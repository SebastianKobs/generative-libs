# generative/genetics

An individual's values varied a little at a time, after Absynth's Mutator: what's repeated is mutated by a depth, every step kept in a lineage you can step back through. No fitness, no death. Seeded, so the same repeat gives the same result. Two genomes can be crossed.

Depends on: `generative/randomness`.

```ts
import { Lineage, mutate, rangedGene, wholeGene, type Genome, type GenomeSchema } from './index.ts';
const schema: GenomeSchema = { shared: { size: rangedGene(scale), petals: wholeGene(3, 9) } }; // scale: a GeneScale
const base: Genome = { shared: { size: 0.5, petals: 5 } };
mutate(base, schema, 0.3, randomness); // each gene moves with a chance of 0.3, on its own stream
const lineage = new Lineage(base, schema);
lineage.mutate(0.3, randomness); // added and current; lineage.select(0) steps back
```

| Export | What it does |
|---|---|
| `Gene`, `GeneValue`, `GeneScale` | A gene is one value and how it moves: `mutate(value, depth, randomness)` and an optional `cross()`. `GeneValue` is a number, an option's name or several; `GeneScale` is a number's range as a position 0 to 1 and back, which the app fills with its params' taper (`gene.ts`). |
| `rangedGene()` | A number moved in position space by up to a third of the travel at depth 1, so a step is as far at the low end of an octaves scale as at the high (`gene.ts`). |
| `wholeGene()` | A whole number moved by 1 either way, held to its bounds (`gene.ts`). |
| `choiceGene()`, `choicesGene()` | One option's name, another with a chance of the depth; a number of options, none twice, one swapped for another, each as likely as its weight. Options are drawn by their names sorted, so reordering them changes nothing a seed grows (`gene.ts`). |
| `Genome`, `GenomeSection`, `GenomeSchema`, `SHARED_SECTION` | A genome in sections: `shared`, each kind's own, any no kind names. A section is its genes' values by name, the schema the genes by section (`genome.ts`). |
| `mutate()` | Each gene moves with a chance of the depth, on a stream named by its section and itself, so a gene added later leaves the others as they were. Only some sections when asked (`genome.ts`). |
| `cross()` | A child of two genomes: each gene a parent's or mixed, then mutated at 0.15 (`genome.ts`). |
| `Individual`, `individualGenome()` | An individual is its id, its kind and its generation from 1. Its genome is the base mutated once for each generation after the first, only `shared` and its kind's section, handed back flat (`genome.ts`). |
| `flatGenome()` | A genome's sections in one object, for what reads it whole (`genome.ts`). |
| `new Lineage(origin, schema)`: `mutate()`, `cross()`, `select()`, `current`, `flat`, `index`, `entries`; `LineageEntry` | A genome and every one it came from: a genome, its parents' indices and a label each. `mutate()` takes all sections or one at a depth scaled up by the square root of how many fewer genes it holds, drawn again up to 8 times until something moves. Nothing is ever removed (`lineage.ts`). |

Tests: `test/genetics.test.js`, on a seeded `Randomness`.
