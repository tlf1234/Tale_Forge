'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStoryById } from '@/services/story.service'
import { Story } from '@/types/story'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Editor } from '@/components/editor'
import styles from './page.module.css'
import { useContractRead } from 'wagmi'
import { CONTRACT_ABIS, CONTRACT_ADDRESSES } from '@/constants/abi'
import { useQuery } from 'react-query'

interface Props {
  params: {
    id: string
  }
}

export default function StoryDetailPage({ params }: Props) {
  const { id } = params
  const [story, setStory] = useState<Story | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)


/*
   * 采用方案：
      1、内容先上传到后端验证
      2、验证通过后返回必要参数
      3、由用户钱包调用合约
      4. 交易成功后再通知后端更新数据库
      所以这里的方案不行，应该把合约放到前端。这里只做内容验证。
      */

  // 从链上读取故事基本信息
  const { data: storyData } = useContractRead({
    address: CONTRACT_ADDRESSES.StoryManager,
    abi: CONTRACT_ABIS.StoryManager,
    functionName: 'getStory',
    args: [id]
  })

  // 从后端获取额外信息
  const { data: storyDetails } = useQuery({
    queryKey: ['story', id],
    queryFn: async () => {
      const res = await fetch(`/api/stories/${id}`)
      if (!res.ok) throw new Error('Failed to fetch story details')
      return res.json()
    }
  })

  useEffect(() => {
    async function fetchStory() {
      try {
        setIsLoading(true)
        setError(null)
        const data = await getStoryById(id)
        setStory(data)
      } catch (err) {
        setError('获取作品详情失败，请稍后重试')
        console.error('Failed to fetch story:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStory()
  }, [id])

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">{error}</p>
        <Link href="/stories" className="text-blue-500 hover:underline mt-4 inline-block">
          返回作品列表
        </Link>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="text-center py-8">
        <p>作品不存在</p>
        <Link href="/stories" className="text-blue-500 hover:underline mt-4 inline-block">
          返回作品列表
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* 左侧信息 */}
        <div className="md:col-span-1">
          <div className="relative aspect-[3/4] w-full">
            <Image
              src={`https://gateway.pinata.cloud/ipfs/${story.coverCid}`}
              alt={story.title}
              fill
              className="object-cover rounded-lg"
            />
          </div>
          <div className="mt-4 space-y-2">
            <h1 className="text-2xl font-bold">{story.title}</h1>
            <p className="text-gray-600">{story.description}</p>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">作者：</span>
              <Link
                href={`/author/${story.authorId}`}
                className="text-blue-500 hover:underline"
              >
                {story.author?.name || story.author?.address}
              </Link>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">字数：</span>
              <span>{story.wordCount}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">目标字数：</span>
              <span>{story.targetWordCount}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">分类：</span>
              <span>{story.category}</span>
            </div>
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="md:col-span-2">
          <div className="prose prose-lg max-w-none">
            <Editor content={story.content} editable={false} />
          </div>
        </div>
      </div>
    </div>
  )
}