import { ethers } from 'ethers'
import { StoryManager__factory } from './typechain'
import type { StoryManager } from './typechain'
import { AuthorManager__factory } from './typechain'
import { NovelNFT__factory } from './typechain'
import { TaforToken__factory } from './typechain'
import { MiningPool__factory } from './typechain'
import { ReaderActivity__factory } from './typechain'
import { TippingSystem__factory } from './typechain'
import { TreasuryManager__factory } from './typechain'

import type { 
  AuthorManager,
  NovelNFT,
  TaforToken,
  MiningPool,
  ReaderActivity,
  TippingSystem,
  TreasuryManager
} from './typechain'

// 导出类型和工厂
export type { 
  StoryManager, 
  AuthorManager,
  NovelNFT,
  TaforToken,
  MiningPool,
  ReaderActivity,
  TippingSystem,
  TreasuryManager
}

export { 
  StoryManager__factory,
  AuthorManager__factory,
  NovelNFT__factory,
  TaforToken__factory,
  MiningPool__factory,
  ReaderActivity__factory,
  TippingSystem__factory,
  TreasuryManager__factory
}

// 合约交互
export class TaleForgeSDK {
  private provider: ethers.providers.Provider
  private signer?: ethers.Signer
  public readonly storyManager: StoryManager
  public readonly authorManager: AuthorManager
  public readonly novelNFT: NovelNFT
  public readonly taforToken: TaforToken
  public readonly miningPool: MiningPool
  public readonly readerActivity: ReaderActivity
  public readonly tippingSystem: TippingSystem
  public readonly treasuryManager: TreasuryManager

  constructor(provider: ethers.providers.Provider, signer?: ethers.Signer) {
    this.provider = provider
    this.signer = signer
    
    // 初始化合约
    this.storyManager = StoryManager__factory.connect(
      process.env.NEXT_PUBLIC_STORY_MANAGER_CONTRACT!,
      this.signer || this.provider
    )
    
    this.authorManager = AuthorManager__factory.connect(
      process.env.NEXT_PUBLIC_AUTHOR_MANAGER_CONTRACT!,
      this.signer || this.provider
    )
    
    this.novelNFT = NovelNFT__factory.connect(
      process.env.NEXT_PUBLIC_NOVEL_NFT_CONTRACT!,
      this.signer || this.provider
    )
    
    this.taforToken = TaforToken__factory.connect(
      process.env.NEXT_PUBLIC_TAFOR_TOKEN_CONTRACT!,
      this.signer || this.provider
    )
    
    this.miningPool = MiningPool__factory.connect(
      process.env.NEXT_PUBLIC_MINING_POOL_CONTRACT!,
      this.signer || this.provider
    )
    
    this.readerActivity = ReaderActivity__factory.connect(
      process.env.NEXT_PUBLIC_READER_ACTIVITY_CONTRACT!,
      this.signer || this.provider
    )
    
    this.tippingSystem = TippingSystem__factory.connect(
      process.env.NEXT_PUBLIC_TIPPING_SYSTEM_CONTRACT!,
      this.signer || this.provider
    )
    
    this.treasuryManager = TreasuryManager__factory.connect(
      process.env.NEXT_PUBLIC_TREASURY_MANAGER_CONTRACT!,
      this.signer || this.provider
    )
  }

  // 获取故事列表
  async getStories() {
    return await this.storyManager.getActiveStories()
  }

  // 获取故事详情
  async getStory(storyId: number) {
    return await this.storyManager.getStory(storyId)
  }
}