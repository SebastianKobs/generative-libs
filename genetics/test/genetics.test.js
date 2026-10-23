// Genetics (mockup/src/libs/generative/genetics/): genes moved a little at a time by a depth, a genome
// in sections mutated, crossed and kept in a lineage, an individual's own by its id and generation
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  choiceGene,
  choicesGene,
  cross,
  flatGenome,
  individualGenome,
  Lineage,
  mutate,
  rangedGene,
  wholeGene,
} from '../index.ts';
import { seededRandomness } from '../../randomness/test/seeded-randomness.js';

// a scale like an octave knob: equal steps in position are equal ratios in value, 20 to 20000
const OCTAVES = {
  positionOf: (value) => Math.log(value / 20) / Math.log(1000),
  valueAt: (position) => 20 * 1000 ** position,
};
const LINEAR = { positionOf: (value) => value, valueAt: (position) => position };
const isSame = (one, other) => JSON.stringify(one) === JSON.stringify(other);
const SEEDS = Array.from({ length: 400 }, (_, seed) => seed + 1);

test('a ranged gene on an octaves-like scale moves as far in position at the low end as at the high; at depth 1 it stays in its range', () => {
  const gene = rangedGene(OCTAVES);
  const depth = 0.3;
  const movedFrom = (position) =>
    SEEDS.map((seed) =>
      Math.abs(OCTAVES.positionOf(gene.mutate(OCTAVES.valueAt(position), depth, seededRandomness(seed))) - position),
    );
  const low = movedFrom(0.2);
  const high = movedFrom(0.8);
  const mean = (moves) => moves.reduce((sum, move) => sum + move, 0) / moves.length;
  assert.ok(Math.max(...low, ...high) <= depth / 3 + 1e-9, 'the largest move a third of the travel at depth 1');
  assert.ok(Math.abs(mean(low) - mean(high)) < 0.01, `${mean(low)} against ${mean(high)}`);
  for (const seed of SEEDS.slice(0, 100)) {
    for (const start of [20, 20000]) {
      const value = gene.mutate(start, 1, seededRandomness(seed));
      assert.ok(value >= 20 - 1e-9 && value <= 20000 + 1e-9, `${value} left its range`);
    }
  }
});

test('a whole gene moves by 1, never past its bounds', () => {
  const gene = wholeGene(1, 4);
  for (const seed of SEEDS.slice(0, 100)) {
    const randomness = seededRandomness(seed);
    assert.equal(Math.abs(gene.mutate(2, 1, randomness) - 2), 1);
    assert.equal(gene.mutate(1, 1, randomness) >= 1, true);
    assert.equal(gene.mutate(4, 1, randomness) <= 4, true);
  }
  assert.equal(gene.mutate(1, 1, { next: () => 0, fork: () => assert.fail() }), 1, 'down from the lowest stays');
  assert.equal(gene.mutate(4, 1, { next: () => 0.9, fork: () => assert.fail() }), 4, 'up from the highest stays');
});

test('a choice and a choices gene draw the same with their options given in another order; a choices gene never holds one option twice and keeps its count', () => {
  const options = ['white', 'red', 'blue', 'yellow', 'black'];
  const reordered = ['black', 'white', 'yellow', 'red', 'blue'];
  for (const seed of SEEDS.slice(0, 100)) {
    assert.equal(
      choiceGene(options).mutate('red', 1, seededRandomness(seed)),
      choiceGene(reordered).mutate('red', 1, seededRandomness(seed)),
    );
    const paints = choicesGene(options, 2);
    const moved = paints.mutate(['white', 'red'], 1, seededRandomness(seed));
    assert.deepEqual(moved, choicesGene(reordered, 2).mutate(['white', 'red'], 1, seededRandomness(seed)));
    assert.equal(moved.length, 2);
    assert.equal(new Set(moved).size, 2, `${moved.join()} holds one twice`);
  }
});

test('a pair swaps in an option as likely as its weight, 1 where none is given, whatever order the options are written in', () => {
  const options = ['white', 'ochre', 'rust', 'blue'];
  const weighted = choicesGene(options, 2, { rust: 2 });
  const swappedIn = SEEDS.map((seed) => weighted.mutate(['white', 'ochre'], 1, seededRandomness(seed)))
    .flat()
    .filter((paint) => paint !== 'white' && paint !== 'ochre');
  const rust = swappedIn.filter((paint) => paint === 'rust').length;
  assert.equal(swappedIn.length, SEEDS.length);
  assert.ok(rust > 230 && rust < 300, `rust twice as likely as blue: ${rust} of ${SEEDS.length}`);
  const reordered = choicesGene([...options].reverse(), 2, { rust: 2 });
  assert.deepEqual(
    reordered.mutate(['white', 'ochre'], 1, seededRandomness(5)),
    weighted.mutate(['white', 'ochre'], 1, seededRandomness(5)),
  );
});

test('a choice switches only to another option, with a chance of the depth', () => {
  const gene = choiceGene(['a', 'b', 'c']);
  const switched = SEEDS.filter((seed) => gene.mutate('a', 0.5, seededRandomness(seed)) !== 'a');
  assert.ok(switched.length > 150 && switched.length < 250, `${switched.length} of 400`);
  assert.equal(gene.mutate('a', 0, seededRandomness(1)), 'a');
  assert.equal(choiceGene(['only']).mutate('only', 1, seededRandomness(1)), 'only', 'no other to go to');
});

// a genome of three sections: what two kinds of plants share, the tap plant's own, a floor's no kind names
const SCHEMA = {
  shared: { size: rangedGene(LINEAR), petals: wholeGene(3, 9) },
  tap: { slant: rangedGene(LINEAR), paints: choicesGene(['white', 'red', 'blue', 'black'], 2) },
  floor: { weft: choiceGene(['over', 'under', 'bar']) },
};
const BASE = {
  shared: { size: 0.5, petals: 5 },
  tap: { slant: 0.5, paints: ['white', 'red'] },
  floor: { weft: 'bar' },
};

test('mutate(): the same randomness, the same genome; a gene added to the schema leaves the others moves as they were; with sections, only those move', () => {
  assert.deepEqual(mutate(BASE, SCHEMA, 1, seededRandomness(7)), mutate(BASE, SCHEMA, 1, seededRandomness(7)));
  assert.notDeepEqual(mutate(BASE, SCHEMA, 1, seededRandomness(7)), BASE);

  const longer = { ...SCHEMA, shared: { ...SCHEMA.shared, extra: rangedGene(LINEAR) } };
  const longerBase = { ...BASE, shared: { ...BASE.shared, extra: 0.5 } };
  const before = mutate(BASE, SCHEMA, 1, seededRandomness(7));
  const after = mutate(longerBase, longer, 1, seededRandomness(7));
  assert.deepEqual({ ...after.shared, extra: undefined }, { ...before.shared, extra: undefined });
  assert.deepEqual(after.tap, before.tap);
  assert.deepEqual(after.floor, before.floor);

  const onlyTap = mutate(BASE, SCHEMA, 1, seededRandomness(7), ['tap']);
  assert.deepEqual(onlyTap.shared, BASE.shared);
  assert.deepEqual(onlyTap.floor, BASE.floor);
  assert.deepEqual(onlyTap.tap, before.tap, 'a section moves as it does with the others');
  assert.notDeepEqual(onlyTap.tap, BASE.tap);
});

test('mutate(): a gene leaves things as they were where its first draw is over the depth', () => {
  assert.deepEqual(mutate(BASE, SCHEMA, 0, seededRandomness(3)), BASE);
});

test('individualGenome(): generation 1 the base, flat; the same id and generation, the same genome; only shared and its own kind moves', () => {
  const individual = (generation, kind = 'tap') => ({ id: 'plant 4', kind, generation });
  const flatBase = { size: 0.5, petals: 5, slant: 0.5, paints: ['white', 'red'] };
  const randomness = seededRandomness(11);
  assert.deepEqual(individualGenome(BASE, SCHEMA, individual(1), 1, randomness), flatBase);

  const third = individualGenome(BASE, SCHEMA, individual(3), 1, randomness);
  assert.deepEqual(third, individualGenome(BASE, SCHEMA, individual(3), 1, seededRandomness(11)));
  assert.deepEqual(Object.keys(third), ['size', 'petals', 'slant', 'paints'], "shared's, then its own");
  assert.notDeepEqual(third, flatBase);

  const second = individualGenome(BASE, SCHEMA, individual(2), 1, randomness);
  assert.notDeepEqual(second, third, 'each generation moves it once more');

  assert.deepEqual(
    Object.keys(individualGenome(BASE, SCHEMA, individual(3, 'hold'), 1, randomness)),
    ['size', 'petals'],
    "a kind with no section, shared's alone",
  );
});

test('cross(): each gene a parent, or a ranged one between them; a choices gene never holds one option twice', () => {
  const first = {
    shared: { size: 0.2, petals: 3 },
    tap: { slant: 0.1, paints: ['white', 'red'] },
    floor: { weft: 'over' },
  };
  const second = {
    shared: { size: 0.8, petals: 9 },
    tap: { slant: 0.9, paints: ['blue', 'black'] },
    floor: { weft: 'under' },
  };
  const slack = (1 / 3) * 0.15 + 1e-9; // the cross's small mutation, in position
  const sizes = [];
  for (const seed of SEEDS.slice(0, 100)) {
    const child = cross(first, second, SCHEMA, seededRandomness(seed));
    sizes.push(child.shared.size);
    assert.ok(child.shared.size >= 0.2 - slack && child.shared.size <= 0.8 + slack, String(child.shared.size));
    assert.ok([2, 3, 4, 8, 9].includes(child.shared.petals), String(child.shared.petals));
    assert.equal(new Set(child.tap.paints).size, 2, `${child.tap.paints.join()} holds one twice`);
    assert.ok(['over', 'under', 'bar'].includes(child.floor.weft));
  }
  const near = (target) => sizes.filter((size) => Math.abs(size - target) < slack).length;
  assert.ok(near(0.5) > 20, 'about half the time the parents average');
  assert.ok(near(0.2) + near(0.8) > 20, 'else one parent or the other');
  assert.deepEqual(
    cross(first, second, SCHEMA, seededRandomness(5)),
    cross(first, second, SCHEMA, seededRandomness(5)),
  );
  const crossed = cross(first, first, { shared: { size: rangedGene(LINEAR) } }, seededRandomness(5));
  assert.ok(Math.abs(crossed.shared.size - 0.2) <= slack, 'two of one parent stay near it');
});

test('flatGenome(): every section in one object', () => {
  assert.deepEqual(flatGenome(BASE), {
    size: 0.5,
    petals: 5,
    slant: 0.5,
    paints: ['white', 'red'],
    weft: 'bar',
  });
});

test('Lineage: a mutation adds an entry, its parent the one before, something moved', () => {
  const lineage = new Lineage(BASE, SCHEMA);
  assert.deepEqual(
    lineage.entries.map(({ label }) => label),
    ['origin'],
  );
  assert.equal(lineage.index, 0);
  lineage.mutate(0.2, seededRandomness(1));
  lineage.mutate(0.2, seededRandomness(2));
  assert.deepEqual(
    lineage.entries.map(({ label }) => label),
    ['origin', 'mutated', 'mutated'],
  );
  assert.deepEqual(
    lineage.entries.map(({ parents }) => parents),
    [[], [0], [1]],
  );
  assert.equal(lineage.index, 2);
  assert.notDeepEqual(lineage.entries[1]?.genome, lineage.entries[0]?.genome);
  assert.notDeepEqual(lineage.entries[2]?.genome, lineage.entries[1]?.genome);
  assert.equal(lineage.current, lineage.entries[2]?.genome);
});

test('Lineage: a mutation moves something even where a draw would often move nothing', () => {
  const unmoved = SEEDS.slice(0, 50).filter((seed) => isSame(mutate(BASE, SCHEMA, 0.3, seededRandomness(seed)), BASE));
  assert.ok(unmoved.length > 0, 'a single draw leaves it as it was for some seeds');
  for (const seed of SEEDS.slice(0, 50)) {
    const lineage = new Lineage(BASE, SCHEMA);
    lineage.mutate(0.3, seededRandomness(seed));
    assert.notDeepEqual(lineage.current, BASE, `seed ${seed}`);
  }
});

test('Lineage: a section alone at the depth scaled up by the square root of how many fewer genes it holds', () => {
  const depths = [];
  const recording = {
    mutate(value, depth) {
      depths.push(depth);
      return value + 1;
    },
  };
  const schema = { shared: { a: recording, b: recording, c: recording }, tap: { d: recording } };
  const lineage = new Lineage({ shared: { a: 0, b: 0, c: 0 }, tap: { d: 0 } }, schema);
  lineage.mutate(0.3, seededRandomness(1), 'tap');
  assert.equal(lineage.entries[1]?.label, 'mutated: tap');
  assert.deepEqual(lineage.current.shared, { a: 0, b: 0, c: 0 }, 'the other section left as it was');
  assert.ok(depths.length > 0);
  for (const depth of depths) {
    assert.ok(Math.abs(depth - 0.6) < 1e-9, `${depth}`);
  }
  depths.length = 0;
  lineage.mutate(0.8, seededRandomness(1), 'tap');
  for (const depth of depths) {
    assert.equal(depth, 1, 'at most 1');
  }
});

test('Lineage: a cross with two parents; select() steps back, nothing removed', () => {
  const lineage = new Lineage(BASE, SCHEMA);
  lineage.mutate(0.5, seededRandomness(1));
  lineage.cross(0, seededRandomness(2));
  assert.equal(lineage.entries[2]?.label, 'crossed');
  assert.deepEqual(lineage.entries[2]?.parents, [1, 0]);
  assert.equal(lineage.index, 2);
  lineage.select(0);
  assert.equal(lineage.index, 0);
  assert.equal(lineage.current, BASE);
  assert.equal(lineage.entries.length, 3);
  lineage.mutate(0.5, seededRandomness(3));
  assert.deepEqual(lineage.entries[3]?.parents, [0], 'a mutation of the entry stepped back to');
  assert.deepEqual(lineage.flat, flatGenome(lineage.current));
});
