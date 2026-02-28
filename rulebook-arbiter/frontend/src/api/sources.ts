import { get } from '@/api/client'
import type { SourceDetail } from '@/types'

export async function getSourceDetail(
  sessionId: string,
  chunkId: string,
): Promise<SourceDetail> {
  return get<SourceDetail>(
    `/sources/${encodeURIComponent(chunkId)}?session_id=${encodeURIComponent(sessionId)}`,
  )
}
