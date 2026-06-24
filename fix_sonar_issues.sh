#!/bin/bash

# Remove intermediate js scripts since they're causing noise in SonarQube
rm -f adversarial_update.js
rm -f fix_api_run_test*.js
rm -f fix_db_rate_limit_build*.js
rm -f fix_lint.js
rm -f fix_reporter_test*.js
rm -f fix_typecheck.js
rm -f replace_batteries.js
rm -f replace_broadcast.js
rm -f replace_rate_limit_route.js
rm -f tap_lite_engine.js
rm -f update_engine_activities.js
rm -f update_evidence_generator.js
rm -f update_gate_*.js
rm -f update_reporter.js
rm -f update_route.js
rm -f update_temporal_activities.js
rm -f update_workflows*.js

# Fix 'import SupabaseReporter' unused in packages/core/tests/core/reporter.test.ts
sed -i '/import { SupabaseReporter } from/d' packages/core/tests/core/reporter.test.ts

# Fix duplicate '@armageddon/shared' imports in armageddon-site/src/app/api/run/route.ts
sed -i '15d' armageddon-site/src/app/api/run/route.ts

# Fix replaceAll vs replace in packages/core/src/core/engine/activities.ts
sed -i 's/\.replace(\/e\/g, /\.replaceAll(/g' packages/core/src/core/engine/activities.ts
sed -i 's/\.replace(\/a\/g, /\.replaceAll(/g' packages/core/src/core/engine/activities.ts
sed -i "s/(s: string) => s.replaceAll('3').replaceAll('@')/(s: string) => s.replaceAll('e', '3').replaceAll('a', '@')/" packages/core/src/core/engine/activities.ts

# Fix parseInt in packages/core/src/core/engine/activities.ts
sed -i 's/parseInt(/Number.parseInt(/g' packages/core/src/core/engine/activities.ts

# Fix `/[^0-9]/g` to `/\D/g` in packages/core/src/core/engine/activities.ts
sed -i 's/\[\^0-9\]/\\D/g' packages/core/src/core/engine/activities.ts

