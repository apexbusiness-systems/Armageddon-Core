const fs = require('fs');
const file = 'armageddon-site/tests/unit/api-run.test.ts';
let content = fs.readFileSync(file, 'utf8');

// The best way to mock modules in vitest is vi.mock before imports
content = content.replace(
    /import \{ checkMembershipResponse, getRunAndVerifyAccess \} from '\.\.\/\.\.\/src\/lib\/auth';\n/,
    ""
);

const newMock = `import { checkMembershipResponse, getRunAndVerifyAccess } from '../../src/lib/auth';
vi.mock('../../src/lib/auth', () => ({
    checkMembershipResponse: vi.fn().mockResolvedValue({
        supabase: {
            from: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null })
        }
    }),
    getRunAndVerifyAccess: vi.fn()
}));`;

content = content.replace(
    /const authMocks = vi\.hoisted\(\(\) => \(\{[\s\S]*?\}\)\);\n\nvi\.mock\('\.\.\/\.\.\/src\/lib\/auth', \(\) => authMocks\);\n/,
    newMock
);

fs.writeFileSync(file, content);
