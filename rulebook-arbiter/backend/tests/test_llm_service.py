"""Tests for app.services.llm_service — especially error wrapping."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.errors.handlers import LLMError
from app.services.llm_service import LLMService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_api_error(code: int, message: str) -> Exception:
    """Build a google.genai.errors.APIError without importing the real class.

    The real constructor requires ``(code, response_json, response)`` but we
    only need something that ``isinstance(exc, Exception)`` and carries the
    status code so the test can assert on the wrapped message.
    """
    from google.genai.errors import APIError

    response_json = {"error": {"message": message, "status": "NOT_FOUND", "code": code}}
    return APIError(code=code, response_json=response_json)


def _make_embedding_response(vectors: list[list[float]]):
    """Mimic the shape returned by ``client.models.embed_content``."""
    embeddings = [SimpleNamespace(values=v) for v in vectors]
    return SimpleNamespace(embeddings=embeddings)


def _make_generate_response(text: str | None):
    """Mimic the shape returned by ``client.models.generate_content``."""
    return SimpleNamespace(text=text)


# ---------------------------------------------------------------------------
# embed() — error cases
# ---------------------------------------------------------------------------


class TestEmbedErrors:
    """Verify that LLMService.embed wraps upstream errors as LLMError."""

    def test_embed_wraps_404_api_error(self) -> None:
        """A 404 from the Gemini API (model not found) becomes LLMError."""
        svc = LLMService(api_key="fake-key")
        svc._client = MagicMock()
        svc._client.models.embed_content.side_effect = _make_api_error(
            404, "models/text-embedding-004 is not found"
        )

        with pytest.raises(LLMError, match="Embedding failed"):
            svc.embed(model="text-embedding-004", texts=["hello"])

    def test_embed_wraps_generic_exception(self) -> None:
        """An unexpected RuntimeError is still wrapped as LLMError."""
        svc = LLMService(api_key="fake-key")
        svc._client = MagicMock()
        svc._client.models.embed_content.side_effect = RuntimeError("connection reset")

        with pytest.raises(LLMError, match="Embedding failed"):
            svc.embed(model="text-embedding-004", texts=["hello"])

    def test_embed_wraps_403_api_error(self) -> None:
        """A 403 (invalid API key / permission denied) becomes LLMError."""
        svc = LLMService(api_key="fake-key")
        svc._client = MagicMock()
        svc._client.models.embed_content.side_effect = _make_api_error(
            403, "API key not valid"
        )

        with pytest.raises(LLMError, match="Embedding failed"):
            svc.embed(model="text-embedding-004", texts=["hello"])

    def test_embed_preserves_original_cause(self) -> None:
        """The __cause__ chain is preserved for debugging."""
        svc = LLMService(api_key="fake-key")
        svc._client = MagicMock()
        original = RuntimeError("socket timeout")
        svc._client.models.embed_content.side_effect = original

        with pytest.raises(LLMError) as exc_info:
            svc.embed(model="text-embedding-004", texts=["hello"])

        assert exc_info.value.__cause__ is original


# ---------------------------------------------------------------------------
# embed() — happy path
# ---------------------------------------------------------------------------


class TestEmbedSuccess:
    """Verify embed() returns correctly shaped vectors."""

    def test_embed_returns_vectors(self) -> None:
        svc = LLMService(api_key="fake-key")
        svc._client = MagicMock()
        svc._client.models.embed_content.return_value = _make_embedding_response(
            [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        )

        result = svc.embed(model="text-embedding-004", texts=["a", "b"])

        assert len(result) == 2
        assert result[0] == [0.1, 0.2, 0.3]
        assert result[1] == [0.4, 0.5, 0.6]

    def test_embed_batches_large_input(self) -> None:
        """Texts exceeding batch_size=100 are split into multiple API calls."""
        svc = LLMService(api_key="fake-key")
        svc._client = MagicMock()

        def embed_side_effect(model, contents):
            return _make_embedding_response(
                [[float(i)] for i in range(len(contents))]
            )

        svc._client.models.embed_content.side_effect = embed_side_effect

        texts = [f"text-{i}" for i in range(150)]
        result = svc.embed(model="text-embedding-004", texts=texts)

        assert len(result) == 150
        # Should have been called twice: batch of 100 + batch of 50
        assert svc._client.models.embed_content.call_count == 2


# ---------------------------------------------------------------------------
# generate() — error cases
# ---------------------------------------------------------------------------


class TestGenerateErrors:
    """Verify that LLMService.generate wraps upstream errors as LLMError."""

    def test_generate_wraps_404_api_error(self) -> None:
        """A 404 from Gemini generation (model not found) becomes LLMError."""
        svc = LLMService(api_key="fake-key")
        svc._client = MagicMock()
        svc._client.models.generate_content.side_effect = _make_api_error(
            404, "models/gemini-2.0-flash is not found"
        )

        with pytest.raises(LLMError, match="Gemini generation failed"):
            svc.generate(
                model="gemini-2.0-flash",
                system_prompt="test",
                messages=[{"role": "user", "text": "hi"}],
                temperature=0.3,
                top_p=0.85,
                max_tokens=100,
            )

    def test_generate_empty_response_raises_llm_error(self) -> None:
        """An empty text response from Gemini raises LLMError."""
        svc = LLMService(api_key="fake-key")
        svc._client = MagicMock()
        svc._client.models.generate_content.return_value = _make_generate_response(
            text=None
        )

        with pytest.raises(LLMError, match="empty response"):
            svc.generate(
                model="gemini-2.0-flash",
                system_prompt="test",
                messages=[{"role": "user", "text": "hi"}],
                temperature=0.3,
                top_p=0.85,
                max_tokens=100,
            )
