# Trigger Armageddon Level 7 Workflow (MASSIVE PARALLEL TEST)
# 10,000 Iterations - GOD MODE
Write-Host "⚠️  WARNING: INITIATING CLASS 7 DESTRUCTION EVENT (10,000 ITERATIONS) ⚠️" -ForegroundColor Yellow
$confirmation = Read-Host "Are you sure? (y/N)"
if ($confirmation -ne 'y') { exit }

Write-Host "Launching Armageddon..."

docker exec armageddon-temporal temporal workflow start `
    --task-queue armageddon-level-7 `
    --type ArmageddonLevel7Workflow `
    --input '{\"runId\": \"GOD-MODE-001\", \"iterations\": 10000}' `
    --address armageddon-temporal:7233 `
    --namespace default

if ($?) {
    Write-Host "✅ GOD MODE INITIATED!" -ForegroundColor Red
    Write-Host "Monitor impact at: http://localhost:8080"
}
else {
    Write-Host "❌ Launch Failed."
}
