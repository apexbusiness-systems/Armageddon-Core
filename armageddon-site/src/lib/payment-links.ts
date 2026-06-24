/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAYMENT LINKS — Stripe Payment Link resolution with honest fallbacks
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Uses Stripe Payment Links ONLY when a valid one is configured via public env.
 * Never uses secret keys. Never falls back to the generic Stripe homepage.
 * When a link is missing, routes to an honest in-app fallback that does not
 * pretend payment has occurred.
 */

import type { PlanId } from './pricing';

const STRIPE_LINKS: Readonly<Record<PlanId, string | undefined>> = {
    'self-serve': undefined,
    pro: process.env.NEXT_PUBLIC_STRIPE_LINK_PRO_MONTHLY,
    team: process.env.NEXT_PUBLIC_STRIPE_LINK_TEAM_MONTHLY,
    verified: process.env.NEXT_PUBLIC_STRIPE_LINK_VERIFIED_REVIEW,
    certified: process.env.NEXT_PUBLIC_STRIPE_LINK_CERTIFIED_GATE,
    enterprise: process.env.NEXT_PUBLIC_STRIPE_LINK_ENTERPRISE_DEPOSIT,
};

const FALLBACK_ROUTES: Readonly<Record<PlanId, string>> = {
    'self-serve': '/onboarding?tier=self-serve',
    pro: '/onboarding?tier=pro&payment=pending',
    team: '/onboarding?tier=team&payment=pending',
    verified: '/onboarding?tier=verified&payment=pending',
    certified: '/onboarding?tier=certified&payment=pending',
    enterprise: '/intake?tier=enterprise',
};

/**
 * A Payment Link is only honoured when it is an https Stripe URL with a real
 * path — this explicitly rejects `https://stripe.com` and any non-Stripe host.
 */
function isValidStripePaymentLink(value: string | undefined): value is string {
    if (!value) return false;
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    const isStripeHost = host === 'buy.stripe.com' || host === 'stripe.com' || host.endsWith('.stripe.com');
    if (!isStripeHost) return false;
    // Reject the bare homepage — a real Payment Link always has a path.
    if (url.pathname === '' || url.pathname === '/') return false;
    return true;
}

export interface CheckoutTarget {
    readonly href: string;
    /** true when href is an external Stripe Payment Link (open in new tab). */
    readonly external: boolean;
    /** true when routing to an in-app flow with payment not yet captured. */
    readonly paymentPending: boolean;
}

/**
 * Resolve where a plan's CTA should send the buyer. Prefers a configured Stripe
 * Payment Link; otherwise an honest in-app fallback route.
 */
export function getCheckoutTarget(plan: PlanId): CheckoutTarget {
    const link = STRIPE_LINKS[plan];
    if (isValidStripePaymentLink(link)) {
        return { href: link, external: true, paymentPending: false };
    }
    const fallback = FALLBACK_ROUTES[plan];
    return {
        href: fallback,
        external: false,
        paymentPending: fallback.includes('payment=pending'),
    };
}

/** True when a given plan has a live Stripe Payment Link configured. */
export function hasConfiguredPaymentLink(plan: PlanId): boolean {
    return isValidStripePaymentLink(STRIPE_LINKS[plan]);
}
