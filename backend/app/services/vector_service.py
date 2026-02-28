import chromadb

from app.errors.handlers import VectorStoreError
from app.models.domain import Chunk


class VectorService:
    """Thin wrapper around ChromaDB for per-session vector collections."""

    def __init__(self, client: chromadb.ClientAPI) -> None:
        self._client = client

    def _collection_name(self, session_id: str) -> str:
        # ChromaDB collection names must be 3-63 chars, start/end with
        # alphanumeric, and contain only alphanumeric, underscores, hyphens.
        return f"session_{session_id}"

    def create_collection(self, session_id: str) -> None:
        """Create a new collection for a session."""
        try:
            self._client.get_or_create_collection(
                name=self._collection_name(session_id),
                metadata={"hnsw:space": "cosine"},
            )
        except Exception as exc:
            raise VectorStoreError(
                f"Failed to create collection for session {session_id}: {exc}"
            ) from exc

    def index_chunks(
        self,
        session_id: str,
        chunks: list[Chunk],
        embeddings: list[list[float]],
    ) -> None:
        """Add chunks with embeddings to the collection.

        Batches upserts in groups of 100 to stay within ChromaDB limits.
        """
        try:
            collection = self._client.get_collection(
                name=self._collection_name(session_id),
            )
        except Exception as exc:
            raise VectorStoreError(
                f"Collection not found for session {session_id}: {exc}"
            ) from exc

        batch_size = 100
        for start in range(0, len(chunks), batch_size):
            end = start + batch_size
            batch_chunks = chunks[start:end]
            batch_embeddings = embeddings[start:end]

            ids = [c.chunk_id for c in batch_chunks]
            documents = [c.text for c in batch_chunks]
            metadatas = [
                {
                    "page": c.page_number,
                    "section": c.section_title or "",
                    "token_count": c.token_count,
                }
                for c in batch_chunks
            ]

            try:
                collection.add(
                    ids=ids,
                    embeddings=batch_embeddings,
                    documents=documents,
                    metadatas=metadatas,
                )
            except Exception as exc:
                raise VectorStoreError(
                    f"Failed to index chunks for session {session_id}: {exc}"
                ) from exc

    def query(
        self,
        session_id: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[tuple[str, float, dict]]:
        """Query the collection.

        Returns a list of (chunk_id, distance, metadata) sorted by
        ascending distance (most relevant first).
        """
        try:
            collection = self._client.get_collection(
                name=self._collection_name(session_id),
            )
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as exc:
            raise VectorStoreError(
                f"Query failed for session {session_id}: {exc}"
            ) from exc

        ids = results["ids"][0] if results["ids"] else []
        distances = results["distances"][0] if results["distances"] else []
        metadatas = results["metadatas"][0] if results["metadatas"] else []
        documents = results["documents"][0] if results["documents"] else []

        output: list[tuple[str, float, dict]] = []
        for chunk_id, distance, meta, doc in zip(
            ids, distances, metadatas, documents, strict=False
        ):
            enriched_meta = {**meta, "document": doc}
            output.append((chunk_id, distance, enriched_meta))

        return output

    def get_chunk_by_id(
        self, session_id: str, chunk_id: str
    ) -> dict | None:
        """Retrieve a specific chunk by its ID."""
        try:
            collection = self._client.get_collection(
                name=self._collection_name(session_id),
            )
            result = collection.get(
                ids=[chunk_id],
                include=["documents", "metadatas"],
            )
        except Exception as exc:
            raise VectorStoreError(
                f"Failed to get chunk {chunk_id}: {exc}"
            ) from exc

        if not result["ids"]:
            return None

        meta = result["metadatas"][0] if result["metadatas"] else {}
        doc = result["documents"][0] if result["documents"] else ""
        return {
            "chunk_id": chunk_id,
            "text": doc,
            "page": meta.get("page", 0),
            "section": meta.get("section", "") or None,
        }

    def delete_collection(self, session_id: str) -> None:
        """Delete a session's collection."""
        try:
            self._client.delete_collection(
                name=self._collection_name(session_id),
            )
        except Exception as exc:
            raise VectorStoreError(
                f"Failed to delete collection for session {session_id}: {exc}"
            ) from exc
