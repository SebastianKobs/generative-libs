// ---------- noise/mean-reverting: noise pulled back toward its mean, a discrete Ornstein-Uhlenbeck ----------

import type { Randomness } from '../randomness/index.ts';
import { normalDraw } from './normal.ts';

// How mean-reverting noise moves
//   mean: where it is pulled back to
//   rate: the share of the way back it is pulled each step, above 0 and at most 1 (1 forgets every step)
//   spread: its standard deviation over a long run, however fast it is pulled back
//   start: where it begins; its mean when not given
export interface MeanRevertingShape {
  readonly mean: number;
  readonly rate: number;
  readonly spread: number;
  readonly start?: number;
}

// Noise that wanders but keeps coming home: each step pulled toward its mean by its rate, then pushed by
// a normal draw (a discrete Ornstein-Uhlenbeck process, an AR(1) series):
//   next = mean + (1 − rate) × (value − mean) + push × normal draw
// The push is sized so the spread over a long run is the one asked: push² = spread² × (1 − (1 − rate)²).
// Advanced by its caller a step at a time
export class MeanRevertingNoise {
  readonly #randomness: Randomness;
  readonly #mean: number;
  readonly #kept: number;
  readonly #push: number;
  #value: number;

  constructor({ mean, rate, spread, start = mean }: MeanRevertingShape, randomness: Randomness) {
    this.#randomness = randomness;
    this.#mean = mean;
    this.#kept = 1 - rate;
    this.#push = spread * Math.sqrt(1 - this.#kept ** 2);
    this.#value = start;
  }

  get value(): number {
    return this.#value;
  }

  // One step on: pulled back, then pushed; the new value
  step(): number {
    const pulled = this.#mean + this.#kept * (this.#value - this.#mean);
    this.#value = pulled + this.#push * normalDraw(this.#randomness);
    return this.#value;
  }
}
