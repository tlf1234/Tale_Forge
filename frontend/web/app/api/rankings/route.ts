import { NextRequest } from 'next/server'

// 获取榜单数据
export async function GET(request: NextRequest) {
  const traceId = Math.random().toString(36).substring(2, 8)
  console.log(`[${traceId}][GET /api/rankings] 开始处理请求:`, {
    url: request.url
  })

  try {
    // 获取查询参数
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'authors' // 榜单类型: authors, works, nft
    const sortBy = searchParams.get('sortBy') || 'earnings' // 排序方式: earnings, readers, works, likes 等
    const timeRange = searchParams.get('timeRange') || 'weekly' // 时间范围: weekly, monthly, yearly, all
    
    console.log(`[${traceId}][GET /api/rankings] 请求参数:`, { type, sortBy, timeRange })

    // 向后端发送请求
    const queryParams = new URLSearchParams({
      type,
      sortBy,
      timeRange
    }).toString()

    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/rankings?${queryParams}`
    console.log(`[${traceId}][GET /api/rankings] 请求后端:`, apiUrl)

    // 设置10秒超时，防止请求长时间挂起
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    try {
      const response = await fetch(apiUrl, { 
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      // 清除超时
      clearTimeout(timeoutId)
      
      console.log(`[${traceId}][GET /api/rankings] 后端响应状态:`, response.status)

      // 处理非200响应
      if (!response.ok) {
        let errorMessage = `后端API错误: ${response.status}`
        
        try {
          // 尝试获取错误信息
          const errorBody = await response.text()
          console.error(`[${traceId}][GET /api/rankings] 后端返回错误:`, errorBody)
          
          // 如果是JSON格式的错误信息，提取错误消息
          if (errorBody.startsWith('{')) {
            const errorData = JSON.parse(errorBody)
            errorMessage = errorData.message || errorData.error || errorMessage
          }
        } catch (e) {
          console.error(`[${traceId}][GET /api/rankings] 解析错误信息失败:`, e)
        }
        
        return Response.json(
          { error: errorMessage },
          { status: response.status }
        )
      }

      // 处理成功响应
      const data = await response.json()
      console.log(`[${traceId}][GET /api/rankings] 成功获取数据:`, {
        items: data.items?.length || 0,
        totalItems: data.total || 0
      })

      // 验证响应数据结构
      if (!data.items || !Array.isArray(data.items)) {
        console.error(`[${traceId}][GET /api/rankings] 响应数据格式错误:`, data)
        return Response.json(
          { error: '响应数据格式错误' },
          { status: 500 }
        )
      }

      return Response.json(data)
    } catch (error) {
      console.error(`[${traceId}][GET /api/rankings] 后端API请求失败:`, error)
      
      // 区分超时和其他错误
      const errorMessage = error instanceof DOMException && error.name === 'AbortError'
        ? '请求超时，请稍后重试'
        : '获取榜单数据失败，后端服务可能暂时不可用'
      
      return Response.json(
        { error: errorMessage },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error(`[${traceId}][GET /api/rankings] 请求处理失败:`, error)
    return Response.json(
      { error: '获取榜单数据失败，请稍后重试' },
      { status: 500 }
    )
  }
} 