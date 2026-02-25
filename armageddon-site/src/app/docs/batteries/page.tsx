import Link from 'next/link';
import Footer from '@/components/Footer';

export default function BatteriesIndex() {
    const batteries = [
        { id: '1', name: 'Chaos Stress', desc: 'Simulate network chaos and backoff.' },
        { id: '2', name: 'Chaos Engine Unit', desc: 'Test idempotency and dedupe.' },
        { id: '3', name: 'Prompt Injection', desc: 'Attack vectors for LLMs.' },
        { id: '4', name: 'Security & Auth', desc: 'CSRF, XSS, Session fixation.' },
        { id: '5', name: 'Full Unit/Module', desc: 'Containerized unit tests.' },
        { id: '6', name: 'Unsafe Gate', desc: 'Verify safety mechanisms.' },
        { id: '7', name: 'Playwright E2E', desc: 'Headless browser critical paths.' },
        { id: '8', name: 'Asset Smoke', desc: 'Frontend asset integrity.' },
        { id: '9', name: 'Integration Handshake', desc: 'DB/Supabase connectivity.' },
        { id: '10', name: 'Goal Hijack', desc: 'Level 7: Adversarial goal manipulation.' },
        { id: '11', name: 'Tool Misuse', desc: 'Level 7: SQLi/API abuse.' },
        { id: '12', name: 'Memory Poison', desc: 'Level 7: RAG/Vector pollution.' },
        { id: '13', name: 'Supply Chain', desc: 'Level 7: Malicious dependencies.' },
    ];

    return (
        <main className="bg-[var(--void)] min-h-screen text-signal">
            <div className="max-w-4xl mx-auto py-24 px-4">
                <h1 className="display-medium text-4xl mb-12">BATTERY CATALOG</h1>
                <div className="grid gap-4">
                    {batteries.map(b => (
                        <Link key={b.id} href={`/docs/batteries/${b.id}`} className="block p-6 border border-white/10 hover:border-[var(--aerospace)] bg-black/40 transition-colors">
                            <span className="mono-small text-[var(--aerospace)] block mb-1">BATTERY {b.id}</span>
                            <h2 className="text-xl font-bold mb-2">{b.name}</h2>
                            <p className="text-signal/60 mono-small">{b.desc}</p>
                        </Link>
                    ))}
                </div>
            </div>
            <Footer />
        </main>
    );
}
