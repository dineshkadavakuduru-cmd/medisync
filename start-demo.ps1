# MediSync — Start Demo Script (Windows)
# Launches all services in the correct order for SIH 2026 demo

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  MediSync — SIH 2026 Demo Launcher" -ForegroundColor Cyan
Write-Host "  PS26133 | Government of Maharashtra" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "C:\Users\Lenovo\ArogyaSetu+\arogyasetu-plus"

# Step 1: Check PostgreSQL
Write-Host "[1/5] Checking PostgreSQL..." -ForegroundColor Yellow
try {
    $pgCheck = Get-Command psql -ErrorAction SilentlyContinue
    if ($pgCheck) {
        Write-Host "  PostgreSQL client found." -ForegroundColor Green
    } else {
        Write-Host "  WARNING: psql not found in PATH. Ensure PostgreSQL is running." -ForegroundColor Red
    }
} catch {
    Write-Host "  WARNING: Could not verify PostgreSQL." -ForegroundColor Red
}

# Step 2: Start Server (Fastify API on port 3001)
Write-Host ""
Write-Host "[2/5] Starting MediSync API Server (port 3001)..." -ForegroundColor Yellow
$serverPath = Join-Path $projectRoot "server"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$serverPath'; `$env:ENABLE_SIMULATOR='true'; npm run dev" -WindowStyle Normal
Write-Host "  Server starting... (waiting 5 seconds)" -ForegroundColor Gray
Start-Sleep -Seconds 5

# Step 3: Start ML Service (FastAPI on port 8000)
Write-Host ""
Write-Host "[3/5] Starting ML Triage Service (port 8000)..." -ForegroundColor Yellow
$mlPath = Join-Path $projectRoot "ml"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$mlPath'; pip install -r requirements.txt; python -m uvicorn api.main:app --port 8000 --reload" -WindowStyle Normal
Write-Host "  ML Service starting... (waiting 5 seconds)" -ForegroundColor Gray
Start-Sleep -Seconds 5

# Step 4: Start Web App (Next.js on port 3000)
Write-Host ""
Write-Host "[4/5] Starting Web Dashboard (port 3000)..." -ForegroundColor Yellow
$webPath = Join-Path $projectRoot "apps\web"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$webPath'; npm run dev" -WindowStyle Normal
Write-Host "  Web App starting... (waiting 8 seconds)" -ForegroundColor Gray
Start-Sleep -Seconds 8

# Step 5: Start Mobile App (Expo)
Write-Host ""
Write-Host "[5/5] Starting Mobile App (Expo)..." -ForegroundColor Yellow
$mobilePath = Join-Path $projectRoot "apps\mobile"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$mobilePath'; npx expo start" -WindowStyle Normal
Write-Host "  Mobile App starting..." -ForegroundColor Gray

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  All services launched!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  API Server:     http://localhost:3001" -ForegroundColor White
Write-Host "  ML Service:     http://localhost:8000" -ForegroundColor White
Write-Host "  Web Dashboard:  http://localhost:3000" -ForegroundColor White
Write-Host "  Mobile App:     Expo DevTools (scan QR)" -ForegroundColor White
Write-Host ""
Write-Host "  Landing Page:   http://localhost:3000/welcome" -ForegroundColor White
Write-Host "  API Docs:       http://localhost:3001/api/health" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C in any window to stop that service." -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor Green
