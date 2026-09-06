import fs from 'node:fs';

/**
 * Loads key-value pairs from an ATSC environment file if it exists,
 * stripping markdown escape characters and surrounding quotes.
 *
 * @param {string} [customPath]
 * @returns {Record<string, string>}
 */
export function loadAtscEnv(customPath) {
    const envFilePath = customPath || process.env.ATSC_ENV_PATH || 'C:/Users/sinyo/Desktop/ENV/ATSC-env.md';
    if (!fs.existsSync(envFilePath)) {
        return {};
    }

    const content = fs.readFileSync(envFilePath, 'utf8');
    const result = {};

    for (const rawLine of content.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) continue;

        const rawKey = line.slice(0, eqIndex).trim();
        let rawVal = line.slice(eqIndex + 1).trim();

        if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
            rawVal = rawVal.slice(1, -1);
        }

        const key = rawKey.replaceAll(String.raw`\_`, '_');
        const val = rawVal.replaceAll(String.raw`\_`, '_');

        result[key] = val;
    }

    return result;
}
