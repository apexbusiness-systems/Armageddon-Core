import { webcrypto } from 'node:crypto';

/**
 * secureRandom - Generates a cryptographically secure random number between 0 and 1.
 * Replacement for Math.random() in security-sensitive contexts.
 */
export function secureRandom(): number {
    const array = new Uint32Array(1);
    webcrypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
}
