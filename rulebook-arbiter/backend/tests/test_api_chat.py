"""Tests for POST /api/chat."""

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


class TestChatEndpoint:
    def test_chat_valid_session(self, app_client) -> None:
        """Uploading then chatting returns an answer with sources."""
        session_id = _upload_pdf(app_client)

        response = app_client.post(
            "/api/chat",
            json={"session_id": session_id, "message": "How do I set up the game?"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert len(data["answer"]) > 0
        assert "sources" in data
        assert "model_used" in data

    def test_chat_invalid_session(self, app_client) -> None:
        """Chatting with a non-existent session_id yields 404."""
        response = app_client.post(
            "/api/chat",
            json={"session_id": "nonexistent-id", "message": "Hello?"},
        )

        assert response.status_code == 404

    def test_chat_empty_message(self, app_client) -> None:
        """An empty message string still returns a response (context-based)."""
        session_id = _upload_pdf(app_client)

        response = app_client.post(
            "/api/chat",
            json={"session_id": session_id, "message": ""},
        )

        # The endpoint should still process (LLM generates from context)
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
