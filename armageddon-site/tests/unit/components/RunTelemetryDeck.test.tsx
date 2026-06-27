// @vitest-environment jsdom
/**
 * UI tests for RunTelemetryDeck — verifies HONEST states and that live metrics
 * render from real telemetry. Canvas is not implemented in jsdom; the
 * seismograph effect bails on a null 2d context, so the deck must still render.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import RunTelemetryDeck from '@/components/RunTelemetryDeck';
import { EMPTY_TELEMETRY, telemetryReducer, type TelemetryState } from '@/lib/run-telemetry';

afterEach(cleanup);

function withEvents(): TelemetryState {
    let s = EMPTY_TELEMETRY;
    s = telemetryReducer(s, { type: 'event', event: { id: '1', event_type: 'ATTACK_BLOCKED', battery_id: 'B10', iteration: 1 } });
    s = telemetryReducer(s, { type: 'event', event: { id: '2', event_type: 'BREACH', battery_id: 'B12', iteration: 2 } });
    s = telemetryReducer(s, { type: 'run', run: { escape_rate: 0.05, total_iterations: 100 } });
    return s;
}

describe('RunTelemetryDeck', () => {
    it('shows the honest BACKEND NOT CONNECTED state (not a tier gate)', () => {
        render(<RunTelemetryDeck telemetry={EMPTY_TELEMETRY} connection="disconnected" />);
        expect(screen.getByText('BACKEND NOT CONNECTED')).toBeInTheDocument();
        expect(screen.queryByText(/Verified tier/i)).not.toBeInTheDocument();
    });

    it('shows a truthful standby state when connected but idle', () => {
        render(<RunTelemetryDeck telemetry={EMPTY_TELEMETRY} connection="standby" />);
        expect(screen.getByText('STANDBY // AWAITING SEQUENCE')).toBeInTheDocument();
    });

    it('renders live metrics derived from the real event stream', () => {
        render(<RunTelemetryDeck telemetry={withEvents()} connection="live" />);
        expect(screen.getByText('ESCAPE RATE')).toBeInTheDocument();
        expect(screen.getByText('5.00%')).toBeInTheDocument(); // escape rate from run row
        // Per-battery vitals reflect the real per-battery counts.
        expect(screen.getByLabelText(/B12.*0 repelled, 1 breached/)).toBeInTheDocument();
        // Seismograph is an accessible image labelled with real counts.
        expect(screen.getByRole('img', { name: /1 attacks repelled, 1 breaches/ })).toBeInTheDocument();
    });
});
