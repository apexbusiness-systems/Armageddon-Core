const ENDPOINT = 'http://localhost:3000/api/run';
export const config = { endpoint: ENDPOINT };
// This secret is for local verification loop
const secret = '6f7679a4675ad424e30873f5f5a45db2c90e79cdaa57101f8a60c54';

const SENSITIVE_KEY_PATTERN = /(token|secret|password|authorization|cookie|jwt|key|code|session|access|refresh)/i;

function sanitizeLogText(value: unknown, maxLength = 200): string {
    const text = typeof value === 'string' ? value : String(value);
    return text
        .replace(/[\r\n\t]/g, ' ')
        .replace(/\u001b\[[0-9;]*m/g, '')
        .slice(0, maxLength);
}

function summarizeUntrustedPayload(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { payloadType: Array.isArray(value) ? 'array' : typeof value };
    }

    const keys = Object.keys(value as Record<string, unknown>);
    return {
        payloadType: 'object',
        keyCount: keys.length,
        keys: keys
            .filter((key) => !SENSITIVE_KEY_PATTERN.test(key))
            .slice(0, 10)
            .map((key) => sanitizeLogText(key, 80)),
        redactedKeyCount: keys.filter((key) => SENSITIVE_KEY_PATTERN.test(key)).length,
    };
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
        console.log(`✅ Deployment verification succeeded status=${res.status} response=${JSON.stringify(summarizeUntrustedPayload(data))}`);
    } else {
        console.error(`❌ Deployment verification failed status=${res.status} response=${JSON.stringify(summarizeUntrustedPayload(data))}`);
        process.exitCode = 1;
    }
} catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('❌ Connection Error:', sanitizeLogText(errorMessage));
    process.exitCode = 1;
}
