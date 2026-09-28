/**
 * withCheckoutContext — attaches the buyer's org UUID (client_reference_id)
 * and email (prefilled_email) to Stripe Payment Links so every purchase maps
 * to an account, without ever corrupting a fallback route or a bad value.
 */
import { describe, expect, it } from 'vitest';
import { withCheckoutContext } from '@/lib/payment-links';

const LINK = 'https://buy.stripe.com/bJefZg2TKfa9e2382lc7u00';
const ORG = '3f2b8c1e-9a4d-4b7e-8c21-5d6e7f8a9b0c';

function params(href: string): URLSearchParams {
    return new URL(href).searchParams;
}

describe('withCheckoutContext', () => {
    it('appends client_reference_id for a UUID org id', () => {
        expect(params(withCheckoutContext(LINK, { orgId: ORG })).get('client_reference_id')).toBe(ORG);
    });

    it.each(['org-123', 'demo', `${ORG}x`, 'a'.repeat(36), ''])('drops a non-UUID org id (%s)', (orgId) => {
        expect(withCheckoutContext(LINK, { orgId })).toBe(LINK);
    });

    it('URL-encodes the prefilled email', () => {
        const href = withCheckoutContext(LINK, { email: 'jenny+ops@example.com' });
        expect(href).toContain('prefilled_email=jenny%2Bops%40example.com');
        expect(params(href).get('prefilled_email')).toBe('jenny+ops@example.com');
    });

    it.each(['not-an-email', 'a@b', '@example.com', 'a@@example.com', 'a b@example.com', 'a@example.'])(
        'drops an invalid email (%s)',
        (email) => {
            expect(params(withCheckoutContext(LINK, { email })).has('prefilled_email')).toBe(false);
        },
    );

    it('preserves existing query params', () => {
        const href = withCheckoutContext(`${LINK}?locale=de&utm_source=site`, { orgId: ORG, email: 'a@example.com' });
        const p = params(href);
        expect(p.get('locale')).toBe('de');
        expect(p.get('utm_source')).toBe('site');
        expect(p.get('client_reference_id')).toBe(ORG);
        expect(p.get('prefilled_email')).toBe('a@example.com');
    });

    it.each([
        '/onboarding?tier=pro&payment=pending',
        '/intake?tier=enterprise',
        'https://example.com/pay/abc',
        'https://stripe.com',
    ])('leaves fallback / non-Stripe targets unchanged (%s)', (href) => {
        expect(withCheckoutContext(href, { orgId: ORG, email: 'a@example.com' })).toBe(href);
    });

    it('returns the plain link when there is no context (anonymous buyer)', () => {
        expect(withCheckoutContext(LINK, {})).toBe(LINK);
    });
});
