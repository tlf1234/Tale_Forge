import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/middleware/authMiddleware'

// 获取用户阅读历史
async function getReadingHistory(request: NextRequest, authInfo: any) {
  try {
    console.log('[通用阅读历史API] 开始处理请求:', {
      url: request.url,
      authInfo: {
        hasAddress: !!authInfo.address,
        hasUserId: !!authInfo.userId,
        hasToken: !!authInfo.token
      }
    })
    
    // 验证必要的身份信息
    if (!authInfo.userId && !authInfo.address) {
      console.error('[通用阅读历史API] 错误: 缺少用户标识')
      return NextResponse.json(
        { error: '缺少必要参数: userId 或 address' },
        { status: 400 }
      )
    }

    // 构建转发到后端API的参数
    const searchParams = request.nextUrl.searchParams
    const params = new URLSearchParams()
    
    // 存储已添加的参数名，避免重复添加
    const addedParams = new Set<string>()
    
    // 复制原始参数，但排除userId和address，后面会单独处理
    searchParams.forEach((value, key) => {
      if (key !== 'userId' && key !== 'address') {
        params.append(key, value)
        addedParams.add(key)
      }
    })
    
    // 添加认证参数，确保不重复添加
    if (authInfo.userId && !addedParams.has('userId')) {
      params.append('userId', authInfo.userId)
      addedParams.add('userId')
    }
    if (authInfo.address && !addedParams.has('address')) {
      params.append('address', authInfo.address)
      addedParams.add('address')
    }
    
    // 再次检查是否添加了用户标识
    if (!params.has('userId') && !params.has('address')) {
      console.error('[通用阅读历史API] 错误: 参数中缺少用户标识')
      return NextResponse.json(
        { error: '缺少必要参数: userId 或 address' },
        { status: 400 }
      )
    }
    
    // 构建后端API URL
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const apiUrl = `${backendUrl}/api/user/reading-history?${params.toString()}`
    
    console.log('[通用阅读历史API] 转发请求到:', apiUrl)
    
    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (authInfo.token) {
      headers['Authorization'] = `Bearer ${authInfo.token}`
    }
    
    // 发送请求到后端
    const response = await fetch(apiUrl, { headers })
    
    // 获取响应
    const data = await response.json()
    
    if (!response.ok) {
      console.error('[通用阅读历史API] 后端响应错误:', {
        status: response.status, 
        data
      })
      return NextResponse.json(
        { error: data.error || '获取阅读历史失败' },
        { status: response.status }
      )
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('[通用阅读历史API] 请求异常:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

// 更新阅读历史
async function updateReadingHistory(request: NextRequest, authInfo: any) {
  try {
    console.log('[通用阅读历史API] 开始处理更新请求:', {
      authInfo: {
        hasAddress: !!authInfo.address,
        hasUserId: !!authInfo.userId,
        hasToken: !!authInfo.token
      }
    })
    
    // 验证必要的身份信息
    if (!authInfo.userId && !authInfo.address) {
      console.error('[通用阅读历史API] 错误: 缺少用户标识')
      return NextResponse.json(
        { error: '缺少必要参数: userId 或 address' },
        { status: 400 }
      )
    }
    
    // 读取请求体
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      console.error('[通用阅读历史API] 解析请求体失败:', error)
      return NextResponse.json(
        { error: '无效的请求数据' },
        { status: 400 }
      )
    }
    
    // 验证请求体有必要的数据
    if (!requestBody || !requestBody.storyId || !requestBody.chapterOrder) {
      console.error('[通用阅读历史API] 错误: 缺少必要参数', requestBody)
      return NextResponse.json(
        { error: '缺少必要参数: storyId 或 chapterOrder' },
        { status: 400 }
      )
    }
    
    // 构建后端API URL
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const apiUrl = `${backendUrl}/api/user/reading-history`
    
    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (authInfo.token) {
      headers['Authorization'] = `Bearer ${authInfo.token}`
    }
    
    // 添加认证信息到请求体，优先使用authInfo中的值
    const body = {
      ...requestBody,
      userId: authInfo.userId || requestBody.userId,
      address: authInfo.address || requestBody.address
    }
    
    // 再次检查是否有用户标识
    if (!body.userId && !body.address) {
      console.error('[通用阅读历史API] 错误: 请求体中缺少用户标识')
      return NextResponse.json(
        { error: '缺少必要参数: userId 或 address' },
        { status: 400 }
      )
    }
    
    console.log('[通用阅读历史API] 向后端发送请求:', {
      url: apiUrl,
      headers: Object.keys(headers),
      body: {
        storyId: body.storyId,
        chapterOrder: body.chapterOrder,
        hasUserId: !!body.userId,
        hasAddress: !!body.address
      }
    })
    
    // 发送请求到后端
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    
    // 获取响应
    const data = await response.json()
    
    if (!response.ok) {
      console.error('[通用阅读历史API] 更新失败:', {
        status: response.status, 
        data
      })
      return NextResponse.json(
        { error: data.error || '更新阅读历史失败' },
        { status: response.status }
      )
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('[通用阅读历史API] 更新请求异常:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

// 使用中间件包装处理函数
export const GET = withAuth((request: NextRequest, authInfo: any) => getReadingHistory(request, authInfo))
export const POST = withAuth((request: NextRequest, authInfo: any) => updateReadingHistory(request, authInfo)) 