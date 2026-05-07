const fs = require('fs');
const file = 'armageddon-site/tests/unit/api-run.test.ts';
let content = fs.readFileSync(file, 'utf8');

// I need to add mock for auth module since we broke it by accident when adding the other mocks.
const mockAuth = `vi.mock('../../src/lib/auth', () => ({
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
    /vi\.mock\('\.\.\/\.\.\/src\/lib\/auth'[\s\S]*?\n\}\);\n/g,
    mockAuth + "\n"
);

fs.writeFileSync(file, content);
