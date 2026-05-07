const fs = require('fs');

let reporterTestPath = 'armageddon-core/tests/core/reporter.test.ts';
let reporterContent = fs.readFileSync(reporterTestPath, 'utf8');

// Just mock createReporter directly to avoid all this supabase client mock hell
const mock = `
vi.mock('../../src/core/reporter', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        SupabaseReporter: vi.fn().mockImplementation(() => ({
            pushEvent: vi.fn().mockResolvedValue(undefined),
            pushEvents: vi.fn().mockResolvedValue(undefined),
            upsertProgress: vi.fn().mockResolvedValue(undefined),
            finalizeRun: vi.fn().mockResolvedValue(undefined)
        }))
    }
});
`;

// we'll just fix the supabase mock
const newMock = `
vi.mock('@supabase/supabase-js', () => {
    return {
        createClient: vi.fn(() => ({
            from: vi.fn(() => ({
                insert: vi.fn().mockResolvedValue({ error: null }),
                upsert: vi.fn().mockResolvedValue({ error: null }),
                update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
            })),
            channel: vi.fn(() => ({
                send: vi.fn().mockResolvedValue({ error: null })
            }))
        }))
    };
});
`;

reporterContent = reporterContent.replace(/vi\.mock\('@supabase\/supabase-js'[\s\S]*?\}\)\;\n\}\)\;/g, newMock);
fs.writeFileSync(reporterTestPath, reporterContent);

let activitiesTestPath = 'armageddon-core/tests/temporal/activities.test.ts';
let activitiesContent = fs.readFileSync(activitiesTestPath, 'utf8');
activitiesContent = activitiesContent.replace(/vi\.mock\('@supabase\/supabase-js'[\s\S]*?\}\)\;\n\}\)\;/g, newMock);
fs.writeFileSync(activitiesTestPath, activitiesContent);
