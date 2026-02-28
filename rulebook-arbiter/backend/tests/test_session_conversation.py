"""Tests for conversation persistence in session metadata.

Verifies that GET /api/sessions/{session_id} includes conversation history
so the frontend can restore chat messages after a page refresh.
"""

from __future__ import annotations

from io import BytesIO

from tests.conftest import create_pdf_with_text


def _upload_pdf(client) -> str:
    """Helper: upload a PDF and return the session_id."""
    pdf_bytes = create_pdf_with_text(
        ["Game Setup\n\nPlace the board in the center."]
    )
    resp = client.post(
        "/api/upload",
        files={"file": ("rules.pdf", BytesIO(pdf_bytes), "application/pdf")},
    )
    assert resp.status_code == 200
    return resp.json()["session_id"]


class TestSessionConversation:
    """GET /api/sessions/{session_id} should include conversation history."""

    def test_new_session_has_empty_conversation(self, app_client) -> None:
        """A freshly uploaded session has an empty conversation list."""
        session_id = _upload_pdf(app_client)

        response = app_client.get(f"/api/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert "conversation" in data
        assert data["conversation"] == []

    def test_conversation_persists_after_chat(self, app_client) -> None:
        """After sending a chat message, conversation appears in session metadata."""
        session_id = _upload_pdf(app_client)

        # Send a chat message
        chat_resp = app_client.post(
            "/api/chat",
            json={"session_id": session_id, "message": "How do I set up?"},
        )
        assert chat_resp.status_code == 200

        # Fetch session metadata — should include conversation
        response = app_client.get(f"/api/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        conversation = data["conversation"]
        assert len(conversation) == 2  # user + assistant
        assert conversation[0]["role"] == "user"
        assert conversation[0]["content"] == "How do I set up?"
        assert conversation[1]["role"] == "assistant"
        assert len(conversation[1]["content"]) > 0

    def test_conversation_has_correct_shape(self, app_client) -> None:
        """Each conversation turn has exactly 'role' and 'content' keys."""
        session_id = _upload_pdf(app_client)

        app_client.post(
            "/api/chat",
            json={"session_id": session_id, "message": "What are the rules?"},
        )

        response = app_client.get(f"/api/sessions/{session_id}")
        data = response.json()

        for turn in data["conversation"]:
            assert set(turn.keys()) == {"role", "content"}
            assert turn["role"] in ("user", "assistant")
            assert isinstance(turn["content"], str)

    def test_multiple_turns_preserved_in_order(self, app_client) -> None:
        """Multiple chat exchanges are preserved in chronological order."""
        session_id = _upload_pdf(app_client)

        app_client.post(
            "/api/chat",
            json={"session_id": session_id, "message": "First question"},
        )
        app_client.post(
            "/api/chat",
            json={"session_id": session_id, "message": "Second question"},
        )

        response = app_client.get(f"/api/sessions/{session_id}")
        data = response.json()
        conversation = data["conversation"]

        assert len(conversation) == 4  # 2 user + 2 assistant
        assert conversation[0]["role"] == "user"
        assert conversation[0]["content"] == "First question"
        assert conversation[1]["role"] == "assistant"
        assert conversation[2]["role"] == "user"
        assert conversation[2]["content"] == "Second question"
        assert conversation[3]["role"] == "assistant"
