'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function Hero() {
    return (
        <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden bg-[var(--void)]">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,80,0,0.1),transparent_70%)]" />
            <div className="absolute inset-0 bg-[url('/grid-pattern.png')] bg-repeat opacity-20" />

            <div className="relative z-10 max-w-5xl mx-auto">
                <motion.h1
                    className="display-large text-6xl md:text-8xl lg:text-9xl mb-8 text-signal tracking-tighter"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: [0.25, 0.8, 0.25, 1] }}
                >
                    ARE YOU<br />
                    <span className="text-[var(--destructive)]">ARMAGEDDONED?</span>
                </motion.h1>

                <motion.p
                    className="mono-medium text-lg md:text-xl text-signal/70 mb-12 max-w-2xl mx-auto"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.8, 0.25, 1] }}
                >
                    Destruction-grade testing. Evidence-based certification.
                    <br />
                    Armageddon breaks your AI system safely in sandbox—then hands you the receipts.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.8, 0.25, 1] }}
                >
                    <Link href="/dry-run" className="btn-cta inline-flex items-center gap-3">
                        <span className="text-xl">RUN FREE DRY TEST</span>
                        <span className="text-2xl">→</span>
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
