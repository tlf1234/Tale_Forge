import { useAccount } from 'wagmi'
import { useContractRead } from 'wagmi'
import { CONTRACT_ABIS, CONTRACT_ADDRESSES } from '@/constants/abi'

export function useAuthorStatus() {
  const { address } = useAccount()

  const { data: authorData, isLoading } = useContractRead({
    address: CONTRACT_ADDRESSES.AuthorManager as `0x${string}`,
    abi: CONTRACT_ABIS.AuthorManager,
    functionName: 'getAuthor',
    args: [address],
    enabled: !!address,
  })

  // 智能合约返回的是一个数组，按合约返回结构提取对应元素
  const authorInfo = authorData as any[];
  
  return {
    isAuthor: authorInfo?.[0] || false,
    authorName: authorInfo?.[1] || '',
    isLoading
  }
} 