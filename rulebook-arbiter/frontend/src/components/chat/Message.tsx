import { memo } from 'react'
import { User, Bot } from 'lucide-react'
import { MessageContent } from '@/components/chat/MessageContent'
import type { ChatMessage } from '@/types'

interface MessageProps {
  readonly message: ChatMessage
  /** The user query that triggered this assistant response (empty for user messages) */
  readonly query?: string
}

export const Message = memo(function Message({ message, query = '' }: MessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={`flex gap-3 px-4 py-3 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
        }`}
        aria-hidden="true"
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>

      <div
        className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <MessageContent
            content={message.content}
            sources={message.sources}
            query={query}
          />
        )}
      </div>
    </div>
  )
})
