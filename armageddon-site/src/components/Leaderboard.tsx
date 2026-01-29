'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

// MOCK DATA
const INITIAL_RANKS = [
    { id: 'op_1', name: 'ZEUS_PRIME', score: 99.9, latency: '12ms', status: 'LEGEND' },
    { id: 'op_2', name: 'NIGHT_WATCH', score: 99.8, latency: '14ms', status: 'ELITE' },
    { id: 'op_3', name: 'VOID_WALKER', score: 99.5, latency: '18ms', status: 'ELITE' },
    { id: 'op_4', name: 'IRON_CLAD', score: 98.2, latency: '22ms', status: 'CERTIFIED' },
    { id: 'op_5', name: 'DATA_GHOST', score: 97.9, latency: '24ms', status: 'CERTIFIED' },
];

export default function Leaderboard() {
    const [ranks, setRanks] = useState(INITIAL_RANKS);

    // Simulate "Live" updates
    useEffect(() => {
        const interval = setInterval(() => {
            setRanks(prev => {
                const newRanks = [...prev];
                // Randomly swap 4th and 5th for "live" feel
                const randomBuffer = new Uint8Array(1);
                window.crypto.getRandomValues(randomBuffer);
                const randomValue = randomBuffer[0] / 255;
                
                if (newRanks.length >= 5 && randomValue > 0.7) {
                    const temp = newRanks[3];
                    newRanks[3] = newRanks[4];
                    newRanks[4] = temp;
                }
                return newRanks;
            });
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="card-panel p-0 overflow-hidden flex flex-col h-full min-h-[300px] border border-[var(--tungsten-light)] bg-[#0a0a0a]">
            {/* Header */}
            <div className="p-4 border-b border-[var(--tungsten-light)] bg-black/40 flex justify-between items-center">
                <span className="mono-small text-[var(--aerospace)] tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-[var(--aerospace)] animate-pulse" />
                    <span>GLOBAL_RANKINGS</span>
                </span>
                <span className="mono-tiny text-signal/30">LEVEL_7_ACCESS</span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {ranks.map((rank, index) => (
                    <motion.div
                        key={rank.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`
                            relative flex items-center justify-between p-3 rounded group
                            ${index === 0 ? 'bg-[var(--aerospace)]/10 border border-[var(--aerospace)]/30' : 'hover:bg-white/5'}
                        `}
                    >
                        <div className="flex items-center gap-4">
                            {/* Rank Number */}
                            <span className={`
                                mono-data w-6 text-center font-bold
                                ${index === 0 ? 'text-[var(--aerospace)]' : 'text-signal/40'}
                            `}>
                                #{index + 1}
                            </span>

                            {/* User Info */}
                            <div>
                                <div className={`
                                    mono-small font-bold tracking-wide
                                    ${index === 0 ? 'text-white' : 'text-signal/80'}
                                `}>
                                    {rank.name}
                                </div>
                                <div className="flex gap-2 mono-tiny text-[10px] opacity-60">
                                    <span className={index === 0 ? 'text-[var(--aerospace)]' : ''}>{rank.status}</span>
                                    <span>{'//'}</span>
                                    <span>{rank.latency}</span>
                                </div>
                            </div>
                        </div>

                        {/* Score */}
                        <div className="text-right">
                            <div className={`
                                mono-data font-bold
                                ${index === 0 ? 'text-[var(--aerospace)]' : 'text-signal'}
                            `}>
                                {rank.score}%
                            </div>
                            <div className="mono-tiny text-signal/30">SECURE</div>
                        </div>

                        {/* Hover Glitch Line */}
                        <div className="absolute inset-0 border border-transparent group-hover:border-white/10 pointer-events-none rounded" />
                    </motion.div>
                ))}

                {/* THE HOOK: User's Unranked State */}
                <div className="mt-4 pt-4 border-t border-[var(--tungsten-light)] border-dashed">
                    <div className="flex items-center justify-between p-3 bg-red-950/20 border border-red-900/50 rounded opacity-60 grayscale group hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                        <div className="flex items-center gap-4">
                            <span className="mono-data text-signal/20 w-6 text-center">--</span>
                            <div>
                                <div className="mono-small text-signal/40 group-hover:text-red-400 transition-colors">YOU</div>
                                <div className="mono-tiny text-red-500/50">UNRANKED</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="mono-tiny text-[var(--aerospace)] animate-pulse">INITIATE SEQUENCE &gt;</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
