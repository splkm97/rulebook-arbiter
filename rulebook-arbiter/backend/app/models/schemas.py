from pydantic import BaseModel


class UploadResponse(BaseModel):
    session_id: str
    title: str
    total_pages: int
    total_chunks: int


class ChatRequest(BaseModel):
    session_id: str
    message: str


class SourceInfo(BaseModel):
    chunk_id: str
    page: int
    section: str | None
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
    section: str | None


class SettingsRequest(BaseModel):
    model: str | None = None


class SettingsResponse(BaseModel):
    model: str
    available_models: list[str]


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
