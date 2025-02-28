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
}

interface Props {
  params: {
    id: string
  }
}

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
        setChapters(data)
      } catch (error) {
        console.error('加载章节失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadChapters()
  }, [id])

  if (isLoading) {
    return <div className={styles.loading}>加载中...</div>
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
              href={`/stories/${id}/read?chapter=${chapter.id}`}
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