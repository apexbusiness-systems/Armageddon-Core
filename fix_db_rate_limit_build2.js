const fs = require('fs');

let file = 'armageddon-site/src/lib/db-rate-limit.ts';
let content = fs.readFileSync(file, 'utf8');

// The build fails because getSupabaseClient runs at module resolution time but missing env vars break it
content = content.replace(
    "const supabase = createClient(supabaseUrl, supabaseServiceKey, {\n    auth: { persistSession: false },\n});",
    "const supabase = createClient(supabaseUrl || 'https://mock.supabase.co', supabaseServiceKey || 'mock-key', {\n    auth: { persistSession: false },\n});"
);

fs.writeFileSync(file, content);
