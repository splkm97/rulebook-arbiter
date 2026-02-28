import { useMemo } from 'react'
import { computeHighlightSegments } from '@/lib/highlight-utils'

interface HighlightedTextProps {
  /** Full chunk text to display */
  readonly text: string
  /** User query for keyword matching */
  readonly query: string
}

function scoreToClass(score: number): string {
  if (score >= 0.6) {
    return 'bg-amber-200/70 dark:bg-amber-500/30'
  }
  if (score >= 0.3) {
    return 'bg-yellow-100/80 dark:bg-yellow-500/20'
  }
  if (score > 0) {
    return 'bg-yellow-50/60 dark:bg-yellow-600/10'
  }
  return ''
}

export function HighlightedText({ text, query }: HighlightedTextProps) {
  const segments = useMemo(
    () => computeHighlightSegments(text, query),
    [text, query],
  )

  const hasHighlights = segments.some((s) => s.score > 0)

  if (!hasHighlights) {
    return <>{text}</>
  }

  return (
    <>
      {segments.map((segment, i) => {
        const cls = scoreToClass(segment.score)
        if (!cls) {
          return (
            <span key={i}>
              {segment.text}
              {i < segments.length - 1 ? ' ' : ''}
            </span>
          )
        }
        return (
          <mark
            key={i}
            className={`${cls} rounded-sm px-0.5 text-inherit`}
          >
            {segment.text}
            {i < segments.length - 1 ? ' ' : ''}
          </mark>
        )
      })}
    </>
  )
}
