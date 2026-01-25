import './globals.css';
import type { Metadata, Viewport } from 'next';

// ═══════════════════════════════════════════════════════════════════════════
// METADATA
// ═══════════════════════════════════════════════════════════════════════════

export const metadata: Metadata = {
    title: 'ARMAGEDDON | Adversarial AI Certification',
    description: 'Sandboxed adversarial certification for AI & software systems. Destruction-grade testing, evidence-based certification. Are you Armageddoned?',
    keywords: ['AI security', 'adversarial testing', 'prompt injection', 'LLM security', 'certification', 'sandbox testing', 'OWASP', 'AI red team'],
    authors: [{ name: 'APEX Business Systems' }],
    openGraph: {
        title: 'ARMAGEDDON Test Suite Certification',
        description: 'Run the test. See what happens. Sandboxed adversarial certification with receipts.',
        type: 'website',
        url: 'https://armageddon.icu',
        siteName: 'ARMAGEDDON',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'ARMAGEDDON | Are You Armageddoned?',
        description: 'Sandboxed adversarial certification for AI systems.',
    },
    robots: { index: true, follow: true },
};

export const viewport: Viewport = {
    themeColor: '#030303',
    width: 'device-width',
    initialScale: 1,
};

// ═══════════════════════════════════════════════════════════════════════════
// ROOT LAYOUT — CONTAINMENT VIEWPORT
// ═══════════════════════════════════════════════════════════════════════════

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="bg-[var(--void)] text-[var(--signal)] antialiased">
                {/* CONTAINMENT VIEWPORT */}
                <div className="relative min-h-screen">
                    {/* Main Content */}
                    {children}

                    {/* FIRE GLOW - Simulated containment breach */}
                    <div className="fire-glow" aria-hidden="true" />

                    {/* ATMOSPHERIC OVERLAYS */}
                    <div className="vignette-overlay" aria-hidden="true" />
                    <div className="noise-overlay" aria-hidden="true" />
                    <div className="chromatic-edge" aria-hidden="true" />
                    <div className="scanline" aria-hidden="true" />

                    {/* SYSTEM STATUS INDICATOR */}
                    <div className="fixed top-5 right-5 z-[10000] pointer-events-none">
                        <div className="flex items-center gap-3 bg-[var(--void)]/95 border border-[var(--tungsten)] px-4 py-2 backdrop-blur-sm">
                            <div className="w-2 h-2 rounded-full bg-[var(--safe)] animate-pulse shadow-[0_0_8px_var(--safe)]" />
                            <span className="mono-small text-[var(--safe)]/80 tracking-widest">
                                VERCEL_EDGE_READY
                            </span>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
