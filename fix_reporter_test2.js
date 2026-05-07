const fs = require('fs');

// Fix reporter test
let reporterTestPath = 'armageddon-core/tests/core/reporter.test.ts';
let reporterContent = fs.readFileSync(reporterTestPath, 'utf8');

const channelMock = `vi.mock('@supabase/supabase-js', () => ({
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
}));`;

reporterContent = reporterContent.replace(
    /vi\.mock\('@supabase\/supabase-js', \(\) => \(\{[\s\S]*?\}\)\)\;/g,
    channelMock
);
fs.writeFileSync(reporterTestPath, reporterContent);

// Fix activities test
let activitiesTestPath = 'armageddon-core/tests/temporal/activities.test.ts';
let activitiesContent = fs.readFileSync(activitiesTestPath, 'utf8');

activitiesContent = activitiesContent.replace(
    /vi\.mock\('@supabase\/supabase-js', \(\) => \(\{[\s\S]*?\}\)\)\;/g,
    channelMock
);
fs.writeFileSync(activitiesTestPath, activitiesContent);
