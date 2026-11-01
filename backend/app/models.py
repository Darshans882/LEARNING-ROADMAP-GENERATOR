"""SQLAlchemy ORM models for SmartLearn AI."""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="student", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    profile: Mapped["StudentProfile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    roadmaps: Mapped[list["Roadmap"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    course_progress: Mapped[list["CourseProgress"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    project_progress: Mapped[list["ProjectProgress"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    conversations: Mapped[list["ChatConversation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)

    # Personal
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(60), default="English")

    # Academic
    college_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    degree: Mapped[str | None] = mapped_column(String(120), nullable=True)
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    current_year: Mapped[str | None] = mapped_column(String(20), nullable=True)
    current_semester: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cgpa: Mapped[str | None] = mapped_column(String(20), nullable=True)
    academic_subjects: Mapped[list] = mapped_column(JSON, default=list)
    previous_qualifications: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Skills
    programming_languages: Mapped[list] = mapped_column(JSON, default=list)
    frameworks: Mapped[list] = mapped_column(JSON, default=list)
    tools: Mapped[list] = mapped_column(JSON, default=list)
    databases: Mapped[list] = mapped_column(JSON, default=list)
    technical_skills: Mapped[list] = mapped_column(JSON, default=list)
    soft_skills: Mapped[list] = mapped_column(JSON, default=list)

    # Career preferences
    desired_role: Mapped[str | None] = mapped_column(String(150), nullable=True)
    career_role_id: Mapped[str | None] = mapped_column(ForeignKey("career_roles.role_id"), nullable=True)
    interested_industries: Mapped[list] = mapped_column(JSON, default=list)
    preferred_positions: Mapped[list] = mapped_column(JSON, default=list)
    short_term_goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    long_term_goal: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Experience
    previous_projects: Mapped[str | None] = mapped_column(Text, nullable=True)
    internships: Mapped[str | None] = mapped_column(Text, nullable=True)
    certifications: Mapped[str | None] = mapped_column(Text, nullable=True)
    work_experience: Mapped[str | None] = mapped_column(Text, nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Learning preferences
    proficiency_level: Mapped[str] = mapped_column(String(30), default="Beginner")
    budget_pref: Mapped[str] = mapped_column(String(30), default="Both")
    preferred_platforms: Mapped[list] = mapped_column(JSON, default=list)
    learning_style: Mapped[str] = mapped_column(String(40), default="Practical")
    course_language: Mapped[str] = mapped_column(String(60), default="English")

    # Time
    hours_per_day: Mapped[float] = mapped_column(Float, default=2.0)
    days_per_week: Mapped[int] = mapped_column(Integer, default=5)
    target_completion_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    parallel_learning: Mapped[bool] = mapped_column(Boolean, default=False)

    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    profile_completeness: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="profile")
    career_role: Mapped["CareerRole | None"] = relationship()


class Skill(Base):
    __tablename__ = "skills"

    skill_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    skill_name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(80), index=True)
    level: Mapped[str] = mapped_column(String(30), default="foundational")
    description: Mapped[str] = mapped_column(Text, default="")
    aliases: Mapped[str] = mapped_column(Text, default="")


class SkillPrerequisite(Base):
    __tablename__ = "skill_prerequisites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.skill_id"), index=True)
    prerequisite_skill_id: Mapped[str] = mapped_column(ForeignKey("skills.skill_id"), index=True)
    strength: Mapped[str] = mapped_column(String(20), default="required")

    __table_args__ = (UniqueConstraint("skill_id", "prerequisite_skill_id", name="uq_skill_prereq"),)


class CareerRole(Base):
    __tablename__ = "career_roles"

    role_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    required_skills: Mapped[list] = mapped_column(JSON, default=list)
    core_skills: Mapped[list] = mapped_column(JSON, default=list)
    advanced_skills: Mapped[list] = mapped_column(JSON, default=list)
    phase_titles: Mapped[list] = mapped_column(JSON, default=list)
    phase_skills: Mapped[list] = mapped_column(JSON, default=list)
    onet_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    esco_uri: Mapped[str | None] = mapped_column(String(300), nullable=True)
    demand_outlook: Mapped[str | None] = mapped_column(Text, nullable=True)
    keywords: Mapped[str] = mapped_column(Text, default="")


class Course(Base):
    __tablename__ = "courses"

    course_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    skills: Mapped[list] = mapped_column(JSON, default=list)
    category: Mapped[str] = mapped_column(String(80), index=True)
    difficulty: Mapped[str] = mapped_column(String(30), default="intermediate")
    platform: Mapped[str] = mapped_column(String(100), index=True)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    link_type: Mapped[str] = mapped_column(String(30), default="direct")
    duration_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_is_estimate: Mapped[bool] = mapped_column(Boolean, default=True)
    price_type: Mapped[str] = mapped_column(String(30), default="Free")
    price_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_note: Mapped[str] = mapped_column(String(200), default="")
    language: Mapped[str] = mapped_column(String(60), default="English")
    prerequisites: Mapped[list] = mapped_column(JSON, default=list)
    certificate: Mapped[bool] = mapped_column(Boolean, default=False)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    rating_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_note: Mapped[str] = mapped_column(String(300), default="")
    learning_type: Mapped[str] = mapped_column(String(40), default="Video")
    last_checked: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Project(Base):
    __tablename__ = "projects"

    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    career_role: Mapped[str] = mapped_column(String(100), default="all", index=True)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    difficulty: Mapped[str] = mapped_column(String(30), default="intermediate")
    duration_hours: Mapped[float] = mapped_column(Float, default=20)
    project_type: Mapped[str] = mapped_column(String(20), default="major")
    deliverables: Mapped[str] = mapped_column(Text, default="")
    github_url: Mapped[str | None] = mapped_column(String(400), nullable=True)
    reference_url: Mapped[str | None] = mapped_column(String(400), nullable=True)


class LearningResource(Base):
    __tablename__ = "learning_resources"

    resource_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(60), default="Documentation")
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    platform: Mapped[str] = mapped_column(String(120), default="")
    price_type: Mapped[str] = mapped_column(String(30), default="Free")
    description: Mapped[str] = mapped_column(Text, default="")


class Roadmap(Base):
    __tablename__ = "roadmaps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    career_goal: Mapped[str] = mapped_column(String(150), nullable=False)
    career_role_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    current_level: Mapped[str] = mapped_column(String(30), default="Beginner")
    target_level: Mapped[str] = mapped_column(String(30), default="Job-ready")
    status: Mapped[str] = mapped_column(String(30), default="active")
    generated_by: Mapped[str] = mapped_column(String(40), default="curated-engine")
    summary: Mapped[str] = mapped_column(Text, default="")
    skill_gap: Mapped[dict] = mapped_column(JSON, default=dict)
    total_hours: Mapped[float] = mapped_column(Float, default=0)
    total_weeks: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_completion: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped[User] = relationship(back_populates="roadmaps")
    nodes: Mapped[list["RoadmapNode"]] = relationship(
        back_populates="roadmap", cascade="all, delete-orphan", order_by="RoadmapNode.order_index"
    )


class RoadmapNode(Base):
    __tablename__ = "roadmap_nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    roadmap_id: Mapped[int] = mapped_column(ForeignKey("roadmaps.id", ondelete="CASCADE"), index=True)
    node_key: Mapped[str] = mapped_column(String(150), nullable=False)
    node_type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    phase_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_hours: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    course_id: Mapped[str | None] = mapped_column(ForeignKey("courses.course_id"), nullable=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.project_id"), nullable=True)
    prerequisites: Mapped[list] = mapped_column(JSON, default=list)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    parent_key: Mapped[str | None] = mapped_column(String(150), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)

    __table_args__ = (UniqueConstraint("roadmap_id", "node_key", name="uq_roadmap_node_key"),)

    roadmap: Mapped[Roadmap] = relationship(back_populates="nodes")
    course: Mapped[Course | None] = relationship()
    project: Mapped[Project | None] = relationship()


class CourseProgress(Base):
    __tablename__ = "course_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.course_id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="in_progress")
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    hours_spent: Mapped[float] = mapped_column(Float, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "course_id", name="uq_user_course_progress"),)
    user: Mapped[User] = relationship(back_populates="course_progress")
    course: Mapped[Course] = relationship()


class ProjectProgress(Base):
    __tablename__ = "project_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.project_id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="in_progress")
    hours_spent: Mapped[float] = mapped_column(Float, default=0)
    repository_url: Mapped[str | None] = mapped_column(String(400), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "project_id", name="uq_user_project_progress"),)
    user: Mapped[User] = relationship(back_populates="project_progress")
    project: Mapped[Project] = relationship()


class NodeProgress(Base):
    """Manual progress for roadmap nodes that have no catalogue record.

    Most course/project nodes point at stored catalogue rows, but the roadmap
    generator can create a *custom* project for a phase when the catalogue has
    no matching project. Those nodes still need to be completable, so this
    table stores per-user, per-roadmap node status overrides.
    """

    __tablename__ = "node_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    roadmap_id: Mapped[int] = mapped_column(ForeignKey("roadmaps.id", ondelete="CASCADE"), index=True)
    node_key: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="in_progress")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "roadmap_id", "node_key", name="uq_user_roadmap_node_progress"),
    )


class AssessmentAttempt(Base):
    __tablename__ = "assessment_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    roadmap_id: Mapped[int] = mapped_column(ForeignKey("roadmaps.id", ondelete="CASCADE"), index=True)
    node_key: Mapped[str] = mapped_column(String(150))
    score: Mapped[float] = mapped_column(Float, default=0)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ChatConversation(Base):
    __tablename__ = "chat_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(150), default="New conversation")
    context_node_key: Mapped[str | None] = mapped_column(String(150), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="conversations")
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="ChatMessage.id"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("chat_conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(20), default="user")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    conversation: Mapped[ChatConversation] = relationship(back_populates="messages")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
