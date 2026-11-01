"""Administrator routes: catalogue, students, usage and configuration."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import (
    ActivityLog,
    CareerRole,
    ChatMessage,
    Course,
    CourseProgress,
    LearningResource,
    Project,
    ProjectProgress,
    Roadmap,
    Skill,
    StudentProfile,
    User,
    utcnow,
)
from ..schemas import (
    AdminStatsOut,
    CourseCreate,
    CourseOut,
    CourseUpdate,
    ProjectOut,
    ResourceCreate,
    RoleCreate,
    SkillCreate,
)
from ..security import PasswordPolicyError, hash_password
from ..services.course_validator import validate_catalogue, validate_course_record
from ..services.dataset_loader import load_catalogue
from ..services.profile_service import profile_completeness

router = APIRouter(prefix="/admin", tags=["Admin"])


class RoleUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    description: str | None = None
    required_skills: list[str] | None = None
    core_skills: list[str] | None = None
    advanced_skills: list[str] | None = None
    phase_titles: list[str] | None = None
    phase_skills: list[list[str]] | None = None
    onet_code: str | None = None
    esco_uri: str | None = None
    demand_outlook: str | None = None
    keywords: str | None = None


class SkillUpdate(BaseModel):
    skill_name: str | None = None
    category: str | None = None
    level: str | None = None
    description: str | None = None
    aliases: str | None = None


class ResourceUpdate(BaseModel):
    title: str | None = None
    resource_type: str | None = None
    url: str | None = None
    skills: list[str] | None = None
    platform: str | None = None
    price_type: str | None = None
    description: str | None = None


class StudentUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    role: str | None = Field(default=None, pattern="^(student|admin)$")
    is_active: bool | None = None
    career_role_id: str | None = None
    desired_role: str | None = None


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=72)


def _student_row(db: Session, user: User) -> dict:
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    roadmap = (
        db.query(Roadmap)
        .filter(Roadmap.user_id == user.id, Roadmap.is_active.is_(True))
        .order_by(Roadmap.created_at.desc())
        .first()
    )
    completed = (
        db.query(CourseProgress)
        .filter(CourseProgress.user_id == user.id, CourseProgress.status == "completed")
        .count()
    )
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "last_login": user.last_login,
        "college_name": profile.college_name if profile else None,
        "degree": profile.degree if profile else None,
        "department": profile.department if profile else None,
        "career_goal": (profile.desired_role if profile else None) or (roadmap.career_goal if roadmap else None),
        "career_role_id": profile.career_role_id if profile else None,
        "onboarding_completed": bool(profile and profile.onboarding_completed),
        "profile_completeness": profile_completeness(profile),
        "active_roadmap": roadmap.career_goal if roadmap else None,
        "completed_courses": completed,
    }


@router.get("/stats", response_model=AdminStatsOut)
def admin_stats(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    return {
        "total_students": db.query(User).filter(User.role == "student").count(),
        "total_courses": db.query(Course).count(),
        "active_courses": db.query(Course).filter(Course.is_active.is_(True)).count(),
        "total_roadmaps": db.query(Roadmap).count(),
        "total_projects": db.query(Project).count(),
        "completed_courses": db.query(CourseProgress).filter(CourseProgress.status == "completed").count(),
        "chat_messages": db.query(ChatMessage).count(),
        "verified_courses": db.query(Course).filter(
            Course.verified.is_(True), Course.link_type == "direct"
        ).count(),
    }


@router.get("/students")
def list_students(
    q: str | None = Query(default=None),
    role: str | None = Query(default=None),
    active: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if active is not None:
        query = query.filter(User.is_active.is_(active))
    if q:
        needle = f"%{q.strip().lower()}%"
        query = query.filter(func.lower(User.email).like(needle) | func.lower(User.full_name).like(needle))
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "items": [_student_row(db, u) for u in users],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.patch("/students/{user_id}")
def update_student(
    user_id: int,
    payload: StudentUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    for field in ("full_name", "role", "is_active"):
        if field in data:
            setattr(user, field, data[field])
    if "career_role_id" in data:
        profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
        if not profile:
            profile = StudentProfile(user_id=user.id)
            db.add(profile)
        if data["career_role_id"]:
            role = db.get(CareerRole, data["career_role_id"])
            if not role:
                raise HTTPException(status_code=400, detail="Career role not found")
            profile.career_role_id = role.role_id
            profile.desired_role = role.title
        else:
            profile.career_role_id = None
    if "desired_role" in data:
        profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
        if profile:
            profile.desired_role = data["desired_role"]
    db.add(ActivityLog(user_id=admin.id, action="admin_student_updated", detail=f"user {user_id}"))
    db.commit()
    db.refresh(user)
    return _student_row(db, user)


@router.delete("/students/{user_id}")
def deactivate_student(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own admin account")
    user.is_active = False
    db.add(ActivityLog(user_id=admin.id, action="admin_student_deactivated", detail=user.email))
    db.commit()
    return {"message": f"{user.email} deactivated"}


@router.post("/students/{user_id}/reset-password")
def reset_student_password(
    user_id: int,
    payload: PasswordReset,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        user.password_hash = hash_password(payload.new_password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.add(ActivityLog(user_id=admin.id, action="admin_password_reset", detail=user.email))
    db.commit()
    return {"message": "Password reset"}


@router.get("/courses")
def admin_courses(
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(Course)
    if q:
        needle = f"%{q.strip().lower()}%"
        query = query.filter(func.lower(Course.title).like(needle) | func.lower(Course.course_id).like(needle))
    total = query.count()
    rows = query.order_by(Course.course_id).offset(offset).limit(limit).all()
    return {"items": [CourseOut.model_validate(c).model_dump() for c in rows], "total": total}


@router.post("/courses", response_model=CourseOut, status_code=201)
def create_course(
    payload: CourseCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Course:
    if db.get(Course, payload.course_id):
        raise HTTPException(status_code=409, detail="A course with this id already exists")
    course = Course(**payload.model_dump())
    if not course.verified:
        course.verification_note = course.verification_note or "Added by admin; not independently verified"
    db.add(course)
    db.add(ActivityLog(user_id=admin.id, action="admin_course_created", detail=course.course_id))
    db.commit()
    db.refresh(course)
    return course


@router.patch("/courses/{course_id}", response_model=CourseOut)
def update_course(
    course_id: str,
    payload: CourseUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Course:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(course, field, value)
    db.add(ActivityLog(user_id=admin.id, action="admin_course_updated", detail=course_id))
    db.commit()
    db.refresh(course)
    return course


@router.delete("/courses/{course_id}")
def deactivate_course(
    course_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    course.is_active = False
    db.add(ActivityLog(user_id=admin.id, action="admin_course_deactivated", detail=course_id))
    db.commit()
    return {"message": "Course deactivated (existing roadmap references are preserved)"}


@router.post("/courses/{course_id}/validate")
def validate_one_course(
    course_id: str,
    network: bool = Query(default=True),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return validate_course_record(db, course, network=network)


@router.post("/catalogue/validate")
def validate_catalogue_links(
    limit: int = Query(default=25, ge=1, le=200),
    network: bool = Query(default=True),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    return validate_catalogue(db, limit=limit, network=network)


@router.post("/catalogue/reload")
def reload_catalogue(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Re-sync the catalogue datasets (idempotent upsert)."""
    counts = load_catalogue(db)
    db.add(ActivityLog(user_id=admin.id, action="admin_catalogue_reloaded", detail=str(counts)))
    db.commit()
    return {"message": "Catalogue reloaded", "counts": counts}


@router.get("/roles")
def admin_roles(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    roles = db.query(CareerRole).order_by(CareerRole.title).all()
    learners = dict(
        db.query(StudentProfile.career_role_id, func.count(StudentProfile.id))
        .group_by(StudentProfile.career_role_id)
        .all()
    )
    return [
        {
            "role_id": r.role_id,
            "title": r.title,
            "category": r.category,
            "description": r.description,
            "required_skills": r.required_skills or [],
            "phase_titles": r.phase_titles or [],
            "skill_count": len(r.required_skills or []),
            "learners": learners.get(r.role_id, 0),
        }
        for r in roles
    ]


@router.post("/roles", status_code=201)
def create_role(
    payload: RoleCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    if db.get(CareerRole, payload.role_id):
        raise HTTPException(status_code=409, detail="Role id already exists")
    missing = [
        s for s in (payload.required_skills or [])
        if not db.get(Skill, s)
    ]
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown skills: {', '.join(missing[:6])}")
    role = CareerRole(**payload.model_dump())
    db.add(role)
    db.add(ActivityLog(user_id=admin.id, action="admin_role_created", detail=role.role_id))
    db.commit()
    return {"message": "Role created", "role_id": role.role_id}


@router.patch("/roles/{role_id}")
def update_role(
    role_id: str,
    payload: RoleUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    role = db.get(CareerRole, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    data = payload.model_dump(exclude_unset=True)
    for skill_field in ("required_skills", "core_skills", "advanced_skills"):
        if skill_field in data:
            missing = [s for s in data[skill_field] or [] if not db.get(Skill, s)]
            if missing:
                raise HTTPException(status_code=400, detail=f"Unknown skills: {', '.join(missing[:6])}")
    for field, value in data.items():
        setattr(role, field, value)
    db.add(ActivityLog(user_id=admin.id, action="admin_role_updated", detail=role_id))
    db.commit()
    return {"message": "Role updated"}


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    role = db.get(CareerRole, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    in_use = db.query(StudentProfile).filter(StudentProfile.career_role_id == role_id).count()
    if in_use:
        raise HTTPException(
            status_code=400,
            detail=f"{in_use} student profile(s) use this role. Move them first.",
        )
    db.delete(role)
    db.add(ActivityLog(user_id=admin.id, action="admin_role_deleted", detail=role_id))
    db.commit()
    return {"message": "Role deleted"}


@router.get("/skills")
def admin_skills(
    q: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(Skill)
    if q:
        needle = f"%{q.strip().lower()}%"
        query = query.filter(func.lower(Skill.skill_name).like(needle) | func.lower(Skill.category).like(needle))
    total = query.count()
    rows = query.order_by(Skill.category, Skill.skill_name).offset(offset).limit(limit).all()
    return {
        "items": [
            {
                "skill_id": s.skill_id, "skill_name": s.skill_name, "category": s.category,
                "level": s.level, "description": s.description, "aliases": s.aliases,
            }
            for s in rows
        ],
        "total": total,
    }


@router.post("/skills", status_code=201)
def create_skill(
    payload: SkillCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    if db.get(Skill, payload.skill_id):
        raise HTTPException(status_code=409, detail="Skill id already exists")
    db.add(Skill(**payload.model_dump()))
    db.add(ActivityLog(user_id=admin.id, action="admin_skill_created", detail=payload.skill_id))
    db.commit()
    return {"message": "Skill created", "skill_id": payload.skill_id}


@router.patch("/skills/{skill_id}")
def update_skill(
    skill_id: str,
    payload: SkillUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    skill = db.get(Skill, skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(skill, field, value)
    db.add(ActivityLog(user_id=admin.id, action="admin_skill_updated", detail=skill_id))
    db.commit()
    return {"message": "Skill updated"}


@router.delete("/skills/{skill_id}")
def delete_skill(
    skill_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    skill = db.get(Skill, skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    used_by_roles = [
        r.role_id for r in db.query(CareerRole).all()
        if skill_id in (r.required_skills or [])
    ]
    used_by_courses = [
        c.course_id for c in db.query(Course).all()
        if skill_id in (c.skills or [])
    ]
    if used_by_roles or used_by_courses:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Skill is still referenced by {len(used_by_roles)} role(s) and "
                f"{len(used_by_courses)} course(s). Remove those references first."
            ),
        )
    db.delete(skill)
    db.add(ActivityLog(user_id=admin.id, action="admin_skill_deleted", detail=skill_id))
    db.commit()
    return {"message": "Skill deleted"}


@router.get("/resources")
def admin_resources(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = db.query(LearningResource).order_by(LearningResource.title).all()
    return [
        {
            "resource_id": r.resource_id, "title": r.title, "resource_type": r.resource_type,
            "url": r.url, "skills": r.skills or [], "platform": r.platform,
            "price_type": r.price_type, "description": r.description,
        }
        for r in rows
    ]


@router.post("/resources", status_code=201)
def create_resource(
    payload: ResourceCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    if db.get(LearningResource, payload.resource_id):
        raise HTTPException(status_code=409, detail="Resource id already exists")
    db.add(LearningResource(**payload.model_dump()))
    db.add(ActivityLog(user_id=admin.id, action="admin_resource_created", detail=payload.resource_id))
    db.commit()
    return {"message": "Resource created", "resource_id": payload.resource_id}


@router.patch("/resources/{resource_id}")
def update_resource(
    resource_id: str,
    payload: ResourceUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    resource = db.get(LearningResource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(resource, field, value)
    db.add(ActivityLog(user_id=admin.id, action="admin_resource_updated", detail=resource_id))
    db.commit()
    return {"message": "Resource updated"}


@router.delete("/resources/{resource_id}")
def delete_resource(
    resource_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    resource = db.get(LearningResource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    db.delete(resource)
    db.add(ActivityLog(user_id=admin.id, action="admin_resource_deleted", detail=resource_id))
    db.commit()
    return {"message": "Resource deleted"}


@router.get("/roadmaps")
def admin_roadmaps(
    limit: int = Query(default=50, ge=1, le=200),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    rows = (
        db.query(Roadmap, User)
        .join(User, User.id == Roadmap.user_id)
        .order_by(Roadmap.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "id": r.id,
                "student": u.full_name,
                "email": u.email,
                "career_goal": r.career_goal,
                "career_role_id": r.career_role_id,
                "progress_recency": {
                    "completed_courses": db.query(CourseProgress).filter(
                        CourseProgress.user_id == u.id, CourseProgress.status == "completed"
                    ).count(),
                },
                "total_hours": r.total_hours,
                "total_weeks": r.total_weeks,
                "expected_completion": r.expected_completion,
                "generated_by": r.generated_by,
                "created_at": r.created_at,
                "is_active": r.is_active,
            }
            for r, u in rows
        ]
    }


@router.get("/activity")
def admin_activity(
    limit: int = Query(default=50, ge=1, le=200),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = (
        db.query(ActivityLog, User)
        .outerjoin(User, User.id == ActivityLog.user_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "action": log.action,
            "detail": log.detail,
            "created_at": log.created_at,
            "user": user.full_name if user else "system",
            "email": user.email if user else None,
        }
        for log, user in rows
    ]


@router.get("/usage")
def admin_usage(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    today = date.today()
    start = today - timedelta(days=13)
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.created_at >= datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc))
        .all()
    )
    by_day: dict[str, int] = {}
    for i in range(14):
        day = (start + timedelta(days=i)).isoformat()
        by_day[day] = 0
    actions: dict[str, int] = {}
    for log in logs:
        day = log.created_at.date().isoformat() if log.created_at else today.isoformat()
        if day in by_day:
            by_day[day] += 1
        actions[log.action] = actions.get(log.action, 0) + 1

    completions = (
        db.query(Course.platform, func.count(CourseProgress.id))
        .join(CourseProgress, CourseProgress.course_id == Course.course_id)
        .filter(CourseProgress.status == "completed")
        .group_by(Course.platform)
        .all()
    )
    top_courses = (
        db.query(Course.title, func.count(CourseProgress.id))
        .join(CourseProgress, CourseProgress.course_id == Course.course_id)
        .filter(CourseProgress.status == "completed")
        .group_by(Course.title)
        .order_by(func.count(CourseProgress.id).desc())
        .limit(8)
        .all()
    )
    roles = (
        db.query(Roadmap.career_goal, func.count(Roadmap.id))
        .group_by(Roadmap.career_goal)
        .order_by(func.count(Roadmap.id).desc())
        .all()
    )
    return {
        "activity_by_day": [{"date": day, "events": count} for day, count in by_day.items()],
        "top_actions": [
            {"action": action, "count": count}
            for action, count in sorted(actions.items(), key=lambda x: x[1], reverse=True)[:8]
        ],
        "completions_by_platform": [{"platform": p, "count": c} for p, c in completions],
        "top_courses": [{"title": t, "completed": c} for t, c in top_courses],
        "roadmaps_by_goal": [{"goal": g, "count": c} for g, c in roles],
        "totals": {
            "students": db.query(User).filter(User.role == "student").count(),
            "active_roadmaps": db.query(Roadmap).filter(Roadmap.is_active.is_(True)).count(),
            "course_progress_rows": db.query(CourseProgress).count(),
            "project_progress_rows": db.query(ProjectProgress).count(),
        },
    }
