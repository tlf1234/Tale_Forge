'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import styles from './page.module.css'
import dynamic from 'next/dynamic'
import { useAccount } from 'wagmi'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import BookmarkButton from '@/components/common/BookmarkButton'
import { FiBookmark, FiBook, FiClock, FiLogIn } from 'react-icons/fi'
import { IoHeartOutline, IoHeart, IoTimeOutline, IoChevronForward } from 'react-icons/io5'
import { useReadingHistory } from '@/hooks/useReadingHistory'
import { useLoginModal } from '@/context/LoginModalContext'

// 空间模块类型
const SPACE_MODULES = [
  { id: 'bookshelf', name: '我的书架', icon: '📚' },
  { id: 'history', name: '阅读历史', icon: '📖' },
  { id: 'comments', name: '评论', icon: '💬' },
  { id: 'likes', name: '点赞', icon: '👍' },
  { id: 'following', name: '我的关注', icon: '👀' },
  { id: 'shares', name: '分享', icon: '🔗' },
  { id: 'nft', name: '我的NFT', icon: '🎨' },
  { id: 'transactions', name: '消费记录', icon: '💰' },
  // { id: 'followers', name: '我的粉丝', icon: '👥' },
  // { id: 'settings', name: '个人设置', icon: '⚙️' }
]

// 定义书架项类型
interface BookshelfItem {
  id: string
  storyId: string
  title: string
  coverCid: string
  authorId: string
  createdAt: string
  progress: number
}

// 定义书架数据类型
interface BookshelfData {
  total: number
  currentPage: number
  totalPages: number
  items: BookshelfItem[]
}

// 定义阅读历史项类型
interface ReadingHistoryItem {
  id: number
  title: string
  coverCid: string
  author: string
  lastRead: string
  duration: string
}

// 定义NFT项类型
interface NftItem {
  id: number
  title: string
  image: string
  creator: string
  purchaseDate: string
  price: string
}

// 定义交易记录类型
interface TransactionItem {
  id: number
  type: string
  title: string
  amount: string
  date: string
  status: string
}

// 定义用户评论类型
interface UserComment {
  id: string
  content: string
  createdAt: string
  likes: number
  isLiked: boolean
  onChainStatus: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'MOCK_CONFIRMED'
  story: {
    id: string
    title: string
    coverCid: string
  }
  chapter: {
    id: string
    title: string
    order: number
  }
}

// 定义用户评论响应类型
interface UserCommentsResponse {
  comments: UserComment[]
  total: number
  page: number
  pageCount: number
}

// 定义用户点赞项类型
interface UserLike {
  id: string
  storyId: string
  chapterId: string
  createdAt: string
  onChainStatus: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'MOCK_CONFIRMED'
  txHash?: string
  story: {
    id: string
    title: string
    coverCid: string
  }
  chapter: {
    id: string
    title: string
    order: number
  }
}

// 定义用户点赞响应类型
interface UserLikesResponse {
  likes: UserLike[]
  total: number
  page: number
  pageCount: number
}

// 定义用户关注类型
interface UserFollowing {
  id: string
  address: string
  nickname: string
  avatar: string
  authorName: string
  isAuthor: boolean
  followedAt?: string
}

// 定义用户关注响应类型
interface UserFollowingResponse {
  following: UserFollowing[]
  total: number
  page: number
  pageCount: number
}

function SpacePageContent() {
  const [activeModule, setActiveModule] = useState('bookshelf')
  const [isLoading, setIsLoading] = useState(false)
  const [bookshelfData, setBookshelfData] = useState<BookshelfData | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const { address, isConnected } = useAccount()
  const { user, token, isAuthenticated } = useAuth()
  const router = useRouter()
  const [storyImages, setStoryImages] = useState<{ [key: string]: string }>({})
  const { openLoginModal } = useLoginModal()
  const [bookshelfError, setBookshelfError] = useState<string | null>(null)

  // 模拟NFT数据
  const MY_NFTS: NftItem[] = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    title: `NFT作品${i + 1}`,
    image: `https://picsum.photos/300/300?random=${i + 20}`,
    creator: `作家${Math.floor(Math.random() * 20) + 1}`,
    purchaseDate: new Date(Date.now() - Math.random() * 10000000000).toLocaleDateString(),
    price: (Math.random() * 10).toFixed(2)
  }))

  // 模拟交易记录数据
  const TRANSACTIONS: TransactionItem[] = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    type: Math.random() > 0.5 ? '购买作品' : '购买NFT',
    title: `${Math.random() > 0.5 ? '作品' : 'NFT'}${i + 1}`,
    amount: (Math.random() * 100).toFixed(2),
    date: new Date(Date.now() - Math.random() * 10000000000).toLocaleDateString(),
    status: Math.random() > 0.2 ? '成功' : '处理中'
  }))

  // 获取书架数据
  useEffect(() => {
    if (activeModule === 'bookshelf' && isAuthenticated) {
      fetchBookshelfData()
    }
  }, [activeModule, isAuthenticated, currentPage])

  // 获取书架数据的函数
  const fetchBookshelfData = async () => {
    if (!isAuthenticated) return
    
    try {
      setIsLoading(true)
      // 重置错误状态
      setBookshelfError(null)
      
      console.log('[空间页面] 开始获取书架数据:', {
        userId: user?.id,
        address: user?.address,
        hasToken: !!token,
        page: currentPage
      })
      
      // 构建请求参数
      const params = new URLSearchParams()
      params.append('page', currentPage.toString())
      params.append('limit', '10')
      
      // 根据登录类型添加相应的标识参数
      if (user?.address) {
        params.append('address', user.address)
      } else if (user?.id) {
        params.append('userId', user.id)
      }

      console.log('[空间页面] 请求参数:', params.toString())
      
      const response = await fetch(`/api/users/bookshelf?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      })
      
      console.log('[空间页面] 收到响应:', {
        status: response.status,
        ok: response.ok
      })
      
      // 尝试解析响应
      let data;
      
      try {
        const text = await response.text();
        console.log('[空间页面] 原始响应内容:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
        
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('[空间页面] JSON解析错误:', parseError);
          setBookshelfError('数据格式错误，请重试');
          return;
        }
      } catch (readError) {
        console.error('[空间页面] 读取响应内容错误:', readError);
        setBookshelfError('读取响应失败');
        return;
      }
      
      if (!response.ok) {
        console.error('[空间页面] 获取书架数据失败:', data);
        setBookshelfError(data?.error || '获取书架数据失败');
        return;
      }
      
      console.log('[空间页面] 获取书架数据成功:', {
        total: data.total,
        currentPage: data.currentPage,
        totalPages: data.totalPages,
        itemsLength: data.items?.length
      })
      
      setBookshelfData(data)
    } catch (error) {
      console.error('[空间页面] 获取书架数据异常:', error)
      setBookshelfError('获取书架数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 获取IPFS图片内容
  const fetchIPFSImage = async (cid: string) => {
    try {
      if (!cid || !cid.startsWith('Qm')) {
        return null;
      }
      
      console.log(`[IPFS] 开始获取图片: ${cid}`);
      
      // 检查缓存中是否已存在
      if (storyImages[cid]) {
        console.log(`[IPFS] 使用缓存图片: ${cid}`);
        return storyImages[cid];
      }
      
      const response = await fetch(`https://blue-casual-wombat-745.mypinata.cloud/ipfs/${cid}`);
      console.log(`[IPFS] 响应状态: ${response.status}`);
      
      if (!response.ok) {
        console.log(`[IPFS] 响应错误: ${response.status}`);
        return null;
      }
      
      const text = await response.text();
      console.log(`[IPFS] 获取到的内容长度: ${text.length}`);
      
      // 检查返回的内容是否已经是base64图片
      if (text.startsWith('data:image')) {
        console.log(`[IPFS] 返回的内容已经是base64图片格式`);
        
        // 缓存结果
        setStoryImages(prev => ({
          ...prev,
          [cid]: text
        }));
        
        return text;
      }
      
      // 检查是否为错误消息
      if (text.includes("The owner of this gateway") || 
          text.includes("ERR_ID") || 
          text.includes("does not have this content") ||
          !text.match(/^(\{|\[|data:image)/)) {
        console.log(`[IPFS] 返回的内容是错误消息，返回默认图片`);
        return '/images/story-default-cover.jpg';
      }
      
      // 尝试解析JSON
      try {
        const data = JSON.parse(text);
        console.log(`[IPFS] JSON解析成功:`, {
          hasContent: !!data.content,
          contentType: typeof data.content,
          contentLength: data.content?.length
        });
        
        if (data.content) {
          console.log(`[IPFS] 使用content字段作为图片内容`);
          
          // 缓存结果
          setStoryImages(prev => ({
            ...prev,
            [cid]: data.content
          }));
          
          return data.content;
        }
      } catch (jsonError) {
        console.log(`[IPFS] JSON解析失败，使用原始内容:`, jsonError);
      }
      
      // 如果都不是，返回原始内容
      console.log(`[IPFS] 使用原始内容作为图片`);
      
      // 缓存结果
      setStoryImages(prev => ({
        ...prev,
        [cid]: text
      }));
      
      return text;
    } catch (error) {
      console.error('[IPFS] 获取图片失败:', error);
      return '/images/story-default-cover.jpg';
    }
  };

  // 获取封面图片URL
  const getCoverImageUrl = (coverCid: string) => {
    if (!coverCid) return '/images/story-default-cover.jpg'
    
    // 判断是否是IPFS CID格式
    if (coverCid.startsWith('Qm') || coverCid.startsWith('baf')) {
      // 优先使用已缓存的图片
      return storyImages[coverCid] || `/images/story-default-cover.jpg`;
    }
    
    // 如果是http链接则直接返回
    if (coverCid.startsWith('http')) {
      return coverCid
    }
    
    // 如果是base64数据
    if (coverCid.startsWith('data:image')) {
      return coverCid
    }
    
    // 其他情况返回默认封面
    return '/images/story-default-cover.jpg'
  };

  // 加载故事封面图片 - 使用批量预加载策略
  useEffect(() => {
    async function loadBookCovers() {
      if (!bookshelfData?.items || bookshelfData.items.length === 0) return;
      
      console.log(`[IPFS] 需要加载 ${bookshelfData.items.length} 个封面图片`);
      
      // 优先加载当前可见的图片
      const visibleBooks = bookshelfData.items.slice(0, 8); // 先加载前8张图片
      
      console.log(`[IPFS] 开始加载可见的 ${visibleBooks.length} 个封面`);
      
      // 并行加载可见图片
      await Promise.all(
        visibleBooks
          .filter(book => book.coverCid?.startsWith('Qm'))
          .map(async book => {
            console.log(`[IPFS] 处理可见封面: ${book.coverCid}`);
            const imageContent = await fetchIPFSImage(book.coverCid);
            if (imageContent) {
              console.log(`[IPFS] 成功获取可见封面: ${book.title}`);
            } else {
              console.log(`[IPFS] 获取可见封面失败: ${book.title}`);
            }
          })
      );
      
      // 然后加载其余图片
      const remainingBooks = bookshelfData.items.slice(8);
      
      if (remainingBooks.length > 0) {
        console.log(`[IPFS] 开始后台加载剩余的 ${remainingBooks.length} 个封面`);
        
        // 使用批量处理，每批4张图片
        const batchSize = 4;
        for (let i = 0; i < remainingBooks.length; i += batchSize) {
          const batch = remainingBooks.slice(i, i + batchSize);
          
          // 并行加载当前批次
          await Promise.all(
            batch
              .filter(book => book.coverCid?.startsWith('Qm'))
              .map(async book => {
                console.log(`[IPFS] 处理后台封面: ${book.coverCid}`);
                const imageContent = await fetchIPFSImage(book.coverCid);
                if (imageContent) {
                  console.log(`[IPFS] 成功获取后台封面: ${book.title}`);
                } else {
                  console.log(`[IPFS] 获取后台封面失败: ${book.title}`);
                }
              })
          );
          
          // 每批处理后等待一小段时间，避免请求过于频繁
          if (i + batchSize < remainingBooks.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }
      
      console.log('[IPFS] 所有封面加载完成');
    }
    
    loadBookCovers();
  }, [bookshelfData]);

  // 渲染分页控件
  const renderPagination = () => {
    if (!bookshelfData || bookshelfData.totalPages <= 1) return null
    
    return (
      <div className={styles.pagination}>
        <button 
          className={styles.pageButton}
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
        >
          上一页
        </button>
        
        <span className={styles.pageInfo}>
          {currentPage} / {bookshelfData.totalPages}
        </span>
        
        <button 
          className={styles.pageButton}
          disabled={currentPage >= bookshelfData.totalPages}
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, bookshelfData.totalPages))}
        >
          下一页
        </button>
      </div>
    )
  }

  // 格式化日期函数
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // 处理书架中的取消收藏操作
  const handleBookmarkRemoved = (storyId: string) => {
    if (bookshelfData) {
      // 从当前列表中过滤掉被取消收藏的作品
      const updatedItems = bookshelfData.items.filter(item => item.storyId !== storyId);
      
      // 更新书架数据
      setBookshelfData({
        ...bookshelfData,
        items: updatedItems,
        total: bookshelfData.total - 1
      });
      
      // 如果当前页面已经没有内容，并且不是第一页，则返回上一页
      if (updatedItems.length === 0 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    }
  };

  // 添加处理登录点击的函数
  const handleLoginClick = () => {
    openLoginModal()
  }

  // 渲染未登录状态的提示界面
  const renderNotLoggedInContent = () => {
    return (
      <div className={styles.notLoggedInContainer}>
        <div className={styles.loginPrompt}>
          <FiLogIn className={styles.loginIcon} />
          <h3 className={styles.loginTitle}>登录以查看您的个人空间</h3>
          <p className={styles.loginDescription}>登录后可以查看您的书架、阅读历史和个人设置</p>
          <button 
            onClick={handleLoginClick}
            className={styles.loginButton}
          >
            立即登录
          </button>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    // 如果未登录，则根据当前选中的模块显示对应的未登录提示
    if (!isAuthenticated) {
      return renderNotLoggedInContent()
    }

    // 下面是原来的内容渲染逻辑，针对已登录用户
    switch (activeModule) {
      case 'bookshelf':
        return (
          <div className={styles.bookshelfContainer}>
            {isLoading ? (
              <div className={styles.loading}>
                <LoadingSpinner />
              </div>
            ) : bookshelfError ? (
              <div className={styles.errorCenterContainer}>
                <div className={styles.errorState}>
                  <div className={styles.errorIcon}>❌</div>
                  <h3 className={styles.errorTitle}>加载失败</h3>
                  <p>{bookshelfError}</p>
                  <button 
                    className={styles.retryButton}
                    onClick={() => fetchBookshelfData()}
                  >
                    重试
                  </button>
                </div>
              </div>
            ) : bookshelfData && bookshelfData.items && bookshelfData.items.length > 0 ? (
              <>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>
                    <div className="flex items-center gap-2">
                      <FiBookmark className="w-5 h-5 fill-blue-600 text-blue-600" />
                      我收藏的作品
                    </div>
                  </h2>
                  <p className={styles.moduleSubtitle}>探索您珍藏的文学世界</p>
                </div>
                <div className={styles.workGrid}>
                  {bookshelfData.items.map(book => (
                    <div key={book.id} className={styles.workCard}>
                      <Link href={`/stories/${book.storyId}`} className={styles.workCardLink}>
                        <div className={styles.coverWrapper}>
                          <Image
                            src={getCoverImageUrl(book.coverCid)}
                            alt={book.title}
                            width={200}
                            height={267}
                            className={styles.cover}
                          />
                          <div className={styles.progress}>
                            <div 
                              className={styles.progressBar} 
                              style={{ width: `${book.progress}%` }}
                            />
                          </div>
                        </div>
                        <div className={styles.info}>
                          <h3 className={styles.title}>{book.title}</h3>
                          <p className={styles.lastRead}>收藏于：{formatDate(book.createdAt)}</p>
                        </div>
                      </Link>
                      <div className={styles.bookmarkActions}>
                        <BookmarkButton 
                          storyId={book.storyId} 
                          variant="button"
                          showText={true}
                          className={styles.removeBookmarkButton}
                          onRemoved={() => handleBookmarkRemoved(book.storyId)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {renderPagination()}
              </>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>📚</div>
                <h3 className={styles.emptyStateTitle}>您的书架暂时为空</h3>
                <p>探索精彩作品，收藏您喜爱的故事。</p>
                <Link href="/stories" className={styles.browseLink}>
                  <span>浏览作品</span>
                  <span className={styles.browseLinkArrow}>→</span>
                </Link>
              </div>
            )}
          </div>
        )
      
      case 'history':
        return <ReadingHistorySection />;
      
      case 'comments':
        return <UserCommentSection />;
      
      case 'likes':
        return <UserLikesSection />;
      
      case 'following':
        return <UserFollowingSection />;
      
      case 'nft':
        return (
          <div className={styles.nftContainer}>
            <div className={styles.moduleHeader}>
              <h2 className={styles.moduleTitle}>我的NFT收藏</h2>
              <p className={styles.moduleSubtitle}>展示您拥有的数字艺术品</p>
            </div>
            {MY_NFTS.length > 0 ? (
              <div className={styles.nftGrid}>
                {MY_NFTS.map(nft => (
                  <Link href={`/nft-market/${nft.id}`} key={nft.id} className={styles.nftCard}>
                    <div className={styles.nftImageWrapper}>
                      <Image
                        src={nft.image as string}
                        alt={nft.title}
                        width={300}
                        height={300}
                        className={styles.nftImage}
                      />
                    </div>
                    <div className={styles.nftInfo}>
                      <h3 className={styles.nftTitle}>{nft.title}</h3>
                      <p className={styles.nftCreator}>创作者：{nft.creator}</p>
                      <p className={styles.nftMeta}>
                        购买日期：{nft.purchaseDate} · {nft.price} BNB
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>🎨</div>
                <h3 className={styles.emptyStateTitle}>暂无NFT收藏</h3>
                <p>探索NFT市场，收集独特的数字艺术品！</p>
                <Link href="/nft-market" className={styles.browseLink}>
                  <span>浏览NFT市场</span>
                  <span className={styles.browseLinkArrow}>→</span>
                </Link>
              </div>
            )}
          </div>
        )
      
      case 'transactions':
        return (
          <div className={styles.transactionsContainer}>
            <div className={styles.moduleHeader}>
              <h2 className={styles.moduleTitle}>交易记录</h2>
              <p className={styles.moduleSubtitle}>查看您的消费历史</p>
            </div>
            {TRANSACTIONS.length > 0 ? (
              <div className={styles.transactionList}>
                {TRANSACTIONS.map(transaction => (
                  <div key={transaction.id} className={styles.transactionItem}>
                    <div className={styles.transactionInfo}>
                      <h3 className={styles.transactionTitle}>{transaction.title}</h3>
                      <span className={styles.transactionType}>{transaction.type}</span>
                      <p className={styles.transactionMeta}>
                        {transaction.date} · <span className={transaction.status === '成功' ? styles.statusSuccess : styles.statusPending}>{transaction.status}</span>
                      </p>
                    </div>
                    <div className={styles.transactionAmount}>
                      {transaction.amount} BNB
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>💰</div>
                <h3 className={styles.emptyStateTitle}>暂无交易记录</h3>
                <p>购买作品或NFT后，将在此显示您的交易记录。</p>
                <Link href="/stories" className={styles.browseLink}>
                  <span>浏览作品</span>
                  <span className={styles.browseLinkArrow}>→</span>
                </Link>
              </div>
            )}
          </div>
        )
      
      // case 'settings':
      //   return (
      //     <div className={styles.settings}>
      //       <div className={styles.moduleHeader}>
      //         <h2 className={styles.moduleTitle}>个人设置</h2>
      //         <p className={styles.moduleSubtitle}>自定义您的账户和阅读偏好</p>
      //       </div>
      //       <div className={styles.settingGroup}>
      //         <h3 className={styles.settingTitle}>账户设置</h3>
      //         <div className={styles.settingItem}>
      //           <label>用户名</label>
      //           <input type="text" placeholder="设置用户名" />
      //         </div>
      //         <div className={styles.settingItem}>
      //           <label>头像</label>
      //           <button className={styles.uploadButton}>
      //             <span className={styles.uploadButtonIcon}>📷</span>
      //             <span>上传头像</span>
      //           </button>
      //         </div>
      //       </div>
      //       <div className={styles.settingGroup}>
      //         <h3 className={styles.settingTitle}>阅读设置</h3>
      //         <div className={styles.settingItem}>
      //           <label>字体大小</label>
      //           <select>
      //             <option>小</option>
      //             <option>中</option>
      //             <option>大</option>
      //           </select>
      //         </div>
      //         <div className={styles.settingItem}>
      //           <label>主题</label>
      //           <select>
      //             <option>浅色</option>
      //             <option>深色</option>
      //             <option>跟随系统</option>
      //           </select>
      //         </div>
      //       </div>
      //     </div>
      //   )
      
      default:
        return null
    }
  }

  return (
    <div className={styles.pageBackground}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>我的空间</h1>
          <p className={styles.headerDescription}>探索、收藏和管理您的数字文学资产</p>
        </div>

        <div className={styles.content}>
          {/* 侧边栏模块导航 - 始终显示，但未登录时可能会禁用某些选项或添加提示 */}
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <div className={styles.userAvatar}>
                {user?.address?.substring(0, 2) || 'TF'}
              </div>
              <div className={styles.userName}>
                {isAuthenticated 
                  ? (user?.nickname || user?.address?.substring(0, 6) + '...' + user?.address?.substring(38) || '用户')
                  : '未登录'}
              </div>
            </div>
            {SPACE_MODULES.map(module => (
              <button
                key={module.id}
                className={`${styles.moduleButton} ${activeModule === module.id ? styles.active : ''}`}
                onClick={() => setActiveModule(module.id)}
              >
                <span className={styles.moduleIcon}>{module.icon}</span>
                {module.name}
              </button>
            ))}
          </div>

          {/* 主内容区域 */}
          <div className={styles.mainContent}>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

// 添加阅读历史区域组件
function ReadingHistorySection() {
  const { historyData, isLoading, error, currentPage, fetchReadingHistory } = useReadingHistory();
  const [storyImages, setStoryImages] = useState<{ [key: string]: string }>({});

  // 获取IPFS图片内容 - 使用useCallback缓存函数引用
  const fetchIPFSImage = useCallback(async (cid: string) => {
    try {
      if (!cid || !cid.startsWith('Qm')) {
        return null;
      }
      
      console.log(`[IPFS] 开始获取图片: ${cid}`);
      
      // 检查缓存中是否已存在
      if (storyImages[cid]) {
        console.log(`[IPFS] 使用缓存图片: ${cid}`);
        return storyImages[cid];
      }
      
      const response = await fetch(`https://blue-casual-wombat-745.mypinata.cloud/ipfs/${cid}`);
      console.log(`[IPFS] 响应状态: ${response.status}`);
      
      if (!response.ok) {
        console.log(`[IPFS] 响应错误: ${response.status}`);
        return null;
      }
      
      const text = await response.text();
      console.log(`[IPFS] 获取到的内容长度: ${text.length}`);
      
      // 检查返回的内容是否已经是base64图片
      if (text.startsWith('data:image')) {
        console.log(`[IPFS] 返回的内容已经是base64图片格式`);
        
        // 缓存结果
        setStoryImages(prev => ({
          ...prev,
          [cid]: text
        }));
        
        return text;
      }
      
      // 检查是否为错误消息
      if (text.includes("The owner of this gateway") || 
          text.includes("ERR_ID") || 
          text.includes("does not have this content") ||
          !text.match(/^(\{|\[|data:image)/)) {
        console.log(`[IPFS] 返回的内容是错误消息，返回默认图片`);
        return '/images/story-default-cover.jpg';
      }
      
      // 尝试解析JSON
      try {
        const data = JSON.parse(text);
        console.log(`[IPFS] JSON解析成功:`, {
          hasContent: !!data.content,
          contentType: typeof data.content,
          contentLength: data.content?.length
        });
        
        if (data.content) {
          console.log(`[IPFS] 使用content字段作为图片内容`);
          
          // 缓存结果
          setStoryImages(prev => ({
            ...prev,
            [cid]: data.content
          }));
          
          return data.content;
        }
      } catch (jsonError) {
        console.log(`[IPFS] JSON解析失败，使用原始内容:`, jsonError);
      }
      
      // 如果都不是，返回原始内容
      console.log(`[IPFS] 使用原始内容作为图片`);
      
      // 缓存结果
      setStoryImages(prev => ({
        ...prev,
        [cid]: text
      }));
      
      return text;
    } catch (error) {
      console.error('[IPFS] 获取图片失败:', error);
      return '/images/story-default-cover.jpg';
    }
  }, [storyImages]);

  // 获取封面图片URL
  const getCoverImageUrl = (coverCid: string) => {
    if (!coverCid) return '/images/story-default-cover.jpg'
    
    // 判断是否是IPFS CID格式
    if (coverCid.startsWith('Qm') || coverCid.startsWith('baf')) {
      // 优先使用已缓存的图片
      return storyImages[coverCid] || `/images/story-default-cover.jpg`;
    }
    
    // 如果是http链接则直接返回
    if (coverCid.startsWith('http')) {
      return coverCid
    }
    
    // 如果是base64数据
    if (coverCid.startsWith('data:image')) {
      return coverCid
    }
    
    // 其他情况返回默认封面
    return '/images/story-default-cover.jpg'
  };

  // 格式化日期，显示更友好的格式
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // 今天，显示几小时前
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 0 ? '刚刚' : `${diffMinutes}分钟前`;
      }
      return `${diffHours}小时前`;
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  // 渲染分页控件
  const renderPagination = () => {
    if (!historyData || historyData.totalPages <= 1) return null
    
    return (
      <div className={styles.pagination}>
        <button 
          className={styles.pageButton}
          disabled={currentPage === 1}
          onClick={() => fetchReadingHistory(Math.max(currentPage - 1, 1))}
        >
          上一页
        </button>
        
        <span className={styles.pageInfo}>
          {currentPage} / {historyData.totalPages}
        </span>
        
        <button 
          className={styles.pageButton}
          disabled={currentPage >= historyData.totalPages}
          onClick={() => fetchReadingHistory(Math.min(currentPage + 1, historyData.totalPages))}
        >
          下一页
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorCenterContainer}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>❌</div>
          <h3 className={styles.errorTitle}>加载失败</h3>
          <p>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => fetchReadingHistory(currentPage)}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.historyContainer}>
      <div className={styles.moduleHeader}>
        <h2 className={styles.moduleTitle}>
          <div className="flex items-center gap-2">
            <FiBook className="inline mr-1" />
            阅读历史
          </div>
        </h2>
        <p className={styles.moduleSubtitle}>回顾您最近阅读的故事</p>
      </div>
      
      {historyData && historyData.items && historyData.items.length > 0 ? (
        <>
          <div className={styles.historyGrid}>
            {historyData.items.map(item => (
              <div key={item.id} className={styles.historyCard}>
                <Link href={`/stories/${item.storyId}`} className={styles.historyCardLink}>
                  <div className={styles.historyCoverWrapper}>
                    <Image
                      src={getCoverImageUrl(item.coverCid)}
                      alt={item.title}
                      width={150}
                      height={225}
                      className={styles.historyCover}
                    />
                    <div className={styles.readingProgress}>
                      <div 
                        className={styles.progressBar}
                        style={{ width: `${(item as any).progress ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <div className={styles.historyInfo}>
                    <h3 className={styles.historyTitle}>{item.title}</h3>
                    <p className={styles.historyAuthor}>{item.author}</p>
                    <div className={styles.historyMeta}>
                      <span className={styles.lastReadTime}>
                        <FiClock className="inline mr-1" />
                        {formatDate(item.lastRead)}
                      </span>
                      <span className={styles.progressText}>
                        已读: {(item as any).progress ?? 0}%
                      </span>
                    </div>
                  </div>
                </Link>
                <div className={styles.historyActions}>
                  <Link 
                    href={`/stories/${item.storyId}/read?chapter=${item.lastChapterOrder}`} 
                    className={styles.continueButton}
                  >
                    继续阅读
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {renderPagination()}
        </>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>📖</div>
          <h3 className={styles.emptyStateTitle}>暂无阅读记录</h3>
          <p>开始阅读，探索精彩的故事世界！</p>
          <Link href="/stories" className={styles.browseLink}>
            <span>开始阅读</span>
            <span className={styles.browseLinkArrow}>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}

// 添加用户评论历史组件
function UserCommentSection() {
  const { user, token, isAuthenticated } = useAuth()
  const [comments, setComments] = useState<UserComment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalComments, setTotalComments] = useState(0)
  const [storyImages, setStoryImages] = useState<{ [key: string]: string }>({})

  // 请求用户的评论历史
  useEffect(() => {
    if (!isAuthenticated) return

    const fetchUserComments = async () => {
      setLoading(true)
      setError(null)
      
      try {
        console.log('[用户评论历史] 开始获取用户评论数据:', {
          userId: user?.id,
          address: user?.address,
          hasToken: !!token,
          page
        })
        
        // 构建请求参数
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('limit', '10')
        
        // 根据登录类型添加相应的标识参数
        if (user?.address) {
          params.append('address', user.address)
        } else if (user?.id) {
          params.append('userId', user.id)
        }
        
        const response = await fetch(`/api/users/comments?${params.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '获取评论数据失败')
        }
        
        const data: UserCommentsResponse = await response.json()
        
        console.log('[用户评论历史] 获取评论数据成功:', {
          totalComments: data.total,
          commentsCount: data.comments.length,
          page: data.page,
          pageCount: data.pageCount
        })
        
        setComments(data.comments)
        setTotalPages(data.pageCount)
        setTotalComments(data.total)
      } catch (err) {
        console.error('[用户评论历史] 获取评论数据失败:', err)
        setError(err instanceof Error ? err.message : '获取评论数据失败')
      } finally {
        setLoading(false)
      }
    }
    
    fetchUserComments()
  }, [user, token, isAuthenticated, page])

  // 点赞处理函数
  const handleLike = async (commentId: string) => {
    if (!isAuthenticated) {
      return
    }
    
    try {
      // 找到当前评论并更新界面状态（乐观更新）
      const updatedComments = comments.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            isLiked: !comment.isLiked,
            likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1
          }
        }
        return comment
      })
      
      setComments(updatedComments)
      
      // 找到当前评论的状态，决定请求类型
      const comment = comments.find(c => c.id === commentId)
      
      if (!comment) return
      
      const endpoint = `/api/stories/${comment.story.id}/chapters/${comment.chapter.id}/comments/${commentId}/${comment.isLiked ? 'unlike' : 'like'}`
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          userId: user?.id,
          address: user?.address
        })
      })
      
      if (!response.ok) {
        // 如果请求失败，回滚状态
        setComments(comments)
        const errorData = await response.json()
        throw new Error(errorData.error || '操作失败')
      }
    } catch (err) {
      console.error('[点赞操作] 失败:', err)
    }
  }

  // 获取IPFS图片内容
  const fetchIPFSImage = useCallback(async (cid: string) => {
    try {
      if (!cid || !cid.startsWith('Qm')) {
        return null;
      }
      
      // 检查缓存中是否已存在
      if (storyImages[cid]) {
        return storyImages[cid];
      }
      
      const response = await fetch(`https://blue-casual-wombat-745.mypinata.cloud/ipfs/${cid}`);
      
      if (!response.ok) {
        return null;
      }
      
      const text = await response.text();
      
      // 检查返回的内容是否已经是base64图片
      if (text.startsWith('data:image')) {
        // 缓存结果
        setStoryImages(prev => ({
          ...prev,
          [cid]: text
        }));
        
        return text;
      }
      
      // 检查是否为错误消息
      if (text.includes("The owner of this gateway") || 
          text.includes("ERR_ID") || 
          text.includes("does not have this content") ||
          !text.match(/^(\{|\[|data:image)/)) {
        return '/images/story-default-cover.jpg';
      }
      
      // 尝试解析JSON
      try {
        const data = JSON.parse(text);
        
        if (data.content) {
          // 缓存结果
          setStoryImages(prev => ({
            ...prev,
            [cid]: data.content
          }));
          
          return data.content;
        }
      } catch (jsonError) {
        console.log(`[IPFS] JSON解析失败，使用原始内容:`, jsonError);
      }
      
      // 如果都不是，返回原始内容
      // 缓存结果
      setStoryImages(prev => ({
        ...prev,
        [cid]: text
      }));
      
      return text;
    } catch (error) {
      console.error('[IPFS] 获取图片失败:', error);
      return '/images/story-default-cover.jpg';
    }
  }, [storyImages]);

  // 格式化时间函数
  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      
      // 小于1分钟
      if (diff < 60000) {
        return '刚刚'
      }
      // 小于1小时
      if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`
      }
      // 小于24小时
      if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}小时前`
      }
      // 小于30天
      if (diff < 2592000000) {
        return `${Math.floor(diff / 86400000)}天前`
      }
      // 大于30天，显示具体日期
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch (error) {
      console.error('日期格式化错误:', error)
      return '未知时间'
    }
  }

  // 获取封面图片地址
  const getCoverImageUrl = (coverCid: string) => {
    if (!coverCid) {
      return '/images/story-default-cover.jpg'
    }
    
    if (coverCid.startsWith('http') || coverCid.startsWith('/')) {
      return coverCid
    }
    
    if (coverCid.startsWith('Qm')) {
      return storyImages[coverCid] || '/images/story-default-cover.jpg'
    }
    
    return '/images/story-default-cover.jpg'
  }

  // 构建评论链接
  const getCommentLink = (storyId: string, chapterId: string) => {
    return `/stories/${storyId}/chapters/${chapterId}?comments=open`
  }

  // 渲染分页控件
  const renderPagination = () => {
    if (totalPages <= 1) return null
    
    return (
      <div className={styles.pagination}>
        <button 
          className={styles.pageButton}
          disabled={page === 1}
          onClick={() => setPage(page => Math.max(1, page - 1))}
        >
          上一页
        </button>
        
        <span className={styles.pageInfo}>
          {page} / {totalPages}
        </span>
        
        <button 
          className={styles.pageButton}
          disabled={page === totalPages}
          onClick={() => setPage(page => Math.min(totalPages, page + 1))}
        >
          下一页
        </button>
      </div>
    )
  }

  // 渲染评论状态标志
  const renderStatusBadge = (status: string) => {
    if (status === 'CONFIRMED') {
      return <span className={`${styles.statusBadge} ${styles.confirmed}`} title="已上链">已上链</span>
    }
    if (status === 'PENDING') {
      return <span className={`${styles.statusBadge} ${styles.pending}`} title="等待上链">待上链</span>
    }
    if (status === 'MOCK_CONFIRMED') {
      return <span className={`${styles.statusBadge} ${styles.mock}`} title="模拟上链">模拟上链</span>
    }
    if (status === 'FAILED') {
      return <span className={`${styles.statusBadge} ${styles.failed}`} title="上链失败">上链失败</span>
    }
    return null
  }

  // 加载封面图片
  useEffect(() => {
    if (!comments || comments.length === 0) return;
    
    const loadCovers = async () => {
      const promises = comments
        .filter(comment => comment.story.coverCid?.startsWith('Qm'))
        .map(comment => fetchIPFSImage(comment.story.coverCid));
      
      await Promise.all(promises);
    };
    
    loadCovers();
  }, [comments, fetchIPFSImage]);

  if (loading && comments.length === 0) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
        <p>加载评论历史中...</p>
      </div>
    );
  }

  if (error && comments.length === 0) {
    return (
      <div className={styles.errorCenterContainer}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>❌</div>
          <h3 className={styles.errorTitle}>加载失败</h3>
          <p>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => setPage(1)}
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>💬</div>
        <h3 className={styles.emptyStateTitle}>您还没有发表过评论</h3>
        <p>探索作品并发表您的见解，与其他读者互动！</p>
        <Link href="/stories" className={styles.browseLink}>
          <span>浏览作品</span>
          <span className={styles.browseLinkArrow}>→</span>
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.commentsContainer}>
      <div className={styles.moduleHeader}>
        <h2 className={styles.moduleTitle}>
          <div className="flex items-center gap-2">
            <span className={styles.moduleIcon}>💬</span>
            我的评论
          </div>
        </h2>
        <p className={styles.moduleSubtitle}>共 {totalComments} 条评论</p>
      </div>
      
      <div className={styles.commentsList}>
        {comments.map(comment => (
          <div key={comment.id} className={styles.commentItem}>
            <div className={styles.commentMeta}>
              <div className={styles.storyInfo}>
                <div className={styles.storyCover}>
                  <Image 
                    src={getCoverImageUrl(comment.story.coverCid)}
                    alt={comment.story.title}
                    width={60}
                    height={80}
                    className={styles.coverImage}
                    unoptimized
                  />
                </div>
                <div className={styles.storyDetails}>
                  <Link href={`/stories/${comment.story.id}`} className={styles.storyTitle}>
                    {comment.story.title}
                  </Link>
                  <div className={styles.chapterInfo}>
                    第 {comment.chapter.order} 章: {comment.chapter.title}
                  </div>
                  <div className={styles.commentTime}>
                    <IoTimeOutline size={14} />
                    <span>{formatTime(comment.createdAt)}</span>
                    {renderStatusBadge(comment.onChainStatus)}
                  </div>
                </div>
              </div>
            </div>
            
            <div className={styles.commentContent}>
              <p>{comment.content}</p>
            </div>
            
            <div className={styles.commentActions}>
              <button 
                className={`${styles.likeButton} ${comment.isLiked ? styles.liked : ''}`}
                onClick={() => handleLike(comment.id)}
              >
                {comment.isLiked ? <IoHeart /> : <IoHeartOutline />}
                <span>{comment.likes}</span>
              </button>
              
              <Link 
                href={getCommentLink(comment.story.id, comment.chapter.id)} 
                className={styles.viewButton}
              >
                <span>查看详情</span>
                <IoChevronForward />
              </Link>
            </div>
          </div>
        ))}
      </div>
      
      {renderPagination()}
    </div>
  )
}

// 添加用户点赞组件
function UserLikesSection() {
  const { user, token, isAuthenticated } = useAuth()
  const [likes, setLikes] = useState<UserLike[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLikes, setTotalLikes] = useState(0)
  const [storyImages, setStoryImages] = useState<{ [key: string]: string }>({})

  // 请求用户的点赞历史
  useEffect(() => {
    if (!isAuthenticated) return

    const fetchUserLikes = async () => {
      setLoading(true)
      setError(null)
      
      try {
        console.log('[用户点赞历史] 开始获取用户点赞数据:', {
          userId: user?.id,
          address: user?.address,
          hasToken: !!token,
          page
        })
        
        // 构建请求参数
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('limit', '10')
        
        // 根据登录类型添加相应的标识参数
        if (user?.address) {
          params.append('address', user.address)
        } else if (user?.id) {
          params.append('userId', user.id)
        }
        
        const response = await fetch(`/api/users/likes?${params.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '获取点赞数据失败')
        }
        
        const data: UserLikesResponse = await response.json()
        
        console.log('[用户点赞历史] 获取点赞数据成功:', {
          totalLikes: data.total,
          likesCount: data.likes.length,
          page: data.page,
          pageCount: data.pageCount
        })
        
        setLikes(data.likes)
        setTotalPages(data.pageCount)
        setTotalLikes(data.total)
      } catch (err) {
        console.error('[用户点赞历史] 获取点赞数据失败:', err)
        setError(err instanceof Error ? err.message : '获取点赞数据失败')
      } finally {
        setLoading(false)
      }
    }
    
    fetchUserLikes()
  }, [user, token, isAuthenticated, page])

  // 取消点赞处理函数
  const handleUnlike = async (storyId: string, chapterId: string, likeId: string) => {
    if (!isAuthenticated) {
      return
    }
    
    try {
      // 找到当前点赞并从列表中移除（乐观更新）
      const updatedLikes = likes.filter(like => like.id !== likeId)
      setLikes(updatedLikes)
      setTotalLikes(prev => prev - 1)
      
      // 发送取消点赞请求
      const endpoint = `/api/stories/${storyId}/chapters/${chapterId}/unlike`
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          userId: user?.id,
          address: user?.address
        })
      })
      
      if (!response.ok) {
        // 如果请求失败，恢复列表状态
        const errorData = await response.json()
        console.error('[取消点赞] 失败:', errorData)
        
        // 重新加载数据
        fetchUserLikes()
        
        toast.error('取消点赞失败，请重试')
      } else {
        toast.success('已取消点赞')
      }
    } catch (err) {
      console.error('[取消点赞] 失败:', err)
      toast.error('操作失败，请重试')
      
      // 重新加载数据
      fetchUserLikes()
    }
  }

  // 获取IPFS图片内容
  const fetchIPFSImage = useCallback(async (cid: string) => {
    try {
      if (!cid || !cid.startsWith('Qm')) {
        return null;
      }
      
      // 检查缓存中是否已存在
      if (storyImages[cid]) {
        return storyImages[cid];
      }
      
      const response = await fetch(`https://blue-casual-wombat-745.mypinata.cloud/ipfs/${cid}`);
      
      if (!response.ok) {
        return null;
      }
      
      const text = await response.text();
      
      // 检查返回的内容是否已经是base64图片
      if (text.startsWith('data:image')) {
        // 缓存结果
        setStoryImages(prev => ({
          ...prev,
          [cid]: text
        }));
        
        return text;
      }
      
      // 检查是否为错误消息
      if (text.includes("The owner of this gateway") || 
          text.includes("ERR_ID") || 
          text.includes("does not have this content") ||
          !text.match(/^(\{|\[|data:image)/)) {
        return '/images/story-default-cover.jpg';
      }
      
      // 尝试解析JSON
      try {
        const data = JSON.parse(text);
        
        if (data.content) {
          // 缓存结果
          setStoryImages(prev => ({
            ...prev,
            [cid]: data.content
          }));
          
          return data.content;
        }
      } catch (jsonError) {
        console.log(`[IPFS] JSON解析失败，使用原始内容:`, jsonError);
      }
      
      // 如果都不是，返回原始内容
      // 缓存结果
      setStoryImages(prev => ({
        ...prev,
        [cid]: text
      }));
      
      return text;
    } catch (error) {
      console.error('[IPFS] 获取图片失败:', error);
      return '/images/story-default-cover.jpg';
    }
  }, [storyImages]);

  // 格式化时间函数
  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      
      // 小于1分钟
      if (diff < 60000) {
        return '刚刚'
      }
      // 小于1小时
      if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`
      }
      // 小于24小时
      if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}小时前`
      }
      // 小于30天
      if (diff < 2592000000) {
        return `${Math.floor(diff / 86400000)}天前`
      }
      // 大于30天，显示具体日期
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch (error) {
      console.error('日期格式化错误:', error)
      return '未知时间'
    }
  }

  // 获取封面图片地址
  const getCoverImageUrl = (coverCid: string) => {
    if (!coverCid) {
      return '/images/story-default-cover.jpg'
    }
    
    if (coverCid.startsWith('http') || coverCid.startsWith('/')) {
      return coverCid
    }
    
    if (coverCid.startsWith('Qm')) {
      return storyImages[coverCid] || '/images/story-default-cover.jpg'
    }
    
    return '/images/story-default-cover.jpg'
  }

  // 构建故事链接
  const getStoryLink = (storyId: string, chapterId: string) => {
    return `/stories/${storyId}/chapters/${chapterId}`
  }

  // 渲染分页控件
  const renderPagination = () => {
    if (totalPages <= 1) return null
    
    return (
      <div className={styles.pagination}>
        <button 
          className={styles.pageButton}
          disabled={page === 1}
          onClick={() => setPage(page => Math.max(1, page - 1))}
        >
          上一页
        </button>
        
        <span className={styles.pageInfo}>
          {page} / {totalPages}
        </span>
        
        <button 
          className={styles.pageButton}
          disabled={page === totalPages}
          onClick={() => setPage(page => Math.min(totalPages, page + 1))}
        >
          下一页
        </button>
      </div>
    )
  }

  // 渲染上链状态标志
  const renderStatusBadge = (status: string) => {
    if (status === 'CONFIRMED') {
      return <span className={`${styles.statusBadge} ${styles.confirmed}`} title="已上链">已上链</span>
    }
    if (status === 'PENDING') {
      return <span className={`${styles.statusBadge} ${styles.pending}`} title="等待上链">待上链</span>
    }
    if (status === 'MOCK_CONFIRMED') {
      return <span className={`${styles.statusBadge} ${styles.mock}`} title="模拟上链">模拟上链</span>
    }
    if (status === 'FAILED') {
      return <span className={`${styles.statusBadge} ${styles.failed}`} title="上链失败">上链失败</span>
    }
    return null
  }

  // 加载封面图片
  useEffect(() => {
    if (!likes || likes.length === 0) return;
    
    const loadCovers = async () => {
      const promises = likes
        .filter(like => like.story.coverCid?.startsWith('Qm'))
        .map(like => fetchIPFSImage(like.story.coverCid));
      
      await Promise.all(promises);
    };
    
    loadCovers();
  }, [likes, fetchIPFSImage]);

  // 重新获取用户点赞数据
  const fetchUserLikes = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // 构建请求参数
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      
      // 根据登录类型添加相应的标识参数
      if (user?.address) {
        params.append('address', user.address)
      } else if (user?.id) {
        params.append('userId', user.id)
      }
      
      const response = await fetch(`/api/users/likes?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '获取点赞数据失败')
      }
      
      const data: UserLikesResponse = await response.json()
      
      setLikes(data.likes)
      setTotalPages(data.pageCount)
      setTotalLikes(data.total)
    } catch (err) {
      console.error('[用户点赞历史] 获取点赞数据失败:', err)
      setError(err instanceof Error ? err.message : '获取点赞数据失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading && likes.length === 0) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
        <p>加载点赞历史中...</p>
      </div>
    );
  }

  if (error && likes.length === 0) {
    return (
      <div className={styles.errorCenterContainer}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>❌</div>
          <h3 className={styles.errorTitle}>加载失败</h3>
          <p>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => setPage(1)}
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  if (likes.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>👍</div>
        <h3 className={styles.emptyStateTitle}>您还没有点赞过任何内容</h3>
        <p>探索作品并点赞您喜爱的内容，表达您的喜好！</p>
        <Link href="/stories" className={styles.browseLink}>
          <span>浏览作品</span>
          <span className={styles.browseLinkArrow}>→</span>
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.likesContainer}>
      <div className={styles.moduleHeader}>
        <h2 className={styles.moduleTitle}>
          <div className="flex items-center gap-2">
            <IoHeart className="inline mr-1 text-rose-500" />
            我的点赞
          </div>
        </h2>
        <p className={styles.moduleSubtitle}>共 {totalLikes} 个点赞</p>
      </div>
      
      <div className={styles.likesList}>
        {likes.map(like => (
          <div key={like.id} className={styles.likeItem}>
            <div className={styles.likeMeta}>
              <div className={styles.storyInfo}>
                <div className={styles.storyCover}>
                  <Image 
                    src={getCoverImageUrl(like.story.coverCid)}
                    alt={like.story.title}
                    width={60}
                    height={80}
                    className={styles.coverImage}
                    unoptimized
                  />
                </div>
                <div className={styles.storyDetails}>
                  <Link href={`/stories/${like.storyId}`} className={styles.storyTitle}>
                    {like.story.title}
                  </Link>
                  <div className={styles.chapterInfo}>
                    {like.chapter ? `第 ${like.chapter.order} 章: ${like.chapter.title}` : '整本作品'}
                  </div>
                  <div className={styles.likeTime}>
                    <IoTimeOutline size={14} />
                    <span>{formatTime(like.createdAt)}</span>
                    {renderStatusBadge(like.onChainStatus)}
                  </div>
                </div>
              </div>
            </div>
            
            <div className={styles.likeActions}>
              <button 
                className={styles.unlikeButton}
                onClick={() => handleUnlike(like.storyId, like.chapterId, like.id)}
                title="取消点赞"
              >
                <IoHeart className="text-rose-500" />
                <span>取消</span>
              </button>
              
              <Link 
                href={getStoryLink(like.storyId, like.chapterId)} 
                className={styles.viewButton}
              >
                <span>查看详情</span>
                <IoChevronForward />
              </Link>
            </div>
          </div>
        ))}
      </div>
      
      {renderPagination()}
    </div>
  )
}

// 添加用户关注组件
function UserFollowingSection() {
  const { user, token, isAuthenticated } = useAuth()
  const [following, setFollowing] = useState<UserFollowing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalFollowing, setTotalFollowing] = useState(0)

  // 请求用户的关注列表
  useEffect(() => {
    if (!isAuthenticated) return

    const fetchUserFollowing = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const traceId = Math.random().toString(36).substring(2, 8);
        console.log(`[${traceId}][用户关注列表-组件] 开始获取用户关注数据:`, {
          userId: user?.id,
          address: user?.address,
          hasToken: !!token,
          page,
          isAuthenticated
        })
        
        // 构建请求参数
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('limit', '10')
        
        // 根据登录类型添加相应的标识参数
        if (user?.address) {
          params.append('address', user.address)
        } else if (user?.id) {
          params.append('userId', user.id)
        }
        
        const requestUrl = `/api/users/following?${params.toString()}`;
        console.log(`[${traceId}][用户关注列表-组件] 请求URL:`, {
          url: requestUrl,
          params: params.toString(),
          hasUserId: !!user?.id,
          hasAddress: !!user?.address
        });
        
        console.log(`[${traceId}][用户关注列表-组件] 请求头:`, {
          hasToken: !!token,
          tokenLength: token?.length,
          contentType: 'application/json'
        });
        
        const response = await fetch(requestUrl, {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        })
        
        console.log(`[${traceId}][用户关注列表-组件] 收到响应:`, {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
          headers: {
            contentType: response.headers.get('content-type')
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[${traceId}][用户关注列表-组件] 响应错误原始内容:`, errorText.substring(0, 200));
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
            console.error(`[${traceId}][用户关注列表-组件] 响应错误:`, errorData);
          } catch (parseError) {
            console.error(`[${traceId}][用户关注列表-组件] 解析错误响应失败:`, parseError);
            throw new Error('获取关注数据失败: 无法解析响应');
          }
          
          throw new Error(errorData.error || '获取关注数据失败')
        }
        
        const responseText = await response.text();
        console.log(`[${traceId}][用户关注列表-组件] 响应内容片段:`, responseText.substring(0, 200));
        
        let data: UserFollowingResponse;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`[${traceId}][用户关注列表-组件] 解析响应数据失败:`, parseError);
          throw new Error('解析响应数据失败');
        }
        
        console.log(`[${traceId}][用户关注列表-组件] 获取关注数据成功:`, {
          totalFollowing: data.total,
          followingCount: data.following?.length || 0,
          page: data.page,
          pageCount: data.pageCount,
          dataKeys: Object.keys(data),
          hasFollowingArray: Array.isArray(data.following)
        })
        
        if (!Array.isArray(data.following)) {
          console.error(`[${traceId}][用户关注列表-组件] 响应数据格式错误:`, {
            followingType: typeof data.following,
            following: data.following
          });
          throw new Error('响应数据格式错误: following不是数组');
        }
        
        setFollowing(data.following)
        setTotalPages(data.pageCount)
        setTotalFollowing(data.total)
      } catch (err) {
        console.error('[用户关注列表-组件] 获取关注数据失败:', err)
        setError(err instanceof Error ? err.message : '获取关注数据失败')
      } finally {
        setLoading(false)
      }
    }
    
    fetchUserFollowing()
  }, [user, token, isAuthenticated, page])

  // 取消关注处理函数
  const handleUnfollow = async (authorId: string) => {
    if (!isAuthenticated) {
      return
    }
    
    try {
      console.log('[取消关注] 开始处理:', {
        authorId,
        userId: user?.id,
        address: user?.address
      });
      
      // 找到当前关注的作者并从列表中移除（乐观更新）
      const updatedFollowing = following.filter(follow => follow.id !== authorId)
      setFollowing(updatedFollowing)
      setTotalFollowing(prev => prev - 1)
      
      // 发送取消关注请求 - 使用正确的API路径和参数
      const apiUrl = `/api/users/following`;
      console.log('[取消关注] 请求API:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          userId: user?.id,
          authorId: authorId
        })
      })
      
      console.log('[取消关注] 收到响应:', {
        status: response.status,
        ok: response.ok
      });
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('[取消关注] 响应错误:', errorData);
        
        // 恢复原来的关注列表（撤销乐观更新）
        fetchUserFollowing()
        toast.error(errorData.error || '取消关注失败')
        return
      }
      
      console.log('[取消关注] 取消关注成功');
      toast.success('已取消关注')
    } catch (error) {
      console.error('[取消关注] 异常:', error)
      toast.error('取消关注失败')
      // 出错时恢复原有数据
      fetchUserFollowing()
    }
  }

  // 格式化时间函数
  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      
      // 小于1分钟
      if (diff < 60000) {
        return '刚刚'
      }
      // 小于1小时
      if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`
      }
      // 小于24小时
      if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}小时前`
      }
      // 小于30天
      if (diff < 2592000000) {
        return `${Math.floor(diff / 86400000)}天前`
      }
      // 大于30天，显示具体日期
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch (error) {
      console.error('日期格式化错误:', error)
      return '未知时间'
    }
  }

  // 渲染分页控件
  const renderPagination = () => {
    if (totalPages <= 1) return null
    
    return (
      <div className={styles.pagination}>
        <button 
          className={styles.pageButton}
          disabled={page === 1}
          onClick={() => setPage(page => Math.max(1, page - 1))}
        >
          上一页
        </button>
        
        <span className={styles.pageInfo}>
          {page} / {totalPages}
        </span>
        
        <button 
          className={styles.pageButton}
          disabled={page === totalPages}
          onClick={() => setPage(page => Math.min(totalPages, page + 1))}
        >
          下一页
        </button>
      </div>
    )
  }

  // 修改重新获取用户关注数据的函数
  const fetchUserFollowing = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const traceId = Math.random().toString(36).substring(2, 8);
      console.log(`[${traceId}][用户关注列表-刷新] 开始获取数据:`, {
        userId: user?.id,
        address: user?.address,
        page,
        isAuthenticated
      });
      
      // 构建请求参数
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      
      // 根据登录类型添加相应的标识参数
      if (user?.address) {
        params.append('address', user.address)
      } else if (user?.id) {
        params.append('userId', user.id)
      }
      
      const requestUrl = `/api/users/following?${params.toString()}`;
      console.log(`[${traceId}][用户关注列表-刷新] 请求URL:`, {
        url: requestUrl,
        params: params.toString()
      });
      
      const response = await fetch(requestUrl, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      })
      
      console.log(`[${traceId}][用户关注列表-刷新] 收到响应:`, {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${traceId}][用户关注列表-刷新] 响应错误原始内容:`, errorText.substring(0, 200));
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
          console.error(`[${traceId}][用户关注列表-刷新] 响应错误:`, errorData);
        } catch (parseError) {
          console.error(`[${traceId}][用户关注列表-刷新] 解析错误响应失败:`, parseError);
          throw new Error('获取关注数据失败: 无法解析响应');
        }
        
        throw new Error(errorData.error || '获取关注数据失败')
      }
      
      const responseText = await response.text();
      let data: UserFollowingResponse;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[${traceId}][用户关注列表-刷新] 解析响应数据失败:`, parseError);
        throw new Error('解析响应数据失败');
      }
      
      console.log(`[${traceId}][用户关注列表-刷新] 获取数据成功:`, {
        totalFollowing: data.total,
        followingCount: data.following?.length || 0,
        page: data.page,
        pageCount: data.pageCount,
        dataKeys: Object.keys(data)
      });
      
      setFollowing(data.following)
      setTotalPages(data.pageCount)
      setTotalFollowing(data.total)
    } catch (err) {
      console.error('[用户关注列表-刷新] 获取数据失败:', err)
      setError(err instanceof Error ? err.message : '获取关注数据失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading && following.length === 0) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
        <p>加载关注列表中...</p>
      </div>
    );
  }

  if (error && following.length === 0) {
    return (
      <div className={styles.errorCenterContainer}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>❌</div>
          <h3 className={styles.errorTitle}>加载失败</h3>
          <p>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => setPage(1)}
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  if (following.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>👀</div>
        <h3 className={styles.emptyStateTitle}>您还没有关注任何作者</h3>
        <p>探索并关注您喜爱的作者，及时获取他们的最新作品！</p>
        <Link href="/stories" className={styles.browseLink}>
          <span>探索作者</span>
          <span className={styles.browseLinkArrow}>→</span>
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.followingContainer}>
      <div className={styles.moduleHeader}>
        <h2 className={styles.moduleTitle}>
          <div className="flex items-center gap-2">
            <span className={styles.moduleIcon}>👀</span>
            我的关注
          </div>
        </h2>
        <p className={styles.moduleSubtitle}>共关注 {totalFollowing} 位作者</p>
      </div>
      
      <div className={styles.followingList}>
        {following.map(author => (
          <div key={author.id} className={styles.followingItem}>
            <div className={styles.authorInfo}>
              <div className={styles.authorAvatar}>
                {author.avatar ? (
                  <Image 
                    src={author.avatar}
                    alt={author.authorName || author.nickname || '作者'}
                    width={60}
                    height={60}
                    className={styles.avatarImage}
                    unoptimized
                  />
                ) : (
                  <div className={styles.defaultAvatar}>
                    {(author.authorName || author.nickname || 'A')[0].toUpperCase()}
                  </div>
                )}
              </div>
              
              <div className={styles.authorDetails}>
                <Link href={`/author/${author.address}`} className={styles.authorName}>
                  {author.authorName || author.nickname || author.address.substring(0, 6) + '...' + author.address.substring(38)}
                </Link>
                {author.isAuthor && (
                  <span className={styles.authorBadge}>作者</span>
                )}
                <div className={styles.followTime}>
                  <IoTimeOutline size={14} />
                  <span>关注于 {author.followedAt ? formatTime(author.followedAt) : '未知时间'}</span>
                </div>
              </div>
            </div>
            
            <div className={styles.followingActions}>
              <button 
                className={styles.unfollowButton}
                onClick={() => handleUnfollow(author.id)}
                title="取消关注"
              >
                <span>取消关注</span>
              </button>
              
              <Link 
                href={`/author/${author.address}`} 
                className={styles.viewAuthorButton}
              >
                <span>查看作品</span>
                <IoChevronForward />
              </Link>
            </div>
          </div>
        ))}
      </div>
      
      {renderPagination()}
    </div>
  )
}

// 使用 dynamic 导入并禁用 SSR
const SpacePage = dynamic(() => Promise.resolve(SpacePageContent) as any, {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner />
    </div>
  )
})

// @ts-ignore
export default SpacePage 