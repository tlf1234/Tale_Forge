'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { IoChevronBack, IoSettingsOutline, IoBookmarkOutline, IoShareSocialOutline, IoStarOutline, IoHeartOutline, IoHeart } from 'react-icons/io5'
import styles from './ReadContent.module.css'  // 使用独立的样式文件
import ImagePreview from '@/components/common/ImagePreview'
import { useChapter } from '@/hooks/useChapter'
import type { Chapter as BaseChapter, ContentBlock } from '@/types/story'
import { useReadingSettings } from '@/hooks/useReadingSettings'
import ReadingSettings from './ReadingSettings'
import TipDialog from './TipDialog'
import { useBookshelf } from '@/hooks/useBookshelf'
import CommentList from '../comment/CommentList'
import { toast } from 'react-hot-toast'
import { getWalletAddress } from '@/lib/contract'
import ChapterTree from './ChapterTree' // Import ChapterTree component
import { FaList } from 'react-icons/fa' // Import FaList icon

interface ReadContentProps {
  id: string
}

interface Chapter extends BaseChapter {
  chapterNumber: number
  totalChapters: number
  author: {
    name: string
    avatar?: string
  }
  coverImage?: string
  status: 'draft' | 'published'
}

interface ChapterResponse {
  chapter: Chapter | null
  loading: boolean
  error: Error | null
  volumes?: any[]
  saveChapter: (data: Partial<Chapter>) => Promise<Chapter | null>
  publish: (authorAddress: string) => Promise<any>
}

const ReadContent: React.FC<ReadContentProps> = ({ id }) => {
  const searchParams = useSearchParams()
  const chapterId = searchParams.get('chapter') || ''
  const order = searchParams.get('order') || ''
  const router = useRouter()
  
  const [isEyeCareMode, setIsEyeCareMode] = useState(false)
  const [imageLoadError, setImageLoadError] = useState<Record<string, boolean>>({})
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showTipDialog, setShowTipDialog] = useState(false)
  const [showChapterTree, setShowChapterTree] = useState(false)
  const { isInBookshelf, addToBookshelf, removeFromBookshelf } = useBookshelf()
  const [isInShelf, setIsInShelf] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [isLiking, setIsLiking] = useState(false)

  const { chapter, loading, error, volumes } = useChapter(id, order || chapterId || '1') as ChapterResponse
  const { settings, updateSetting, resetSettings } = useReadingSettings()

  useEffect(() => {
    if (chapter && !loading) {
      // 新章节时滚动到顶部
      window.scrollTo({
        top: 0,
        behavior: 'instant'
      })
    }
  }, [chapter, loading])

  useEffect(() => {
    setIsInShelf(isInBookshelf(id))
  }, [id, isInBookshelf])

  // 初始化点赞状态
  useEffect(() => {
    const fetchLikeStatus = async () => {
      try {
        const response = await fetch(`/api/stories/${id}/like/status`)
        if (response.ok) {
          const data = await response.json()
          setIsLiked(data.isLiked)
          setLikeCount(data.likeCount)
        }
      } catch (error) {
        console.error('Failed to fetch like status:', error)
      }
    }

    if (id) {
      fetchLikeStatus()
    }
  }, [id])

  // 处理章节切换
  const handleChapterChange = useCallback((direction: 'prev' | 'next') => {
    console.log('章节切换:', { direction, chapter });
    
    if (!chapter) {
      console.log('没有当前章节信息');
      return;
    }
    
    const nextOrder = direction === 'prev' 
      ? chapter.order - 1 
      : chapter.order + 1;

    console.log('目标章节顺序:', nextOrder);

    if (nextOrder < 1 || nextOrder > chapter.totalChapters) {
      console.log('章节顺序超出范围');
      return;
    }
    
    // 切换章节前先滚动到顶部
    window.scrollTo({
      top: 0,
      behavior: 'instant'
    })
    
    // 使用order构建URL
    const newUrl = `/stories/${id}/read?order=${nextOrder}`;
    console.log('导航到新URL:', newUrl);
    router.push(newUrl);
  }, [chapter, id, router])

  const handleTip = async (amount: number) => {
    try {
      // TODO: Implement actual tipping logic here
      console.log('Tipping amount:', amount)
      // Call smart contract method
    } catch (error) {
      console.error('Failed to tip:', error)
    }
  }

  const handleBookshelf = () => {
    if (isInShelf) {
      removeFromBookshelf(id)
      setIsInShelf(false)
    } else if (chapter) {
      addToBookshelf({
        id,
        title: chapter.title,
        author: chapter.author.name,
        coverImage: chapter.coverImage || '/images/story-default-cover.jpg',
        readProgress: 0
      })
      setIsInShelf(true)
    }
  }

  // 处理点赞
  const handleLike = async () => {
    if (isLiking) return

    try {
      setIsLiking(true)

      // 检查钱包连接
      const address = await getWalletAddress().catch(() => null)
      if (!address) {
        toast.error('请先连接钱包')
        return
      }

      const response = await fetch(`/api/stories/${id}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      setIsLiked(prev => !prev)
      setLikeCount(prev => isLiked ? prev - 1 : prev + 1)
      toast.success(isLiked ? '已取消点赞' : '点赞成功')
    } catch (error) {
      console.error('Failed to like story:', error)
      toast.error(error instanceof Error ? error.message : '点赞失败，请重试')
    } finally {
      setIsLiking(false)
    }
  }

  // 加载状态
  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>加载中...</p>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className={styles.error}>
        <p>加载失败: {error.message}</p>
        <button onClick={() => window.location.reload()} className={styles.retryButton}>
          重试
        </button>
      </div>
    )
  }

  // 空值检查
  if (!chapter) {
    return <div>加载中...</div>
  }

  // 解构chapter对象
  const { title, content, wordCount } = chapter
  const currentTime = new Date()

  // 处理内容渲染
  const renderContent = () => {
    if (Array.isArray(content)) {
      return content.map((block, index) => (
        <div key={index} className={styles.contentBlock}>
          {block.type === 'text' ? (
            <p className={styles.text}>{block.content}</p>
          ) : block.type === 'image' && !imageLoadError[block.content] ? (
            <figure className={styles.figure}>
              <div className={styles.imageWrapper}>
                <Image
                  src={block.content}
                  alt={block.caption || '插图'}
                  width={800}
                  height={400}
                  className={styles.image}
                  onError={() => setImageLoadError(prev => ({
                    ...prev,
                    [block.content]: true
                  }))}
                />
              </div>
              {block.caption && (
                <figcaption className={styles.caption}>{block.caption}</figcaption>
              )}
            </figure>
          ) : null}
        </div>
      ))
    } else {
      // 如果content是字符串，处理HTML内容
      const cleanContent = content
        .replace(/spellcheck="[^"]*"/g, '') // 移除spellcheck属性
        .replace(/class="editor-paragraph"/g, 'class="' + styles.paragraph + '"') // 替换class
        .replace(/style="([^"]*)"/g, (match, style) => {
          // 保留text-align和margin-left样式
          const alignMatch = style.match(/text-align:\s*([^;]+)/)
          const marginMatch = style.match(/margin-left:\s*([^;]+)/)
          const keepStyles = []
          
          if (alignMatch) keepStyles.push(`text-align: ${alignMatch[1]}`)
          if (marginMatch) keepStyles.push(`margin-left: ${marginMatch[1]}`)
          
          return keepStyles.length ? `style="${keepStyles.join('; ')}"` : ''
        })
        .replace(/&nbsp;/g, ' ') // 将&nbsp;替换为普通空格

      // 创建一个临时div来解析HTML
      const div = document.createElement('div')
      div.innerHTML = cleanContent

      // 返回处理后的HTML内容
      return <div dangerouslySetInnerHTML={{ __html: div.innerHTML }} />
    }
  }

  // 添加章节树组件
  const renderChapterTree = () => {
    if (!showChapterTree) return null

    return (
      <div className={styles.chapterTreeOverlay} onClick={() => setShowChapterTree(false)}>
        <div className={styles.chapterTreeWrapper} onClick={e => e.stopPropagation()}>
          <ChapterTree
            storyId={id}
            volumes={volumes || []}
            currentChapterId={chapterId}
            onClose={() => setShowChapterTree(false)}
          />
        </div>
      </div>
    )
  }

  // 在工具栏中添加目录按钮
  const renderToolbar = () => (
    <div className={styles.toolbar}>
      <button
        className={styles.toolbarButton}
        onClick={() => setShowChapterTree(true)}
        title="目录"
      >
        <FaList />
      </button>
      <button
        className={styles.toolbarButton}
        onClick={() => setShowSettings(true)}
        title="设置"
      >
        <IoSettingsOutline />
      </button>
      <button
        className={styles.toolbarButton}
        onClick={handleBookshelf}
        title={isInShelf ? "已在书架" : "加入书架"}
      >
        <IoBookmarkOutline />
      </button>
      <button
        className={styles.toolbarButton}
        onClick={() => setShowTipDialog(true)}
        title="打赏"
      >
        <IoStarOutline />
      </button>
      <button
        className={styles.toolbarButton}
        onClick={() => {
          // TODO: 实现分享功能
          console.log('Share')
        }}
        title="分享"
      >
        <IoShareSocialOutline />
      </button>
    </div>
  )

  return (
    <div 
      className={`${styles.reader} 
        ${isEyeCareMode ? styles['theme-eyeCare'] : ''} 
        ${styles[`theme-${settings.theme || 'default'}`]} 
        ${styles[`fontSize-${settings.fontSize <= 14 ? 'small' : 
                           settings.fontSize <= 16 ? 'normal' : 
                           settings.fontSize <= 18 ? 'large' : 'xlarge'}`]} 
        ${styles[`lineHeight-${settings.lineHeight <= 1.5 ? 'compact' : 
                              settings.lineHeight <= 1.8 ? 'normal' : 'loose'}`]}`
      }
      style={{
        fontFamily: settings.fontFamily,
        letterSpacing: `${settings.letterSpacing}px`
      }}
    >
      {/* 阅读界面顶部导航 */}
      <div className={styles.readerHeader}>
        <div className={styles.leftNav}>
          <button className={styles.actionButton} onClick={() => router.back()}>
            <IoChevronBack />
            返回
          </button>
          <button className={styles.actionButton} onClick={() => router.push(`/stories/${id}/chapters`)}>
            目录
          </button>
        </div>
        <div className={styles.rightNav}>
          <button className={styles.actionButton} onClick={() => setIsEyeCareMode(!isEyeCareMode)}>
            {isEyeCareMode ? '护眼' : '正常'}
          </button>
          {renderToolbar()}
        </div>
      </div>

      {/* 内容区域 */}
      <div className={styles.content}>
        <div className={styles.chapterHeader}>
          <h1 className={styles.chapterTitle}>
            {chapter.chapterNumber ? `第${chapter.chapterNumber}章：` : ''}{title}
            <span className={styles.wordCount}>{wordCount}字</span>
          </h1>
          <div className={styles.chapterInfo}>
            <span>{chapter.author?.name || '佚名'}</span>
            <span>·</span>
            <span>{currentTime.toLocaleString()}</span>
          </div>
        </div>
        {renderContent()}

        {/* 文章末尾的互动区域 */}
        <div className={styles.contentFooter}>
          <div className={styles.interactionButtons}>
            <button 
              className={`${styles.interactionButton} ${isLiked ? styles.liked : ''} ${isLiking ? styles.disabled : ''}`}
              onClick={handleLike}
              disabled={isLiking}
            >
              {isLiked ? <IoHeart /> : <IoHeartOutline />}
              <span>{isLiking ? '处理中...' : `喜欢 ${likeCount > 0 ? `(${likeCount})` : ''}`}</span>
            </button>
            <button 
              className={styles.interactionButton}
              onClick={() => setShowTipDialog(true)}
            >
              <IoStarOutline />
              <span>打赏作者</span>
            </button>
          </div>
        </div>
      </div>

      {/* 底部导航 */}
      <div className={styles.footer}>
        <button
          className={styles.navButton}
          onClick={() => handleChapterChange('prev')}
          disabled={chapter.chapterNumber <= 1}
        >
          上一章
        </button>
        <span className={styles.chapterStatus}>
          {chapter.chapterNumber} / {chapter.totalChapters}
        </span>
        <button
          className={styles.navButton}
          onClick={() => handleChapterChange('next')}
          disabled={chapter.chapterNumber >= chapter.totalChapters}
        >
          下一章
        </button>
      </div>

      {/* 评论区 */}
      <div className={styles.commentSection}>
        <CommentList storyId={id} chapterId={chapterId} />
      </div>

      {/* 图片预览 */}
      {previewImage && (
        <ImagePreview
          src={previewImage.src}
          alt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {/* 阅读设置 */}
      {showSettings && (
        <div className={styles.settingsOverlay}>
          <ReadingSettings
            settings={settings}
            onUpdateSetting={updateSetting}
            onReset={resetSettings}
            onClose={() => setShowSettings(false)}
          />
        </div>
      )}

      {showTipDialog && (
        <TipDialog
          authorName={chapter?.author?.name || ''}
          authorAvatar="/default-avatar.png" // TODO: Replace with actual author avatar
          onTip={handleTip}
          onClose={() => setShowTipDialog(false)}
        />
      )}

      {renderChapterTree()}
    </div>
  )
} 

export default ReadContent 