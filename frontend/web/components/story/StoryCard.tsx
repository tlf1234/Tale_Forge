import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Story } from '@/types/story'
import cardStyles from '@/styles/card.module.css'
import styles from './StoryCard.module.css'

interface StoryCardProps {
  id: string
  title: string
  description: string
  coverImage: string
  author: {
    name: string
    address: string
  }
  category: string
  stats?: {
    likes?: number
    comments?: number
    favorites?: number
  }
  isNFT?: boolean
}

export function StoryCard({ 
  id, 
  title, 
  description, 
  coverImage, 
  author,
  category,
  stats = {},
  isNFT = false
}: StoryCardProps) {
  return (
    <Link 
      href={`/stories/${id}`}
      className="block bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative h-48">
        <Image
          src={coverImage}
          alt={title}
          fill
          className="object-cover"
        />
      </div>
      
      <div className="p-4">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <div className="text-sm text-gray-600 mb-2">
          作者: {author.name}
        </div>
        
        <p className="text-sm text-gray-500 line-clamp-2 mb-4">
          {description}
        </p>

        <div className="flex justify-between items-center text-sm text-gray-500">
          <div className="flex space-x-4">
            <span>{stats.likes || 0} 喜欢</span>
            <span>{stats.comments || 0} 评论</span>
            <span>{stats.favorites || 0} 收藏</span>
          </div>
          {isNFT && (
            <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded-full text-xs">
              NFT
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}