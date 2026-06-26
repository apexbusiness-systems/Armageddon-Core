import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

import { lookup } from 'node:dns/promises';
import { validateSSRF } from '@/lib/omniport';

const mockedLookup = lookup as unknown as ReturnType<typeof vi.fn>;

describe('validateSSRF', () => {
    beforeEach(() => {
        mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    });

    it.each([
        'http://127.0.0.1', 'http://localhost', 'http://10.0.0.1',
        'http://172.16.0.1', 'http://172.31.255.255', 'http://192.168.1.1',
        'http://169.254.1.1', 'http://[::1]', 'http://[fc00::1]', 'http://[fd00::1]',
        'http://[fe80::1]', 'http://2130706433',
    ])('rejects blocked target %s', async target => {
        await expect(validateSSRF(target)).resolves.toBe(false);
    });

    it('rejects DNS names resolving to private IP addresses', async () => {
        mockedLookup.mockResolvedValueOnce([{ address: '10.1.2.3', family: 4 }]);
        await expect(validateSSRF('https://private.example.test')).resolves.toBe(false);
    });

    it('accepts a normal public https URL', async () => {
        mockedLookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
        await expect(validateSSRF('https://example.com/path')).resolves.toBe(true);
    });
});
