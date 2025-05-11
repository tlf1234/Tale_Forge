import prisma from '../prisma'
import { uploadImageToIPFS } from '../ipfs'
import type { User, Story, Like, Favorite, Transaction, Prisma } from '@prisma/client'
import type { ReadingHistory } from '@prisma/client'

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

interface AuthorRegisterInput {
  address: string
  penName: string
  bio?: string
  avatar?: string
  email?: string
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
  async updateUser(address: string, data: {
    penName?: string
    bio?: string
    email?: string
    avatar?: string
  }) {
    console.log('[updateUser] 开始更新用户信息:', { address, data })

    const user = await prisma.user.findUnique({
      where: { address }
    })

    if (!user) {
      console.log('[updateUser] 错误: 用户不存在')
      throw new Error('用户不存在')
    }

    if (!user.isAuthor) {
      console.log('[updateUser] 错误: 非作者用户')
      throw new Error('非作者用户')
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { address },
        data: {
          authorName: data.penName,
          bio: data.bio,
          email: data.email,
          avatar: data.avatar,
          updatedAt: new Date()
        }
      })
      console.log('[updateUser] 更新成功:', updatedUser)
      return updatedUser
    } catch (error) {
      console.error('[updateUser] 更新失败:', error)
      throw new Error('更新用户信息失败')
    }
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
   * 根据用户ID获取用户信息
   */
  async getUserById(userId: string) {
    console.log('[getUserById] 开始查询用户, 用户ID:', userId)
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
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

      if (!user) {
        console.log('[getUserById] 用户不存在, 用户ID:', userId)
        return null
      }

      console.log('[getUserById] 查询成功:', user)
      return {
        id: user.id,
        address: user.address,
        nickname: user.nickname,
        authorName: user.authorName,
        bio: user.bio,
        avatar: user.avatar,
        email: user.email,
        isAuthor: user.isAuthor,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        stats: {
          storyCount: user._count.stories,
          followerCount: user._count.followers,
          followingCount: user._count.following
        }
      }
    } catch (error) {
      console.error('[getUserById] 查询失败:', error)
      throw error
    }
  }

  // 完整的注册方法
  async registerAuthor(data: AuthorRegisterInput) {
    // 后端负责完整的业务逻辑验证
    // 1. 数据完整性验证
    if (!data.address || !data.penName || !data.email) {
      throw new Error('缺少必要信息')
    }

    // 2. 业务规则验证
    // 2.1 笔名唯一性检查
    const existingAuthor = await prisma.user.findFirst({
      where: {
        authorName: data.penName,
        NOT: { address: data.address }
      }
    })
    if (existingAuthor) {
      throw new Error('该笔名已被使用')
    }

    // 2.2 地址是否已注册
    const existingUser = await prisma.user.findUnique({
      where: { address: data.address }
    })
    if (existingUser?.isAuthor) {
      throw new Error('该地址已注册为作者')
    }

    // 3. 创建或更新作者信息
    try {
      return await prisma.user.upsert({
        where: { address: data.address },
        create: {
          address: data.address,
          authorName: data.penName,
          bio: data.bio || '',
          email: data.email,
          avatar: data.avatar || '',
          isAuthor: true
        },
        update: {
          authorName: data.penName,
          bio: data.bio || '',
          email: data.email,
          avatar: data.avatar || '',
          isAuthor: true
        }
      })
    } catch (error) {
      console.error('Failed to register author:', error)
      throw new Error('注册作者失败')
    }
  }

  // 获取作者的粉丝列表
  async getAuthorFollowers(authorAddress: string, skip = 0, take = 10) {
    console.log(`[getAuthorFollowers] 开始查询作者粉丝, 作者地址: ${authorAddress}, skip: ${skip}, take: ${take}`)
    
    const author = await prisma.user.findUnique({
      where: { address: authorAddress },
    });

    if (!author) {
      console.log('[getAuthorFollowers] 错误: 未找到作者')
      throw new Error('Author not found');
    }

    const [total, followers] = await Promise.all([
      prisma.follow.count({
        where: { followingId: author.id }
      }),
      prisma.follow.findMany({
        where: { followingId: author.id },
        skip,
        take,
        include: {
          follower: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ]);

    const formattedFollowers = followers.map(f => ({
      id: f.follower.id,
      address: f.follower.address,
      nickname: f.follower.nickname,
      avatar: f.follower.avatar,
      authorName: f.follower.authorName,
      isAuthor: f.follower.isAuthor,
      followedAt: f.createdAt
    }));

    console.log(`[getAuthorFollowers] 查询成功, 粉丝数量: ${formattedFollowers.length}/${total}`)
    
    return {
      followers: formattedFollowers,
      total
    };
  }

  // 获取用户关注的作者列表
  async getUserFollowing(userId: string, skip = 0, take = 10) {
    console.log(`[getUserFollowing] 开始查询用户关注列表, 用户ID: ${userId}, skip: ${skip}, take: ${take}`)
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      console.log('[getUserFollowing] 错误: 未找到用户')
      throw new Error('User not found');
    }

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
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ]);

    const formattedFollowing = following.map(f => ({
      id: f.following.id,
      address: f.following.address,
      nickname: f.following.nickname,
      avatar: f.following.avatar,
      authorName: f.following.authorName,
      isAuthor: f.following.isAuthor,
      followedAt: f.createdAt
    }));

    console.log(`[getUserFollowing] 查询成功, 关注数量: ${formattedFollowing.length}/${total}`)
    
    return {
      following: formattedFollowing,
      total
    };
  }

  // 用户关注作者
  async followAuthor(userId: string, authorId: string) {
    console.log(`[followAuthor] 用户关注作者, 用户ID: ${userId}, 作者ID或地址: ${authorId}`)
    console.log(`[followAuthor] 作者ID类型: ${typeof authorId}, 长度: ${authorId.length}, 是否以0x开头: ${authorId.startsWith('0x')}`)
    
    // 查找用户
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.log('[followAuthor] 错误: 未找到用户')
      throw new Error('User not found');
    }
    console.log(`[followAuthor] 找到用户: ${user.id}, 地址: ${user.address}`)
    
    // 判断authorId是否为钱包地址（以0x开头）
    let author;
    if (authorId.startsWith('0x')) {
      // 通过钱包地址查找作者
      console.log(`[followAuthor] 检测到作者ID是钱包地址: ${authorId}，尝试通过地址查找作者`);
      const normalizedAddress = authorId.toLowerCase();
      console.log(`[followAuthor] 规范化后的钱包地址: ${normalizedAddress}`);
      
      author = await prisma.user.findFirst({
        where: { 
          address: {
            mode: 'insensitive',
            equals: normalizedAddress
          }
        }
      });
      console.log(`[followAuthor] 通过钱包地址查询结果: ${author ? '找到作者' : '未找到作者'}`);
      if (author) {
        console.log(`[followAuthor] 找到作者信息: ID=${author.id}, 地址=${author.address}, 名称=${author.authorName || author.nickname || '未设置名称'}`);
      } else {
        // 尝试直接使用等于查询
        console.log(`[followAuthor] 尝试使用精确匹配查询钱包地址`);
        author = await prisma.user.findFirst({
          where: { address: normalizedAddress }
        });
        console.log(`[followAuthor] 精确匹配查询结果: ${author ? '找到作者' : '未找到作者'}`);
        if (author) {
          console.log(`[followAuthor] 精确匹配找到作者: ID=${author.id}, 地址=${author.address}`);
        } else {
          // 查询所有用户的地址，看看有没有相似的
          console.log(`[followAuthor] 尝试查询所有用户地址进行比对`);
          const allUsers = await prisma.user.findMany({
            select: { id: true, address: true },
            take: 10
          });
          console.log(`[followAuthor] 系统中的用户地址样本(前10个):`, allUsers.map(u => ({ id: u.id, address: u.address })));
        }
      }
    } else {
      // 通过ID查找作者
      console.log(`[followAuthor] 使用ID查找作者: ${authorId}`);
      author = await prisma.user.findUnique({ where: { id: authorId } });
      console.log(`[followAuthor] 通过ID查询结果: ${author ? '找到作者' : '未找到作者'}`);
    }
    
    if (!author) {
      console.log('[followAuthor] 错误: 未找到作者')
      throw new Error('Author not found');
    }

    // 检查是否已经关注
    console.log(`[followAuthor] 检查是否已经关注, 关注者ID: ${userId}, 被关注者ID: ${author.id}`);
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: author.id
        }
      }
    });

    if (existingFollow) {
      console.log('[followAuthor] 用户已经关注了该作者')
      return {
        id: author.id,
        address: author.address,
        nickname: author.nickname,
        avatar: author.avatar,
        authorName: author.authorName,
        isAuthor: author.isAuthor,
        followedAt: existingFollow.createdAt
      };
    }

    console.log(`[followAuthor] 创建新的关注关系: 关注者=${userId}, 被关注者=${author.id}`);
    const follow = await prisma.follow.create({
      data: {
        followerId: userId,
        followingId: author.id
      },
      include: {
        following: true
      }
    });
    
    console.log('[followAuthor] 创建关注关系成功:', follow.id)
    
    return {
      id: author.id,
      address: author.address,
      nickname: author.nickname,
      avatar: author.avatar,
      authorName: author.authorName,
      isAuthor: author.isAuthor,
      followedAt: follow.createdAt
    };
  }

  // 用户取消关注作者
  async unfollowAuthor(userId: string, authorId: string) {
    console.log(`[unfollowAuthor] 用户取消关注作者, 用户ID: ${userId}, 作者ID或地址: ${authorId}`)
    console.log(`[unfollowAuthor] 作者ID类型: ${typeof authorId}, 长度: ${authorId.length}, 是否以0x开头: ${authorId.startsWith('0x')}`)
    
    // 判断authorId是否为钱包地址（以0x开头）
    let authorIdToUse = authorId;
    if (authorId.startsWith('0x')) {
      // 通过钱包地址查找作者
      console.log(`[unfollowAuthor] 检测到作者ID是钱包地址: ${authorId}，尝试通过地址查找作者`);
      const normalizedAddress = authorId.toLowerCase();
      console.log(`[unfollowAuthor] 规范化后的钱包地址: ${normalizedAddress}`);
      
      const author = await prisma.user.findFirst({
        where: { 
          address: {
            mode: 'insensitive',
            equals: normalizedAddress
          }
        }
      });
      
      console.log(`[unfollowAuthor] 通过钱包地址查询结果: ${author ? '找到作者' : '未找到作者'}`);
      if (author) {
        console.log(`[unfollowAuthor] 找到作者信息: ID=${author.id}, 地址=${author.address}, 名称=${author.authorName || author.nickname || '未设置名称'}`);
        authorIdToUse = author.id;
      } else {
        // 尝试直接使用等于查询
        console.log(`[unfollowAuthor] 尝试使用精确匹配查询钱包地址`);
        const exactAuthor = await prisma.user.findFirst({
          where: { address: normalizedAddress }
        });
        
        console.log(`[unfollowAuthor] 精确匹配查询结果: ${exactAuthor ? '找到作者' : '未找到作者'}`);
        if (exactAuthor) {
          console.log(`[unfollowAuthor] 精确匹配找到作者: ID=${exactAuthor.id}, 地址=${exactAuthor.address}`);
          authorIdToUse = exactAuthor.id;
        } else {
          console.log('[unfollowAuthor] 错误: 未找到作者')
          throw new Error('Author not found');
        }
      }
    } else {
      console.log(`[unfollowAuthor] 使用ID查找作者: ${authorId}`);
    }
    
    // 检查关注关系是否存在
    console.log(`[unfollowAuthor] 检查关注关系是否存在: 关注者=${userId}, 被关注者=${authorIdToUse}`);
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: authorIdToUse
        }
      }
    });

    if (!follow) {
      console.log('[unfollowAuthor] 关注关系不存在')
      return { success: true, message: '未关注该作者' };
    }

    console.log(`[unfollowAuthor] 找到关注关系，准备删除: ${follow.id}`);
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: authorIdToUse
        }
      }
    });
    
    console.log('[unfollowAuthor] 删除关注关系成功')
    
    return { success: true, message: '取消关注成功' };
  }

  // 检查用户是否关注了某作者
  async checkFollowStatus(userId: string, authorId: string) {
    console.log(`[checkFollowStatus] 检查关注状态, 用户ID: ${userId}, 作者ID或地址: ${authorId}`)
    console.log(`[checkFollowStatus] 作者ID类型: ${typeof authorId}, 长度: ${authorId.length}, 是否以0x开头: ${authorId.startsWith('0x')}`)
    
    // 查找用户
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.log('[checkFollowStatus] 错误: 未找到用户')
      throw new Error('User not found');
    }
    console.log(`[checkFollowStatus] 找到用户: ${user.id}, 地址: ${user.address}`)
    
    // 判断authorId是否为钱包地址（以0x开头）
    let author;
    if (authorId.startsWith('0x')) {
      // 通过钱包地址查找作者
      console.log(`[checkFollowStatus] 检测到作者ID是钱包地址: ${authorId}，尝试通过地址查找作者`);
      const normalizedAddress = authorId.toLowerCase();
      console.log(`[checkFollowStatus] 规范化后的钱包地址: ${normalizedAddress}`);
      
      author = await prisma.user.findFirst({
        where: { 
          address: {
            mode: 'insensitive',
            equals: normalizedAddress
          }
        }
      });
      
      console.log(`[checkFollowStatus] 通过钱包地址查询结果: ${author ? '找到作者' : '未找到作者'}`);
      if (author) {
        console.log(`[checkFollowStatus] 找到作者信息: ID=${author.id}, 地址=${author.address}, 名称=${author.authorName || author.nickname || '未设置名称'}`);
      } else {
        // 尝试直接使用等于查询
        console.log(`[checkFollowStatus] 尝试使用精确匹配查询钱包地址`);
        author = await prisma.user.findFirst({
          where: { address: normalizedAddress }
        });
        
        console.log(`[checkFollowStatus] 精确匹配查询结果: ${author ? '找到作者' : '未找到作者'}`);
        if (author) {
          console.log(`[checkFollowStatus] 精确匹配找到作者: ID=${author.id}, 地址=${author.address}`);
        } else {
          // 查询所有用户的地址，看看有没有相似的
          console.log(`[checkFollowStatus] 尝试查询所有用户地址进行比对`);
          const allUsers = await prisma.user.findMany({
            select: { id: true, address: true },
            take: 10
          });
          console.log(`[checkFollowStatus] 系统中的用户地址样本(前10个):`, allUsers.map(u => ({ id: u.id, address: u.address })));
        }
      }
    } else {
      // 通过ID查找作者
      console.log(`[checkFollowStatus] 使用ID查找作者: ${authorId}`);
      author = await prisma.user.findUnique({ where: { id: authorId } });
      console.log(`[checkFollowStatus] 通过ID查询结果: ${author ? '找到作者' : '未找到作者'}`);
    }
    
    if (!author) {
      console.log('[checkFollowStatus] 错误: 未找到作者')
      throw new Error('Author not found');
    }

    console.log(`[checkFollowStatus] 检查关注关系: 关注者=${userId}, 被关注者=${author.id}`);
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: author.id
        }
      }
    });

    const isFollowing = !!follow;
    
    console.log(`[checkFollowStatus] 关注状态: ${isFollowing ? '已关注' : '未关注'}, 关注ID: ${follow?.id || '无'}`)
    
    return {
      isFollowing,
      followedAt: follow?.createdAt || null,
      author: {
        id: author.id,
        address: author.address,
        nickname: author.nickname,
        avatar: author.avatar,
        authorName: author.authorName,
        isAuthor: author.isAuthor
      }
    };
  }

  // 获得作者信息
  async getUserByAddress(address: string) {
    console.log(`[getUserIdByAddress] 开始查询作者信息, 地址: ${address}`)
    
    const user = await prisma.user.findUnique({
      where: { 
        address
      },
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
    console.log('[getUserIdByAddress] 查询结果:', user)

    if (!user) {
      console.log('[getUserIdByAddress] 错误: 未找到作者')
      throw new Error('Author not found')
    }

    const result = {
      id: user.id,
      address: user.address,
      authorName: user.authorName,
      bio: user.bio,
      avatar: user.avatar,
      email: user.email,
      isAuthor: user.isAuthor,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      stats: {
        storyCount: user._count.stories,
        followerCount: user._count.followers,
        followingCount: user._count.following
      }
    }
    console.log('[getUserIdByAddress] 返回结果:', result)
    return result
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
   * 获取用户收藏的故事
   */
  async getUserFavorites(userId: string, params: {
    skip?: number
    take?: number
  }): Promise<{ total: number; favorites: (Favorite & { story: Story })[] }> {
    console.log('[用户服务-获取收藏] 开始获取用户收藏:', { userId, params });
    
    const { skip = 0, take = 10 } = params

    try {
      console.log('[用户服务-获取收藏] 查询收藏总数');
      const total = await prisma.favorite.count({
        where: { userId },
      });
      
      console.log('[用户服务-获取收藏] 收藏总数:', total);
      
      console.log('[用户服务-获取收藏] 查询收藏列表:', { skip, take });
      const favorites = await prisma.favorite.findMany({
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
      });
      
      console.log('[用户服务-获取收藏] 收藏列表获取成功, 数量:', favorites.length);
      
      if (favorites.length > 0) {
        console.log('[用户服务-获取收藏] 第一个收藏项:', {
          id: favorites[0].id,
          storyId: favorites[0].storyId,
          storyTitle: favorites[0].story.title,
          createdAt: favorites[0].createdAt
        });
      } else {
        console.log('[用户服务-获取收藏] 用户没有收藏');
      }

      return {
        total,
        favorites,
      };
    } catch (error) {
      console.error('[用户服务-获取收藏] 获取收藏失败:', error);
      throw error;
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
    type?: 'PURCHASE' | 'REWARD' | 'WITHDRAW'
  }): Promise<{ total: number; transactions: (Transaction & { story: Story })[] }> {
    const { skip = 0, take = 10, type } = params

    const where = {
      userId,
      ...(type && { type })
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
    console.log('[用户服务-收藏故事] 开始添加收藏:', { userId, storyId });
    
    try {
      // 检查故事是否存在
      console.log('[用户服务-收藏故事] 开始检查故事是否存在:', storyId);
      const story = await prisma.story.findUnique({
        where: { id: storyId }
      });
      
      if (!story) {
        console.log('[用户服务-收藏故事] 故事不存在:', storyId);
        throw new Error('故事不存在');
      }
      console.log('[用户服务-收藏故事] 故事存在:', { 
        storyId: story.id, 
        title: story.title 
      });
      
      // 检查是否已经收藏
      console.log('[用户服务-收藏故事] 开始检查是否已收藏');
      const existingFavorite = await prisma.favorite.findUnique({
        where: {
          userId_storyId: {
            userId,
            storyId
          }
        }
      });
      
      if (existingFavorite) {
        console.log('[用户服务-收藏故事] 已经收藏过该故事:', existingFavorite.id);
        return existingFavorite;
      }
      console.log('[用户服务-收藏故事] 未收藏过该故事，准备创建收藏');
      
      // 打印Prisma模型信息
      try {
        console.log('[用户服务-收藏故事] Favorite模型字段:', 
          Object.keys(prisma.favorite).includes('fields') 
            ? Object.keys(prisma.favorite.fields) 
            : '无法获取字段信息'
        );
      } catch (e) {
        console.log('[用户服务-收藏故事] 获取模型信息失败:', e);
      }
      
      // 创建收藏前记录数据库状态
      console.log('[用户服务-收藏故事] 创建收藏前检查数据库状态');
      const favoriteCount = await prisma.favorite.count();
      console.log('[用户服务-收藏故事] 当前收藏总数:', favoriteCount);
      
      // 创建收藏
      console.log('[用户服务-收藏故事] 开始创建收藏记录:', {
        userId,
        storyId,
        dataStruct: JSON.stringify({userId, storyId})
      });
      
      try {
        const favorite = await prisma.favorite.create({
          data: {
            userId,
            storyId,
          },
        });
        
        console.log('[用户服务-收藏故事] 收藏成功:', { 
          favoriteId: favorite.id,
          favoriteData: JSON.stringify(favorite)
        });
        return favorite;
      } catch (createError) {
        console.error('[用户服务-收藏故事] 创建收藏记录失败:', createError);
        
        // 检查数据库结构
        console.log('[用户服务-收藏故事] 尝试查询Favorite表结构');
        try {
          const sampleFavorite = await prisma.favorite.findFirst();
          console.log('[用户服务-收藏故事] 示例记录:', 
            sampleFavorite ? JSON.stringify(sampleFavorite) : '未找到样本记录'
          );
        } catch (e) {
          console.error('[用户服务-收藏故事] 查询示例记录失败:', e);
        }
        
        throw createError;
      }
    } catch (error) {
      console.error('[用户服务-收藏故事] 收藏失败:', error);
      console.error('[用户服务-收藏故事] 错误堆栈:', (error as Error).stack);
      
      // 提取Prisma错误信息
      if (error && typeof error === 'object') {
        if ('code' in error) {
          console.error(`[用户服务-收藏故事] Prisma错误代码: ${(error as any).code}`);
        }
        if ('message' in error) {
          console.error(`[用户服务-收藏故事] 错误信息: ${(error as any).message}`);
        }
        if ('meta' in error) {
          console.error(`[用户服务-收藏故事] 元数据: ${JSON.stringify((error as any).meta)}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * 取消收藏故事
   */
  async unfavoriteStory(userId: string, storyId: string): Promise<void> {
    console.log('[用户服务-取消收藏] 开始取消收藏:', { userId, storyId });
    
    try {
      await prisma.favorite.delete({
        where: {
          userId_storyId: {
            userId,
            storyId,
          },
        },
      });
      
      console.log('[用户服务-取消收藏] 取消收藏成功');
    } catch (error) {
      console.error('[用户服务-取消收藏] 取消收藏失败:', error);
      throw error;
    }
  }

  /**
   * 记录交易
   */
  async recordTransaction(data: {
    userId: string
    storyId: string
    type: 'PURCHASE' | 'REWARD' | 'WITHDRAW'
    amount: string
    txHash: string
  }): Promise<Transaction> {
    return prisma.transaction.create({
      data,
      include: {
        story: true
      }
    })
  }

  /**
   * 获取用户阅读历史
   * @param params 查询参数，包含userId或address（至少一个）
   * @param page 页码，默认为1
   * @param limit 每页数量，默认为10
   * @returns 用户阅读历史记录
   */
  async getUserReadingHistory(
    params: { userId?: string | string[]; address?: string }, 
    page = 1, 
    limit = 10
  ) {
    console.log('[UserService] 获取用户阅读历史:', { params, page, limit })
    
    try {
      // 查询条件构造
      let where: any = {};
      
      if (params.userId) {
        console.log('[UserService] 使用userId查询阅读历史')
        // 确保userId是单个字符串而不是数组
        const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
        console.log('[UserService] 处理后的userId:', userId)
        where.userId = userId;
      } else if (params.address) {
        console.log('[UserService] 使用address查询阅读历史')
        // 通过地址查询用户ID
        const user = await prisma.user.findUnique({
          where: { address: params.address },
          select: { id: true }
        });
        
        if (!user) {
          console.log('[UserService] 用户不存在:', params.address)
          throw new Error('User not found');
        }
        
        where.userId = user.id;
      } else {
        console.log('[UserService] 缺少必要的参数')
        throw new Error('Missing required parameter: userId or address');
      }
      
      // 计算分页
      const skip = (page - 1) * limit;
      
      // 查询总数
      const total = await prisma.readingHistory.count({ where });
      
      // 查询数据
      const items = await prisma.readingHistory.findMany({
        where,
        orderBy: { lastReadAt: 'desc' },
        skip,
        take: limit,
        include: {
          story: {
            select: {
              title: true,
              coverCid: true,
              author: {
                select: {
                  nickname: true,
                  authorName: true
                }
              }
            }
          }
        }
      });
      
      // 格式化结果
      const formattedItems = items.map((item: any) => ({
        id: item.id,
        storyId: item.storyId,
        title: item.story.title,
        coverCid: item.story.coverCid || '',
        author: item.story.author.authorName || item.story.author.nickname || '未知作者',
        lastRead: item.lastReadAt.toISOString(),
        progress: item.readingProgress,
        lastChapterOrder: item.lastChapterOrder
      }));
      
      // 计算总页数
      const totalPages = Math.ceil(total / limit);
      
      console.log('[UserService] 阅读历史查询结果:', {
        total,
        currentPage: page,
        totalPages,
        itemsCount: formattedItems.length
      })
      
      return {
        total,
        currentPage: page,
        totalPages,
        items: formattedItems
      };
    } catch (error) {
      console.error('[UserService] 获取阅读历史异常:', error)
      throw error;
    }
  }
  
  /**
   * 更新用户阅读历史
   * @param params 参数，包含storyId、userId/address和阅读章节信息
   * @returns 更新后的阅读历史记录
   */
  async updateReadingHistory(params: { 
    storyId: string; 
    userId?: string; 
    address?: string;
    chapterOrder?: number;
  }) {
    console.log('[UserService] 更新阅读历史:', params)
    
    try {
      let userId = params.userId;
      
      // 如果没有userId但有address，通过address获取userId
      if (!userId && params.address) {
        console.log('[UserService] 通过地址查询用户ID:', params.address)
        const user = await prisma.user.findUnique({
          where: { address: params.address },
          select: { id: true }
        });
        
        if (!user) {
          console.log('[UserService] 用户不存在:', params.address)
          throw new Error('User not found');
        }
        
        userId = user.id;
      }
      
      if (!userId) {
        console.log('[UserService] 缺少用户ID')
        throw new Error('Missing user identification');
      }
      
      // 查询故事是否存在
      const story = await prisma.story.findUnique({
        where: { id: params.storyId },
        select: { id: true }
      });
      
      if (!story) {
        console.log('[UserService] 故事不存在:', params.storyId)
        throw new Error('Story not found');
      }
      
      // 构建更新数据 - 只包含章节号和最后阅读时间
      const updateData: any = {
        lastReadAt: new Date()
      };
      
      if (params.chapterOrder !== undefined) {
        updateData.lastChapterOrder = params.chapterOrder;
      }
      
      // 更新或创建阅读历史记录
      console.log('[UserService] 更新/创建阅读历史:', {
        userId,
        storyId: params.storyId,
        chapterOrder: params.chapterOrder
      })
      
      const result = await prisma.readingHistory.upsert({
        where: {
          userId_storyId: {
            userId,
            storyId: params.storyId
          }
        },
        update: updateData,
        create: {
          userId,
          storyId: params.storyId,
          readingProgress: 0, // 默认值，不再追踪进度
          lastChapterOrder: params.chapterOrder || 1,
          lastReadAt: new Date()
        }
      });
      
      console.log('[UserService] 阅读历史更新成功:', {
        id: result.id,
        chapterOrder: result.lastChapterOrder
      })
      
      return result;
    } catch (error) {
      console.error('[UserService] 更新阅读历史异常:', error)
      throw error;
    }
  }
}