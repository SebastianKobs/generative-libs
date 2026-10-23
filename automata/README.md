# automata

A one-row automaton (Wolfram's elementary rules): a row of 0s and 1s, the next row by a rule number 0 to 255, and the rule as a gene, mutated by a bit. No drawing: what a row means, a weft or a bar of 16 steps, is the caller's. It uses only `libs/generative/randomness/`, and hands back a gene as an object fitting genetics' `Gene` by its shape, so a project takes automata without genetics.

```ts
import { nextRow, ruleGene } from './index.ts';
const row = Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]);
nextRow(row, 90);                        // a new row, [0,0,0,1,0,1,0,0,0]: the Sierpinski pattern; row is unchanged
ruleGene().mutate(90, 0.3, randomness);  // one of the rule's eight bits flipped; the depth is unused
```

| File | What it does |
|---|---|
| [`next-row.ts`](next-row.ts) | `nextRow()`: each cell's next state from itself and its two neighbours, wrapping round, by the rule's bit for the three cells read as a number 0 to 7 (left, middle, right); a new row |
| [`rule-gene.ts`](rule-gene.ts) | `ruleGene()`: a gene whose `mutate()` flips one of the rule's eight bits, so it stays 0 to 255 |

Tested in node on a seeded `Randomness` (`test/automata.test.js`).
