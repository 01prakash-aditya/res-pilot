import os
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Dict, Any

from langchain_community.vectorstores import FAISS
from langchain.prompts import PromptTemplate
from langchain.chains import RetrievalQA

from database import get_session, Document
from qaModel import _get_qa_pipeline, _get_embeddings
from logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/compare", tags=["Compare"])

BASE_DIR = Path(__file__).parent
INDEX_DIR = BASE_DIR / "indexes"

class CompareRequest(BaseModel):
    doc_ids: List[str]
    questions: List[str] = ["What is the main methodology?", "What are the key findings?", "What are the limitations mentioned?"]

class CompareQARequest(BaseModel):
    doc_ids: List[str]
    question: str

def _load_and_merge_indexes(doc_ids: List[str]) -> FAISS:
    merged_index = None
    
    for doc_id in doc_ids:
        index_path = INDEX_DIR / doc_id
        if not index_path.exists():
            raise HTTPException(status_code=404, detail=f"FAISS index for doc {doc_id} not found")
            
        try:
            db = FAISS.load_local(str(index_path), _get_embeddings(), allow_dangerous_deserialization=True)
            if merged_index is None:
                merged_index = db
            else:
                merged_index.merge_from(db)
        except Exception as e:
            logger.error(f"Failed to load index for {doc_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to merge indices")
            
    return merged_index

@router.post("")
async def compare_documents(data: CompareRequest, session: Session = Depends(get_session)):
    if len(data.doc_ids) < 2 or len(data.doc_ids) > 5:
        raise HTTPException(status_code=400, detail="Select 2 to 5 documents to compare")
        
    results = {doc_id: {} for doc_id in data.doc_ids}
    import asyncio
    from langchain_community.vectorstores import FAISS
    from qaModel import initialize_qa_system
    import torch
    
    async def get_answer(doc_id: str, q: str):
        index_path = INDEX_DIR / doc_id
        if not index_path.exists():
            return "Document index not found."
        
        try:
            db = FAISS.load_local(str(index_path), _get_embeddings(), allow_dangerous_deserialization=True)
            qa = initialize_qa_system(db)
            with torch.inference_mode():
                # Run the model inference in a separate thread so we can do multiple concurrently
                res = await asyncio.to_thread(qa.invoke, {"query": q})
            return res["result"]
        except Exception as e:
            logger.error(f"Error answering '{q}' for {doc_id}: {e}")
            return "Failed to process question."

    tasks = []
    task_info = []
    
    # We queue up all questions for all documents concurrently
    for doc_id in data.doc_ids:
        for q in data.questions:
            tasks.append(get_answer(doc_id, q))
            task_info.append((doc_id, q))
            
    answers = await asyncio.gather(*tasks)
    
    for (doc_id, q), ans in zip(task_info, answers):
        results[doc_id][q] = ans
        
    return {"comparison": results}

@router.post("/qa")
def compare_qa(data: CompareQARequest, session: Session = Depends(get_session)):
    if len(data.doc_ids) < 2:
        raise HTTPException(status_code=400, detail="Select at least 2 documents to compare")
        
    merged_index = _load_and_merge_indexes(data.doc_ids)
    llm = _get_qa_pipeline()
    
    prompt_template = """Answer the question based on the context below. The context is from multiple documents.
Cite your sources by referring to the specific document IDs or names where appropriate.

Context: {context}
Question: {question}
Answer in detail:"""
    
    prompt = PromptTemplate(template=prompt_template, input_variables=["context", "question"])
    
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=merged_index.as_retriever(search_kwargs={"k": 5}),
        chain_type="stuff",
        return_source_documents=True,
        chain_type_kwargs={"prompt": prompt}
    )
    
    result = qa_chain.invoke({"query": data.question})
    
    sources = []
    for doc in result.get("source_documents", []):
        sources.append({
            "page": doc.metadata.get("page", 0) + 1,
            "text": doc.page_content[:200] + "...",
            "doc_id": doc.metadata.get("doc_id", "Unknown") # Need to ensure doc_id was set in metadata at index time
        })
        
    return {
        "answer": result.get("result", ""),
        "sources": sources
    }
