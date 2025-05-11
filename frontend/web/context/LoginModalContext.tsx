'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

// 登录弹窗上下文类型
interface LoginModalContextType {
  isOpen: boolean
  openLoginModal: (returnUrl?: string) => void
  closeLoginModal: () => void
  returnUrl: string | null
}

// 创建上下文
const LoginModalContext = createContext<LoginModalContextType | undefined>(undefined)

// 提供者组件
export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [returnUrl, setReturnUrl] = useState<string | null>(null)

  // 打开登录弹窗
  const openLoginModal = (url?: string) => {
    // 如果提供了返回URL，则保存它
    if (url) {
      setReturnUrl(url)
    } else {
      // 默认使用当前URL
      setReturnUrl(window.location.pathname + window.location.search)
    }
    setIsOpen(true)
  }

  // 关闭登录弹窗
  const closeLoginModal = () => {
    setIsOpen(false)
  }

  return (
    <LoginModalContext.Provider
      value={{
        isOpen,
        openLoginModal,
        closeLoginModal,
        returnUrl
      }}
    >
      {children}
    </LoginModalContext.Provider>
  )
}

// 自定义钩子
export function useLoginModal() {
  const context = useContext(LoginModalContext)
  if (context === undefined) {
    throw new Error('useLoginModal must be used within a LoginModalProvider')
  }
  return context
} 