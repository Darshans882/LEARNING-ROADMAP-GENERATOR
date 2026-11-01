"""Roadmap generation, retrieval and export routes."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from ..ai.roadmap_generator import generate_roadmap, roadmap_to_dict
from ..ai.skill_analyzer import analyze_profile
from ..database import get_db
from ..deps import get_current_user, get_profile, verified_student
from ..models import ActivityLog, CareerRole, Roadmap, StudentProfile, User
from ..schemas import GenerateRoadmapRequest
from ..services.progress_service import (
    build_schedule,
    get_active_roadmap,
    recalculate_roadmap,
)
from ..services.profile_service import goals_are_past

logger = logging.getLogger("smartlearn.roadmap")
router = APIRouter(prefix="/roadmap", tags=["Roadmap"])


def _roadmap_payload(db: Session, roadmap: Roadmap, profile: StudentProfile) -> dict:
    recalc = recalculate_roadmap(db, roadmap, profile)
    payload = roadmap_to_dict(roadmap, recalc)
    schedule = build_schedule(roadmap, profile)
    payload["schedule"] = schedule
    payload["warnings"] = schedule.get("warnings", [])
    return payload


@router.get("")
def get_roadmap(
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    roadmap = get_active_roadmap(db, user.id)
    if not roadmap:
        return {
            "has_roadmap": False,
            "roadmap": None,
            "message": "No active roadmap yet. Generate one to get started.",
        }
    return {"has_roadmap": True, "roadmap": _roadmap_payload(db, roadmap, profile)}


@router.post("/generate")
def create_roadmap(
    payload: GenerateRoadmapRequest | None = None,
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    payload = payload or GenerateRoadmapRequest()
    role_id = payload.career_role_id or profile.career_role_id
    if not role_id:
        raise HTTPException(status_code=400, detail="Select a career goal before generating a roadmap")
    role = db.get(CareerRole, role_id)
    if not role:
        raise HTTPException(status_code=400, detail="Career role not found")
    if profile.career_role_id != role_id:
        profile.career_role_id = role_id
        profile.desired_role = role.title

    if goals_are_past(profile):
        raise HTTPException(
            status_code=400,
            detail="Your target completion date is in the past. Update it in Profile before generating a plan.",
        )

    try:
        roadmap = generate_roadmap(
            db, user, profile, role_id=role_id,
            force=payload.force, use_llm=payload.use_llm,
        )
        recalc = recalculate_roadmap(db, roadmap, profile, commit=False)
        db.add(ActivityLog(
            user_id=user.id, action="roadmap_generated",
            detail=f"{role.title} · {recalc['progress_percent']}% complete",
        ))
        db.commit()
        db.refresh(roadmap)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        db.rollback()
        logger.exception("Roadmap generation failed")
        raise HTTPException(status_code=500, detail=f"Roadmap generation failed: {exc}") from exc

    return {"message": "Roadmap generated", "roadmap": _roadmap_payload(db, roadmap, profile)}


@router.post("/regenerate")
def regenerate_roadmap(
    use_llm: bool = Query(default=True),
    career_role_id: str | None = Query(default=None),
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    return create_roadmap(
        GenerateRoadmapRequest(career_role_id=career_role_id, force=True, use_llm=use_llm),
        user=user, profile=profile, db=db,
    )


@router.get("/next")
def next_node(
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    roadmap = get_active_roadmap(db, user.id)
    if not roadmap:
        raise HTTPException(status_code=404, detail="No active roadmap")
    recalculate_roadmap(db, roadmap, profile)
    candidates = sorted(
        [n for n in roadmap.nodes if n.status in {"current", "pending"} and n.node_type in {"course", "project", "assessment"}],
        key=lambda n: n.order_index,
    )
    if not candidates:
        return {"node": None, "message": "All available nodes are complete"}
    node = candidates[0]
    return {
        "node": {
            "node_key": node.node_key,
            "title": node.title,
            "node_type": node.node_type,
            "phase_number": node.phase_number,
            "status": node.status,
            "course_id": node.course_id,
            "project_id": node.project_id,
        }
    }


@router.get("/{roadmap_id}")
def get_roadmap_by_id(
    roadmap_id: int,
    user: User = Depends(get_current_user),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    roadmap = (
        db.query(Roadmap)
        .filter(Roadmap.id == roadmap_id, Roadmap.user_id == user.id)
        .first()
    )
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    return {"has_roadmap": True, "roadmap": _roadmap_payload(db, roadmap, profile)}


@router.delete("/{roadmap_id}")
def delete_roadmap(
    roadmap_id: int,
    user: User = Depends(verified_student),
    db: Session = Depends(get_db),
) -> dict:
    roadmap = (
        db.query(Roadmap)
        .filter(Roadmap.id == roadmap_id, Roadmap.user_id == user.id)
        .first()
    )
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    roadmap.is_active = False
    roadmap.status = "archived"
    db.add(ActivityLog(user_id=user.id, action="roadmap_archived", detail=roadmap.career_goal))
    db.commit()
    return {"message": "Roadmap archived"}


@router.get("/{roadmap_id}/export", response_class=PlainTextResponse)
def export_roadmap(
    roadmap_id: int,
    user: User = Depends(get_current_user),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> str:
    roadmap = (
        db.query(Roadmap)
        .filter(Roadmap.id == roadmap_id, Roadmap.user_id == user.id)
        .first()
    )
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    recalc = recalculate_roadmap(db, roadmap, profile)
    analysis = analyze_profile(db, profile, roadmap.career_role_id)
    lines = [
        f"# SmartLearn AI Roadmap — {roadmap.career_goal}",
        "",
        f"**Student:** {user.full_name}  ",
        f"**Current level:** {roadmap.current_level} → {roadmap.target_level}  ",
        f"**Progress:** {recalc['progress_percent']}%  ",
        f"**Expected completion:** {roadmap.expected_completion or 'not set'}  ",
        f"**Total effort:** ~{roadmap.total_hours:.0f} hours over {roadmap.total_weeks} weeks  ",
        f"**Readiness for role:** {analysis['readiness']:.0f}%",
        "",
        "## Summary",
        "",
        roadmap.summary,
        "",
        "## Phases",
    ]
    current_phase = None
    for node in sorted(roadmap.nodes, key=lambda n: n.order_index):
        if node.node_type == "phase":
            current_phase = node
            lines += ["", f"### Phase {node.phase_number}: {node.title}", ""]
            if node.description:
                lines += [node.description, ""]
        elif node.node_type == "course":
            c = node.course
            duration = f"{node.duration_hours:.0f}h" if node.duration_hours else "duration n/a"
            verify = "verified direct page" if c and c.verified and c.link_type == "direct" else "catalogue/search — verify before enrolling"
            lines.append(f"- [ ] **{node.title}** ({node.node_type}, {duration}) — {verify}")
            if c:
                lines.append(f"  - Link: {c.url}")
        elif node.node_type == "project":
            lines.append(f"- [ ] **Project: {node.title}** (~{node.duration_hours:.0f}h)")
        elif node.node_type == "assessment":
            lines.append(f"- [ ] **Assessment: {node.title}**")
    lines += ["", "## Skill gap", ""]
    for item in analysis["missing_skills"][:20]:
        lines.append(f"- {item['skill_name']} ({item['category']})")
    lines += ["", "---", "Generated by SmartLearn AI. Course links and metadata come from the stored catalogue; always confirm details on the provider page."]
    return "\n".join(lines)
