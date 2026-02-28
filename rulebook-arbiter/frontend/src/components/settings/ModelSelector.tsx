import { useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { updateModel } from '@/api/settings'
import { useSessionStore } from '@/stores/session-store'
import { useSettingsStore } from '@/stores/settings-store'

export function ModelSelector() {
  const { t } = useTranslation()
  const sessionId = useSessionStore((s) => s.sessionId)
  const model = useSettingsStore((s) => s.model)
  const availableModels = useSettingsStore((s) => s.availableModels)
  const setModel = useSettingsStore((s) => s.setModel)

  const { mutate, isPending } = useMutation({
    mutationFn: (newModel: string) => {
      if (!sessionId) throw new Error('No session')
      return updateModel(sessionId, newModel)
    },
    onSuccess: (data) => {
      setModel(data.model)
    },
    onError: (_error, _newModel, context) => {
      // Rollback to previous model on failure
      if (context?.previousModel) {
        setModel(context.previousModel)
      }
    },
    onMutate: (newModel) => {
      const previousModel = model
      setModel(newModel)
      return { previousModel }
    },
  })

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      mutate(e.target.value)
    },
    [mutate],
  )

  if (!sessionId || availableModels.length === 0) {
    return null
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <label
        htmlFor="model-selector"
        className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:block"
      >
        {t('settings.model')}
      </label>
      <div className="relative">
        <select
          id="model-selector"
          value={model}
          onChange={handleChange}
          disabled={isPending}
          className="appearance-none rounded-md border border-slate-200 bg-white px-2.5 py-1 pr-7 text-xs font-medium text-slate-700 transition-colors duration-150 hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        >
          {availableModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
