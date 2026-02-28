from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class RulebookError(Exception):
    """Base exception for Rulebook Arbiter."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class SessionNotFoundError(RulebookError):
    """Raised when a session ID does not exist."""

    def __init__(self, session_id: str) -> None:
        super().__init__(
            message=f"Session not found: {session_id}",
            status_code=404,
        )


class InvalidPDFError(RulebookError):
    """Raised when the uploaded file is not a valid PDF."""

    def __init__(self, detail: str = "Invalid or corrupted PDF file") -> None:
        super().__init__(message=detail, status_code=400)


class LLMError(RulebookError):
    """Raised when the LLM service fails."""

    def __init__(self, detail: str = "LLM generation failed") -> None:
        super().__init__(message=detail, status_code=502)


class VectorStoreError(RulebookError):
    """Raised when the vector store encounters an error."""

    def __init__(self, detail: str = "Vector store operation failed") -> None:
        super().__init__(message=detail, status_code=500)


def register_exception_handlers(app: FastAPI) -> None:
    """Attach custom exception handlers to the FastAPI application."""

    @app.exception_handler(RulebookError)
    async def rulebook_error_handler(
        _request: Request, exc: RulebookError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.message, "detail": None},
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(
        _request: Request, exc: Exception
    ) -> JSONResponse:
        import logging

        logging.getLogger(__name__).exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal server error",
                "detail": None,
            },
        )
