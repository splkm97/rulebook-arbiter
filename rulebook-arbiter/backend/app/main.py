from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

import chromadb
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings
from app.errors.handlers import register_exception_handlers
from app.routers import chat, sessions, settings, sources, upload
from app.services.llm_service import LLMService
from app.services.retrieval_service import RetrievalService
from app.services.session_service import SessionService
from app.services.vector_service import VectorService


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize shared services on startup, clean up on shutdown."""
    app_settings = Settings()
    app.state.settings = app_settings

    # ChromaDB persistent client
    chroma_client = chromadb.PersistentClient(path=app_settings.chromadb_path)
    app.state.chroma_client = chroma_client

    # Services
    vector_service = VectorService(client=chroma_client)
    app.state.vector_service = vector_service

    llm_service = LLMService(api_key=app_settings.gemini_api_key)
    app.state.llm_service = llm_service

    session_service = SessionService(
        default_model=app_settings.generation_model,
    )
    app.state.session_service = session_service

    retrieval_service = RetrievalService(
        vector_service=vector_service,
        llm_service=llm_service,
        session_service=session_service,
        settings=app_settings,
    )
    app.state.retrieval_service = retrieval_service

    yield

    # Shutdown: nothing to clean up for in-memory stores


app = FastAPI(
    title="Rulebook Arbiter",
    description="Board game rulebook Q&A powered by RAG",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS - allow all origins in dev mode
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
register_exception_handlers(app)

# Routers
app.include_router(upload.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(sources.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")


@app.get("/api/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
