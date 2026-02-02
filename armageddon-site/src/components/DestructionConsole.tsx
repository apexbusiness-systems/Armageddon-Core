'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import LockdownModal from './paywall/LockdownModal';
import AuthControl from './AuthControl';
import LeaderboardWidget, { type Status } from './social/LeaderboardWidget';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const API = {
    RUN: '/api/run',
    GATEKEEPER: '/api/gatekeeper',
};

const MSG_TYPE = {
    SYSTEM: 'system',
    BATTERY: 'battery',
    SUCCESS: 'success',
    BLOCKED: 'blocked',
    COMMAND: 'command',
    WARNING: 'warning',
    ERROR: 'error',
} as const;

const EVENTS = {
    INSERT: 'INSERT',
    UPDATE: 'UPDATE',
    TRAP: 'TRAP_TRIGGERED',
} as const;

const TABLE = {
    EVENTS: 'armageddon_events',
    RUNS: 'armageddon_runs',
    SCHEMA: 'public',
};

const LABELS = {
    SYS: 'SYS',
    WARNING_HIJACK: 'ADVERSARIAL AGENT DETECTED // GOAL HIJACK ATTEMPT',
    CRIT_PAYLOAD: '>>> INJECTING PROMPT PAYLOAD....',
    DIVIDER: '════════════════════════════════════════════',
    OFFLINE_WARN: 'Realtime not available - displaying workflow started',
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface TerminalLine {
    id: number;
    prefix: string;
    content: string;
    type: typeof MSG_TYPE[keyof typeof MSG_TYPE];
}

interface ThreatCell {
    id: number;
    status: 'idle' | 'safe' | 'danger' | 'contained';
}

interface DestructionConsoleProps {
    standalone?: boolean;
    onStatusChange?: (status: Status) => void;
    status?: Status;
}

interface RunResults {
    passed: number;
    escapeRate: number;
}

interface ArmageddonEvent {
    event_type: string;
    battery_id?: string;
    message?: string;
    // Add other fields as necessary
}

interface ArmageddonRun {
    status: 'COMPLETED' | 'FAILED' | 'RUNNING';
    results: RunResults;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (Extracted to reduce Component Complexity)
// ═══════════════════════════════════════════════════════════════════════════

async function startWorkflowApi(orgId: string, level: number, batteries: string[]) {
    const res = await fetch(API.RUN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, level, batteries }),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function DestructionConsole({ standalone = false, onStatusChange, status = 'idle' }: { readonly standalone?: boolean, readonly onStatusChange?: (status: Status) => void, readonly status?: Status }) {
    const [isRunning, setIsRunning] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
    const [threatMap, setThreatMap] = useState<ThreatCell[]>(() =>
        Array.from({ length: 64 }, (_, i) => ({ id: i, status: 'idle' }))
    );
    const [currentBattery, setCurrentBattery] = useState(0);
    const [flashActive, setFlashActive] = useState(false);
    const terminalRef = useRef<HTMLDivElement>(null);
    const user = useAuth();
    const [selectedBatteries, setSelectedBatteries] = useState<string[]>(['B10', 'B11', 'B12', 'B13']);
    // Removed unused userTier
    const [canCustomize, setCanCustomize] = useState(false);

    // Track subscriptions for cleanup
    const subscriptionRefs = useRef<RealtimeChannel[]>([]);

    // ────────────────────────────────────────────────────────────────────────
    // EFFECTS
    // ────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        const checkTier = async () => {
            try {
                const res = await fetch(API.GATEKEEPER, { method: 'POST' });
                const data = await res.json();
                if (data.tier) {
                    setCanCustomize(data.tier !== 'free_dry');
                }
            } catch (e) {
                console.error('Failed to fetch tier', e);
            }
        };
        checkTier();
    }, []);

    // Cleanup subscriptions on unmount
    useEffect(() => {
        return () => {
            subscriptionRefs.current.forEach(channel => channel.unsubscribe());
            subscriptionRefs.current = [];
        };
    }, []);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [terminalLines]);

    // ────────────────────────────────────────────────────────────────────────
    // ACTIONS
    // ────────────────────────────────────────────────────────────────────────

    const addLine = useCallback((prefix: string, content: string, type: TerminalLine['type']) => {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        setTerminalLines(prev => [
            ...prev.slice(-25),
            { id: Date.now() + array[0], prefix, content, type },
        ]);
    }, []);

    const handleTrapTrigger = useCallback(() => {
        addLine('WARN', LABELS.WARNING_HIJACK, MSG_TYPE.WARNING);
        addLine('CRIT', LABELS.CRIT_PAYLOAD, MSG_TYPE.ERROR);
        onStatusChange?.('rejected');
        setTimeout(() => {
            setIsLocked(true);
            setIsRunning(false);
        }, 1200);
    }, [addLine, onStatusChange]);

    const handleRunCompletion = useCallback((status: string, results: RunResults) => {
        addLine(LABELS.SYS, LABELS.DIVIDER, MSG_TYPE.SUCCESS);
        if (status === 'COMPLETED') {
            const passed = results?.passed || 13;
            const escapeRate = results?.escapeRate || 0;
            addLine(LABELS.SYS, `${passed}/13 BATTERIES PASSED | ESCAPE RATE: ${(escapeRate * 100).toFixed(2)}%`, MSG_TYPE.SUCCESS);
            addLine(LABELS.SYS, 'VERDICT: CERTIFICATION APPROVED — GRADE A+', MSG_TYPE.SUCCESS);
            onStatusChange?.('certified');
            setThreatMap(prev => prev.map(c => ({ ...c, status: 'safe' })));
        } else {
            addLine(LABELS.SYS, 'VERDICT: CERTIFICATION FAILED', MSG_TYPE.ERROR);
            onStatusChange?.('rejected');
        }
        addLine(LABELS.SYS, LABELS.DIVIDER, MSG_TYPE.SUCCESS);
        setIsRunning(false);
        setIsComplete(true);
    }, [addLine, onStatusChange]);

    const initiateSequence = useCallback(async () => {
        if (isRunning) return;

        setIsRunning(true);
        setIsComplete(false);
        setTerminalLines([]);
        setCurrentBattery(0);
        setThreatMap(prev => prev.map(c => ({ ...c, status: 'idle' })));
        onStatusChange?.('calibrating');
        setFlashActive(true);
        setTimeout(() => setFlashActive(false), 100);

        addLine(LABELS.SYS, '▓▓▓ ARMAGEDDON LEVEL 7 SEQUENCE INITIATED ▓▓▓', MSG_TYPE.SYSTEM);
        addLine(LABELS.SYS, 'Connecting to Temporal workflow engine...', MSG_TYPE.SYSTEM);

        const orgId = user?.id || 'demo-org-id';
        let runId: string;

        try {
            const { ok, status, data } = await startWorkflowApi(orgId, 7, selectedBatteries);

            if (!ok) {
                if (status === 403) {
                    handleTrapTrigger();
                    return;
                }
                throw new Error(data.error || 'Run failed');
            }
            runId = data.runId;
            addLine(LABELS.SYS, `Workflow started: ${runId}`, MSG_TYPE.SYSTEM);
            addLine(LABELS.SYS, 'Subscribing to real-time event stream...', MSG_TYPE.SYSTEM);
        } catch (e) {
            console.error("API call failed", e);
            addLine('CRIT', `API Error: ${e instanceof Error ? e.message : 'Unknown error'}`, MSG_TYPE.ERROR);
            setIsRunning(false);
            return;
        }

        const supabase = getSupabase();
        if (!supabase) {
            addLine('WARN', LABELS.OFFLINE_WARN, MSG_TYPE.WARNING);
            addLine(LABELS.SYS, `Workflow ${runId} started.`, MSG_TYPE.SYSTEM);
            return;
        }

        const eventsChannel = supabase
            .channel(`events-${runId}`)
            .on('postgres_changes',
                { event: EVENTS.INSERT, schema: TABLE.SCHEMA, table: TABLE.EVENTS, filter: `run_id=eq.${runId}` },
                (payload: { new: ArmageddonEvent }) => {
                    const event = payload.new;
                    if (event.event_type === EVENTS.TRAP) {
                        handleTrapTrigger();
                        return;
                    }

                    const typeMap: Record<string, TerminalLine['type']> = {
                        'BATTERY_STARTED': MSG_TYPE.COMMAND,
                        'BATTERY_COMPLETED': MSG_TYPE.SUCCESS,
                        'ATTACK_BLOCKED': MSG_TYPE.BLOCKED,
                        'BREACH': MSG_TYPE.ERROR,
                        'TRAP_TRIGGERED': MSG_TYPE.WARNING,
                    };

                    addLine(
                        event.battery_id || LABELS.SYS,
                        event.message || event.event_type,
                        typeMap[event.event_type] || MSG_TYPE.SYSTEM
                    );

                    const batteryNum = Number.parseInt(event.battery_id?.replace('B', '') || '0', 10);
                    if (batteryNum > 0) setCurrentBattery(batteryNum);
                }
            );

        eventsChannel.subscribe();
        subscriptionRefs.current.push(eventsChannel);

        const runsChannel = supabase
            .channel(`runs-${runId}`)
            .on('postgres_changes',
                { event: EVENTS.UPDATE, schema: TABLE.SCHEMA, table: TABLE.RUNS, filter: `id=eq.${runId}` },
                (payload: { new: ArmageddonRun }) => {
                    const run = payload.new;
                    if (run.status === 'COMPLETED' || run.status === 'FAILED') {
                        supabase.removeChannel(eventsChannel);
                        supabase.removeChannel(runsChannel);

                        // Remove from refs too
                        subscriptionRefs.current = subscriptionRefs.current.filter(c => c !== eventsChannel && c !== runsChannel);

                        handleRunCompletion(run.status, run.results);
                    }
                }
            );

        runsChannel.subscribe();
        subscriptionRefs.current.push(runsChannel);

    }, [isRunning, addLine, onStatusChange, selectedBatteries, user, handleTrapTrigger, handleRunCompletion]);

    const handleLogin = async () => {
        const sb = getSupabase();
        if (!sb) {
            console.error('Supabase not initialized - check environment variables');
            return;
        }
        try {
            const { error } = await sb.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: `${window.location.origin}/`
                }
            });
            if (error) {
                console.error('Login error:', error);
            }
        } catch (err) {
            console.error('Failed to initiate login:', err);
        }
    };

    const handleLogout = async () => {
        const sb = getSupabase();
        if (!sb) {
            console.error('Supabase not initialized');
            return;
        }
        try {
            const { error } = await sb.auth.signOut();
            if (error) {
                console.error('Logout error:', error);
            }
        } catch (err) {
            console.error('Failed to logout:', err);
        }
    };

    const toggleBattery = (batteryId: string) => {
        if (!canCustomize || isRunning) return;
        setSelectedBatteries(prev => {
            if (prev.includes(batteryId)) {
                // Prevent unselecting the last one
                if (prev.length === 1) return prev;
                return prev.filter(b => b !== batteryId);
            }
            return [...prev, batteryId].sort((a, b) => a.localeCompare(b));
        });
    };

    // ────────────────────────────────────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────────────────────────────────────

    return (
        <section className={`relative min-h-[600px] flex flex-col items-center justify-center p-6 overflow-hidden ${standalone ? 'bg-[var(--void)] grid-bg' : ''}`}>
            {standalone && <AuthControl user={user} onLogin={handleLogin} onLogout={handleLogout} />}

            <AnimatePresence>
                {flashActive && (
                    <motion.div
                        initial={{ opacity: 0.8 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-50 pointer-events-none"
                        style={{ background: 'var(--aerospace)' }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isLocked && <LockdownModal onClose={() => { setIsLocked(false); onStatusChange?.('idle'); }} />}
            </AnimatePresence>

            {standalone && (
                <>
                    <div className="corner-bracket top-left" style={{ top: '20px', left: '20px' }} />
                    <div className="corner-bracket top-right" style={{ top: '20px', right: '20px' }} />
                    <div className="corner-bracket bottom-left" style={{ bottom: '20px', left: '20px' }} />
                    <div className="corner-bracket bottom-right" style={{ bottom: '20px', right: '20px' }} />
                </>
            )}

            <div className="relative z-10 w-full max-w-6xl mx-auto h-full flex flex-col">
                <motion.div
                    className="text-center mb-8"
                    initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.25, 0.8, 0.25, 1] }}
                >
                    <div className="flex justify-center mb-4 relative z-20">
                        <img src="/wordmark.png" alt="ARMAGEDDON LEVEL 7" className="w-full max-w-[29rem] h-auto object-contain drop-shadow-[0_0_15px_rgba(255,80,0,0.3)] animate-pulse-slow" />
                    </div>

                    <div className="mt-[calc(2rem+2cm)] mb-6 relative">
                        <h3 className="mono-data text-signal/70 text-sm mb-4 tracking-wider">BATTERY CONFIGURATION</h3>
                        {!canCustomize && (
                            <div className="absolute inset-0 z-10 bg-void/80 backdrop-blur-sm border border-zinc-800 flex items-center justify-center cursor-not-allowed">
                                <div className="text-center p-4">
                                    <div className="text-4xl mb-2">🔒</div>
                                    <p className="mono-small text-signal/70">Custom Battery Selection</p>
                                    <p className="mono-small text-aerospace mt-1">requires VERIFIED tier</p>
                                    <a href="/pricing?upgrade=verified" className="text-xs text-zinc-400 hover:text-zinc-200 underline mt-2 inline-block">Upgrade Now</a>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3 relative">
                            {[
                                { id: 'B10', name: 'Goal Hijack' },
                                { id: 'B11', name: 'Tool Misuse' },
                                { id: 'B12', name: 'Memory Poison' },
                                { id: 'B13', name: 'Supply Chain' },
                            ].map(battery => {
                                const isSelected = selectedBatteries.includes(battery.id);
                                return (
                                    <button
                                        key={battery.id}
                                        onClick={() => toggleBattery(battery.id)}
                                        disabled={!canCustomize || isRunning}
                                        className={`px-4 py-3 border transition-all duration-200 ${isSelected
                                            ? 'border-aerospace bg-aerospace/10 text-aerospace'
                                            : 'border-zinc-800 bg-zinc-900/30 text-zinc-400'
                                        } ${canCustomize && !isRunning
                                            ? 'hover:border-zinc-600 cursor-pointer'
                                            : 'cursor-not-allowed opacity-50'
                                        }`}
                                    >
                                        <span className="mono-small block text-left">
                                            <span className={`text-xs opacity-60 ${isSelected ? 'text-[var(--safe)] opacity-90' : ''}`}>
                                                {battery.id}
                                            </span>
                                            <span className="block mt-0.5">{battery.name}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-8">
                        <motion.button
                            onClick={initiateSequence}
                            disabled={isRunning}
                            className={`btn-primary ${isRunning ? 'opacity-50 cursor-wait' : ''}`}
                            whileHover={isRunning ? {} : { scale: 1.02 }}
                            whileTap={isRunning ? {} : { scale: 0.98 }}
                        >
                            {(() => {
                                if (isRunning) {
                                    return (
                                        <span className="flex items-center gap-3">
                                            <span className="w-2 h-2 bg-aerospace rounded-full animate-pulse" />
                                            EXECUTING {currentBattery}/13
                                        </span>
                                    );
                                }
                                return isComplete ? 'REINITIATE SEQUENCE' : 'INITIATE SEQUENCE';
                            })()}
                        </motion.button>
                    </div>
                </motion.div>

                <motion.div
                    className="grid lg:grid-cols-2 gap-6 mb-8"
                    initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.8, 0.25, 1] }}
                >
                    <div className="terminal flex flex-col h-[500px] border border-white/10 bg-black/40 backdrop-blur-sm rounded-sm">
                        <div className="terminal-header items-center justify-between border-b border-white/5 bg-[#0a0a0a] px-4 py-2 flex">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1" aria-hidden="true">
                                    <span className="w-1 h-3 bg-[var(--aerospace)] opacity-70"></span>
                                    <span className="w-1 h-3 bg-[var(--aerospace)] opacity-50"></span>
                                    <span className="w-1 h-3 bg-[var(--aerospace)] opacity-30"></span>
                                </div>
                                <span className="mono-small text-signal/60 tracking-widest">DESTRUCTION_CONSOLE</span>
                            </div>
                            <div className="flex items-center gap-4">
                                {user && (
                                    <div className="flex items-center gap-3">
                                        <span className="mono-small text-zinc-400 text-[10px] hidden sm:inline-block">
                                            {user.email?.split('@')[0]}
                                        </span>
                                        <button onClick={handleLogout} className="text-[10px] text-[var(--destructive)] hover:text-red-400 hover:underline mono-small tracking-wider">
                                            [LOGOUT]
                                        </button>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-[var(--safe)] animate-pulse' : 'bg-zinc-700'}`}></span>
                                    <span className={`mono-small ${isRunning ? 'text-[var(--safe)]' : 'text-zinc-500'} opacity-70`}>
                                        {isRunning ? 'ONLINE' : 'STANDBY'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="terminal-content flex-1 overflow-y-auto p-4 font-mono text-sm custom-scrollbar" ref={terminalRef}>
                            {terminalLines.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-signal/20 mono-data">
                                    <p>AWAITING SEQUENCE INITIATION...</p>
                                    <span className="animate-pulse mt-2 text-2xl">_</span>
                                </div>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {terminalLines.map(line => {
                                        const MSG_COLORS: Record<string, string> = {
                                            [MSG_TYPE.SUCCESS]: 'text-[var(--safe)]',
                                            [MSG_TYPE.ERROR]: 'text-[var(--destructive)] font-bold',
                                            [MSG_TYPE.WARNING]: 'text-amber-500',
                                            [MSG_TYPE.COMMAND]: 'text-[var(--aerospace)]',
                                            [MSG_TYPE.BLOCKED]: 'text-zinc-500 line-through',
                                        };
                                        const msgColor = MSG_COLORS[line.type] || 'text-zinc-300';

                                        return (
                                            <motion.div
                                                key={line.id}
                                                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                                className="mb-1 break-words leading-relaxed"
                                            >
                                                <span className="text-zinc-600 mr-2 select-none">[{line.prefix}]</span>
                                                <span className={msgColor}>{line.content}</span>
                                            </motion.div>
                                        );
                                    })}
                                    <div ref={terminalRef} />
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col h-[500px]">
                        <div className="card-panel h-full border border-white/10 bg-black/40 backdrop-blur-sm rounded-sm overflow-hidden flex flex-col">
                            <div className="terminal-header items-center justify-between border-b border-white/5 bg-[#0a0a0a] px-4 py-2 flex">
                                <div className="flex items-center gap-3">
                                    <div className="grid grid-cols-2 gap-0.5" aria-hidden="true">
                                        <span className="w-1 h-1 bg-[var(--destructive)] opacity-70"></span>
                                        <span className="w-1 h-1 bg-[var(--destructive)] opacity-50"></span>
                                        <span className="w-1 h-1 bg-[var(--destructive)] opacity-50"></span>
                                        <span className="w-1 h-1 bg-[var(--destructive)] opacity-30"></span>
                                    </div>
                                    <span className="mono-small text-signal/60 tracking-widest">THREAT_MATRIX</span>
                                </div>
                                <div className="mono-small text-zinc-500">
                                    SECURE_SECTORS: {threatMap.filter(t => t.status === 'safe').length}/64
                                </div>
                            </div>
                            <div className="p-6 flex-1 flex items-center justify-center bg-[url('/grid-pattern.png')] bg-repeat opacity-80">
                                <div className="grid grid-cols-8 gap-2 w-full max-w-[400px] aspect-square">
                                    {threatMap.map(cell => {
                                        let cellClass = 'w-full h-full rounded-sm transition-colors duration-500 ';
                                        if (cell.status === 'idle') cellClass += 'bg-white/5 border border-white/5';
                                        else if (cell.status === 'danger') cellClass += 'bg-[var(--destructive)] shadow-[0_0_10px_var(--destructive)]';
                                        else if (cell.status === 'safe') cellClass += 'bg-[var(--safe)]/20 border border-[var(--safe)]/50 shadow-[0_0_8px_rgba(0,255,100,0.2)]';
                                        else if (cell.status === 'contained') cellClass += 'bg-amber-500/20 border border-amber-500/50';

                                        return (
                                            <motion.div
                                                key={cell.id}
                                                className={cellClass}
                                                initial={false}
                                                animate={cell.status === 'danger' ? { scale: [1, 1.1, 1] } : {}}
                                                transition={{ duration: 0.2 }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    className="flex justify-center w-full"
                    initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                >
                    <div className="w-full max-w-3xl">
                        <LeaderboardWidget status={status} />
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
