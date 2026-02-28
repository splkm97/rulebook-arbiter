/**
 * Sentence-level highlighting utilities.
 *
 * Splits chunk text into sentences, scores each against the user query
 * via keyword overlap, and returns typed segments for rendering.
 */

export interface HighlightSegment {
  readonly text: string
  /** 0-1 relevance score based on keyword overlap with the query */
  readonly score: number
}

// ---- Stopwords (common English words that add noise to keyword matching) ----

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
  'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very',
  'just', 'because', 'if', 'when', 'where', 'how', 'what', 'which', 'who',
  'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself',
  'we', 'our', 'ours', 'you', 'your', 'yours', 'he', 'him', 'his', 'she',
  'her', 'hers', 'it', 'its', 'they', 'them', 'their', 'theirs', 'about',
  'up', 'down', 'here', 'there',
])

// ---- Korean particles / postpositions to strip ----

const KO_PARTICLES =
  /(?:은|는|이|가|을|를|의|에|에서|로|으로|도|만|까지|부터|마다|밖에|처럼|같이|보다|라고|고|며|면서|지만|는데|ㄴ데|인데)$/

/**
 * Extract meaningful keywords from a query string.
 * Strips stopwords and very short tokens.
 */
export function tokenizeQuery(query: string): readonly string[] {
  const raw = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)

  const keywords = raw
    .map((w) => w.replace(KO_PARTICLES, ''))
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))

  // Deduplicate while preserving order
  return [...new Set(keywords)]
}

/**
 * Split text into sentence-like segments.
 * Handles typical punctuation (.!?) and preserves trailing whitespace.
 */
export function splitIntoSentences(text: string): readonly string[] {
  // Split on sentence-ending punctuation followed by whitespace or end of string.
  // Also split on newlines (common in rulebook chunks).
  const raw = text.split(/(?<=[.!?。])\s+|\n+/)
  return raw.filter((s) => s.trim().length > 0)
}

/**
 * Score a sentence against query keywords.
 * Returns 0-1 based on the fraction of query keywords found in the sentence.
 */
export function scoreSentence(
  sentence: string,
  queryKeywords: readonly string[],
): number {
  if (queryKeywords.length === 0) return 0

  const lowerSentence = sentence.toLowerCase()
  const matchCount = queryKeywords.filter((kw) =>
    lowerSentence.includes(kw),
  ).length

  return matchCount / queryKeywords.length
}

/**
 * Score and segment chunk text for highlighted rendering.
 *
 * Splits the text into sentences, scores each against the user query,
 * and returns an array of segments with relevance scores.
 *
 * @param text - Full chunk text
 * @param query - User's original question
 * @param threshold - Minimum score to be considered a "highlight" (default 0.2)
 */
export function computeHighlightSegments(
  text: string,
  query: string,
  threshold: number = 0.2,
): readonly HighlightSegment[] {
  const keywords = tokenizeQuery(query)

  // No keywords → no highlighting
  if (keywords.length === 0) {
    return [{ text, score: 0 }]
  }

  const sentences = splitIntoSentences(text)

  // Single sentence or unsplittable → score the whole block
  if (sentences.length <= 1) {
    const score = scoreSentence(text, keywords)
    return [{ text, score: score >= threshold ? score : 0 }]
  }

  return sentences.map((sentence) => {
    const score = scoreSentence(sentence, keywords)
    return {
      text: sentence,
      score: score >= threshold ? score : 0,
    }
  })
}
