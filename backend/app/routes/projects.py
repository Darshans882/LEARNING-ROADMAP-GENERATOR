"""Project and learning-resource discovery routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_profile, verified_student
from ..models import CareerRole, Project, StudentProfile, User
from ..schemas import ProjectOut

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("")
def list_projects(
    q: str | None = Query(default=None),
    career_role: str | None = Query(default=None),
    project_type: str | None = Query(default=None),
    difficulty: str | None = Query(default=None),
    skill: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    query = db.query(Project)
    if career_role:
        query = query.filter(Project.career_role.in_([career_role, "all"]))
    if project_type:
        query = query.filter(func.lower(Project.project_type) == project_type.lower())
    if difficulty:
        query = query.filter(func.lower(Project.difficulty) == difficulty.lower())
    if q:
        needle = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Project.title).like(needle),
                func.lower(Project.description).like(needle),
                func.lower(Project.deliverables).like(needle),
            )
        )
    projects = query.order_by(Project.title).all()
    if skill:
        needle = skill.strip().lower()
        projects = [p for p in projects if needle in [s.lower() for s in (p.skills or [])]]
    total = len(projects)
    page = projects[offset: offset + limit]
    return {
        "items": [ProjectOut.model_validate(p).model_dump() for p in page],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/recommended", response_model=list[ProjectOut])
def recommended_projects(
    limit: int = Query(default=6, ge=1, le=30),
    include_all_roles: bool = Query(default=True),
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> list[Project]:
    role_id = profile.career_role_id
    roles = [role_id] if role_id else []
    if include_all_roles:
        roles.append("all")
    query = db.query(Project)
    if roles:
        query = query.filter(Project.career_role.in_(roles))
    projects = query.all()
    if not projects:
        projects = db.query(Project).all()
    # Rank projects that use skills the student already has or is currently learning.
    known = set()
    for values in (
        profile.programming_languages, profile.frameworks, profile.tools,
        profile.databases, profile.technical_skills,
    ):
        for value in values or []:
            known.add(str(value).strip().lower().replace(" ", "-"))
            known.add(str(value).strip().lower())

    def score(p: Project) -> tuple:
        hits = sum(
            1 for s in (p.skills or [])
            if s.lower() in known or s.lower().replace("-", " ") in known
        )
        return (hits, p.difficulty == (profile.proficiency_level or "").lower(), p.project_type == "major")

    projects.sort(key=score, reverse=True)
    return projects[:limit]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/related", response_model=list[ProjectOut])
def related_projects(
    project_id: str,
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Project]:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    skills = set(project.skills or [])
    candidates = [
        p for p in db.query(Project).filter(Project.project_id != project_id).all()
        if skills.intersection(p.skills or []) or p.career_role == project.career_role
    ]
    candidates.sort(key=lambda p: len(skills.intersection(p.skills or [])), reverse=True)
    return candidates[:limit]
