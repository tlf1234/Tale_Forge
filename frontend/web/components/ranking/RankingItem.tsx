import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface RankingItemProps {
  rank: number
  title: string
  author: string
  reads: number
  id: number
  isNFT?: boolean
  tokenId?: string
  floorPrice?: number
  totalEarnings?: number
  miningRewards?: number
  coverImage?: string
}

export function RankingItem({ 
  rank, 
  title, 
  author, 
  reads, 
  id,
  isNFT = false,
  tokenId,
  floorPrice,
  totalEarnings = 0,
  miningRewards = 0,
  coverImage = `https://source.unsplash.com/800x600/?fantasy,book&${id}`
}: RankingItemProps) {
  return (
    <Link 
      href={`/stories/${id}`}
      className="block bg-white rounded-lg hover:shadow-md transition-all duration-300"
    >
      <div className="flex gap-5 p-5">
        {/* 排名 */}
        <div className="text-base text-gray-400 font-medium w-4">
          {rank}
        </div>

        {/* 封面图 */}
        <div className="relative w-24 h-32 flex-shrink-0">
          <Image
            src={coverImage}
            alt={title}
            fill
            className="object-cover rounded-lg"
            sizes="96px"
            priority={rank <= 3}
          />
          {isNFT && (
            <div className="absolute -top-1.5 -right-1.5 bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded">
              NFT
            </div>
          )}
        </div>

        {/* 内容区域 */}
        <div className="flex-1 min-w-0">
          <div className="mb-4">
            <h3 className="text-base text-gray-900 font-medium mb-2 line-clamp-1">{title}</h3>
            <p className="text-sm text-gray-500">作者：{author}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">阅读量</span>
              <span className="text-gray-900">{reads.toLocaleString()}</span>
            </div>
            
            {isNFT && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Token ID</span>
                  <span className="text-gray-900">#{tokenId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">地板价</span>
                  <span className="text-gray-900">{floorPrice} ETH</span>
                </div>
              </>
            )}
            
            <div className="flex justify-between">
              <span className="text-gray-500">总收益</span>
              <span className="text-gray-900">{totalEarnings} ETH</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-500">挖矿收益</span>
              <span className="text-gray-900">{miningRewards} ETH</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}