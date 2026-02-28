from fastapi import APIRouter, Request

from app.models.domain import DEFAULT_SECTION
from app.models.schemas import ChatRequest, ChatResponse, SourceInfo

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, request: Request) -> ChatResponse:
    """Ask a question about a previously uploaded rulebook."""
    retrieval_service = request.app.state.retrieval_service
    result = retrieval_service.process_query(
        session_id=body.session_id,
        query=body.message,
    )

    sources = [
        SourceInfo(
            chunk_id=ctx.chunk.chunk_id,
            page=ctx.chunk.page_number,
            section=ctx.chunk.section_title or DEFAULT_SECTION,
            label=ctx.label,
            score=round(ctx.score, 4),
        )
        for ctx in result.sources
    ]

    return ChatResponse(
        answer=result.answer,
        sources=sources,
        model_used=result.model_used,
    )
