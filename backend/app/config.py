"""Runtime settings, read from environment variables (never hard-code secrets)."""
import os
from dataclasses import dataclass, field
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent


def _list(name: str, default: str) -> list[str]:
    return [x.strip() for x in os.getenv(name, default).split(",") if x.strip()]


@dataclass
class Settings:
    knowledge_dir: Path = field(default_factory=lambda: Path(os.getenv("KNOWLEDGE_DIR", BASE / "knowledge")))
    index_dir: Path = field(default_factory=lambda: Path(os.getenv("INDEX_DIR", BASE / "data")))

    # embeddings: "auto" (MiniLM if installed, else local), "minilm", or "local"
    embedder: str = field(default_factory=lambda: os.getenv("EMBEDDER", "auto"))
    minilm_model: str = field(default_factory=lambda: os.getenv("MINILM_MODEL", "sentence-transformers/all-MiniLM-L6-v2"))

    # generation: "auto" (Anthropic if a key is set, else extractive), "anthropic", or "extractive"
    llm_provider: str = field(default_factory=lambda: os.getenv("LLM_PROVIDER", "auto"))
    anthropic_api_key: str = field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))
    anthropic_model: str = field(default_factory=lambda: os.getenv("ANTHROPIC_MODEL", "claude-haiku-5-5"))
    max_output_tokens: int = field(default_factory=lambda: int(os.getenv("MAX_OUTPUT_TOKENS", "400")))

    # retrieval
    top_k: int = field(default_factory=lambda: int(os.getenv("TOP_K", "4")))
    min_score: float | None = field(default_factory=lambda: float(os.environ["MIN_SCORE"]) if "MIN_SCORE" in os.environ else None)

    # API hardening
    cors_origins: list[str] = field(default_factory=lambda: _list("CORS_ORIGINS", "http://localhost:3000"))
    rate_limit_per_min: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_PER_MIN", "20")))
    max_message_chars: int = field(default_factory=lambda: int(os.getenv("MAX_MESSAGE_CHARS", "500")))
    shared_secret: str = field(default_factory=lambda: os.getenv("CHAT_SHARED_SECRET", ""))
