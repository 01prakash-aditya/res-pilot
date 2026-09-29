from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
import requests
from typing import List, Optional

from database import get_session, RelatedPaper, Document
from logger import get_logger

try:
    from keybert import KeyBERT
    kw_model = KeyBERT()
except ImportError:
    kw_model = None

logger = get_logger(__name__)
router = APIRouter(prefix="/api/related", tags=["Related Papers"])

def fetch_related_papers(doc_id: str, summary: str, session: Session):
    if not kw_model:
        logger.warning("KeyBERT not installed, skipping related papers fetch")
        return
        
    try:
        # Check if already fetched
        existing = session.exec(select(RelatedPaper).where(RelatedPaper.doc_id == doc_id)).all()
        if existing:
            return

        # Extract keywords
        keywords = kw_model.extract_keywords(summary, keyphrase_ngram_range=(1, 2), stop_words='english', top_n=5)
        query = " ".join([kw[0] for kw in keywords])
        
        # Query Semantic Scholar
        url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={query}&fields=title,authors,year,abstract,citationCount,openAccessPdf&limit=10"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            papers = data.get("data", [])
            
            extracted = []
            for p in papers:
                authors = ", ".join([a.get("name", "") for a in p.get("authors", [])])
                pdf_url = p.get("openAccessPdf", {}).get("url") if p.get("openAccessPdf") else None
                rp = RelatedPaper(
                    doc_id=doc_id,
                    s2_paper_id=p.get("paperId", ""),
                    title=p.get("title", ""),
                    authors_json=authors,
                    year=p.get("year"),
                    abstract=p.get("abstract"),
                    citation_count=p.get("citationCount") or 0,
                    pdf_url=pdf_url
                )
                extracted.append(rp)
                
            if extracted:
                session.add_all(extracted)
                session.commit()
                logger.info(f"Fetched {len(extracted)} related papers for {doc_id}")
    except Exception as e:
        logger.error(f"Error fetching related papers for {doc_id}: {e}")

@router.get("/{doc_id}")
def get_related_papers(doc_id: str, session: Session = Depends(get_session)):
    papers = session.exec(select(RelatedPaper).where(RelatedPaper.doc_id == doc_id).order_by(RelatedPaper.citation_count.desc())).all()
    
    if not papers:
        # Retry fetching on the fly if it failed during background processing
        doc = session.exec(select(Document).where(Document.doc_id == doc_id)).first()
        if doc and doc.summary:
            fetch_related_papers(doc_id, doc.summary, session)
            papers = session.exec(select(RelatedPaper).where(RelatedPaper.doc_id == doc_id).order_by(RelatedPaper.citation_count.desc())).all()
            
    return {
        "papers": [
            {
                "id": p.id,
                "s2_paper_id": p.s2_paper_id,
                "title": p.title,
                "authors": p.authors_json,
                "year": p.year,
                "abstract": p.abstract,
                "citation_count": p.citation_count,
                "pdf_url": p.pdf_url
            } for p in papers
        ]
    }
    
class UploadUrlRequest(BaseModel):
    url: str
    
@router.post("/upload-url")
def upload_url(data: UploadUrlRequest, session: Session = Depends(get_session)):
    # This would kick off the same background task as file upload
    return {"message": "Upload from URL queued", "url": data.url}
