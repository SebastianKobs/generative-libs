// ---------- libs/generative/trails/traffic: where agents ran, on a grid finer than the simulation's ----------

// The traffic grid's side: finer than the simulation's, for hairlines
export const TRAFFIC_GRID = 640;

const TRAFFIC_PER_PASS = 0.22; // one agent crossing a point
const SPLATS_PER_CELL = 2; // a splat every half traffic cell along a step

const RENORMALISE_BELOW = 1e-6; // the shared gain this small: brought back to 1, the cells with it, before they grow past a float

// Where agents ran, on a grid `TRAFFIC_GRID` cells a side, fading as one.
//   1. Stored as cells times one shared gain: a fade multiplies every cell alike, so it turns the gain down,
//      not each of the 410 000 cells (a master fader, not every channel's own).
//   2. A step laid is divided by the gain as it's stored, so it reads at its own strength.
//   3. The strongest cell is kept as it goes: a fade scales it as it scales every cell, a step can only raise it.
//   4. Read, the cells are worked out once into a copy, so reading changes nothing that comes after.
export class Traffic {
  readonly #trailGrid: number;
  readonly #cells = new Float32Array(TRAFFIC_GRID * TRAFFIC_GRID); // each cell's traffic ÷ the gain
  #gain = 1;
  #strongestCell = 0; // the strongest of #cells, before the gain
  #read: Float32Array | undefined; // the cells times the gain, as last worked out; dropped by any change
  #readFresh = false;

  // trailGrid: the simulation's cells a side, the grid a step's ends are in
  constructor(trailGrid: number) {
    this.#trailGrid = trailGrid;
  }
  // each cell's traffic
  get values(): Readonly<Float32Array> {
    if (this.#gain === 1) {
      return this.#cells;
    }
    if (!this.#readFresh) {
      this.#read ??= new Float32Array(this.#cells.length);
      for (let cell = 0; cell < this.#cells.length; cell++) {
        this.#read[cell] = (this.#cells[cell] ?? 0) * this.#gain;
      }
      this.#readFresh = true;
    }
    return this.#read ?? this.#cells;
  }
  // the strongest cell's traffic, rounded to a float as each cell read is
  get strongest(): number {
    return Math.fround(this.#strongestCell * this.#gain);
  }
  // An agent's step as a hairline: a bilinear splat (each splat shared among the four cells round it,
  // by how near) every half traffic cell along it, so it is a cell wide and smooth without a blur pass.
  record(from: { readonly x: number; readonly y: number }, to: { readonly x: number; readonly y: number }): void {
    const perCell = TRAFFIC_GRID / this.#trailGrid;
    const length = Math.hypot(to.x - from.x, to.y - from.y) * perCell;
    const pieces = Math.max(1, Math.ceil(length * SPLATS_PER_CELL));
    const weight = TRAFFIC_PER_PASS / pieces / 2 / this.#gain;
    for (let piece = 0; piece < pieces; piece++) {
      const along = (piece + 0.5) / pieces;
      const x = (from.x + (to.x - from.x) * along) * perCell - 0.5;
      const y = (from.y + (to.y - from.y) * along) * perCell - 0.5;
      this.#splat(x, y, weight);
    }
    this.#readFresh = false;
  }
  // every cell faded by `factor`; the strongest cell it leaves
  fade(factor: number): number {
    this.#gain *= factor;
    this.#readFresh = false;
    if (this.#gain < RENORMALISE_BELOW) {
      this.#renormalise();
    }
    return this.strongest;
  }
  clear(): void {
    this.#cells.fill(0);
    this.#gain = 1;
    this.#strongestCell = 0;
    this.#readFresh = false;
  }
  #renormalise(): void {
    for (let cell = 0; cell < this.#cells.length; cell++) {
      this.#cells[cell] = (this.#cells[cell] ?? 0) * this.#gain;
    }
    this.#strongestCell = Math.fround(this.#strongestCell * this.#gain);
    this.#gain = 1;
  }
  // A weight shared among the four cells round (x, y), a cell's centre at its index.
  //   1. A point past the plane is dropped: a step crossing a seam is laid by both fields, each its own part.
  //   2. A point's share falling past the plane goes to the edge cell beside it, so an edge cell gets as much as one inside:
  //      dropped, the edge cells got half, and the tiles' seams showed as dark lines across the threads.
  #splat(x: number, y: number, weight: number): void {
    if (!onPlane(x) || !onPlane(y)) {
      return;
    }
    const column = Math.floor(x);
    const row = Math.floor(y);
    const right = x - column;
    const down = y - row;
    const [left, next] = [inGrid(column), inGrid(column + 1)];
    const [top, below] = [inGrid(row) * TRAFFIC_GRID, inGrid(row + 1) * TRAFFIC_GRID];
    this.#addTo(top + left, weight * (1 - right) * (1 - down) * 2);
    this.#addTo(top + next, weight * right * (1 - down) * 2);
    this.#addTo(below + left, weight * (1 - right) * down * 2);
    this.#addTo(below + next, weight * right * down * 2);
  }
  #addTo(cell: number, amount: number): void {
    this.#cells[cell] = (this.#cells[cell] ?? 0) + amount;
    this.#strongestCell = Math.max(this.#strongestCell, this.#cells[cell] ?? 0); // as stored, a float
  }
}

// a cell spans half a cell either side of its centre
function onPlane(at: number): boolean {
  return at >= -0.5 && at < TRAFFIC_GRID - 0.5;
}
function inGrid(cell: number): number {
  return Math.min(TRAFFIC_GRID - 1, Math.max(0, cell));
}
