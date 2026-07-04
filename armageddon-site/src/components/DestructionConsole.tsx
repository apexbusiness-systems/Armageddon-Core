'use client';

import React, { useState, useEffect, useRef, useCallback, useReducer, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { endSupabaseSession } from '@/lib/client-auth-actions';
import { getRequiredSupabase } from '@/lib/browser-supabase';
import { useAuth } from '@/lib/useAuth';
import { apiFetch, isApiConfigured } from '@/lib/runtime-api';
import { DRAFT_KEY, canStartRunForTarget, readSavedCodebaseTarget, type CodebaseTarget, type OnboardingDraft } from '@/lib/codebase-target';
import LockdownModal from './paywall/LockdownModal';
import AuthHeader from './AuthHeader';
import TargetConfigPanel from './TargetConfigPanel';
import AttestationBadge, { useAttestationPubKey } from './AttestationBadge';
import LeaderboardWidget, { type Status } from './social/LeaderboardWidget';
import RunTelemetryDeck, { type DeckConnection } from './RunTelemetryDeck';
import { remainingReadinessBlockers, type ReadinessItem } from './RunReadinessChecklist';
import {
    telemetryReducer,
    EMPTY_TELEMETRY,
    deriveSectorMatrix,
    secureSectors,
    type SectorStatus,
} from '@/lib/run-telemetry';
import { useT } from '@/i18n/useT';
import type { HomeDictionary } from '@/i18n/types';

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

type ConsoleDictionary = HomeDictionary['console'];

interface BuildReadinessItemsParams {
    readonly userReady: boolean;
    readonly targetReady: boolean;
    readonly authorizationConfirmed: boolean;
    readonly orgMembershipReady: boolean;
    readonly backendConnected: boolean;
    readonly batteryAccessVerified: boolean;
    readonly attestationReady: boolean;
    readonly labels: ConsoleDictionary['readiness']['items'];
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

function signedInReadinessItem(userReady: boolean): ReadinessItem {
    return {
        id: 'signed-in',
        label: 'Signed in',
        ready: userReady,
        detail: userReady ? 'User session is active.' : 'Sign in to start a test run.',
        required: true,
        whatItMeans: userReady ? 'Armageddon can associate runs with your account.' : 'No active user session is available in this browser.',
        whyItMatters: 'Runs and evidence must be tied to an authenticated operator.',
        nextStep: userReady ? 'Continue setup.' : 'Sign in before starting a run.',
        ctaLabel: userReady ? undefined : 'Sign in',
        ctaHref: userReady ? undefined : '/onboarding',
    };
}

function targetReadinessItem(targetReady: boolean, labels: ConsoleDictionary['readiness']['items']): ReadinessItem {
    return {
        id: 'target',
        label: labels.target.label,
        ready: targetReady,
        detail: targetReady ? labels.target.detailReady : 'Choose the app, API, or agent endpoint Armageddon should test.',
        required: true,
        whatItMeans: targetReady ? 'A target endpoint is saved for this browser.' : 'Armageddon does not yet know what system to test.',
        whyItMatters: 'Every run needs an explicit, authorized target endpoint.',
        nextStep: targetReady ? 'Confirm authorization and workspace readiness.' : 'Set the target endpoint in onboarding.',
        ctaLabel: targetReady ? undefined : 'Set target',
        ctaHref: targetReady ? undefined : '/onboarding#target-config',
    };
}

function authorizationReadinessItem(authorizationConfirmed: boolean, labels: ConsoleDictionary['readiness']['items']): ReadinessItem {
    return {
        id: 'authorization',
        label: labels.authorization.label,
        ready: authorizationConfirmed,
        detail: authorizationConfirmed ? labels.authorization.detailReady : 'Confirm you are authorized to test this target.',
        required: true,
        whatItMeans: 'The operator must explicitly confirm authorized-use scope.',
        whyItMatters: 'Armageddon must only be run against systems you own or are authorized to assess.',
        nextStep: authorizationConfirmed ? 'Authorization is confirmed.' : 'Review and confirm authorization in onboarding.',
        ctaLabel: authorizationConfirmed ? undefined : 'Review authorization',
        ctaHref: authorizationConfirmed ? undefined : '/onboarding#target-config',
    };
}

function organizationReadinessItem(orgMembershipReady: boolean, labels: ConsoleDictionary['readiness']['items']): ReadinessItem {
    return {
        id: 'organization',
        label: labels.organization.label,
        ready: orgMembershipReady,
        detail: orgMembershipReady ? labels.organization.detailReady : 'Your account is signed in, but it has not been added to a workspace yet.',
        required: true,
        whatItMeans: orgMembershipReady ? 'Runs will be tied to an active workspace.' : 'A workspace is required so runs, evidence, permissions, and billing are tied to the correct organization.',
        whyItMatters: 'Workspace membership prevents orphaned evidence and unauthorized billing or permission scope.',
        nextStep: orgMembershipReady ? 'Continue setup.' : 'Ask an admin to add your login email to an organization, then refresh this page.',
        technicalDetail: orgMembershipReady ? undefined : 'The backend returned 404 from /api/me/organizations because no organization_members row exists for this user. No organization_members row was found for this Supabase user.',
    };
}

function backendReadinessItem(backendConnected: boolean, labels: ConsoleDictionary['readiness']['items']): ReadinessItem {
    return {
        id: 'backend',
        label: labels.backend.label,
        ready: backendConnected,
        detail: backendConnected ? labels.backend.detailReady : 'The live Armageddon backend is not connected in this build.',
        required: true,
        whatItMeans: backendConnected ? 'Backed run APIs are reachable from this build.' : 'This deployment can save local setup, but it cannot start real runs until NEXT_PUBLIC_ARMAGEDDON_API_BASE is configured at build time.',
        whyItMatters: 'Run initiation, gatekeeper checks, telemetry, and evidence persistence require the live backend.',
        nextStep: backendConnected ? 'Continue setup.' : 'Rebuild with NEXT_PUBLIC_ARMAGEDDON_API_BASE set to the Armageddon backend origin.',
    };
}

function testAccessReadinessItem(batteryAccessVerified: boolean, labels: ConsoleDictionary['readiness']['items']): ReadinessItem {
    return {
        id: 'battery-access',
        label: labels.batteryAccess.label,
        ready: batteryAccessVerified,
        detail: batteryAccessVerified ? labels.batteryAccess.detailReady : 'Your current account or plan cannot start this test set yet.',
        required: true,
        whatItMeans: batteryAccessVerified ? 'Gatekeeper confirmed this account can start the selected test set.' : 'The selected tests require account or plan access that is not verified yet.',
        whyItMatters: 'Access checks prevent starting tests outside the workspace plan or review scope.',
        nextStep: batteryAccessVerified ? 'Continue setup.' : 'View pricing or contact an admin to enable access.',
        ctaLabel: batteryAccessVerified ? undefined : 'View pricing',
        ctaHref: batteryAccessVerified ? undefined : '/pricing',
    };
}

function evidenceSigningReadinessItem(attestationReady: boolean): ReadinessItem {
    return {
        id: 'evidence-signing',
        label: 'Evidence signing key unavailable',
        ready: attestationReady,
        detail: attestationReady ? 'Signed verification artifacts are available.' : 'Runs may start, but signed verification artifacts are unavailable until ARMAGEDDON_ATTESTATION_SEED is configured.',
        required: false,
        whatItMeans: attestationReady ? 'The public attestation key is available for evidence verification.' : 'Certification artifacts cannot be considered complete until this is fixed.',
        whyItMatters: 'Signed evidence lets reviewers verify that artifacts came from the Armageddon pipeline.',
        nextStep: attestationReady ? 'Continue setup.' : 'Ask an operator to configure ARMAGEDDON_ATTESTATION_SEED for signed evidence.',
        technicalDetail: attestationReady ? undefined : 'ARMAGEDDON_ATTESTATION_SEED is missing or /api/attestation/pubkey is unavailable.',
    };
}

function buildReadinessItems(params: BuildReadinessItemsParams): ReadinessItem[] {
    return [
        signedInReadinessItem(params.userReady),
        targetReadinessItem(params.targetReady, params.labels),
        authorizationReadinessItem(params.authorizationConfirmed, params.labels),
        organizationReadinessItem(params.orgMembershipReady, params.labels),
        backendReadinessItem(params.backendConnected, params.labels),
        testAccessReadinessItem(params.batteryAccessVerified, params.labels),
        evidenceSigningReadinessItem(params.attestationReady),
    ];
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
    const [onboardingDraft, setOnboardingDraft] = useState<OnboardingDraft | null>(null);
    const [orgMembershipReady, setOrgMembershipReady] = useState(false);
    const [batteryAccessVerified, setBatteryAccessVerified] = useState(false);
    const [flashActive, setFlashActive] = useState(false);
    const terminalRef = useRef<HTMLDivElement>(null);
    const user = useAuth();
    const attestationPubKey = useAttestationPubKey();
    const { dictionary } = useT();
    const t = dictionary.home.console;
    const [selectedBatteries, setSelectedBatteries] = useState<string[]>(['B10', 'B11', 'B12', 'B13']);
    const [userTier, setUserTier] = useState<string>('free_dry');
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
                    setBatteryAccessVerified(Boolean(data.eligible));
                    setUserTier(data.tier);
                }
            } catch (e) {
                setBatteryAccessVerified(false);
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
                const rawDraft = localStorage.getItem(DRAFT_KEY);
                setOnboardingDraft(rawDraft ? (JSON.parse(rawDraft) as OnboardingDraft) : null);
            } catch {
                setCodebaseTarget(null);
                setOnboardingDraft(null);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const checkOrgMembership = async () => {
            if (!isApiConfigured()) {
                setOrgMembershipReady(false);
                return;
            }
            const org = await resolveActiveOrg();
            if (!cancelled) setOrgMembershipReady(org.ok);
        };
        void checkOrgMembership();
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
            addLine(LABELS.SYS, 'VERDICT: EVIDENCE GENERATED | SUBMIT FOR REVIEW', MSG_TYPE.SUCCESS);
            onStatusChange?.('certified');
        } else if (run.status === 'cancelled') {
            addLine(LABELS.SYS, 'VERDICT: RUN CANCELLED | NO CERTIFICATION ISSUED', MSG_TYPE.WARNING);
            onStatusChange?.('idle');
        } else {
            addLine(LABELS.SYS, 'VERDICT: BREACH EVIDENCE RECORDED | REVIEW REQUIRED', MSG_TYPE.ERROR);
            onStatusChange?.('rejected');
        }
        addLine(LABELS.SYS, LABELS.DIVIDER, MSG_TYPE.SUCCESS);
        setIsRunning(false);
        setIsComplete(true);
    }, [addLine, onStatusChange, selectedBatteries]);

    const readinessItems = useMemo<ReadinessItem[]>(() => buildReadinessItems({
        userReady: user !== null,
        targetReady: codebaseTarget !== null,
        authorizationConfirmed: onboardingDraft?.authorizationConfirmed === true,
        orgMembershipReady,
        backendConnected,
        batteryAccessVerified,
        attestationReady: attestationPubKey !== null,
        labels: t.readiness.items,
    }), [attestationPubKey, backendConnected, batteryAccessVerified, codebaseTarget, onboardingDraft, orgMembershipReady, t, user]);

    const initiateSequence = useCallback(async () => {
        if (isRunning) return;

        const savedTarget = readSavedCodebaseTarget();
        setCodebaseTarget(savedTarget);
        const targetReadiness = canStartRunForTarget(savedTarget);
        const blockers = remainingReadinessBlockers(readinessItems);
        if (!targetReadiness.ok || blockers.length > 0) {
            setIsComplete(false);
            setTerminalLines([]);
            const reason = targetReadiness.ok
                ? `${t.readiness.completeItemsFirstPrefix}${blockers.join(', ')}.`
                : targetReadiness.code === 'missing' ? t.readiness.targetMissingReason : t.readiness.targetInvalidReason;
            addLine(LABELS.SYS, `${t.readiness.runBlockedPrefix}${reason}`, MSG_TYPE.WARNING);
            addLine(LABELS.SYS, t.readiness.noRunStarted, MSG_TYPE.SYSTEM);
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

        const targetLevel = userTier === 'certified' ? 8 : userTier === 'verified' ? 6 : 3;
        addLine(LABELS.SYS, `▓▓▓ ARMAGEDDON LEVEL ${targetLevel} SEQUENCE INITIATED ▓▓▓`, MSG_TYPE.SYSTEM);
        addLine(LABELS.SYS, 'Connecting to Temporal workflow engine...', MSG_TYPE.SYSTEM);

        // Resolve a real session + organization. Never fall back to a demo or user id.
        const org = await resolveActiveOrg();
        if (!org.ok) {
            const messages: Record<typeof org.reason, string> = {
                'unauthenticated': 'Sign in to start a certification run.',
                'no-org': 'Your account is signed in, but it has not been added to a workspace yet. Ask an admin to add your login email to an organization, then refresh this page. Admin detail: No organization_members row was found for this Supabase user.',
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

        if (!savedTarget) {
            addLine('CRIT', t.readiness.targetMissingFatal, MSG_TYPE.ERROR);
            setIsRunning(false);
            onStatusChange?.('idle');
            return;
        }
        const targetUrl = savedTarget.endpointUrl;

        try {
            const { ok, status, data } = await startWorkflowApi(orgId, targetLevel, selectedBatteries, org.accessToken, targetUrl);

            if (!ok || !data.runId) {
                if (status === 403) {
                    // Eligibility/membership denial (e.g. plan tier, battery access) —
                    // not an adversarial signal. Surface it like the org-membership
                    // check above; genuine trap detection stays on the EVENTS.TRAP
                    // realtime channel handler below.
                    addLine(LABELS.SYS, data.error || 'Access denied.', MSG_TYPE.WARNING);
                    if (data.upsellMessage) {
                        addLine(LABELS.SYS, data.upsellMessage, MSG_TYPE.WARNING);
                    }
                    if (data.upgradeUrl) {
                        addLine(LABELS.SYS, `Upgrade: ${data.upgradeUrl}`, MSG_TYPE.WARNING);
                    }
                    setIsRunning(false);
                    onStatusChange?.('idle');
                    return;
                }
                throw new Error(data.error || 'Run failed');
            }
            runId = data.runId;
            setRunId(runId);
            addLine(LABELS.SYS, t.readiness.workflowStartedAgainst.replace('{url}', targetUrl).replace('{runId}', runId), MSG_TYPE.SYSTEM);
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

    }, [isRunning, readinessItems, addLine, onStatusChange, selectedBatteries, handleTrapTrigger, handleRunCompletion, t]);

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
        if (!isTerminal) warnings.push('Run is not terminal: exported evidence is incomplete and non-certifiable.');
        if (!runId) warnings.push('No durable run id: evidence cannot be verified.');

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

                    <div className="mt-[calc(2rem+2cm)] mb-6 relative">
                        <TargetConfigPanel />
                        <h3 className="mono-data text-signal/70 text-sm mb-4 tracking-wider">STEP 2 — BATTERY CONFIGURATION</h3>
                        {!canCustomize && (
                            <div className="absolute inset-0 z-10 bg-void/70 backdrop-blur-sm flex items-center justify-center">
                                {/* Meaningful copy sits on a solid high-contrast panel — never
                                    behind the blur — and the CTA is a real, focusable link.
                                    Honest copy: distinguish "no backend on this deployment"
                                    from a genuine tier gate, so the lock is never misread. */}
                                {backendConnected ? (
                                    <div className="text-center p-5 mx-4 max-w-xs bg-black/90 border border-[var(--aerospace)]/60 rounded-sm shadow-[0_0_24px_rgba(255,80,0,0.15)]">
                                        <p className="mono-small tracking-[0.3em] text-[var(--aerospace)] mb-3 uppercase">{t.lockedLabel}</p>
                                        <p className="mono-data text-signal text-sm">{t.customBatterySelection}</p>
                                        <p className="mono-small text-signal/80 mt-1">{t.requiresVerifiedTier}</p>
                                        <a
                                            href="/pricing?upgrade=verified"
                                            className="btn-secondary inline-block mt-4 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                                        >
                                            {t.viewPricing}
                                        </a>
                                    </div>
                                ) : (
                                    <div className="text-center p-5 mx-4 max-w-xs bg-black/90 border border-[var(--destructive)]/60 rounded-sm shadow-[0_0_24px_rgba(255,80,0,0.15)]">
                                        <p className="mono-small tracking-[0.3em] text-[var(--destructive)] mb-3 uppercase">{t.backendNotConnectedLabel}</p>
                                        <p className="mono-data text-signal text-sm">{t.noLiveBackendDesc}</p>
                                        <p className="mono-small text-signal/80 mt-1">{t.configStateNotice}</p>
                                        <a
                                            href="/pricing"
                                            className="btn-secondary inline-block mt-4 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                                        >
                                            {t.requestAccess}
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
                                        <span className="flex items-center gap-3 uppercase">
                                            <span className="w-2 h-2 bg-aerospace rounded-full animate-pulse" />
                                            {t.executingLabel} {currentBattery}/13
                                        </span>
                                    );
                                }
                                return (
                                    <span className="uppercase">
                                        {isComplete ? t.reinitiateSequence : t.initiateSequence}
                                    </span>
                                );
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
                                        className="btn-secondary w-full uppercase"
                                    >
                                        {t.exportJsonEvidence}
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
                                <span className="mono-small text-signal/60 tracking-widest truncate uppercase">{t.consoleLabel}</span>
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
                                    <span className={`mono-small ${isRunning ? 'text-[var(--safe)]' : 'text-zinc-500'} opacity-70 uppercase`}>
                                        {isRunning ? t.statusOnline : t.statusStandby}
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
                                    <span className="mono-small text-signal/60 tracking-widest uppercase">{t.threatMatrixLabel}</span>
                                </div>
                                <div className="mono-small text-zinc-500 uppercase">
                                    {t.secureSectorsLabel}: {secureSectorCount}/64
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
