"""Retrieval-Augmented Generation index.

Primary backend: ChromaDB (optional, enabled with USE_CHROMA=true).
Fallback backend: an in-process TF-IDF cosine index, which keeps the whole
application functional offline and without extra infrastructure.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from ..config import settings
from ..models import CareerRole, Course, LearningResource, Project, Skill


@dataclass
class RetrievedDocument:
    id: str
    text: str
    metadata: dict[str, Any]
    score: float = 0.0

    def as_source(self) -> dict[str, Any]:
        return {
            "title": self.metadata.get("title", self.id),
            "type": self.metadata.get("type", "document"),
            "url": self.metadata.get("url"),
            "verified": self.metadata.get("verified"),
        }


class RAGEngine:
    def __init__(self, db: Session):
        self.db = db
        self.backend = "tfidf"
        self.documents = self._build_documents()
        self._vectorizer: TfidfVectorizer | None = None
        self._matrix = None
        self._chroma = None
        if not self.documents:
            return
        if settings.USE_CHROMA and settings.llm_enabled:
            self._try_chroma()
        if self._chroma is None:
            self._fit_tfidf()

    # ------------------------------------------------------------------
    # Document construction
    # ------------------------------------------------------------------
    def _build_documents(self) -> list[RetrievedDocument]:
        skill_names = {s.skill_id: s.skill_name for s in self.db.query(Skill).all()}
        docs: list[RetrievedDocument] = []

        for c in self.db.query(Course).filter(Course.is_active.is_(True)).all():
            skill_text = ", ".join(skill_names.get(s, s) for s in (c.skills or []))
            docs.append(RetrievedDocument(
                id=f"course:{c.course_id}",
                text=(
                    f"Course: {c.title}. Platform: {c.platform}. Category: {c.category}. "
                    f"Difficulty: {c.difficulty}. Skills: {skill_text}. "
                    f"Duration: {c.duration_hours or 'unknown'} hours. Price: {c.price_type}. "
                    f"Language: {c.language}. Description: {c.description} "
                    f"Verification: {'verified direct page' if c.verified else 'catalogue/search - needs verification'}."
                ),
                metadata={
                    "type": "course", "id": c.course_id, "title": c.title, "url": c.url,
                    "verified": bool(c.verified), "platform": c.platform, "skills": c.skills,
                    "difficulty": c.difficulty,
                },
            ))

        for r in self.db.query(CareerRole).all():
            docs.append(RetrievedDocument(
                id=f"career:{r.role_id}",
                text=(
                    f"Career role: {r.title}. Category: {r.category}. {r.description} "
                    f"Required skills: {', '.join(skill_names.get(s, s) for s in (r.required_skills or []))}. "
                    f"Demand: {r.demand_outlook or 'not specified'}."
                ),
                metadata={"type": "career", "id": r.role_id, "title": r.title, "url": r.esco_uri},
            ))

        for p in self.db.query(Project).all():
            docs.append(RetrievedDocument(
                id=f"project:{p.project_id}",
                text=(
                    f"Project: {p.title}. For {p.career_role}. Skills: "
                    f"{', '.join(skill_names.get(s, s) for s in (p.skills or []))}. "
                    f"Difficulty: {p.difficulty}. Estimated {p.duration_hours} hours. {p.description} "
                    f"Deliverables: {p.deliverables}."
                ),
                metadata={"type": "project", "id": p.project_id, "title": p.title, "url": p.reference_url},
            ))

        for res in self.db.query(LearningResource).all():
            docs.append(RetrievedDocument(
                id=f"resource:{res.resource_id}",
                text=f"{res.resource_type}: {res.title}. {res.description} Skills: {', '.join(res.skills or [])}.",
                metadata={"type": "resource", "id": res.resource_id, "title": res.title, "url": res.url},
            ))

        for s in self.db.query(Skill).all():
            docs.append(RetrievedDocument(
                id=f"skill:{s.skill_id}",
                text=(
                    f"Skill: {s.skill_name}. Category: {s.category}. Level: {s.level}. {s.description} "
                    f"Also known as: {s.aliases}."
                ),
                metadata={"type": "skill", "id": s.skill_id, "title": s.skill_name},
            ))
        return docs

    # ------------------------------------------------------------------
    # Backends
    # ------------------------------------------------------------------
    def _fit_tfidf(self) -> None:
        self._vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english", sublinear_tf=True)
        self._matrix = self._vectorizer.fit_transform([d.text.lower() for d in self.documents])
        self.backend = "tfidf"

    def _try_chroma(self) -> None:
        try:
            import chromadb
            from chromadb.utils import embedding_functions

            embed = embedding_functions.OpenAIEmbeddingFunction(
                api_key=settings.LLM_API_KEY, model_name=settings.EMBEDDING_MODEL,
            )
            client = chromadb.PersistentClient(path=settings.CHROMA_DIR)
            collection = client.get_or_create_collection(
                name="smartlearn_catalogue", embedding_function=embed,
                metadata={"hnsw:space": "cosine"},
            )
            if collection.count() < len(self.documents):
                collection.upsert(
                    ids=[d.id for d in self.documents],
                    documents=[d.text for d in self.documents],
                    metadatas=[{k: v for k, v in d.metadata.items() if isinstance(v, (str, int, float, bool))}
                               for d in self.documents],
                )
            self._chroma = collection
            self.backend = "chroma"
        except Exception:
            self._chroma = None

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------
    def retrieve(
        self,
        query: str,
        k: int = 6,
        types: list[str] | None = None,
    ) -> list[RetrievedDocument]:
        if not self.documents or not query.strip():
            return []
        if self._chroma is not None:
            try:
                where = {"type": {"$in": types}} if types else None
                result = self._chroma.query(query_texts=[query], n_results=k, where=where)
                docs: list[RetrievedDocument] = []
                by_id = {d.id: d for d in self.documents}
                for doc_id, distance in zip(result["ids"][0], result["distances"][0]):
                    base = by_id.get(doc_id)
                    if base:
                        docs.append(RetrievedDocument(
                            id=base.id, text=base.text, metadata=base.metadata,
                            score=round(1 - float(distance), 4),
                        ))
                if docs:
                    return docs
            except Exception:
                if self._matrix is None:
                    self._fit_tfidf()

        assert self._vectorizer is not None and self._matrix is not None
        query_vec = self._vectorizer.transform([query.lower()])
        scores = cosine_similarity(query_vec, self._matrix).flatten()
        order = scores.argsort()[::-1]
        results = []
        for idx in order:
            if scores[idx] <= 0.01:
                break
            doc = self.documents[int(idx)]
            if types and doc.metadata.get("type") not in types:
                continue
            results.append(RetrievedDocument(
                id=doc.id, text=doc.text, metadata=doc.metadata, score=round(float(scores[idx]), 4)
            ))
            if len(results) >= k:
                break
        return results

    def catalogue_context(self, query: str, k: int = 6) -> str:
        docs = self.retrieve(query, k=k, types=["course", "career", "project", "resource"])
        if not docs:
            return "No catalogue documents matched."
        lines = []
        for d in docs:
            meta = d.metadata
            lines.append(
                f"[{meta.get('type')}] {meta.get('title')} | url={meta.get('url') or 'n/a'} | "
                f"verified={meta.get('verified')} | {d.text[:450]}"
            )
        return "\n".join(lines)


def extract_json(text: str) -> str | None:
    """Extract the first JSON object from an LLM response."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    match = re.search(r"\{.*\}", text, re.DOTALL)
    return match.group(0) if match else None
