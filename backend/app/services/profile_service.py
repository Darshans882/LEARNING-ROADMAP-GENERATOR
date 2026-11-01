"""Student profile helpers."""
from __future__ import annotations

from datetime import date

from ..models import StudentProfile, User


def profile_completeness(profile: StudentProfile | None) -> int:
    if not profile:
        return 0
    checks = [
        bool(profile.country), bool(profile.preferred_language),
        bool(profile.college_name), bool(profile.degree), bool(profile.department),
        bool(profile.current_year), bool(profile.current_semester), bool(profile.academic_subjects),
        bool(profile.previous_qualifications),
        bool(profile.programming_languages), bool(profile.frameworks), bool(profile.tools),
        bool(profile.databases), bool(profile.technical_skills), bool(profile.soft_skills),
        bool(profile.career_role_id), bool(profile.interested_industries), bool(profile.preferred_positions),
        bool(profile.short_term_goal), bool(profile.long_term_goal),
        bool(profile.previous_projects or profile.internships or profile.certifications),
        bool(profile.portfolio_url),
        bool(profile.proficiency_level), bool(profile.budget_pref), bool(profile.course_language),
        bool(profile.learning_style), bool(profile.preferred_platforms),
        bool(profile.hours_per_day), bool(profile.days_per_week), bool(profile.target_completion_date),
    ]
    return int(round(sum(1 for c in checks if c) / len(checks) * 100))


def onboarding_errors(profile: StudentProfile, role_exists: bool) -> list[str]:
    errors = []
    if not profile.college_name:
        errors.append("College name is required")
    if not profile.degree:
        errors.append("Degree is required")
    if not profile.department:
        errors.append("Department is required")
    if not profile.current_year:
        errors.append("Current year is required")
    if not role_exists:
        errors.append("Select a valid career goal")
    if not profile.hours_per_day or not profile.days_per_week:
        errors.append("Weekly study availability is required")
    return errors


def profile_public_dict(profile: StudentProfile, user: User) -> dict:
    return {
        "id": profile.id,
        "full_name": user.full_name,
        "email": user.email,
        "age": profile.age,
        "country": profile.country,
        "preferred_language": profile.preferred_language,
        "college_name": profile.college_name,
        "degree": profile.degree,
        "department": profile.department,
        "current_year": profile.current_year,
        "current_semester": profile.current_semester,
        "cgpa": profile.cgpa,
        "academic_subjects": profile.academic_subjects or [],
        "previous_qualifications": profile.previous_qualifications,
        "programming_languages": profile.programming_languages or [],
        "frameworks": profile.frameworks or [],
        "tools": profile.tools or [],
        "databases": profile.databases or [],
        "technical_skills": profile.technical_skills or [],
        "soft_skills": profile.soft_skills or [],
        "desired_role": profile.desired_role,
        "career_role_id": profile.career_role_id,
        "career_title": profile.career_role.title if profile.career_role else profile.desired_role,
        "interested_industries": profile.interested_industries or [],
        "preferred_positions": profile.preferred_positions or [],
        "short_term_goal": profile.short_term_goal,
        "long_term_goal": profile.long_term_goal,
        "previous_projects": profile.previous_projects,
        "internships": profile.internships,
        "certifications": profile.certifications,
        "work_experience": profile.work_experience,
        "portfolio_url": profile.portfolio_url,
        "proficiency_level": profile.proficiency_level,
        "budget_pref": profile.budget_pref,
        "preferred_platforms": profile.preferred_platforms or [],
        "learning_style": profile.learning_style,
        "course_language": profile.course_language,
        "hours_per_day": profile.hours_per_day,
        "days_per_week": profile.days_per_week,
        "target_completion_date": profile.target_completion_date,
        "parallel_learning": profile.parallel_learning,
        "onboarding_completed": profile.onboarding_completed,
        "profile_completeness": profile_completeness(profile),
        "updated_at": profile.updated_at,
    }


def goals_are_past(profile: StudentProfile) -> bool:
    return bool(profile.target_completion_date and profile.target_completion_date < date.today())
