// Apply migration via Supabase SDK
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://qhjqselqpkfqjfpuxykb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoanFzZWxxcGtmcWpmcHV4eWtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTM5MDQ5OSwiZXhwIjoyMDg0OTY2NDk5fQ.r_A3UC4O5tDHp6o5HBbAEu4GWnuiKnNP9229_WZHFck';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    console.log('📊 Applying Battery Selection migration...');

    // Read migration
    const sql = fs.readFileSync('supabase/migrations/20260126_add_run_config.sql', 'utf-8');

    // Execute via RPC (if available) or direct query
    try {
        // Method 1: Try via RPC
        const { data, error } = await supabase.rpc('exec_sql', { sql });

        if (error) {
            console.log('⚠️  RPC not available, trying alternate method...');

            // Method 2: Execute statements individually
            const statements = sql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

            for (const stmt of statements) {
                console.log(`Executing: ${stmt.substring(0, 50)}...`);
                const { error: stmtError } = await supabase.from('_sql').insert({ query: stmt });
                if (stmtError) {
                    console.error(`❌ Error: ${stmtError.message}`);
                }
            }
        } else {
            console.log('✅ Migration applied successfully!');
            console.log(data);
        }
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        console.log('\n⚠️  Manual migration required. Run the following SQL in Supabase SQL Editor:');
        console.log('\n' + sql);
    }

    // Verify
    console.log('\n🔍 Verifying config column...');
    const { data: runs, error: verifyError } = await supabase
        .from('armageddon_runs')
        .select('config')
        .limit(1);

    if (verifyError) {
        console.log('⚠️  Verification check: Please verify manually in Supabase');
    } else {
        console.log('✅ Config column accessible!');
    }
}

applyMigration();
