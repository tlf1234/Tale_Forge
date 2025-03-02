import { NextResponse } from 'next/server'
import { CONTRACT_ABIS, CONTRACT_ADDRESSES } from '@/constants/abi'

interface Story {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  author: string;
  authorId: string;
  authorAvatar: string;
  category: string;
  stats: {
    likes: number;
    comments: number;
    views: number;
  };
  createdAt: string;
  updatedAt: string;
}

// 获取故事列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    // 转发请求到后端服务
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stories?${searchParams}`)
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 500 })
  }
}

// 创建新故事
export async function POST(request: Request) {
  try {
    const data = await request.json()
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return NextResponse.json(await response.json())
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create story' }, { status: 500 })
  }
}
