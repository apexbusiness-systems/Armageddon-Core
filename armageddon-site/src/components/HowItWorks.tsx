'use client';

import { motion } from 'framer-motion';

export default function HowItWorks() {
    const steps = [
        {
            title: 'CONCURRENT BATTERIES',
            desc: '9 batteries launch simultaneously (CPU-bound + I/O-bound).',
            icon: '⚡'
        },
        {
            title: 'DETERMINISTIC CHAOS',
            desc: 'Seed-based RNG (CHAOS_SEED=42) ensures 100% reproducibility.',
            icon: '🎲'
        },
        {
            title: 'EVIDENCE BUNDLE',
            desc: 'Get report.md, certificate.txt, junit.xml, and timestamped logs.',
            icon: '📂'
        },
        {
            title: 'LEVEL 7 GOD MODE',
            desc: '40,000 adversarial attacks: Goal Hijack, Tool Misuse, Poison.',
            icon: '👁️'
        }
    ];

    return (
        <section className="py-24 bg-[var(--void)] text-center relative overflow-hidden">
            <div className="max-w-6xl mx-auto px-4">
                <h2 className="display-medium text-4xl mb-16 text-signal">
                    HOW ARMAGEDDON WORKS
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {steps.map((step, idx) => (
                        <motion.div
                            key={idx}
                            className="p-8 border border-[var(--tungsten)] bg-[var(--deep-space)]/50 backdrop-blur-sm"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            viewport={{ once: true }}
                        >
                            <div className="text-4xl mb-6">{step.icon}</div>
                            <h3 className="mono-medium text-lg text-[var(--aerospace)] mb-4">
                                {step.title}
                            </h3>
                            <p className="mono-small text-signal/70">
                                {step.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
