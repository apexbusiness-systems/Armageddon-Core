/**
 * Revenue gate for the Cloudflare static export (scripts/lib/public-build-env.mjs).
 *
 * Next inlines NEXT_PUBLIC_* at build time; the Stripe Payment Links live in
 * wrangler.jsonc `vars` (Worker runtime). These tests pin the JSONC parsing,
 * env precedence, the pre-build link gate, the post-build exported-HTML gate,
 * and the single shared validity rule used by both the site and the script.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    MIN_EXPORTED_STRIPE_LINKS,
    PAID_PLAN_LINK_KEYS,
    applyPublicBuildEnv,
    assertExportedStripeLinks,
    assertRevenueLinks,
    countDistinctStripeLinks,
    findInvalidPaidLinks,
    readPublicVars,
    shouldEnforceRevenueGate,
    stripJsonc,
} from '../../../scripts/lib/public-build-env.mjs';
import { isValidStripePaymentLink } from '../../src/lib/stripe-payment-link.mjs';

const SITE = join(__dirname, '..', '..');
const WRANGLER = readFileSync(join(SITE, 'wrangler.jsonc'), 'utf8');

function validLinks(): Record<string, string> {
    return Object.fromEntries(
        PAID_PLAN_LINK_KEYS.map((key, index) => [key, `https://buy.stripe.com/test${index}abc`]),
    );
}

describe('stripJsonc', () => {
    it('parses the real wrangler.jsonc with every Stripe URL intact', () => {
        const config = JSON.parse(stripJsonc(WRANGLER));
        const rawUrls = WRANGLER.match(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g) ?? [];
        const stripeKeys = Object.keys(config.vars).filter((key) => key.startsWith('NEXT_PUBLIC_STRIPE_LINK_'));

        expect(stripeKeys.sort()).toEqual([...PAID_PLAN_LINK_KEYS].sort());
        expect(stripeKeys.map((key) => config.vars[key]).sort()).toEqual([...rawUrls].sort());
    });

    it('keeps // and /* inside strings, and removes comments and trailing commas outside them', () => {
        const src = '{\n  // line\n  "a": "https://x.test//p/*q*/", /* block */\n  "b": [1, 2, /* c */],\n  "c": "x, }",\n}';
        expect(JSON.parse(stripJsonc(src))).toEqual({ a: 'https://x.test//p/*q*/', b: [1, 2], c: 'x, }' });
    });

    it('handles escaped quotes inside strings', () => {
        expect(JSON.parse(stripJsonc('{"a": "say \\"hi\\" // not a comment"}'))).toEqual({
            a: 'say "hi" // not a comment',
        });
    });
});

describe('readPublicVars / applyPublicBuildEnv', () => {
    it('reads only NEXT_PUBLIC_* vars from wrangler.jsonc', () => {
        const vars = readPublicVars(WRANGLER);
        expect(Object.keys(vars).every((key) => key.startsWith('NEXT_PUBLIC_'))).toBe(true);
        expect(vars).not.toHaveProperty('TEMPORAL_ADDRESS');
        for (const key of PAID_PLAN_LINK_KEYS) expect(vars[key]).toMatch(/^https:\/\/buy\.stripe\.com\//);
    });

    it('never overrides an explicitly set env value', () => {
        const env: Record<string, string | undefined> = { NEXT_PUBLIC_A: 'from-ci' };
        const applied = applyPublicBuildEnv({ NEXT_PUBLIC_A: 'from-wrangler', NEXT_PUBLIC_B: 'b' }, env);
        expect(env).toEqual({ NEXT_PUBLIC_A: 'from-ci', NEXT_PUBLIC_B: 'b' });
        expect(applied).toEqual(['NEXT_PUBLIC_B']);
    });

    it('treats an empty string (missing CI secret) as unset', () => {
        const env: Record<string, string | undefined> = { NEXT_PUBLIC_A: '' };
        expect(applyPublicBuildEnv({ NEXT_PUBLIC_A: 'filled' }, env)).toEqual(['NEXT_PUBLIC_A']);
        expect(env.NEXT_PUBLIC_A).toBe('filled');
    });
});

describe('revenue gate', () => {
    it('is enforced only for CI static-export builds', () => {
        expect(shouldEnforceRevenueGate({ CLOUDFLARE_STATIC_EXPORT: 'true', CI: 'true' })).toBe(true);
        expect(shouldEnforceRevenueGate({ CLOUDFLARE_STATIC_EXPORT: 'true' })).toBe(false);
        expect(shouldEnforceRevenueGate({ CI: 'true' })).toBe(false);
    });

    it('passes when every paid-plan link is a valid Payment Link', () => {
        expect(() => assertRevenueLinks(validLinks())).not.toThrow();
    });

    it('fails when a paid-plan link is missing', () => {
        const env = validLinks();
        delete env.NEXT_PUBLIC_STRIPE_LINK_TEAM_MONTHLY;
        expect(findInvalidPaidLinks(env)).toEqual(['NEXT_PUBLIC_STRIPE_LINK_TEAM_MONTHLY']);
        expect(() => assertRevenueLinks(env)).toThrow(/NEXT_PUBLIC_STRIPE_LINK_TEAM_MONTHLY/);
    });

    it.each([
        ['bare Stripe homepage', 'https://stripe.com'],
        ['non-https', 'http://buy.stripe.com/abc'],
        ['non-Stripe host', 'https://buy.stripe.com.evil.test/abc'],
        ['empty', ''],
    ])('fails on an invalid link (%s)', (_label, value) => {
        expect(() => assertRevenueLinks({ ...validLinks(), NEXT_PUBLIC_STRIPE_LINK_PRO_MONTHLY: value })).toThrow(
            /NEXT_PUBLIC_STRIPE_LINK_PRO_MONTHLY/,
        );
    });

    it('the committed wrangler.jsonc satisfies the gate (catches config regressions at PR time)', () => {
        expect(findInvalidPaidLinks(readPublicVars(WRANGLER))).toEqual([]);
    });
});

describe('exported pricing HTML gate', () => {
    const html = PAID_PLAN_LINK_KEYS.map((_key, i) => `<a href="https://buy.stripe.com/link${i}">x</a>`).join('');

    it('counts distinct buy.stripe.com links', () => {
        expect(countDistinctStripeLinks(html + html)).toBe(PAID_PLAN_LINK_KEYS.length);
        expect(countDistinctStripeLinks('<a href="/onboarding?tier=pro&payment=pending">x</a>')).toBe(0);
    });

    it(`requires at least ${MIN_EXPORTED_STRIPE_LINKS} distinct links`, () => {
        expect(assertExportedStripeLinks(html)).toBe(MIN_EXPORTED_STRIPE_LINKS);
        expect(() => assertExportedStripeLinks('<a href="https://buy.stripe.com/only1">x</a>')).toThrow(/1 distinct/);
        expect(() => assertExportedStripeLinks(null)).toThrow(/0 distinct/);
    });
});

describe('shared Payment Link validity (site ↔ build script parity)', () => {
    it('payment-links.ts uses the shared rule instead of a local copy', () => {
        const source = readFileSync(join(SITE, 'src', 'lib', 'payment-links.ts'), 'utf8');
        expect(source).toContain("from './stripe-payment-link.mjs'");
        expect(source).not.toMatch(/function isValidStripePaymentLink/);
    });

    it.each([
        ['https://buy.stripe.com/abc123', true],
        ['https://checkout.stripe.com/c/pay/abc', true],
        ['https://stripe.com/', false],
        ['https://stripe.com', false],
        ['http://buy.stripe.com/abc', false],
        ['https://evilstripe.com/abc', false],
        ['not a url', false],
        [undefined, false],
    ])('isValidStripePaymentLink(%s) === %s', (value, expected) => {
        expect(isValidStripePaymentLink(value)).toBe(expected);
    });
});
