import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: Request,
  { params }: { params: { address: string } }
) {
  try {
    const url = new URL(request.url)
    const storyId = url.searchParams.get('storyId')
    
    if (!storyId) {
      return NextResponse.json(
        { error: 'Story ID is required' },
        { status: 400 }
      )
    }
    
    // 根据钱包地址找到用户
    const user = await prisma.user.findUnique({
      where: { address: params.address },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 检查故事是否在用户的收藏中
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_storyId: {
          userId: user.id,
          storyId: storyId
        }
      }
    })

    return NextResponse.json({
      isBookmarked: !!favorite
    })
  } catch (error) {
    console.error('Error checking favorite status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
} 