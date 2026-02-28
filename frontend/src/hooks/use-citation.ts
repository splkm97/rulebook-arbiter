import { useQuery } from '@tanstack/react-query'
import { getSourceDetail } from '@/api/sources'
import { useSessionStore } from '@/stores/session-store'

export function useCitation(chunkId: string, enabled: boolean = false) {
  const sessionId = useSessionStore((s) => s.sessionId)

  return useQuery({
    queryKey: ['source', sessionId, chunkId],
    queryFn: () => {
      if (!sessionId) {
        throw new Error('No active session')
      }
      return getSourceDetail(sessionId, chunkId)
    },
    enabled: enabled && !!sessionId,
    staleTime: Infinity,
  })
}
