
async function benchmark() {
    console.log('Running Supabase Reporter Benchmark...');

    const LATENCY = 50; // Simulated latency per DB call (ms)
    const ITEMS = 100;
    const BATCH_SIZE = 10;

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Simulation of existing pushEvent
    async function pushEvent(batteryId: string, eventType: string, payload: any) {
        await delay(LATENCY);
    }

    // Simulation of proposed pushEvents
    async function pushEvents(batteryId: string, events: any[]) {
        await delay(LATENCY); // Single delay for batch
    }

    // Baseline: Single Inserts
    console.time('Baseline (Single Inserts)');
    for (let i = 0; i < ITEMS; i++) {
        await pushEvent('B1', 'BREACH', { iteration: i });
    }
    console.timeEnd('Baseline (Single Inserts)');

    // Optimized: Batched Inserts
    console.time(`Batched (Batch Size: ${BATCH_SIZE})`);
    let batch: any[] = [];
    for (let i = 0; i < ITEMS; i++) {
        batch.push({ eventType: 'BREACH', payload: { iteration: i } });
        if (batch.length >= BATCH_SIZE) {
            await pushEvents('B1', batch);
            batch = [];
        }
    }
    if (batch.length > 0) {
        await pushEvents('B1', batch);
    }
    console.timeEnd(`Batched (Batch Size: ${BATCH_SIZE})`);

    console.log(`\nEstimated Improvement: ~${(ITEMS / (ITEMS / BATCH_SIZE)).toFixed(1)}x faster (theoretical)`);
}

void benchmark();
