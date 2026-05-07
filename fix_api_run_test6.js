const fs = require('fs');
const file = 'armageddon-site/tests/unit/api-run.test.ts';
let content = fs.readFileSync(file, 'utf8');

// The issue is that authMocks is defined inside vi.hoisted but I need to make it accessible or just use the imported version
// since vi.mock will replace the import.
content = content.replace(/authMocks\.getRunAndVerifyAccess/g, "(getRunAndVerifyAccess as any)");
fs.writeFileSync(file, content);
