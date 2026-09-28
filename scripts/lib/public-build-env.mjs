/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON — public build-time config for the Cloudflare static export
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at BUILD time. The public config
 * (Stripe Payment Links, Supabase URL, API base) lives in
 * `armageddon-site/wrangler.jsonc` `vars`, which only reach the Worker at
 * RUNTIME — so a static export built without them silently ships every paid
 * CTA on its `payment=pending` fallback. This module makes `wrangler.jsonc`
 * the single source of truth for public build config and enforces a revenue
 * gate on CI production builds. Pure helpers, no dependencies.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { isValidStripePaymentLink } from '../../armageddon-site/src/lib/stripe-payment-link.mjs';

/** Every paid plan's Payment Link; the order mirrors `src/lib/payment-links.ts`. */
export const PAID_PLAN_LINK_KEYS = Object.freeze([
    'NEXT_PUBLIC_STRIPE_LINK_PRO_MONTHLY',
    'NEXT_PUBLIC_STRIPE_LINK_TEAM_MONTHLY',
    'NEXT_PUBLIC_STRIPE_LINK_VERIFIED_REVIEW',
    'NEXT_PUBLIC_STRIPE_LINK_CERTIFIED_GATE',
    'NEXT_PUBLIC_STRIPE_LINK_ENTERPRISE_DEPOSIT',
]);

/** Minimum distinct Payment Links the exported pricing page must carry. */
export const MIN_EXPORTED_STRIPE_LINKS = PAID_PLAN_LINK_KEYS.length;

const PUBLIC_PREFIX = 'NEXT_PUBLIC_';

/**
 * Strips `//` and `/* *\/` comments and trailing commas from JSONC while
 * leaving string contents untouched (URLs contain `//`, so naive stripping
 * breaks them).
 *
 * @param {string} src
 * @returns {string}
 */
export function stripJsonc(src) {
    return stripTrailingCommas(stripComments(src));
}

/**
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
    let out = '';
    let inString = false;
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        const next = src[i + 1];
        if (inString) {
            out += c;
            if (c === '\\') {
                out += next ?? '';
                i += 2;
                continue;
            }
            if (c === '"') inString = false;
            i++;
        } else if (c === '/' && next === '/') {
            while (i < src.length && src[i] !== '\n') i++;
        } else if (c === '/' && next === '*') {
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i += 2;
        } else {
            if (c === '"') inString = true;
            out += c;
            i++;
        }
    }
    return out;
}

/**
 * @param {string} src comment-free JSONC text
 * @returns {string}
 */
function stripTrailingCommas(src) {
    let out = '';
    let inString = false;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inString) {
            out += c;
            if (c === '\\') {
                out += src[i + 1] ?? '';
                i++;
            } else if (c === '"') {
                inString = false;
            }
        } else if (c !== ',' || !closesAfter(src, i + 1)) {
            if (c === '"') inString = true;
            out += c;
        }
    }
    return out;
}

/**
 * True when the next non-whitespace character at or after `from` closes an
 * object or array (i.e. the comma before it is a trailing comma).
 *
 * @param {string} src
 * @param {number} from
 * @returns {boolean}
 */
function closesAfter(src, from) {
    let j = from;
    while (j < src.length && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n' || src[j] === '\r')) j++;
    return src[j] === '}' || src[j] === ']';
}

/**
 * The `NEXT_PUBLIC_*` entries of a wrangler.jsonc `vars` block.
 *
 * @param {string} wranglerSource raw wrangler.jsonc text
 * @returns {Record<string, string>}
 */
export function readPublicVars(wranglerSource) {
    const config = JSON.parse(stripJsonc(wranglerSource));
    const vars = config?.vars ?? {};
    return Object.fromEntries(
        Object.entries(vars).filter(([key, value]) => key.startsWith(PUBLIC_PREFIX) && typeof value === 'string'),
    );
}

/**
 * Copies public vars into `env` only where the key is not already set, so an
 * explicit CI/shell value always wins. An empty string counts as unset (a
 * missing GitHub secret expands to '').
 *
 * @param {Record<string, string>} publicVars
 * @param {Record<string, string | undefined>} env mutated in place
 * @returns {string[]} the keys that were filled from `publicVars`
 */
export function applyPublicBuildEnv(publicVars, env) {
    const applied = [];
    for (const [key, value] of Object.entries(publicVars)) {
        if (env[key] === undefined || env[key] === '') {
            env[key] = value;
            applied.push(key);
        }
    }
    return applied;
}

/**
 * The revenue gate is enforced on CI builds of the Cloudflare static export
 * (the production artifact). Local builds only report.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function shouldEnforceRevenueGate(env) {
    return env.CLOUDFLARE_STATIC_EXPORT === 'true' && env.CI === 'true';
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string[]} paid-plan link keys that are missing or not a valid Payment Link
 */
export function findInvalidPaidLinks(env) {
    return PAID_PLAN_LINK_KEYS.filter((key) => !isValidStripePaymentLink(env[key]));
}

/**
 * @param {Record<string, string | undefined>} env
 * @throws {Error} when any paid-plan link is missing or invalid
 */
export function assertRevenueLinks(env) {
    const invalid = findInvalidPaidLinks(env);
    if (invalid.length > 0) {
        throw new Error(
            `[cf-build] Revenue gate: missing or invalid Stripe Payment Link(s): ${invalid.join(', ')}. ` +
                'Set them in armageddon-site/wrangler.jsonc "vars" (or the build env). ' +
                'Refusing to build a production export whose paid CTAs cannot reach checkout.',
        );
    }
}

/**
 * Distinct `https://buy.stripe.com/...` URLs in exported HTML.
 *
 * @param {string} html
 * @returns {number}
 */
export function countDistinctStripeLinks(html) {
    return new Set(html.match(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g) ?? []).size;
}

/**
 * The exported pricing page (`pricing.html` or `pricing/index.html`), or null.
 *
 * @param {string} outDir
 * @returns {string | null}
 */
export function resolveExportedPricingHtml(outDir) {
    const candidates = [path.join(outDir, 'pricing.html'), path.join(outDir, 'pricing', 'index.html')];
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

/**
 * @param {string | null} html exported pricing HTML (null when not found)
 * @throws {Error} when fewer than MIN_EXPORTED_STRIPE_LINKS distinct links are present
 */
export function assertExportedStripeLinks(html) {
    const count = html === null ? 0 : countDistinctStripeLinks(html);
    if (count < MIN_EXPORTED_STRIPE_LINKS) {
        throw new Error(
            `[cf-build] Revenue gate: exported pricing page has ${count} distinct buy.stripe.com link(s); ` +
                `expected at least ${MIN_EXPORTED_STRIPE_LINKS}.`,
        );
    }
    return count;
}
