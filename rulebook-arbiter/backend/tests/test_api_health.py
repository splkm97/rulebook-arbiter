"""Tests for GET /api/health."""

from __future__ import annotations


class TestHealthEndpoint:
    def test_health_returns_ok(self, app_client) -> None:
        response = app_client.get("/api/health")

        assert response.status_code == 200
        data = response.json()
        assert data == {"status": "ok"}
