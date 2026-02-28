# AGENTS.md — Rulebook Arbiter

Board game rulebook Q&A app powered by RAG (ChromaDB + Gemini). Upload a PDF, ask questions, get cited answers.

## Build & Run

### Backend (Python 3.12+, uv)

```bash
cd backend
uv sync                          # install all deps (including test extras)
uv run uvicorn app.main:app --reload  # dev server on :8000
```

Test extras are declared under `[project.optional-dependencies].test` in `pyproject.toml` — `uv sync` installs them by default.

```bash
uv run pytest                    # all tests
uv run pytest tests/test_api_chat.py  # single file
uv run pytest -x -q              # fail-fast, quiet
```

**Required env:** Copy `.env.example` → `.env`. Only `RULEBOOK_GEMINI_API_KEY` is required; all other `RULEBOOK_*` vars have defaults in `app/config.py`.

### Frontend (Node, npm)

```bash
cd frontend
npm install
npm run dev                       # vite dev server on :5173, proxies /api → :8000
npm run build                     # tsc -b && vite build (TS compile THEN bundle)
```

E2E tests (Playwright auto-starts dev server):

```bash
npx playwright install            # first time only
npm run test:e2e                  # runs all e2e/*.spec.ts
npm run demo:record               # runs e2e/demo-recording.spec.ts only
```

### Docker

```bash
docker compose up                 # backend (:8000) + frontend (:5173)
```

Frontend `depends_on` backend with health check (`GET /api/health`). Backend reads `.env` file; frontend gets `VITE_API_URL` from compose.

## Architecture Contracts

### Service Dependency Injection

All services are wired in `main.py` lifespan context manager and attached to `app.state`:

```
Settings → LLMService(api_key)
         → VectorService(chroma_client)
         → SessionService(default_model)
         → RetrievalService(vector, llm, session, settings)
```

Routers access services via `request.app.state.<service>`. No global singletons, no import-time side effects.

### Error Response Contract

All API errors return `{ "error": string, "detail": null }`. Status codes are fixed per exception type:

| Exception | Status | Cause |
|-----------|--------|-------|
| `InvalidPDFError` | 400 | Bad upload (not PDF, no text, corrupt) |
| `SessionNotFoundError` | 404 | Unknown session_id |
| `LLMError` | 502 | Gemini API failure after retries |
| `VectorStoreError` | 500 | ChromaDB operation failure |
| Unhandled `Exception` | 500 | Catch-all, logged server-side |

Frontend `ApiClientError` (`api/client.ts`) parses this shape. All non-OK responses throw typed errors.

### Sessions Are In-Memory

`SessionService` stores sessions in a dict guarded by `threading.Lock`. **Server restart loses all session state.** ChromaDB collections persist on disk but orphan without their session metadata.

### Conversation History Trimming

Max 10 Q&A pairs (20 turns). When exceeded, oldest pair is dropped. Enforced in `SessionService.add_turn()`.

### Preset System

Three presets in `app/models/presets.py` — `learn` (T=0.5), `setup` (T=0.2), `arbiter` (T=0.3, default). All presets enforce citation format `[p.X, §Y]` in their system prompts. Adding a preset requires only appending to the `PRESETS` dict.

### Frontend API Proxy

Dev mode: Vite proxies `/api/*` → `http://localhost:8000` (`vite.config.ts`). Docker mode: `VITE_API_URL=http://backend:8000`. Frontend code always uses relative `/api` paths.

### Frontend State

Zustand stores with immutable patterns. `session-store` and `settings-store` persist to localStorage. `chat-store` is ephemeral (in-memory only). TanStack React Query handles server state (mutations + caching).

## Testing

### Backend Test Setup

`tests/conftest.py` reconstructs the FastAPI app **without the lifespan** — it manually creates services with a mock LLM and ephemeral ChromaDB client. The mock LLM returns fixed 3D embeddings and a canned response with citations. `create_pdf_with_text(["page 1 text", "page 2 text"])` generates valid PDFs using raw PDF content stream operators.

Tests use `TestClient(raise_server_exceptions=False)` so HTTP error codes are returned, not raised.

### Frontend E2E

`e2e/helpers.ts` intercepts API calls via `page.route()` with **URL callback functions** (not glob patterns) to avoid matching Vite module paths (`/src/api/*`). Helper functions `uploadPdf()` and `sendChatMessage()` abstract common flows. Locators use regex for bilingual Korean/English text matching.
