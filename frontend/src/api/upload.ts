import { post } from '@/api/client'
import type { UploadResponse } from '@/types'

export async function uploadPDF(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  return post<UploadResponse>('/upload', formData)
}
