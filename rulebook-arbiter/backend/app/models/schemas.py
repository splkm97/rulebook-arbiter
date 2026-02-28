from typing import Literal

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    session_id: str
    title: str
    total_pages: int
    total_chunks: int
    duplicate: bool = False


class ChatRequest(BaseModel):
    session_id: str
    message: str = Field(..., min_length=1, max_length=10000)


class SourceInfo(BaseModel):
    chunk_id: str
    page: int
    section: str
    label: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceInfo]
    model_used: str


class SourceDetailResponse(BaseModel):
    chunk_id: str
    text: str
    page: int
    section: str


class SettingsRequest(BaseModel):
    model: str | None = None
    preset: str | None = None


class SettingsResponse(BaseModel):
    model: str
    available_models: list[str]
    preset: str
    available_presets: list[str]


class ConversationTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class SessionMetadataResponse(BaseModel):
    session_id: str
    title: str
    total_pages: int
    total_chunks: int
    model: str
    preset: str
    conversation: list[ConversationTurn] = []


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
