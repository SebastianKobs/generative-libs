// ---------- noise/drift: a random walk held within ±limit, reflected at its edges ----------

import type { Randomness } from '../randomness/index.ts';

// How a drift moves
//   step: the most it moves a step, each move even in [−step, step)
//   limit: it stays within ±limit, above 0
//   start: where it begins, within ±limit; 0 when not given
export interface DriftShape {
  readonly step: number;
  readonly limit: number;
  readonly start?: number;
}

// A random walk held within ±limit: a move past an edge comes back by what it overshot, as a ball off
// a wall, so it never sticks at an edge. Advanced by its caller a step at a time
export class Drift {
  readonly #randomness: Randomness;
  readonly #step: number;
  readonly #limit: number;
  #value: number;

  constructor({ step, limit, start = 0 }: DriftShape, randomness: Randomness) {
    this.#randomness = randomness;
    this.#step = step;
    this.#limit = limit;
    this.#value = start;
  }

  get value(): number {
    return this.#value;
  }

  // One step on, reflected at the edges; the new value
  step(): number {
    const moved = this.#value + (this.#randomness.next() * 2 - 1) * this.#step;
    this.#value = reflected(moved, this.#limit);
    return this.#value;
  }
}

// A value folded back within ±limit, however far past it is: as a triangle wave, rising from −limit to
// limit and falling back, a period of 4 × limit
function reflected(value: number, limit: number): number {
  const period = 4 * limit;
  const along = (((value + limit) % period) + period) % period;
  if (along <= 2 * limit) {
    return along - limit;
  }
  return period - along - limit;
}
