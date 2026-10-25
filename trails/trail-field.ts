// ---------- libs/generative/trails/trail-field: a slime mould's agents on a field ----------

import type { Randomness } from '../randomness/index.ts';
import { Traffic } from './traffic.ts';

// What the mould does, changeable as it runs
//   sense: how far ahead an agent smells, in the field's cells (tuned on a grid 112 cells a side)
//   sensorAngle: how wide it looks, in radians either side of its heading
//   turn: how hard it turns towards the stronger side, in radians
//   fade: how much of a thread is left after a step (0 to 1, near 1 lasts long)
//   perSeed: how many agents a seed lets loose
//   scent: how strong a food's wide, faint scent is at its centre (0.08 if not said): stronger, it pulls against the trail
//   scentReach: how far that scent spreads, in the field's cells, to a third of its strength (23 if not said)
//   hearth: how strong a food's narrow hearth is at its centre (1 if not said): stronger, threads run into the food, not past it
//   hearthReach: how far that hearth spreads, in the field's cells, to a third of its strength (6.4 if not said)
//   lifetime: how many quanta an agent runs before it's let go (forever if not said), so threads stay near where it was let loose
//   scouts: the share of agents let loose as scouts (none if not said): a scout smells no trail, nor the food where it was let loose,
//     only the others', so it walks to a food nearby and lays a trail the others can follow: new threads grow between foods. It lays
//     its trail and traffic only where it smells another food, so its search leaves nothing for the others to follow into nowhere
//   scoutLifetime: how many quanta a scout runs before it's let go (the lifetime if not said)
//   tintReach: how far from where it was let loose an agent's color counts, in the field's cells, to 1/e (all the way if not said):
//     so a thread shows the color of the plant nearest, not the one with the most agents
//   starveAfter: how many quanta an agent runs without standing in a food's hearth before it's let go (for ever if not said): so a
//     stream leading to no food dies back, while one between foods lives on, its agents fed at each end
//   trailPasses, tintPasses: how many times a quantum the trail and the colors diffuse and fade (once a step, 4, if not said):
//     fewer passes spread as far and fade as much, each pass by more, and cost less; the colors steer no agent, so theirs
//     changes only how they blur, the trail's how the agents follow it
//   tintGrid: the colors' cells a side (the field's 160 if not said): coarser, they diffuse in less time, weigh as much and blur
//     as far across the floor, and show steps sooner along a dense thread; changed, the colors are carried onto the new grid
//   edges: what the plane's edges do to an agent ('turn' if not said): 'turn' turns it away a cell inside; 'pass' lets it go once it steps
//     past the plane, kept in `leavers` for whoever runs the field next to it (TrailTiles), unless nothing lies beyond: then it turns away
export interface TrailRules {
  readonly sense: number;
  readonly sensorAngle: number;
  readonly turn: number;
  readonly fade: number;
  readonly perSeed: number;
  readonly scent?: number;
  readonly scentReach?: number;
  readonly hearth?: number;
  readonly hearthReach?: number;
  readonly lifetime?: number;
  readonly scouts?: number;
  readonly scoutLifetime?: number;
  readonly tintReach?: number;
  readonly starveAfter?: number;
  readonly trailPasses?: number;
  readonly tintPasses?: number;
  readonly tintGrid?: number;
  readonly edges?: 'turn' | 'pass';
}
// An agent as it passes from one field to the next: where it stands and its home, in the plane of the field it is handed to (0 to 1
// across and down; a leaver's just past the plane it left), the heading it keeps, its age in quanta, the quanta since it last stood in a
// food's hearth (its age if not said), and its color if it has one
export interface Traveller {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly homeX: number;
  readonly homeY: number;
  readonly age: number;
  readonly sinceFood?: number;
  readonly scout: boolean;
  readonly tint?: Tint | undefined;
}
// What lies beyond a field's plane, one tile across and down (each -1, 0 or 1):
//   has: whether a field does; where none does, an agent turns away
//   takes: whether it takes an agent handed over (`has` if not said): an asleep field has a trail to smell but takes none,
//     so an agent turns away from it as from no field
//   smellAt: what a sensor smells at a place past the plane, as the field beyond smells it there, 0 where none lies
//     (the place and a scout's home both in the cells of that field's plane)
export interface FieldBeyond {
  has(across: number, down: number): boolean;
  takes?(across: number, down: number): boolean;
  smellAt(across: number, down: number, place: Point, home: Point | undefined): number;
}
// A food's shape under the rules: its hearth's and scent's heights and widths (in cells squared), and how far it's laid
interface FoodShape {
  readonly hearthHeight: number;
  readonly hearthWidth: number;
  readonly scentHeight: number;
  readonly scentWidth: number;
  readonly reach: number;
}

// A color an agent carries and lays with its trail: red, green and blue, 0 to 1
export type Tint = readonly [number, number, number];
// The colors laid on the field, each cell's sums of red, green and blue and the weight they were laid with: a cell's color is its sums
// over its weight, and they spread and fade with the trail
export interface Tints {
  readonly red: Readonly<Float32Array>;
  readonly green: Readonly<Float32Array>;
  readonly blue: Readonly<Float32Array>;
  readonly weight: Readonly<Float32Array>;
}

// What a caller has told that no quantum has run yet
interface Told {
  readonly kind: 'food' | 'foodGone' | 'seed' | 'arrive';
  readonly x: number;
  readonly y: number;
  readonly tint?: Tint | undefined;
  readonly agents?: number | undefined;
  readonly traveller?: Traveller | undefined;
}

// The colors' grids as the field writes them
type ColorGrids = Record<keyof Tints, Float32Array>;

interface Point {
  readonly x: number;
  readonly y: number;
}

const NOTHING_BEYOND: FieldBeyond = { has: () => true, smellAt: () => 0 }; // a field alone: hands on, smells nothing
const GRID = 160; // the field's cells a side
const GRID_TUNED_ON = 112; // the distances below were tuned on this many cells a side
const SCALE = GRID / GRID_TUNED_ON;
export const QUANTUM_BEATS = 0.5;
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
// diffusing once a step, a cell takes this much of each of its four neighbours and keeps the rest of itself (0.94);
// a pass for several steps takes as many times this: spread as far, as a blur's spread adds up step by step
const GIVEN_BY_NEIGHBOUR = 0.015;
const EDGE_MARGIN = 1; // cells from the edge an agent turns away
const SCOUT_SCENT = 0.01; // what a scout must smell of another food where it steps to lay its trail there
const FADED = 1e-4; // a trace this weak is gone: a traffic pass is 0.22, and a byte of it rounds to 0

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
  #tintGrid: number; // the colors' cells a side
  #tintScratch: Float32Array;
  readonly #food = new Float32Array(GRID * GRID);
  readonly #traffic = new Traffic(GRID);
  readonly #agentX = new Float32Array(MAX_AGENTS);
  readonly #agentY = new Float32Array(MAX_AGENTS);
  readonly #heading = new Float32Array(MAX_AGENTS);
  readonly #bornAt = new Float32Array(MAX_AGENTS); // the quantum each agent was let loose in
  readonly #fedAt = new Float32Array(MAX_AGENTS); // the quantum each last stood in a food's hearth: let loose at one, at first
  readonly #homeX = new Float32Array(MAX_AGENTS); // where each was let loose, in cells: a scout doesn't smell the food there
  readonly #homeY = new Float32Array(MAX_AGENTS);
  readonly #scout = new Uint8Array(MAX_AGENTS); // 1 for a scout
  readonly #agentTint = new Float32Array(MAX_AGENTS * 3); // the color each agent carries, red, green, blue
  readonly #agentTinted = new Uint8Array(MAX_AGENTS); // 1 where it carries one
  readonly #gone = new Uint8Array(MAX_AGENTS); // 1 once it left for another field: no age lets it go without a lifetime
  #tints: ColorGrids;
  readonly #told: Told[] = [];
  readonly #leavers: Traveller[] = [];
  readonly #fieldBeyond: FieldBeyond;
  #rules: TrailRules;
  #agents = 0;
  #oldest = 0; // the next agent to be let go once MAX_AGENTS are loose
  #quanta = 0;
  #liveAgents = 0; // the agents the last step moved: not let go, not handed on
  #strongestTraffic = 0; // the strongest cell of the traffic after the last quantum
  #letOut = 0; // the agents handed on to another field in the last quantum
  #tookIn = 0; // the agents taken in from another field in the last quantum
  #settled = false; // no agent live and every trace faded, cleared: nothing to run until told
  #slept = 0; // the quanta reached asleep: an agent's age counts only the quanta the field ran
  #asleep = false;

  // The agents' draws come from `randomness`, on a stream of their own.
  // `fieldBeyond` tells, for 'pass' edges, which sides have a field to hand an agent to and what it smells there
  // (every side has one, smelling nothing, if not said)
  constructor(rules: TrailRules, randomness: Randomness, fieldBeyond: FieldBeyond = NOTHING_BEYOND) {
    this.#rules = rules;
    this.#draws = randomness.fork('agents');
    this.#fieldBeyond = fieldBeyond;
    this.#tintGrid = rules.tintGrid ?? GRID;
    this.#tints = colorGrids(this.#tintGrid);
    this.#tintScratch = new Float32Array(this.#tintGrid ** 2);
  }

  // where agents ran, TRAFFIC_GRID cells a side, row by row: read, don't change
  get traffic(): Readonly<Float32Array> {
    return this.#traffic.values;
  }
  // the colors the agents laid, tintGrid cells a side, row by row: read, don't change
  get tints(): Tints {
    return this.#tints;
  }
  // how many agents have been let loose here, those let go or handed on counted (at most MAX_AGENTS):
  // none while the field has only had food
  get agentsLoose(): number {
    return this.#agents;
  }
  // the agents the last step moved: not let go, not handed on
  get liveAgents(): number {
    return this.#liveAgents;
  }
  // the strongest cell of the traffic after the last quantum run; 0 once the traces are cleared
  get strongestTraffic(): number {
    return this.#strongestTraffic;
  }
  // the agents handed on to the field beside in the last quantum run; 0 for a quantum skipped
  get letOut(): number {
    return this.#letOut;
  }
  // the agents taken in from the field beside in the last quantum run; 0 for a quantum skipped
  get tookIn(): number {
    return this.#tookIn;
  }
  // the field's cells a side
  static get grid(): number {
    return GRID;
  }
  // the colors' cells a side, as the rules say
  get tintGrid(): number {
    return this.#tintGrid;
  }
  get rules(): TrailRules {
    return this.#rules;
  }
  // the agents that stepped past the plane since they were last cleared, in the order they left: read, then clear
  get leavers(): readonly Traveller[] {
    return this.#leavers;
  }
  clearLeavers(): void {
    this.#leavers.length = 0;
  }
  // counts from the next quantum on
  set rules(rules: TrailRules) {
    this.#rules = rules;
    const tintGrid = rules.tintGrid ?? GRID;
    if (tintGrid !== this.#tintGrid) {
      this.#carryTintsOnto(tintGrid);
    }
  }

  // A food at (x, y): a hearth and a scent agents are drawn to (a plant is born there)
  food(x: number, y: number): void {
    this.#tell({ kind: 'food', x, y });
  }
  // The food at (x, y) taken away: its hearth and scent as food() laid them, under the same rules (a plant gone)
  foodGone(x: number, y: number): void {
    this.#tell({ kind: 'foodGone', x, y });
  }
  // A seed at (x, y): `agents` let loose there, `perSeed` if not said (a note played there), each carrying `tint` where it's given
  seed(x: number, y: number, tint?: Tint, agents?: number): void {
    if (this.#asleep) {
      return;
    }
    this.#told.push({ kind: 'seed', x, y, tint, agents });
  }

  // An agent from the field beside, standing in this plane: it carries on from the next quantum's start
  arrive(traveller: Traveller): void {
    this.#told.push({ kind: 'arrive', x: traveller.x, y: traveller.y, traveller });
  }

  // how many quanta have been reached, the idle and the asleep ones skipped included
  get quanta(): number {
    return this.#quanta;
  }

  // Whether the field is asleep: it steps no quantum and keeps its trail, traffic, colors and agents as they are, its quanta
  // counted as reached and not as the agents' age; a food told is applied at once, a seed dropped. Waking carries on where it was.
  get asleep(): boolean {
    return this.#asleep;
  }
  set asleep(asleep: boolean) {
    if (asleep && !this.#asleep) {
      this.#applyFoodsToldAndDropSeeds();
    }
    this.#asleep = asleep;
  }

  // Runs every quantum that ends by `beat`; a beat already reached does nothing
  advanceTo(beat: number): void {
    const target = Math.floor(beat / QUANTUM_BEATS);
    while (this.#quanta < target) {
      if (this.#asleep) {
        this.#slept += target - this.#quanta;
        this.#quanta = target;
        this.#letOut = 0;
        this.#tookIn = 0;
        return;
      }
      if (this.#isIdle()) {
        this.#quanta = target; // nothing to move, fade or draw: a late field costs nothing
        this.#letOut = 0;
        this.#tookIn = 0;
        return;
      }
      this.#runQuantum();
    }
  }

  // Nothing to run: no agent was ever let loose, or every one is let go or handed on and the traces have faded
  // away, and nothing is told. The trail, the traffic and the colors are empty and stay so.
  get idle(): boolean {
    return this.#isIdle();
  }
  #isIdle(): boolean {
    return this.#told.length === 0 && (this.#agents === 0 || this.#settled);
  }

  // A food or its going applied at once while asleep, as food is state; any other is kept for the quantum
  #tell(told: Told): void {
    if (this.#asleep) {
      this.#apply(told);
      return;
    }
    this.#told.push(told);
  }
  // Falling asleep: what was told and not run yet. A food is applied, a seed dropped, an arriving agent kept for waking.
  #applyFoodsToldAndDropSeeds(): void {
    const kept: Told[] = [];
    for (const told of this.#told.splice(0)) {
      if (told.kind === 'arrive') {
        kept.push(told);
      } else if (told.kind !== 'seed') {
        this.#apply(told);
      }
    }
    this.#told.push(...kept);
  }

  #runQuantum(): void {
    this.#letOut = 0;
    this.#tookIn = 0;
    for (const told of this.#told.splice(0)) {
      this.#apply(told);
    }
    let strongestTrail = 0;
    let strongestTint = 0;
    const trailPasses = this.#rules.trailPasses ?? STEPS_PER_QUANTUM;
    const tintPasses = this.#rules.tintPasses ?? STEPS_PER_QUANTUM;
    for (let step = 0; step < STEPS_PER_QUANTUM; step++) {
      this.#liveAgents = this.#moveAgents();
      if (passDue(step, trailPasses)) {
        strongestTrail = this.#diffuse(this.#trail, this.#scratch, GRID, trailPasses);
      }
      if (passDue(step, tintPasses)) {
        strongestTint = this.#diffuseTints(tintPasses);
      }
    }
    let strongest = Math.max(strongestTrail, strongestTint);
    this.#strongestTraffic = this.#traffic.fade(this.#rules.fade ** STEPS_PER_QUANTUM);
    strongest = Math.max(strongest, this.#strongestTraffic);
    this.#quanta++;
    this.#settled = this.#liveAgents === 0 && strongest < FADED;
    if (this.#settled) {
      this.#clearTraces();
    }
  }

  // a grid `side` cells a side diffused and faded by one of `passes` passes a quantum; the strongest cell it leaves.
  // A blur spreads by cells: on a coarser grid each pass gives less, so it spreads as far across the floor
  #diffuse(grid: Float32Array, scratch: Float32Array, side: number, passes: number): number {
    const stepsAPass = STEPS_PER_QUANTUM / passes;
    const given = GIVEN_BY_NEIGHBOUR * stepsAPass * (side / GRID) ** 2;
    return diffuseAndFade(grid, scratch, side, this.#rules.fade ** stepsAPass, given);
  }
  // every color channel diffused so; the strongest cell of the colors' weight
  #diffuseTints(passes: number): number {
    let strongest = 0;
    for (const [name, channel] of Object.entries(this.#tints)) {
      const strongestOfChannel = this.#diffuse(channel, this.#tintScratch, this.#tintGrid, passes);
      strongest = name === 'weight' ? strongestOfChannel : strongest;
    }
    return strongest;
  }

  // The colors onto a grid `side` cells a side, each cell from the old one under its middle: a cell holds its color a field cell,
  // so it carries over as it is, and the colors weigh as much
  #carryTintsOnto(side: number): void {
    const before = this.#tints;
    const oldSide = this.#tintGrid;
    this.#tints = colorGrids(side);
    for (const [name, channel] of Object.entries(this.#tints)) {
      const from = before[name as keyof Tints];
      for (let row = 0; row < side; row++) {
        const oldRow = Math.floor(((row + 0.5) * oldSide) / side);
        for (let column = 0; column < side; column++) {
          const oldColumn = Math.floor(((column + 0.5) * oldSide) / side);
          channel[row * side + column] = cellAt(from, oldRow * oldSide + oldColumn);
        }
      }
    }
    this.#tintGrid = side;
    this.#tintScratch = new Float32Array(side * side);
  }

  // The trail, traffic and colors to nothing; the food stays, for a seed or an arriving agent to find
  #clearTraces(): void {
    this.#trail.fill(0);
    this.#traffic.clear();
    this.#strongestTraffic = 0;
    for (const channel of Object.values(this.#tints)) {
      channel.fill(0);
    }
  }

  #apply({ kind, x, y, tint, agents, traveller }: Told): void {
    if (kind === 'food' || kind === 'foodGone') {
      addFood(this.#food, { x, y }, this.#rules, kind === 'food' ? 1 : -1);
      return;
    }
    if (kind === 'arrive' && traveller) {
      this.#takeIn(traveller);
      return;
    }
    for (let agent = 0; agent < (agents ?? this.#rules.perSeed); agent++) {
      this.#letLoose(x, y, tint);
    }
  }

  // Once MAX_AGENTS are loose, the oldest goes first
  #freeSlot(): number {
    const slot = this.#agents < MAX_AGENTS ? this.#agents++ : this.#oldest++ % MAX_AGENTS;
    this.#gone[slot] = 0;
    return slot;
  }

  // The quanta the field ran, not the asleep ones: what an agent's age and its time since food count
  #quantaRun(): number {
    return this.#quanta - this.#slept;
  }

  // Carries on as it was, nothing drawn; the step that brought it across is laid here as it was in the field it left
  #takeIn(traveller: Traveller): void {
    this.#tookIn++;
    const slot = this.#freeSlot();
    const at = { x: traveller.x * GRID, y: traveller.y * GRID };
    this.#agentX[slot] = at.x;
    this.#agentY[slot] = at.y;
    this.#heading[slot] = traveller.heading;
    this.#bornAt[slot] = this.#quantaRun() - traveller.age;
    this.#fedAt[slot] = this.#quantaRun() - (traveller.sinceFood ?? traveller.age);
    this.#homeX[slot] = traveller.homeX * GRID;
    this.#homeY[slot] = traveller.homeY * GRID;
    this.#scout[slot] = traveller.scout ? 1 : 0;
    this.#agentTinted[slot] = traveller.tint ? 1 : 0;
    this.#agentTint.set(traveller.tint ?? [0, 0, 0], slot * 3);
    const from = { x: at.x - Math.cos(traveller.heading) * SPEED, y: at.y - Math.sin(traveller.heading) * SPEED };
    this.#lay(slot, from, at);
  }

  #letLoose(x: number, y: number, tint: Tint | undefined): void {
    const slot = this.#freeSlot();
    this.#agentX[slot] = x * GRID + (this.#draws.next() - 0.5) * SEED_SCATTER;
    this.#agentY[slot] = y * GRID + (this.#draws.next() - 0.5) * SEED_SCATTER;
    this.#heading[slot] = this.#draws.next() * Math.PI * 2;
    this.#bornAt[slot] = this.#quantaRun();
    this.#fedAt[slot] = this.#quantaRun();
    this.#homeX[slot] = x * GRID;
    this.#homeY[slot] = y * GRID;
    // drawn only where the rules have scouts, so a field without them draws as before
    this.#scout[slot] = this.#rules.scouts !== undefined && this.#draws.next() < this.#rules.scouts ? 1 : 0;
    this.#agentTinted[slot] = tint ? 1 : 0;
    this.#agentTint.set(tint ?? [0, 0, 0], slot * 3);
  }

  // Moves each live agent a step; how many that was
  #moveAgents(): number {
    let live = 0;
    const lifetime = this.#rules.lifetime ?? Infinity;
    const scoutLifetime = this.#rules.scoutLifetime ?? lifetime;
    for (let agent = 0; agent < this.#agents; agent++) {
      if (this.#gone[agent]) {
        continue;
      }
      const age = this.#quantaRun() - cellAt(this.#bornAt, agent);
      if (age >= (this.#scout[agent] ? scoutLifetime : lifetime) || this.#starved(agent)) {
        continue; // let go: its slot taken by the next one let loose, the oldest first
      }
      live++;
      this.#steer(agent);
      this.#step(agent);
    }
    return live;
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
    const place = {
      x: cellAt(this.#agentX, agent) + Math.cos(direction) * sense,
      y: cellAt(this.#agentY, agent) + Math.sin(direction) * sense,
    };
    const home = this.#scout[agent] ? this.#homeOf(agent) : undefined;
    const across = sideOf(place.x);
    const down = sideOf(place.y);
    if (across === 0 && down === 0) {
      return this.smellAt(place, home);
    }
    return this.#smellBeyond(across, down, place, home);
  }
  // What a sensor past the plane smells: what the field beyond smells there, nothing where there is none or edges turn
  #smellBeyond(across: number, down: number, place: Point, home: Point | undefined): number {
    if (this.#rules.edges !== 'pass' || !this.#fieldBeyond.has(across, down)) {
      return 0;
    }
    const shift = { x: across * GRID, y: down * GRID };
    const inBeyond = (point: Point): Point => ({ x: point.x - shift.x, y: point.y - shift.y });
    return this.#fieldBeyond.smellAt(across, down, inBeyond(place), home && inBeyond(home));
  }

  // What a sensor smells at a place in the plane, in cells: the trail and the food there. A scout, given its home, smells only the
  // food there but its home's, as food() would have laid it there; nothing past the plane.
  smellAt(place: Point, home?: Point): number {
    const column = Math.floor(place.x);
    const row = Math.floor(place.y);
    if (column < 0 || row < 0 || column >= GRID || row >= GRID) {
      return 0;
    }
    const cell = row * GRID + column;
    if (home) {
      return this.#othersFood(home, cell, place);
    }
    return cellAt(this.#trail, cell) + cellAt(this.#food, cell) * FOOD_WEIGHT;
  }
  // What a scout smells at a place: the food there but its home's, as food() would have laid it there
  #othersFood(home: Point, cell: number, { x, y }: Point): number {
    const distanceSquared = (x - home.x) ** 2 + (y - home.y) ** 2;
    const homeFood = foodAt(foodShape(this.#rules), distanceSquared);
    return Math.max(0, cellAt(this.#food, cell) - homeFood) * FOOD_WEIGHT;
  }
  #homeOf(agent: number): Point {
    return { x: cellAt(this.#homeX, agent), y: cellAt(this.#homeY, agent) };
  }

  // Steps along its heading, leaving traffic and a deposit; at the edge, turns away to a new heading, or passes on
  #step(agent: number): void {
    const from = { x: cellAt(this.#agentX, agent), y: cellAt(this.#agentY, agent) };
    const heading = cellAt(this.#heading, agent);
    const to = { x: from.x + Math.cos(heading) * SPEED, y: from.y + Math.sin(heading) * SPEED };
    if (this.#rules.edges === 'pass') {
      this.#stepPassing(agent, from, to);
      return;
    }
    if (to.x < EDGE_MARGIN || to.y < EDGE_MARGIN || to.x > GRID - 1 - EDGE_MARGIN || to.y > GRID - 1 - EDGE_MARGIN) {
      this.#heading[agent] = this.#draws.next() * Math.PI * 2;
      return;
    }
    this.#agentX[agent] = to.x;
    this.#agentY[agent] = to.y;
    this.#lay(agent, from, to);
  }

  // With 'pass' edges, an agent stands anywhere in the plane; past it, it goes to the field beyond, where there is one
  #stepPassing(agent: number, from: Point, to: Point): void {
    const across = sideOf(to.x);
    const down = sideOf(to.y);
    if (across === 0 && down === 0) {
      this.#agentX[agent] = to.x;
      this.#agentY[agent] = to.y;
      this.#lay(agent, from, to);
      return;
    }
    if (!this.#takes(across, down)) {
      this.#heading[agent] = this.#draws.next() * Math.PI * 2;
      return;
    }
    this.#leave(agent, from, to);
  }

  // Whether the field beyond takes an agent handed over
  #takes(across: number, down: number): boolean {
    const beyond = this.#fieldBeyond;
    return beyond.takes ? beyond.takes(across, down) : beyond.has(across, down);
  }

  // The agent let go and kept in `leavers`; its step is laid as far as the plane goes, by a scout not at all (it smells nothing past it)
  #leave(agent: number, from: Point, to: Point): void {
    if (!this.#scout[agent]) {
      this.#traffic.record(from, to);
    }
    this.#gone[agent] = 1;
    this.#letOut++;
    this.#leavers.push({
      x: to.x / GRID,
      y: to.y / GRID,
      heading: cellAt(this.#heading, agent),
      homeX: cellAt(this.#homeX, agent) / GRID,
      homeY: cellAt(this.#homeY, agent) / GRID,
      age: this.#quantaRun() - cellAt(this.#bornAt, agent),
      sinceFood: this.#quantaRun() - cellAt(this.#fedAt, agent),
      scout: this.#scout[agent] === 1,
      tint: this.#agentTinted[agent] ? this.#tintOf(agent) : undefined,
    });
  }

  #tintOf(agent: number): Tint {
    return [
      cellAt(this.#agentTint, agent * 3),
      cellAt(this.#agentTint, agent * 3 + 1),
      cellAt(this.#agentTint, agent * 3 + 2),
    ];
  }

  // What a step into `to`, a cell of the plane, leaves: traffic and a deposit, and the agent's color
  #lay(agent: number, from: Point, to: Point): void {
    const cell = Math.floor(to.y) * GRID + Math.floor(to.x);
    if (cellAt(this.#food, cell) >= foodShape(this.#rules).hearthHeight / 3) {
      this.#fedAt[agent] = this.#quantaRun(); // in a hearth: within its reach of a food's centre
    }
    if (this.#scout[agent] && this.#othersFood(this.#homeOf(agent), cell, to) < SCOUT_SCENT) {
      return; // a scout searching: nothing laid
    }
    this.#traffic.record(from, to);
    this.#trail[cell] = Math.min(TRAIL_CAP, cellAt(this.#trail, cell) + DEPOSIT);
    if (this.#agentTinted[agent]) {
      this.#tint(agent, to);
    }
  }
  // the agent's color laid in the color's cell at `to`, with the trail's deposit as its weight, less the further it is from where
  // it was let loose; shared over the field's cells the color's cell spans, so a color weighs as much on the floor
  #tint(agent: number, to: Point): void {
    const { red, green, blue, weight } = this.#tints;
    const cellWidth = GRID / this.#tintGrid; // in the field's cells
    const cell = Math.floor(to.y / cellWidth) * this.#tintGrid + Math.floor(to.x / cellWidth);
    const laid = (DEPOSIT * this.#tintNearHome(agent)) / cellWidth ** 2;
    red[cell] = cellAt(red, cell) + laid * cellAt(this.#agentTint, agent * 3);
    green[cell] = cellAt(green, cell) + laid * cellAt(this.#agentTint, agent * 3 + 1);
    blue[cell] = cellAt(blue, cell) + laid * cellAt(this.#agentTint, agent * 3 + 2);
    weight[cell] = cellAt(weight, cell) + laid;
  }
  // An agent `starveAfter` quanta without food: let go.
  // Laying a fainter trail instead doesn't stop a stream into nowhere: steering compares the sides, not how strong they are,
  // so a faint stream on empty floor steers as well as a strong one
  #starved(agent: number): boolean {
    const starveAfter = this.#rules.starveAfter ?? Infinity;
    return this.#quantaRun() - cellAt(this.#fedAt, agent) >= starveAfter;
  }
  #tintNearHome(agent: number): number {
    const reach = this.#rules.tintReach;
    if (reach === undefined) {
      return 1;
    }
    const fromHome = Math.hypot(
      cellAt(this.#agentX, agent) - cellAt(this.#homeX, agent),
      cellAt(this.#agentY, agent) - cellAt(this.#homeY, agent),
    );
    return Math.exp(-fromHome / reach);
  }
}

// A food's hearth and scent added to the cells round (x, y), on the plane 0 to 1, or taken away (`sign` -1), never below none; its
// hearth and scent as the rules say, spread over the cells they reach, twice their reach at least
function addFood(food: Float32Array, { x, y }: { x: number; y: number }, rules: TrailRules, sign: 1 | -1): void {
  const centreX = x * GRID;
  const centreY = y * GRID;
  const shape = foodShape(rules);
  const reach = shape.reach;
  for (
    let row = Math.max(0, Math.floor(centreY - reach));
    row <= Math.min(GRID - 1, Math.ceil(centreY + reach));
    row++
  ) {
    for (
      let column = Math.max(0, Math.floor(centreX - reach));
      column <= Math.min(GRID - 1, Math.ceil(centreX + reach));
      column++
    ) {
      const distanceSquared = (column - centreX) ** 2 + (row - centreY) ** 2;
      food[row * GRID + column] = Math.max(
        0,
        cellAt(food, row * GRID + column) + sign * foodAt(shape, distanceSquared),
      );
    }
  }
}

// How far a food is laid from its place, in planes (1 the plane's width): the tiles it reaches are the ones within
export function foodReach(rules: TrailRules): number {
  return foodShape(rules).reach / GRID;
}

// The colors' grids, `side` cells a side, empty
function colorGrids(side: number): ColorGrids {
  return {
    red: new Float32Array(side * side),
    green: new Float32Array(side * side),
    blue: new Float32Array(side * side),
    weight: new Float32Array(side * side),
  };
}
// A food's shape under the rules, their own where they say, else the hearth's and scent's below
function foodShape(rules: TrailRules): FoodShape {
  const scentWidth = rules.scentReach === undefined ? SCENT.width : rules.scentReach ** 2;
  const hearthWidth = rules.hearthReach === undefined ? HEARTH.width : rules.hearthReach ** 2;
  return {
    hearthHeight: rules.hearth ?? HEARTH.height,
    hearthWidth,
    scentHeight: rules.scent ?? SCENT.height,
    scentWidth,
    reach: Math.max(FOOD_REACH, 2 * Math.sqrt(scentWidth), 2 * Math.sqrt(hearthWidth)),
  };
}
// A food's hearth and scent at a distance from it, squared, in cells; none past its reach, as it's laid
function foodAt(shape: FoodShape, distanceSquared: number): number {
  if (distanceSquared > shape.reach ** 2 * 2) {
    return 0;
  }
  const hearth = shape.hearthHeight * Math.exp(-distanceSquared / shape.hearthWidth);
  return hearth + shape.scentHeight * Math.exp(-distanceSquared / shape.scentWidth);
}
// Each cell: mostly itself, a little of the neighbours it has (four inside, fewer at the edge), then the slow fade; the strongest cell it leaves
function diffuseAndFade(trail: Float32Array, scratch: Float32Array, side: number, fade: number, given: number): number {
  const keepOwn = 1 - 4 * given;
  let strongest = 0;
  for (let row = 0; row < side; row++) {
    for (let column = 0; column < side; column++) {
      const cell = row * side + column;
      const around =
        (column > 0 ? cellAt(trail, cell - 1) : 0)
        + (column < side - 1 ? cellAt(trail, cell + 1) : 0)
        + (row > 0 ? cellAt(trail, cell - side) : 0)
        + (row < side - 1 ? cellAt(trail, cell + side) : 0);
      scratch[cell] = (cellAt(trail, cell) * keepOwn + around * given) * fade;
      strongest = Math.max(strongest, cellAt(scratch, cell));
    }
  }
  trail.set(scratch);
  return strongest;
}

// Whether a pass of `passes` a quantum falls after this step: spread over the steps, the last always one
function passDue(step: number, passes: number): boolean {
  return Math.floor(((step + 1) * passes) / STEPS_PER_QUANTUM) > Math.floor((step * passes) / STEPS_PER_QUANTUM);
}

// Which side of the plane a place in cells is past: -1 before it, 1 beyond it, 0 within it
function sideOf(place: number): -1 | 0 | 1 {
  if (place < 0) {
    return -1;
  }
  return place >= GRID ? 1 : 0;
}

function cellAt(cells: Readonly<Float32Array>, index: number): number {
  return cells[index] ?? 0;
}
