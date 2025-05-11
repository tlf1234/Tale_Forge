import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// 点赞故事
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const storyId = params.id
    
    // 获取认证令牌
    const cookieStore = cookies()
    const token = cookieStore.get('token')?.value
    
    if (!token) {
      return NextResponse.json(
        { error: '未认证，请先登录' },
        { status: 401 }
      )
    }
    
    // 调用后端 API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/stories/${storyId}/like`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    )
    
    return NextResponse.json(await response.json())
  } catch (error: any) {
    console.error('Like story error:', error)
    return NextResponse.json(
      { error: error.message || '点赞失败' },
      { status: 500 }
    )
  }
}

// 取消点赞故事
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const storyId = params.id
    
    // 获取认证令牌
    const cookieStore = cookies()
    const token = cookieStore.get('token')?.value
    
    if (!token) {
      return NextResponse.json(
        { error: '未认证，请先登录' },
        { status: 401 }
      )
    }
    
    // 调用后端 API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/stories/${storyId}/like`,
      {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    )
    
    return NextResponse.json(await response.json())
  } catch (error: any) {
    console.error('Unlike story error:', error)
    return NextResponse.json(
      { error: error.message || '取消点赞失败' },
      { status: 500 }
    )
  }
} 