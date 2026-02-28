from app.config import Settings
from app.models.domain import ContextChunk, RetrievalResult
from app.services.llm_service import LLMService
from app.services.session_service import SessionService
from app.services.vector_service import VectorService

SYSTEM_PROMPT = """\
You are a board game rulebook expert. Answer questions based ONLY on the provided rulebook context.

Rules:
1. Use ONLY the provided context to answer. If the context doesn't contain the answer, say so explicitly.
2. ALWAYS include inline citations using the format [p.X, §Y] where X is the page number and Y is the section name.
3. If a rule is ambiguous, present multiple interpretations and cite each.
4. Match the user's language (Korean or English).
5. For complex rules, structure your answer with bullet points or numbered steps.
6. If asked about rules not in the provided context, explicitly state that the information is not available in the uploaded rulebook.
"""


class RetrievalService:
    """Full RAG pipeline: embed query -> retrieve -> generate."""

    def __init__(
        self,
        vector_service: VectorService,
        llm_service: LLMService,
        session_service: SessionService,
        settings: Settings,
    ) -> None:
        self._vector = vector_service
        self._llm = llm_service
        self._sessions = session_service
        self._settings = settings

    def process_query(self, session_id: str, query: str) -> RetrievalResult:
        """Execute the full retrieval-augmented generation pipeline.

        1. Look up the session.
        2. Embed the user query.
        3. Vector search for relevant chunks.
        4. Build labelled context.
        5. Construct message history with the new query + context.
        6. Generate a response via the LLM.
        7. Persist the user and assistant turns.
        8. Return a ``RetrievalResult``.
        """
        session = self._sessions.get_session(session_id)

        # 1. Embed the query
        query_embeddings = self._llm.embed(
            model=self._settings.embedding_model,
            texts=[query],
        )
        query_embedding = query_embeddings[0]

        # 2. Retrieve top-K chunks
        raw_results = self._vector.query(
            session_id=session_id,
            query_embedding=query_embedding,
            top_k=self._settings.retrieval_top_k,
        )

        # 3. Build ContextChunks and labelled context block
        context_chunks: list[ContextChunk] = []
        context_parts: list[str] = []

        for chunk_id, distance, meta in raw_results:
            page = meta.get("page", 0)
            section = meta.get("section", "") or None
            text = meta.get("document", "")

            section_label = f"§{section}" if section else "§General"
            label = f"[p.{page}, {section_label}]"

            # ChromaDB cosine distance: 0 = identical, 2 = opposite
            # Convert to a similarity-like score (higher = better)
            score = max(0.0, 1.0 - distance)

            # Resolve the full Chunk from the session store if available
            chunk = session.chunks.get(chunk_id)
            if chunk is None:
                # Fallback: construct a minimal Chunk from metadata
                from app.models.domain import Chunk
                from app.services.chunking_service import estimate_tokens

                chunk = Chunk(
                    chunk_id=chunk_id,
                    text=text,
                    page_number=page,
                    section_title=section,
                    token_count=estimate_tokens(text),
                )

            context_chunks.append(
                ContextChunk(chunk=chunk, score=score, label=label)
            )
            context_parts.append(f"{label}:\n{text}")

        context_block = "\n\n---\n\n".join(context_parts)

        # 4. Build messages from conversation history + new query
        messages: list[dict] = []
        for turn in session.conversation:
            role = "model" if turn["role"] == "assistant" else turn["role"]
            messages.append({"role": role, "text": turn["content"]})

        # Append the current user query with context
        user_message = (
            f"Context from the rulebook:\n\n{context_block}\n\n"
            f"---\n\nQuestion: {query}"
        )
        messages.append({"role": "user", "text": user_message})

        # 5. Generate
        answer = self._llm.generate(
            model=session.model,
            system_prompt=SYSTEM_PROMPT,
            messages=messages,
            temperature=self._settings.generation_temperature,
            top_p=self._settings.generation_top_p,
            max_tokens=self._settings.generation_max_output_tokens,
        )

        # 6. Store conversation turns
        self._sessions.add_turn(
            session_id,
            role="user",
            content=query,
            max_turns=self._settings.max_conversation_turns,
        )
        self._sessions.add_turn(
            session_id,
            role="assistant",
            content=answer,
            max_turns=self._settings.max_conversation_turns,
        )

        return RetrievalResult(
            answer=answer,
            sources=context_chunks,
            model_used=session.model,
        )
