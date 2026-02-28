import { useMemo, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { splitByCitations, parseCitations } from '@/lib/citation-parser'
import { CitationPopover } from '@/components/chat/CitationPopover'
import type { SourceInfo } from '@/types'

interface MessageContentProps {
  readonly content: string
  readonly sources?: readonly SourceInfo[]
  /** User query for source text highlighting */
  readonly query?: string
}

function findSourceForCitation(
  page: number,
  section: string,
  sources: readonly SourceInfo[],
): SourceInfo | undefined {
  return sources.find(
    (s) =>
      s.page === page &&
      (section === '' || s.section === section),
  )
}

function renderTextWithCitations(
  text: string,
  sources: readonly SourceInfo[],
  query: string,
): ReactNode[] {
  const parts = splitByCitations(text)
  const citations = parseCitations(text)
  let citationIndex = 0

  return parts.map((part, i) => {
    if (part.type === 'citation') {
      const citation = citations[citationIndex]
      citationIndex++
      if (citation) {
        const source = findSourceForCitation(
          citation.page,
          citation.section,
          sources,
        )
        return (
          <CitationPopover
            key={`citation-${i}`}
            citationText={part.value}
            source={source}
            query={query}
          />
        )
      }
    }
    return <span key={`text-${i}`}>{part.value}</span>
  })
}

export function MessageContent({ content, sources = [], query = '' }: MessageContentProps) {
  const hasCitations = useMemo(
    () => parseCitations(content).length > 0,
    [content],
  )

  if (!hasCitations) {
    return (
      <div className="prose prose-sm prose-slate max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none dark:prose-code:bg-slate-700">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    )
  }

  return (
    <div className="prose prose-sm prose-slate max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none dark:prose-code:bg-slate-700">
      <ReactMarkdown
        components={{
          p: ({ children }) => {
            if (typeof children === 'string') {
              return <p>{renderTextWithCitations(children, sources, query)}</p>
            }

            const processed = processChildren(children, sources, query)
            return <p>{processed}</p>
          },
          li: ({ children }) => {
            if (typeof children === 'string') {
              return <li>{renderTextWithCitations(children, sources, query)}</li>
            }

            const processed = processChildren(children, sources, query)
            return <li>{processed}</li>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function processChildren(
  children: ReactNode,
  sources: readonly SourceInfo[],
  query: string,
): ReactNode {
  if (typeof children === 'string') {
    return renderTextWithCitations(children, sources, query)
  }

  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === 'string') {
        return (
          <span key={i}>
            {renderTextWithCitations(child, sources, query)}
          </span>
        )
      }
      return child
    })
  }

  return children
}
