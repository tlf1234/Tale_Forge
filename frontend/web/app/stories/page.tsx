'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { StoryCard } from '@/components/story/StoryCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Pagination } from '@/components/common/Pagination'
import { CATEGORIES, SORT_OPTIONS } from '@/constants/story'
import type { Story, StoriesResponse } from '@/types/story'
import styles from './page.module.css'

const fetchStories = async (params: any) => {
  const queryString = new URLSearchParams(params).toString()
  const response = await fetch(`/api/stories?${queryString}`)
  if (!response.ok) {
    throw new Error('Failed to fetch stories')
  }
  return response.json()
}

export default function StoriesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<StoriesResponse | null>(null)

  const category = searchParams.get('category') || 'all'
  const sortBy = searchParams.get('sort') || 'latest'
  const page = Number(searchParams.get('page')) || 1
  const search = searchParams.get('search') || ''

  useEffect(() => {
    async function loadStories() {
      try {
        setIsLoading(true)
        setError(null)
        const result = await fetchStories({
          category,
          sortBy,
          search,
          page,
          limit: 12
        })
        setData(result)
      } catch (err) {
        setError('获取作品列表失败，请稍后重试')
        console.error('Error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadStories()
  }, [category, sortBy, search, page])

  const handleCategoryChange = (newCategory: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('category', newCategory)
    params.set('page', '1')
    router.push(`/stories?${params.toString()}`)
  }

  const handleSortChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('sort', newSort)
    params.set('page', '1')
    router.push(`/stories?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams)
    params.set('search', search)
    params.set('page', '1')
    router.push(`/stories?${params.toString()}`)
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', newPage.toString())
    router.push(`/stories?${params.toString()}`)
  }

  return (
    <div className="min-h-screen pt-[118px]">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">探索作品</h1>
            <p className="text-gray-600">发现精彩的故事和创作</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 mb-8">
            <div className="flex flex-wrap gap-4">
              {/* 分类选项 */}
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-700 mb-2">分类</h3>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryChange(cat.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
                        ${category === cat.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 排序选项 */}
              <div className="flex-none">
                <h3 className="text-sm font-medium text-gray-700 mb-2">排序</h3>
                <div className="flex gap-2">
                  {SORT_OPTIONS.map(option => (
                    <button
                      key={option.id}
                      onClick={() => handleSortChange(option.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
                        ${sortBy === option.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-gray-500">{error}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {data?.stories.map(story => (
                  <StoryCard 
                    key={story.id}
                    {...story}
                    coverImage={story.coverCid ? `https://gateway.pinata.cloud/ipfs/${story.coverCid}` : '/images/default-cover.jpg'}
                  />
                ))}
              </div>

              {data?.stories.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">没有找到相关作品</h3>
                  <p className="text-gray-500">试试其他分类吧</p>
                </div>
              )}

              {data && data.pagination.totalPages > 1 && (
                <div className="mt-8 flex justify-center">
                  <Pagination
                    page={data.pagination.page}
                    totalPages={Math.ceil(data.pagination.total / data.pagination.limit)}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
} 