import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAuthOrigin } from '../../../src/lib/auth-origin';

describe('auth-origin', () => {
    const originalEnv = process.env;
    const originalWindow = global.window;

    beforeEach(() => {

        process.env = { ...originalEnv };

        // Mock window object
        global.window = Object.create(global.window || {});
        Object.defineProperty(global.window, 'location', {
            value: {
                hostname: 'armageddontest.icu'
            },
            writable: true
        });
    });

    afterEach(() => {
        process.env = originalEnv;
        global.window = originalWindow;
    });

    it('returns canonical origin when NEXT_PUBLIC_SITE_URL is not set', () => {
        delete process.env.NEXT_PUBLIC_SITE_URL;
        expect(getAuthOrigin()).toBe('https://armageddontest.icu');
    });

    it.each([
        ['canonical', 'https://armageddontest.icu', 'https://armageddontest.icu'],
        ['stale domain (www.armageddon.icu)', 'https://www.armageddon.icu', 'https://armageddontest.icu'],
        ['omnihub domain', 'https://app.apexomnihub.icu', 'https://armageddontest.icu'],
        ['trailing slash', 'https://armageddontest.icu/', 'https://armageddontest.icu'],
        ['malformed NEXT_PUBLIC_SITE_URL', 'not-a-url', 'https://armageddontest.icu'],
    ])('returns canonical origin for %s', (_label, siteUrl, expected) => {
        process.env.NEXT_PUBLIC_SITE_URL = siteUrl;
        expect(getAuthOrigin()).toBe(expected);
    });

    it('allows localhost when browser is actually on localhost', () => {
        process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
        global.window.location.hostname = 'localhost';
        expect(getAuthOrigin()).toBe('http://localhost:3000');
    });

    it('rejects localhost when browser is NOT on localhost', () => {
        process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
        global.window.location.hostname = 'armageddontest.icu'; // user in prod
        expect(getAuthOrigin()).toBe('https://armageddontest.icu');
    });
});
