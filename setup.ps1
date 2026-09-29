$ErrorActionPreference = "Stop"

Write-Host "Setting up Frontend..."
cd frontend
npm install

Write-Host "Setting up Backend..."
cd ..\backend
if (-not (Test-Path ".venv")) {
    python -m venv .venv
}
.venv\Scripts\activate
pip install -r requirements.txt

Write-Host "Setup complete. To start the servers:"
Write-Host "Frontend: cd frontend; npm run dev"
Write-Host "Backend: cd backend; .\.venv\Scripts\activate; uvicorn main:app --reload --host 0.0.0.0 --port 8000"
