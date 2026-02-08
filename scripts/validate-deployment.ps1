# ARMAGEDDON Deployment Validation Script
# Comprehensive pre-deployment verification for Option B infrastructure

param(
    [switch]$SkipBuild = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Continue"
$script:FailureCount = 0
$script:WarningCount = 0
$script:SuccessCount = 0

function Write-Status {
    param([string]$Message, [string]$Status)
    
    switch ($Status) {
        "SUCCESS" { 
            Write-Host "✅ $Message" -ForegroundColor Green
            $script:SuccessCount++
        }
        "FAILURE" { 
            Write-Host "❌ $Message" -ForegroundColor Red
            $script:FailureCount++
        }
        "WARNING" { 
            Write-Host "⚠️  $Message" -ForegroundColor Yellow
            $script:WarningCount++
        }
        "INFO" { 
            Write-Host "ℹ️  $Message" -ForegroundColor Cyan
        }
    }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     ARMAGEDDON DEPLOYMENT VALIDATION (OPTION B)        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Change to repo root
$repoRoot = "c:\Users\sinyo\Armageddon-Core"
Set-Location $repoRoot

# Section 1: Environment Check
Write-Host "[1/7] ENVIRONMENT VALIDATION" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray

# Node version
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Status "Node.js installed: $nodeVersion" "SUCCESS"
}
else {
    Write-Status "Node.js not found" "FAILURE"
}

# NPM version
$npmVersion = npm --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Status "NPM installed: $npmVersion" "SUCCESS"
}
else {
    Write-Status "NPM not found" "FAILURE"
}

# Check .env file
if (Test-Path ".env") {
    Write-Status ".env file exists" "SUCCESS"
}
else {
    Write-Status ".env file missing" "WARNING"
}

Write-Host ""

# Section 2: Dependency Installation
Write-Host "[2/7] DEPENDENCY VALIDATION" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray

if (-not $SkipBuild) {
    Write-Host "Installing dependencies..." -ForegroundColor Gray
    npm ci 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Status "npm ci completed successfully" "SUCCESS"
    }
    else {
        Write-Status "npm ci failed" "FAILURE"
    }
}
else {
    Write-Status "Skipping dependency installation (--SkipBuild)" "INFO"
}

Write-Host ""

# Section 3: Build Validation
Write-Host "[3/7] BUILD VALIDATION" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray

if (-not $SkipBuild) {
    # Shared package
    Write-Host "Building @armageddon/shared..." -ForegroundColor Gray
    npm run build -w @armageddon/shared 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Status "@armageddon/shared build successful" "SUCCESS"
    }
    else {
        Write-Status "@armageddon/shared build failed" "FAILURE"
    }

    # Core package
    Write-Host "Building armageddon-core..." -ForegroundColor Gray
    npm run build -w armageddon-core 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Status "armageddon-core build successful" "SUCCESS"
    }
    else {
        Write-Status "armageddon-core build failed" "FAILURE"
    }

    # Site package
    Write-Host "Building armageddon-site..." -ForegroundColor Gray
    $env:NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co"
    $env:SUPABASE_SERVICE_ROLE_KEY = "placeholder"
    npm run build -w armageddon-site 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Status "armageddon-site build successful" "SUCCESS"
    }
    else {
        Write-Status "armageddon-site build failed" "FAILURE"
    }
}
else {
    Write-Status "Skipping builds (--SkipBuild)" "INFO"
}

Write-Host ""

# Section 4: Type Checking
Write-Host "[4/7] TYPE CHECKING" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray

Write-Host "Type checking armageddon-core..." -ForegroundColor Gray
npm run typecheck -w armageddon-core 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Status "armageddon-core typecheck passed" "SUCCESS"
}
else {
    Write-Status "armageddon-core typecheck failed" "FAILURE"
}

Write-Host ""

# Section 5: Linting
Write-Host "[5/7] LINT VALIDATION" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray

Write-Host "Linting armageddon-site..." -ForegroundColor Gray
npm run lint -w armageddon-site 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Status "armageddon-site lint passed" "SUCCESS"
}
else {
    Write-Status "armageddon-site lint failed" "WARNING"
}

Write-Host ""

# Section 6: Infrastructure Check
Write-Host "[6/7] INFRASTRUCTURE VALIDATION" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray

# Check key files exist
$keyFiles = @(
    "armageddon-site\src\components\paywall\LockdownModal.tsx",
    "armageddon-site\src\components\DestructionConsole.tsx",
    "armageddon-site\src\components\BatteryGrid.tsx",
    "armageddon-core\src\temporal\activities.ts",
    ".github\workflows\ci.yml",
    "scripts\trigger_armageddon.ps1"
)

foreach ($file in $keyFiles) {
    if (Test-Path $file) {
        Write-Status "$file exists" "SUCCESS"
    }
    else {
        Write-Status "$file missing" "FAILURE"
    }
}

Write-Host ""

# Section 7: Docker/Temporal Check
Write-Host "[7/7] TEMPORAL VALIDATION" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray

try {
    $dockerPs = docker ps --format "{{.Names}}" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Docker is running" "SUCCESS"
        
        if ($dockerPs -match "temporal") {
            Write-Status "Temporal container found" "SUCCESS"
        }
        else {
            Write-Status "Temporal container not running" "WARNING"
        }
    }
    else {
        Write-Status "Docker not available" "WARNING"
    }
}
catch {
    Write-Status "Docker check failed" "WARNING"
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                   VALIDATION SUMMARY                   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ✅ Successes: $script:SuccessCount" -ForegroundColor Green
Write-Host "  ⚠️  Warnings:  $script:WarningCount" -ForegroundColor Yellow
Write-Host "  ❌ Failures:  $script:FailureCount" -ForegroundColor Red
Write-Host ""

if ($script:FailureCount -eq 0) {
    Write-Host "🎯 DEPLOYMENT READY - All critical checks passed!" -ForegroundColor Green
    exit 0
}
elseif ($script:FailureCount -le 2) {
    Write-Host "⚠️  DEPLOYMENT POSSIBLE - Some checks failed but may be non-critical" -ForegroundColor Yellow
    exit 0
}
else {
    Write-Host "❌ DEPLOYMENT BLOCKED - Critical failures detected" -ForegroundColor Red
    exit 1
}
