// Automata (generative/automata/): a one-row automaton, the next row by a rule number,
// and a rule as a gene, one bit flipped
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextRow, ruleGene } from '../index.ts';
import { seededRandomness } from '../../randomness/test/seeded-randomness.js';

const SEEDS = Array.from({ length: 200 }, (_, seed) => seed + 1);

function oneCell(length, at) {
  return Uint8Array.from({ length }, (_, cell) => (cell === at ? 1 : 0));
}

function bitsSet(number) {
  return number.toString(2).split('1').length - 1;
}

test('rule 90 from one cell gives the Sierpinski rows: both neighbours, then every second cell; rule 0 empties a row and rule 255 fills it', () => {
  const first = nextRow(oneCell(9, 4), 90);
  assert.deepEqual([...first], [0, 0, 0, 1, 0, 1, 0, 0, 0]);
  assert.deepEqual([...nextRow(first, 90)], [0, 0, 1, 0, 0, 0, 1, 0, 0]);
  assert.deepEqual([...nextRow(nextRow(first, 90), 90)], [0, 1, 0, 1, 0, 1, 0, 1, 0]);
  assert.deepEqual([...nextRow(oneCell(6, 2), 0)], [0, 0, 0, 0, 0, 0]);
  assert.deepEqual([...nextRow(oneCell(6, 2), 255)], [1, 1, 1, 1, 1, 1]);
});

test('nextRow() wraps round: a cell at the end is a neighbour of the one at the start', () => {
  assert.deepEqual([...nextRow(oneCell(8, 0), 90)], [0, 1, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual([...nextRow(oneCell(8, 7), 90)], [1, 0, 0, 0, 0, 0, 1, 0]);
});

test('nextRow() gives a new row and leaves the row given unchanged', () => {
  const row = oneCell(16, 8);
  const next = nextRow(row, 30);
  assert.notEqual(next, row);
  assert.deepEqual([...row], [...oneCell(16, 8)]);
  assert.equal(next.length, 16);
});

test('a rule gene flips exactly one bit and stays within 0 to 255, whatever the depth; the same rule for the same randomness', () => {
  const gene = ruleGene();
  const flipped = new Set();
  for (const seed of SEEDS) {
    assert.equal(gene.mutate(90, 1, seededRandomness(seed)), gene.mutate(90, 1, seededRandomness(seed)));
    for (const rule of [0, 90, 110, 255]) {
      const mutated = gene.mutate(rule, seed % 3, seededRandomness(seed));
      assert.ok(Number.isInteger(mutated) && mutated >= 0 && mutated <= 255, `${mutated}`);
      assert.equal(bitsSet(mutated ^ rule), 1, `${rule} to ${mutated}`);
      flipped.add(mutated ^ rule);
    }
  }
  assert.equal(flipped.size, 8, 'every one of the eight bits is reached');
});
