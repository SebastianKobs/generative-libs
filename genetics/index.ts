// ---------- genetics: an individual's values varied a little at a time, every step kept in a lineage ----------
// Its parts: a gene, one value and how it moves, ranged, whole, a choice or a pair (gene.ts); a genome in sections,
// mutated by a depth, crossed, an individual's own by its id, kind and generation (genome.ts); a genome and every one it
// came from, to step back through (lineage.ts). Uses only libs/generative/randomness/
export { choiceGene, choicesGene, rangedGene, wholeGene, type Gene, type GeneScale, type GeneValue } from './gene.ts';
export {
  cross,
  flatGenome,
  individualGenome,
  mutate,
  SHARED_SECTION,
  type Genome,
  type GenomeSchema,
  type GenomeSection,
  type Individual,
} from './genome.ts';
export { Lineage, type LineageEntry } from './lineage.ts';
