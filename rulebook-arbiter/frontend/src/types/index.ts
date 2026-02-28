export interface UploadResponse {
  readonly session_id: string
  readonly title: string
  readonly total_pages: number
  readonly total_chunks: number
}

export interface SourceInfo {
  readonly chunk_id: string
  readonly page: number
  readonly section: string | null
  readonly label: string
  readonly score: number
}

export interface ChatResponse {
  readonly answer: string
  readonly sources: readonly SourceInfo[]
  readonly model_used: string
}

export interface SourceDetail {
  readonly chunk_id: string
  readonly text: string
  readonly page: number
  readonly section: string | null
}

export interface SettingsResponse {
  readonly model: string
  readonly available_models: readonly string[]
}

export interface ChatMessage {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly sources?: readonly SourceInfo[]
}

export interface ApiError {
  readonly error: string
  readonly detail?: string
}
