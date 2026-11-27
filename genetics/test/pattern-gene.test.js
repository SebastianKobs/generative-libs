// Genetics' pattern gene (genetics/): a step pattern of levels moved a little, a step's level, a hit moved
// to a neighbor or one added or taken away, and crossed by segments; in a genome and a lineage as any gene
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lineage, mutate, patternGene, wholeGene } from '../index.ts';
import { seededRandomness } from '../../randomness/test/seeded-randomness.js';

const SEEDS = Array.from({ length: 300 }, (_, seed) => seed + 1);
const MAX_LEVEL = 3;
const ACCENTS = [3, 0, 1, 0, 2, 0, 0, 1];
// the draws that pick each kind of change: a third of the way for each
const TOGGLE = 0;
const MOVE = 0.4;
const DENSITY = 0.8;

// a Randomness drawing the numbers given, in order, so each change can be made on purpose
function scripted(draws) {
  const left = [...draws];
  return {
    next: () => left.shift() ?? assert.fail('drew more than scripted'),
    fork: () => assert.fail('a gene draws from what it is handed'),
  };
}
function hitsOf(pattern) {
  return pattern.filter((level) => level > 0).length;
}
function isInBounds(pattern, length) {
  return (
    pattern.length === length && pattern.every((level) => Number.isInteger(level) && level >= 0 && level <= MAX_LEVEL)
  );
}

test('patternGene(): its length and levels kept at any depth, from any pattern, the same seed the same pattern', () => {
  const gene = patternGene(MAX_LEVEL);
  const patterns = [ACCENTS, [0, 0, 0, 0], [3, 3, 3, 3], [0], [3]];
  for (const seed of SEEDS) {
    for (const pattern of patterns) {
      for (const depth of [0.2, 1]) {
        const moved = gene.mutate(pattern, depth, seededRandomness(seed));
        assert.ok(isInBounds(moved, pattern.length), `${moved.join()} from ${pattern.join()}, seed ${seed}`);
        assert.deepEqual(moved, gene.mutate(pattern, depth, seededRandomness(seed)));
      }
    }
  }
  assert.deepEqual(ACCENTS, [3, 0, 1, 0, 2, 0, 0, 1], 'the pattern handed in is left as it was');
});

test('patternGene(): at depth 0 nothing changes; at depth 1 something does, nearly always', () => {
  const gene = patternGene(MAX_LEVEL);
  for (const seed of SEEDS) {
    assert.deepEqual(gene.mutate(ACCENTS, 0, seededRandomness(seed)), ACCENTS, `seed ${seed}`);
  }
  const changed = SEEDS.filter((seed) => gene.mutate(ACCENTS, 1, seededRandomness(seed)).join() !== ACCENTS.join());
  assert.ok(changed.length > SEEDS.length * 0.9, `${changed.length} of ${SEEDS.length}`);
  const sometimes = SEEDS.filter((seed) => gene.mutate(ACCENTS, 0.4, seededRandomness(seed)).join() !== ACCENTS.join());
  assert.ok(
    sometimes.length > 90 && sometimes.length < 150,
    `a change with a chance of the depth: ${sometimes.length}`,
  );
});

test('patternGene(): a toggle moves one step a level up or down, turning back at 0 and at the top', () => {
  const gene = patternGene(MAX_LEVEL);
  // a change, the toggle, step 2 (2 / 8 = 0.25), then up (≥ 0.5) or down
  assert.deepEqual(gene.mutate(ACCENTS, 1, scripted([0, TOGGLE, 0.25, 0.9])), [3, 0, 2, 0, 2, 0, 0, 1]);
  assert.deepEqual(gene.mutate(ACCENTS, 1, scripted([0, TOGGLE, 0.25, 0.1])), [3, 0, 0, 0, 2, 0, 0, 1]);
  assert.deepEqual(gene.mutate(ACCENTS, 1, scripted([0, TOGGLE, 0.125, 0.1])), [3, 1, 1, 0, 2, 0, 0, 1], 'up from 0');
  assert.deepEqual(
    gene.mutate(ACCENTS, 1, scripted([0, TOGGLE, 0, 0.9])),
    [2, 0, 1, 0, 2, 0, 0, 1],
    'down from the top',
  );
});

test('patternGene(): a move takes a hit to the neighbor asked, else the other, only onto a rest; the levels and their count kept', () => {
  const gene = patternGene(MAX_LEVEL);
  // the hits are at steps 0, 2, 4, 7: the third (2 / 4 = 0.5) is step 4, then left (< 0.5) or right
  assert.deepEqual(gene.mutate(ACCENTS, 1, scripted([0, MOVE, 0.5, 0.1])), [3, 0, 1, 2, 0, 0, 0, 1]);
  assert.deepEqual(gene.mutate(ACCENTS, 1, scripted([0, MOVE, 0.5, 0.9])), [3, 0, 1, 0, 0, 2, 0, 1]);
  // step 0 asked left: past the start, so right
  assert.deepEqual(gene.mutate(ACCENTS, 1, scripted([0, MOVE, 0, 0.1])), [0, 3, 1, 0, 2, 0, 0, 1]);
  // step 1 between two hits: nowhere to go
  assert.deepEqual(gene.mutate([2, 1, 2], 1, scripted([0, MOVE, 0.4, 0.1])), [2, 1, 2]);
  assert.deepEqual(gene.mutate([0, 0, 0], 1, scripted([0, MOVE])), [0, 0, 0], 'no hit to move');
  for (const seed of SEEDS) {
    const randomness = seededRandomness(seed);
    const moved = gene.mutate(ACCENTS, 1, scripted([0, MOVE, randomness.next(), randomness.next()]));
    assert.deepEqual([...moved].sort(), [...ACCENTS].sort(), `seed ${seed}`);
  }
});

test('patternGene(): density adds a hit on a rest at a level from 1 to the top, or takes one away; one hit either way', () => {
  const gene = patternGene(MAX_LEVEL);
  // up (≥ 0.5): the rests are steps 1, 3, 5, 6; the second (1 / 4 = 0.25) is step 3, at the top level (≥ 2 / 3)
  assert.deepEqual(gene.mutate(ACCENTS, 1, scripted([0, DENSITY, 0.9, 0.25, 0.9])), [3, 0, 1, 3, 2, 0, 0, 1]);
  // down: the hits are steps 0, 2, 4, 7; the last (3 / 4 = 0.75) is step 7
  assert.deepEqual(gene.mutate(ACCENTS, 1, scripted([0, DENSITY, 0.1, 0.75])), [3, 0, 1, 0, 2, 0, 0, 0]);
  assert.deepEqual(gene.mutate([3, 3], 1, scripted([0, DENSITY, 0.9, 0])), [0, 3], 'no rest to fill: one taken away');
  assert.deepEqual(gene.mutate([0, 0], 1, scripted([0, DENSITY, 0.1, 0.5, 0])), [0, 1], 'no hit to take: one added');
  for (const seed of SEEDS) {
    const randomness = seededRandomness(seed);
    const changed = gene.mutate(
      ACCENTS,
      1,
      scripted([0, DENSITY, ...Array.from({ length: 3 }, () => randomness.next())]),
    );
    assert.equal(Math.abs(hitsOf(changed) - hitsOf(ACCENTS)), 1, `seed ${seed}`);
  }
});

test('patternGene(): a cross takes a segment from one parent and the rest from the other, the same seed the same child', () => {
  const gene = patternGene(MAX_LEVEL);
  const quiet = [0, 0, 0, 0, 0, 0, 0, 0];
  const loud = [2, 2, 2, 2, 2, 2, 2, 2];
  const mixed = [];
  for (const seed of SEEDS) {
    const child = gene.cross(quiet, loud, seededRandomness(seed));
    assert.equal(child.length, 8);
    assert.ok(
      child.every((level) => level === 0 || level === 2),
      child.join(),
    );
    // one segment from a parent: the levels change at most twice along it
    const changes = child.filter((level, step) => step > 0 && level !== child[step - 1]).length;
    assert.ok(changes <= 2, child.join());
    assert.deepEqual(child, gene.cross(quiet, loud, seededRandomness(seed)));
    if (changes > 0) {
      mixed.push(seed);
    }
  }
  assert.ok(mixed.length > SEEDS.length / 2, `most children hold both parents: ${mixed.length}`);
});

test('patternGene(): in a genome, mutate() and a Lineage move it as any gene, within its bounds', () => {
  const schema = { shared: { accents: patternGene(MAX_LEVEL), voices: wholeGene(1, 4) } };
  const base = { shared: { accents: ACCENTS, voices: 2 } };
  const moved = SEEDS.slice(0, 50).map((seed) => mutate(base, schema, 1, seededRandomness(seed)));
  assert.ok(moved.every(({ shared }) => isInBounds(shared.accents, 8)));
  assert.ok(moved.some(({ shared }) => shared.accents.join() !== ACCENTS.join()));
  assert.deepEqual(mutate(base, schema, 1, seededRandomness(4)), mutate(base, schema, 1, seededRandomness(4)));

  const lineage = new Lineage(base, schema);
  lineage.mutate(0.5, seededRandomness(1));
  lineage.mutate(0.5, seededRandomness(2));
  lineage.cross(0, seededRandomness(3));
  assert.deepEqual(
    lineage.entries.map(({ label }) => label),
    ['origin', 'mutated', 'mutated', 'crossed'],
  );
  for (const { genome } of lineage.entries) {
    assert.ok(isInBounds(genome.shared.accents, 8), genome.shared.accents.join());
  }
  assert.ok(isInBounds(lineage.flat.accents, 8));
});
