// libs/generative/trails/traffic.ts: where agents ran, on a grid finer than the field's, the traffic fading as one gain
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAFFIC_GRID, Traffic, TrailField } from '../index.ts';
import { near } from '../../../base/util/test/near.js';
import { STEPS, sameTraffic, total } from './trails.js';

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

test('a line across the plane leaves as much traffic in the edge cells as in the middle: no dark line at a seam', () => {
  const grid = TrailField.grid;
  const lineAcross = new Traffic(grid);
  lineAcross.record({ x: 0, y: grid / 2 + 0.3 }, { x: grid, y: grid / 2 + 0.3 });
  const across = lineAcross.values;
  const middle = columnOf(across, TRAFFIC_GRID / 2);
  for (const edge of [0, TRAFFIC_GRID - 1]) {
    const edgeColumn = columnOf(across, edge);
    near(edgeColumn, middle, `column ${edge}: ${edgeColumn} against ${middle}`, 0.05 * middle);
  }
  const lineDown = new Traffic(grid);
  lineDown.record({ x: grid / 2 + 0.3, y: 0 }, { x: grid / 2 + 0.3, y: grid });
  const down = lineDown.values;
  for (const edge of [0, TRAFFIC_GRID - 1]) {
    const edgeRow = rowOf(down, edge);
    near(edgeRow, middle, `row ${edge}: ${edgeRow} against ${middle}`, 0.05 * middle);
  }
});

test("a step's part past the plane leaves nothing in this field's traffic: the field beyond lays it", () => {
  const grid = TrailField.grid;
  const traffic = new Traffic(grid);
  traffic.record({ x: grid + 0.2, y: 40 }, { x: grid + 3, y: 41 });
  traffic.record({ x: 40, y: -3 }, { x: 41, y: -0.2 });
  assert.equal(total(traffic.values), 0);
});

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
    near(value, reference[cell], `cell ${cell}: ${value} against ${reference[cell]}`, 1e-6);
    strongest = Math.max(strongest, value);
  });
  near(traffic.strongest, strongest, `${traffic.strongest} against ${strongest}`, 1e-7);
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
  near(traffic.strongest, strongest, '', 1e-7);
});

test('reading the traffic changes nothing that comes after: the same traffic read every quantum or never', () => {
  const factor = 0.965 ** 4;
  assert.ok(sameTraffic(fadedOver(300, factor, 1).values, fadedOver(300, factor).values));
});
