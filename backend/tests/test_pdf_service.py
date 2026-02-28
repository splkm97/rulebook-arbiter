"""Tests for app.services.pdf_service."""

from __future__ import annotations

import pytest

from app.errors.handlers import InvalidPDFError
from app.services.pdf_service import detect_title, extract_pages
from tests.conftest import create_pdf_with_text


class TestExtractPages:
    """extract_pages: valid/invalid PDF handling."""

    def test_extract_pages_valid_pdf(self, sample_pdf_bytes: bytes) -> None:
        """A valid 2-page PDF yields 2 tuples with 1-indexed page numbers."""
        pages = extract_pages(sample_pdf_bytes)

        assert len(pages) == 2
        assert pages[0][0] == 1
        assert pages[1][0] == 2
        # Each page should contain some text
        assert len(pages[0][1]) > 0
        assert len(pages[1][1]) > 0

    def test_extract_pages_invalid_bytes(self) -> None:
        """Garbage bytes raise InvalidPDFError."""
        with pytest.raises(InvalidPDFError, match="Could not parse PDF"):
            extract_pages(b"this is not a pdf at all")

    def test_extract_pages_empty_bytes(self) -> None:
        """Empty bytes raise InvalidPDFError."""
        with pytest.raises(InvalidPDFError, match="Could not parse PDF"):
            extract_pages(b"")

    def test_extract_pages_multiple_pages(self, pdf_factory) -> None:
        """Five pages yield 5 tuples numbered 1 through 5."""
        pdf = pdf_factory(
            [f"Page {i} content" for i in range(1, 6)]
        )
        pages = extract_pages(pdf)

        assert len(pages) == 5
        assert [p[0] for p in pages] == [1, 2, 3, 4, 5]


class TestDetectTitle:
    """detect_title: title extraction from first-page text."""

    def test_detect_title_normal(self) -> None:
        """First suitable line of the first page is used as the title."""
        pages = [
            (1, "Catan: The Board Game\n\nRules for play..."),
            (2, "Component list..."),
        ]
        assert detect_title(pages) == "Catan: The Board Game"

    def test_detect_title_empty_pages(self) -> None:
        """No pages -> 'Untitled Rulebook'."""
        assert detect_title([]) == "Untitled Rulebook"

    def test_detect_title_all_blank_text(self) -> None:
        """Pages with only whitespace -> 'Untitled Rulebook'."""
        pages = [(1, "   \n   \n  ")]
        assert detect_title(pages) == "Untitled Rulebook"

    def test_detect_title_long_first_line(self) -> None:
        """Lines > 120 characters are skipped; a shorter one is used."""
        long_line = "A" * 121
        pages = [(1, f"{long_line}\nActual Title")]
        assert detect_title(pages) == "Actual Title"

    def test_detect_title_single_char_lines_skipped(self) -> None:
        """Lines shorter than 2 characters are skipped."""
        pages = [(1, "X\nReal Title\nMore text")]
        assert detect_title(pages) == "Real Title"

    def test_detect_title_all_lines_too_long(self) -> None:
        """When every line > 120 chars, fall back to 'Untitled Rulebook'."""
        pages = [(1, "A" * 200 + "\n" + "B" * 150)]
        assert detect_title(pages) == "Untitled Rulebook"
