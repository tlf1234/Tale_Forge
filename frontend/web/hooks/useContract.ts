// 需要安装 wagmi 依赖
// pnpm add wagmi viem @wagmi/core

// 修改导入，因为 StoryManager__factory 还未生成
import { useContractRead, useWalletClient, usePublicClient } from 'wagmi'  // 更新导入
import { CONTRACT_ABI } from '../constants/abi'  // 我们需要创建这个文件存放 ABI

export function useStoryManager() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  
  return useContractRead({
    address: process.env.NEXT_PUBLIC_STORY_MANAGER_CONTRACT as `0x${string}`,  // 添加类型断言
    abi: CONTRACT_ABI.StoryManager,  // 使用导入的 ABI
  })
} 