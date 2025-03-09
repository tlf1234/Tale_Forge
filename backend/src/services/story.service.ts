import { ethers } from 'ethers'
import prisma from '../prisma'
import { uploadToIPFS, getFromIPFS, uploadJSONToIPFS } from '../ipfs'
import type { Story, Chapter, Prisma, StoryStatus } from '@prisma/client'
import { SyncStatus } from '@prisma/client'
import { syncService } from './sync.service'

export class StoryService {
  /**
   * 获取作者作品列表
   */
  async getAuthorStories(authorId: string, params: {
    status?: StoryStatus
    skip?: number
    take?: number
  }) {
    console.log('[StoryService.getAuthorStories] 开始获取作者作品:', {
      authorId,
      params
    })

    try {

      /**
       * TODO 注意！！！同步这一功能还是有问题的，没有较好的触发需要同步的机制，这个如果后面还需要有这个功能
       * 就需要进一步优化，暂时先这样。
       * 方案一：比对作品数量
                最简单的方案，但可能会有遗漏：
                从链上获取作者的作品数量
                与数据库中的作品数量比较
                如果数量不一致，说明需要同步
                优点：
                实现简单，开销小
                快速发现新增或删除的作品
                缺点：
                无法发现作品内容的更新
                如果恰好数量一致但内容不同，会遗漏
       */
      // 1. 获取同步状态
      const syncState = await syncService.getAuthorStoriesSyncState(authorId)
      console.log('[StoryService.getAuthorStories] 同步状态:', syncState)
      
      // 2. 触发同步的条件：
      // - 首次加载（没有同步记录）
      // - 同步状态不是 COMPLETED
      // PENDING（待同步）
      // SYNCING（同步中）
      // COMPLETED（同步完成）
      // FAILED（同步失败）
      const needsSync = !syncState || !['COMPLETED'].includes(syncState.syncStatus)
      // 如果需要同步，触发一次同步（异步执行，不等待结果）
      if (needsSync) {
        console.log('[StoryService.getAuthorStories] 触发同步，原因:', !syncState ? '首次加载' : `状态为 ${syncState.syncStatus}`)
        // 异步触发同步，不等待结果
        syncService.triggerStoriesSync(authorId).catch(error => {
          console.error('[StoryService.getAuthorStories] 触发同步失败:', error)
        })
      }

      // 3. 从数据库获取作品列表
      const { status, skip = 0, take = 10 } = params
      const where = {
        authorId,
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

      console.log('[StoryService.getAuthorStories] 查询结果:', {
        total,
        storiesCount: stories.length,
        syncStatus: syncState?.syncStatus
      })

      // 返回数据库当前的数据，同时返回同步状态供前端展示
      return { 
        stories, 
        total,
        syncStatus: syncState?.syncStatus || 'PENDING',
        message: needsSync ? '正在同步区块链数据，稍后刷新页面查看最新数据' : undefined,
        error: syncState?.syncStatus === 'FAILED' ? '同步失败，请稍后重试' : undefined
      }
    } catch (error) {
      console.error('[StoryService.getAuthorStories] 获取失败:', error)
      throw error
    }
  }


  /**
   * 创建故事
   * 1. 验证数据
   * 2. 上传内容到 IPFS
   * 3、todo接上AI实现内容合规审查（作品创建环节应该不需要，内容提交是需要的）
   * 3. 返回上传结果供智能合约使用
   */
  async uploadStory(data: {
    title: string
    description: string
    content: string
    coverImage?: string
    authorAddress: string
    type: string
    category: string
    tags?: string[]
  }) {
    console.log('[StoryService.uploadStory] 开始上传故事:', {
      title: data.title,
      authorAddress: data.authorAddress
    })

    try {
      // 1. 验证必填字段
      if (!data.title || !data.description || !data.content || !data.authorAddress) {
        throw new Error('缺少必填字段')
      }

      // 2. 上传内容到 IPFS
      const { contentCid, coverCid } = await syncService.prepareStoryCreation({
        title: data.title,
        description: data.description,
        content: data.content,
        coverImage: data.coverImage,
        authorAddress: data.authorAddress
      })

      // 3. 返回上传结果供智能合约使用
      return {
        contentCid,  // 故事内容的 IPFS CID
        coverCid,    // 封面图片的 IPFS CID
        type: data.type,
        category: data.category,
        tags: data.tags || []
      }
    } catch (error) {
      console.error('[StoryService.createStory] 创建失败:', error)
      throw error
    }
  }

  // 保存故事
  async saveStory(data: {
    title: string
    description: string
    content: string
    coverImage?: string
    authorAddress: string
    contentCid: string
    coverCid: string
    category: string
    tags?: string[]
    targetWordCount: number
  }) {
    console.log('[StoryService.saveStory] 开始保存故事:', {
      title: data.title,
      authorAddress: data.authorAddress
    })

    try {
      // 1. 验证必填字段
      if (!data.title || !data.description || !data.content || !data.authorAddress) {
        throw new Error('缺少必填字段')
      }

      // 2. 查找作者ID
      const author = await prisma.user.findUnique({
        where: { address: data.authorAddress },
        select: { id: true }
      })

      if (!author) {
        throw new Error('作者不存在')
      }

      // 3. 保存故事到数据库
      const story = await prisma.story.create({
        data: {
          title: data.title,
          description: data.description,
          contentCID: data.contentCid,
          cover: data.coverCid,
          authorId: author.id,
          category: data.category,
          tags: data.tags || [],
          status: 'DRAFT',
          wordCount: data.content.length,
          targetWordCount: data.targetWordCount,
          isNFT: false,
          published: false
        },
        include: {
          author: {
            select: {
              id: true,
              address: true,
              authorName: true,
              avatar: true
            }
          }
        }
      })

      return story
    } catch (error) {
      console.error('[StoryService.saveStory] 保存失败:', error)
      throw error
    }
  }

  
  // 验证故事内容
  async validateStory(data: any) {
    // 内容验证逻辑
    return { isValid: true, ipfsHash: '' }
  }


  // 更新故事
  async updateStory(id: string, data: {
    title?: string
    description?: string
    content?: string
    category?: string
    targetWordCount?: number
    coverImage?: File
    status?: StoryStatus
  }) {
    const updateData: Prisma.StoryUpdateInput = {}

    // 1. 处理内容更新
    if (data.content) {
      updateData.contentCID = await uploadToIPFS(data.content)
      updateData.wordCount = data.content.length
    }

    // 2. 处理封面更新
    if (data.coverImage) {
      const buffer = Buffer.from(await data.coverImage.arrayBuffer())
      updateData.cover = await uploadToIPFS(buffer)
    }

    // 3. 更新其他字段
    Object.assign(updateData, {
      title: data.title,
      description: data.description,
      category: data.category,
      targetWordCount: data.targetWordCount,
      status: data.status
    })

    return await prisma.story.update({
      where: { id },
      data: updateData
    })
  }


  // 获取故事详情
  async getStory(id: string) {
    // 1. 获取数据库中的基本信息
    const story = await prisma.story.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        contentCID: true,
        cover: true,
        authorId: true,
        status: true,
        category: true,
        tags: true,
        wordCount: true,
        targetWordCount: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            address: true,
            authorName: true,
            avatar: true
          }
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            favorites: true
          }
        }
      }
    })

    // 2. 内容按需从 IPFS 获取
    if (story) {
      const content = await getFromIPFS(story.contentCID)
      return { ...story, content }
    }
  }

  // 获取故事列表
  async getStories(params: {
    category?: string
    authorId?: string
    status?: StoryStatus
    skip?: number
    take?: number
    orderBy?: string
  }) {
    const { category, authorId, status, skip = 0, take = 10, orderBy = 'createdAt' } = params

    const where: Prisma.StoryWhereInput = {}
    if (category) where.category = category
    if (authorId) where.authorId = authorId
    if (status) where.status = status

    const [total, stories] = await Promise.all([
      prisma.story.count({ where }),
      prisma.story.findMany({
        where,
        skip,
        take,
        orderBy: { [orderBy]: 'desc' },
        include: {
          author: true,
          _count: {
            select: {
              likes: true,
              comments: true,
              favorites: true
            }
          }
        }
      })
    ])

    return {
      stories,
      total,
      currentPage: Math.floor(skip / take) + 1,
      totalPages: Math.ceil(total / take)
    }
  }

  // 删除故事
  async deleteStory(id: string) {
    return await prisma.story.delete({
      where: { id }
    })
  }

  /*
  章节相关
  */
  // 添加章节
  async addChapter(storyId: string, data: {
    title: string
    content: string
    order: number
  }) {
    // 创建草稿章节，直接保存内容到数据库
    return await prisma.chapter.create({
      data: {
        title: data.title,
        content: data.content,
        order: data.order,
        wordCount: data.content.length,
        status: 'DRAFT',
        storyId
      }
    })
  }

  // 更新章节
  async updateChapter(id: string, data: {
    title?: string
    content?: string
    order?: number
  }, storyId?: string) {
    // 如果提供了 storyId，先验证章节是否属于该故事
    if (storyId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id }
      });
      
      if (!chapter || chapter.storyId !== storyId) {
        throw new Error('章节不属于指定的故事');
      }
    }
    
    return await prisma.chapter.update({
      where: { id },
      data
    })
  }


  // 删除章节
  async deleteChapter(id: string, storyId?: string) {
    // 如果提供了 storyId，先验证章节是否属于该故事
    if (storyId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id }
      });
      
      if (!chapter || chapter.storyId !== storyId) {
        throw new Error('章节不属于指定的故事');
      }
    }
    
    return await prisma.chapter.delete({
      where: { id }
    })
  }


  // 发布章节
  async publishChapter(id: string, authorAddress: string, storyId?: string) {
    // 如果提供了 storyId，先验证章节是否属于该故事
    if (storyId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id }
      });
      
      if (!chapter || chapter.storyId !== storyId) {
        throw new Error('章节不属于指定的故事');
      }
    }
    
    // 获取章节
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        story: true
      }
    })

    if (!chapter) {
      throw new Error('章节不存在')
    }

    // 验证作者身份
    if (chapter.story.authorId !== authorAddress) {
      throw new Error('只有作者才能发布章节')
    }

    // 获取章节内容
    const content = chapter.content

    if (!content) {
      throw new Error('章节内容为空')
    }

    try {
      // 上传到IPFS
      const contentCID = await uploadToIPFS(content)

      //注意后端不需上传链上数据，所有合约相关都是尽可能在前端，通过钱包组件调用合约实现
      
      // 更新章节状态
      return await prisma.chapter.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          contentCID,
          updatedAt: new Date()
        }
      })
    } catch (error) {
      console.error('发布章节失败:', error)
      throw new Error('发布章节失败')
    }
  }

  // 获取章节列表
  async getChaptersByStoryId(storyId: string) {
    return await prisma.chapter.findMany({
      where: {
        storyId: storyId
      },
      orderBy: {
        order: 'asc'
      },
      select: {
        id: true,
        title: true,
        wordCount: true,
        order: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

 // 获取章节内容
 async getChapter(id: string, storyId?: string) {
  // @ts-ignore - 忽略类型检查，因为我们已经修改了 Prisma 模型
  const chapter = await prisma.chapter.findUnique({
    where: { 
      id,
      ...(storyId ? { storyId } : {})
    },
    include: {
      story: {
        include: {
          author: true
        }
      }
    }
  })

  if (!chapter) throw new Error('Chapter not found')
  
  // 如果提供了 storyId 但章节不属于该故事，则拒绝访问
  if (storyId && chapter.storyId !== storyId) {
    throw new Error('章节不属于指定的故事')
  }

  // 如果是草稿状态，直接返回content
  // @ts-ignore - 忽略类型检查，因为我们已经修改了 Prisma 模型
  if (chapter.status === 'DRAFT' && chapter.content) {
    return chapter
  }

  // 如果是已发布状态，从IPFS获取内容
  if (chapter.contentCID) {
    const content = await getFromIPFS(chapter.contentCID)
    return { ...chapter, content }
  }

 }

}

// 导出单例实例
export const storyService = new StoryService() 