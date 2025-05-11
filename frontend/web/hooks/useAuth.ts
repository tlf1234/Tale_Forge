'use client'

import { useState, useEffect, createContext, useContext, createElement } from 'react'
import { useAccount } from 'wagmi'
import type { ReactNode } from 'react'
import { syncReadingHistory } from '@/services/syncService'
import { toast } from 'react-hot-toast'


/**
 * 注意，该文件和useAuth.tsx文件是同一个文件，只是为了防止在tsx文件中使用时，出现错误
 * !!!!!!!!!!!
 */

// 用户类型
interface User {
  id: string
  address?: string
  email?: string
  nickname?: string
  avatar?: string
  isAuthor: boolean
  type: string
  authType: string
}

// 认证上下文类型
interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithWallet: (address: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

// 创建认证上下文
const AuthContext = createContext<AuthContextType | null>(null)

// 认证钩子
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// 认证提供者组件
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { address, isConnected } = useAccount()

  // 从本地存储加载用户信息
  useEffect(() => {
    const loadUser = () => {
      try {
        const savedToken = localStorage.getItem('token')
        const savedUser = localStorage.getItem('user')
        
        if (savedToken && savedUser) {
          const parsedUser = JSON.parse(savedUser)
          
          // 检查如果用户是钱包登录，地址是否与当前连接的钱包匹配
          if (parsedUser.authType === 'WALLET' && isConnected && address) {
            if (parsedUser.address?.toLowerCase() !== address.toLowerCase()) {
              console.log('[Auth] 钱包地址不匹配，不加载存储的用户信息', {
                storedAddress: parsedUser.address,
                connectedAddress: address
              })
              // 地址不匹配，清除本地存储
              localStorage.removeItem('token')
              localStorage.removeItem('user')
              setIsLoading(false)
              return
            }
          }
          
          // 加载用户信息
          setToken(savedToken)
          setUser(parsedUser)
          console.log('[Auth] 已从本地存储加载用户信息', {
            userId: parsedUser.id,
            address: parsedUser.address,
            authType: parsedUser.authType
          })
        }
      } catch (error) {
        console.error('[Auth] 加载用户信息失败:', error)
        // 出错时清除本地存储
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadUser()
  }, [address, isConnected])

  // 钱包连接/断开时自动处理
  useEffect(() => {
    if (isConnected && address) {
      // 检查是否需要重新登录
      if (!user) {
        // 未登录状态，直接使用钱包登录
        console.log('未登录状态，使用钱包登录:', address);
        loginWithWallet(address);
      } else if (user.authType === 'WALLET') {
        // 已经是钱包登录，但地址不匹配时，需要先登出再重新登录
        if (user.address !== address) {
          console.log('钱包地址变更，重新登录:', {
            oldAddress: user.address,
            newAddress: address
          });
          // 先登出当前用户
          logout();
          // 使用新钱包登录
          setTimeout(() => loginWithWallet(address), 100);
      }
      }
    } else if (!isConnected && user?.authType === 'WALLET') {
      // 钱包断开连接，但用户是通过钱包登录的，需要登出
      console.log('钱包断开连接，登出钱包用户');
      logout();
    }
  }, [isConnected, address, user]);

  // 邮箱登录
  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || '登录失败')
      }
      
      // 保存认证信息
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      
      setToken(data.token)
      setUser(data.user)
      
      // 登录成功后，同步本地阅读历史到服务器
      try {
        const localReadingHistory = localStorage.getItem('reading_history')
        const hasHistory = localReadingHistory && Object.keys(JSON.parse(localReadingHistory)).length > 0
        
        // 如果有本地阅读历史，显示正在同步的提示
        if (hasHistory) {
          toast.success('登录成功，正在同步阅读记录...', { duration: 3000 })
        } else {
          toast.success('登录成功')
        }
        
        await syncReadingHistory(data.user.id, data.user.address, data.token)
      } catch (syncError) {
        console.error('[Auth] 同步阅读历史失败:', syncError)
        // 同步失败不影响登录流程，所以不抛出错误
      }
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // 钱包登录
  const loginWithWallet = async (walletAddress: string) => {
    setIsLoading(true)
    try {
      // 先清除之前的认证数据，确保不使用旧数据
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      
      console.log('[Auth] 钱包登录开始:', walletAddress)
      
      const response = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        console.error('[Auth] 钱包登录失败:', data.error)
        throw new Error(data.error || '钱包登录失败')
      }
      
      console.log('[Auth] 钱包登录成功:', {
        userId: data.user.id,
        address: data.user.address
      })
      
      // 保存认证信息
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      
      setToken(data.token)
      setUser(data.user)
      
      // 钱包登录成功后，同步本地阅读历史到服务器
      try {
        const localReadingHistory = localStorage.getItem('reading_history')
        const hasHistory = localReadingHistory && Object.keys(JSON.parse(localReadingHistory)).length > 0
        
        // 如果有本地阅读历史，显示正在同步的提示
        if (hasHistory) {
          toast.success('钱包连接成功，正在同步阅读记录...', { duration: 3000 })
        } else {
          toast.success('钱包连接成功')
        }
        
        await syncReadingHistory(data.user.id, data.user.address, data.token)
      } catch (syncError) {
        console.error('[Auth] 同步阅读历史失败:', syncError)
        // 同步失败不影响登录流程，所以不抛出错误
      }
    } catch (error) {
      console.error('[Auth] 钱包登录异常:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // 登出
  const logout = () => {
    console.log('[Auth] 用户登出')
    // 清除本地存储
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // 清除状态
    setToken(null)
    setUser(null)
    // 添加页面刷新 - 确保所有状态重置
    //window.location.href = '/'
  }

  const authValue = {
    user,
    token,
    isLoading,
    login,
    loginWithWallet,
    logout,
    isAuthenticated: !!user && !!token
  }

  // 使用createElement代替JSX语法
  return createElement(
    AuthContext.Provider,
    { value: authValue },
    children
  )
} 