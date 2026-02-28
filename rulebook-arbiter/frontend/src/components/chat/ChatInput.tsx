import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SendHorizontal } from 'lucide-react'
import { useSessionStore } from '@/stores/session-store'
import { useChatStore } from '@/stores/chat-store'

interface ChatInputProps {
  readonly onSend: (message: string) => void
}

const MAX_ROWS = 6
const LINE_HEIGHT = 20

export function ChatInput({ onSend }: ChatInputProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sessionId = useSessionStore((s) => s.sessionId)
  const isLoading = useChatStore((s) => s.isLoading)

  const isDisabled = !sessionId || isLoading
  const canSend = value.trim().length > 0 && !isDisabled

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = MAX_ROWS * LINE_HEIGHT + 16
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed && !isDisabled) {
      onSend(trimmed)
      setValue('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }, [value, isDisabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)
      adjustHeight()
    },
    [adjustHeight],
  )

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.placeholder')}
          disabled={isDisabled}
          rows={1}
          aria-label={t('chat.placeholder')}
          className="min-h-[36px] flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors duration-150 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:border-blue-400 dark:focus:bg-slate-700"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label={t('chat.send')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors duration-150 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-600 dark:disabled:text-slate-400 dark:focus:ring-offset-slate-800"
        >
          <SendHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1 text-center text-[10px] text-slate-400 dark:text-slate-500">
        Ctrl+Enter / Cmd+Enter
      </p>
    </div>
  )
}
