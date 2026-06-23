#!/usr/bin/env node

const CANONICAL_PRODUCTION_URL = 'https://armageddontest.icu';

function validateEnv() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!siteUrl) {
        console.error('❌ VALIDATION FAILED: NEXT_PUBLIC_SITE_URL is missing.');
        process.exitCode = 1;
        return;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(siteUrl);
    } catch {
        console.error('❌ VALIDATION FAILED: NEXT_PUBLIC_SITE_URL is malformed.');
        process.exitCode = 1;
        return;
    }

    const lowerHost = parsedUrl.hostname.toLowerCase();

    const BANNED_PATTERNS = [
        'localhost',
        'omnihub',
        'apex-omnihub',
        'armageddon.apex.com',
        'www.armageddon.icu',
        '127.0.0.1'
    ];

    if (BANNED_PATTERNS.some(pattern => lowerHost.includes(pattern))) {
        console.error('❌ VALIDATION FAILED: NEXT_PUBLIC_SITE_URL contains banned or stale hostname.');
        process.exitCode = 1;
        return;
    }

    if (lowerHost === 'armageddon.icu' && siteUrl !== CANONICAL_PRODUCTION_URL) {
         console.error('❌ VALIDATION FAILED: NEXT_PUBLIC_SITE_URL is armageddon.icu but does not match canonical exactly.');
         process.exitCode = 1;
         return;
    }

    if (siteUrl !== CANONICAL_PRODUCTION_URL) {
         console.error('❌ VALIDATION FAILED: NEXT_PUBLIC_SITE_URL does not match canonical production URL: ' + CANONICAL_PRODUCTION_URL);
         process.exitCode = 1;
         return;
    }

    console.log('✅ VALIDATION PASSED: Armageddon production environment is valid.');
}

validateEnv();
