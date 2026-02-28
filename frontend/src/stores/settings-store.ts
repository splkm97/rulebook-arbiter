import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  readonly model: string
  readonly language: 'ko' | 'en'
  readonly preset: string
  readonly availableModels: readonly string[]
  readonly availablePresets: readonly string[]
  readonly setModel: (model: string) => void
  readonly setLanguage: (lang: 'ko' | 'en') => void
  readonly setPreset: (preset: string) => void
  readonly setAvailableModels: (models: readonly string[]) => void
  readonly setAvailablePresets: (presets: readonly string[]) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      model: '',
      language: 'ko',
      preset: 'arbiter',
      availableModels: [],
      availablePresets: [],

      setModel: (model) => set({ model }),

      setLanguage: (language) => set({ language }),

      setPreset: (preset) => set({ preset }),

      setAvailableModels: (availableModels) => set({ availableModels }),

      setAvailablePresets: (availablePresets) => set({ availablePresets }),
    }),
    {
      name: 'rulebook-settings',
      partialize: (state) => ({
        model: state.model,
        language: state.language,
      }),
    },
  ),
)
