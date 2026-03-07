import { describe, it, expect } from 'vitest';
import { parseDuration } from '../../src/core/stress';

describe('stress', () => {
    describe('parseDuration', () => {
        it('should parse seconds correctly', () => {
            expect(parseDuration('30s')).toBe(30000);
            expect(parseDuration('1s')).toBe(1000);
            expect(parseDuration('0s')).toBe(0);
        });

        it('should parse minutes correctly', () => {
            expect(parseDuration('5m')).toBe(5 * 60 * 1000);
            expect(parseDuration('1m')).toBe(60000);
        });

        it('should parse hours correctly', () => {
            expect(parseDuration('1h')).toBe(60 * 60 * 1000);
            expect(parseDuration('2h')).toBe(2 * 60 * 60 * 1000);
        });

        it('should handle large values', () => {
            expect(parseDuration('120s')).toBe(120000);
            expect(parseDuration('90m')).toBe(90 * 60 * 1000);
        });

        it('should return default 30s for invalid formats', () => {
            expect(parseDuration('')).toBe(30000);
            expect(parseDuration('30')).toBe(30000);
            expect(parseDuration('5x')).toBe(30000);
            expect(parseDuration('10d')).toBe(30000);
            expect(parseDuration('s30')).toBe(30000);
            expect(parseDuration('30.5s')).toBe(30000);
        });
    });
});
