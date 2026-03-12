# Infrastructure Patterns — OmniDev-V2 Reference

## Docker Multi-Stage (Node.js)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 app && adduser -u 1001 -G app -s /bin/sh -D app
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
USER app
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Docker Multi-Stage (Python)
```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt
COPY . .

FROM python:3.12-slim
WORKDIR /app
RUN useradd -r -s /bin/false app
COPY --from=builder /install /usr/local
COPY --from=builder --chown=app:app /app .
USER app
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: app
  template:
    spec:
      containers:
      - name: app
        image: app:v1.0.0  # NEVER use :latest
        resources:
          requests: { memory: "128Mi", cpu: "100m" }
          limits: { memory: "256Mi", cpu: "500m" }
        livenessProbe:
          httpGet: { path: /health, port: 8080 }
          initialDelaySeconds: 10
        readinessProbe:
          httpGet: { path: /ready, port: 8080 }
        securityContext:
          runAsNonRoot: true
          readOnlyRootFilesystem: true
```

## GitHub Actions CI/CD
```yaml
name: CI/CD
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test -- --coverage
      - run: npm audit --audit-level=high
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      # Deploy step varies by target
```

## Scale Reference
| Scale | Architecture | Stack |
|-------|-------------|-------|
| 0-1K users | Monolith | Single server + managed DB |
| 1K-100K | Modular monolith | Load balancer + DB replicas + Redis |
| 100K-1M | Microservices | K8s + service mesh + CDN + cache |
| >1M | Event-driven micro | Multi-region + CQRS + event sourcing |
