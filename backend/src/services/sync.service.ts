import prisma from '../prisma'
import { uploadToIPFS, getFromIPFS } from '../ipfs'
import { ethers } from 'ethers'
import { CONTRACT_ADDRESSES, ABIS } from '@tale-forge/shared'
import type { StoryStatus } from '@prisma/client'
import type { SyncStatus } from '@prisma/client'

export class SyncService {
  private provider: ethers.providers.JsonRpcProvider

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(process.env.BSC_TESTNET_RPC_URL)
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
      let coverCid = 'https://tale-forge.com/images/story-default-cover.jpg'
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
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.StoryManager,
        ABIS.StoryManager,
        this.provider
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
      const content = await this.getContentFromIPFS(storyData.contentHash)
      
      // 2. 保存到数据库
      const story = await prisma.story.upsert({
        where: { 
          id: storyData.id 
        },
        update: {
          title: storyData.title,
          description: content.description,
          contentCID: storyData.contentHash,
          cover: content.coverImage,
          status: this.mapChainStatusToDBStatus(storyData.status),
          updatedAt: new Date(Number(storyData.lastUpdate) * 1000)
        },
        create: {
          id: storyData.id,
          title: storyData.title,
          description: content.description,
          contentCID: storyData.contentHash,
          cover: content.coverImage,
          authorId: storyData.authorId,
          category: content.category || 'GENERAL',
          tags: content.tags || [],
          status: this.mapChainStatusToDBStatus(storyData.status),
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
   * 异步同步作者作品
   */
  private async syncAuthorStoriesAsync(authorId: string) {
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
      const onchainStories = await this.getAuthorStoriesFromChain(author.address)
      console.log('[SyncService.syncAuthorStoriesAsync] 从链上获取到作品:', {
        count: onchainStories.length
      })

      // 3. 同步每个作品
      for (const story of onchainStories) {
        await this.syncStoryFromChain(story)
      }

      // 4. 更新同步状态为完成
      await prisma.authorStoriesSync.update({
        where: { authorId },
        data: {
          syncStatus: 'COMPLETED',
          lastSynced: new Date(),
          errorMessage: null
        }
      })

      console.log('[SyncService.syncAuthorStoriesAsync] 同步完成:', authorId)
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

  /**
   * 从IPFS获取内容
   */
  private async getContentFromIPFS(contentHash: string) {
    console.log('[SyncService.getContentFromIPFS] 开始获取IPFS内容:', contentHash)
    
    try {
      const response = await fetch(`${process.env.IPFS_GATEWAY}${contentHash}`)
      if (!response.ok) {
        throw new Error('Failed to fetch content from IPFS')
      }
      
      const content = await response.json()
      console.log('[SyncService.getContentFromIPFS] 获取成功')
      
      return content
    } catch (error) {
      console.error('[SyncService.getContentFromIPFS] 获取失败:', error)
      throw error
    }
  }

  /**
   * 将链上状态映射为数据库状态
   */
  private mapChainStatusToDBStatus(chainStatus: number): 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'SUSPENDED' {
    const statusMap: { [key: number]: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'SUSPENDED' } = {
      0: 'DRAFT',
      1: 'PUBLISHED',
      2: 'COMPLETED',
      3: 'SUSPENDED'
    }
    return statusMap[chainStatus] || 'DRAFT'
  }
}

// 导出单例实例
export const syncService = new SyncService() 