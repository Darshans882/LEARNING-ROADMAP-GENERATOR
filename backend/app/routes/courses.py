"""Course, skill and learning-resource catalogue routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..ai.recommendation import CourseRecommender
from ..ai.recommendation import to_dict as rec_to_dict
from ..database import get_db
from ..deps import get_current_user, get_profile, verified_student
from ..models import Course, LearningResource, Skill, StudentProfile, User
from ..schemas import (
    CourseOut,
    CourseRecommendationOut,
    ResourceOut,
    SkillOut,
)
from ..services.course_validator import validate_course_record

router = APIRouter(prefix="/courses", tags=["Courses"])
skills_router = APIRouter(prefix="/skills", tags=["Skills"])
resources_router = APIRouter(prefix="/resources", tags=["Resources"])


class RecommendationRequest(BaseModel):
    skill_ids: list[str] = Field(default_factory=list)
    limit: int = Field(default=8, ge=1, le=30)
    allow_catalogue: bool = True
    use_career_goal: bool = True


@router.get("")
def list_courses(
    q: str | None = Query(default=None, max_length=200),
    platform: str | None = Query(default=None),
    category: str | None = Query(default=None),
    difficulty: str | None = Query(default=None),
    price_type: str | None = Query(default=None),
    skill: str | None = Query(default=None),
    verified_only: bool = Query(default=False),
    active_only: bool = Query(default=True),
    sort: str = Query(default="recommended"),
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    query = db.query(Course)
    if active_only:
        query = query.filter(Course.is_active.is_(True))
    if platform:
        query = query.filter(func.lower(Course.platform) == platform.lower())
    if category:
        query = query.filter(func.lower(Course.category) == category.lower())
    if difficulty:
        query = query.filter(func.lower(Course.difficulty) == difficulty.lower())
    if price_type:
        query = query.filter(func.lower(Course.price_type) == price_type.lower())
    if verified_only:
        query = query.filter(Course.verified.is_(True), Course.link_type == "direct")
    if q:
        needle = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Course.title).like(needle),
                func.lower(Course.description).like(needle),
                func.lower(Course.platform).like(needle),
                func.lower(Course.category).like(needle),
            )
        )
    if skill:
        needle = skill.strip().lower()
        all_courses = query.all()
        courses = [c for c in all_courses if needle in [s.lower() for s in (c.skills or [])]]
        total = len(courses)
    else:
        total = query.count()
        courses = query.all()

    if sort in {"duration", "price", "title"}:
        if sort == "duration":
            courses.sort(key=lambda c: (c.duration_hours is None, c.duration_hours or 0))
        elif sort == "price":
            courses.sort(key=lambda c: (c.price_type != "Free", c.price_usd or 0))
        else:
            courses.sort(key=lambda c: c.title.lower())
    else:
        courses.sort(key=lambda c: (not (c.verified and c.link_type == "direct"), c.title.lower()))
    page = courses[offset: offset + limit]
    return {
        "items": [CourseOut.model_validate(c).model_dump() for c in page],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/filters")
def course_filters(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    courses = db.query(Course).filter(Course.is_active.is_(True)).all()
    skills = db.query(Skill).order_by(Skill.skill_name).all()
    return {
        "platforms": sorted({c.platform for c in courses}),
        "categories": sorted({c.category for c in courses}),
        "difficulties": ["beginner", "intermediate", "advanced"],
        "price_types": sorted({c.price_type for c in courses}),
        "skills": [
            {"skill_id": s.skill_id, "skill_name": s.skill_name, "category": s.category}
            for s in skills
        ],
        "counts": {
            "courses": len(courses),
            "verified_direct": sum(1 for c in courses if c.verified and c.link_type == "direct"),
            "free": sum(1 for c in courses if c.price_type == "Free"),
        },
    }


@router.get("/recommendations", response_model=list[CourseRecommendationOut])
def recommend_courses(
    skill_ids: str | None = Query(default=None, description="Comma-separated skill ids"),
    limit: int = Query(default=8, ge=1, le=30),
    allow_catalogue: bool = Query(default=True),
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> list[dict]:
    requested = [s.strip() for s in (skill_ids or "").split(",") if s.strip()]
    role = None
    if profile.career_role_id:
        from ..models import CareerRole

        role = db.get(CareerRole, profile.career_role_id)
    targets = requested or (role.required_skills if role else profile.technical_skills) or []
    recommender = CourseRecommender(db)
    recs = recommender.recommend(
        profile, targets, limit=limit, allow_catalogue=allow_catalogue,
        career_title=role.title if role else (profile.desired_role or ""),
    )
    return [rec_to_dict(r) for r in recs]


@router.post("/recommendations", response_model=list[CourseRecommendationOut])
def recommend_courses_post(
    payload: RecommendationRequest,
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> list[dict]:
    targets = payload.skill_ids
    role = None
    if profile.career_role_id:
        from ..models import CareerRole

        role = db.get(CareerRole, profile.career_role_id)
    if not targets and payload.use_career_goal and role:
        targets = role.required_skills or []
    recommender = CourseRecommender(db)
    recs = recommender.recommend(
        profile, targets, limit=payload.limit, allow_catalogue=payload.allow_catalogue,
        career_title=role.title if role else (profile.desired_role or ""),
    )
    return [rec_to_dict(r) for r in recs]


@router.get("/{course_id}", response_model=CourseOut)
def get_course(
    course_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Course:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.get("/{course_id}/related", response_model=list[CourseOut])
def related_courses(
    course_id: str,
    limit: int = Query(default=6, ge=1, le=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Course]:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    skill_set = set(course.skills or [])
    candidates = [
        c for c in db.query(Course).filter(Course.is_active.is_(True)).all()
        if c.course_id != course_id and skill_set.intersection(c.skills or [])
    ]
    candidates.sort(key=lambda c: (len(skill_set.intersection(c.skills or [])), c.verified), reverse=True)
    return candidates[:limit]


@router.post("/{course_id}/validate")
def validate_course(
    course_id: str,
    network: bool = Query(default=False, description="Perform a live HTTP reachability check"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return validate_course_record(db, course, network=network)


@skills_router.get("", response_model=list[SkillOut])
def list_skills(
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Skill]:
    query = db.query(Skill)
    if category:
        query = query.filter(func.lower(Skill.category) == category.lower())
    if q:
        needle = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Skill.skill_name).like(needle),
                func.lower(Skill.aliases).like(needle),
                func.lower(Skill.category).like(needle),
            )
        )
    return query.order_by(Skill.category, Skill.skill_name).all()


@skills_router.get("/categories")
def skill_categories(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    rows = (
        db.query(Skill.category, func.count(Skill.skill_id))
        .group_by(Skill.category)
        .order_by(Skill.category)
        .all()
    )
    return [{"category": category, "count": count} for category, count in rows]


@resources_router.get("", response_model=list[ResourceOut])
def list_resources(
    q: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[LearningResource]:
    query = db.query(LearningResource)
    if resource_type:
        query = query.filter(func.lower(LearningResource.resource_type) == resource_type.lower())
    if q:
        needle = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(LearningResource.title).like(needle),
                func.lower(LearningResource.description).like(needle),
                func.lower(LearningResource.platform).like(needle),
            )
        )
    return query.order_by(LearningResource.title).all()
