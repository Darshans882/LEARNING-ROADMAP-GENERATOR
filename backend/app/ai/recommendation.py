"""Content-based course recommendation engine using Pandas + scikit-learn."""
from __future__ import annotations

import re
import pickle
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from ..models import Course, Skill, StudentProfile

DIFFICULTY_RANK = {"beginner": 1, "intermediate": 2, "advanced": 3}
LEVEL_RANK = {"Beginner": 1, "Intermediate": 2, "Advanced": 3}
MODEL_ARTIFACT = Path(__file__).resolve().parents[2] / "model_artifacts" / "course_recommender.pkl"


def _skills_text(skills: list[str], skill_names: dict[str, str]) -> str:
    return " ".join(skill_names.get(s, s).replace("-", " ") for s in skills)


@dataclass
class Recommendation:
    course: Course
    score: float
    matched_skills: list[str]
    reasons: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    prerequisite_met: bool = True


class CourseRecommender:
    def __init__(self, db: Session):
        self.db = db
        self.skills = {s.skill_id: s for s in db.query(Skill).all()}
        self.courses = db.query(Course).filter(Course.is_active.is_(True)).all()
        self.by_id = {c.course_id: c for c in self.courses}
        self._build_index()

    def _build_index(self) -> None:
        if not self.courses:
            self.df = pd.DataFrame()
            self.matrix = None
            self.vectorizer = None
            return
        rows = []
        for c in self.courses:
            skill_names = _skills_text(c.skills or [], {k: v.skill_name for k, v in self.skills.items()})
            text = " ".join(filter(None, [
                c.title, c.description, skill_names, c.category,
                c.platform, c.difficulty, c.learning_type,
            ]))
            rows.append({
                "course_id": c.course_id,
                "text": re.sub(r"\s+", " ", text.lower()),
                "skills": set(c.skills or []),
            })
        self.df = pd.DataFrame(rows).sort_values("course_id").reset_index(drop=True)
        if self._load_trained_index():
            return
        self._fit_index()

    def _fit_index(self) -> None:
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2), stop_words="english", max_features=4000, sublinear_tf=True,
        )
        self.matrix = self.vectorizer.fit_transform(self.df["text"])

    def _load_trained_index(self) -> bool:
        if not MODEL_ARTIFACT.exists():
            return False
        try:
            with MODEL_ARTIFACT.open("rb") as artifact_file:
                artifact = pickle.load(artifact_file)
        except (OSError, ValueError, EOFError):
            return False
        if artifact.get("version") != 1 or artifact.get("course_ids") != self.df["course_id"].tolist():
            return False
        if artifact.get("texts") != self.df["text"].tolist():
            return False
        self.vectorizer = artifact["vectorizer"]
        self.matrix = artifact["matrix"]
        return True

    def _budget_ok(self, course: Course, budget: str) -> bool:
        if budget == "Free":
            return course.price_type == "Free"
        return True

    def _difficulty_score(self, course: Course, level: str, target_level: str) -> float:
        student_rank = LEVEL_RANK.get(level, 1)
        course_rank = DIFFICULTY_RANK.get(course.difficulty, 2)
        distance = course_rank - student_rank
        if distance == 0:
            return 1.0
        if distance == 1:
            return 0.85
        if distance == 2:
            return 0.55
        return 0.7  # easier than current level: consolidation value

    def recommend(
        self,
        profile: StudentProfile,
        target_skills: list[str],
        known_skills: set[str] | None = None,
        limit: int = 8,
        exclude_ids: set[str] | None = None,
        allow_catalogue: bool = True,
        career_title: str = "",
    ) -> list[Recommendation]:
        if self.matrix is None or self.df.empty:
            return []
        known_skills = known_skills or set()
        exclude_ids = exclude_ids or set()
        target_skills = [s for s in dict.fromkeys(target_skills) if s]
        skill_query = _skills_text(target_skills, {k: v.skill_name for k, v in self.skills.items()})
        query_text = " ".join(filter(None, [skill_query, career_title, profile.proficiency_level]))
        if not query_text.strip():
            return []
        query_vec = self.vectorizer.transform([query_text.lower()])
        semantic = cosine_similarity(query_vec, self.matrix).flatten()

        results: list[Recommendation] = []
        target_set = set(target_skills)
        for idx, row in self.df.iterrows():
            course = self.by_id[row["course_id"]]
            if course.course_id in exclude_ids:
                continue
            if not self._budget_ok(course, profile.budget_pref or "Both"):
                continue
            if course.link_type != "direct" and not allow_catalogue:
                continue

            overlap = target_set & row["skills"]
            if target_skills and not overlap:
                # Keep semantically close courses as fallback, lower rank.
                if semantic[idx] < 0.12:
                    continue

            score = 0.0
            reasons: list[str] = []
            warnings: list[str] = []

            overlap_ratio = len(overlap) / max(1, len(target_set))
            score += overlap_ratio * 42
            if overlap:
                names = ", ".join(self.skills[s].skill_name for s in list(overlap)[:4])
                reasons.append(f"Covers {names}")
                if len(overlap) > 1 and course.link_type == "search":
                    outcomes = ", ".join(course.skills[:6])
                    reasons.append(
                        f"This catalogue search covers several target skills ({outcomes}); "
                        "select the specific course that matches the current focus."
                    )

            score += float(semantic[idx]) * 18
            diff_score = self._difficulty_score(course, profile.proficiency_level, "Job-ready")
            score += diff_score * 14
            if course.difficulty == profile.proficiency_level.lower():
                reasons.append(f"Matches your {profile.proficiency_level.lower()} level")
            elif DIFFICULTY_RANK.get(course.difficulty, 2) > LEVEL_RANK.get(profile.proficiency_level, 1):
                reasons.append("Stretch course that builds on what you know")

            if course.price_type == "Free":
                score += 8
                reasons.append("Free")
            elif course.price_type == "Freemium":
                score += 4

            if course.language.lower() == (profile.course_language or "English").lower():
                score += 6
            elif (profile.course_language or "English").lower() != "english":
                warnings.append(
                    f"Course language is {course.language}; your preferred language is {profile.course_language}"
                )

            preferred = [p.strip().lower() for p in (profile.preferred_platforms or [])]
            if course.platform.lower() in preferred:
                score += 5
                reasons.append(f"From your preferred platform, {course.platform}")

            if course.verified and course.link_type == "direct":
                score += 6
                reasons.append("Verified direct course page")
            elif course.verified:
                score += 2
            else:
                warnings.append("Catalogue/search link - verify the current course, price and duration before enrolling")

            prereq_met = all(p in known_skills for p in (course.prerequisites or []))
            if not prereq_met:
                course_prereqs = [p for p in course.prerequisites if p not in known_skills]
                prereq_names = ", ".join(self.skills.get(p, p).skill_name if p in self.skills else p for p in course_prereqs)
                warnings.append(f"Prerequisites to review first: {prereq_names}")
                score -= 5
            else:
                score += 4
                if course.prerequisites:
                    reasons.append("Prerequisites are already covered by your profile")

            if course.rating is not None:
                score += min(4.0, max(0.0, (course.rating - 3.5) * 4))

            results.append(Recommendation(
                course=course,
                score=round(max(0.0, min(99.0, score)), 1),
                matched_skills=[self.skills[s].skill_name for s in overlap],
                reasons=reasons[:4],
                warnings=warnings[:3],
                prerequisite_met=prereq_met,
            ))

        results.sort(key=lambda r: (r.score, len(r.matched_skills), r.course.verified), reverse=True)
        return results[:limit]

    def recommend_per_skill(
        self,
        profile: StudentProfile,
        skills: list[str],
        known_skills: set[str] | None = None,
        max_per_skill: int = 1,
        allow_catalogue: bool = True,
        career_title: str = "",
    ) -> dict[str, list[Recommendation]]:
        """Best course(s) for each individual missing skill, avoiding duplicates."""
        known_skills = known_skills or set()
        chosen: dict[str, list[Recommendation]] = {}
        used: set[str] = set()
        for skill_id in skills:
            candidates = self.recommend(
                profile, [skill_id], known_skills=known_skills,
                limit=8, exclude_ids=used, allow_catalogue=allow_catalogue,
                career_title=career_title,
            )
            picks = candidates[:max_per_skill]
            if not picks and allow_catalogue:
                # Fall back to a catalogue search for the bare skill name.
                candidates = self.recommend(
                    profile, [skill_id], known_skills=known_skills, limit=5,
                    exclude_ids=used, allow_catalogue=True, career_title=career_title,
                )
                picks = candidates[:max_per_skill]
            chosen[skill_id] = picks
            used.update(p.course.course_id for p in picks)
        return chosen


def to_dict(rec: Recommendation) -> dict[str, Any]:
    return {
        "course": rec.course,
        "score": rec.score,
        "matched_skills": rec.matched_skills,
        "reasons": rec.reasons,
        "warnings": rec.warnings,
        "prerequisite_met": rec.prerequisite_met,
    }
