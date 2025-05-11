import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(
  request: Request,
  { params }: { params: { address: string } }
) {
  try {
    const body = await request.json()
    const { storyId, progress } = body
    
    if (!storyId) {
      return NextResponse.json(
        { error: 'Story ID is required' },
        { status: 400 }
      )
    }
    
    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      return NextResponse.json(
        { error: 'Progress must be a number between 0 and 100' },
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

    if (!favorite) {
      return NextResponse.json(
        { error: 'Story not in favorites' },
        { status: 404 }
      )
    }

    // 更新阅读进度
    const updatedFavorite = await prisma.favorite.update({
      where: {
        id: favorite.id
      },
      data: {
        readingProgress: progress
      }
    })

    return NextResponse.json({
      success: true,
      favorite: updatedFavorite
    })
  } catch (error) {
    console.error('Error updating reading progress:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
} 