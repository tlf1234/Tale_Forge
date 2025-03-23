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
    name?: string
    address: string
  }
  category: string
  stats?: {
    views?: number
    likes?: number
    comments?: number
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
      className="group block bg-white rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 border border-gray-100"
    >
      <div className="relative h-52">
        <Image
          src={coverImage}
          alt={title}
          fill
          className="object-cover transform group-hover:scale-105 transition-transform duration-500"
        />
        {/* 分类标签 */}
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1 text-xs font-medium bg-white/90 text-gray-700 rounded-full">
            {category}
          </span>
        </div>
        {/* NFT标签 */}
        {isNFT && (
          <div className="absolute top-3 right-3">
            <span className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded-full shadow-sm">
              NFT
            </span>
          </div>
        )}
      </div>
      
      <div className="p-4">
        {/* 标题和作者信息 */}
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
            {title}
          </h3>
          <div className="flex flex-col gap-1">
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">{author.name || '未知作者'}</span>
            </div>
            <div className="flex items-center text-xs text-gray-400">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="font-mono">
                {author.address.slice(0, 6)}...{author.address.slice(-4)}
              </span>
            </div>
          </div>
        </div>
        
        {/* 描述 */}
        <p className="text-sm text-gray-600 line-clamp-2 mb-4 min-h-[40px]">
          {description}
        </p>

        {/* 统计信息 */}
        <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-3">
          <div className="flex space-x-4">
            <span className="inline-flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {stats.views || 0}
            </span>
            <span className="inline-flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {stats.likes || 0}
            </span>
            <span className="inline-flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {stats.comments || 0}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}