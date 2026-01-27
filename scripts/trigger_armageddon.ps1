# Trigger Armageddon Level 7 Workflow (Smoke Test)
Write-Host "Triggering Armageddon Level 7 Workflow..."

docker exec armageddon-temporal temporal workflow start `
    --task-queue armageddon-level-7 `
    --type ArmageddonLevel7Workflow `
    --input '{\"runId\": \"MANUAL-RUN\", \"iterations\": 1}' `
    --address armageddon-temporal:7233 `
    --namespace default

if ($?) {
    Write-Host "✅ Workflow Triggered Successfully!" -ForegroundColor Green
    Write-Host "View Dashboard: http://localhost:8080"
}
else {
    Write-Host "❌ Failed to trigger workflow." -ForegroundColor Red
}
