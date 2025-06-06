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
  TippingSystemAddress: ABIS.TippingSystemAddress,
  MiningPool: ABIS.MiningPool
}

// 作者代币和代币工厂的通用ABI
export const TOKEN_ABIS = {
  TokenFactory: [
    "function checkEligibility(address author) view returns (bool)",
    "function minWordCount() view returns (uint256)",
    "function minLikeCount() view returns (uint256)",
    "function minFollowerCount() view returns (uint256)",
    "function createAuthorToken(string memory name, string memory symbol, address author, uint256 commitedRevenue) returns (address)"
  ],
  AuthorToken: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function author() view returns (address)",
    "function commitedRevenue() view returns (uint256)",
    "function checkUserPrivilege(address user, string memory privilegeType) view returns (bool)",
    "function toggleFeature(string memory featureType, bool enabled)"
  ]
}

// 合约地址配置
const CONTRACTS = {
  mainnet: {
    AuthorManager: process.env.NEXT_PUBLIC_MAINNET_AUTHOR_MANAGER_CONTRACT || '',
    StoryManager: process.env.NEXT_PUBLIC_MAINNET_STORY_MANAGER_CONTRACT || '',
    TaforToken: process.env.NEXT_PUBLIC_MAINNET_TAFOR_TOKEN_CONTRACT || '',
    TreasuryManager: process.env.NEXT_PUBLIC_MAINNET_TREASURY_MANAGER_CONTRACT || '',
    NovelNFT: process.env.NEXT_PUBLIC_MAINNET_NOVEL_NFT_CONTRACT || '',
    ReaderActivityAddress: process.env.NEXT_PUBLIC_MAINNET_READER_ACTIVITY_ADDRESS_CONTRACT || '',
    TippingSystemAddress: process.env.NEXT_PUBLIC_MAINNET_TIPPING_SYSTEM_ADDRESS_CONTRACT || '',
    MiningPool: process.env.NEXT_PUBLIC_MAINNET_MINING_POOL_CONTRACT || '',
    TokenFactory: process.env.NEXT_PUBLIC_MAINNET_TOKEN_FACTORY_CONTRACT || ''
  },
  testnet: {
    AuthorManager: process.env.NEXT_PUBLIC_TESTNET_AUTHOR_MANAGER_CONTRACT || '',
    StoryManager: process.env.NEXT_PUBLIC_TESTNET_STORY_MANAGER_CONTRACT || '',
    TaforToken: process.env.NEXT_PUBLIC_TESTNET_TAFOR_TOKEN_CONTRACT || '',
    TreasuryManager: process.env.NEXT_PUBLIC_TESTNET_TREASURY_MANAGER_CONTRACT || '',
    NovelNFT: process.env.NEXT_PUBLIC_TESTNET_NOVEL_NFT_CONTRACT || '',
    ReaderActivityAddress: process.env.NEXT_PUBLIC_TESTNET_READER_ACTIVITY_ADDRESS_CONTRACT || '',
    TippingSystemAddress: process.env.NEXT_PUBLIC_TESTNET_TIPPING_SYSTEM_ADDRESS_CONTRACT || '',
    MiningPool: process.env.NEXT_PUBLIC_TESTNET_MINING_POOL_CONTRACT || '',
    TokenFactory: process.env.NEXT_PUBLIC_TESTNET_TOKEN_FACTORY_CONTRACT || ''
  }
};

// 通过环境变量控制使用主网还是测试网
const isMainnet = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';

// 导出当前网络的合约地址
export const CONTRACT_ADDRESSES = isMainnet ? CONTRACTS.mainnet : CONTRACTS.testnet;

// 导出当前网络信息
export const NETWORK_CONFIG = {
  chainId: isMainnet ? 1 : 11155111, // 1 for mainnet, 11155111 for Sepolia testnet
  name: isMainnet ? 'Ethereum Mainnet' : 'Sepolia Testnet'
};


