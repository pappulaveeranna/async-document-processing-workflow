# Async Document Processing Workflow System

A production-style full-stack application where users upload documents, trigger background processing via Celery workers, track progress in real-time using Redis Pub/Sub + Server-Sent Events, review and edit extracted output, finalize records, and export results as JSON or CSV.

---

## Live Demo

> 🌐 **Live URL:** <INSERT_LIVE_URL>

> 📹 [Watch the 3–5 minute demo video here](<INSERT_VIDEO_LINK>)

---

## AI Tools Used

**Amazon Q Developer** (AWS IDE plugin) was used to assist with code generation, scaffolding, and debugging during development. All architecture decisions, design choices, and implementation logic were authored and reviewed by the developer.

---

## Architecture Overview

```
┌─────────────────┐        HTTP / SSE         ┌──────────────────────┐
│   Next.js 15    │ ◄────────────────────────► │   FastAPI (Python)   │
│   (Frontend)    │                            └──────────┬───────────┘
└─────────────────┘                                       │
                                                 ┌────────┴────────┐
                                                 │   PostgreSQL 16  │
                                                 │  (documents +    │
                                                 │   jobs + results)│
                                                 └────────┬────────┘
                                                          │
                                             ┌────────────┴────────────┐
                                             │         Redis 7          │
                                             │  • Celery broker (DB 0)  │
                                             │  • Celery results (DB 1) │
                                             │  • Pub/Sub progress      │
                                             │  • Status cache          │
                                             └────────────┬────────────┘
                                                          │
                                                 ┌────────┴────────┐
                                                 │  Celery Worker   │
                                                 │  (process_doc)   │
                                                 └─────────────────┘
```

### Component Roles

| Component | Technology | Role |
|-----------|-----------|------|
| Frontend | Next.js 15 + TypeScript + Tailwind CSS | Upload UI, dashboard, SSE progress consumer |
| Backend API | FastAPI + Python 3.12 | REST endpoints, SSE streaming, job orchestration |
| Database | PostgreSQL 16 | Document metadata, job state, extracted/finalized data |
| Task Queue | Celery 5 | Async background document processing |
| Broker + Pub/Sub | Redis 7 | Celery broker, result backend, progress event channel |

### Processing Pipeline

Every uploaded document goes through 7 stages inside a Celery worker. At each stage a progress event is published to a Redis Pub/Sub channel (`job:<job_id>`). The FastAPI SSE endpoint subscribes to that channel and streams events to the browser in real time.

```
job_queued
  → job_started          (5%)
  → parsing_started      (20%)   ← text extracted from file
  → parsing_completed    (45%)
  → extraction_started   (60%)   ← structured fields derived
  → extraction_completed (80%)
  → result_stored        (95%)   ← JSON saved to PostgreSQL
  → job_completed        (100%)
```

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py            # All 8 API endpoints
│   │   ├── core/
│   │   │   ├── config.py            # pydantic-settings + Redis health check
│   │   │   └── database.py          # SQLAlchemy engine + session factory
│   │   ├── models/
│   │   │   └── models.py            # Document + ProcessingJob ORM models
│   │   ├── schemas/
│   │   │   └── schemas.py           # Pydantic request/response DTOs
│   │   ├── services/
│   │   │   ├── document_service.py  # Business logic, text extraction, field derivation
│   │   │   └── redis_service.py     # Pub/Sub publish, status cache, subscriber
│   │   ├── worker/
│   │   │   ├── celery_app.py        # Celery app configuration
│   │   │   └── tasks.py             # process_document Celery task (7 stages)
│   │   └── main.py                  # FastAPI app, CORS, DB init
│   ├── .env.example
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Jobs dashboard (search, filter, sort, paginate)
│   │   │   ├── upload/page.tsx      # Multi-file upload screen
│   │   │   └── jobs/[id]/page.tsx   # Job detail, edit, finalize, export
│   │   ├── components/
│   │   │   ├── LiveProgress.tsx     # SSE EventSource → real-time progress bar
│   │   │   ├── ProgressBar.tsx      # Animated progress bar UI
│   │   │   ├── StatusBadge.tsx      # Colored status pill
│   │   │   └── UploadZone.tsx       # Drag-and-drop file upload area
│   │   ├── lib/
│   │   │   └── api.ts               # Axios API client
│   │   └── types/
│   │       └── index.ts             # Shared TypeScript types
│   ├── Dockerfile
│   └── package.json
├── sample_files/                    # Test documents (txt, csv, md)
├── sample_exports/                  # Example JSON + CSV exports
├── docker-compose.yml
└── README.md
```

---

## Setup & Run

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Quick Start — Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/pappulaveeranna/async-document-processing-workflow.git
cd async-document-processing-workflow

# 2. Start all 5 services (db, redis, api, worker, frontend)
docker compose up --build

# 3. Open in browser
#    Frontend:  http://localhost:3000
#    API:       http://localhost:8000
#    API Docs:  http://localhost:8000/docs
```

> First run takes ~3 minutes to build images and pull dependencies.

### Local Development (without Docker)

**Requirements:** Python 3.12, Node 20+, PostgreSQL 16, Redis 7 running locally.

**Backend — Terminal 1 (API server):**
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt

cp .env.example .env
# Edit .env — set DATABASE_URL and REDIS_URL to your local instances

uvicorn app.main:app --reload --port 8000
```

**Backend — Terminal 2 (Celery worker):**
```bash
cd backend
venv\Scripts\activate

# Windows requires --pool=solo
celery -A app.worker.celery_app worker --loglevel=info --pool=solo
```

**Frontend — Terminal 3:**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

> **Note:** The app will refuse to start if Redis is not reachable. This is intentional — Redis is a hard requirement, not optional.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload one or more documents |
| `GET` | `/api/jobs` | List jobs — supports `search`, `status`, `sort_by`, `sort_order`, `skip`, `limit` |
| `GET` | `/api/jobs/{id}` | Get full job details including extracted/finalized data |
| `GET` | `/api/jobs/{id}/progress` | **SSE stream** — real-time progress via Redis Pub/Sub |
| `POST` | `/api/jobs/{id}/retry` | Retry a failed job (idempotent) |
| `PUT` | `/api/jobs/{id}/extracted` | Update extracted data (edit before finalize) |
| `POST` | `/api/jobs/{id}/finalize` | Finalize reviewed result |
| `GET` | `/api/jobs/{id}/export?format=json\|csv` | Export finalized result |

Interactive Swagger docs: `http://localhost:8000/docs`

---

## Database Schema

### `documents`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Auto-generated |
| `filename` | String | Saved filename (UUID-based) |
| `original_filename` | String | Original upload name |
| `file_type` | String | MIME type |
| `file_size` | Integer | Bytes |
| `file_path` | String | Absolute path on disk |
| `uploaded_at` | DateTime | Upload timestamp |

### `processing_jobs`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Auto-generated |
| `document_id` | UUID FK | References `documents.id` |
| `celery_task_id` | String | Celery task ID for tracking |
| `status` | Enum | `queued / processing / completed / failed / finalized` |
| `current_stage` | String | Current pipeline stage name |
| `progress` | Integer | 0–100 |
| `error_message` | Text | Set on failure |
| `retry_count` | Integer | Number of retries attempted |
| `extracted_data` | JSON | Structured output from worker |
| `finalized_data` | JSON | Reviewed and finalized output |
| `created_at` | DateTime | Job creation time |
| `updated_at` | DateTime | Last update time |

---

## Supported File Types

| Extension | MIME Type |
|-----------|-----------|
| `.pdf` | `application/pdf` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `.txt` | `text/plain` |
| `.csv` | `text/csv` |
| `.md` | `text/markdown` |

---

## Assumptions & Tradeoffs

| Decision | Reasoning |
|----------|-----------|
| **SSE over WebSockets** | SSE is simpler, sufficient for unidirectional server→client progress streaming, and requires no additional protocol upgrade |
| **Redis dual role** | Redis serves as both Celery broker (DB 0), result backend (DB 1), and Pub/Sub channel. Separate DB indices prevent key collisions |
| **Simulated processing logic** | Text extraction and keyword derivation are intentionally simple. The assignment evaluates async architecture, not NLP/OCR quality |
| **File storage on disk** | Files stored on a shared Docker volume (`uploads/`). `UPLOAD_DIR` is env-configurable — easy to swap for S3 in production |
| **No authentication** | Out of scope for this assignment. JWT-based auth via FastAPI dependency injection would be straightforward to add |
| **CORS allow all origins** | Set to `*` for development convenience. Must be restricted in production |
| **Fail-fast on Redis** | App refuses to start if Redis is unreachable. No silent fallback — ensures the async architecture is always real |

---

## Limitations

- **No file deduplication** — uploading the same file twice creates two separate jobs
- **Image-based PDFs** — PyPDF2 cannot extract text from scanned/image PDFs; a fallback message is stored instead
- **SSE cleanup** — if a client disconnects mid-stream, the server-side generator times out after 120 seconds
- **Single worker concurrency** — default `--concurrency=4` in Docker; horizontal scaling requires Kubernetes or multiple worker containers
- **No cancellation** — once a job is dispatched to Celery it cannot be cancelled mid-flight

---

## Bonus Features Implemented

- [x] **Docker Compose** — full 5-service setup (db, redis, api, worker, frontend)
- [x] **Idempotent retry** — `retry_count` tracked in DB; Celery `max_retries=3` enforced; guard prevents retrying a processing job
- [x] **File storage abstraction** — `UPLOAD_DIR` configurable via environment variable
- [x] **Fail-fast Redis check** — app startup fails immediately if Redis is not reachable
- [x] **Edge case handling** — file size limit (50MB), invalid JSON guard on edit/finalize, SSE timeout, image-based PDF fallback
- [x] **Pagination** — dashboard supports skip/limit with page controls
- [x] **Interactive API docs** — Swagger UI at `/docs`

---

## Sample Files

Located in `sample_files/`:

| File | Type | Description |
|------|------|-------------|
| `machine_learning_intro.txt` | Text | Article about ML — good for keyword extraction |
| `product_catalog.csv` | CSV | Product data — tests CSV parsing |
| `architecture_doc.md` | Markdown | Technical doc — tests Markdown parsing |

---

## Sample Exports

Located in `sample_exports/`:

| File | Description |
|------|-------------|
| `machine_learning_intro_export.json` | JSON export of finalized job |
| `machine_learning_intro_export.csv` | CSV export of finalized job (flattened) |
