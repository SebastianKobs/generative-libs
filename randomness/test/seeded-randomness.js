// A seeded Randomness for every package of the group's tests (not a test itself):
//   - next(): mulberry32, a tiny generator, a 32-bit state scrambled to a float in [0, 1);
//   - fork(name): a stream of its own, seeded by the seed and the name, so the same
//     name from the same seed always gives the same stream, whatever was drawn before.

/**
 * @param {number} seed
 * @returns {import('../index.ts').Randomness}
 */
export function seededRandomness(seed) {
  return { next: mulberry32(seed), fork: (name) => seededRandomness(hashSeed(`${seed}:${name}`)) };
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// a string folded to a seed: FNV-1a, each character xored in, then multiplied by a prime
function hashSeed(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
