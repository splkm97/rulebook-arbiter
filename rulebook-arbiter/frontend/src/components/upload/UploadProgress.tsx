import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

export function UploadProgress() {
  const { t } = useTranslation()

  return (
    <div
      className="flex flex-col items-center gap-3 py-8"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Loader2
        className="h-8 w-8 animate-spin text-blue-500"
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {t('upload.processing')}
      </p>
    </div>
  )
}
