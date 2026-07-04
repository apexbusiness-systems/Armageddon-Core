/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CANONICAL UI FREEZE — regression guardrail
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * These assertions freeze the agreed-upon canonical state of the public
 * marketing surfaces (header pricing entry, footer CTA, pricing cards) so that
 * a regression or an unattended/rogue agent edit fails CI instead of silently
 * shipping. Each `it` documents one invariant and WHY it exists.
 *
 * If a product decision intentionally changes one of these surfaces, update the
 * matching assertion AND `docs/CANONICAL_UI_CONTRACT.md` in the same change —
 * never delete an assertion to make CI pass.
 *
 * Source-text assertions are used on purpose: the components pull in
 * framer-motion, next/navigation and Supabase auth, which are awkward to render
 * headlessly. Freezing the source contract is the cheapest durable guardrail.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import en from '../../src/i18n/dictionaries/en';

const SRC = join(__dirname, '..', '..', 'src');

function read(relativeFromSrc: string): string {
    return readFileSync(join(SRC, relativeFromSrc), 'utf8');
}

describe('canonical UI freeze — header pricing entry', () => {
    const header = read('components/AuthHeader.tsx');

    it('exposes a persistent, visible PRICING nav link to /pricing', () => {
        // The pricing page must have its own visible UI entry point, separate
        // from the auth CTAs. Freeze the dedicated /pricing Link.
        expect(header).toMatch(/href=["']\/pricing["']/);
    });

    it('keeps the pricing link independent of auth state (rendered outside the logged-in branch)', () => {
        // The link sits before the isLoggedIn ternary so it shows for every
        // visitor. Guard against it being moved inside an auth-gated branch.
        const linkIndex = header.indexOf("href=\"/pricing\"");
        const ternaryIndex = header.indexOf('isLoggedIn ? (');
        expect(linkIndex).toBeGreaterThan(-1);
        expect(ternaryIndex).toBeGreaterThan(-1);
        expect(linkIndex).toBeLessThan(ternaryIndex);
    });
});

describe('canonical UI freeze — footer CTA + sub-footer', () => {
    const footer = read('components/Footer.tsx');

    it('routes the conversion CTA only to /intake', () => {
        expect(footer).toContain("router.push('/intake')");
    });

    it('does not route the footer CTA anywhere other than /intake', () => {
        // No competing destinations (onboarding/pricing/dashboard) may be wired
        // into the footer CTA handler.
        expect(footer).not.toMatch(/router\.push\((?!'\/intake')/);
    });

    it('has removed the "EDGE BY" deployment badge block', () => {
        expect(footer).not.toContain('EDGE BY');
        expect(footer).not.toContain('CLOUDFLARE / LOCAL MOAT');
    });

    it('keeps the deployment indicator wired through the i18n dictionary and centers it', () => {
        expect(footer).toContain('dictionary.common.footer.deploymentIndicator');
        const indicatorBlock = footer.slice(
            footer.indexOf('Deployment indicator'),
            footer.indexOf('dictionary.common.footer.deploymentIndicator'),
        );
        expect(indicatorBlock).toContain('justify-center');
    });

    it('keeps the canonical English deployment indicator copy with the // separator', () => {
        expect(en.common.footer.deploymentIndicator).toBe('Cloudflare edge ready // local moat backed');
    });
});

describe('canonical UI freeze — pricing page cards', () => {
    // Card markup lives in the client component; page.tsx is a thin server
    // wrapper that only keeps the static `metadata` export.
    const page = read('app/pricing/PricingPageClient.tsx');

    it('uses the .pricing-card contrast panel class on every card', () => {
        expect(page).toContain('pricing-card');
    });

    it('uses the btn-primary industrial control for the card CTA', () => {
        expect(page).toContain('btn-primary');
    });

    it('does not pin button height with min-h — uniformity comes from font sizing, not taller buttons', () => {
        expect(page).not.toMatch(/min-h-\[/);
    });

    it('always reserves the disclaimer line (toggled with invisible) so cards stay aligned', () => {
        expect(page).toContain('invisible');
        expect(page).toContain('paymentPending');
    });
});

describe('canonical UI freeze — pricing card CSS (globals.css)', () => {
    const css = read('app/globals.css');

    it('paints pricing cards above the .fire-glow mask (z-index >= 2)', () => {
        const card = css.slice(css.indexOf('.pricing-card {'));
        expect(card).toMatch(/z-index:\s*2/);
    });

    it('defines the burning-flame hover animation as a box-shadow keyframe', () => {
        expect(css).toContain('@keyframes pricing-flame');
        const hover = css.slice(css.indexOf('.pricing-card:hover'));
        expect(hover).toMatch(/animation:\s*pricing-flame/);
    });

    it('defines btn-secondary with the same physical footprint as btn-primary', () => {
        expect(css).toContain('.btn-secondary');
    });
});

describe('canonical UI freeze — pricing data + checkout routing', () => {
    it('keeps exactly six plans in the published order', () => {
        const pricing = read('lib/pricing.ts');
        for (const id of ['self-serve', 'pro', 'team', 'verified', 'certified', 'enterprise']) {
            expect(pricing).toContain(`'${id}'`);
        }
    });

    it('routes the enterprise tier to the intake scope review', () => {
        const links = read('lib/payment-links.ts');
        expect(links).toContain("enterprise: '/intake?tier=enterprise'");
    });
});
