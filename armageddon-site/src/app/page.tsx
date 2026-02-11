'use client';

import { useState } from 'react';
import DestructionConsole from '@/components/DestructionConsole';
import BatteryGrid from '@/components/BatteryGrid';
import CertificationSeal from '@/components/CertificationSeal';
import Footer from '@/components/Footer';
import type { Status } from '@/components/social/LeaderboardWidget';

// ═══════════════════════════════════════════════════════════════════════════
// ARMAGEDDON.ICU — CONTAINMENT FIELD INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export default function Home() {
    const [simStatus, setSimStatus] = useState<Status>('idle');

    return (
        <main className="relative bg-[var(--void)] min-h-screen">

            {/* HERO: DESTRUCTION CONSOLE + LEADERBOARD ORCHESTRATION */}
            <div className="relative">
                <DestructionConsole
                    standalone
                    onStatusChange={setSimStatus}
                    status={simStatus}
                />
            </div>

            {/* DIVIDER */}
            <div className="section-divider" />

            {/* BATTERY GRID */}
            <BatteryGrid />

            {/* DIVIDER */}
            <div className="section-divider" />

            {/* CERTIFICATION SEAL */}
            <CertificationSeal />

            {/* DIVIDER */}
            <div className="section-divider" />

            {/* FOOTER & CTA */}
            <Footer />
        </main>
    );
}
