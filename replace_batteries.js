const fs = require('fs');
const file = 'armageddon-site/src/app/api/run/route.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace imports
content = content.replace(
    "import { checkMembershipResponse, getRunAndVerifyAccess } from '@/lib/auth';",
    "import { checkMembershipResponse, getRunAndVerifyAccess } from '@/lib/auth';\nimport { DEFAULT_BATTERIES } from '@armageddon/shared';"
);

// Replace default validated batteries
content = content.replace(
    "let validatedBatteries: string[] = ['B10', 'B11', 'B12', 'B13']; // Default: all batteries",
    "let validatedBatteries: string[] = DEFAULT_BATTERIES;"
);

// Replace regex pattern
content = content.replace(
    "const validPattern = /^B1[0-3]$/;",
    "const validPattern = /^B1[0-4]$/;"
);

// Replace error message
content = content.replace(
    "Allowed: B10, B11, B12, B13`",
    "Allowed: ${DEFAULT_BATTERIES.join(', ')}`"
);

fs.writeFileSync(file, content);
