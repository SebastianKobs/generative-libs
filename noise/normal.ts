// ---------- noise/normal: a draw from the normal distribution, out of a Randomness's even draws ----------

import type { Randomness } from '../randomness/index.ts';

const TAU = Math.PI * 2;

// A normal draw, mean 0 and spread 1, by Box-Muller: two even draws turned into a radius and an angle,
// the point's x on the plane. Two draws a call; the point's y is dropped, so no draw is kept between calls
export function normalDraw(randomness: Randomness): number {
  // 1 − a draw is in (0, 1]: its logarithm is never infinite
  const radius = Math.sqrt(-2 * Math.log(1 - randomness.next()));
  return radius * Math.cos(TAU * randomness.next());
}
