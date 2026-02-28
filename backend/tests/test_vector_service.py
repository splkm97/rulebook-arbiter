"""Tests for app.services.vector_service."""

from __future__ import annotations

import chromadb
import pytest

from app.errors.handlers import VectorStoreError
from app.models.domain import Chunk
from app.services.vector_service import VectorService


@pytest.fixture()
def vs() -> VectorService:
    """VectorService backed by an ephemeral ChromaDB client."""
    client = chromadb.EphemeralClient()
    return VectorService(client=client)


def _make_chunks(n: int) -> list[Chunk]:
    """Create *n* deterministic Chunk objects."""
    return [
        Chunk(
            chunk_id=f"chunk-{i:04d}",
            text=f"Chunk text number {i}.",
            page_number=(i % 5) + 1,
            section_title=f"Section {i % 3}",
            token_count=10,
        )
        for i in range(n)
    ]


def _make_embeddings(n: int, dim: int = 3) -> list[list[float]]:
    """Create *n* simple embedding vectors of dimension *dim*."""
    return [[float(i + 1) / (j + 1) for j in range(dim)] for i in range(n)]


class TestCreateCollection:
    def test_create_collection(self, vs: VectorService) -> None:
        vs.create_collection("sess-1")
        # No exception means success

    def test_create_collection_duplicate(self, vs: VectorService) -> None:
        """Creating the same collection twice should not error (get_or_create)."""
        vs.create_collection("sess-dup")
        vs.create_collection("sess-dup")  # no error


class TestIndexAndQuery:
    def test_index_and_query(self, vs: VectorService) -> None:
        """Index 3 chunks, query, and verify results are returned."""
        chunks = _make_chunks(3)
        embeddings = _make_embeddings(3)

        vs.create_collection("sess-q")
        vs.index_chunks("sess-q", chunks, embeddings)

        results = vs.query("sess-q", query_embedding=[1.0, 1.0, 1.0], top_k=3)
        assert len(results) == 3

        # Each result is (chunk_id, distance, metadata_dict)
        returned_ids = {r[0] for r in results}
        expected_ids = {c.chunk_id for c in chunks}
        assert returned_ids == expected_ids

    def test_query_top_k(self, vs: VectorService) -> None:
        """Query with top_k=2 on a collection of 5 returns exactly 2."""
        chunks = _make_chunks(5)
        embeddings = _make_embeddings(5)

        vs.create_collection("sess-topk")
        vs.index_chunks("sess-topk", chunks, embeddings)

        results = vs.query("sess-topk", query_embedding=[1.0, 1.0, 1.0], top_k=2)
        assert len(results) == 2


class TestGetChunkById:
    def test_get_chunk_by_id_exists(self, vs: VectorService) -> None:
        chunks = _make_chunks(3)
        embeddings = _make_embeddings(3)

        vs.create_collection("sess-get")
        vs.index_chunks("sess-get", chunks, embeddings)

        result = vs.get_chunk_by_id("sess-get", "chunk-0001")
        assert result is not None
        assert result["chunk_id"] == "chunk-0001"
        assert "text" in result
        assert result["page"] == 2  # (1 % 5) + 1 = 2

    def test_get_chunk_by_id_not_found(self, vs: VectorService) -> None:
        vs.create_collection("sess-miss")
        result = vs.get_chunk_by_id("sess-miss", "nonexistent-id")
        assert result is None


class TestDeleteCollection:
    def test_delete_collection(self, vs: VectorService) -> None:
        vs.create_collection("sess-del")
        vs.delete_collection("sess-del")

        # Attempting to query the deleted collection should raise
        with pytest.raises(VectorStoreError):
            vs.query("sess-del", query_embedding=[1.0, 1.0, 1.0])


class TestIndexBatching:
    def test_index_batching_large(self, vs: VectorService) -> None:
        """Indexing >100 chunks exercises the internal batch loop."""
        n = 150
        chunks = _make_chunks(n)
        embeddings = _make_embeddings(n)

        vs.create_collection("sess-batch")
        vs.index_chunks("sess-batch", chunks, embeddings)

        # Verify all 150 are indexed by checking individual chunk retrieval
        # (ChromaDB query has internal n_results caps, so we use get_chunk_by_id)
        first = vs.get_chunk_by_id("sess-batch", "chunk-0000")
        last = vs.get_chunk_by_id("sess-batch", f"chunk-{n - 1:04d}")
        mid = vs.get_chunk_by_id("sess-batch", "chunk-0099")  # boundary of first batch

        assert first is not None
        assert last is not None
        assert mid is not None

        # Also verify a query returns results (proves indexing worked)
        results = vs.query(
            "sess-batch",
            query_embedding=[1.0, 1.0, 1.0],
            top_k=10,
        )
        assert len(results) == 10
