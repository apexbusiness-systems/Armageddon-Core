#!/usr/bin/env bash
set -e

npx tsc --noEmit
npx eslint . --max-warnings 0

cd armageddon-core
npx vitest run --coverage --coverage.reporter=lcov
cd ..

if compgen -G "armageddon-site/jest.config.*" > /dev/null; then
  cd armageddon-site
  npx jest --coverage --coverageReporters=lcov
  cd ..
else
  mkdir -p armageddon-site/coverage
  echo "TN:" > armageddon-site/coverage/lcov.info
fi

npm audit --workspace armageddon-core --audit-level=critical
