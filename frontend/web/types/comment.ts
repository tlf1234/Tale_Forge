export interface User {
  id: string
  name: string
  avatar: string
}

export interface Reply {
  id: string
  content: string
  author: User
  createdAt: string
  likes: number
  isLiked: boolean
  replyToId?: string    // 回复目标ID，如果为空则是对评论的直接回复
  replyToName?: string  // 回复目标用户名
}

export interface Comment {
  id: string
  content: string
  author: User
  createdAt: string
  likes: number
  isLiked: boolean
  replies: Reply[]
  replyCount: number
  isHot?: boolean     // 热门评论标识
  isTodayHot?: boolean // 今日热门标识
}

// 添加评论分类类型
export enum CommentFilterType {
  ALL = 'all',         // 全部评论
  HOT = 'hot',         // 热门评论
  TODAY_HOT = 'today_hot' // 今日热门
}

export interface CommentListProps {
  storyId: string
  chapterId: string
}

export interface CommentItemProps {
  comment: Comment
  onLike: (commentId: string) => void
  onReply: (commentId: string, replyId?: string, replyToName?: string) => void
  onDelete: (commentId: string) => void
  onLoadMoreReplies?: (commentId: string, page: number) => Promise<{
    replies: Reply[]
    hasMore: boolean
  }>
}

export interface CommentInputProps {
  storyId: string
  chapterId: string
  replyTo?: {
    commentId: string
    userName: string
    replyId?: string
    replyToName?: string
  }
  onSubmit: (content: string) => Promise<void>
  onCancel?: () => void
  isDisabled?: boolean
}

export interface CommentFormData {
  content: string
  parentId?: string
} 