$ErrorActionPreference = "Stop"

$scriptPath = $PSScriptRoot

Write-Host "Starting Backend Server..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath\backend'; .\.venv\Scripts\activate; uvicorn main:app --reload --host 0.0.0.0 --port 8000"

Write-Host "Starting Frontend Server..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath\frontend'; npm run dev"

Write-Host "Both servers started in separate windows."
