import { useMutation } from '@tanstack/react-query'
import { sendMessage } from '@/api/chat'
import { useChatStore } from '@/stores/chat-store'
import { useSessionStore } from '@/stores/session-store'
import { ApiClientError } from '@/api/client'

export function useChat() {
  const sessionId = useSessionStore((s) => s.sessionId)
  const addUserMessage = useChatStore((s) => s.addUserMessage)
  const addAssistantMessage = useChatStore((s) => s.addAssistantMessage)
  const setLoading = useChatStore((s) => s.setLoading)

  const mutation = useMutation({
    mutationFn: async (message: string) => {
      if (!sessionId) {
        throw new Error('No active session')
      }
      return sendMessage(sessionId, message)
    },
    onMutate: (message) => {
      addUserMessage(message)
      setLoading(true)
    },
    onSuccess: (data) => {
      addAssistantMessage(data.answer, data.sources)
      setLoading(false)
    },
    onError: (error) => {
      const errorMessage =
        error instanceof ApiClientError
          ? error.detail ?? error.error
          : 'Failed to send message'

      addAssistantMessage(errorMessage, [])
      setLoading(false)
    },
  })

  return {
    send: mutation.mutate,
    isPending: mutation.isPending,
  }
}
