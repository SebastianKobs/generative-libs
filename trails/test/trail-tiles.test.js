// libs/generative/trails/trail-tiles.ts: fields on a grid of tiles stepped together, handing agents over at the seams,
// a far field left asleep
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { near } from '../../../base/util/test/near.js';
import {
  FADED_AFTER,
  PASSING,
  QUANTA_A_BEAT,
  RED,
  SEEDS,
  copyOf,
  fieldAt,
  inOneGo,
  inSmallSteps,
  massIn,
  runThrough,
  sameTraffic,
  tilesOf,
  total,
} from './trails.js';

// the traffic along a tile's left edge, where an agent crossing from the tile before lands
const LEFT_STRIP = { x0: 0, x1: 0.02, y0: 0, y1: 1 };
const RIGHT_STRIP = { x0: 0.98, x1: 1, y0: 0, y1: 1 };

// events across two tiles and their seam: [beat, 'food' | 'seed', x, y] in tile units
const TOLD_ACROSS = [
  [0, 'food', 0.9, 0.5],
  [0.5, 'food', 1.2, 0.5],
  [1, 'seed', 0.9, 0.5],
  [2, 'seed', 1.2, 0.5],
  [3.5, 'seed', 0.95, 0.52],
  [6, 'seed', 1.05, 0.48],
];

const SLEEPING = { ...PASSING, lifetime: 20, starveAfter: 20 };

function nobodyAwake() {
  return false;
}

// only the tile at (across, down) awake
function onlyAt(across, down) {
  return (tile) => tile.across === across && tile.down === down;
}

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
    [red, green, blue].forEach((sums, index) => near(sums[cell] / weight[cell], RED[index], '', 1e-3));
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
  const weightNear = maxWeightBeyond(5);
  assert.ok(weightNear < 0.25 * everywhere, `reach 5: ${weightNear}, everywhere: ${everywhere}`);
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
  const laidIn = smells();
  assert.ok(
    laidIn.every((smell) => smell > 0),
    `laid in both: ${laidIn.join(', ')}`,
  );
  tiles.foodGone(0.98, 0.5);
  tiles.advanceTo(1);
  const goneFrom = smells();
  assert.ok(
    goneFrom.every((smell) => smell < 1e-6),
    `gone from both: ${goneFrom.join(', ')}`,
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

test('the same traffic across seams in one go or in small steps, in every tile, with agents smelling over them', () => {
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

test('agents let loose beside a seam with no food gather no more in the border columns than in columns of the same width inside', () => {
  const { seam, inside } = gatheringAtSeam();
  assert.ok(inside > 0, 'agents ran');
  assert.ok(seam <= inside, `seam ${seam}, inside ${inside}`);
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
  const withTrail = crossing(true);
  const withoutTrail = crossing(false);
  assert.ok(withTrail > withoutTrail, `with ${withTrail}, without ${withoutTrail}`);
});

test("a hand-over is counted out of the field that let the agents go and into the one that took them in, and none once they're idle", () => {
  const tiles = tilesOf(1, { ...PASSING, lifetime: 4 });
  tiles.advanceTo(0);
  tiles.seed(0.999, 0.5, RED, 12);
  tiles.seed(1.02, 0.5, undefined, 0); // the field beyond, made, with nobody in it
  const [first, beyond] = [fieldAt(tiles, 0, 0), fieldAt(tiles, 1, 0)];
  assert.equal(first.letOut + first.tookIn, 0);
  let letOut = 0;
  let tookIn = 0;
  for (let quantum = 1; quantum <= 20; quantum++) {
    tiles.advanceTo(quantum / QUANTA_A_BEAT);
    letOut += first.letOut;
    tookIn += beyond.tookIn;
  }
  assert.ok(letOut > 0, 'some agents left the first field');
  assert.ok(tookIn > 0, 'the field beyond took in some');
  tiles.advanceTo(FADED_AFTER);
  for (const field of [first, beyond]) {
    assert.equal(field.idle, true);
    assert.equal(field.letOut, 0, 'a quantum skipped lets none out');
    assert.equal(field.tookIn, 0);
  }
});

test("each field's time for its last quantum in ms: 0 before a run, measured after for a field with agents", () => {
  const tiles = tilesOf(1);
  tiles.advanceTo(0);
  tiles.seed(0.5, 0.5, RED, 12);
  tiles.food(1.5, 0.5);
  const [seeded, fed] = [fieldAt(tiles, 0, 0), fieldAt(tiles, 1, 0)];
  assert.equal(tiles.msOf(seeded), 0, 'nothing run yet');
  assert.equal(tiles.msOf(fed), 0, 'nothing run yet');
  tiles.advanceTo(2);
  assert.ok(tiles.msOf(seeded) > 0, 'a field with agents took time');
  assert.ok(tiles.msOf(seeded) < 1000);
  assert.ok(tiles.msOf(fed) >= 0);
});

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
  tiles.advanceTo(200, nobodyAwake);
  assert.equal(field.asleep, true);
  assert.ok(sameTraffic(field.traffic, traffic), 'traffic unchanged');
  assert.ok(sameTraffic(field.tints.weight, colors), 'colors unchanged');
  assert.equal(field.quanta, 400);
});

test('its agents do not age while it sleeps: past their lifetime and starving time asleep, they run on once it wakes', () => {
  const asleep = tilesOf(1, SLEEPING);
  const awake = tilesOf(1, SLEEPING);
  for (const tiles of [asleep, awake]) {
    tiles.advanceTo(0);
    tiles.seed(0.5, 0.5, RED, 12);
    tiles.advanceTo(2);
  }
  asleep.advanceTo(100, nobodyAwake);
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
  slept.advanceTo(20, nobodyAwake);
  slept.advanceTo(23);
  never.advanceTo(6); // the 6 quanta it ran after waking
  const [woken, kept] = [fieldAt(slept, 0, 0), fieldAt(never, 0, 0)];
  assert.ok(total(woken.traffic) > 0);
  assert.ok(sameTraffic(woken.traffic, kept.traffic), 'the same traffic');
  assert.ok(sameTraffic(woken.tints.weight, kept.tints.weight), 'the same colors');
  assert.equal(woken.liveAgents, kept.liveAgents);
});

test('while asleep a food laid or taken away is applied at once; a seed is dropped, also one told just before, so waking brings no burst', () => {
  const tiles = tilesOf(1, SLEEPING);
  tiles.advanceTo(0);
  tiles.food(0.5, 0.5);
  tiles.advanceTo(1, nobodyAwake);
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
  const justBefore = tilesOf(1, SLEEPING);
  justBefore.advanceTo(0);
  justBefore.food(0.5, 0.5);
  justBefore.seed(0.5, 0.5, RED, 12);
  justBefore.advanceTo(2, nobodyAwake);
  const told = fieldAt(justBefore, 0, 0);
  assert.ok(told.smellAt(centre) > 0, 'the food told just before is laid');
  justBefore.advanceTo(4);
  assert.equal(told.agentsLoose, 0, 'the seed told just before was dropped');
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

test('the awake test is read at each call: a field woken runs again, and without a test every field runs', () => {
  const tiles = tilesOf(1, SLEEPING);
  tiles.advanceTo(0);
  tiles.food(0.5, 0.5);
  tiles.advanceTo(1, nobodyAwake);
  const field = fieldAt(tiles, 0, 0);
  assert.equal(field.asleep, true);
  tiles.advanceTo(2);
  assert.equal(field.asleep, false);
  tiles.seed(0.5, 0.5, RED, 12);
  tiles.advanceTo(4, onlyAt(0, 0));
  assert.ok(total(field.traffic) > 0, 'it ran');
});
