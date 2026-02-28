"""Tests for POST /api/upload."""

from __future__ import annotations

from io import BytesIO

import pytest

from app.errors.handlers import LLMError
from tests.conftest import create_pdf_with_text


class TestUploadEndpoint:
    def test_upload_valid_pdf(self, app_client) -> None:
        """Upload a valid PDF and verify the response shape."""
        pdf_bytes = create_pdf_with_text(
            [
                "Catan Rules\n\nPlace the board in the center of the table.",
                "Gameplay\n\nOn your turn draw a card.",
            ]
        )

        response = app_client.post(
            "/api/upload",
            files={"file": ("rules.pdf", BytesIO(pdf_bytes), "application/pdf")},
        )

        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert data["total_pages"] == 2
        assert data["total_chunks"] >= 1
        assert len(data["title"]) > 0

    def test_upload_invalid_content_type(self, app_client) -> None:
        """Uploading a non-PDF content type yields 400."""
        response = app_client.post(
            "/api/upload",
            files={"file": ("notes.txt", BytesIO(b"hello"), "text/plain")},
        )

        assert response.status_code == 400
        body = response.json()
        assert "error" in body

    def test_upload_invalid_magic_bytes(self, app_client) -> None:
        """application/pdf header but non-PDF bytes yields 400."""
        response = app_client.post(
            "/api/upload",
            files={
                "file": (
                    "fake.pdf",
                    BytesIO(b"NOT_A_PDF_FILE_CONTENT"),
                    "application/pdf",
                )
            },
        )

        assert response.status_code == 400

    def test_upload_empty_pdf(self, app_client, pdf_factory) -> None:
        """A PDF with blank pages (no extractable text) yields 400."""
        from pypdf import PdfWriter

        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)
        buf = BytesIO()
        writer.write(buf)
        blank_pdf = buf.getvalue()

        response = app_client.post(
            "/api/upload",
            files={"file": ("blank.pdf", BytesIO(blank_pdf), "application/pdf")},
        )

        assert response.status_code == 400
        data = response.json()
        assert "error" in data


class TestUploadEmbeddingFailure:
    """Embedding API errors during upload should surface as HTTP 502."""

    def test_upload_returns_502_when_embedding_model_not_found(
        self, app_client, mock_llm_service
    ) -> None:
        """If the embedding model returns 404, upload responds with 502."""
        mock_llm_service.embed.side_effect = LLMError(
            "Embedding failed: 404 NOT_FOUND. models/text-embedding-004 is not found"
        )

        pdf_bytes = create_pdf_with_text(
            ["Rules\n\nPlace the board in the center."]
        )
        response = app_client.post(
            "/api/upload",
            files={"file": ("rules.pdf", BytesIO(pdf_bytes), "application/pdf")},
        )

        assert response.status_code == 502
        data = response.json()
        assert "error" in data
        assert "Embedding failed" in data["error"]

    def test_upload_returns_502_when_embedding_raises_generic_llm_error(
        self, app_client, mock_llm_service
    ) -> None:
        """Any LLMError from the embedding step surfaces as 502."""
        mock_llm_service.embed.side_effect = LLMError(
            "Embedding failed: connection reset"
        )

        pdf_bytes = create_pdf_with_text(
            ["Rules\n\nShuffle the deck and deal cards."]
        )
        response = app_client.post(
            "/api/upload",
            files={"file": ("rules.pdf", BytesIO(pdf_bytes), "application/pdf")},
        )

        assert response.status_code == 502


class TestUploadDuplicateDetection:
    """Uploading the same PDF twice should return the existing session."""

    def test_duplicate_upload_returns_existing_session(
        self, app_client, mock_llm_service
    ) -> None:
        """Same PDF bytes uploaded twice → same session_id, duplicate flag set."""
        pdf_bytes = create_pdf_with_text(
            ["Catan Rules\n\nPlace the board in the center."]
        )

        first = app_client.post(
            "/api/upload",
            files={"file": ("rules.pdf", BytesIO(pdf_bytes), "application/pdf")},
        )
        assert first.status_code == 200
        first_data = first.json()
        assert first_data.get("duplicate") is not True

        second = app_client.post(
            "/api/upload",
            files={"file": ("rules.pdf", BytesIO(pdf_bytes), "application/pdf")},
        )
        assert second.status_code == 200
        second_data = second.json()
        assert second_data["session_id"] == first_data["session_id"]
        assert second_data["duplicate"] is True

    def test_different_pdfs_create_separate_sessions(
        self, app_client, mock_llm_service
    ) -> None:
        """Two distinct PDFs produce different session_ids."""
        pdf_a = create_pdf_with_text(["Game A Rules\n\nDo something."])
        pdf_b = create_pdf_with_text(["Game B Rules\n\nDo something else."])

        resp_a = app_client.post(
            "/api/upload",
            files={"file": ("a.pdf", BytesIO(pdf_a), "application/pdf")},
        )
        resp_b = app_client.post(
            "/api/upload",
            files={"file": ("b.pdf", BytesIO(pdf_b), "application/pdf")},
        )

        assert resp_a.status_code == 200
        assert resp_b.status_code == 200
        assert resp_a.json()["session_id"] != resp_b.json()["session_id"]

    def test_duplicate_upload_skips_embedding_api(
        self, app_client, mock_llm_service
    ) -> None:
        """Second upload of same PDF must NOT call the embedding API again."""
        pdf_bytes = create_pdf_with_text(
            ["Pandemic Rules\n\nDraw infection cards."]
        )

        app_client.post(
            "/api/upload",
            files={"file": ("rules.pdf", BytesIO(pdf_bytes), "application/pdf")},
        )
        calls_after_first = mock_llm_service.embed.call_count

        app_client.post(
            "/api/upload",
            files={"file": ("rules.pdf", BytesIO(pdf_bytes), "application/pdf")},
        )
        calls_after_second = mock_llm_service.embed.call_count

        assert calls_after_second == calls_after_first, (
            "embed() should not be called on duplicate upload"
        )
