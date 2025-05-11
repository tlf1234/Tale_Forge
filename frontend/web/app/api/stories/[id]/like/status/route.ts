import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const storyId = params.id
    
    // 获取认证令牌
    const cookieStore = cookies()
    const token = cookieStore.get('token')?.value
    
    // 如果没有token，返回未点赞状态
    if (!token) {
      return NextResponse.json({ isLiked: false })
    }
    
    // 调用后端 API，使用认证头
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/stories/${storyId}/like/status`,
      {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    )

    return NextResponse.json(await response.json())
  } catch (error: any) {
    console.error('Get like status error:', error)
    return NextResponse.json(
      { error: error.message || '获取点赞状态失败', isLiked: false },
      { status: 500 }
    )
  }
} 