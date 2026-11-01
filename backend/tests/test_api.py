"""End-to-end API tests against an isolated SQLite database."""
from __future__ import annotations

import os
import tempfile
import uuid
from pathlib import Path

TEST_DB = Path(tempfile.gettempdir()) / f"smartlearn_test_{os.getpid()}.db"
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["SEED_DEMO_DATA"] = "true"
os.environ["USE_CHROMA"] = "false"
os.environ["LLM_PROVIDER"] = "none"
os.environ["OPENAI_API_KEY"] = ""
os.environ["COURSE_URL_VALIDATION"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client
    if TEST_DB.exists():
        try:
            TEST_DB.unlink()
        except OSError:
            pass


def auth_headers(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture(scope="session")
def student(client: TestClient) -> dict[str, str]:
    return auth_headers(client, "demo@smartlearn.ai", "Demo@1234")


@pytest.fixture(scope="session")
def admin(client: TestClient) -> dict[str, str]:
    return auth_headers(client, "admin@smartlearn.ai", "Admin@1234")


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["db_status"] == "ok"


def test_spa_deep_link_fallback(client: TestClient) -> None:
    dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    response = client.get("/roadmap")
    if dist.exists():
        assert response.status_code == 200, response.text
        assert 'id="root"' in response.text

    # Unknown API routes must return JSON 404, never the SPA shell.
    missing = client.get("/api/this-route-does-not-exist")
    assert missing.status_code == 404
    assert missing.headers["content-type"].startswith("application/json")


def test_ai_status(client: TestClient) -> None:
    response = client.get("/api/ai/status")
    assert response.status_code == 200
    body = response.json()
    assert body["rag_backend"] in {"tfidf", "chroma"}
    assert body["mode"]


def test_login_rejects_bad_password(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"email": "demo@smartlearn.ai", "password": "wrong"})
    assert response.status_code == 401


def test_profile_and_dashboard(client: TestClient, student: dict[str, str]) -> None:
    me = client.get("/api/auth/me", headers=student)
    assert me.status_code == 200, me.text
    assert me.json()["onboarding_completed"] is True

    profile = client.get("/api/students/profile", headers=student)
    assert profile.status_code == 200, profile.text
    assert profile.json()["career_role_id"] == "data-scientist"
    assert profile.json()["full_name"]

    dashboard = client.get("/api/students/dashboard", headers=student)
    assert dashboard.status_code == 200, dashboard.text
    body = dashboard.json()
    assert body["has_roadmap"] is True
    assert body["total_courses"] > 0
    assert "charts" in body and "skill_radar" in body["charts"]


def test_catalogue_and_recommendations(client: TestClient, student: dict[str, str]) -> None:
    courses = client.get("/api/courses?limit=10", headers=student)
    assert courses.status_code == 200
    assert courses.json()["total"] > 50

    verified = client.get("/api/courses?verified_only=true", headers=student)
    assert verified.status_code == 200
    for course in verified.json()["items"]:
        assert course["verified"] is True
        assert course["link_type"] == "direct"

    recs = client.get("/api/courses/recommendations?limit=5", headers=student)
    assert recs.status_code == 200, recs.text
    assert len(recs.json()) <= 5
    for rec in recs.json():
        assert rec["course"]["url"].startswith("http")
        assert "warnings" in rec


def test_careers_and_analysis(client: TestClient, student: dict[str, str]) -> None:
    careers = client.get("/api/careers", headers=student)
    assert careers.status_code == 200
    assert len(careers.json()) >= 15

    matches = client.get("/api/students/career-matches?limit=5", headers=student)
    assert matches.status_code == 200, matches.text
    assert 0 < len(matches.json()) <= 5

    analysis = client.get("/api/students/analysis", headers=student)
    assert analysis.status_code == 200, analysis.text
    body = analysis.json()
    assert 0 <= body["readiness"] <= 100
    assert body["total_required"] >= body["total_matched"]
    assert body["gaps_by_category"]


def test_roadmap_graph_and_export(client: TestClient, student: dict[str, str]) -> None:
    response = client.get("/api/roadmap", headers=student)
    assert response.status_code == 200, response.text
    roadmap = response.json()["roadmap"]
    assert roadmap["nodes"]
    assert roadmap["edges"]
    types = {node["node_type"] for node in roadmap["nodes"]}
    assert {"phase", "course", "project", "assessment"} <= types
    for edge in roadmap["edges"]:
        keys = {node["node_key"] for node in roadmap["nodes"]}
        assert edge["source"] in keys and edge["target"] in keys

    # Node action routing depends on top-level catalogue ids being serialized.
    for node in roadmap["nodes"]:
        if node["node_type"] == "course":
            assert node["course_id"] == node["course"]["course_id"]
        if node["node_type"] == "project":
            if node["project"]:
                assert node["project_id"] == node["project"]["project_id"]
            else:
                assert node["project_id"] is None

    exported = client.get(f"/api/roadmap/{roadmap['id']}/export", headers=student)
    assert exported.status_code == 200
    assert "SmartLearn AI Roadmap" in exported.text


def test_progress_update_recalculates(client: TestClient, student: dict[str, str]) -> None:
    roadmap = client.get("/api/roadmap", headers=student).json()["roadmap"]
    target = next(
        (n for n in roadmap["nodes"] if n["node_type"] == "course" and n["status"] in {"pending", "current"}),
        None,
    )
    assert target is not None
    response = client.post(
        "/api/progress/course",
        headers=student,
        json={"course_id": target["course"]["course_id"], "status": "completed", "progress_percent": 100},
    )
    assert response.status_code == 200, response.text
    assert response.json()["roadmap"]["progress_percent"] >= roadmap["progress_percent"]

    refreshed = client.get("/api/roadmap", headers=student).json()["roadmap"]
    node = next(n for n in refreshed["nodes"] if n["node_key"] == target["node_key"])
    assert node["status"] == "completed"

    reset = client.delete(f"/api/progress/course/{target['course']['course_id']}", headers=student)
    assert reset.status_code == 200


def test_generated_project_node_progress(client: TestClient, student: dict[str, str]) -> None:
    roadmap = client.get("/api/roadmap", headers=student).json()["roadmap"]
    generated = next(
        (
            n for n in roadmap["nodes"]
            if n["node_type"] == "project"
            and n["project_id"] is None
            and (n.get("meta") or {}).get("generated")
        ),
        None,
    )
    assert generated is not None, "demo roadmap should include a generated project node"

    completed = client.post(
        "/api/progress/node",
        headers=student,
        json={"node_key": generated["node_key"], "status": "completed"},
    )
    assert completed.status_code == 200, completed.text
    refreshed = client.get("/api/roadmap", headers=student).json()["roadmap"]
    node = next(n for n in refreshed["nodes"] if n["node_key"] == generated["node_key"])
    assert node["status"] == "completed"

    reset = client.delete(f"/api/progress/node/{generated['node_key']}", headers=student)
    assert reset.status_code == 200, reset.text


def test_assessment_requires_dependencies_then_passes(client: TestClient) -> None:
    email = f"assessment-{uuid.uuid4().hex[:10]}@example.com"
    register = client.post(
        "/api/auth/register",
        json={"full_name": "Assessment Learner", "email": email, "password": "TestPass123"},
    )
    assert register.status_code == 201, register.text
    headers = {"Authorization": f"Bearer {register.json()['access_token']}"}
    onboarding = client.post(
        "/api/students/onboarding",
        headers=headers,
        json={
            "college_name": "Assessment Institute",
            "degree": "B.Tech",
            "department": "Computer Science",
            "current_year": "2",
            "career_role_id": "data-scientist",
            "proficiency_level": "Beginner",
            "hours_per_day": 3,
            "days_per_week": 5,
        },
    )
    assert onboarding.status_code == 200, onboarding.text
    roadmap = onboarding.json()["roadmap"]
    by_key = {n["node_key"]: n for n in roadmap["nodes"]}
    assessment = by_key["assessment-1"]
    deps = (assessment.get("meta") or {}).get("dependency_keys") or []

    blocked = client.post(
        "/api/progress/assessment",
        headers=headers,
        json={"node_key": "assessment-1", "score": 85},
    )
    assert blocked.status_code == 400, blocked.text
    assert "Complete" in blocked.json()["detail"]

    # Finish the dependency chain: course -> project (-> any other dependency).
    for dep_key in deps:
        dep = by_key[dep_key]
        if dep["node_type"] == "course":
            response = client.post(
                "/api/progress/course",
                headers=headers,
                json={"course_id": dep["course_id"], "status": "completed"},
            )
        elif dep["project_id"]:
            response = client.post(
                "/api/progress/project",
                headers=headers,
                json={"project_id": dep["project_id"], "status": "completed"},
            )
        else:
            response = client.post(
                "/api/progress/node",
                headers=headers,
                json={"node_key": dep_key, "status": "completed"},
            )
        assert response.status_code == 200, response.text

    passed = client.post(
        "/api/progress/assessment",
        headers=headers,
        json={"node_key": "assessment-1", "score": 85},
    )
    assert passed.status_code == 200, passed.text
    assert passed.json()["passed"] is True

    refreshed = client.get("/api/roadmap", headers=headers).json()["roadmap"]
    node = next(n for n in refreshed["nodes"] if n["node_key"] == "assessment-1")
    assert node["status"] == "completed"
    assert node["score"] == 85


def test_planner_and_milestones(client: TestClient, student: dict[str, str]) -> None:
    planner = client.get("/api/progress/planner", headers=student)
    assert planner.status_code == 200, planner.text
    body = planner.json()
    assert body["weeks"]
    assert body["current_week"] >= 1

    milestones = client.get("/api/progress/milestones", headers=student)
    assert milestones.status_code == 200
    assert len(milestones.json()) >= 2


def test_chat_grounding(client: TestClient, student: dict[str, str]) -> None:
    response = client.post(
        "/api/chat", headers=student, json={"message": "What should I study next?"}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["conversation_id"] > 0
    assert len(body["message"]) > 20
    for source in body["sources"]:
        assert source["url"].startswith("http")

    convo = client.get(f"/api/chat/conversations/{body['conversation_id']}", headers=student)
    assert convo.status_code == 200
    assert len(convo.json()["messages"]) >= 2


def test_onboarding_new_student(client: TestClient) -> None:
    email = f"test-{uuid.uuid4().hex[:10]}@example.com"
    register = client.post(
        "/api/auth/register",
        json={"full_name": "Test Learner", "email": email, "password": "TestPass123"},
    )
    assert register.status_code == 201, register.text
    headers = {"Authorization": f"Bearer {register.json()['access_token']}"}

    onboarding = client.post(
        "/api/students/onboarding",
        headers=headers,
        json={
            "college_name": "Test Institute",
            "degree": "B.Tech",
            "department": "Computer Science",
            "current_year": "2",
            "career_role_id": "full-stack-developer",
            "hours_per_day": 2,
            "days_per_week": 5,
            "programming_languages": ["Python", "JavaScript"],
            "technical_skills": ["HTML/CSS"],
            "target_completion_date": "2027-12-31",
            "proficiency_level": "Beginner",
            "budget_pref": "Free",
            "learning_style": "Practical",
        },
    )
    assert onboarding.status_code == 200, onboarding.text
    body = onboarding.json()
    assert body["profile"]["onboarding_completed"] is True
    assert body["roadmap"] and body["roadmap"]["nodes"]

    dashboard = client.get("/api/students/dashboard", headers=headers)
    assert dashboard.status_code == 200
    assert dashboard.json()["has_roadmap"] is True


def test_admin_stats_and_catalog(client: TestClient, admin: dict[str, str]) -> None:
    stats = client.get("/api/admin/stats", headers=admin)
    assert stats.status_code == 200, stats.text
    body = stats.json()
    assert body["total_students"] >= 2
    assert body["total_courses"] > 50
    assert body["verified_courses"] > 0

    students = client.get("/api/admin/students?limit=10", headers=admin)
    assert students.status_code == 200
    assert students.json()["total"] >= 2

    usage = client.get("/api/admin/usage", headers=admin)
    assert usage.status_code == 200
    assert len(usage.json()["activity_by_day"]) == 14


def test_admin_course_crud(client: TestClient, admin: dict[str, str]) -> None:
    course_id = f"test-course-{uuid.uuid4().hex[:8]}"
    created = client.post(
        "/api/admin/courses",
        headers=admin,
        json={
            "course_id": course_id,
            "title": "Test Course for API",
            "description": "Created by an automated test.",
            "skills": ["python-programming"],
            "category": "Programming",
            "difficulty": "beginner",
            "platform": "SmartLearn",
            "url": "https://example.com/test-course",
            "link_type": "catalogue",
            "verified": False,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["verified"] is False

    patched = client.patch(
        f"/api/admin/courses/{course_id}", headers=admin, json={"title": "Updated Test Course"}
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "Updated Test Course"

    validated = client.post(f"/api/admin/courses/{course_id}/validate?network=false", headers=admin)
    assert validated.status_code == 200
    assert validated.json()["status"] == "static-only"

    deleted = client.delete(f"/api/admin/courses/{course_id}", headers=admin)
    assert deleted.status_code == 200


def test_admin_routes_forbidden_for_students(client: TestClient, student: dict[str, str]) -> None:
    assert client.get("/api/admin/stats", headers=student).status_code == 403


def test_career_change_regenerates_roadmap(client: TestClient) -> None:
    email = f"switch-{uuid.uuid4().hex[:10]}@example.com"
    register = client.post(
        "/api/auth/register",
        json={"full_name": "Switch Learner", "email": email, "password": "TestPass123"},
    )
    headers = {"Authorization": f"Bearer {register.json()['access_token']}"}
    onboarding = client.post(
        "/api/students/onboarding",
        headers=headers,
        json={
            "college_name": "Switch Institute",
            "degree": "B.Des",
            "department": "Design",
            "current_year": "3",
            "career_role_id": "ui-ux-designer",
            "hours_per_day": 2,
            "days_per_week": 4,
        },
    )
    assert onboarding.status_code == 200, onboarding.text
    first_goal = onboarding.json()["roadmap"]["career_goal"]

    updated = client.put(
        "/api/students/profile",
        headers=headers,
        json={"career_role_id": "data-analyst"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["career_role_id"] == "data-analyst"

    roadmap = client.get("/api/roadmap", headers=headers).json()["roadmap"]
    assert roadmap["career_goal"] != first_goal
    assert roadmap["career_role_id"] == "data-analyst"
