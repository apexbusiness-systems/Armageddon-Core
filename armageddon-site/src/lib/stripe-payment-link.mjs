/**
 * Stripe Payment Link validity — the single rule shared by the site
 * (`payment-links.ts`) and the Cloudflare build revenue gate
 * (`scripts/lib/public-build-env.mjs`). Plain ESM with JSDoc types so Node can
 * import it without a TypeScript build step. Keep it dependency-free and pure.
 */

/**
 * A Payment Link is only honoured when it is an https Stripe URL with a real
 * path — this explicitly rejects `https://stripe.com` and any non-Stripe host.
 *
 * @param {string | undefined} value
 * @returns {value is string}
 */
export function isValidStripePaymentLink(value) {
    if (!value) return false;
    let url;
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
    return url.pathname !== '' && url.pathname !== '/';
}
