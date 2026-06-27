/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RUN TELEMETRY — pure, real-data reducer for the live Destruction Console
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every value here is derived ONLY from the genuine Supabase stream the engine
 * already emits (`packages/core/src/core/reporter.ts`):
 *   • armageddon_events  — per-attack INSERTs (ATTACK_BLOCKED / BREACH / …)
 *   • armageddon_runs    — run-level progress UPDATEs (escape_rate, breaches…)
 *
 * Nothing is fabricated. The reducer is pure (unit-testable without a DOM),
 * idempotent (realtime can redeliver a row — we de-dupe by event id), and
 * bounded (ring buffers) so a 10,000-iteration run never unbounds React state.
 */

/** Adversarial batteries surfaced in the deck (the "GOD MODE" tier). */
export const BATTERY_IDS = ['B10', 'B11', 'B12', 'B13', 'B14'] as const;

/** Waveform ring-buffer size — the seismograph shows the last N events. */
export const WAVEFORM_CAPACITY = 120;
/** Matrix size — the 64-cell rolling "secure sectors" wall. */
export const SECTOR_COUNT = 64;
/** De-dupe memory bound (ids of recently-applied events). */
const SEEN_CAPACITY = 512;

export type SpikeKind = 'block' | 'breach' | 'drift' | 'marker';

export interface TelemetrySpike {
    /** Monotonic sequence — stable React key and x-ordering. */
    seq: number;
    kind: SpikeKind;
    battery: string;
    iteration: number;
}

export interface BatteryVitals {
    battery: string;
    blocked: number;
    breaches: number;
    drift: number;
    lastIteration: number;
}

export type SectorStatus = 'idle' | 'safe' | 'danger';

export interface TelemetryState {
    spikes: TelemetrySpike[];
    /** Last SECTOR_COUNT block/breach outcomes, oldest→newest. */
    outcomes: SectorStatus[];
    batteries: Record<string, BatteryVitals>;
    totalBlocked: number;
    totalBreaches: number;
    /** 0..1 — authoritative from the run row when present, else derived. */
    escapeRate: number;
    /** Configured iteration cap per battery (from the run row). */
    totalIterations: number;
    activeBattery: string | null;
    firstEventAt: number | null;
    lastEventAt: number | null;
    seq: number;
    seenIds: string[];
}

export const EMPTY_TELEMETRY: TelemetryState = {
    spikes: [],
    outcomes: [],
    batteries: {},
    totalBlocked: 0,
    totalBreaches: 0,
    escapeRate: 0,
    totalIterations: 0,
    activeBattery: null,
    firstEventAt: null,
    lastEventAt: null,
    seq: 0,
    seenIds: [],
};

/** Raw armageddon_events row shape (only the fields the deck consumes). */
export interface RawTelemetryEvent {
    id?: string;
    event_type: string;
    battery_id?: string | null;
    iteration?: number | null;
    severity?: string | null;
    created_at?: string | null;
}

/** Raw armageddon_runs progress fields. */
export interface RawRunProgress {
    escape_rate?: number | null;
    breaches?: number | null;
    total_iterations?: number | null;
}

export type TelemetryAction =
    | { type: 'reset' }
    | { type: 'event'; event: RawTelemetryEvent }
    | { type: 'run'; run: RawRunProgress };

const SPIKE_KIND: Record<string, SpikeKind> = {
    ATTACK_BLOCKED: 'block',
    BREACH: 'breach',
    DRIFT_DETECTED: 'drift',
};

function vitalsFor(state: TelemetryState, battery: string): BatteryVitals {
    return (
        state.batteries[battery] ?? {
            battery,
            blocked: 0,
            breaches: 0,
            drift: 0,
            lastIteration: 0,
        }
    );
}

function applyEvent(state: TelemetryState, event: RawTelemetryEvent): TelemetryState {
    // Idempotency: realtime may redeliver. Skip ids we've already folded in.
    if (event.id && state.seenIds.includes(event.id)) return state;

    const kind = SPIKE_KIND[event.event_type] ?? 'marker';
    const battery = event.battery_id ?? 'SYS';
    const iteration =
        typeof event.iteration === 'number' && Number.isFinite(event.iteration)
            ? event.iteration
            : 0;
    const at = event.created_at ? Date.parse(event.created_at) : Date.now();
    const seq = state.seq + 1;

    const next: TelemetryState = {
        ...state,
        seq,
        firstEventAt: state.firstEventAt ?? at,
        lastEventAt: at,
        seenIds: event.id
            ? [...state.seenIds, event.id].slice(-SEEN_CAPACITY)
            : state.seenIds,
    };

    // Waveform ring buffer (skip pure markers that carry no battery signal).
    next.spikes = [...state.spikes, { seq, kind, battery, iteration }].slice(
        -WAVEFORM_CAPACITY
    );

    // Active battery follows the most recent battery-scoped event.
    if (battery !== 'SYS') next.activeBattery = battery;

    // Per-battery vitals + run totals + the rolling sector wall.
    if (kind === 'block' || kind === 'breach' || kind === 'drift') {
        const v = vitalsFor(state, battery);
        next.batteries = {
            ...state.batteries,
            [battery]: {
                battery,
                blocked: v.blocked + (kind === 'block' ? 1 : 0),
                breaches: v.breaches + (kind === 'breach' ? 1 : 0),
                drift: v.drift + (kind === 'drift' ? 1 : 0),
                lastIteration: Math.max(v.lastIteration, iteration),
            },
        };
        if (kind === 'block') next.totalBlocked = state.totalBlocked + 1;
        if (kind === 'breach') next.totalBreaches = state.totalBreaches + 1;
        if (kind === 'block' || kind === 'breach') {
            const outcome: SectorStatus = kind === 'block' ? 'safe' : 'danger';
            next.outcomes = [...state.outcomes, outcome].slice(-SECTOR_COUNT);
        }
    }

    return next;
}

function applyRun(state: TelemetryState, run: RawRunProgress): TelemetryState {
    const next = { ...state };
    if (typeof run.escape_rate === 'number' && Number.isFinite(run.escape_rate)) {
        next.escapeRate = run.escape_rate;
    }
    if (typeof run.total_iterations === 'number' && Number.isFinite(run.total_iterations)) {
        next.totalIterations = run.total_iterations;
    }
    return next;
}

export function telemetryReducer(
    state: TelemetryState,
    action: TelemetryAction
): TelemetryState {
    switch (action.type) {
        case 'reset':
            return EMPTY_TELEMETRY;
        case 'event':
            return applyEvent(state, action.event);
        case 'run':
            return applyRun(state, action.run);
        default:
            return state;
    }
}

/** Count of repelled sectors in the current rolling window (≤ SECTOR_COUNT). */
export function secureSectors(state: TelemetryState): number {
    return state.outcomes.reduce((n, o) => (o === 'safe' ? n + 1 : n), 0);
}

/**
 * Project the rolling outcomes onto the 64-cell matrix, oldest→newest, with
 * not-yet-observed sectors left idle. Pure → safe to call in a useMemo.
 */
export function deriveSectorMatrix(state: TelemetryState): SectorStatus[] {
    const cells: SectorStatus[] = Array.from({ length: SECTOR_COUNT }, () => 'idle' as SectorStatus);
    for (let i = 0; i < state.outcomes.length && i < SECTOR_COUNT; i++) {
        cells[i] = state.outcomes[i];
    }
    return cells;
}

/** Live effective escape rate (prefers the authoritative run value). */
export function effectiveEscapeRate(state: TelemetryState): number {
    if (state.escapeRate > 0) return state.escapeRate;
    const total = state.totalBlocked + state.totalBreaches;
    return total > 0 ? state.totalBreaches / total : 0;
}

/** Throughput in probes/sec across the observed window (0 when indeterminate). */
export function throughputPerSec(state: TelemetryState): number {
    if (state.firstEventAt === null || state.lastEventAt === null) return 0;
    const elapsedMs = state.lastEventAt - state.firstEventAt;
    if (elapsedMs <= 0) return 0;
    const probes = state.totalBlocked + state.totalBreaches;
    return probes / (elapsedMs / 1000);
}
