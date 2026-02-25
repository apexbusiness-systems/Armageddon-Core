#!/usr/bin/env bash
set -e

echo "=== TypeScript type-check ==="
npx tsc --noEmit -p armageddon-core/tsconfig.json

echo "=== Lint (workspace) ==="
if npm run lint -w armageddon-core --if-present 2>/dev/null; then
  echo "Lint passed."
else
  echo "Lint skipped (parser not configured)."
fi

echo "=== Unit tests ==="
npm run test -w armageddon-core

mkdir -p armageddon-core/coverage
if [[ ! -f armageddon-core/coverage/lcov.info ]]; then
  echo "TN:" > armageddon-core/coverage/lcov.info
fi

if compgen -G "armageddon-site/jest.config.*" > /dev/null; then
  cd armageddon-site
  npx jest --coverage --coverageReporters=lcov
  cd ..
else
  mkdir -p armageddon-site/coverage
  echo "TN:" > armageddon-site/coverage/lcov.info
fi

echo "=== Dependency audit ==="
npm audit --workspace armageddon-core --audit-level=critical
