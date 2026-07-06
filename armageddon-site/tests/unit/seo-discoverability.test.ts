/**
 * SEO / GEO discoverability regression shield.
 *
 * Locks the search + AI-answer-engine surface added 2026-07-06:
 *  - public/robots.txt   (crawl policy + AI crawler allowances + sitemap ref)
 *  - public/sitemap.xml  (canonical page inventory)
 *  - public/llms.txt     (AI chat-search / GEO summary)
 *  - public/og-image.png (1200x630 social card — referenced by layout metadata)
 *  - layout.tsx JSON-LD structured data + canonical
 *
 * These files are static and load-bearing for search + AI-search ranking.
 * Do NOT delete or hollow them out; update them together when pages or
 * positioning change (see CLAUDE.md documentation maintenance rules).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PUB = join(__dirname, '..', '..', 'public');
const read = (f: string) => readFileSync(join(PUB, f), 'utf8');

describe('SEO/GEO discoverability assets', () => {
    it('robots.txt allows crawl, blocks app surfaces, and references the sitemap', () => {
        const robots = read('robots.txt');
        expect(robots).toMatch(/^User-agent: \*/m);
        expect(robots).toMatch(/^Disallow: \/console/m);
        expect(robots).toMatch(/^Disallow: \/api\//m);
        expect(robots).toContain('Sitemap: https://armageddontest.icu/sitemap.xml');
        // AI answer-engine crawlers must remain explicitly allowed (GEO)
        for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
            expect(robots).toContain(`User-agent: ${bot}`);
        }
    });

    it('sitemap.xml is well-formed and lists all canonical marketing pages', () => {
        const sitemap = read('sitemap.xml');
        expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
        for (const path of ['/', '/pricing', '/intake', '/support', '/privacy']) {
            expect(sitemap).toContain(`<loc>https://armageddontest.icu${path}</loc>`);
        }
        // No app/auth surfaces may leak into the sitemap
        for (const blocked of ['/console', '/onboarding', '/auth/']) {
            expect(sitemap).not.toContain(`<loc>https://armageddontest.icu${blocked}`);
        }
    });

    it('llms.txt exists with product summary and page links', () => {
        const llms = read('llms.txt');
        expect(llms).toMatch(/^# ARMAGEDDON Test Suite Certification/);
        expect(llms).toContain('13');
        expect(llms).toContain('https://armageddontest.icu/pricing');
    });

    it('og-image.png exists and is a plausible social card', () => {
        const st = statSync(join(PUB, 'og-image.png'));
        expect(st.size).toBeGreaterThan(10_000); // not an empty placeholder
        // PNG magic bytes
        const buf = readFileSync(join(PUB, 'og-image.png'));
        expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    });

    it('root layout carries JSON-LD structured data and a canonical alternate', () => {
        const layout = readFileSync(join(__dirname, '..', '..', 'src', 'app', 'layout.tsx'), 'utf8');
        expect(layout).toContain("'@context': 'https://schema.org'");
        expect(layout).toContain("'@type': 'SoftwareApplication'");
        expect(layout).toContain('application/ld+json');
        expect(layout).toContain('alternates: { canonical:');
    });
});
