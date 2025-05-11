import { NextRequest, NextResponse } from 'next/server'
import { withAuth, buildAuthParams, buildAuthHeaders } from '@/middleware/authMiddleware'

async function getBookshelf(request: NextRequest, authInfo: any) {
  try {
    console.log('[前端-书架API] 开始处理请求:', {
      url: request.url,
      authInfo: {
        hasAddress: !!authInfo.address,
        hasUserId: !!authInfo.userId,
        hasToken: !!authInfo.token
      }
    })
    
    // 获取请求参数
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    // 构建API请求参数
    const queryParams = buildAuthParams(authInfo)
    queryParams.append('page', page.toString())
    queryParams.append('limit', limit.toString())
    
    // 构建请求头
    const headers = buildAuthHeaders(authInfo)
    
    console.log('[前端-书架API] 请求参数:', {
      params: queryParams.toString(),
      hasAuthHeader: !!headers['Authorization']
    })
    
    // 调用后端API
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    
    // 打印完整的请求URL，帮助调试
    const apiUrl = `${backendUrl}/api/user/bookshelf?${queryParams.toString()}`
    console.log('[前端-书架API] 请求URL:', apiUrl)
    
    // 发起请求到后端
    const response = await fetch(apiUrl, {
      headers,
      method: 'GET'
    })
    
    console.log('[前端-书架API] 后端响应状态:', response.status)
    
    // 尝试解析响应体
    let data
    try {
      data = await response.json()
      console.log('[前端-书架API] 后端响应数据类型:', typeof data)
    } catch (parseError) {
      console.error('[前端-书架API] 解析响应失败:', parseError)
      return NextResponse.json(
        { error: '无法解析服务器响应' },
        { status: 500 }
      )
    }
    
    console.log('[前端-书架API] 后端响应:', {
      status: response.status,
      ok: response.ok,
      dataKeys: Object.keys(data || {}),
      hasError: !!data?.error
    })
    
    if (!response.ok) {
      console.error('[前端-书架API] 请求失败:', {
        status: response.status,
        error: data?.error
      })
      return NextResponse.json(
        { error: data?.error || '获取书架数据失败' },
        { status: response.status }
      )
    }
    
    console.log('[前端-书架API] 请求成功:', {
      totalItems: data?.items?.length,
      totalPages: data?.totalPages
    })
    
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[前端-书架API] 请求异常:', {
      error: error.message,
      stack: error.stack
    })
    return NextResponse.json(
      { error: error.message || '获取书架数据失败' },
      { status: 500 }
    )
  }
}

// 使用中间件包装处理函数
export const GET = withAuth(getBookshelf)