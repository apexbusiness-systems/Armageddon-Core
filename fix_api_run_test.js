const fs = require('fs');
const file = 'armageddon-site/tests/unit/api-run.test.ts';
let content = fs.readFileSync(file, 'utf8');

// We need to vi.mock db-rate-limit to avoid initialization errors
const mockDbRateLimit = `vi.mock('../../src/lib/db-rate-limit', () => ({
    dbRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: new Date().toISOString() })
}));`;

content = content.replace(
    /vi\.mock\('\.\.\/\.\.\/src\/lib\/auth'/g,
    mockDbRateLimit + "\n\nvi.mock('../../src/lib/auth'"
);

fs.writeFileSync(file, content);
