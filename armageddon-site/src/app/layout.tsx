import './globals.css';
import type { Metadata, Viewport } from 'next';
import StickyArmageddonPlayer from '@/components/StickyArmageddonPlayer';
import PwaInstallDock from '@/components/PwaInstallDock';

// ═══════════════════════════════════════════════════════════════════════════
// METADATA
// ═══════════════════════════════════════════════════════════════════════════

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false, // HARDWARE LOCK
    themeColor: '#000000',
};

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://armageddontest.icu'),
    title: 'APEX L7',
    description: 'Sandboxed adversarial certification for AI & software systems. Destruction-grade testing, evidence-based certification. Are you Armageddoned?',
    keywords: ['AI security', 'adversarial testing', 'prompt injection', 'LLM security', 'certification', 'sandbox testing', 'OWASP', 'AI red team'],
    authors: [{ name: 'APEX Business Systems Ltd.' }],
    manifest: '/manifest.webmanifest', // PWA Manifest Link
    icons: {
        icon: [
            { url: '/favicon.ico', sizes: 'any' },
            { url: '/icon.png', type: 'image/png', sizes: '512x512' },
        ],
        apple: [
            { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'APEX L7',
    },
    openGraph: {
        title: 'ARMAGEDDON Test Suite Certification',
        description: 'Run the test. See what happens. Sandboxed adversarial certification with receipts.',
        type: 'website',
        url: 'https://armageddontest.icu',
        siteName: 'APEX Business Systems',
        images: [
            {
                url: 'https://armageddontest.icu/og-image.png',
                width: 1200,
                height: 630,
            },
        ],
        locale: 'en_US',
    },
    robots: { index: true, follow: true },
};



// ═══════════════════════════════════════════════════════════════════════════
// ROOT LAYOUT — CONTAINMENT VIEWPORT
// ═══════════════════════════════════════════════════════════════════════════

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="bg-[var(--void)] text-[var(--signal)] antialiased">
                {/* Preload the LCP hero wordmark — AVIF covers ~93% of browsers; the
                    rest fall back through the <picture> element in DestructionConsole. */}
                <link rel="preload" as="image" href="/wordmark.avif" type="image/avif" fetchPriority="high" />
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
                    <div className="fixed top-5 left-5 z-[10000] pointer-events-none">
                        <div className="flex items-center gap-3 bg-[var(--void)]/95 border border-[var(--tungsten)] px-4 py-2 backdrop-blur-sm">
                            <div className="w-2 h-2 rounded-full bg-[var(--safe)] animate-pulse shadow-[0_0_8px_var(--safe)]" />
                            <span className="mono-small text-[var(--safe)]/80 tracking-widest">
                                CLOUDFLARE_EDGE_READY
                            </span>
                        </div>
                    </div>
                </div>

                <PwaInstallDock />
                <StickyArmageddonPlayer />

            </body>
        </html>
    );
}
