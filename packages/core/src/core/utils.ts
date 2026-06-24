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

// ═══════════════════════════════════════════════════════════════════════════
// APEX-POWER: Deterministic Utilities for Reproducible Simulation
// DATE: 2026-02-06
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SeedableRNG - Deterministic pseudo-random number generator.
 * Uses mulberry32 algorithm for reproducible test results.
 * APEX-POWER: "Never Guess." Same seed = same sequence.
 */
export class SeedableRNG {
    private state: number;

    constructor(seed: number) {
        this.state = seed >>> 0; // Ensure unsigned 32-bit
    }

    /**
     * Returns next random number in [0, 1).
     * Mulberry32 algorithm - fast, deterministic, good distribution.
     */
    next(): number {
        let t = (this.state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /**
     * Returns true with given probability [0, 1].
     */
    bool(probability: number): boolean {
        return this.next() < probability;
    }

    /**
     * Returns random integer in [min, max] inclusive.
     */
    int(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
}

/**
 * hashString - FNV-1a hash for deterministic string → number mapping.
 * APEX-POWER: Same input = same output. Zero drift. Zero guessing.
 */
export function hashString(str: string): number {
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
        hash ^= str.codePointAt(i) ?? 0;
        hash = Math.imul(hash, 16777619); // FNV prime
    }
    return hash >>> 0; // Ensure unsigned
}
