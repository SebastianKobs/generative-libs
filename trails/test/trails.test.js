// Trails (mockup/src/libs/generative/trails/): a slime mould's agents on a field, food drawing them, seeds letting more loose
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAFFIC_GRID, TrailField, TrailTiles } from '../index.ts';
import { Traffic } from '../traffic.ts';
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

// ---------- the rules a tuning pass added: food's shape, lifetimes, scouts, tints ----------

const AT_A = { x: 0.3, y: 0.5 };
const AT_B = { x: 0.6, y: 0.5 }; // 48 cells from A on the 160-cell field
const FAR_FROM_A = { x: 0.9, y: 0.5 }; // 96 cells: out of reach of any smell of its
const MANY = 6; // agents a test seed lets loose, enough that a chance run doesn't decide
const SENSE = { ...RULES, perSeed: MANY };
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
const around = ({ x, y }, reach) => ({ x0: x - reach, x1: x + reach, y0: y - reach, y1: y + reach });
const totalAfter = (rules, told, beats) => {
  const field = fieldOf(1, rules);
  told(field);
  field.advanceTo(beats);
  return total(field.traffic);
};

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

test('a stronger hearth draws more of the traffic to the food it was let loose beside', () => {
  const near = around(AT_A, 0.04);
  const mass = (hearth) =>
    massAfter(
      { ...SENSE, hearth, scent: 0 },
      {
        told: (field) => {
          field.food(AT_A.x, AT_A.y);
          field.seed(AT_A.x + 0.04, AT_A.y);
        },
        beats: 20,
        box: near,
      },
    );
  assert.ok(mass(8) > 1.5 * mass(0), `strong ${mass(8)}, none ${mass(0)}`);
});

test('a food whose hearth reaches farther draws agents let loose farther off', () => {
  const near = around(AT_A, 0.04);
  const mass = (hearthReach) =>
    massAfter(
      { ...SENSE, hearth: 8, hearthReach, scent: 0 },
      {
        told: (field) => {
          field.food(AT_A.x, AT_A.y);
          field.seed(AT_A.x + 0.09, AT_A.y);
        },
        beats: 20,
        box: near,
      },
    );
  assert.ok(mass(16) > 1.5 * mass(3), `wide ${mass(16)}, narrow ${mass(3)}`);
});

test('a stronger scent draws agents to a food some way off', () => {
  const nearB = around(AT_B, 0.05);
  const mass = (scent) =>
    massAfter(
      { ...SENSE, scent, scentReach: 40 },
      {
        told: (field) => {
          field.food(AT_B.x, AT_B.y);
          field.seed(AT_B.x - 0.12, AT_B.y);
        },
        beats: 20,
        box: nearB,
      },
    );
  assert.ok(mass(0.5) > 1.5 * mass(0), `strong ${mass(0.5)}, none ${mass(0)}`);
});

test('a scent that spreads farther draws agents from farther off', () => {
  const nearB = around(AT_B, 0.05);
  const mass = (scentReach) =>
    massAfter(
      { ...SENSE, scent: 1, scentReach },
      {
        told: (field) => {
          field.food(AT_B.x, AT_B.y);
          field.seed(AT_B.x - 0.25, AT_B.y);
        },
        beats: 20,
        box: nearB,
      },
    );
  assert.ok(mass(40) > 1.5 * mass(5), `wide ${mass(40)}, narrow ${mass(5)}`);
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
  const red = [0.8, 0.2, 0.1];
  const tinted = fieldOf(1, SENSE);
  const plain = fieldOf(1, SENSE);
  tinted.seed(0.5, 0.5, red);
  plain.seed(0.5, 0.5);
  tinted.advanceTo(6);
  plain.advanceTo(6);
  const { weight, red: sumRed, green: sumGreen, blue: sumBlue } = tinted.tints;
  const laid = Array.from(weight.keys()).filter((cell) => weight[cell] > 1e-3);
  assert.ok(laid.length > 0);
  for (const cell of laid) {
    const colorOfCell = [sumRed[cell], sumGreen[cell], sumBlue[cell]].map((sum) => sum / weight[cell]);
    colorOfCell.forEach((channel, index) => assert.ok(Math.abs(channel - red[index]) < 1e-3, `cell ${cell}`));
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
  const near = laidWeight(4);
  assert.ok(near.weight < 0.5 * everywhere.weight, `near ${near.weight}, everywhere ${everywhere.weight}`);
  assert.ok(sameTraffic(near.traffic, everywhere.traffic), 'the reach changes no trail');
});

test("a seed's own agents count overrides perSeed, even to none", () => {
  const rules = { ...RULES, perSeed: 0 };
  const some = fieldOf(1, rules);
  some.seed(0.5, 0.5, undefined, 3);
  some.advanceTo(4);
  assert.ok(total(some.traffic) > 0, 'more than perSeed');
  const none = fieldOf(1, { ...RULES, perSeed: 3 });
  none.seed(0.5, 0.5, undefined, 0);
  none.advanceTo(4);
  assert.equal(total(none.traffic), 0, 'fewer than perSeed');
});

// ---------- fields handing agents over: edges that pass an agent out, tiles that take it in ----------

const PASSING = { ...SENSE, edges: 'pass' };
const tilesOf = (seed, rules = PASSING, wrapAcross) => new TrailTiles(rules, seededRandomness(seed), wrapAcross);
const fieldAt = (tiles, across, down) =>
  tiles.fields.find(({ tile }) => tile.across === across && tile.down === down)?.field;
const RED = [0.8, 0.2, 0.1];
// the traffic along a tile's left edge, where an agent crossing from the tile before lands
const LEFT_STRIP = { x0: 0, x1: 0.02, y0: 0, y1: 1 };
const RIGHT_STRIP = { x0: 0.98, x1: 1, y0: 0, y1: 1 };

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
    assert.ok(Math.abs(leaver.homeX - 0.999) < 0.02 && Math.abs(leaver.homeY - 0.5) < 0.02, 'its home kept');
    assert.ok(Number.isFinite(leaver.heading) && leaver.age >= 0);
  }
  field.clearLeavers();
  assert.equal(field.leavers.length, 0);
});

test("'turn' is what a field does if edges isn't said: its agents never leave, and the traffic is as before", () => {
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

test('an agent crossing a seam lands in the field beyond with its color, and the step is traffic in both fields', () => {
  const tiles = tilesOf(1);
  tiles.advanceTo(0);
  tiles.seed(0.98, 0.5, RED, 12);
  tiles.seed(1.02, 0.5, undefined, 0); // the field beyond, made, with nobody in it
  tiles.advanceTo(10);
  const before = fieldAt(tiles, 0, 0);
  const beyond = fieldAt(tiles, 1, 0);
  assert.ok(massIn(beyond.traffic, { x0: 0, x1: 0.5, y0: 0, y1: 1 }) > 0, 'agents ran on in the field beyond');
  assert.ok(
    massIn(before.traffic, RIGHT_STRIP) > 0 && massIn(beyond.traffic, LEFT_STRIP) > 0,
    'the seam is laid on both sides',
  );
  const laid = Array.from(beyond.tints.weight.keys()).filter((cell) => beyond.tints.weight[cell] > 1e-3);
  assert.ok(laid.length > 0, 'the color came across');
  for (const cell of laid) {
    const { red, green, blue, weight } = beyond.tints;
    [red, green, blue].forEach((sums, index) => assert.ok(Math.abs(sums[cell] / weight[cell] - RED[index]) < 1e-3));
  }
});

test("a color's home is kept across a seam: its weight falls with the distance from where it was let loose, there as here", () => {
  const maxWeightBeyond = (tintReach) => {
    let most = 0;
    for (const seed of SEEDS) {
      const tiles = tilesOf(seed, { ...PASSING, tintReach });
      tiles.advanceTo(0);
      tiles.seed(0.875, 0.5, RED, 40); // 20 cells from the seam
      tiles.seed(1.5, 0.5, undefined, 0);
      tiles.advanceTo(12);
      const beyond = fieldAt(tiles, 1, 0);
      assert.ok(massIn(beyond.traffic, { x0: 0, x1: 0.3, y0: 0, y1: 1 }) > 0, 'agents crossed');
      most = Math.max(most, ...beyond.tints.weight);
    }
    return most;
  };
  const everywhere = maxWeightBeyond(undefined);
  const near = maxWeightBeyond(5);
  assert.ok(near < 0.25 * everywhere, `reach 5: ${near}, everywhere: ${everywhere}`);
});

test('a scout keeps its flag and its home across a seam: it smells its own plant beyond as nothing, and lays no trail there', () => {
  const trafficBeyond = (rules, { food }) => {
    let sum = 0;
    for (const seed of SEEDS) {
      const tiles = tilesOf(seed, { ...PASSING, hearth: 4, scent: 0.5, ...rules });
      tiles.advanceTo(0);
      if (food) {
        tiles.food(0.85, 0.5); // laid in the tile beyond too, as its reach overlaps it
      }
      tiles.seed(1.5, 0.5, undefined, 0); // the field beyond, with nobody let loose in it
      tiles.seed(0.85, 0.5, undefined, 20);
      tiles.advanceTo(10);
      sum += total(fieldAt(tiles, 1, 0).traffic);
    }
    return sum;
  };
  const others = trafficBeyond({ scouts: 0, hearth: 0, scent: 0 }, { food: false });
  const scouts = trafficBeyond({ scouts: 1 }, { food: true });
  assert.ok(others > 0, 'agents that are not scouts cross');
  assert.ok(scouts < 0.02 * others, `scouts ${scouts}, others ${others}`);
});

test('an agent leaving into a tile with no field turns away: no field is made, nobody crosses', () => {
  const tiles = tilesOf(1);
  tiles.advanceTo(0);
  tiles.seed(0.99, 0.5, undefined, 12);
  tiles.seed(0.5, 0.01, undefined, 12);
  tiles.advanceTo(10);
  assert.equal(tiles.fields.length, 1);
  const only = fieldAt(tiles, 0, 0);
  assert.ok(total(only.traffic) > 0);
  assert.equal(only.leavers.length, 0);
});

test('where the tiles wrap round, an agent leaving the last tile lands in the first, across and down', () => {
  const landed = (place, strip) => {
    const tiles = tilesOf(2, PASSING, 2);
    tiles.advanceTo(0);
    tiles.seed(0.5, 0.5, undefined, 0); // tile 0,0, with nobody in it
    tiles.seed(place.x, place.y, undefined, 20);
    tiles.advanceTo(8);
    return massIn(fieldAt(tiles, 0, 0).traffic, strip);
  };
  const across = landed({ x: 1.98, y: 0.5 }, { x0: 0, x1: 0.2, y0: 0, y1: 1 });
  const down = landed({ x: 0.5, y: 1.98 }, { x0: 0, x1: 1, y0: 0, y1: 0.2 });
  assert.ok(across > 0, 'across');
  assert.ok(down > 0, 'down');
  const wrongWay = (place) => {
    const tiles = tilesOf(2, PASSING);
    tiles.advanceTo(0);
    tiles.seed(0.5, 0.5, undefined, 0);
    tiles.seed(place.x, place.y, undefined, 20);
    tiles.advanceTo(8);
    return total(fieldAt(tiles, 0, 0).traffic);
  };
  assert.equal(wrongWay({ x: 1.98, y: 0.5 }), 0, 'with no wrap, tile 2 is no field: nothing comes back');
});

test("a food near an edge is laid in the tile beyond too, in that tile's own plane; one far from every edge in its tile only", () => {
  const tiles = tilesOf(1);
  tiles.advanceTo(0);
  tiles.food(0.9, 0.5);
  assert.deepEqual(
    tiles.fields.map(({ tile }) => [tile.across, tile.down]),
    [
      [0, 0],
      [1, 0],
    ],
  );
  const farOff = tilesOf(1);
  farOff.food(0.5, 0.5);
  assert.equal(farOff.fields.length, 1);
  const corner = tilesOf(1);
  corner.food(0.95, 0.95);
  assert.equal(corner.fields.length, 4, 'a corner reaches three more tiles');
});

test('the food laid beyond the seam draws agents there: a hearth across the seam holds the traffic of agents let loose beside it', () => {
  const rules = { ...PASSING, hearth: 8, hearthReach: 16, scent: 0 };
  const nearSeam = (told) => {
    let mass = 0;
    for (const seed of SEEDS) {
      const tiles = tilesOf(seed, rules);
      tiles.advanceTo(0);
      told(tiles);
      tiles.seed(1.04, 0.5, undefined, 6);
      tiles.advanceTo(20);
      mass += massIn(fieldAt(tiles, 1, 0).traffic, { x0: 0, x1: 0.06, y0: 0.4, y1: 0.6 });
    }
    return mass;
  };
  const withFood = nearSeam((tiles) => tiles.food(0.98, 0.5));
  const without = nearSeam(() => undefined);
  assert.ok(withFood > 1.5 * without, `food ${withFood}, none ${without}`);
});

test('a food taken away is taken from every tile it was laid in: it smells of nothing there', () => {
  const rules = { ...PASSING, hearth: 8, hearthReach: 16, scent: 0 };
  const tiles = tilesOf(1, rules);
  tiles.advanceTo(0);
  tiles.seed(0.5, 0.5, undefined, 0); // tile 0 and tile 1 made, nobody let loose
  tiles.seed(1.5, 0.5, undefined, 0);
  tiles.food(0.98, 0.5);
  tiles.advanceTo(0.5);
  const inTile0 = { x: 0.98 * 160, y: 80 };
  const inTile1 = { x: 2, y: 80 }; // the food is 5 cells past tile 1's left edge
  const smells = () => [fieldAt(tiles, 0, 0).smellAt(inTile0), fieldAt(tiles, 1, 0).smellAt(inTile1)];
  assert.ok(
    smells().every((smell) => smell > 0),
    `laid in both: ${smells().join(', ')}`,
  );
  tiles.foodGone(0.98, 0.5);
  tiles.advanceTo(1);
  assert.ok(
    smells().every((smell) => smell < 1e-6),
    `gone from both: ${smells().join(', ')}`,
  );
});

test('a seed lets agents loose in its own tile only, whatever it reaches', () => {
  const tiles = tilesOf(1, { ...PASSING, perSeed: 4 });
  tiles.advanceTo(0);
  tiles.seed(1.5, 0.5);
  tiles.advanceTo(2);
  assert.equal(tiles.fields.length, 1);
  assert.deepEqual(tiles.fields[0].tile, { across: 1, down: 0 });
  assert.ok(total(tiles.fields[0].field.traffic) > 0);
});

// events across two tiles and their seam: [beat, 'food' | 'seed', x, y] in tile units
const TOLD_ACROSS = [
  [0, 'food', 0.9, 0.5],
  [0.5, 'food', 1.2, 0.5],
  [1, 'seed', 0.9, 0.5],
  [2, 'seed', 1.2, 0.5],
  [3.5, 'seed', 0.95, 0.52],
  [6, 'seed', 1.05, 0.48],
];

test('the same events at the same beats give the same traffic in every tile, in one go or in small steps', () => {
  for (const seed of SEEDS.slice(0, 3)) {
    const whole = runThrough(tilesOf(seed), TOLD_ACROSS, inOneGo);
    const pieces = runThrough(tilesOf(seed), TOLD_ACROSS, inSmallSteps);
    whole.advanceTo(12);
    for (let beat = 7; beat < 12; beat += 0.07) {
      pieces.advanceTo(beat);
    }
    pieces.advanceTo(12);
    assert.equal(whole.fields.length, 2);
    assert.equal(pieces.fields.length, 2);
    assert.ok(massIn(whole.fields[1].field.traffic, { x0: 0, x1: 1, y0: 0, y1: 1 }) > 0);
    whole.fields.forEach(({ field }, at) => {
      assert.ok(sameTraffic(field.traffic, pieces.fields[at].field.traffic), `seed ${seed}, tile ${at}`);
    });
  }
});

test('rules set on the tiles reach every field, and each tile draws from a stream of its own', () => {
  const tiles = tilesOf(1);
  tiles.advanceTo(0);
  tiles.seed(0.5, 0.5, undefined, 0);
  tiles.seed(1.5, 0.5, undefined, 0);
  tiles.rules = { ...PASSING, perSeed: 3 };
  assert.equal(tiles.rules.perSeed, 3);
  for (const { field } of tiles.fields) {
    assert.equal(field.rules.perSeed, 3);
  }
  const alone = tilesOf(1);
  alone.advanceTo(0);
  alone.seed(1.5, 0.5);
  const beside = tilesOf(1);
  beside.advanceTo(0);
  beside.seed(0.5, 0.5);
  beside.seed(1.5, 0.5);
  for (const each of [alone, beside]) {
    each.advanceTo(3);
  }
  assert.ok(
    sameTraffic(fieldAt(alone, 1, 0).traffic, fieldAt(beside, 1, 0).traffic),
    'a tile beside changes nothing here',
  );
});

test('a tile made late runs from the beat the tiles have reached, and costs nothing for the beats before', () => {
  const tiles = tilesOf(1);
  const before = performance.now();
  tiles.advanceTo(2000);
  tiles.seed(0.5, 0.5);
  assert.ok(performance.now() - before < 500);
  tiles.advanceTo(2004);
  assert.equal(tiles.fields[0].field.quanta, 4008);
  assert.ok(total(tiles.fields[0].field.traffic) > 0);
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

// ---------- a field idle again once its agents are let go and its traces have faded (LOOK23d) ----------

const LET_GO = { ...SENSE, lifetime: 4 };
const FADED_AFTER = 100; // beats: 200 quanta, far past the lifetime and the fade of a thread
const QUANTA_A_BEAT = 2;
const isClear = (field) => total(field.traffic) === 0 && field.tints.weight.every((weight) => weight === 0);

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
  const before = performance.now();
  field.advanceTo(5000);
  assert.ok(performance.now() - before < 500, 'a quantum of an idle field costs nothing');
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
    let near = 0;
    for (const seed of SEEDS) {
      const field = fieldOf(seed, rules);
      field.food(AT_A.x, AT_A.y);
      field.seed(0.9, 0.9, undefined, 1); // lets an agent loose, then the field goes idle
      field.advanceTo(idleFirst ? FADED_AFTER : 1);
      field.seed(AT_A.x, AT_A.y);
      field.advanceTo((idleFirst ? FADED_AFTER : 1) + 3);
      near += massIn(field.traffic, around(AT_A, 0.15));
    }
    return near;
  };
  assert.ok(mass(true) > 0.5 * mass(false), `after idle ${mass(true)}, without ${mass(false)}`);
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

// ---------- starving: an agent let go once it has run starveAfter quanta without standing in a food's hearth ----------

const STARVING = { ...SENSE, hearth: 6, hearthReach: 6, starveAfter: 4 };
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
  assert.ok(afterArriving(10) < 0.2 * afterArriving(0), 'arriving starved, it walks no further');
});

// ---------- smelling across a seam: a sensor past the plane reads the field beyond ----------

// two tiles side by side, agents let loose either side of the seam, 0.05 of a tile from it: the traffic in the
// strips at the seam, against strips the same distance from the seeds on the other side of them
function gatheringAtSeam() {
  const strip = (x0, x1) => ({ x0, x1, y0: 0.3, y1: 0.7 });
  let seam = 0;
  let inside = 0;
  for (const seed of SEEDS) {
    const tiles = tilesOf(seed);
    tiles.advanceTo(0);
    tiles.seed(0.95, 0.5, undefined, 20);
    tiles.seed(1.05, 0.5, undefined, 20);
    tiles.advanceTo(6);
    const left = fieldAt(tiles, 0, 0).traffic;
    const right = fieldAt(tiles, 1, 0).traffic;
    seam += massIn(left, strip(0.95, 1)) + massIn(right, strip(0, 0.05));
    inside += massIn(left, strip(0.85, 0.9)) + massIn(right, strip(0.1, 0.15));
  }
  return { seam, inside };
}

test('agents let loose beside a seam with no food gather no more in the border columns than in columns of the same width inside', () => {
  const { seam, inside } = gatheringAtSeam();
  assert.ok(inside > 0, 'agents ran');
  assert.ok(seam <= inside, `seam ${seam}, inside ${inside}`);
});

test('a sensor past the plane smells what the field beyond smells there, in that field s cells; a scout with its home there', () => {
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
  assert.ok(
    Math.abs(scoutPast.home.x - (0.9 * 160 - 160)) < 1e-3,
    `its home in the neighbour's cells: ${scoutPast.home.x}`,
  );
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

test('with no field beyond a side, nothing is asked of it and an agent turns away, as before', () => {
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

test('a trail laid in the field beyond is smelled across the seam: more agents cross towards it than towards none', () => {
  const crossing = (laid) => {
    let crossed = 0;
    for (const seed of SEEDS) {
      const tiles = tilesOf(seed);
      tiles.advanceTo(0);
      tiles.seed(1.1, 0.5, undefined, laid ? 20 : 0); // a trail in tile 1, near the seam
      tiles.seed(0.97, 0.5, undefined, 20);
      tiles.advanceTo(1);
      crossed += massIn(fieldAt(tiles, 1, 0).traffic, { x0: 0, x1: 0.1, y0: 0, y1: 1 });
    }
    return crossed;
  };
  assert.ok(crossing(true) > crossing(false), `with ${crossing(true)}, without ${crossing(false)}`);
});

test('the same traffic across seams in one go or in small steps, with agents smelling over them', () => {
  const run = (stepsOf) => {
    const tiles = tilesOf(3);
    tiles.advanceTo(0);
    tiles.seed(0.9, 0.5, undefined, 12);
    tiles.seed(1.1, 0.5, undefined, 12);
    for (const step of [...stepsOf(0, 6), 6]) {
      tiles.advanceTo(step);
    }
    return tiles.fields.map(({ field }) => field.traffic);
  };
  const oneGo = run(inOneGo);
  const small = run(inSmallSteps);
  assert.equal(oneGo.length, small.length);
  assert.ok(oneGo.length > 1, 'agents crossed into both tiles');
  assert.ok(oneGo.every((traffic, at) => sameTraffic(traffic, small[at])));
});

// ---------- the traffic at the plane's edges ----------

// a line's traffic in one column, or one row, of the traffic grid
function columnOf(traffic, column) {
  let sum = 0;
  for (let row = 0; row < TRAFFIC_GRID; row++) {
    sum += traffic[row * TRAFFIC_GRID + column];
  }
  return sum;
}
function rowOf(traffic, row) {
  return total(traffic.subarray(row * TRAFFIC_GRID, (row + 1) * TRAFFIC_GRID));
}

test('a line across the plane leaves as much traffic in the edge cells as in the middle: no dark line at a seam', () => {
  const grid = TrailField.grid;
  const lineAcross = new Traffic(grid);
  lineAcross.record({ x: 0, y: grid / 2 + 0.3 }, { x: grid, y: grid / 2 + 0.3 });
  const across = lineAcross.values;
  const middle = columnOf(across, TRAFFIC_GRID / 2);
  for (const edge of [0, TRAFFIC_GRID - 1]) {
    assert.ok(
      Math.abs(columnOf(across, edge) - middle) < 0.05 * middle,
      `column ${edge}: ${columnOf(across, edge)} against ${middle}`,
    );
  }
  const lineDown = new Traffic(grid);
  lineDown.record({ x: grid / 2 + 0.3, y: 0 }, { x: grid / 2 + 0.3, y: grid });
  const down = lineDown.values;
  for (const edge of [0, TRAFFIC_GRID - 1]) {
    assert.ok(
      Math.abs(rowOf(down, edge) - middle) < 0.05 * middle,
      `row ${edge}: ${rowOf(down, edge)} against ${middle}`,
    );
  }
});

test("a step's part past the plane leaves nothing in this field's traffic: the field beyond lays it", () => {
  const grid = TrailField.grid;
  const traffic = new Traffic(grid);
  traffic.record({ x: grid + 0.2, y: 40 }, { x: grid + 3, y: 41 });
  traffic.record({ x: 40, y: -3 }, { x: 41, y: -0.2 });
  assert.equal(total(traffic.values), 0);
});

// ---------- the traffic faded as one gain ----------

// steps along a few lines, each recorded between fades, as a field's quanta lay them
const STEPS = [
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
// the traffic faded quantum by quantum, `fades` times, a step recorded before each
function fadedOver(fades, factor, readEvery = Infinity) {
  const traffic = new Traffic(TrailField.grid);
  for (let quantum = 0; quantum < fades; quantum++) {
    const [from, to] = STEPS[quantum % STEPS.length];
    traffic.record(from, to);
    traffic.fade(factor);
    if (quantum % readEvery === 0) {
      void traffic.values; // read as a painting reads it
    }
  }
  return traffic;
}

test('the traffic faded as one gain reads as if every cell were faded: each cell, and the strongest', () => {
  const factor = 0.965 ** 4;
  const fades = 12;
  const traffic = fadedOver(fades, factor);
  // the reference: each step's own traffic, faded as many times as it has been since
  const reference = new Float32Array(TRAFFIC_GRID * TRAFFIC_GRID);
  for (let quantum = 0; quantum < fades; quantum++) {
    const one = new Traffic(TrailField.grid);
    one.record(...STEPS[quantum % STEPS.length]);
    one.values.forEach((value, cell) => {
      reference[cell] += value * factor ** (fades - quantum);
    });
  }
  let strongest = 0;
  traffic.values.forEach((value, cell) => {
    assert.ok(Math.abs(value - reference[cell]) < 1e-6, `cell ${cell}: ${value} against ${reference[cell]}`);
    strongest = Math.max(strongest, value);
  });
  assert.ok(Math.abs(traffic.strongest - strongest) < 1e-7, `${traffic.strongest} against ${strongest}`);
});

test('the traffic faded for long stays right: the gain is brought back to 1 now and then, and the cells with it', () => {
  const factor = 0.965 ** 4;
  const traffic = fadedOver(400, factor);
  const values = traffic.values;
  assert.ok(values.every(Number.isFinite), 'no cell overflowed');
  let strongest = 0;
  values.forEach((value) => {
    strongest = Math.max(strongest, value);
  });
  assert.ok(strongest > 0.05 && strongest < 1, `the last steps still there: ${strongest}`);
  assert.ok(Math.abs(traffic.strongest - strongest) < 1e-7);
});

test('reading the traffic changes nothing that comes after: the same traffic read every quantum or never', () => {
  const factor = 0.965 ** 4;
  assert.ok(sameTraffic(fadedOver(300, factor, 1).values, fadedOver(300, factor).values));
});

test('the traffic cleared is empty, its strongest 0, and records afresh', () => {
  const traffic = fadedOver(5, 0.5);
  traffic.clear();
  assert.equal(total(traffic.values), 0);
  assert.equal(traffic.strongest, 0);
  traffic.record(...STEPS[0]);
  assert.ok(traffic.strongest > 0);
});

// ---------- what a debug map reads of a field and of the tiles (LOOK23e) ----------

test('a hand-over is counted out of the field that let the agents go and into the one that took them in', () => {
  const tiles = tilesOf(1);
  tiles.advanceTo(0);
  tiles.seed(0.98, 0.5, RED, 12);
  tiles.seed(1.02, 0.5, undefined, 0); // the field beyond, made, with nobody in it
  let letOut = 0;
  let tookIn = 0;
  for (let quantum = 1; quantum <= 20; quantum++) {
    tiles.advanceTo(quantum / QUANTA_A_BEAT);
    letOut += fieldAt(tiles, 0, 0).letOut;
    tookIn += fieldAt(tiles, 1, 0).tookIn;
  }
  assert.ok(letOut > 0, 'some agents left the first field');
  assert.ok(tookIn > 0, 'the field beyond took in some');
});

test("a field's last quantum counts what it let out and took in, and nothing once it's idle", () => {
  const field = new TrailField({ ...PASSING, lifetime: 4 }, seededRandomness(1));
  assert.equal(field.letOut + field.tookIn, 0);
  field.seed(0.999, 0.5, RED, 12);
  field.advanceTo(0.5);
  assert.ok(field.letOut > 0, 'agents left in the quantum run');
  field.advanceTo(FADED_AFTER);
  assert.equal(field.idle, true);
  assert.equal(field.letOut, 0, 'a quantum skipped lets none out');
  assert.equal(field.tookIn, 0);
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

test("each field's time for its last quantum in ms: measured for the fields that ran, 0 for one that didn't", () => {
  const tiles = tilesOf(1);
  tiles.advanceTo(0);
  tiles.seed(0.5, 0.5, RED, 12);
  tiles.food(1.5, 0.5);
  const [seeded, fed] = [fieldAt(tiles, 0, 0), fieldAt(tiles, 1, 0)];
  assert.equal(tiles.msOf(seeded), 0, 'nothing run yet');
  tiles.advanceTo(2);
  assert.ok(tiles.msOf(seeded) > 0, 'a field with agents took time');
  assert.ok(tiles.msOf(seeded) < 1000);
  assert.ok(tiles.msOf(fed) >= 0);
  assert.ok(tiles.msOf(seeded) > tiles.msOf(fed), 'one with no agents took less');
});

// ---------- the trail and the colors diffused fewer times a quantum ----------

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

test('the colors diffused once a quantum weigh about as much and spread about as far as diffused at every step', () => {
  const once = weightAndSpread(colorsOf(1));
  const everyStep = weightAndSpread(colorsOf(4));
  assert.ok(Math.abs(once.mass / everyStep.mass - 1) < 0.1, `weight ${once.mass} against ${everyStep.mass}`);
  assert.ok(Math.abs(once.spread / everyStep.spread - 1) < 0.1, `spread ${once.spread} against ${everyStep.spread}`);
});

test('the passes not said are one a step, as before: the same colors as four passes said', () => {
  assert.ok(sameTraffic(colorsOf(undefined), colorsOf(4)));
});

test('the colors diffused once a quantum differ from those diffused at every step: the passes are taken', () => {
  assert.ok(!sameTraffic(colorsOf(1), colorsOf(4)));
});

// ---------- the colors on a grid coarser than the field's ----------

const TINT_GRIDS = [80, 120, 160];

test("the colors lie on the rules' grid, tintGrid cells a side; the field's if not said", () => {
  const field = fieldOf(3, { ...SENSE, tintGrid: 120 });
  assert.equal(field.tintGrid, 120);
  assert.equal(field.tints.weight.length, 120 * 120);
  assert.equal(fieldOf(3, SENSE).tintGrid, TrailField.grid);
  assert.equal(colorsOf(1).length, TrailField.grid ** 2);
});

test("the colors on a coarser grid weigh as much and spread as far as on the field's, in the field's cells", () => {
  // measured on the field's grid before the colors' grid could be coarser (2026-10-25)
  const onTheFieldsGrid = { 1: { mass: 153.261, spread: 25.757 }, 4: { mass: 163.109, spread: 25.8 } };
  for (const tintGrid of TINT_GRIDS) {
    for (const tintPasses of [1, 4]) {
      const { mass, spread } = weightAndSpread(colorsOf(tintPasses, tintGrid));
      const before = onTheFieldsGrid[tintPasses];
      const which = `grid ${tintGrid}, passes ${tintPasses}`;
      assert.ok(Math.abs(mass / before.mass - 1) < 0.1, `${which}: weight ${mass} against ${before.mass}`);
      assert.ok(Math.abs(spread / before.spread - 1) < 0.1, `${which}: spread ${spread} against ${before.spread}`);
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
      assert.ok(Math.abs(added / expected - 1) < 0.1, `${which}: ${added} cells² added, ${expected} expected`);
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
  assert.ok(Math.abs(after.mass / before.mass - 1) < 0.05, `weight ${after.mass} against ${before.mass}`);
  assert.ok(Math.abs(after.spread / before.spread - 1) < 0.05, `spread ${after.spread} against ${before.spread}`);
  field.advanceTo(8);
  assert.ok(weightAndSpread(field.tints.weight).mass > 0, 'running on, on the new grid');
});

// ---------- a field asleep: far from where it's looked at, it waits as it is (LOOK23h) ----------

const SLEEPING = { ...PASSING, lifetime: 20, starveAfter: 20 };
const NOBODY = () => false;
// only the tile at (across, down) awake
const onlyAt = (across, down) => (tile) => tile.across === across && tile.down === down;
const copyOf = (values) => Float32Array.from(values);

test('a field asleep stays as it is over many beats: its traffic and colors unchanged, its quanta counted as reached', () => {
  const tiles = tilesOf(1, SLEEPING);
  tiles.advanceTo(0);
  tiles.seed(0.5, 0.5, RED, 12);
  tiles.advanceTo(3);
  const field = fieldAt(tiles, 0, 0);
  const traffic = copyOf(field.traffic);
  const colors = copyOf(field.tints.weight);
  assert.ok(total(traffic) > 0);
  assert.equal(field.asleep, false);
  tiles.advanceTo(200, NOBODY);
  assert.equal(field.asleep, true);
  assert.ok(sameTraffic(field.traffic, traffic), 'traffic unchanged');
  assert.ok(sameTraffic(field.tints.weight, colors), 'colors unchanged');
  assert.equal(field.quanta, 400);
  assert.equal(tiles.msOf(field) < 5, true);
});

test('its agents do not age while it sleeps: past their lifetime and starving time asleep, they run on once it wakes', () => {
  const asleep = tilesOf(1, SLEEPING);
  const awake = tilesOf(1, SLEEPING);
  for (const tiles of [asleep, awake]) {
    tiles.advanceTo(0);
    tiles.seed(0.5, 0.5, RED, 12);
    tiles.advanceTo(2);
  }
  asleep.advanceTo(100, NOBODY);
  awake.advanceTo(100);
  asleep.advanceTo(100.5);
  assert.equal(fieldAt(asleep, 0, 0).liveAgents, 12, 'all still alive once woken');
  assert.equal(fieldAt(awake, 0, 0).liveAgents, 0, 'awake, they ran out their lifetime');
});

test('a field woken carries on as one that never slept, given no events between', () => {
  const slept = tilesOf(1, SLEEPING);
  const never = tilesOf(1, SLEEPING);
  for (const tiles of [slept, never]) {
    tiles.advanceTo(0);
    tiles.seed(0.5, 0.5, RED, 12);
    tiles.advanceTo(3);
  }
  slept.advanceTo(20, NOBODY);
  slept.advanceTo(23);
  never.advanceTo(6); // the 6 quanta it ran after waking
  const [woken, kept] = [fieldAt(slept, 0, 0), fieldAt(never, 0, 0)];
  assert.ok(total(woken.traffic) > 0);
  assert.ok(sameTraffic(woken.traffic, kept.traffic), 'the same traffic');
  assert.ok(sameTraffic(woken.tints.weight, kept.tints.weight), 'the same colors');
  assert.equal(woken.liveAgents, kept.liveAgents);
});

test('while asleep a food laid or taken away is applied at once; a seed is dropped, so waking brings no burst', () => {
  const tiles = tilesOf(1, SLEEPING);
  tiles.advanceTo(0);
  tiles.food(0.5, 0.5);
  tiles.advanceTo(1, NOBODY);
  const field = fieldAt(tiles, 0, 0);
  assert.equal(field.asleep, true);
  const centre = { x: 80, y: 80 };
  const before = field.smellAt(centre);
  tiles.food(0.5, 0.5);
  assert.ok(field.smellAt(centre) > before, 'a food laid is smelled at once');
  tiles.foodGone(0.5, 0.5);
  tiles.foodGone(0.5, 0.5);
  assert.ok(field.smellAt(centre) < 1e-6, 'a food taken away is gone at once');
  tiles.seed(0.5, 0.5, RED, 12);
  tiles.advanceTo(4);
  assert.equal(field.asleep, false);
  assert.equal(field.agentsLoose, 0, 'the seed was dropped');
  assert.equal(total(field.traffic), 0);
});

test('a seed told just before a field falls asleep is dropped too, a food told then applied', () => {
  const tiles = tilesOf(1, SLEEPING);
  tiles.advanceTo(0);
  tiles.food(0.5, 0.5);
  tiles.seed(0.5, 0.5, RED, 12);
  tiles.advanceTo(2, NOBODY);
  const field = fieldAt(tiles, 0, 0);
  assert.ok(field.smellAt({ x: 80, y: 80 }) > 0, 'the food is laid');
  tiles.advanceTo(4);
  assert.equal(field.agentsLoose, 0, 'the seed was dropped');
});

test('a seam into an asleep field is as one into no field: an agent turns away and the asleep field is left as it is', () => {
  const tiles = tilesOf(1, SLEEPING);
  tiles.advanceTo(0);
  tiles.food(1.5, 0.5); // makes the field beside
  tiles.seed(0.99, 0.5, RED, 12);
  tiles.advanceTo(1, onlyAt(0, 0));
  const [awake, asleep] = [fieldAt(tiles, 0, 0), fieldAt(tiles, 1, 0)];
  assert.equal(asleep.asleep, true);
  assert.equal(awake.asleep, false);
  tiles.advanceTo(10, onlyAt(0, 0));
  assert.ok(total(awake.traffic) > 0, 'the awake field ran');
  assert.equal(awake.leavers.length, 0);
  assert.equal(awake.letOut, 0);
  assert.equal(total(asleep.traffic), 0, 'nobody crossed');
  assert.equal(asleep.tookIn, 0);
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

test('the awake test is read at each call: a field woken runs again, and without a test every field runs, as before', () => {
  const tiles = tilesOf(1, SLEEPING);
  tiles.advanceTo(0);
  tiles.food(0.5, 0.5);
  tiles.advanceTo(1, NOBODY);
  const field = fieldAt(tiles, 0, 0);
  assert.equal(field.asleep, true);
  tiles.advanceTo(2);
  assert.equal(field.asleep, false);
  tiles.seed(0.5, 0.5, RED, 12);
  tiles.advanceTo(4, onlyAt(0, 0));
  assert.ok(total(field.traffic) > 0, 'it ran');
});

// ---------- threads run into a food's centre, not past it; a plant's color kept near it ----------

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
// the three foods run for 60 beats under `rules`, over three randomnesses
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

test("an agent's sensors close in by senseInHearth at a food's centre: the traffic round a quiet food peaks at its centre, not on a ring", () => {
  const before = trafficRoundQuiet({});
  assert.ok(before.ring > 0.9 * before.centre, `before: ring ${before.ring}, centre ${before.centre}`);
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
  const field = (rules) => {
    const run = fieldOf(1, { ...SENSE, ...rules });
    run.seed(0.5, 0.5);
    run.advanceTo(10);
    return run.traffic;
  };
  assert.ok(sameTraffic(field({}), field({ senseInHearth: 0.7, turnBackWithin: 3 })), 'no food: as before');
});

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
