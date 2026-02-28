# Rulebook Arbiter

A web app that lets you upload a board game rulebook PDF and ask questions about the rules, powered by RAG.

Answers include inline citations like `[p.3, §Setup]` — click one to see the original source text.

## Features

- **PDF Upload** — Drag-and-drop a rulebook; automatic text extraction → chunking → embedding → indexing
- **RAG Q&A** — Ask questions in natural language and get answers grounded in the rulebook with inline citations
- **Citation Verification** — Click a citation badge to view the original text with sentence-level highlights
- **3 Presets** — Learn (beginner-friendly) / Setup (game preparation guide) / Arbiter (dispute resolution)
- **Korean · English** — Bilingual UI and AI responses

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, TanStack Query |
| Backend | FastAPI, Python 3.12+, ChromaDB, Google Gemini API |
| Infra | Docker Compose |

## Getting Started

### Prerequisites

- [Google Gemini API key](https://aistudio.google.com/apikey)
- Docker + Docker Compose (Docker setup) or Python 3.12+ / Node.js 20+ (local setup)

### Docker (Recommended)

```bash
cp .env.example .env
# Set RULEBOOK_GEMINI_API_KEY in .env

docker compose up
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Local Development

**Backend:**

```bash
cd backend
cp ../.env.example ../.env        # Set your API key
uv sync
uv run uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `localhost:8000`.

## Testing

```bash
# Backend unit tests
cd backend && uv run pytest

# Frontend E2E tests (Playwright)
cd frontend && npx playwright install  # first time only
npm run test:e2e
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RULEBOOK_GEMINI_API_KEY` | — | Google Gemini API key (required) |
| `RULEBOOK_GENERATION_MODEL` | `gemini-3-flash-preview` | Generation model |
| `RULEBOOK_EMBEDDING_MODEL` | `text-embedding-004` | Embedding model |
| `RULEBOOK_CHUNK_TARGET_TOKENS` | `600` | Target tokens per chunk |
| `RULEBOOK_CHUNK_OVERLAP_TOKENS` | `100` | Overlap tokens between chunks |
| `RULEBOOK_RETRIEVAL_TOP_K` | `5` | Number of chunks to retrieve |
| `RULEBOOK_GENERATION_MAX_OUTPUT_TOKENS` | `2048` | Max response tokens |
| `RULEBOOK_CHROMADB_PATH` | `./data/chromadb` | ChromaDB storage path |
| `RULEBOOK_MAX_CONVERSATION_TURNS` | `10` | Max conversation pairs retained |

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, service initialization
│   │   ├── config.py            # Environment variable settings
│   │   ├── models/              # Domain models, presets, API schemas
│   │   ├── routers/             # API endpoints (upload, chat, sources, settings)
│   │   ├── services/            # Business logic (PDF, chunking, LLM, vector, session, RAG)
│   │   └── errors/              # Exception handling
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── api/                 # HTTP client
│   │   ├── components/          # React components (chat, layout, upload, settings)
│   │   ├── hooks/               # Custom hooks (useChat, useUpload, useCitation)
│   │   ├── stores/              # Zustand state management
│   │   ├── i18n/                # i18n resources (ko, en)
│   │   └── lib/                 # Utilities (citation parser, highlighting)
│   └── e2e/                     # Playwright E2E tests
├── docs/
│   ├── user-scenarios.md        # User scenarios (US-01 ~ US-08)
│   └── demo-scenario.md         # 1-minute demo scenario
└── docker-compose.yml
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/upload` | Upload PDF rulebook |
| `POST` | `/api/chat` | Ask a rule question (RAG) |
| `GET` | `/api/sources/{chunk_id}` | Get citation source text |
| `GET` | `/api/sessions/{session_id}` | Session metadata + conversation history |
| `GET/PUT` | `/api/settings` | Get or update model/preset |

## License

Private
