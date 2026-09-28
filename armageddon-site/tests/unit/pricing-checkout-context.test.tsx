// @vitest-environment jsdom
/**
 * Pricing page ↔ checkout context: a signed-in buyer's Payment Link carries
 * their org UUID; an anonymous buyer gets the plain link; the honest
 * fulfilment note renders under Stripe CTAs.
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../src/i18n/dictionaries/en';

const ORG = '3f2b8c1e-9a4d-4b7e-8c21-5d6e7f8a9b0c';
const PRO_LINK = 'https://buy.stripe.com/test_pro_monthly';

const resolveActiveOrg = vi.fn();

vi.mock('@/lib/active-org', () => ({ resolveActiveOrg: () => resolveActiveOrg() }));
vi.mock('@/i18n/useT', () => ({ useT: () => ({ dictionary: en }) }));
vi.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
        React.createElement('a', { href, ...rest }, children),
}));

async function renderPricing() {
    // STRIPE_LINKS is read from process.env at module load (Next inlines it at build).
    vi.resetModules();
    const { default: PricingPageClient } = await import('@/app/pricing/PricingPageClient');
    return render(<PricingPageClient />);
}

function proCta(): HTMLAnchorElement {
    const card = screen.getByText(en.pricing.plans.pro.name).closest('.pricing-card') as HTMLElement;
    return within(card).getByRole('link', { name: en.pricing.plans.pro.ctaLabel }) as HTMLAnchorElement;
}

describe('PricingPageClient checkout context', () => {
    beforeEach(() => {
        vi.stubEnv('NEXT_PUBLIC_STRIPE_LINK_PRO_MONTHLY', PRO_LINK);
        vi.stubEnv('NEXT_PUBLIC_STRIPE_LINK_TEAM_MONTHLY', '');
        vi.stubEnv('NEXT_PUBLIC_STRIPE_LINK_ENTERPRISE_DEPOSIT', 'https://buy.stripe.com/test_enterprise');
        resolveActiveOrg.mockReset();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('attaches client_reference_id + prefilled_email for a signed-in buyer with an org', async () => {
        resolveActiveOrg.mockResolvedValue({ ok: true, organizationId: ORG, accessToken: 't', email: 'buyer@example.com' });
        await renderPricing();

        await waitFor(() => expect(proCta().href).toContain(`client_reference_id=${ORG}`));
        expect(proCta().href).toContain('prefilled_email=buyer%40example.com');
        expect(proCta().href.startsWith(PRO_LINK)).toBe(true);
        expect(proCta()).toHaveAttribute('target', '_blank');
    });

    it('keeps the plain Payment Link for an anonymous buyer', async () => {
        resolveActiveOrg.mockResolvedValue({ ok: false, reason: 'unauthenticated' });
        await renderPricing();

        await waitFor(() => expect(resolveActiveOrg).toHaveBeenCalled());
        expect(proCta().href).toBe(PRO_LINK);
    });

    it('keeps the plain Payment Link when the org lookup fails', async () => {
        resolveActiveOrg.mockRejectedValue(new Error('network'));
        await renderPricing();

        await waitFor(() => expect(resolveActiveOrg).toHaveBeenCalled());
        expect(proCta().href).toBe(PRO_LINK);
    });

    it('shows the fulfilment note under a Stripe CTA and the pending note under a fallback CTA', async () => {
        resolveActiveOrg.mockResolvedValue({ ok: false, reason: 'unauthenticated' });
        await renderPricing();

        const proCard = screen.getByText(en.pricing.plans.pro.name).closest('.pricing-card') as HTMLElement;
        const teamCard = screen.getByText(en.pricing.plans.team.name).closest('.pricing-card') as HTMLElement;
        expect(within(proCard).getByText(en.pricing.checkoutFulfilmentNote)).not.toHaveClass('invisible');
        // Team has no link configured in this test → honest pending fallback.
        expect(within(teamCard).getByText(en.pricing.checkoutPendingNote)).not.toHaveClass('invisible');
        expect(within(teamCard).getByRole('link', { name: en.pricing.plans.team.ctaLabel })).toHaveAttribute(
            'href',
            '/onboarding?tier=team&payment=pending',
        );
    });

    it('does not promise a workspace upgrade under the Enterprise deposit CTA', async () => {
        resolveActiveOrg.mockResolvedValue({ ok: false, reason: 'unauthenticated' });
        await renderPricing();

        const card = screen.getByText(en.pricing.plans.enterprise.name).closest('.pricing-card') as HTMLElement;
        expect(within(card).getByRole('link', { name: en.pricing.plans.enterprise.ctaLabel })).toHaveAttribute(
            'href',
            'https://buy.stripe.com/test_enterprise',
        );
        expect(within(card).queryByText(en.pricing.checkoutFulfilmentNote)).toBeNull();
    });
});
