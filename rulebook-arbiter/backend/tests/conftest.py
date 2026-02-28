"""Shared test fixtures for the Rulebook Arbiter backend."""

from __future__ import annotations

from io import BytesIO
from unittest.mock import MagicMock

import chromadb
import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
)

from app.config import Settings
from app.models.domain import Chunk
from app.services.session_service import SessionService
from app.services.vector_service import VectorService


# ---------------------------------------------------------------------------
# PDF creation helpers
# ---------------------------------------------------------------------------


def create_pdf_with_text(pages_text: list[str]) -> bytes:
    """Create a minimal valid PDF with extractable text on each page.

    Uses raw PDF content stream operators to embed text that pypdf can
    extract.  Each page gets a /Helvetica font resource and a simple BT/ET
    block with the supplied text.
    """
    writer = PdfWriter()

    for text in pages_text:
        from pypdf import PageObject

        page = PageObject.create_blank_page(width=612, height=792)

        # Escape parentheses for the PDF text operator
        safe_text = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        content = f"BT /F1 12 Tf 72 720 Td ({safe_text}) Tj ET"
        stream = DecodedStreamObject()
        stream.set_data(content.encode())

        font_dict = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        resources = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject(
                    {
                        NameObject("/F1"): font_dict,
                    }
                ),
            }
        )
        page[NameObject("/Resources")] = resources
        page[NameObject("/Contents")] = stream
        writer.add_page(page)

    buf = BytesIO()
    writer.write(buf)
    return buf.getvalue()


@pytest.fixture()
def pdf_factory():
    """Return the ``create_pdf_with_text`` helper so tests can build PDFs."""
    return create_pdf_with_text


# ---------------------------------------------------------------------------
# Sample data fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def sample_pdf_bytes() -> bytes:
    """A minimal valid PDF with 2 pages of extractable text."""
    return create_pdf_with_text(
        [
            "Game Setup: Place the board in the center of the table.",
            "Gameplay: On your turn, draw a card or move a piece.",
        ]
    )


@pytest.fixture()
def sample_text_pages() -> list[tuple[int, str]]:
    """Sample extracted pages for chunking tests."""
    return [
        (
            1,
            "# Game Setup\n\nPlace the board in the center of the table. "
            "Each player takes a set of pieces.\n\n"
            "Shuffle the deck and deal 5 cards to each player.\n\n"
            "## Starting Player\n\nThe youngest player goes first.",
        ),
        (
            2,
            "# Gameplay\n\nOn your turn, you may perform one of the "
            "following actions:\n\n"
            "1. Draw a card from the deck\n"
            "2. Play a card from your hand\n"
            "3. Move a piece on the board\n\n"
            "## Combat\n\nWhen two pieces occupy the same space, combat "
            "occurs. Compare the attack values.",
        ),
        (
            3,
            "# Scoring\n\nAt the end of the game, count your victory points:\n\n"
            "- Each captured piece: 2 points\n"
            "- Each territory: 3 points\n"
            "- Bonus cards: varies\n\n"
            "The player with the most points wins.",
        ),
    ]


@pytest.fixture()
def sample_chunks() -> list[Chunk]:
    """Pre-built chunks for vector / session tests."""
    return [
        Chunk(
            chunk_id="chunk-001",
            text="Place the board in the center.",
            page_number=1,
            section_title="Game Setup",
            token_count=10,
        ),
        Chunk(
            chunk_id="chunk-002",
            text="On your turn, perform an action.",
            page_number=2,
            section_title="Gameplay",
            token_count=10,
        ),
        Chunk(
            chunk_id="chunk-003",
            text="Count your victory points.",
            page_number=3,
            section_title="Scoring",
            token_count=8,
        ),
    ]


# ---------------------------------------------------------------------------
# Mock LLM service
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_llm_service():
    """MagicMock LLM service with predictable embed / generate behaviour."""
    service = MagicMock()

    def embed_side_effect(model: str, texts: list[str]):
        """Return a 3-dimensional fake embedding for every input text."""
        return [[0.1 * (i + 1), 0.2 * (i + 1), 0.3 * (i + 1)] for i in range(len(texts))]

    service.embed.side_effect = embed_side_effect
    service.generate.return_value = (
        "Based on the rules [p.1, \u00a7Game Setup], "
        "place the board in the center of the table."
    )
    return service


# ---------------------------------------------------------------------------
# FastAPI TestClient
# ---------------------------------------------------------------------------


@pytest.fixture()
def app_client(mock_llm_service, tmp_path):
    """Create a FastAPI ``TestClient`` with mocked LLM and ephemeral ChromaDB.

    We build a *separate* FastAPI app that shares the same routers and
    exception handlers but has no lifespan, so the real ``LLMService`` is
    never instantiated.  All services are wired manually to inject the
    mock LLM and an ephemeral ChromaDB.
    """
    from contextlib import asynccontextmanager
    from collections.abc import AsyncIterator

    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    from app.errors.handlers import register_exception_handlers
    from app.routers import chat, settings, sources, upload
    from app.services.retrieval_service import RetrievalService

    app_settings = Settings(
        gemini_api_key="test-key",
        chromadb_path=str(tmp_path / "chromadb"),
        generation_model="gemini-2.0-flash",
    )

    chroma_client = chromadb.EphemeralClient()
    vector_service = VectorService(client=chroma_client)
    session_service = SessionService(default_model=app_settings.generation_model)
    retrieval_service = RetrievalService(
        vector_service=vector_service,
        llm_service=mock_llm_service,
        session_service=session_service,
        settings=app_settings,
    )

    @asynccontextmanager
    async def _noop_lifespan(_app: FastAPI) -> AsyncIterator[None]:
        yield

    test_app = FastAPI(lifespan=_noop_lifespan)
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(test_app)
    test_app.include_router(upload.router, prefix="/api")
    test_app.include_router(chat.router, prefix="/api")
    test_app.include_router(sources.router, prefix="/api")
    test_app.include_router(settings.router, prefix="/api")

    @test_app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    test_app.state.settings = app_settings
    test_app.state.chroma_client = chroma_client
    test_app.state.vector_service = vector_service
    test_app.state.llm_service = mock_llm_service
    test_app.state.session_service = session_service
    test_app.state.retrieval_service = retrieval_service

    with TestClient(test_app, raise_server_exceptions=False) as client:
        yield client
