'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { FaPen, FaBook, FaChartBar, FaWallet, FaCoins, FaCrown, FaStar, FaRocket, FaGem, FaUsers, FaExchangeAlt } from 'react-icons/fa'
import WalletRequired from '@/components/web3/WalletRequired'
import styles from './page.module.css'
import { useAccount } from 'wagmi'

// 创作中心功能模块
const AUTHOR_MODULES = [
  {
    id: 'token',
    name: '作者代币',
    description: '创建和管理你的个人代币，建立专属粉丝经济',
    icon: <FaCoins />,
    link: '/author/token',
    highlight: true
  },
  {
    id: 'write',
    name: '开始创作',
    description: '创作新的故事，发挥你的创意',
    icon: <FaPen />,
    link: '/author/write'
  },
  {
    id: 'works',
    name: '作品管理',
    description: '管理你的作品，查看数据分析',
    icon: <FaBook />,
    link: '/author/works'
  },
  {
    id: 'stats',
    name: '数据分析',
    description: '查看作品表现，了解读者喜好',
    icon: <FaChartBar />,
    link: '/author/stats'
  },
  {
    id: 'earnings',
    name: '收益管理',
    description: '管理你的收益，查看交易记录',
    icon: <FaWallet />,
    link: '/author/earnings'
  }
]

// 代币功能介绍
const TOKEN_FEATURES = [
  {
    title: '粉丝专属权益',
    description: '持有您的代币的粉丝可获得专属内容和优先阅读权',
    icon: <FaStar className={styles.featureIcon} />
  },
  {
    title: '创作收益分成',
    description: '通过代币回购机制，与粉丝共享您的创作收益',
    icon: <FaGem className={styles.featureIcon} />
  },
  {
    title: '社区治理',
    description: '让粉丝参与您创作方向的投票和决策',
    icon: <FaUsers className={styles.featureIcon} />
  },
  {
    title: '价值增长',
    description: '随着您创作影响力的增长，代币价值也会相应提升',
    icon: <FaRocket className={styles.featureIcon} />
  }
]

export default function AuthorPage() {
  const { address } = useAccount()
  const [hasCheckedToken, setHasCheckedToken] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const [tokenInfo, setTokenInfo] = useState({
    name: '',
    symbol: '',
    holders: 0
  })

  // 检查作者是否已有代币
  useEffect(() => {
    const checkAuthorToken = async () => {
      if (!address) return
      
      try {
        const response = await fetch(`/api/token?address=${address}`)
        const data = await response.json()
        
        if (data.hasToken) {
          setHasToken(true)
          setTokenInfo({
            name: data.tokenName,
            symbol: data.tokenSymbol,
            holders: 24 // 假设值，实际应从API获取
          })
        }
      } catch (error) {
        console.error('Failed to check token status:', error)
      } finally {
        setHasCheckedToken(true)
      }
    }
    
    checkAuthorToken()
  }, [address])

  return (
    <WalletRequired
      title="作者中心"
      description="连接钱包以访问您的作者中心"
      icon={<FaPen className="w-10 h-10 text-indigo-600" />}
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>创作中心</h1>
          <p className={styles.subtitle}>在这里开始你的创作之旅</p>
        </div>

        {/* 作者代币特别推广区 */}
        {!hasToken ? (
          <div className={styles.tokenPromotion}>
            <div className={styles.tokenPromotionContent}>
              <div className={styles.tokenPromotionIcon}>
                <FaCrown />
              </div>
              <div className={styles.tokenPromotionText}>
                <h2>发行你的个人代币</h2>
                <p>创建专属代币，建立你的粉丝经济，获得额外收益</p>
                <div className={styles.tokenPromotionFeatures}>
                  <div className={styles.tokenFeature}>
                    <FaStar />
                    <span>粉丝专属权益</span>
                  </div>
                  <div className={styles.tokenFeature}>
                    <FaCoins />
                    <span>创作收益分成</span>
                  </div>
                  <div className={styles.tokenFeature}>
                    <FaChartBar />
                    <span>价值持续增长</span>
                  </div>
                </div>
              </div>
              <Link href="/author/token" className={styles.tokenPromotionButton}>
                立即发币
              </Link>
            </div>
          </div>
        ) : (
          <div className={styles.tokenDashboard}>
            <div className={styles.tokenDashboardContent}>
              <div className={styles.tokenDashboardHeader}>
                <div className={styles.tokenDashboardIcon}>
                  <FaCoins />
                </div>
                <div className={styles.tokenDashboardInfo}>
                  <h2>您的代币: {tokenInfo.name} ({tokenInfo.symbol})</h2>
                  <p>已有 {tokenInfo.holders} 位粉丝持有您的代币</p>
                </div>
                <div className={styles.tokenDashboardButtons}>
                  <Link href="/author/token" className={styles.tokenDashboardButton}>
                    管理代币
                  </Link>
                  <Link href="/market/tokens" className={styles.tokenMarketButton}>
                    查看市场
                  </Link>
                </div>
              </div>
              <div className={styles.tokenDashboardStats}>
                <div className={styles.tokenStat}>
                  <div className={styles.tokenStatValue}>1,000,000</div>
                  <div className={styles.tokenStatLabel}>总供应量</div>
                </div>
                <div className={styles.tokenStat}>
                  <div className={styles.tokenStatValue}>0.0012 BNB</div>
                  <div className={styles.tokenStatLabel}>当前价格</div>
                </div>
                <div className={styles.tokenStat}>
                  <div className={styles.tokenStatValue}>1,200 BNB</div>
                  <div className={styles.tokenStatLabel}>市值</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={styles.grid}>
          {AUTHOR_MODULES.map(module => (
            <Link 
              key={module.id}
              href={module.link}
              className={`${styles.moduleCard} ${module.highlight ? styles.highlightCard : ''}`}
            >
              <div className={styles.moduleIcon}>
                {module.icon}
              </div>
              <div className={styles.moduleInfo}>
                <h3 className={styles.moduleName}>{module.name}</h3>
                <p className={styles.moduleDescription}>{module.description}</p>
              </div>
              {module.highlight && <div className={styles.highlightBadge}>热门</div>}
            </Link>
          ))}
        </div>

        {/* 代币功能详细介绍 */}
        <div className={styles.tokenFeaturesSection}>
          <h2 className={styles.sectionTitle}>作者代币功能</h2>
          <div className={styles.featuresGrid}>
            {TOKEN_FEATURES.map((feature, index) => (
              <div key={index} className={styles.featureCard}>
                <div className={styles.featureIconWrapper}>
                  {feature.icon}
                </div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
              </div>
            ))}
          </div>
          <div className={styles.featuresCTA}>
            <Link href="/author/token" className={styles.primaryButton}>
              <FaCoins />
              {hasToken ? '管理我的代币' : '创建我的代币'}
            </Link>
          </div>
        </div>

        {/* 快捷操作区 */}
        <div className={styles.quickActions}>
          <h2 className={styles.sectionTitle}>快捷操作</h2>
          <div className={styles.actionButtons}>
            <Link href="/author/token" className={styles.primaryButton}>
              <FaCoins />
              {hasToken ? '管理代币' : '发行代币'}
            </Link>
            <Link href="/market/tokens" className={styles.primaryButton}>
              <FaExchangeAlt />
              代币市场
            </Link>
            <Link href="/author/write" className={styles.secondaryButton}>
              <FaPen />
              开始写作
            </Link>
            <Link href="/author/works" className={styles.secondaryButton}>
              查看作品
            </Link>
          </div>
        </div>

        {/* 创作数据概览 */}
        <div className={styles.statsOverview}>
          <h2 className={styles.sectionTitle}>创作数据概览</h2>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>12</div>
              <div className={styles.statLabel}>作品总数</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>1.2k</div>
              <div className={styles.statLabel}>总阅读量</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>3.5 BNB</div>
              <div className={styles.statLabel}>总收益</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>89%</div>
              <div className={styles.statLabel}>好评率</div>
            </div>
          </div>
        </div>
      </div>
    </WalletRequired>
  )
} 