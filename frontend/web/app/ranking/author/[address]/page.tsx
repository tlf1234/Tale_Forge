'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import Link from 'next/link'
import Image from 'next/image'
import { FiUsers, FiAward, FiClock, FiMessageSquare, FiShare2, FiBook, FiHeart, FiUser } from 'react-icons/fi'
import { FaEthereum, FaCoins, FaRegBookmark, FaBookmark } from 'react-icons/fa'
import { RiVipCrownFill, RiQuillPenLine, RiNftFill } from 'react-icons/ri'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import styles from './page.module.css'

// 定义多个 IPFS 网关
const IPFS_GATEWAYS = [
  'https://blue-casual-wombat-745.mypinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  // 'https://gateway.pinata.cloud/ipfs/',
  // 'https://cloudflare-ipfs.com/ipfs/'
];

// 获取 IPFS 图片内容
const fetchIPFSImage = async (cid: string) => {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      console.log(`[IPFS] Trying gateway ${gateway} for image: ${cid}`);
      const response = await fetch(`${gateway}${cid}`);
      
      if (!response.ok) {
        console.log(`[IPFS] Gateway ${gateway} failed with status: ${response.status}`);
        continue;
      }
      
      const text = await response.text();
      if (text.startsWith('data:image')) {
        return text;
      }
      
      try {
        const data = JSON.parse(text);
        if (data.content) {
          return data.content;
        }
      } catch (e) {
        // Not JSON, use as-is
      }
      
      return text;
    } catch (error) {
      console.error(`[IPFS] Error with gateway ${gateway}:`, error);
      // Continue to next gateway
    }
  }
  console.log(`[IPFS] All gateways failed for ${cid}, using default image`);
  return null;
};

// 作者数据类型
interface Author {
  id: string;
  address: string;
  authorName: string;
  nickname?: string;
  bio: string;
  avatar: string;
  coverImage?: string;
  createdAt: string;
  updatedAt: string;
  isAuthor: boolean;
  totalWordCount: number;
  totalStories: number;
  totalFollowers: number;
  totalLikes: number;
  totalComments: number;
  nftCount: number;
  socialLinks?: {
    twitter?: string;
    discord?: string;
    website?: string;
  };
  achievements?: string[];
  level?: number;
  tags?: string[];
  ranking?: number; // 排名信息
  earnings?: number; // 收益信息
}

// 故事数据类型
interface Story {
  id: string;
  title: string;
  coverCid: string;
  description?: string;
  wordCount: number;
  status: string;
  category: string;
  updatedAt: string;
  isNFT: boolean;
  likes: number;
  favorites: number;
  comments: number;
  isSerial: boolean;
  chapterCount?: number;
  lastUpdated?: string;
}

export default function AuthorDetailPage({ params }: { params: { address: string } }) {
  const { user, isAuthenticated } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storyImages, setStoryImages] = useState<{ [key: string]: string }>({});
  const [activeTab, setActiveTab] = useState('works');
  const [author, setAuthor] = useState<Author | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 获取作者详细信息和关注状态
  useEffect(() => {
    const fetchAuthorDetails = async () => {
      if (!params.address) return;
      
      try {
        setIsLoading(true);
        
        // 获取作者信息
        const authorResponse = await fetch(`/api/authors/${params.address}`);
        if (authorResponse.ok) {
          const authorData = await authorResponse.json();
          setAuthor({
            ...authorData,
            totalWordCount: authorData.totalWordCount || 0,
            totalStories: authorData.totalStories || 0,
            totalFollowers: authorData.totalFollowers || 0,
            totalLikes: authorData.totalLikes || 0,
            totalComments: authorData.totalComments || 0,
            nftCount: authorData.nftCount || 0,
            achievements: authorData.achievements || [],
            level: authorData.level || 1,
            tags: authorData.tags || ['玄幻', '修真', '都市'],
            ranking: authorData.ranking || Math.floor(Math.random() * 50) + 1, // 随机排名，实际应从API获取
            earnings: authorData.earnings || Math.floor(Math.random() * 10000) + 1000 // 随机收益，实际应从API获取
          });
          
          // 加载作者头像
          if (authorData.avatar?.startsWith('Qm')) {
            const avatarContent = await fetchIPFSImage(authorData.avatar);
            if (avatarContent) {
              setStoryImages(prev => ({
                ...prev,
                [authorData.avatar]: avatarContent
              }));
            }
          }
        }
        
        // 获取作者故事列表
        const storiesResponse = await fetch(`/api/authors/${params.address}/stories`);
        if (storiesResponse.ok) {
          const data = await storiesResponse.json();
          const fetchedStories = data.stories || [];
          setStories(fetchedStories);
          
          // 处理IPFS图片
          const ipfsStories = fetchedStories.filter((story: any) => story?.coverCid?.startsWith('Qm'));
          console.log(`[IPFS] 需要加载 ${ipfsStories.length} 个 IPFS 图片`);
          
          // 并行加载所有图片，但不等待全部完成
          ipfsStories.forEach(async (story: any) => {
            try {
              if (!story.coverCid) return;
              console.log(`[IPFS] 开始处理故事 ${story.id} 的封面: ${story.coverCid}`);
              const imageContent = await fetchIPFSImage(story.coverCid);
              if (imageContent) {
                console.log(`[IPFS] 成功获取故事 ${story.id} 的封面图片`);
                setStoryImages(prev => ({
                  ...prev,
                  [story.coverCid]: imageContent
                }));
              }
            } catch (error) {
              console.error(`[IPFS] 获取故事 ${story.id} 的封面图片失败:`, error);
            }
          });
        }

        // 获取关注信息
        if (isAuthenticated) {
          const followsResponse = await fetch(`/api/authors/${params.address}/follows`);
          if (followsResponse.ok) {
            const data = await followsResponse.json();
            setFollowersCount(data.followers?.length || 0);
            setIsFollowing(data.followers?.some((f: any) => f.address === user?.address) || false);
          }
        }
      } catch (error) {
        console.error('Error fetching author details:', error);
        toast.error('获取作者信息失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuthorDetails();
  }, [params.address, isAuthenticated, user?.address]);

  // 获取封面图片URL
  const getCoverImageUrl = (coverCid: string) => {
    if (!coverCid) {
      return '/images/story-default-cover.jpg';
    }
    
    if (coverCid.startsWith('Qm')) {
      return storyImages[coverCid] || '/images/story-default-cover.jpg';
    }
    
    if (coverCid.startsWith('http')) {
      return coverCid;
    }
    
    return '/images/story-default-cover.jpg';
  };

  // 关注/取消关注作者
  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      toast.error('请先登录');
      return;
    }
    
    try {
      const response = await fetch(`/api/authors/${params.address}/follows`, {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          followerAddress: user?.address
        })
      });

      if (response.ok) {
        setIsFollowing(!isFollowing);
        setFollowersCount(prev => isFollowing ? prev - 1 : prev + 1);
        toast.success(isFollowing ? '已取消关注' : '关注成功');
      } else {
        const error = await response.json();
        toast.error(error.message || (isFollowing ? '取消关注失败' : '关注失败'));
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error(isFollowing ? '取消关注失败' : '关注失败');
    }
  };

  // 加载更多故事
  const handleLoadMore = async () => {
    if (isLoadingMore || stories.length === 0) return;
    
    setIsLoadingMore(true);
    // 这里应该实现加载更多故事的逻辑
    // 模拟延迟加载
    setTimeout(() => {
      setIsLoadingMore(false);
    }, 1000);
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
    } catch (e) {
      return '未知时间';
    }
  };

  // 获取作者头像URL
  const getAvatarUrl = (avatar: string | undefined) => {
    if (!avatar) {
      return '/images/default-avatar.png';
    }
    
    if (avatar.startsWith('Qm')) {
      return storyImages[avatar] || '/images/default-avatar.png';
    }
    
    if (avatar.startsWith('http')) {
      return avatar;
    }
    
    return '/images/default-avatar.png';
  };

  if (isLoading) {
    return (
      <div className={styles.pageBackground}>
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <LoadingSpinner />
            <p>加载作者信息中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!author) {
    return (
      <div className={styles.pageBackground}>
        <div className={styles.container}>
          <div className={styles.errorContainer}>
            <div className={styles.errorIcon}>😕</div>
            <h2>作者不存在</h2>
            <p>无法找到该作者信息，请检查地址是否正确</p>
            <Link href="/ranking" className={styles.backButton}>
              返回榜单
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageBackground}>
      <div className={styles.container}>
        <div className={styles.breadcrumbs}>
          <Link href="/ranking">榜单中心</Link> &gt; <span>作者详情</span>
        </div>
        
        <div className={styles.authorDetailContainer}>
          {/* 作者信息卡片 */}
          <div className={styles.authorCard}>
            <div className={styles.authorHeader}>
              <div className={styles.authorRank}>
                <RiVipCrownFill className={styles.rankIcon} />
                <span>排名 #{author.ranking || '—'}</span>
              </div>
              
              <div className={styles.authorAvatar}>
                <Image
                  src={getAvatarUrl(author.avatar)}
                  alt={author.authorName || '作者'}
                  width={120}
                  height={120}
                  className={styles.avatarImage}
                />
                
                {author.isAuthor && (
                  <div className={styles.authorBadge}>
                    <RiQuillPenLine />
                    认证作家
                  </div>
                )}
              </div>
              
              <div className={styles.authorInfo}>
                <h1 className={styles.authorName}>
                  {author.authorName || author.nickname || '匿名作家'}
                </h1>
                
                <div className={styles.authorAddress}>
                  {author.address.substring(0, 6)}...{author.address.substring(author.address.length - 4)}
                </div>
                
                <div className={styles.authorStats}>
                  <div className={styles.statItem}>
                    <FiUsers className={styles.statIcon} />
                    <span>{followersCount || 0}</span>
                    <span className={styles.statLabel}>粉丝</span>
                  </div>
                  
                  <div className={styles.statItem}>
                    <FiBook className={styles.statIcon} />
                    <span>{author.totalStories || 0}</span>
                    <span className={styles.statLabel}>作品</span>
                  </div>
                  
                  <div className={styles.statItem}>
                    <RiNftFill className={styles.statIcon} />
                    <span>{author.nftCount || 0}</span>
                    <span className={styles.statLabel}>NFT</span>
                  </div>
                  
                  <div className={styles.statItem}>
                    <FaCoins className={styles.statIcon} />
                    <span>{author.earnings?.toLocaleString() || 0}</span>
                    <span className={styles.statLabel}>收益</span>
                  </div>
                </div>
                
                <div className={styles.followButtonContainer}>
                  <button
                    className={`${styles.followButton} ${isFollowing ? styles.following : ''}`}
                    onClick={handleFollowToggle}
                  >
                    {isFollowing ? (
                      <>
                        <FiUsers className={styles.followIcon} />
                        已关注
                      </>
                    ) : (
                      <>
                        <FiUsers className={styles.followIcon} />
                        关注
                      </>
                    )}
                  </button>
                  
                  <button className={styles.shareButton}>
                    <FiShare2 className={styles.shareIcon} />
                    分享
                  </button>
                </div>
              </div>
            </div>
            
            <div className={styles.authorBio}>
              <h3 className={styles.bioTitle}>作者简介</h3>
              <p className={styles.bioContent}>{author.bio || '这位作者很神秘，还没有留下自我介绍。'}</p>
              
              {author.tags && author.tags.length > 0 && (
                <div className={styles.authorTags}>
                  {author.tags.map((tag, index) => (
                    <span key={index} className={styles.tag}>{tag}</span>
                  ))}
                </div>
              )}
              
              <div className={styles.authorMeta}>
                <div className={styles.metaItem}>
                  <FiClock className={styles.metaIcon} />
                  加入时间: {formatDate(author.createdAt)}
                </div>
                
                <div className={styles.metaItem}>
                  <FiAward className={styles.metaIcon} />
                  等级: {author.level || 1}
                </div>
              </div>
            </div>
          </div>
          
          {/* 作品展示区 */}
          <div className={styles.authorWorkSection}>
            <div className={styles.tabBar}>
              <button
                className={`${styles.tabButton} ${activeTab === 'works' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('works')}
              >
                <FiBook className={styles.tabIcon} />
                作品列表
              </button>
              <button
                className={`${styles.tabButton} ${activeTab === 'stats' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('stats')}
              >
                <FiHeart className={styles.tabIcon} />
                作者数据
              </button>
              <button
                className={`${styles.tabButton} ${activeTab === 'nft' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('nft')}
              >
                <RiNftFill className={styles.tabIcon} />
                NFT作品
              </button>
            </div>
            
            {activeTab === 'works' && (
              <div className={styles.worksList}>
                <h2 className={styles.sectionTitle}>作品列表 ({stories.length})</h2>
                
                {stories.length > 0 ? (
                  <div className={styles.storyGrid}>
                    {stories.map(story => (
                      <Link href={`/stories/${story.id}`} key={story.id} className={styles.storyCard}>
                        <div className={styles.storyCoverWrapper}>
                          <Image
                            src={getCoverImageUrl(story.coverCid)}
                            alt={story.title}
                            width={200}
                            height={280}
                            className={styles.storyCover}
                          />
                          {story.isNFT && (
                            <div className={styles.nftBadge}>
                              <RiNftFill className={styles.nftIcon} />
                              NFT
                            </div>
                          )}
                        </div>
                        
                        <div className={styles.storyInfo}>
                          <h3 className={styles.storyTitle}>{story.title}</h3>
                          
                          <div className={styles.storyStats}>
                            <span className={styles.storyStatItem}>
                              <FiHeart className={styles.storyStatIcon} />
                              {story.likes || 0}
                            </span>
                            <span className={styles.storyStatItem}>
                              <FaRegBookmark className={styles.storyStatIcon} />
                              {story.favorites || 0}
                            </span>
                            <span className={styles.storyStatItem}>
                              <FiMessageSquare className={styles.storyStatIcon} />
                              {story.comments || 0}
                            </span>
                          </div>
                          
                          <div className={styles.storyMeta}>
                            <span>{story.category}</span>
                            <span>·</span>
                            <span>{story.wordCount}字</span>
                            <span>·</span>
                            <span>更新于{formatDate(story.updatedAt)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📝</div>
                    <p>该作者暂时没有发布作品</p>
                  </div>
                )}
                
                {stories.length > 0 && (
                  <div className={styles.loadMoreContainer}>
                    <button
                      className={styles.loadMoreButton}
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <div className="flex items-center justify-center">
                          <LoadingSpinner size={16} />
                          <span className="ml-2">加载中...</span>
                        </div>
                      ) : (
                        '加载更多'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'stats' && (
              <div className={styles.statsTab}>
                <h2 className={styles.sectionTitle}>作者数据</h2>
                
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statCardIcon}><FiBook /></div>
                    <div className={styles.statCardValue}>{author.totalStories || 0}</div>
                    <div className={styles.statCardLabel}>作品总数</div>
                  </div>
                  
                  <div className={styles.statCard}>
                    <div className={styles.statCardIcon}><FiHeart /></div>
                    <div className={styles.statCardValue}>{author.totalLikes || 0}</div>
                    <div className={styles.statCardLabel}>获赞总数</div>
                  </div>
                  
                  <div className={styles.statCard}>
                    <div className={styles.statCardIcon}><FiUsers /></div>
                    <div className={styles.statCardValue}>{author.totalFollowers || 0}</div>
                    <div className={styles.statCardLabel}>粉丝总数</div>
                  </div>
                  
                  <div className={styles.statCard}>
                    <div className={styles.statCardIcon}><FiMessageSquare /></div>
                    <div className={styles.statCardValue}>{author.totalComments || 0}</div>
                    <div className={styles.statCardLabel}>评论总数</div>
                  </div>
                  
                  <div className={styles.statCard}>
                    <div className={styles.statCardIcon}><RiQuillPenLine /></div>
                    <div className={styles.statCardValue}>{(author.totalWordCount / 10000).toFixed(1)}万</div>
                    <div className={styles.statCardLabel}>累计字数</div>
                  </div>
                  
                  <div className={styles.statCard}>
                    <div className={styles.statCardIcon}><FaEthereum /></div>
                    <div className={styles.statCardValue}>{author.earnings?.toLocaleString() || 0}</div>
                    <div className={styles.statCardLabel}>累计收益</div>
                  </div>
                </div>
                
                <div className={styles.achievementsSection}>
                  <h3 className={styles.subsectionTitle}>作者成就</h3>
                  
                  {author.achievements && author.achievements.length > 0 ? (
                    <div className={styles.achievementsList}>
                      {author.achievements.map((achievement, index) => (
                        <div key={index} className={styles.achievementItem}>
                          <FiAward className={styles.achievementIcon} />
                          <span>{achievement}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <p>暂无成就</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'nft' && (
              <div className={styles.nftTab}>
                <h2 className={styles.sectionTitle}>NFT作品</h2>
                
                {/* 模拟NFT展示 */}
                {author.nftCount > 0 ? (
                  <div className={styles.nftGrid}>
                    {Array.from({ length: Math.min(6, author.nftCount || 0) }).map((_, index) => (
                      <div key={index} className={styles.nftCard}>
                        <div className={styles.nftImageWrapper}>
                          <Image
                            src={`https://picsum.photos/400/400?random=${index + 1}`}
                            alt={`NFT作品${index + 1}`}
                            width={300}
                            height={300}
                            className={styles.nftImage}
                          />
                        </div>
                        <div className={styles.nftInfo}>
                          <h3 className={styles.nftTitle}>NFT作品 #{index + 1}</h3>
                          <div className={styles.nftPrice}>
                            <FaEthereum className={styles.ethIcon} />
                            <span>{(Math.random() * 10).toFixed(2)} BNB</span>
                          </div>
                          <div className={styles.nftMeta}>
                            <span>稀有度: 史诗</span>
                            <span>·</span>
                            <span>铸造于{formatDate(new Date(Date.now() - Math.random() * 10000000000).toString())}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>🎨</div>
                    <p>该作者暂时没有NFT作品</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 