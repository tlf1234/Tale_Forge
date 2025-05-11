// 导入必要的依赖
import { NextRequest, NextResponse } from 'next/server'

// 后端API基础URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * 处理获取用户评论历史的请求
 * 代理到后端API并返回结果
 */
export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2, 10); // 生成请求ID方便跟踪
  console.log(`[${requestId}][前端API-评论历史] 开始处理请求:`, {
    url: request.url,
    headers: {
      authorization: request.headers.get('Authorization') ? '存在' : '不存在',
      'content-type': request.headers.get('Content-Type'),
      'user-agent': request.headers.get('User-Agent')?.substring(0, 50) + '...',
    },
    timestamp: new Date().toISOString()
  });
  
  try {
    // 获取URL参数
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const address = searchParams.get('address')
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '10'

    console.log(`[${requestId}][前端API-评论历史] 请求参数:`, {
      userId,
      address,
      page,
      limit
    });

    // 参数验证
    if (!userId && !address) {
      console.log(`[${requestId}][前端API-评论历史] 缺少必要参数: userId或address`);
      return NextResponse.json(
        { error: '必须提供userId或address参数' },
        { status: 400 }
      )
    }

    // 获取认证令牌 - 从Authorization header获取
    const authorization = request.headers.get('Authorization')
    const token = authorization?.startsWith('Bearer ') 
      ? authorization.substring(7) 
      : null

    console.log(`[${requestId}][前端API-评论历史] 认证信息:`, {
      hasAuthorization: !!authorization,
      hasToken: !!token,
      tokenLength: token?.length
    });

    // 构建请求参数
    const params = new URLSearchParams()
    if (userId) params.append('userId', userId)
    if (address) params.append('address', address)
    params.append('page', page)
    params.append('limit', limit)

    const backendUrl = `${API_BASE_URL}/api/user/comments?${params.toString()}`;
    console.log(`[${requestId}][前端API-评论历史] 转发请求到后端:`, {
      url: backendUrl,
      method: 'GET',
      hasToken: !!token
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
    )
    const responseTime = Date.now() - startTime;

    console.log(`[${requestId}][前端API-评论历史] 收到后端响应:`, {
      status: response.status,
      statusText: response.statusText,
      responseTime: `${responseTime}ms`,
      contentType: response.headers.get('content-type')
    });

    // 获取响应数据
    let data;
    try {
      const text = await response.text();
      console.log(`[${requestId}][前端API-评论历史] 响应内容片段:`, 
        text.substring(0, 200) + (text.length > 200 ? '...' : ''));
      
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error(`[${requestId}][前端API-评论历史] JSON解析失败:`, parseError);
        return NextResponse.json(
          { error: '响应格式错误' },
          { status: 502 }
        );
      }
    } catch (readError) {
      console.error(`[${requestId}][前端API-评论历史] 读取响应内容失败:`, readError);
      return NextResponse.json(
        { error: '读取响应失败' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error(`[${requestId}][前端API-评论历史] 获取失败:`, {
        status: response.status,
        error: data?.error || '未知错误'
      });
      return NextResponse.json(
        { error: data?.error || '获取评论历史失败' },
        { status: response.status }
      )
    }

    console.log(`[${requestId}][前端API-评论历史] 获取成功:`, {
      total: data.total,
      page: data.page,
      pageCount: data.pageCount,
      commentsCount: data.comments?.length,
      firstCommentId: data.comments?.length > 0 ? data.comments[0].id : null,
      lastCommentId: data.comments?.length > 0 ? data.comments[data.comments.length - 1].id : null
    });

    // 返回处理结果
    return NextResponse.json(data)
  } catch (error) {
    console.error(`[${requestId}][前端API-评论历史] 处理异常:`, error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
} 