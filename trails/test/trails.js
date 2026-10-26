// What the trails' tests share (not a test itself): fields and tiles on a seeded randomness,
// events told as their beats are reached, and what's read of the traffic
import { TRAFFIC_GRID, TrailField, TrailTiles } from '../index.ts';
import { seededRandomness } from '../../randomness/test/seeded-randomness.js';

export const SEEDS = [1, 2, 3, 4, 5, 6];
export const RULES = { sense: 6, sensorAngle: 0.7, turn: 0.4, fade: 0.96, perSeed: 2 };
export const MANY = 6; // agents a test seed lets loose, enough that a chance run doesn't decide
export const SENSE = { ...RULES, perSeed: MANY };
export const PASSING = { ...SENSE, edges: 'pass' };
export const RED = [0.8, 0.2, 0.1];
export const FADED_AFTER = 100; // beats: 200 quanta, far past the lifetime and the fade of a thread
export const QUANTA_A_BEAT = 2;

// steps along a few lines, each recorded between fades, as a field's quanta lay them
export const STEPS = [
  [
    { x: 10, y: 20 },
    { x: 11, y: 20.5 },
  ],
  [
    { x: 80, y: 80 },
    { x: 80.7, y: 81 },
  ],
  [
    { x: 10.5, y: 20.2 },
    { x: 11.2, y: 20.9 },
  ],
];

export function fieldOf(seed, rules = RULES) {
  return new TrailField(rules, seededRandomness(seed));
}

export function tilesOf(seed, rules = PASSING, wrapAcross) {
  return new TrailTiles(rules, seededRandomness(seed), wrapAcross);
}

export function fieldAt(tiles, across, down) {
  return tiles.fields.find(({ tile }) => tile.across === across && tile.down === down)?.field;
}

// each event, [beat, 'food' | 'seed', x, y], told as its beat is reached, before advancing past it;
// `stepsOf(from, to)` gives the beats advanced to on the way
export function runThrough(places, told, stepsOf) {
  let beat = 0;
  for (const [at, kind, x, y] of told) {
    for (const step of stepsOf(beat, at)) {
      places.advanceTo(step);
    }
    places.advanceTo(at);
    beat = at;
    if (kind === 'food') {
      places.food(x, y);
    } else {
      places.seed(x, y);
    }
  }
  return places;
}

export function inOneGo(from, to) {
  return [to];
}

export function inSmallSteps(from, to) {
  const steps = [];
  for (let step = from + 0.07; step < to; step += 0.07) {
    steps.push(step);
  }
  return steps;
}

export function sameTraffic(first, second) {
  return first.length === second.length && first.every((value, at) => value === second[at]);
}

export function total(traffic) {
  return traffic.reduce((sum, value) => sum + value, 0);
}

export function copyOf(values) {
  return Float32Array.from(values);
}

// the traffic in a box on the plane (0 to 1 by 0 to 1)
export function massIn(traffic, { x0, x1, y0, y1 }) {
  let sum = 0;
  for (let row = Math.floor(y0 * TRAFFIC_GRID); row < Math.ceil(y1 * TRAFFIC_GRID); row++) {
    for (let column = Math.floor(x0 * TRAFFIC_GRID); column < Math.ceil(x1 * TRAFFIC_GRID); column++) {
      sum += traffic[row * TRAFFIC_GRID + column];
    }
  }
  return sum;
}
