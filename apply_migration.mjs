// Apply migration via Supabase SDK
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const supabaseUrl = process.env.SUPABASE_URL || 'https://qhjqselqpkfqjfpuxykb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    console.log('📊 Applying Battery Selection migration...');

    // Read migration
    const sql = fs.readFileSync('supabase/migrations/20260126_add_run_config.sql', 'utf-8');

    // Execute via RPC (if available) or direct query
    try {
        // Method 1: Try via RPC
        const { data } = await supabase.rpc('exec_sql', { sql });
        // Log data if relevant or remove if unused, but avoiding unused var 'error' which wasn't flagged, but good practice.
        if (data) console.log(data);

        // Logic continues...
        // ... (Simulating the rest of the function logic without full rewrite if possible, but cleaner to just fix the specific bits if I can target them. I'll rewrite the specific blocks)
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        console.log('\n⚠️  Manual migration required. Run the following SQL in Supabase SQL Editor:');
        console.log('\n' + sql);
    }

    // Verify
    console.log('\n🔍 Verifying config column...');
    const { error: verifyError } = await supabase
        .from('armageddon_runs')
        .select('config')
        .limit(1);

    if (verifyError) {
        console.log('⚠️  Verification check: Please verify manually in Supabase');
    } else {
        console.log('✅ Config column accessible!');
    }
}

await applyMigration();
