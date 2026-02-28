"""Tests for GET/PUT /api/settings."""

from __future__ import annotations

from io import BytesIO

from tests.conftest import create_pdf_with_text


def _upload_pdf(client) -> str:
    """Upload a PDF and return the session_id."""
    pdf_bytes = create_pdf_with_text(
        ["Setup Rules\n\nPlace the board in the center."]
    )
    resp = client.post(
        "/api/upload",
        files={"file": ("rules.pdf", BytesIO(pdf_bytes), "application/pdf")},
    )
    assert resp.status_code == 200
    return resp.json()["session_id"]


class TestSettingsEndpoint:
    def test_get_settings(self, app_client) -> None:
        """GET /api/settings returns model and available_models."""
        session_id = _upload_pdf(app_client)

        response = app_client.get(
            "/api/settings", params={"session_id": session_id}
        )

        assert response.status_code == 200
        data = response.json()
        assert "model" in data
        assert data["model"] == "gemini-2.0-flash"
        assert "available_models" in data
        assert isinstance(data["available_models"], list)
        assert len(data["available_models"]) >= 2

    def test_update_settings_valid(self, app_client) -> None:
        """PUT with a valid model changes the session's model."""
        session_id = _upload_pdf(app_client)

        response = app_client.put(
            "/api/settings",
            params={"session_id": session_id},
            json={"model": "gemini-2.0-pro"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["model"] == "gemini-2.0-pro"

    def test_update_settings_invalid_model(self, app_client) -> None:
        """PUT with an invalid model name yields 400."""
        session_id = _upload_pdf(app_client)

        response = app_client.put(
            "/api/settings",
            params={"session_id": session_id},
            json={"model": "gpt-4-does-not-exist"},
        )

        assert response.status_code == 400

    def test_get_settings_invalid_session(self, app_client) -> None:
        """GET with non-existent session_id yields 404."""
        response = app_client.get(
            "/api/settings", params={"session_id": "bad-session-id"}
        )

        assert response.status_code == 404
