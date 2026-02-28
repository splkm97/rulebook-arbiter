"""Tests for POST /api/chat."""

from __future__ import annotations

from io import BytesIO

from app.errors.handlers import LLMError
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
        """An empty message is rejected by input validation (min_length=1)."""
        session_id = _upload_pdf(app_client)

        response = app_client.post(
            "/api/chat",
            json={"session_id": session_id, "message": ""},
        )

        assert response.status_code == 422


class TestChatEmbeddingFailure:
    """Embedding API errors during chat should surface as HTTP 502."""

    def test_chat_returns_502_when_embedding_model_not_found(
        self, app_client, mock_llm_service
    ) -> None:
        """If the embedding model 404s during query embedding, chat returns 502."""
        # First upload succeeds (embed works during upload)
        session_id = _upload_pdf(app_client)

        # Now break embed for the chat query
        mock_llm_service.embed.side_effect = LLMError(
            "Embedding failed: 404 NOT_FOUND. models/text-embedding-004 is not found"
        )

        response = app_client.post(
            "/api/chat",
            json={"session_id": session_id, "message": "How do I set up?"},
        )

        assert response.status_code == 502
        data = response.json()
        assert "error" in data
        assert "Embedding failed" in data["error"]

    def test_chat_returns_502_when_generation_fails(
        self, app_client, mock_llm_service
    ) -> None:
        """If the generation model fails after retrieval, chat returns 502."""
        session_id = _upload_pdf(app_client)

        # Embed still works but generation fails
        mock_llm_service.generate.side_effect = LLMError(
            "Gemini generation failed: 404 NOT_FOUND"
        )

        response = app_client.post(
            "/api/chat",
            json={"session_id": session_id, "message": "How do I set up?"},
        )

        assert response.status_code == 502
        data = response.json()
        assert "error" in data
