import { NextResponse } from 'next/server'
import { PrismaClient, User } from '@prisma/client'

const prisma = new PrismaClient()

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

export async function GET(
  request: Request,
  { params }: { params: { address: string } }
) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/authors/${params.address}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'API request failed')
    }
    return NextResponse.json(await response.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch author: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { address: string } }
) {
  try {
    const data = await request.json()
    
    // 先更新基本信息，使用upsert确保用户存在
    const author = await prisma.user.upsert({
      where: {
        address: params.address,
      },
      create: {
        address: params.address,
        authorName: data.penName,
        bio: data.bio,
        avatar: data.avatar || '',
        isAuthor: true,
        email: data.email
      },
      update: {
        authorName: data.penName,
        bio: data.bio,
        avatar: data.avatar || '',
        isAuthor: true,
        email: data.email
      }
    })

    return NextResponse.json(author)
  } catch (error) {
    console.error('Failed to update author:', error)
    return NextResponse.json(
      { error: 'Failed to update author: ' + (error as Error).message },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
