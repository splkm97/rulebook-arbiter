import threading
from dataclasses import dataclass, field

from app.errors.handlers import SessionNotFoundError
from app.models.domain import Chunk
from app.models.presets import DEFAULT_PRESET


@dataclass
class ConversationEntry:
    """A single conversation turn stored internally."""

    role: str  # "user" | "assistant"
    content: str

    def to_dict(self) -> dict[str, str]:
        return {"role": self.role, "content": self.content}


@dataclass
class Session:
    session_id: str
    title: str
    total_pages: int
    total_chunks: int
    model: str
    preset: str = DEFAULT_PRESET
    pdf_hash: str | None = None
    chunks: dict[str, Chunk] = field(default_factory=dict)
    conversation: list[ConversationEntry] = field(default_factory=list)


class SessionService:
    """Thread-safe in-memory session store."""

    def __init__(self, default_model: str) -> None:
        self._sessions: dict[str, Session] = {}
        self._hash_to_session_id: dict[str, str] = {}
        self._lock = threading.Lock()
        self._default_model = default_model

    def create_session(
        self,
        session_id: str,
        title: str,
        total_pages: int,
        chunks: list[Chunk],
        model: str | None = None,
        pdf_hash: str | None = None,
    ) -> Session:
        """Create and store a new session."""
        chunk_map = {c.chunk_id: c for c in chunks}
        session = Session(
            session_id=session_id,
            title=title,
            total_pages=total_pages,
            total_chunks=len(chunks),
            model=model or self._default_model,
            pdf_hash=pdf_hash,
            chunks=chunk_map,
            conversation=[],
        )
        with self._lock:
            self._sessions[session_id] = session
            if pdf_hash is not None:
                self._hash_to_session_id[pdf_hash] = session_id
        return session

    def find_session_by_hash(self, pdf_hash: str) -> Session | None:
        """Look up a session by PDF content hash. Returns None if not found."""
        with self._lock:
            session_id = self._hash_to_session_id.get(pdf_hash)
            if session_id is None:
                return None
            return self._sessions.get(session_id)

    def get_session(self, session_id: str) -> Session:
        """Retrieve a session or raise ``SessionNotFoundError``."""
        with self._lock:
            session = self._sessions.get(session_id)
        if session is None:
            raise SessionNotFoundError(session_id)
        return session

    def get_conversation_snapshot(
        self, session_id: str
    ) -> list[dict[str, str]]:
        """Return a copy of the conversation for safe iteration outside locks."""
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                raise SessionNotFoundError(session_id)
            return [entry.to_dict() for entry in session.conversation]

    def add_turn(
        self,
        session_id: str,
        role: str,
        content: str,
        max_turns: int = 10,
    ) -> None:
        """Append a conversation turn and cap history length.

        When the conversation exceeds *max_turns* pairs (user+assistant),
        the oldest pairs are trimmed via slice assignment (O(1) amortized).
        """
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                raise SessionNotFoundError(session_id)
            session.conversation.append(
                ConversationEntry(role=role, content=content)
            )
            max_entries = max_turns * 2
            if len(session.conversation) > max_entries:
                session.conversation = session.conversation[-max_entries:]

    def update_model(self, session_id: str, model: str) -> None:
        """Change the generation model for a session."""
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                raise SessionNotFoundError(session_id)
            session.model = model

    def update_preset(self, session_id: str, preset: str) -> None:
        """Change the active prompt preset for a session."""
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                raise SessionNotFoundError(session_id)
            session.preset = preset
