"""Tests for app.services.chunking_service."""

from __future__ import annotations

import pytest

from app.services.chunking_service import (
    SECTION_PATTERNS,
    _detect_section,
    chunk_pages,
    estimate_tokens,
)


# ---------------------------------------------------------------------------
# estimate_tokens
# ---------------------------------------------------------------------------


class TestEstimateTokens:
    """estimate_tokens: token count heuristic."""

    def test_english_text(self) -> None:
        """English text: roughly 1.3x the word count."""
        text = "Place the board in the center of the table"
        result = estimate_tokens(text)
        word_count = len(text.split())
        expected = int(word_count * 1.3)
        assert result == expected

    def test_korean_text(self) -> None:
        """Korean text: ~1.5 tokens per Korean character + any Latin words."""
        text = "\ud55c\uad6d\uc5b4 \ud14c\uc2a4\ud2b8"
        result = estimate_tokens(text)
        # 3 Korean chars + remaining " " splits to ~1 word-like token
        # Korean contrib: int(3 * 1.5) = 4
        # Remaining after removing Korean: "  " -> split yields empty strings or blanks
        assert result > 0

    def test_mixed_korean_english(self) -> None:
        """Mixed Korean + English tokens are summed."""
        text = "\uac8c\uc784 Setup rules"
        result = estimate_tokens(text)
        # 2 Korean chars -> int(2 * 1.5) = 3
        # Remaining Latin: "  Setup rules" -> 2 words -> int(2*1.3)=2
        assert result == 3 + 2

    def test_empty_string(self) -> None:
        """Empty string yields 0."""
        assert estimate_tokens("") == 0

    def test_whitespace_only(self) -> None:
        """Whitespace-only string yields 0 (no words, no Korean)."""
        assert estimate_tokens("   \t\n  ") == 0


# ---------------------------------------------------------------------------
# _detect_section
# ---------------------------------------------------------------------------


class TestDetectSection:
    """_detect_section: heading pattern matching."""

    def test_markdown_heading(self) -> None:
        """Lines like '# Heading' are detected."""
        assert _detect_section("# Game Setup") == "Game Setup"
        assert _detect_section("## Combat") == "Combat"
        assert _detect_section("### Advanced Rules") == "Advanced Rules"

    def test_all_caps_heading(self) -> None:
        """All-uppercase lines with 3+ chars are detected."""
        assert _detect_section("GAME SETUP") == "GAME SETUP"

    def test_numbered_heading(self) -> None:
        """Numbered section headings like '1.2 Setup'."""
        result = _detect_section("1.2 Setup Phase")
        assert result is not None
        # The regex captures group 2 ('Setup Phase') as lastindex
        assert "Setup Phase" in result

    def test_chapter_section_part(self) -> None:
        """Lines starting with 'Chapter', 'Section', or 'Part' (case-insensitive)."""
        result = _detect_section("Chapter 3 - Combat")
        assert result is not None

    def test_korean_section(self) -> None:
        """Korean section pattern like '\uac8c\uc784 \uc900\ube44:'."""
        result = _detect_section("\uac8c\uc784\uc900\ube44:")
        assert result is not None

    def test_no_match(self) -> None:
        """Regular text returns None."""
        assert _detect_section("Place the board in the center.") is None
        assert _detect_section("") is None


# ---------------------------------------------------------------------------
# chunk_pages
# ---------------------------------------------------------------------------


class TestChunkPages:
    """chunk_pages: page-aware semantic chunking."""

    def test_basic_chunking(self, sample_text_pages) -> None:
        """Three content-rich pages produce multiple chunks."""
        chunks = chunk_pages(sample_text_pages, target_tokens=50, overlap_tokens=10)
        assert len(chunks) > 0

        # All chunk IDs should be unique
        ids = [c.chunk_id for c in chunks]
        assert len(ids) == len(set(ids))

        # Page numbers should be 1-indexed
        for chunk in chunks:
            assert chunk.page_number >= 1

    def test_section_detection(self, sample_text_pages) -> None:
        """Chunks carry the section title detected from markdown headings."""
        chunks = chunk_pages(sample_text_pages, target_tokens=50, overlap_tokens=10)

        section_titles = {c.section_title for c in chunks if c.section_title}
        # At minimum the main headings should appear
        assert len(section_titles) > 0

    def test_overlap(self) -> None:
        """Consecutive chunks share overlap text from the previous chunk's tail."""
        pages = [
            (
                1,
                "Alpha paragraph one.\n\n"
                "Beta paragraph two.\n\n"
                "Gamma paragraph three.\n\n"
                "Delta paragraph four.",
            ),
        ]
        # Low target so we get multiple chunks from a single page
        chunks = chunk_pages(pages, target_tokens=5, overlap_tokens=3)
        if len(chunks) >= 2:
            # The second chunk should contain overlap from the first
            # (the tail of chunk[0] should appear at the start of chunk[1])
            first_text = chunks[0].text
            second_text = chunks[1].text
            # At least some words from the end of first should appear in second
            first_words = first_text.split()
            # Overlap means some trailing content reappears
            overlap_found = any(w in second_text for w in first_words[-3:])
            assert overlap_found, "Expected overlap text between consecutive chunks"

    def test_empty_pages(self) -> None:
        """Pages with empty or whitespace-only text produce no chunks."""
        pages = [(1, ""), (2, "   \n   "), (3, "\n\n\n")]
        chunks = chunk_pages(pages)
        assert len(chunks) == 0

    def test_single_short_page(self) -> None:
        """One page with little text produces exactly one chunk."""
        pages = [(1, "Short text only.")]
        chunks = chunk_pages(pages, target_tokens=600, overlap_tokens=100)
        assert len(chunks) == 1
        assert "Short text only." in chunks[0].text

    def test_all_chunks_have_positive_token_count(self, sample_text_pages) -> None:
        """Every chunk has a positive token_count."""
        chunks = chunk_pages(sample_text_pages, target_tokens=50, overlap_tokens=10)
        for chunk in chunks:
            assert chunk.token_count > 0

    def test_section_boundary_flushes_chunk(self) -> None:
        """A new section heading forces a chunk flush."""
        pages = [
            (
                1,
                "# Section A\n\nContent for section A.\n\n"
                "# Section B\n\nContent for section B.",
            ),
        ]
        chunks = chunk_pages(pages, target_tokens=600, overlap_tokens=0)
        # Should produce at least 2 chunks (one per section)
        assert len(chunks) >= 2
        titles = [c.section_title for c in chunks]
        assert "Section A" in titles
        assert "Section B" in titles
