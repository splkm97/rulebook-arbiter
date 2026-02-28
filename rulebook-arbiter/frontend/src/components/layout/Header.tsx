import { useTranslation } from 'react-i18next'
import { Gavel, BookCheck } from 'lucide-react'
import { useSessionStore } from '@/stores/session-store'
import { ModelSelector } from '@/components/settings/ModelSelector'
import { LanguageToggle } from '@/components/settings/LanguageToggle'

export function Header() {
  const { t } = useTranslation()
  const rulebookTitle = useSessionStore((s) => s.rulebookTitle)

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Gavel
            className="h-5 w-5 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
          <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {t('header.title')}
          </h1>
        </div>

        {rulebookTitle && (
          <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 sm:flex dark:border-slate-600 dark:bg-slate-700">
            <BookCheck
              className="h-3.5 w-3.5 text-green-600 dark:text-green-400"
              aria-hidden="true"
            />
            <span className="max-w-[200px] truncate text-xs font-medium text-slate-600 dark:text-slate-300">
              {rulebookTitle}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ModelSelector />
        <LanguageToggle />
      </div>
    </header>
  )
}
