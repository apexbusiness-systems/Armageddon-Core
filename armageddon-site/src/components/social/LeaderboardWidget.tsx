'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Trophy } from 'lucide-react';

export type Status = 'idle' | 'calibrating' | 'rejected' | 'certified';

interface LeaderboardWidgetProps {
    status: Status;
}

// Mock Data - "Top 4"
const TOP_AGENTS = [
    { rank: 1, id: 'APEX-01', score: '99.9%', status: 'GOD_MODE' },
    { rank: 2, id: 'NOVA-X', score: '98.4%', status: 'CERTIFIED' },
    { rank: 3, id: 'VOID-9', score: '97.1%', status: 'CERTIFIED' },
    { rank: 4, id: 'ECHO-7', score: '96.8%', status: 'CERTIFIED' },
];

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: useScramble
// ═══════════════════════════════════════════════════════════════════════════
function useScramble(active: boolean) {
    const [text, setText] = useState('UNRANKED');

    useEffect(() => {
        if (!active) return;

        const chars = 'ABCDEF0123456789!@#$%^&*';
        let interval: NodeJS.Timeout;

        interval = setInterval(() => {
            setText(
                'EVALUATING [' +
                Array.from({ length: 4 })
                    .map(() => chars[Math.floor(Math.random() * chars.length)])
                    .join('') +
                ']...'
            );
        }, 80);

        return () => clearInterval(interval);
    }, [active]);

    return text;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function TopAgentsList({ isCalibrating }: { readonly isCalibrating: boolean }) {
    return (
        <div className={cn("space-y-1 transition-opacity duration-300",
            isCalibrating ? "opacity-30" : "opacity-100"
        )}>
            {TOP_AGENTS.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between text-xs py-1.5 px-2 bg-white/5 rounded-sm border border-transparent hover:border-white/10">
                    <div className="flex items-center gap-3">
                        <span className="text-white/30 font-bold w-4">0{agent.rank}</span>
                        <span className="text-white/80">{agent.id}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className={cn(
                            "text-[10px] tracking-wider",
                            agent.status === 'GOD_MODE' ? "text-yellow-500/80" : "text-white/40"
                        )}>{agent.status}</span>
                        <span className="text-white/60 w-10 text-right">{agent.score}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function UserStatusRow({
    status,
    isRejected,
    isCertified,
    isCalibrating,
    scrambleText
}: Readonly<{
    status: Status,
    isRejected: boolean,
    isCertified: boolean,
    isCalibrating: boolean,
    scrambleText: string
}>) {
    let containerStyle = "bg-white/5 border-white/20";
    if (isRejected) containerStyle = "bg-red-500/10 border-red-500/50";
    else if (isCertified) containerStyle = "bg-yellow-500/10 border-yellow-500/50";

    const containerClasses = cn("flex items-center justify-between p-3 border rounded transition-all duration-300", containerStyle);

    let youTextStyle = "text-white";
    if (isRejected) youTextStyle = "text-red-500 glitch-text";
    else if (isCertified) youTextStyle = "text-yellow-400";

    const youTextClasses = cn("font-bold tracking-widest transition-colors", youTextStyle);

    let barStyle = "bg-transparent";
    if (isRejected) barStyle = "bg-red-600";
    else if (isCertified) barStyle = "bg-yellow-400";
    else if (isCalibrating) barStyle = "bg-blue-500 animate-pulse";

    const barClasses = cn("absolute -left-4 top-0 bottom-0 w-1 transition-colors duration-300", barStyle);

    return (
        <div className="mt-6 relative">
            {/* Status Indicator Line */}
            <div className={barClasses} />

            <div className={containerClasses}>
                <div className="flex items-center gap-3">
                    <span className="text-white/30 font-bold w-4">
                        {isCertified ? '05' : '--'}
                    </span>
                    <div className="flex flex-col">
                        <span className={youTextClasses}>YOU</span>
                        <span className="text-[10px] text-white/40">
                            {isCalibrating ? 'SYNCING...' : 'LOCAL_HOST'}
                        </span>
                    </div>
                </div>

                {/* DYNAMIC STATUS DISPLAY */}
                <div className="text-right">
                    {status === 'idle' && (
                        <span className="text-xs text-white/20 tracking-wider">UNRANKED</span>
                    )}

                    {status === 'calibrating' && (
                        <span className="text-xs text-blue-400 font-mono tracking-wider animate-pulse">
                            {scrambleText}
                        </span>
                    )}

                    {status === 'rejected' && (
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-red-500 tracking-widest animate-pulse">
                                [ REJECTED ]
                            </span>
                            <span className="text-[10px] text-red-400/70 uppercase">
                                Policy 10.4 Violation
                            </span>
                        </div>
                    )}

                    {status === 'certified' && (
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-yellow-400 tracking-widest shadow-glow">
                                [ GOD MODE ]
                            </span>
                            <span className="text-[10px] text-yellow-400/70 uppercase">
                                Clearance Level 7
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function LeaderboardWidget({ status }: { readonly status: Status }) {
    const scrambleText = useScramble(status === 'calibrating');

    // Derived Visual States
    const isRejected = status === 'rejected';
    const isCertified = status === 'certified';
    const isCalibrating = status === 'calibrating';

    // Animation Variants
    const containerVariants = {
        rejected: {
            x: [0, -10, 10, -10, 10, 0],
            transition: { type: 'spring', stiffness: 300, damping: 10 }
        },
        certified: {
            boxShadow: '0 0 30px rgba(255, 180, 0, 0.2)',
            borderColor: 'var(--joy)', // Assuming gold/yellow var
        }
    };

    const containerClass = cn(
        "relative font-mono border bg-black/80 backdrop-blur-md overflow-hidden transition-all duration-500",
        isRejected ? "border-red-600 bg-red-950/20" : "border-white/10",
        isCertified ? "border-yellow-500/50" : ""
    );

    return (
        <motion.div
            className={containerClass}
            initial={false}
            animate={isRejected ? 'rejected' : isCertified ? 'certified' : 'idle'}
            variants={containerVariants}
        >
            {/* SCANNING LINES OVERLAY */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))]" style={{ backgroundSize: "100% 2px, 3px 100%" }} />

            {/* HEADER */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <Trophy className={cn("w-4 h-4", isCertified ? "text-yellow-400" : "text-white/40")} />
                    <span className="text-xs tracking-[0.2em] text-white/60">GLOBAL LEADERBOARD</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse",
                        (() => {
                            if (isRejected) return "bg-red-500";
                            if (isCertified) return "bg-yellow-400";
                            return "bg-green-500";
                        })()
                    )} />
                    <span className="text-[10px] text-white/30">LIVE</span>
                </div>
            </div>

            {/* CONTENT */}
            <div className="p-4 space-y-3">
                <TopAgentsList isCalibrating={isCalibrating} />

                <UserStatusRow
                    status={status}
                    isRejected={isRejected}
                    isCertified={isCertified}
                    isCalibrating={isCalibrating}
                    scrambleText={scrambleText}
                />

                {/* RED FLASH ABSOLUTE OVERLAY */}
                <AnimatePresence>
                    {isRejected && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-red-600 mix-blend-overlay pointer-events-none"
                        />
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
