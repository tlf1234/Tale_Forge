import { ethers } from 'ethers'
import prisma from '../prisma'
import { CONTRACT_ADDRESSES, ABIS } from '@tale-forge/shared'
import { uploadToIPFS, getFromIPFS, uploadJSONToIPFS } from '../ipfs'
import type { Story, Chapter, Prisma, StoryStatus } from '@prisma/client'

export class StoryService {
  constructor() {
    // 不再需要 provider 和合约初始化
  }

  // 验证故事内容
  async validateStory(data: any) {
    // 内容验证逻辑
    return { isValid: true, ipfsHash: '' }
  }



  // 其他数据库操作方法

  // 创建故事
  async createStory(data: {
    title: string
    description: string
    content: string
    authorId: string
    category: string
    targetWordCount: number
    coverImage?: File
  }) {
    // 1. 上传内容到 IPFS
    const contentCID = await uploadToIPFS(data.content)
    
    // 2. 上传封面到 IPFS (如果有)
    let coverCID = ''
    if (data.coverImage) {
      const buffer = Buffer.from(await data.coverImage.arrayBuffer())
      coverCID = await uploadToIPFS(buffer)
    }

    // 3. 保存到数据库
    return await prisma.story.create({
      data: {
        title: data.title,
        description: data.description,
        contentCID,
        cover: coverCID,
        authorId: data.authorId,
        category: data.category,
        targetWordCount: data.targetWordCount,
        wordCount: data.content.length,
        status: 'DRAFT' as const
      }
    })
  }

  // 更新故事
  async updateStory(id: string, data: {
    title?: string
    description?: string
    content?: string
    category?: string
    targetWordCount?: number
    coverImage?: File
    status?: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'SUSPENDED'
  }) {
    const updateData: Prisma.StoryUpdateInput = {}

    // 1. 处理内容更新
    if (data.content) {
      updateData.contentCID = await uploadToIPFS(data.content)
      updateData.wordCount = data.content.length
    }

    // 2. 处理封面更新
    if (data.coverImage) {
      const buffer = Buffer.from(await data.coverImage.arrayBuffer())
      updateData.cover = await uploadToIPFS(buffer)
    }

    // 3. 更新其他字段
    Object.assign(updateData, {
      title: data.title,
      description: data.description,
      category: data.category,
      targetWordCount: data.targetWordCount,
      status: data.status
    })

    return await prisma.story.update({
      where: { id },
      data: updateData
    })
  }

  // 获取故事详情
  async getStory(id: string) {
    // 1. 获取数据库中的基本信息
    const story = await prisma.story.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        contentCID: true,
        cover: true,
        authorId: true,
        // 不获取content
      }
    })

    // 2. 内容按需从 IPFS 获取
    if (story) {
      const content = await getFromIPFS(story.contentCID)
      return { ...story, content }
    }
  }

  // 获取故事列表
  async getStories(params: {
    category?: string
    authorId?: string
    status?: StoryStatus
    skip?: number
    take?: number
    orderBy?: string
  }) {
    const { category, authorId, status, skip = 0, take = 10, orderBy = 'createdAt' } = params

    const where: Prisma.StoryWhereInput = {}
    if (category) where.category = category
    if (authorId) where.authorId = authorId
    if (status) where.status = status

    const [total, stories] = await Promise.all([
      prisma.story.count({ where }),
      prisma.story.findMany({
        where,
        skip,
        take,
        orderBy: { [orderBy]: 'desc' },
        include: {
          author: true,
          _count: {
            select: {
              likes: true,
              comments: true,
              favorites: true
            }
          }
        }
      })
    ])

    return {
      stories,
      total,
      currentPage: Math.floor(skip / take) + 1,
      totalPages: Math.ceil(total / take)
    }
  }

  // 删除故事
  async deleteStory(id: string) {
    return await prisma.story.delete({
      where: { id }
    })
  }

  // 添加章节
  async addChapter(storyId: string, data: {
    title: string
    content: string
    order: number
  }) {
    const contentCID = await uploadToIPFS(data.content)

    return await prisma.chapter.create({
      data: {
        title: data.title,
        contentCID,
        order: data.order,
        wordCount: data.content.length,
        storyId
      }
    })
  }

  // 更新章节
  async updateChapter(id: string, data: {
    title?: string
    content?: string
    order?: number
  }) {
    const updateData: Prisma.ChapterUpdateInput = {}

    if (data.content) {
      updateData.contentCID = await uploadToIPFS(data.content)
      updateData.wordCount = data.content.length
    }

    Object.assign(updateData, {
      title: data.title,
      order: data.order
    })

    return await prisma.chapter.update({
      where: { id },
      data: updateData
    })
  }

  // 删除章节
  async deleteChapter(id: string) {
    return await prisma.chapter.delete({
      where: { id }
    })
  }

  // 获取章节内容
  async getChapter(id: string) {
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        story: {
          include: {
            author: true
          }
        }
      }
    })

    if (!chapter) throw new Error('Chapter not found')

    const content = await getFromIPFS(chapter.contentCID)
    return { ...chapter, content }
  }

  /**
   * 保存故事到数据库
   */
  async saveStory(data: {
    title: string
    description: string
    content: string
    authorId: string
    category: string
    targetWordCount: number
    coverImage?: File
  }) {
    // 1. 上传内容到 IPFS
    const contentCID = await uploadToIPFS(data.content)
    const coverCID = data.coverImage ? 
      await uploadToIPFS(Buffer.from(await data.coverImage.arrayBuffer()))
      : null

    // 2. 数据库只存储CID和基本信息
    return prisma.story.create({
      data: {
        title: data.title,
        description: data.description,
        contentCID,  // 存CID
        cover: coverCID,
        authorId: data.authorId,
        category: data.category,
        targetWordCount: data.targetWordCount,
        wordCount: data.content.length,
        status: 'DRAFT' as StoryStatus
      }
    })
  }
} 