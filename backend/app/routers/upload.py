import hashlib
import uuid

from fastapi import APIRouter, Request, UploadFile

from app.errors.handlers import InvalidPDFError
from app.models.schemas import UploadResponse
from app.services.chunking_service import chunk_pages
from app.services.pdf_service import detect_title, extract_pages

router = APIRouter()

PDF_MAGIC_BYTES = b"%PDF"
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB


@router.post("/upload", response_model=UploadResponse)
async def upload_rulebook(file: UploadFile, request: Request) -> UploadResponse:
    """Upload a PDF rulebook, extract text, chunk, embed, and index."""
    # Validate content type
    if file.content_type and file.content_type != "application/pdf":
        raise InvalidPDFError(
            f"Expected application/pdf, got {file.content_type}"
        )

    pdf_bytes = await file.read()

    if len(pdf_bytes) > MAX_UPLOAD_BYTES:
        raise InvalidPDFError(
            f"File exceeds maximum size of {MAX_UPLOAD_BYTES // (1024 * 1024)}MB"
        )

    # Validate magic bytes
    if not pdf_bytes[:4].startswith(PDF_MAGIC_BYTES):
        raise InvalidPDFError("File does not appear to be a valid PDF")

    # Duplicate detection via content hash
    pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()
    session_service = request.app.state.session_service
    existing = session_service.find_session_by_hash(pdf_hash)
    if existing is not None:
        return UploadResponse(
            session_id=existing.session_id,
            title=existing.title,
            total_pages=existing.total_pages,
            total_chunks=existing.total_chunks,
            duplicate=True,
        )

    # Extract pages
    pages = extract_pages(pdf_bytes)

    if not any(text.strip() for _, text in pages):
        raise InvalidPDFError(
            "PDF contains no extractable text. It may be a scanned document."
        )

    # Detect title
    title = detect_title(pages)

    # Chunk
    settings = request.app.state.settings
    chunks = chunk_pages(
        pages,
        target_tokens=settings.chunk_target_tokens,
        overlap_tokens=settings.chunk_overlap_tokens,
    )

    if not chunks:
        raise InvalidPDFError("Could not extract any text chunks from the PDF")

    # Embed all chunk texts
    llm_service = request.app.state.llm_service
    texts = [c.text for c in chunks]
    embeddings = llm_service.embed(
        model=settings.embedding_model,
        texts=texts,
    )

    # Create session and index
    session_id = uuid.uuid4().hex
    vector_service = request.app.state.vector_service
    vector_service.create_collection(session_id)
    vector_service.index_chunks(session_id, chunks, embeddings)

    session_service.create_session(
        session_id=session_id,
        title=title,
        total_pages=len(pages),
        chunks=chunks,
        pdf_hash=pdf_hash,
    )

    return UploadResponse(
        session_id=session_id,
        title=title,
        total_pages=len(pages),
        total_chunks=len(chunks),
    )
