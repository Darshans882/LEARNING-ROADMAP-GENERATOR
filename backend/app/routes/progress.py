"""Learning progress routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_profile, verified_student
from ..models import ActivityLog, Course, CourseProgress, NodeProgress, Project, ProjectProgress, StudentProfile, User
from ..schemas import (
    AssessmentUpdate,
    CourseOut,
    CourseProgressUpdate,
    NodeProgressUpdate,
    ProjectOut,
    ProjectProgressUpdate,
)
from ..services.progress_service import (
    get_active_roadmap,
    learning_hours,
    mark_assessment,
    mark_course_complete,
    mark_node_progress,
    mark_project_complete,
    milestones_data,
    planner_data,
    recalculate_roadmap,
    task_counts,
)

router = APIRouter(prefix="/progress", tags=["Progress"])


def _course_progress_dict(db: Session, row: CourseProgress) -> dict:
    course = db.get(Course, row.course_id)
    return {
        "id": row.id,
        "course_id": row.course_id,
        "status": row.status,
        "progress_percent": row.progress_percent,
        "hours_spent": row.hours_spent,
        "started_at": row.started_at,
        "completed_at": row.completed_at,
        "notes": row.notes,
        "updated_at": row.updated_at,
        "course": CourseOut.model_validate(course).model_dump() if course else None,
    }


def _project_progress_dict(db: Session, row: ProjectProgress) -> dict:
    project = db.get(Project, row.project_id)
    return {
        "id": row.id,
        "project_id": row.project_id,
        "status": row.status,
        "hours_spent": row.hours_spent,
        "repository_url": row.repository_url,
        "notes": row.notes,
        "completed_at": row.completed_at,
        "updated_at": row.updated_at,
        "project": ProjectOut.model_validate(project).model_dump() if project else None,
    }


@router.get("")
def get_progress(
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    roadmap = get_active_roadmap(db, user.id)
    courses = (
        db.query(CourseProgress)
        .filter(CourseProgress.user_id == user.id)
        .order_by(CourseProgress.updated_at.desc())
        .all()
    )
    projects = (
        db.query(ProjectProgress)
        .filter(ProjectProgress.user_id == user.id)
        .order_by(ProjectProgress.updated_at.desc())
        .all()
    )
    result = {
        "courses": [_course_progress_dict(db, r) for r in courses],
        "projects": [_project_progress_dict(db, r) for r in projects],
        "has_roadmap": bool(roadmap),
    }
    if roadmap:
        recalc = recalculate_roadmap(db, roadmap, profile)
        result.update({
            "roadmap": {
                "id": roadmap.id,
                "career_goal": roadmap.career_goal,
                "progress_percent": recalc["progress_percent"],
                "current_phase": recalc["current_phase"],
            },
            "counts": task_counts(db, user.id, roadmap),
            "hours": learning_hours(db, user.id, roadmap, profile),
            "nodes": [
                {
                    "node_key": n.node_key,
                    "title": n.title,
                    "node_type": n.node_type,
                    "status": n.status,
                    "phase_number": n.phase_number,
                    "course_id": n.course_id,
                    "project_id": n.project_id,
                }
                for n in sorted(roadmap.nodes, key=lambda n: n.order_index)
            ],
        })
    return result


@router.post("/course")
def update_course_progress(
    payload: CourseProgressUpdate,
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    if not db.get(Course, payload.course_id):
        raise HTTPException(status_code=404, detail="Course not found")
    result = mark_course_complete(db, user, profile, payload)
    db.add(ActivityLog(
        user_id=user.id, action=f"course_{payload.status}",
        detail=f"{payload.course_id} → {result['progress_percent']}%",
    ))
    db.commit()
    return result


@router.post("/project")
def update_project_progress(
    payload: ProjectProgressUpdate,
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    try:
        result = mark_project_complete(db, user, profile, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.add(ActivityLog(user_id=user.id, action=f"project_{payload.status}", detail=payload.project_id))
    db.commit()
    return result


@router.post("/assessment")
def update_assessment(
    payload: AssessmentUpdate,
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    try:
        result = mark_assessment(db, user, profile, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.add(ActivityLog(
        user_id=user.id, action="assessment_submitted",
        detail=f"{payload.node_key}: {payload.score}%",
    ))
    db.commit()
    return result


@router.delete("/course/{course_id}")
def reset_course_progress(
    course_id: str,
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    row = (
        db.query(CourseProgress)
        .filter(CourseProgress.user_id == user.id, CourseProgress.course_id == course_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="No progress recorded for this course")
    db.delete(row)
    db.flush()
    roadmap = get_active_roadmap(db, user.id)
    result = recalculate_roadmap(db, roadmap, profile, commit=False) if roadmap else None
    db.add(ActivityLog(user_id=user.id, action="course_progress_reset", detail=course_id))
    db.commit()
    return {"message": "Course progress reset", "roadmap": result}


@router.delete("/project/{project_id}")
def reset_project_progress(
    project_id: str,
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    row = (
        db.query(ProjectProgress)
        .filter(ProjectProgress.user_id == user.id, ProjectProgress.project_id == project_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="No progress recorded for this project")
    db.delete(row)
    db.flush()
    roadmap = get_active_roadmap(db, user.id)
    result = recalculate_roadmap(db, roadmap, profile, commit=False) if roadmap else None
    db.add(ActivityLog(user_id=user.id, action="project_progress_reset", detail=project_id))
    db.commit()
    return {"message": "Project progress reset", "roadmap": result}


@router.post("/node")
def update_node_progress(
    payload: NodeProgressUpdate,
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    try:
        result = mark_node_progress(db, user, profile, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.add(ActivityLog(
        user_id=user.id, action=f"node_{payload.status}", detail=payload.node_key,
    ))
    db.commit()
    return result


@router.delete("/node/{node_key}")
def reset_node_progress(
    node_key: str,
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    roadmap = get_active_roadmap(db, user.id)
    if not roadmap:
        raise HTTPException(status_code=404, detail="No active roadmap")
    row = (
        db.query(NodeProgress)
        .filter(
            NodeProgress.user_id == user.id,
            NodeProgress.roadmap_id == roadmap.id,
            NodeProgress.node_key == node_key,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="No manual progress recorded for this node")
    db.delete(row)
    db.flush()
    result = recalculate_roadmap(db, roadmap, profile, commit=False)
    db.add(ActivityLog(user_id=user.id, action="node_progress_reset", detail=node_key))
    db.commit()
    return {"message": "Node progress reset", "roadmap": result}


@router.get("/planner")
def get_planner(
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    return planner_data(db, user, profile)


@router.get("/milestones")
def get_milestones(
    user: User = Depends(verified_student),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> list[dict]:
    return milestones_data(db, user, profile)
