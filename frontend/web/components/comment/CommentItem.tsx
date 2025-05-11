import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { IoHeartOutline, IoHeart, IoEllipsisVertical } from 'react-icons/io5'
import styles from './CommentItem.module.css'
import type { CommentItemProps } from '@/types/comment'

const DEFAULT_AVATAR = '/images/avatars/default-avatar.svg'

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onLike,
  onReply,
  onDelete,
  onLoadMoreReplies
}) => {
  const [showActions, setShowActions] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [hasMoreReplies, setHasMoreReplies] = useState(
    comment.replyCount > comment.replies.length
  )
  
  // 安全地解构comment对象，提供默认值以防属性不存在
  const { 
    id = '',
    content = '', 
    createdAt = new Date().toISOString(), 
    likes = 0, 
    isLiked = false, 
    replies = [], 
    replyCount = 0,
    isHot = false,
    isTodayHot = false
  } = comment || {}
  
  // 每当评论或回复数量变化时，重新计算是否有更多回复
  useEffect(() => {
    if (comment) {
      const hasMore = comment.replyCount > comment.replies.length;
      console.log(`【CommentItem useEffect】更新hasMoreReplies状态: ${hasMore}, 回复总数: ${comment.replyCount}, 已加载: ${comment.replies.length}`);
      setHasMoreReplies(hasMore);
    }
  }, [comment, comment?.replyCount, comment?.replies.length]);

  // 确保author对象存在，如果不存在则提供默认值
  const author = comment?.author || { id: '0', name: '未知用户', avatar: DEFAULT_AVATAR }

  // 简单的时间格式化函数
  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      
      // 小于1分钟
      if (diff < 60000) {
        return '刚刚'
      }
      // 小于1小时
      if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`
      }
      // 小于24小时
      if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}小时前`
      }
      // 小于30天
      if (diff < 2592000000) {
        return `${Math.floor(diff / 86400000)}天前`
      }
      // 大于30天，显示具体日期
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch (error) {
      console.error('日期格式化错误:', error)
      return '未知时间'
    }
  }

  // 加载更多回复
  const handleLoadMoreReplies = async () => {
    console.log('【handleLoadMoreReplies】点击了加载更多回复按钮', {
      commentId: id,
      loadingReplies,
      hasMoreReplies,
      currentRepliesCount: replies.length,
      totalRepliesCount: replyCount
    });
    
    if (loadingReplies || !onLoadMoreReplies) {
      console.log('【handleLoadMoreReplies】无法加载更多回复，条件不满足', {
        loadingReplies,
        hasOnLoadMoreReplies: !!onLoadMoreReplies
      });
      return;
    }
    
    try {
      setLoadingReplies(true);
      
      // 正确计算加载参数 - 当前已加载的回复数量
      const currentLoadedCount = replies.length;
      console.log(`【handleLoadMoreReplies】加载更多回复，当前已加载${currentLoadedCount}条，总共${replyCount}条`);
      
      // 确保onLoadMoreReplies函数存在
      if (typeof onLoadMoreReplies !== 'function') {
        console.error('【handleLoadMoreReplies】onLoadMoreReplies不是一个函数');
        return;
      }
      
      // 使用currentLoadedCount作为skip参数
      const result = await onLoadMoreReplies(id, currentLoadedCount);
      console.log('【handleLoadMoreReplies】加载结果:', result);
      
      if (result) {
        setHasMoreReplies(result.hasMore);
        console.log(`【handleLoadMoreReplies】加载完成，新增${result.replies.length}条回复，hasMore=${result.hasMore}`);
      } else {
        console.log('【handleLoadMoreReplies】加载结果为空');
        setHasMoreReplies(false);
      }
    } catch (error) {
      console.error('【handleLoadMoreReplies】加载更多回复失败:', error);
      // 发生错误时不改变hasMoreReplies状态，允许用户重试
    } finally {
      setLoadingReplies(false);
    }
  }

  // 如果评论对象不存在，显示占位内容
  if (!comment) {
    return (
      <div className={styles.container}>
        <div className={styles.avatar}>
          <Image
            src={DEFAULT_AVATAR}
            alt="头像"
            width={40}
            height={40}
            className={styles.avatarImage}
            unoptimized
          />
        </div>
        <div className={styles.content}>
          <div className={styles.text}>评论内容加载失败</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* 用户头像 */}
      <div className={styles.avatar}>
        <Image
          src={author?.avatar || DEFAULT_AVATAR}
          alt="头像"
          width={40}
          height={40}
          className={styles.avatarImage}
          onError={(e) => {
            // 图片加载失败时，强制使用默认头像
            const target = e.target as HTMLImageElement;
            target.onerror = null; // 防止无限循环
            target.src = DEFAULT_AVATAR;
          }}
          unoptimized // 禁用Next.js优化，确保路径正确解析
        />
      </div>

      <div className={styles.content}>
        {/* 评论头部 */}
        <div className={styles.header}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {author?.name || '未知用户'}
              {isHot && <span className={styles.hotBadge} title="热门评论">热</span>}
              {isTodayHot && <span className={styles.todayHotBadge} title="今日热评">今</span>}
            </span>
            <span className={styles.time}>{formatTime(createdAt)}</span>
          </div>
          <div className={styles.actions}>
            <button
              className={`${styles.actionButton} ${isLiked ? styles.liked : ''}`}
              onClick={() => onLike(id)}
              aria-label={isLiked ? "取消点赞" : "点赞"}
            >
              {isLiked ? <IoHeart /> : <IoHeartOutline />}
              {likes > 0 && <span className={styles.likeCount}>{likes}</span>}
            </button>
            <button
              className={styles.actionButton}
              onClick={() => onReply(id)}
              aria-label="回复"
            >
              回复
            </button>
            <div className={styles.moreActions}>
              <button
                className={styles.actionButton}
                onClick={() => setShowActions(!showActions)}
                aria-label="更多"
              >
                <IoEllipsisVertical />
              </button>
              {showActions && (
                <div className={styles.actionMenu}>
                  <button
                    className={styles.menuItem}
                    onClick={() => {
                      onDelete(id)
                      setShowActions(false)
                    }}
                  >
                    删除
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 评论内容 */}
        <div className={styles.text}>{content}</div>

        {/* 回复列表 */}
        {replies && replies.length > 0 && (
          <div className={styles.replies}>
            {replies.map((reply) => {
              return (
                <div key={reply.id} className={styles.reply}>
                  <div className={styles.replyAvatar}>
                    <Image
                      src={reply.author?.avatar || DEFAULT_AVATAR}
                      alt="头像"
                      width={24}
                      height={24}
                      className={styles.avatarImage}
                      onError={(e) => {
                        // 图片加载失败时，强制使用默认头像
                        const target = e.target as HTMLImageElement;
                        target.onerror = null; // 防止无限循环
                        target.src = DEFAULT_AVATAR;
                      }}
                      unoptimized // 禁用Next.js优化，确保路径正确解析
                    />
                  </div>
                  <div className={styles.replyContent}>
                    <div className={styles.replyHeader}>
                      <span className={styles.replyUserName}>{reply.author?.name || '未知用户'}</span>
                      
                      <div className={styles.replyRightActions}>
                        <span className={styles.replyTime}>
                          {formatTime(reply.createdAt)}
                        </span>
                        
                        <button
                          className={styles.replyButton}
                          onClick={() => onReply(id, reply.id, reply.author?.name || '未知用户')}
                        >
                          回复
                        </button>
                      </div>
                    </div>
                    <div className={styles.replyText}>
                      {(reply.replyToId && reply.replyToId !== id && reply.replyToName) ? (
                        <span className={styles.replyTag}>
                          <span className={styles.replyArrow}>→</span>
                          <strong>@{reply.replyToName}</strong>
                        </span>
                      ) : null}
                      {reply.content}
                    </div>
                  </div>
                </div>
              )
            })}
            {replyCount > replies.length && (
              <button
                className={`${styles.viewMoreReplies} ${loadingReplies ? styles.loading : ''}`}
                onClick={handleLoadMoreReplies}
                disabled={loadingReplies}
              >
                {loadingReplies 
                  ? '加载中...' 
                  : `查看更多回复 (${replyCount - replies.length})`
                }
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CommentItem 