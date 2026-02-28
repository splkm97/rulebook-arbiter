import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Loader2, X } from 'lucide-react'
import { useCitation } from '@/hooks/use-citation'
import type { SourceInfo } from '@/types'

interface CitationPopoverProps {
  readonly citationText: string
  readonly source?: SourceInfo
}

export function CitationPopover({ citationText, source }: CitationPopoverProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [shouldFetch, setShouldFetch] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const chunkId = source?.chunk_id ?? ''
  const { data, isLoading, isError } = useCitation(chunkId, shouldFetch)

  const handleClick = useCallback(() => {
    setIsOpen((prev) => !prev)
    if (!shouldFetch && source) {
      setShouldFetch(true)
    }
  }, [shouldFetch, source])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    buttonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <span className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        aria-expanded={isOpen}
        aria-label={`View source: ${citationText}`}
        className="inline-flex items-center gap-0.5 rounded-md bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700 transition-colors duration-150 hover:bg-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
      >
        <BookOpen className="h-3 w-3" aria-hidden="true" />
        {citationText}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="tooltip"
          className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-800 sm:w-80"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {source && (
                <>
                  <span>
                    {t('source.page')} {source.page}
                  </span>
                  {source.section && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <span>{source.section}</span>
                    </>
                  )}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close source detail"
              className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-500 dark:text-slate-400">
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              {t('source.loading')}
            </div>
          )}

          {isError && (
            <p className="py-2 text-sm text-red-500 dark:text-red-400">
              {t('source.error')}
            </p>
          )}

          {data && (
            <div className="max-h-48 overflow-y-auto rounded bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-700 dark:bg-slate-700/50 dark:text-slate-300">
              {data.text}
            </div>
          )}

          <div className="absolute -bottom-1.5 left-4 h-3 w-3 rotate-45 border-b border-r border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800" />
        </div>
      )}
    </span>
  )
}
