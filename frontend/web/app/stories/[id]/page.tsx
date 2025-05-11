'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Story } from '@/types/story'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Editor } from '@/components/editor'
import { FiBook, FiClock, FiUser, FiTag, FiHeart, FiMessageSquare, FiStar, FiArrowLeft, FiShare2, FiBookmark, FiCopy, FiExternalLink, FiLock, FiDollarSign, FiCheckCircle, FiEdit3, FiArrowRight } from 'react-icons/fi'
import { SiEthereum, SiBinance } from 'react-icons/si'
import { truncateAddress } from '@/utils/address'
import styles from './page.module.css'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useAccount } from 'wagmi'
import BookmarkButton from '@/components/common/BookmarkButton'
import { useLoginModal } from '@/context/LoginModalContext'

interface Props {
  params: {
    id: string
  }
}

export default function StoryDetailPage({ params }: Props) {
  const { id } = params
  const router = useRouter()
  const [story, setStory] = useState<Story | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [isLiking, setIsLiking] = useState(false)
  const [storyImages, setStoryImages] = useState<{ [key: string]: string }>({})
  const [chapterStats, setChapterStats] = useState<{
    total: number;
    published: number;
    draft: number;
  }>({
    total: 0,
    published: 0,
    draft: 0
  })
  const { isConnected } = useAccount()
  const { user, token, isAuthenticated } = useAuth()
  const [isSharingOpen, setIsSharingOpen] = useState(false)
  const { openLoginModal } = useLoginModal()
  const [isFollowing, setIsFollowing] = useState(false)
  const [isFollowingLoading, setIsFollowingLoading] = useState(false)

  // 获取章节统计信息
  useEffect(() => {
    async function loadChapterStats() {
      try {
        const response = await fetch(`/api/stories/${id}/chapters/stats`)
        if (!response.ok) {
          throw new Error('获取章节统计失败')
        }
        const data = await response.json()
        setChapterStats(data)
      } catch (error) {
        console.error('获取章节统计失败:', error)
      }
    }

    if (id) {
      loadChapterStats()
    }
  }, [id])

  // 获取 IPFS 图片
  const fetchIPFSImage = async (cid: string) => {
    try {
      console.log(`[IPFS] 开始获取图片: ${cid}`)
      const response = await fetch(`https://blue-casual-wombat-745.mypinata.cloud/ipfs/${cid}`)
      console.log(`[IPFS] 响应状态: ${response.status}`)
      const text = await response.text()
      console.log(`[IPFS] 获取到的内容长度: ${text.length}`)
      
      // 检查返回的内容是否已经是 base64 图片
      if (text.startsWith('data:image')) {
        console.log(`[IPFS] 返回的内容已经是 base64 图片格式`)
        return text
      }
      
      // 检查是否为错误消息。防止这些错误消息被当作图片URL传递给Next.js的Image组件。
      if (text.includes("The owner of this gateway") || 
          text.includes("ERR_ID") || 
          text.includes("does not have this content") ||
          !text.match(/^(\{|\[|data:image)/)) {
        console.log(`[IPFS] 返回的内容是错误消息，返回默认图片`)
        return '/images/story-default-cover.jpg'
      }
      
      // 尝试解析 JSON
      try {
        const data = JSON.parse(text)
        console.log(`[IPFS] JSON 解析成功:`, {
          hasContent: !!data.content,
          contentType: typeof data.content,
          contentLength: data.content?.length
        })
        
        if (data.content) {
          console.log(`[IPFS] 使用 content 字段作为图片内容`)
          return data.content
        }
      } catch (jsonError) {
        console.log(`[IPFS] JSON 解析失败，使用原始内容:`, jsonError)
      }
      
      // 如果都不是，返回原始内容
      console.log(`[IPFS] 使用原始内容作为图片`)
      return text
    } catch (error) {
      console.error('[IPFS] 获取图片失败:', error)
      return '/images/story-default-cover.jpg'
    }
  }

  // 加载 IPFS 图片
  useEffect(() => {
    async function loadIPFSImages() {
      if (!story) return

      const imagesToLoad = [
        { cid: story.coverCid, key: 'cover' },
        { cid: story.author.avatar, key: 'avatar' },
        { cid: story.nftImage || story.coverCid, key: 'nft' }
      ].filter(img => img.cid?.startsWith('Qm'))

      console.log(`[IPFS] 需要加载 ${imagesToLoad.length} 个 IPFS 图片`)

      const imagePromises = imagesToLoad.map(async ({ cid, key }) => {
        if (!cid) return
        console.log(`[IPFS] 开始处理 ${key} 图片: ${cid}`)
        const imageContent = await fetchIPFSImage(cid)
        if (imageContent) {
          console.log(`[IPFS] 成功获取 ${key} 图片`)
          setStoryImages(prev => ({
            ...prev,
            [cid]: imageContent
          }))
        } else {
          console.log(`[IPFS] 获取 ${key} 图片失败`)
        }
      })

      await Promise.all(imagePromises)
      console.log('[IPFS] 所有图片加载完成，当前图片缓存:', Object.keys(storyImages))
    }

    loadIPFSImages()
  }, [story])

  // 获取故事详情
  useEffect(() => {
    async function loadStory() {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/stories/${id}`)
        if (!response.ok) {
          throw new Error('获取故事详情失败')
        }
        const data = await response.json()
        setStory(data)
      } catch (error) {
        console.error('获取故事详情失败:', error)
        setError(error instanceof Error ? error.message : '未知错误')
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      loadStory()
    }
  }, [id])

  // 检查是否已点赞
  useEffect(() => {
    async function checkLikeStatus() {
      try {
        const response = await fetch(`/api/stories/${id}/like/check`)
        if (!response.ok) {
          throw new Error('检查点赞状态失败')
        }
        const data = await response.json()
        setIsLiked(data.isLiked)
        setLikeCount(data.likeCount)
      } catch (error) {
        console.error('检查点赞状态失败:', error)
      }
    }

    if (id) {
      checkLikeStatus()
    }
  }, [id])

  // 检查是否已关注作者
  useEffect(() => {
    async function checkFollowStatus() {
      if (!isAuthenticated || !story?.author?.address) return;
      
      try {
        console.log(`[作者关注-调试] 开始检查关注状态:`, {
          authorId: story.author.address,
          userId: user?.id,
          hasToken: !!token,
          isAuthenticated
        });
        
        const params = new URLSearchParams();
        if (user?.address) {
          params.append('address', user.address);
        } else if (user?.id) {
          params.append('userId', user.id);
        }
        params.append('authorId', story.author.address);
        
        const requestUrl = `/api/users/following/status?${params.toString()}`;
        console.log(`[作者关注-调试] 请求URL:`, requestUrl);
        
        const response = await fetch(requestUrl, {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        });
        
        console.log(`[作者关注-调试] 收到响应:`, {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[作者关注-调试] 检查关注状态失败:`, {
            status: response.status,
            statusText: response.statusText,
            errorText
          });
          return;
        }
        
        const data = await response.json();
        console.log(`[作者关注-调试] 关注状态:`, data);
        setIsFollowing(data.isFollowing);
      } catch (error) {
        console.error(`[作者关注-调试] 检查关注状态异常:`, error);
      }
    }

    checkFollowStatus();
  }, [story?.author?.address, user, isAuthenticated, token]);

  // 处理点赞
  const handleLike = async () => {
    if (isLiking) return
    setIsLiking(true)
    try {
      const response = await fetch(`/api/stories/${id}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        setIsLiked(!isLiked)
        setLikeCount(prev => isLiked ? prev - 1 : prev + 1)
      }
    } catch (error) {
      console.error('Failed to like story:', error)
    } finally {
      setIsLiking(false)
    }
  }

  // 处理分享
  const handleShare = () => {
    // TODO: 实现分享功能
    if (navigator.share) {
      navigator.share({
        title: story?.title,
        text: story?.description,
        url: window.location.href
      })
    }
  }

  // 更新阅读进度
  const updateReadingProgress = async (progress: number) => {
    if (!user?.address || !isAuthenticated) return;
    
    try {
      console.log(`[故事详情] 开始更新阅读进度:`, { 
        storyId: id, 
        progress, 
        userAddress: user.address 
      });
      
      const response = await fetch(`/api/users/${user.address}/favorites/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storyId: id,
          progress
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.error(`[故事详情] 更新阅读进度失败:`, data);
        return;
      }
      
      const data = await response.json();
      console.log(`[故事详情] 更新阅读进度成功:`, data);
    } catch (error) {
      console.error(`[故事详情] 更新阅读进度异常:`, error);
    }
  };

  // 处理关注作者
  const handleFollowAuthor = async () => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    
    if (!story?.author?.address) {
      toast.error('作者信息不完整');
      return;
    }
    
    if (isFollowingLoading) return;
    
    setIsFollowingLoading(true);
    
    try {
      console.log(`[作者关注-调试] ${isFollowing ? '取消关注' : '关注'}作者开始:`, {
        authorId: story.author.address,
        userId: user?.id,
        userAddress: user?.address,
        hasToken: !!token,
        isFollowing: isFollowing
      });
      
      // 乐观更新UI
      setIsFollowing(prev => !prev);
      
      if (story?.author) {
        setStory(prev => prev ? {
          ...prev,
          author: {
            ...prev.author,
            followerCount: isFollowing 
              ? Math.max(0, (prev.author.followerCount || 0) - 1)
              : (prev.author.followerCount || 0) + 1
          }
        } : null);
      }
      
      // 根据操作类型选择HTTP方法
      const method = isFollowing ? 'DELETE' : 'POST';
      let requestUrl = `/api/users/following`;
      let headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      };
      let body: string | undefined = undefined;
      
      // 如果是DELETE请求，使用URL参数；如果是POST请求，使用请求体
      if (method === 'DELETE') {
        const params = new URLSearchParams();
        params.append('userId', user?.id || '');
        params.append('authorId', story.author.address);
        requestUrl = `${requestUrl}?${params.toString()}`;
      } else {
        body = JSON.stringify({
          userId: user?.id,
          address: user?.address,
          authorId: story.author.address
        });
      }
      
      console.log(`[作者关注-调试] 请求信息:`, {
        url: requestUrl,
        method,
        hasToken: !!token
      });
      
      const response = await fetch(requestUrl, {
        method,
        headers,
        body
      });
      
      console.log(`[作者关注-调试] 收到响应:`, {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: await response.text() };
        }
        
        console.error(`[作者关注-调试] ${isFollowing ? '取消关注' : '关注'}作者失败:`, {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        
        // 回滚UI状态
        setIsFollowing(isFollowing);
        if (story?.author) {
          setStory(prev => prev ? {
            ...prev,
            author: {
              ...prev.author,
              followerCount: isFollowing 
                ? (prev.author.followerCount || 0)
                : Math.max(0, (prev.author.followerCount || 0) - 1)
            }
          } : null);
        }
        
        toast.error(errorData.error || `${isFollowing ? '取消关注' : '关注'}失败`);
        return;
      }
      
      const data = await response.json();
      console.log(`[作者关注-调试] ${isFollowing ? '取消关注' : '关注'}成功:`, data);
      toast.success(isFollowing ? '已取消关注作者' : '已成功关注作者');
    } catch (error) {
      console.error(`[作者关注-调试] ${isFollowing ? '取消关注' : '关注'}作者异常:`, error);
      toast.error(`${isFollowing ? '取消关注' : '关注'}过程中出现错误`);
      
      // 回滚UI状态
      setIsFollowing(isFollowing);
      if (story?.author) {
        setStory(prev => prev ? {
          ...prev,
          author: {
            ...prev.author,
            followerCount: isFollowing 
              ? (prev.author.followerCount || 0)
              : Math.max(0, (prev.author.followerCount || 0) - 1)
          }
        } : null);
      }
    } finally {
      setIsFollowingLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center max-w-lg mx-auto px-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link 
            href="/stories" 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
          >
            返回作品列表
          </Link>
        </div>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center max-w-lg mx-auto px-4">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiBook className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 mb-4">作品不存在</p>
          <Link 
            href="/stories" 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
          >
            返回作品列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.main}>
      {/* 顶部导航栏 */}
      <div className={styles.navbar}>
        <div className={styles.navbarContent}>
          <Link 
            href="/stories"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
            <span>返回列表</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-1.5 text-gray-600 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 rounded-full"
              title="分享"
            >
              <FiShare2 className="w-4 h-4" />
            </button>
            <BookmarkButton
              storyId={id}
              variant="pill"
              showText={false}
              size="sm"
            />
          </div>
        </div>
      </div>

      <div className={styles.container}>
        {/* 作品信息区域 */}
        <div className={styles.header}>
          <div className={styles.coverWrapper}>
            <Image
              src={
                story.coverCid?.startsWith('data:image') 
                  ? story.coverCid
                  : story.coverCid?.startsWith('Qm')
                    ? storyImages[story.coverCid] || `https://blue-casual-wombat-745.mypinata.cloud/ipfs/${story.coverCid}`
                    : '/images/story-default-cover.jpg'
              }
              alt={story.title}
              className={styles.cover}
              width={280}
              height={420}
              priority
            />
          </div>
          <div className={styles.info}>
            <div className={styles.category}>
              <FiTag className="w-4 h-4" />
              <span>{story.category}</span>
              <div className={styles.statusBadge}>
                {story.status === 'completed' ? (
                  <>
                    <FiCheckCircle className="w-4 h-4" />
                    <span>已完结</span>
                  </>
                ) : (
                  <>
                    <FiEdit3 className="w-4 h-4" />
                    <span>连载中</span>
                  </>
                )}
              </div>
            </div>
            <h1 className={styles.title}>{story.title}</h1>
            <p className={styles.description}>{story.description}</p>
            
            {/* 作者信息卡片 */}
            <div className={styles.authorCard}>
              <div className={styles.authorHeader}>
                <div className={styles.authorMain}>
                  <div className={styles.authorAvatar}>
                    {story.author.avatar ? (
                      <Image 
                        src={story.author.avatar} 
                        alt={story.author.authorName || '作者'} 
                        width={64} 
                        height={64} 
                        className="rounded-full ring-2 ring-white shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-full flex items-center justify-center text-sm font-medium ring-2 ring-white shadow-sm">
                        {(story.author.authorName || 'A')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className={styles.authorInfo}>
                    <Link 
                      href={`/author/${story.author.address}`}
                      className={styles.authorName}
                    >
                      {story.author.authorName || truncateAddress(story.author.address)}
                    </Link>
                    <div className={styles.authorAddress}>
                      <SiEthereum className="w-3 h-3" />
                      <a
                        href={`https://etherscan.io/address/${story.author.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.addressLink}
                      >
                        {truncateAddress(story.author.address)}
                        <FiExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
                <button 
                  className={`${styles.followButton} ${isFollowing ? styles.following : ''}`}
                  onClick={handleFollowAuthor}
                  disabled={isFollowingLoading}
                >
                  {isFollowingLoading ? (
                    <span className={styles.loadingSpinner}></span>
                  ) : isFollowing ? (
                    '已关注'
                  ) : (
                    '关注作者'
                  )}
                </button>
              </div>
              
              <div className={styles.authorStats}>
                <div className={styles.authorStatItem}>
                  <span className={styles.statLabel}>作品</span>
                  <span className={styles.statValue}>{story.author.storyCount || 0}</span>
                </div>
                <div className={styles.authorStatItem}>
                  <span className={styles.statLabel}>粉丝</span>
                  <span className={styles.statValue}>{story.author.followerCount || 0}</span>
                </div>
                <div className={styles.authorStatItem}>
                  <span className={styles.statLabel}>NFT</span>
                  <span className={styles.statValue}>{story.author.nftCount || 0}</span>
                </div>
              </div>
            </div>

            {/* 作品统计信息 */}
            <div className={styles.stats}>
              <div className={styles.statsItem}>
                <div className={styles.statsIcon}>
                  <FiBook />
                </div>
                <div className={styles.statsText}>
                  <div className={styles.statsLabel}>当前章节</div>
                  <div className={styles.statsValue}>{chapterStats.published} 章</div>
                </div>
              </div>
              <div className={styles.statsItem}>
                <div className={styles.statsIcon}>
                  <FiClock />
                </div>
                <div className={styles.statsText}>
                  <div className={styles.statsLabel}>更新频率</div>
                  <div className={styles.statsValue}>每周 {story?.updateFrequency || '-'} 章</div>
                </div>
              </div>
              <div className={styles.statsItem}>
                <div className={styles.statsIcon}>
                  <FiEdit3 />
                </div>
                <div className={styles.statsText}>
                  <div className={styles.statsLabel}>平均字数</div>
                  <div className={styles.statsValue}>{story?.averageWordsPerChapter || '-'} 字/章</div>
                </div>
              </div>
              <div className={styles.statsItem}>
                <div className={styles.statsIcon}>
                  <FiMessageSquare />
                </div>
                <div className={styles.statsText}>
                  <div className={styles.statsLabel}>评论数</div>
                  <div className={styles.statsValue}>{story?.commentCount || 0}</div>
                </div>
              </div>
            </div>

            {/* 收益信息 */}
            <div className={styles.earnings}>
              <div className={styles.earningItem}>
                <div className={styles.earningIcon}>
                  <SiBinance className="w-5 h-5" />
                </div>
                <div className={styles.earningInfo}>
                  <span className={styles.earningLabel}>BNB 收益</span>
                  <span className={styles.earningValue}>
                    {story.bnbEarnings?.toFixed(4) || '0.0000'} BNB
                  </span>
                </div>
              </div>
              <div className={styles.earningItem}>
                <div className={styles.earningIcon}>
                  <Image
                    src="/images/token-icon.png"
                    alt="TF Token"
                    width={20}
                    height={20}
                  />
                </div>
                <div className={styles.earningInfo}>
                  <span className={styles.earningLabel}>平台代币收益</span>
                  <span className={styles.earningValue}>
                    {story.tokenEarnings?.toLocaleString() || '0'} TF
                  </span>
                </div>
              </div>
            </div>

            {/* 章节信息 */}
            <div className={styles.chapterInfo}>
              <div className={styles.chapterStats}>
                <div className={styles.chapterStatItem}>
                  <span className={styles.chapterStatLabel}>当前章节</span>
                  <span className={styles.chapterStatValue}>{story.chapterCount || 0}</span>
                </div>
                <div className={styles.chapterStatItem}>
                  <span className={styles.chapterStatLabel}>更新频率</span>
                  <span className={styles.chapterStatValue}>每周 3-4 章</span>
                </div>
                <div className={styles.chapterStatItem}>
                  <span className={styles.chapterStatLabel}>平均字数</span>
                  <span className={styles.chapterStatValue}>
                    {story.chapterCount ? Math.round(story.wordCount / story.chapterCount) : 0}
                  </span>
                </div>
              </div>
              <Link
                href={`/stories/${id}/chapters`}
                className={styles.chaptersButton}
              >
                <FiBook className="w-5 h-5" />
                <span>查看完整章节列表</span>
                <FiArrowRight className="w-5 h-5" />
              </Link>
            </div>

            <div className={styles.actions}>
              <Link
                href={`/stories/${id}/read?order=1`}
                className={styles.readButton}
              >
                开始阅读
              </Link>
              <button
                onClick={handleLike}
                disabled={isLiking}
                className={`${styles.actionButton} ${isLiked ? styles.liked : ''}`}
              >
                <FiHeart className="w-5 h-5" />
                <span>{likeCount}</span>
              </button>
              <BookmarkButton 
                storyId={id}
                variant="button"
                className={styles.actionButton}
              />
            </div>
          </div>
        </div>

        {/* Web3 信息区域 */}
        <div className={styles.web3Info}>
          <div className={styles.web3Header}>
            <h3 className={styles.web3Title}>
              <SiEthereum />
              Web3 信息
            </h3>
          </div>
          
          <div className={styles.web3Grid}>
            {/* NFT 信息 */}
            <div className={styles.web3Card}>
              <div className={styles.web3Label}>
                <FiLock /> NFT 凭证
              </div>
              <div className={styles.nftPreview}>
                <Image
                  src={
                    story.nftImage?.startsWith('data:image') || story.coverCid?.startsWith('data:image')
                      ? story.nftImage || story.coverCid || '/images/story-default-cover.jpg'
                      : story.nftImage?.startsWith('Qm') || story.coverCid?.startsWith('Qm')
                        ? storyImages[story.nftImage || story.coverCid || ''] || 
                          `https://blue-casual-wombat-745.mypinata.cloud/ipfs/${story.nftImage || story.coverCid}`
                        : '/images/story-default-cover.jpg'
                  }
                  alt="NFT Preview"
                  className={styles.nftImage}
                  fill
                />
              </div>
              <div className={styles.web3Badge}>
                已铸造 {story.nftMinted || 0}/{story.nftTotal || 1000}
              </div>
              <button className={styles.web3Button}>
                <FiExternalLink /> 铸造 NFT
              </button>
            </div>

            {/* 代币经济 */}
            <div className={styles.web3Card}>
              <div className={styles.web3Label}>
                <FiDollarSign /> 代币经济
              </div>
              <div className={styles.web3Value}>
                <div className={styles.tokenInfo}>
                  <span className={styles.tokenAmount}>{story.tokenPrice || 0}</span>
                  <span className={styles.tokenSymbol}>TF</span>
                </div>
              </div>
              <div className={styles.web3Stats}>
                <div className={styles.web3StatItem}>
                  <span className={styles.web3StatLabel}>持有者</span>
                  <span className={styles.web3StatValue}>{story.tokenHolders || 0}</span>
                </div>
                <div className={styles.web3StatItem}>
                  <span className={styles.web3StatLabel}>流通量</span>
                  <span className={styles.web3StatValue}>{story.tokenSupply || 0}</span>
                </div>
              </div>
              <button className={styles.web3Button}>
                <FiExternalLink /> 购买代币
              </button>
            </div>

            {/* 智能合约 */}
            <div className={styles.web3Card}>
              <div className={styles.web3Label}>
                <SiEthereum /> 智能合约
              </div>
              <div className={styles.web3Stats}>
                <div className={styles.web3StatItem}>
                  <span className={styles.web3StatLabel}>创建时间</span>
                  <span className={styles.web3StatValue}>
                    {new Date(story.contractCreatedAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>
                <div className={styles.web3StatItem}>
                  <span className={styles.web3StatLabel}>交易数</span>
                  <span className={styles.web3StatValue}>{story.transactionCount || 0}</span>
                </div>
              </div>
              <div className={styles.web3Value}>
                <a
                  href={`https://etherscan.io/address/${story.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.web3Button}
                >
                  {truncateAddress(story.contractAddress || '')}
                  <FiExternalLink />
                </a>
              </div>
              <div className={styles.web3Links}>
                <a href="#" className={styles.web3Link}>查看源码</a>
                <a href="#" className={styles.web3Link}>查看交易</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}