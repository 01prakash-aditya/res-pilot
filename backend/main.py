"""
ResPilot Backend — main.py (v2.0)
All 17 improvements applied:
  #1  Async background processing (asyncio.create_task + asyncio.to_thread)
    #2  SQLite persistence via SQLModel (respilot.db + FAISS indexes on disk)
  #3  QA model cached via lru_cache (see qaModel.py)
  #4  Real-time SSE progress stream (/api/progress/{doc_id})
  #5  13 translation languages (see translationModel.py)
  #6  Multi-document global Q&A (/api/qa/global)
  #7  API key auth + slowapi rate limiting
  #8  50 MB file size limit
  #14 CORS origins from .env; all hardcoded localhost URLs eliminated
  #15 Structured logging (see logger.py)
"""
import os
import uuid
import asyncio
import json
import copy
import shutil
from pathlib import Path
from typing import Dict
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, HTTPException, Body, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from pydantic import BaseModel
import torch

from database import Document, create_db, engine
from auth import verify_api_key
import annotations
import citations
import related
import compare
from logger import get_logger
from translationModel import translate_text_core
from summaryModel import summarize_text_optimized
from qaModel import create_faiss_index, initialize_qa_system, load_pdf_text_with_pages, _get_embeddings, postprocess_math

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logger = get_logger(__name__)

# ── Paths & config ────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "files"
INDEX_DIR  = BASE_DIR / "indexes"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
INDEX_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "50")) * 1024 * 1024

# ── Shared state ──────────────────────────────────────────────────────────────
faiss_store: Dict[str, object] = {}           # doc_id → FAISS
progress_queues: Dict[str, asyncio.Queue] = {} # doc_id → asyncio.Queue

limiter = Limiter(key_func=get_remote_address)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db()
    logger.info("SQLite database ready")
    await _reload_faiss_indexes()
    logger.info("ResPilot v2.0 backend ready")
    yield
    logger.info("ResPilot backend shutting down")


async def _reload_faiss_indexes():
    """Reload all completed FAISS indexes from disk into memory on startup."""
    from langchain_community.vectorstores import FAISS

    with Session(engine) as session:
        completed_docs = session.exec(
            select(Document).where(Document.status == "completed")
        ).all()

    if not completed_docs:
        logger.info("No completed documents — skipping FAISS reload")
        return

    logger.info(f"Reloading {len(completed_docs)} FAISS index(es)…")
    embeddings = await asyncio.to_thread(_get_embeddings)

    for doc in completed_docs:
        index_path = INDEX_DIR / doc.doc_id
        if index_path.exists():
            try:
                def _load(path, emb):
                    return FAISS.load_local(path, emb, allow_dangerous_deserialization=True)
                faiss_store[doc.doc_id] = await asyncio.to_thread(
                    _load, str(index_path), embeddings
                )
                logger.info(f"  ✓ {doc.filename}")
            except Exception as exc:
                logger.error(f"  ✗ {doc.doc_id}: {exc}")


# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(title="ResPilot API", version="2.0.0", lifespan=lifespan)

app.include_router(annotations.router)
app.include_router(citations.router)
app.include_router(related.router)
app.include_router(compare.router)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ── Request models ────────────────────────────────────────────────────────────
class QARequest(BaseModel):
    question: str

class TranslationRequest(BaseModel):
    target_lang: str


# ── Background processing ─────────────────────────────────────────────────────
async def _emit(doc_id: str, step: str, pct: int, status: str = "processing", error: str = None):
    """Push a progress event to the SSE queue and update the DB."""
    event = {"step": step, "pct": pct, "status": status}
    if error:
        event["error"] = error

    q = progress_queues.get(doc_id)
    if q:
        await q.put(event)

    with Session(engine) as s:
        doc = s.exec(select(Document).where(Document.doc_id == doc_id)).first()
        if doc:
            doc.progress_step = step
            doc.progress_pct  = pct
            if status != "processing":
                doc.status = status
            if error:
                doc.error_message = error
            s.add(doc)
            s.commit()


async def process_document(doc_id: str, file_path: Path, filename: str):
    """
    Full async pipeline: extract → summarise → index → save.
    CPU-bound AI calls are offloaded with asyncio.to_thread() so the
    event loop stays responsive for concurrent SSE clients.
    """
    try:
        logger.info(f"[{doc_id}] START: {filename}")

        await _emit(doc_id, "Extracting text from PDF", 10)
        pages = await asyncio.to_thread(load_pdf_text_with_pages, str(file_path))
        full_text = " ".join(p["text"] for p in pages if p["text"].strip())
        if not full_text.strip():
            raise ValueError("No readable text found in the PDF")
        logger.info(f"[{doc_id}] Extracted {len(full_text):,} chars from {len(pages)} pages")

        await _emit(doc_id, "Generating AI summary", 30)
        summary = await asyncio.to_thread(summarize_text_optimized, full_text)
        logger.info(f"[{doc_id}] Summary complete ({len(summary)} chars)")
        
        await _emit(doc_id, "Extracting references & related papers", 50)
        from citations import extract_references_from_pdf
        from related import fetch_related_papers
        with Session(engine) as s:
            await asyncio.to_thread(extract_references_from_pdf, doc_id, str(file_path), s)
            await asyncio.to_thread(fetch_related_papers, doc_id, summary, s)

        await _emit(doc_id, "Building semantic search index", 70)
        faiss_db = await asyncio.to_thread(create_faiss_index, pages)

        await _emit(doc_id, "Saving to disk", 90)
        index_path = INDEX_DIR / doc_id
        await asyncio.to_thread(faiss_db.save_local, str(index_path))
        faiss_store[doc_id] = faiss_db

        with Session(engine) as s:
            doc = s.exec(select(Document).where(Document.doc_id == doc_id)).first()
            if doc:
                doc.status        = "completed"
                doc.summary       = summary
                doc.progress_step = "Complete"
                doc.progress_pct  = 100
                s.add(doc)
                s.commit()

        await _emit(doc_id, "Complete", 100, "completed")
        logger.info(f"[{doc_id}] DONE ✓")

    except Exception as exc:
        logger.error(f"[{doc_id}] FAILED: {exc}", exc_info=True)
        with Session(engine) as s:
            doc = s.exec(select(Document).where(Document.doc_id == doc_id)).first()
            if doc:
                doc.status        = "failed"
                doc.error_message = str(exc)
                s.add(doc)
                s.commit()
        await _emit(doc_id, "Failed", 0, "failed", str(exc))

    finally:
        await asyncio.sleep(300)   # keep queue alive for 5 min for late clients
        progress_queues.pop(doc_id, None)


# ── Upload ────────────────────────────────────────────────────────────────────
@app.post("/api/upload")
@limiter.limit("10/minute")
async def upload_file(
    request: Request,
    file: UploadFile,
    _: str = Depends(verify_api_key),
):
    if file.content_type not in ("application/pdf", "text/plain"):
        return JSONResponse({"detail": "Only PDF/text files are allowed"}, status_code=400)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        return JSONResponse(
            {"detail": f"File exceeds {MAX_FILE_SIZE // (1024*1024)} MB limit"},
            status_code=400,
        )

    doc_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or "upload.pdf")[1] or ".pdf"
    file_path = UPLOAD_DIR / f"{doc_id}{ext}"
    file_path.write_bytes(content)

    with Session(engine) as s:
        s.add(Document(doc_id=doc_id, filename=file.filename,
                       status="processing", progress_step="Queued", progress_pct=0))
        s.commit()

    # Create queue *before* starting the task so no events are missed
    progress_queues[doc_id] = asyncio.Queue()
    asyncio.create_task(process_document(doc_id, file_path, file.filename))

    logger.info(f"Accepted upload: {file.filename} → {doc_id}")
    return JSONResponse({"doc_id": doc_id, "filename": file.filename, "status": "processing"})


# ── SSE progress stream ────────────────────────────────────────────────────────
@app.get("/api/progress/{doc_id}")
async def stream_progress(doc_id: str):
    """Server-Sent Events stream of processing progress. No auth header needed (EventSource)."""
    async def gen():
        with Session(engine) as s:
            doc = s.exec(select(Document).where(Document.doc_id == doc_id)).first()
            if not doc:
                yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
                return
            if doc.status in ("completed", "failed"):
                payload = {"step": doc.progress_step, "pct": doc.progress_pct, "status": doc.status}
                if doc.error_message:
                    payload["error"] = doc.error_message
                yield f"data: {json.dumps(payload)}\n\n"
                return

        # Guard against race: wait up to 5 s for queue to appear
        for _ in range(50):
            if doc_id in progress_queues:
                break
            await asyncio.sleep(0.1)

        q = progress_queues.get(doc_id)
        if not q:
            yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
            return

        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=30)
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("status") in ("completed", "failed"):
                    break
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'heartbeat': True})}\n\n"

    return StreamingResponse(
        gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Status / Files ────────────────────────────────────────────────────────────
@app.get("/api/status/{doc_id}")
async def get_status(doc_id: str, _: str = Depends(verify_api_key)):
    with Session(engine) as s:
        doc = s.exec(select(Document).where(Document.doc_id == doc_id)).first()
        if not doc:
            raise HTTPException(404, "Document not found")
        return JSONResponse({
            "doc_id": doc_id, "status": doc.status,
            "progress_step": doc.progress_step, "progress_pct": doc.progress_pct,
            "error": doc.error_message,
        })


@app.get("/api/files")
async def list_files(_: str = Depends(verify_api_key)):
    with Session(engine) as s:
        docs = s.exec(select(Document)).all()
        return JSONResponse({
            "files": [{
                "doc_id": d.doc_id, "filename": d.filename, "status": d.status,
                "progress_step": d.progress_step, "progress_pct": d.progress_pct,
                "upload_date": d.created_at.isoformat(),
            } for d in docs],
            "count": len(docs),
        })


@app.get("/api/file-info/{doc_id}")
async def get_file_info(doc_id: str, _: str = Depends(verify_api_key)):
    with Session(engine) as s:
        doc = s.exec(select(Document).where(Document.doc_id == doc_id)).first()
        if not doc:
            raise HTTPException(404, "Document not found")
        return JSONResponse({
            "doc_id": doc_id, "filename": doc.filename,
            "status": doc.status, "upload_date": doc.created_at.isoformat(),
        })


# ── Analyse (summary) ─────────────────────────────────────────────────────────
@app.get("/api/analyze/{doc_id}")
async def get_summary(doc_id: str, _: str = Depends(verify_api_key)):
    with Session(engine) as s:
        doc = s.exec(select(Document).where(Document.doc_id == doc_id)).first()
        if not doc:
            raise HTTPException(404, "Document not found")
        if doc.status == "processing":
            return JSONResponse({
                "status": "processing",
                "progress_pct": doc.progress_pct,
                "progress_step": doc.progress_step,
            })
        if doc.status == "failed":
            raise HTTPException(500, f"Processing failed: {doc.error_message}")
        return JSONResponse({"status": "completed", "summary": doc.summary})


# ── Translation ───────────────────────────────────────────────────────────────
@app.post("/api/translate/{doc_id}")
@limiter.limit("20/minute")
async def translate_summary(
    request: Request,
    doc_id: str,
    body: TranslationRequest = Body(...),
    _: str = Depends(verify_api_key),
):
    with Session(engine) as s:
        doc = s.exec(select(Document).where(Document.doc_id == doc_id)).first()
        if not doc:
            raise HTTPException(404, "Document not found")
        if doc.status != "completed":
            raise HTTPException(400, "Document is not yet processed")
        summary = doc.summary

    try:
        translated = await asyncio.to_thread(translate_text_core, summary, body.target_lang)
        return JSONResponse({"translated_summary": translated})
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except RuntimeError as exc:
        raise HTTPException(500, str(exc))


# ── Q&A (single document) ─────────────────────────────────────────────────────
@app.post("/api/qa/{doc_id}")
@limiter.limit("60/minute")
async def answer_question(
    request: Request,
    doc_id: str,
    body: QARequest = Body(...),
    _: str = Depends(verify_api_key),
):
    if doc_id not in faiss_store:
        raise HTTPException(404, "Document index not found — please re-upload or restart")

    try:
        qa = initialize_qa_system(faiss_store[doc_id])
        with torch.inference_mode():
            result = await asyncio.to_thread(qa.invoke, {"query": body.question})
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        sources = [
            {"text": d.page_content[:200] + "…", "page": d.metadata.get("page", "N/A")}
            for d in result["source_documents"]
        ]
        return JSONResponse({"question": body.question, "answer": postprocess_math(result["result"]), "sources": sources})

    except Exception as exc:
        logger.error(f"QA error ({doc_id}): {exc}", exc_info=True)
        raise HTTPException(500, f"Q&A failed: {exc}")


# ── Streaming Q&A (SSE word-by-word) ─────────────────────────────────────────
@app.post("/api/qa-stream/{doc_id}")
async def answer_question_stream(
    doc_id: str,
    body: QARequest = Body(...),
    _: str = Depends(verify_api_key),
):
    if doc_id not in faiss_store:
        raise HTTPException(404, "Document index not found")

    async def gen():
        try:
            qa = initialize_qa_system(faiss_store[doc_id])
            with torch.inference_mode():
                result = await asyncio.to_thread(qa.invoke, {"query": body.question})
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            processed_result = postprocess_math(result["result"])
            words = processed_result.split()
            for i, word in enumerate(words):
                token = word + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'token': token})}\n\n"
                await asyncio.sleep(0.04)

            sources = [
                {"text": d.page_content[:200] + "…", "page": d.metadata.get("page", "N/A")}
                for d in result["source_documents"]
            ]
            yield f"data: {json.dumps({'done': True, 'sources': sources})}\n\n"

        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Multi-document global Q&A ─────────────────────────────────────────────────
@app.post("/api/qa/global")
@limiter.limit("30/minute")
async def global_qa(
    request: Request,
    body: QARequest = Body(...),
    _: str = Depends(verify_api_key),
):
    if not faiss_store:
        raise HTTPException(400, "No documents have been processed yet")

    indexes = list(faiss_store.values())
    if len(indexes) == 1:
        merged = indexes[0]
    else:
        # deepcopy so we don't mutate the stored indexes when calling merge_from
        merged = copy.deepcopy(indexes[0])
        for idx in indexes[1:]:
            merged.merge_from(copy.deepcopy(idx))

    try:
        qa = initialize_qa_system(merged)
        with torch.inference_mode():
            result = await asyncio.to_thread(qa.invoke, {"query": body.question})
        return JSONResponse({
            "question": body.question,
            "answer": postprocess_math(result["result"]),
            "sources": [
                {"text": d.page_content[:200] + "…", "page": d.metadata.get("page", "N/A")}
                for d in result["source_documents"]
            ],
        })
    except Exception as exc:
        logger.error(f"Global QA error: {exc}", exc_info=True)
        raise HTTPException(500, str(exc))


# ── Delete ────────────────────────────────────────────────────────────────────
@app.delete("/api/delete/{doc_id}")
async def delete_document(doc_id: str, _: str = Depends(verify_api_key)):
    with Session(engine) as s:
        doc = s.exec(select(Document).where(Document.doc_id == doc_id)).first()
        if not doc:
            raise HTTPException(404, "Document not found")
        filename = doc.filename
        s.delete(doc)
        s.commit()

    faiss_store.pop(doc_id, None)
    for f in UPLOAD_DIR.glob(f"{doc_id}.*"):
        f.unlink(missing_ok=True)
    index_path = INDEX_DIR / doc_id
    if index_path.exists():
        shutil.rmtree(index_path)

    logger.info(f"Deleted {doc_id} ({filename})")
    return JSONResponse({"message": "Document deleted", "doc_id": doc_id, "filename": filename})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)