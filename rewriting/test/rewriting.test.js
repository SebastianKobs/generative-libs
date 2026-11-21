// Rewriting (generative/rewriting/): an L-system's letters rewritten by a production
// rule, each keeping an id through the generations; a production as a gene, mutated within its limits
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { letter, productionGene, rewrite } from '../index.ts';
import { seededRandomness } from '../../randomness/test/seeded-randomness.js';

// Konstrukt's vines' limits: the parts a production may hold, and how much it may branch
const KONSTRUKT = {
  parts: ['F', '[+B]', '[-B]', '[+F]', '[-F]', '[B]'],
  minParts: 3,
  maxParts: 7,
  variable: 'B',
  minVariables: 1,
  maxVariables: 3,
};
const SEEDS = Array.from({ length: 100 }, (_, seed) => seed + 1);

// a production's parts: a bracketed branch or one character
function partsOf(production) {
  return production.match(/\[[^\]]*\]|./g) ?? [];
}

function isBalanced(production) {
  let depth = 0;
  for (const character of production) {
    if (character === '[') {
      depth++;
    }
    if (character === ']') {
      depth--;
    }
    if (depth < 0) {
      return false;
    }
  }
  return depth === 0;
}

test("rewrite() keeps a staying letter's id, names a grown one by its parent and place, with the generation it was born in", () => {
  const axiom = [letter('F', '0', 0), letter('B', '1', 0)];
  const first = rewrite(axiom, 'F[+B]', 1);
  assert.deepEqual(
    first.map(({ character, id, born }) => `${character} ${id} ${born}`),
    ['F 0 0', 'F 1.0 1', '[ 1.1 1', '+ 1.2 1', 'B 1.3 1', '] 1.4 1'],
  );
  const second = rewrite(axiom, 'F[+B]', 2);
  assert.deepEqual(
    second.map(({ character, id, born }) => `${character} ${id} ${born}`),
    [
      'F 0 0',
      'F 1.0 1',
      '[ 1.1 1',
      '+ 1.2 1',
      'F 1.3.0 2',
      '[ 1.3.1 2',
      '+ 1.3.2 2',
      'B 1.3.3 2',
      '] 1.3.4 2',
      '] 1.4 1',
    ],
  );
});

test('rewrite() rewrites the variable it is given, and a generation of none gives the axiom back, not the same array', () => {
  const axiom = [letter('X', 'a', 0), letter('B', 'b', 0)];
  assert.deepEqual(
    rewrite(axiom, 'FX', 1, 'X').map(({ id }) => id),
    ['a.0', 'a.1', 'b'],
  );
  const none = rewrite(axiom, 'F', 0);
  assert.deepEqual(none, axiom);
  assert.notEqual(none, axiom);
});

test("a production gene's mutation stays within its limits, its brackets balanced, over a hundred seeds", () => {
  const gene = productionGene(KONSTRUKT);
  let changes = 0;
  for (const seed of SEEDS) {
    const randomness = seededRandomness(seed);
    let production = 'F[+B][-B]F';
    for (let step = 0; step < 30; step++) {
      const mutated = gene.mutate(production, 1, randomness);
      if (mutated !== production) {
        changes++;
      }
      production = mutated;
      const parts = partsOf(production);
      const branching = parts.filter((part) => part.includes('B')).length;
      assert.ok(parts.length >= 3 && parts.length <= 7, `${production}: ${parts.length} parts`);
      assert.ok(branching >= 1 && branching <= 3, `${production}: ${branching} branching parts`);
      assert.ok(isBalanced(production), `${production} unbalanced`);
      assert.ok(
        parts.every((part) => KONSTRUKT.parts.includes(part)),
        `${production}: a part from outside`,
      );
    }
  }
  assert.ok(changes > 1000, `${changes} changes of 3000 tries`);
});

test('a production gene gives the same production for the same randomness, and ignores the depth', () => {
  const gene = productionGene(KONSTRUKT);
  for (const seed of SEEDS) {
    const first = gene.mutate('F[+B][-B]F', 0.2, seededRandomness(seed));
    assert.equal(gene.mutate('F[+B][-B]F', 0.2, seededRandomness(seed)), first);
    assert.equal(gene.mutate('F[+B][-B]F', 1.5, seededRandomness(seed)), first);
  }
});

test('a production already at a limit is left as it is where the change would pass it', () => {
  const gene = productionGene({ ...KONSTRUKT, minParts: 3, maxParts: 3, maxVariables: 1 });
  for (const seed of SEEDS) {
    const mutated = gene.mutate('F[+B]F', 1, seededRandomness(seed));
    const parts = partsOf(mutated);
    assert.equal(parts.length, 3);
    assert.ok(parts.filter((part) => part.includes('B')).length <= 1);
  }
});
