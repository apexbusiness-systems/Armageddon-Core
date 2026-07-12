import { describe, it, expect, vi } from 'vitest';
import { validateSSRF } from '@armageddon/shared/omniport';

describe('validateSSRF', () => {
    // 1. Schemes and formats
    it('accepts valid http and https urls', async () => {
        expect(await validateSSRF('http://example.com')).toBe(true);
        expect(await validateSSRF('https://example.com/path?query=1')).toBe(true);
    });

    it('rejects invalid schemes', async () => {
        expect(await validateSSRF('ftp://example.com')).toBe(false);
        expect(await validateSSRF('gopher://example.com')).toBe(false);
        expect(await validateSSRF('file:///etc/passwd')).toBe(false);
    });

    it('rejects urls containing userinfo (username or password)', async () => {
        expect(await validateSSRF('https://user@example.com')).toBe(false);
        expect(await validateSSRF('https://user:password@example.com')).toBe(false);
    });

    // 2. Loopback and Localhost
    it('rejects localhost and loopback domains', async () => {
        expect(await validateSSRF('http://localhost')).toBe(false);
        expect(await validateSSRF('https://sub.localhost')).toBe(false);
        expect(await validateSSRF('http://127.0.0.1')).toBe(false);
        expect(await validateSSRF('http://[::1]')).toBe(false);
    });

    // 3. Blocked IPv4 Ranges (RFC testing)
    it('rejects private and reserved IPv4 ranges', async () => {
        const blockedIps = [
            '0.1.2.3',          // 0.0.0.0/8
            '10.0.0.1',         // 10.0.0.0/8
            '100.64.0.1',       // 100.64.0.0/10 (CGNAT)
            '127.0.0.1',        // 127.0.0.0/8
            '169.254.169.254',  // 169.254.0.0/16 (Link-local/metadata)
            '172.16.5.5',       // 172.16.0.0/12
            '192.0.0.170',      // 192.0.0.0/24 (IETF Protocol)
            '192.0.2.1',        // 192.0.2.0/24 (TEST-NET-1)
            '192.168.1.1',      // 192.168.0.0/16
            '198.18.0.50',      // 198.18.0.0/15 (Benchmarking)
            '198.51.100.22',    // 198.51.100.0/24 (TEST-NET-2)
            '203.0.113.88',     // 203.0.113.0/24 (TEST-NET-3)
            '224.0.0.1',        // 224.0.0.0/4 (Multicast)
            '245.0.0.1',        // 240.0.0.0/4 (Reserved)
            '255.255.255.255',  // Broadcast
        ];
        for (const ip of blockedIps) {
            expect(await validateSSRF(`http://${ip}`)).toBe(false);
        }
    });

    // 4. Blocked IPv6 Ranges (RFC testing)
    it('rejects private, reserved, and multicast IPv6 ranges', async () => {
        const blockedIps = [
            '::',               // Unspecified
            '::1',              // Loopback
            'fc00::1',          // Unique-local (fc00::/7)
            'fdff::9',          // Unique-local
            'fe80::1',          // Link-local (fe80::/10)
            'ff02::1',          // Multicast (ff00::/8)
            '2001:db8::1',      // Documentation (2001:db8::/32)
            '0100::1',          // Discard (0100::/64)
            '::ffff:192.168.1.1', // IPv4-mapped private
            '::ffff:169.254.169.254', // IPv4-mapped metadata
            '::ffff:0:10.0.0.1', // IPv4-mapped alternative format
            '::127.0.0.1',      // IPv4-compatible loopback
            '64:ff9b::192.168.1.1', // NAT64 mapped private
        ];
        for (const ip of blockedIps) {
            const isOk = await validateSSRF(`http://[${ip}]`);
            if (isOk) {
                console.log(`FAILED IP: ${ip}`);
            }
            expect(isOk, `IP ${ip} should be rejected`).toBe(false);
        }
    });
});
