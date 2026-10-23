# genetics

An individual's values varied a little at a time, after Absynth's Mutator: what's repeated is mutated by a depth, every step kept in a lineage you can step back through. No fitness, no death. Seeded, so the same repeat gives the same result. It uses only `libs/generative/randomness/`.

```ts
import { Lineage, mutate, rangedGene, wholeGene, type Genome, type GenomeSchema } from './index.ts';
const schema: GenomeSchema = { shared: { size: rangedGene(scale), petals: wholeGene(3, 9) } };   // scale: a GeneScale
const base: Genome = { shared: { size: 0.5, petals: 5 } };
mutate(base, schema, 0.3, randomness);    // each gene moves with a chance of 0.3, on its own stream
const lineage = new Lineage(base, schema);
lineage.mutate(0.3, randomness);          // added and current; lineage.select(0) steps back
```

| File | What it does |
|---|---|
| [`gene.ts`](gene.ts) | `Gene<Value>`: `mutate(value, depth, randomness)` and an optional `cross()`; `GeneValue`, a number, an option's name or several; `GeneScale`, a number's range as a position 0 to 1 and back, which the app fills with its params' taper; `rangedGene()`, moved in position space by up to a third of the travel at depth 1, so a step is as far at the low end of an octaves scale as at the high; `wholeGene()`, by 1, held to its bounds; `choiceGene()`, another option with a chance of the depth; `choicesGene()`, a number of options none twice, one swapped for another, each as likely as its weight (1 where none is given). A choice is drawn by its options' names sorted, so reordering them changes nothing a seed grows |
| [`genome.ts`](genome.ts) | `Genome`, in sections (`shared`, each kind's own, any no kind names), and its `GenomeSchema` of genes; `mutate()`, each gene on a stream named by its section and itself, so a gene added later leaves the others as they were, of some sections only when asked; `cross()`, each gene a parent's or mixed, then mutated at 0.15; `individualGenome()`, a base mutated once for each generation after the first by its id, only `shared` and the section its kind names, handed back flat; `flatGenome()` |
| [`lineage.ts`](lineage.ts) | `Lineage`: a genome and every one it came from; `mutate()`, all sections or one alone at a depth scaled up by the square root of how many fewer genes it holds, drawn again up to 8 times until something moves; `cross()` with another entry; `select()` any entry; `current`, `flat`, `index`, `entries`; nothing is ever removed |

Tested in node on a seeded `Randomness` (`test/genetics.test.js`).
