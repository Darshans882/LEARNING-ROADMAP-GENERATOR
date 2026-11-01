"""Application configuration loaded from environment variables."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    APP_NAME: str = "SmartLearn AI"
    APP_VERSION: str = "1.0.0"
    ENV: str = os.getenv("ENV", "development")
    API_PREFIX: str = "/api"

    # Default is a local SQLite database so the app runs out of the box.
    # Set DATABASE_URL=postgresql+psycopg://user:pass@host:5432/smartlearn for Postgres.
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'smartlearn.db').as_posix()}")

    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production-smartlearn-dev-secret")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))

    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
        ).split(",")
        if o.strip()
    ]

    # LLM configuration. If no API key is present the app uses a deterministic
    # curated engine, so every feature remains functional offline.
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "openai")  # openai | ollama | none
    LLM_API_KEY: str = os.getenv("OPENAI_API_KEY", os.getenv("LLM_API_KEY", ""))
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.2"))
    LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "2500"))
    LLM_TIMEOUT_SECONDS: int = int(os.getenv("LLM_TIMEOUT_SECONDS", "45"))

    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    CHROMA_DIR: str = os.getenv("CHROMA_DIR", str(BASE_DIR / "chroma_store"))
    USE_CHROMA: bool = _bool("USE_CHROMA", False)

    COURSE_URL_VALIDATION: bool = _bool("COURSE_URL_VALIDATION", True)
    URL_VALIDATION_TIMEOUT: float = float(os.getenv("URL_VALIDATION_TIMEOUT", "6"))
    SEED_DEMO_DATA: bool = _bool("SEED_DEMO_DATA", True)

    @property
    def llm_enabled(self) -> bool:
        return bool(self.LLM_API_KEY) and self.LLM_PROVIDER.lower() not in {"none", "off", ""}

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith("postgresql")


settings = Settings()
