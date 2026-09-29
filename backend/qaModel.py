import pymupdf as fitz
import torch
from functools import lru_cache
from typing import List, Dict, Any

from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.llms import HuggingFacePipeline
from langchain.chains import RetrievalQA
from langchain_core.prompts import PromptTemplate
from langchain_core.documents import Document as LCDocument
from langchain.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain.retrievers import ContextualCompressionRetriever

from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline
from logger import get_logger

import warnings
warnings.filterwarnings("ignore", category=FutureWarning, module="huggingface_hub")
warnings.filterwarnings("ignore", category=UserWarning, module="transformers")

logger = get_logger(__name__)

DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
DTYPE = torch.float16 if DEVICE == 'cuda' else torch.float32

EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
QA_MODEL = "google/flan-t5-base"


def load_pdf_text_with_pages(file_path: str) -> List[Dict[str, Any]]:
    """
    Extract text per page, returning a list of {"page": int, "text": str} dicts.
    Page numbers are 1-indexed to match PDF viewer conventions.
    """
    pages = []
    with fitz.open(file_path) as doc:
        for i, page in enumerate(doc):
            text = page.get_text()
            if text.strip():
                pages.append({"page": i + 1, "text": text})
    if not pages:
        raise ValueError("PDF contains no readable text")
    logger.info(f"Extracted text from {len(pages)} pages")
    return pages


@lru_cache(maxsize=1)
def _get_embeddings() -> HuggingFaceEmbeddings:
    """Cache the embedding model — loaded once for the entire process lifetime."""
    logger.info(f"Loading embedding model: {EMBED_MODEL}")
    return HuggingFaceEmbeddings(
        model_name=EMBED_MODEL,
        model_kwargs={"device": DEVICE}
    )


def create_faiss_index(pages: List[Dict[str, Any]]) -> FAISS:
    """
    Build a FAISS vector index from a list of page dicts.
    Each chunk carries page-number metadata for source citation.
    """
    logger.info("Initialising text splitter...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    all_docs: List[LCDocument] = []
    for page_info in pages:
        chunks = splitter.create_documents(
            [page_info["text"]],
            metadatas=[{"page": page_info["page"]}],
        )
        all_docs.extend(chunks)

    logger.info(f"Created {len(all_docs)} document chunks")
    faiss_db = FAISS.from_documents(documents=all_docs, embedding=_get_embeddings())
    logger.info("FAISS vector database built successfully")
    return faiss_db


@lru_cache(maxsize=1)
def _get_qa_pipeline() -> HuggingFacePipeline:
    """
    Load and cache the Flan-T5 inference pipeline.
    Separated from chain creation so the expensive model load happens only once,
    while the retriever can be swapped per-document cheaply.
    """
    logger.info(f"Loading Q&A model: {QA_MODEL}")
    tokenizer = AutoTokenizer.from_pretrained(QA_MODEL, model_max_length=2048)
    model = AutoModelForSeq2SeqLM.from_pretrained(QA_MODEL, dtype=DTYPE).to(DEVICE)
    pipe = pipeline(
        "text2text-generation",
        model=model,
        tokenizer=tokenizer,
        max_new_tokens=1024,
        truncation=True,
        do_sample=True,
        temperature=0.3,
        top_p=0.95,
        device=0 if DEVICE == "cuda" else -1,
    )
    logger.info("Flan-T5 Q&A model ready")
    return HuggingFacePipeline(pipeline=pipe)


@lru_cache(maxsize=1)
def _get_reranker() -> HuggingFaceCrossEncoder:
    """Load and cache the cross-encoder reranker model."""
    logger.info(f"Loading Reranker model: {RERANKER_MODEL}")
    return HuggingFaceCrossEncoder(
        model_name=RERANKER_MODEL,
        model_kwargs={"device": DEVICE}
    )


def initialize_qa_system(db: FAISS) -> RetrievalQA:
    """
    Assemble a RetrievalQA chain using the cached pipeline + a fresh retriever.
    This is fast because the model itself is already loaded via _get_qa_pipeline().
    """
    llm = _get_qa_pipeline()

    prompt_template = """Answer the question based on the context below.
Be extremely precise and concise. Do not include unnecessary information.
Use a markdown bulleted list if providing multiple points.
Format mathematical variables using LaTeX (e.g. $x_i$).

Context: {context}

Question: {question}

Answer:"""

    prompt = PromptTemplate(template=prompt_template, input_variables=["context", "question"])

    # Fetch top 15 chunks broadly using FAISS
    base_retriever = db.as_retriever(search_kwargs={"k": 15})

    # Score and filter down to the top 3 best chunks
    compressor = CrossEncoderReranker(model=_get_reranker(), top_n=3)
    
    rerank_retriever = ContextualCompressionRetriever(
        base_compressor=compressor,
        base_retriever=base_retriever
    )

    return RetrievalQA.from_chain_type(
        llm=llm,
        retriever=rerank_retriever,
        chain_type="stuff",
        return_source_documents=True,
        chain_type_kwargs={"prompt": prompt},
    )

def postprocess_math(text: str) -> str:
    """Heuristic to format text properly and wrap standalone math equations in $$ for LaTeX rendering."""
    import re
    
    # 1. Format bullet points to ensure they render as a list
    text = text.replace('•', '\n\n* ')
    
    # 2. Add newlines after colons if they introduce a list
    text = re.sub(r':\s*(?=\*)', ':\n\n', text)

    lines = text.split('\n')
    for i, line in enumerate(lines):
        # Look for equals signs and math operators on lines with very few standard words
        if '=' in line and any(op in line for op in ['+', '-', '*', '/', 'max', 'min']) and '$' not in line:
            # Count words composed purely of alphabetical characters
            words = re.findall(r'\b[a-zA-Z]{4,}\b', line)
            if len(words) < 4:
                lines[i] = f"$${line.strip()}$$"
    
    processed = '\n'.join(lines)
    
    # Clean up excessive newlines
    processed = re.sub(r'\n{3,}', '\n\n', processed)
    processed = processed.strip()
    
    # Fix common flattened variables from PDFs, avoiding common words
    def subscript_replacer(match):
        word = match.group(0)
        if word.lower() in ["hi", "ok", "bi", "dj"]:
            return word
        return f"${match.group(1)}_{match.group(2)}$"
        
    processed = re.sub(r'\b([a-zA-Z])([ijk0-9])\b', subscript_replacer, processed)
    # Special cases for this paper
    processed = re.sub(r'\bRd\b', r'$\\mathbb{R}^d$', processed)
    
    return processed

