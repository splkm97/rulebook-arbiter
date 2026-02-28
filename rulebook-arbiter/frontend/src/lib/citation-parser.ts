export interface Citation {
  readonly full: string
  readonly page: number
  readonly section: string
  readonly index: number
}

const CITATION_PATTERN = /\[p\.(\d+)(?:,\s*§([^\]]+))?\]/g

export function parseCitations(text: string): readonly Citation[] {
  const citations: Citation[] = []
  let match: RegExpExecArray | null

  const regex = new RegExp(CITATION_PATTERN.source, CITATION_PATTERN.flags)

  while ((match = regex.exec(text)) !== null) {
    citations.push({
      full: match[0],
      page: parseInt(match[1] ?? '0', 10),
      section: match[2] ?? '',
      index: match.index,
    })
  }

  return citations
}

export function splitByCitations(
  text: string,
): readonly { readonly type: 'text' | 'citation'; readonly value: string }[] {
  const parts: { type: 'text' | 'citation'; value: string }[] = []
  const regex = new RegExp(CITATION_PATTERN.source, CITATION_PATTERN.flags)

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'citation', value: match[0] })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts
}
