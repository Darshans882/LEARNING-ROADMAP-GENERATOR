"""Student profile, onboarding, dashboard and planning routes."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..ai.roadmap_generator import generate_roadmap, roadmap_to_dict
from ..ai.skill_analyzer import analyze_profile, recommend_careers
from ..database import get_db
from ..deps import get_current_user, get_profile, verified_student
from ..models import ActivityLog, CareerRole, StudentProfile, User
from ..schemas import (
    CareerRecommendationOut,
    OnboardingPayload,
    ProfileUpdate,
    SkillAnalysisOut,
    StudentProfileOut,
)
from ..services.progress_service import (
    dashboard_data,
    get_active_roadmap,
    milestones_data,
    planner_data,
    recalculate_roadmap,
)
from ..services.profile_service import (
    onboarding_errors,
    profile_completeness,
    profile_public_dict,
)

logger = logging.getLogger("smartlearn.students")
router = APIRouter(prefix="/students", tags=["Students"])

OPTIONS = {
    "proficiency_levels": ["Beginner", "Intermediate", "Advanced"],
    "budget_prefs": ["Free", "Paid", "Both"],
    "learning_styles": ["Video", "Reading", "Practical", "Mixed"],
    "platforms": [
        "Coursera", "Udemy", "edX", "freeCodeCamp", "Kaggle", "Google", "Microsoft Learn",
        "AWS", "Cisco", "Figma", "YouTube", "NPTEL", "Scrimba", "LeetCode", "OpenAI",
    ],
    "languages": ["English", "Hindi", "Tamil", "Telugu", "Bengali", "French", "Spanish", "German"],
    "years": ["1", "2", "3", "4", "5+"],
    "semesters": ["1", "2", "3", "4", "5", "6", "7", "8"],
    "industries": [
        "Technology", "Fintech", "Healthcare", "EdTech", "E-commerce", "Design", "Media",
        "Consulting", "Manufacturing", "Government", "Research", "Cybersecurity", "Cloud",
    ],
}


def _apply_profile_fields(profile: StudentProfile, payload: ProfileUpdate) -> None:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)


@router.get("/options")
def get_options(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    roles = db.query(CareerRole).order_by(CareerRole.title).all()
    return {
        **OPTIONS,
        "career_roles": [
            {"role_id": r.role_id, "title": r.title, "category": r.category} for r in roles
        ],
    }


@router.get("/profile", response_model=StudentProfileOut)
def get_student_profile(
    user: User = Depends(get_current_user),
    profile: StudentProfile = Depends(get_profile),
) -> dict:
    return profile_public_dict(profile, user)


@router.put("/profile", response_model=StudentProfileOut)
def update_student_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    old_role = profile.career_role_id
    data = payload.model_dump(exclude_unset=True)

    if "career_role_id" in data and data["career_role_id"]:
        role = db.get(CareerRole, data["career_role_id"])
        if not role:
            raise HTTPException(status_code=400, detail="Selected career goal does not exist")
        data["desired_role"] = role.title

    _apply_profile_fields(profile, ProfileUpdate(**data))
    profile.profile_completeness = profile_completeness(profile)
    db.add(ActivityLog(user_id=user.id, action="profile_updated", detail="Student profile updated"))
    db.flush()

    role_changed = bool(profile.career_role_id and profile.career_role_id != old_role)
    if role_changed and profile.onboarding_completed:
        # A career change regenerates the roadmap immediately (deterministic engine,
        # fast). Rich LLM prose can be requested later from the Roadmap page.
        try:
            roadmap = generate_roadmap(db, user, profile, force=True, use_llm=False)
            recalculate_roadmap(db, roadmap, profile, commit=False)
            db.add(ActivityLog(
                user_id=user.id, action="roadmap_regenerated",
                detail=f"Career goal changed to {profile.desired_role}",
            ))
        except Exception as exc:  # pragma: no cover - logged, profile still saves
            logger.warning("Automatic roadmap regeneration failed: %s", exc)

    db.commit()
    db.refresh(profile)
    return profile_public_dict(profile, user)


@router.post("/onboarding")
def complete_onboarding(
    payload: OnboardingPayload,
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    role = db.get(CareerRole, payload.career_role_id)
    data = payload.model_dump(exclude_unset=True)
    if role:
        data["desired_role"] = role.title

    _apply_profile_fields(profile, ProfileUpdate(**data))
    errors = onboarding_errors(profile, role_exists=bool(role))
    if errors:
        db.rollback()
        raise HTTPException(status_code=400, detail="; ".join(errors))

    profile.onboarding_completed = True
    profile.profile_completeness = profile_completeness(profile)
    db.add(ActivityLog(user_id=user.id, action="onboarding_completed", detail=profile.desired_role or ""))
    db.flush()

    roadmap_payload = None
    try:
        roadmap = generate_roadmap(db, user, profile, force=True, use_llm=True)
        recalc = recalculate_roadmap(db, roadmap, profile, commit=False)
        roadmap_payload = roadmap_to_dict(roadmap, recalc)
    except Exception as exc:  # pragma: no cover
        logger.warning("Roadmap generation during onboarding failed: %s", exc)

    db.commit()
    db.refresh(profile)
    return {
        "profile": profile_public_dict(profile, user),
        "roadmap": roadmap_payload,
        "message": "Onboarding complete. Your personalized roadmap is ready.",
    }


@router.get("/dashboard")
def student_dashboard(
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    return dashboard_data(db, user, profile)


@router.get("/analysis", response_model=SkillAnalysisOut)
def skill_analysis(
    role_id: str | None = Query(default=None),
    include_completed: bool = Query(default=True),
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    try:
        return analyze_profile(db, profile, role_id, include_completed=include_completed)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/career-matches", response_model=list[CareerRecommendationOut])
def career_matches(
    limit: int = Query(default=6, ge=1, le=20),
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> list[dict]:
    return recommend_careers(db, profile, limit=limit)


@router.get("/planner")
def planner(
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    return planner_data(db, user, profile)


@router.get("/milestones")
def milestones(
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> list[dict]:
    return milestones_data(db, user, profile)


@router.get("/activity")
def activity(
    limit: int = Query(default=25, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == user.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {"id": r.id, "action": r.action, "detail": r.detail, "created_at": r.created_at}
        for r in rows
    ]


@router.get("/roadmap-summary")
def roadmap_summary(
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    roadmap = get_active_roadmap(db, user.id)
    if not roadmap:
        return {"has_roadmap": False}
    recalc = recalculate_roadmap(db, roadmap, profile)
    return {
        "has_roadmap": True,
        "id": roadmap.id,
        "career_goal": roadmap.career_goal,
        "progress_percent": recalc["progress_percent"],
        "current_phase": recalc["current_phase"],
        "expected_completion": roadmap.expected_completion,
        "total_weeks": roadmap.total_weeks,
    }
