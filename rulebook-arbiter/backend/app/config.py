from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str = ""
    generation_model: str = "gemini-2.0-flash"
    embedding_model: str = "text-embedding-004"
    chunk_target_tokens: int = 600
    chunk_overlap_tokens: int = 100
    retrieval_top_k: int = 5
    chromadb_path: str = "./data/chromadb"
    max_conversation_turns: int = 10
    generation_temperature: float = 0.3
    generation_top_p: float = 0.85
    generation_max_output_tokens: int = 2048

    model_config = {"env_prefix": "RULEBOOK_", "env_file": ".env"}
