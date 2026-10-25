// Trails (mockup/src/libs/generative/trails/): a slime mould's agents on a field, food drawing them, seeds letting more loose
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAFFIC_GRID, TrailField, TrailTiles } from '../index.ts';
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

test('a food taken away is taken from every tile it was laid in', () => {
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
  const kept = nearSeam((tiles) => tiles.food(0.98, 0.5));
  const gone = nearSeam((tiles) => {
    tiles.food(0.98, 0.5);
    tiles.foodGone(0.98, 0.5);
  });
  assert.ok(gone < 0.5 * kept, `gone ${gone}, kept ${kept}`);
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
