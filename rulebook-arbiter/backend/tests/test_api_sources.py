"""Tests for GET /api/sources/{chunk_id}."""

from __future__ import annotations

from io import BytesIO

from tests.conftest import create_pdf_with_text


def _upload_and_chat(client) -> tuple[str, list[dict]]:
    """Upload a PDF, ask a question, return (session_id, sources)."""
    pdf_bytes = create_pdf_with_text(
        [
            "Setup Rules\n\nPlace the board in the center of the table.",
            "Scoring\n\nCount your victory points at the end.",
        ]
    )
    resp = client.post(
        "/api/upload",
        files={"file": ("rules.pdf", BytesIO(pdf_bytes), "application/pdf")},
    )
    assert resp.status_code == 200
    session_id = resp.json()["session_id"]

    chat_resp = client.post(
        "/api/chat",
        json={"session_id": session_id, "message": "How do I set up?"},
    )
    assert chat_resp.status_code == 200
    sources = chat_resp.json()["sources"]
    return session_id, sources


class TestSourcesEndpoint:
    def test_get_source_valid(self, app_client) -> None:
        """Retrieve a chunk's full text by its ID."""
        session_id, sources = _upload_and_chat(app_client)
        assert len(sources) > 0

        chunk_id = sources[0]["chunk_id"]
        response = app_client.get(
            f"/api/sources/{chunk_id}",
            params={"session_id": session_id},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["chunk_id"] == chunk_id
        assert "text" in data
        assert len(data["text"]) > 0
        assert "page" in data

    def test_get_source_invalid_session(self, app_client) -> None:
        """A bad session_id yields 404."""
        response = app_client.get(
            "/api/sources/some-chunk-id",
            params={"session_id": "does-not-exist"},
        )

        assert response.status_code == 404

    def test_get_source_invalid_chunk(self, app_client) -> None:
        """Valid session but non-existent chunk_id yields 404."""
        session_id, _sources = _upload_and_chat(app_client)

        response = app_client.get(
            "/api/sources/nonexistent-chunk-id",
            params={"session_id": session_id},
        )

        assert response.status_code == 404
