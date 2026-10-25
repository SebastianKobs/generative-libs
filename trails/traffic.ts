// ---------- libs/generative/trails/traffic: where agents ran, on a grid finer than the simulation's ----------

// The traffic grid's side: finer than the simulation's, for hairlines
export const TRAFFIC_GRID = 640;

const TRAFFIC_PER_PASS = 0.22; // one agent crossing a point
const SPLATS_PER_CELL = 2; // a splat every half traffic cell along a step

// An agent's step as a hairline: a bilinear splat (each splat shared among the four cells round it,
// by how near) every half traffic cell along it, so it is a cell wide and smooth without a blur pass.
// The step's ends are in the simulation's cells, on a grid `trailGrid` cells a side.
export function recordTraffic(
  traffic: Float32Array,
  trailGrid: number,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): void {
  const perCell = TRAFFIC_GRID / trailGrid;
  const length = Math.hypot(to.x - from.x, to.y - from.y) * perCell;
  const pieces = Math.max(1, Math.ceil(length * SPLATS_PER_CELL));
  const weight = TRAFFIC_PER_PASS / pieces / 2;
  for (let piece = 0; piece < pieces; piece++) {
    const along = (piece + 0.5) / pieces;
    const x = (from.x + (to.x - from.x) * along) * perCell - 0.5;
    const y = (from.y + (to.y - from.y) * along) * perCell - 0.5;
    splat(traffic, x, y, weight);
  }
}

// Every cell's traffic fades by `factor`; the strongest cell it leaves
export function fadeTraffic(traffic: Float32Array, factor: number): number {
  let strongest = 0;
  for (let cell = 0; cell < traffic.length; cell++) {
    traffic[cell] = (traffic[cell] ?? 0) * factor;
    strongest = Math.max(strongest, traffic[cell] ?? 0);
  }
  return strongest;
}

// A weight shared among the four cells round (x, y); none at the grid's last row and column
function splat(traffic: Float32Array, x: number, y: number, weight: number): void {
  const column = Math.floor(x);
  const row = Math.floor(y);
  if (column < 0 || row < 0 || column >= TRAFFIC_GRID - 1 || row >= TRAFFIC_GRID - 1) {
    return;
  }
  const right = x - column;
  const down = y - row;
  const at = row * TRAFFIC_GRID + column;
  addTo(traffic, at, weight * (1 - right) * (1 - down) * 2);
  addTo(traffic, at + 1, weight * right * (1 - down) * 2);
  addTo(traffic, at + TRAFFIC_GRID, weight * (1 - right) * down * 2);
  addTo(traffic, at + TRAFFIC_GRID + 1, weight * right * down * 2);
}

function addTo(traffic: Float32Array, cell: number, amount: number): void {
  traffic[cell] = (traffic[cell] ?? 0) + amount;
}
