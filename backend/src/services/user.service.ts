import prisma from '../prisma'
import { uploadImageToIPFS } from '../ipfs'
import type { User, Story, Like, Favorite, Transaction, Prisma } from '@prisma/client'

export interface UpdateUserInput {
  nickname?: string
  avatar?: File
  bio?: string
  authorName?: string
  socialLinks?: {
    twitter?: string
    discord?: string
    website?: string
  }
}

export class UserService {
  /**
   * 创建用户
   */
  async createUser(data: {
    address: string
    penName?: string
    bio?: string
    avatar?: string
    email?: string
  }): Promise<User> {
    return await prisma.user.create({
      data: {
        address: data.address,
        authorName: data.penName,
        bio: data.bio,
        avatar: data.avatar,
        email: data.email,
        isAuthor: true
      }
    })
  }

  /**
   * 创建或获取用户
   */
  async getOrCreateUser(address: string): Promise<User> {
    return await prisma.user.upsert({
      where: { address },
      update: {},
      create: { address }
    })
  }

  /**
   * 更新用户信息
   */
  async updateUser(id: string, data: {
    nickname?: string
    avatar?: File
    bio?: string
    email?: string
    socialLinks?: {
      twitter?: string
      discord?: string
      website?: string
    }
  }) {
    const updateData: Prisma.UserUpdateInput = {}

    if (data.avatar) {
      updateData.avatar = await uploadImageToIPFS(data.avatar)
    }

    Object.assign(updateData, {
      nickname: data.nickname,
      bio: data.bio,
      email: data.email,
      socialLinks: data.socialLinks
    })

    return await prisma.user.update({
      where: { id },
      data: updateData
    })
  }

  /**
   * 获取用户信息
   */
  async getUser(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            stories: true,
            followers: true,
            following: true
          }
        }
      }
    })
  }

  /**
   * 关注用户
   */
  async followUser(followerId: string, followingId: string) {
    return await prisma.follow.create({
      data: {
        followerId,
        followingId
      }
    })
  }

  /**
   * 取消关注
   */
  async unfollowUser(followerId: string, followingId: string) {
    return await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId
        }
      }
    })
  }

  /**
   * 获取用户的关注者
   */
  async getFollowers(userId: string, skip = 0, take = 10) {
    const [total, followers] = await Promise.all([
      prisma.follow.count({
        where: { followingId: userId }
      }),
      prisma.follow.findMany({
        where: { followingId: userId },
        skip,
        take,
        include: {
          follower: true
        }
      })
    ])

    return {
      followers: followers.map(f => f.follower),
      total
    }
  }

  /**
   * 获取用户关注的人
   */
  async getFollowing(userId: string, skip = 0, take = 10) {
    const [total, following] = await Promise.all([
      prisma.follow.count({
        where: { followerId: userId }
      }),
      prisma.follow.findMany({
        where: { followerId: userId },
        skip,
        take,
        include: {
          following: true
        }
      })
    ])

    return {
      following: following.map(f => f.following),
      total
    }
  }

  /**
   * 获取用户创作的故事
   */
  async getUserStories(userId: string, params: {
    status?: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'SUSPENDED'
    skip?: number
    take?: number
  }) {
    const { status, skip = 0, take = 10 } = params

    const where = {
      authorId: userId,
      ...(status && { status })
    }

    const [total, stories] = await Promise.all([
      prisma.story.count({ where }),
      prisma.story.findMany({
        where,
        skip,
        take,
        include: {
          _count: {
            select: {
              likes: true,
              comments: true,
              favorites: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    ])

    return { stories, total }
  }

  /**
   * 获取用户收藏的故事
   */
  async getUserFavorites(userId: string, params: {
    skip?: number
    take?: number
  }): Promise<{ total: number; favorites: (Favorite & { story: Story })[] }> {
    const { skip = 0, take = 10 } = params

    const [total, favorites] = await Promise.all([
      prisma.favorite.count({
        where: { userId },
      }),
      prisma.favorite.findMany({
        where: { userId },
        skip,
        take,
        include: {
          story: {
            include: {
              _count: {
                select: {
                  likes: true,
                  favorites: true,
                  comments: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ])

    return {
      total,
      favorites,
    }
  }

  /**
   * 获取用户点赞的故事
   */
  async getUserLikes(userId: string, params: {
    skip?: number
    take?: number
  }): Promise<{ total: number; likes: (Like & { story: Story })[] }> {
    const { skip = 0, take = 10 } = params

    const [total, likes] = await Promise.all([
      prisma.like.count({
        where: { userId },
      }),
      prisma.like.findMany({
        where: { userId },
        skip,
        take,
        include: {
          story: {
            include: {
              _count: {
                select: {
                  likes: true,
                  favorites: true,
                  comments: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ])

    return {
      total,
      likes,
    }
  }

  /**
   * 获取用户交易记录
   */
  async getUserTransactions(userId: string, params: {
    skip?: number
    take?: number
    type?: 'REWARD' | 'NFT_MINT' | 'NFT_TRADE'
  }): Promise<{ total: number; transactions: (Transaction & { story: Story })[] }> {
    const { skip = 0, take = 10, type } = params

    const where = {
      userId,
      ...(type && { type }),
    }

    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        skip,
        take,
        include: {
          story: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ])

    return {
      total,
      transactions,
    }
  }

  /**
   * 点赞故事
   */
  async likeStory(userId: string, storyId: string): Promise<Like> {
    return prisma.like.create({
      data: {
        userId,
        storyId,
      },
    })
  }

  /**
   * 取消点赞故事
   */
  async unlikeStory(userId: string, storyId: string): Promise<void> {
    await prisma.like.delete({
      where: {
        userId_storyId: {
          userId,
          storyId,
        },
      },
    })
  }

  /**
   * 收藏故事
   */
  async favoriteStory(userId: string, storyId: string): Promise<Favorite> {
    return prisma.favorite.create({
      data: {
        userId,
        storyId,
      },
    })
  }

  /**
   * 取消收藏故事
   */
  async unfavoriteStory(userId: string, storyId: string): Promise<void> {
    await prisma.favorite.delete({
      where: {
        userId_storyId: {
          userId,
          storyId,
        },
      },
    })
  }

  /**
   * 记录交易
   */
  async recordTransaction(data: {
    userId: string
    storyId: string
    type: 'REWARD' | 'NFT_MINT' | 'NFT_TRADE'
    amount: string
    txHash: string
  }): Promise<Transaction> {
    return prisma.transaction.create({
      data,
    })
  }
}