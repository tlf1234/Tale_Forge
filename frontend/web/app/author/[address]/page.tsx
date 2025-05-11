'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

export default function AuthorRedirectPage({ params }: { params: { address: string } }) {
  const router = useRouter()
  
  useEffect(() => {
    // 重定向到新的作者详情页面
    router.replace(`/ranking/author/${params.address}`)
  }, [router, params.address])
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <LoadingSpinner />
      <p className="mt-4 text-gray-600">正在跳转到新页面...</p>
    </div>
  )
}

