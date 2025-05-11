'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from './page.module.css'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useSearchParams, useRouter } from 'next/navigation'

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
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalChapters, setTotalChapters] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 21
  
  // 从URL获取当前页码
  useEffect(() => {
    const page = searchParams.get('page')
    console.log('[调试] searchParams变化，当前page参数:', page)
    
    if (page) {
      const pageNum = parseInt(page, 10)
      console.log('[调试] 从URL设置页码:', pageNum)
      setCurrentPage(pageNum)
    } else {
      console.log('[调试] URL中无page参数，使用默认页码1')
    }
  }, [searchParams])
  
  // 加载章节统计数据
  useEffect(() => {
    async function getChaptersStats() {
      try {
        console.log('[调试] 请求章节统计API:', `/api/stories/${id}/chapters/stats`)
        const statsResponse = await fetch(`/api/stories/${id}/chapters/stats`)
        console.log('[调试] 章节统计API状态码:', statsResponse.status)
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          console.log('[调试] 章节统计数据:', statsData)
          const publishedCount = statsData.published || 0
          console.log('[调试] 已发布章节数:', publishedCount)
          setTotalChapters(publishedCount)
          
          // 检查当前页面是否超出范围
          const maxPage = Math.ceil(publishedCount / pageSize)
          console.log('[调试] 计算得到的最大页数:', maxPage)
          
          // 如果当前页码超出范围，自动跳转到最后一页
          if (currentPage > maxPage && maxPage > 0) {
            console.log('[调试] 当前页码超出范围，重定向到最后一页:', maxPage)
            router.replace(`/stories/${id}/chapters?page=${maxPage}`)
            return false
          }
          return true
        }
        return false
      } catch (error) {
        console.error('[调试] 获取章节统计数据失败:', error)
        return false
      }
    }
    
    getChaptersStats()
  }, [id, currentPage, pageSize, router])
  
  // 加载章节数据
  useEffect(() => {
    console.log('[调试] 开始加载章节数据, 当前页码:', currentPage, '故事ID:', id)
    
    async function loadChapters() {
      console.log('[调试] 执行loadChapters函数')
      try {
        setIsLoading(true)
        
        // 获取总章节数以计算范围
        const statsResponse = await fetch(`/api/stories/${id}/chapters/stats`)
        if (!statsResponse.ok) {
          throw new Error('获取章节统计失败')
        }
        const stats = await statsResponse.json()
        const totalPublished = stats.published || 0
        
        // 如果没有章节，则直接返回
        if (totalPublished === 0) {
          setIsLoading(false)
          return
        }
        
        // 计算要加载的章节范围
        // 第一页：显示最新的20章，即从最大序号开始倒数20章
        // 第二页：显示第21-40章，依此类推
        const startIdx = (currentPage - 1) * pageSize + 1
        const endIdx = Math.min(currentPage * pageSize, totalPublished)
        
        // 换算成章节order序号 (假设章节按order从1开始递增)
        // 注意：这里使用倒序，所以end是较大的order，start是较小的order
        const end = totalPublished - startIdx + 1 + 1 // +1 因为API是包含性的
        const start = totalPublished - endIdx + 1
        
        if (end <= start) {
          console.log('[调试] 没有符合条件的章节数据，范围无效:', {start, end})
          setIsLoading(false)
          return
        }
        
        console.log('[调试] 计算的范围参数:', {
          totalPublished,
          pageStart: startIdx,
          pageEnd: endIdx,
          rangeStart: start,
          rangeEnd: end,
          currentPage
        })
        
        // 使用range接口获取章节 - 与write页面相同的接口
        const apiUrl = `/api/stories/${id}/chapters/range?start=${end}&end=${start}`
        console.log('[调试] 请求章节范围API:', apiUrl)
        const response = await fetch(apiUrl)
        console.log('[调试] 章节范围API状态码:', response.status)
        
        if (!response.ok) {
          console.error('[调试] 章节范围API返回错误状态码:', response.status)
          throw new Error('加载章节失败')
        }
        
        const data = await response.json()
        console.log('[调试] 章节范围API返回原始数据长度:', data.length)
        
        // 过滤已发布的章节
        const publishedChapters = data.filter((chapter: Chapter) => {
          const isPublished = chapter.status?.toLowerCase() === 'published'
          console.log('[调试] 章节状态:', chapter.id, chapter.title, chapter.status, isPublished ? '已发布' : '未发布')
          return isPublished
        })
        
        console.log('[调试] 过滤后的已发布章节数量:', publishedChapters.length)
        
        // 确保按照章节顺序排序（从大到小/从新到旧）
        const sortedChapters = [...publishedChapters].sort((a: Chapter, b: Chapter) => b.order - a.order)
        
        console.log('[调试] 排序后的章节列表:', sortedChapters.map((c: Chapter) => ({id: c.id, title: c.title, order: c.order})))
        
        console.log('[调试] 即将更新章节状态...')
        setChapters(sortedChapters)
        console.log('[调试] 章节状态已更新')
      } catch (error) {
        console.error('[调试] 加载章节失败:', error)
      } finally {
        console.log('[调试] 加载完成，设置isLoading=false')
        setIsLoading(false)
      }
    }

    if (currentPage > 0) {
      loadChapters()
    }
  }, [id, currentPage])
  
  // 处理页码变更
  const handlePageChange = (newPage: number) => {
    console.log('[调试] 请求切换页码:', newPage)
    if (newPage <= 0 || newPage > Math.ceil(totalChapters / pageSize)) {
      console.log('[调试] 页码超出范围，忽略请求')
      return
    }
    
    console.log('[调试] 页码合法，即将更新URL')
    // 更新URL
    router.push(`/stories/${id}/chapters?page=${newPage}`)
    console.log('[调试] URL已更新为:', `/stories/${id}/chapters?page=${newPage}`)
  }
  
  // 处理页码输入
  const [jumpPageInput, setJumpPageInput] = useState('')
  
  const handleJumpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 只允许输入数字
    const value = e.target.value.replace(/[^\d]/g, '')
    setJumpPageInput(value)
  }
  
  const handleJumpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleJumpToPage()
    }
  }
  
  const handleJumpToPage = () => {
    if (!jumpPageInput) return
    
    const pageNum = parseInt(jumpPageInput, 10)
    if (isNaN(pageNum)) return
    
    // 清空输入
    setJumpPageInput('')
    
    // 跳转到指定页码
    handlePageChange(pageNum)
  }

  // 输出当前渲染状态的调试信息
  console.log('[调试] 当前渲染状态:', {
    isLoading,
    chaptersLength: chapters?.length || 0,
    totalChapters,
    currentPage,
    totalPages: Math.ceil(totalChapters / pageSize)
  })

  if (isLoading) {
    console.log('[调试] 显示加载中状态')
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

  // 计算总页数
  const totalPages = Math.ceil(totalChapters / pageSize)
  
  // 检查并记录是否有章节
  const hasChapters = Array.isArray(chapters) && chapters.length > 0
  console.log('[调试] 最终渲染判断 - 是否有章节:', hasChapters, '章节数量:', chapters?.length || 0)
  
  // 检查当前页码是否超出最大页数范围
  const isInvalidPage = currentPage > totalPages && totalChapters > 0
  console.log('[调试] 检查页码有效性 - 当前页码:', currentPage, '总页数:', totalPages, '是否超出范围:', isInvalidPage)

  return (
    <div className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>章节目录</h1>
          <Link href={`/stories/${id}`} className={styles.backButton}>
            返回作品详情
          </Link>
        </div>

        {isInvalidPage ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 min-h-[60vh] bg-white rounded-lg shadow-sm">
            <div className="w-24 h-24 bg-yellow-50 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">页码超出范围</h2>
            <p className="text-gray-600 text-center mb-8 max-w-sm">
              当前请求的页码超出了可用范围，请返回第一页查看内容。
            </p>
            <div className="flex gap-4">
              <Link 
                href={`/stories/${id}/chapters?page=1`}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 text-sm font-medium shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                返回第一页
              </Link>
              <Link 
                href={`/stories/${id}`}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2 text-sm font-medium"
              >
                返回作品详情
              </Link>
            </div>
          </div>
        ) : hasChapters ? (
          <>
            <div className={styles.chapterList}>
              {chapters.map(chapter => {
                console.log('[调试] 渲染章节:', chapter.id, chapter.title)
                return (
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
                )
              })}
            </div>
            
            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button 
                  onClick={() => handlePageChange(1)} 
                  disabled={currentPage === 1}
                  className={`${styles.pageButton} ${currentPage === 1 ? styles.disabled : ''}`}
                >
                  首页
                </button>
                
                <button 
                  onClick={() => handlePageChange(currentPage - 1)} 
                  disabled={currentPage === 1}
                  className={`${styles.pageButton} ${currentPage === 1 ? styles.disabled : ''}`}
                >
                  上一页
                </button>
                
                <div className={styles.pageInfo}>
                  <span className={styles.currentPage}>{currentPage}</span>
                  <span className={styles.pageDivider}>/</span>
                  <span className={styles.totalPages}>{totalPages}</span>
                </div>
                
                <button 
                  onClick={() => handlePageChange(currentPage + 1)} 
                  disabled={currentPage === totalPages}
                  className={`${styles.pageButton} ${currentPage === totalPages ? styles.disabled : ''}`}
                >
                  下一页
                </button>
                
                <button 
                  onClick={() => handlePageChange(totalPages)} 
                  disabled={currentPage === totalPages}
                  className={`${styles.pageButton} ${currentPage === totalPages ? styles.disabled : ''}`}
                >
                  末页
                </button>
                
                {/* 跳转到指定页码 */}
                <div className={styles.jumpWrapper}>
                  <span className={styles.jumpLabel}>跳至</span>
                  <input
                    type="text"
                    value={jumpPageInput}
                    onChange={handleJumpInputChange}
                    onKeyDown={handleJumpKeyDown}
                    className={styles.jumpInput}
                    placeholder="页码"
                    aria-label="跳转到页码"
                    maxLength={4}
                  />
                  <button 
                    onClick={handleJumpToPage}
                    className={styles.jumpButton}
                  >
                    跳转
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col items-center justify-center py-16 px-4 min-h-[60vh] bg-white rounded-lg shadow-sm">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">暂无章节内容</h2>
              <p className="text-gray-600 text-center mb-8 max-w-sm">
                作者正在创作中，请稍后再来查看。每一个精彩的故事都值得等待。
              </p>
              <div className="flex gap-4">
                <Link 
                  href={`/stories/${id}`}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 text-sm font-medium shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  返回作品详情
                </Link>
                <Link 
                  href="/stories"
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2 text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  浏览其他作品
                </Link>
              </div>
            </div>
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-medium text-yellow-800 mb-2">调试信息</h3>
              <pre className="text-xs text-yellow-700 whitespace-pre-wrap">
                {JSON.stringify({
                  id,
                  currentPage,
                  pageSize,
                  totalChapters,
                  chaptersState: typeof chapters,
                  chaptersLength: chapters?.length || 0,
                  chaptersContent: chapters?.slice(0, 2) || 'No chapters'
                }, null, 2)}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  )
}