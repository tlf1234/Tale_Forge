import prisma from '../prisma'
import type { Comment, User, CommentLike, Prisma } from '@prisma/client'

export interface CreateCommentInput {
  content: string
  userId: string
  storyId?: string
  chapterId?: string
  parentId?: string
  replyToId?: string   // 二级回复目标评论ID
  replyToName?: string // 二级回复目标用户名
}

export class CommentService {
  /**
   * 创建评论或回复
   */
  async createComment(input: CreateCommentInput): Promise<Comment> {
    const { content, userId, storyId, chapterId, parentId, replyToId, replyToName } = input

    console.log('[CommentService.createComment] 开始创建评论:', {
      contentLength: content.length,
      userId,
      storyId,
      chapterId,
      parentId,
      replyToId,
      replyToName,
      timestamp: new Date().toISOString()
    })

    if (!storyId && !chapterId) {
      console.error('[CommentService.createComment] 错误: 必须提供storyId或chapterId')
      throw new Error('Either storyId or chapterId must be provided')
    }

    try {
      const comment = await prisma.comment.create({
        data: {
          content,
          userId,
          storyId,
          chapterId,
          parentId,
          replyToId,    // 保存回复目标ID
          replyToName,  // 保存回复目标用户名
        },
        include: {
          user: true,
          likes: true,
          replies: {
            include: {
              user: true,
              likes: true,
            }
          }
        }
      })

      console.log('[CommentService.createComment] 评论创建成功:', {
        commentId: comment.id,
        storyId: comment.storyId,
        chapterId: comment.chapterId,
        parentId: comment.parentId,
        createdAt: comment.createdAt
      })

      return comment
    } catch (error) {
      console.error('[CommentService.createComment] 创建评论失败:', error)
      throw error
    }
  }

  /**
   * 获取评论回复
   */
  async getCommentReplies(commentId: string, params: {
    skip?: number
    take?: number
  }): Promise<{ total: number; replies: (Comment & { user: User; likes: CommentLike[] })[] }> {
    const { skip = 0, take = 10 } = params

    console.log('[CommentService.getCommentReplies] 开始获取评论回复:', {
      commentId,
      skip,
      take,
      timestamp: new Date().toISOString()
    })

    try {
      // 先获取总数，以确定实际应该跳过的数量
      const total = await prisma.comment.count({
        where: { parentId: commentId }
      });
      
      console.log('[CommentService.getCommentReplies] 评论总回复数:', total);
      
      // 检查是否请求的偏移量超出了实际数据范围
      let actualSkip = skip;
      let actualTake = take;
      
      if (skip >= total) {
        // 如果请求的skip超出了总数，意味着已经没有数据可加载
        console.log('[CommentService.getCommentReplies] 请求的偏移量超出了总数，返回空数组');
        return {
          total,
          replies: []
        };
      }
      
      // 如果请求的数量超出了剩余的数据量，调整take值
      if (skip + take > total) {
        actualTake = total - skip;
        console.log(`[CommentService.getCommentReplies] 调整take值: ${take} -> ${actualTake}`);
      }

      // 获取回复，按照创建时间升序排序（从早到晚）
      const replies = await prisma.comment.findMany({
        where: { parentId: commentId },
        skip: actualSkip,
        take: actualTake,
        include: {
          user: true,
          likes: true
        },
        orderBy: {
          createdAt: 'asc' // 从早到晚排序，这样显示回复时更符合对话逻辑
        }
      });

      console.log('[CommentService.getCommentReplies] 获取回复成功:', {
        commentId,
        totalReplies: total,
        requestedSkip: skip,
        requestedTake: take,
        actualSkip,
        actualTake,
        returnedReplies: replies.length
      })

      return {
        total,
        replies
      }
    } catch (error) {
      console.error('[CommentService.getCommentReplies] 获取回复失败:', {
        commentId,
        error
      })
      throw error
    }
  }

  /**
   * 点赞评论
   */
  async likeComment(userId: string, commentId: string): Promise<void> {
    console.log('[CommentService.likeComment] 开始点赞评论:', {
      userId,
      commentId,
      timestamp: new Date().toISOString()
    })
    
    try {
      // 检查是否已点赞
      const existingLike = await prisma.commentLike.findUnique({
        where: {
          userId_commentId: {
            userId,
            commentId
          }
        }
      })

      if (existingLike) {
        console.log('[CommentService.likeComment] 已经点过赞了:', {
          userId,
          commentId,
          likeId: existingLike.id,
          createdAt: existingLike.createdAt
        })
        throw new Error('Already liked this comment')
      }

      // 创建点赞记录
      const like = await prisma.commentLike.create({
        data: {
          userId,
          commentId
        }
      })
      
      console.log('[CommentService.likeComment] 点赞成功:', {
        userId,
        commentId,
        likeId: like.id,
        createdAt: like.createdAt
      })
    } catch (error) {
      console.error('[CommentService.likeComment] 点赞失败:', {
        userId,
        commentId,
        error
      })
      throw error
    }
  }

  /**
   * 取消点赞
   */
  async unlikeComment(userId: string, commentId: string): Promise<void> {
    console.log('[CommentService.unlikeComment] 开始取消点赞:', {
      userId,
      commentId,
      timestamp: new Date().toISOString()
    })
    
    try {
      // 检查是否已点赞
      const existingLike = await prisma.commentLike.findUnique({
        where: {
          userId_commentId: {
            userId,
            commentId
          }
        }
      })

      if (!existingLike) {
        console.log('[CommentService.unlikeComment] 未点过赞，无法取消:', {
          userId,
          commentId
        })
        throw new Error('Not liked this comment yet')
      }

      // 删除点赞记录
      await prisma.commentLike.delete({
        where: {
          userId_commentId: {
            userId,
            commentId
          }
        }
      })
      
      console.log('[CommentService.unlikeComment] 取消点赞成功:', {
        userId,
        commentId,
        likeId: existingLike.id
      })
    } catch (error) {
      console.error('[CommentService.unlikeComment] 取消点赞失败:', {
        userId,
        commentId,
        error
      })
      throw error
    }
  }

  /**
   * 获取评论（包含点赞信息）
   */
  async getComment(commentId: string, currentUserId?: string): Promise<Comment & {
    user: User;
    likes: CommentLike[];
    isLiked: boolean;
    likeCount: number;
  }> {
    console.log('[CommentService.getComment] 开始获取评论详情:', {
      commentId,
      currentUserId,
      timestamp: new Date().toISOString()
    })
    
    try {
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          user: true,
          likes: true
        }
      })

      if (!comment) {
        console.error('[CommentService.getComment] 评论不存在:', {
          commentId
        })
        throw new Error('Comment not found')
      }

      const isLiked = currentUserId ? comment.likes.some(like => like.userId === currentUserId) : false
      const likeCount = comment.likes.length
      
      console.log('[CommentService.getComment] 获取评论成功:', {
        commentId,
        userId: comment.userId,
        storyId: comment.storyId,
        chapterId: comment.chapterId,
        hasParent: !!comment.parentId,
        likeCount,
        isLiked
      })

      return {
        ...comment,
        isLiked,
        likeCount
      }
    } catch (error) {
      console.error('[CommentService.getComment] 获取评论失败:', {
        commentId,
        error
      })
      throw error
    }
  }

  /**
   * 获取评论列表（包含回复和点赞信息）
   * 支持获取故事级别评论和章节级别评论，后者通过提供chapterId参数实现。
   */
  async getComments(storyId: string, params: {
    skip?: number
    take?: number
    currentUserId?: string
    chapterId?: string  // 如果提供则只获取该章节下的评论
  }) {
    const { skip = 0, take = 10, currentUserId, chapterId } = params

    console.log('[CommentService.getComments] 开始获取评论列表:', {
      storyId,
      chapterId,
      skip,
      take,
      currentUserId,
      timestamp: new Date().toISOString()
    })

    try {
      // 构建评论查询条件
      const whereCondition: any = { 
        storyId,
        parentId: null  // 只获取主评论
      }
      
      // 如果传入章节ID，添加到查询条件，此时只获取指定章节的评论
      if (chapterId) {
        whereCondition.chapterId = chapterId
      }

      console.log('[CommentService.getComments] 查询条件:', whereCondition)

      const [total, comments] = await Promise.all([
        prisma.comment.count({
          where: whereCondition
        }),
        prisma.comment.findMany({
          where: whereCondition,
          skip,
          take,
          include: {
            user: true,
            likes: true,
            replies: {
              include: {
                user: true,
                likes: true
              },
              take: 3,  // 默认只显示前3条回复
              orderBy: {
                createdAt: 'desc'
              }
            },
            _count: {
              select: {
                replies: true  // 获取回复总数
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        })
      ])

      console.log('[CommentService.getComments] 数据库查询结果:', {
        total,
        commentsCount: comments.length,
        timestamp: new Date().toISOString()
      })

      // 处理点赞和回复信息
      const formattedComments = comments.map(comment => ({
        ...comment,
        isLiked: currentUserId ? comment.likes.some(like => like.userId === currentUserId) : false,
        likeCount: comment.likes.length,
        replyCount: comment._count.replies,
        replies: comment.replies.map(reply => ({
          ...reply,
          isLiked: currentUserId ? reply.likes.some(like => like.userId === currentUserId) : false,
          likeCount: reply.likes.length
        }))
      }))

      console.log('[CommentService.getComments] 获取评论列表成功:', {
        total,
        returnedCount: formattedComments.length,
        firstCommentId: formattedComments.length > 0 ? formattedComments[0].id : null
      })

      return {
        total,
        comments: formattedComments
      }
    } catch (error) {
      console.error('[CommentService.getComments] 获取评论列表失败:', {
        storyId,
        chapterId,
        error
      })
      throw error
    }
  }
  
  /**
   * 获取故事评论（包含回复和点赞信息）
   * 该方法是为了向后兼容性而保留的，推荐使用更通用的getComments方法
   * @deprecated 请使用 getComments 方法
   */
  async getStoryComments(storyId: string, params: {
    skip?: number
    take?: number
    currentUserId?: string
    chapterId?: string
  }) {
    console.log('[CommentService.getStoryComments] 已废弃方法调用，转发至getComments', {
      storyId,
      params
    })
    return this.getComments(storyId, params);
  }

  /**
   * 获取章节评论
   * @deprecated 请使用 getComments 方法代替，并提供 chapterId 参数
   */
  async getChapterComments(chapterId: string, params: {
    skip?: number
    take?: number
  }): Promise<{ total: number; comments: (Comment & { user: User })[] }> {
    const { skip = 0, take = 10 } = params

    console.log('[CommentService.getChapterComments] 已废弃方法调用，使用简单实现', {
      chapterId,
      skip, 
      take
    })

    try {
      const [total, comments] = await Promise.all([
        prisma.comment.count({
          where: { chapterId },
        }),
        prisma.comment.findMany({
          where: { chapterId },
          skip,
          take,
          include: {
            user: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
      ])

      console.log('[CommentService.getChapterComments] 获取章节评论成功:', {
        chapterId,
        total,
        commentsCount: comments.length
      })

      return {
        total,
        comments,
      }
    } catch (error) {
      console.error('[CommentService.getChapterComments] 获取章节评论失败:', {
        chapterId,
        error
      })
      throw error
    }
  }

  /**
   * 更新评论
   */
  async updateComment(id: string, content: string): Promise<Comment> {
    console.log('[CommentService.updateComment] 开始更新评论:', {
      commentId: id,
      contentLength: content.length,
      timestamp: new Date().toISOString()
    })

    try {
      const comment = await prisma.comment.update({
        where: { id },
        data: { content },
      })

      console.log('[CommentService.updateComment] 更新评论成功:', {
        commentId: comment.id,
        updatedAt: comment.updatedAt
      })

      return comment
    } catch (error) {
      console.error('[CommentService.updateComment] 更新评论失败:', {
        commentId: id,
        error
      })
      throw error
    }
  }

  /**
   * 删除评论
   */
  async deleteComment(id: string): Promise<void> {
    console.log('[CommentService.deleteComment] 开始删除评论:', {
      commentId: id,
      timestamp: new Date().toISOString()
    })

    try {
      await prisma.comment.delete({
        where: { id },
      })
      
      console.log('[CommentService.deleteComment] 删除评论成功:', {
        commentId: id
      })
    } catch (error) {
      console.error('[CommentService.deleteComment] 删除评论失败:', {
        commentId: id,
        error
      })
      throw error
    }
  }

  /**
   * 获取用户评论历史
   */
  async getUserComments(params: {
    userId?: string;
    address?: string;
    page?: number;
    limit?: number;
    currentUserId?: string;  // 当前登录用户ID，用于判断是否已点赞
  }) {
    const requestId = Math.random().toString(36).substring(2, 10); // 生成请求ID方便跟踪
    console.log(`[${requestId}][CommentService.getUserComments] 开始获取用户评论历史:`, params);
    
    const { userId, address, page = 1, limit = 10, currentUserId } = params;
    
    // 确保至少提供了一个标识
    if (!userId && !address) {
      console.error(`[${requestId}][CommentService.getUserComments] 错误: 必须提供userId或address`);
      throw new Error('Either userId or address must be provided');
    }

    try {
      // 构建查询条件
      let userWhere: Prisma.UserWhereInput = {};
      
      if (userId) {
        userWhere.id = userId;
      } else if (address) {
        // 根据Prisma模型正确设置钱包地址查询条件
        userWhere.address = {
          contains: address,
          mode: 'insensitive'
        };
      }
      
      console.log(`[${requestId}][CommentService.getUserComments] 构建用户查询条件:`, userWhere);

      // 分页参数
      const skip = (page - 1) * limit;
      
      // 查询评论总数
      const countStart = Date.now();
      const total = await prisma.comment.count({
        where: {
          user: userWhere
        }
      });
      console.log(`[${requestId}][CommentService.getUserComments] 查询评论总数完成:`, {
        total,
        time: `${Date.now() - countStart}ms`
      });
      
      // 计算总页数
      const pageCount = Math.ceil(total / limit);
      
      if (total === 0) {
        console.log(`[${requestId}][CommentService.getUserComments] 未找到评论`);
        return {
          comments: [],
          total: 0,
          page,
          pageCount: 0
        };
      }
      
      // 查询评论列表，确保包含所有需要的关联数据
      const queryStart = Date.now();
      const comments = await prisma.comment.findMany({
        where: {
          user: userWhere
        },
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          user: true,
          story: true,
          chapter: true,
          likes: true
        },
        skip,
        take: limit
      });
      
      console.log(`[${requestId}][CommentService.getUserComments] 查询评论列表完成:`, {
        count: comments.length,
        time: `${Date.now() - queryStart}ms`
      });
      
      // 处理评论数据，添加前端需要的字段和格式
      const commentsWithLikeStatus = comments.map(comment => {
        // 判断当前用户是否已点赞此评论
        const isLiked = currentUserId && comment.likes
          ? comment.likes.some((like: any) => like.userId === currentUserId)
          : false;
          
        // 确保返回的评论对象符合前端期望的格式
        return {
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt,
          onChainStatus: comment.onChainStatus || 'PENDING', // 确保链上状态字段存在
          likes: comment.likes ? comment.likes.length : 0,
          isLiked,
          user: comment.user ? {
            id: comment.user.id,
            username: comment.user.nickname || '',
            nickname: comment.user.nickname || '',
            avatar: comment.user.avatar || '',
            walletAddress: comment.user.address || ''
          } : null,
          story: comment.story ? {
            id: comment.story.id,
            title: comment.story.title,
            coverCid: comment.story.coverCid || ''
          } : null,
          chapter: comment.chapter ? {
            id: comment.chapter.id,
            title: comment.chapter.title,
            order: comment.chapter.order
          } : null
        };
      });
      
      console.log(`[${requestId}][CommentService.getUserComments] 处理完成，返回结果:`, {
        commentsCount: commentsWithLikeStatus.length,
        total,
        page,
        pageCount
      });
      
      return {
        comments: commentsWithLikeStatus,
        total,
        page,
        pageCount
      };
    } catch (error) {
      console.error(`[${requestId}][CommentService.getUserComments] 查询评论失败:`, error);
      throw error;
    }
  }
} 