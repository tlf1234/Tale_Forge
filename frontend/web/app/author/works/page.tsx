'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { FiEdit, FiTrash, FiPlus, FiEye, FiHeart, FiMessageSquare, FiClock, FiFilter, FiSearch } from 'react-icons/fi'
import { FaBook } from 'react-icons/fa'
import WalletRequired from '@/components/web3/WalletRequired'
import styles from './page.module.css'

interface Work {
  id: string;
  title: string;
  cover: string;
  type: string;
  status: 'draft' | 'published' | 'reviewing';
  wordCount: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  updateTime: string;
  isSerial: boolean;
  description: string;
}

// API 返回的故事类型
interface Story {
  id: string;
  title: string;
  coverCid?: string;
  category: string;
  status: string;
  wordCount: number;
  description?: string;
  updatedAt: string;
  stats?: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
  };
}

export default function WorksPage() {
  const router = useRouter()
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<Work['status'] | 'all'>('all')

  // 加载作品列表
  const loadWorks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/stories')
      if (!response.ok) {
        throw new Error('Failed to fetch stories')
      }
      const data = await response.json()
      const stories = data.stories || []
      
      // 将API返回的数据转换为页面需要的格式
      const formattedWorks: Work[] = stories.map((story: Story) => ({
        id: story.id,
        title: story.title,
        cover: story.coverCid ? `https://ipfs.io/ipfs/${story.coverCid}` : '/images/default-cover.jpg',
        type: story.category,
        status: story.status.toLowerCase() as Work['status'],
        wordCount: story.wordCount || 0,
        viewCount: story.stats?.viewCount || 0,
        likeCount: story.stats?.likeCount || 0,
        commentCount: story.stats?.commentCount || 0,
        updateTime: new Date(story.updatedAt).toLocaleDateString(),
        isSerial: true, // 默认为连载
        description: story.description || '暂无简介'
      }))
      
      setWorks(formattedWorks)
    } catch (error) {
      console.error('加载作品列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorks()
  }, [])

  // 过滤作品
  const filteredWorks = works.filter(work => {
    const matchesSearch = work.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || work.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <WalletRequired
      title="我的作品"
      description="连接钱包以查看您的作品"
      icon={<FaBook className="w-10 h-10 text-indigo-600" />}
    >
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* 顶部统计 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">总作品数</h3>
              <p className="text-3xl font-bold text-indigo-600">{works.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">总字数</h3>
              <p className="text-3xl font-bold text-indigo-600">
                {works.reduce((sum, work) => sum + work.wordCount, 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">总阅读量</h3>
              <p className="text-3xl font-bold text-indigo-600">
                {works.reduce((sum, work) => sum + work.viewCount, 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">总获赞数</h3>
              <p className="text-3xl font-bold text-indigo-600">
                {works.reduce((sum, work) => sum + work.likeCount, 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* 工具栏 */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="搜索作品..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as Work['status'] | 'all')}
                  className="pl-4 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">全部状态</option>
                  <option value="draft">草稿</option>
                  <option value="reviewing">审核中</option>
                  <option value="published">已发布</option>
                </select>
              </div>
              <Link
                href="/author/write"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <FiPlus className="w-5 h-5 mr-2" />
                创作新故事
              </Link>
            </div>
          </div>

          {/* 作品列表 */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-pulse">加载中...</div>
            </div>
          ) : filteredWorks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiEdit className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">开始您的创作之旅</h3>
              <p className="text-gray-500 mb-6">创建您的第一部作品，与读者分享您的故事</p>
              <Link
                href="/author/write"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <FiPlus className="w-4 h-4 mr-2" />
                创建新作品
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredWorks.map((work) => (
                <div key={work.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start gap-6">
                      <div className="relative w-32 h-44 flex-shrink-0">
                        <Image
                          src={work.cover}
                          alt={work.title}
                          fill
                          className="object-cover rounded-lg"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="text-xl font-bold text-gray-900 truncate">{work.title}</h2>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => router.push(`/author/write?id=${work.id}`)}
                              className="p-2 text-gray-600 hover:text-indigo-600 rounded-full hover:bg-indigo-50"
                            >
                              <FiEdit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('确定要删除这个作品吗？此操作不可恢复。')) {
                                  return;
                                }
                                try {
                                  const response = await fetch(`/api/stories/${work.id}`, {
                                    method: 'DELETE',
                                  });
                                  if (!response.ok) {
                                    throw new Error('删除作品失败');
                                  }
                                  // 重新加载作品列表
                                  loadWorks();
                                } catch (error) {
                                  console.error('删除作品失败:', error);
                                  alert('删除作品失败，请稍后重试');
                                }
                              }}
                              className="p-2 text-gray-600 hover:text-red-600 rounded-full hover:bg-red-50"
                            >
                              <FiTrash className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-gray-500 mb-4 line-clamp-2">{work.description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="flex items-center gap-2 text-gray-600">
                            <FiClock className="w-5 h-5" />
                            <span>{work.updateTime}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <FiEye className="w-5 h-5" />
                            <span>{work.viewCount.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <FiHeart className="w-5 h-5" />
                            <span>{work.likeCount.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <FiMessageSquare className="w-5 h-5" />
                            <span>{work.commentCount.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            work.status === 'published' ? 'bg-green-100 text-green-800' :
                            work.status === 'reviewing' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {work.status === 'published' ? '已发布' :
                             work.status === 'reviewing' ? '审核中' : '草稿'}
                          </span>
                          {work.isSerial && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              连载
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </WalletRequired>
  )
}