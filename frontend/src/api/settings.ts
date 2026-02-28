import { get, put } from '@/api/client'
import type { SettingsResponse } from '@/types'

export async function getSettings(sessionId: string): Promise<SettingsResponse> {
  return get<SettingsResponse>(
    `/settings?session_id=${encodeURIComponent(sessionId)}`,
  )
}

export async function updateModel(
  sessionId: string,
  model: string,
): Promise<SettingsResponse> {
  return put<SettingsResponse>(
    `/settings?session_id=${encodeURIComponent(sessionId)}`,
    { model },
  )
}

export async function updatePreset(
  sessionId: string,
  preset: string,
): Promise<SettingsResponse> {
  return put<SettingsResponse>(
    `/settings?session_id=${encodeURIComponent(sessionId)}`,
    { preset },
  )
}
