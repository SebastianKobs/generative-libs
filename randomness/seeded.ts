// ---------- randomness/seeded: a seeded Randomness, the same draws for the same seed ----------

import type { Randomness } from './randomness.ts';

// The largest 32-bit state plus one: a state divided by it is a draw in [0, 1)
const STATES = 4294967296;
// FNV-1a's offset and prime, a string folded to a seed
const HASH_OFFSET = 2166136261;
const HASH_PRIME = 16777619;

// A Randomness from a seed:
//   next(): mulberry32, a tiny generator, a 32-bit state scrambled to a float in [0, 1);
//   fork(name): a stream of its own, seeded by the seed and the name, so the same name from the
//   same seed always gives the same stream, whatever was drawn before.
// Not for anything secret: 32 bits of state, quick and even enough for a rule's draws
export function seededRandomness(seed: number): Randomness {
  return { next: mulberry32(seed), fork: (name) => seededRandomness(hashSeed(`${seed}:${name}`)) };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / STATES;
  };
}

// a string folded to a seed: FNV-1a, each character xored in, then multiplied by a prime
function hashSeed(text: string): number {
  let hash = HASH_OFFSET;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, HASH_PRIME);
  }
  return hash >>> 0;
}
