'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import ConnectButton from '@/components/web3/ConnectButton'
import { useAccount } from 'wagmi'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoginWithWallet, setIsLoginWithWallet] = useState(false)
  const [isWalletLoading, setIsWalletLoading] = useState(false)
  
  const router = useRouter()
  const { login, loginWithWallet } = useAuth()
  const { address, isConnected } = useAccount()

  // 处理钱包登录
  useEffect(() => {
    if (isConnected && address && isLoginWithWallet) {
      handleWalletLogin()
    }
  }, [isConnected, address, isLoginWithWallet])

  // 处理钱包登录
  const handleWalletLogin = async () => {
    try {
      setIsWalletLoading(true)
      await loginWithWallet(address as string)
      router.push('/')
    } catch (err: any) {
      console.error('Wallet login error:', err)
      setError(err.message || '钱包登录失败')
    } finally {
      setIsWalletLoading(false)
      setIsLoginWithWallet(false)
    }
  }

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setError('请输入邮箱和密码')
      return
    }
    
    try {
      setLoading(true)
      setError('')
      await login(email, password)
      router.push('/')
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || '登录失败，请检查您的邮箱和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8 pt-24">
      <div className="w-full max-w-md">
        {/* Logo和标题 */}
        <div className="text-center mb-8">
          <Image 
            src="/logo.png" 
            alt="Tale Forge Logo" 
            width={80} 
            height={80} 
            className="mx-auto"
          />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">欢迎登录</h2>
          <p className="mt-2 text-sm text-gray-600">
            探索Web3故事创作的无限可能
          </p>
        </div>

        {/* 登录方式切换 */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setIsLoginWithWallet(false)}
            className={`flex-1 py-2 text-center ${!isLoginWithWallet ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            邮箱登录
          </button>
          <button
            onClick={() => setIsLoginWithWallet(true)}
            className={`flex-1 py-2 text-center ${isLoginWithWallet ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            钱包登录
          </button>
        </div>

        {/* 登录表单 */}
        <div className="bg-white py-8 px-6 shadow rounded-xl">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded">
              {error}
            </div>
          )}
          
          {isLoginWithWallet ? (
            <div className="text-center py-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">使用您的数字钱包登录</h3>
              <p className="text-sm text-gray-600 mb-6">连接您的Web3钱包以安全登录Tale Forge</p>
              
              <div className="flex justify-center mb-4">
                <ConnectButton />
              </div>
              
              {isWalletLoading && (
                <div className="mt-4 flex justify-center items-center text-indigo-600">
                  <svg className="animate-spin mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  登录处理中...
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  电子邮箱
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="您的邮箱地址"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  密码
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="您的密码"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    记住我
                  </label>
                </div>

                <div className="text-sm">
                  <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
                    忘记密码?
                  </Link>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 
                    ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : null}
                  {loading ? '登录中...' : '登录'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">没有账号?</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/register"
                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                注册新账号
              </Link>
            </div>
          </div>
        </div>

        {/* 页脚信息 */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>继续操作表示您同意我们的</p>
          <div className="mt-1">
            <Link href="/terms" className="text-indigo-600 hover:text-indigo-500">
              服务条款
            </Link>
            {' 和 '}
            <Link href="/privacy" className="text-indigo-600 hover:text-indigo-500">
              隐私政策
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 