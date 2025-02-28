import { ABIS } from '@tale-forge/shared'

/**用途：存储合约地址和 ABI 的常量配置
  内容：包含各个合约的地址和 ABI 配置对象 */

export const CONTRACT_ABIS = {
  AuthorManager: ABIS.AuthorManager,
  StoryManager: ABIS.StoryManager,
  TaforToken: ABIS.TaforToken,
  TreasuryManager: ABIS.TreasuryManager,
  NovelNFT: ABIS.NovelNFT,
  ReaderActivityAddress: ABIS.ReaderActivityAddress,
  TippingSystemAddress: ABIS.TippingSystemAddress
}

export const CONTRACT_ADDRESSES = {
  AuthorManager: process.env.NEXT_PUBLIC_AUTHOR_MANAGER_CONTRACT || '',
  StoryManager: process.env.NEXT_PUBLIC_STORY_MANAGER_CONTRACT || '',
  TaforToken: process.env.NEXT_PUBLIC_TAFOR_TOKEN_CONTRACT || '',
  TreasuryManager: process.env.NEXT_PUBLIC_TREASURY_MANAGER_CONTRACT || '',
  NovelNFT: process.env.NEXT_PUBLIC_NOVEL_NFT_CONTRACT || '',
  ReaderActivityAddress: process.env.NEXT_PUBLIC_READER_ACTIVITY_ADDRESS_CONTRACT || '',
  TippingSystemAddress: process.env.NEXT_PUBLIC_TIPPING_SYSTEM_ADDRESS_CONTRACT || ''
} 


