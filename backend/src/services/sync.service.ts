import prisma from '../prisma'
import { uploadToIPFS, getFromIPFS } from '../utils/ipfs'
import { ethers } from 'ethers'
import { CONTRACT_ADDRESSES, ABIS } from '@tale-forge/shared'
import type { StoryStatus } from '@prisma/client'
// import type { 
//   StoryCreatedEvent,
//   ChapterUpdatedEvent
// } from '@tale-forge/shared'

export class SyncService {
  private provider: ethers.providers.Provider
  private contracts: {
    story: ethers.Contract
    author: ethers.Contract
  }

  constructor(provider: ethers.providers.Provider) {
    this.provider = provider
    this.contracts = {
      story: new ethers.Contract(
        CONTRACT_ADDRESSES.StoryManager,
        ABIS.StoryManager,
        provider
      ),
      author: new ethers.Contract(
        CONTRACT_ADDRESSES.AuthorManager,
        ABIS.AuthorManager,
        provider
      )
    }
  }

  // 同步故事数据
  async syncStories(fromBlock: number) {
    const filter = this.contracts.story.filters.StoryCreated()
    const events = await this.contracts.story.queryFilter(filter, fromBlock)

    for (const event of events as ethers.Event[]) {
      const [id, author, title] = event.args || []
      
      // 从链上获取完整数据
      const storyData = await this.contracts.story.getStory(id)
      
      // 更新数据库
      await prisma.story.upsert({
        where: { id: id.toString() },
        create: {
          id: id.toString(),
          title: storyData.title,
          description: storyData.description,
          contentCID: storyData.contentCid,
          category: 'GENERAL', // 默认分类
          authorId: author,
          status: 'DRAFT' as StoryStatus,
          targetWordCount: 0,
          wordCount: 0
        },
        update: {
          title: storyData.title,
          description: storyData.description,
          contentCID: storyData.contentCid
        }
      })
    }

    // 更新同步状态
    await this.updateSyncState('story', await this.provider.getBlockNumber())
  }

  // 同步作者数据
  async syncAuthors(fromBlock: number) {
    const filter = this.contracts.author.filters.AuthorRegistered()
    const events = await this.contracts.author.queryFilter(filter, fromBlock)

    for (const event of events as ethers.Event[]) {
      const [address, penName] = event.args || []
      
      // 从链上获取完整数据
      const authorData = await this.contracts.author.getAuthor(address)
      
      // 更新数据库
      await prisma.user.upsert({
        where: { address },
        create: {
          address,
          authorName: penName,
          isAuthor: true,
          // ... 其他字段
        },
        update: {
          authorName: penName,
          // ... 其他字段
        }
      })
    }

    // 更新同步状态
    await this.updateSyncState('author', await this.provider.getBlockNumber())
  }

  // 获取同步状态
  private async getSyncState(type: string): Promise<number> {
    const state = await prisma.syncState.findUnique({
      where: { type }
    })
    return state?.blockNumber || 0
  }

  // 更新同步状态
  private async updateSyncState(type: string, blockNumber: number) {
    await prisma.syncState.upsert({
      where: { type },
      create: { type, blockNumber },
      update: { blockNumber }
    })
  }

  // 启动同步
  async startSync() {
    try {
      // 同步故事
      const storyFromBlock = await this.getSyncState('story')
      await this.syncStories(storyFromBlock)

      // 同步作者
      const authorFromBlock = await this.getSyncState('author')
      await this.syncAuthors(authorFromBlock)
    } catch (error) {
      console.error('Sync failed:', error)
      throw error
    }
  }

  // 导出单例实例
  static getInstance(provider: ethers.providers.Provider): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService(provider)
    }
    return SyncService.instance
  }

  private static instance: SyncService | null = null
}

// 导出单例实例
export const syncService = SyncService.getInstance(
  new ethers.providers.JsonRpcProvider(process.env.RPC_URL)
)
