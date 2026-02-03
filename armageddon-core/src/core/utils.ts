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

/**
 * SeedableRNG - Deterministic random number generator for simulations.
 * Uses Mulberry32 algorithm.
 */
export class SeedableRNG {
    private state: number;

    constructor(seed: number) {
        this.state = seed | 0;
    }

    /**
     * Returns a float between 0 and 1.
     */
    next(): number {
        this.state = (this.state + 0x6D2B79F5) | 0;
        let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
        t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /**
     * Returns true/false based on probability.
     */
    bool(probability: number): boolean {
        return this.next() < probability;
    }

    /**
     * Returns integer between min and max (inclusive).
     */
    int(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
}

/**
 * Hash a string to a 32-bit integer seed.
 */
export function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}
