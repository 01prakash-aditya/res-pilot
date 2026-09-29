"""
Database layer using SQLModel (SQLAlchemy + Pydantic in one class).
SQLModel was created by the same author as FastAPI (Tiangolo) and provides
a clean, type-safe way to define DB models that are also Pydantic models.
"""
import os
from typing import Optional
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field, create_engine, Session, select

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./respilot.db")

# echo=False silences SQL debug output; set to True for troubleshooting
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})


class Document(SQLModel, table=True):
    """
    A single uploaded research paper.
    Status lifecycle: processing → completed | failed
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    doc_id: str = Field(index=True, unique=True)
    filename: str
    status: str = Field(default="processing")       # processing | completed | failed
    summary: Optional[str] = Field(default=None)
    progress_step: Optional[str] = Field(default="Queued")
    progress_pct: int = Field(default=0)
    error_message: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Annotation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    doc_id: str = Field(index=True)
    text_excerpt: str
    note: str
    tag: str
    color: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Reference(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    doc_id: str = Field(index=True)
    title: str
    authors: str
    year: Optional[str] = Field(default=None)
    doi_or_url: Optional[str] = Field(default=None)
    in_text_count: int = Field(default=0)

class RelatedPaper(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    doc_id: str = Field(index=True)
    s2_paper_id: str
    title: str
    authors_json: str
    year: Optional[int] = Field(default=None)
    abstract: Optional[str] = Field(default=None)
    citation_count: int = Field(default=0)
    pdf_url: Optional[str] = Field(default=None)

def create_db() -> None:
    """Create all tables if they don't exist."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """FastAPI dependency that yields a SQLModel session."""
    with Session(engine) as session:
        yield session
