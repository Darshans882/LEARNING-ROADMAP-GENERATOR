"""Pydantic v2 request/response schemas."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _validate_url(value: str | None) -> str | None:
    if value in (None, ""):
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Must be a valid http(s) URL")
    return value


def _to_list(value: Any) -> list[str]:
    if value is None or value == "":
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    if isinstance(value, (list, tuple, set)):
        out: list[str] = []
        for item in value:
            if isinstance(item, str):
                out.extend([v.strip() for v in item.split(",") if v.strip()])
            elif item is not None:
                out.append(str(item))
        return out
    return [str(value)]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return " ".join(v.split())


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


class AccountUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime | None = None
    onboarding_completed: bool = False


# ---------------------------------------------------------------------------
# Student profile
# ---------------------------------------------------------------------------
class ProfileUpdate(BaseModel):
    age: int | None = Field(default=None, ge=13, le=100)
    country: str | None = Field(default=None, max_length=100)
    preferred_language: str | None = Field(default=None, max_length=60)

    college_name: str | None = Field(default=None, max_length=200)
    degree: str | None = Field(default=None, max_length=120)
    department: str | None = Field(default=None, max_length=120)
    current_year: str | None = Field(default=None, max_length=20)
    current_semester: str | None = Field(default=None, max_length=20)
    cgpa: str | None = Field(default=None, max_length=20)
    academic_subjects: list[str] | None = None
    previous_qualifications: str | None = None

    programming_languages: list[str] | None = None
    frameworks: list[str] | None = None
    tools: list[str] | None = None
    databases: list[str] | None = None
    technical_skills: list[str] | None = None
    soft_skills: list[str] | None = None

    desired_role: str | None = Field(default=None, max_length=150)
    career_role_id: str | None = Field(default=None, max_length=80)
    interested_industries: list[str] | None = None
    preferred_positions: list[str] | None = None
    short_term_goal: str | None = None
    long_term_goal: str | None = None

    previous_projects: str | None = None
    internships: str | None = None
    certifications: str | None = None
    work_experience: str | None = None
    portfolio_url: str | None = Field(default=None, max_length=300)

    proficiency_level: Literal["Beginner", "Intermediate", "Advanced"] | None = None
    budget_pref: Literal["Free", "Paid", "Both"] | None = None
    preferred_platforms: list[str] | None = None
    learning_style: Literal["Video", "Reading", "Practical", "Mixed"] | None = None
    course_language: str | None = Field(default=None, max_length=60)

    hours_per_day: float | None = Field(default=None, ge=0.5, le=16)
    days_per_week: int | None = Field(default=None, ge=1, le=7)
    target_completion_date: date | None = None
    parallel_learning: bool | None = None

    @field_validator(
        "academic_subjects", "programming_languages", "frameworks", "tools", "databases",
        "technical_skills", "soft_skills", "interested_industries", "preferred_positions",
        "preferred_platforms", mode="before",
    )
    @classmethod
    def list_fields(cls, v: Any) -> Any:
        return _to_list(v) if v is not None else None

    @field_validator("portfolio_url")
    @classmethod
    def check_portfolio(cls, v: str | None) -> str | None:
        return _validate_url(v)

    @field_validator("cgpa")
    @classmethod
    def check_cgpa(cls, v: str | None) -> str | None:
        if not v:
            return v
        normalized = v.strip().replace("%", "")
        try:
            num = float(normalized)
        except ValueError as exc:
            raise ValueError("CGPA/percentage must be numeric") from exc
        if num < 0 or num > 100:
            raise ValueError("CGPA/percentage must be between 0 and 100")
        return v.strip()

    @field_validator("target_completion_date")
    @classmethod
    def target_not_absurd(cls, v: date | None) -> date | None:
        if v and v.year < 2000:
            raise ValueError("Target completion date is not valid")
        return v

    @model_validator(mode="after")
    def check_time(self):
        if self.hours_per_day is not None and self.days_per_week is not None:
            if self.hours_per_day * self.days_per_week < 1:
                raise ValueError("Weekly study capacity must be at least 1 hour")
        return self


class StudentProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    age: int | None = None
    country: str | None = None
    preferred_language: str = "English"
    college_name: str | None = None
    degree: str | None = None
    department: str | None = None
    current_year: str | None = None
    current_semester: str | None = None
    cgpa: str | None = None
    academic_subjects: list[str] = []
    previous_qualifications: str | None = None
    programming_languages: list[str] = []
    frameworks: list[str] = []
    tools: list[str] = []
    databases: list[str] = []
    technical_skills: list[str] = []
    soft_skills: list[str] = []
    desired_role: str | None = None
    career_role_id: str | None = None
    career_title: str | None = None
    interested_industries: list[str] = []
    preferred_positions: list[str] = []
    short_term_goal: str | None = None
    long_term_goal: str | None = None
    previous_projects: str | None = None
    internships: str | None = None
    certifications: str | None = None
    work_experience: str | None = None
    portfolio_url: str | None = None
    proficiency_level: str = "Beginner"
    budget_pref: str = "Both"
    preferred_platforms: list[str] = []
    learning_style: str = "Practical"
    course_language: str = "English"
    hours_per_day: float = 2
    days_per_week: int = 5
    target_completion_date: date | None = None
    parallel_learning: bool = False
    onboarding_completed: bool = False
    profile_completeness: int = 0
    updated_at: datetime | None = None


class OnboardingPayload(ProfileUpdate):
    college_name: str = Field(min_length=1, max_length=200)
    degree: str = Field(min_length=1, max_length=120)
    department: str = Field(min_length=1, max_length=120)
    current_year: str = Field(min_length=1, max_length=20)
    career_role_id: str = Field(min_length=1, max_length=80)
    hours_per_day: float = Field(ge=0.5, le=16)
    days_per_week: int = Field(ge=1, le=7)


# ---------------------------------------------------------------------------
# Catalogue
# ---------------------------------------------------------------------------
class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    skill_id: str
    skill_name: str
    category: str
    level: str
    description: str = ""
    aliases: str = ""


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    course_id: str
    title: str
    description: str
    skills: list[str]
    category: str
    difficulty: str
    platform: str
    url: str
    link_type: str
    duration_hours: float | None = None
    duration_is_estimate: bool = True
    price_type: str
    price_usd: float | None = None
    price_note: str = ""
    language: str
    prerequisites: list[str]
    certificate: bool
    rating: float | None = None
    rating_count: int | None = None
    verified: bool
    verification_note: str = ""
    learning_type: str
    is_active: bool = True


class CourseRecommendationOut(BaseModel):
    course: CourseOut
    score: float
    matched_skills: list[str]
    reasons: list[str]
    warnings: list[str] = []
    prerequisite_met: bool = True


class CareerRoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    role_id: str
    title: str
    category: str
    description: str
    required_skills: list[str]
    core_skills: list[str]
    advanced_skills: list[str]
    phase_titles: list[str]
    phase_skills: list[list[str]]
    onet_code: str | None = None
    esco_uri: str | None = None
    demand_outlook: str | None = None
    keywords: str = ""


class CareerRecommendationOut(BaseModel):
    role: CareerRoleOut
    match_score: float
    matched_skills: list[str]
    missing_skills: list[str]
    reasons: list[str]


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    project_id: str
    title: str
    description: str
    career_role: str
    skills: list[str]
    difficulty: str
    duration_hours: float
    project_type: str
    deliverables: str
    github_url: str | None = None
    reference_url: str | None = None


class ResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    resource_id: str
    title: str
    resource_type: str
    url: str
    skills: list[str]
    platform: str
    price_type: str
    description: str


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------
class SkillMatchOut(BaseModel):
    skill_id: str
    skill_name: str
    category: str
    level: str
    evidence: str = ""


class SkillGapItemOut(BaseModel):
    skill_id: str
    skill_name: str
    category: str
    level: str
    missing_prerequisites: list[str] = []
    reason: str = ""


class CategoryScoreOut(BaseModel):
    category: str
    current: int
    required: int
    coverage: float


class SkillAnalysisOut(BaseModel):
    role_id: str
    role_title: str
    readiness: float
    current_level: str
    target_level: str
    matched_skills: list[SkillMatchOut]
    missing_skills: list[SkillGapItemOut]
    strengths: list[str]
    gaps_by_category: list[CategoryScoreOut]
    prerequisites: list[dict[str, Any]]
    summary: str
    total_required: int
    total_matched: int


# ---------------------------------------------------------------------------
# Roadmap
# ---------------------------------------------------------------------------
class RoadmapNodeOut(BaseModel):
    node_key: str
    node_type: str
    title: str
    description: str
    phase_number: int | None = None
    duration_hours: float = 0
    status: str
    prerequisites: list[str] = []
    skills: list[str] = []
    parent_key: str | None = None
    order_index: int = 0
    score: float | None = None
    meta: dict[str, Any] = {}
    course: CourseOut | None = None
    project: ProjectOut | None = None


class RoadmapEdgeOut(BaseModel):
    id: str
    source: str
    target: str
    animated: bool = False


class RoadmapOut(BaseModel):
    id: int
    career_goal: str
    career_role_id: str | None = None
    current_level: str
    target_level: str
    status: str
    generated_by: str
    summary: str
    total_hours: float
    total_weeks: int
    start_date: date | None = None
    expected_completion: date | None = None
    progress_percent: float = 0
    current_phase: int | None = None
    nodes: list[RoadmapNodeOut]
    edges: list[RoadmapEdgeOut] = []
    skill_gap: dict[str, Any] = {}
    feasibility: dict[str, Any] = {}

    @model_validator(mode="after")
    def compute_meta(self):
        return self


class GenerateRoadmapRequest(BaseModel):
    career_role_id: str | None = None
    force: bool = False
    use_llm: bool = True


class ProgressPercent(BaseModel):
    progress_percent: float
    current_phase: int | None = None
    completed_nodes: int
    total_nodes: int


# ---------------------------------------------------------------------------
# Progress / planner
# ---------------------------------------------------------------------------
class CourseProgressUpdate(BaseModel):
    course_id: str
    status: Literal["not_started", "in_progress", "completed"] = "completed"
    progress_percent: int | None = Field(default=None, ge=0, le=100)
    hours_spent: float | None = Field(default=None, ge=0, le=1000)
    notes: str | None = None


class ProjectProgressUpdate(BaseModel):
    project_id: str
    status: Literal["not_started", "in_progress", "completed"] = "completed"
    hours_spent: float | None = Field(default=None, ge=0, le=1000)
    repository_url: str | None = Field(default=None, max_length=400)
    notes: str | None = None

    @field_validator("repository_url")
    @classmethod
    def check_repo(cls, v: str | None) -> str | None:
        return _validate_url(v)


class AssessmentUpdate(BaseModel):
    node_key: str
    score: float = Field(ge=0, le=100)


class NodeProgressUpdate(BaseModel):
    node_key: str = Field(min_length=1, max_length=150)
    status: Literal["not_started", "in_progress", "completed"] = "completed"
    notes: str | None = Field(default=None, max_length=2000)


class MilestoneOut(BaseModel):
    title: str
    due: date | None = None
    status: str
    week: int | None = None
    type: str = "phase"


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: int | None = None
    node_key: str | None = None


class ChatSourceOut(BaseModel):
    title: str
    type: str
    url: str | None = None
    verified: bool | None = None


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    sources: list[dict[str, Any]] = []
    created_at: datetime


class ChatResponse(BaseModel):
    conversation_id: int
    message: str
    sources: list[ChatSourceOut] = []
    suggested_prompts: list[str] = []


class ConversationOut(BaseModel):
    id: int
    title: str
    context_node_key: str | None = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
class CourseCreate(BaseModel):
    course_id: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9][a-z0-9-_]*$")
    title: str = Field(min_length=2, max_length=250)
    description: str = ""
    skills: list[str] = []
    category: str = "General"
    difficulty: Literal["beginner", "intermediate", "advanced"] = "beginner"
    platform: str
    url: str
    link_type: Literal["direct", "catalogue", "search"] = "direct"
    duration_hours: float | None = Field(default=None, ge=0, le=5000)
    duration_is_estimate: bool = True
    price_type: Literal["Free", "Paid", "Freemium"] = "Free"
    price_usd: float | None = Field(default=None, ge=0, le=100000)
    price_note: str = ""
    language: str = "English"
    prerequisites: list[str] = []
    certificate: bool = False
    rating: float | None = Field(default=None, ge=0, le=5)
    rating_count: int | None = Field(default=None, ge=0)
    verified: bool = False
    verification_note: str = ""
    learning_type: str = "Video"

    @field_validator("url")
    @classmethod
    def valid_url(cls, v: str) -> str:
        return _validate_url(v)  # type: ignore[return-value]


class CourseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=250)
    description: str | None = None
    skills: list[str] | None = None
    category: str | None = None
    difficulty: Literal["beginner", "intermediate", "advanced"] | None = None
    platform: str | None = None
    url: str | None = None
    link_type: Literal["direct", "catalogue", "search"] | None = None
    duration_hours: float | None = Field(default=None, ge=0, le=5000)
    duration_is_estimate: bool | None = None
    price_type: Literal["Free", "Paid", "Freemium"] | None = None
    price_usd: float | None = Field(default=None, ge=0, le=100000)
    price_note: str | None = None
    language: str | None = None
    prerequisites: list[str] | None = None
    certificate: bool | None = None
    rating: float | None = Field(default=None, ge=0, le=5)
    rating_count: int | None = Field(default=None, ge=0)
    verified: bool | None = None
    verification_note: str | None = None
    learning_type: str | None = None
    is_active: bool | None = None

    @field_validator("url")
    @classmethod
    def valid_url(cls, v: str | None) -> str | None:
        return _validate_url(v)


class RoleCreate(BaseModel):
    role_id: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9][a-z0-9-_]*$")
    title: str = Field(min_length=2, max_length=150)
    category: str = "General"
    description: str = ""
    required_skills: list[str] = []
    core_skills: list[str] = []
    advanced_skills: list[str] = []
    phase_titles: list[str] = ["Foundations", "Core Skills", "Intermediate", "Advanced", "Projects", "Career"]
    phase_skills: list[list[str]] = []
    onet_code: str | None = None
    esco_uri: str | None = None
    demand_outlook: str | None = None
    keywords: str = ""


class SkillCreate(BaseModel):
    skill_id: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9][a-z0-9-_]*$")
    skill_name: str
    category: str
    level: Literal["foundational", "intermediate", "advanced"] = "foundational"
    description: str = ""
    aliases: str = ""


class ResourceCreate(BaseModel):
    resource_id: str
    title: str
    resource_type: str = "Documentation"
    url: str
    skills: list[str] = []
    platform: str = ""
    price_type: str = "Free"
    description: str = ""

    @field_validator("url")
    @classmethod
    def valid_url(cls, v: str) -> str:
        return _validate_url(v)  # type: ignore[return-value]


class AdminStatsOut(BaseModel):
    total_students: int
    total_courses: int
    active_courses: int
    total_roadmaps: int
    total_projects: int
    completed_courses: int
    chat_messages: int
    verified_courses: int


TokenOut.model_rebuild()
