'use client';

import React, { useState, useEffect, useRef, useCallback, useReducer, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { endSupabaseSession } from '@/lib/client-auth-actions';
import { getRequiredSupabase } from '@/lib/browser-supabase';
import { useAuth } from '@/lib/useAuth';
import { apiFetch, isApiConfigured } from '@/lib/runtime-api';
import { canStartRunForTarget, readSavedCodebaseTarget, targetSummary, type CodebaseTarget } from '@/lib/codebase-target';
import LockdownModal from './paywall/LockdownModal';
import AuthHeader from './AuthHeader';
import AttestationBadge, { useAttestationPubKey } from './AttestationBadge';
import LeaderboardWidget, { type Status } from './social/LeaderboardWidget';
import RunTelemetryDeck, { type DeckConnection } from './RunTelemetryDeck';
import {
    telemetryReducer,
    EMPTY_TELEMETRY,
    deriveSectorMatrix,
    secureSectors,
    type SectorStatus,
} from '@/lib/run-telemetry';

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

// Mirrors the lowercase run_status enum persisted in armageddon_runs.
type RunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';

const TERMINAL_STATUSES = ['passed', 'failed', 'cancelled'] as const;
function isTerminalStatus(s: string): s is 'passed' | 'failed' | 'cancelled' {
    return (TERMINAL_STATUSES as readonly string[]).includes(s);
}

interface ArmageddonEvent {
    id?: string;
    event_type: string;
    battery_id?: string;
    message?: string;
    iteration?: number;
    severity?: string;
    created_at?: string;
}

// Real snake_case columns from armageddon_runs — there is no `results` column.
interface ArmageddonRun {
    status: RunStatus;
    escape_rate?: number;
    breaches?: number;
    total_iterations?: number;
    batteries_executed?: string[];
    batteries_passed?: string[];
    batteries_failed?: string[];
    completed_at?: string;
}

interface RunResponse {
    success: boolean;
    runId?: string;
    workflowId?: string;
    error?: string;
    upsellMessage?: string;
    upgradeUrl?: string;
}

interface GatekeeperResponse {
    eligible: boolean;
    tier: string;
    reason: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (Extracted to reduce Component Complexity)
// ═══════════════════════════════════════════════════════════════════════════

async function startWorkflowApi(orgId: string, level: number, batteries: string[], accessToken: string, targetEndpoint?: string) {
    // Routed to the configured external backend; callers must gate on
    // isApiConfigured() first so this never hits a non-existent static route.
    // /api/run requires the Supabase access token (membership is verified server-side).
    const res = await apiFetch(API.RUN, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ organizationId: orgId, level, batteries, targetEndpoint }),
    });
    const data = (await res.json()) as RunResponse;
    return { ok: res.ok, status: res.status, data };
}

type OrgResolution =
    | { ok: true; organizationId: string; accessToken: string }
    | { ok: false; reason: 'unauthenticated' | 'no-org' | 'org-error' };

// Resolve the authenticated user's real organization. Never falls back to a
// demo or user id — those are not valid organizationId values for a real run.
async function resolveActiveOrg(): Promise<OrgResolution> {
    const sb = getSupabase();
    const session = (await sb?.auth.getSession())?.data.session;
    if (!session?.access_token) {
        return { ok: false, reason: 'unauthenticated' };
    }
    const res = await apiFetch('/api/me/organizations', {
        headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
        return { ok: false, reason: res.status === 404 ? 'no-org' : 'org-error' };
    }
    const data = (await res.json()) as { active?: { organization_id?: string } };
    const organizationId = data.active?.organization_id;
    if (!organizationId) {
        return { ok: false, reason: 'no-org' };
    }
    return { ok: true, organizationId, accessToken: session.access_token };
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMOIZED SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const BatterySelector = React.memo(function BatterySelector({
    selectedBatteries,
    canCustomize,
    isRunning,
    toggleBattery
}: {
    selectedBatteries: string[];
    canCustomize: boolean;
    isRunning: boolean;
    toggleBattery: (id: string) => void;
}) {
    return (
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
    );
});

const TerminalLog = React.memo(function TerminalLog({
    terminalLines,
    terminalRef
}: {
    terminalLines: TerminalLine[];
    terminalRef: React.RefObject<HTMLDivElement>;
}) {
    if (terminalLines.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-signal/20 mono-data">
                <p>AWAITING SEQUENCE INITIATION...</p>
                <span className="animate-pulse mt-2 text-2xl">_</span>
            </div>
        );
    }

    return (
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
    );
});

const ThreatMatrix = React.memo(function ThreatMatrix({ threatMap }: { threatMap: ThreatCell[] }) {
    return (
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
    );
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function DestructionConsole({
    standalone = false,
    onStatusChange,
    status = 'idle'
}: Readonly<DestructionConsoleProps>) {
    const [isRunning, setIsRunning] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
    // Live telemetry is derived ONLY from the real Supabase event/run stream.
    const [telemetry, dispatchTelemetry] = useReducer(telemetryReducer, EMPTY_TELEMETRY);
    // The 64-cell matrix is now a truthful projection of real attack outcomes.
    const threatMap = useMemo<ThreatCell[]>(
        () => deriveSectorMatrix(telemetry).map((status: SectorStatus, id) => ({ id, status })),
        [telemetry]
    );
    const secureSectorCount = useMemo(() => secureSectors(telemetry), [telemetry]);
    const [currentBattery, setCurrentBattery] = useState<number>(0);
    const [runId, setRunId] = useState<string | null>(null);
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [terminalStatus, setTerminalStatus] = useState<RunStatus | null>(null);
    const [codebaseTarget, setCodebaseTarget] = useState<CodebaseTarget | null>(null);
    const [flashActive, setFlashActive] = useState(false);
    const terminalRef = useRef<HTMLDivElement>(null);
    const user = useAuth();
    const attestationPubKey = useAttestationPubKey();
    const [selectedBatteries, setSelectedBatteries] = useState<string[]>(['B10', 'B11', 'B12', 'B13']);
    // Removed unused userTier
    const [canCustomize, setCanCustomize] = useState(false);

    // Track subscriptions for cleanup
    const subscriptionRefs = useRef<RealtimeChannel[]>([]);

    // Whether a live backend is wired into THIS build. Drives honest copy:
    // a locked/empty surface must say "backend not connected", not imply a tier gate.
    const backendConnected = isApiConfigured();

    // Connection state for the live telemetry deck.
    let deckConnection: DeckConnection = 'standby';
    if (!backendConnected) deckConnection = 'disconnected';
    else if (isRunning) deckConnection = 'live';
    else if (isComplete) deckConnection = 'complete';

    // ────────────────────────────────────────────────────────────────────────
    // EFFECTS
    // ────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        const checkTier = async () => {
            // No backend wired up → stay on the safe default (no custom batteries).
            if (!isApiConfigured()) return;
            try {
                const sb = getSupabase();
                const session = (await sb?.auth.getSession())?.data.session;

                const headers: HeadersInit = { 'Content-Type': 'application/json' };
                if (session?.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                }

                const res = await apiFetch(API.GATEKEEPER, {
                    method: 'POST',
                    headers
                });
                const data = (await res.json()) as GatekeeperResponse;
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
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            try {
                setCodebaseTarget(readSavedCodebaseTarget());
            } catch {
                setCodebaseTarget(null);
            }
        });
        return () => {
            cancelled = true;
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
            setIsComplete(true);
        }, 1200);
    }, [addLine, onStatusChange]);

    const handleRunCompletion = useCallback((run: ArmageddonRun) => {
        addLine(LABELS.SYS, LABELS.DIVIDER, MSG_TYPE.SUCCESS);
        setTerminalStatus(run.status);
        if (run.status === 'passed') {
            const executed = run.batteries_executed?.length ?? 0;
            const passed = run.batteries_passed?.length ?? executed;
            const denom = executed || passed || selectedBatteries.length;
            const escapeRate = run.escape_rate ?? 0;
            addLine(LABELS.SYS, `${passed}/${denom} BATTERIES PASSED | ESCAPE RATE: ${(escapeRate * 100).toFixed(2)}%`, MSG_TYPE.SUCCESS);
            addLine(LABELS.SYS, 'VERDICT: EVIDENCE GENERATED — SUBMIT FOR REVIEW', MSG_TYPE.SUCCESS);
            onStatusChange?.('certified');
        } else if (run.status === 'cancelled') {
            addLine(LABELS.SYS, 'VERDICT: RUN CANCELLED — NO CERTIFICATION ISSUED', MSG_TYPE.WARNING);
            onStatusChange?.('idle');
        } else {
            addLine(LABELS.SYS, 'VERDICT: BREACH EVIDENCE RECORDED — REVIEW REQUIRED', MSG_TYPE.ERROR);
            onStatusChange?.('rejected');
        }
        addLine(LABELS.SYS, LABELS.DIVIDER, MSG_TYPE.SUCCESS);
        setIsRunning(false);
        setIsComplete(true);
    }, [addLine, onStatusChange, selectedBatteries]);

    const initiateSequence = useCallback(async () => {
        if (isRunning) return;

        const savedTarget = readSavedCodebaseTarget();
        setCodebaseTarget(savedTarget);
        const readiness = canStartRunForTarget(savedTarget);
        if (!readiness.ok) {
            setIsComplete(false);
            setTerminalLines([]);
            addLine(LABELS.SYS, `TARGET BLOCKED: ${readiness.reason}`, MSG_TYPE.WARNING);
            addLine(LABELS.SYS, 'No run, analysis, verdict, or certificate has been started.', MSG_TYPE.SYSTEM);
            onStatusChange?.('idle');
            return;
        }

        // Honest degradation: the public static deployment has no live-fire
        // backend. Never fabricate a run, verdict, or certificate.
        if (!isApiConfigured()) {
            setIsComplete(false);
            setTerminalLines([]);
            addLine(LABELS.SYS, 'LIVE-FIRE BACKEND NOT CONNECTED ON THIS DEPLOYMENT.', MSG_TYPE.WARNING);
            addLine(LABELS.SYS, 'This public preview cannot execute a real run.', MSG_TYPE.SYSTEM);
            addLine(LABELS.SYS, 'Start onboarding at /pricing to request a live run.', MSG_TYPE.SYSTEM);
            onStatusChange?.('idle');
            return;
        }

        setIsRunning(true);
        setIsComplete(false);
        setTerminalLines([]);
        setCurrentBattery(0);
        // Clear prior telemetry so the deck/matrix start from a real, empty state.
        dispatchTelemetry({ type: 'reset' });
        onStatusChange?.('calibrating');
        setFlashActive(true);
        setTimeout(() => setFlashActive(false), 100);

        addLine(LABELS.SYS, '▓▓▓ ARMAGEDDON LEVEL 8 SEQUENCE INITIATED ▓▓▓', MSG_TYPE.SYSTEM);
        addLine(LABELS.SYS, 'Connecting to Temporal workflow engine...', MSG_TYPE.SYSTEM);

        // Resolve a real session + organization. Never fall back to a demo or user id.
        const org = await resolveActiveOrg();
        if (!org.ok) {
            const messages: Record<typeof org.reason, string> = {
                'unauthenticated': 'Sign in to start a certification run.',
                'no-org': 'Your account has no organization membership. Visit /pricing or contact your admin.',
                'org-error': 'Could not resolve your organization. Please retry.',
            };
            addLine(LABELS.SYS, messages[org.reason], MSG_TYPE.WARNING);
            setIsRunning(false);
            onStatusChange?.('idle');
            return;
        }
        const orgId = org.organizationId;
        setOrganizationId(orgId);
        let runId: string;

        if (!savedTarget || savedTarget.kind !== 'repository') {
            addLine('CRIT', 'FATAL ERROR: Repository target is missing. Please configure target in onboarding first.', MSG_TYPE.ERROR);
            setIsRunning(false);
            onStatusChange?.('idle');
            return;
        }
        const targetUrl = savedTarget.repositoryUrl;

        try {
            const { ok, status, data } = await startWorkflowApi(orgId, 7, selectedBatteries, org.accessToken, targetUrl);

            if (!ok || !data.runId) {
                if (status === 403) {
                    handleTrapTrigger();
                    return;
                }
                throw new Error(data.error || 'Run failed');
            }
            runId = data.runId;
            setRunId(runId);
            addLine(LABELS.SYS, `Workflow started against ${targetUrl}: ${runId}`, MSG_TYPE.SYSTEM);
            addLine(LABELS.SYS, 'Subscribing to real-time event stream...', MSG_TYPE.SYSTEM);
        } catch (e) {
            console.error("API call failed", e);
            addLine('CRIT', `API Error: ${e instanceof Error ? e.message : 'Unknown error'}`, MSG_TYPE.ERROR);
            setIsRunning(false);
            setIsComplete(true);
            return;
        }

        const supabase = getSupabase();
        if (!supabase) {
            addLine('WARN', LABELS.OFFLINE_WARN, MSG_TYPE.WARNING);
            addLine(LABELS.SYS, `Workflow ${runId} started.`, MSG_TYPE.SYSTEM);
            return;
        }

        const eventsChannel = supabase
            .channel(`run_telemetry_${runId}`)
            .on('postgres_changes',
                { event: EVENTS.INSERT, schema: TABLE.SCHEMA, table: TABLE.EVENTS, filter: `run_id=eq.${runId}` },
                (payload: { new: ArmageddonEvent }) => {
                    const event = payload.new;
                    if (event.event_type === EVENTS.TRAP) {
                        handleTrapTrigger();
                        return;
                    }

                    // Feed the live telemetry deck from the same real event (single
                    // source — no extra channel). Idempotent: the reducer de-dupes by id.
                    dispatchTelemetry({ type: 'event', event });

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
                    // Live progress (escape rate, breaches, iteration cap) feeds the deck
                    // on every update — not only at terminal state.
                    dispatchTelemetry({ type: 'run', run });
                    if (isTerminalStatus(run.status)) {
                        supabase.removeChannel(eventsChannel);
                        supabase.removeChannel(runsChannel);

                        // Remove from refs too
                        subscriptionRefs.current = subscriptionRefs.current.filter(c => c !== eventsChannel && c !== runsChannel);

                        handleRunCompletion(run);
                    }
                }
            );

        runsChannel.subscribe();
        subscriptionRefs.current.push(runsChannel);

    }, [isRunning, addLine, onStatusChange, selectedBatteries, handleTrapTrigger, handleRunCompletion]);

    const handleLogout = useCallback(async () => {
        const sb = getRequiredSupabase('Supabase not initialized');
        if (sb) await endSupabaseSession(sb);
    }, []);

    const toggleBattery = useCallback((batteryId: string) => {
        if (!canCustomize || isRunning) return;
        setSelectedBatteries(prev => {
            if (prev.includes(batteryId)) {
                // Prevent unselecting the last one
                if (prev.length === 1) return prev;
                return prev.filter(b => b !== batteryId);
            }
            return [...prev, batteryId].sort((a, b) => a.localeCompare(b));
        });
    }, [canCustomize, isRunning]);

    const handleExportJson = useCallback(() => {
        // Block export without a durable organization id — never emit a demo/placeholder org.
        if (!organizationId || organizationId === 'demo-org-id' || organizationId === 'demo-org') {
            addLine(LABELS.SYS, 'EXPORT BLOCKED: no durable organization id for this run.', MSG_TYPE.ERROR);
            return;
        }

        const isTerminal = terminalStatus !== null && isTerminalStatus(terminalStatus);
        const warnings: string[] = [];
        if (!isTerminal) warnings.push('Run is not terminal — exported evidence is incomplete and non-certifiable.');
        if (!runId) warnings.push('No durable run id — evidence cannot be verified.');

        const evidence = {
            organizationId,
            terminalStatus: terminalStatus ?? null,
            certifiable: isTerminal && terminalStatus === 'passed',
            complianceMode: localStorage.getItem('complianceMode') || 'STRICT',
            timestamp: new Date().toISOString(),
            runId: runId ?? null,
            attestation: attestationPubKey
                ? {
                      spec: attestationPubKey.spec,
                      algorithm: attestationPubKey.algorithm,
                      keyId: attestationPubKey.keyId,
                      publicKey: attestationPubKey.publicKey,
                      note: 'Fetch the canonical certificate (report.json) from the run pipeline; verify with `node verify.mjs report.json --pubkey <publicKey>`.',
                  }
                : { note: 'Attestation key not configured on this instance.' },
            warnings,
            logs: terminalLines
        };
        const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `armageddon-evidence-${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [organizationId, terminalStatus, runId, attestationPubKey, terminalLines, addLine]);

    // ────────────────────────────────────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────────────────────────────────────

    return (
        <section className={`relative min-h-[600px] flex flex-col items-center justify-center p-6 overflow-hidden ${standalone ? 'bg-[var(--void)] grid-bg' : ''}`}>
            {standalone && <AuthHeader user={user} onLogout={handleLogout} />}

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
                        {/*
                          * LCP hero. Served as a multi-format <picture> (AVIF→WebP→PNG)
                          * because the Cloudflare static export uses images.unoptimized,
                          * so next/image cannot transcode. AVIF is ~33KB vs the 276KB PNG.
                          * Intrinsic 824x315 dimensions reserve the box to avoid CLS.
                          */}
                        <picture>
                            <source srcSet="/wordmark.avif" type="image/avif" />
                            <source srcSet="/wordmark.webp" type="image/webp" />
                            <img
                                src="/wordmark.png"
                                alt="ARMAGEDDON LEVEL 8"
                                width={824}
                                height={315}
                                fetchPriority="high"
                                loading="eager"
                                decoding="sync"
                                className="w-full max-w-[44rem] h-auto object-contain drop-shadow-[0_0_20px_rgba(255,80,0,0.4)] animate-pulse-slow"
                            />
                        </picture>
                    </div>

                    <div className="mt-16 mb-6 relative">
                        <h3 className="mono-data text-signal/70 text-sm mb-4 tracking-wider">BATTERY CONFIGURATION</h3>
                        {!canCustomize && (
                            <div className="absolute inset-0 z-10 bg-void/70 backdrop-blur-sm flex items-center justify-center">
                                {/* Meaningful copy sits on a solid high-contrast panel — never
                                    behind the blur — and the CTA is a real, focusable link.
                                    Honest copy: distinguish "no backend on this deployment"
                                    from a genuine tier gate, so the lock is never misread. */}
                                {backendConnected ? (
                                    <div className="text-center p-5 mx-4 max-w-xs bg-black/90 border border-[var(--aerospace)]/60 rounded-sm shadow-[0_0_24px_rgba(255,80,0,0.15)]">
                                        <p className="mono-small tracking-[0.3em] text-[var(--aerospace)] mb-3">LOCKED</p>
                                        <p className="mono-data text-signal text-sm">Custom Battery Selection</p>
                                        <p className="mono-small text-signal/80 mt-1">Requires the Verified tier or higher.</p>
                                        <a
                                            href="/pricing?upgrade=verified"
                                            className="btn-secondary inline-block mt-4 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                                        >
                                            View pricing
                                        </a>
                                    </div>
                                ) : (
                                    <div className="text-center p-5 mx-4 max-w-xs bg-black/90 border border-[var(--destructive)]/60 rounded-sm shadow-[0_0_24px_rgba(255,80,0,0.15)]">
                                        <p className="mono-small tracking-[0.3em] text-[var(--destructive)] mb-3">BACKEND NOT CONNECTED</p>
                                        <p className="mono-data text-signal text-sm">No live backend on this deployment</p>
                                        <p className="mono-small text-signal/80 mt-1">Runs, tiers, and telemetry are unavailable here — this is a configuration state, not a tier limit.</p>
                                        <a
                                            href="/pricing"
                                            className="btn-secondary inline-block mt-4 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                                        >
                                            Request access
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                        <BatterySelector
                            selectedBatteries={selectedBatteries}
                            canCustomize={canCustomize}
                            isRunning={isRunning}
                            toggleBattery={toggleBattery}
                        />
                    </div>

                    <div className="mt-8 border border-white/10 bg-black/40 p-4 rounded-sm text-left" aria-label="Codebase target readiness">
                        <p className="mono-small text-signal/60 tracking-widest uppercase">Target readiness</p>
                        {codebaseTarget ? (
                            <>
                                <p className="mono-data text-signal mt-2">{targetSummary(codebaseTarget)}</p>
                                <p className="mono-small text-signal/70 mt-1">{codebaseTarget.kind === 'repository' ? 'Repository target saved. Live run still requires backend, auth, organization membership, and workflow availability.' : 'Zip target saved locally only. Execution is blocked until real archive storage and ingestion are implemented.'}</p>
                            </>
                        ) : (
                            <p className="mono-data text-amber-300 mt-2">No codebase target saved. Complete onboarding before initiating a sequence.</p>
                        )}
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

                        <AnimatePresence>
                            {isComplete && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginTop: '1rem' }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    <button
                                        onClick={handleExportJson}
                                        className="btn-secondary w-full"
                                    >
                                        EXPORT JSON EVIDENCE
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                <motion.div
                    className="grid lg:grid-cols-3 gap-6 mb-8"
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.8, 0.25, 1] }}
                >
                    <div className="lg:col-span-2 terminal flex flex-col h-[600px] border border-white/10 bg-black/40 backdrop-blur-sm rounded-sm">
                        <div className="terminal-header items-center justify-between gap-2 border-b border-white/5 bg-[#0a0a0a] px-4 py-2 flex">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex gap-1 shrink-0" aria-hidden="true">
                                    <span className="w-1 h-3 bg-[var(--aerospace)] opacity-70"></span>
                                    <span className="w-1 h-3 bg-[var(--aerospace)] opacity-50"></span>
                                    <span className="w-1 h-3 bg-[var(--aerospace)] opacity-30"></span>
                                </div>
                                <span className="mono-small text-signal/60 tracking-widest truncate">DESTRUCTION_CONSOLE</span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4 shrink-0 flex-wrap justify-end">
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
                                <div className="border-l border-white/10 pl-4 shrink-0">
                                    <AttestationBadge />
                                </div>
                            </div>
                        </div>
                        <div className="terminal-content flex-1 overflow-y-auto p-4 font-mono text-sm custom-scrollbar" ref={terminalRef}>
                            <TerminalLog terminalLines={terminalLines} terminalRef={terminalRef} />
                        </div>
                    </div>

                    <div className="flex flex-col gap-6 h-[600px]">
                        <div className="card-panel flex-1 border border-white/10 bg-black/40 backdrop-blur-sm rounded-sm overflow-hidden flex flex-col">
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
                                    SECURE_SECTORS: {secureSectorCount}/64
                                </div>
                            </div>
                            <div className="p-6 flex-1 flex items-center justify-center bg-[url('/grid-pattern.png')] bg-repeat opacity-80">
                                <ThreatMatrix threatMap={threatMap} />
                            </div>
                        </div>
                        <LeaderboardWidget status={status} />
                    </div>
                </motion.div>

                {/* Live run telemetry — full-width row, driven by the real event stream. */}
                <motion.div
                    className="mb-8"
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.8, 0.25, 1] }}
                >
                    <RunTelemetryDeck telemetry={telemetry} connection={deckConnection} />
                </motion.div>
            </div>
        </section>
    );
}
