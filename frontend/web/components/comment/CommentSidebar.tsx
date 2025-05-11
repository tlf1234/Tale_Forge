import React, { useEffect, useRef } from 'react'
import { IoClose } from 'react-icons/io5'
import CommentList from './CommentList'
import styles from './CommentSidebar.module.css'

interface CommentSidebarProps {
  storyId: string
  chapterId: string
  onClose: () => void
}

const CommentSidebar: React.FC<CommentSidebarProps> = ({
  storyId,
  chapterId,
  onClose
}) => {
  const sidebarRef = useRef<HTMLDivElement>(null)
  
  // 处理点击外部关闭侧边栏
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    
    // 添加点击事件监听器
    document.addEventListener('mousedown', handleOutsideClick)
    
    // 添加Esc键关闭侧边栏
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEscKey)
    
    // 打开时禁止背景滚动
    document.body.style.overflow = 'hidden'
    
    // 清理函数
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  
  // 侧边栏打开动画
  useEffect(() => {
    if (sidebarRef.current) {
      sidebarRef.current.classList.add(styles.visible)
    }
    
    return () => {
      if (sidebarRef.current) {
        sidebarRef.current.classList.remove(styles.visible)
      }
    }
  }, [])
  
  return (
    <aside className={styles.backdrop}>
      <div className={styles.sidebar} ref={sidebarRef}>
        <div className={styles.header}>
          <h2 className={styles.title}>评论</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <IoClose />
          </button>
        </div>
        
        <div className={styles.content}>
          <CommentList 
            storyId={storyId} 
            chapterId={chapterId}
          />
        </div>
      </div>
    </aside>
  )
}

export default CommentSidebar 