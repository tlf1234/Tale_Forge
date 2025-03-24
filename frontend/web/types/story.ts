// 章节内容块类型
export type ContentBlock = {
  id: string
  type: 'text' | 'image'
  content: string
  caption?: string
  align?: 'left' | 'center' | 'right'
}

// 章节元信息
export interface ChapterMeta {
  id: string
  title: string
  order: number
  wordCount: number
  status: 'draft' | 'pending' | 'published'
  createdAt: string
  updatedAt: string
}

// 章节信息
export interface Chapter extends ChapterMeta {
  content: string
  publishedData?: PublishedData
}

// 发布数据
export interface PublishedData {
  version: number
  publishedAt: string
  ipfsHash: string
  serverUrl: string
  txHash: string
}

// 作者信息
export interface Author {
  id: string
  address: string
  authorName?: string
  avatar?: string
  bio?: string
}

// 故事统计信息
export interface StoryStats {
  likes: number
  views: number
  comments: number
  favorites?: number
}

// 故事信息
export interface Story {
  id: string
  title: string
  description: string
  coverCid: string
  contentCid: string
  content?: string
  author: Author
  category: string
  status: 'DRAFT' | 'PUBLISHED'
  isNFT: boolean
  nftAddress?: string
  targetWordCount: number
  wordCount: number
  chapters?: Chapter[]
  stats: StoryStats
  createdAt: string
  updatedAt: string
}

// 分页信息
export interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

// 故事列表响应
export interface StoriesResponse {
  stories: Story[]
  pagination: Pagination
}

// 获取故事列表的参数
export interface GetStoriesParams {
  category?: string
  sortBy?: string
  search?: string
  page?: number
  limit?: number
}

// 分类
export interface Category {
  id: string
  name: string
}

// 排序选项
export interface SortOption {
  id: string
  name: string
}

// 创建故事的参数
export interface CreateStoryParams {
  title: string
  description: string
  content: string
  coverImage: File
  authorAddress: string
  targetWordCount: number
  category: string
}