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
                {/* 
                   DestructionConsole controls the layout of the terminal and right column.
                   We pass 'simStatus' and 'setSimStatus' to it.
                   DestructionConsole renders the LeaderboardWidget internally in its grid.
                   
                   Wait, I didn't update DestructionConsole to render LeaderboardWidget in the grid.
                   I removed the old Leaderboard import, but I didn't add LeaderboardWidget back.
                   
                   Let's fix page.tsx to Render LeaderboardWidget IF DestructionConsole allows it? 
                   NO, DestructionConsole is a black box component in this file.
                   
                   I need to make sure DestructionConsole Renders LeaderboardWidget.
                   I updated DestructionConsole in the previous step, but I didn't see the code add <LeaderboardWidget>.
                   I only saw it import type { Status }.
                   
                   Looking at the diff I applied to DestructionConsole:
                   - import type { Status } from './social/LeaderboardWidget';
                   - It accepts onStatusChange.
                   - I removed import Leaderboard from './Leaderboard';
                   - I REMOVED <Leaderboard /> from JSX (lines 296+ in original).
                   
                   So currently, DestructionConsole has an EMPTY SPACE where Leaderboard was.
                   
                   I must Update DestructionConsole to Import and Render LeaderboardWidget.
                   
                   BUT I am currently editing page.tsx.
                   
                   I will update page.tsx to just be the orchestrator.
                   AND I will perform ANOTHER edit on DestructionConsole to render LeaderboardWidget.
                   
                   For page.tsx, I just need to pass the props.
                */}
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
