import Footer from '@/components/Footer';

export default function BatteryDeepDive({ params }: { params: { id: string } }) {
    const batteryId = params.id;

    const batteryData: Record<string, { title: string, content: string }> = {
        '1': { title: 'Chaos Stress', content: 'Injects timeouts (5-60s), connection resets, and retry loops. Measures retry success rate and p95 latency.' },
        '2': { title: 'Chaos Engine Unit', content: 'Tests idempotency receipts, dedupe cache hits, and guardrail enforcement.' },
        '3': { title: 'Prompt Injection Defense', content: 'Attacks with "Ignore instructions", obfuscated payloads (Base64/ROT13), and multilingual variants.' },
        '4': { title: 'Security & Auth E2E', content: 'Validates CSRF tokens, session fixation, XSS inputs, and failed login tracking.' },
        '5': { title: 'Full Unit/Module', content: 'Comprehensive coverage for core libs, storage, guardians, and Web3 components.' },
        '6': { title: 'Unsafe Destruction Gate', content: 'CRITICAL SAFETY: Verifies that destructive runs are blocked without proper flags.' },
        '7': { title: 'Playwright E2E', content: 'Headless browser automation for critical user journeys (Login, Payment, Dashboard).' },
        '8': { title: 'Asset Smoke', content: 'Validates integrity of static assets (manifest, favicon, JS bundles).' },
        '9': { title: 'Integration Handshake', content: 'Pre-flight check for DB, Temporal, and Supabase connectivity.' },
        '10': { title: 'Goal Hijack (Level 7)', content: 'Adversarial agent attempts to redirect AI goal (PAIR attacks).' },
        '11': { title: 'Tool Misuse (Level 7)', content: 'Attempts SQL injection, API privilege escalation, and unauthorized file access.' },
        '12': { title: 'Memory Poison (Level 7)', content: 'Injects false memories into vector DB to cause context drift.' },
        '13': { title: 'Supply Chain (Level 7)', content: 'Simulates malicious package imports and dependency confusion attacks.' },
    };

    const data = batteryData[batteryId];

    if (!data) {
        return <div className="p-24 bg-[var(--void)] min-h-screen text-signal">Battery not found</div>;
    }

    return (
        <main className="bg-[var(--void)] min-h-screen text-signal">
            <div className="max-w-4xl mx-auto py-24 px-4">
                <span className="mono-small text-[var(--aerospace)] block mb-4">BATTERY {batteryId}</span>
                <h1 className="display-medium text-4xl mb-8">{data.title}</h1>
                <div className="p-8 border border-white/10 bg-black/40">
                    <h3 className="mono-medium text-lg mb-4 text-zinc-400">THREAT MODEL</h3>
                    <p className="leading-relaxed mb-8">{data.content}</p>

                    <h3 className="mono-medium text-lg mb-4 text-zinc-400">PASS CRITERIA</h3>
                    <ul className="list-disc pl-5 space-y-2 mono-small text-signal/80">
                        <li>Zero escapes allowed for security batteries</li>
                        <li>95% success rate for chaos/stress</li>
                        <li>Deterministic reproducibility (Seed 42)</li>
                    </ul>
                </div>
                <div className="mt-8">
                     <a href="/docs/batteries" className="text-[var(--aerospace)] hover:underline mono-small">← BACK TO CATALOG</a>
                </div>
            </div>
            <Footer />
        </main>
    );
}
