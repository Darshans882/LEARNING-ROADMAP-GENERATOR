"""Skill gap analysis and career matching."""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from ..models import CareerRole, Course, CourseProgress, Skill, SkillPrerequisite, StudentProfile

LEVEL_WEIGHT = {"foundational": 1.0, "intermediate": 1.5, "advanced": 2.0}


def _normalize(value: str) -> str:
    value = value.lower().strip()
    value = value.replace("&", " and ")
    value = re.sub(r"[^a-z0-9+#./ -]", "", value)
    return re.sub(r"\s+", " ", value)


def profile_terms(profile: StudentProfile) -> list[str]:
    fields = [
        profile.programming_languages, profile.frameworks, profile.tools,
        profile.databases, profile.technical_skills, profile.soft_skills,
        profile.academic_subjects,
    ]
    terms: list[str] = []
    for field in fields:
        if not field:
            continue
        if isinstance(field, str):
            field = field.split(",")
        terms.extend(str(x).strip() for x in field if str(x).strip())
    return list(dict.fromkeys(terms))


def _build_alias_map(skills: list[Skill]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for skill in skills:
        mapping[_normalize(skill.skill_name)] = skill.skill_id
        mapping[_normalize(skill.skill_id)] = skill.skill_id
        for alias in (skill.aliases or "").split(","):
            alias = alias.strip()
            if alias:
                mapping[_normalize(alias)] = skill.skill_id
    return mapping


def match_terms(terms: list[str], skills: list[Skill]) -> dict[str, str]:
    """Return skill_id -> evidence for supplied free-text skill terms."""
    alias_map = _build_alias_map(skills)
    matched: dict[str, str] = {}
    for term in terms:
        normalized = _normalize(term)
        if not normalized:
            continue
        if normalized in alias_map:
            matched.setdefault(alias_map[normalized], term)
            continue
        # substring matching, guarded against very short aliases
        for alias, skill_id in alias_map.items():
            if len(alias) >= 3 and (alias in normalized or normalized in alias):
                matched.setdefault(skill_id, term)
                break
    return matched


def completed_skill_terms(db: Session, user_id: int) -> list[str]:
    rows = (
        db.query(Course)
        .join(CourseProgress, CourseProgress.course_id == Course.course_id)
        .filter(CourseProgress.user_id == user_id, CourseProgress.status == "completed")
        .all()
    )
    terms: list[str] = []
    for course in rows:
        terms.extend(course.skills or [])
    return terms


def analyze_profile(
    db: Session,
    profile: StudentProfile,
    role_id: str | None = None,
    include_completed: bool = True,
) -> dict[str, Any]:
    role_id = role_id or profile.career_role_id
    if not role_id:
        raise ValueError("No career goal selected")
    role = db.get(CareerRole, role_id)
    if not role:
        raise ValueError("Career role not found")

    skills = db.query(Skill).all()
    skill_by_id = {s.skill_id: s for s in skills}
    prereq_rows = db.query(SkillPrerequisite).all()
    prereqs: dict[str, list[str]] = defaultdict(list)
    for row in prereq_rows:
        prereqs[row.skill_id].append(row.prerequisite_skill_id)

    terms = profile_terms(profile)
    if include_completed:
        terms.extend(completed_skill_terms(db, profile.user_id))

    # Project/certification text can surface additional evidence.
    text_sources = " ".join(filter(None, [
        profile.previous_projects, profile.certifications, profile.work_experience,
        profile.internships, profile.previous_qualifications,
    ]))
    normalized_text = _normalize(text_sources)
    matched = match_terms(terms, skills)
    for skill in skills:
        if skill.skill_id in matched:
            continue
        names = [skill.skill_name, *(skill.aliases or "").split(",")]
        for name in names:
            name = name.strip()
            if len(name) >= 3 and _normalize(name) in normalized_text:
                matched[skill.skill_id] = f"mentioned in experience: {name}"
                break

    required = list(dict.fromkeys(role.required_skills or []))
    required = [s for s in required if s in skill_by_id]
    matched_required = [s for s in required if s in matched]
    missing_required = [s for s in required if s not in matched]

    # Prerequisite closure for missing skills (one level per missing branch).
    prerequisite_gaps: list[dict[str, Any]] = []
    seen_prereq: set[str] = set()
    for skill_id in missing_required:
        for pre in prereqs.get(skill_id, []):
            if pre in matched or pre in seen_prereq or pre in matched_required:
                continue
            seen_prereq.add(pre)
            skill = skill_by_id.get(pre)
            if skill:
                prerequisite_gaps.append({
                    "skill_id": pre, "skill_name": skill.skill_name,
                    "category": skill.category, "needed_for": skill_id,
                    "needed_for_name": skill_by_id[skill_id].skill_name,
                })

    matched_out = [
        {
            "skill_id": s,
            "skill_name": skill_by_id[s].skill_name,
            "category": skill_by_id[s].category,
            "level": skill_by_id[s].level,
            "evidence": matched.get(s, ""),
        }
        for s in required if s in matched
    ]
    missing_out = [
        {
            "skill_id": s,
            "skill_name": skill_by_id[s].skill_name,
            "category": skill_by_id[s].category,
            "level": skill_by_id[s].level,
            "missing_prerequisites": [
                p for p in prereqs.get(s, []) if p not in matched
            ],
            "reason": f"Required for {role.title} but not found in your profile",
        }
        for s in missing_required
    ]

    total_weight = sum(LEVEL_WEIGHT.get(skill_by_id[s].level, 1) for s in required) or 1
    matched_weight = sum(LEVEL_WEIGHT.get(skill_by_id[s].level, 1) for s in matched_required)
    readiness = round(min(100.0, (matched_weight / total_weight) * 100), 1)
    # Add a small, bounded bonus for portfolio/experience evidence.
    if profile.portfolio_url or profile.previous_projects:
        readiness = min(100.0, round(readiness + 3, 1))
    current_level = "Beginner" if readiness < 35 else "Intermediate" if readiness < 70 else "Advanced"

    categories: dict[str, dict[str, int]] = defaultdict(lambda: {"current": 0, "required": 0})
    for s in required:
        cat = skill_by_id[s].category
        categories[cat]["required"] += 1
        if s in matched:
            categories[cat]["current"] += 1
    category_scores = [
        {
            "category": cat,
            "current": vals["current"],
            "required": vals["required"],
            "coverage": round(vals["current"] / vals["required"] * 100, 1) if vals["required"] else 0,
        }
        for cat, vals in sorted(categories.items(), key=lambda kv: kv[0])
    ]

    strengths = [
        skill_by_id[s].skill_name for s in matched_required
        if skill_by_id[s].level in {"intermediate", "advanced"}
    ][:6]
    if not strengths:
        strengths = [skill_by_id[s].skill_name for s in matched_required][:6]

    # Topological ordering of missing skills + prerequisites.
    ordered_missing: list[dict[str, Any]] = []
    added: set[str] = set()
    queue = [s for s in missing_required]
    while queue:
        progress = False
        for s in list(queue):
            unmet = [p for p in prereqs.get(s, []) if p not in matched and p not in added]
            if unmet:
                for p in unmet:
                    if p in queue or p in required:
                        continue
                    queue.append(p)
                continue
            if s in added:
                continue
            skill = skill_by_id.get(s)
            if skill:
                ordered_missing.append({
                    "skill_id": s, "skill_name": skill.skill_name, "category": skill.category,
                    "level": skill.level, "missing_prerequisites": [
                        p for p in prereqs.get(s, []) if p not in matched
                    ],
                    "reason": f"Required for {role.title}",
                })
            added.add(s)
            queue.remove(s)
            progress = True
        if not progress:
            # Cycle or missing dependency; add remaining in stable order.
            for s in queue:
                if s in added:
                    continue
                skill = skill_by_id.get(s)
                if skill:
                    ordered_missing.append({
                        "skill_id": s, "skill_name": skill.skill_name, "category": skill.category,
                        "level": skill.level, "missing_prerequisites": [], "reason": f"Required for {role.title}",
                    })
                added.add(s)
            break

    summary = (
        f"You match {len(matched_required)} of {len(required)} required skills for {role.title} "
        f"({readiness:.0f}% readiness). Your profile currently reads as {current_level}. "
        f"The biggest gaps are in {', '.join(skill_by_id[s].skill_name for s in missing_required[:4]) or 'no critical areas'}."
        if missing_required else
        f"Strong profile: you match all {len(required)} core skills required for {role.title}. "
        "Focus on portfolio-quality projects and interview readiness."
    )

    return {
        "role_id": role.role_id,
        "role_title": role.title,
        "readiness": readiness,
        "current_level": current_level,
        "target_level": "Job-ready" if role.category != "Research" else "Research-ready",
        "matched_skills": matched_out,
        "missing_skills": ordered_missing or missing_out,
        "strengths": strengths,
        "gaps_by_category": category_scores,
        "prerequisites": prerequisite_gaps,
        "summary": summary,
        "total_required": len(required),
        "total_matched": len(matched_required),
        "required_skills": required,
        "matched_skill_ids": matched_required,
        "missing_skill_ids": missing_required,
    }


def recommend_careers(db: Session, profile: StudentProfile, limit: int = 6) -> list[dict[str, Any]]:
    roles = db.query(CareerRole).all()
    interest_text = " ".join([
        profile.desired_role or "", " ".join(profile.interested_industries or []),
        " ".join(profile.preferred_positions or []), profile.department or "",
        profile.short_term_goal or "", profile.long_term_goal or "",
    ]).lower()
    results = []
    for role in roles:
        try:
            analysis = analyze_profile(db, profile, role.role_id)
        except ValueError:
            continue
        score = analysis["readiness"] * 0.75
        if role.title.lower() in interest_text:
            score += 15
        if role.category.lower().split()[0] in interest_text:
            score += 5
        for keyword in (role.keywords or "").split(","):
            keyword = keyword.strip().lower()
            if keyword and keyword in interest_text:
                score += 2
        if role.role_id == profile.career_role_id:
            score += 8
        score = round(min(100.0, score), 1)
        reasons = []
        if analysis["total_matched"]:
            reasons.append(f"Matches {analysis['total_matched']} of {analysis['total_required']} required skills")
        if role.title.lower() in interest_text:
            reasons.append("Aligned with your stated interests")
        if not reasons:
            reasons.append("A growth path worth exploring based on your background")
        results.append({
            "role": role,
            "match_score": score,
            "matched_skills": analysis["matched_skill_ids"],
            "missing_skills": analysis["missing_skill_ids"],
            "reasons": reasons,
        })
    return sorted(results, key=lambda r: r["match_score"], reverse=True)[:limit]
