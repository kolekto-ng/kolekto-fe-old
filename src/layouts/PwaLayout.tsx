import React from 'react'
import { useLocation } from 'react-router-dom'

interface PwaLayoutProps {
  children: React.ReactNode
}

const PwaLayout: React.FC<PwaLayoutProps> = ({ children }) => {
  const location = useLocation()

  // Hide header for dashboard, splash, and auth pages (they have their own headers)
  const hideHeader = ['/dashboard', '/', '/login', '/register', '/forgot-password', '/reset-password'].includes(
    location.pathname
  )

  return (
    <div className="min-h-screen bg-white">
      {!hideHeader && (
        <header className="sticky top-0 z-10 border-b bg-white">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="text-lg font-semibold">Kolekto</div>
            <div className="text-xs text-gray-500">PWA</div>
          </div>
        </header>
      )}
      <main className={hideHeader ? '' : 'max-w-5xl mx-auto px-4 py-6'}>{children}</main>
    </div>
  )
}

export default PwaLayout


