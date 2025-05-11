import { NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// 根据用户ID获取用户信息
export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const requestId = Math.random().toString(36).substring(2, 8)
  console.log(`[GET /api/users/profile/:userId][${requestId}] 收到请求:`, {
    url: request.url,
    userId: params.userId,
    timestamp: new Date().toISOString()
  })
  
  try {
    // 从Authorization header获取token
    const authorization = request.headers.get('Authorization')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (authorization) {
      headers['Authorization'] = authorization
      console.log(`[GET /api/users/profile/:userId][${requestId}] 包含认证头:`, {
        authType: authorization.startsWith('Bearer ') ? 'Bearer' : 'Other',
        authLength: authorization.length
      })
    } else {
      console.log(`[GET /api/users/profile/:userId][${requestId}] 未提供认证头`)
    }
    
    // 构建完整的API URL
    const apiUrl = `${API_BASE_URL}/api/users/profile/${params.userId}`
    console.log(`[GET /api/users/profile/:userId][${requestId}] 准备调用后端API:`, {
      apiUrl,
      method: 'GET',
      headers: Object.keys(headers)
    })
    
    // 调用后端API获取用户信息
    console.log(`[GET /api/users/profile/:userId][${requestId}] 开始请求后端API`)
    const startTime = Date.now()
    
    const response = await fetch(
      apiUrl,
      {
        headers,
        cache: 'no-store'
      }
    )
    
    const responseTime = Date.now() - startTime
    console.log(`[GET /api/users/profile/:userId][${requestId}] 后端API响应:`, {
      status: response.status,
      statusText: response.statusText,
      responseTime: `${responseTime}ms`
    })
    
    if (!response.ok) {
      console.error(`[GET /api/users/profile/:userId][${requestId}] 后端API请求失败:`, {
        status: response.status,
        statusText: response.statusText
      })
      
      // 尝试读取错误响应
      let errorData = '未知错误'
      try {
        const errorResponse = await response.text()
        errorData = errorResponse
        console.error(`[GET /api/users/profile/:userId][${requestId}] 错误响应内容:`, errorResponse)
      } catch (e) {
        console.error(`[GET /api/users/profile/:userId][${requestId}] 无法读取错误响应内容`)
      }
      
      return NextResponse.json(
        { error: '获取用户信息失败', details: errorData },
        { status: response.status }
      )
    }
    
    // 解析响应数据
    const userData = await response.json()
    console.log(`[GET /api/users/profile/:userId][${requestId}] 后端返回的用户数据:`, {
      id: userData.id,
      hasAddress: !!userData.address,
      hasNickname: !!userData.nickname,
      hasAuthorName: !!userData.authorName,
      hasAvatar: !!userData.avatar,
      isAuthor: !!userData.isAuthor,
      hasEmail: !!userData.email
    })
    
    // 确保数据格式符合前端需求
    const formattedUser = {
      id: userData.id,
      address: userData.address,
      nickname: userData.nickname || userData.authorName || '用户',
      authorName: userData.authorName,
      avatar: userData.avatar || '/images/avatars/default-avatar.svg',
      bio: userData.bio || '',
      isAuthor: userData.isAuthor || false,
      email: userData.email,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt
    }
    
    console.log(`[GET /api/users/profile/:userId][${requestId}] 处理后的用户数据:`, {
      id: formattedUser.id,
      nickname: formattedUser.nickname,
      authorName: formattedUser.authorName,
      hasAvatar: !!formattedUser.avatar && formattedUser.avatar !== '/images/avatars/default-avatar.svg',
      isAuthor: formattedUser.isAuthor
    })
    
    return NextResponse.json(formattedUser)
  } catch (error) {
    console.error(`[GET /api/users/profile/:userId][${requestId}] 处理异常:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return NextResponse.json(
      { error: '获取用户信息失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
} 