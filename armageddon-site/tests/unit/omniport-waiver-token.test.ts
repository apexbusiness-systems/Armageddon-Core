import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyWaiverToken, type WaiverTokenPayload } from '@/lib/omniport';

const SECRET = 'test-live-fire-secret';

function base64url(input: Buffer | string): string {
    return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signWaiverToken(payload: Partial<WaiverTokenPayload>, secret = SECRET): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signature = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest();
    return `${headerB64}.${payloadB64}.${base64url(signature)}`;
}

function validPayload(overrides: Partial<WaiverTokenPayload> = {}): WaiverTokenPayload {
    const now = Date.now();
    return {
        orgId: 'org-1',
        issuedAt: now,
        expiresAt: now + 10 * 60 * 1000,
        runLevel: 7,
        acceptedByUserId: 'user-1',
        waiverVersion: '1.0',
        ...overrides,
    };
}

describe('verifyWaiverToken', () => {
    beforeEach(() => {
        process.env.OMNIPORT_LIVE_FIRE_SECRET = SECRET;
    });

    it('accepts a validly signed, unexpired token', () => {
        const token = signWaiverToken(validPayload());
        expect(verifyWaiverToken(token)).toMatchObject({ orgId: 'org-1', runLevel: 7 });
    });

    it('rejects a token signed with the wrong secret', () => {
        const token = signWaiverToken(validPayload(), 'wrong-secret');
        expect(verifyWaiverToken(token)).toBeNull();
    });

    it('rejects a tampered payload (signature no longer matches)', () => {
        const token = signWaiverToken(validPayload());
        const [headerB64, , signatureB64] = token.split('.');
        const tamperedPayload = base64url(JSON.stringify(validPayload({ runLevel: 1 })));
        expect(verifyWaiverToken(`${headerB64}.${tamperedPayload}.${signatureB64}`)).toBeNull();
    });

    it('rejects an expired token', () => {
        const now = Date.now();
        const token = signWaiverToken(validPayload({ issuedAt: now - 20 * 60 * 1000, expiresAt: now - 1000 }));
        expect(verifyWaiverToken(token)).toBeNull();
    });

    it('rejects a token issued more than 15 minutes ago even if expiresAt is still in the future', () => {
        const now = Date.now();
        const token = signWaiverToken(validPayload({ issuedAt: now - 16 * 60 * 1000, expiresAt: now + 60 * 60 * 1000 }));
        expect(verifyWaiverToken(token)).toBeNull();
    });

    it('rejects a token issued in the future', () => {
        const now = Date.now();
        const token = signWaiverToken(validPayload({ issuedAt: now + 60 * 1000 }));
        expect(verifyWaiverToken(token)).toBeNull();
    });

    it('rejects malformed tokens', () => {
        expect(verifyWaiverToken('not-a-jwt')).toBeNull();
        expect(verifyWaiverToken('a.b')).toBeNull();
        expect(verifyWaiverToken('')).toBeNull();
    });

    it('rejects a structurally valid but incomplete payload', () => {
        const token = signWaiverToken({ orgId: 'org-1' } as WaiverTokenPayload);
        expect(verifyWaiverToken(token)).toBeNull();
    });

    it('returns null when OMNIPORT_LIVE_FIRE_SECRET is not configured', () => {
        delete process.env.OMNIPORT_LIVE_FIRE_SECRET;
        const token = signWaiverToken(validPayload());
        expect(verifyWaiverToken(token)).toBeNull();
    });
});
