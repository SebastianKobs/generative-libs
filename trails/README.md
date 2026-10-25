# trails

A slime mould's agents on a field, or on a grid of tiles that hand agents over at the seams (Physarum, after Jeff Jones's 2010 model): agents sense the trail ahead, left and right, turn towards the strongest, step and deposit; the trail diffuses and fades slowly. Food, a hearth and a wide, faint scent, draws them; each seed lets a few more loose; the threads that grow link the foods. A field is run forward in half-beat quanta and keeps no copy of its past: the same events told at the same beats give the same trails. No drawing: ink, an image or a heat map made of the traffic is the caller's. It uses only `libs/generative/randomness/`.

```ts
import { TRAFFIC_GRID, TrailField } from './index.ts';
const rules = { sense: 6, sensorAngle: 0.7, turn: 0.4, fade: 0.96, perSeed: 2 };
const field = new TrailField(rules, randomness.fork('mould'));   // the agents' draws come from it
field.advanceTo(4);
field.food(0.3, 0.6);   // a plant born at (0.3, 0.6) on the plane 0 to 1; runs in the next quantum
field.seed(0.3, 0.6);   // a note played there: perSeed agents let loose
field.seed(0.3, 0.6, [1, 0.6, 0.2], 1);   // one agent carrying a color, laid with its trail
field.foodGone(0.3, 0.6);   // the plant gone: its food taken away as food() laid it
field.advanceTo(10);    // every quantum that ends by beat 10
field.traffic;          // where agents ran, TRAFFIC_GRID cells a side, row by row, read-only
field.quanta;           // the quanta reached: 20 here
field.tints;            // the colors laid, field.tintGrid cells a side (the rules' tintGrid, the field's 160 if not said): sums of red, green, blue and their weight
```

Fields on a grid of tiles, so threads cross the seams between them:

```ts
import { TrailTiles } from './index.ts';
const tiles = new TrailTiles({ ...rules, edges: 'pass' }, randomness.fork('mould'), 4);   // 4: a world of 4 × 4 tiles that wraps round
tiles.advanceTo(4);
tiles.food(1.25, 0.5);    // places in tile units: a quarter into tile 1, halfway down tile 0
tiles.seed(1.25, 0.5);    // agents let loose in tile 1, its own tile only
tiles.advanceTo(10);      // every field, tile by tile, row by row, one quantum at a time, then the agents that left handed on
tiles.fields;             // [{ tile: { across, down }, field }], in the order they were made
tiles.advanceTo(12, (tile) => tile.across < 2);   // only these tiles awake; the rest sleep, as they are, until a call names them
```

Optional rules shape the mould further: a food's `hearth` and `scent` and how far each reaches, so threads run into a food and foods smell each other; an agent's `lifetime`; a share of `scouts`, which smell only the other foods and lay a trail only near one, so new threads grow between foods, and their own `scoutLifetime`; `tintReach`, how far from where it was let loose an agent's color counts; `starveAfter`, how many quanta an agent runs without standing in a food's hearth before it's let go, so a stream leading to no food dies back; `edges`, `'turn'` (if not said) turning an agent away at the plane's edge, or `'pass'`, letting it go once it steps past, kept with its place, heading, home, age, scout flag, quanta since its last food and color in the field's `leavers`; `trailPasses` and `tintPasses`, how many times a quantum the trail and the colors diffuse, fewer for less time, each pass spreading as far as the steps it stands for; `tintGrid`, the colors' cells a side, coarser for less time, weighing as much and blurring as far across the floor, the colors carried onto a new grid when it changes. Each is documented on `TrailRules`; left out, the mould runs as it did before them.

The caller tells each event before advancing past its beat: `advanceTo(its beat)`, then `food()`, `foodGone()` or `seed()`. A beat already reached does nothing. A field no agent was ever let loose in has nothing to move, so advancing it skips its quanta at once: one made late costs nothing. A field is idle again once every agent is let go or handed on, nothing is told and every trace (trail, traffic, colors) has faded below 1e-4: it clears them to 0 and skips its quanta at once, its food kept, until a food, a seed or an arriving agent wakes it (`idle`). Every cell fades, the border's too, diffusing from the neighbours it has. A lone field's edges turn an agent away; it does not wrap round.

`TrailTiles` makes a field where a food's reach overlaps a tile (laid in each tile it overlaps, in that tile's own plane) or a seed falls, and nowhere else, so empty world costs nothing. An agent stepping past a tile's plane passes into the tile beyond where there is a field, with its color, home and scout flag, and the step that crossed is laid in both fields; where there is none it turns away, as at an edge, so agents make no fields where nobody has been. Each field's draws are a fork of the tiles' `Randomness` by its tile; the same events told at the same beats give the same traffic in every tile, in one go or in small steps. `wrapAcross` makes the tile after the last the first.

A field far from where it's looked at can sleep: `advanceTo(beat, awake)` is handed a test of which tiles are awake (every tile if not said). An asleep field (`asleep`) steps nothing and keeps its trail, traffic, colors and agents as they are; its quanta count as reached but not in its agents' age or quanta since food, so a woken field carries on as one that never slept and its agents don't all die at once. While it sleeps a food laid or taken away is applied at once, a seed is dropped, so waking brings no burst. No agent is handed to it: a seam into it is as one into no field, the agent turns away (`FieldBeyond.takes`), but a sensor past it still smells its trail and food as they lie.

A sensor past a tile's plane smells what the field beyond smells there: its trail and food, at the place in its own cells (`smellAt()`; a scout leaves out its own home's food). Where no field lies beyond, it smells nothing and the agent turns away. Only the sensors reach across: the trail doesn't diffuse over a seam, and the neighbour's trail is read as it stands when asked, in the fields' fixed order.

| File | What it does |
|---|---|
| [`trail-field.ts`](trail-field.ts) | `TrailField`: `food()`, `foodGone()`, `seed()` (a color and a count optional), `advanceTo()`, `quanta`, `traffic`, `tints`, `tintGrid`, `rules`, `arrive()`, `leavers`, `idle`, `asleep`, `smellAt()`; `TrailRules` (`sense`, `sensorAngle`, `turn`, `fade`, `perSeed`; optional `scent`, `scentReach`, `hearth`, `hearthReach`, `lifetime`, `scouts`, `scoutLifetime`, `tintReach`, `starveAfter`, `trailPasses`, `tintPasses`, `tintGrid`, `edges`); `Tint`, `Tints`; up to 700 agents, the oldest let go first; the field 160 cells a side |
| [`trail-tiles.ts`](trail-tiles.ts) | `TrailTiles`: fields on a grid of tiles stepped together, in tile units: `food()`, `foodGone()`, `seed()`, `advanceTo()` (with which tiles are awake), `rules`, `fields` (each with its `Tile`); an optional `wrapAcross`; agents that stepped past a plane handed to the field beyond |
| [`traffic.ts`](traffic.ts) | `TRAFFIC_GRID`, where agents ran on a grid finer than the field's; an agent's step recorded as a smooth hairline, the traffic fading with the trail |

Tested in node on a seeded `Randomness` (`test/trails.test.js`).
