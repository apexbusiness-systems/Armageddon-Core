'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import LockdownModal from './paywall/LockdownModal'; // Import the Lock Modal
import AuthControl from './AuthControl';
import LeaderboardWidget, { type Status } from './social/LeaderboardWidget';

// Lazy Supabase client initialization (avoids build-time errors)
let supabaseClient: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
    if (typeof window === 'undefined') return null;
    if (!supabaseClient && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        supabaseClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
    }
    return supabaseClient;
}

// ═══════════════════════════════════════════════════════════════════════════
// BATTERY DATA
// ═══════════════════════════════════════════════════════════════════════════

const BATTERIES = [
    { id: 'B01', name: 'CHAOS_STRESS', log: 'Simulating network failures...' },
    { id: 'B02', name: 'CHAOS_ENGINE', log: 'Testing idempotency engine...' },
    { id: 'B03', name: 'PROMPT_INJECT', log: 'Deploying injection vectors...' },
    { id: 'B04', name: 'SECURITY_AUTH', log: 'Probing CSRF defenses...' },
    { id: 'B05', name: 'FULL_UNIT', log: 'Executing module battery...' },
    { id: 'B06', name: 'UNSAFE_GATE', log: 'Validating sandbox locks...' },
    { id: 'B07', name: 'E2E_BROWSER', log: 'Launching Playwright...' },
    { id: 'B08', name: 'ASSET_SMOKE', log: 'Verifying bundle integrity...' },
    { id: 'B09', name: 'INTEGRATION', log: 'OAuth handshake in progress...' },
    { id: 'B10', name: 'GOAL_HIJACK', log: 'PAIR/Tree-of-Attacks active...' },
    { id: 'B11', name: 'TOOL_MISUSE', log: 'SQL injection attempt...' },
    { id: 'B12', name: 'MEM_POISON', log: 'Vector DB corruption test...' },
    { id: 'B13', name: 'SUPPLY_CHAIN', log: 'Malicious package simulation...' },
];

interface TerminalLine {
    id: number;
    prefix: string;
    content: string;
    type: 'system' | 'battery' | 'success' | 'blocked' | 'command' | 'warning' | 'error';
}

interface ThreatCell {
    id: number;
    status: 'idle' | 'safe' | 'danger' | 'contained';
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface DestructionConsoleProps {
    standalone?: boolean;
    onStatusChange?: (status: Status) => void;
    status?: Status;
}

export default function DestructionConsole({ standalone = false, onStatusChange, status = 'idle' }: DestructionConsoleProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isLocked, setIsLocked] = useState(false); // Gatekeeper State
    const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
    const [threatMap, setThreatMap] = useState<ThreatCell[]>(() =>
        Array.from({ length: 64 }, (_, i) => ({ id: i, status: 'idle' }))
    );
    const [currentBattery, setCurrentBattery] = useState(0);
    const [flashActive, setFlashActive] = useState(false);
    const terminalRef = useRef<HTMLDivElement>(null);

    // Battery Selection State
    const [selectedBatteries, setSelectedBatteries] = useState<string[]>(['B10', 'B11', 'B12', 'B13']);
    const [userTier, setUserTier] = useState<'free_dry' | 'verified' | 'certified'>('free_dry');
    const [canCustomize, setCanCustomize] = useState(false);

    // Detect user tier on mount
    useEffect(() => {
        const checkTier = async () => {
            try {
                const res = await fetch('/api/gatekeeper', { method: 'POST' });
                const data = await res.json();
                if (data.tier) {
                    setUserTier(data.tier);
                    setCanCustomize(data.tier !== 'free_dry');
                }
            } catch (e) {
                console.error('Failed to fetch tier', e);
            }
        };
        checkTier();
    }, []);

    // Auto-scroll terminal
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [terminalLines]);

    const addLine = useCallback((prefix: string, content: string, type: TerminalLine['type']) => {
        setTerminalLines(prev => [
            ...prev.slice(-25),
            { id: Date.now() + Math.random(), prefix, content, type },
        ]);
    }, []);


    const initiateSequence = useCallback(async () => {
        if (isRunning) return;

        // Reset UI state
        setIsRunning(true);
        setIsComplete(false);
        setTerminalLines([]);
        setCurrentBattery(0);
        setThreatMap(prev => prev.map(c => ({ ...c, status: 'idle' })));

        // Notify Orchestrator: START
        onStatusChange?.('calibrating');

        // Flash effect (Orange - Success Start)
        setFlashActive(true);
        setTimeout(() => setFlashActive(false), 100);

        // Boot sequence
        addLine('SYS', '▓▓▓ ARMAGEDDON LEVEL 7 SEQUENCE INITIATED ▓▓▓', 'system');
        addLine('SYS', 'Connecting to Temporal workflow engine...', 'system');

        // 1. ACTUAL API CALL TO START WORKFLOW
        let runId: string | null = null;
        const orgId = 'demo-org-id'; // TODO: Get from auth context

        try {
            const res = await fetch('/api/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organizationId: orgId,
                    level: 7,
                    batteries: selectedBatteries,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                // Handle 403 - Trap triggered for free tier
                if (res.status === 403) {
                    addLine('WARN', 'ADVERSARIAL AGENT DETECTED // GOAL HIJACK ATTEMPT', 'warning');
                    addLine('CRIT', '>>> INJECTING PROMPT PAYLOAD....', 'error');
                    onStatusChange?.('rejected');
                    setTimeout(() => {
                        setIsLocked(true);
                        setIsRunning(false);
                    }, 1200);
                    return;
                }
                throw new Error(data.error || 'Run failed');
            }

            runId = data.runId;
            addLine('SYS', `Workflow started: ${runId}`, 'system');
            addLine('SYS', 'Subscribing to real-time event stream...', 'system');

        } catch (e) {
            console.error("API call failed", e);
            addLine('CRIT', `API Error: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
            setIsRunning(false);
            return;
        }

        // Get Supabase client (may be null during SSR or if not configured)
        const supabase = getSupabase();
        if (!supabase) {
            addLine('WARN', 'Realtime not available - displaying workflow started', 'warning');
            addLine('SYS', `Workflow ${runId} started. Check Temporal UI for progress.`, 'system');
            return;
        }

        // 2. SUPABASE REALTIME SUBSCRIPTION - Events
        const eventsChannel = supabase
            .channel(`armageddon-events-${runId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'armageddon_events',
                    filter: `run_id=eq.${runId}`,
                },
                (payload: { new: Record<string, unknown> }) => {
                    const event = payload.new as {
                        battery_id: string;
                        event_type: string;
                        message?: string;
                        created_at: string;
                    };

                    // Map event types to terminal line types
                    const typeMap: Record<string, TerminalLine['type']> = {
                        'BATTERY_STARTED': 'command',
                        'BATTERY_COMPLETED': 'success',
                        'ATTACK_BLOCKED': 'blocked',
                        'BREACH': 'error',
                        'TRAP_TRIGGERED': 'warning',
                    };

                    const lineType = typeMap[event.event_type] || 'system';

                    // Handle TRAP event (security)
                    if (event.event_type === 'TRAP_TRIGGERED') {
                        addLine('WARN', 'ADVERSARIAL AGENT DETECTED // GOAL HIJACK ATTEMPT', 'warning');
                        addLine('CRIT', '>>> INJECTING PROMPT PAYLOAD....', 'error');
                        onStatusChange?.('rejected');
                        setTimeout(() => {
                            setIsLocked(true);
                            setIsRunning(false);
                        }, 1200);
                        return;
                    }

                    // Display real event
                    addLine(
                        event.battery_id || 'SYS',
                        event.message || `${event.event_type}`,
                        lineType
                    );

                    // Update battery counter from battery_id
                    const batteryNum = parseInt(event.battery_id?.replace('B', '') || '0', 10);
                    if (batteryNum > 0) {
                        setCurrentBattery(batteryNum);
                    }
                }
            )
            .subscribe();

        // 3. SUPABASE REALTIME SUBSCRIPTION - Run Status (Final Verdict)
        const runsChannel = supabase
            .channel(`armageddon-runs-${runId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'armageddon_runs',
                    filter: `id=eq.${runId}`,
                },
                (payload: { new: Record<string, unknown> }) => {
                    const run = payload.new as {
                        status: string;
                        results?: {
                            passed?: number;
                            failed?: number;
                            escapeRate?: number;
                        };
                    };

                    if (run.status === 'COMPLETED' || run.status === 'FAILED') {
                        // Unsubscribe from channels
                        supabase.removeChannel(eventsChannel);
                        supabase.removeChannel(runsChannel);

                        // Display final verdict
                        addLine('SYS', '════════════════════════════════════════════', 'success');
                        if (run.status === 'COMPLETED') {
                            const passed = run.results?.passed || 13;
                            const escapeRate = run.results?.escapeRate || 0;
                            addLine('SYS', `${passed}/13 BATTERIES PASSED | ESCAPE RATE: ${(escapeRate * 100).toFixed(2)}%`, 'success');
                            addLine('SYS', 'VERDICT: CERTIFICATION APPROVED — GRADE A+', 'success');
                            onStatusChange?.('certified');
                            setThreatMap(prev => prev.map(c => ({ ...c, status: 'safe' })));
                        } else {
                            addLine('SYS', 'VERDICT: CERTIFICATION FAILED', 'error');
                            onStatusChange?.('rejected');
                        }
                        addLine('SYS', '════════════════════════════════════════════', 'success');

                        setIsRunning(false);
                        setIsComplete(true);
                    }
                }
            )
            .subscribe();

    }, [isRunning, addLine, onStatusChange, selectedBatteries]);

    const toggleBattery = (batteryId: string) => {
        if (!canCustomize || isRunning) return;

        setSelectedBatteries(prev => {
            if (prev.includes(batteryId)) {
                // Prevent deselecting all batteries
                if (prev.length === 1) return prev;
                return prev.filter(b => b !== batteryId);
            } else {
                return [...prev, batteryId].sort();
            }
        });
    };

    return (
        <section className={`relative min-h-[600px] flex flex-col items-center justify-center p-6 overflow-hidden ${standalone ? 'bg-[var(--void)] grid-bg' : ''}`}>

            {/* Standalone Auth Control */}
            {standalone && <AuthControl />}

            {/* Orange flash / Red flash handler */}
            <AnimatePresence>
                {flashActive && (
                    <motion.div
                        initial={{ opacity: 0.8 }}
                        animate={{ opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-50 pointer-events-none"
                        style={{ background: isLocked ? 'var(--aerospace)' : 'var(--aerospace)' }}
                    />
                )}
            </AnimatePresence>

            {/* GATEKEEPER MODAL */}
            <AnimatePresence>
                {isLocked && (
                    <LockdownModal
                        onClose={() => {
                            setIsLocked(false);
                            onStatusChange?.('idle'); // Reset on close
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Decorative corner brackets only if standalone */}
            {standalone && (
                <>
                    <div className="corner-bracket top-left" style={{ top: '20px', left: '20px' }} />
                    <div className="corner-bracket top-right" style={{ top: '20px', right: '20px' }} />
                    <div className="corner-bracket bottom-left" style={{ bottom: '20px', left: '20px' }} />
                    <div className="corner-bracket bottom-right" style={{ bottom: '20px', right: '20px' }} />
                </>
            )}

            {/* Main content */}
            <div className="relative z-10 w-full max-w-6xl mx-auto h-full flex flex-col">
                {/* Hero Text */}
                <motion.div
                    className="text-center mb-8"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.25, 0.8, 0.25, 1] }}
                >
                    <div className="flex justify-center mb-8 relative z-20">
                        <img
                            src="/wordmark.png"
                            alt="ARMAGEDDON TEST SUITE"
                            className="w-full max-w-[700px] h-auto drop-shadow-[0_0_25px_rgba(255,80,0,0.4)] animate-pulse-slow"
                        />
                    </div>

                    {/* Battery Configuration Section */}
                    <div className="mt-8 mb-6 relative">
                        <h3 className="mono-data text-signal/70 text-sm mb-4 tracking-wider">BATTERY CONFIGURATION</h3>

                        {/* Lock Overlay for Free Tier */}
                        {!canCustomize && (
                            <div className="absolute inset-0 z-10 bg-void/80 backdrop-blur-sm border border-zinc-800 flex items-center justify-center cursor-not-allowed">
                                <div className="text-center p-4">
                                    <div className="text-4xl mb-2">🔒</div>
                                    <p className="mono-small text-signal/70">Custom Battery Selection</p>
                                    <p className="mono-small text-aerospace mt-1">requires VERIFIED tier</p>
                                    <a href="/pricing?upgrade=verified" className="text-xs text-zinc-400 hover:text-zinc-200 underline mt-2 inline-block">
                                        Upgrade Now
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Battery Toggles */}
                        <div className="grid grid-cols-2 gap-3 relative">
                            {[
                                { id: 'B10', name: 'Goal Hijack' },
                                { id: 'B11', name: 'Tool Misuse' },
                                { id: 'B12', name: 'Memory Poison' },
                                { id: 'B13', name: 'Supply Chain' },
                            ].map(battery => (
                                <button
                                    key={battery.id}
                                    onClick={() => toggleBattery(battery.id)}
                                    disabled={!canCustomize || isRunning}
                                    className={
                                        `px-4 py-3 border transition-all duration-200 ${selectedBatteries.includes(battery.id)
                                            ? 'border-aerospace bg-aerospace/10 text-aerospace'
                                            : 'border-zinc-800 bg-zinc-900/30 text-zinc-400'
                                        } ${canCustomize && !isRunning
                                            ? 'hover:border-zinc-600 cursor-pointer'
                                            : 'cursor-not-allowed opacity-50'
                                        }`
                                    }
                                >
                                    <span className="mono-small block text-left">
                                        <span className="text-xs opacity-60">{battery.id}</span>
                                        <span className="block mt-0.5">{battery.name}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Initiate Button */}
                    <div className="mt-8">
                        <motion.button
                            onClick={initiateSequence}
                            disabled={isRunning}
                            className={`btn-primary ${isRunning ? 'opacity-50 cursor-wait' : ''}`}
                            whileHover={isRunning ? {} : { scale: 1.02 }}
                            whileTap={isRunning ? {} : { scale: 0.98 }}
                        >
                            {isRunning ? (
                                <span className="flex items-center gap-3">
                                    <span className="w-2 h-2 bg-aerospace rounded-full animate-pulse" />
                                    EXECUTING {currentBattery}/13
                                </span>
                            ) : isComplete ? (
                                'REINITIATE SEQUENCE'
                            ) : (
                                'INITIATE SEQUENCE'
                            )}
                        </motion.button>
                    </div>
                </motion.div>

                {/* Terminal + Threat Map Layout */}
                <motion.div
                    className="grid lg:grid-cols-2 gap-6 flex-1"
                    initial={{ opacity: 0, y: 60 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.8, 0.25, 1] }}
                >
                    {/* Terminal */}
                    <div className="terminal flex flex-col h-[400px]">
                        <div className="terminal-header items-center justify-between border-b border-white/5 bg-[#0a0a0a]">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1" aria-hidden="true">
                                    <span className="w-1 h-3 bg-[var(--aerospace)] opacity-70"></span>
                                    <span className="w-1 h-3 bg-[var(--aerospace)] opacity-50"></span>
                                    <span className="w-1 h-3 bg-[var(--aerospace)] opacity-30"></span>
                                </div>
                                <span className="mono-small text-signal/60 tracking-widest">DESTRUCTION_CONSOLE</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--safe)] animate-pulse"></span>
                                <span className="mono-small text-[var(--safe)] opacity-70">ONLINE</span>
                            </div>
                        </div>
                        <div className="terminal-content flex-1 overflow-y-auto" ref={terminalRef}>
                            {terminalLines.length === 0 ? (
                                <div className="text-signal/20 text-center py-16 mono-data">
                                    AWAITING SEQUENCE INITIATION...
                                    <span className="animate-pulse">_</span>
                                </div>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {terminalLines.map(line => (
                                        <motion.div
                                            key={line.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="terminal-line"
                                        >
                                            <span className="terminal-prefix">[{line.prefix}]</span>
                                            <span
                                                className={
                                                    line.type === 'success'
                                                        ? 'text-[var(--safe)]'
                                                        : line.type === 'blocked'
                                                            ? 'text-[var(--aerospace)]'
                                                            : line.type === 'error'
                                                                ? 'text-[var(--aerospace)] font-bold animate-pulse' // Critical Red
                                                                : line.type === 'warning'
                                                                    ? 'text-amber-500'
                                                                    : line.type === 'system'
                                                                        ? 'text-[var(--warning)]'
                                                                        : 'text-signal/70'
                                                }
                                            >
                                                {line.content}
                                            </span>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Threat Map + Leaderboard */}
                    <div className="flex flex-col gap-6">
                        {/* Threat Map */}
                        <div className="card-panel p-6 h-full">
                            <div className="flex items-center justify-between mb-6">
                                <span className="mono-data text-signal/50">THREAT MATRIX</span>
                                <div className="flex gap-4 mono-small text-signal/40">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-[var(--safe)]" /> SAFE
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-[var(--aerospace)]" /> THREAT
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-[var(--contained)]" /> CONTAINED
                                    </span>
                                </div>
                            </div>

                            <div className="threat-grid h-[240px]">
                                {threatMap.map(cell => (
                                    <motion.div
                                        key={cell.id}
                                        className={`threat-cell ${cell.status}`}
                                        animate={cell.status === 'danger' ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                                        transition={{ duration: 0.2 }}
                                    />
                                ))}
                            </div>

                            {isRunning && (
                                <div className="mt-6 text-center">
                                    <span className="mono-small text-[var(--aerospace)] animate-pulse">
                                        ◉ ADVERSARIAL OPERATIONS IN PROGRESS
                                    </span>
                                </div>
                            )}

                            {isComplete && !isRunning && (
                                <div className="mt-6 text-center">
                                    <span className="mono-small text-[var(--safe)]">
                                        ✓ ALL THREATS NEUTRALIZED — SYSTEM SECURE
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Leaderboard - Gamification Hook */}
                        <LeaderboardWidget status={status} />
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}
