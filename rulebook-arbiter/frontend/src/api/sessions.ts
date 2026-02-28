import { get } from '@/api/client'
import type { SessionMetadataResponse } from '@/types'

export async function getSessionMetadata(
  sessionId: string,
): Promise<SessionMetadataResponse> {
  return get<SessionMetadataResponse>(
    `/sessions/${encodeURIComponent(sessionId)}`,
  )
}
