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
    chainId?: string  // 添加链上ID字段
  }) {
    console.log('[StoryService.saveStory] 开始保存故事:', {
      title: data.title,
      authorAddress: data.authorAddress,
      chainId: data.chainId  // 添加链上ID日志
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
          wordCount: data.content.length,
          targetWordCount: data.targetWordCount,
          isNFT: false,
          chainId: data.chainId ? parseInt(data.chainId) : null
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
    console.log('[StoryService.getStory] 开始获取故事:', { id });

    try {
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
          category: true,
          tags: true,
          wordCount: true,
          targetWordCount: true,
          createdAt: true,
          updatedAt: true,
          nftAddress: true,  // NFT合约地址
          chainId: true,     // 链上故事ID
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
      });

      console.log('[StoryService.getStory] 数据库查询结果:', {
        found: !!story,
        storyId: story?.id,
        title: story?.title,
        nftAddress: story?.nftAddress,
        chainId: story?.chainId,
        authorAddress: story?.authorId
      });

      if (!story) {
        console.log('[StoryService.getStory] 故事不存在:', { id });
        return null;
      }

      // 2. 内容按需从 IPFS 获取
      if (story) {
        console.log('[StoryService.getStory] 开始从IPFS获取内容:', { contentCID: story.contentCID });
        const content = await getFromIPFS(story.contentCID);
        console.log('[StoryService.getStory] IPFS内容获取成功:', { 
          contentLength: content?.length,
          hasContent: !!content 
        });
        return { ...story, content };
      }
    } catch (error) {
      console.error('[StoryService.getStory] 获取故事失败:', error);
      throw error;
    }
  }

  // 获取故事列表
  async getStories(params: {
    category?: string
    authorId?: string
    skip?: number
    take?: number
    orderBy?: string
  }) {
    console.log('[StoryService.getStories] 开始获取故事列表:', params)

    try {
      const { category, authorId, skip = 0, take = 10, orderBy } = params
      const where = {
        ...(category && { category }),
        ...(authorId && { authorId })
      }

      const [total, stories] = await Promise.all([
        prisma.story.count({ where }),
        prisma.story.findMany({
          where,
          skip,
          take,
          include: {
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
          },
          orderBy: orderBy ? { [orderBy]: 'desc' } : { createdAt: 'desc' }
        })
      ])

      // 为没有封面的作品添加默认封面
      const processedStories = stories.map(story => ({
        ...story,
        cover: story.cover || 'https://tale-forge.com/images/story-default-cover.jpg'
      }))

      return { stories: processedStories, total }
    } catch (error) {
      console.error('[StoryService.getStories] 获取失败:', error)
      throw error
    }
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
    // 检查是否已存在相同序号的章节
    const existingChapter = await prisma.chapter.findFirst({
      where: {
        storyId,
        order: data.order
      }
    });

    if (existingChapter) {
      throw new Error(`已存在第 ${data.order} 章节，请选择其他章节序号`);
    }

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


  // 发布章节
  async publishChapter(id: string, authorAddress: string, storyId?: string, txHash?: string) {
    // 如果提供了 storyId，先验证章节是否属于该故事
    if (storyId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id },
        include: { story: true }
      });
      
      if (!chapter) {
        throw new Error('章节不存在');
      }
      
      if (chapter.storyId !== storyId) {
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

    // console.log('【publishChapter】作者地址:', authorAddress);
    // console.log('【publishChapter】chapter.story.authorId', chapter.story.authorId);

    // // 验证作者身份
    // if (chapter.story.authorId !== authorAddress) {
    //   throw new Error('只有作者才能发布章节')
    // }

    // 获取章节内容
    const content = chapter.content

    if (!content) {
      throw new Error('章节内容为空')
    }

    try {
      // 上传到IPFS
      const contentCID = await uploadToIPFS(content)
      console.log(`成功上传章节内容到IPFS，CID: ${contentCID}`)

      //注意后端不需上传链上数据，所有合约相关都是尽可能在前端，通过钱包组件调用合约实现
      
      // 更新章节状态，保留content作为备份
      return await prisma.chapter.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          contentCID,
          txHash,  // 添加交易哈希
          // 注意：不清空content字段，保留作为备份
          updatedAt: new Date()
        }
      })
    } catch (error) {
      console.error('发布章节失败:', error)
      throw new Error('发布章节失败')
    }
  }

  // 更新章节（保存章节）
  async updateChapter(id: string, data: {
    title?: string
    content?: string
    order?: number
    wordCount?: number
  }, storyId?: string) {
    // 如果提供了 storyId，先验证章节是否属于该故事
    if (storyId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id },
        include: { story: true }
      });
      
      if (!chapter) {
        throw new Error('章节不存在');
      }
      
      if (chapter.storyId !== storyId) {
        throw new Error('章节不属于指定的故事');
      }
    }
    
    // 更新章节
    return await prisma.chapter.update({
      where: { id },
      data
    });
  }


  // 删除章节
  async deleteChapter(id: string, storyId?: string) {
    // 如果提供了 storyId，先验证章节是否属于该故事
    if (storyId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id },
        include: { story: true }
      });
      
      if (!chapter) {
        throw new Error('章节不存在');
      }
      
      if (chapter.storyId !== storyId) {
        throw new Error('章节不属于指定的故事');
      }
    }
    
    return await prisma.chapter.delete({
      where: { id }
    });
  }


  // 获取章节列表
  async getChaptersByStoryId(storyId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    
    return await prisma.chapter.findMany({
      where: {
        storyId: storyId
      },
      orderBy: {
        order: 'asc'
      },
      skip,
      take: limit,
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

  // 获取章节统计信息
  async getChapterStats(storyId: string) {
    console.log(`[getChapterStats] 开始获取故事 ${storyId} 的章节统计信息`);
    
    // 获取所有章节和它们的状态信息
    const chapters = await prisma.chapter.findMany({
      where: {
        storyId: storyId
      },
      select: {
        id: true,
        status: true,
        title: true // 添加标题便于识别
      }
    });
    
    console.log(`[getChapterStats] 所有章节数量: ${chapters.length}`);
    
    // 更详细地记录每个章节的状态
    chapters.forEach((chapter, index) => {
      console.log(`[getChapterStats] 章节 ${index+1}: ID=${chapter.id}, 标题=${chapter.title}, 状态=${chapter.status}`);
    });
    
    // 获取章节总数
    const totalCount = chapters.length;
    
    // 统计各种状态的章节数量
    const statusCounts = chapters.reduce((acc, chapter) => {
      const status = chapter.status || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`[getChapterStats] 各状态章节数量:`, statusCounts);
    
    // 获取已发布章节数
    const publishedCount = await prisma.chapter.count({
      where: {
        storyId: storyId,
        status: 'PUBLISHED'
      }
    });
    
    console.log(`[getChapterStats] PUBLISHED 章节数: ${publishedCount}`);
    
    // 获取草稿章节数 - 这里原来可能有问题
    const draftCount = await prisma.chapter.count({
      where: {
        storyId: storyId,
        status: 'DRAFT'  // 明确指定为DRAFT而不是not PUBLISHED
      }
    });
    
    console.log(`[getChapterStats] DRAFT 章节数: ${draftCount}`);
    console.log(`[getChapterStats] 统计结果: 总计=${totalCount}, 已发布=${publishedCount}, 草稿=${draftCount}`);
    
    // 检查数据一致性
    if (publishedCount + draftCount !== totalCount) {
      console.warn(`[getChapterStats] ⚠️ 数据不一致! 总数(${totalCount}) ≠ 已发布(${publishedCount}) + 草稿(${draftCount})`);
      console.warn(`[getChapterStats] 可能存在未定义的状态值，详情:`, statusCounts);
    }
    
    // 返回统计信息
    return {
      total: totalCount,
      published: publishedCount,
      draft: draftCount,
      statusCounts: statusCounts
    };
  }
  
  // 获取最近的章节
  async getRecentChapters(storyId: string, limit: number = 10) {
    console.log(`[getRecentChapters] 开始获取故事 ${storyId} 的最近章节，限制数量: ${limit}`);
    
    try {
      const chapters = await prisma.chapter.findMany({
        where: {
          storyId: storyId
        },
        orderBy: {
          order: 'desc' // 按章节序号降序排列
        },
        take: limit,
        select: {
          id: true,
          title: true,
          order: true,
          status: true,
          wordCount: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      console.log(`[getRecentChapters] 查询到 ${chapters.length} 个章节`);
      console.log(`[getRecentChapters] 章节序号范围: ${chapters.length > 0 ? `${chapters[chapters.length-1].order} 到 ${chapters[0].order}` : '无章节'}`);
      
      // 打印章节详情
      if (chapters.length > 0) {
        console.table(chapters.map(c => ({
          id: c.id.substring(0, 8),
          order: c.order,
          title: c.title,
          status: c.status,
          wordCount: c.wordCount
        })));
      }
      
      return chapters;
    } catch (error) {
      console.error(`[getRecentChapters] 获取故事章节失败:`, error);
      throw error;
    }
  }
  
  // 获取指定范围的章节
  async getChaptersByRange(storyId: string, start: number, end: number) {
    return await prisma.chapter.findMany({
      where: {
        storyId: storyId,
        order: {
          gte: end,
          lte: start
        }
      },
      orderBy: {
        order: 'desc' // 按章节序号降序排列
      },
      select: {
        id: true,
        title: true,
        order: true,
        status: true,
        wordCount: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }
  
  // 搜索章节
  async searchChapters(storyId: string, keyword: string) {
    return await prisma.chapter.findMany({
      where: {
        storyId: storyId,
        title: {
          contains: keyword,
          mode: 'insensitive' // 不区分大小写
        }
      },
      orderBy: {
        order: 'desc' // 按章节序号降序排列
      },
      select: {
        id: true,
        title: true,
        order: true,
        status: true,
        wordCount: true,
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

  // 如果是草稿状态，直接返回chapter（无论content是否为空）
  if (chapter.status === 'DRAFT') {
    // 确保content字段存在，如果不存在则设为空字符串
    return { ...chapter, content: chapter.content || '' };
  }

  // 如果是已发布状态，从IPFS获取内容
  if (chapter.contentCID) {
    try {
      console.log(`尝试从IPFS获取章节内容 (章节ID: ${id}, CID: ${chapter.contentCID})`);
      const content = await getFromIPFS(chapter.contentCID);
      console.log(`成功从IPFS获取内容，内容长度: ${content ? content.length : 0} 字符`);
      return { ...chapter, content };
    } catch (error) {
      console.error(`从IPFS获取内容失败 (章节ID: ${id}, CID: ${chapter.contentCID}):`, error);
      
      // 如果IPFS获取失败，尝试使用数据库中的content字段作为备份
      if (chapter.content) {
        console.log(`使用数据库中的content字段作为备份，内容长度: ${chapter.content.length} 字符`);
        return { ...chapter, content: chapter.content };
      }
      
      // 如果数据库中也没有content，则返回空内容
      console.warn(`IPFS获取失败且数据库中也没有content字段，返回空内容`);
      return { ...chapter, content: '' };
    }
  }
  
  // 如果既不是草稿也没有contentCID，返回章节数据但内容为空
  console.warn(`章节 ${id} 状态为 ${chapter.status}，但没有contentCID，返回空内容`);
  return { ...chapter, content: '' };
 }

}

// 导出单例实例
export const storyService = new StoryService() 