
import 'dotenv/config';

const ENDPOINT = 'http://localhost:3000/api/run';
export const config = { endpoint: ENDPOINT };

// This secret is for local verification loop, now loaded from environment
const secret = process.env.VERIFICATION_SECRET;

if (!secret) {
    console.error('❌ Missing VERIFICATION_SECRET environment variable.');
    process.exit(1);
}

console.log('🚀 Verifying Armageddon Backend...');
console.log(`Target: ${ENDPOINT}`);

try {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`
        },
        body: JSON.stringify({
            organizationId: 'verification-script',
            iterations: 10,
            level: 7
        })
    });

    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (res.ok) {
        console.log('✅ Success:', data);
    } else {
        console.error('❌ Failed:', res.status, data);
        process.exit(1);
    }
} catch (err: unknown) { // Explicitly typed as unknown
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('❌ Connection Error:', errorMessage);
    process.exit(1);
}
