// ---------- noise/pink: 1/f noise by Voss-McCartney, a step at a time ----------

import type { Randomness } from '../randomness/index.ts';

// Pink (1/f) noise by Voss-McCartney: several random sources summed, the first re-drawn every step, each
// next at half the rate of the one before.
// Why it is pink: a source held for 2ᵏ steps carries power only below about 1/2ᵏ, so each octave down
// adds one more source to the sum, and the power falls about 3 dB an octave, as 1/f does.
// The slower sources take turns, by the trailing zeros of the step's count, so one moves at a time, not
// all on the same step. Each source is even in [−1, 1); their mean, the value, stays within ±1.
// Advanced by its caller a step at a time; the same draws give the same series.
export class PinkNoise {
  readonly #randomness: Randomness;
  readonly #sources: number[];
  #steps = 0;

  // `sources`: how many, at least 1; each one past the first adds an octave of 1/f below
  constructor(sources: number, randomness: Randomness) {
    this.#randomness = randomness;
    this.#sources = Array.from({ length: sources }, () => evenDraw(randomness));
  }

  // the last step's value, or the first sources' before any step
  get value(): number {
    return this.#sources.reduce((sum, source) => sum + source, 0) / this.#sources.length;
  }

  // One step on: the first source re-drawn, and the slower one whose turn it is; the new value
  step(): number {
    this.#steps++;
    this.#redraw(0);
    this.#redraw(1 + trailingZeros(this.#steps));
    return this.value;
  }

  // a source past the slowest is no source: nothing drawn
  #redraw(source: number): void {
    if (source >= this.#sources.length) {
      return;
    }
    this.#sources[source] = evenDraw(this.#randomness);
  }
}

// a draw even in [−1, 1)
function evenDraw(randomness: Randomness): number {
  return randomness.next() * 2 - 1;
}
// how many times a whole number above 0 halves evenly: 1 → 0, 2 → 1, 12 → 2
function trailingZeros(count: number): number {
  return 31 - Math.clz32(count & -count);
}
