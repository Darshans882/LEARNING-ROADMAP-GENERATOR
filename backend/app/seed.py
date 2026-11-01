"""Idempotent database seeding: catalogue, demo accounts and a demo roadmap."""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from .models import (
    ActivityLog,
    CourseProgress,
    StudentProfile,
    User,
    utcnow,
)
from .security import hash_password
from .services.dataset_loader import load_catalogue
from .services.profile_service import profile_completeness

logger = logging.getLogger("smartlearn.seed")
DATASETS = Path(__file__).resolve().parent / "datasets"

DEMO_PASSWORD = "Demo@1234"
ADMIN_PASSWORD = "Admin@1234"
SECOND_PASSWORD = "Student@123"


def _as_list(value) -> list[str]:
    if not value or (isinstance(value, float) and pd.isna(value)):
        return []
    return [v.strip() for v in str(value).split(",") if v.strip()]


def _ensure_user(db: Session, email: str, password: str, name: str, role: str = "student") -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user
    user = User(
        email=email, password_hash=hash_password(password),
        full_name=name, role=role, is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _demo_profile(db: Session, user: User) -> StudentProfile:
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    if profile:
        return profile
    try:
        df = pd.read_csv(DATASETS / "student_profiles.csv", dtype=str, keep_default_na=False)
        row = df.iloc[0].to_dict()
    except Exception:
        row = {}
    profile = StudentProfile(
        user_id=user.id,
        age=21, country="India", preferred_language="English",
        college_name="National Institute of Technology", degree="B.Tech",
        department="Computer Science", current_year="3", current_semester="5", cgpa="8.4",
        academic_subjects=_as_list(row.get("academic_subjects", "Data Structures, DBMS, Statistics")),
        previous_qualifications="Higher Secondary (Science, 92%)",
        programming_languages=_as_list(row.get("programming_languages", "Python, JavaScript, SQL")),
        frameworks=_as_list(row.get("frameworks", "React")),
        tools=_as_list(row.get("tools", "Git, VS Code, Jupyter")),
        databases=_as_list(row.get("databases", "PostgreSQL, SQLite")),
        technical_skills=_as_list(row.get("technical_skills", "HTML/CSS, Pandas, NumPy")),
        soft_skills=_as_list(row.get("soft_skills", "Communication, Teamwork")),
        desired_role="Data Scientist", career_role_id="data-scientist",
        interested_industries=_as_list("Technology, Fintech, Healthcare"),
        preferred_positions=_as_list("Data Scientist, ML Analyst"),
        short_term_goal="Land a data science internship within 8 months",
        long_term_goal="Lead an applied ML team",
        previous_projects="Exploratory analysis of IPL data; personal portfolio site",
        internships="None", certifications="freeCodeCamp Responsive Web Design",
        work_experience="None", portfolio_url="https://github.com/example",
        proficiency_level="Intermediate", budget_pref="Both",
        preferred_platforms=_as_list("Coursera, Kaggle, freeCodeCamp"),
        learning_style="Practical", course_language="English",
        hours_per_day=3, days_per_week=5, target_completion_date=date(2027, 6, 30),
        parallel_learning=False, onboarding_completed=True,
    )
    profile.profile_completeness = profile_completeness(profile)
    db.add(profile)
    db.flush()
    return profile


def _second_profile(db: Session, user: User) -> StudentProfile:
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    if profile:
        return profile
    profile = StudentProfile(
        user_id=user.id, age=20, country="India", preferred_language="English",
        college_name="Symbiosis Institute of Design", degree="B.Des",
        department="Communication Design", current_year="2", current_semester="4", cgpa="8.9",
        academic_subjects=_as_list("Design Studio, Typography, Research Methods"),
        previous_qualifications="Higher Secondary (Arts)",
        programming_languages=[], frameworks=[], tools=_as_list("Figma, Canva, Notion"),
        databases=[], technical_skills=_as_list("Wireframing, UI Design"),
        soft_skills=_as_list("Communication, Presentation, Teamwork"),
        desired_role="UI/UX Designer", career_role_id="ui-ux-designer",
        interested_industries=_as_list("Design, EdTech, Consumer Apps"),
        preferred_positions=_as_list("Product Design Intern, UX Researcher"),
        short_term_goal="Build three portfolio case studies and land a design internship",
        long_term_goal="Become a senior product designer",
        previous_projects="Redesigned the college library website",
        internships="None", certifications="Google UX Design (in progress)",
        work_experience="Freelance poster design",
        portfolio_url="https://www.behance.net/example",
        proficiency_level="Beginner", budget_pref="Free",
        preferred_platforms=_as_list("Coursera, Figma, YouTube"),
        learning_style="Practical", course_language="English",
        hours_per_day=2, days_per_week=4, target_completion_date=date(2027, 3, 31),
        parallel_learning=False, onboarding_completed=True,
    )
    profile.profile_completeness = profile_completeness(profile)
    db.add(profile)
    db.flush()
    return profile


def _seed_progress(db: Session, user: User, profile: StudentProfile) -> None:
    """Give the demo account a realistic starting point."""
    existing = db.query(CourseProgress).filter(CourseProgress.user_id == user.id).count()
    if existing:
        return
    now = datetime.now(timezone.utc)
    for cid, status, percent in [
        ("kaggle-python", "completed", 100),
        ("fcc-scientific-python", "completed", 100),
        ("kaggle-pandas", "in_progress", 45),
    ]:
        db.add(CourseProgress(
            user_id=user.id, course_id=cid, status=status, progress_percent=percent,
            hours_spent=12 if status == "completed" else 3,
            started_at=now, completed_at=now if status == "completed" else None,
        ))
    db.flush()


def seed_database(db: Session) -> dict:
    counts = load_catalogue(db)

    admin = _ensure_user(db, "admin@smartlearn.ai", ADMIN_PASSWORD, "Platform Admin", role="admin")
    demo = _ensure_user(db, "demo@smartlearn.ai", DEMO_PASSWORD, "Aarav Sharma")
    second = _ensure_user(db, "priya@smartlearn.ai", SECOND_PASSWORD, "Priya Nair")

    demo_profile = _demo_profile(db, demo)
    second_profile = _second_profile(db, second)
    db.commit()

    # Generate roadmaps lazily but eagerly for the demo accounts so reviewers
    # immediately see a populated dashboard.
    try:
        from .ai.roadmap_generator import generate_roadmap
        from .services.progress_service import get_active_roadmap, recalculate_roadmap

        if not get_active_roadmap(db, demo.id):
            _seed_progress(db, demo, demo_profile)
            db.commit()
            roadmap = generate_roadmap(db, demo, demo_profile, force=True, use_llm=False)
            recalculate_roadmap(db, roadmap, demo_profile)
            db.add(ActivityLog(user_id=demo.id, action="roadmap_generated", detail=roadmap.career_goal))
            db.commit()
        if not get_active_roadmap(db, second.id):
            roadmap2 = generate_roadmap(db, second, second_profile, force=True, use_llm=False)
            recalculate_roadmap(db, roadmap2, second_profile)
            db.commit()
    except Exception as exc:  # pragma: no cover - seed must never prevent startup
        logger.exception("Demo roadmap generation failed: %s", exc)
        db.rollback()

    return {
        **counts,
        "users": db.query(User).count(),
        "demo_email": demo.email,
        "admin_email": admin.email,
    }
