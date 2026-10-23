// ---------- libs/generative/articulation/sweep: a throw whose shape only the caller knows ----------

import type { Hand, SweepMark } from './mark.ts';

// What to make of a sweep: as much of it as `upTo` (0..1 of it), in `steps` lines
export interface SweepOptions {
  readonly upTo?: number;
  readonly steps?: number;
}

const SWEEP_STEPS = 14;

// A throw whose shape only the caller knows (an arc round a ring), made as far as `upTo`: a line a
// step, thinning as it goes, each at its `along` and `intensity`; once the whole is made, a flick
// off its end, its `heading` relative to the stroke's direction there. No time: the caller times it
export function sweep(hand: Hand, { upTo = 1, steps = SWEEP_STEPS }: SweepOptions = {}): SweepMark[] {
  const marks: SweepMark[] = [];
  for (let step = 0; step < steps; step++) {
    const start = step / steps;
    if (start > upTo) {
      return marks;
    }
    const intensity = 1 - start * 0.85;
    marks.push({
      kind: 'line',
      from: { along: start },
      along: (step + 1) / steps,
      intensity,
      weight: (0.5 + hand.load) * intensity * (0.7 + 0.5 * hand.viscosity),
      size: 1,
    });
  }
  if (upTo < 1) {
    return marks;
  }
  marks.push({
    kind: 'flick',
    along: 1,
    intensity: 0.15,
    count: Math.round(3 + 5 * hand.height * (1 - 0.5 * hand.viscosity)),
    throw: (0.025 + 0.06 * hand.speed) * (hand.reach ?? 1),
    heading: 0,
    fan: 0.7,
    manner: hand.gesture === 'drip' ? 'drip' : 'fling',
  });
  return marks;
}
