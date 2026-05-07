const fs = require('fs');
const file = 'armageddon-site/tests/unit/api-run.test.ts';
let content = fs.readFileSync(file, 'utf8');

// I replaced vi.mock('../../src/lib/auth' with the new mock, but apparently broke the import. Let me restore the import.
content = `import { checkMembershipResponse, getRunAndVerifyAccess } from '../../src/lib/auth';\n` + content;
fs.writeFileSync(file, content);
