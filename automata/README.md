# generative/automata

A one-row automaton (Wolfram's elementary rules): a row of 0s and 1s, the next row by a rule number 0 to 255, and the rule as a gene, mutated by a bit. No drawing: what a row means, a weft or a bar of 16 steps, is the caller's.

Depends on: `generative/randomness`.

The gene it hands back fits genetics' `Gene` by its shape, so a project takes automata without genetics.

```ts
import { nextRow, ruleGene } from './index.ts';
const row = Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]);
nextRow(row, 90); // a new row, [0,0,0,1,0,1,0,0,0]: the Sierpinski pattern; row is unchanged
ruleGene().mutate(90, 0.3, randomness); // one of the rule's eight bits flipped; the depth is unused
```

| Export | What it does |
|---|---|
| `nextRow()` | Each cell's next state from itself and its two neighbors, wrapping round: the rule's bit for the three cells read as a number 0 to 7 (left, middle, right). It makes a new row (`next-row.ts`). |
| `ruleGene()` | A gene whose `mutate()` flips one of the rule's eight bits, so the rule stays 0 to 255 (`rule-gene.ts`). |

Tests: `test/automata.test.js`, on a seeded `Randomness`.
