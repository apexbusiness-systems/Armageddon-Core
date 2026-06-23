/**
 * Canonical production auth origin helper for Armageddon Test Suite.
 */

const CANONICAL_ORIGIN = 'https://armageddontest.icu';

export function getAuthOrigin(): string {
    // 1. Determine base url from environment or fallback to canonical.
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || CANONICAL_ORIGIN;

    // Normalize trailing slashes
    siteUrl = siteUrl.replace(/\/+$/, '');

    // 2. Validate URL shape
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(siteUrl);
    } catch {
        parsedUrl = new URL(CANONICAL_ORIGIN);
    }

    // 3. Localhost bypass
    if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
        // Only allow localhost if the browser's current origin is actually localhost
        if (typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            return parsedUrl.origin;
        } else {
             // Revert to canonical if env says localhost but browser isn't
            return CANONICAL_ORIGIN;
        }
    }

    // 4. Stale domain re-mapping
    const STALE_DOMAINS = [
        'armageddon.apex.com',
        'armageddon.icu',
        'www.armageddon.icu',
        'apexomnihub.icu',
        'app.apexomnihub.icu'
    ];

    if (STALE_DOMAINS.includes(parsedUrl.hostname) || parsedUrl.hostname.includes('omnihub')) {
         return CANONICAL_ORIGIN;
    }

    // Ensure it strictly returns the canonical URL for any non-localhost non-canonical configuration
    // to prevent production domains drifting from armageddontest.icu
    if (parsedUrl.hostname !== 'armageddontest.icu' && parsedUrl.hostname !== 'www.armageddontest.icu') {
        return CANONICAL_ORIGIN;
    }

    return parsedUrl.origin;
}
