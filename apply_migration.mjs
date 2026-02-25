// Apply migration via Supabase SDK
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    console.error('❌ Error: SUPABASE_URL is required');
    process.exit(1);
}

if (!supabaseKey) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    console.log('📊 Applying Battery Selection migration...');

    // Read migration
    const migrationPath = 'supabase/migrations/20260126_add_run_config.sql';
    if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Error: Migration file not found at ${migrationPath}`);
        return;
    }
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Execute via RPC
    try {
        console.log('⏳ Executing SQL via RPC...');
        const { data, error } = await supabase.rpc('exec_sql', { sql });

        if (error) {
            // Check if it's because exec_sql is missing
            if (error.message?.includes('function') && error.message?.includes('does not exist')) {
                console.warn('⚠️  RPC "exec_sql" not found in database.');
            }
            throw error;
        }

        console.log('✅ Migration SQL executed successfully via RPC.');
        if (data) console.log('RPC Response:', data);

    } catch (err) {
        console.error('❌ Migration execution failed:', err.message || err);
        console.log('\n⚠️  Automated migration could not be completed.');
        console.log('Please run the following SQL manually in the Supabase SQL Editor:');
        console.log('\n' + sql);
        console.log('\n(Note: You can also use the "apply_migration.sql" file if you have psql access)');
    }

    // Verify
    console.log('\n🔍 Verifying "config" column in "armageddon_runs" table...');
    try {
        const { error: verifyError } = await supabase
            .from('armageddon_runs')
            .select('config')
            .limit(1);

        if (verifyError) {
            console.error('❌ Verification check failed:', verifyError.message);
            console.log('   Status: The migration may not have been applied successfully.');
        } else {
            console.log('✅ Verification successful! "config" column is accessible.');
        }
    } catch (err) {
        console.error('❌ Verification failed with exception:', err.message);
    }
}

await applyMigration();
