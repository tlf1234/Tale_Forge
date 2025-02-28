import { NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getContract } from '@/lib/contract'
import { ReaderActivity__factory } from '@/contracts/typechain'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const storyId = params.id
    
    // 获取用户的钱包地址（从session或请求中）
    const userAddress = ''; // TODO: 从session获取用户地址
    
    if (!userAddress) {
      return NextResponse.json(
        { error: '请先连接钱包' },
        { status: 401 }
      )
    }

    // 获取合约实例
    const contract = await getContract(ReaderActivity__factory)
    
    // 调用合约的点赞方法
    const tx = await contract.like(storyId)
    await tx.wait()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Like error:', error)
    return NextResponse.json(
      { error: error.message || '点赞失败' },
      { status: 500 }
    )
  }
} 