import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDropzone } from 'react-dropzone'
import { useTranslation } from 'react-i18next'
import { FileUp, X, FileText, AlertCircle } from 'lucide-react'
import { useUpload } from '@/hooks/use-upload'
import { UploadProgress } from '@/components/upload/UploadProgress'

interface UploadModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

const MAX_FILE_SIZE = 50 * 1024 * 1024

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<Element | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const { upload, isPending, isSuccess, isError, error, reset } = useUpload()

  const handleDrop = useCallback((accepted: File[]) => {
    const file = accepted[0]
    if (file) {
      setSelectedFile(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isPending,
  })

  const handleUpload = useCallback(() => {
    if (selectedFile) {
      upload(selectedFile)
    }
  }, [selectedFile, upload])

  const handleClose = useCallback(() => {
    setSelectedFile(null)
    reset()
    onClose()
  }, [onClose, reset])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    },
    [handleClose],
  )

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement
      modalRef.current?.focus()
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.body.style.overflow = ''
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(handleClose, 600)
      return () => clearTimeout(timer)
    }
  }, [isSuccess, handleClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative mx-4 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl focus:outline-none dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id={titleId}
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {t('upload.title')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {isPending ? (
          <UploadProgress />
        ) : (
          <>
            <div
              {...getRootProps()}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors duration-150 ${
                isDragActive
                  ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700/50 dark:hover:border-slate-500'
              }`}
            >
              <input {...getInputProps()} />
              <FileUp
                className={`h-10 w-10 ${
                  isDragActive
                    ? 'text-blue-500'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
                aria-hidden="true"
              />
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                {t('upload.dropzone')}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {t('upload.maxSize')}
              </p>
            </div>

            {selectedFile && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-700/50">
                <FileText
                  className="h-4 w-4 shrink-0 text-blue-500"
                  aria-hidden="true"
                />
                <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                  {selectedFile.name}
                </span>
                <span className="ml-auto shrink-0 text-xs text-slate-400">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
            )}

            {isError && (
              <div
                className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/30"
                role="alert"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                  aria-hidden="true"
                />
                <p className="text-sm text-red-700 dark:text-red-400">
                  {t('error.upload')}
                  {error?.message ? `: ${error.message}` : ''}
                </p>
              </div>
            )}

            {isSuccess && (
              <div
                className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
                role="status"
              >
                Upload complete
              </div>
            )}

            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || isPending}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-600 dark:disabled:text-slate-400 dark:focus:ring-offset-slate-800"
            >
              {t('upload.confirm')}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
