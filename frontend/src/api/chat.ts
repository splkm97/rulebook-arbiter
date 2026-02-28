import { post } from '@/api/client'
import type { ChatResponse } from '@/types'

export async function sendMessage(
  sessionId: string,
  message: string,
): Promise<ChatResponse> {
  return post<ChatResponse>('/chat', {
    session_id: sessionId,
    message,
  })
}
