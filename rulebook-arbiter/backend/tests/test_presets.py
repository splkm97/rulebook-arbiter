"""Tests for prompt preset API and session integration."""

from __future__ import annotations

from io import BytesIO

from app.models.presets import AVAILABLE_PRESET_IDS, DEFAULT_PRESET, PRESETS

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


class TestPresetConstants:
    """Sanity checks on preset definitions."""

    def test_all_presets_have_required_fields(self) -> None:
        """Every preset has a non-empty system_prompt and valid params."""
        for preset_id, preset in PRESETS.items():
            assert len(preset.system_prompt) > 0, f"{preset_id} has empty prompt"
            assert 0.0 <= preset.temperature <= 1.0, f"{preset_id} bad temperature"
            assert 0.0 <= preset.top_p <= 1.0, f"{preset_id} bad top_p"

    def test_default_preset_exists(self) -> None:
        """DEFAULT_PRESET must be in PRESETS."""
        assert DEFAULT_PRESET in PRESETS

    def test_available_preset_ids_matches_presets(self) -> None:
        """AVAILABLE_PRESET_IDS matches PRESETS keys."""
        assert set(AVAILABLE_PRESET_IDS) == set(PRESETS.keys())

    def test_exactly_three_presets(self) -> None:
        """We define learn, setup, and arbiter presets."""
        assert set(PRESETS.keys()) == {"learn", "setup", "arbiter"}


class TestPresetAPI:
    """Tests for preset fields in the settings API."""

    def test_get_settings_includes_preset(self, app_client) -> None:
        """GET /api/settings returns preset and available_presets."""
        session_id = _upload_pdf(app_client)

        response = app_client.get(
            "/api/settings", params={"session_id": session_id}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["preset"] == DEFAULT_PRESET
        assert "available_presets" in data
        assert set(data["available_presets"]) == {"learn", "setup", "arbiter"}

    def test_update_preset_valid(self, app_client) -> None:
        """PUT with a valid preset changes the session's preset."""
        session_id = _upload_pdf(app_client)

        response = app_client.put(
            "/api/settings",
            params={"session_id": session_id},
            json={"preset": "learn"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["preset"] == "learn"

    def test_update_preset_invalid(self, app_client) -> None:
        """PUT with an invalid preset name yields 400."""
        session_id = _upload_pdf(app_client)

        response = app_client.put(
            "/api/settings",
            params={"session_id": session_id},
            json={"preset": "nonexistent-preset"},
        )

        assert response.status_code == 400

    def test_update_model_and_preset_together(self, app_client) -> None:
        """PUT can update both model and preset in a single request."""
        session_id = _upload_pdf(app_client)

        response = app_client.put(
            "/api/settings",
            params={"session_id": session_id},
            json={"model": "gemini-3-pro-preview", "preset": "setup"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["model"] == "gemini-3-pro-preview"
        assert data["preset"] == "setup"

    def test_session_metadata_includes_preset(self, app_client) -> None:
        """GET /api/sessions/:id returns the preset field."""
        session_id = _upload_pdf(app_client)

        response = app_client.get(f"/api/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["preset"] == DEFAULT_PRESET

    def test_preset_persists_across_settings_calls(self, app_client) -> None:
        """Preset set via PUT persists in subsequent GET."""
        session_id = _upload_pdf(app_client)

        # Change preset to setup
        app_client.put(
            "/api/settings",
            params={"session_id": session_id},
            json={"preset": "setup"},
        )

        # Verify via GET
        response = app_client.get(
            "/api/settings", params={"session_id": session_id}
        )
        assert response.json()["preset"] == "setup"

        # Also verify in session metadata
        response = app_client.get(f"/api/sessions/{session_id}")
        assert response.json()["preset"] == "setup"
