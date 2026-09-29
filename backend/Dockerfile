FROM python:3.11-slim

WORKDIR /app

# System deps for PyMuPDF, faiss, torch (CPU)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgomp1 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Torch CPU-only (avoids pulling the full CUDA wheel in Docker)
RUN pip install --no-cache-dir \
    torch==2.6.0+cpu torchvision==0.21.0+cpu torchaudio==2.6.0+cpu \
    --index-url https://download.pytorch.org/whl/cpu

COPY . .

RUN mkdir -p files indexes logs

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
