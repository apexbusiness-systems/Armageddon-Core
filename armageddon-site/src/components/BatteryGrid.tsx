'use client';

import { useState } from 'react';
import { BATTERIES } from '@armageddon/shared';
import BatteryCard from './BatteryCard';
import SectionIntro from './SectionIntro';
import RevealPanel from './RevealPanel';
import { useT } from '@/i18n/useT';

export default function BatteryGrid() {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const { dictionary } = useT();
    const t = dictionary.home.batteryGrid;

    return (
        <section className="py-32 px-4 relative overflow-hidden">
            {/* Background grid pattern */}
            <div className="absolute inset-0 grid-bg opacity-50" />

            <div className="relative z-10 max-w-7xl mx-auto">
                <SectionIntro
                    eyebrow={t.eyebrow}
                    title={t.title}
                    description={t.description}
                />

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
                <RevealPanel className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="stat-block">
                        <div className="stat-value">13</div>
                        <div className="stat-label">{t.statTotalBatteries}</div>
                    </div>
                    <div className="stat-block">
                        <div className="stat-value">PAIR</div>
                        <div className="stat-label">{t.statRealAdversarialEngine}</div>
                    </div>
                    <div className="stat-block">
                        <div className="stat-value">&lt;0.01%</div>
                        <div className="stat-label">{t.statEscapeThreshold}</div>
                    </div>
                    <div className="stat-block">
                        <div className="stat-value">FULL</div>
                        <div className="stat-label">{t.statConcurrency}</div>
                    </div>
                </RevealPanel>
            </div>
        </section>
    );
}
