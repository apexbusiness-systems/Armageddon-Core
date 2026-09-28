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
import { isValidStripePaymentLink } from './stripe-payment-link.mjs';

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

/** Buyer context attached to a Stripe checkout so the payment maps to an account. */
export interface CheckoutContext {
    readonly orgId?: string;
    readonly email?: string;
}

// Same UUID rule the edge Worker enforces on organizationId (intake-handler.ts
// parseRunInput). A UUID is also a valid Stripe client_reference_id
// (alphanumerics, dashes, underscores; max 200 chars).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mirrors the Worker's isValidEmail (single @, dotted domain) plus a no-
// whitespace rule. Stripe ignores an invalid prefilled_email, so a rejected
// address only loses a convenience prefill, never checkout.
function isPlausibleEmail(email: string): boolean {
    if (email.length > 254 || /\s/.test(email)) return false;
    const at = email.indexOf('@');
    if (at < 1 || at !== email.lastIndexOf('@')) return false;
    const domain = email.slice(at + 1);
    const dot = domain.lastIndexOf('.');
    return dot > 0 && dot < domain.length - 1;
}

/**
 * Attach buyer context to a Stripe Payment Link: `client_reference_id` (the
 * org UUID, echoed on checkout.session.completed for fulfilment) and
 * `prefilled_email`. Invalid values are dropped; existing query params are
 * preserved; in-app fallback routes and non-Stripe targets are returned
 * unchanged. Pure — no network, no globals.
 */
export function withCheckoutContext(href: string, context: CheckoutContext): string {
    if (!isValidStripePaymentLink(href)) return href;
    const url = new URL(href);
    if (context.orgId && UUID_PATTERN.test(context.orgId)) {
        url.searchParams.set('client_reference_id', context.orgId);
    }
    if (context.email && isPlausibleEmail(context.email)) {
        url.searchParams.set('prefilled_email', context.email);
    }
    return url.toString();
}
