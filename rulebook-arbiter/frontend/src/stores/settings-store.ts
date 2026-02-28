import { create } from 'zustand'

interface SettingsState {
  readonly model: string
  readonly language: 'ko' | 'en'
  readonly availableModels: readonly string[]
  readonly setModel: (model: string) => void
  readonly setLanguage: (lang: 'ko' | 'en') => void
  readonly setAvailableModels: (models: readonly string[]) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  model: '',
  language: 'ko',
  availableModels: [],

  setModel: (model) => set({ model }),

  setLanguage: (language) => set({ language }),

  setAvailableModels: (availableModels) => set({ availableModels }),
}))
