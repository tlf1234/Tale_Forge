'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { XMarkIcon, EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { useAccount } from 'wagmi'
import { useAuth } from '@/hooks/useAuth'
import { useLoginModal } from '@/context/LoginModalContext'
import ConnectButton from '@/components/web3/ConnectButton'

export default function LoginModal() {
  // 状态
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoginWithWallet, setIsLoginWithWallet] = useState(false)
  const [isWalletLoading, setIsWalletLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  
  // 钩子
  const router = useRouter()
  const { login, loginWithWallet } = useAuth()
  const { address, isConnected } = useAccount()
  const { isOpen, closeLoginModal, returnUrl } = useLoginModal()
  
  // 处理钱包登录
  useEffect(() => {
    if (isConnected && address && isLoginWithWallet) {
      handleWalletLogin()
    }
  }, [isConnected, address, isLoginWithWallet])

  // 动画效果：当isOpen变化时，延迟设置showModal
  useEffect(() => {
    if (isOpen) {
      setShowModal(true)
    } else {
      // 使用更长的延迟以确保动画完成
      const timer = setTimeout(() => {
        setShowModal(false)
      }, 300) // 300ms的延迟，与CSS动画时间匹配
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // 处理钱包登录逻辑
  const handleWalletLogin = async () => {
    try {
      setIsWalletLoading(true)
      await loginWithWallet(address as string)
      
      // 登录成功后关闭弹窗并跳转（如果有返回URL）
      closeLoginModal()
      if (returnUrl) {
        router.push(returnUrl)
      }
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
      
      // 登录成功后关闭弹窗并跳转（如果有返回URL）
      closeLoginModal()
      if (returnUrl) {
        router.push(returnUrl)
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || '登录失败，请检查您的邮箱和密码')
    } finally {
      setLoading(false)
    }
  }

  // 处理关闭模态框
  const handleCloseModal = (e?: React.MouseEvent) => {
    // 防止事件冒泡
    if (e) {
      e.stopPropagation()
    }
    closeLoginModal()
  }

  // 如果弹窗未打开，则不渲染
  if (!showModal) return null

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      {/* 背景遮罩 */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleCloseModal}
        aria-hidden="true"
      />
      
      {/* 弹窗内容 */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div 
          className={`relative w-full max-w-md overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-2xl transform transition-all duration-300 
            ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}
          onClick={(e) => e.stopPropagation()} // 防止点击内容区域时关闭
        >
          {/* 关闭按钮 - 移至右上角 */}
          <button 
            onClick={handleCloseModal}
            className="absolute top-4 right-4 z-20 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded-md text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="关闭登录弹窗"
            type="button"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          
          {/* 模态框顶部内容区域 */}
          <div className="pt-8 pb-2 px-6">
            {/* Logo - 简化版本 */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-white dark:bg-gray-700 shadow-sm flex items-center justify-center">
                <Image 
                  src="/logo.png" 
                  alt="Tale Forge Logo" 
                  width={48} 
                  height={48} 
                  className="rounded-full object-cover"
                  priority
                />
              </div>
            </div>
          
            {/* 标题 */}
            <div className="text-center pb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">账户登录</h3>
            </div>
          </div>
          
          {/* 分隔线 */}
          <div className="w-full h-px bg-gray-200 dark:bg-gray-700"></div>
          
          {/* 弹窗内容区域 */}
          <div className="p-5">
            {/* 登录方式切换 */}
            <div className="flex mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setIsLoginWithWallet(false)}
                className={`flex-1 py-2 rounded-md text-sm font-medium text-center transition-all ${!isLoginWithWallet 
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-indigo-600 dark:text-indigo-400' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/80'}`}
              >
                邮箱登录
              </button>
              <button
                onClick={() => setIsLoginWithWallet(true)}
                className={`flex-1 py-2 rounded-md text-sm font-medium text-center transition-all ${isLoginWithWallet 
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-indigo-600 dark:text-indigo-400' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/80'}`}
              >
                钱包登录
              </button>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-300 rounded-lg text-sm animate-fadeIn">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              </div>
            )}
            
            {isLoginWithWallet ? (
              <div className="text-center py-4">
                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3">使用您的数字钱包登录</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">连接Web3钱包，安全便捷地访问您的账户</p>
                
                <div className="flex justify-center mb-6">
                  <ConnectButton />
                </div>
                
                {isWalletLoading && (
                  <div className="mt-4 flex justify-center items-center text-indigo-600 dark:text-indigo-400">
                    <svg className="animate-spin mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    登录处理中...
                  </div>
                )}
                
                <p className="mt-6 text-xs text-gray-500 dark:text-gray-500">
                  首次登录将自动为您创建账户
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="group">
                  <label htmlFor="modal-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    电子邮箱
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                      <EnvelopeIcon className="h-5 w-5" />
                    </div>
                    <input
                      id="modal-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:focus:ring-indigo-600 dark:focus:border-indigo-600 transition-all"
                      placeholder="您的邮箱地址"
                    />
                  </div>
                </div>

                <div className="group">
                  <label htmlFor="modal-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    密码
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                      <LockClosedIcon className="h-5 w-5" />
                    </div>
                    <input
                      id="modal-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:focus:ring-indigo-600 dark:focus:border-indigo-600 transition-all"
                      placeholder="您的密码"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="modal-remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-600 border-gray-300 rounded"
                    />
                    <label htmlFor="modal-remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      记住我
                    </label>
                  </div>

                  <div className="text-sm">
                    <Link href="/forgot-password" onClick={(e) => {e.stopPropagation(); closeLoginModal();}} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors">
                      忘记密码?
                    </Link>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all
                      ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        登录中...
                      </>
                    ) : '登录'}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">其他选项</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link
                  href="/register"
                  onClick={(e) => {e.stopPropagation(); closeLoginModal();}}
                  className="flex justify-center items-center py-2 px-4 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                  </svg>
                  注册新账号
                </Link>
                
                <Link
                  href="/login"
                  onClick={(e) => {e.stopPropagation(); closeLoginModal();}}
                  className="flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  完整登录页面
                </Link>
              </div>
            </div>
            
            {/* 底部提示 */}
            <p className="mt-5 text-xs text-center text-gray-500 dark:text-gray-400">
              登录即表示您同意我们的
              <Link href="/terms" onClick={(e) => e.stopPropagation()} className="text-indigo-600 dark:text-indigo-400 hover:underline mx-1">服务条款</Link>
              和
              <Link href="/privacy" onClick={(e) => e.stopPropagation()} className="text-indigo-600 dark:text-indigo-400 hover:underline ml-1">隐私政策</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 