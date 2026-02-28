import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'
import { useChatStore } from '@/stores/chat-store'
import { Message } from '@/components/chat/Message'
import { TypingIndicator } from '@/components/chat/TypingIndicator'

export function MessageList() {
  const { t } = useTranslation()
  const messages = useChatStore((s) => s.messages)
  const isLoading = useChatStore((s) => s.isLoading)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, isLoading])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700">
          <BookOpen
            className="h-8 w-8 text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {t('chat.empty')}
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {t('chat.emptyHint')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto scroll-smooth"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      <div className="flex flex-col py-2">
        {messages.map((msg) => (
          <Message key={msg.id} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
      </div>
    </div>
  )
}
