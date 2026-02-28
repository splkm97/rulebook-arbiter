import { useEffect, useRef } from 'react'
import { getSessionMetadata } from '@/api/sessions'
import { getSettings } from '@/api/settings'
import { ApiClientError } from '@/api/client'
import { useSessionStore } from '@/stores/session-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useChatStore } from '@/stores/chat-store'
import type { ChatMessage, ConversationTurn } from '@/types'

function conversationToMessages(
  sessionId: string,
  conversation: readonly ConversationTurn[],
): ChatMessage[] {
  return conversation.map((turn, i) => ({
    id: `hydrated-${sessionId}-${i}`,
    role: turn.role,
    content: turn.content,
  }))
}

/**
 * Validates the persisted session against the backend on mount and
 * whenever the sessionId changes (e.g. uploading a second PDF).
 *
 * If the backend still holds the session, store metadata is refreshed
 * and conversation history is restored into the chat store.
 * If the session is gone (404), local state is cleared gracefully.
 * Transient network errors leave persisted state intact.
 */
export function useSessionHydration(): void {
  const lastHydratedId = useRef<string | null>(null)

  const sessionId = useSessionStore((s) => s.sessionId)
  const setSession = useSessionStore((s) => s.setSession)
  const clearSession = useSessionStore((s) => s.clearSession)
  const setModel = useSettingsStore((s) => s.setModel)
  const setPreset = useSettingsStore((s) => s.setPreset)
  const setAvailableModels = useSettingsStore((s) => s.setAvailableModels)
  const setAvailablePresets = useSettingsStore((s) => s.setAvailablePresets)
  const setMessages = useChatStore((s) => s.setMessages)
  const clearMessages = useChatStore((s) => s.clearMessages)

  useEffect(() => {
    if (!sessionId || lastHydratedId.current === sessionId) return
    lastHydratedId.current = sessionId

    async function validate() {
      try {
        const meta = await getSessionMetadata(sessionId!)

        // Refresh store with authoritative backend data
        setSession({
          session_id: meta.session_id,
          title: meta.title,
          total_pages: meta.total_pages,
          total_chunks: meta.total_chunks,
        })

        // Restore chat messages from backend conversation history
        if (meta.conversation.length > 0) {
          setMessages(conversationToMessages(sessionId!, meta.conversation))
        }

        // Fetch current settings for this session
        const settings = await getSettings(sessionId!)
        setModel(settings.model)
        setPreset(settings.preset)
        setAvailableModels(settings.available_models)
        setAvailablePresets(settings.available_presets)
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          // Session expired or server restarted — clear gracefully
          clearSession()
          clearMessages()
          lastHydratedId.current = null
        }
        // Network errors: leave persisted state intact
      }
    }

    validate()
  }, [
    sessionId,
    setSession,
    clearSession,
    setModel,
    setPreset,
    setAvailableModels,
    setAvailablePresets,
    setMessages,
    clearMessages,
  ])
}
