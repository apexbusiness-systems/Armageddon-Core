import { describe, it, expect } from 'vitest';
import { isSafeEmail } from '../../../src/components/AuthModal';

// Regression coverage for the linear-time email validator that replaced the
// backtracking regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/. The validator must remain at
// least as strict as that pattern for the addresses real users submit.
describe('isSafeEmail', () => {
    it('accepts ordinary valid addresses', () => {
        for (const value of [
            'operator@domain.com',
            'a@b.co',
            'first.last@sub.example.org',
            'user+tag@example.io',
            '  trimmed@example.com  ', // leading/trailing whitespace is trimmed away
        ]) {
            expect(isSafeEmail(value)).toBe(true);
        }
    });

    it('rejects everything the old regex rejected', () => {
        for (const value of [
            '',
            'no-at-symbol',
            '@no-local.com',
            'no-domain@',
            'missing-dot@example',
            'two@@example.com',
        ]) {
            expect(isSafeEmail(value)).toBe(false);
        }
    });

    it('rejects whitespace and control characters anywhere in the address', () => {
        expect(isSafeEmail('a b@example.com')).toBe(false);
        expect(isSafeEmail('a\t@example.com')).toBe(false);
        expect(isSafeEmail('a@exa\nmple.com')).toBe(false);
        expect(isSafeEmail(`a@example.com${String.fromCharCode(1)}`)).toBe(false); // embedded control char (U+0001)
        expect(isSafeEmail(`a@example.com${String.fromCharCode(0x7f)}`)).toBe(false); // embedded DEL (U+007F)
    });

    it('rejects malformed domains (leading/trailing/double dots)', () => {
        expect(isSafeEmail('a@.example.com')).toBe(false);
        expect(isSafeEmail('a@example.com.')).toBe(false);
        expect(isSafeEmail('a@example..com')).toBe(false);
    });

    it('enforces sane length bounds', () => {
        const longLocal = `${'x'.repeat(65)}@example.com`;
        expect(isSafeEmail(longLocal)).toBe(false);
        const longDomain = `a@${'d'.repeat(250)}.com`;
        expect(isSafeEmail(longDomain)).toBe(false);
        expect(isSafeEmail('a@b')).toBe(false); // shorter than a dotted domain
    });
});
