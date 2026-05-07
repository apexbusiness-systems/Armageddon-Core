const fs = require('fs');
const file = 'armageddon-site/tests/unit/api-run.test.ts';
let content = fs.readFileSync(file, 'utf8');

// Use vi.hoisted for the auth mock to ensure it works properly with imports
const hoistedAuth = `const authMocks = vi.hoisted(() => ({
    checkMembershipResponse: vi.fn().mockResolvedValue({
        supabase: {
            from: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null })
        }
    }),
    getRunAndVerifyAccess: vi.fn()
}));

vi.mock('../../src/lib/auth', () => authMocks);`;

content = content.replace(
    /vi\.mock\('\.\.\/\.\.\/src\/lib\/auth'[\s\S]*?\n\}\);\n/g,
    hoistedAuth + "\n"
);

// We need to replace getRunAndVerifyAccess in tests with authMocks.getRunAndVerifyAccess
content = content.replace(
    /\(getRunAndVerifyAccess as any\)/g,
    "authMocks.getRunAndVerifyAccess"
);

fs.writeFileSync(file, content);
