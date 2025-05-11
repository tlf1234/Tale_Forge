'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { IoChevronBack, IoSettingsOutline, IoShareSocialOutline, IoStarOutline, IoHeartOutline, IoHeart, IoChatbubbleOutline, IoListOutline } from 'react-icons/io5'
import styles from './page.module.css'
import ImagePreview from '@/components/common/ImagePreview'
import { useReadingSettings } from '@/context/ReadingSettingsContext'
import ReadingSettings from '@/components/story/ReadingSettings'
import TipDialog from '@/components/story/TipDialog'
import { toast } from 'react-hot-toast'
import { getWalletAddress } from '@/lib/contract'
import { FiBook, FiArrowLeft, FiArrowRight } from 'react-icons/fi'
import Link from 'next/link'
import CommentPreview from '@/components/comment/CommentPreview'
import CommentList from '@/components/comment/CommentList'
import CommentSidebar from '@/components/comment/CommentSidebar'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import BookmarkButton from '@/components/common/BookmarkButton'
import { useReadingHistory } from '@/hooks/useReadingHistory'

interface Props {
  params: {
    id: string
  }
  searchParams: {
    order?: string
  }
}

interface Chapter {
  id: string
  title: string
  content: string
  order: number
  totalChapters: number
  author: {
    name: string
    avatar?: string
  }
  coverImage?: string
  status: 'draft' | 'published'
  wordCount: number
}

export default function ReadPage({ params, searchParams }: Props) {
  const { id } = params
  const { order = '1' } = searchParams
  const router = useRouter()
  
  console.log('【ReadPage】初始化参数:', { id, order, searchParams })
  
  // 状态管理
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEyeCareMode, setIsEyeCareMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTipDialog, setShowTipDialog] = useState(false)
  const [jumpValue, setJumpValue] = useState('')
  const [jumpError, setJumpError] = useState<string | null>(null)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [isLiking, setIsLiking] = useState(false)
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null)
  const [imageLoadError, setImageLoadError] = useState<Record<string, boolean>>({})
  const [showComments, setShowComments] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isMobile = useMediaQuery('(max-width: 768px)')
  const jumpInputRef = useRef<HTMLInputElement>(null)
  
  // Hooks
  const { settings, updateSetting, resetSettings } = useReadingSettings()
  const { recordChapterRead } = useReadingHistory()

  // 加载章节数据
  useEffect(() => {
    async function loadChapter() {
      console.log('【ReadPage】开始加载章节:', { id, order })
      try {
        console.log('【ReadPage】请求章节API:', `/api/stories/${id}/chapters/order/${order}`)
        //获得的数据并不是分布式数据，而是数据库数据
        const response = await fetch(`/api/stories/${id}/chapters/order/${order}`)
    
        console.log('【ReadPage】API响应:', response)

        
        if (!response.ok) {
          console.error('【ReadPage】API响应错误:', response.status, response.statusText)
          throw new Error('加载章节失败')
        }
        
        const data = await response.json()
        console.log('【ReadPage】获取到章节内容数据:', data.content)
        
        setChapter(data)
        
        // 新章节时滚动到顶部
        window.scrollTo({
          top: 0,
          behavior: 'instant'
        })
        
        // 不实时记录阅读进度，采用定时和离开页面时记录的策略
      } catch (error) {
        console.error('【ReadPage】加载章节失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadChapter()
  }, [id, order])
  
  // 定时记录阅读历史（每60秒记录一次）
  useEffect(() => {
    // 只在章节加载完成后才开始定时记录
    if (!chapter) return;
    
    console.log('【ReadPage】设置定时记录阅读历史:', {
      storyId: id,
      chapterOrder: chapter.order
    });
    
    // 设置定时器，每60秒记录一次阅读历史
    const timer = setInterval(() => {
      console.log('【ReadPage】定时记录阅读历史:', {
        storyId: id,
        chapterOrder: chapter.order
      });
      
      try {
        if (typeof recordChapterRead === 'function') {
          // 传递额外的故事信息，供本地存储使用
          recordChapterRead(id, chapter.order, {
            title: chapter.title,
            author: chapter.author?.name,
            coverCid: chapter.coverImage
          });
        }
      } catch (err) {
        console.error('【ReadPage】定时记录阅读历史异常:', err);
      }
    }, 60000); // 60秒
    
    // 清理定时器
    return () => {
      clearInterval(timer);
    };
  }, [id, chapter, recordChapterRead]);

  // 离开页面时记录阅读历史（保持不变，确保最后记录一次）
  useEffect(() => {
    // 只在章节加载完成后才设置清理函数
    if (!chapter) return;
    
    // 在组件卸载时记录阅读历史
    return () => {
      console.log('【ReadPage】页面卸载，记录阅读历史:', {
        storyId: id,
        chapterOrder: chapter.order
      });
      
      // 使用setTimeout确保不阻塞UI
      setTimeout(() => {
        try {
          if (typeof recordChapterRead === 'function') {
            // 传递额外的故事信息，供本地存储使用
            recordChapterRead(id, chapter.order, {
              title: chapter.title,
              author: chapter.author?.name,
              coverCid: chapter.coverImage
            });
          }
        } catch (err) {
          console.error('【ReadPage】记录阅读历史异常:', err);
        }
      }, 0);
    };
  }, [id, chapter, recordChapterRead]);

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

 // 添加图片点击处理函数
 const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  const target = e.target as HTMLElement;
  
  // 检查是否点击了图片并且是否有data-preview属性
  if (target.tagName === 'IMG' && target.getAttribute('data-preview') === 'true') {
    const img = target as HTMLImageElement;
    setPreviewImage({
      src: img.src,
      alt: img.alt || '图片预览'
    });
  }
}, []);

  // 处理章节切换
  const handleChapterChange = (direction: 'prev' | 'next') => {
    if (!chapter) {
      console.log('【ReadPage】章节切换失败: chapter 为空')
      return
    }

    const nextOrder = direction === 'prev' ? chapter.order - 1 : chapter.order + 1
    console.log('【ReadPage】章节切换:', {
      direction,
      currentOrder: chapter.order,
      nextOrder,
      totalChapters: chapter.totalChapters
    })

    if (nextOrder < 1 || nextOrder > chapter.totalChapters) {
      console.log('【ReadPage】章节切换超出范围')
      return
    }

    // 页面卸载时会自动记录当前章节阅读历史
    
    window.scrollTo({
      top: 0,
      behavior: 'instant'
    })
    
    const nextUrl = `/stories/${id}/read?order=${nextOrder}`
    console.log('【ReadPage】跳转到下一章:', nextUrl)
    router.push(nextUrl)
  }

  // 章节跳转处理
  const handleJump = () => {
    if (!chapter) return
    
    const chapterOrder = parseInt(jumpValue)
    if (isNaN(chapterOrder) || chapterOrder < 1 || chapterOrder > chapter.totalChapters) {
      setJumpError(`请输入1-${chapter.totalChapters}之间的数字`)
      setTimeout(() => {
        setJumpError(null)
      }, 3000)
      return
    }

    if (chapterOrder === chapter.order) return

    // 页面卸载时会自动记录当前章节阅读历史
    
    window.scrollTo({
      top: 0,
      behavior: 'instant'
    })
    
    router.push(`/stories/${id}/read?order=${chapterOrder}`)
    setJumpValue('')
  }

  // 处理输入变化
  const handleJumpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setJumpValue(e.target.value)
    setJumpError(null)
  }

  // 处理打赏
  const handleTip = async (amount: number) => {
    try {
      // TODO: Implement actual tipping logic here
      console.log('Tipping amount:', amount)
      // Call smart contract method
    } catch (error) {
      console.error('Failed to tip:', error)
    }
  }

  // 处理点赞
  const handleLike = async () => {
    if (isLiking) return

    try {
      setIsLiking(true)

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

  // 处理显示评论
  const handleShowComments = () => {
    // 在移动端，通过状态控制评论展开收起
    if (isMobile) {
      setShowComments(!showComments)
      // 滚动到评论区
      setTimeout(() => {
        const commentSection = document.getElementById('comments-section')
        if (commentSection) {
          commentSection.scrollIntoView({ behavior: 'smooth' })
        }
      }, 100)
    } else {
      // 桌面端直接展示评论（已废弃侧边栏方式）
      setShowComments(true)
    }
  }

  // 渲染工具栏
  const renderToolbar = () => (
    <div className={styles.toolbar}>
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
      <div className={styles.toolbarButton} style={{ padding: 0 }}>
        <BookmarkButton 
          storyId={id}
          variant="icon"
          showText={false}
          size="md"
          className="flex items-center justify-center w-full h-full"
        />
      </div>
      <button
        className={styles.toolbarButton}
        onClick={() => setShowSettings(true)}
        title="设置"
      >
        <IoSettingsOutline />
      </button>
    </div>
  )

  // 添加内容格式化函数
  const formatChapterContent = (content: string, fontSize: number): string => {
    if (!content) return '';
    
    // 1. 修复段落缩进处理
    let formatted = content
      // 确保所有段落都有正确的缩进和字体大小
      .replace(/<p(?![^>]*?style=['"][^'"]*text-indent)[^>]*>(?!<\/?(?:br|img|hr)[^>]*>)/gi, 
        `<p style="text-indent: 2em; font-size: ${fontSize}px !important;">`);

    // 2. 处理特殊段落：对话、章节标题等不需要缩进
    formatted = formatted
      // 对话段落（以引号开始的段落）去除缩进
      .replace(/<p style="text-indent: 2em; font-size: [^"]*px !important;">(["'""''])/gi, 
        `<p style="text-indent: 0; font-size: ${fontSize}px !important;">$1`)
      // 章节标题（以"第"字开头的段落）居中且不缩进
      .replace(/<p style="text-indent: 2em; font-size: [^"]*px !important;">(第[\s\S]*?[章节回][\s\S]*?)(<\/p>)/gi, 
        `<p style="text-align: center; text-indent: 0; font-weight: bold; margin: 1em 0; font-size: ${Math.round(fontSize * 1.2)}px !important;">$1$2`)
      // 场景转换行（只有3-5个字符的短行，如"次日"）居中不缩进
      .replace(/<p style="text-indent: 2em; font-size: [^"]*px !important;">(.{1,5})<\/p>/gi, (match, p1) => {
        if (/^[\s\S]{1,5}$/.test(p1) && !/[，。；：？！,.;:?!]/.test(p1)) {
          return `<p style="text-align: center; text-indent: 0; font-size: ${fontSize}px !important;">${p1}</p>`;
        }
        return match;
      });

    // 3. 确保空行被正确处理
    formatted = formatted
      .replace(/<p>\s*<\/p>/gi, `<p class="empty-line" style="height: 1em; margin: 0.5em 0; font-size: ${fontSize}px !important;"></p>`);

    // 4. 修复可能的多重样式问题
    formatted = formatted
      .replace(/style="([^"]*)text-indent:[^;]*;([^"]*)text-indent:[^;]*;/gi, 'style="$1$2text-indent:');

    // 5. 为图片添加可点击预览的类和属性
    formatted = formatted
      .replace(/<img([^>]*)src="([^"]*)"([^>]*)>/gi, '<img$1src="$2"$3 class="clickable-image" data-preview="true">');

    // 6. 确保所有span元素也应用字体大小
    formatted = formatted
      .replace(/<span([^>]*)>/gi, `<span$1 style="font-size: ${fontSize}px !important;">`);

    return formatted;
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="flex space-x-2 mb-2">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
          </div>
          <span className="text-sm text-gray-500">正在加载章节内容...</span>
        </div>
      </div>
    )
  }

  if (!chapter) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center max-w-lg mx-auto px-4">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiBook className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">暂无章节内容</h2>
          <p className="text-gray-600 mb-6">该作品还未发布任何章节，请稍后再来查看</p>
          <div className="flex gap-4 justify-center">
            <Link 
              href={`/stories/${id}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <FiArrowLeft className="w-4 h-4" />
              返回作品详情
            </Link>
            <Link 
              href="/stories"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
            >
              <FiBook className="w-4 h-4" />
              浏览其他作品
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`${styles.reader} 
        ${isEyeCareMode ? styles['theme-eyeCare'] : ''} 
        ${styles[`theme-${settings.theme || 'default'}`]} 
        ${styles[`lineHeight-${settings.lineHeight <= 1.5 ? 'compact' : 
                              settings.lineHeight <= 1.8 ? 'normal' : 'loose'}`]}`
      }
      style={{
        fontFamily: settings.fontFamily,
        letterSpacing: `${settings.letterSpacing}px`,
        fontSize: `${settings.fontSize}px`,
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
        <div className={styles.chapterHeader} style={{ '--header-font-size': `${settings.fontSize}px` } as React.CSSProperties}>
          <h1 className={styles.chapterTitle} style={{ fontSize: `${Math.round(settings.fontSize * 1.5)}px` }}>
            {chapter.title}
            {chapter.wordCount > 0 && (
              <span className={styles.wordCount}>
                {chapter.wordCount}字
              </span>
            )}
          </h1>
          <div className={styles.chapterInfo} style={{ fontSize: `${Math.round(settings.fontSize * 0.8)}px` }}>
            <span>{chapter.author?.name || '佚名'}</span>
          </div>
        </div>
        
        <div 
          className={styles.contentWrapper} 
          style={{
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            letterSpacing: `${settings.letterSpacing}px`,
            fontFamily: settings.fontFamily,
            color: settings.theme === 'dark' ? '#e0e0e0' : 
                   settings.theme === 'sepia' ? '#5d4037' : 
                   settings.theme === 'eyeCare' ? '#333333' : '#333333',
          }}
          onClick={handleContentClick}
          dangerouslySetInnerHTML={{ __html: formatChapterContent(chapter.content, settings.fontSize) }}
        />

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
            <div className={styles.interactionButton} style={{ padding: 0 }}>
              <BookmarkButton 
                storyId={id}
                variant="button"
                showText={true}
                size="md"
                className="h-full flex items-center px-6"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 底部导航 */}
      <div className={styles.footer}>
        <button
          className={styles.navButton}
          onClick={() => handleChapterChange('prev')}
          disabled={chapter.order <= 1}
        >
          上一章
        </button>
        
        <span className={styles.chapterStatus}>
          {chapter.order} / {chapter.totalChapters}
        </span>
        
        <button
          className={styles.navButton}
          onClick={() => handleChapterChange('next')}
          disabled={chapter.order >= chapter.totalChapters}
        >
          下一章
        </button>

        <div className={styles.jumpInputWrapper}>
          <input
            ref={jumpInputRef}
            type="number"
            min="1"
            max={chapter.totalChapters}
            value={jumpValue}
            onChange={handleJumpInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleJump()}
            className={styles.jumpInput}
            placeholder="跳转..."
          />
          <button 
            onClick={handleJump} 
            className={styles.jumpGoButton}
            disabled={!jumpValue || jumpValue === chapter.order.toString()}
          >
            <FiArrowRight />
          </button>
          {jumpError && <div className={styles.jumpError}>{jumpError}</div>}
        </div>
      </div>

      {/* 评论区 - 直接整合到页面底部 */}
      <div className={styles.commentSection} id="comments-section">
        <CommentList
          storyId={id} 
          chapterId={chapter?.id || ''}
        />
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
          <ReadingSettings onClose={() => setShowSettings(false)} />
        </div>
      )}

      {/* 打赏对话框 */}
      {showTipDialog && (
        <TipDialog
          authorName={chapter?.author?.name || ''}
          authorAvatar="/images/avatars/default-avatar.svg"
          onTip={handleTip}
          onClose={() => setShowTipDialog(false)}
        />
      )}
    </div>
  )
} 