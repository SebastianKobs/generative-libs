// ---------- randomness: the draws a generative rule takes, handed in, and a seeded one to hand ----------
// What it holds: Randomness, a draw and a stream of its own by name (randomness.ts); seededRandomness(), the same
// draws for the same seed, for an app or a test to hand in (seeded.ts). No other library imports a generator
export type { Randomness } from './randomness.ts';
export { seededRandomness } from './seeded.ts';
