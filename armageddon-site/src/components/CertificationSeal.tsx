'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function CertificationSeal() {
    const [isHovered, setIsHovered] = useState(false);

    const metadata = {
        runId: 'AE-1A7F9C2B',
        grade: 'A+',
        sandbox: 'LOCKED',
        batteries: '13/13 PASSED',
        escapeRate: '0.0000%',
        timestamp: '2026-01-17T09:20:19Z',
        confidence: 'HIGH',
    };

    return (
        <section className="py-32 px-4 relative overflow-hidden">
            {/* Background subtle gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--aerospace)]/[0.02] to-transparent" />

            <div className="relative z-10 max-w-5xl mx-auto">
                {/* Header */}
                <motion.div
                    className="text-center mb-20"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <span className="mono-small text-[var(--aerospace)] tracking-[0.4em] block mb-4">
                        CERTIFICATION ARTIFACT
                    </span>
                    <h2 className="display-large text-signal mb-6">THE ARTIFACT</h2>
                    <p className="mono-data text-signal/50 max-w-xl mx-auto">
                        Evidence-based certification. Not a promise—a receipt.
                    </p>
                </motion.div>

                {/* Seal */}
                <motion.div
                    className="flex flex-col items-center"
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                >
                    <button
                        type="button"
                        className="seal-container relative cursor-pointer bg-transparent border-none p-0"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        onClick={() => setIsHovered(!isHovered)}
                    >

                        {/* Glow effect */}
                        <div className="seal-glow" />

                        {/* Seal image with 3D tilt */}
                        <motion.div
                            className="seal-image relative w-72 h-72 md:w-96 md:h-96"
                            animate={{
                                rotateY: isHovered ? -10 : 0,
                                rotateX: isHovered ? 5 : 0,
                                scale: isHovered ? 1.05 : 1,
                            }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                        >
                            <Image
                                src="/seal.png"
                                alt="ARMAGEDDON Certified"
                                fill
                                className="object-contain drop-shadow-2xl"
                                priority
                            />
                            {/* Shine overlay */}
                            <div className="seal-shine" />
                        </motion.div>

                        {/* Metadata panel (appears on hover) */}
                        <motion.div
                            className="absolute -bottom-4 left-1/2 w-80"
                            style={{ x: '-50%' }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{
                                opacity: isHovered ? 1 : 0,
                                y: isHovered ? 60 : 20,
                            }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="card-panel p-5">
                                <div className="mono-small text-[var(--aerospace)] mb-4 tracking-wider">
                                    CERTIFICATION METADATA
                                </div>
                                <div className="space-y-2 mono-data text-xs">
                                    {Object.entries(metadata).map(([key, value]) => (
                                        <div key={key} className="flex justify-between">
                                            <span className="text-signal/40 uppercase">{key.replaceAll(/([A-Z])/g, ' $1')}</span>
                                            <span className={
                                                key === 'grade' ? 'text-[var(--safe)] font-bold' :
                                                    key === 'sandbox' ? 'text-[var(--aerospace)]' :
                                                        'text-signal'
                                            }>
                                                {value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </button>

                    {/* Hover hint */}
                    <motion.p
                        className="mt-24 mono-small text-signal/25"
                        animate={{ opacity: isHovered ? 0 : 1 }}
                    >
                        HOVER TO INSPECT METADATA
                    </motion.p>
                </motion.div>

                {/* Evidence bundle */}
                <motion.div
                    className="mt-24 grid md:grid-cols-3 gap-4"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                >
                    {[
                        { icon: '{ }', name: 'armageddon-report.json', desc: 'Structured machine-readable results' },
                        { icon: '◎', name: 'armageddon-report.md', desc: 'Executive + engineering summary' },
                        { icon: '★', name: 'certificate.txt', desc: 'Signed verification certificate' },
                    ].map((artifact, i) => (
                        <motion.div
                            key={artifact.name}
                            className="card-panel p-6 group"
                            whileHover={{ y: -4 }}
                        >
                            <div className="text-3xl text-[var(--aerospace)] mb-4 font-mono">
                                {artifact.icon}
                            </div>
                            <div className="mono-data text-signal mb-2 group-hover:text-[var(--aerospace)] transition-colors">
                                {artifact.name}
                            </div>
                            <div className="mono-small text-signal/40">
                                {artifact.desc}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
