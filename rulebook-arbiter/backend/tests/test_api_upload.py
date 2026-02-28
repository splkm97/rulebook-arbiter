"""Tests for POST /api/upload."""

from __future__ import annotations

from io import BytesIO

import pytest

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
        data = response.json()
        assert "error" in data

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
