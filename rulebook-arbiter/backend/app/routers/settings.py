from fastapi import APIRouter, Query, Request

from app.models.schemas import SettingsRequest, SettingsResponse

router = APIRouter()

AVAILABLE_MODELS: list[str] = [
    "gemini-2.0-flash",
    "gemini-2.0-pro",
]


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    request: Request,
    session_id: str = Query(..., description="Session ID"),
) -> SettingsResponse:
    """Return the current model and available models for a session."""
    session_service = request.app.state.session_service
    session = session_service.get_session(session_id)

    return SettingsResponse(
        model=session.model,
        available_models=AVAILABLE_MODELS,
    )


@router.put("/settings", response_model=SettingsResponse)
async def update_settings(
    body: SettingsRequest,
    request: Request,
    session_id: str = Query(..., description="Session ID"),
) -> SettingsResponse:
    """Update the generation model for a session."""
    session_service = request.app.state.session_service
    session = session_service.get_session(session_id)

    if body.model is not None:
        if body.model not in AVAILABLE_MODELS:
            from fastapi import HTTPException

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid model '{body.model}'. "
                    f"Available: {AVAILABLE_MODELS}"
                ),
            )
        session_service.update_model(session_id, body.model)

    # Re-fetch to return the current state
    session = session_service.get_session(session_id)
    return SettingsResponse(
        model=session.model,
        available_models=AVAILABLE_MODELS,
    )
