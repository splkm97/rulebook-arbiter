import { useCallback, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { ChatPanel } from '@/components/chat/ChatPanel'

export function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false)
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-slate-900">
      {/* Desktop sidebar */}
      <div className="hidden w-[364px] shrink-0 md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={closeSidebar}
          role="presentation"
        >
          <div
            className="h-full w-[364px]"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center md:hidden">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            className="flex h-12 w-12 items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {isSidebarOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
          <div className="flex-1">
            <Header />
          </div>
        </div>

        <div className="hidden md:block">
          <Header />
        </div>

        <main className="flex-1 overflow-hidden">
          <ChatPanel />
        </main>
      </div>
    </div>
  )
}
