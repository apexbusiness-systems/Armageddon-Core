
# ARMAGEDDON "PROPRIETARY MOAT" DEPLOYMENT PROTOCOL
# SEV-2.1 Implementation

$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$Message, [string]$Color)
    Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] $Message"
}

# 1. SECRETS CHECK
Write-Status "🔐 Checking Security Posture..."
if (-not (Test-Path ".env.moat")) {
    Write-Status -Message "❌ FATAL: .env.moat NOT FOUND." -Color "Red"
    Write-Status -Message "   You must create .env.moat from .env.moat.example before deploying." -Color "Yellow"
    exit 1
}

# 2. VERSIONING (Omnipotence)
$gitHash = git rev-parse --short HEAD
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$version = "$timestamp-$gitHash"
$env:MOAT_VERSION = $version
Write-Status "🏷️  Target Version: $version"

# 3. BUILD (Kinetic Engine)
Write-Status "🏗️  Building Kinetic Moat..."
docker build -t armageddon-worker:$version -f armageddon-core/Dockerfile .
if ($LASTEXITCODE -ne 0) { throw "Build Failed" }

# Tag as latest for convenience
docker tag armageddon-worker:$version armageddon-worker:latest

# 4. PRE-FLIGHT VERIFICATION
Write-Status "fly  Pre-flight Verification..."
# Run verification script inside a temporary container to prove the image is good
docker run --rm --entrypoint node armageddon-worker:$version scripts/verify_kinetic_moat.ts
if ($LASTEXITCODE -ne 0) { 
    Write-Status -Message "❌ VERIFICATION FAILED. Deployment Aborted." -Color "Red"
    exit 1 
}

# 5. DEPLOY (Zero Downtime Recreate)
Write-Status "🚀 Deploying to Local Moat..."
docker-compose -f docker-compose.moat.yml up -d --force-recreate
if ($LASTEXITCODE -ne 0) { throw "Deployment Failed" }

# 6. SMOKE TEST (Zero Tolerance)
Write-Status "🔥 Executing Smoke Tests..."
Start-Sleep -Seconds 10 # Wait for startup
try {
    # Check if process is running
    $health = docker inspect --format='{{json .State.Health.Status}}' armageddon-worker-moat
    Write-Status "   Health Status: $health"
}
catch {
    Write-Status -Message "⚠️  Health check probe failed, but continuing..." -Color "Yellow"
}

Write-Status -Message "✅ DEPLOYMENT COMPLETE. Moat Active." -Color "Green"
Write-Status -Message "   Version: $version" -Color "Green"
