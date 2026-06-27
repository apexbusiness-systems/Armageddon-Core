'use client';

import Link from 'next/link';
import { useT } from '@/i18n/useT';
import type { Dictionary } from '@/i18n/types';

type SectionTitleKey = keyof Dictionary['privacy']['sectionTitles'];

interface Section {
  readonly id: string;
  readonly titleKey: SectionTitleKey;
  readonly content: React.ReactNode;
}

// Legal body copy is the controlling English text (see `translationNotice`
// in the i18n dictionary) and is intentionally not machine-translated.
const SECTIONS: readonly Section[] = [
  {
    id: '§0',
    titleKey: 'overview',
    content: (
      <>
        <p>This Privacy Policy describes how APEX Business Systems Ltd. (&quot;APEX&quot;, &quot;we&quot;, &quot;our&quot;) collects, uses, and protects information when you use the ARMAGEDDON Test Suite GitHub App and website at armageddontest.icu (collectively, the &quot;Service&quot;).</p>
        <p>APEX is based in Edmonton, Alberta, Canada. This policy is governed by the Personal Information Protection and Electronic Documents Act (PIPEDA) and is designed to be consistent with GDPR principles for users in the European Economic Area.</p>
        <div className="bg-[#0a0a0a] border border-white/[0.08] px-4 py-3 mt-4">
          <p className="text-[var(--warning)] text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
            ARMAGEDDON Test Suite runs tests in an isolated sandbox environment. We do not store, analyze, or train on your source code or proprietary data beyond what is required to execute and report test results.
          </p>
        </div>
      </>
    ),
  },
  {
    id: '§1',
    titleKey: 'infoWeCollect',
    content: (
      <>
        <p>We collect only what is necessary to operate the Service:</p>
        <ul>
          <li><strong>GitHub Account Data:</strong> Username, email address (if provided by GitHub OAuth), organization membership, and installation scope (which repositories the GitHub App is installed on). This data is provided by GitHub per your authorization.</li>
          <li><strong>Test Execution Data:</strong> Repository metadata (name, branch, commit SHA), test run configuration, battery selection, and test output logs. This data is used solely to generate certification results.</li>
          <li><strong>Certification Artifacts:</strong> Structured test results (armageddon-report.json, armageddon-report.md, certificate.txt) are generated and stored for the duration of your subscription and for a reasonable retention period thereafter.</li>
          <li><strong>Usage Data:</strong> Page views, feature usage, and error logs collected via Cloudflare analytics. No personally identifiable information is included in these analytics.</li>
          <li><strong>Support Communications:</strong> Messages sent through our support chat (ATLAS) or via email to info-outreach@armageddontest.icu. These are used exclusively to resolve your support request.</li>
          <li><strong>Payment Data:</strong> If you subscribe to a paid tier, payment is processed by Stripe. APEX does not store full card numbers or payment credentials. Stripe&apos;s privacy policy applies to payment data.</li>
        </ul>
      </>
    ),
  },
  {
    id: '§2',
    titleKey: 'howWeUse',
    content: (
      <ul>
        <li>Authenticate your access and manage your account.</li>
        <li>Execute adversarial test batteries against your designated repositories or systems.</li>
        <li>Generate, store, and make available your certification artifacts.</li>
        <li>Display your results on the leaderboard if you opt in to public rankings.</li>
        <li>Process payments and manage subscription tiers.</li>
        <li>Respond to support requests and resolve incidents.</li>
        <li>Monitor service health and security. We do not use your data for advertising or sell it to third parties.</li>
      </ul>
    ),
  },
  {
    id: '§3',
    titleKey: 'dataWeDontCollect',
    content: (
      <ul>
        <li>We do not store, read, or retain your source code beyond sandbox execution scope.</li>
        <li>We do not use your data to train AI or machine learning models.</li>
        <li>We do not sell, rent, or trade your personal information.</li>
        <li>We do not collect biometric data, location beyond country-level, or sensitive personal data.</li>
        <li>Leaderboard display is opt-in. Opting out removes your results from public display.</li>
      </ul>
    ),
  },
  {
    id: '§4',
    titleKey: 'thirdPartyServices',
    content: (
      <>
        <p>The Service uses the following third-party providers. Each is governed by their own privacy policy:</p>
        <ul>
          <li>
            <strong>GitHub Inc.</strong>: OAuth authentication, repository access, webhook delivery.{' '}
            <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer" className="text-[var(--safe)] hover:underline">
              GitHub Privacy Statement
            </a>
          </li>
          <li>
            <strong>Cloudflare Inc.</strong>: CDN, edge network, DDoS protection, and analytics.{' '}
            <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" className="text-[var(--safe)] hover:underline">
              Cloudflare Privacy Policy
            </a>
          </li>
          <li>
            <strong>Stripe Inc.</strong>: Payment processing for paid tiers.{' '}
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--safe)] hover:underline">
              Stripe Privacy Policy
            </a>
          </li>
          <li>
            <strong>Anthropic PBC</strong>: Powers the ATLAS support chat assistant. Support chat messages may be processed by Anthropic&apos;s API to generate responses.{' '}
            <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--safe)] hover:underline">
              Anthropic Privacy Policy
            </a>
          </li>
          <li>
            <strong>Supabase Inc.</strong>: Database and authentication infrastructure.{' '}
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--safe)] hover:underline">
              Supabase Privacy Policy
            </a>
          </li>
        </ul>
      </>
    ),
  },
  {
    id: '§5',
    titleKey: 'dataRetention',
    content: (
      <ul>
        <li>Account and access data is retained for the duration of your account plus 90 days after deletion.</li>
        <li>Test results and certification artifacts are retained for the duration of your subscription. After cancellation, artifacts are available for 30 days before deletion.</li>
        <li>Support communications are retained for 12 months.</li>
        <li>Anonymized usage analytics are retained indefinitely.</li>
        <li>Payment records are retained as required by applicable tax law (typically 7 years).</li>
      </ul>
    ),
  },
  {
    id: '§6',
    titleKey: 'yourRights',
    content: (
      <>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul>
          <li>Access a copy of the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your personal data (subject to legal retention obligations).</li>
          <li>Withdraw consent to data processing where processing is based on consent.</li>
          <li>Lodge a complaint with a supervisory authority (e.g., the Office of the Privacy Commissioner of Canada, or your EU/UK DPA).</li>
        </ul>
        <p>To exercise any of these rights, contact us at the address below. We will respond within 30 days.</p>
      </>
    ),
  },
  {
    id: '§7',
    titleKey: 'security',
    content: (
      <p>
        We implement enterprise-grade security measures including Cloudflare edge protection, encrypted data in transit (TLS 1.3) and at rest, least-privilege access controls, and regular adversarial testing (we eat our own cooking: the ARMAGEDDON suite runs on our own infrastructure). No system is impenetrable. In the event of a data breach, we will notify affected users within 72 hours as required by applicable law.
      </p>
    ),
  },
  {
    id: '§8',
    titleKey: 'cookies',
    content: (
      <p>
        We use only essential cookies required for session authentication and CSRF protection. We do not use third-party tracking cookies or advertising cookies. Cloudflare may set cookies for bot protection (cf_clearance). You can disable non-essential cookies in your browser without affecting core functionality.
      </p>
    ),
  },
  {
    id: '§9',
    titleKey: 'changes',
    content: (
      <p>
        We may update this policy periodically. Material changes will be announced via the ARMAGEDDON Test Suite GitHub App and/or email. Continued use of the Service after changes constitutes acceptance of the updated policy.
      </p>
    ),
  },
  {
    id: '§10',
    titleKey: 'contact',
    content: (
      <>
        <p>For privacy requests, data deletion, or questions:</p>
        <div className="mt-4 bg-[#0a0a0a] border border-white/[0.08] px-5 py-4">
          <p className="text-sm text-[var(--signal-dim)] leading-relaxed" style={{ fontFamily: 'var(--font-mono)' }}>
            <strong className="text-[var(--signal)]">APEX Business Systems Ltd.</strong><br />
            Edmonton, Alberta, Canada<br />
            Email:{' '}
            <a href="mailto:info-outreach@armageddontest.icu" className="text-[var(--safe)] hover:underline">
              info-outreach@armageddontest.icu
            </a><br />
            Website:{' '}
            <a href="https://armageddontest.icu" className="text-[var(--safe)] hover:underline">
              https://armageddontest.icu
            </a>
          </p>
        </div>
      </>
    ),
  },
];

export default function PrivacyPageClient() {
  const { dictionary } = useT();
  const t = dictionary.privacy;

  return (
    <main className="relative min-h-screen bg-[var(--void)] text-[var(--signal)] flex flex-col">

      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 border-b border-white/[0.06] bg-[var(--void)]/95 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-3">
          <picture>
            <source srcSet="/wordmark.avif" type="image/avif" />
            <img src="/wordmark.png" alt="ARMAGEDDON Test Suite" className="h-7 w-auto" />
          </picture>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/" className="mono-small text-[var(--signal-dim)] hover:text-[var(--signal)] transition-colors">{dictionary.common.nav.home}</Link>
          <Link href="/support" className="mono-small text-[var(--signal-dim)] hover:text-[var(--signal)] transition-colors">Support</Link>
          <a href="https://github.com/apexbusiness-systems/armageddon-test-suite" target="_blank" rel="noopener noreferrer" className="mono-small text-[var(--signal-dim)] hover:text-[var(--signal)] transition-colors">{dictionary.common.nav.docs}</a>
        </div>
      </nav>

      {/* POLICY CONTENT */}
      <div className="flex-1 max-w-[760px] w-full mx-auto px-6 py-10 pb-16">

        {/* HEADER */}
        <div className="border-b border-white/[0.06] pb-6 mb-10">
          <p className="mono-small text-[var(--signal-dim)]/60 mb-2">{t.effectiveDateLine}</p>
          <h1 className="text-2xl font-bold tracking-widest uppercase text-[var(--signal)]" style={{ fontFamily: 'var(--font-display)' }}>
            {t.title}
          </h1>
          <p className="mono-small text-[var(--signal-dim)]/50 mt-3 normal-case tracking-normal" style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', letterSpacing: '0.02em', textTransform: 'none' }}>
            {t.translationNotice}
          </p>
        </div>

        {/* SECTIONS */}
        <div className="flex flex-col gap-10">
          {SECTIONS.map((section) => (
            <div key={section.id}>
              <p className="mono-small text-[var(--aerospace)] mb-1.5">{section.id}</p>
              <h2 className="text-sm font-bold tracking-[0.12em] uppercase text-[var(--signal)] border-l-2 border-[var(--aerospace)] pl-3 mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                {t.sectionTitles[section.titleKey]}
              </h2>
              <div className="flex flex-col gap-3 text-sm text-[var(--signal-dim)] leading-relaxed [&_p]:leading-relaxed [&_ul]:list-none [&_ul]:pl-0 [&_li]:relative [&_li]:pl-5 [&_li]:leading-relaxed [&_li]:mb-1.5 [&_li::before]:content-['▸'] [&_li::before]:absolute [&_li::before]:left-0 [&_li::before]:text-[var(--aerospace)] [&_strong]:text-[var(--signal)]" style={{ fontFamily: 'var(--font-body)' }}>
                {section.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.06] px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <span className="mono-small text-[var(--signal-dim)]/40">© 2026 APEX BUSINESS SYSTEMS LTD.</span>
        <div className="flex gap-5">
          <Link href="/support" className="mono-small text-[var(--signal-dim)]/40 hover:text-[var(--signal-dim)] transition-colors">Support</Link>
          <a href="mailto:info-outreach@armageddontest.icu" className="mono-small text-[var(--signal-dim)]/40 hover:text-[var(--signal-dim)] transition-colors">Email Support</a>
          <Link href="/" className="mono-small text-[var(--signal-dim)]/40 hover:text-[var(--signal-dim)] transition-colors">{dictionary.common.nav.home}</Link>
        </div>
      </footer>

    </main>
  );
}
