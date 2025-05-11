import React from 'react'
import styles from './styles.module.css'

interface LoadingSpinnerProps {
  size?: number;
}

export function LoadingSpinner({ size }: LoadingSpinnerProps) {
  const sizeStyle = size ? { width: `${size}px`, height: `${size}px` } : {};
  
  return (
    <div className={styles.spinner} style={sizeStyle}>
      <div className={styles.dot} style={size ? { width: `${size / 4}px`, height: `${size / 4}px` } : {}}></div>
      <div className={styles.dot} style={size ? { width: `${size / 4}px`, height: `${size / 4}px` } : {}}></div>
      <div className={styles.dot} style={size ? { width: `${size / 4}px`, height: `${size / 4}px` } : {}}></div>
    </div>
  )
} 