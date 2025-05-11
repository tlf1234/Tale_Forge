'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

// 表单类型
type FormMode = 'login' | 'register'

// 表单字段
interface FormFields {
  email: string
  password: string
  nickname?: string
}

export default function EmailAuthForm() {
  const router = useRouter()
  const [mode, setMode] = useState<FormMode>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<FormFields>({
    email: '',
    password: '',
    nickname: ''
  })

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // 验证表单数据
      if (!formData.email || !formData.password) {
        toast.error('请填写必要信息')
        return
      }

      if (mode === 'register' && !formData.nickname) {
        toast.error('请填写昵称')
        return
      }

      // 构建请求数据
      const endpoint = mode === 'login' 
        ? '/api/auth/login' 
        : '/api/auth/register'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '操作失败')
      }

      if (mode === 'login') {
        // 登录成功，保存令牌
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        
        // 同时设置cookies，确保API请求可以获取到token
        document.cookie = `token=${data.token}; path=/; max-age=${60*60*24*7}; SameSite=Strict`;
        
        toast.success('登录成功')
        router.push('/') // 导航到首页
      } else {
        // 注册成功
        toast.success('注册成功，请登录')
        setMode('login')
        setFormData(prev => ({ ...prev, password: '' }))
      }
    } catch (error: any) {
      toast.error(error.message || '操作失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 切换表单模式
  const toggleMode = () => {
    setMode(prev => prev === 'login' ? 'register' : 'login')
    setFormData({
      email: '',
      password: '',
      nickname: ''
    })
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-bold text-center mb-6">
        {mode === 'login' ? '登录账号' : '注册账号'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
              昵称
            </label>
            <input
              id="nickname"
              name="nickname"
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="请输入昵称"
              value={formData.nickname}
              onChange={handleInputChange}
              disabled={isLoading}
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            电子邮箱
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="请输入邮箱"
            value={formData.email}
            onChange={handleInputChange}
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            密码
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="请输入密码"
            value={formData.password}
            onChange={handleInputChange}
            disabled={isLoading}
          />
        </div>

        <div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading
              ? '处理中...'
              : mode === 'login'
                ? '登录'
                : '注册'
            }
          </button>
        </div>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={toggleMode}
          className="text-indigo-600 hover:text-indigo-500 text-sm"
          disabled={isLoading}
        >
          {mode === 'login'
            ? '没有账号？点击注册'
            : '已有账号？点击登录'
          }
        </button>
      </div>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <p className="text-center text-sm text-gray-600">
          或者继续使用
        </p>
        <div className="mt-3 flex justify-center">
          <Link
            href="/connect"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            钱包登录
          </Link>
        </div>
      </div>
    </div>
  )
} 