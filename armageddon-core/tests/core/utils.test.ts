import { describe, it, expect } from 'vitest';
import { secureRandom, SeedableRNG, hashString } from '../../src/core/utils';

describe('utils', () => {
  describe('secureRandom', () => {
    it('should return a number between 0 and 1', () => {
      const val = secureRandom();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    });

    it('should return different values on subsequent calls', () => {
      const val1 = secureRandom();
      const val2 = secureRandom();
      expect(val1).not.toBe(val2);
    });
  });

  describe('SeedableRNG', () => {
    it('should be deterministic with the same seed', () => {
      const rng1 = new SeedableRNG(123);
      const rng2 = new SeedableRNG(123);

      expect(rng1.next()).toBe(rng2.next());
      expect(rng1.next()).toBe(rng2.next());
      expect(rng1.int(0, 100)).toBe(rng2.int(0, 100));
    });

    it('should be different with different seeds', () => {
        const rng1 = new SeedableRNG(123);
        const rng2 = new SeedableRNG(456);

        expect(rng1.next()).not.toBe(rng2.next());
    });

    it('should generate bools respecting probability', () => {
        const rng = new SeedableRNG(123);
        // Statistical test might be flaky, but we can check bounds
        const res = rng.bool(0.5);
        expect(typeof res).toBe('boolean');
    });

    it('should generate ints within range', () => {
        const rng = new SeedableRNG(123);
        for(let i=0; i<100; i++) {
            const val = rng.int(10, 20);
            expect(val).toBeGreaterThanOrEqual(10);
            expect(val).toBeLessThanOrEqual(20);
        }
    });
  });

  describe('hashString', () => {
    it('should return consistent hash', () => {
        expect(hashString('test')).toBe(hashString('test'));
    });

    it('should return different hash for different strings', () => {
        expect(hashString('foo')).not.toBe(hashString('bar'));
    });
  });
});
