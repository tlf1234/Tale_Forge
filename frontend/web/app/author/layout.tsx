'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './layout.module.css'

export default function AuthorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className={styles.layout}>
      {/* 侧边栏 */}
      <aside className={styles.sidebar}>
        <nav className={styles.nav}>
          <Link 
            href="/author"
            className={`${styles.navLink} ${pathname === '/author' ? styles.active : ''}`}
          >
            创作中心
          </Link>
          <Link 
            href="/author/write"
            className={`${styles.navLink} ${pathname === '/author/write' ? styles.active : ''}`}
          >
            开始创作
          </Link>
          <Link 
            href="/author/works"
            className={`${styles.navLink} ${pathname === '/author/works' ? styles.active : ''}`}
          >
            作品管理
          </Link>
          <Link 
            href="/author/stats"
            className={`${styles.navLink} ${pathname === '/author/stats' ? styles.active : ''}`}
          >
            数据分析
          </Link>
          <Link 
            href="/author/earnings"
            className={`${styles.navLink} ${pathname === '/author/earnings' ? styles.active : ''}`}
          >
            收益管理
          </Link>
        </nav>
      </aside>

      {/* 主要内容区域 */}
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
} 