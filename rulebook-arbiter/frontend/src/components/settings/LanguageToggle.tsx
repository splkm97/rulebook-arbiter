import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/stores/settings-store'

export function LanguageToggle() {
  const { i18n } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)

  const toggle = useCallback(() => {
    const next = language === 'ko' ? 'en' : 'ko'
    setLanguage(next)
    i18n.changeLanguage(next)
  }, [language, setLanguage, i18n])

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch language to ${language === 'ko' ? 'English' : 'Korean'}`}
      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-600"
    >
      {language === 'ko' ? 'EN' : '한국어'}
    </button>
  )
}
