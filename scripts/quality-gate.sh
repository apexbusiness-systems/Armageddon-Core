#!/usr/bin/env bash
set -e

npx tsc --noEmit
npx eslint . --max-warnings 0

cd apps/core
npx jest --coverage --coverageReporters=lcov
cd ../..

if compgen -G "apps/omnihub-site/jest.config.*" > /dev/null; then
  cd apps/omnihub-site
  npx jest --coverage --coverageReporters=lcov
  cd ../..
else
  mkdir -p apps/omnihub-site/coverage
  echo "TN:" > apps/omnihub-site/coverage/lcov.info
fi

npm audit --audit-level=critical
