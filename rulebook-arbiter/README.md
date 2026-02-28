# 룰북 심판관 (Rulebook Arbiter)

보드게임 룰북 PDF를 업로드하면 RAG 기반으로 규칙을 질의응답해주는 웹 앱.

답변에 `[p.3, §게임 준비]` 형태의 인라인 인용이 포함되어, 클릭하면 원문을 바로 확인할 수 있다.

## 주요 기능

- **PDF 업로드** — 드래그앤드롭으로 룰북 업로드, 자동 텍스트 추출 → 청킹 → 임베딩 → 인덱싱
- **RAG Q&A** — 자연어 질문에 대해 룰북 원문 인용이 포함된 답변 생성
- **인용 검증** — 인용 배지 클릭 시 원문 텍스트와 하이라이트 표시
- **3가지 프리셋** — 학습 (초보자 설명) / 셋업 (게임 준비 가이드) / 심판 (분쟁 판정)
- **한국어 · English** — UI 및 AI 답변 양방향 언어 지원

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, TanStack Query |
| Backend | FastAPI, Python 3.12+, ChromaDB, Google Gemini API |
| Infra | Docker Compose |

## 시작하기

### 사전 요구사항

- [Google Gemini API 키](https://aistudio.google.com/apikey)
- Docker + Docker Compose (Docker 실행) 또는 Python 3.12+ / Node.js 20+ (로컬 실행)

### Docker (권장)

```bash
cp .env.example .env
# .env 파일에서 RULEBOOK_GEMINI_API_KEY 설정

docker compose up
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API 문서: http://localhost:8000/docs

### 로컬 실행

**Backend:**

```bash
cd backend
cp ../.env.example ../.env        # API 키 설정
uv sync
uv run uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Vite 개발 서버가 `/api` 요청을 `localhost:8000`으로 프록시한다.

## 테스트

```bash
# Backend 단위 테스트
cd backend && uv run pytest

# Frontend E2E 테스트 (Playwright)
cd frontend && npx playwright install  # 최초 1회
npm run test:e2e
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `RULEBOOK_GEMINI_API_KEY` | — | Google Gemini API 키 (필수) |
| `RULEBOOK_GENERATION_MODEL` | `gemini-3-flash-preview` | 생성 모델 |
| `RULEBOOK_EMBEDDING_MODEL` | `text-embedding-004` | 임베딩 모델 |
| `RULEBOOK_CHUNK_TARGET_TOKENS` | `600` | 청크 목표 토큰 수 |
| `RULEBOOK_CHUNK_OVERLAP_TOKENS` | `100` | 청크 간 오버랩 토큰 |
| `RULEBOOK_RETRIEVAL_TOP_K` | `5` | 검색 시 반환할 청크 수 |
| `RULEBOOK_GENERATION_MAX_OUTPUT_TOKENS` | `2048` | 최대 응답 토큰 |
| `RULEBOOK_CHROMADB_PATH` | `./data/chromadb` | ChromaDB 저장 경로 |
| `RULEBOOK_MAX_CONVERSATION_TURNS` | `10` | 대화 기록 최대 쌍 수 |

## 프로젝트 구조

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 앱, 서비스 초기화
│   │   ├── config.py            # 환경 변수 설정
│   │   ├── models/              # 도메인 모델, 프리셋, API 스키마
│   │   ├── routers/             # API 엔드포인트 (upload, chat, sources, settings)
│   │   ├── services/            # 비즈니스 로직 (PDF, 청킹, LLM, 벡터, 세션, RAG)
│   │   └── errors/              # 예외 처리
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── api/                 # HTTP 클라이언트
│   │   ├── components/          # React 컴포넌트 (chat, layout, upload, settings)
│   │   ├── hooks/               # 커스텀 훅 (useChat, useUpload, useCitation)
│   │   ├── stores/              # Zustand 상태 관리
│   │   ├── i18n/                # 다국어 리소스 (ko, en)
│   │   └── lib/                 # 유틸리티 (인용 파서, 하이라이트)
│   └── e2e/                     # Playwright E2E 테스트
├── docs/
│   ├── user-scenarios.md        # 사용자 시나리오 (US-01 ~ US-08)
│   └── demo-scenario.md         # 1분 데모 시나리오
└── docker-compose.yml
```

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/health` | 헬스 체크 |
| `POST` | `/api/upload` | PDF 룰북 업로드 |
| `POST` | `/api/chat` | 규칙 질문 (RAG) |
| `GET` | `/api/sources/{chunk_id}` | 인용 원문 조회 |
| `GET` | `/api/sessions/{session_id}` | 세션 메타데이터 + 대화 기록 |
| `GET/PUT` | `/api/settings` | 모델/프리셋 조회 및 변경 |

## 라이선스

Private
