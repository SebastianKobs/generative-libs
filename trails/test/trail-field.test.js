// libs/generative/trails/trail-field.ts: one field of a slime mold's agents on a plane, food drawing them,
// seeds letting more loose; its traffic and the colors they lay, run forward in quanta
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAFFIC_GRID, TrailField } from '../index.ts';
import { seededRandomness } from '../../randomness/test/seeded-randomness.js';
import { near, isNear } from '../../../base/util/test/near.js';
import {
  FADED_AFTER,
  MANY,
  PASSING,
  QUANTA_A_BEAT,
  RED,
  RULES,
  SEEDS,
  SENSE,
  fieldOf,
  inOneGo,
  inSmallSteps,
  massIn,
  runThrough,
  sameTraffic,
  total,
} from './trails.js';

// what is told at each beat: [beat, 'food' | 'seed', x, y]
const TOLD = [
  [0, 'food', 0.2, 0.5],
  [0.5, 'food', 0.8, 0.5],
  [1, 'seed', 0.2, 0.5],
  [2, 'seed', 0.8, 0.5],
  [3.5, 'seed', 0.25, 0.52],
  [6, 'seed', 0.75, 0.48],
];

const AT_A = { x: 0.3, y: 0.5 };
const AT_B = { x: 0.6, y: 0.5 }; // 48 cells from A on the 160-cell field
const FAR_FROM_A = { x: 0.9, y: 0.5 }; // 96 cells: out of reach of any smell of its

// What draws agents to a food: its hearth's and its scent's strength and reach. Each row lets agents loose `offset` off
// the food and counts the traffic within `reach` of it, under the rules `fixed` and `weak` or `strong`.
const PULLS = [
  {
    rule: 'hearth strength',
    food: AT_A,
    offset: 0.04,
    reach: 0.04,
    fixed: { scent: 0 },
    weak: { hearth: 0 },
    strong: { hearth: 8 },
  },
  {
    rule: 'hearth reach',
    food: AT_A,
    offset: 0.09,
    reach: 0.04,
    fixed: { hearth: 8, scent: 0 },
    weak: { hearthReach: 3 },
    strong: { hearthReach: 16 },
  },
  {
    rule: 'scent strength',
    food: AT_B,
    offset: -0.12,
    reach: 0.05,
    fixed: { scentReach: 40 },
    weak: { scent: 0 },
    strong: { scent: 0.5 },
  },
  {
    rule: 'scent reach',
    food: AT_B,
    offset: -0.25,
    reach: 0.05,
    fixed: { scent: 1 },
    weak: { scentReach: 5 },
    strong: { scentReach: 40 },
  },
];

const LET_GO = { ...SENSE, lifetime: 4 };
const STARVING = { ...SENSE, hearth: 6, hearthReach: 6, starveAfter: 4 };

const COARSER_GRIDS = [80, 120];
const TINT_GRIDS = [...COARSER_GRIDS, TrailField.grid];

// Glow's mould: its genes and lifetimes, under which threads ring a quiet food rather than run into it
const GLOWING = {
  sense: 7,
  sensorAngle: 0.6,
  turn: 0.35,
  fade: 0.965,
  perSeed: 3,
  scent: 0.25,
  scentReach: 40,
  hearth: 6,
  hearthReach: 6,
  lifetime: 96,
  scouts: 0.2,
  scoutLifetime: 32,
  tintReach: 40,
  starveAfter: 96,
};
// two busy foods, and a quiet one off the line between them, 13 cells from it; each seeded every beat, the quiet one with one agent
const BUSY = [
  { x: 0.25, y: 0.5, agents: 3, tint: [1, 0, 0] },
  { x: 0.75, y: 0.5, agents: 3, tint: [0, 0, 1] },
];
const QUIET = { x: 0.5, y: 0.42, agents: 1, tint: [0, 1, 0] };

// the rules' effect over several randomnesses, summed: the traffic in a box on the plane after `beats`, with what was told first
function massAfter(rules, { told, beats, box }) {
  let mass = 0;
  for (const seed of SEEDS) {
    const field = fieldOf(seed, rules);
    told(field);
    field.advanceTo(beats);
    mass += massIn(field.traffic, box);
  }
  return mass;
}

function around({ x, y }, reach) {
  return { x0: x - reach, x1: x + reach, y0: y - reach, y1: y + reach };
}

function totalAfter(rules, told, beats) {
  const field = fieldOf(1, rules);
  told(field);
  field.advanceTo(beats);
  return total(field.traffic);
}

function isClear(field) {
  return total(field.traffic) === 0 && field.tints.weight.every((weight) => weight === 0);
}

// the traffic summed over several randomnesses, 1.5 beats after a seed (3 quanta) and 4 beats later (8 more)
function trafficEarlyAndLate(rules, withFood) {
  let early = 0;
  let late = 0;
  for (const seed of SEEDS) {
    const field = fieldOf(seed, rules);
    if (withFood) {
      field.food(0.5, 0.5);
    }
    field.seed(0.5, 0.5);
    field.advanceTo(1.5);
    early += total(field.traffic);
    field.advanceTo(5.5);
    late += total(field.traffic);
  }
  return { early, late };
}

// a field's colors after a few quanta of a seed every beat at its middle, diffused `tintPasses` times a quantum, on a grid
// `tintGrid` cells a side
function colorsOf(tintPasses, tintGrid) {
  const field = fieldOf(3, { ...SENSE, tintPasses, tintGrid });
  for (let beat = 0; beat < 6; beat++) {
    field.seed(0.5, 0.5, RED);
    field.advanceTo(beat + 1);
  }
  return field.tints.weight;
}

// how much color was laid, and how far it lies from where it was laid, on average (the root of its second moment),
// both in the field's cells, whatever the colors' grid
function weightAndSpread(weight) {
  const grid = TrailField.grid;
  const side = Math.sqrt(weight.length);
  const cellWidth = grid / side;
  let mass = 0;
  let moment = 0;
  weight.forEach((value, cell) => {
    const dx = ((cell % side) + 0.5) * cellWidth - grid / 2;
    const dy = (Math.floor(cell / side) + 0.5) * cellWidth - grid / 2;
    mass += value * cellWidth ** 2;
    moment += value * cellWidth ** 2 * (dx * dx + dy * dy);
  });
  return { mass, spread: Math.sqrt(moment / mass) };
}

// the mean of `cells`, a grid `side` cells a side over the plane, by distance from `at`, in the field's cells: within each band
function meanByDistance(cells, at, bands) {
  const side = Math.sqrt(cells.length);
  const perFieldCell = side / TrailField.grid;
  const sums = bands.map(() => 0);
  const counts = bands.map(() => 0);
  cells.forEach((value, cell) => {
    const across = ((cell % side) + 0.5) / perFieldCell - at.x * TrailField.grid;
    const down = (Math.floor(cell / side) + 0.5) / perFieldCell - at.y * TrailField.grid;
    const distance = Math.hypot(across, down);
    const band = bands.findIndex(([from, to]) => distance >= from && distance < to);
    if (band >= 0) {
      sums[band] += value;
      counts[band]++;
    }
  });
  return sums.map((sum, band) => sum / counts[band]);
}

// the three foods run for 60 beats under `rules`
function plantsRun(rules, seed) {
  const field = fieldOf(seed, { ...GLOWING, ...rules });
  const plants = [...BUSY, QUIET];
  for (const { x, y } of plants) {
    field.food(x, y);
  }
  for (let beat = 0; beat < 60; beat++) {
    for (const { x, y, tint, agents } of plants) {
      field.seed(x, y, tint, agents);
    }
    field.advanceTo(beat + 1);
  }
  return field;
}

// the traffic round the quiet food, summed over `seeds`: at its centre (2 cells), on a ring round it (2 to 4), the ring's outside
// (4 to 6) and beyond its hearth (8 to 20)
function trafficRoundQuiet(rules, seeds = SEEDS.slice(0, 3)) {
  const bands = [
    [0, 2],
    [2, 4],
    [4, 6],
    [8, 20],
  ];
  const summed = [0, 0, 0, 0];
  for (const seed of seeds) {
    meanByDistance(plantsRun(rules, seed).traffic, QUIET, bands).forEach((mean, band) => (summed[band] += mean));
  }
  const [centre, ring, ringOutside, beyond] = summed;
  return { centre, ring, ringOutside, beyond };
}

// the share of the weight laid in each plant's own channel round it, at 0 to 8 cells and 24 to 40, over three randomnesses
function ownColorRound(rules) {
  const bands = [
    [0, 8],
    [24, 40],
  ];
  const own = { near: 0, far: 0 };
  const weights = { near: 0, far: 0 };
  for (const seed of SEEDS.slice(0, 3)) {
    const { green, weight } = plantsRun({ tintGrid: 80, ...rules }, seed).tints;
    const [greenNear, greenFar] = meanByDistance(green, QUIET, bands);
    const [weightNear, weightFar] = meanByDistance(weight, QUIET, bands);
    own.near += greenNear;
    own.far += greenFar;
    weights.near += weightNear;
    weights.far += weightFar;
  }
  return { near: own.near / weights.near, far: own.far / weights.far, weightFar: weights.far };
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
  const massNear = massIn(field.traffic, { x0: 0.15, x1: 0.45, y0: 0.45, y1: 0.75 });
  assert.ok(massNear > 0);
  assert.ok(massNear > 0.9 * total(field.traffic), 'agents let loose there have stayed near it');
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

test('a field with nothing loose skips its idle quanta: late, it runs as a fresh one does from its first event', () => {
  const late = fieldOf(1);
  const before = performance.now();
  late.advanceTo(2000);
  assert.ok(performance.now() - before < 500, 'a quantum with no agent costs nothing');
  assert.equal(late.quanta, 4000);
  const fresh = fieldOf(1);
  for (const field of [late, fresh]) {
    field.food(0.2, 0.5);
    field.seed(0.2, 0.5);
  }
  late.advanceTo(2004);
  fresh.advanceTo(4);
  assert.ok(total(fresh.traffic) > 0);
  assert.ok(sameTraffic(late.traffic, fresh.traffic));
});

test('a food taken away no longer draws agents: its hearth is gone with it', () => {
  const nearA = around(AT_A, 0.04);
  const mass = (told) =>
    massAfter(
      { ...SENSE, hearth: 8, scent: 0 },
      {
        told: (field) => {
          told(field);
          field.seed(AT_A.x + 0.04, AT_A.y);
        },
        beats: 20,
        box: nearA,
      },
    );
  const kept = mass((field) => field.food(AT_A.x, AT_A.y));
  const gone = mass((field) => {
    field.food(AT_A.x, AT_A.y);
    field.foodGone(AT_A.x, AT_A.y);
  });
  assert.ok(gone < 0.5 * kept, `gone ${gone}, kept ${kept}`);
});

test('taking away a food never laid leaves the field as it was: a cell is never below none', () => {
  const field = fieldOf(1, SENSE);
  const control = fieldOf(1, SENSE);
  field.foodGone(AT_A.x, AT_A.y);
  for (const each of [field, control]) {
    each.seed(AT_A.x, AT_A.y);
  }
  field.advanceTo(10);
  control.advanceTo(10);
  assert.ok(sameTraffic(field.traffic, control.traffic));
});

test('a stronger or wider hearth or scent draws more of the traffic to the food agents were let loose off', () => {
  for (const { rule, food, offset, reach, fixed, weak, strong } of PULLS) {
    const mass = (varied) =>
      massAfter(
        { ...SENSE, ...fixed, ...varied },
        {
          told: (field) => {
            field.food(food.x, food.y);
            field.seed(food.x + offset, food.y);
          },
          beats: 20,
          box: around(food, reach),
        },
      );
    const weakMass = mass(weak);
    const strongMass = mass(strong);
    assert.ok(strongMass > 1.5 * weakMass, `${rule}: strong ${strongMass}, weak ${weakMass}`);
  }
});

test('an agent is let go after its lifetime in quanta: its traffic only fades after, where unlimited agents go on laying', () => {
  const told = (field) => field.seed(0.5, 0.5);
  const traffic = (lifetime) => {
    const field = fieldOf(1, { ...SENSE, lifetime });
    told(field);
    field.advanceTo(3); // 6 quanta, the agents let go after 4
    const early = total(field.traffic);
    field.advanceTo(7); // 8 quanta more
    return { early, late: total(field.traffic) };
  };
  const limited = traffic(4);
  const unlimited = traffic(undefined);
  assert.ok(limited.late < 0.5 * limited.early, `limited ${limited.early} then ${limited.late}`);
  assert.ok(unlimited.late > 0.5 * unlimited.early, `unlimited ${unlimited.early} then ${unlimited.late}`);
});

test('a scout let loose beside only its own food smells nothing to walk to and lays almost no traffic', () => {
  const told = (field) => {
    field.food(AT_A.x, AT_A.y);
    field.seed(AT_A.x, AT_A.y);
  };
  const scouts = totalAfter({ ...SENSE, scouts: 1 }, told, 10);
  const others = totalAfter({ ...SENSE, scouts: 0 }, told, 10);
  assert.ok(scouts < 0.2 * others, `scouts ${scouts}, agents that are not ${others}`);
});

test('a scout lays its trail only where it smells another food: little while none is near', () => {
  const told = (other) => (field) => {
    field.food(AT_A.x, AT_A.y);
    field.food(other.x, other.y);
    field.seed(AT_A.x, AT_A.y);
  };
  const rules = { ...SENSE, scouts: 1 };
  const farOther = totalAfter(rules, told(FAR_FROM_A), 10);
  const nearOther = totalAfter(rules, told(AT_B), 10);
  assert.ok(nearOther > 3 * farOther, `near ${nearOther}, far ${farOther}`);
});

test('a scout walks to a food nearby: most of its traffic is round the other food', () => {
  let nearOther = 0;
  let everywhere = 0;
  for (const seed of SEEDS) {
    const field = fieldOf(seed, { ...SENSE, scouts: 1 });
    field.food(AT_A.x, AT_A.y);
    field.food(AT_B.x, AT_B.y);
    field.seed(AT_A.x, AT_A.y);
    field.advanceTo(20);
    nearOther += massIn(field.traffic, around(AT_B, 0.04));
    everywhere += total(field.traffic);
  }
  assert.ok(nearOther > 0.5 * everywhere, `near ${nearOther} of ${everywhere}`);
});

test('a scout runs its own lifetime, and the rules lifetime where none is said', () => {
  const told = (field) => {
    field.food(AT_A.x, AT_A.y);
    field.food(AT_B.x, AT_B.y);
    field.seed(AT_A.x, AT_A.y);
  };
  const lateTraffic = (rules) => {
    const field = fieldOf(1, { ...SENSE, scouts: 1, ...rules });
    told(field);
    field.advanceTo(40);
    return Array.from(field.traffic);
  };
  const shortScouts = lateTraffic({ scoutLifetime: 2 });
  const longScouts = lateTraffic({});
  const shortAll = lateTraffic({ lifetime: 2 });
  assert.ok(total(shortScouts) < 0.2 * total(longScouts), 'a short scout lifetime lets them go early');
  assert.ok(sameTraffic(shortAll, shortScouts), 'scouts have the lifetime where scoutLifetime is not said');
});

test('a seed with a color lays it with its trail, and a seed without lays none', () => {
  const tinted = fieldOf(1, SENSE);
  const plain = fieldOf(1, SENSE);
  tinted.seed(0.5, 0.5, RED);
  plain.seed(0.5, 0.5);
  tinted.advanceTo(6);
  plain.advanceTo(6);
  const { weight, red: sumRed, green: sumGreen, blue: sumBlue } = tinted.tints;
  const laid = Array.from(weight.keys()).filter((cell) => weight[cell] > 1e-3);
  assert.ok(laid.length > 0);
  for (const cell of laid) {
    const colorOfCell = [sumRed[cell], sumGreen[cell], sumBlue[cell]].map((sum) => sum / weight[cell]);
    colorOfCell.forEach((channel, index) => near(channel, RED[index], `cell ${cell}`, 1e-3));
  }
  assert.equal(
    plain.tints.weight.every((value) => value === 0),
    true,
  );
  assert.ok(sameTraffic(tinted.traffic, plain.traffic), 'a color changes no trail');
});

test("an agent's color counts less the farther it is from where it was let loose, to 1/e at tintReach", () => {
  const laidWeight = (tintReach) => {
    const field = fieldOf(1, { ...SENSE, tintReach });
    field.seed(0.5, 0.5, [1, 1, 1]);
    field.advanceTo(20);
    return { weight: field.tints.weight.reduce((sum, value) => sum + value, 0), traffic: field.traffic };
  };
  const everywhere = laidWeight(undefined);
  const laidNear = laidWeight(4);
  assert.ok(laidNear.weight < 0.5 * everywhere.weight, `near ${laidNear.weight}, everywhere ${everywhere.weight}`);
  assert.ok(sameTraffic(laidNear.traffic, everywhere.traffic), 'the reach changes no trail');
});

test("a seed's own agents count overrides perSeed, even to none; changed rules count from the next quantum on", () => {
  const some = fieldOf(1, { ...RULES, perSeed: 0 });
  some.seed(0.5, 0.5, undefined, 3);
  some.advanceTo(4);
  assert.ok(total(some.traffic) > 0, 'more than perSeed');
  const none = fieldOf(1, { ...RULES, perSeed: 3 });
  none.seed(0.5, 0.5, undefined, 0);
  none.advanceTo(4);
  assert.equal(total(none.traffic), 0, 'fewer than perSeed');
  const changed = fieldOf(1, { ...RULES, perSeed: 0 });
  changed.seed(0.5, 0.5);
  changed.advanceTo(4);
  assert.equal(total(changed.traffic), 0, 'perSeed 0 lets none loose');
  changed.rules = { ...RULES, perSeed: 3 };
  assert.equal(changed.rules.perSeed, 3);
  changed.seed(0.5, 0.5);
  changed.advanceTo(8);
  assert.ok(total(changed.traffic) > 0, 'perSeed 3 from the next quantum on');
});

test("with edges 'pass' an agent stepping past the plane is let go and kept with its place, heading, home, age, scout and color", () => {
  const field = new TrailField(PASSING, seededRandomness(1));
  field.seed(0.999, 0.5, RED);
  field.advanceTo(2);
  assert.ok(field.leavers.length > 0);
  for (const leaver of field.leavers) {
    assert.ok(leaver.x < 0 || leaver.x >= 1 || leaver.y < 0 || leaver.y >= 1, 'it stands past the plane');
    assert.ok(leaver.x > -0.05 && leaver.x < 1.05 && leaver.y > -0.05 && leaver.y < 1.05, 'one step past');
    assert.deepEqual(leaver.tint, RED.map(Math.fround)); // kept as the field keeps it, in 32 bits
    assert.equal(leaver.scout, false);
    assert.ok(isNear(leaver.homeX, 0.999, 0.02) && isNear(leaver.homeY, 0.5, 0.02), 'its home kept');
    assert.ok(Number.isFinite(leaver.heading) && leaver.age >= 0);
  }
  field.clearLeavers();
  assert.equal(field.leavers.length, 0);
});

test("'turn' is what a field does if edges isn't said: its agents never leave, and the traffic is the same as where it's said", () => {
  const unsaid = fieldOf(1, SENSE);
  const turning = fieldOf(1, { ...SENSE, edges: 'turn' });
  for (const field of [unsaid, turning]) {
    field.seed(0.999, 0.5);
    field.advanceTo(8);
    assert.equal(field.leavers.length, 0);
  }
  assert.ok(total(unsaid.traffic) > 0);
  assert.ok(sameTraffic(unsaid.traffic, turning.traffic));
});

test('the agents loose: none for food alone, perSeed for a seed once a quantum has run, those let go still counted', () => {
  const field = fieldOf(1, { ...RULES, lifetime: 2 });
  assert.equal(field.agentsLoose, 0);
  field.food(0.3, 0.6);
  field.advanceTo(2);
  assert.equal(field.agentsLoose, 0, 'food alone lets none loose');
  field.seed(0.3, 0.6);
  assert.equal(field.agentsLoose, 0, 'a seed told is run in the next quantum');
  field.advanceTo(2.5);
  assert.equal(field.agentsLoose, RULES.perSeed);
  field.advanceTo(40);
  assert.equal(field.agentsLoose, RULES.perSeed, 'past their lifetime, they were still let loose here');
});

test('a field whose agents are all let go and whose traces have faded is idle: its traffic and colors cleared, its quanta skipped', () => {
  const field = fieldOf(1, LET_GO);
  field.seed(0.5, 0.5, [1, 0.5, 0.2]);
  assert.equal(field.idle, false, 'a seed is told');
  field.advanceTo(3);
  assert.equal(field.idle, false, 'agents running');
  field.advanceTo(FADED_AFTER);
  assert.equal(field.idle, true);
  assert.ok(isClear(field), 'traffic and colors all 0');
  assert.equal(field.quanta, FADED_AFTER * QUANTA_A_BEAT);
  field.advanceTo(5000); // as many idle quanta as the first test's field skips, within its one time budget
  assert.equal(field.quanta, 10000);
});

test('without a lifetime an agent is never let go: the field is never idle', () => {
  const field = fieldOf(1, SENSE);
  field.seed(0.5, 0.5);
  field.advanceTo(FADED_AFTER);
  assert.equal(field.idle, false);
  assert.ok(total(field.traffic) > 0);
});

test('an idle field is woken by a seed, a food or an arriving agent, and runs again', () => {
  const field = fieldOf(1, LET_GO);
  field.seed(0.5, 0.5);
  field.advanceTo(FADED_AFTER);
  assert.equal(field.idle, true);
  field.seed(0.5, 0.5);
  assert.equal(field.idle, false);
  field.advanceTo(FADED_AFTER + 1);
  assert.ok(total(field.traffic) > 0, 'its new agents ran');
  field.advanceTo(2 * FADED_AFTER);
  assert.equal(field.idle, true);
  field.food(0.3, 0.3);
  assert.equal(field.idle, false, 'a food told');
});

test('the food laid stays through an idle stretch: a seed after it still finds its hearth', () => {
  const rules = { ...LET_GO, hearth: 3, hearthReach: 10 };
  const mass = (idleFirst) => {
    let massNear = 0;
    for (const seed of SEEDS) {
      const field = fieldOf(seed, rules);
      field.food(AT_A.x, AT_A.y);
      field.seed(0.9, 0.9, undefined, 1); // lets an agent loose, then the field goes idle
      field.advanceTo(idleFirst ? FADED_AFTER : 1);
      field.seed(AT_A.x, AT_A.y);
      field.advanceTo((idleFirst ? FADED_AFTER : 1) + 3);
      massNear += massIn(field.traffic, around(AT_A, 0.15));
    }
    return massNear;
  };
  const afterIdle = mass(true);
  const withoutIdle = mass(false);
  assert.ok(afterIdle > 0.5 * withoutIdle, `after idle ${afterIdle}, without ${withoutIdle}`);
});

test('the same events at the same beats give the same traffic whether the field went idle between them or not, in one go or in small steps', () => {
  const told = [
    [0, 'seed', 0.3, 0.5],
    [FADED_AFTER, 'seed', 0.6, 0.5],
    [FADED_AFTER + 2, 'seed', 0.5, 0.4],
  ];
  const oneGo = runThrough(fieldOf(1, LET_GO), told, inOneGo);
  const small = runThrough(fieldOf(1, LET_GO), told, inSmallSteps);
  oneGo.advanceTo(FADED_AFTER + 6);
  small.advanceTo(FADED_AFTER + 6);
  assert.ok(total(oneGo.traffic) > 0);
  assert.ok(sameTraffic(oneGo.traffic, small.traffic));
  assert.equal(oneGo.quanta, small.quanta);
});

test("a cell on the plane's border fades as every other cell does, the trail's and the color's", () => {
  const field = fieldOf(1, { ...LET_GO, edges: 'pass' });
  const seen = [];
  // an agent let loose on the edge itself lays on a border cell before it turns away
  field.seed(0.001, 0.5, [1, 0.5, 0.2], 3);
  field.advanceTo(1);
  const weight = field.tints.weight;
  const borderWeight = () =>
    weight
      .filter((_, cell) => cell % 160 === 0 || cell % 160 === 159 || cell < 160 || cell >= 159 * 160)
      .reduce((sum, value) => sum + value, 0);
  seen.push(borderWeight());
  field.advanceTo(FADED_AFTER);
  seen.push(borderWeight());
  assert.ok(seen[0] > 0, 'something was laid on the border');
  assert.equal(seen[1], 0, `the border's color faded: ${seen.join(', ')}`);
  assert.equal(field.idle, true);
});

test('an agent with no food in reach is let go after starveAfter quanta: its traffic fades after; not said, it runs on', () => {
  const starving = trafficEarlyAndLate(STARVING, false);
  const unsaid = trafficEarlyAndLate({ ...STARVING, starveAfter: undefined }, false);
  assert.ok(starving.late < 0.5 * starving.early, `starving ${starving.early} then ${starving.late}`);
  assert.ok(unsaid.late > 0.5 * unsaid.early, `never starving ${unsaid.early} then ${unsaid.late}`);
});

test("an agent standing in a food's hearth is fed again: let loose on a food, its traffic runs on past starveAfter", () => {
  const fed = trafficEarlyAndLate(STARVING, true);
  const unfed = trafficEarlyAndLate(STARVING, false);
  assert.ok(fed.late > 0.5 * fed.early, `fed ${fed.early} then ${fed.late}`);
  assert.ok(fed.late > 3 * unfed.late, `fed ${fed.late}, unfed ${unfed.late}`);
});

test('the quanta since its last food go with an agent across a seam: one arriving starved is let go, one fed runs on', () => {
  const leaving = new TrailField(PASSING, seededRandomness(1));
  leaving.seed(0.999, 0.5);
  leaving.advanceTo(2);
  assert.ok(leaving.leavers.length > 0);
  for (const leaver of leaving.leavers) {
    assert.equal(leaver.sinceFood, leaver.age, 'no food on the way: as long since food as since it was let loose');
  }
  const afterArriving = (sinceFood) => {
    const field = new TrailField(STARVING, seededRandomness(1));
    field.arrive({ x: 0.5, y: 0.5, heading: 0, homeX: 0.2, homeY: 0.5, age: 1, sinceFood, scout: false });
    field.advanceTo(2);
    return total(field.traffic);
  };
  const starved = afterArriving(10);
  const fed = afterArriving(0);
  assert.ok(starved < 0.2 * fed, `arriving starved, it walks no further: ${starved}, fed ${fed}`);
});

test("a sensor past the plane smells what the field beyond smells there, in that field's own cells; a scout with its home there", () => {
  const asked = [];
  const beyond = {
    has: () => true,
    smellAt: (across, down, place, home) => {
      asked.push({ across, down, place, home });
      return 0;
    },
  };
  const arrive = (field, scout) =>
    field.arrive({ x: 0.995, y: 0.5, heading: 0, homeX: 0.9, homeY: 0.5, age: 0, scout });
  const walker = new TrailField(PASSING, seededRandomness(1), beyond);
  arrive(walker, false);
  walker.advanceTo(0.5);
  const past = asked.find(({ across }) => across === 1);
  assert.ok(past, 'asked what lies beyond the right side');
  assert.equal(past.down, 0);
  assert.ok(past.place.x >= 0 && past.place.x < 10, `in the neighbour's cells: ${past.place.x}`);
  assert.equal(past.home, undefined, 'a walker has no home to leave out');
  asked.length = 0;
  const scout = new TrailField(PASSING, seededRandomness(1), beyond);
  arrive(scout, true);
  scout.advanceTo(0.5);
  const scoutPast = asked.find(({ across }) => across === 1);
  near(scoutPast.home.x, 0.9 * 160 - 160, `its home in the neighbour's cells: ${scoutPast.home.x}`, 1e-3);
});

test('what the field beyond smells is its trail and food; a scout leaves out its own home', () => {
  const field = fieldOf(1, PASSING);
  field.food(0.5, 0.5);
  field.advanceTo(0.5);
  const centre = { x: 80, y: 80 };
  assert.ok(field.smellAt(centre) > 0, 'food smelled');
  assert.ok(field.smellAt(centre, centre) < 1e-6, 'a scout at its own home smells none of it');
  assert.equal(field.smellAt({ x: -3, y: 80 }), 0, 'nothing past its own plane');
});

test('with no field beyond a side, nothing is asked of it and an agent turns away', () => {
  let asked = 0;
  const beyond = {
    has: () => false,
    smellAt: () => {
      asked++;
      return 1;
    },
  };
  const field = new TrailField(PASSING, seededRandomness(1), beyond);
  field.seed(0.999, 0.5, undefined, 6);
  field.advanceTo(3);
  assert.equal(asked, 0);
  assert.equal(field.leavers.length, 0);
});

test('a sensor past the plane still smells a field that does not take agents, and the agent turns away', () => {
  let asked = 0;
  const beyond = {
    has: () => true,
    takes: () => false,
    smellAt: () => {
      asked++;
      return 0;
    },
  };
  const field = new TrailField(PASSING, seededRandomness(1), beyond);
  field.seed(0.999, 0.5, undefined, 6);
  field.advanceTo(3);
  assert.ok(asked > 0, 'asked what it smells');
  assert.equal(field.leavers.length, 0);
});

test('the live agents: those the last step moved, none once they are let go; the strongest traffic, none once cleared', () => {
  const field = fieldOf(1, LET_GO);
  assert.equal(field.liveAgents, 0);
  assert.equal(field.strongestTraffic, 0);
  field.seed(0.5, 0.5);
  field.advanceTo(2);
  assert.equal(field.liveAgents, MANY, 'every agent let loose is running');
  assert.ok(field.strongestTraffic > 0);
  assert.equal(
    field.strongestTraffic,
    field.traffic.reduce((most, value) => Math.max(most, value), 0),
    'the strongest cell of its traffic',
  );
  field.advanceTo(FADED_AFTER);
  assert.equal(field.liveAgents, 0);
  assert.equal(field.strongestTraffic, 0);
});

test('the colors diffused once a quantum weigh about as much and spread about as far as diffused at every step', () => {
  const once = weightAndSpread(colorsOf(1));
  const everyStep = weightAndSpread(colorsOf(4));
  near(once.mass / everyStep.mass, 1, `weight ${once.mass} against ${everyStep.mass}`, 0.1);
  near(once.spread / everyStep.spread, 1, `spread ${once.spread} against ${everyStep.spread}`, 0.1);
});

test('the passes not said are one a step: the same colors as four passes said, and not those of one a quantum', () => {
  assert.ok(sameTraffic(colorsOf(undefined), colorsOf(4)));
  assert.ok(!sameTraffic(colorsOf(1), colorsOf(4)), 'the passes are taken');
});

test("the colors lie on the rules' grid, tintGrid cells a side; the field's if not said", () => {
  const field = fieldOf(3, { ...SENSE, tintGrid: 120 });
  assert.equal(field.tintGrid, 120);
  assert.equal(field.tints.weight.length, 120 * 120);
  assert.equal(fieldOf(3, SENSE).tintGrid, TrailField.grid);
  assert.equal(colorsOf(1).length, TrailField.grid ** 2);
});

test("the colors on a coarser grid weigh as much and spread as far as on the field's, in the field's cells", () => {
  for (const tintPasses of [1, 4]) {
    const onFieldsGrid = weightAndSpread(colorsOf(tintPasses, TrailField.grid));
    for (const tintGrid of COARSER_GRIDS) {
      const { mass, spread } = weightAndSpread(colorsOf(tintPasses, tintGrid));
      const which = `grid ${tintGrid}, passes ${tintPasses}`;
      near(mass / onFieldsGrid.mass, 1, `${which}: weight ${mass} against ${onFieldsGrid.mass}`, 0.1);
      near(spread / onFieldsGrid.spread, 1, `${which}: spread ${spread} against ${onFieldsGrid.spread}`, 0.1);
    }
  }
});

test("the colors blur as far a quantum on any grid as on the field's: a variance of 4 × 0.015 field cells² a step", () => {
  // the agents gone after 2 quanta, the colors only blur and fade: what's added to their spread squared is the blur's
  for (const tintGrid of TINT_GRIDS) {
    for (const tintPasses of [1, 4]) {
      const field = fieldOf(3, { ...SENSE, tintPasses, tintGrid, lifetime: 2 });
      field.seed(0.5, 0.5, RED);
      field.advanceTo(2); // 4 quanta of half a beat
      const early = weightAndSpread(field.tints.weight).spread;
      field.advanceTo(12);
      const late = weightAndSpread(field.tints.weight).spread;
      const added = late ** 2 - early ** 2;
      const expected = 20 * 4 * 4 * 0.015; // quanta × steps × 4 neighbours × each one's share
      const which = `grid ${tintGrid}, passes ${tintPasses}`;
      near(added / expected, 1, `${which}: ${added} cells² added, ${expected} expected`, 0.1);
    }
  }
});

test('the colors carried onto a new grid as the rules change it: the same weight and spread, no flash', () => {
  const field = fieldOf(3, { ...SENSE, tintPasses: 1 });
  for (let beat = 0; beat < 6; beat++) {
    field.seed(0.5, 0.5, RED);
    field.advanceTo(beat + 1);
  }
  const before = weightAndSpread(field.tints.weight);
  field.rules = { ...SENSE, tintPasses: 1, tintGrid: 80 };
  assert.equal(field.tintGrid, 80);
  assert.equal(field.tints.weight.length, 80 * 80);
  // each new cell takes the old one under its middle, not their average: a few percent off where the threads are fine
  const after = weightAndSpread(field.tints.weight);
  near(after.mass / before.mass, 1, `weight ${after.mass} against ${before.mass}`, 0.05);
  near(after.spread / before.spread, 1, `spread ${after.spread} against ${before.spread}`, 0.05);
  field.advanceTo(8);
  assert.ok(weightAndSpread(field.tints.weight).mass > 0, 'running on, on the new grid');
});

test("an agent's sensors close in by senseInHearth at a food's centre: the traffic round a quiet food peaks at its centre, not on a ring", () => {
  const open = trafficRoundQuiet({});
  assert.ok(open.ring > 0.9 * open.centre, `open: ring ${open.ring}, centre ${open.centre}`);
  const closing = trafficRoundQuiet({ senseInHearth: 0.7 });
  assert.ok(closing.ring < 0.75 * closing.centre, `closing: ring ${closing.ring}, centre ${closing.centre}`);
});

test("an agent passing within turnBackWithin cells of a food's centre turns back there: the ring thins, and agents still leave", () => {
  // over six randomnesses, and the ring 2 to 6 cells: over three, one ran as many round the centre either way
  const passing = trafficRoundQuiet({ senseInHearth: 0.7 }, SEEDS);
  const turning = trafficRoundQuiet({ senseInHearth: 0.7, turnBackWithin: 3 }, SEEDS);
  const ringShare = ({ centre, ring, ringOutside }) => (ring + ringOutside) / centre;
  assert.ok(
    ringShare(turning) < 0.85 * ringShare(passing),
    `turning ${ringShare(turning)}, passing ${ringShare(passing)}`,
  );
  assert.ok(turning.beyond > 0.5 * passing.beyond, `beyond: turning ${turning.beyond}, passing ${passing.beyond}`);
});

test('a turn back changes nothing where the rules leave it out, and the senses close in on no food', () => {
  const traffic = (rules) => {
    const run = fieldOf(1, { ...SENSE, ...rules });
    run.seed(0.5, 0.5);
    run.advanceTo(10);
    return run.traffic;
  };
  assert.ok(
    sameTraffic(traffic({}), traffic({ senseInHearth: 0.7, turnBackWithin: 3 })),
    'no food: the same traffic as with neither',
  );
});

test("an agent's color counts tintGuard times within tintGuardReach of where it was let loose: a quiet plant's own color holds", () => {
  const open = ownColorRound({});
  const guarded = ownColorRound({ tintGuard: 8, tintGuardReach: 10 });
  assert.ok(guarded.near > 1.8 * open.near, `near: guarded ${guarded.near}, open ${open.near}`);
  assert.ok(
    guarded.weightFar > 0.8 * open.weightFar,
    `the weight far off kept: ${guarded.weightFar}, ${open.weightFar}`,
  );
});

test('a guard changes no trail, and none is a guard of 1', () => {
  const run = (rules) => {
    const field = fieldOf(1, { ...SENSE, ...rules });
    field.seed(0.5, 0.5, RED);
    field.advanceTo(10);
    return field;
  };
  const open = run({});
  const guarded = run({ tintGuard: 8, tintGuardReach: 10 });
  assert.ok(sameTraffic(open.traffic, guarded.traffic));
  assert.ok(sameTraffic(open.tints.weight, run({ tintGuard: 1, tintGuardReach: 10 }).tints.weight));
});
