// Paths (paths/): the cheapest path through layers of choices (Viterbi), with anchors, forbidden moves
// and a clear answer when no path is left
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cheapestPath } from '../index.ts';
import { seededRandomness } from '../../randomness/test/seeded-randomness.js';

// three layers of letters; an option's cost by its letter, a move's by how far apart the letters are
const LETTERS = [
  ['a', 'b', 'c'],
  ['a', 'b', 'c'],
  ['a', 'b', 'c'],
];
const LETTER_COSTS = { a: 3, b: 1, c: 2 };
function letterCost(_layer, option) {
  return LETTER_COSTS[option];
}
function distance(_layer, previous, option) {
  return Math.abs(previous.charCodeAt(0) - option.charCodeAt(0)) * 2;
}

test('cheapestPath(): a small case by hand, an option and its moves each counted once', () => {
  // b costs least and staying costs nothing: b, b, b costs 1 + 1 + 1; a, b, a would cost 3 + 2 + 1 + 2 + 3 = 11
  assert.deepEqual(cheapestPath({ layers: LETTERS, optionCost: letterCost, moveCost: distance }), {
    found: true,
    options: ['b', 'b', 'b'],
    cost: 3,
  });
  // layer 1 makes b dear: c, c, c costs 2 + 2 + 2 = 6; b, c, b 1 + 2 + 2 + 2 + 1 = 8; b, b, b 1 + 10 + 1 = 12
  const dearMiddle = (layer, option) => (layer === 1 && option === 'b' ? 10 : LETTER_COSTS[option]);
  assert.deepEqual(cheapestPath({ layers: LETTERS, optionCost: dearMiddle, moveCost: distance }), {
    found: true,
    options: ['c', 'c', 'c'],
    cost: 6,
  });
  // a move is handed the layer it moves into
  const moveLayers = [];
  cheapestPath({
    layers: LETTERS,
    optionCost: letterCost,
    moveCost: (layer, previous, option) => {
      moveLayers.push(layer);
      return distance(layer, previous, option);
    },
  });
  assert.deepEqual([...new Set(moveLayers)], [1, 2]);
});

test('cheapestPath(): options of any type, objects too, and no layers an empty path of cost 0', () => {
  const soft = { name: 'soft', cost: 1 };
  const loud = { name: 'loud', cost: 4 };
  const result = cheapestPath({
    layers: [
      [soft, loud],
      [loud, soft],
    ],
    optionCost: (_layer, option) => option.cost,
    moveCost: () => 0,
  });
  assert.deepEqual(result, { found: true, options: [soft, soft], cost: 2 });
  assert.equal(result.options[0], soft, 'the option itself, not a copy');
  assert.deepEqual(cheapestPath({ layers: [], optionCost: letterCost, moveCost: distance }), {
    found: true,
    options: [],
    cost: 0,
  });
});

test('cheapestPath(): an anchor fixes a layer to one option, or limits it to some, kept in the layer’s order', () => {
  const fixed = cheapestPath({ layers: LETTERS, optionCost: letterCost, moveCost: distance, anchors: { 0: ['a'] } });
  // a, b, b: 3 + 2 + 1 + 0 + 1 = 7; a, a, a: 9; unanchored it would be b, b, b
  assert.deepEqual(fixed, { found: true, options: ['a', 'b', 'b'], cost: 7 });
  const limited = cheapestPath({
    layers: LETTERS,
    optionCost: letterCost,
    moveCost: distance,
    anchors: { 1: ['c', 'a'], 2: ['b'] },
  });
  // c, c, b: 2 + 0 + 2 + 2 + 1 = 7; a, a, b: 3 + 0 + 3 + 2 + 1 = 9
  assert.deepEqual(limited, { found: true, options: ['c', 'c', 'b'], cost: 7 });
});

test('cheapestPath(): an Infinity cost forbids an option or a move; the path goes round it', () => {
  const noRepeat = (layer, previous, option) => (previous === option ? Infinity : distance(layer, previous, option));
  // no option twice in a row: b, c, b costs 1 + 2 + 2 + 2 + 1 = 8, b, a, b 9, c, b, c 9
  assert.deepEqual(cheapestPath({ layers: LETTERS, optionCost: letterCost, moveCost: noRepeat }), {
    found: true,
    options: ['b', 'c', 'b'],
    cost: 8,
  });
  const noB = (layer, option) => (option === 'b' ? Infinity : LETTER_COSTS[option]);
  // c, c, c: 6; a, a, a: 9
  assert.deepEqual(cheapestPath({ layers: LETTERS, optionCost: noB, moveCost: distance }), {
    found: true,
    options: ['c', 'c', 'c'],
    cost: 6,
  });
});

test('cheapestPath(): no path, when every one is forbidden, names the first layer none reaches', () => {
  const intoTwo = (layer) => (layer === 2 ? Infinity : 0);
  assert.deepEqual(cheapestPath({ layers: LETTERS, optionCost: letterCost, moveCost: intoTwo }), {
    found: false,
    blockedAt: 2,
  });
  assert.deepEqual(
    cheapestPath({ layers: LETTERS, optionCost: letterCost, moveCost: distance, anchors: { 1: ['z'] } }),
    { found: false, blockedAt: 1 },
    'an anchor to an option the layer lacks leaves it none',
  );
  assert.deepEqual(cheapestPath({ layers: [['a'], []], optionCost: letterCost, moveCost: distance }), {
    found: false,
    blockedAt: 1,
  });
  assert.deepEqual(cheapestPath({ layers: LETTERS, optionCost: () => Infinity, moveCost: distance }), {
    found: false,
    blockedAt: 0,
  });
});

test('cheapestPath(): of paths that cost the same, the one whose last option comes first, then going back, the option before it', () => {
  const free = () => 0;
  assert.deepEqual(cheapestPath({ layers: LETTERS, optionCost: free, moveCost: free }).options, ['a', 'a', 'a']);
  // (b, a) and (a, b) cost 1, the rest more: the last option a comes first, so b, a
  const crossed = (_layer, previous, option) => (previous === option ? 5 : 1);
  assert.deepEqual(
    cheapestPath({
      layers: [
        ['a', 'b'],
        ['a', 'b'],
      ],
      optionCost: free,
      moveCost: crossed,
    }).options,
    ['b', 'a'],
  );
});

test('cheapestPath(): the same cost and path as every path tried, on seeded layers with some options and moves forbidden', () => {
  const randomness = seededRandomness(17);
  const drawWhole = (below) => Math.floor(randomness.next() * below);
  for (let round = 0; round < 60; round++) {
    const layers = Array.from({ length: 1 + drawWhole(5) }, () =>
      Array.from({ length: 1 + drawWhole(4) }, (_, i) => i),
    );
    // whole costs, so every sum is exact and ties are true ties; about one in six forbidden
    const optionCosts = layers.map((options) => options.map(() => costDrawn(drawWhole)));
    const moveCosts = layers.map((options, layer) =>
      options.map(() => (layers[layer - 1] ?? []).map(() => costDrawn(drawWhole))),
    );
    const optionCost = (layer, option) => optionCosts[layer][option];
    const moveCost = (layer, previous, option) => moveCosts[layer][option][previous];
    const result = cheapestPath({ layers, optionCost, moveCost });
    const best = bruteForce(layers, optionCost, moveCost);
    if (best === undefined) {
      assert.equal(result.found, false, `round ${round}`);
      continue;
    }
    assert.deepEqual(result, { found: true, options: best.options, cost: best.cost }, `round ${round}`);
  }
});

function costDrawn(drawWhole) {
  if (drawWhole(6) === 0) {
    return Infinity;
  }
  return drawWhole(10);
}
// Every path tried: the cheapest, of equal ones the first by the tie rule (the last option first, then back)
function bruteForce(layers, optionCost, moveCost) {
  let best;
  for (const options of everyPath(layers)) {
    const cost = options.reduce(
      (sum, option, layer) =>
        sum + (layer === 0 ? 0 : moveCost(layer, options[layer - 1], option)) + optionCost(layer, option),
      0,
    );
    if (cost === Infinity) {
      continue;
    }
    if (best === undefined || cost < best.cost || (cost === best.cost && comesFirst(options, best.options))) {
      best = { options, cost };
    }
  }
  return best;
}
function* everyPath(layers, done = []) {
  if (done.length === layers.length) {
    yield done;
    return;
  }
  for (const option of layers[done.length]) {
    yield* everyPath(layers, [...done, option]);
  }
}
// read from the last layer back, the first place they differ decides; the options are their places
function comesFirst(options, others) {
  for (let layer = options.length - 1; layer >= 0; layer--) {
    if (options[layer] !== others[layer]) {
      return options[layer] < others[layer];
    }
  }
  return false;
}
