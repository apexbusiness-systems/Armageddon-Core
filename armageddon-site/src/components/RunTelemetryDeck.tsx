'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RunTelemetryDeck — live "Containment Monitor" for an Armageddon run
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A novel, real-data telemetry surface driven entirely by the Supabase event /
 * run stream (see `@/lib/run-telemetry`). Three coordinated readouts:
 *
 *   1. Containment Seismograph — a canvas EKG/seismograph where every real
 *      attack event is a spike (▲ blocked / ▼ breach / · drift). Bounded ring
 *      buffer; rendered via requestAnimationFrame so a 10k-iteration run never
 *      stalls React. Honours prefers-reduced-motion (static last frame).
 *   2. Live metric readouts — escape rate, repelled, breaches, throughput.
 *   3. Per-battery vital bars — B10–B14 blocked/breach split + progress.
 *
 * Honest by construction: with no backend or no active run it shows a truthful
 * idle state instead of fabricating activity.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
    BATTERY_IDS,
    effectiveEscapeRate,
    throughputPerSec,
    type TelemetryState,
} from '@/lib/run-telemetry';

export type DeckConnection = 'disconnected' | 'standby' | 'live' | 'complete';

interface RunTelemetryDeckProps {
    telemetry: TelemetryState;
    connection: DeckConnection;
}

/** Header status-light colour per connection state. */
const HEADER_LIGHT: Record<DeckConnection, string> = {
    live: 'bg-[var(--safe)] animate-pulse',
    complete: 'bg-[var(--safe)]',
    disconnected: 'bg-[var(--destructive)]',
    standby: 'bg-zinc-700',
};

/** Read a CSS custom property off an element (falls back to a literal). */
function cssVar(el: Element | null, name: string, fallback: string): string {
    if (!el) return fallback;
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
}

// ── Seismograph ──────────────────────────────────────────────────────────────

const Seismograph = React.memo(function Seismograph({
    telemetry,
    animate,
}: Readonly<{
    telemetry: TelemetryState;
    animate: boolean;
}>) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const spikes = telemetry.spikes;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const safe = cssVar(canvas, '--safe', '#00FF88');
        const danger = cssVar(canvas, '--destructive', '#FF3300');
        const warn = cssVar(canvas, '--warning', '#FFB800');
        const dim = 'rgba(232,232,232,0.18)';

        let raf = 0;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = canvas.clientWidth || 600;
            const h = canvas.clientHeight || 160;
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);

        const draw = () => {
            const w = canvas.clientWidth || 600;
            const h = canvas.clientHeight || 160;
            const mid = h / 2;
            ctx.clearRect(0, 0, w, h);

            // Baseline.
            ctx.strokeStyle = dim;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, mid);
            ctx.lineTo(w, mid);
            ctx.stroke();

            const cap = 120;
            const step = w / cap;
            const maxAmp = mid - 6;

            for (let i = 0; i < spikes.length; i++) {
                const s = spikes[i];
                const x = w - (spikes.length - i) * step + step / 2;
                if (x < 0) continue;

                let color: string;
                let amp: number;
                if (s.kind === 'block') {
                    color = safe;
                    amp = -maxAmp * 0.85; // up
                } else if (s.kind === 'breach') {
                    color = danger;
                    amp = maxAmp * 0.95; // down
                } else if (s.kind === 'drift') {
                    color = warn;
                    amp = -maxAmp * 0.35;
                } else {
                    // marker — faint full-height tick
                    ctx.strokeStyle = dim;
                    ctx.beginPath();
                    ctx.moveTo(x, 4);
                    ctx.lineTo(x, h - 4);
                    ctx.stroke();
                    continue;
                }

                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, mid);
                ctx.lineTo(x, mid + amp);
                ctx.stroke();
                // spike head
                ctx.fillStyle = color;
                ctx.fillRect(x - 1.5, mid + amp - 1.5, 3, 3);
            }

            // Live "now" cursor sweep (animation only).
            if (animate) {
                ctx.strokeStyle = 'rgba(255,51,0,0.25)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(w - 1, 0);
                ctx.lineTo(w - 1, h);
                ctx.stroke();
                raf = requestAnimationFrame(draw);
            }
        };

        draw();

        return () => {
            window.removeEventListener('resize', resize);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [animate, spikes]);

    const label = `Containment seismograph: ${telemetry.totalBlocked} attacks repelled, ${telemetry.totalBreaches} breaches`;

    // The canvas is a visual rendering of data already exposed accessibly via the
    // metric readouts and per-battery bars; expose a concise text summary for
    // assistive tech and mark the canvas itself decorative.
    return (
        <div className="relative">
            <span className="sr-only">{label}</span>
            {/* Unlabeled canvas is ignored by assistive tech; the sr-only summary
                above carries the meaning, and the metric readouts are accessible. */}
            <canvas ref={canvasRef} className="w-full h-[160px] block" />
        </div>
    );
});

// ── Metric readout ───────────────────────────────────────────────────────────

type MetricTone = 'neutral' | 'safe' | 'danger' | 'warn';

const METRIC_TONE_CLASS: Record<MetricTone, string> = {
    neutral: 'text-signal',
    safe: 'text-[var(--safe)]',
    danger: 'text-[var(--destructive)]',
    warn: 'text-amber-500',
};

function Metric({
    label,
    value,
    tone = 'neutral',
}: Readonly<{
    label: string;
    value: string;
    tone?: MetricTone;
}>) {
    const toneClass = METRIC_TONE_CLASS[tone];
    return (
        <div className="flex flex-col">
            <span className="mono-small text-signal/40 text-[10px] tracking-widest">{label}</span>
            <span className={`mono-data text-lg ${toneClass}`}>{value}</span>
        </div>
    );
}

// ── Per-battery vital bar ────────────────────────────────────────────────────

const BATTERY_NAMES: Record<string, string> = {
    B10: 'GOAL_HIJACK',
    B11: 'TOOL_MISUSE',
    B12: 'MEMORY_POISON',
    B13: 'SUPPLY_CHAIN',
    B14: 'LIVE_FIRE',
};

function VitalBar({
    battery,
    blocked,
    breaches,
    active,
}: Readonly<{
    battery: string;
    blocked: number;
    breaches: number;
    active: boolean;
}>) {
    const total = blocked + breaches;
    const breachPct = total > 0 ? (breaches / total) * 100 : 0;
    const blockPct = total > 0 ? 100 - breachPct : 0;
    return (
        <div
            className="flex items-center gap-2"
            aria-label={`${battery} ${BATTERY_NAMES[battery] ?? ''}: ${blocked} repelled, ${breaches} breached`}
        >
            <span
                className={`mono-small text-[10px] w-9 shrink-0 ${active ? 'text-[var(--aerospace)]' : 'text-signal/50'}`}
            >
                {battery}
                {active && <span className="ml-1 inline-block w-1 h-1 rounded-full bg-[var(--aerospace)] animate-pulse align-middle" />}
            </span>
            <div className="flex-1 h-2 rounded-sm overflow-hidden bg-white/5 flex">
                <div className="h-full bg-[var(--safe)]/70" style={{ width: `${blockPct}%` }} />
                <div className="h-full bg-[var(--destructive)]" style={{ width: `${breachPct}%` }} />
            </div>
            <span className="mono-small text-[10px] w-16 shrink-0 text-right text-signal/60 tabular-nums">
                {blocked}/{total}
            </span>
        </div>
    );
}

// ── Idle / honest states ─────────────────────────────────────────────────────

function DeckMessage({ title, body, tone }: Readonly<{ title: string; body: string; tone: 'danger' | 'neutral' }>) {
    return (
        <div className="h-[220px] flex flex-col items-center justify-center text-center px-6">
            <p
                className={`mono-small tracking-[0.3em] mb-2 ${tone === 'danger' ? 'text-[var(--destructive)]' : 'text-signal/50'}`}
            >
                {title}
            </p>
            <p className="mono-small text-signal/40 max-w-sm">{body}</p>
        </div>
    );
}

// ── Deck ─────────────────────────────────────────────────────────────────────

export default function RunTelemetryDeck({ telemetry, connection }: Readonly<RunTelemetryDeckProps>) {
    const prefersReducedMotion = useReducedMotion();
    const animate = connection === 'live' && !prefersReducedMotion;

    const escapeRate = useMemo(() => effectiveEscapeRate(telemetry), [telemetry]);
    const throughput = useMemo(() => throughputPerSec(telemetry), [telemetry]);

    const headerLight = HEADER_LIGHT[connection];

    return (
        <section
            aria-label="Live run telemetry"
            className="card-panel border border-white/10 bg-black/40 backdrop-blur-sm rounded-sm overflow-hidden"
        >
            <div className="terminal-header items-center justify-between gap-2 border-b border-white/5 bg-[#0a0a0a] px-4 py-2 flex">
                <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${headerLight}`} />
                    <span className="mono-small text-signal/60 tracking-widest truncate">CONTAINMENT_MONITOR</span>
                </div>
                <span className="mono-small text-zinc-500 text-[10px] shrink-0">
                    {connection === 'live'
                        ? `ACTIVE // ${telemetry.activeBattery ?? '--'}`
                        : connection.toUpperCase()}
                </span>
            </div>

            {connection === 'disconnected' && (
                <DeckMessage
                    tone="danger"
                    title="BACKEND NOT CONNECTED"
                    body="This deployment has no live backend wired up, so run telemetry is unavailable here. Start onboarding at /pricing to request a live run."
                />
            )}

            {connection === 'standby' && (
                <DeckMessage
                    tone="neutral"
                    title="STANDBY // AWAITING SEQUENCE"
                    body="Initiate a sequence to stream live containment telemetry from the engine."
                />
            )}

            {(connection === 'live' || connection === 'complete') && (
                <div className="p-4 flex flex-col gap-4">
                    {/* Seismograph */}
                    <div className="rounded-sm border border-white/5 bg-black/40 px-2 py-1">
                        <Seismograph telemetry={telemetry} animate={animate} />
                        <div className="flex items-center gap-4 px-1 pb-1 mono-small text-[10px] text-signal/40">
                            <span><span className="text-[var(--safe)]">▲</span> REPELLED</span>
                            <span><span className="text-[var(--destructive)]">▼</span> BREACH</span>
                            <span><span className="text-amber-500">·</span> DRIFT</span>
                        </div>
                    </div>

                    {/* Live metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <Metric
                            label="ESCAPE RATE"
                            value={`${(escapeRate * 100).toFixed(2)}%`}
                            tone={escapeRate > 0 ? 'danger' : 'safe'}
                        />
                        <Metric label="REPELLED" value={telemetry.totalBlocked.toLocaleString()} tone="safe" />
                        <Metric
                            label="BREACHES"
                            value={telemetry.totalBreaches.toLocaleString()}
                            tone={telemetry.totalBreaches > 0 ? 'danger' : 'neutral'}
                        />
                        <Metric
                            label="THROUGHPUT"
                            value={throughput > 0 ? `${throughput.toFixed(0)}/s` : '--'}
                        />
                    </div>

                    {/* Per-battery vitals */}
                    <div className="flex flex-col gap-2 pt-1">
                        {BATTERY_IDS.map((b) => {
                            const v = telemetry.batteries[b];
                            return (
                                <VitalBar
                                    key={b}
                                    battery={b}
                                    blocked={v?.blocked ?? 0}
                                    breaches={v?.breaches ?? 0}
                                    active={telemetry.activeBattery === b}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}
