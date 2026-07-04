import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveOmniPortTaskQueue } from '@/lib/omniport';

describe('resolveOmniPortTaskQueue', () => {
    const originalPrefix = process.env.OMNIPORT_TASK_QUEUE_PREFIX;
    const originalFallback = process.env.TEMPORAL_TASK_QUEUE;

    beforeEach(() => {
        delete process.env.OMNIPORT_TASK_QUEUE_PREFIX;
        delete process.env.TEMPORAL_TASK_QUEUE;
    });

    afterEach(() => {
        if (originalPrefix === undefined) delete process.env.OMNIPORT_TASK_QUEUE_PREFIX;
        else process.env.OMNIPORT_TASK_QUEUE_PREFIX = originalPrefix;
        if (originalFallback === undefined) delete process.env.TEMPORAL_TASK_QUEUE;
        else process.env.TEMPORAL_TASK_QUEUE = originalFallback;
    });

    it('derives a per-operator queue name from the organization id', () => {
        expect(resolveOmniPortTaskQueue('org-1234')).toBe('armageddon-moat-org-1234');
    });

    it('honors a custom prefix', () => {
        process.env.OMNIPORT_TASK_QUEUE_PREFIX = 'custom-moat';
        expect(resolveOmniPortTaskQueue('org-1234')).toBe('custom-moat-org-1234');
    });

    it('strips characters Temporal task queue names cannot contain', () => {
        expect(resolveOmniPortTaskQueue('org/1234:test')).toBe('armageddon-moat-org1234test');
    });

    it('two different organizations never resolve to the same queue', () => {
        expect(resolveOmniPortTaskQueue('org-a')).not.toBe(resolveOmniPortTaskQueue('org-b'));
    });

    it('falls back to the shared queue when organizationId sanitizes to empty', () => {
        process.env.TEMPORAL_TASK_QUEUE = 'shared-fallback-queue';
        expect(resolveOmniPortTaskQueue('///')).toBe('shared-fallback-queue');
    });

    it('falls back to armageddon-level-7 when no fallback env var is set either', () => {
        expect(resolveOmniPortTaskQueue('///')).toBe('armageddon-level-7');
    });
});
