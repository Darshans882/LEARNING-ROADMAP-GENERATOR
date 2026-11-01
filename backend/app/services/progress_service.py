"""Progress tracking, roadmap status recalculation and dashboard aggregates."""
from __future__ import annotations

import math
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from ..ai.skill_analyzer import analyze_profile
from ..models import (
    AssessmentAttempt,
    Course,
    CourseProgress,
    NodeProgress,
    Project,
    ProjectProgress,
    Roadmap,
    RoadmapNode,
    StudentProfile,
    User,
    utcnow,
)
from .duration_calculator import (
    ASSESSMENT_HOURS,
    COURSE_OVERHEAD,
    PROJECT_OVERHEAD,
    calculate_schedule,
)

COUNTED_PHASE_TYPES = {"course", "project", "assessment"}


def get_active_roadmap(db: Session, user_id: int) -> Roadmap | None:
    return (
        db.query(Roadmap)
        .filter(Roadmap.user_id == user_id, Roadmap.is_active.is_(True))
        .order_by(Roadmap.created_at.desc())
        .first()
    )


def phase_groups(roadmap: Roadmap) -> dict[int, list[RoadmapNode]]:
    groups: dict[int, list[RoadmapNode]] = {}
    for node in roadmap.nodes:
        if node.phase_number is None:
            continue
        groups.setdefault(node.phase_number, []).append(node)
    for nodes in groups.values():
        nodes.sort(key=lambda n: n.order_index)
    return dict(sorted(groups.items()))


def build_schedule(roadmap: Roadmap, profile: StudentProfile) -> dict[str, Any]:
    groups = phase_groups(roadmap)
    phases = []
    for number, nodes in groups.items():
        phase_node = next((n for n in nodes if n.node_type == "phase"), None)
        courses = [
            {"key": n.node_key, "title": n.title, "hours": n.duration_hours}
            for n in nodes if n.node_type == "course"
        ]
        project = next((n for n in nodes if n.node_type == "project"), None)
        assessment = next((n for n in nodes if n.node_type == "assessment"), None)
        phases.append({
            "phase_number": number,
            "title": phase_node.title if phase_node else f"Phase {number}",
            "courses": courses,
            "project": (
                {"key": project.node_key, "title": project.title, "hours": project.duration_hours}
                if project else None
            ),
            "assessment": (
                {"key": assessment.node_key, "title": assessment.title} if assessment else None
            ),
        })
    return calculate_schedule(
        phases, profile,
        start_date=roadmap.start_date or date.today(),
        target_date=profile.target_completion_date,
    )


def _progress_maps(db: Session, user_id: int, roadmap_id: int | None = None):
    courses = {
        p.course_id: p for p in db.query(CourseProgress).filter(CourseProgress.user_id == user_id).all()
    }
    projects = {
        p.project_id: p for p in db.query(ProjectProgress).filter(ProjectProgress.user_id == user_id).all()
    }
    nodes = {}
    if roadmap_id is not None:
        nodes = {
            p.node_key: p
            for p in db.query(NodeProgress).filter(
                NodeProgress.user_id == user_id, NodeProgress.roadmap_id == roadmap_id
            ).all()
        }
    return courses, projects, nodes


def _is_assessment_passed(node: RoadmapNode) -> bool:
    threshold = float((node.meta or {}).get("pass_score", 70))
    return node.score is not None and node.score >= threshold


def recalculate_roadmap(
    db: Session, roadmap: Roadmap, profile: StudentProfile, commit: bool = True
) -> dict[str, Any]:
    nodes = sorted(roadmap.nodes, key=lambda n: n.order_index)
    course_progress, project_progress, node_progress = _progress_maps(db, roadmap.user_id, roadmap.id)
    groups = phase_groups(roadmap)

    previous_phases_complete = True
    current_phase: int | None = None
    phase_results: dict[int, dict[str, Any]] = {}

    for number, phase_nodes in groups.items():
        phase_node = next((n for n in phase_nodes if n.node_type == "phase"), None)
        children = [n for n in phase_nodes if n.node_type in COUNTED_PHASE_TYPES]
        if not children:
            if phase_node:
                phase_node.status = "completed"
            phase_results[number] = {"completed": True, "percent": 100}
            continue

        courses = [n for n in children if n.node_type == "course"]
        projects = [n for n in children if n.node_type == "project"]
        assessments = [n for n in children if n.node_type == "assessment"]

        for n in courses:
            p = course_progress.get(n.course_id)
            if p and p.status == "completed":
                n.status = "completed"
            elif not previous_phases_complete:
                n.status = "locked"
            elif p and p.status == "in_progress":
                n.status = "current"
            else:
                n.status = "pending"

        all_courses_complete = all(n.status == "completed" for n in courses) if courses else True
        for n in projects:
            p = project_progress.get(n.project_id) if n.project_id else None
            manual = node_progress.get(n.node_key)
            if (p and p.status == "completed") or (manual and manual.status == "completed"):
                n.status = "completed"
            elif not previous_phases_complete:
                n.status = "locked"
            elif not all_courses_complete:
                n.status = "locked"
            elif manual and manual.status == "in_progress":
                n.status = "current"
            else:
                n.status = "current"

        all_projects_complete = all(n.status == "completed" for n in projects) if projects else True
        for n in assessments:
            if _is_assessment_passed(n):
                n.status = "completed"
            elif not previous_phases_complete:
                n.status = "locked"
            elif not (all_courses_complete and all_projects_complete):
                n.status = "locked"
            else:
                n.status = "current"

        all_children_complete = all(n.status == "completed" for n in children)
        if all_children_complete:
            if phase_node:
                phase_node.status = "completed"
            percent = 100
            previous_phases_complete = True
        elif previous_phases_complete:
            if phase_node:
                phase_node.status = "current"
            current_phase = current_phase or number
            completed_children = sum(1 for n in children if n.status == "completed")
            percent = round(completed_children / len(children) * 100)
            previous_phases_complete = False
        else:
            if phase_node:
                phase_node.status = "locked"
            percent = 0
            previous_phases_complete = False

        # Exactly one available course should be highlighted as current.
        if previous_phases_complete is False and phase_node and phase_node.status == "current":
            if not any(n.status == "current" for n in courses):
                for n in courses:
                    if n.status == "pending":
                        n.status = "current"
                        break
        phase_results[number] = {"completed": all_children_complete, "percent": percent}

    # Context nodes
    for n in nodes:
        if n.node_type in {"start", "goal", "skill_analysis"}:
            n.status = "completed"
        elif n.node_type == "completion":
            n.status = "completed" if previous_phases_complete else "locked"

    counted = [n for n in nodes if n.node_type in {"course", "project", "assessment", "phase", "completion"}]
    completed = [n for n in counted if n.status == "completed"]
    progress = round(len(completed) / len(counted) * 100, 1) if counted else 0.0
    if progress >= 99.9:
        progress = 100.0
        roadmap.status = "completed"
    else:
        roadmap.status = "active"
    roadmap.updated_at = utcnow()
    if commit:
        db.commit()
    return {
        "progress_percent": progress,
        "current_phase": current_phase,
        "completed_nodes": len(completed),
        "total_nodes": len(counted),
        "phase_results": phase_results,
    }


def _upsert_course_progress(
    db: Session, user_id: int, course_id: str, status: str,
    percent: int | None, hours: float | None, notes: str | None,
) -> CourseProgress:
    course = db.get(Course, course_id)
    if not course:
        raise ValueError("Course not found in the verified catalogue")
    row = (
        db.query(CourseProgress)
        .filter(CourseProgress.user_id == user_id, CourseProgress.course_id == course_id)
        .first()
    )
    now = datetime.now(timezone.utc)
    if not row:
        row = CourseProgress(user_id=user_id, course_id=course_id, started_at=now)
        db.add(row)
    row.status = status
    if status == "completed":
        row.progress_percent = 100
        row.completed_at = row.completed_at or now
    elif status == "in_progress":
        row.progress_percent = percent if percent is not None else max(1, row.progress_percent or 5)
        row.completed_at = None
    else:
        row.progress_percent = 0
        row.completed_at = None
    if hours is not None:
        row.hours_spent = hours
    if notes is not None:
        row.notes = notes
    row.updated_at = now
    db.flush()
    return row


def mark_course_complete(
    db: Session, user: User, profile: StudentProfile, payload
) -> dict[str, Any]:
    row = _upsert_course_progress(
        db, user.id, payload.course_id, payload.status,
        payload.progress_percent, payload.hours_spent, payload.notes,
    )
    roadmap = get_active_roadmap(db, user.id)
    result = None
    if roadmap:
        result = recalculate_roadmap(db, roadmap, profile, commit=False)
    db.commit()
    return {
        "course_id": row.course_id,
        "status": row.status,
        "progress_percent": row.progress_percent,
        "roadmap": result,
    }


def mark_project_complete(
    db: Session, user: User, profile: StudentProfile, payload
) -> dict[str, Any]:
    project = db.get(Project, payload.project_id)
    if not project:
        raise ValueError("Project not found")
    row = (
        db.query(ProjectProgress)
        .filter(ProjectProgress.user_id == user.id, ProjectProgress.project_id == payload.project_id)
        .first()
    )
    if not row:
        row = ProjectProgress(user_id=user.id, project_id=payload.project_id)
        db.add(row)
    row.status = payload.status
    if payload.status == "completed":
        row.completed_at = row.completed_at or datetime.now(timezone.utc)
    else:
        row.completed_at = None
    if payload.hours_spent is not None:
        row.hours_spent = payload.hours_spent
    if payload.repository_url is not None:
        row.repository_url = payload.repository_url
    if payload.notes is not None:
        row.notes = payload.notes
    row.updated_at = utcnow()
    db.flush()

    roadmap = get_active_roadmap(db, user.id)
    result = None
    if roadmap:
        result = recalculate_roadmap(db, roadmap, profile, commit=False)
    db.commit()
    return {"project_id": row.project_id, "status": row.status, "roadmap": result}


def mark_node_progress(
    db: Session, user: User, profile: StudentProfile, payload
) -> dict[str, Any]:
    """Update status for a roadmap node without a catalogue project record."""
    roadmap = get_active_roadmap(db, user.id)
    if not roadmap:
        raise ValueError("Generate a roadmap before updating node progress")
    node = next((n for n in roadmap.nodes if n.node_key == payload.node_key), None)
    if not node:
        raise ValueError("Roadmap node not found")
    if node.node_type not in {"project", "phase", "completion"}:
        raise ValueError("Node progress is only editable for project/phases nodes")
    if node.project_id:
        raise ValueError("Use the project progress endpoint for catalogue projects")

    row = (
        db.query(NodeProgress)
        .filter(
            NodeProgress.user_id == user.id,
            NodeProgress.roadmap_id == roadmap.id,
            NodeProgress.node_key == node.node_key,
        )
        .first()
    )
    if not row:
        row = NodeProgress(user_id=user.id, roadmap_id=roadmap.id, node_key=node.node_key)
        db.add(row)
    row.status = payload.status
    if payload.status == "completed":
        row.completed_at = row.completed_at or datetime.now(timezone.utc)
    else:
        row.completed_at = None
    if getattr(payload, "notes", None) is not None:
        row.notes = payload.notes
    row.updated_at = utcnow()
    db.flush()
    result = recalculate_roadmap(db, roadmap, profile, commit=False)
    db.commit()
    return {"node_key": node.node_key, "status": row.status, "roadmap": result}


def mark_assessment(
    db: Session, user: User, profile: StudentProfile, payload
) -> dict[str, Any]:
    roadmap = get_active_roadmap(db, user.id)
    if not roadmap:
        raise ValueError("Generate a roadmap before submitting an assessment")
    node = next((n for n in roadmap.nodes if n.node_key == payload.node_key), None)
    if not node or node.node_type != "assessment":
        raise ValueError("Assessment node not found")
    # Ensure dependencies are complete.
    deps = (node.meta or {}).get("dependency_keys", [])
    deps = deps if isinstance(deps, list) else []
    dep_nodes = [n for n in roadmap.nodes if n.node_key in deps]
    if any(n.status != "completed" for n in dep_nodes):
        raise ValueError("Complete the phase courses and project before taking the assessment")
    node.score = payload.score
    passed = payload.score >= float((node.meta or {}).get("pass_score", 70))
    db.add(AssessmentAttempt(
        user_id=user.id, roadmap_id=roadmap.id, node_key=node.node_key,
        score=payload.score, passed=passed,
    ))
    db.flush()
    result = recalculate_roadmap(db, roadmap, profile, commit=False)
    db.commit()
    return {"node_key": node.node_key, "score": payload.score, "passed": passed, "roadmap": result}


def task_counts(db: Session, user_id: int, roadmap: Roadmap) -> dict[str, Any]:
    course_nodes = [n for n in roadmap.nodes if n.node_type == "course"]
    completed_courses = sum(1 for n in course_nodes if n.status == "completed")
    project_nodes = [n for n in roadmap.nodes if n.node_type == "project"]
    completed_projects = sum(1 for n in project_nodes if n.status == "completed")
    total_courses = len(course_nodes)
    total_projects = len(project_nodes)
    return {
        "total_courses": total_courses,
        "completed_courses": completed_courses,
        "pending_courses": total_courses - completed_courses,
        "total_projects": total_projects,
        "completed_projects": completed_projects,
    }


def learning_hours(db: Session, user_id: int, roadmap: Roadmap, profile: StudentProfile) -> dict[str, float]:
    course_base = sum(
        (n.duration_hours or 0) for n in roadmap.nodes if n.node_type == "course" and n.status == "completed"
    )
    project_base = sum(
        (n.duration_hours or 0) for n in roadmap.nodes if n.node_type == "project" and n.status == "completed"
    )
    assessment = sum(
        2.0 for n in roadmap.nodes if n.node_type == "assessment" and n.status == "completed"
    )
    completed = course_base * COURSE_OVERHEAD + project_base * PROJECT_OVERHEAD + assessment
    total = roadmap.total_hours or completed
    return {
        "total": round(total, 1),
        "completed": round(completed, 1),
        "remaining": round(max(0.0, total - completed), 1),
    }


def phase_chart(roadmap: Roadmap) -> list[dict[str, Any]]:
    result = []
    for number, nodes in phase_groups(roadmap).items():
        phase_node = next((n for n in nodes if n.node_type == "phase"), None)
        children = [n for n in nodes if n.node_type in COUNTED_PHASE_TYPES]
        completed = sum(1 for n in children if n.status == "completed")
        result.append({
            "phase": f"Phase {number}",
            "title": phase_node.title if phase_node else f"Phase {number}",
            "progress": round(completed / len(children) * 100) if children else 100,
            "status": phase_node.status if phase_node else "pending",
        })
    return result


def dashboard_data(db: Session, user: User, profile: StudentProfile) -> dict[str, Any]:
    roadmap = get_active_roadmap(db, user.id)
    base = {
        "full_name": user.full_name,
        "career_goal": profile.desired_role,
        "onboarding_completed": profile.onboarding_completed,
        "profile_completeness": profile.profile_completeness,
        "has_roadmap": bool(roadmap),
        "ai": {
            "enabled": False,
            "provider": "curated",
        },
    }
    if not roadmap:
        return base

    recalc = recalculate_roadmap(db, roadmap, profile)
    schedule = build_schedule(roadmap, profile)
    analysis = analyze_profile(db, profile, roadmap.career_role_id)
    counts = task_counts(db, user.id, roadmap)
    hours = learning_hours(db, user.id, roadmap, profile)
    current_phase = recalc["current_phase"]
    phase_title = None
    if current_phase:
        node = next((n for n in roadmap.nodes if n.node_type == "phase" and n.phase_number == current_phase), None)
        phase_title = node.title if node else None

    progress_counts = {"completed": 0, "current": 0, "pending": 0, "locked": 0}
    for n in roadmap.nodes:
        if n.node_type in {"course", "project", "assessment", "phase", "completion"}:
            progress_counts[n.status] = progress_counts.get(n.status, 0) + 1

    today = date.today()
    current_week = min(
        schedule["total_weeks"],
        max(1, (today - (roadmap.start_date or today)).days // 7 + 1),
    )
    upcoming = []
    for p in schedule["phases"]:
        node = next((n for n in roadmap.nodes if n.node_type == "phase" and n.phase_number == p["phase_number"]), None)
        if node and node.status != "completed":
            upcoming.append({
                "title": f"Complete {p['title']}",
                "due": p["end_date"],
                "status": node.status,
                "week": math.ceil(p["end_week"]),
                "type": "phase",
            })
    upcoming = upcoming[:3]
    if roadmap.status != "completed":
        upcoming.append({
            "title": "Roadmap completion & career readiness review",
            "due": roadmap.expected_completion,
            "status": "locked",
            "week": roadmap.total_weeks,
            "type": "completion",
        })

    weekly_chart = [
        {
            "week": f"W{w['week']}",
            "planned": w["planned_hours"],
            "capacity": w["capacity_hours"],
            "completed": sum(i["hours"] for i in w["items"]
                             if any(n.node_key == i["node_key"] and n.status == "completed" for n in roadmap.nodes)),
        }
        for w in schedule["weeks"][max(0, current_week - 2): current_week + 6]
    ]

    recent = []
    for p in db.query(CourseProgress).filter(
        CourseProgress.user_id == user.id, CourseProgress.status == "completed"
    ).order_by(CourseProgress.completed_at.desc()).limit(5).all():
        course = db.get(Course, p.course_id)
        recent.append({
            "title": f"Completed {course.title if course else p.course_id}",
            "date": p.completed_at, "type": "course",
        })
    for p in db.query(ProjectProgress).filter(
        ProjectProgress.user_id == user.id, ProjectProgress.status == "completed"
    ).order_by(ProjectProgress.completed_at.desc()).limit(3).all():
        project = db.get(Project, p.project_id)
        recent.append({
            "title": f"Completed project {project.title if project else p.project_id}",
            "date": p.completed_at, "type": "project",
        })
    recent.sort(key=lambda x: x["date"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

    return {
        **base,
        "has_roadmap": True,
        "career_goal": roadmap.career_goal,
        "roadmap_id": roadmap.id,
        "current_phase": current_phase,
        "current_phase_title": phase_title,
        "total_phases": len(phase_groups(roadmap)),
        "progress_percent": recalc["progress_percent"],
        "readiness": analysis["readiness"],
        "current_level": analysis["current_level"],
        **counts,
        "learning_hours": hours,
        "hour_counts": {
            "total": hours["total"],
            "completed": hours["completed"],
            "remaining": hours["remaining"],
        },
        "expected_completion": roadmap.expected_completion,
        "total_weeks": roadmap.total_weeks,
        "current_week": current_week,
        "upcoming_milestones": upcoming,
        "recent_activity": recent[:5],
        "charts": {
            "status_pie": [
                {"name": "Completed", "value": progress_counts["completed"]},
                {"name": "In progress", "value": progress_counts["current"]},
                {"name": "Pending", "value": progress_counts["pending"]},
                {"name": "Locked", "value": progress_counts["locked"]},
            ],
            "weekly_hours": weekly_chart,
            "phase_progress": phase_chart(roadmap),
            "monthly_progress": [
                {"month": m["label"], "hours": m["hours"], "milestone": m["milestone"]}
                for m in schedule["months"]
            ],
            "skill_radar": analysis["gaps_by_category"],
            "skill_gap": {
                "matched": len(analysis["matched_skills"]),
                "missing": len(analysis["missing_skills"]),
                "total": analysis["total_required"],
            },
        },
        "feasibility": schedule["feasibility"],
        "warnings": schedule["warnings"],
        "skill_summary": analysis["summary"],
        "ai": {"enabled": False, "provider": "curated"},
    }


def planner_data(db: Session, user: User, profile: StudentProfile) -> dict[str, Any]:
    roadmap = get_active_roadmap(db, user.id)
    if not roadmap:
        return {"weeks": [], "total_weeks": 0, "message": "Generate a roadmap first"}
    recalculate_roadmap(db, roadmap, profile)
    schedule = build_schedule(roadmap, profile)
    status_map = {n.node_key: n.status for n in roadmap.nodes}
    today = date.today()
    current_week = min(
        schedule["total_weeks"],
        max(1, (today - (roadmap.start_date or today)).days // 7 + 1),
    )
    for week in schedule["weeks"]:
        for item in week["items"]:
            item["status"] = status_map.get(item["node_key"], "pending")
        week["focus"] = ", ".join(dict.fromkeys(i["title"] for i in week["items"])) or "Rest & revision"
        week["is_current"] = week["week"] == current_week
    return {
        "weeks": schedule["weeks"],
        "months": schedule["months"],
        "total_weeks": schedule["total_weeks"],
        "current_week": current_week,
        "capacity": schedule["weekly_capacity"],
        "hours_per_day": profile.hours_per_day,
        "days_per_week": profile.days_per_week,
        "feasibility": schedule["feasibility"],
        "warnings": schedule["warnings"],
    }


def milestones_data(db: Session, user: User, profile: StudentProfile) -> list[dict[str, Any]]:
    roadmap = get_active_roadmap(db, user.id)
    if not roadmap:
        return []
    recalculate_roadmap(db, roadmap, profile)
    schedule = build_schedule(roadmap, profile)
    milestones = []
    for p in schedule["phases"]:
        node = next((n for n in roadmap.nodes if n.node_type == "phase" and n.phase_number == p["phase_number"]), None)
        children = [
            n for n in roadmap.nodes
            if n.phase_number == p["phase_number"] and n.node_type in COUNTED_PHASE_TYPES
        ]
        completed = sum(1 for n in children if n.status == "completed")
        milestones.append({
            "title": p["title"],
            "due": p["end_date"],
            "status": "completed" if completed == len(children) and children else (node.status if node else "pending"),
            "week": math.ceil(p["end_week"]),
            "type": "phase",
            "progress": round(completed / len(children) * 100) if children else 100,
            "phase": p["phase_number"],
        })
    if roadmap.expected_completion:
        milestones.append({
            "title": "Career readiness review",
            "due": roadmap.expected_completion,
            "status": "completed" if roadmap.status == "completed" else "locked",
            "week": roadmap.total_weeks,
            "type": "completion",
            "progress": 100 if roadmap.status == "completed" else 0,
            "phase": None,
        })
    return milestones
