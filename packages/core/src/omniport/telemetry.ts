// armageddon-core/src/omniport/telemetry.ts
// Push-model telemetry client: fires structured events from Temporal activities to APEX-OmniHub.
// Fail-silent: a network error here must NEVER crash a running battery.

import { createHmac } from 'node:crypto';
import type { OmniPortTelemetryEvent } from './types';

export async function pushTelemetry(event: OmniPortTelemetryEvent): Promise<void> {
    if (process.env.OMNIPORT_ENABLED !== 'true') return;

    const omniHubUrl = process.env.OMNIPORT_OMNIHUB_URL;
    const apiKey = process.env.OMNIPORT_API_KEY;
    const webhookSecret = process.env.OMNIPORT_WEBHOOK_SECRET;

    if (!omniHubUrl || !apiKey || !webhookSecret) return;

    const body = JSON.stringify(event);
    const signature = createHmac('sha256', webhookSecret).update(body).digest('hex');

    try {
        await fetch(`${omniHubUrl}/api/v1/armageddon/telemetry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-OmniPort-Signature': signature,
            },
            body,
        });
    } catch (err) {
        console.error('[OmniPort] Telemetry push failed:', (err as Error).message);
    }
}
