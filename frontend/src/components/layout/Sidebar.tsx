import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Upload,
  FileText,
  Layers,
  Plus,
  BookOpen,
} from 'lucide-react'
import { useSessionStore } from '@/stores/session-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useChatStore } from '@/stores/chat-store'
import { UploadModal } from '@/components/upload/UploadModal'

export function Sidebar() {
  const { t } = useTranslation()
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const sessionId = useSessionStore((s) => s.sessionId)
  const rulebookTitle = useSessionStore((s) => s.rulebookTitle)
  const totalPages = useSessionStore((s) => s.totalPages)
  const totalChunks = useSessionStore((s) => s.totalChunks)
  const clearSession = useSessionStore((s) => s.clearSession)
  const setModel = useSettingsStore((s) => s.setModel)
  const setPreset = useSettingsStore((s) => s.setPreset)
  const setAvailableModels = useSettingsStore((s) => s.setAvailableModels)
  const setAvailablePresets = useSettingsStore((s) => s.setAvailablePresets)
  const clearMessages = useChatStore((s) => s.clearMessages)

  const handleOpenUpload = useCallback(() => {
    setIsUploadOpen(true)
  }, [])

  const handleCloseUpload = useCallback(() => {
    setIsUploadOpen(false)
  }, [])

  const handleNewSession = useCallback(() => {
    clearSession()
    clearMessages()
    setModel('')
    setPreset('arbiter')
    setAvailableModels([])
    setAvailablePresets([])
  }, [clearSession, clearMessages, setModel, setPreset, setAvailableModels, setAvailablePresets])

  return (
    <>
      <aside className="flex h-full w-full flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
        <div className="p-3">
          <button
            type="button"
            onClick={handleOpenUpload}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {t('upload.button')}
          </button>
        </div>

        {sessionId && (
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="mb-2.5 text-[13px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t('session.info')}
              </h3>

              {rulebookTitle && (
                <div className="mb-3 flex items-start gap-2">
                  <BookOpen
                    className="mt-0.5 h-4 w-4 shrink-0 text-blue-500"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium leading-tight text-slate-700 dark:text-slate-300">
                    {rulebookTitle}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {totalPages} {t('session.pages')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {totalChunks} {t('session.chunks')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!sessionId && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200/60 dark:bg-slate-700">
              <BookOpen
                className="h-6 w-6 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {t('chat.emptyHint')}
            </p>
          </div>
        )}

        <div className="border-t border-slate-200 p-3 dark:border-slate-700">
          <button
            type="button"
            onClick={handleNewSession}
            disabled={!sessionId}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t('session.new')}
          </button>
        </div>
      </aside>

      <UploadModal isOpen={isUploadOpen} onClose={handleCloseUpload} />
    </>
  )
}
