const fs = require('fs');
const file = 'armageddon-core/src/core/reporter.ts';
let content = fs.readFileSync(file, 'utf8');

// Update SupabaseReporter constructor to use channel
content = content.replace(
    "    private readonly runId: string;\n",
    "    private readonly runId: string;\n    private readonly channel: ReturnType<SupabaseClient['channel']>;\n"
);

content = content.replace(
    "        this.runId = runId;\n    }",
    "        this.runId = runId;\n        this.channel = this.client.channel(`run_telemetry_${runId}`);\n    }"
);

// Update pushEvent to emit broadcast
const pushEventOriginal = `        const { error } = await this.client
            .from('armageddon_events')
            .insert(event);`;

const pushEventNew = `        const [dbResult, broadcastResult] = await Promise.all([
            this.client.from('armageddon_events').insert(event),
            this.channel.send({
                type: 'broadcast',
                event: 'armageddon_event',
                payload: event,
            })
        ]);

        const error = dbResult.error;`;
content = content.replace(pushEventOriginal, pushEventNew);

// Update pushEvents to emit broadcast
const pushEventsOriginal = `        const { error } = await this.client
            .from('armageddon_events')
            .insert(rows);`;

const pushEventsNew = `        const [dbResult, broadcastResult] = await Promise.all([
            this.client.from('armageddon_events').insert(rows),
            this.channel.send({
                type: 'broadcast',
                event: 'armageddon_event_batch',
                payload: { events: rows },
            })
        ]);

        const error = dbResult.error;`;
content = content.replace(pushEventsOriginal, pushEventsNew);

fs.writeFileSync(file, content);
