import { describe, it, expect } from 'vitest';
import {
    telemetryReducer,
    EMPTY_TELEMETRY,
    secureSectors,
    deriveSectorMatrix,
    effectiveEscapeRate,
    SECTOR_COUNT,
    WAVEFORM_CAPACITY,
    type TelemetryState,
    type RawTelemetryEvent,
} from '@/lib/run-telemetry';

function feed(events: RawTelemetryEvent[], start: TelemetryState = EMPTY_TELEMETRY): TelemetryState {
    return events.reduce((s, event) => telemetryReducer(s, { type: 'event', event }), start);
}

describe('run-telemetry reducer — real-data aggregation', () => {
    it('aggregates blocked and breach events per battery and in totals', () => {
        const s = feed([
            { id: '1', event_type: 'ATTACK_BLOCKED', battery_id: 'B10', iteration: 1 },
            { id: '2', event_type: 'ATTACK_BLOCKED', battery_id: 'B10', iteration: 2 },
            { id: '3', event_type: 'BREACH', battery_id: 'B12', iteration: 5 },
        ]);
        expect(s.totalBlocked).toBe(2);
        expect(s.totalBreaches).toBe(1);
        expect(s.batteries.B10.blocked).toBe(2);
        expect(s.batteries.B12.breaches).toBe(1);
        expect(s.batteries.B10.lastIteration).toBe(2);
        expect(s.activeBattery).toBe('B12');
    });

    it('is idempotent — a redelivered event id is folded in only once', () => {
        const once = feed([{ id: 'dup', event_type: 'BREACH', battery_id: 'B11', iteration: 1 }]);
        const twice = telemetryReducer(once, {
            type: 'event',
            event: { id: 'dup', event_type: 'BREACH', battery_id: 'B11', iteration: 1 },
        });
        expect(twice.totalBreaches).toBe(1);
        expect(twice).toBe(once); // unchanged reference — no double count
    });

    it('bounds the waveform ring buffer at WAVEFORM_CAPACITY', () => {
        const many: RawTelemetryEvent[] = Array.from({ length: WAVEFORM_CAPACITY + 50 }, (_, i) => ({
            id: `e${i}`,
            event_type: 'ATTACK_BLOCKED',
            battery_id: 'B10',
            iteration: i,
        }));
        const s = feed(many);
        expect(s.spikes).toHaveLength(WAVEFORM_CAPACITY);
        expect(s.totalBlocked).toBe(WAVEFORM_CAPACITY + 50); // totals are not truncated
    });

    it('projects real outcomes onto a truthful 64-cell sector matrix', () => {
        const s = feed([
            { id: '1', event_type: 'ATTACK_BLOCKED', battery_id: 'B10', iteration: 1 },
            { id: '2', event_type: 'BREACH', battery_id: 'B10', iteration: 2 },
            { id: '3', event_type: 'ATTACK_BLOCKED', battery_id: 'B10', iteration: 3 },
        ]);
        const cells = deriveSectorMatrix(s);
        expect(cells).toHaveLength(SECTOR_COUNT);
        expect(cells[0]).toBe('safe');
        expect(cells[1]).toBe('danger');
        expect(cells[2]).toBe('safe');
        expect(cells[3]).toBe('idle');
        expect(secureSectors(s)).toBe(2);
    });

    it('takes the authoritative escape_rate from a run update when present', () => {
        let s = feed([{ id: '1', event_type: 'BREACH', battery_id: 'B10', iteration: 1 }]);
        // Derived (no run row yet): 1 breach / 1 total = 1.0
        expect(effectiveEscapeRate(s)).toBeCloseTo(1.0);
        s = telemetryReducer(s, { type: 'run', run: { escape_rate: 0.0123, total_iterations: 10000 } });
        expect(s.escapeRate).toBeCloseTo(0.0123);
        expect(s.totalIterations).toBe(10000);
        expect(effectiveEscapeRate(s)).toBeCloseTo(0.0123);
    });

    it('reset returns to the empty baseline', () => {
        const s = feed([{ id: '1', event_type: 'BREACH', battery_id: 'B10', iteration: 1 }]);
        expect(telemetryReducer(s, { type: 'reset' })).toBe(EMPTY_TELEMETRY);
    });
});
