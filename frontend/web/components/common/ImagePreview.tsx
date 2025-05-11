'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import styles from './ImagePreview.module.css'
import { IoClose, IoAdd, IoRemove } from 'react-icons/io5'

interface ImagePreviewProps {
  src: string
  alt: string
  onClose: () => void
}

export default function ImagePreview({ src, alt, onClose }: ImagePreviewProps) {
  const [scale, setScale] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })

  // 格式化缩放百分比显示
  const formatZoomPercentage = () => {
    return `${Math.round(scale * 100)}%`;
  };

  // 按ESC键关闭预览
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    // 鼠标滚轮缩放
    const handleWheel = (e: Event) => {
      const wheelEvent = e as WheelEvent
      wheelEvent.preventDefault()
      setScale(prev => {
        const delta = wheelEvent.deltaY * -0.005
        const newScale = Math.min(Math.max(0.5, prev + delta), 4)
        return newScale
      })
    }
    
    window.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden' // 防止背景滚动
    
    // 添加滚轮事件监听器
    const previewElement = document.querySelector(`.${styles.imageWrapper}`)
    if (previewElement) {
      previewElement.addEventListener('wheel', handleWheel, { passive: false })
    }
    
    return () => {
      window.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = '' // 恢复背景滚动
      if (previewElement) {
        previewElement.removeEventListener('wheel', handleWheel)
      }
    }
  }, [onClose])

  // 处理缩放
  const handleZoom = (direction: 'in' | 'out') => {
    setScale(prev => {
      const delta = direction === 'in' ? 0.2 : -0.2
      return Math.min(Math.max(0.5, prev + delta), 4)
    })
  }

  // 重置缩放和位置
  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  // 处理拖动开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsPanning(true)
      setStartPos({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }

  // 处理拖动中
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && scale > 1) {
      setPosition({
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y
      })
    }
  }

  // 处理拖动结束
  const handleMouseUp = () => {
    setIsPanning(false)
  }

  // 处理触摸事件
  useEffect(() => {
    const handleTouchStart = (e: Event) => {
      const touchEvent = e as TouchEvent
      if (touchEvent.touches.length === 1 && scale > 1) {
        const touch = touchEvent.touches[0]
        setIsPanning(true)
        setStartPos({
          x: touch.clientX - position.x,
          y: touch.clientY - position.y
        })
      }
    }

    const handleTouchMove = (e: Event) => {
      const touchEvent = e as TouchEvent
      if (touchEvent.touches.length === 1 && isPanning && scale > 1) {
        const touch = touchEvent.touches[0]
        setPosition({
          x: touch.clientX - startPos.x,
          y: touch.clientY - startPos.y
        })
        touchEvent.preventDefault() // 防止页面滚动
      }
    }

    const handleTouchEnd = () => {
      setIsPanning(false)
    }

    const imageWrapper = document.querySelector(`.${styles.imageWrapper}`)
    if (imageWrapper) {
      imageWrapper.addEventListener('touchstart', handleTouchStart, { passive: false })
      imageWrapper.addEventListener('touchmove', handleTouchMove, { passive: false })
      imageWrapper.addEventListener('touchend', handleTouchEnd)
    }

    return () => {
      if (imageWrapper) {
        imageWrapper.removeEventListener('touchstart', handleTouchStart)
        imageWrapper.removeEventListener('touchmove', handleTouchMove)
        imageWrapper.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [isPanning, position, scale, startPos])

  // 阻止冒泡，防止点击图片时关闭预览
  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div 
        className={styles.content} 
        onClick={handleImageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <button className={styles.closeButton} onClick={onClose}>
          <IoClose size={24} />
        </button>
        
        <div className={styles.zoomControls}>
          <button className={styles.zoomButton} onClick={() => handleZoom('in')} title="放大">
            <IoAdd size={20} />
          </button>
          <button 
            className={`${styles.zoomButton} ${styles.zoomPercentage}`} 
            onClick={() => resetZoom()} 
            title="重置缩放"
          >
            {formatZoomPercentage()}
          </button>
          <button className={styles.zoomButton} onClick={() => handleZoom('out')} title="缩小">
            <IoRemove size={20} />
          </button>
        </div>
        
        <div className={styles.imageWrapper}>
          <div 
            className={styles.imageContainer}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              cursor: scale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'
            }}
          >
            <img
              src={src}
              alt={alt}
              className={styles.image}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 