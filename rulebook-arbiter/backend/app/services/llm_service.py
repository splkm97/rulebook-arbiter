from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.errors.handlers import LLMError


def _is_retryable(exc: BaseException) -> bool:
    """Return True only for transient errors worth retrying."""
    if isinstance(exc, LLMError):
        return False
    if isinstance(exc, genai_errors.APIError):
        return exc.code in (429, 500, 502, 503, 504)
    # Unknown exceptions (network errors, timeouts) are retryable
    return True


class LLMService:
    """Google GenAI client for generation and embedding."""

    def __init__(self, api_key: str) -> None:
        self._client = genai.Client(api_key=api_key)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=1, max=10),
        retry=retry_if_exception(_is_retryable),
        reraise=True,
    )
    def generate(
        self,
        model: str,
        system_prompt: str,
        messages: list[dict],
        temperature: float,
        top_p: float,
        max_tokens: int,
    ) -> str:
        """Generate a response using Gemini.

        *messages* is a list of ``{"role": "user" | "model", "text": str}``.
        Uses ``client.models.generate_content`` with a
        ``GenerateContentConfig``.
        """
        contents: list[types.Content] = []
        for msg in messages:
            role = msg["role"]
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg["text"])],
                )
            )

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            top_p=top_p,
            max_output_tokens=max_tokens,
        )

        try:
            response = self._client.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
        except Exception as exc:
            raise LLMError(f"Gemini generation failed: {exc}") from exc

        if not response.text:
            raise LLMError("Gemini returned an empty response")

        return response.text

    def embed(self, model: str, texts: list[str]) -> list[list[float]]:
        """Batch embed texts.

        Processes in batches of 100 to respect API limits. Returns a
        flat list of embedding vectors in the same order as *texts*.
        """
        all_embeddings: list[list[float]] = []
        batch_size = 100

        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            try:
                response = self._client.models.embed_content(
                    model=model,
                    contents=batch,
                )
            except Exception as exc:
                raise LLMError(f"Embedding failed: {exc}") from exc

            for embedding in response.embeddings:
                all_embeddings.append(list(embedding.values))

        return all_embeddings
