"""Tests for app.services.session_service."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest

from app.errors.handlers import SessionNotFoundError
from app.models.domain import Chunk
from app.services.session_service import SessionService


@pytest.fixture()
def svc() -> SessionService:
    """A fresh SessionService for each test."""
    return SessionService(default_model="gemini-2.0-flash")


@pytest.fixture()
def three_chunks() -> list[Chunk]:
    return [
        Chunk(chunk_id="c1", text="t1", page_number=1, section_title="S1", token_count=5),
        Chunk(chunk_id="c2", text="t2", page_number=2, section_title="S2", token_count=5),
        Chunk(chunk_id="c3", text="t3", page_number=3, section_title=None, token_count=5),
    ]


class TestCreateSession:
    def test_create_session(self, svc: SessionService, three_chunks) -> None:
        session = svc.create_session(
            session_id="sess-1",
            title="My Game",
            total_pages=3,
            chunks=three_chunks,
        )

        assert session.session_id == "sess-1"
        assert session.title == "My Game"
        assert session.total_pages == 3
        assert session.total_chunks == 3
        assert session.model == "gemini-2.0-flash"
        assert session.conversation == []

    def test_create_session_custom_model(self, svc: SessionService, three_chunks) -> None:
        session = svc.create_session(
            session_id="sess-2",
            title="Custom",
            total_pages=1,
            chunks=three_chunks,
            model="gemini-2.0-pro",
        )
        assert session.model == "gemini-2.0-pro"


class TestGetSession:
    def test_get_session_exists(self, svc: SessionService, three_chunks) -> None:
        svc.create_session("sess-x", "T", 1, three_chunks)
        session = svc.get_session("sess-x")
        assert session.session_id == "sess-x"
        assert session.title == "T"

    def test_get_session_not_found(self, svc: SessionService) -> None:
        with pytest.raises(SessionNotFoundError):
            svc.get_session("does-not-exist")


class TestAddTurn:
    def test_add_turn_basic(self, svc: SessionService, three_chunks) -> None:
        svc.create_session("s1", "T", 1, three_chunks)

        svc.add_turn("s1", role="user", content="What are the rules?")
        svc.add_turn("s1", role="assistant", content="Here are the rules...")

        session = svc.get_session("s1")
        assert len(session.conversation) == 2
        assert session.conversation[0].role == "user"
        assert session.conversation[1].role == "assistant"

    def test_add_turn_caps_at_max(self, svc: SessionService, three_chunks) -> None:
        """When conversation exceeds max_turns pairs, oldest pair is removed."""
        svc.create_session("s2", "T", 1, three_chunks)

        max_turns = 2
        # Add 3 pairs (6 entries); with max_turns=2 only 2 pairs should remain
        for i in range(3):
            svc.add_turn("s2", "user", f"Q{i}", max_turns=max_turns)
            svc.add_turn("s2", "assistant", f"A{i}", max_turns=max_turns)

        session = svc.get_session("s2")
        # max_turns=2 means 4 entries max
        assert len(session.conversation) <= max_turns * 2

        # The oldest pair (Q0/A0) should have been removed
        contents = [t.content for t in session.conversation]
        assert "Q0" not in contents

    def test_add_turn_not_found(self, svc: SessionService) -> None:
        with pytest.raises(SessionNotFoundError):
            svc.add_turn("nope", "user", "hello")


class TestUpdateModel:
    def test_update_model(self, svc: SessionService, three_chunks) -> None:
        svc.create_session("s3", "T", 1, three_chunks)
        svc.update_model("s3", "gemini-2.0-pro")

        session = svc.get_session("s3")
        assert session.model == "gemini-2.0-pro"

    def test_update_model_not_found(self, svc: SessionService) -> None:
        with pytest.raises(SessionNotFoundError):
            svc.update_model("nope", "gemini-2.0-pro")


class TestChunkMap:
    def test_chunk_map_populated(self, svc: SessionService, three_chunks) -> None:
        session = svc.create_session("s4", "T", 1, three_chunks)

        assert len(session.chunks) == 3
        assert "c1" in session.chunks
        assert session.chunks["c1"].text == "t1"
        assert session.chunks["c3"].section_title is None


class TestFindByHash:
    """Duplicate detection via PDF content hash."""

    def test_find_by_hash_returns_none_when_empty(
        self, svc: SessionService
    ) -> None:
        """No sessions registered → None."""
        assert svc.find_session_by_hash("abc123") is None

    def test_find_by_hash_returns_session_on_match(
        self, svc: SessionService, three_chunks
    ) -> None:
        """Session created with a hash can be retrieved by that hash."""
        svc.create_session(
            session_id="s-hash",
            title="T",
            total_pages=1,
            chunks=three_chunks,
            pdf_hash="deadbeef",
        )
        found = svc.find_session_by_hash("deadbeef")
        assert found is not None
        assert found.session_id == "s-hash"

    def test_find_by_hash_returns_none_for_different_hash(
        self, svc: SessionService, three_chunks
    ) -> None:
        """Looking up a hash that doesn't match any session → None."""
        svc.create_session(
            session_id="s-other",
            title="T",
            total_pages=1,
            chunks=three_chunks,
            pdf_hash="aaa",
        )
        assert svc.find_session_by_hash("bbb") is None

    def test_find_by_hash_without_hash_is_not_findable(
        self, svc: SessionService, three_chunks
    ) -> None:
        """Sessions created without a hash are never matched."""
        svc.create_session(
            session_id="s-nohash",
            title="T",
            total_pages=1,
            chunks=three_chunks,
        )
        assert svc.find_session_by_hash("anything") is None


class TestThreadSafety:
    def test_concurrent_create_get(self, three_chunks) -> None:
        """Concurrent create/get operations must not crash."""
        svc = SessionService(default_model="gemini-2.0-flash")

        def worker(idx: int) -> str:
            sid = f"concurrent-{idx}"
            svc.create_session(sid, "T", 1, three_chunks)
            session = svc.get_session(sid)
            return session.session_id

        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(worker, i) for i in range(20)]
            results = [f.result() for f in as_completed(futures)]

        assert len(results) == 20
