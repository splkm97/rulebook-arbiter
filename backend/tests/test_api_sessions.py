"""Tests for the GET /api/sessions/{session_id} endpoint."""

from __future__ import annotations

from io import BytesIO

from tests.conftest import create_pdf_with_text


def _upload_pdf(client) -> str:
    """Helper: upload a PDF and return the session_id."""
    pdf_bytes = create_pdf_with_text(
        [
            "Game Setup\n\nPlace the board in the center.",
            "Gameplay\n\nDraw a card on your turn.",
        ]
    )
    resp = client.post(
        "/api/upload",
        files={"file": ("rules.pdf", BytesIO(pdf_bytes), "application/pdf")},
    )
    assert resp.status_code == 200
    return resp.json()["session_id"]


class TestGetSessionMetadata:
    """GET /api/sessions/{session_id}"""

    def test_valid_session_returns_metadata(self, app_client) -> None:
        """An uploaded session returns full metadata with 200."""
        session_id = _upload_pdf(app_client)

        response = app_client.get(f"/api/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session_id
        assert isinstance(data["title"], str)
        assert len(data["title"]) > 0
        assert data["total_pages"] == 2
        assert data["total_chunks"] >= 1
        assert data["model"] == "gemini-3-flash-preview"

    def test_nonexistent_session_returns_404(self, app_client) -> None:
        """A missing session_id returns 404 with error body."""
        response = app_client.get("/api/sessions/does-not-exist")

        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        assert "does-not-exist" in data["error"]

    def test_response_shape(self, app_client) -> None:
        """Response contains exactly the expected keys."""
        session_id = _upload_pdf(app_client)

        response = app_client.get(f"/api/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        expected_keys = {"session_id", "title", "total_pages", "total_chunks", "model", "preset", "conversation"}
        assert set(data.keys()) == expected_keys
