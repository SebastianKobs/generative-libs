// Trails (mockup/src/libs/generative/trails/): a slime mould's agents on a field, food drawing them, seeds letting more loose
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAFFIC_GRID, TrailField } from '../index.ts';
import { seededRandomness } from '../../randomness/test/seeded-randomness.js';

const SEEDS = [1, 2, 3, 4, 5, 6];
const RULES = { sense: 6, sensorAngle: 0.7, turn: 0.4, fade: 0.96, perSeed: 2 };
const fieldOf = (seed, rules = RULES) => new TrailField(rules, seededRandomness(seed));

// what is told at each beat: [beat, 'food' | 'seed', x, y]
const TOLD = [
  [0, 'food', 0.2, 0.5],
  [0.5, 'food', 0.8, 0.5],
  [1, 'seed', 0.2, 0.5],
  [2, 'seed', 0.8, 0.5],
  [3.5, 'seed', 0.25, 0.52],
  [6, 'seed', 0.75, 0.48],
];

// each event told as its beat is reached, before advancing past it; `stepsOf` gives the beats advanced to on the way
function runThrough(field, told, stepsOf) {
  let beat = 0;
  for (const [at, kind, x, y] of told) {
    for (const step of stepsOf(beat, at)) {
      field.advanceTo(step);
    }
    field.advanceTo(at);
    beat = at;
    if (kind === 'food') {
      field.food(x, y);
    } else {
      field.seed(x, y);
    }
  }
  return field;
}
const inOneGo = (from, to) => [to];
const inSmallSteps = (from, to) => {
  const steps = [];
  for (let step = from + 0.07; step < to; step += 0.07) {
    steps.push(step);
  }
  return steps;
};

const sameTraffic = (first, second) =>
  first.length === second.length && first.every((value, at) => value === second[at]);
const total = (traffic) => traffic.reduce((sum, value) => sum + value, 0);
// the traffic in a box on the plane (0 to 1 by 0 to 1)
function massIn(traffic, { x0, x1, y0, y1 }) {
  let sum = 0;
  for (let row = Math.floor(y0 * TRAFFIC_GRID); row < Math.ceil(y1 * TRAFFIC_GRID); row++) {
    for (let column = Math.floor(x0 * TRAFFIC_GRID); column < Math.ceil(x1 * TRAFFIC_GRID); column++) {
      sum += traffic[row * TRAFFIC_GRID + column];
    }
  }
  return sum;
}

test('the same events, beats and randomness give the same traffic; another randomness, another', () => {
  const first = runThrough(fieldOf(1), TOLD, inOneGo);
  const second = runThrough(fieldOf(1), TOLD, inOneGo);
  const other = runThrough(fieldOf(2), TOLD, inOneGo);
  for (const field of [first, second, other]) {
    field.advanceTo(10);
  }
  assert.equal(first.traffic.length, TRAFFIC_GRID * TRAFFIC_GRID);
  assert.ok(total(first.traffic) > 0);
  assert.ok(sameTraffic(first.traffic, second.traffic));
  assert.ok(!sameTraffic(first.traffic, other.traffic));
});

test('advanced in one go or in many small steps, with the same events told at the same beats, the same traffic', () => {
  for (const seed of SEEDS.slice(0, 3)) {
    const whole = runThrough(fieldOf(seed), TOLD, inOneGo);
    const pieces = runThrough(fieldOf(seed), TOLD, inSmallSteps);
    whole.advanceTo(10);
    for (let beat = 7; beat < 10; beat += 0.07) {
      pieces.advanceTo(beat);
    }
    pieces.advanceTo(10);
    assert.ok(sameTraffic(whole.traffic, pieces.traffic), `seed ${seed}`);
  }
});

test('no agents before a seed: food alone leaves no traffic; after a seed, traffic near it', () => {
  const field = fieldOf(1);
  field.food(0.3, 0.6);
  field.advanceTo(8);
  assert.equal(total(field.traffic), 0);
  field.seed(0.3, 0.6);
  field.advanceTo(10);
  const near = massIn(field.traffic, { x0: 0.15, x1: 0.45, y0: 0.45, y1: 0.75 });
  assert.ok(near > 0);
  assert.ok(near > 0.9 * total(field.traffic), 'agents let loose there have stayed near it');
});

test('a seed lets perSeed agents loose, and changed rules count from the next quantum on', () => {
  const field = fieldOf(1, { ...RULES, perSeed: 0 });
  field.seed(0.5, 0.5);
  field.advanceTo(4);
  assert.equal(total(field.traffic), 0);
  field.rules = { ...RULES, perSeed: 3 };
  assert.equal(field.rules.perSeed, 3);
  field.seed(0.5, 0.5);
  field.advanceTo(8);
  assert.ok(total(field.traffic) > 0);
});

test('two foods and seeds between them grow more traffic along the line joining them than off it', () => {
  const told = [
    [0, 'food', 0.35, 0.5],
    [0, 'food', 0.65, 0.5],
    ...Array.from({ length: 12 }, (_, turn) => [1 + turn * 2, 'seed', turn % 2 === 0 ? 0.35 : 0.65, 0.5]),
  ];
  const between = { x0: 0.42, x1: 0.58 };
  let along = 0;
  let off = 0;
  for (const seed of SEEDS) {
    const field = runThrough(fieldOf(seed), told, inOneGo);
    field.advanceTo(60);
    along += massIn(field.traffic, { ...between, y0: 0.42, y1: 0.58 });
    off += massIn(field.traffic, { ...between, y0: 0.18, y1: 0.34 });
    off += massIn(field.traffic, { ...between, y0: 0.66, y1: 0.82 });
  }
  const offEach = off / 2; // two bands off the line, one on it
  assert.ok(along > 0);
  assert.ok(along > 3 * offEach, `along ${along}, off ${offEach}`);
});
