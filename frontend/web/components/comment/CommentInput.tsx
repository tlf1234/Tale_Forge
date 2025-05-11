import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { IoSend, IoClose } from 'react-icons/io5'
import styles from './CommentInput.module.css'
import type { CommentInputProps } from '@/types/comment'
import { useAuth } from '@/hooks/useAuth'
import { useLoginModal } from '@/context/LoginModalContext'

const MAX_COMMENT_LENGTH = 500

const CommentInput: React.FC<CommentInputProps> = ({
  storyId,
  chapterId,
  replyTo,
  onSubmit,
  onCancel,
  isDisabled = false
}) => {
  const { user, isAuthenticated } = useAuth()
  const { openLoginModal } = useLoginModal()
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 聚焦输入框
  useEffect(() => {
    if (textareaRef.current && replyTo) {
      textareaRef.current.focus()
    }
  }, [replyTo])

  // 自适应文本框高度
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const adjustHeight = () => {
      textarea.style.height = 'auto'
      const scrollHeight = textarea.scrollHeight
      textarea.style.height = `${scrollHeight}px`
    }

    textarea.addEventListener('input', adjustHeight)
    
    // 初始设置
    adjustHeight()
    
    return () => {
      textarea.removeEventListener('input', adjustHeight)
    }
  }, [])

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting || isDisabled || !isAuthenticated) return

    try {
      setIsSubmitting(true)
      await onSubmit(content.trim())
      setContent('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (error) {
      console.error('提交评论失败:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理键盘提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const remainingChars = MAX_COMMENT_LENGTH - content.length
  const isNearLimit = remainingChars <= 50
  const buttonDisabled = !content.trim() || isSubmitting || isDisabled

  // 如果用户未登录，显示登录提示
  if (!isAuthenticated) {
    return (
      <div className={styles.loginPrompt}>
        <div className={styles.loginMessage}>
          请先<button onClick={() => openLoginModal()} className={styles.loginLink}>登录</button>后参与评论
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.container} ${isDisabled ? styles.disabled : ''}`}>
      <div className={styles.avatar}>
        <Image
          src={user?.avatar || "/images/avatars/default-avatar.svg"}
          alt="用户头像"
          width={40}
          height={40}
          className={styles.avatarImage}
          onError={(e) => {
            // 图片加载失败时处理
            const target = e.target as HTMLImageElement;
            target.onerror = null; // 防止无限循环
            console.error('头像加载失败，使用默认头像');
            target.src = '/images/avatars/default-avatar.svg';
          }}
          unoptimized // 禁用Next.js优化，确保路径正确解析
        />
      </div>
      
      <div className={styles.inputArea}>
        {replyTo && (
          <div className={styles.replyHeader}>
            <span>
              {replyTo.replyId ? (
                <><span className={styles.replyArrow}>→</span> <strong>@{replyTo.replyToName || replyTo.userName}</strong></>
              ) : (
                <>回复 <strong>{replyTo.userName}</strong></>
              )}
            </span>
            <button
              className={styles.cancelButton}
              onClick={onCancel}
              aria-label="取消回复"
              title="取消回复"
              disabled={isDisabled}
            >
              <IoClose />
            </button>
          </div>
        )}
        
        <div className={styles.inputContainer}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={replyTo ? "写下你的回复..." : "写下你的评论..."}
            className={styles.input}
            rows={1}
            maxLength={MAX_COMMENT_LENGTH}
            aria-label={replyTo ? "回复输入框" : "评论输入框"}
            disabled={isDisabled}
          />
          
          {content.length > 0 && (
            <div className={`${styles.charCounter} ${isNearLimit ? styles.charCounterLimit : ''}`}>
              {remainingChars}
            </div>
          )}
          
          <button
            className={`${styles.submitButton} ${buttonDisabled ? styles.disabled : ''}`}
            onClick={handleSubmit}
            disabled={buttonDisabled}
            aria-label="发送评论"
            title={buttonDisabled ? (isDisabled ? "提交已禁用" : "请输入内容") : "发送评论 (Ctrl+Enter)"}
          >
            <IoSend />
          </button>
        </div>
      </div>
    </div>
  )
}

export default CommentInput 