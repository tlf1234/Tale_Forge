'use client'

import Providers from './providers/index'
import Layout from '@/components/layout'
import { Header } from '@/components/layout/Header'
import { Toaster } from 'react-hot-toast'

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Providers>
        <Header />
        <Layout>
          {children}
        </Layout>
      </Providers>
      <Toaster position="top-right" />
    </>
  )
}
