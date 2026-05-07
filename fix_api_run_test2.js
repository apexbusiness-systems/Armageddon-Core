const fs = require('fs');
const file = 'armageddon-site/tests/unit/api-run.test.ts';
let content = fs.readFileSync(file, 'utf8');

// The test fails because we didn't mock @armageddon/shared export DEFAULT_BATTERIES correctly.
const sharedMock = `vi.mock('@armageddon/shared', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        DEFAULT_BATTERIES: ['B10', 'B11', 'B12', 'B13', 'B14'],
        checkRunEligibility: vi.fn().mockResolvedValue({
            eligible: true,
            tier: 'certified'
        }),
        normalizeIterations: vi.fn().mockReturnValue(100)
    };
});`;

content = content.replace(
    /vi\.mock\('@armageddon\/shared'[\s\S]*?\n\}\);\n/g,
    sharedMock + "\n"
);

fs.writeFileSync(file, content);
