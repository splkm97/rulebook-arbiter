from pypdf import PdfReader
import io

from app.errors.handlers import InvalidPDFError


def extract_pages(pdf_bytes: bytes) -> list[tuple[int, str]]:
    """Extract text from PDF, returns list of (page_number, text).

    page_number is 1-indexed. Pages with no extractable text are
    included with an empty string so page numbering stays consistent.
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
    except Exception as exc:
        raise InvalidPDFError(f"Could not parse PDF: {exc}") from exc

    if len(reader.pages) == 0:
        raise InvalidPDFError("PDF contains no pages")

    pages: list[tuple[int, str]] = []
    for idx, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        pages.append((idx + 1, text))

    return pages


def detect_title(pages: list[tuple[int, str]]) -> str:
    """Detect rulebook title from first page text.

    Takes the first non-empty, non-trivially-short line from the first
    page that is at most 120 characters long. Falls back to "Untitled
    Rulebook" when nothing suitable is found.
    """
    if not pages:
        return "Untitled Rulebook"

    _page_num, first_page_text = pages[0]
    for line in first_page_text.splitlines():
        stripped = line.strip()
        if stripped and 2 <= len(stripped) <= 120:
            return stripped

    return "Untitled Rulebook"
