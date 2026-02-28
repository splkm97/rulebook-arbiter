from dataclasses import dataclass


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    text: str
    page_number: int
    section_title: str | None
    token_count: int


@dataclass(frozen=True)
class ContextChunk:
    chunk: Chunk
    score: float
    label: str  # e.g., "[p.3, Setup]"


@dataclass(frozen=True)
class RetrievalResult:
    answer: str
    sources: list[ContextChunk]
    model_used: str
