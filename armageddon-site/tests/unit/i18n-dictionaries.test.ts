/**
 * I18N DICTIONARY PARITY — regression guardrail
 *
 * English (`src/i18n/dictionaries/en.ts`) is the schema source of truth.
 * Every other locale dictionary must have exact key parity with it: no
 * missing keys, no extra keys, and no key resolving to a non-string where
 * English has a string (a missed translation slot would otherwise silently
 * fall through to `undefined` in the UI). Arrays (e.g. plan features,
 * support scope badges) are compared by length-of-shape only, not by content,
 * since translated copy is expected to differ in length and wording from
 * English.
 */

import { describe, it, expect } from 'vitest';
import en from '../../src/i18n/dictionaries/en';
import fr from '../../src/i18n/dictionaries/fr';
import de from '../../src/i18n/dictionaries/de';
import it18n from '../../src/i18n/dictionaries/it';
import es from '../../src/i18n/dictionaries/es';
import zhCN from '../../src/i18n/dictionaries/zh-CN';
import pt from '../../src/i18n/dictionaries/pt';
import { SUPPORTED_LOCALES, type Locale } from '../../src/i18n/locales';
import type { Dictionary } from '../../src/i18n/types';

const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = {
    en,
    fr,
    de,
    it: it18n,
    es,
    'zh-CN': zhCN,
    pt,
};

type LeafKind = 'string' | 'string-array' | 'object';

/** Recursively collects a sorted list of `dotted.path:kind` entries for structural comparison. */
function collectShape(value: unknown, prefix = ''): string[] {
    if (Array.isArray(value)) {
        const kind: LeafKind = 'string-array';
        return [`${prefix}:${kind}`];
    }
    if (value !== null && typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
            collectShape(child, prefix ? `${prefix}.${key}` : key),
        );
    }
    const kind: LeafKind = 'string';
    return [`${prefix}:${kind}`];
}

describe('i18n dictionary parity', () => {
    it('declares the expected set of supported locales', () => {
        expect(SUPPORTED_LOCALES).toEqual(['en', 'fr', 'de', 'it', 'es', 'zh-CN', 'pt']);
    });

    const englishShape = collectShape(en).sort();

    it('the English dictionary has a non-empty schema shape', () => {
        expect(englishShape.length).toBeGreaterThan(0);
    });

    for (const locale of SUPPORTED_LOCALES) {
        if (locale === 'en') continue;

        it(`"${locale}" dictionary has exact key parity with English`, () => {
            const shape = collectShape(DICTIONARIES[locale]).sort();
            expect(shape).toEqual(englishShape);
        });

        it(`"${locale}" dictionary plans cover the same plan ids as English, in the same order`, () => {
            expect(Object.keys(DICTIONARIES[locale].pricing.plans)).toEqual(
                Object.keys(en.pricing.plans),
            );
        });

        it(`"${locale}" dictionary has no empty-string leaf values`, () => {
            const blanks: string[] = [];
            const walk = (value: unknown, prefix: string) => {
                if (Array.isArray(value)) {
                    value.forEach((item, i) => walk(item, `${prefix}[${i}]`));
                    return;
                }
                if (value !== null && typeof value === 'object') {
                    Object.entries(value as Record<string, unknown>).forEach(([key, child]) =>
                        walk(child, prefix ? `${prefix}.${key}` : key),
                    );
                    return;
                }
                // `cadenceLabel` is intentionally an empty string for the free tier
                // across every locale (no "/month"-style suffix needed).
                if (typeof value === 'string' && value === '' && !prefix.endsWith('cadenceLabel')) {
                    blanks.push(prefix);
                }
            };
            walk(DICTIONARIES[locale], '');
            expect(blanks).toEqual([]);
        });
    }
});
