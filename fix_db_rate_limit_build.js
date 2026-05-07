const fs = require('fs');

let file = 'armageddon-site/src/lib/db-rate-limit.ts';
let content = fs.readFileSync(file, 'utf8');

// The build fails because getSupabaseClient runs at module resolution time but missing env vars break it
content = content.replace(
    "if (!supabaseUrl || !supabaseServiceKey) {\n    throw new Error('Missing Supabase credentials for rate limiting');\n}",
    "if (!supabaseUrl || !supabaseServiceKey) {\n    console.warn('Missing Supabase credentials for rate limiting');\n}"
);

fs.writeFileSync(file, content);
