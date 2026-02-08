# IMPERATIVE KILL SWITCH
# Protocol SEV-1.2: Containment Breach Response

Write-Host "🚨 ACTIVATING KILL SWITCH..." -ForegroundColor Red

# 1. Stop all containers immediately
docker-compose -f docker-compose.moat.yml stop

# 2. Force remove containers to ensure no zombie processes
docker-compose -f docker-compose.moat.yml rm -f -s

Write-Host "✅ CONTAINMENT SECURED. All services terminated." -ForegroundColor Green
Write-Host "   Timestamp: $(Get-Date)" -ForegroundColor Gray
