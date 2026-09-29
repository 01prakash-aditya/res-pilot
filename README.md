# ResPilot

ResPilot is a GPU-accelerated local research assistant designed to turn dense academic papers into digestible summaries, evidence trails, seamless translations, and context-aware answers.

## The Idea Behind ResPilot

Academic papers are often dense, lengthy, and filled with domain-specific jargon. Researchers waste hours parsing through documents to extract core methodologies, key findings, and specific data points. ResPilot was created to solve this bottleneck.

By leveraging state-of-the-art open-source NLP models running locally, ResPilot guarantees data privacy while providing powerful AI-assisted research tools. It reads your PDFs, builds a semantic search index, generates comprehensive hierarchical summaries, and allows you to interrogate the text through an interactive Retrieval-Augmented Generation (RAG) system.

## System Architecture

The following diagram illustrates how the frontend interacts with the local FastAPI backend and the underlying local AI models.

```mermaid
flowchart TD
    subgraph Frontend [React + Vite UI]
        UI_Upload[PDF Uploader]
        UI_Summary[Summary & Translation View]
        UI_QA[Q&A Interface]
    end

    subgraph Backend [FastAPI Server]
        API_Upload[Upload Endpoint]
        API_Summary[Analysis Endpoint]
        API_QA[Q&A Endpoint]
        DB[(SQLite / SQLModel)]
        FAISS[(FAISS Vector DB)]
        
        subgraph Local AI Models
            BART[BART-Large-CNN\nSummarization]
            T5[Flan-T5-Base\nRAG Q&A]
            Embed[MiniLM-L6-v2\nEmbeddings]
            Rerank[MS-MARCO-MiniLM\nCross-Encoder]
            Translate[Helsinki-NLP\nTranslation]
        end
    end

    UI_Upload -->|1. Upload PDF| API_Upload
    API_Upload -->|2. Store Metadata| DB
    API_Upload -->|3. Extract Text| Embed
    Embed -->|4. Chunk & Embed| FAISS
    API_Upload -->|5. Full Text| BART
    BART -->|6. Save Summary| DB
    
    UI_Summary -->|7. Fetch Summary| API_Summary
    API_Summary -->|8. Request Translation| Translate
    
    UI_QA -->|9. Ask Question| API_QA
    API_QA -->|10. Broad Fetch (15 Chunks)| FAISS
    FAISS -->|11. Filter to Top 3| Rerank
    Rerank -->|12. Context + Question| T5
    T5 -->|13. Grounded Answer| UI_QA
```

## Core Features

### 1. Document Summarization
Upload any PDF, and ResPilot will automatically parse it, filter out academic noise (like headers and citations), chunk it, and run it through `facebook/bart-large-cnn`. For long documents, it uses a hierarchical summarization technique to generate a clean, highly formatted, paragraph-based overview of the entire paper.

### 2. Context-Aware Q&A (RAG)
Stop using Ctrl+F. ResPilot chunks your document and stores it in a FAISS vector database using `all-MiniLM-L6-v2` embeddings. When you ask a question, the backend retrieves a broad set of paragraphs from FAISS, scores and filters them down to the most highly relevant chunks using a `ms-marco-MiniLM-L-6-v2` **Cross-Encoder Reranker**, and feeds only the absolute best context to `google/flan-t5-base`. The result is a precise, concise, and structured answer (complete with LaTeX math rendering and markdown formatting) grounded strictly in the source text.

### 3. Multi-Language Translation
Need to read a summary in another language? ResPilot uses the `Helsinki-NLP/opus-mt` model family to translate summaries into 11+ languages on the fly, entirely offline.

### 4. GPU Acceleration & Privacy
All models run locally on your machine. No API keys, no data sharing, and no subscription fees. If an NVIDIA GPU is detected, ResPilot automatically offloads tensor computations via CUDA to drastically reduce processing times.

## Application Screenshots

**Main Dashboard & Document Library**
![Dashboard](screenshots/Screenshot%202026-09-29%20130237.png)

**Document Summary & Analysis**
![Summary View](screenshots/Screenshot%202026-09-29%20130249.png)

**Multi-Language Translation**
![Translation](screenshots/Screenshot%202026-09-29%20130257.png)

**Interactive Q&A Session**
![QA Session](screenshots/Screenshot%202026-09-29%20130324.png)

**Model Loading & Processing Details**
![Processing](screenshots/Screenshot%202026-09-29%20133732.png)

## Technology Stack

**Frontend:**
- React 18
- Vite
- TailwindCSS
- Axios (for API communication)

**Backend:**
- Python 3.9+
- FastAPI (REST API)
- PyTorch (Tensor operations & CUDA)
- HuggingFace Transformers (Model inference)
- LangChain (Text chunking and RAG orchestration)
- FAISS (Local vector store)
- SQLModel / SQLite (Metadata persistence)
- PyMuPDF (PDF text extraction)

## Installation & Setup

### Prerequisites
- Python 3.9 or higher
- Node.js 16 or higher
- Minimum 8GB RAM (16GB recommended)
- 5GB free storage for AI models (downloaded automatically on first run)
- (Optional but Highly Recommended) NVIDIA GPU with 6GB+ VRAM for CUDA acceleration.

### Quick Setup

ResPilot includes a PowerShell setup script that creates the virtual environment, installs backend dependencies, and installs frontend node modules.

Open a PowerShell terminal in the root directory and run:
```powershell
.\setup.ps1
```

*Note: If you have an NVIDIA GPU, install the CUDA version of PyTorch in the backend virtual environment for maximum performance:*
```powershell
cd backend
.\.venv\Scripts\activate
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

## Running the Application

To launch both the backend and frontend simultaneously, use the provided run script from the root directory:
```powershell
.\run.ps1
```
This will open two separate terminal windows. The frontend will be available in your browser at `http://localhost:5173`.

Alternatively, you can run them manually:

**Backend:**
```powershell
cd backend
.\.venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```powershell
cd frontend
npm run dev
```

## API Reference

### Document Management
- `POST /api/upload` - Upload and queue a PDF for processing
- `GET /api/files` - List all uploaded documents and their statuses
- `GET /api/file-info/{doc_id}` - Retrieve metadata for a specific document
- `DELETE /api/delete/{doc_id}` - Delete a document, its FAISS index, and database records

### AI Operations
- `GET /api/analyze/{doc_id}` - Retrieve the generated hierarchical summary
- `POST /api/translate/{doc_id}` - Translate a summary (Accepts `{"target_lang": "es"}`)
- `POST /api/qa/{doc_id}` - Query the document using RAG (Accepts `{"question": "What is the methodology?"}`)
- `GET /api/progress/{doc_id}` - Server-Sent Events (SSE) stream for real-time processing progress

## Limitations

- By default, PDF uploads are limited to 50MB.
- RAG generation accuracy is dependent on the `Flan-T5-Base` model capabilities.
- Inference on CPU can be slow; a dedicated GPU is strongly recommended for a smooth user experience.