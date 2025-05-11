'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiConfig } from 'wagmi'
import { config } from '../../config/wagmi'
import { ReadingSettingsProvider } from '../../context/ReadingSettingsContext'
import { AuthProvider } from '@/hooks/useAuth'
import { LoginModalProvider } from '@/context/LoginModalContext'
import LoginModal from '@/components/auth/LoginModal'

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient()
  
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LoginModalProvider>
            <ReadingSettingsProvider>
              {children}
              <LoginModal />
            </ReadingSettingsProvider>
          </LoginModalProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}
