import { create } from 'zustand'
import type { ChatMessage, SourceInfo } from '@/types'

interface ChatState {
  readonly messages: readonly ChatMessage[]
  readonly isLoading: boolean
  readonly addUserMessage: (content: string) => string
  readonly addAssistantMessage: (
    content: string,
    sources: readonly SourceInfo[],
  ) => void
  readonly setLoading: (loading: boolean) => void
  readonly clearMessages: () => void
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,

  addUserMessage: (content) => {
    const id = generateId()
    set((state) => ({
      messages: [
        ...state.messages,
        { id, role: 'user' as const, content },
      ],
    }))
    return id
  },

  addAssistantMessage: (content, sources) => {
    const id = generateId()
    set((state) => ({
      messages: [
        ...state.messages,
        { id, role: 'assistant' as const, content, sources },
      ],
    }))
  },

  setLoading: (loading) => set({ isLoading: loading }),

  clearMessages: () => set({ messages: [], isLoading: false }),
}))
