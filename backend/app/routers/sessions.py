from fastapi import APIRouter, Request

from app.models.schemas import ConversationTurn, SessionMetadataResponse

router = APIRouter()


@router.get("/sessions/{session_id}", response_model=SessionMetadataResponse)
async def get_session_metadata(
    session_id: str,
    request: Request,
) -> SessionMetadataResponse:
    """Retrieve metadata for an existing session."""
    session_service = request.app.state.session_service
    session = session_service.get_session(session_id)

    # Use snapshot for thread-safe iteration of conversation
    conversation = session_service.get_conversation_snapshot(session_id)

    return SessionMetadataResponse(
        session_id=session.session_id,
        title=session.title,
        total_pages=session.total_pages,
        total_chunks=session.total_chunks,
        model=session.model,
        preset=session.preset,
        conversation=[
            ConversationTurn(role=turn["role"], content=turn["content"])
            for turn in conversation
        ],
    )
