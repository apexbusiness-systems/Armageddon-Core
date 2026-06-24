import { startChaosEngine } from './chaos-engine';

export function runSimulation() {
    const targetNode = process.env.TARGET_ENV === 'shadow' ? 'https://dormant.production.omnihub.apex' : 'https://dev.omnihub.apex';
    startChaosEngine(targetNode);
}

runSimulation();
