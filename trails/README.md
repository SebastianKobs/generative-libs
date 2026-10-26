# generative/trails

A slime mold's agents on a field, or on a grid of tiles that hand agents over at the seams (Physarum, after Jeff Jones's 2010 model). Agents sense the trail ahead, left and right, turn toward the strongest, step and deposit; the trail diffuses and fades. Food draws them, each seed lets a few more loose, and the threads that grow link the foods. No drawing: ink, an image or a heat map made of the traffic is the caller's.

Depends on: `generative/randomness`.

```ts
import { TRAFFIC_GRID, TrailField, TrailTiles } from './index.ts';
const rules = { sense: 6, sensorAngle: 0.7, turn: 0.4, fade: 0.96, perSeed: 2 };
const field = new TrailField(rules, randomness.fork('mould')); // the agents' draws come from it
field.advanceTo(4);
field.food(0.3, 0.6); // a plant born at (0.3, 0.6) on the plane 0 to 1; runs in the next quantum
field.seed(0.3, 0.6); // a note played there: perSeed agents let loose
field.seed(0.3, 0.6, [1, 0.6, 0.2], 1); // one agent carrying a color, laid with its trail
field.foodGone(0.3, 0.6); // the plant gone: its food taken away
field.advanceTo(10); // every quantum that ends by beat 10
field.traffic; // where agents ran, TRAFFIC_GRID cells a side, row by row, read-only
field.quanta; // the quanta reached: 20 here

// fields on a grid of tiles, so threads cross the seams between them
const tiles = new TrailTiles({ ...rules, edges: 'pass' }, randomness.fork('mould'), 4); // a world of 4 × 4 tiles that wraps round
tiles.food(1.25, 0.5); // places in tile units: a quarter into tile 1, halfway down tile 0
tiles.advanceTo(10);
tiles.advanceTo(12, (tile) => tile.across < 2); // only these tiles awake; the rest sleep until a call names them
```

How it works:

1. A field is run forward in half-beat quanta and keeps no copy of its past: the same events told at the same beats give the same trails.
2. The caller tells each event before advancing past its beat: `advanceTo(its beat)`, then `food()`, `foodGone()` or `seed()`. A beat already reached does nothing.
3. A field that is `idle`, with no agent loose and every trace faded, skips its quanta at once, so a field made late costs nothing. A food, a seed or an arriving agent wakes it.
4. `TrailTiles` makes a field only where a food's reach overlaps a tile or a seed falls, so empty world costs nothing. An agent stepping past a tile's plane passes into the tile beyond where there is a field, with its color, home and scout flag; where there is none it turns away.
5. A tile far from where it's looked at can sleep: it steps nothing and keeps its trail, traffic, colors and agents as they are. It takes no agent, so a seam into it is as one into no field, but a sensor past it still smells its trail and food.

| Export | What it does |
|---|---|
| `new TrailField(rules, randomness)`: `food()`, `foodGone()`, `seed()`, `advanceTo()`, `quanta`, `rules`, `idle`, `asleep` | One field, 160 cells a side, up to 700 agents, the oldest let go first (`trail-field.ts`). |
| `TrailField`'s readings: `traffic`, `tints`, `tintGrid`, `grid`, `agentsLoose`, `liveAgents`, `strongestTraffic`, `letOut`, `tookIn` | What the agents did: where they ran, the colors they laid and the counts of the last quantum (`trail-field.ts`). |
| `TrailField`'s seams: `arrive()`, `leavers`, `clearLeavers()`, `smellAt()` | An agent handed over to a field beside, the agents that left this one, and what a sensor past the plane smells here (`trail-field.ts`). |
| `TrailRules` | The agents' `sense`, `sensorAngle`, `turn`, `fade` and `perSeed`, and the optional rules for scent, hearths, scouts, colors, edges and passes, each documented in `trail-field.ts` (`trail-field.ts`). |
| `Tint`, `Tints` | A color an agent carries, red, green and blue 0 to 1; the colors laid, as sums of each channel and their weight (`trail-field.ts`). |
| `new TrailTiles(rules, randomness, wrapAcross?)`: `food()`, `foodGone()`, `seed()`, `advanceTo()`, `rules`, `fields`, `msOf()` | Fields on a grid of tiles stepped together, tile by tile, row by row, one quantum at a time, then the agents that left handed on. Places are in tile units (`trail-tiles.ts`). |
| `Tile`, `TileField` | A tile's place on the grid, across and down from 0; a tile and the field running in it (`trail-tiles.ts`). |
| `TRAFFIC_GRID` | The cells a side of the traffic, a grid finer than the field's. An agent's step is recorded as a smooth hairline, the traffic fading with the trail (`traffic.ts`). |

Tests: `test/trails.test.js`, on a seeded `Randomness`.
