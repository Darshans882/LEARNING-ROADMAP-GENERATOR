"""FastAPI application entry point for SmartLearn AI."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .config import settings
from .database import SessionLocal, init_db
from .routes import admin, auth, careers, chatbot, courses, progress, projects, roadmap, students

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger("smartlearn")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Database ready: %s", "PostgreSQL" if settings.is_postgres else "SQLite")
    if settings.SEED_DEMO_DATA:
        from .seed import seed_database

        db = SessionLocal()
        try:
            counts = seed_database(db)
            logger.info("Seed complete: %s", counts)
        except Exception as exc:  # pragma: no cover - startup must not fail
            logger.exception("Seeding failed: %s", exc)
            db.rollback()
        finally:
            db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Personalized learning roadmap generator with skill-gap analysis, an honest "
        "course catalogue, progress tracking and a grounded AI assistant.\n\n"
        "Authenticate with `POST /api/auth/login` or the Swagger **Authorize** button "
        "(username = email, password = account password)."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    messages = []
    for error in exc.errors():
        location = ".".join(str(part) for part in error.get("loc", []) if part not in {"body", "query"})
        messages.append(f"{location}: {error.get('msg')}" if location else str(error.get("msg")))
    return JSONResponse(
        status_code=422,
        content={"detail": "; ".join(messages) or "Invalid request", "errors": exc.errors()},
    )


@app.get("/api/health", tags=["System"])
def health() -> dict:
    db_status = "ok"
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as exc:  # pragma: no cover
        db_status = f"error: {exc}"
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENV,
        "database": "postgresql" if settings.is_postgres else "sqlite",
        "db_status": db_status,
    }


@app.get("/api/ai/status", tags=["System"])
def ai_status() -> dict:
    from .ai.llm_engine import llm_engine

    status = llm_engine.status()
    status["rag_backend"] = "chroma" if (settings.USE_CHROMA and settings.llm_enabled) else "tfidf"
    status["course_url_validation"] = settings.COURSE_URL_VALIDATION
    status["mode"] = "llm-enhanced" if status["available"] else "deterministic curated engine"
    return status


@app.get("/api", tags=["System"])
def api_index() -> dict:
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/api/health",
        "routes": {
            "auth": "/api/auth",
            "students": "/api/students",
            "careers": "/api/careers",
            "courses": "/api/courses",
            "roadmap": "/api/roadmap",
            "progress": "/api/progress",
            "projects": "/api/projects",
            "chat": "/api/chat",
            "admin": "/api/admin",
        },
    }


for router in (
    auth.router,
    students.router,
    careers.router,
    courses.router,
    courses.skills_router,
    courses.resources_router,
    roadmap.router,
    progress.router,
    projects.router,
    chatbot.router,
    admin.router,
):
    app.include_router(router, prefix=settings.API_PREFIX)

# Serve the production frontend build from the same service when it exists.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


class SPAStaticFiles(StaticFiles):
    """Serve the Vite build and fall back to index.html for client-side routes."""

    async def get_response(self, path: str, scope):
        from starlette.exceptions import HTTPException as StarletteHTTPException

        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            # Never turn an unknown API route into a 200 HTML page.
            request_path = (scope or {}).get("path", "")
            is_api = path.startswith("api/") or request_path.startswith("/api/")
            if exc.status_code == 404 and not is_api:
                return await super().get_response("index.html", scope)
            raise


if FRONTEND_DIST.exists():
    app.mount("/", SPAStaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
else:

    @app.get("/", tags=["System"])
    def root() -> dict:
        return {
            "message": "SmartLearn AI API is running. See /docs for the API reference.",
            "frontend": "Start the Vite dev server in frontend/ (npm run dev)",
        }
