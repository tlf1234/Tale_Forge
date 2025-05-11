import prisma from '../prisma'
import { uploadToIPFS, getJSONFromIPFS, uploadJSONToIPFS, getFromIPFS } from '../ipfs'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Contract } from '@ethersproject/contracts'
import { formatEther } from '@ethersproject/units'
import { CONTRACT_ADDRESS, CONTRACT_ABI, getProvider, getContractWithSigner } from '../config/contract'
import type { StoryStatus } from '@prisma/client'
import type { SyncStatus } from '@prisma/client'

export class SyncService {
  private provider: JsonRpcProvider | null = null

  constructor() {
    // 初始化 provider
    this.initProvider()
  }

  private async initProvider() {
    this.provider = await getProvider()
  }

  private async ensureProvider() {
    if (!this.provider) {
      this.provider = await getProvider()
    }
    return this.provider
  }

  /**
   * 处理故事创建前的准备工作
   */
  async prepareStoryCreation(data: {
    title: string
    description: string
    content: string
    coverImage?: string
    authorAddress: string
  }) {
    console.log('[SyncService.prepareStoryCreation] 开始准备创建故事:', { 
      title: data.title,
      authorAddress: data.authorAddress 
    })

    try {
      // 1. 准备内容数据
      const contentData = {
        content: data.content,
        description: data.description,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }

      // 2. 上传内容到IPFS
      console.log('[SyncService.prepareStoryCreation] 上传内容到IPFS...')
      const contentCid = await uploadToIPFS(JSON.stringify(contentData))

      // 3. 处理封面图片
      let coverCid = '/images/story-default-cover.jpg'
      if (data.coverImage) {
        if (data.coverImage.startsWith('data:image')) {
          console.log('[SyncService.prepareStoryCreation] 上传封面到IPFS...')
          coverCid = await uploadToIPFS(data.coverImage)
        } else {
          coverCid = data.coverImage
        }
      }

      console.log('[SyncService.prepareStoryCreation] 准备完成:', {
        contentCid,
        coverCid
      })

      return {
        contentCid,
        coverCid
      }
    } catch (error) {
      console.error('[SyncService.prepareStoryCreation] 准备失败:', error)
      throw error
    }
  }

  /**
   * 从链上获取作者作品列表
   */
  async getAuthorStoriesFromChain(authorAddress: string) {
    console.log('[SyncService.getAuthorStoriesFromChain] 开始从链上获取作品:', authorAddress)
    
    try {
      const provider = await this.ensureProvider()
      if (!provider) {
        throw new Error('无法获取 provider')
      }

      const contract = new Contract(
        CONTRACT_ADDRESS.StoryManager,
        CONTRACT_ABI.StoryManager,
        provider
      )
      
      const stories = await contract.getAuthorStories(authorAddress)
      console.log('[SyncService.getAuthorStoriesFromChain] 链上作品数据:', stories)
      
      return stories
    } catch (error) {
      console.error('[SyncService.getAuthorStoriesFromChain] 获取失败:', error)
      throw error
    }
  }

  /**
   * 获取区块链同步状态
   */
  async getChainSyncState(type: string) {
    return await prisma.chainSyncState.findUnique({
      where: { type }
    })
  }

  /**
   * 更新区块链同步状态
   */
  async updateChainSyncState(type: string, blockNumber: number) {
    return await prisma.chainSyncState.upsert({
      where: { type },
      update: { 
        blockNumber,
        updatedAt: new Date()
      },
      create: {
        type,
        blockNumber
      }
    })
  }

  /**
   * 获取作者作品同步状态
   */
  async getAuthorStoriesSyncState(authorId: string) {
    return await prisma.authorStoriesSync.findUnique({
      where: { authorId }
    })
  }

  /**
   * 将链上作品数据同步到数据库
   */
  async syncStoryFromChain(storyData: any) {
    console.log('[SyncService.syncStoryFromChain] 开始同步链上作品:', storyData)
    
    try {
      // 1. 从IPFS获取作品内容
      const rawContent = await getFromIPFS(storyData.contentHash)
      const content = JSON.parse(typeof rawContent === 'string' ? rawContent : rawContent.toString('utf-8'))
      
      // 2. 保存到数据库
      const story = await prisma.story.upsert({
        where: { 
          id: storyData.id 
        },
        update: {
          title: storyData.title,
          description: content.description,
          contentCid: storyData.contentHash,
          coverCid: storyData.coverCid,
          updatedAt: new Date(Number(storyData.lastUpdate) * 1000)
        },
        create: {
          id: storyData.id,
          title: storyData.title,
          description: content.description,
          contentCid: storyData.contentHash,
          coverCid: storyData.coverCid,
          authorId: storyData.authorId,
          category: content.category || 'GENERAL',
          tags: content.tags || [],
          createdAt: new Date(Number(storyData.createdAt) * 1000),
          updatedAt: new Date(Number(storyData.lastUpdate) * 1000)
        }
      })
      
      console.log('[SyncService.syncStoryFromChain] 同步完成:', story)
      return story
    } catch (error) {
      console.error('[SyncService.syncStoryFromChain] 同步失败:', error)
      throw error
    }
  }

  /**
   * 触发作品同步
   */
  async triggerStoriesSync(authorId: string) {
    console.log('[SyncService.triggerStoriesSync] 开始同步作者作品:', authorId)

    // 1. 更新同步状态为进行中
    await prisma.authorStoriesSync.upsert({
      where: { authorId },
      update: {
        syncStatus: 'SYNCING',
        lastSynced: new Date(),
        errorMessage: null
      },
      create: {
        authorId,
        syncStatus: 'SYNCING'
      }
    })

    // 2. 异步执行同步操作
    this.syncAuthorStoriesAsync(authorId).catch(error => {
      console.error('[SyncService.triggerStoriesSync] 同步失败:', error)
    })
  }

  /**
   * 从链上获取作者作品列表并同步到数据库
   */
  private async syncAuthorStoriesAsync(authorId: string) {
    let rawContent: string | null = null;
    try {
      console.log('[SyncService.syncAuthorStoriesAsync] 开始异步同步:', authorId)

      // 1. 获取作者钱包地址
      const author = await prisma.user.findUnique({
        where: { id: authorId }
      })

      if (!author?.address) {
        throw new Error('作者信息不存在')
      }

      // 2. 从链上获取作品列表
      const provider = await this.ensureProvider()
      if (!provider) {
        throw new Error('无法获取 provider')
      }

      const storyManager = new Contract(
        CONTRACT_ADDRESS.StoryManager,
        CONTRACT_ABI.StoryManager,
        provider
      )
      
      const onchainStoryIds = await storyManager.getAuthorStories(author.address)
      console.log('[SyncService.syncAuthorStoriesAsync] 从链上获取到作品 IDs:', onchainStoryIds)

      // 3. 同步每个作品
      for (const storyId of onchainStoryIds) {
        try {
          // 获取链上作品详情
          const story = await storyManager.stories(storyId)
          console.log(`[SyncService.syncAuthorStoriesAsync] 作品 ID ${storyId} 链上数据:`, story)

          // 安全地处理数据
          const storyData = {
            id: storyId.toString(),
            title: story.title || '',
            authorId: story.author || '',
            contentHash: story.contentCid || '',
            coverCid: story.coverCid || '/images/story-default-cover.jpg',
            createdAt: story.createdAt ? new Date(story.createdAt.toNumber() * 1000) : new Date(),
            updatedAt: story.lastUpdate ? new Date(story.lastUpdate.toNumber() * 1000) : new Date()
          }

          console.log(`[SyncService.syncAuthorStoriesAsync] 作品 ID ${storyId} 的 contentHash:`, storyData.contentHash);
          // 从 IPFS 获取内容
          const response = await getFromIPFS(storyData.contentHash);

          if (!response) {
            throw new Error('无法获取IPFS内容')
          }

          // 确保 response 是字符串
          rawContent = typeof response === 'string' ? response : response.toString('utf-8');

          console.log(`[SyncService.syncAuthorStoriesAsync] 作品 ID ${storyId} IPFS原始内容:`, rawContent)
          
          let content;
          try {
            content = JSON.parse(rawContent || '')
            console.log(`[SyncService.syncAuthorStoriesAsync] 作品 ID ${storyId} JSON解析成功:`, content)
          } catch (parseError) {
            console.error(`[SyncService.syncAuthorStoriesAsync] 作品 ID ${storyId} JSON解析失败，使用原始内容:`, parseError)
            // 如果不是JSON格式，使用原始内容构建一个基本的内容对象
            const description = typeof rawContent === 'string' 
              ? rawContent.slice(0, 200)  // 如果是字符串，取前200个字符
              : String(rawContent).slice(0, 200);  // 如果不是字符串，先转换成字符串
            
            content = {
              content: rawContent,
              description: description,
              timestamp: new Date().toISOString(),
              version: '1.0'
            }
          }
          
          // 保存到数据库
          await prisma.story.upsert({
            where: { 
              id: storyData.id 
            },
            update: {
              title: storyData.title,
              description: content.description || '',
              contentCid: storyData.contentHash,
              coverCid: storyData.coverCid,
              updatedAt: storyData.updatedAt
            },
            create: {
              id: storyData.id,
              title: storyData.title,
              description: content.description || '',
              contentCid: storyData.contentHash,
              coverCid: storyData.coverCid,
              authorId: author.id,
              category: content.category || 'GENERAL',
              tags: content.tags || [],
              createdAt: storyData.createdAt,
              updatedAt: storyData.updatedAt,
              wordCount: 0,
              targetWordCount: 10000
            }
          })

          console.log(`[SyncService.syncAuthorStoriesAsync] 作品 ID ${storyId} 同步完成`)
        } catch (error) {
          console.error(`[SyncService.syncAuthorStoriesAsync] 作品 ID ${storyId} 同步失败:`, error)
          // 继续同步其他作品
          continue
        }
      }

      // 4. 更新同步状态为完成
      if (rawContent) {
        await prisma.authorStoriesSync.update({
          where: { authorId },
          data: {
            syncStatus: 'COMPLETED',
            lastSynced: new Date(),
            errorMessage: null
          }
        });
        console.log('[SyncService.syncAuthorStoriesAsync] 同步完成:', authorId);
      } else {
        // 如果获取失败，更新状态为失败
        await prisma.authorStoriesSync.update({
          where: { authorId },
          data: {
            syncStatus: 'FAILED',
            errorMessage: '无法获取IPFS内容',
            retryCount: {
              increment: 1
            }
          }
        });
        console.error('[SyncService.syncAuthorStoriesAsync] 同步失败: 无法获取IPFS内容');
      }
    } catch (error) {
      console.error('[SyncService.syncAuthorStoriesAsync] 同步失败:', error)

      // 5. 更新同步状态为失败
      await prisma.authorStoriesSync.update({
        where: { authorId },
        data: {
          syncStatus: 'FAILED',
          errorMessage: error instanceof Error ? error.message : '同步失败',
          retryCount: {
            increment: 1
          }
        }
      })

      throw error
    }
  }

  //上传章节数据到链上(后端不考虑用合约写入功能，所有合约相关都是尽可能在前端，通过钱包组件调用合约实现)
  // async uploadChapterData(chapterData: any) {
  //   console.log('[SyncService.uploadChapterData] 开始上传章节数据:', chapterData)

  //   try {
  //     // 确保 provider 已初始化
  //     const provider = await this.ensureProvider()
  //     if (!provider) {
  //       throw new Error('无法获取 provider')
  //     }

  //     // 获取故事信息，以获取链上 ID
  //     const chapter = await prisma.chapter.findUnique({
  //       where: { id: chapterData.id },
  //       include: {
  //         story: true
  //       }
  //     })

  //     if (!chapter || !chapter.story) {
  //       throw new Error('章节或故事信息不存在')
  //     }

  //     // 获取故事的链上 ID
  //     const storyChainId = chapter.story.nftAddress ? parseInt(chapter.story.nftAddress) : 0;
  //     if (!storyChainId) {
  //       throw new Error('故事链上 ID 不存在')
  //     }

  //     // 计算章节字数
  //     const wordCount = chapterData.content ? chapterData.content.length : 0

  //     // 获取带签名的合约实例
  //     const contract = getContractWithSigner(
  //       CONTRACT_ADDRESS.StoryManager,
  //       CONTRACT_ABI.StoryManager,
  //       provider
  //     )
      
  //     console.log('[SyncService.uploadChapterData] 调用合约更新章节:', {
  //       storyId: storyChainId,
  //       chapterNumber: chapter.order,
  //       title: chapterData.title,
  //       wordCount
  //     })

  //     // 调用合约的 updateChapter 函数
  //     // 参数：故事ID, 章节序号, 章节标题, 内容摘要, 字数
  //     const tx = await contract.updateChapter(
  //       storyChainId,         // 故事的链上ID
  //       chapter.order,        // 章节序号
  //       chapterData.title,    // 章节标题
  //       '',                   // 内容摘要，这里不使用 contentCid
  //       wordCount             // 章节字数
  //     )
      
  //     // 等待交易确认
  //     const receipt = await tx.wait()
      
  //     console.log('[SyncService.uploadChapterData] 章节上链成功:', receipt.transactionHash)

  //     // 更新数据库中的章节信息
  //     const updatedChapter = await prisma.chapter.update({
  //       where: { id: chapterData.id },
  //       data: {
  //         title: chapterData.title,
  //         content: chapterData.content,
  //         status: chapterData.status,
  //         txHash: receipt.transactionHash,
  //         wordCount,
  //         updatedAt: new Date()
  //       }
  //     })

  //     console.log('[SyncService.uploadChapterData] 章节数据上传完成:', updatedChapter)
  //     return updatedChapter
  //   } catch (error) {
  //     console.error('[SyncService.uploadChapterData] 章节数据上传失败:', error)
  //     throw error
  //   }
  // }

  // 批量上传点赞、评论、收藏数据到链上
  async collectInteractionData() {
    console.log('[SyncService.collectInteractionData] 开始收集互动数据', { timestamp: new Date().toISOString() })
    
    try {
      // 获取上次同步时间
      const lastSyncState = await prisma.chainSyncState.findUnique({
        where: { type: 'interactions' }
      })
      
      const lastSyncTime = lastSyncState?.updatedAt || new Date(0)
      console.log('[SyncService.collectInteractionData] 上次同步时间:', { 
        lastSyncTime: lastSyncTime.toISOString(),
        hasExistingState: !!lastSyncState 
      })
      
      // 获取新的点赞数据（按作品分组）- 只获取状态为PENDING的记录
      const newLikes = await prisma.like.groupBy({
        by: ['storyId'],
        _count: {
          id: true
        },
        where: {
          onChainStatus: 'PENDING',
          createdAt: {
            gt: lastSyncTime
          }
        }
      })
      
      console.log('[SyncService.collectInteractionData] 获取到新的点赞数据:', { 
        storyCount: newLikes.length,
        storyIds: newLikes.map(l => l.storyId).join(',')
      })
      
      // 获取新的评论数据（按作品分组）- 只获取状态为PENDING的记录
      const newComments = await prisma.comment.groupBy({
        by: ['storyId'],
        _count: {
          id: true
        },
        where: {
          onChainStatus: 'PENDING',
          createdAt: {
            gt: lastSyncTime
          },
          storyId: {
            not: null
          }
        }
      })
      
      console.log('[SyncService.collectInteractionData] 获取到新的评论数据:', { 
        storyCount: newComments.length,
        storyIds: newComments.map(c => c.storyId).join(',')
      })
      
      // 获取新的收藏数据（按作品分组）- 只获取状态为PENDING的记录
      const newFavorites = await prisma.favorite.groupBy({
        by: ['storyId'],
        _count: {
          id: true
        },
        where: {
          onChainStatus: 'PENDING',
          createdAt: {
            gt: lastSyncTime
          }
        }
      })
      
      console.log('[SyncService.collectInteractionData] 获取到新的收藏数据:', { 
        storyCount: newFavorites.length,
        storyIds: newFavorites.map(f => f.storyId).join(',')
      })
      
      // 合并互动数据，按作品ID整合
      const storyInteractions = new Map()
      
      // 处理点赞数据
      for (const like of newLikes) {
        if (!storyInteractions.has(like.storyId)) {
          storyInteractions.set(like.storyId, {
            storyId: like.storyId,
            newLikes: 0,
            newComments: 0,
            newFavorites: 0,
            newShares: 0
          })
        }
        storyInteractions.get(like.storyId).newLikes += like._count.id
      }
      
      // 处理评论数据
      for (const comment of newComments) {
        if (comment.storyId) {
          if (!storyInteractions.has(comment.storyId)) {
            storyInteractions.set(comment.storyId, {
              storyId: comment.storyId,
              newLikes: 0,
              newComments: 0,
              newFavorites: 0,
              newShares: 0
            })
          }
          storyInteractions.get(comment.storyId).newComments += comment._count.id
        }
      }
      
      // 处理收藏数据
      for (const favorite of newFavorites) {
        if (!storyInteractions.has(favorite.storyId)) {
          storyInteractions.set(favorite.storyId, {
            storyId: favorite.storyId,
            newLikes: 0,
            newComments: 0,
            newFavorites: 0,
            newShares: 0
          })
        }
        storyInteractions.get(favorite.storyId).newFavorites += favorite._count.id
      }
      
      // 转换为数组
      const interactionsArray = Array.from(storyInteractions.values())
      
      console.log('[SyncService.collectInteractionData] 合并后的互动数据:', { 
        totalStories: interactionsArray.length,
        data: interactionsArray 
      })
      
      // 过滤掉无互动的作品
      const filteredInteractions = interactionsArray.filter(
        item => item.newLikes > 0 || item.newComments > 0 || item.newFavorites > 0
      )
      
      console.log('[SyncService.collectInteractionData] 过滤后的互动数据:', { 
        totalStories: filteredInteractions.length,
        totalInteractions: filteredInteractions.reduce((sum, item) => 
          sum + item.newLikes + item.newComments + item.newFavorites, 0)
      })
      
      // 批量上链
      if (filteredInteractions.length > 0) {
        // 获取每个作品的chainId
        const storyIdToChainIdMap = new Map()
        const stories = await prisma.story.findMany({
          where: {
            id: {
              in: filteredInteractions.map(item => item.storyId)
            }
          },
          select: {
            id: true,
            chainId: true
          }
        })
        
        console.log('[SyncService.collectInteractionData] 查询到的故事链上ID:', { 
          totalStories: stories.length,
          storiesWithChainId: stories.filter(s => s.chainId).length,
          chainIdMapping: stories.map(s => `${s.id}:${s.chainId || 'null'}`).join(',')
        })
        
        for (const story of stories) {
          if (story.chainId) {
            storyIdToChainIdMap.set(story.id, story.chainId)
          }
        }
        
        // 准备上链数据，转换为链上ID
        const batchInteractions = filteredInteractions
          .filter(item => storyIdToChainIdMap.has(item.storyId))
          .map(item => ({
            storyId: storyIdToChainIdMap.get(item.storyId),
            newLikes: item.newLikes,
            newComments: item.newComments,
            newFavorites: item.newFavorites,
            newShares: item.newShares
          }))
        
        console.log('[SyncService.collectInteractionData] 最终准备上链的互动数据:', { 
          totalItems: batchInteractions.length,
          droppedItems: filteredInteractions.length - batchInteractions.length,
          totalInteractions: batchInteractions.reduce((sum, item) => 
            sum + item.newLikes + item.newComments + item.newFavorites, 0),
          data: batchInteractions
        })
        
        if (batchInteractions.length > 0) {
          return batchInteractions
        }
      }
      
      console.log('[SyncService.collectInteractionData] 无新互动数据需要上链')
      return []
    } catch (error) {
      console.error('[SyncService.collectInteractionData] 收集互动数据失败:', error)
      console.error('[SyncService.collectInteractionData] 错误堆栈:', error instanceof Error ? error.stack : 'No stack trace')
      throw error
    }
  }
  
  // 执行批量上链操作
  async uploadInteractionsBatch() {
    console.log('[SyncService.uploadInteractionsBatch] 开始批量上链操作', { timestamp: new Date().toISOString() })
    
    try {
      // 1. 收集互动数据
      const batchInteractions = await this.collectInteractionData()
      
      if (batchInteractions.length === 0) {
        console.log('[SyncService.uploadInteractionsBatch] 无互动数据需要上链')
        return null
      }
      
      // 2. 准备合约调用
      const provider = await this.ensureProvider()
      if (!provider) {
        console.error('[SyncService.uploadInteractionsBatch] Provider初始化失败')
        throw new Error('无法获取 provider')
      }
      
      console.log('[SyncService.uploadInteractionsBatch] Provider初始化成功:', { 
        network: provider.network?.name || 'unknown',
        chainId: provider.network?.chainId || 'unknown'
      })
      
      const storyManager = getContractWithSigner(
        CONTRACT_ADDRESS.StoryManager,
        CONTRACT_ABI.StoryManager,
        provider
      )
      
      if (!storyManager) {
        console.error('[SyncService.uploadInteractionsBatch] 合约初始化失败')
        throw new Error('无法初始化合约')
      }
      
      console.log('[SyncService.uploadInteractionsBatch] 合约初始化成功:', { 
        address: CONTRACT_ADDRESS.StoryManager
      })
      
      // 3. 生成批次ID (使用当前时间戳)
      const batchId = Math.floor(Date.now() / 1000).toString()
      
      // 4. 创建批次记录
      let interactionBatch = await prisma.interactionBatch.create({
        data: {
          batchId,
          storiesCount: batchInteractions.length,
          likesCount: batchInteractions.reduce((sum, item) => sum + item.newLikes, 0),
          commentsCount: batchInteractions.reduce((sum, item) => sum + item.newComments, 0),
          favoritesCount: batchInteractions.reduce((sum, item) => sum + item.newFavorites, 0),
          sharesCount: batchInteractions.reduce((sum, item) => sum + item.newShares, 0),
          status: 'PROCESSING'
        }
      })
      
      console.log('[SyncService.uploadInteractionsBatch] 创建批次记录成功:', { 
        batchId: interactionBatch.id,
        batchTimestamp: batchId,
        storiesCount: interactionBatch.storiesCount,
        interactionsCount: interactionBatch.likesCount + interactionBatch.commentsCount + interactionBatch.favoritesCount
      })
      
      // 5. 调用合约进行批量更新
      console.log('[SyncService.uploadInteractionsBatch] 准备调用合约进行批量更新:', {
        batchId,
        interactionsCount: batchInteractions.length,
        contract: CONTRACT_ADDRESS.StoryManager 
      })
      
      try {
        console.log('[SyncService.uploadInteractionsBatch] 调用合约函数 batchUpdateInteractions, 参数:', {
          batchId,
          interactions: JSON.stringify(batchInteractions)
        })
        
        const tx = await storyManager.batchUpdateInteractions(batchId, batchInteractions)
        
        console.log('[SyncService.uploadInteractionsBatch] 合约调用成功, 等待确认:', { 
          txHash: tx.hash,
          nonce: tx.nonce,
          gasLimit: tx.gasLimit?.toString() || 'unknown'
        })
        
        const receipt = await tx.wait()
        
        console.log('[SyncService.uploadInteractionsBatch] 交易确认成功:', {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed?.toString() || 'unknown',
          status: receipt.status,
          confirmations: receipt.confirmations,
          events: receipt.events?.length || 0
        })
        
        // 6. 更新批次记录
        interactionBatch = await prisma.interactionBatch.update({
          where: { id: interactionBatch.id },
          data: {
            txHash: receipt.transactionHash,
            status: 'COMPLETED',
            processedAt: new Date()
          }
        })
        
        console.log('[SyncService.uploadInteractionsBatch] 更新批次记录状态为完成:', { 
          batchId: interactionBatch.id,
          txHash: receipt.transactionHash,
          status: 'COMPLETED'
        })
        
        // 7. 更新同步状态
        const syncState = await prisma.chainSyncState.upsert({
          where: { type: 'interactions' },
          update: {
            blockNumber: receipt.blockNumber,
            updatedAt: new Date()
          },
          create: {
            type: 'interactions',
            blockNumber: receipt.blockNumber
          }
        })
        
        console.log('[SyncService.uploadInteractionsBatch] 更新链同步状态成功:', { 
          type: 'interactions',
          blockNumber: syncState.blockNumber,
          updatedAt: syncState.updatedAt
        })
        
        // 8. 更新互动记录状态为已上链
        console.log('[SyncService.uploadInteractionsBatch] 开始更新已上链互动记录状态')
        
        try {
          // 更新PENDING状态的点赞记录
          const likesResult = await prisma.like.updateMany({
            where: {
              onChainStatus: 'PENDING',
              createdAt: {
                gt: syncState.updatedAt
              }
            },
            data: {
              onChainStatus: 'CONFIRMED',
              txHash: receipt.transactionHash
            }
          })
          
          console.log('[SyncService.uploadInteractionsBatch] 更新点赞记录状态成功:', { 
            count: likesResult.count
          })
          
          // 更新PENDING状态的评论记录
          const commentsResult = await prisma.comment.updateMany({
            where: {
              onChainStatus: 'PENDING',
              createdAt: {
                gt: syncState.updatedAt
              }
            },
            data: {
              onChainStatus: 'CONFIRMED',
              txHash: receipt.transactionHash
            }
          })
          
          console.log('[SyncService.uploadInteractionsBatch] 更新评论记录状态成功:', { 
            count: commentsResult.count
          })
          
          // 更新PENDING状态的收藏记录
          const favoritesResult = await prisma.favorite.updateMany({
            where: {
              onChainStatus: 'PENDING',
              createdAt: {
                gt: syncState.updatedAt
              }
            },
            data: {
              onChainStatus: 'CONFIRMED',
              txHash: receipt.transactionHash
            }
          })
          
          console.log('[SyncService.uploadInteractionsBatch] 更新收藏记录状态成功:', { 
            count: favoritesResult.count
          })
        } catch (updateError) {
          console.error('[SyncService.uploadInteractionsBatch] 更新互动记录状态失败:', updateError)
          // 这里不抛出错误，因为交易已经成功
        }
        
        return {
          batchId,
          txHash: receipt.transactionHash,
          interactionsCount: batchInteractions.length,
          status: 'COMPLETED'
        }
      } catch (error) {
        // 更新批次状态为失败
        await prisma.interactionBatch.update({
          where: { id: interactionBatch.id },
          data: {
            status: 'FAILED',
            processedAt: new Date()
          }
        })
        
        console.error('[SyncService.uploadInteractionsBatch] 批量上链失败:', error)
        console.error('[SyncService.uploadInteractionsBatch] 错误堆栈:', error instanceof Error ? error.stack : 'No stack trace')
        throw error
      }
    } catch (error) {
      console.error('[SyncService.uploadInteractionsBatch] 批量上链处理失败:', error)
      console.error('[SyncService.uploadInteractionsBatch] 错误堆栈:', error instanceof Error ? error.stack : 'No stack trace')
      throw error
    }
  }
  
  // 获取互动批次记录
  async getInteractionBatches(limit = 10, offset = 0) {
    try {
      const batches = await prisma.interactionBatch.findMany({
        take: limit,
        skip: offset,
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      return batches;
    } catch (error) {
      console.error('[SyncService.getInteractionBatches] 获取批次记录失败:', error);
      throw error;
    }
  }
  
  // 获取批次记录详情
  async getInteractionBatchById(id: string) {
    try {
      const batch = await prisma.interactionBatch.findUnique({
        where: { id }
      });
      
      return batch;
    } catch (error) {
      console.error('[SyncService.getInteractionBatchById] 获取批次记录详情失败:', error);
      throw error;
    }
  }
  
  // 定时上链任务。也可以手动触发上链
  async scheduleInteractionUploads() {
    console.log('[SyncService.scheduleInteractionUploads] 启动定时上链任务', { timestamp: new Date().toISOString() })
    
    try {
      // 这里可以使用 node-cron 或类似的库设置定时任务
      // 简单示例：每天凌晨2点执行一次上链操作
      const now = new Date()
      const target = new Date(now)
      target.setHours(2, 0, 0, 0)
      
      // 如果当前时间已经过了今天的执行时间，则设置为明天
      if (now.getTime() > target.getTime()) {
        target.setDate(target.getDate() + 1)
      }
      
      const delay = target.getTime() - now.getTime()
      
      console.log('[SyncService.scheduleInteractionUploads] 计划在以下时间执行上链:', {
        currentTime: now.toISOString(),
        targetTime: target.toISOString(),
        delayMs: delay,
        delayHours: (delay / (1000 * 60 * 60)).toFixed(2)
      })
      
      // 设置定时器
      setTimeout(async () => {
        try {
          console.log('[SyncService.scheduleInteractionUploads] 定时器触发, 开始执行上链任务', { 
            executionTime: new Date().toISOString() 
          })
          
          await this.uploadInteractionsBatch()
          
          console.log('[SyncService.scheduleInteractionUploads] 定时上链任务执行成功')
        } catch (error) {
          console.error('[SyncService.scheduleInteractionUploads] 定时上链任务执行失败:', error)
          console.error('[SyncService.scheduleInteractionUploads] 错误堆栈:', error instanceof Error ? error.stack : 'No stack trace')
        } finally {
          // 执行完毕后，再次调度下一次任务
          console.log('[SyncService.scheduleInteractionUploads] 重新调度下一次任务')
          this.scheduleInteractionUploads()
        }
      }, delay)
      
      return {
        scheduledTime: target.toISOString(),
        delayMs: delay
      }
    } catch (error) {
      console.error('[SyncService.scheduleInteractionUploads] 设置定时上链任务失败:', error)
      console.error('[SyncService.scheduleInteractionUploads] 错误堆栈:', error instanceof Error ? error.stack : 'No stack trace')
      throw error
    }
  }

  // 手动触发互动批量上链
  async triggerInteractionBatchUpload() {
    try {
      console.log('[SyncService.triggerInteractionBatchUpload] 手动触发批量上链', { timestamp: new Date().toISOString() });
      const result = await this.uploadInteractionsBatch();
      console.log('[SyncService.triggerInteractionBatchUpload] 手动触发批量上链完成:', result);
      return result;
    } catch (error) {
      console.error('[SyncService.triggerInteractionBatchUpload] 手动触发批量上链失败:', error);
      console.error('[SyncService.triggerInteractionBatchUpload] 错误堆栈:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }
  

}






// 导出单例实例
export const syncService = new SyncService()