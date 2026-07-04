/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON — ENVIRONMENT VARIABLE SANITIZATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Values pasted into deployment dashboards frequently arrive wrapped in
 * literal quotes (e.g. SUPABASE_URL set to `"https://…"` including the quote
 * characters). A quoted URL fails supabase-js validation, and when a client
 * is constructed at module scope that error aborts `next build` page-data
 * collection. All env reads that feed URL/credential validation must go
 * through these helpers.
 */

/**
 * Normalize a raw env value: trim whitespace, strip one pair of matching
 * surrounding quotes, and collapse empty results to `undefined`.
 *
 * Use this form in client-side code, where `process.env.NEXT_PUBLIC_*` must
 * stay a literal property access so the bundler can inline it.
 */
export function cleanEnvValue(raw: string | undefined): string | undefined {
    if (raw === undefined) return undefined;
    let value = raw.trim();
    if (value.length >= 2) {
        const first = value[0];
        const last = value[value.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
            value = value.slice(1, -1).trim();
        }
    }
    return value.length > 0 ? value : undefined;
}

/**
 * Read and normalize `process.env[name]`. Server-side only — dynamic
 * property access is not inlined into client bundles.
 */
export function readEnv(name: string): string | undefined {
    return cleanEnvValue(process.env[name]);
}
