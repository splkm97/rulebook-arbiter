import threading
from dataclasses import dataclass, field

from app.errors.handlers import SessionNotFoundError
from app.models.domain import Chunk


@dataclass
class Session:
    session_id: str
    title: str
    total_pages: int
    total_chunks: int
    model: str
    chunks: dict[str, Chunk] = field(default_factory=dict)
    conversation: list[dict] = field(default_factory=list)


class SessionService:
    """Thread-safe in-memory session store."""

    def __init__(self, default_model: str) -> None:
        self._sessions: dict[str, Session] = {}
        self._lock = threading.Lock()
        self._default_model = default_model

    def create_session(
        self,
        session_id: str,
        title: str,
        total_pages: int,
        chunks: list[Chunk],
        model: str | None = None,
    ) -> Session:
        """Create and store a new session."""
        chunk_map = {c.chunk_id: c for c in chunks}
        session = Session(
            session_id=session_id,
            title=title,
            total_pages=total_pages,
            total_chunks=len(chunks),
            model=model or self._default_model,
            chunks=chunk_map,
            conversation=[],
        )
        with self._lock:
            self._sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Session:
        """Retrieve a session or raise ``SessionNotFoundError``."""
        with self._lock:
            session = self._sessions.get(session_id)
        if session is None:
            raise SessionNotFoundError(session_id)
        return session

    def add_turn(
        self,
        session_id: str,
        role: str,
        content: str,
        max_turns: int = 10,
    ) -> None:
        """Append a conversation turn and cap history length.

        When the conversation exceeds *max_turns* pairs (user+assistant),
        the oldest pair is removed.
        """
        session = self.get_session(session_id)
        with self._lock:
            session.conversation.append({"role": role, "content": content})
            # Each turn pair is 2 entries; cap at max_turns pairs
            max_entries = max_turns * 2
            while len(session.conversation) > max_entries:
                # Remove the two oldest entries (one pair)
                session.conversation.pop(0)
                session.conversation.pop(0)

    def update_model(self, session_id: str, model: str) -> None:
        """Change the generation model for a session."""
        session = self.get_session(session_id)
        with self._lock:
            session.model = model
