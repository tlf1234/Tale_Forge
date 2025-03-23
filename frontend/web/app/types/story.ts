export interface Author {
  id: string
  address: string
  name: string
  avatar: string
}

export interface StoryStats {
  likes: number
  comments: number
  favorites: number
}

export interface Story {
  id: string
  title: string
  description: string
  coverCid?: string
  author: Author
  category: string
  stats: {
    likes: number
    comments: number
    favorites: number
  }
  createdAt: string
  updatedAt: string
}

export interface StoriesResponse {
  stories: Story[]
  total: number
  currentPage: number
  totalPages: number
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
} 