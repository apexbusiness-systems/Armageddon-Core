docker-compose restart temporal
Write-Host "Waiting 20 seconds for Temporal to initialize..."
Start-Sleep -Seconds 20
docker-compose logs --tail=50 temporal
docker-compose up -d worker
Start-Sleep -Seconds 5
docker-compose logs --tail=20 worker
