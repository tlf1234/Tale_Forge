'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

import styles from './page.module.css'

// IPFS 网关列表
const IPFS_GATEWAYS = [
  'https://blue-casual-wombat-745.mypinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/'
]

// 从IPFS获取图片内容
const fetchIPFSImage = async (cid: string) => {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      console.log(`[IPFS] 尝试网关 ${gateway} 获取图片: ${cid}`)
      const response = await fetch(`${gateway}${cid}`)
      
      if (!response.ok) {
        console.log(`[IPFS] 网关 ${gateway} 返回状态码: ${response.status}`)
        continue // 尝试下一个网关
      }
      
      const text = await response.text()
      
      // 检查返回的内容是否已经是 base64 图片
      if (text.startsWith('data:image')) {
        console.log(`[IPFS] 网关 ${gateway} 返回的内容已经是 base64 图片格式`)
        return text
      }
      
      // 检查是否为错误消息
      if (text.includes("The owner of this gateway") || 
          text.includes("ERR_ID") || 
          text.includes("does not have this content") ||
          !text.match(/^(\{|\[|data:image)/)) {
        console.log(`[IPFS] 网关 ${gateway} 返回错误消息，尝试下一个网关`)
        continue
      }
      
      // 尝试解析 JSON
      try {
        const data = JSON.parse(text)
        if (data.content) {
          console.log(`[IPFS] 网关 ${gateway} 返回的JSON内容解析成功`)
          return data.content
        }
      } catch (jsonError) {
        console.log(`[IPFS] 网关 ${gateway} 返回的内容不是有效JSON，使用原始内容`)
      }
      
      // 返回原始内容
      console.log(`[IPFS] 使用网关 ${gateway} 返回的原始内容作为图片`)
      return text
    } catch (error) {
      console.error(`[IPFS] 网关 ${gateway} 请求失败:`, error)
      // 继续尝试下一个网关
    }
  }
  
  console.log(`[IPFS] 所有网关均失败，使用默认图片`)
  return null
}

// 榜单类型
const RANKING_TYPES = [
  { id: 'authors', name: '作家榜' },
  { id: 'works', name: '作品榜' },
  { id: 'nft', name: 'NFT榜' }
]

// 作家榜排序选项
const AUTHOR_SORT_OPTIONS = [
  { id: 'earnings', name: '收益' },
  { id: 'readers', name: '读者数' },
  { id: 'works', name: '作品数' },
  { id: 'likes', name: '获赞数' }
]

// 作品榜排序选项
const WORK_SORT_OPTIONS = [
  { id: 'hot', name: '热门' },
  { id: 'new', name: '最新' },
  { id: 'rating', name: '评分' },
  { id: 'collect', name: '收藏' }
]

// NFT榜排序选项
const NFT_SORT_OPTIONS = [
  { id: 'volume', name: '交易额' },
  { id: 'trades', name: '交易量' },
  { id: 'price', name: '价格' }
]

// 时间范围选项
const TIME_RANGES = [
  { id: 'weekly', name: '周榜' },
  { id: 'monthly', name: '月榜' },
  { id: 'yearly', name: '年榜' },
  { id: 'all', name: '总榜' }
]

// 数据类型定义
// 作家数据类型
interface Author {
  id: string;
  address: string;
  authorName: string;
  avatar: string;
  earnings: number;
  readers: number;
  works: number;
  likes: number;
  verified: boolean;
  description: string;
  tags: string[];
  ranking: number;
}

// 作品数据类型
interface Work {
  id: string;
  title: string;
  author: string;
  authorId: string; 
  cover: string;
  views: number;
  rating: string;
  collects: number;
  hot: number;
  new: number;
  tags: string[];
  ranking: number;
}

// NFT数据类型
interface NFT {
  id: string;
  title: string;
  image: string;
  creator: string;
  creatorId: string;
  volume: number;
  trades: number;
  price: string;
  ranking: number;
}

export default function RankingPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rankingType, setRankingType] = useState('authors')
  const [sortBy, setSortBy] = useState('earnings')
  const [timeRange, setTimeRange] = useState('weekly')
  const [rankingData, setRankingData] = useState<(Author | Work | NFT)[]>([])
  const [storyImages, setStoryImages] = useState<{ [key: string]: string }>({})
  const [isFetching, setIsFetching] = useState(false) // 用于控制重试按钮状态

  // 获取当前排序选项
  const getCurrentSortOptions = () => {
    switch (rankingType) {
      case 'works':
        return WORK_SORT_OPTIONS
      case 'nft':
        return NFT_SORT_OPTIONS
      default:
        return AUTHOR_SORT_OPTIONS
    }
  }

  // 获取榜单数据
  const fetchRankingData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setIsFetching(true)
    
    try {
      const queryParams = new URLSearchParams({
        type: rankingType,
        sortBy,
        timeRange
      }).toString()
      
      const url = `/api/rankings?${queryParams}`
      console.log('【榜单中心】请求URL:', url, '参数:', { rankingType, sortBy, timeRange })
      
      const response = await fetch(url)
      console.log('【榜单中心】响应状态:', response.status)
      
      if (!response.ok) {
        let errorMessage = '获取榜单数据失败'
        
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          const errorText = await response.text()
          console.error('【榜单中心】请求失败:', errorText)
          errorMessage = `获取榜单数据失败: ${response.status}`
        }
        
        throw new Error(errorMessage)
      }
      
      const data = await response.json()
      console.log('【榜单中心】返回数据:', {
        items: data.items?.length || 0,
        type: data.type || rankingType
      })
      
      // 确保数据格式正确
      if (!data.items || !Array.isArray(data.items)) {
        console.error('【榜单中心】数据格式错误:', data)
        throw new Error('返回数据格式错误')
      }
      
      setRankingData(data.items || [])
      
      // 预加载IPFS图片
      if (data.items && data.items.length > 0) {
        // 确定要加载的图片字段
        const imageField = rankingType === 'works' 
          ? 'cover' 
          : rankingType === 'nft' ? 'image' : 'avatar'
        
        // 并行加载前8张图片
        const visibleItems = data.items.slice(0, 8)
        
        console.log(`【榜单中心】开始预加载${visibleItems.length}个IPFS图片`)
        
        // 使用Promise.all并行加载，但不等待全部完成
        visibleItems
          .filter((item: any) => item[imageField]?.startsWith('Qm'))
          .forEach(async (item: any) => {
            try {
              console.log(`【榜单中心】加载图片:`, item[imageField])
              const imageContent = await fetchIPFSImage(item[imageField])
              if (imageContent) {
                console.log(`【榜单中心】图片加载成功:`, item[imageField].substring(0, 10) + '...')
                setStoryImages(prev => ({
                  ...prev,
                  [item[imageField]]: imageContent
                }))
              }
            } catch (err) {
              console.error(`【榜单中心】加载图片失败:`, item[imageField], err)
            }
          })
      }
    } catch (err) {
      console.error('【榜单中心】获取榜单数据失败:', err)
      setError(err instanceof Error ? err.message : '获取榜单数据失败，请稍后重试')
    } finally {
      setIsLoading(false)
      setIsFetching(false)
    }
  }, [rankingType, sortBy, timeRange])

  // 当筛选条件变化时重新获取数据
  useEffect(() => {
    fetchRankingData()
  }, [fetchRankingData])

  // 获取图片URL
  const getImageUrl = (item: any, type: string): string => {
    const imageKey = type === 'works' ? 'cover' : type === 'nft' ? 'image' : 'avatar'
    const image = item[imageKey]
    
    if (!image) {
      console.log(`【榜单中心】图片地址为空, 使用默认图片`)
      return '/images/story-default-cover.jpg'
    }
    
    // 检查是否有缓存的IPFS图片
    if (image.startsWith('Qm') && storyImages[image]) {
      console.log(`【榜单中心】使用缓存的IPFS图片: ${image.substring(0, 10)}...`)
      return storyImages[image]
    }
    
    // 如果是IPFS格式但还没有加载，返回默认图片
    if (image.startsWith('Qm')) {
      console.log(`【榜单中心】IPFS图片尚未加载: ${image.substring(0, 10)}...`)
      return '/images/story-default-cover.jpg'
    }
    
    // HTTP链接直接返回
    if (image.startsWith('http')) {
      return image
    }
    
    // Base64图片直接返回
    if (image.startsWith('data:')) {
      return image
    }
    
    console.log(`【榜单中心】未知格式图片: ${image.substring(0, 20)}...`)
    return '/images/story-default-cover.jpg'
  }

  // 加载更多IPFS图片
  useEffect(() => {
    const loadMoreImages = async () => {
      if (rankingData.length === 0) return
      
      // 确定要加载的图片字段
      const imageField = rankingType === 'works' 
        ? 'cover' 
        : rankingType === 'nft' ? 'image' : 'avatar'
      
      // 加载还未加载的图片（从第9张开始）
      const remainingItems = rankingData.slice(8)
      
      if (remainingItems.length === 0) return
      
      console.log(`【榜单中心】加载更多图片: ${remainingItems.length}个`)
      
      // 分批处理，每批4个图片
      const batchSize = 4
      for (let i = 0; i < remainingItems.length; i += batchSize) {
        const batch = remainingItems.slice(i, i + batchSize)
        
        // 并行加载当前批次
        await Promise.all(
          batch
            .filter(item => {
              const image = item[imageField as keyof typeof item] as string
              return image?.startsWith('Qm') && !storyImages[image]
            })
            .map(async item => {
              try {
                const image = item[imageField as keyof typeof item] as string
                console.log(`【榜单中心】加载批次图片: ${image.substring(0, 10)}...`)
                const imageContent = await fetchIPFSImage(image)
                if (imageContent) {
                  console.log(`【榜单中心】批次图片加载成功: ${image.substring(0, 10)}...`)
                  setStoryImages(prev => ({
                    ...prev,
                    [image]: imageContent
                  }))
                }
              } catch (error) {
                console.error('【榜单中心】批次加载图片失败:', error)
              }
            })
        )
        
        // 每批处理后等待一小段时间，避免请求过于频繁
        if (i + batchSize < remainingItems.length) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
    }
    
    if (!isLoading) {
      loadMoreImages()
    }
  }, [isLoading, rankingData, rankingType, storyImages])

  // 格式化数值函数
  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万'
    }
    return num.toLocaleString('zh-CN')
  }

  return (
    <div className="min-h-screen pt-[118px]">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">榜单中心</h1>
            <p className="text-gray-600">发现优秀的作家、作品与NFT</p>
          </div>

          {/* 榜单筛选器 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <div className="space-y-6">
              {/* 榜单类型 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">榜单类型</h3>
                <div className="flex flex-wrap gap-3">
                  {RANKING_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => {
                        setRankingType(type.id);
                        setSortBy(type.id === 'works' ? 'hot' : type.id === 'nft' ? 'volume' : 'earnings');
                      }}
                      className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300
                        ${rankingType === type.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {type.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 排序选项 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">排序方式</h3>
                <div className="flex flex-wrap gap-3">
                  {getCurrentSortOptions().map(option => (
                    <button
                      key={option.id}
                      onClick={() => setSortBy(option.id)}
                      className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300
                        ${sortBy === option.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {option.name}榜
                    </button>
                  ))}
                </div>
              </div>

              {/* 时间范围 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">时间范围</h3>
                <div className="flex flex-wrap gap-3">
                  {TIME_RANGES.map(range => (
                    <button
                      key={range.id}
                      onClick={() => setTimeRange(range.id)}
                      className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300
                        ${timeRange === range.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {range.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 榜单内容 */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="text-center">
                <LoadingSpinner />
                <p className="mt-4 text-gray-600">正在加载榜单数据...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex justify-center py-12 text-center">
              <div className="max-w-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-xl font-medium text-gray-900 mb-2">获取数据失败</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button 
                  onClick={fetchRankingData}
                  disabled={isFetching}
                  className={`px-4 py-2 rounded-md font-medium transition-all
                    ${isFetching
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  {isFetching ? '加载中...' : '重新加载'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {rankingType === 'authors' && (
                <div className={styles.authorList}>
                  {rankingData.map((author, index) => (
                    <Link 
                      href={`/ranking/author/${(author as Author).address}`} 
                      key={author.id} 
                      className={styles.authorCard}
                    >
                      <div className={styles.ranking}>
                        <span className={styles.rankingNumber}>
                          {index + 1}
                        </span>
                      </div>
                      <div className={styles.avatarWrapper}>
                        <Image
                          src={getImageUrl(author, 'authors')}
                          alt={(author as Author).authorName}
                          width={80}
                          height={80}
                          className={styles.avatar}
                        />
                        {(author as Author).verified && (
                          <div className={styles.verifiedBadge}>
                            <svg viewBox="0 0 24 24" fill="none" className={styles.verifiedIcon}>
                              <path
                                d="M9 12l2 2 4-4"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className={styles.info}>
                        <h3 className={styles.name}>{(author as Author).authorName}</h3>
                        <p className={styles.description}>{(author as Author).description}</p>
                        <div className={styles.tags}>
                          {(author as Author).tags?.map(tag => (
                            <span key={tag} className={styles.tag}>
                              {tag}
                            </span>
                          )) || null}
                        </div>
                      </div>
                      <div className={styles.stats}>
                        <div className={styles.stat}>
                          <span className={styles.value}>
                            {formatNumber((author as Author).earnings)}
                          </span>
                          <span className={styles.label}>收益</span>
                        </div>
                        <div className={styles.stat}>
                          <span className={styles.value}>
                            {formatNumber((author as Author).readers)}
                          </span>
                          <span className={styles.label}>读者</span>
                        </div>
                        <div className={styles.stat}>
                          <span className={styles.value}>{(author as Author).works}</span>
                          <span className={styles.label}>作品</span>
                        </div>
                        <div className={styles.stat}>
                          <span className={styles.value}>
                            {formatNumber((author as Author).likes)}
                          </span>
                          <span className={styles.label}>获赞</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {rankingType === 'works' && (
                <div className={styles.workList}>
                  {rankingData.map((work, index) => (
                    <Link 
                      href={`/stories/${work.id}`} 
                      key={work.id} 
                      className={styles.workCard}
                    >
                      <div className={styles.ranking}>
                        <span className={styles.rankingNumber}>
                          {index + 1}
                        </span>
                      </div>
                      <div className={styles.coverWrapper}>
                        <Image
                          src={getImageUrl(work, 'works')}
                          alt={(work as Work).title}
                          width={200}
                          height={267}
                          className={styles.cover}
                        />
                      </div>
                      <div className={styles.info}>
                        <h3 className={styles.title}>{(work as Work).title}</h3>
                        <p className={styles.author}>{(work as Work).author}</p>
                        <div className={styles.tags}>
                          {(work as Work).tags?.map(tag => (
                            <span key={tag} className={styles.tag}>
                              {tag}
                            </span>
                          )) || null}
                        </div>
                        <div className={styles.workStats}>
                          <div className={styles.workStat}>
                            <span className={styles.value}>{formatNumber((work as Work).views)}</span>
                            <span className={styles.label}>阅读</span>
                          </div>
                          <div className={styles.workStat}>
                            <span className={styles.value}>{(work as Work).rating}</span>
                            <span className={styles.label}>评分</span>
                          </div>
                          <div className={styles.workStat}>
                            <span className={styles.value}>
                              {formatNumber((work as Work).collects)}
                            </span>
                            <span className={styles.label}>收藏</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {rankingType === 'nft' && (
                <div className={styles.nftList}>
                  {rankingData.map((nft, index) => (
                    <Link 
                      href={`/nft-market/${nft.id}`} 
                      key={nft.id} 
                      className={styles.nftCard}
                    >
                      <div className={styles.ranking}>
                        <span className={styles.rankingNumber}>
                          {index + 1}
                        </span>
                      </div>
                      <div className={styles.nftImageWrapper}>
                        <Image
                          src={getImageUrl(nft, 'nft')}
                          alt={(nft as NFT).title}
                          width={200}
                          height={200}
                          className={styles.nftImage}
                        />
                      </div>
                      <div className={styles.info}>
                        <h3 className={styles.title}>{(nft as NFT).title}</h3>
                        <p className={styles.creator}>创作者：{(nft as NFT).creator}</p>
                        <div className={styles.nftStats}>
                          <div className={styles.nftStat}>
                            <span className={styles.value}>
                              {formatNumber((nft as NFT).volume)}
                            </span>
                            <span className={styles.label}>交易额</span>
                          </div>
                          <div className={styles.nftStat}>
                            <span className={styles.value}>
                              {formatNumber((nft as NFT).trades)}
                            </span>
                            <span className={styles.label}>交易量</span>
                          </div>
                          <div className={styles.nftStat}>
                            <span className={styles.value}>{(nft as NFT).price}</span>
                            <span className={styles.label}>价格</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* 暂无数据提示 */}
              {rankingData.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="text-gray-400 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0v10l-8 4m0-10L4 7m8 4v10" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-gray-700 mb-2">暂无榜单数据</h3>
                  <p className="text-gray-500 text-center max-w-md mb-6">
                    当前筛选条件下没有榜单数据，请尝试更改榜单类型或排序方式。
                  </p>
                  <button 
                    onClick={fetchRankingData}
                    disabled={isFetching}
                    className={`px-4 py-2 rounded-md font-medium transition-all
                      ${isFetching
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                  >
                    {isFetching ? '加载中...' : '刷新数据'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 