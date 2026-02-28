import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { GraduationCap, Puzzle, Gavel } from 'lucide-react'
import { updatePreset } from '@/api/settings'
import { useSessionStore } from '@/stores/session-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useChatStore } from '@/stores/chat-store'

const PRESET_ICONS: Partial<Record<string, React.ElementType>> = {
  learn: GraduationCap,
  setup: Puzzle,
  arbiter: Gavel,
}

export function PresetChips() {
  const { t } = useTranslation()
  const sessionId = useSessionStore((s) => s.sessionId)
  const preset = useSettingsStore((s) => s.preset)
  const availablePresets = useSettingsStore((s) => s.availablePresets)
  const setPreset = useSettingsStore((s) => s.setPreset)
  const isLoading = useChatStore((s) => s.isLoading)

  const { mutate, isPending } = useMutation({
    mutationFn: (newPreset: string) => {
      if (!sessionId) throw new Error('No session')
      return updatePreset(sessionId, newPreset)
    },
    onSuccess: (data) => {
      setPreset(data.preset)
    },
    onError: (_error, _newPreset, context) => {
      // Rollback to previous preset on failure
      if (context?.previousPreset) {
        setPreset(context.previousPreset)
      }
    },
    onMutate: (newPreset) => {
      const previousPreset = preset
      setPreset(newPreset)
      return { previousPreset }
    },
  })

  const handleSelect = useCallback(
    (presetId: string) => {
      if (presetId === preset) return
      mutate(presetId)
    },
    [preset, mutate],
  )

  if (!sessionId || availablePresets.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-1.5 border-t border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
      <span className="mr-1 text-xs font-medium text-slate-400 dark:text-slate-500">
        {t('preset.label')}
      </span>
      {availablePresets.map((presetId) => {
        const isActive = presetId === preset
        const Icon = PRESET_ICONS[presetId]
        const name = t(`preset.${presetId}.name`)
        const description = t(`preset.${presetId}.description`)

        return (
          <button
            key={presetId}
            type="button"
            onClick={() => handleSelect(presetId)}
            disabled={isLoading || isPending}
            title={description}
            aria-pressed={isActive}
            aria-label={`${name}: ${description}`}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-slate-800 ${
              isActive
                ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:ring-blue-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            {Icon ? (
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            ) : null}
            {name}
          </button>
        )
      })}
    </div>
  )
}
