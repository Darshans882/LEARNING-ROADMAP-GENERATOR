"""Load and clean the curated CSV catalogue into the database."""
from __future__ import annotations

import math
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from ..models import (
    CareerRole,
    Course,
    LearningResource,
    Project,
    Skill,
    SkillPrerequisite,
)

DATASETS = Path(__file__).resolve().parents[1] / "datasets"


def _clean(value):
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _num(value) -> float | None:
    value = _clean(value)
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _bool(value) -> bool:
    value = _clean(value)
    if value is None:
        return False
    return str(value).lower() in {"1", "true", "yes", "y"}


def _list(value) -> list[str]:
    value = _clean(value)
    if not value:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return [v.strip() for v in str(value).split("|") if v.strip()]


def _read(name: str) -> pd.DataFrame:
    path = DATASETS / name
    if not path.exists():
        raise FileNotFoundError(f"Missing dataset {path}. Run tools/build_datasets.py")
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    return df.where(pd.notnull(df), None)


def load_catalogue(db: Session) -> dict[str, int]:
    """Idempotently upsert catalogue rows. Returns counts."""
    skills = _read("skills.csv")
    existing_skills = {s.skill_id for s in db.query(Skill).all()}
    for _, r in skills.iterrows():
        if r["skill_id"] not in existing_skills:
            db.add(Skill(
                skill_id=r["skill_id"], skill_name=r["skill_name"], category=r["category"],
                level=r["level"], description=r["description"] or "", aliases=r["aliases"] or "",
            ))
    db.flush()

    prereqs = _read("skill_prerequisites.csv")
    existing_prereqs = {
        (p.skill_id, p.prerequisite_skill_id) for p in db.query(SkillPrerequisite).all()
    }
    for _, r in prereqs.iterrows():
        key = (r["skill_id"], r["prerequisite_skill_id"])
        if key not in existing_prereqs:
            db.add(SkillPrerequisite(
                skill_id=r["skill_id"], prerequisite_skill_id=r["prerequisite_skill_id"],
                strength=r.get("strength") or "required",
            ))
    db.flush()

    roles = _read("career_roles.csv")
    existing_roles = {x.role_id: x for x in db.query(CareerRole).all()}
    for _, r in roles.iterrows():
        phase_skills = []
        for i in range(1, 7):
            phase_skills.append(_list(r.get(f"phase{i}_skills")))
        values = dict(
            title=r["title"], category=r["category"], description=r["description"] or "",
            required_skills=_list(r["required_skills"]), core_skills=_list(r["core_skills"]),
            advanced_skills=_list(r["advanced_skills"]), phase_titles=_list(r["phase_titles"]),
            phase_skills=phase_skills, onet_code=r.get("onet_code"), esco_uri=r.get("esco_uri"),
            demand_outlook=r.get("demand_outlook"), keywords=r.get("keywords") or "",
        )
        if r["role_id"] in existing_roles:
            for k, v in values.items():
                setattr(existing_roles[r["role_id"]], k, v)
        else:
            db.add(CareerRole(role_id=r["role_id"], **values))
    db.flush()

    courses = _read("courses.csv")
    existing_courses = {c.course_id: c for c in db.query(Course).all()}
    for _, r in courses.iterrows():
        values = dict(
            title=r["title"], description=r["description"] or "", skills=_list(r["skills"]),
            category=r["category"], difficulty=(r["difficulty"] or "intermediate").lower(),
            platform=r["platform"], url=r["url"], link_type=r.get("link_type") or "direct",
            duration_hours=_num(r.get("duration_hours")),
            duration_is_estimate=_bool(r.get("duration_is_estimate")),
            price_type=r.get("price_type") or "Free", price_usd=_num(r.get("price_usd")),
            price_note=r.get("price_note") or "", language=r.get("language") or "English",
            prerequisites=_list(r.get("prerequisites")), certificate=_bool(r.get("certificate")),
            rating=_num(r.get("rating")), rating_count=int(_num(r.get("rating_count")) or 0) or None,
            verified=_bool(r.get("verified")), verification_note=r.get("verification_note") or "",
            learning_type=r.get("learning_type") or "Video", last_checked=r.get("last_checked"),
            is_active=True,
        )
        if r["course_id"] in existing_courses:
            for k, v in values.items():
                setattr(existing_courses[r["course_id"]], k, v)
        else:
            db.add(Course(course_id=r["course_id"], **values))
    db.flush()

    projects = _read("projects.csv")
    existing_projects = {p.project_id for p in db.query(Project).all()}
    for _, r in projects.iterrows():
        if r["project_id"] not in existing_projects:
            db.add(Project(
                project_id=r["project_id"], title=r["title"], description=r["description"] or "",
                career_role=r.get("career_role") or "all", skills=_list(r["skills"]),
                difficulty=r.get("difficulty") or "intermediate",
                duration_hours=_num(r.get("duration_hours")) or 20,
                project_type=r.get("project_type") or "major", deliverables=r.get("deliverables") or "",
                github_url=_clean(r.get("github_url")), reference_url=_clean(r.get("reference_url")),
            ))
    db.flush()

    resources = _read("learning_resources.csv")
    existing_resources = {x.resource_id for x in db.query(LearningResource).all()}
    for _, r in resources.iterrows():
        if r["resource_id"] not in existing_resources:
            db.add(LearningResource(
                resource_id=r["resource_id"], title=r["title"], resource_type=r.get("resource_type") or "Documentation",
                url=r["url"], skills=_list(r.get("skills")), platform=r.get("platform") or "",
                price_type=r.get("price_type") or "Free", description=r.get("description") or "",
            ))
    db.commit()

    return {
        "skills": db.query(Skill).count(),
        "courses": db.query(Course).count(),
        "careers": db.query(CareerRole).count(),
        "projects": db.query(Project).count(),
        "resources": db.query(LearningResource).count(),
    }
