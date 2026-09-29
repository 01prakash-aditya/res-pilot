"""
Integration tests for the ResPilot FastAPI backend.
Run with:  pytest tests/ -v
"""
import io
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Ensure .env is loaded before importing app
import os
os.environ.setdefault("API_KEY", "")           # disable auth during tests
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_respilot.db")

from main import app


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(scope="module")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


# ── /api/files ────────────────────────────────────────────────────────────────
@pytest.mark.anyio
async def test_list_files_empty(client):
    resp = await client.get("/api/files")
    assert resp.status_code == 200
    data = resp.json()
    assert "files" in data
    assert isinstance(data["files"], list)


# ── /api/upload ───────────────────────────────────────────────────────────────
@pytest.mark.anyio
async def test_upload_non_pdf_rejected(client):
    """Uploading a text file disguised as a different type should fail gracefully."""
    fake = io.BytesIO(b"not a pdf")
    resp = await client.post(
        "/api/upload",
        files={"file": ("bad.exe", fake, "application/octet-stream")},
    )
    assert resp.status_code == 400


@pytest.mark.anyio
async def test_upload_oversized_rejected(client):
    """Files over 50 MB should be rejected."""
    big = io.BytesIO(b"x" * (51 * 1024 * 1024))
    resp = await client.post(
        "/api/upload",
        files={"file": ("huge.pdf", big, "application/pdf")},
    )
    assert resp.status_code == 400
    assert "limit" in resp.json()["detail"].lower()


# ── /api/status ───────────────────────────────────────────────────────────────
@pytest.mark.anyio
async def test_status_not_found(client):
    resp = await client.get("/api/status/nonexistent-doc-id")
    assert resp.status_code == 404


# ── /api/analyze ──────────────────────────────────────────────────────────────
@pytest.mark.anyio
async def test_analyze_not_found(client):
    resp = await client.get("/api/analyze/nonexistent-doc-id")
    assert resp.status_code == 404


# ── /api/translate ────────────────────────────────────────────────────────────
@pytest.mark.anyio
async def test_translate_not_found(client):
    resp = await client.post(
        "/api/translate/nonexistent-doc-id",
        json={"target_lang": "es"},
    )
    assert resp.status_code == 404


# ── /api/qa ───────────────────────────────────────────────────────────────────
@pytest.mark.anyio
async def test_qa_not_found(client):
    resp = await client.post(
        "/api/qa/nonexistent-doc-id",
        json={"question": "What is this about?"},
    )
    assert resp.status_code == 404


# ── /api/delete ───────────────────────────────────────────────────────────────
@pytest.mark.anyio
async def test_delete_not_found(client):
    resp = await client.delete("/api/delete/nonexistent-doc-id")
    assert resp.status_code == 404


# ── /api/qa/global ────────────────────────────────────────────────────────────
@pytest.mark.anyio
async def test_global_qa_no_docs(client):
    """Global Q&A should return 400 when no documents have been processed."""
    resp = await client.post("/api/qa/global", json={"question": "test"})
    assert resp.status_code == 400
