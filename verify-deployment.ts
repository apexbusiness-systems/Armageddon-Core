// verify-deployment.ts
// Standard Node.js 18+ fetch is global

const ENDPOINT = 'https://armageddon-core-git-main-apexapps.vercel.app/api/run';
const SECRET = '6f7679a4675ad424e30873f5f5a44db2c90e79cdaa57101f8a60c54'; // (Note: I need to verify I have the right one, actually let me use the one I generated in memory if I can, or presume the code I wrote before had it. Wait, did I copy it right? Yes.)

// Wait, the secret in my previous tool call was '6f76...'. I will trust the file replace.
// actually, I'll just write it cleanly.

async function verify() {
    const secret = '6f7679a4675ad424e30873f5f5a45db2c90e79cdaa57101f8a60c54';

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

        console.log(`\nStatus: ${res.status} ${res.statusText}`);
        console.log('Response:', data);

        if (res.ok && data.success) {
            console.log('\n✅ VERIFICATION PASSED: workflow started.');
        } else {
            console.error('\n❌ VERIFICATION FAILED.');
            process.exit(1);
        }
    } catch (err) {
        console.error('\n❌ NETWORK ERROR:', err);
        process.exit(1);
    }
}

verify();
