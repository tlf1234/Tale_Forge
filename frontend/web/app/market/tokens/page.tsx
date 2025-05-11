'use client'

import React, { useState, useEffect } from 'react'
import { FaCoins, FaChartLine, FaSearch, FaFilter, FaSort, FaStar, FaExchangeAlt, FaTimes, FaArrowUp, FaArrowDown } from 'react-icons/fa'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { ethers } from 'ethers'
import styles from './page.module.css'
import WalletRequired from '@/components/web3/WalletRequired'
import { toast } from 'react-hot-toast'
import { TOKEN_ABIS } from '@/constants/contracts'

// 代币类型
type AuthorToken = {
  address: string
  name: string
  symbol: string
  authorName: string
  authorAddress: string
  price: string
  priceChange24h: number
  volume24h: string
  marketCap: string
  holders: number
}

// 排序类型
type SortType = 'price' | 'priceChange' | 'volume' | 'marketCap' | 'holders'

// 交易类型
type TradeType = 'buy' | 'sell'

export default function TokenMarketPage() {
  const { address } = useAccount()
  const [isLoading, setIsLoading] = useState(true)
  const [tokens, setTokens] = useState<AuthorToken[]>([])
  const [filteredTokens, setFilteredTokens] = useState<AuthorToken[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortType>('marketCap')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [activeTab, setActiveTab] = useState<'all' | 'trending' | 'new' | 'following'>('all')
  
  // 交易相关状态
  const [showTradeModal, setShowTradeModal] = useState(false)
  const [tradeType, setTradeType] = useState<TradeType>('buy')
  const [selectedToken, setSelectedToken] = useState<AuthorToken | null>(null)
  const [tradeAmount, setTradeAmount] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('0')
  const [userBalance, setUserBalance] = useState('0')
  const [isProcessing, setIsProcessing] = useState(false)

  // 模拟获取代币数据
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setIsLoading(true)
        
        // 使用实际的API调用
        const response = await fetch(`/api/market/tokens?page=1&limit=20&sort=${sortBy}&order=${sortDirection}&filter=${activeTab}${searchTerm ? `&search=${searchTerm}` : ''}`)
        const data = await response.json()
        
        if (data.error) {
          console.error('Error fetching tokens:', data.error)
          return
        }
        
        setTokens(data.tokens)
        setFilteredTokens(data.tokens)
      } catch (error) {
        console.error('Failed to fetch tokens:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchTokens()
  }, [sortBy, sortDirection, activeTab])

  // 处理搜索
  useEffect(() => {
    // 当搜索词变化时，使用API进行搜索
    const searchTokens = async () => {
      if (searchTerm.trim() === '') {
        // 如果搜索词为空，重新获取所有代币
        const response = await fetch(`/api/market/tokens?page=1&limit=20&sort=${sortBy}&order=${sortDirection}&filter=${activeTab}`)
        const data = await response.json()
        
        if (data.error) {
          console.error('Error fetching tokens:', data.error)
          return
        }
        
        setTokens(data.tokens)
        setFilteredTokens(data.tokens)
      } else {
        // 如果有搜索词，使用API搜索
        const response = await fetch(`/api/market/tokens?page=1&limit=20&sort=${sortBy}&order=${sortDirection}&filter=${activeTab}&search=${searchTerm}`)
        const data = await response.json()
        
        if (data.error) {
          console.error('Error searching tokens:', data.error)
          return
        }
        
        setTokens(data.tokens)
        setFilteredTokens(data.tokens)
      }
    }
    
    // 使用防抖处理搜索，避免频繁请求
    const debounceSearch = setTimeout(() => {
      searchTokens()
    }, 500)
    
    return () => clearTimeout(debounceSearch)
  }, [searchTerm])

  // 处理排序
  useEffect(() => {
    const sorted = [...filteredTokens].sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'price':
          comparison = parseFloat(a.price) - parseFloat(b.price)
          break
        case 'priceChange':
          comparison = a.priceChange24h - b.priceChange24h
          break
        case 'volume':
          comparison = parseFloat(a.volume24h.replace(/,/g, '')) - parseFloat(b.volume24h.replace(/,/g, ''))
          break
        case 'marketCap':
          comparison = parseFloat(a.marketCap.replace(/,/g, '')) - parseFloat(b.marketCap.replace(/,/g, ''))
          break
        case 'holders':
          comparison = a.holders - b.holders
          break
        default:
          comparison = 0
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
    
    setFilteredTokens(sorted)
  }, [sortBy, sortDirection])

  // 处理标签切换
  const handleTabChange = (tab: 'all' | 'trending' | 'new' | 'following') => {
    setActiveTab(tab)
    setIsLoading(true)
    
    // 使用API获取对应标签的代币列表
    fetch(`/api/market/tokens?page=1&limit=20&sort=${sortBy}&order=${sortDirection}&filter=${tab}${searchTerm ? `&search=${searchTerm}` : ''}`)
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          console.error('Error fetching tokens by tab:', data.error)
          return
        }
        
        setTokens(data.tokens)
        setFilteredTokens(data.tokens)
      })
      .catch(error => {
        console.error('Failed to fetch tokens by tab:', error)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  // 处理排序方向切换
  const handleSortDirectionToggle = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  // 处理排序类型切换
  const handleSortByChange = (type: SortType) => {
    setSortBy(type)
  }

  // 打开交易模态框
  const openTradeModal = async (token: AuthorToken, type: TradeType) => {
    setSelectedToken(token)
    setTradeType(type)
    setTradeAmount('')
    setEstimatedCost('0')
    setIsProcessing(true)
    
    try {
      // 获取用户余额
      const response = await fetch(`/api/market/tokens/trade?tokenAddress=${token.address}&userAddress=${address}`)
      const data = await response.json()
      
      if (data.error) {
        toast.error(data.error)
        return
      }
      
      if (type === 'buy') {
        // 获取BNB余额
        setUserBalance(data.bnbBalance)
      } else {
        // 获取代币余额
        setUserBalance(data.tokenBalance)
      }
      
      setShowTradeModal(true)
    } catch (error) {
      console.error('Failed to get balance:', error)
      toast.error('获取余额失败')
    } finally {
      setIsProcessing(false)
    }
  }

  // 关闭交易模态框
  const closeTradeModal = () => {
    setShowTradeModal(false)
    setSelectedToken(null)
  }

  // 处理交易金额变化
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setTradeAmount(value)
      
      if (selectedToken && value !== '') {
        const amount = parseFloat(value)
        const price = parseFloat(selectedToken.price)
        
        if (tradeType === 'buy') {
          setEstimatedCost((amount * price).toFixed(4))
        } else {
          setEstimatedCost((amount * price).toFixed(4))
        }
      } else {
        setEstimatedCost('0')
      }
    }
  }

  // 设置最大金额
  const setMaxAmount = () => {
    if (selectedToken) {
      if (tradeType === 'buy') {
        const maxTokens = Math.floor(parseFloat(userBalance) / parseFloat(selectedToken.price))
        setTradeAmount(maxTokens.toString())
        setEstimatedCost(parseFloat(userBalance).toFixed(4))
      } else {
        setTradeAmount(userBalance)
        const cost = parseFloat(userBalance) * parseFloat(selectedToken.price)
        setEstimatedCost(cost.toFixed(4))
      }
    }
  }

  // 执行交易
  const executeTrade = async () => {
    if (!selectedToken || !address || !tradeAmount || parseFloat(tradeAmount) <= 0) {
      toast.error('请输入有效的交易数量')
      return
    }
    
    try {
      setIsProcessing(true)
      
      // 调用API执行交易
      const response = await fetch('/api/market/tokens/trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenAddress: selectedToken.address,
          tradeType,
          amount: tradeAmount,
          userAddress: address
        }),
      })
      
      const data = await response.json()
      
      if (data.error) {
        toast.error(data.error)
        return
      }
      
      if (data.success) {
        if (tradeType === 'buy') {
          toast.success(`成功购买 ${tradeAmount} ${selectedToken.symbol}`)
        } else {
          toast.success(`成功出售 ${tradeAmount} ${selectedToken.symbol}`)
        }
        
        // 关闭模态框并刷新数据
        closeTradeModal()
        
        // 刷新代币列表
        const refreshResponse = await fetch(`/api/market/tokens?page=1&limit=20&sort=${sortBy}&order=${sortDirection}&filter=${activeTab}${searchTerm ? `&search=${searchTerm}` : ''}`)
        const refreshData = await refreshResponse.json()
        
        if (!refreshData.error) {
          setTokens(refreshData.tokens)
          setFilteredTokens(refreshData.tokens)
        }
      }
    } catch (error) {
      console.error('Trade failed:', error)
      toast.error('交易失败，请稍后重试')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <WalletRequired
      title="代币市场"
      description="连接钱包以访问代币市场"
      icon={<FaCoins className="w-10 h-10 text-indigo-600" />}
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>作者代币市场</h1>
          <p className={styles.subtitle}>发现、购买和交易你喜爱的作者的代币</p>
        </div>

        {/* 搜索和筛选 */}
        <div className={styles.searchContainer}>
          <div className={styles.searchBox}>
            <FaSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="搜索代币名称、符号或作者..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <div className={styles.filterContainer}>
            <button className={styles.filterButton}>
              <FaFilter />
              <span>筛选</span>
            </button>
            <button 
              className={styles.sortButton}
              onClick={handleSortDirectionToggle}
            >
              <FaSort />
              <span>{sortDirection === 'asc' ? '升序' : '降序'}</span>
            </button>
          </div>
        </div>

        {/* 标签栏 */}
        <div className={styles.tabsContainer}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'all' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('all')}
          >
            所有代币
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'trending' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('trending')}
          >
            热门上涨
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'new' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('new')}
          >
            最新发行
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'following' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('following')}
          >
            我的关注
          </button>
        </div>

        {/* 排序选项 */}
        <div className={styles.sortOptionsContainer}>
          <div className={styles.sortOptions}>
            <button 
              className={`${styles.sortOption} ${sortBy === 'price' ? styles.activeSortOption : ''}`}
              onClick={() => handleSortByChange('price')}
            >
              价格
            </button>
            <button 
              className={`${styles.sortOption} ${sortBy === 'priceChange' ? styles.activeSortOption : ''}`}
              onClick={() => handleSortByChange('priceChange')}
            >
              涨跌幅
            </button>
            <button 
              className={`${styles.sortOption} ${sortBy === 'volume' ? styles.activeSortOption : ''}`}
              onClick={() => handleSortByChange('volume')}
            >
              交易量
            </button>
            <button 
              className={`${styles.sortOption} ${sortBy === 'marketCap' ? styles.activeSortOption : ''}`}
              onClick={() => handleSortByChange('marketCap')}
            >
              市值
            </button>
            <button 
              className={`${styles.sortOption} ${sortBy === 'holders' ? styles.activeSortOption : ''}`}
              onClick={() => handleSortByChange('holders')}
            >
              持有人数
            </button>
          </div>
        </div>

        {/* 代币列表 */}
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>加载中...</p>
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className={styles.emptyContainer}>
            <FaCoins className={styles.emptyIcon} />
            <p>没有找到符合条件的代币</p>
          </div>
        ) : (
          <div className={styles.tokenList}>
            <div className={styles.tokenListHeader}>
              <div className={styles.tokenCol}>代币</div>
              <div className={styles.priceCol}>价格</div>
              <div className={styles.changeCol}>24h涨跌</div>
              <div className={styles.volumeCol}>交易量</div>
              <div className={styles.marketCapCol}>市值</div>
              <div className={styles.holdersCol}>持有人数</div>
              <div className={styles.actionCol}>操作</div>
            </div>
            {filteredTokens.map((token, index) => (
              <div key={index} className={styles.tokenItem}>
                <div className={styles.tokenCol}>
                  <div className={styles.tokenIcon}>
                    <FaCoins />
                  </div>
                  <div className={styles.tokenInfo}>
                    <div className={styles.tokenName}>{token.name}</div>
                    <div className={styles.tokenSymbol}>{token.symbol}</div>
                  </div>
                </div>
                <div className={styles.priceCol}>{token.price} BNB</div>
                <div className={`${styles.changeCol} ${token.priceChange24h >= 0 ? styles.positiveChange : styles.negativeChange}`}>
                  {token.priceChange24h >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                  {Math.abs(token.priceChange24h)}%
                </div>
                <div className={styles.volumeCol}>{token.volume24h} BNB</div>
                <div className={styles.marketCapCol}>{token.marketCap} BNB</div>
                <div className={styles.holdersCol}>{token.holders}</div>
                <div className={styles.actionCol}>
                  <button 
                    className={styles.buyButton}
                    onClick={() => openTradeModal(token, 'buy')}
                  >
                    购买
                  </button>
                  <button 
                    className={styles.sellButton}
                    onClick={() => openTradeModal(token, 'sell')}
                  >
                    出售
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 交易模态框 */}
        {showTradeModal && selectedToken && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3>{tradeType === 'buy' ? '购买' : '出售'} {selectedToken.name}</h3>
                <button className={styles.closeButton} onClick={closeTradeModal}>
                  <FaTimes />
                </button>
              </div>
              
              <div className={styles.modalBody}>
                <div className={styles.tokenDetails}>
                  <div className={styles.tokenDetailIcon}>
                    <FaCoins />
                  </div>
                  <div className={styles.tokenDetailInfo}>
                    <div className={styles.tokenDetailName}>{selectedToken.name}</div>
                    <div className={styles.tokenDetailSymbol}>{selectedToken.symbol}</div>
                  </div>
                </div>
                
                <div className={styles.priceInfo}>
                  <div className={styles.priceLabel}>当前价格</div>
                  <div className={styles.priceValue}>{selectedToken.price} BNB</div>
                </div>
                
                <div className={styles.balanceInfo}>
                  <div className={styles.balanceLabel}>
                    {tradeType === 'buy' ? 'BNB余额' : `${selectedToken.symbol}余额`}
                  </div>
                  <div className={styles.balanceValue}>
                    {userBalance} {tradeType === 'buy' ? 'BNB' : selectedToken.symbol}
                  </div>
                </div>
                
                <div className={styles.amountContainer}>
                  <label htmlFor="tradeAmount" className={styles.amountLabel}>
                    {tradeType === 'buy' ? '购买数量' : '出售数量'}
                  </label>
                  <div className={styles.amountInputContainer}>
                    <input
                      id="tradeAmount"
                      type="text"
                      value={tradeAmount}
                      onChange={handleAmountChange}
                      className={styles.amountInput}
                      placeholder="0.0"
                    />
                    <button 
                      className={styles.maxButton}
                      onClick={setMaxAmount}
                    >
                      最大
                    </button>
                  </div>
                </div>
                
                <div className={styles.costContainer}>
                  <div className={styles.costLabel}>
                    {tradeType === 'buy' ? '预计花费' : '预计获得'}
                  </div>
                  <div className={styles.costValue}>
                    {estimatedCost} {tradeType === 'buy' ? 'BNB' : 'BNB'}
                  </div>
                </div>
              </div>
              
              <div className={styles.modalFooter}>
                <button 
                  className={styles.cancelButton}
                  onClick={closeTradeModal}
                  disabled={isProcessing}
                >
                  取消
                </button>
                <button 
                  className={styles.confirmButton}
                  onClick={executeTrade}
                  disabled={isProcessing || !tradeAmount || parseFloat(tradeAmount) <= 0}
                >
                  {isProcessing ? (
                    <>
                      <div className={styles.buttonSpinner}></div>
                      处理中...
                    </>
                  ) : (
                    `确认${tradeType === 'buy' ? '购买' : '出售'}`
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </WalletRequired>
  )
} 