import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './CommentPreview.module.css'
import CommentSkeleton from './CommentSkeleton'
import CommentItem from './CommentItem'
import { useComments } from '@/hooks/useComments'
import { useAuth } from '@/hooks/useAuth'
import { Comment } from '@/types/comment'
import { FaComments } from 'react-icons/fa'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useLoginModal } from '@/context/LoginModalContext'

interface CommentPreviewProps {
  storyId: string
  chapterId: string
  showAllComments: () => void
}

const CommentPreview: React.FC<CommentPreviewProps> = ({
  storyId,
  chapterId,
  showAllComments
}) => {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const { openLoginModal } = useLoginModal()
  const {
    comments,
    loading,
    error,
  } = useComments(storyId, chapterId)
  
  // 确定显示多少评论
  const displayCount = isMobile ? 2 : 3
  
  // 处理操作(点赞,回复,删除)
  const handleAction = (id: string) => {
    if (!isAuthenticated) {
      // 未登录时,弹出登录窗口
      openLoginModal()
      return
    }
    
    // 已登录，展示所有评论
    showAllComments()
  }
  
  if (loading) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>
          ???? <span className={styles.count}>???...</span>
        </h3>
        <div className={styles.skeletonContainer}>
          <CommentSkeleton />
          {!isMobile && <CommentSkeleton />}
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>????</h3>
        <div className={styles.error}>??????,?????</div>
      </div>
    )
  }
  
  // ???n???
  const previewComments = comments.slice(0, displayCount)
  
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        ???? 
        {comments.length > 0 && (
          <span className={styles.count}>({comments.length})</span>
        )}
      </h3>
      
      {previewComments.length > 0 ? (
        <div className={styles.previewList}>
          {previewComments.map(comment => (
            <div key={comment.id} className={styles.previewItem}>
              <CommentItem
                comment={comment}
                onLike={handleAction}
                onReply={handleAction}
                onDelete={handleAction}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          ????,?????????????
        </div>
      )}
      
      <button 
        className={styles.viewAllButton}
        onClick={isAuthenticated ? showAllComments : () => openLoginModal()}
      >
        <FaComments className={styles.commentIcon} />
        {isAuthenticated ? 
          (comments.length > 0 ? '查看全部' : '发表评论') : 
          '登录后参与评论'
        }
      </button>
    </div>
  )
}

export default CommentPreview 
