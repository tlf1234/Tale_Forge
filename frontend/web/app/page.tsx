'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { StoryCard } from '@/components/story/StoryCard'
import { RankingItem } from '@/components/ranking/RankingItem'
import { NFTCard } from '@/components/nft/NFTCard'
import styles from './page.module.css'
import Banner from '@/components/home/Banner'
import { CategoryFilter } from '@/components/home/CategoryFilter'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import type { Story } from '@/types/story'
import { CATEGORIES, SORT_OPTIONS } from '@/constants/story'

//配置数据
const TOP_EARNING_STORIES = [
  {
    id: 1,
    rank: 1,
    title: "永恒之剑",
    author: "剑客小说家",
    reads: 15000,
    isNFT: true,
    tokenId: "1024",
    floorPrice: 0.5,
    totalEarnings: 2.8,
    miningRewards: 1.2,
    coverImage: `https://picsum.photos/800/600?random=1`
  },
  {
    id: 2,
    rank: 2,
    title: "星际迷航记",
    author: "科幻作家",
    reads: 12000,
    isNFT: true,
    tokenId: "1025",
    floorPrice: 0.3,
    totalEarnings: 1.5,
    miningRewards: 0.8,
    coverImage: `https://picsum.photos/800/600?random=2`
  },
  {
    id: 3,
    rank: 3,
    title: "都市传说",
    author: "现代派",
    reads: 9500,
    isNFT: true,
    tokenId: "1026",
    floorPrice: 0.2,
    totalEarnings: 0.9,
    miningRewards: 0.5,
    coverImage: `https://picsum.photos/800/600?random=3`
  },
  {
    id: 4,
    rank: 4,
    title: "魔法学院",
    author: "奇幻作家",
    reads: 8800,
    isNFT: true,
    tokenId: "1027",
    floorPrice: 0.15,
    totalEarnings: 0.6,
    miningRewards: 0.3,
    coverImage: `https://picsum.photos/800/600?random=4`
  },
  {
    id: 5,
    rank: 5,
    title: "修真世界",
    author: "仙侠作家",
    reads: 8200,
    isNFT: true,
    tokenId: "1028",
    floorPrice: 0.12,
    totalEarnings: 0.4,
    miningRewards: 0.2,
    coverImage: `https://picsum.photos/800/600?random=5`
  },
  {
    id: 6,
    rank: 6,
    title: "商业帝国",
    author: "商战作家",
    reads: 7800,
    isNFT: true,
    tokenId: "1029",
    floorPrice: 0.1,
    totalEarnings: 0.3,
    miningRewards: 0.15,
    coverImage: `https://picsum.photos/800/600?random=6`
  },
  {
    id: 7,
    rank: 7,
    title: "龙族崛起",
    author: "玄幻作家",
    reads: 7500,
    isNFT: true,
    tokenId: "1030",
    floorPrice: 0.08,
    totalEarnings: 0.25,
    miningRewards: 0.12,
    coverImage: `https://picsum.photos/800/600?random=7`
  },
  {
    id: 8,
    rank: 8,
    title: "末日求生",
    author: "末世作家",
    reads: 7200,
    isNFT: true,
    tokenId: "1031",
    floorPrice: 0.06,
    totalEarnings: 0.2,
    miningRewards: 0.1,
    coverImage: `https://picsum.photos/800/600?random=8`
  }
]

const fetchStories = async (params: any) => {
  const queryString = new URLSearchParams(params).toString()
  const response = await fetch(`/api/stories?${queryString}`)
  if (!response.ok) {
    throw new Error('Failed to fetch stories')
  }
  return response.json()
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [latestStories, setLatestStories] = useState<Story[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function loadStories() {
      try {
        setIsLoading(true)
        setError(null)
        const result = await fetchStories({
          sortBy: 'latest',
          limit: 8
        })
        console.log('API Response:', result)
        if (!result || !result.stories) {
          throw new Error('Invalid API response')
        }
        setLatestStories(result.stories)
      } catch (err) {
        console.error('Error:', err)
        setError('获取作品列表失败，请稍后重试')
      } finally {
        setIsLoading(false)
      }
    }

    loadStories()
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className={styles.main}>
      <div className="container mx-auto px-8 md:px-12 lg:px-16">
        <Banner />
      </div>
      
      {/* 最新连载 */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>最新连载</h2>
              <p className={styles.sectionSubtitle}>
                发现最新上架的精彩作品
              </p>
            </div>
            <Link href="/stories" className={styles.moreLink}>
              查看更多
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>
          
          <div className={styles.grid}>
            {isLoading ? (
              <LoadingSpinner />
            ) : error ? (
              <p className="text-red-500 text-center">{error}</p>
            ) : (
              latestStories.map(story => (
                <StoryCard
                  key={story.id}
                  id={story.id}
                  title={story.title}
                  description={story.description}
                  coverImage={story.coverCid ? `https://ipfs.io/ipfs/${story.coverCid}` : '/images/story-default-cover.jpg'}
                  author={story.author}
                  category={story.category}
                  stats={{
                    views: story.stats?.views || 0,
                    likes: story.stats?.likes || 0,
                    comments: story.stats?.comments || 0
                  }}
                />
              ))
            )}
          </div>
        </div>
      </section>
            
      {/* 收益风云榜作品 */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>热门收益作品</h2>
              <p className={styles.sectionSubtitle}>
                最受欢迎的作品及其收益情况
              </p>
            </div>
            <Link href="/ranking" className={styles.moreLink}>
              查看更多
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>
          <div className={styles.grid}>
            {TOP_EARNING_STORIES.slice(0, 8).map(story => (
              <RankingItem 
                key={story.id}
                {...story}
                coverImage={story.coverImage || '/images/default-story-cover.png'}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 热门NFT作品 */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>热门NFT作品</h2>
              <p className={styles.sectionSubtitle}>
                独特的数字艺术收藏品
              </p>
            </div>
            <Link href="/nft-market" className={styles.moreLink}>
              查看更多
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>
          <div className={styles.grid}>
            {[1,2,3,4].map(i => (
              <div key={i} className={styles.card}>
                <NFTCard />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}