'use client'

import React, { useState, useEffect, createContext, useContext } from 'react'
import { useAccount } from 'wagmi'


/**
 * 注意，该文件和useAuth.ts文件是同一个文件，只是为了防止在ts文件中使用时，出现错误
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
export function AuthProvider({ children }: { children: React.ReactNode }) {
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
          
          // 检查：如果是钱包用户，且当前连接了钱包，则验证地址是否匹配
          if (parsedUser.authType === 'WALLET' && isConnected && address) {
            // 当钱包地址不匹配时，不使用本地存储的用户信息
            if (parsedUser.address?.toLowerCase() !== address?.toLowerCase()) {
              console.log('加载用户信息：检测到钱包地址不匹配', {
                savedAddress: parsedUser.address,
                connectedAddress: address
              })
              // 清除本地存储，不设置用户状态
              localStorage.removeItem('token')
              localStorage.removeItem('user')
              setIsLoading(false)
              return
            }
          }
          
          setToken(savedToken)
          setUser(parsedUser)
          
          // 同步token到cookies，确保API请求可以获取到token
          // 检查是否已经有相同的cookie，避免重复设置
          if (!document.cookie.includes(`token=${savedToken}`)) {
            document.cookie = `token=${savedToken}; path=/; max-age=${60*60*24*7}; SameSite=Strict`;
          }
        }
      } catch (error) {
        console.error('Failed to load user:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadUser()
  }, [isConnected, address])  // 添加依赖，当钱包连接状态或地址变化时重新检查

  // 钱包连接/断开时自动处理
  useEffect(() => {
    if (isConnected && address) {
      // 如果当前没有用户或用户地址与钱包不匹配，尝试登录
      if (!user) {
        // 未登录状态，直接尝试用钱包登录
        loginWithWallet(address)
      } else if (user.authType === 'WALLET' && user.address?.toLowerCase() !== address?.toLowerCase()) {
        // 已登录但钱包地址不匹配，先登出再用新钱包登录
        logout()
        setTimeout(() => loginWithWallet(address), 100)
      }
    } else if (!isConnected && user?.authType === 'WALLET') {
      // 钱包断开连接，但用户是通过钱包登录的，需要登出
      logout()
    }
  }, [isConnected, address, user])

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
      
      // 保存认证信息到localStorage
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      
      // 同时设置cookies，确保API请求可以获取到token
      // 设置为安全的cookie，有效期7天
      document.cookie = `token=${data.token}; path=/; max-age=${60*60*24*7}; SameSite=Strict`;
      
      setToken(data.token)
      setUser(data.user)
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
      document.cookie = 'token=; path=/; max-age=0; SameSite=Strict';
      
      // 确保钱包地址使用小写形式
      const normalizedAddress = walletAddress.toLowerCase();
      
      const response = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: normalizedAddress })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || '钱包登录失败')
      }
      
      // 保存认证信息到localStorage
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify({...data.user, authType: 'WALLET'}))
      
      // 同时设置cookies，确保API请求可以获取到token
      // 设置为安全的cookie，有效期7天
      document.cookie = `token=${data.token}; path=/; max-age=${60*60*24*7}; SameSite=Strict`;
      
      setToken(data.token)
      setUser({...data.user, authType: 'WALLET'})
    } catch (error) {
      console.error('Wallet login failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // 登出
  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // 同时清除cookie
    document.cookie = 'token=; path=/; max-age=0; SameSite=Strict';
    setToken(null)
    setUser(null)
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

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  )
} 