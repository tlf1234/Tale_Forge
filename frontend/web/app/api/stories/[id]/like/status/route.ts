import { NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getContract } from '@/lib/contract'
import { ReaderActivity__factory } from '@/typechain'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const storyId = params.id
    
    // 获取用户的钱包地址（从session或请求中）
    const userAddress = ''; // TODO: 从session获取用户地址
    
    // 获取合约实例
    const contract = await getContract(ReaderActivity__factory, false)
    
    // 获取点赞状态
    const [isLiked, likeCount] = await Promise.all([
      userAddress ? contract.hasLiked(storyId, userAddress) : false,
      contract.getLikeCount(storyId)
    ])

    return NextResponse.json({
      isLiked,
      likeCount: likeCount.toNumber()
    })
  } catch (error: any) {
    console.error('Get like status error:', error)
    return NextResponse.json(
      { error: error.message || '获取点赞状态失败' },
      { status: 500 }
    )
  }
} 