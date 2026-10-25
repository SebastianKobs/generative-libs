# trails

A slime mould's agents on a field (Physarum, after Jeff Jones's 2010 model): agents sense the trail ahead, left and right, turn towards the strongest, step and deposit; the trail diffuses and fades slowly. Food, a hearth and a wide, faint scent, draws them; each seed lets a few more loose; the threads that grow link the foods. A field is run forward in half-beat quanta and keeps no copy of its past: the same events told at the same beats give the same trails. No drawing: ink, an image or a heat map made of the traffic is the caller's. It uses only `libs/generative/randomness/`.

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
field.tints;            // the colors laid, TrailField.grid cells a side: sums of red, green, blue and their weight
```

Optional rules shape the mould further: a food's `hearth` and `scent` and how far each reaches, so threads run into a food and foods smell each other; an agent's `lifetime`; a share of `scouts`, which smell only the other foods and lay a trail only near one, so new threads grow between foods, and their own `scoutLifetime`; `tintReach`, how far from where it was let loose an agent's color counts. Each is documented on `TrailRules`; left out, the mould runs as it did before them.

The caller tells each event before advancing past its beat: `advanceTo(its beat)`, then `food()`, `foodGone()` or `seed()`. A beat already reached does nothing. A field no agent was ever let loose in has nothing to move, so advancing it skips its quanta at once: one made late costs nothing. The plane's edges turn an agent away; it does not wrap round.

| File | What it does |
|---|---|
| [`trail-field.ts`](trail-field.ts) | `TrailField`: `food()`, `foodGone()`, `seed()` (a color and a count optional), `advanceTo()`, `quanta`, `traffic`, `tints`, `rules`; `TrailRules` (`sense`, `sensorAngle`, `turn`, `fade`, `perSeed`; optional `scent`, `scentReach`, `hearth`, `hearthReach`, `lifetime`, `scouts`, `scoutLifetime`, `tintReach`); `Tint`, `Tints`; up to 700 agents, the oldest let go first; the field 160 cells a side |
| [`traffic.ts`](traffic.ts) | `TRAFFIC_GRID`, where agents ran on a grid finer than the field's; an agent's step recorded as a smooth hairline, the traffic fading with the trail |

Tested in node on a seeded `Randomness` (`test/trails.test.js`).
