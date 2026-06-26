import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockResolve, mockLookup } = vi.hoisted(() => ({
    mockResolve: vi.fn(),
    mockLookup: vi.fn(),
}));

vi.mock('node:dns/promises', () => ({
    default: {
        resolve: mockResolve,
        lookup: mockLookup,
    }
}));

import { validateSSRF } from '../../../src/lib/omniport';

describe('validateSSRF — SSRF Hardening checks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolve.mockResolvedValue(['8.8.8.8']); // Default public IP resolver mock
        mockLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    });

    it('rejects 127.0.0.1 (decimal loopback)', async () => {
        expect(await validateSSRF('http://127.0.0.1')).toBe(false);
    });

    it('rejects localhost', async () => {
        expect(await validateSSRF('http://localhost')).toBe(false);
    });

    it('rejects 10.x.x.x private range', async () => {
        expect(await validateSSRF('http://10.0.0.1')).toBe(false);
        expect(await validateSSRF('http://10.255.255.255')).toBe(false);
    });

    it('rejects 172.16-31.x.x private range', async () => {
        expect(await validateSSRF('http://172.16.0.1')).toBe(false);
        expect(await validateSSRF('http://172.31.255.255')).toBe(false);
        expect(await validateSSRF('http://172.15.255.255')).toBe(true); // Should pass
    });

    it('rejects 192.168.x.x private range', async () => {
        expect(await validateSSRF('http://192.168.1.1')).toBe(false);
    });

    it('rejects 169.254.x.x link-local range', async () => {
        expect(await validateSSRF('http://169.254.169.254')).toBe(false);
    });

    it('rejects ::1 loopback', async () => {
        expect(await validateSSRF('http://[::1]')).toBe(false);
    });

    it('rejects fc00::/7 unique local IPv6 range', async () => {
        expect(await validateSSRF('http://[fc00::1]')).toBe(false);
        expect(await validateSSRF('http://[fd00::1]')).toBe(false);
    });

    it('rejects fe80::/10 link-local IPv6 range', async () => {
        expect(await validateSSRF('http://[fe80::1]')).toBe(false);
    });

    it('rejects encoded/obfuscated private IP variants', async () => {
        // Hex representation of 127.0.0.1: 0x7f000001
        expect(await validateSSRF('http://0x7f000001')).toBe(false);
        
        // Integer representation of 127.0.0.1: 2130706433
        expect(await validateSSRF('http://2130706433')).toBe(false);

        // Mixed/partial notation: 127.1, 10.1
        expect(await validateSSRF('http://127.1')).toBe(false);
        expect(await validateSSRF('http://10.1')).toBe(false);

        // Hex dot notation: 0x7f.0x0.0x0.0x1
        expect(await validateSSRF('http://0x7f.0x0.0x0.0x1')).toBe(false);

        // Octal notation: 0177.0.0.1 or 017700000001
        expect(await validateSSRF('http://0177.0.0.1')).toBe(false);
        expect(await validateSSRF('http://017700000001')).toBe(false);
    });

    it('rejects DNS hostname resolving to private IP', async () => {
        // Mock resolver returning private IP
        mockResolve.mockResolvedValue(['10.0.0.1']);
        expect(await validateSSRF('http://my-private-host.local')).toBe(false);
    });

    it('accepts a valid public HTTPS URL', async () => {
        expect(await validateSSRF('https://apexbusiness-systems.com')).toBe(true);
    });
});
