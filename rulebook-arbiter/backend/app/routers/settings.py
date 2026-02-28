from fastapi import APIRouter, HTTPException, Query, Request

from app.models.presets import AVAILABLE_PRESET_IDS, PRESETS
from app.models.schemas import SettingsRequest, SettingsResponse
from app.services.session_service import Session

router = APIRouter()

AVAILABLE_MODELS: list[str] = [
    "gemini-3-flash-preview",
    "gemini-3-pro-preview",
]


def _build_response(session: Session) -> SettingsResponse:
    """Build a SettingsResponse from a session."""
    return SettingsResponse(
        model=session.model,
        available_models=AVAILABLE_MODELS,
        preset=session.preset,
        available_presets=AVAILABLE_PRESET_IDS,
    )


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    request: Request,
    session_id: str = Query(..., description="Session ID"),
) -> SettingsResponse:
    """Return the current model, preset, and available options for a session."""
    session_service = request.app.state.session_service
    session = session_service.get_session(session_id)
    return _build_response(session)


@router.put("/settings", response_model=SettingsResponse)
async def update_settings(
    body: SettingsRequest,
    request: Request,
    session_id: str = Query(..., description="Session ID"),
) -> SettingsResponse:
    """Update the generation model and/or prompt preset for a session."""
    session_service = request.app.state.session_service
    session = session_service.get_session(session_id)

    if body.model is not None:
        if body.model not in AVAILABLE_MODELS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid model. Available: {AVAILABLE_MODELS}",
            )
        session_service.update_model(session_id, body.model)

    if body.preset is not None:
        if body.preset not in PRESETS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid preset. Available: {AVAILABLE_PRESET_IDS}",
            )
        session_service.update_preset(session_id, body.preset)

    # Re-fetch to return the current state
    session = session_service.get_session(session_id)
    return _build_response(session)
