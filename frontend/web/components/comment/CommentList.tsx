import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import styles from './CommentList.module.css'
import CommentItem from './CommentItem'
import CommentInput from './CommentInput'
import CommentSkeleton from './CommentSkeleton'
import { useComments } from '@/hooks/useComments'
import { useAuth } from '@/hooks/useAuth'
import { IoCaretDown, IoCaretUp, IoRefresh, IoFlame, IoTime } from 'react-icons/io5'
import type { CommentListProps } from '@/types/comment'
import { CommentFilterType } from '@/types/comment'
import { BsArrowsCollapse } from 'react-icons/bs'

const CommentList: React.FC<CommentListProps> = ({ storyId, chapterId }) => {
  const { isAuthenticated } = useAuth()
  const {
    comments,
    loading,
    error,
    hasMore,
    totalComments,
    loadMore,
    addComment,
    addReply,
    loadMoreReplies,
    likeComment,
    deleteComment,
    reload
  } = useComments(storyId, chapterId)

  const [replyTo, setReplyTo] = useState<{
    commentId: string
    userName: string
    replyId?: string
    replyToName?: string
  } | null>(null)
  
  const [expanded, setExpanded] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const commentListRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [activeFilter, setActiveFilter] = useState<CommentFilterType>(CommentFilterType.ALL)
  
  // 过滤评论列表
  const filteredComments = useMemo(() => {
    if (activeFilter === CommentFilterType.ALL) {
      return comments;
    } else if (activeFilter === CommentFilterType.HOT) {
      // 热门评论：点赞数 >= 10 或 回复数 >= 5
      return comments.filter(comment => 
        comment.isHot || comment.likes >= 10 || comment.replyCount >= 5
      );
    } else if (activeFilter === CommentFilterType.TODAY_HOT) {
      // 今日热评：今天发布的评论中点赞数 >= 5 或 回复数 >= 3
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return comments.filter(comment => {
        const commentDate = new Date(comment.createdAt);
        const isToday = commentDate >= today;
        return (comment.isTodayHot || 
                (isToday && (comment.likes >= 5 || comment.replyCount >= 3)));
      });
    }
    return comments;
  }, [comments, activeFilter]);
  
  // 处理评论区展开/收起
  const toggleExpanded = () => {
    setExpanded(!expanded)
    // 如果是展开，滚动到评论区
    if (!expanded && commentListRef.current) {
      commentListRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // 切换过滤器
  const handleFilterChange = (filter: CommentFilterType) => {
    setActiveFilter(filter);
    // 滚动到顶部
    if (commentListRef.current) {
      commentListRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }
  }

  // 监听滚动以显示/隐藏回到顶部按钮
  useEffect(() => {
    const handleScroll = () => {
      if (commentListRef.current) {
        setShowScrollButton(commentListRef.current.scrollTop > 300)
      }
    }

    const commentListElement = commentListRef.current
    if (commentListElement) {
      commentListElement.addEventListener('scroll', handleScroll)
      return () => commentListElement.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // 添加评论
  const handleAddComment = async (content: string) => {
    try {
      setIsSubmitting(true)
      await addComment(content)
      // 添加评论后，切换到全部评论视图
      setActiveFilter(CommentFilterType.ALL)
    } catch (error) {
      console.error('添加评论失败:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 添加回复
  const handleAddReply = async (content: string) => {
    if (!replyTo) return
    
    try {
      setIsSubmitting(true)
      await addReply(
        replyTo.commentId, 
        content, 
        replyTo.replyId,  // 传递回复目标ID
        replyTo.replyId ? replyTo.replyToName || replyTo.userName : replyTo.userName  // 始终传递用户名
      )
      setReplyTo(null) // 重置回复目标
    } catch (error) {
      console.error('添加回复失败:', error)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // 处理回复按钮点击
  const handleReply = (commentId: string, replyId?: string, replyToName?: string) => {
    // 查找评论以获取用户名
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return
    
    setReplyTo({
      commentId,
      userName: comment.author.name,
      replyId,      // 保存回复目标ID
      replyToName   // 保存回复目标用户名
    })
    
    console.log('设置回复目标:', {
      commentId,
      userName: comment.author.name,
      replyId,
      replyToName
    })
  }
  
  // 处理点赞
  const handleLike = async (commentId: string) => {
    try {
      await likeComment(commentId)
    } catch (error) {
      console.error('点赞失败:', error)
    }
  }
  
  // 处理加载更多回复
  const handleLoadMoreReplies = useCallback(async (commentId: string, page: number) => {
    console.log(`【CommentList.handleLoadMoreReplies】收到加载请求: commentId=${commentId}, page=${page}`);
    try {
      const result = await loadMoreReplies(commentId, page);
      console.log(`【CommentList.handleLoadMoreReplies】请求成功: 加载了${result.replies?.length || 0}条回复`);
      return result;
    } catch (error) {
      console.error('【CommentList.handleLoadMoreReplies】加载失败:', error);
      return { replies: [], hasMore: false };
    }
  }, [loadMoreReplies])
  
  // 滚动到底部加载更多
  useEffect(() => {
    if (!expanded) return
    
    const handleScroll = () => {
      if (!hasMore || loading) return
      
      const scrollPosition = window.innerHeight + window.scrollY
      const bottomPosition = document.body.offsetHeight - 300
      
      if (scrollPosition >= bottomPosition) {
        loadMore()
      }
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [hasMore, loading, expanded, loadMore])

  // 滚动到顶部
  const scrollToTop = () => {
    if (commentListRef.current) {
      commentListRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={toggleExpanded}>
        <h3 className={styles.title}>
          全部评论 {totalComments > 0 && (
            <span className={styles.count}>{totalComments}</span>
          )}
          <div className={styles.expandButton}>
            {expanded ? <IoCaretUp /> : <IoCaretDown />}
          </div>
        </h3>
      </div>
      
      {expanded && (
        <>
          {/* 评论规范提示语 */}
          <div className={styles.commentGuide}>
            平等表达，友善交流
          </div>
          
          {/* 评论输入框 - 始终显示，但会根据登录状态改变显示内容 */}
          <div className={styles.inputContainer}>
            <CommentInput
              storyId={storyId}
              chapterId={chapterId}
              onSubmit={handleAddComment}
              isDisabled={isSubmitting}
            />
          </div>
          
          {/* 评论分类标签 */}
          <div className={styles.commentTabs}>
            <button 
              className={`${styles.commentTab} ${activeFilter === CommentFilterType.ALL ? styles.active : ''}`}
              onClick={() => handleFilterChange(CommentFilterType.ALL)}
            >
              全部评论
            </button>
            <button 
              className={`${styles.commentTab} ${activeFilter === CommentFilterType.HOT ? styles.active : ''}`}
              onClick={() => handleFilterChange(CommentFilterType.HOT)}
            >
              <IoFlame className={styles.tabIcon} />
              热门评论
            </button>
            <button 
              className={`${styles.commentTab} ${activeFilter === CommentFilterType.TODAY_HOT ? styles.active : ''}`}
              onClick={() => handleFilterChange(CommentFilterType.TODAY_HOT)}
            >
              <IoTime className={styles.tabIcon} />
              今日热评
            </button>
          </div>

          {/* 错误状态 */}
          {error && (
            <div className={styles.error}>
              <p>没有获得评论，可刷新重试</p>
              <button onClick={reload} className={styles.retryButton}>
                <IoRefresh /> 重试
              </button>
            </div>
          )}

          {/* 评论列表 */}
          <div className={styles.listContainer} ref={commentListRef}>
            {filteredComments.length > 0 ? (
              <>
                <div className={styles.list}>
                  {filteredComments.map(comment => (
                    <div key={comment.id} className={styles.commentWrapper}>
                      <CommentItem
                        comment={comment}
                        onLike={handleLike}
                        onReply={handleReply}
                        onDelete={deleteComment}
                        onLoadMoreReplies={handleLoadMoreReplies}
                      />
                      {replyTo?.commentId === comment.id && (
                        <div className={styles.replyInput}>
                          <CommentInput
                            storyId={storyId}
                            chapterId={chapterId}
                            replyTo={replyTo}
                            onSubmit={handleAddReply}
                            onCancel={() => setReplyTo(null)}
                            isDisabled={isSubmitting}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {loading && (
                  <div className={styles.loadingContainer}>
                    <div className={styles.loading}></div>
                    <span>加载中...</span>
                  </div>
                )}
                
                {hasMore && !loading && activeFilter === CommentFilterType.ALL && (
                  <button 
                    className={styles.loadMoreButton}
                    onClick={loadMore}
                  >
                    加载更多评论
                  </button>
                )}
                
                {!hasMore && !loading && filteredComments.length > 0 && (
                  <div className={styles.endMessage}>
                    已经到底了~
                  </div>
                )}
              </>
            ) : loading ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loading}></div>
                <span>加载中...</span>
              </div>
            ) : (
              <div className={styles.emptyState}>
                {activeFilter === CommentFilterType.ALL ? 
                  '暂无评论，快来发表第一条评论吧~' :
                  activeFilter === CommentFilterType.HOT ? 
                    '暂无热门评论，参与评论互动可能成为热评~' :
                    '暂无今日热评，快来发表精彩评论吧~'
                }
              </div>
            )}
          </div>
        </>
      )}
      
      {/* 回到顶部按钮 */}
      {showScrollButton && (
        <button 
          className={styles.scrollTopButton}
          onClick={scrollToTop}
          aria-label="回到顶部"
        >
          <BsArrowsCollapse />
        </button>
      )}
    </div>
  )
}

export default CommentList 
