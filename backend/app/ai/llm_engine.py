"""Configurable LLM client with graceful degradation.

Supported providers:
- OpenAI or any OpenAI-compatible endpoint (OpenRouter, Groq, Ollama, vLLM)
- LangChain's ChatOpenAI adapter (set LLM_PROVIDER=langchain)

When no key/provider is configured every caller falls back to the curated,
deterministic engine. The application never fails because the LLM is down.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from ..config import settings
from .rag_engine import extract_json

logger = logging.getLogger("smartlearn.llm")


class LLMEngine:
    def __init__(self) -> None:
        self.provider = (settings.LLM_PROVIDER or "none").lower()
        self.last_error: str | None = None
        self._client = None
        if settings.llm_enabled and self.provider in {"openai", "compatible", "ollama", "langchain"}:
            if self.provider != "langchain":
                try:
                    from openai import OpenAI

                    self._client = OpenAI(
                        api_key=settings.LLM_API_KEY,
                        base_url=settings.LLM_BASE_URL,
                        timeout=settings.LLM_TIMEOUT_SECONDS,
                    )
                except Exception as exc:  # pragma: no cover - configuration dependent
                    self.last_error = f"LLM client init failed: {exc}"
                    logger.warning(self.last_error)

    @property
    def available(self) -> bool:
        return bool(settings.llm_enabled) and (self._client is not None or self.provider == "langchain")

    def status(self) -> dict[str, Any]:
        return {
            "enabled": settings.llm_enabled,
            "available": self.available,
            "provider": self.provider,
            "model": settings.LLM_MODEL,
            "base_url": settings.LLM_BASE_URL if self.available else None,
            "fallback": "curated deterministic engine",
            "last_error": self.last_error,
        }

    def chat(self, messages: list[dict[str, str]], json_mode: bool = False) -> str | None:
        if not self.available:
            return None
        if self.provider == "langchain":
            return self._chat_langchain(messages, json_mode)
        try:
            kwargs: dict[str, Any] = {
                "model": settings.LLM_MODEL,
                "messages": messages,
                "temperature": settings.LLM_TEMPERATURE,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            response = self._client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content
            self.last_error = None
            return content
        except Exception as exc:  # noqa: BLE001
            self.last_error = f"{type(exc).__name__}: {exc}"
            logger.warning("LLM request failed: %s", self.last_error)
            return None

    def _chat_langchain(self, messages: list[dict[str, str]], json_mode: bool) -> str | None:
        try:
            from langchain_core.messages import HumanMessage, SystemMessage
            from langchain_openai import ChatOpenAI

            llm = ChatOpenAI(
                model=settings.LLM_MODEL,
                api_key=settings.LLM_API_KEY,
                base_url=settings.LLM_BASE_URL,
                temperature=settings.LLM_TEMPERATURE,
                timeout=settings.LLM_TIMEOUT_SECONDS,
            )
            converted = []
            for m in messages:
                cls = SystemMessage if m["role"] == "system" else HumanMessage
                converted.append(cls(content=m["content"]))
            response = llm.invoke(converted)
            self.last_error = None
            return response.content if isinstance(response.content, str) else str(response.content)
        except Exception as exc:  # noqa: BLE001
            self.last_error = f"LangChain: {type(exc).__name__}: {exc}"
            logger.warning(self.last_error)
            return None

    def json_completion(self, system: str, user: str) -> dict[str, Any] | None:
        raw = self.chat(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            json_mode=True,
        )
        if not raw:
            return None
        payload = extract_json(raw)
        if not payload:
            return None
        try:
            data = json.loads(payload)
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            self.last_error = "LLM returned invalid JSON"
            return None


llm_engine = LLMEngine()
