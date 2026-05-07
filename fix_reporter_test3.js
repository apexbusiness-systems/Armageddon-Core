const fs = require('fs');

let reporterTestPath = 'armageddon-core/tests/core/reporter.test.ts';
let reporterContent = fs.readFileSync(reporterTestPath, 'utf8');

// The issue might be the regex didn't match. Let's see what's actually in there.
// Actually we can just rewrite the mock.

const mock = `
vi.mock('@supabase/supabase-js', () => {
  const mockChannel = { send: vi.fn().mockResolvedValue({ error: null }) };
  const mockClient = {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    })),
    channel: vi.fn(() => mockChannel)
  };
  return {
    createClient: vi.fn(() => mockClient)
  };
});
`;

reporterContent = reporterContent.replace(/vi\.mock\('@supabase\/supabase-js'[\s\S]*?\}\)\)\;/g, mock);
fs.writeFileSync(reporterTestPath, reporterContent);

let activitiesTestPath = 'armageddon-core/tests/temporal/activities.test.ts';
let activitiesContent = fs.readFileSync(activitiesTestPath, 'utf8');
activitiesContent = activitiesContent.replace(/vi\.mock\('@supabase\/supabase-js'[\s\S]*?\}\)\)\;/g, mock);
fs.writeFileSync(activitiesTestPath, activitiesContent);
