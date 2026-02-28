import { useMutation } from '@tanstack/react-query'
import { uploadPDF } from '@/api/upload'
import { useSessionStore } from '@/stores/session-store'
import { useChatStore } from '@/stores/chat-store'
import { getSettings } from '@/api/settings'
import { useSettingsStore } from '@/stores/settings-store'

export function useUpload() {
  const setSession = useSessionStore((s) => s.setSession)
  const clearMessages = useChatStore((s) => s.clearMessages)
  const setModel = useSettingsStore((s) => s.setModel)
  const setAvailableModels = useSettingsStore((s) => s.setAvailableModels)

  const mutation = useMutation({
    mutationFn: uploadPDF,
    onSuccess: async (data) => {
      setSession(data)
      clearMessages()

      try {
        const settings = await getSettings(data.session_id)
        setModel(settings.model)
        setAvailableModels(settings.available_models)
      } catch {
        // Settings fetch is non-critical; session is still valid
      }
    },
  })

  return {
    upload: mutation.mutate,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }
}
