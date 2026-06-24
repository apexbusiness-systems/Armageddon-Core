'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

// ═══════════════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════════════

export default function Footer() {
    const user = useAuth();
    const router = useRouter();

    // Public conversion CTA. This must NEVER start OAuth — buyers go to pricing,
    // and signed-in users go straight into onboarding for a self-serve run.
    const handleCtaClick = () => {
        if (user) {
            router.push('/onboarding?tier=self-serve');
        } else {
            router.push('/pricing');
        }
    };

    const getButtonText = () => {
        if (user) return 'START TESTING';
        return 'GET CERTIFIED';
    };

    return (
        <footer className="relative overflow-hidden">
            {/* CTA Section */}
            <section className="py-28 px-4 relative">
                {/* Background glow */}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--aerospace)]/[0.03] to-transparent" />

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    {/* Context line */}
                    <motion.p
                        className="display-medium text-signal/80 mb-12"
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                    >
                        COMPLIANCE IS A CHECKLIST.
                        <br />
                        <span className="text-[var(--aerospace)]">ARMAGEDDON PRODUCES EVIDENCE.</span>
                    </motion.p>

                    {/* CTA Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                    >
                        <button
                            onClick={handleCtaClick}
                            className="btn-cta mx-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                        >
                            <span>{getButtonText()}</span>
                        </button>
                    </motion.div>

                    {/* Tier info */}
                    <motion.p
                        className="mt-8 mono-small text-signal/60"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        SELF-SERVE (FREE) → VERIFIED (EVIDENCE REVIEW) → CERTIFIED (RELEASE-READINESS GATE)
                    </motion.p>
                </div>
            </section>

            {/* Divider */}
            <div className="section-divider" />

            {/* Sub-footer */}
            <div className="py-8 px-4 bg-[var(--void)]">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Brand */}
                    <div className="flex items-center gap-4">
                        <span className="mono-small text-signal/30">© 2026 APEX BUSINESS SYSTEMS</span>
                    </div>

                    {/* Deployment badge */}
                    <div className="flex items-center gap-3">
                        <span className="mono-small text-signal/40">EDGE BY</span>
                        <div className="h-5 w-5 rounded-full border border-[var(--safe)]/60 shadow-[0_0_16px_rgba(59,255,128,0.35)]" />
                        <span className="mono-small text-signal/40">CLOUDFLARE / LOCAL MOAT</span>
                    </div>

                    {/* Deployment indicator */}
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-[var(--safe)] rounded-full animate-pulse" />
                        <span className="mono-small text-signal/30">CLOUDFLARE EDGE READY // LOCAL MOAT BACKED</span>
                    </div>

                    {/* OmniHub Attribution — visible, not loud */}
                    <div className="relative z-10 flex items-center gap-2">
                        <span className="mono-small text-signal/40">POWERED BY</span>
                        <Image
                            src="/apex-wordmark-logo.png"
                            alt="APEX-OmniHub"
                            width={220}
                            height={45}
                            className="object-contain"
                        />
                    </div>
                </div>
            </div>

            {/* Legal */}
            <div className="py-6 px-4 bg-[var(--void)] border-t border-[var(--tungsten)]">
                <p className="text-center mono-small text-signal/55 max-w-4xl mx-auto">
                    Armageddon Test Suite Certification is designed for controlled sandbox testing and does not guarantee breach prevention.
                    Certification reflects results of the tested build/configuration at time of run.
                    Not a substitute for compliance certifications (SOC 2, ISO 27001) or professional penetration testing.
                </p>
            </div>
        </footer>
    );
}
