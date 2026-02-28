import { create } from 'zustand'
import type { UploadResponse } from '@/types'

interface SessionState {
  readonly sessionId: string | null
  readonly rulebookTitle: string | null
  readonly totalPages: number
  readonly totalChunks: number
  readonly setSession: (data: UploadResponse) => void
  readonly clearSession: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  rulebookTitle: null,
  totalPages: 0,
  totalChunks: 0,

  setSession: (data) =>
    set({
      sessionId: data.session_id,
      rulebookTitle: data.title,
      totalPages: data.total_pages,
      totalChunks: data.total_chunks,
    }),

  clearSession: () =>
    set({
      sessionId: null,
      rulebookTitle: null,
      totalPages: 0,
      totalChunks: 0,
    }),
}))
