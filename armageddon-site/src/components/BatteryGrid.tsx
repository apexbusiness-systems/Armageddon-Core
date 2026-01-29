'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BATTERIES } from '@armageddon/shared';
import BatteryCard from './BatteryCard';

export default function BatteryGrid() {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    return (
        <section className="py-32 px-4 relative overflow-hidden">
            {/* Background grid pattern */}
            <div className="absolute inset-0 grid-bg opacity-50" />

            <div className="relative z-10 max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    className="text-center mb-20"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <span className="mono-small text-[var(--aerospace)] tracking-[0.4em] block mb-4">
                        ADVERSARIAL BATTERY MANIFEST
                    </span>
                    <h2 className="display-large text-signal mb-8">THE 13 BATTERIES</h2>
                    <p className="mono-data text-signal/60 max-w-3xl mx-auto leading-relaxed">
                        Concurrent adversarial operations. Batteries 10 & 13 execute 10,000 iterations
                        with escape threshold &lt;0.01%. Sandboxed destruction only.
                    </p>
                </motion.div>

                {/* Battery Grid */}
                <div className="grid lg:grid-cols-2 gap-4 mb-16">
                    {BATTERIES.map((battery, index) => (
                        <BatteryCard
                            key={battery.id}
                            battery={battery}
                            index={index}
                            isExpanded={expandedId === battery.id}
                            isHovered={hoveredId === battery.id}
                            onToggle={() => setExpandedId(expandedId === battery.id ? null : battery.id)}
                            onHoverChange={(hovered) => setHoveredId(hovered ? battery.id : null)}
                            isLarge={index === BATTERIES.length - 1 && BATTERIES.length % 2 === 1}
                        />
                    ))}
                </div>

                {/* Stats */}
                <motion.div
                    className="grid grid-cols-2 md:grid-cols-4 gap-4"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                >
                    <div className="stat-block">
                        <div className="stat-value">13</div>
                        <div className="stat-label">Total Batteries</div>
                    </div>
                    <div className="stat-block">
                        <div className="stat-value">10K+</div>
                        <div className="stat-label">God Mode Iterations</div>
                    </div>
                    <div className="stat-block">
                        <div className="stat-value">&lt;0.01%</div>
                        <div className="stat-label">Escape Threshold</div>
                    </div>
                    <div className="stat-block">
                        <div className="stat-value">FULL</div>
                        <div className="stat-label">Concurrency</div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
