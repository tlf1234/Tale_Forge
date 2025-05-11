'use client'

import React from 'react'
import { FiBookmark } from 'react-icons/fi'
import { useBookmarkStatus } from '@/hooks/useBookmarkStatus'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useLoginModal } from '@/context/LoginModalContext'

interface BookmarkButtonProps {
  storyId: string
  variant?: 'icon' | 'button' | 'pill'
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
  onRemoved?: () => void
}

const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  storyId,
  variant = 'icon',
  className = '',
  showText = true,
  size = 'md',
  onRemoved
}) => {
  const { isBookmarked, toggleBookmark } = useBookmarkStatus(storyId)
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const { openLoginModal } = useLoginModal()

  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault() // 防止链接导航
    e.stopPropagation() // 防止事件冒泡

    if (!isAuthenticated) {
      toast.error('请先登录')
      openLoginModal() // 使用登录弹窗替代直接跳转
      return
    }

    const success = await toggleBookmark()
    if (success) {
      if (isBookmarked) {
        // 取消收藏成功
        if (onRemoved) {
          // 如果是在书架页面（有onRemoved回调）
          toast.success('已从书架中移除')
          // 延迟一下调用回调，确保提示显示后再更新UI
          setTimeout(() => {
            onRemoved()
          }, 100)
        } else {
          // 普通场景下的取消收藏
          toast.success('已取消收藏')
        }
      } else {
        // 添加收藏成功
        toast.success('收藏成功！')
      }
    } else {
      toast.error('操作失败，请重试')
    }
  }

  // 支持在书架中使用不同的文案
  const bookmarkText = () => {
    // 如果是在onRemoved回调存在的情况下(书架页面)，显示"移除收藏"而不是"已收藏"
    if (isBookmarked) {
      return onRemoved ? '移除收藏' : '已收藏'
    }
    return '收藏'
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleBookmark}
        className={`p-2 transition-colors ${
          isBookmarked 
            ? 'text-blue-600' 
            : 'text-gray-600 hover:text-gray-900'
        } ${className}`}
        title={isBookmarked ? (onRemoved ? '点击移除收藏' : '已收藏，点击取消') : '点击收藏'}
      >
        <FiBookmark className={`${sizes[size]} ${isBookmarked ? 'fill-blue-600' : ''}`} />
      </button>
    )
  }

  if (variant === 'pill') {
    return (
      <button
        onClick={handleBookmark}
        className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
          isBookmarked
            ? 'bg-blue-100 text-blue-600'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        } ${className}`}
        title={isBookmarked ? (onRemoved ? '点击移除收藏' : '已收藏，点击取消') : '点击收藏'}
      >
        <div className="flex items-center gap-1">
          <FiBookmark className={`${sizes.sm} ${isBookmarked ? 'fill-blue-600' : ''}`} />
          {showText && <span className="text-xs">{bookmarkText()}</span>}
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={handleBookmark}
      className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 text-sm ${
        isBookmarked
          ? 'bg-blue-50 text-blue-600 border border-blue-200'
          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
      } ${className}`}
      title={isBookmarked ? (onRemoved ? '点击移除收藏' : '已收藏，点击取消') : '点击收藏'}
    >
      <FiBookmark className={`${sizes[size]} ${isBookmarked ? 'fill-blue-600' : ''}`} />
      {showText && <span>{bookmarkText()}</span>}
    </button>
  )
}

export default BookmarkButton 