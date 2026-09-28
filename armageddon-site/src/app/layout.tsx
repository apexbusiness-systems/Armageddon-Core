import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, Space_Mono, Syne } from 'next/font/google';
import StickyArmageddonPlayer from '@/components/StickyArmageddonPlayer';
import PwaInstallDock from '@/components/PwaInstallDock';
import LanguageSelector from '@/components/LanguageSelector';
import AppProviders from '@/components/AppProviders';
import { isApiConfigured } from '@/lib/runtime-api';

const bebasNeue = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' });
const spaceMono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-mono', display: 'swap' });
const syne = Syne({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-body', display: 'swap' });

// ═══════════════════════════════════════════════════════════════════════════
// METADATA
// ═══════════════════════════════════════════════════════════════════════════

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    themeColor: '#000000',
};

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://armageddontest.icu'),
    title: {
        default: 'ARMAGEDDON Test Suite — Adversarial AI Security Certification',
        template: '%s | ARMAGEDDON Test Suite',
    },
    alternates: { canonical: '/' },
    description: 'Sandboxed adversarial certification for AI & software systems. Destruction-grade testing, evidence-based certification. Are you Armageddoned?',
    keywords: ['AI security', 'adversarial testing', 'prompt injection', 'LLM security', 'certification', 'sandbox testing', 'OWASP', 'AI red team'],
    authors: [{ name: 'APEX Business Systems Ltd.' }],
    manifest: '/manifest.webmanifest', // PWA Manifest Link
    icons: {
        icon: [
            { url: '/favicon.ico', sizes: 'any' },
            // Same artwork as /icon.png at 76 KB instead of 483 KB (browser tab icon).
            { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
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
        // Multilingual SEO/GEO: the site serves all copy in these locales via
        // the client-side dictionary system (src/i18n). Declaring alternates
        // lets search + answer engines surface the localized experience.
        // Kept in lockstep with SUPPORTED_LOCALES (i18n-dictionaries.test.ts).
        alternateLocale: ['fr_FR', 'de_DE', 'it_IT', 'es_ES', 'zh_CN', 'pt_PT'],
    },
    robots: { index: true, follow: true },
};

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURED DATA (JSON-LD) — SEO/GEO INVARIANT
// Static, build-time constant. No user input flows into this string; safe for
// dangerouslySetInnerHTML. Keep synchronized with public/llms.txt and
// public/sitemap.xml when positioning or page inventory changes.
// ═══════════════════════════════════════════════════════════════════════════
const JSON_LD = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'Organization',
            '@id': 'https://armageddontest.icu/#org',
            name: 'APEX Business Systems Ltd.',
            url: 'https://armageddontest.icu',
            logo: 'https://armageddontest.icu/icon.png',
            sameAs: [
                'https://github.com/apexbusiness-systems',
                'https://twitter.com/ApexBusinessSys',
                'https://linkedin.com/company/apex-business-systems'
            ],
            contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'security support',
                url: 'https://armageddontest.icu/support',
            },
        },
        {
            '@type': 'WebSite',
            '@id': 'https://armageddontest.icu/#website',
            url: 'https://armageddontest.icu',
            name: 'ARMAGEDDON Test Suite Certification',
            publisher: { '@id': 'https://armageddontest.icu/#org' },
        },
        {
            '@type': 'SoftwareApplication',
            '@id': 'https://armageddontest.icu/#app',
            name: 'ARMAGEDDON Test Suite',
            applicationCategory: 'SecurityApplication',
            applicationSubCategory: 'Adversarial AI Security Certification',
            operatingSystem: 'Web',
            url: 'https://armageddontest.icu',
            image: 'https://armageddontest.icu/og-image.png',
            description:
                'Sandboxed adversarial certification for AI and software systems. 13 concurrent adversarial batteries — prompt injection, goal hijack, tool misuse, memory poisoning, supply chain — producing signed, evidence-based certification artifacts.',
            featureList: [
                '13 Concurrent Adversarial Attack Batteries',
                'PAIR Adaptive Jailbreak Engine',
                'RAG Memory Poisoning & Vector DB Defense',
                'Cryptographically Signed PDF & JSON Attestation Artifacts',
                'Sub-0.01% Escape Threshold Verification'
            ],
            offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'CAD',
                description: 'Self-serve tier is free; Verified and Certified tiers available.',
                url: 'https://armageddontest.icu/pricing',
            },
            publisher: { '@id': 'https://armageddontest.icu/#org' },
        },
        {
            '@type': 'FAQPage',
            '@id': 'https://armageddontest.icu/#faq',
            mainEntity: [
                {
                    '@type': 'Question',
                    name: 'What is adversarial AI testing and why is it required?',
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Adversarial AI testing systematically evaluates LLMs, AI agents, and neural networks against hostile attacks such as prompt injection, goal hijacking, and memory poisoning to ensure fail-closed security before production deployment.',
                    },
                },
                {
                    '@type': 'Question',
                    name: 'How does ARMAGEDDON execute adversarial certification?',
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'ARMAGEDDON deploys 13 concurrent attack batteries inside a locked sandbox, utilizing algorithms like PAIR to dynamically probe vulnerabilities and generate verifiable, cryptographically signed certification seals.',
                    },
                },
                {
                    '@type': 'Question',
                    name: 'What deliverables are produced after an ARMAGEDDON test run?',
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Every completed test run generates a machine-readable telemetry report (armageddon-report.json), an engineering markdown audit (armageddon-report.md), and a signed certification certificate (certificate.pdf).',
                    },
                },
            ],
        },
    ],
});



// ═══════════════════════════════════════════════════════════════════════════
// ROOT LAYOUT — CONTAINMENT VIEWPORT
// ═══════════════════════════════════════════════════════════════════════════

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Honest status pill: this used to be a hardcoded "always ready" string
    // that stayed green even when the console below it showed RUN BLOCKED.
    // NEXT_PUBLIC_ARMAGEDDON_API_BASE is inlined at build time (see
    // src/lib/runtime-api.ts), so this reflects the actual build, not
    // wishful text. The edge CDN itself has no "down" state worth signaling
    // here — the thing that actually varies build-to-build is backend wiring.
    const backendWired = isApiConfigured();
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                {/* LCP preload hint — keep this single-format so modern browsers do
                    not spend the critical path fetching both AVIF and WebP before
                    painting the hero wordmark. The <picture> fallback still serves
                    WebP/PNG to older browsers during normal discovery. */}
                <link rel="preload" as="image" href="/wordmark.avif" type="image/avif" fetchPriority="high" />
                {/* JSON-LD structured data — static constant, no user input (see JSON_LD above) */}
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />
            </head>
            <body className={`${bebasNeue.variable} ${spaceMono.variable} ${syne.variable} bg-[var(--void)] text-[var(--signal)] antialiased`}>
                <AppProviders>
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

                        {/* SYSTEM STATUS INDICATOR — reflects actual build wiring, not a fixed string */}
                        <div className="fixed top-4 left-4 sm:top-5 sm:left-5 z-[10000] pointer-events-none max-w-[calc(100vw-16rem)] sm:max-w-none">
                            <div className="flex items-center gap-2 sm:gap-3 bg-[var(--void)]/95 border border-[var(--tungsten)] px-2.5 py-1 sm:px-4 sm:py-2 backdrop-blur-sm">
                                <div
                                    className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${
                                        backendWired
                                            ? 'bg-[var(--safe)] shadow-[0_0_8px_var(--safe)]'
                                            : 'bg-[var(--warning)] shadow-[0_0_8px_var(--warning)]'
                                    }`}
                                />
                                <span
                                    className={`mono-small text-[10px] sm:text-xs tracking-widest truncate ${
                                        backendWired ? 'text-[var(--safe)]/80' : 'text-[var(--warning)]/80'
                                    }`}
                                >
                                    {backendWired ? 'CLOUDFLARE_EDGE_READY // BACKEND_LIVE' : 'CLOUDFLARE_EDGE_READY // BACKEND_OFFLINE'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <LanguageSelector />
                    <PwaInstallDock />
                    <StickyArmageddonPlayer />
                </AppProviders>
            </body>
        </html>
    );
}
