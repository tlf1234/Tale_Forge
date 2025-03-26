'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from './page.module.css'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Chapter {
  id: string
  title: string
  wordCount: number
  order: number
  updatedAt: string
  status: string  // 改为string类型，因为后端可能返回不同大小写
}

interface Props {
  params: {
    id: string
  }
}

// 章节列表页面
export default function ChaptersPage({ params }: Props) {
  const { id } = params
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadChapters() {
      try {
        const response = await fetch(`/api/stories/${id}/chapters`)
        if (!response.ok) {
          throw new Error('加载章节失败')
        }
        const data = await response.json()
        // 先将状态值转换为小写，再过滤已发布的章节
        const publishedChapters = data.filter((chapter: Chapter) => 
          chapter.status?.toLowerCase() === 'published'
        )
        setChapters(publishedChapters)
      } catch (error) {
        console.error('加载章节失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadChapters()
  }, [id])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="flex space-x-2 mb-2">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
          </div>
          <span className="text-sm text-gray-500">正在加载章节列表...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>章节目录</h1>
          <Link href={`/stories/${id}`} className={styles.backButton}>
            返回作品详情
          </Link>
        </div>

        <div className={styles.chapterList}>
          {chapters.map(chapter => (
            <Link 
              key={chapter.id}
              href={`/stories/${id}/read?order=${chapter.order}`}
              className={styles.chapterItem}
            >
              <div className={styles.chapterInfo}>
                <span className={styles.chapterTitle}>{chapter.title}</span>
                <div className={styles.chapterMeta}>
                  <span>{chapter.wordCount} 字</span>
                  <span>
                    {formatDistanceToNow(new Date(chapter.updatedAt), {
                      addSuffix: true,
                      locale: zhCN
                    })}
                  </span>
                </div>
              </div>
              <span className={styles.arrow}>→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}