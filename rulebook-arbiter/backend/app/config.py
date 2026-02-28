from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str = ""
    generation_model: str = "gemini-3-flash-preview"
    embedding_model: str = "gemini-embedding-001"
    chunk_target_tokens: int = 600
    chunk_overlap_tokens: int = 100
    retrieval_top_k: int = 5
    chromadb_path: str = "./data/chromadb"
    max_conversation_turns: int = 10
    generation_max_output_tokens: int = 2048

    model_config = {"env_prefix": "RULEBOOK_", "env_file": ".env", "extra": "ignore"}
