# paths

The cheapest path through layers of choices: one option chosen in each layer, each option and each move from one layer's option to the next costed, the cheapest whole path found by Viterbi without trying every path. A layer can be fixed to one option or limited to some, and a cost of Infinity forbids an option or a move. For a sequence chosen step by step where each choice should fit its neighbors: a voicing a chord, a fingering a note, a hand a hit (a drummer's sticking, as an example).

Depends on: nothing.

```ts
import { cheapestPath } from './index.ts';
const path = cheapestPath({
  layers: [['low', 'high'], ['low', 'high'], ['low', 'high']],
  optionCost: (layer, option) => (layer === 1 && option === 'low' ? Infinity : 0), // layer 1 can't be low
  moveCost: (_layer, previous, option) => (previous === option ? 0 : 1), // a change costs 1
  anchors: { 0: ['low'] }, // the first layer fixed
});
if (path.found) {
  path.options; // ['low', 'high', 'high'], path.cost 1
}
```

How it works:

1. Layer by layer, the cheapest way to reach every allowed option is kept: its own cost plus the cheapest of the ways to the layer before, each with its move.
2. A layer none of whose options is reached at a finite cost ends it: no path, and that layer named.
3. The cheapest last option is followed back through where each came from. Of paths that cost the same, the one whose last option comes first in its layer wins, then, going back, whose option before it comes first.

| Export | What it does |
|---|---|
| `cheapestPath()` | The cheapest path, by Viterbi: each layer costs its options times the layer before's in moves, not every path. Ties go to the earlier option, from the last layer back (`cheapest-path.ts`). |
| `PathProblem` | The `layers`, each a list of options of any type; `optionCost(layer, option)`; `moveCost(layer, previous, option)`, `layer` the one moved into; `anchors`, by layer the options it is held to (`cheapest-path.ts`). |
| `CheapestPath` | `{ found: true, options, cost }`, an option a layer, or `{ found: false, blockedAt }`, the first layer no allowed path reaches (`cheapest-path.ts`). |

Tests: `test/paths.test.js`: small cases by hand, anchors, forbidden options and moves, no path, ties, and seeded cases against every path tried.
