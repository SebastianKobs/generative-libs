// Articulation (mockup/src/libs/generative/articulation/): a stroke's marks from a hand's qualities, their place,
// time, kind and intensity; a stroke made of a path; a throw swept along a shape the caller knows
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { USUAL_SPEED, articulate, carryOf, strokeOf, sweep } from '../index.ts';
import { seededRandomness } from '../../randomness/test/seeded-randomness.js';
import { near } from '../../../base/util/test/near.js';

const SEEDS = Array.from({ length: 60 }, (_, seed) => seed + 1);
const LINE_KINDS = new Set(['line', 'break']);

// a pour with a load that never runs out within the stroke (a load of 1 carries past its end)
const POUR = { gesture: 'pour', viscosity: 0.5, height: 0.5, speed: 0.5, load: 1 };
const handOf = (gesture, qualities = {}) => ({ ...POUR, gesture, ...qualities });

// a straight path along x: each stretch `step` long in `beats`; at USUAL_SPEED a beat, speed 1
const straightPath = (stretches) => {
  const path = [{ x: 0, y: 0, beat: 0 }];
  for (const { step, beats } of stretches) {
    const last = path.at(-1);
    path.push({ x: last.x + step, y: 0, beat: last.beat + beats });
  }
  return path;
};
const usualStretch = { step: USUAL_SPEED * 4, beats: 4 };
const usualPath = (count) => straightPath(Array.from({ length: count }, () => usualStretch));
// slow first (speed 0.5), then fast (speed 2)
const slowThenFast = straightPath([
  ...Array.from({ length: 8 }, () => ({ step: USUAL_SPEED * 0.5, beats: 1 })),
  ...Array.from({ length: 8 }, () => ({ step: USUAL_SPEED * 2, beats: 1 })),
]);
const allSlow = straightPath(Array.from({ length: 16 }, () => ({ step: USUAL_SPEED * 0.3, beats: 1 })));
const allFast = straightPath(Array.from({ length: 16 }, () => ({ step: USUAL_SPEED * 2, beats: 1 })));

const ofKind = (marks, kind) => marks.filter((mark) => mark.kind === kind);
const hasProgress = (mark) => mark.progress !== undefined;
// the flick of what's left once the load has run out is made apart from the gesture's own marks
const withoutRunOut = (marks) => marks.filter((mark) => !hasProgress(mark));
const lastLineAlong = (marks) =>
  Math.max(...marks.filter((mark) => LINE_KINDS.has(mark.kind)).map((mark) => mark.along));
const along = (mark) => mark.along;
const alongOfSamples = (stroke, keep) => stroke.filter(keep).map(along);

test('strokeOf() takes four samples a stretch, along from 0 to 1 by index; a straight path at the usual pace has speed 1', () => {
  const stroke = strokeOf(usualPath(3));
  assert.equal(stroke.length, 3 * 4 + 1);
  stroke.slice(0, -1).forEach((sample, index) => near(sample.along, index / 12, `${index}`, 1e-12));
  assert.equal(stroke.at(-1).along, 1);
  assert.equal(stroke[0].beat, 0);
  near(stroke[1].beat, 1, '', 1e-12);
  for (const sample of stroke) {
    near(sample.speed, 1, `${sample.speed}`, 1e-9);
    assert.ok(Math.abs(sample.y) < 1e-12);
  }
  assert.deepEqual(strokeOf([{ x: 0.2, y: 0.3, beat: 5 }]).map(along), [0]);
  assert.deepEqual(strokeOf([]), []);
});

test('articulate() gives the same marks for the same stroke, hand and randomness, whatever was drawn before', () => {
  const stroke = strokeOf(slowThenFast);
  for (const gesture of ['drip', 'pour', 'fling', 'splatter']) {
    const hand = handOf(gesture, { load: 0.5 });
    const marks = articulate(stroke, hand, seededRandomness(7));
    assert.ok(marks.length > 0, gesture);
    assert.deepEqual(articulate(stroke, hand, seededRandomness(7)), marks, gesture);
    const used = seededRandomness(7);
    used.next();
    used.fork('other').next();
    assert.deepEqual(articulate(stroke, hand, used), marks, `${gesture} after other draws`);
    assert.notDeepEqual(articulate(stroke, hand, seededRandomness(8)), marks, `${gesture}, another seed`);
  }
});

test('a stroke made to half way gives a prefix of the whole one, each mark the same', () => {
  const stroke = strokeOf(slowThenFast);
  for (const gesture of ['drip', 'pour', 'fling', 'splatter']) {
    const hand = handOf(gesture, { load: 0.5 });
    const whole = articulate(stroke, hand, seededRandomness(3));
    const half = articulate(stroke, hand, seededRandomness(3), { upTo: 0.5 });
    assert.ok(half.length > 0 && half.length < whole.length, gesture);
    assert.deepEqual(whole.slice(0, half.length), half, gesture);
  }
});

test('the load: intensity falls from 1 to 0.35 where it runs out; more load runs further', () => {
  const stroke = strokeOf(usualPath(20));
  const marks = articulate(stroke, handOf('pour', { load: 0.5, viscosity: 0 }), seededRandomness(1));
  const lines = marks.filter((mark) => LINE_KINDS.has(mark.kind));
  assert.ok(lines[0].intensity > 0.97, `${lines[0].intensity}`);
  for (let index = 1; index < lines.length; index++) {
    assert.ok(lines[index].intensity <= lines[index - 1].intensity, `${index}`);
  }
  near(lines.at(-1).intensity, 0.35, `${lines.at(-1).intensity}`, 0.02);
  near(lastLineAlong(marks), 0.85, `${lastLineAlong(marks)}`, 0.02);
  for (const load of [0, 0.5, 1]) {
    const run = articulate(stroke, handOf('pour', { load }), seededRandomness(1));
    near(lastLineAlong(run), Math.min(1, 0.55 + 0.6 * load), `load ${load}`, 0.02);
  }
});

test("the run-out's drip flick comes only once the stroke has come that far, then eases in", () => {
  const stroke = strokeOf(usualPath(20));
  const hand = handOf('pour', { load: 0.5 });
  const runOutOf = (upTo) => articulate(stroke, hand, seededRandomness(1), { upTo }).filter(hasProgress);
  assert.equal(runOutOf(0.5).length, 0);
  assert.equal(runOutOf(0.84).length, 0);
  const partway = runOutOf(0.9);
  assert.equal(partway.length, 1);
  assert.ok(partway[0].progress > 0 && partway[0].progress < 1, `${partway[0].progress}`);
  assert.equal(partway[0].manner, 'drip');
  const marks = articulate(stroke, hand, seededRandomness(1));
  const whole = marks.filter(hasProgress);
  assert.equal(whole.length, 1);
  assert.equal(whole[0].progress, 1);
  assert.equal(marks.at(-1), whole[0]);
});

test("a drip's beads come on every third sample, each after its line", () => {
  const stroke = strokeOf(usualPath(10));
  const marks = articulate(stroke, handOf('drip'), seededRandomness(2));
  assert.deepEqual(
    ofKind(marks, 'bead').map(along),
    alongOfSamples(stroke, (_, index) => index > 0 && index % 3 === 0),
  );
  assert.equal(ofKind(marks, 'line').length, stroke.length - 1);
  assert.equal(ofKind(marks, 'break').length, 0);
  assert.ok(ofKind(marks, 'line').every((mark) => mark.size === 0.4));
  const index = marks.findIndex((mark) => mark.kind === 'bead');
  assert.equal(marks[index - 1].kind, 'line');
  assert.equal(marks[index - 1].along, marks[index].along);
});

test("a splatter's marks are flicks and blots, on every other sample", () => {
  const stroke = strokeOf(usualPath(10));
  const marks = withoutRunOut(articulate(stroke, handOf('splatter'), seededRandomness(2)));
  const places = alongOfSamples(stroke, (_, index) => index > 0 && index % 2 === 0);
  assert.deepEqual(ofKind(marks, 'flick').map(along), places);
  assert.deepEqual(ofKind(marks, 'blot').map(along), places);
  assert.equal(marks.length, 2 * places.length);
  assert.ok(ofKind(marks, 'flick').every((mark) => mark.manner === 'splatter' && mark.count === 3));
});

test("a fling's flicks come only where the hand is fast", () => {
  const stroke = strokeOf(slowThenFast);
  const speedAt = (mark) => stroke.find((sample) => sample.along === mark.along).speed;
  const hand = handOf('fling');
  let flicks = 0;
  for (const seed of SEEDS) {
    const thrown = ofKind(withoutRunOut(articulate(stroke, hand, seededRandomness(seed))), 'flick');
    flicks += thrown.length;
    assert.ok(
      thrown.every((mark) => speedAt(mark) > 0.8),
      `seed ${seed}`,
    );
  }
  assert.ok(flicks > 0, 'the fast samples throw sometimes');
  const slow = SEEDS.flatMap((seed) =>
    ofKind(withoutRunOut(articulate(strokeOf(allSlow), hand, seededRandomness(seed))), 'flick'),
  );
  assert.equal(slow.length, 0);
});

test("a pour's pools come only where the hand is slow and the paint thick", () => {
  const stroke = strokeOf(slowThenFast);
  const slowSamples = alongOfSamples(stroke, (sample, index) => index > 0 && sample.speed < 0.6);
  assert.ok(slowSamples.length > 0 && slowSamples.length < stroke.length - 1);
  for (const seed of SEEDS) {
    const thick = articulate(stroke, handOf('pour', { viscosity: 1 }), seededRandomness(seed));
    assert.deepEqual(ofKind(thick, 'pool').map(along), slowSamples, `thick, seed ${seed}`);
    const thin = articulate(stroke, handOf('pour', { viscosity: 0 }), seededRandomness(seed));
    assert.equal(ofKind(thin, 'pool').length, 0, `thin, seed ${seed}`);
    const fast = articulate(strokeOf(allFast), handOf('pour', { viscosity: 1 }), seededRandomness(seed));
    assert.equal(ofKind(fast, 'pool').length, 0, `fast, seed ${seed}`);
  }
});

test("a landing's blot comes first, then the flick off it; none without a landing", () => {
  const stroke = strokeOf(usualPath(4));
  const hand = handOf('pour', { height: 1 });
  const landed = articulate(stroke, hand, seededRandomness(5), { landing: 1 });
  assert.equal(landed[0].kind, 'blot');
  assert.equal(landed[0].along, 0);
  assert.equal(landed[0].size, (1 + hand.height) * 1.2);
  assert.equal(landed[1].kind, 'flick');
  assert.equal(landed[1].manner, 'splatter');
  const bigger = articulate(stroke, hand, seededRandomness(5), { landing: 2 });
  assert.equal(bigger[0].size, 2 * landed[0].size);
  const none = articulate(stroke, hand, seededRandomness(5));
  assert.equal(ofKind(none, 'blot').length, 0);
  assert.deepEqual(landed.slice(2), none);
  assert.deepEqual(articulate([], hand, seededRandomness(5), { landing: 1 }), []);
});

test('sweep() makes the lines thin as they go and the flick only once the whole is made', () => {
  const hand = handOf('fling', { load: 0.5 });
  const marks = sweep(hand);
  const lines = ofKind(marks, 'line');
  assert.equal(lines.length, 14);
  assert.equal(marks.at(-1).kind, 'flick');
  assert.equal(marks.at(-1).along, 1);
  assert.equal(marks.at(-1).manner, 'fling');
  lines.forEach((line, index) => {
    near(line.from.along, index / 14, '', 1e-12);
    near(line.along, (index + 1) / 14, '', 1e-12);
    if (index === 0) {
      return;
    }
    assert.ok(line.intensity < lines[index - 1].intensity, `${index}`);
    assert.ok(line.weight < lines[index - 1].weight, `${index}`);
  });
  const partway = sweep(hand, { upTo: 0.5 });
  assert.ok(partway.every((mark) => mark.kind === 'line' && mark.from.along <= 0.5));
  assert.deepEqual(partway, lines.slice(0, partway.length));
  assert.equal(sweep(hand, { upTo: 0.99 }).at(-1).kind, 'line');
  assert.equal(ofKind(sweep(hand, { steps: 4 }), 'line').length, 4);
  assert.equal(sweep(handOf('drip'), { steps: 2 }).at(-1).manner, 'drip');
});

test("carryOf() grows with the hand's speed and its reach, the same for the same randomness", () => {
  const slow = handOf('fling', { speed: 0.2 });
  const quick = handOf('fling', { speed: 1.5 });
  for (const seed of SEEDS) {
    assert.ok(carryOf(quick, seededRandomness(seed)) > carryOf(slow, seededRandomness(seed)), `seed ${seed}`);
    const far = carryOf({ ...quick, reach: 2 }, seededRandomness(seed));
    near(far, 2 * carryOf(quick, seededRandomness(seed)), `reach, seed ${seed}`, 1e-12);
  }
  const used = seededRandomness(9);
  used.next();
  assert.equal(carryOf(quick, used), carryOf(quick, seededRandomness(9)));
  assert.notEqual(carryOf(quick, seededRandomness(1)), carryOf(quick, seededRandomness(2)));
});
