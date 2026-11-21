// Sync (generative/sync/): coupled oscillators falling into step, a note pulling them to flash
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Flock } from '../index.ts';
import { seededRandomness } from '../../randomness/test/seeded-randomness.js';
import { near } from '../../../base/util/test/near.js';

const SEEDS = Array.from({ length: 20 }, (_, seed) => seed + 1);
const TAU = Math.PI * 2;
const COUNT = 24;
const RULES = { period: 2.4, spread: 0.12, coupling: 0.5, entrain: 0.2 };
const flockOf = (seed, topology = 'all', rules = RULES) =>
  new Flock({ count: COUNT, topology, rules }, seededRandomness(seed));

// how far the phases agree: 0 spread evenly round the circle, 1 all together (the length of their mean arrow)
const orderOf = (phases) =>
  Math.hypot(
    phases.reduce((sum, phase) => sum + Math.cos(phase), 0),
    phases.reduce((sum, phase) => sum + Math.sin(phase), 0),
  ) / phases.length;
// how far a phase is from the flash, 0 to π
const distanceFromFlash = (phase) => Math.abs(Math.atan2(Math.sin(phase), Math.cos(phase)));
const copyOf = (phases) => [...phases];

test('the same randomness gives the same phases, and each oscillator its own pace and first phase', () => {
  for (const seed of SEEDS) {
    assert.deepEqual(copyOf(flockOf(seed).phases), copyOf(flockOf(seed).phases));
  }
  const phases = copyOf(flockOf(1).phases);
  assert.equal(phases.length, COUNT);
  assert.ok(new Set(phases).size === COUNT, 'every first phase is its own');
  assert.ok(phases.every((phase) => phase >= 0 && phase < TAU));
  assert.notDeepEqual(phases, copyOf(flockOf(2).phases));
  const first = flockOf(3);
  const second = flockOf(3);
  first.advanceTo(10);
  second.advanceTo(10);
  assert.deepEqual(copyOf(first.phases), copyOf(second.phases));
});

test('coupled, the phases agree more over time; uncoupled and of one pace, they never do', () => {
  const evenPaced = { period: 2.4, spread: 0, coupling: 1, entrain: 0 };
  for (const seed of SEEDS) {
    const coupled = flockOf(seed, 'all', evenPaced);
    const alone = flockOf(seed, 'all', { ...evenPaced, coupling: 0 });
    const before = orderOf(coupled.phases);
    coupled.advanceTo(60);
    alone.advanceTo(60);
    assert.ok(orderOf(coupled.phases) > before + 0.2, `seed ${seed}: ${before} to ${orderOf(coupled.phases)}`);
    near(orderOf(alone.phases), before, `seed ${seed}`, 1e-9);
  }
});

test("a pull moves every phase towards the flash, a ring's by the quarter its count of pulls has walked to", () => {
  for (const topology of ['all', 'ring']) {
    for (const seed of SEEDS) {
      const flock = flockOf(seed, topology);
      flock.advanceTo(3);
      const before = copyOf(flock.phases);
      flock.pull();
      const after = copyOf(flock.phases);
      before.forEach((phase, index) => {
        assert.ok(distanceFromFlash(after[index]) <= distanceFromFlash(phase) + 1e-12, `${topology} ${seed}:${index}`);
      });
    }
  }
  // all-to-all: every oscillator pulled alike; ring: the ones near the quarter pulled harder
  const all = flockOf(1, 'all');
  const before = copyOf(all.phases);
  all.pull();
  const movedAll = copyOf(all.phases).map((phase, index) => Math.abs(phase - before[index]));
  assert.ok(movedAll.every((moved) => moved > 0));
  const ring = flockOf(1, 'ring');
  const start = copyOf(ring.phases);
  ring.pull();
  const movedRing = copyOf(ring.phases).map((phase, index) => Math.abs(phase - start[index]));
  assert.ok(Math.max(...movedRing) > 4 * Math.min(...movedRing.filter((moved) => moved > 0)), 'near the quarter more');
});

test('advanced in one go or in many small steps, with the same pulls told at the same beats, the same phases', () => {
  const pullsAt = [1, 1.25, 4, 9.5];
  const advanceOneGo = (flock) => {
    for (const beat of pullsAt) {
      flock.advanceTo(beat);
      flock.pull();
    }
    flock.advanceTo(16);
  };
  const advanceInSmallSteps = (flock) => {
    let beat = 0;
    for (const pullAt of pullsAt) {
      while (beat < pullAt) {
        beat = Math.min(pullAt, beat + 0.1);
        flock.advanceTo(beat);
      }
      flock.pull();
    }
    while (beat < 16) {
      beat = Math.min(16, beat + 0.1);
      flock.advanceTo(beat);
    }
  };
  for (const topology of ['all', 'ring']) {
    for (const seed of SEEDS.slice(0, 5)) {
      const whole = flockOf(seed, topology);
      const pieces = flockOf(seed, topology);
      advanceOneGo(whole);
      advanceInSmallSteps(pieces);
      assert.deepEqual(copyOf(whole.phases), copyOf(pieces.phases), `${topology} ${seed}`);
    }
  }
});

test('advancing to a beat already reached changes nothing', () => {
  const flock = flockOf(1);
  flock.advanceTo(5);
  const there = copyOf(flock.phases);
  flock.advanceTo(5);
  flock.advanceTo(2);
  assert.deepEqual(copyOf(flock.phases), there);
});

test('changed rules count from the next step on', () => {
  const kept = flockOf(4);
  const changed = flockOf(4);
  kept.advanceTo(4);
  changed.advanceTo(4);
  changed.rules = { ...RULES, coupling: 1.2 };
  assert.deepEqual(copyOf(changed.phases), copyOf(kept.phases));
  kept.advanceTo(4.0625);
  changed.advanceTo(4.0625);
  assert.notDeepEqual(copyOf(changed.phases), copyOf(kept.phases));
  assert.equal(changed.rules.coupling, 1.2);
});
