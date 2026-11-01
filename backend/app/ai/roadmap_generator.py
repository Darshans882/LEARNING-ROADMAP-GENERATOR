"""Personalized roadmap generation and graph construction."""
from __future__ import annotations

import re
from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session

from ..models import (
    CareerRole,
    Course,
    Project,
    Roadmap,
    RoadmapNode,
    Skill,
    StudentProfile,
    User,
)
from ..services.duration_calculator import calculate_schedule
from ..services.progress_service import get_active_roadmap, recalculate_roadmap
from .llm_engine import llm_engine
from .recommendation import CourseRecommender
from .skill_analyzer import analyze_profile

NODE_TYPES = Literal[
    "start", "goal", "skill_analysis", "phase", "course", "project", "assessment", "completion"
]


# ---------------------------------------------------------------------------
# Validation models
# ---------------------------------------------------------------------------
class GeneratedNode(BaseModel):
    node_key: str = Field(min_length=2, max_length=150)
    node_type: NODE_TYPES
    title: str = Field(min_length=2, max_length=250)
    description: str = ""
    phase_number: int | None = Field(default=None, ge=1, le=12)
    duration_hours: float = Field(default=0, ge=0, le=5000)
    parent_key: str | None = None
    skills: list[str] = []
    prerequisites: list[str] = []
    order_index: int = 0
    course_id: str | None = None
    project_id: str | None = None
    meta: dict[str, Any] = {}

    @model_validator(mode="after")
    def must_be_grounded(self):
        if self.node_type == "course" and not self.course_id:
            raise ValueError("Course nodes require a catalogue course_id")
        if self.node_type == "project" and not self.project_id and not self.meta.get("generated"):
            raise ValueError("Project nodes require a project_id or generated flag")
        if self.node_type == "phase" and not self.phase_number:
            raise ValueError("Phase nodes require a phase number")
        return self


class GeneratedRoadmap(BaseModel):
    career_goal: str
    career_role_id: str
    nodes: list[GeneratedNode]
    total_hours: float
    total_weeks: int
    expected_completion: date
    summary: str

    @model_validator(mode="after")
    def unique_keys(self):
        keys = [n.node_key for n in self.nodes]
        if len(keys) != len(set(keys)):
            raise ValueError("Duplicate node keys in roadmap")
        if not any(n.node_type == "completion" for n in self.nodes):
            raise ValueError("Roadmap must contain a completion node")
        return self


class EnrichedPhase(BaseModel):
    phase_number: int = Field(ge=1, le=12)
    objectives: list[str] = Field(default_factory=list, max_length=6)
    assignments: list[str] = Field(default_factory=list, max_length=6)
    monthly_milestone: str | None = None

    @field_validator("objectives", "assignments")
    @classmethod
    def no_links(cls, values: list[str]) -> list[str]:
        cleaned = []
        for value in values:
            value = value.strip()
            if not value or "http://" in value or "https://" in value:
                continue
            cleaned.append(value[:400])
        return cleaned[:4]


class EnrichedNode(BaseModel):
    node_key: str
    objective: str

    @field_validator("objective")
    @classmethod
    def no_links(cls, value: str) -> str:
        value = value.strip()
        if "http://" in value or "https://" in value:
            return ""
        return value[:500]


class LLMEnrichment(BaseModel):
    summary: str = Field(default="", max_length=1500)
    phases: list[EnrichedPhase] = Field(default_factory=list, max_length=12)
    nodes: list[EnrichedNode] = Field(default_factory=list, max_length=40)

    @field_validator("summary")
    @classmethod
    def summary_no_links(cls, value: str) -> str:
        return "" if "http://" in value or "https://" in value else value.strip()[:1200]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _safe_phase_skills(role: CareerRole) -> list[list[str]]:
    raw = role.phase_skills or []
    result: list[list[str]] = []
    for item in raw:
        if isinstance(item, str):
            result.append([s.strip() for s in item.split("|") if s.strip()])
        elif isinstance(item, list):
            result.append([str(s) for s in item if s])
        else:
            result.append([])
    while len(result) < 6:
        result.append([])
    return result[:6]


def _objectives_for_course(course: Course, skills: list[str], skill_names: dict[str, str], role_title: str) -> list[str]:
    names = [skill_names.get(s, s) for s in skills[:3]]
    objectives = [
        f"Understand the core concepts of {', '.join(names)}.",
        f"Complete the guided exercises in {course.title}.",
    ]
    if course.learning_type == "Practical":
        objectives.append(f"Apply {names[0] if names else 'the material'} by building a small working artifact.")
    else:
        objectives.append(f"Summarize how {', '.join(names)} connects to the day-to-day work of a {role_title}.")
    return objectives


def _assignment_for_course(course: Course, skills: list[str], skill_names: dict[str, str]) -> str:
    names = ", ".join(skill_names.get(s, s) for s in skills[:3]) or "the course topics"
    return (
        f"Finish the course's practice material for {names}, then write a short evidence note "
        f"(what you built, what was hard, what you would do differently) and commit it to your portfolio repo."
    )


def _select_project(
    projects: list[Project], role_id: str, phase_skills: list[str], used: set[str], phase_number: int
) -> dict[str, Any] | None:
    candidates = [
        p for p in projects
        if p.project_id not in used and p.career_role in {role_id, "all"}
    ]
    if not candidates:
        return None
    preference = "mini" if phase_number <= 2 else "major"
    best: tuple[float, Project] | None = None
    for p in candidates:
        overlap = len(set(p.skills or []) & set(phase_skills))
        score = overlap * 4.0
        if p.project_id in {"proj-portfolio", "proj-interview"}:
            score += 0.5 if phase_number >= 5 else -1.0
        if p.project_type == preference:
            score += 2.0
        if p.career_role == role_id:
            score += 1.5
        if best is None or score > best[0]:
            best = (score, p)
    if best and (best[0] > 0 or phase_number >= 5):
        return {"project": best[1], "generated": False}
    return None


def _generated_project(phase_number: int, title: str, skills: list[str], skill_names: dict[str, str]) -> dict:
    names = [skill_names.get(s, s) for s in skills[:4]]
    return {
        "generated": True,
        "title": f"Applied {title} Project",
        "description": (
            f"Build a portfolio-ready deliverable that demonstrates {', '.join(names) or 'the phase skills'}. "
            "Define the scope, ship a working result and document your decisions."
        ),
        "skills": skills,
        "duration_hours": 10 + phase_number * 2,
        "project_type": "mini" if phase_number <= 2 else "major",
        "deliverables": "Working artifact, README with setup steps, short reflection and evidence of testing",
        "reference_url": None,
    }


def _build_edges(nodes: list[GeneratedNode]) -> list[dict[str, Any]]:
    edges = []
    seen = set()
    for node in nodes:
        deps = (node.meta or {}).get("dependency_keys")
        deps = deps if isinstance(deps, list) else ([node.parent_key] if node.parent_key else [])
        for dep in deps:
            key = (dep, node.node_key)
            if not dep or dep == node.node_key or key in seen:
                continue
            seen.add(key)
            edges.append({
                "id": f"e-{dep}-{node.node_key}",
                "source": dep,
                "target": node.node_key,
                "animated": node.node_type in {"course", "project"} and node.meta.get("phase_status") == "current",
            })
    return edges


def _extract_json_text(text: str) -> str | None:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    return match.group(0) if match else None


def _enrich_with_llm(
    profile: StudentProfile,
    role: CareerRole,
    analysis: dict[str, Any],
    nodes: list[GeneratedNode],
    summary: str,
) -> tuple[LLMEnrichment | None, str | None]:
    if not llm_engine.available:
        return None, "LLM not configured; used curated curriculum design."
    skill_names = {s: s for s in analysis.get("required_skills", [])}
    context = {
        "student": {
            "degree": profile.degree, "department": profile.department,
            "year": profile.current_year, "level": profile.proficiency_level,
            "current_skills": [m["skill_name"] for m in analysis["matched_skills"]],
            "missing_skills": [m["skill_name"] for m in analysis["missing_skills"]],
            "hours_per_day": profile.hours_per_day, "days_per_week": profile.days_per_week,
            "budget": profile.budget_pref, "language": profile.course_language,
            "short_term_goal": profile.short_term_goal, "long_term_goal": profile.long_term_goal,
        },
        "career": {
            "title": role.title, "description": role.description,
            "core_skills": role.core_skills, "advanced_skills": role.advanced_skills,
            "phase_titles": role.phase_titles,
        },
        "phases": [
            {
                "phase_number": n.phase_number, "title": n.title,
                "topics": n.skills, "duration_hours": n.duration_hours,
                "courses": [
                    {"title": nn.title, "platform": nn.meta.get("platform")}
                    for nn in nodes if nn.node_type == "course" and nn.phase_number == n.phase_number
                ],
            }
            for n in nodes if n.node_type == "phase"
        ],
    }
    system = (
        "You are a senior curriculum designer for a personalized learning platform. "
        "Use ONLY the supplied student, career, skill-gap and phase data. Never invent or change "
        "course titles, URLs, prices, durations, ratings, certificates or project links. "
        "Write practical, specific educational prose for a college student. "
        "Return strict JSON with keys: summary (string), phases (array of {phase_number, objectives[], "
        "assignments[], monthly_milestone}), nodes (array of {node_key, objective}). "
        "Objectives and assignments must be actionable and must not contain URLs. "
        "The summary must be 2-4 sentences and must not claim progress that is not in the data."
    )
    user = (
        "Create curriculum enrichment for this roadmap. Keep the given phase structure and titles. "
        f"Return JSON only.\n\n{context}\n\nBase summary: {summary}"
    )
    data = llm_engine.json_completion(system, user)
    if not data:
        return None, llm_engine.last_error or "LLM returned no usable JSON; curated content retained."
    try:
        return LLMEnrichment.model_validate(data), None
    except Exception as exc:
        return None, f"LLM output failed validation: {exc}"


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------
def generate_roadmap(
    db: Session,
    user: User,
    profile: StudentProfile,
    role_id: str | None = None,
    force: bool = False,
    use_llm: bool = True,
) -> Roadmap:
    role_id = role_id or profile.career_role_id
    if not role_id:
        raise ValueError("Select a career goal before generating a roadmap")
    role = db.get(CareerRole, role_id)
    if not role:
        raise ValueError("Career role not found")

    active = get_active_roadmap(db, user.id)
    if active and not force and active.career_role_id == role_id:
        return active

    analysis = analyze_profile(db, profile, role_id)
    if not analysis["required_skills"]:
        raise ValueError("This career role has no configured skills yet")

    skill_rows = db.query(Skill).all()
    skill_names = {s.skill_id: s.skill_name for s in skill_rows}
    courses = db.query(Course).filter(Course.is_active.is_(True)).all()
    projects = db.query(Project).all()
    missing_ids = [m["skill_id"] for m in analysis["missing_skills"]]
    missing_set = set(missing_ids)
    matched_ids = set(analysis["matched_skill_ids"])

    phase_skills = _safe_phase_skills(role)
    # Ensure every missing required skill is represented in a phase.
    assigned = {s for group in phase_skills for s in group}
    unassigned = [s for s in missing_ids if s not in assigned]
    if unassigned:
        for skill_id in unassigned:
            skill = next((s for s in skill_rows if s.skill_id == skill_id), None)
            if not skill:
                continue
            target = 1
            for idx, group in enumerate(phase_skills[:5]):
                cats = [
                    next((s.category for s in skill_rows if s.skill_id == sid), "")
                    for sid in group
                ]
                if skill.category in cats:
                    target = idx
                    break
            phase_skills[target].append(skill_id)

    phase_titles = list(role.phase_titles or [])
    while len(phase_titles) < 6:
        phase_titles.append(f"Phase {len(phase_titles) + 1}")
    phase_titles = phase_titles[:6]

    recommender = CourseRecommender(db)
    selected_courses: list[Course] = []
    used_course_ids: set[str] = set()
    used_project_ids: set[str] = set()
    phase_plans: list[dict[str, Any]] = []
    generated_nodes: list[GeneratedNode] = []
    order = 0

    def add_node(**kwargs) -> GeneratedNode:
        nonlocal order
        kwargs.setdefault("order_index", order)
        node = GeneratedNode(**kwargs)
        generated_nodes.append(node)
        order += 1
        return node

    add_node(
        node_key="start", node_type="start",
        title="Start your journey", description=f"Your personalized path to becoming a {role.title}.",
        meta={"label": "Start"},
    )
    goal_node = add_node(
        node_key="goal", node_type="goal",
        title=role.title,
        description=role.description,
        skills=analysis["required_skills"],
        meta={
            "required_level": analysis["target_level"],
            "current_level": analysis["current_level"],
            "readiness": analysis["readiness"],
            "demand_outlook": role.demand_outlook,
            "onet_code": role.onet_code,
            "esco_uri": role.esco_uri,
            "dependency_keys": ["start"],
        },
    )
    analysis_node = add_node(
        node_key="skill-analysis", node_type="skill_analysis",
        title="Skill gap analysis",
        description=analysis["summary"],
        duration_hours=1,
        skills=analysis["missing_skill_ids"],
        meta={
            "readiness": analysis["readiness"],
            "matched": len(analysis["matched_skills"]),
            "missing": len(analysis["missing_skills"]),
            "gaps_by_category": analysis["gaps_by_category"],
            "dependency_keys": ["goal"],
        },
    )

    previous_anchor = analysis_node.node_key

    for idx, group in enumerate(phase_skills):
        number = idx + 1
        title = phase_titles[idx]
        group = list(dict.fromkeys(group))
        phase_missing = [s for s in group if s in missing_set]
        phase_matched = [s for s in group if s in matched_ids]
        # Recommend courses grounded in the catalogue, one per missing skill.
        per_skill = recommender.recommend_per_skill(
            profile, phase_missing, known_skills=matched_ids,
            max_per_skill=1, allow_catalogue=True, career_title=role.title,
        ) if phase_missing else {}
        picks: list[tuple[Course, list[str], Any]] = []
        seen_pick: set[str] = set()
        for skill_id, recs in per_skill.items():
            for rec in recs:
                c = rec.course
                if c.course_id in used_course_ids or c.course_id in seen_pick:
                    continue
                seen_pick.add(c.course_id)
                picks.append((c, [skill_id], rec))
        # Prefer courses that cover several phase skills, then verified direct pages.
        picks.sort(
            key=lambda item: (
                len(set(item[0].skills) & set(phase_missing)),
                item[0].verified,
                item[0].link_type == "direct",
                item[2].score,
            ),
            reverse=True,
        )
        picks = picks[:3]
        while len(picks) < min(2, len(phase_missing)):
            extra = recommender.recommend(
                profile, phase_missing, known_skills=matched_ids, limit=12,
                exclude_ids=used_course_ids | seen_pick, allow_catalogue=True,
                career_title=role.title,
            )
            added = False
            for rec in extra:
                if rec.course.course_id in seen_pick:
                    continue
                picks.append((rec.course, [s for s in phase_missing if s in rec.course.skills], rec))
                seen_pick.add(rec.course.course_id)
                added = True
                break
            if not added:
                break

        if not picks and not phase_missing:
            # Reinforcement course for an already-strong phase.
            extra = recommender.recommend(
                profile, group, known_skills=matched_ids, limit=4,
                exclude_ids=used_course_ids, allow_catalogue=False, career_title=role.title,
            )
            if extra and group:
                rec = extra[0]
                picks = [(rec.course, [s for s in group if s in rec.course.skills][:2], rec)]

        phase_course_nodes: list[GeneratedNode] = []
        uncovered = [s for s in phase_missing]
        for course, covered_skills, rec in picks:
            if course.course_id in used_course_ids:
                continue
            used_course_ids.add(course.course_id)
            selected_courses.append(course)
            covered = [s for s in course.skills if s in phase_missing] or covered_skills
            uncovered = [s for s in uncovered if s not in covered]
            node_key = f"course-{course.course_id}-{number}"
            duration = course.duration_hours or 20.0
            node = add_node(
                node_key=node_key, node_type="course", title=course.title,
                description=course.description,
                phase_number=number,
                duration_hours=duration,
                parent_key=f"phase-{number}",
                skills=course.skills or [],
                prerequisites=course.prerequisites or [],
                course_id=course.course_id,
                meta={
                    "platform": course.platform,
                    "url": course.url,
                    "verified": bool(course.verified),
                    "link_type": course.link_type,
                    "verification_note": course.verification_note,
                    "difficulty": course.difficulty,
                    "price_type": course.price_type,
                    "price_usd": course.price_usd,
                    "price_note": course.price_note,
                    "language": course.language,
                    "rating": course.rating,
                    "certificate": bool(course.certificate),
                    "learning_type": course.learning_type,
                    "duration_is_estimate": bool(course.duration_is_estimate) or not course.duration_hours,
                    "match_score": rec.score,
                    "match_reasons": rec.reasons,
                    "warnings": rec.warnings,
                    "objectives": _objectives_for_course(course, covered, skill_names, role.title),
                    "assignment": _assignment_for_course(course, covered, skill_names),
                    "covered_skills": covered,
                    "dependency_keys": [f"phase-{number}"],
                },
            )
            phase_course_nodes.append(node)

        project_data = _select_project(projects, role_id, group, used_project_ids, number)
        if project_data:
            project = project_data["project"]
            used_project_ids.add(project.project_id)
            p_title = project.title
            p_desc = project.description
            p_skills = project.skills or []
            p_hours = project.duration_hours
            p_type = project.project_type
            p_deliverables = project.deliverables
            p_reference = project.reference_url
            p_generated = False
            p_id = project.project_id
            p_difficulty = project.difficulty
        else:
            generated = _generated_project(number, title, group, skill_names)
            p_title = generated["title"]
            p_desc = generated["description"]
            p_skills = generated["skills"]
            p_hours = generated["duration_hours"]
            p_type = generated["project_type"]
            p_deliverables = generated["deliverables"]
            p_reference = None
            p_generated = True
            p_id = None
            p_difficulty = "intermediate" if number < 4 else "advanced"

        project_key = f"project-{number}"
        dep_keys = [n.node_key for n in phase_course_nodes] or [f"phase-{number}"]
        project_node = add_node(
            node_key=project_key, node_type="project", title=p_title,
            description=p_desc,
            phase_number=number,
            duration_hours=p_hours,
            parent_key=f"phase-{number}",
            skills=p_skills,
            project_id=p_id,
            meta={
                "generated": p_generated,
                "deliverables": p_deliverables,
                "difficulty": p_difficulty,
                "project_type": p_type,
                "reference_url": p_reference,
                "requirements": [skill_names.get(s, s) for s in p_skills],
                "dependency_keys": dep_keys,
            },
        )

        assessment_key = f"assessment-{number}"
        quiz_topics = [skill_names.get(s, s) for s in group if s in missing_set][:5]
        if not quiz_topics:
            quiz_topics = [skill_names.get(s, s) for s in group][:5]
        assessment_node = add_node(
            node_key=assessment_key, node_type="assessment",
            title=f"Phase {number} checkpoint: {title}",
            description=(
                f"Score at least 70% on a short quiz and practical evaluation covering "
                f"{', '.join(quiz_topics) or 'the phase topics'}. The next phase unlocks when you pass."
            ),
            phase_number=number,
            duration_hours=2,
            parent_key=project_key,
            skills=group,
            meta={
                "pass_score": 70,
                "quiz_topics": quiz_topics,
                "type": "quiz + skill evaluation",
                "dependency_keys": [project_key],
            },
        )

        phase_duration = (
            sum(n.duration_hours for n in phase_course_nodes) + p_hours + 2
        )
        phase_node = add_node(
            node_key=f"phase-{number}", node_type="phase", title=f"Phase {number}: {title}",
            description=(
                f"Focus: {', '.join(skill_names.get(s, s) for s in group) or 'applied practice'}. "
                f"Complete {len(phase_course_nodes)} course(s), build the project, and pass the checkpoint."
            ),
            phase_number=number,
            duration_hours=phase_duration,
            parent_key=previous_anchor,
            skills=group,
            prerequisites=[],
            meta={
                "topics": [skill_names.get(s, s) for s in group],
                "missing_skills": [skill_names.get(s, s) for s in phase_missing],
                "covered_skills": [skill_names.get(s, s) for s in phase_matched],
                "uncovered_skills": [skill_names.get(s, s) for s in uncovered],
                "course_count": len(phase_course_nodes),
                "project_type": p_type,
                "objectives": [
                    f"Build working proficiency in {', '.join(skill_names.get(s, s) for s in phase_missing[:3])}."
                    if phase_missing else f"Deepen your existing {', '.join(skill_names.get(s, s) for s in group[:3])}.",
                    f"Apply the skills in a {p_type} project with a clear deliverable.",
                    "Pass the phase checkpoint at 70% or above.",
                ],
                "assignments": [
                    f"Complete the recommended course work for {skill_names.get(s, s)}."
                    for s in phase_missing[:3]
                ] + [f"Ship the project deliverable: {p_deliverables}."],
                "monthly_milestone": f"Complete {title} and pass the checkpoint",
                "dependency_keys": [previous_anchor],
            },
        )
        phase_plans.append({
            "phase_number": number,
            "title": title,
            "courses": [
                {"key": n.node_key, "title": n.title, "hours": n.duration_hours}
                for n in phase_course_nodes
            ],
            "project": {"key": project_key, "title": p_title, "hours": p_hours},
            "assessment": {"key": assessment_key, "title": assessment_node.title},
        })
        previous_anchor = assessment_key

    # Completion node
    final_skills = [skill_names.get(s, s) for s in analysis["required_skills"]]
    plan_schedule = calculate_schedule(
        phase_plans, profile, start_date=date.today(), target_date=profile.target_completion_date,
    )
    total_catalogue_links = sum(
        1 for c in selected_courses if not c.verified or c.link_type != "direct"
    )
    summary = (
        f"Your {role.title} roadmap closes {len(missing_ids)} skill gaps across "
        f"{len(phase_plans)} phases, with {len(selected_courses)} recommended courses and "
        f"{len(phase_plans)} applied projects. It needs roughly {plan_schedule['total_hours']:.0f} focused hours "
        f"over {plan_schedule['total_weeks']} weeks at your capacity of "
        f"{plan_schedule['weekly_capacity']:.0f} hours/week. "
        f"You finish with a checkpoint-based portfolio and career-readiness review."
    )
    if total_catalogue_links:
        summary += (
            f" {total_catalogue_links} recommendation(s) point to an official platform catalogue or search page; "
            "these are marked unverified and should be confirmed before enrolling."
        )

    completion_node = add_node(
        node_key="completion", node_type="completion",
        title="Career ready: " + role.title,
        description=(
            f"Final skills: {', '.join(final_skills[:6])}. "
            "Complete every checkpoint to unlock your readiness summary."
        ),
        duration_hours=2,
        skills=analysis["required_skills"],
        meta={
            "final_skills": final_skills,
            "career_readiness_target": analysis["target_level"],
            "dependency_keys": [previous_anchor],
            "summary": summary,
        },
    )

    total_hours = plan_schedule["total_hours"]
    expected = plan_schedule["expected_completion"]

    generated = GeneratedRoadmap(
        career_goal=role.title,
        career_role_id=role.role_id,
        nodes=generated_nodes,
        total_hours=total_hours,
        total_weeks=plan_schedule["total_weeks"],
        expected_completion=expected,
        summary=summary,
    )

    enriched = None
    llm_note = None
    if use_llm:
        enriched, llm_note = _enrich_with_llm(profile, role, analysis, generated_nodes, summary)
        if enriched and enriched.summary:
            summary = enriched.summary
        if enriched:
            phase_meta = {p.phase_number: p for p in enriched.phases}
            for node in generated_nodes:
                if node.node_type == "phase" and node.phase_number in phase_meta:
                    enrich = phase_meta[node.phase_number]
                    if enrich.objectives:
                        node.meta["objectives"] = enrich.objectives
                    if enrich.assignments:
                        node.meta["assignments"] = enrich.assignments
                    if enrich.monthly_milestone:
                        node.meta["monthly_milestone"] = enrich.monthly_milestone
                if node.node_type == "course":
                    node_match = next((n for n in enriched.nodes if n.node_key == node.node_key), None)
                    if node_match and node_match.objective:
                        node.meta["objectives"] = [node_match.objective, *node.meta.get("objectives", [])[:2]]

    # Persist. Keep prior roadmaps as history.
    if active:
        active.is_active = False
        db.flush()

    roadmap = Roadmap(
        user_id=user.id,
        career_goal=role.title,
        career_role_id=role.role_id,
        current_level=analysis["current_level"],
        target_level=analysis["target_level"],
        status="active",
        generated_by="llm+curated" if enriched else "curated-engine",
        summary=summary,
        skill_gap={
            "readiness": analysis["readiness"],
            "matched": analysis["matched_skills"],
            "missing": [
                {"skill_id": m["skill_id"], "skill_name": m["skill_name"], "category": m["category"], "level": m["level"]}
                for m in analysis["missing_skills"]
            ],
            "gaps_by_category": analysis["gaps_by_category"],
            "prerequisites": analysis["prerequisites"],
            "analysis_summary": analysis["summary"],
            "feasibility": plan_schedule["feasibility"],
            "months": plan_schedule["months"],
            "warnings": plan_schedule["warnings"],
            "llm_note": llm_note,
        },
        total_hours=total_hours,
        total_weeks=plan_schedule["total_weeks"],
        start_date=date.today(),
        expected_completion=expected,
        is_active=True,
    )
    db.add(roadmap)
    db.flush()

    db_nodes: dict[str, RoadmapNode] = {}
    for node in generated_nodes:
        db_node = RoadmapNode(
            roadmap_id=roadmap.id,
            node_key=node.node_key,
            node_type=node.node_type,
            title=node.title,
            description=node.description,
            phase_number=node.phase_number,
            duration_hours=node.duration_hours,
            status="pending",
            course_id=node.course_id,
            project_id=node.project_id,
            prerequisites=node.prerequisites,
            skills=node.skills,
            parent_key=node.parent_key,
            order_index=node.order_index,
            meta=node.meta,
        )
        db.add(db_node)
        db_nodes[node.node_key] = db_node
    db.flush()

    # Profile is now explicitly pursuing this role.
    profile.career_role_id = role.role_id
    profile.desired_role = role.title
    db.flush()

    recalculate_roadmap(db, roadmap, profile, commit=False)
    db.commit()
    db.refresh(roadmap)
    return roadmap


def roadmap_to_dict(roadmap: Roadmap, recalc: dict[str, Any] | None = None) -> dict[str, Any]:
    from ..schemas import CourseOut, ProjectOut

    nodes = sorted(roadmap.nodes, key=lambda n: n.order_index)
    edges = []
    seen = set()
    for node in nodes:
        deps = (node.meta or {}).get("dependency_keys")
        deps = deps if isinstance(deps, list) else ([node.parent_key] if node.parent_key else [])
        for dep in deps:
            if not dep or dep == node.node_key or (dep, node.node_key) in seen:
                continue
            seen.add((dep, node.node_key))
            edges.append({
                "id": f"e-{dep}-{node.node_key}",
                "source": dep,
                "target": node.node_key,
                "animated": node.status in {"current", "pending"},
            })
    return {
        "id": roadmap.id,
        "career_goal": roadmap.career_goal,
        "career_role_id": roadmap.career_role_id,
        "current_level": roadmap.current_level,
        "target_level": roadmap.target_level,
        "status": roadmap.status,
        "generated_by": roadmap.generated_by,
        "summary": roadmap.summary,
        "total_hours": roadmap.total_hours,
        "total_weeks": roadmap.total_weeks,
        "start_date": roadmap.start_date,
        "expected_completion": roadmap.expected_completion,
        "progress_percent": (recalc or {}).get("progress_percent", 0),
        "current_phase": (recalc or {}).get("current_phase"),
        "nodes": [
            {
                "node_key": n.node_key,
                "node_type": n.node_type,
                "title": n.title,
                "description": n.description,
                "phase_number": n.phase_number,
                "duration_hours": n.duration_hours,
                "status": n.status,
                "prerequisites": n.prerequisites or [],
                "skills": n.skills or [],
                "parent_key": n.parent_key,
                "order_index": n.order_index,
                "score": n.score,
                "meta": n.meta or {},
                "course_id": n.course_id,
                "project_id": n.project_id,
                "course": CourseOut.model_validate(n.course).model_dump() if n.course else None,
                "project": ProjectOut.model_validate(n.project).model_dump() if n.project else None,
            }
            for n in nodes
        ],
        "edges": edges,
        "skill_gap": roadmap.skill_gap or {},
        "feasibility": (roadmap.skill_gap or {}).get("feasibility", {}),
    }

