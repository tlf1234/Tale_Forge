'use client'

import React, { useState, useEffect } from 'react'
import { FaCoins, FaChartLine, FaExchangeAlt, FaUsers, FaCheckCircle, FaSpinner, FaExclamationTriangle } from 'react-icons/fa'
import WalletRequired from '@/components/web3/WalletRequired'
import styles from './page.module.css'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { ethers } from 'ethers'
import { toast } from 'react-hot-toast'

// 代币分配方案
const TOKEN_DISTRIBUTION = [
  { name: '作者持有', percentage: 40, color: '#4F46E5' },
  { name: '平台流动性池', percentage: 30, color: '#10B981' },
  { name: '读者激励池', percentage: 20, color: '#F59E0B' },
  { name: '平台储备', percentage: 10, color: '#6366F1' },
]

export default function AuthorTokenPage() {
  const { address } = useAccount()
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    tokenName: '',
    tokenSymbol: '',
    commitedRevenue: 15,
    description: ''
  })
  const [hasToken, setHasToken] = useState(false)
  const [tokenInfo, setTokenInfo] = useState({
    address: '',
    name: '',
    symbol: '',
    totalSupply: '',
    price: '0.0012 BNB',
    holders: 0,
    marketCap: '0 BNB'
  })
  const [authorStats, setAuthorStats] = useState({
    totalWordCount: 0,
    likeCount: 0,
    followerCount: 0,
    isSpecialAuthor: false
  })
  const [requirements, setRequirements] = useState({
    minWordCount: 500000,
    minLikeCount: 1000,
    minFollowerCount: 500
  })
  const [isEligible, setIsEligible] = useState(false)

  // 获取作者代币资格和信息
  useEffect(() => {
    const fetchTokenEligibility = async () => {
      if (!address) return
      
      try {
        setIsLoading(true)
        const response = await fetch(`/api/token?address=${address}`)
        const data = await response.json()
        
        if (data.error) {
          toast.error(data.error)
          return
        }
        
        setIsEligible(data.eligible)
        
        if (data.hasToken) {
          setHasToken(true)
          setTokenInfo({
            address: data.tokenAddress,
            name: data.tokenName,
            symbol: data.tokenSymbol,
            totalSupply: data.totalSupply,
            price: '0.0012 BNB', // 这里应该从DEX获取实时价格
            holders: 24, // 这里应该从合约获取实际持有人数
            marketCap: '1,200 BNB' // 这里应该计算实际市值
          })
        } else if (data.stats) {
          setAuthorStats(data.stats)
          setRequirements(data.requirements)
        }
      } catch (error) {
        console.error('Failed to fetch token eligibility:', error)
        toast.error('获取代币资格信息失败')
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchTokenEligibility()
  }, [address])

  // 处理表单变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // 处理发币申请提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStep(2)
  }

  // 处理发币确认
  const handleConfirm = async () => {
    if (!address) return
    
    try {
      setIsCreating(true)
      
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          tokenName: formData.tokenName,
          tokenSymbol: formData.tokenSymbol,
          commitedRevenue: formData.commitedRevenue
        }),
      })
      
      const data = await response.json()
      
      if (data.error) {
        toast.error(data.error)
        return
      }
      
      if (data.success) {
        toast.success('代币创建成功！')
        setHasToken(true)
        setTokenInfo({
          address: data.tokenAddress,
          name: formData.tokenName,
          symbol: formData.tokenSymbol,
          totalSupply: '1,000,000',
          price: '0.0012 BNB',
          holders: 1,
          marketCap: '1,200 BNB'
        })
      }
    } catch (error) {
      console.error('Failed to create token:', error)
      toast.error('代币创建失败，请稍后重试')
    } finally {
      setIsCreating(false)
    }
  }

  // 构建资格条件列表
  const eligibilityCriteria = [
    { 
      name: '累计创作字数', 
      value: Number(requirements.minWordCount), 
      unit: '字', 
      current: Number(authorStats.totalWordCount) 
    },
    { 
      name: '累计获得点赞', 
      value: Number(requirements.minLikeCount), 
      unit: '个', 
      current: Number(authorStats.likeCount) 
    },
    { 
      name: '累计粉丝数', 
      value: Number(requirements.minFollowerCount), 
      unit: '人', 
      current: Number(authorStats.followerCount) 
    },
  ]

  return (
    <WalletRequired
      title="作者代币"
      description="连接钱包以访问您的作者代币功能"
      icon={<FaCoins className="w-10 h-10 text-indigo-600" />}
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>作者代币</h1>
          <p className={styles.subtitle}>创建并管理你的个人代币，与粉丝建立更紧密的联系</p>
        </div>

        {isLoading ? (
          <div className={styles.loadingContainer}>
            <FaSpinner className={styles.spinner} />
            <p>加载中...</p>
          </div>
        ) : !hasToken ? (
          <div className={styles.tokenCreationContainer}>
            {/* 发币资格检查 */}
            <div className={styles.eligibilityCard}>
              <h2 className={styles.cardTitle}>发币资格</h2>
              <div className={styles.criteriaList}>
                {eligibilityCriteria.map((criteria, index) => (
                  <div key={index} className={styles.criteriaItem}>
                    <div className={styles.criteriaName}>{criteria.name}</div>
                    <div className={styles.criteriaProgress}>
                      <div 
                        className={styles.progressBar} 
                        style={{ 
                          width: `${Math.min(100, (criteria.current / criteria.value) * 100)}%`,
                          backgroundColor: criteria.current >= criteria.value ? '#10B981' : '#F59E0B'
                        }}
                      ></div>
                    </div>
                    <div className={styles.criteriaValues}>
                      <span>{criteria.current.toLocaleString()}</span>
                      <span>/</span>
                      <span>{criteria.value.toLocaleString()} {criteria.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.eligibilityStatus}>
                {isEligible ? (
                  <div className={styles.eligibleStatus}>
                    <FaCheckCircle />
                    <span>您已满足发币条件</span>
                  </div>
                ) : authorStats.isSpecialAuthor ? (
                  <div className={styles.eligibleStatus}>
                    <FaCheckCircle />
                    <span>您是特邀作者，已获得发币资格</span>
                  </div>
                ) : (
                  <div className={styles.ineligibleStatus}>
                    <FaExclamationTriangle />
                    <span>您尚未满足发币条件</span>
                  </div>
                )}
              </div>
            </div>

            {(isEligible || authorStats.isSpecialAuthor) && step === 1 && (
              <div className={styles.tokenFormCard}>
                <h2 className={styles.cardTitle}>创建你的代币</h2>
                <form onSubmit={handleSubmit} className={styles.tokenForm}>
                  <div className={styles.formGroup}>
                    <label htmlFor="tokenName">代币名称</label>
                    <input
                      type="text"
                      id="tokenName"
                      name="tokenName"
                      value={formData.tokenName}
                      onChange={handleChange}
                      placeholder="例如: 张三的创作代币"
                      required
                      className={styles.input}
                    />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="tokenSymbol">代币符号</label>
                    <input
                      type="text"
                      id="tokenSymbol"
                      name="tokenSymbol"
                      value={formData.tokenSymbol}
                      onChange={handleChange}
                      placeholder="例如: ZST"
                      maxLength={5}
                      required
                      className={styles.input}
                    />
                    <small className={styles.helperText}>最多5个字符，建议使用您名字的缩写</small>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="commitedRevenue">承诺收入比例</label>
                    <div className={styles.rangeContainer}>
                      <input
                        type="range"
                        id="commitedRevenue"
                        name="commitedRevenue"
                        min="5"
                        max="30"
                        step="1"
                        value={formData.commitedRevenue}
                        onChange={handleChange}
                        className={styles.rangeInput}
                      />
                      <span className={styles.rangeValue}>{formData.commitedRevenue}%</span>
                    </div>
                    <small className={styles.helperText}>您承诺将创作收入的这一比例用于回购代币或提供分红</small>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="description">代币描述</label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="描述您的代币用途和价值..."
                      className={styles.textarea}
                      rows={4}
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    className={styles.submitButton}
                  >
                    下一步
                  </button>
                </form>
              </div>
            )}

            {(isEligible || authorStats.isSpecialAuthor) && step === 2 && (
              <div className={styles.confirmationCard}>
                <h2 className={styles.cardTitle}>确认发行详情</h2>
                
                <div className={styles.tokenDetails}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>代币名称:</span>
                    <span className={styles.detailValue}>{formData.tokenName}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>代币符号:</span>
                    <span className={styles.detailValue}>{formData.tokenSymbol}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>初始供应量:</span>
                    <span className={styles.detailValue}>1,000,000 {formData.tokenSymbol}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>承诺收入比例:</span>
                    <span className={styles.detailValue}>{formData.commitedRevenue}%</span>
                  </div>
                </div>
                
                <div className={styles.distributionChart}>
                  <h3 className={styles.distributionTitle}>代币分配</h3>
                  <div className={styles.pieChart}>
                    {TOKEN_DISTRIBUTION.map((item, index) => (
                      <div 
                        key={index}
                        className={styles.pieSegment}
                        style={{
                          backgroundColor: item.color,
                          transform: `rotate(${index * 36}deg) skew(${90 - item.percentage * 3.6}deg)`
                        }}
                      />
                    ))}
                  </div>
                  <div className={styles.distributionLegend}>
                    {TOKEN_DISTRIBUTION.map((item, index) => (
                      <div key={index} className={styles.legendItem}>
                        <div className={styles.legendColor} style={{ backgroundColor: item.color }}></div>
                        <span className={styles.legendText}>{item.name} ({item.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className={styles.confirmationText}>
                  <p>确认发行后，将在区块链上创建您的个人代币。此操作不可逆，请确认以上信息无误。</p>
                </div>
                
                <div className={styles.confirmationButtons}>
                  <button 
                    className={styles.backButton} 
                    onClick={() => setStep(1)}
                    disabled={isCreating}
                  >
                    返回修改
                  </button>
                  <button 
                    className={styles.confirmButton}
                    onClick={handleConfirm}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <>
                        <FaSpinner className={styles.spinner} />
                        处理中...
                      </>
                    ) : '确认发行'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.tokenManagementContainer}>
            <div className={styles.tokenInfoCard}>
              <div className={styles.tokenHeader}>
                <div className={styles.tokenIcon}>
                  <FaCoins />
                </div>
                <div className={styles.tokenTitles}>
                  <h2 className={styles.tokenName}>{tokenInfo.name} ({tokenInfo.symbol})</h2>
                  <p className={styles.tokenAddress}>
                    {tokenInfo.address.slice(0, 6)}...{tokenInfo.address.slice(-4)}
                    <button className={styles.copyButton} onClick={() => {
                      navigator.clipboard.writeText(tokenInfo.address);
                      toast.success('地址已复制到剪贴板');
                    }}>
                      复制
                    </button>
                  </p>
                </div>
              </div>
              
              <div className={styles.tokenStats}>
                <div className={styles.statItem}>
                  <div className={styles.statIcon}><FaCoins /></div>
                  <div className={styles.statInfo}>
                    <div className={styles.statValue}>{tokenInfo.totalSupply}</div>
                    <div className={styles.statLabel}>总供应量</div>
                  </div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statIcon}><FaChartLine /></div>
                  <div className={styles.statInfo}>
                    <div className={styles.statValue}>{tokenInfo.price}</div>
                    <div className={styles.statLabel}>当前价格</div>
                  </div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statIcon}><FaUsers /></div>
                  <div className={styles.statInfo}>
                    <div className={styles.statValue}>{tokenInfo.holders}</div>
                    <div className={styles.statLabel}>持有人数</div>
                  </div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statIcon}><FaExchangeAlt /></div>
                  <div className={styles.statInfo}>
                    <div className={styles.statValue}>{tokenInfo.marketCap}</div>
                    <div className={styles.statLabel}>市值</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={styles.actionCardsContainer}>
              <div className={styles.actionCard}>
                <h3 className={styles.actionTitle}>代币功能管理</h3>
                <div className={styles.toggleList}>
                  <div className={styles.toggleItem}>
                    <span>优先阅读权</span>
                    <label className={styles.switch}>
                      <input type="checkbox" defaultChecked />
                      <span className={styles.slider}></span>
                    </label>
                  </div>
                  <div className={styles.toggleItem}>
                    <span>专属评论区</span>
                    <label className={styles.switch}>
                      <input type="checkbox" defaultChecked />
                      <span className={styles.slider}></span>
                    </label>
                  </div>
                  <div className={styles.toggleItem}>
                    <span>投票权</span>
                    <label className={styles.switch}>
                      <input type="checkbox" />
                      <span className={styles.slider}></span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className={styles.actionCard}>
                <h3 className={styles.actionTitle}>收入承诺</h3>
                <div className={styles.commitmentInfo}>
                  <div className={styles.commitmentValue}>
                    <span className={styles.percentValue}>{formData.commitedRevenue}%</span>
                    <span className={styles.percentLabel}>创作收入</span>
                  </div>
                  <button className={styles.commitButton}>
                    执行回购
                  </button>
                </div>
                <div className={styles.commitmentHistory}>
                  <h4>历史回购记录</h4>
                  <div className={styles.historyList}>
                    <div className={styles.historyItem}>
                      <span>2023-06-15</span>
                      <span>0.5 BNB</span>
                    </div>
                    <div className={styles.historyItem}>
                      <span>2023-05-30</span>
                      <span>0.3 BNB</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={styles.holdersList}>
              <h3 className={styles.holdersTitle}>代币持有者 ({tokenInfo.holders})</h3>
              <div className={styles.holdersTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.addressCol}>地址</div>
                  <div className={styles.balanceCol}>持有量</div>
                  <div className={styles.percentageCol}>百分比</div>
                </div>
                <div className={styles.tableBody}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={styles.tableRow}>
                      <div className={styles.addressCol}>
                        0x{Math.random().toString(16).substring(2, 10)}...{Math.random().toString(16).substring(2, 6)}
                      </div>
                      <div className={styles.balanceCol}>
                        {Math.floor(Math.random() * 100000).toLocaleString()} {tokenInfo.symbol}
                      </div>
                      <div className={styles.percentageCol}>
                        {(Math.random() * 10).toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.viewAllLink}>
                <Link href="#">查看全部持有者</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </WalletRequired>
  )
} 