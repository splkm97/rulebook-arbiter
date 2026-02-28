from fastapi import APIRouter, HTTPException, Query, Request

from app.models.schemas import SourceDetailResponse

router = APIRouter()


@router.get("/sources/{chunk_id}", response_model=SourceDetailResponse)
async def get_source_detail(
    chunk_id: str,
    request: Request,
    session_id: str = Query(..., description="Session ID"),
) -> SourceDetailResponse:
    """Retrieve the full text of a specific source chunk."""
    session_service = request.app.state.session_service
    session = session_service.get_session(session_id)

    chunk = session.chunks.get(chunk_id)
    if chunk is None:
        raise HTTPException(
            status_code=404,
            detail=f"Chunk {chunk_id} not found in session {session_id}",
        )

    return SourceDetailResponse(
        chunk_id=chunk.chunk_id,
        text=chunk.text,
        page=chunk.page_number,
        section=chunk.section_title,
    )
