// ---------- generative/articulation/articulate: a stroke's marks from a hand's qualities ----------

import type { Randomness } from '../randomness/index.ts';
import type { BreakMark, FlickMark, Hand, LineMark, Mark, MarkPlace } from './mark.ts';
import type { StrokePoint } from './stroke.ts';

// What to make of a stroke
//   upTo: as much of it as this share (0..1)
//   landing: where the hand first touches down, the size of that mark as a share of the usual; 0, none
export interface ArticulateOptions {
  readonly upTo?: number;
  readonly landing?: number;
}

// One sample's own draws and place, handed to what its gesture adds
interface Touch {
  readonly here: MarkPlace;
  readonly sample: StrokePoint;
  readonly from: StrokePoint;
  readonly index: number;
  readonly roll: number;
  readonly wobble: number;
}

const TAU = Math.PI * 2;
const RUNS_OUT_FROM = 0.55; // the share of the stroke a load of 0 carries
const RUNS_OUT_PER_LOAD = 0.6;
const RUN_OUT_EASE = 0.12; // the share of the stroke the run-out comes in over
const BEAD_EVERY = 3; // a drip's bead on every third sample
const SPLATTER_EVERY = 2; // a splatter's dot on every other sample
const FLICK_ROLL = 0.16; // a fling's flick: this share of fast samples
const FLICK_FROM_SPEED = 0.8;
const POOL_BELOW_SPEED = 0.6;
const SAMPLES_BACK_FOR_HEADING = 3; // the run-out flick leaves along the last three samples' heading

// The marks of a stroke made as far as `upTo`, in the order the hand makes them:
//   1. the landing, if `landing` is above 0: a blot and the flick off it;
//   2. each sample of the stroke: its line (or a break), and what its gesture adds;
//   3. past where the load runs out, once the stroke has come that far: a flick of what's left.
// Every sample draws two numbers whether it is made or not, so the same sample rolls the same
// way however far the stroke has come.
export function articulate(
  stroke: readonly StrokePoint[],
  hand: Hand,
  randomness: Randomness,
  { upTo = 1, landing = 0 }: ArticulateOptions = {},
): Mark[] {
  const first = stroke[0];
  if (first === undefined) {
    return [];
  }
  const draws = randomness.fork('marks');
  const runsOutAt = Math.min(1, RUNS_OUT_FROM + RUNS_OUT_PER_LOAD * hand.load);
  const marks: Mark[] = [];
  if (landing > 0) {
    marks.push(...landedMarks(first, hand, draws, landing));
  }
  let previous = first;
  let last = first;
  let lastIndex = 0;
  for (const [index, sample] of stroke.entries()) {
    const roll = draws.next();
    const wobble = draws.next();
    if (index === 0 || sample.along > Math.min(upTo, runsOutAt)) {
      continue;
    }
    const intensity = 1 - 0.65 * Math.pow(sample.along / runsOutAt, 1.2);
    const here = { ...placeOf(sample), intensity, weight: weightAt(hand, sample, intensity) };
    marks.push(...marksOfSample({ here, sample, from: previous, index, roll, wobble }, hand));
    previous = sample;
    last = sample;
    lastIndex = index;
  }
  if (upTo < runsOutAt) {
    return marks;
  }
  marks.push(runOutFlick(stroke, { last, lastIndex }, hand, (upTo - runsOutAt) / RUN_OUT_EASE));
  return marks;
}

// How far one throw carries, in the quarter turns its shape takes: with the hand's speed, a little
// different for each randomness, and the hand's reach
export function carryOf(hand: Hand, randomness: Randomness): number {
  const draw = randomness.fork('carry').next();
  return (0.8 + 1.1 * hand.speed) * (0.8 + 0.4 * draw) * (hand.reach ?? 1);
}

// What a sample makes, by the hand's gesture
function marksOfSample(touch: Touch, hand: Hand): Mark[] {
  if (hand.gesture === 'splatter') {
    return splatterMarks(touch);
  }
  if (hand.gesture === 'drip') {
    return dripMarks(touch, hand);
  }
  if (hand.gesture === 'fling') {
    return flingMarks(touch, hand);
  }
  return pourMarks(touch, hand);
}

// A flick of dots all round, and a blot, on every other sample
function splatterMarks({ here, index, wobble }: Touch): Mark[] {
  if (index % SPLATTER_EVERY) {
    return [];
  }
  return [
    { ...here, kind: 'flick', count: 3, scatter: 3, size: 0.5, heading: wobble * TAU, fan: TAU, manner: 'splatter' },
    { ...here, kind: 'blot', size: 0.9 },
  ];
}

// A thin line, and a bead with a tail on every third sample
function dripMarks({ here, from, index, wobble }: Touch, hand: Hand): Mark[] {
  const marks: Mark[] = [lineMark(here, from, 0.4)];
  if (index % BEAD_EVERY) {
    return marks;
  }
  marks.push({
    ...here,
    kind: 'bead',
    size: 0.7 + hand.viscosity * 0.6,
    tail: 2 + 5 * (1 - hand.viscosity) * wobble,
  });
  return marks;
}

// A line, and where the hand is fast a flick of streaks along its heading
function flingMarks(touch: Touch, hand: Hand): Mark[] {
  const { here, sample, from, roll, wobble } = touch;
  const marks: Mark[] = [lineOrBreak(touch, hand, 0.55)];
  if (roll >= FLICK_ROLL || sample.speed <= FLICK_FROM_SPEED) {
    return marks;
  }
  marks.push({
    ...here,
    kind: 'flick',
    count: 3,
    throw: 0.04 * hand.speed,
    size: 0.4,
    heading: Math.atan2(sample.y - from.y, sample.x - from.x) + (wobble - 0.5) * 0.8,
    fan: 0.5,
    manner: 'fling',
  });
  return marks;
}

// A line, and where the hand is slow and the paint thick a pool
function pourMarks(touch: Touch, hand: Hand): Mark[] {
  const { here, sample, wobble } = touch;
  const marks: Mark[] = [lineOrBreak(touch, hand, 1)];
  if (sample.speed < POOL_BELOW_SPEED && wobble < hand.viscosity) {
    marks.push({ ...here, kind: 'pool', size: 0.8 + hand.viscosity * 0.5 });
  }
  return marks;
}

// A stretch made, or where the load is low and thin a stretch left unmade
function lineOrBreak({ here, from, roll }: Touch, hand: Hand, size: number): LineMark | BreakMark {
  const running = here.intensity < 0.5 && roll < (0.5 - here.intensity) * (1.6 - hand.viscosity) * 1.6;
  if (running) {
    return { ...here, kind: 'break' };
  }
  return lineMark(here, from, size);
}

function lineMark(here: MarkPlace, from: StrokePoint, size: number): LineMark {
  return {
    ...here,
    kind: 'line',
    from: { x: from.x, y: from.y, beat: from.beat },
    duration: here.beat - from.beat,
    size,
  };
}

// Where the hand first touches down: a round mark, and a flick of marks off it
function landedMarks(first: StrokePoint, hand: Hand, draws: Randomness, landing: number): Mark[] {
  const here = { ...placeOf(first), intensity: 1, weight: weightAt(hand, first, 1) };
  const size = (1 + hand.height) * 1.2 * landing;
  return [
    { ...here, kind: 'blot', size },
    {
      ...here,
      kind: 'flick',
      count: Math.round(2 + 5 * hand.height * (1 - hand.viscosity * 0.6)),
      throw: landing * 0.03 * (0.5 + hand.height),
      size: size * 0.3,
      heading: draws.next() * TAU,
      fan: TAU,
      manner: 'splatter',
    },
  ];
}

// What's left of the load, thrown off the last sample made along the stroke's heading there; `progress` is how far
// past the run-out the stroke has come, eased
function runOutFlick(
  stroke: readonly StrokePoint[],
  { last, lastIndex }: { last: StrokePoint; lastIndex: number },
  hand: Hand,
  pastRunOut: number,
): FlickMark {
  const back = stroke[Math.max(0, lastIndex - SAMPLES_BACK_FOR_HEADING)] ?? last;
  return {
    ...placeOf(last),
    intensity: 0.4,
    weight: weightAt(hand, last, 0.4),
    kind: 'flick',
    count: Math.round(2 + 4 * (1 - hand.viscosity)),
    throw: 0.03 + 0.04 * hand.height,
    size: 1,
    heading: Math.atan2(last.y - back.y, last.x - back.x),
    fan: 0.9,
    manner: 'drip',
    progress: smooth(pastRunOut),
  };
}

function placeOf(sample: StrokePoint): Pick<MarkPlace, 'along' | 'beat' | 'x' | 'y'> {
  return { along: sample.along, beat: sample.beat, x: sample.x, y: sample.y };
}

// The stroke's thickness at one sample: thin where the hand is fast and the load falls far, thick
// where the load is thick and plentiful, thinning as `intensity` (the load left) falls
function weightAt(hand: Hand, sample: StrokePoint, intensity: number): number {
  const pace = 0.5 + hand.speed * (0.5 + sample.speed) * 1.1;
  const body = (0.5 + hand.viscosity * 0.7) * (0.4 + hand.load * 0.9);
  const fall = 0.7 + 0.5 * hand.height;
  return (body * intensity) / (pace * fall);
}

// Smoothstep: 0 to 1 along an S, flat at both ends
function smooth(fraction: number): number {
  const held = Math.max(0, Math.min(1, fraction));
  return held * held * (3 - 2 * held);
}
