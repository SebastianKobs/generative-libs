# generative/rewriting

An L-system's string (Lindenmayer's) rewritten by a production rule, one rewrite a generation, every letter keeping an id so what grew from what can be followed. A production is a gene, mutated a little at a time within its limits. No turtle: drawing the letters is the caller's job.

Depends on: `generative/randomness`.

The gene it hands back fits genetics' `Gene` by its shape, so a project takes rewriting without genetics.

```ts
import { letter, productionGene, rewrite } from './index.ts';
const axiom = [letter('F', '0', 0), letter('B', '1', 0)];
rewrite(axiom, 'F[+B]', 2); // B becomes the production, twice; 'F' 1.3.0 is the grown B's first letter, born in generation 2
const vines = productionGene({ parts: ['F', '[+B]', '[-B]'], minParts: 3, maxParts: 7, variable: 'B', minVariables: 1, maxVariables: 3 });
vines.mutate('F[+B][-B]F', 0.3, randomness); // one part swapped, dropped or added; the depth is unused
```

| Export | What it does |
|---|---|
| `Letter`, `letter()` | A letter: its character, its id and the generation it was born in (`letter.ts`). |
| `rewrite()` | Every letter that is the variable (`B` unless told) becomes the production. A letter that stays keeps its id; one grown from the variable gets `<parent id>.<its place>` and the generation it was born in (`rewrite.ts`). |
| `productionGene()`, `ProductionLimits` | A gene whose `mutate()` swaps one part with its neighbor, drops one or adds one from `limits.parts`. A change that leaves the limits is not made; a part is a bracketed branch or one character, so brackets stay balanced (`production-gene.ts`). |

Tests: `test/rewriting.test.js`, on a seeded `Randomness`, with Konstrukt's vines' limits.
