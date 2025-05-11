import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * 从请求中提取认证信息
 * 支持从query参数、请求头和cookies中获取认证信息
 */
export function extractAuthInfo(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // 从query参数中获取
  const addressFromQuery = searchParams.get('address');
  const userIdFromQuery = searchParams.get('userId');
  const tokenFromQuery = searchParams.get('token');
  
  // 从请求头中获取
  const authHeader = request.headers.get('authorization');
  const tokenFromHeader = authHeader?.startsWith('Bearer ') 
    ? authHeader.replace('Bearer ', '') 
    : authHeader;
  
  // 从cookies中获取
  const cookieStore = cookies();
  const tokenFromCookie = cookieStore.get('token')?.value;
  const userIdFromCookie = cookieStore.get('userId')?.value;
  const addressFromCookie = cookieStore.get('address')?.value;
  
  // 构建认证对象
  const authInfo = {
    address: addressFromQuery || addressFromCookie || undefined,
    userId: userIdFromQuery || userIdFromCookie || undefined,
    token: tokenFromQuery || tokenFromHeader || tokenFromCookie || undefined
  };
  
  return authInfo;
}

/**
 * 认证中间件
 * 验证请求是否包含有效的认证信息
 * 至少需要包含address、userId或token中的一个
 * 如果只有token，尝试从token解析用户信息
 */
export function withAuth(handler: Function) {
  return async (request: NextRequest) => {
    try {
      const authInfo = extractAuthInfo(request);
      
      console.log('[AUTH MIDDLEWARE] 提取到的认证信息:', {
        hasAddress: !!authInfo.address,
        hasUserId: !!authInfo.userId,
        hasToken: !!authInfo.token,
        tokenLength: authInfo.token ? authInfo.token.length : 0
      });
      
      // 检查是否有任何认证信息
      if (!authInfo.address && !authInfo.userId && !authInfo.token) {
        console.log('[AUTH MIDDLEWARE] 未提供任何认证信息');
        return NextResponse.json(
          { error: '未授权，请提供认证信息' },
          { status: 401 }
        );
      }
      
      // 如果有token但没有userId或address，尝试从token解析
      if (authInfo.token && !authInfo.userId && !authInfo.address) {
        console.log('[AUTH MIDDLEWARE] 只有token，尝试解析用户信息');
        
        try {
          // 尝试从token中解析用户信息
          // 注意：这是一个示例，实际应根据token格式进行解析
          const tokenParts = authInfo.token.split('.');
          if (tokenParts.length === 3) {
            try {
              // JWT token，解码payload部分
              const payload = JSON.parse(atob(tokenParts[1]));
              console.log('[AUTH MIDDLEWARE] 解析JWT成功:', payload);
              
              // 从payload中提取用户ID
              if (payload.id || payload.userId || payload.sub) {
                authInfo.userId = payload.id || payload.userId || payload.sub;
                console.log('[AUTH MIDDLEWARE] 从token提取到userId:', authInfo.userId);
              }
              
              // 从payload中提取地址
              if (payload.address) {
                authInfo.address = payload.address;
                console.log('[AUTH MIDDLEWARE] 从token提取到address:', authInfo.address);
              }
            } catch (err) {
              console.error('[AUTH MIDDLEWARE] JWT解析失败:', err);
            }
          }
          
          // 如果还是没有用户信息，尝试验证token
          if (!authInfo.userId && !authInfo.address) {
            console.log('[AUTH MIDDLEWARE] 从token中无法提取用户信息，尝试验证token');
            
            // 向后端发送验证请求
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const verifyUrl = `${backendUrl}/api/auth/verify`;
            
            const verifyResponse = await fetch(verifyUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authInfo.token}`
              }
            });
            
            if (verifyResponse.ok) {
              const userData = await verifyResponse.json();
              console.log('[AUTH MIDDLEWARE] Token验证成功，获取到用户信息:', userData);
              
              if (userData.userId || userData.id) {
                authInfo.userId = userData.userId || userData.id;
              }
              
              if (userData.address) {
                authInfo.address = userData.address;
              }
            } else {
              console.error('[AUTH MIDDLEWARE] Token验证失败:', await verifyResponse.text());
            }
          }
        } catch (parseError) {
          console.error('[AUTH MIDDLEWARE] 解析token失败:', parseError);
        }
      }
      
      // 记录最终的认证信息
      console.log('[AUTH MIDDLEWARE] 最终认证信息:', {
        hasAddress: !!authInfo.address,
        hasUserId: !!authInfo.userId,
        hasToken: !!authInfo.token
      });
      
      // 认证信息存在，传递给处理函数
      return handler(request, authInfo);
    } catch (error) {
      console.error('[AUTH MIDDLEWARE] 处理请求时发生错误:', error);
      return NextResponse.json(
        { error: '处理请求时发生错误' },
        { status: 500 }
      );
    }
  };
}

/**
 * 构建后端API认证请求参数
 */
export function buildAuthParams(authInfo: {
  address?: string;
  userId?: string;
  token?: string;
}) {
  const params = new URLSearchParams();
  
  if (authInfo.address) params.append('address', authInfo.address);
  if (authInfo.userId) params.append('userId', authInfo.userId);
  if (authInfo.token) params.append('token', authInfo.token);
  
  return params;
}

/**
 * 构建后端API认证请求头
 */
export function buildAuthHeaders(authInfo: {
  address?: string;
  userId?: string;
  token?: string;
}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (authInfo.token) {
    headers['Authorization'] = `Bearer ${authInfo.token}`;
  }
  
  return headers;
} 