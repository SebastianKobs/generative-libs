// ---------- libs/generative/trails/trail-field: a slime mould's agents on a field ----------

import type { Randomness } from '../randomness/index.ts';
import { fadeTraffic, recordTraffic, TRAFFIC_GRID } from './traffic.ts';

// What the mould does, changeable as it runs
//   sense: how far ahead an agent smells, in the field's cells (tuned on a grid 112 cells a side)
//   sensorAngle: how wide it looks, in radians either side of its heading
//   turn: how hard it turns towards the stronger side, in radians
//   fade: how much of a thread is left after a step (0 to 1, near 1 lasts long)
//   perSeed: how many agents a seed lets loose
export interface TrailRules {
  readonly sense: number;
  readonly sensorAngle: number;
  readonly turn: number;
  readonly fade: number;
  readonly perSeed: number;
}

// What a caller has told that no quantum has run yet
interface Told {
  readonly kind: 'food' | 'seed';
  readonly x: number;
  readonly y: number;
}

const GRID = 160; // the field's cells a side
const GRID_TUNED_ON = 112; // the distances below were tuned on this many cells a side
const SCALE = GRID / GRID_TUNED_ON;
const QUANTUM_BEATS = 0.5;
const STEPS_PER_QUANTUM = 4;
const MAX_AGENTS = 700;
const SPEED = 1.1; // cells a step
const DEPOSIT = 0.3; // what an agent leaves in the cell it steps into
const TRAIL_CAP = 3;
const FOOD_WEIGHT = 0.5; // how much a cell's food counts against its trail, when an agent smells it
const FOOD_REACH = 44; // cells round a food it is spread over
const HEARTH = { height: 1, width: 41 }; // a narrow hearth ...
const SCENT = { height: 0.08, width: 530 }; // ... and a wide, faint scent: what draws threads between plants
const SEED_SCATTER = 3; // cells a seed's agents start apart
const KEEP_OWN = 0.94; // diffusing, a cell keeps this much of itself ...
const GIVEN_BY_NEIGHBOUR = 0.015; // ... and takes this much of each of its four neighbours
const EDGE_MARGIN = 1; // cells from the edge an agent turns away

// A slime mould (Physarum, after Jeff Jones's 2010 model): agents sense the trail ahead, left and
// right, turn towards the strongest, step and deposit; the trail diffuses a little and fades slowly.
// Food, a hearth and a wide, faint scent, draws them; each seed lets a few more loose. The threads
// that grow link the foods.
// The field is a plane, 0 to 1 by 0 to 1, its edges turning an agent away. A run goes forward only, in
// half-beat quanta, and keeps no copy of its past: the same events told at the same beats give the
// same trails, however its caller's frames fall.
// The caller tells each event, `advanceTo(its beat)` then `food()` or `seed()`, before advancing past
// it. An event told is run in the next quantum.
export class TrailField {
  readonly #draws: Randomness;
  readonly #trail = new Float32Array(GRID * GRID);
  readonly #scratch = new Float32Array(GRID * GRID);
  readonly #food = new Float32Array(GRID * GRID);
  readonly #traffic = new Float32Array(TRAFFIC_GRID * TRAFFIC_GRID);
  readonly #agentX = new Float32Array(MAX_AGENTS);
  readonly #agentY = new Float32Array(MAX_AGENTS);
  readonly #heading = new Float32Array(MAX_AGENTS);
  readonly #told: Told[] = [];
  #rules: TrailRules;
  #agents = 0;
  #oldest = 0; // the next agent to be let go once MAX_AGENTS are loose
  #quanta = 0;

  // The agents' draws come from `randomness`, on a stream of their own
  constructor(rules: TrailRules, randomness: Randomness) {
    this.#rules = rules;
    this.#draws = randomness.fork('agents');
  }

  // where agents ran, TRAFFIC_GRID cells a side, row by row: read, don't change
  get traffic(): Readonly<Float32Array> {
    return this.#traffic;
  }
  get rules(): TrailRules {
    return this.#rules;
  }
  // counts from the next quantum on
  set rules(rules: TrailRules) {
    this.#rules = rules;
  }

  // A food at (x, y): a hearth and a scent agents are drawn to (a plant is born there)
  food(x: number, y: number): void {
    this.#told.push({ kind: 'food', x, y });
  }
  // A seed at (x, y): `perSeed` agents let loose there (a note played there)
  seed(x: number, y: number): void {
    this.#told.push({ kind: 'seed', x, y });
  }

  // Runs every quantum that ends by `beat`; a beat already reached does nothing
  advanceTo(beat: number): void {
    const target = Math.floor(beat / QUANTUM_BEATS);
    while (this.#quanta < target) {
      this.#runQuantum();
    }
  }

  #runQuantum(): void {
    for (const told of this.#told.splice(0)) {
      this.#apply(told);
    }
    for (let step = 0; step < STEPS_PER_QUANTUM; step++) {
      this.#moveAgents();
      diffuseAndFade(this.#trail, this.#scratch, this.#rules.fade);
    }
    fadeTraffic(this.#traffic, this.#rules.fade ** STEPS_PER_QUANTUM);
    this.#quanta++;
  }

  #apply({ kind, x, y }: Told): void {
    if (kind === 'food') {
      addFood(this.#food, x, y);
      return;
    }
    for (let agent = 0; agent < this.#rules.perSeed; agent++) {
      this.#letLoose(x, y);
    }
  }

  // Once MAX_AGENTS are loose, the oldest goes first
  #letLoose(x: number, y: number): void {
    const slot = this.#agents < MAX_AGENTS ? this.#agents++ : this.#oldest++ % MAX_AGENTS;
    this.#agentX[slot] = x * GRID + (this.#draws.next() - 0.5) * SEED_SCATTER;
    this.#agentY[slot] = y * GRID + (this.#draws.next() - 0.5) * SEED_SCATTER;
    this.#heading[slot] = this.#draws.next() * Math.PI * 2;
  }

  #moveAgents(): void {
    for (let agent = 0; agent < this.#agents; agent++) {
      this.#steer(agent);
      this.#step(agent);
    }
  }

  // Turns towards the side that smells stronger; between two equal sides, by a coin
  #steer(agent: number): void {
    const { turn, sensorAngle } = this.#rules;
    const heading = cellAt(this.#heading, agent);
    const ahead = this.#smellFrom(agent, heading);
    const left = this.#smellFrom(agent, heading - sensorAngle);
    const right = this.#smellFrom(agent, heading + sensorAngle);
    const coin = this.#draws.next();
    if (ahead > left && ahead > right) {
      return;
    }
    if (ahead < left && ahead < right) {
      this.#heading[agent] = heading + (coin < 0.5 ? -turn : turn);
      return;
    }
    if (left > right) {
      this.#heading[agent] = heading - turn;
    } else if (right > left) {
      this.#heading[agent] = heading + turn;
    }
  }

  #smellFrom(agent: number, direction: number): number {
    const sense = this.#rules.sense * SCALE;
    const x = cellAt(this.#agentX, agent) + Math.cos(direction) * sense;
    const y = cellAt(this.#agentY, agent) + Math.sin(direction) * sense;
    const column = Math.floor(x);
    const row = Math.floor(y);
    if (column < 0 || row < 0 || column >= GRID || row >= GRID) {
      return 0;
    }
    const cell = row * GRID + column;
    return cellAt(this.#trail, cell) + cellAt(this.#food, cell) * FOOD_WEIGHT;
  }

  // Steps along its heading, leaving traffic and a deposit; at the edge, turns away to a new heading
  #step(agent: number): void {
    const from = { x: cellAt(this.#agentX, agent), y: cellAt(this.#agentY, agent) };
    const heading = cellAt(this.#heading, agent);
    const to = { x: from.x + Math.cos(heading) * SPEED, y: from.y + Math.sin(heading) * SPEED };
    if (to.x < EDGE_MARGIN || to.y < EDGE_MARGIN || to.x > GRID - 1 - EDGE_MARGIN || to.y > GRID - 1 - EDGE_MARGIN) {
      this.#heading[agent] = this.#draws.next() * Math.PI * 2;
      return;
    }
    recordTraffic(this.#traffic, GRID, from, to);
    this.#agentX[agent] = to.x;
    this.#agentY[agent] = to.y;
    const cell = Math.floor(to.y) * GRID + Math.floor(to.x);
    this.#trail[cell] = Math.min(TRAIL_CAP, cellAt(this.#trail, cell) + DEPOSIT);
  }
}

// A food's hearth and scent added to the cells round (x, y), on the plane 0 to 1
function addFood(food: Float32Array, x: number, y: number): void {
  const centreX = x * GRID;
  const centreY = y * GRID;
  for (
    let row = Math.max(0, Math.floor(centreY - FOOD_REACH));
    row <= Math.min(GRID - 1, Math.ceil(centreY + FOOD_REACH));
    row++
  ) {
    for (
      let column = Math.max(0, Math.floor(centreX - FOOD_REACH));
      column <= Math.min(GRID - 1, Math.ceil(centreX + FOOD_REACH));
      column++
    ) {
      const distanceSquared = (column - centreX) ** 2 + (row - centreY) ** 2;
      const hearth = HEARTH.height * Math.exp(-distanceSquared / HEARTH.width);
      const scent = SCENT.height * Math.exp(-distanceSquared / SCENT.width);
      food[row * GRID + column] = cellAt(food, row * GRID + column) + hearth + scent;
    }
  }
}

// Each cell inside the edge: mostly itself, a little of its four neighbours, then the slow fade
function diffuseAndFade(trail: Float32Array, scratch: Float32Array, fade: number): void {
  for (let row = 1; row < GRID - 1; row++) {
    for (let column = 1; column < GRID - 1; column++) {
      const cell = row * GRID + column;
      const around =
        cellAt(trail, cell - 1) + cellAt(trail, cell + 1) + cellAt(trail, cell - GRID) + cellAt(trail, cell + GRID);
      scratch[cell] = (cellAt(trail, cell) * KEEP_OWN + around * GIVEN_BY_NEIGHBOUR) * fade;
    }
  }
  for (let row = 1; row < GRID - 1; row++) {
    for (let column = 1; column < GRID - 1; column++) {
      trail[row * GRID + column] = cellAt(scratch, row * GRID + column);
    }
  }
}

function cellAt(cells: Readonly<Float32Array>, index: number): number {
  return cells[index] ?? 0;
}
