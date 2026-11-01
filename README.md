# SmartLearn AI — Personalized Learning Roadmap Generator

SmartLearn AI builds an honest, personalized learning roadmap for a student's target career. It combines a curated
course/skill/project catalogue, a deterministic recommendation and scheduling engine, optional LLM enhancement, and a
grounded RAG assistant. Everything works offline out of the box — an LLM key only enriches explanations; it never
invents course metadata, URLs, prices, ratings or progress.

## Table of contents

- [Feature highlights](#feature-highlights)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [Configuration](#configuration)
- [PostgreSQL setup](#postgresql-setup)
- [LLM and RAG setup](#llm-and-rag-setup)
- [API overview](#api-overview)
- [Tests](#tests)
- [Production deployment](#production-deployment)
- [Data honesty policy](#data-honesty-policy)
- [Troubleshooting](#troubleshooting)

## Feature highlights

- **Multi-step onboarding** covering personal details, academics, technical skills, soft skills, career preferences,
  experience, learning preferences, budget, language and weekly availability.
- **Skill-gap analysis** with current vs required skills, category coverage, prerequisites, evidence and readiness score.
- **Personalized roadmap** with phases, courses, assignments, revision time, mini/major projects, assessments, weekly
  schedule, monthly milestones and an expected completion date.
- **Interactive React Flow roadmap** — Dagre left-to-right auto-layout, branches/merges, custom node types, zoom, drag,
  minimap, fit view, fullscreen, status colors, locked/completed nodes and a node detail side panel.
- **Duration and feasibility calculator** that accounts for course hours, assignments, revision and projects, plus the
  student's daily/weekly availability. Sequential by default; parallel learning only when the student opts in.
- **Recommendation engine** ranked by skill match, prerequisites, budget, language, learning style, platform preference
  and difficulty. Unverifiable catalogue/search links are clearly labelled as unverified.
- **Progress tracking** for courses, catalogue projects, generated roadmap projects and assessment nodes, with
  automatic unlocking of dependent nodes and roadmap status recalculation.
- **Dashboard and analytics** (Recharts): weekly study hours, skill radar, status pie, phase progress, monthly progress,
  upcoming milestones, recent activity and feasibility warnings.
- **Global AI assistant** on every authenticated page (floating bottom-right) plus a full Assistant page with
  conversation history. Context-aware of the profile, roadmap, selected node and catalogue; it cannot invent links or
  progress.
- **Admin console** for platform metrics, usage charts, learners, roles, courses, skills, resources, roadmaps and an
  audit log. Course URL validation and catalogue reload are built in.
- **JWT auth** with student/admin roles, bcrypt password hashing, account export and password changes.
- **Swagger / OpenAPI docs** at `/docs`.

## Architecture

```
React 18 + Vite + Tailwind CSS + Recharts + @xyflow/react (Dagre)
        │  axios  /api
        ▼
FastAPI + Pydantic v2 + SQLAlchemy 2.0
        │
        ├── deterministic engines
        │     ├── skill analyzer (gaps, prerequisites, readiness)
        │     ├── recommendation engine (scoring + reasons + warnings)
        │     ├── duration/feasibility calculator
        │     ├── roadmap generator (phases, graph nodes, edges, schedule)
        │     └── grounded chatbot (profile/roadmap/catalogue context)
        │
        ├── optional LLM layer (OpenAI-compatible, Ollama or LangChain)
        ├── optional RAG (ChromaDB embeddings, TF-IDF fallback)
        └── PostgreSQL (production) or SQLite (default, zero config)
```

The course catalogue, skills, career roles, projects and resources are seeded from CSV datasets under
`backend/app/datasets/`. Trained recommendation artifacts are stored separately under `backend/model_artifacts/`.
The application auto-creates tables and seeds demo accounts on startup.

## Project structure

```
SmartLearn-AI/
├── backend/
│   ├── app/
│   │   ├── ai/                     # roadmap generator, skill analyzer, recommender, RAG, LLM, chatbot
│   │   ├── datasets/               # courses, skills, careers, projects, resources, profiles
│   │   ├── routes/                 # auth, students, careers, courses, roadmap, progress, projects, chatbot, admin
│   │   ├── services/               # dataset loader, profile, duration calculator, validation, progress
│   │   ├── config.py               # environment configuration
│   │   ├── database.py             # SQLAlchemy engine/session/Base
│   │   ├── deps.py                 # auth dependencies, role guards
│   │   ├── main.py                 # FastAPI app, CORS, error handling, static frontend
│   │   ├── models.py               # 17 SQLAlchemy models
│   │   ├── schemas.py              # Pydantic v2 request/response contracts
│   │   ├── security.py             # bcrypt + JWT
│   │   └── seed.py                 # idempotent catalogue/demo seeding
│   ├── tests/test_api.py           # end-to-end API tests
│   ├── model_artifacts/            # exported trained recommendation indexes
│   ├── tools/train_recommender.py  # train and export the TF-IDF course index
│   ├── requirements.txt            # core dependencies
│   ├── requirements-ai.txt         # optional LLM + Chroma extras
│   ├── schema.sql                  # PostgreSQL reference schema
│   ├── pytest.ini
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/client.js           # axios client, auth header, errors, formatting
│   │   ├── components/             # UI kit, roadmap nodes/layout, chat panel, chatbot, guards
│   │   ├── context/                # auth + assistant context
│   │   ├── layouts/MainLayout.jsx  # sidebar, header, global chatbot
│   │   └── pages/                  # 17 pages (landing → admin)
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── .env.example
└── README.md
```

## Quick start

Requirements: **Python 3.11+** (3.14 tested for the core app), **Node.js 18+** and npm.

### One-command Windows start

From the project folder, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

The script prepares missing dependencies and configuration, starts both services in separate PowerShell windows,
and opens <http://localhost:5173>. Keep those windows open while using the app.

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

On macOS/Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

The first start creates `backend/smartlearn.db` (SQLite), loads the catalogue and seeds demo accounts and demo
roadmaps. API docs: <http://localhost:8000/docs>. Health check: <http://localhost:8000/api/health>.

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to `http://localhost:8000`.

### 3. Production-style single service (optional)

```powershell
cd frontend
npm run build
cd ..\backend
python -m uvicorn app.main:app --port 8000
```

`backend/app/main.py` serves `frontend/dist` at `/` when the build exists. Visit <http://localhost:8000>.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Student (Data Science, populated roadmap) | `demo@smartlearn.ai` | `Demo@1234` |
| Student (UI/UX Design) | `priya@smartlearn.ai` | `Student@123` |
| Administrator | `admin@smartlearn.ai` | `Admin@1234` |

> Change the `JWT_SECRET` and demo passwords before any public deployment. Set `SEED_DEMO_DATA=false` to skip seeding.

## Configuration

Copy `backend/.env.example` to `backend/.env`. Key variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ENV` | `development` | Environment label shown in health output |
| `DATABASE_URL` | SQLite file | SQLAlchemy URL; PostgreSQL supported |
| `JWT_SECRET` | dev secret | **Must change in production** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `720` | JWT lifetime |
| `CORS_ORIGINS` | localhost origins | Allowed frontend origins (comma-separated) |
| `LLM_PROVIDER` | `openai` | `openai`, `compatible`, `ollama`, `langchain`, `none` |
| `OPENAI_API_KEY` / `LLM_API_KEY` | empty | Enables LLM mode when present |
| `LLM_BASE_URL` | OpenAI | OpenAI-compatible endpoint or Ollama URL |
| `LLM_MODEL` | `gpt-4o-mini` | Chat model name |
| `USE_CHROMA` | `false` | Enable ChromaDB vector retrieval |
| `COURSE_URL_VALIDATION` | `true` | Allow live URL checks |
| `SEED_DEMO_DATA` | `true` | Seed catalogue + demo accounts at startup |

Frontend (`frontend/.env`): set `VITE_API_URL` only when the API is on a different origin. Leave it empty to use the
Vite proxy in development and same-origin `/api` in production.

## PostgreSQL setup

```sql
CREATE USER smartlearn WITH PASSWORD 'smartlearn';
CREATE DATABASE smartlearn OWNER smartlearn;
```

```ini
# backend/.env
DATABASE_URL=postgresql+psycopg://smartlearn:smartlearn@localhost:5432/smartlearn
```

Install the driver (uncomment it in `requirements.txt` or install directly):

```bash
pip install "psycopg[binary]>=3.1,<4.0"
```

Then start the backend. Tables are created automatically and seeded. `backend/schema.sql` contains the full reference
schema if you prefer to provision manually:

```bash
psql -U smartlearn -d smartlearn -f schema.sql
```

All JSON columns are portable between SQLite and PostgreSQL.

## LLM and RAG setup

The app is fully functional without an API key. To enable richer narrative explanations:

```bash
pip install -r requirements-ai.txt
```

```ini
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

For a local Ollama model:

```ini
LLM_PROVIDER=ollama
LLM_API_KEY=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.1
```

For OpenAI-compatible endpoints (vLLM, LM Studio, Azure gateways):

```ini
LLM_PROVIDER=compatible
LLM_API_KEY=...
LLM_BASE_URL=https://your-gateway/v1
LLM_MODEL=your-model
```

For LangChain provider wiring, set `LLM_PROVIDER=langchain`. For ChromaDB retrieval, set `USE_CHROMA=true` and provide
an embedding-capable key. If Chroma or LangChain are unavailable, the app automatically falls back to TF-IDF retrieval
and deterministic generation.

**Guardrail:** LLM output is limited to prose (summaries, explanations). Course titles, URLs, prices, ratings, hours,
prerequisites, phases, graph edges and progress are always built from stored data and deterministic engines.

## API overview

All routes are under `/api`; interactive docs at `/docs`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/token`, `GET/PATCH /auth/me`, `POST /auth/change-password`, `GET /auth/me/export` |
| Profile & onboarding | `GET /students/options`, `GET/PUT /students/profile`, `POST /students/onboarding` |
| Student insights | `GET /students/dashboard`, `/students/analysis`, `/students/career-matches`, `/students/planner`, `/students/milestones`, `/students/activity`, `/students/roadmap-summary` |
| Careers | `GET /careers`, `GET /careers/{role_id}`, `GET /careers/{role_id}/skills` |
| Catalogue | `GET /courses`, `/courses/{id}`, `/courses/recommendations`, `/skills`, `/resources` |
| Roadmap | `GET /roadmap`, `POST /roadmap/generate`, `GET /roadmap/export` |
| Progress | `POST/DELETE /progress/course`, `/progress/project`, `/progress/node`, `POST /progress/assessment`, `GET /progress/overview`, `/progress/planner`, `/progress/milestones` |
| Projects | `GET /projects`, `/projects/recommended` |
| Assistant | `POST /chat`, `GET /chat/conversations`, `GET/DELETE /chat/conversations/{id}` |
| Admin | `/admin/stats`, `/admin/students`, `/admin/courses`, `/admin/roles`, `/admin/skills`, `/admin/resources`, `/admin/roadmaps`, `/admin/activity`, `/admin/usage`, `/admin/catalogue/validate`, `/admin/catalogue/reload` |
| System | `GET /api/health`, `GET /api/ai/status` |

Swagger tip: use **Authorize** with the OAuth2 password form (`username` = email). Alternatively call
`POST /api/auth/login` and paste the returned bearer token.

## Tests

Train or refresh the separately stored course recommender artifact from the CSV catalogue:

```bash
cd backend
python tools/train_recommender.py
```

This writes `backend/model_artifacts/course_recommender.pkl`. The application uses it when its course data matches;
otherwise it rebuilds the TF-IDF index in memory. The source datasets remain in `backend/app/datasets/`.

```bash
cd backend
python -m pytest -x -q
```

The suite covers registration/login, profile onboarding, roadmap generation, recommendations, progress updates,
chatbot grounding, admin permissions and catalogue validation contracts.

Frontend production build check:

```bash
cd frontend
npm run build
```

## Production deployment

1. **Build the frontend:** `cd frontend && npm install && npm run build`.
2. **Configure the backend:** set `ENV=production`, a strong `JWT_SECRET`, `DATABASE_URL` for PostgreSQL,
   `CORS_ORIGINS=https://your-domain.example` and `SEED_DEMO_DATA=false`.
3. **Run migrations/seed:** start the API once so tables are created (or apply `backend/schema.sql`), then optionally
   run a one-off seed of the catalogue only.
4. **Run with a process manager** behind HTTPS (nginx/Caddy → uvicorn):

   ```bash
   pip install -r requirements.txt "psycopg[binary]>=3.1,<4.0"
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
   ```

   Use `gunicorn -k uvicorn.workers.UvicornWorker` on Linux if preferred.
5. **Serve the SPA:** since `frontend/dist` is built, FastAPI serves it at `/`. If you host the frontend separately
   (Netlify/Vercel/S3), set `VITE_API_URL=https://api.your-domain.example/api` at build time and add the frontend
   origin to `CORS_ORIGINS`. Configure SPA rewrites so unknown routes return `index.html`.
6. **Reverse proxy:** forward `/api`, `/docs` and `/` to uvicorn. Add TLS, gzip/brotli and request-size limits.
7. **Operate:** back up PostgreSQL (`pg_dump`), rotate `JWT_SECRET` deliberately (existing tokens become invalid),
   monitor `/api/health`, and periodically run catalogue link validation from the admin console.

### Vercel + Render

This repository includes `vercel.json` and `render.yaml` for the split deployment:

- Import the repository into Vercel from the repository root. Vercel builds `frontend/` and serves its SPA routes.
- Create the Render web service from `render.yaml`. Set `CORS_ORIGINS` to the deployed Vercel URL.
- After Render is live, set Vercel's `VITE_API_URL` to the Render URL plus `/api`, then redeploy the frontend.

The included Render blueprint uses SQLite for zero-setup deployment. Render's local filesystem is ephemeral, so use
Render PostgreSQL for persistent user and progress data by replacing `DATABASE_URL` with the PostgreSQL connection URL.

Optional Docker sketch (single container):

```dockerfile
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=web /web/dist /frontend/dist
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Data honesty policy

This project intentionally avoids fabricated learning data:

- Only courses stored in the catalogue can appear in roadmaps, recommendations and answers.
- `verified=true` requires a direct course page that has been checked. Catalogue and search pages are stored with
  `link_type=catalogue|search`, `verified=false`, and the UI displays a "verify" warning.
- Ratings, rating counts, prices and durations are left blank when unknown; duration estimates are explicitly flagged.
- The assistant is told to say it does not know rather than invent a course, link, price or completion percentage.
- Students see a reminder that course details must be confirmed on the provider page.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Cannot reach the API` in the UI | Start the backend on port 8000; confirm the Vite proxy target. |
| 401 immediately after login | Clear `localStorage` (`smartlearn_token`, `smartlearn_user`) and sign in again. A changed `JWT_SECRET` invalidates old tokens. |
| CORS error | Add the frontend origin to `CORS_ORIGINS` and restart the backend. |
| `psycopg` import error | `pip install "psycopg[binary]>=3.1,<4.0"` and use `postgresql+psycopg://`. |
| ChromaDB/LangChain install fails on Python 3.14 | Keep the core `requirements.txt` only, or use Python 3.11/3.12 for the optional AI extras. The app falls back automatically. |
| Demo data changed unexpectedly | Delete `backend/smartlearn.db` and restart to reseed (SQLite only). |
| Frontend build fails to resolve modules | Run `npm install` inside `frontend/`, then `npm run build`. |

---

Built with FastAPI, SQLAlchemy, React, Tailwind CSS, Recharts and React Flow. No fabricated course data.
