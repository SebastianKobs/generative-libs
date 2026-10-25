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

// A weight shared among the four cells round (x, y), a cell's centre at its index.
//   1. A point past the plane is dropped: a step crossing a seam is laid by both fields, each its own part.
//   2. A point's share falling past the plane goes to the edge cell beside it, so an edge cell gets as much as one inside:
//      dropped, the edge cells got half, and the tiles' seams showed as dark lines across the threads.
function splat(traffic: Float32Array, x: number, y: number, weight: number): void {
  if (!onPlane(x) || !onPlane(y)) {
    return;
  }
  const column = Math.floor(x);
  const row = Math.floor(y);
  const right = x - column;
  const down = y - row;
  const [left, next] = [inGrid(column), inGrid(column + 1)];
  const [top, below] = [inGrid(row) * TRAFFIC_GRID, inGrid(row + 1) * TRAFFIC_GRID];
  addTo(traffic, top + left, weight * (1 - right) * (1 - down) * 2);
  addTo(traffic, top + next, weight * right * (1 - down) * 2);
  addTo(traffic, below + left, weight * (1 - right) * down * 2);
  addTo(traffic, below + next, weight * right * down * 2);
}

// a cell spans half a cell either side of its centre
function onPlane(at: number): boolean {
  return at >= -0.5 && at < TRAFFIC_GRID - 0.5;
}
function inGrid(cell: number): number {
  return Math.min(TRAFFIC_GRID - 1, Math.max(0, cell));
}

function addTo(traffic: Float32Array, cell: number, amount: number): void {
  traffic[cell] = (traffic[cell] ?? 0) + amount;
}
