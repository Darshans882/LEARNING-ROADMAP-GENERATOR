"""Career role catalogue and matching routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..ai.recommendation import CourseRecommender
from ..ai.skill_analyzer import recommend_careers
from ..database import get_db
from ..deps import get_current_user, get_profile, verified_student
from ..models import CareerRole, Course, Skill, StudentProfile, User
from ..schemas import CareerRecommendationOut, CareerRoleOut, CourseRecommendationOut
from ..ai.recommendation import to_dict as rec_to_dict

router = APIRouter(prefix="/careers", tags=["Careers"])
FEATURED = ["data-scientist", "full-stack-developer", "ui-ux-designer", "cybersecurity-analyst"]


@router.get("", response_model=list[CareerRoleOut])
def list_careers(
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CareerRole]:
    query = db.query(CareerRole)
    if category:
        query = query.filter(CareerRole.category == category)
    roles = query.order_by(CareerRole.title).all()
    if q:
        needle = q.strip().lower()
        roles = [
            r for r in roles
            if needle in r.title.lower() or needle in (r.description or "").lower()
            or needle in (r.keywords or "").lower() or needle in r.category.lower()
        ]
    return roles


@router.get("/featured", response_model=list[CareerRoleOut])
def featured_careers(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CareerRole]:
    roles = db.query(CareerRole).all()
    ranked = sorted(roles, key=lambda r: FEATURED.index(r.role_id) if r.role_id in FEATURED else 99)
    return ranked[:6]


@router.get("/matches", response_model=list[CareerRecommendationOut])
def match_careers(
    limit: int = Query(default=6, ge=1, le=20),
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> list[dict]:
    return recommend_careers(db, profile, limit=limit)


@router.get("/{role_id}", response_model=CareerRoleOut)
def get_career(
    role_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CareerRole:
    role = db.get(CareerRole, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Career role not found")
    return role


@router.get("/{role_id}/skills")
def career_skills(
    role_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    role = db.get(CareerRole, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Career role not found")
    skills = {s.skill_id: s for s in db.query(Skill).all()}
    groups = {"core": role.core_skills or [], "advanced": role.advanced_skills or [], "all": role.required_skills or []}
    return {
        "role_id": role.role_id,
        "title": role.title,
        "phases": [
            {
                "phase": idx + 1,
                "title": role.phase_titles[idx] if idx < len(role.phase_titles) else f"Phase {idx + 1}",
                "skills": [
                    {"skill_id": sid, "skill_name": skills[sid].skill_name if sid in skills else sid}
                    for sid in (group or [])
                ],
            }
            for idx, group in enumerate(role.phase_skills or [])
        ],
        "skills": {
            key: [
                {"skill_id": sid, "skill_name": skills[sid].skill_name if sid in skills else sid}
                for sid in ids
            ]
            for key, ids in groups.items()
        },
    }


@router.get("/{role_id}/courses", response_model=list[CourseRecommendationOut])
def career_courses(
    role_id: str,
    limit: int = Query(default=12, ge=1, le=40),
    db: Session = Depends(get_db),
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
) -> list[dict]:
    role = db.get(CareerRole, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Career role not found")
    recommender = CourseRecommender(db)
    recs = recommender.recommend(
        profile,
        role.required_skills or [],
        limit=limit,
        career_title=role.title,
    )
    return [rec_to_dict(r) for r in recs]
