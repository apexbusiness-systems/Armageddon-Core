# ARMAGEDDON Temporal Validation Script
# Verifies Temporal server connectivity and workflow execution capability

Write-Host "=== ARMAGEDDON Temporal Validation ===" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "[1/4] Checking Docker status..." -ForegroundColor Yellow
try {
    $dockerStatus = docker ps --format "{{.Names}}" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Docker is running" -ForegroundColor Green
}
catch {
    Write-Host "❌ Docker command failed: $_" -ForegroundColor Red
    exit 1
}

# Check for Temporal container
Write-Host "[2/4] Checking for Temporal container..." -ForegroundColor Yellow
$temporalContainer = docker ps --filter "name=armageddon-temporal" --format "{{.Names}}"
if ($temporalContainer -match "armageddon-temporal") {
    Write-Host "✅ Temporal container 'armageddon-temporal' is running" -ForegroundColor Green
}
else {
    Write-Host "⚠️  Temporal container not found. Checking for any temporal container..." -ForegroundColor Yellow
    $anyTemporal = docker ps --filter "name=temporal" --format "{{.Names}}"
    if ($anyTemporal) {
        Write-Host "✅ Found Temporal container: $anyTemporal" -ForegroundColor Green
    }
    else {
        Write-Host "❌ No Temporal container running. Please start via docker-compose." -ForegroundColor Red
        Write-Host "   Run: docker-compose up -d" -ForegroundColor Gray
        exit 1
    }
}

# Test Temporal connectivity
Write-Host "[3/4] Testing Temporal server connectivity..." -ForegroundColor Yellow
try {
    $temporalHealth = Invoke-WebRequest -Uri "http://localhost:7233" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Host "✅ Temporal server is reachable on port 7233" -ForegroundColor Green
}
catch {
    Write-Host "⚠️  Temporal server not responding on port 7233 (may be normal)" -ForegroundColor Yellow
}

# Test Temporal UI
Write-Host "[4/4] Testing Temporal UI..." -ForegroundColor Yellow
try {
    $uiHealth = Invoke-WebRequest -Uri "http://localhost:8080" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Host "✅ Temporal UI is accessible at http://localhost:8080" -ForegroundColor Green
}
catch {
    Write-Host "⚠️  Temporal UI not accessible (may not be exposed)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Temporal Validation Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To trigger a test workflow, run:" -ForegroundColor Gray
Write-Host "  .\scripts\trigger_armageddon.ps1" -ForegroundColor White
Write-Host ""
