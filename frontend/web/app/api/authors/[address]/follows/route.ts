import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 获取作者的关注者列表
export async function GET(
  request: Request,
  { params }: { params: { address: string } }
) {
  try {
    const author = await prisma.user.findUnique({
      where: { address: params.address },
      include: {
        followers: {
          include: {
            follower: true
          }
        },
        following: {
          include: {
            following: true
          }
        }
      }
    })

    if (!author) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      followers: author.followers.map(f => ({
        id: f.follower.id,
        address: f.follower.address,
        nickname: f.follower.nickname,
        avatar: f.follower.avatar,
        authorName: f.follower.authorName,
        isAuthor: f.follower.isAuthor,
        followedAt: f.createdAt
      })),
      following: author.following.map(f => ({
        id: f.following.id,
        address: f.following.address,
        nickname: f.following.nickname,
        avatar: f.following.avatar,
        authorName: f.following.authorName,
        isAuthor: f.following.isAuthor,
        followedAt: f.createdAt
      }))
    })
  } catch (error) {
    console.error('Failed to fetch followers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch followers' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// 关注作者
export async function POST(
  request: Request,
  { params }: { params: { address: string } }
) {
  try {
    const data = await request.json()
    const followerAddress = data.followerAddress

    if (!followerAddress) {
      return NextResponse.json(
        { error: 'Missing follower address' },
        { status: 400 }
      )
    }

    // 获取关注者和被关注者
    const [follower, following] = await Promise.all([
      prisma.user.findUnique({ where: { address: followerAddress } }),
      prisma.user.findUnique({ where: { address: params.address } })
    ])

    if (!follower || !following) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 创建关注关系
    const follow = await prisma.follow.create({
      data: {
        followerId: follower.id,
        followingId: following.id
      },
      include: {
        following: true
      }
    })

    return NextResponse.json({
      id: follow.following.id,
      address: follow.following.address,
      nickname: follow.following.nickname,
      avatar: follow.following.avatar,
      authorName: follow.following.authorName,
      isAuthor: follow.following.isAuthor,
      followedAt: follow.createdAt
    })
  } catch (error) {
    if ((error as any).code === 'P2002') {
      return NextResponse.json(
        { error: 'Already following this author' },
        { status: 400 }
      )
    }
    console.error('Failed to follow author:', error)
    return NextResponse.json(
      { error: 'Failed to follow author' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// 取消关注作者
export async function DELETE(
  request: Request,
  { params }: { params: { address: string } }
) {
  try {
    const data = await request.json()
    const followerAddress = data.followerAddress

    if (!followerAddress) {
      return NextResponse.json(
        { error: 'Missing follower address' },
        { status: 400 }
      )
    }

    // 获取关注者和被关注者
    const [follower, following] = await Promise.all([
      prisma.user.findUnique({ where: { address: followerAddress } }),
      prisma.user.findUnique({ where: { address: params.address } })
    ])

    if (!follower || !following) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 删除关注关系
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: follower.id,
          followingId: following.id
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return NextResponse.json(
        { error: 'Not following this author' },
        { status: 400 }
      )
    }
    console.error('Failed to unfollow author:', error)
    return NextResponse.json(
      { error: 'Failed to unfollow author' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
