import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..', 'src');

function read(relativeFromSrc: string): string {
    return readFileSync(join(SRC, relativeFromSrc), 'utf8');
}

describe('hero LCP asset contract', () => {
    const layout = read('app/layout.tsx');
    const consoleComponent = read('components/DestructionConsole.tsx');

    it('preloads only the AVIF hero wordmark to avoid competing critical-path image fetches', () => {
        const wordmarkPreloads = layout.match(/<link rel="preload" as="image" href="\/wordmark\.(?:avif|webp|png)"/g) ?? [];

        expect(wordmarkPreloads).toEqual(['<link rel="preload" as="image" href="/wordmark.avif"']);
        expect(layout).not.toContain('href="/wordmark.webp" type="image/webp" fetchPriority="high"');
    });

    it('keeps the visible hero wordmark eagerly prioritized with intrinsic dimensions and format fallbacks', () => {
        expect(consoleComponent).toContain('<source srcSet="/wordmark.avif" type="image/avif" />');
        expect(consoleComponent).toContain('<source srcSet="/wordmark.webp" type="image/webp" />');
        expect(consoleComponent).toContain('width={824}');
        expect(consoleComponent).toContain('height={315}');
        expect(consoleComponent).toContain('fetchPriority="high"');
        expect(consoleComponent).toContain('loading="eager"');
    });
});
