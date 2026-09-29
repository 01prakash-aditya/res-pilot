from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional

from database import get_session, Annotation, Document
from logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/annotations", tags=["Annotations"])


class AnnotationCreate(BaseModel):
    text_excerpt: str
    note: str
    tag: str
    color: str

class AnnotationRead(BaseModel):
    id: int
    doc_id: str
    text_excerpt: str
    note: str
    tag: str
    color: str
    created_at: str


@router.post("/{doc_id}", response_model=AnnotationRead)
def create_annotation(doc_id: str, data: AnnotationCreate, session: Session = Depends(get_session)):
    doc = session.exec(select(Document).where(Document.doc_id == doc_id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    annotation = Annotation(
        doc_id=doc_id,
        text_excerpt=data.text_excerpt,
        note=data.note,
        tag=data.tag,
        color=data.color
    )
    session.add(annotation)
    session.commit()
    session.refresh(annotation)
    logger.info(f"Created annotation {annotation.id} for doc {doc_id}")
    
    return {
        "id": annotation.id,
        "doc_id": annotation.doc_id,
        "text_excerpt": annotation.text_excerpt,
        "note": annotation.note,
        "tag": annotation.tag,
        "color": annotation.color,
        "created_at": annotation.created_at.isoformat()
    }


@router.get("/{doc_id}", response_model=List[AnnotationRead])
def get_annotations(doc_id: str, session: Session = Depends(get_session)):
    annotations = session.exec(select(Annotation).where(Annotation.doc_id == doc_id).order_by(Annotation.created_at)).all()
    return [
        {
            "id": a.id,
            "doc_id": a.doc_id,
            "text_excerpt": a.text_excerpt,
            "note": a.note,
            "tag": a.tag,
            "color": a.color,
            "created_at": a.created_at.isoformat()
        } for a in annotations
    ]


@router.delete("/{annotation_id}")
def delete_annotation(annotation_id: int, session: Session = Depends(get_session)):
    annotation = session.get(Annotation, annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
        
    session.delete(annotation)
    session.commit()
    logger.info(f"Deleted annotation {annotation_id}")
    return {"message": "Annotation deleted successfully"}
