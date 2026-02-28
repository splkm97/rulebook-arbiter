import re
import uuid

from app.models.domain import Chunk

SECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^#{1,3}\s+(.+)"),
    re.compile(r"^([A-Z][A-Z\s]{2,})$"),
    re.compile(r"^(\d+\.[\d.]*)\s+(.+)"),
    re.compile(r"^(Chapter|Section|Part)\s+", re.IGNORECASE),
    re.compile(r"^([가-힣]+\s*[:\-])"),
]


def estimate_tokens(text: str) -> int:
    """Estimate token count.

    Korean characters are counted as ~1.5 tokens each. Latin-script
    words are counted as ~1.3 tokens each. The two contributions are
    summed to give a rough total.
    """
    korean_chars = sum(1 for ch in text if "\uac00" <= ch <= "\ud7a3")
    remaining = re.sub(r"[\uac00-\ud7a3]", "", text)
    word_count = len(remaining.split())
    return int(korean_chars * 1.5 + word_count * 1.3)


def _detect_section(line: str) -> str | None:
    """Return a section title if *line* matches a known heading pattern."""
    for pattern in SECTION_PATTERNS:
        m = pattern.match(line.strip())
        if m:
            # Use last captured group as the title text
            return m.group(m.lastindex or 0).strip()
    return None


def chunk_pages(
    pages: list[tuple[int, str]],
    target_tokens: int = 600,
    overlap_tokens: int = 100,
) -> list[Chunk]:
    """Page-aware semantic chunking.

    1. Iterate pages; split each page into paragraphs (double newline).
    2. Track the current section title via regex heading detection.
    3. Accumulate paragraphs until *target_tokens* is reached, then
       flush the current chunk.
    4. Overlap is achieved by carrying the tail of the previous chunk's
       text (up to *overlap_tokens* estimated tokens) into the next one.
    """
    chunks: list[Chunk] = []
    current_paragraphs: list[str] = []
    current_tokens = 0
    current_page = 1
    current_section: str | None = None
    previous_overlap_text = ""

    def _flush() -> None:
        nonlocal current_paragraphs, current_tokens, previous_overlap_text

        if not current_paragraphs:
            return

        body = "\n\n".join(current_paragraphs).strip()
        if not body:
            current_paragraphs = []
            current_tokens = 0
            return

        # Prepend overlap from the previous chunk
        if previous_overlap_text:
            full_text = previous_overlap_text + "\n\n" + body
        else:
            full_text = body

        token_count = estimate_tokens(full_text)
        chunks.append(
            Chunk(
                chunk_id=uuid.uuid4().hex,
                text=full_text,
                page_number=current_page,
                section_title=current_section,
                token_count=token_count,
            )
        )

        # Build overlap text from the tail of the current paragraphs
        overlap_parts: list[str] = []
        overlap_tok = 0
        for para in reversed(current_paragraphs):
            para_tok = estimate_tokens(para)
            if overlap_tok + para_tok > overlap_tokens:
                break
            overlap_parts.insert(0, para)
            overlap_tok += para_tok
        previous_overlap_text = "\n\n".join(overlap_parts)

        current_paragraphs = []
        current_tokens = 0

    for page_number, page_text in pages:
        current_page = page_number
        paragraphs = re.split(r"\n{2,}", page_text)

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # Check first line for section headings
            first_line = para.split("\n", 1)[0]
            detected = _detect_section(first_line)
            if detected is not None:
                # New section boundary: flush the accumulated chunk
                _flush()
                current_section = detected

            para_tokens = estimate_tokens(para)

            if current_tokens + para_tokens > target_tokens and current_paragraphs:
                _flush()

            current_paragraphs.append(para)
            current_tokens += para_tokens

    # Flush any remaining content
    _flush()

    return chunks
