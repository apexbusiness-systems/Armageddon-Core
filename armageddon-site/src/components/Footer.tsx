'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useT } from '@/i18n/useT';

// ═══════════════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════════════

export default function Footer() {
    const user = useAuth();
    const router = useRouter();
    const { dictionary } = useT();

    // Public conversion CTA. Always sends to the intake page regardless of auth state.
    const handleCtaClick = () => {
        router.push('/intake');
    };

    const getButtonText = () => {
        if (user) return dictionary.common.footer.ctaButtonLoggedIn;
        return dictionary.common.footer.ctaButtonLoggedOut;
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
                        className="display-medium text-signal/80 mb-12 uppercase"
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                    >
                        {dictionary.common.footer.ctaHeadline}
                        <br />
                        <span className="text-[var(--aerospace)]">{dictionary.common.footer.ctaHeadlineHighlight}</span>
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
                        className="mt-8 mono-small text-signal/60 uppercase"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        {dictionary.common.footer.tierLadder}
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
                        <span className="mono-small text-signal/30 uppercase">{dictionary.common.footer.copyright}</span>
                    </div>

                    {/* Deployment indicator */}
                    <div className="flex items-center justify-center gap-3">
                        <div className="w-2 h-2 bg-[var(--safe)] rounded-full animate-pulse" />
                        <span className="mono-small text-signal/30 uppercase">{dictionary.common.footer.deploymentIndicator}</span>
                    </div>

                    {/* OmniHub Attribution: visible, not loud */}
                    <div className="relative z-10 flex items-center gap-2">
                        <span className="mono-small text-signal/40 uppercase">{dictionary.common.footer.poweredBy}</span>
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
                    {dictionary.common.footer.legalDisclaimer}
                </p>
            </div>
        </footer>
    );
}
