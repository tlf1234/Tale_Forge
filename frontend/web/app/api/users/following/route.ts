import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';


const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// 处理获取用户关注列表的请求
export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2, 10); // 生成请求ID方便跟踪
  
  try {
    console.log(`[${requestId}][用户关注列表API] 开始处理请求:`, {
      url: request.url,
      method: request.method,
      timestamp: new Date().toISOString()
    });
    
    // 获取URL参数
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const address = searchParams.get('address');
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '10';
    
    console.log(`[${requestId}][用户关注列表API] 请求参数详情:`, {
      userId,
      address,
      page,
      limit,
      allParams: Object.fromEntries(searchParams.entries())
    });
    
    // 参数验证
    if (!userId && !address) {
      console.log(`[${requestId}][用户关注列表API] 缺少必要参数: userId或address`);
      return NextResponse.json(
        { error: '必须提供userId或address参数' },
        { status: 400 }
      );
    }
    
    // 获取认证令牌
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;
    
    console.log(`[${requestId}][用户关注列表API] 认证信息:`, {
      hasToken: !!token,
      tokenLength: token?.length,
      cookieNames: Array.from(cookieStore.getAll()).map(c => c.name)
    });
    
    // 构建请求参数
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (address) params.append('address', address);
    params.append('page', page);
    params.append('limit', limit);
    
    // 构建API端点 - 使用userId参数调用后端API
    const targetUserId = userId || 'address'; // 如果没有userId，使用'address'作为占位符
    const backendUrl = `${API_BASE_URL}/api/users/${targetUserId}/following?${params.toString()}`;
    
    console.log(`[${requestId}][用户关注列表API] 转发请求到后端:`, {
      url: backendUrl,
      method: 'GET',
      hasToken: !!token,
      params: params.toString(),
      API_BASE_URL
    });
    
    // 请求后端API
    const startTime = Date.now();
    const response = await fetch(
      backendUrl,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        cache: 'no-store' // 禁用缓存
      }
    );
    const responseTime = Date.now() - startTime;
    
    console.log(`[${requestId}][用户关注列表API] 收到后端响应:`, {
      status: response.status,
      statusText: response.statusText,
      responseTime: `${responseTime}ms`,
      contentType: response.headers.get('content-type'),
      headers: Object.fromEntries(
        response.headers.entries()
      )
    });
    
    // 获取响应数据
    let data;
    try {
      const text = await response.text();
      console.log(`[${requestId}][用户关注列表API] 响应内容片段:`, 
        text.substring(0, 200) + (text.length > 200 ? '...' : ''));
      
      try {
        data = JSON.parse(text);
        console.log(`[${requestId}][用户关注列表API] 响应数据结构:`, {
          hasFollowing: !!data.following,
          followingLength: data.following?.length,
          total: data.total,
          page: data.page,
          pageCount: data.pageCount,
          dataKeys: Object.keys(data)
        });
      } catch (parseError) {
        console.error(`[${requestId}][用户关注列表API] JSON解析失败:`, parseError);
        return NextResponse.json(
          { error: '响应格式错误' },
          { status: 502 }
        );
      }
    } catch (readError) {
      console.error(`[${requestId}][用户关注列表API] 读取响应内容失败:`, readError);
      return NextResponse.json(
        { error: '读取响应失败' },
        { status: 502 }
      );
    }
    
    if (!response.ok) {
      console.error(`[${requestId}][用户关注列表API] 获取失败:`, {
        status: response.status,
        error: data?.error || '未知错误'
      });
      return NextResponse.json(
        { error: data?.error || '获取关注列表失败' },
        { status: response.status }
      );
    }
    
    console.log(`[${requestId}][用户关注列表API] 获取成功:`, {
      total: data.total,
      page: data.page,
      pageCount: data.pageCount,
      followingCount: data.following?.length,
      firstFollowingId: data.following?.[0]?.id || 'N/A'
    });
    
    // 返回处理结果
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[${requestId}][用户关注列表API] 处理异常:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: error.message || '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 处理关注作者的请求
export async function POST(request: NextRequest) {
  try {
    // 获取请求体中的数据
    const body = await request.json();
    const { userId, authorId } = body;
    
    console.log(`[用户关注API] 收到关注请求:`, {
      userId,
      authorId
    });
    
    // 检查authorId的格式
    console.log(`[用户关注API] authorId详情:`, {
      value: authorId,
      type: typeof authorId,
      length: authorId?.length,
      isStartWith0x: authorId?.startsWith('0x'),
      firstFiveChars: authorId?.substring(0, 5)
    });
    
    if (!userId || !authorId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    // 从Cookie中获取认证令牌
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;
    
    console.log(`[用户关注API] 认证信息:`, {
      hasToken: !!token,
      tokenLength: token?.length
    });
    
    if (!token) {
      return NextResponse.json({ error: '需要认证' }, { status: 401 });
    }
    
    // 构建API端点
    const apiUrl = `${API_BASE_URL}/api/users/${userId}/following/${authorId}`;
    
    console.log(`[用户关注API] 发送后端请求:`, {
      url: apiUrl,
      method: 'POST',
      userId,
      authorId,
      API_BASE_URL
    });
    
    // 发送请求到后端
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });
    
    console.log(`[用户关注API] 收到后端响应:`, {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      url: response.url
    });
    
    // 处理响应
    if (!response.ok) {
      let error;
      try {
        error = await response.json();
        console.error(`[用户关注API] 后端返回错误(JSON):`, error);
      } catch (e) {
        // 如果响应不是JSON格式
        const text = await response.text();
        console.error(`[用户关注API] 响应不是JSON:`, text.substring(0, 200));
        error = { error: '服务器返回了非JSON响应' };
      }
      
      console.error(`[用户关注API] 后端返回错误状态码:`, response.status);
      return NextResponse.json(
        { error: error.error || '关注作者失败' }, 
        { status: response.status }
      );
    }
    
    let data;
    try {
      data = await response.json();
      console.log(`[用户关注API] 关注成功:`, data);
    } catch (e) {
      console.error(`[用户关注API] 解析成功响应失败:`, e);
      data = { success: true };
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[用户关注API] 服务器错误:', error);
    console.error('[用户关注API] 错误堆栈:', error.stack);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}

// 处理取消关注作者的请求
export async function DELETE(request: NextRequest) {
  try {
    // 从URL中获取查询参数
    const searchParams = request.nextUrl.searchParams;
    let userId = searchParams.get('userId');
    let authorId = searchParams.get('authorId');
    
    // 如果URL中没有参数，尝试从请求体中获取
    if (!userId || !authorId) {
      try {
        const body = await request.json();
        userId = body.userId || userId;
        authorId = body.authorId || authorId;
        
        console.log(`[用户取消关注API] 从请求体获取参数:`, {
          userId,
          authorId
        });
      } catch (e) {
        console.error(`[用户取消关注API] 解析请求体失败:`, e);
      }
    }
    
    console.log(`[用户取消关注API] 收到取消关注请求:`, {
      userId,
      authorId
    });
    
    // 检查authorId的格式
    console.log(`[用户取消关注API] authorId详情:`, {
      value: authorId,
      type: typeof authorId,
      length: authorId?.length,
      isStartWith0x: authorId?.startsWith('0x'),
      firstFiveChars: authorId?.substring(0, 5)
    });
    
    if (!userId || !authorId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    // 从Cookie中获取认证令牌
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;
    
    console.log(`[用户取消关注API] 认证信息:`, {
      hasToken: !!token,
      tokenLength: token?.length
    });
    
    if (!token) {
      return NextResponse.json({ error: '需要认证' }, { status: 401 });
    }
    
    // 构建API端点
    const apiUrl = `${API_BASE_URL}/api/users/${userId}/following/${authorId}`;
    
    console.log(`[用户取消关注API] 发送后端请求:`, {
      url: apiUrl,
      method: 'DELETE',
      userId,
      authorId,
      API_BASE_URL
    });
    
    // 发送请求到后端
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });
    
    console.log(`[用户取消关注API] 收到后端响应:`, {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      url: response.url
    });
    
    // 处理响应
    if (!response.ok) {
      let error;
      try {
        error = await response.json();
        console.error(`[用户取消关注API] 后端返回错误(JSON):`, error);
      } catch (e) {
        // 如果响应不是JSON格式
        const text = await response.text();
        console.error(`[用户取消关注API] 响应不是JSON:`, text.substring(0, 200));
        error = { error: '服务器返回了非JSON响应' };
      }
      
      console.error(`[用户取消关注API] 后端返回错误状态码:`, response.status);
      return NextResponse.json(
        { error: error.error || '取消关注作者失败' }, 
        { status: response.status }
      );
    }
    
    let data;
    try {
      data = await response.json();
      console.log(`[用户取消关注API] 取消关注成功:`, data);
    } catch (e) {
      console.error(`[用户取消关注API] 解析成功响应失败:`, e);
      data = { success: true };
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[用户取消关注API] 服务器错误:', error);
    console.error('[用户取消关注API] 错误堆栈:', error.stack);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
} 