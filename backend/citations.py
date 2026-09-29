import pymupdf as fitz
import re
import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Dict, Any
from pathlib import Path

from database import get_session, Reference, Document
from logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/citations", tags=["Citations"])

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

def _resolve_doi(doi: str) -> bool:
    try:
        url = f"https://doi.org/{doi}"
        response = requests.head(url, allow_redirects=True, timeout=3)
        return response.status_code == 200
    except Exception:
        return False

def extract_references_from_pdf(doc_id: str, filepath: str, session: Session):
    try:
        doc = fitz.open(filepath)
        text = ""
        for page in doc:
            text += page.get_text("text") + "\n"
        
        # Very basic heuristic for References section
        ref_start = re.search(r'\b(References|Bibliography)\b', text, re.IGNORECASE)
        if not ref_start:
            return
            
        ref_text = text[ref_start.end():]
        # Look for [1] or 1. style references
        matches = re.finditer(r'\[?(\d+)\]?\s+([^\[\n](?:.(?!\[\d+\]))*)', ref_text, re.DOTALL)
        
        extracted = []
        for match in matches:
            ref_body = match.group(2).strip().replace('\n', ' ')
            if len(ref_body) < 10:
                continue
                
            # Heuristics for Year
            year_match = re.search(r'\b(19|20)\d{2}\b', ref_body)
            year = year_match.group(0) if year_match else None
            
            # Heuristics for DOI
            doi_match = re.search(r'10\.\d{4,9}/[-._;()/:A-Z0-9]+', ref_body, re.IGNORECASE)
            doi_or_url = doi_match.group(0) if doi_match else None
            
            if doi_or_url and _resolve_doi(doi_or_url):
                doi_or_url = f"https://doi.org/{doi_or_url}"
                
            ref = Reference(
                doc_id=doc_id,
                title=ref_body[:200] + "..." if len(ref_body) > 200 else ref_body,
                authors="Unknown", # Requires more complex NLP to parse accurately
                year=year,
                doi_or_url=doi_or_url,
                in_text_count=len(re.findall(rf'\[{match.group(1)}\]', text))
            )
            extracted.append(ref)
            
        if extracted:
            session.add_all(extracted)
            session.commit()
            logger.info(f"Extracted {len(extracted)} references for {doc_id}")
            
    except Exception as e:
        logger.error(f"Error extracting references for {doc_id}: {e}")

@router.get("/{doc_id}")
def get_citations(doc_id: str, session: Session = Depends(get_session)):
    refs = session.exec(select(Reference).where(Reference.doc_id == doc_id)).all()
    in_text_count = sum(r.in_text_count for r in refs)
    return {
        "references": [
            {
                "id": r.id,
                "title": r.title,
                "authors": r.authors,
                "year": r.year,
                "doi_or_url": r.doi_or_url,
                "in_text_count": r.in_text_count
            } for r in refs
        ],
        "in_text_count": in_text_count
    }
