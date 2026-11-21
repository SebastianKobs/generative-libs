// ---------- generative/genetics/genome: values in sections, mutated, crossed, an individual's own ----------

import type { Randomness } from '../randomness/index.ts';
import type { Gene, GeneValue } from './gene.ts';

// A genome: sections of values, `shared` the genes every kind of plant reads, then each kind's own
// and any no kind names (a floor's)
export type GenomeSection = Readonly<Record<string, GeneValue>>;
export type Genome = Readonly<Record<string, GenomeSection>>;
// What each value may be and how it moves: the genome's own shape, of genes
export type GenomeSchema = Readonly<Record<string, Readonly<Record<string, Gene<GeneValue>>>>>;
// Who a genome is for: its id, its kind (the section that is its own) and its generation, from 1
export interface Individual {
  id: string;
  kind: string;
  generation: number;
}

export const SHARED_SECTION = 'shared';
// A cross's small mutation, as the design document's hybrid
const CROSS_DEPTH = 0.15;

// A genome a little changed: each gene moves with a chance of `depth`, on a stream of its own,
// named by its section and itself. So a gene added later leaves every other gene's move as it was.
// `sections` limits it to those named; every section when not given.
export function mutate(
  genome: Genome,
  schema: GenomeSchema,
  depth: number,
  randomness: Randomness,
  sections?: readonly string[],
): Genome {
  const mutated: Record<string, GenomeSection> = { ...genome };
  for (const [section, genes] of Object.entries(schema)) {
    if (sections && !sections.includes(section)) {
      continue;
    }
    mutated[section] = mutateSection(genome[section] ?? {}, genes, depth, randomness, section);
  }
  return mutated;
}

// A child of two genomes: each gene from one parent or mixed by its gene, then a small mutation
export function cross(first: Genome, second: Genome, schema: GenomeSchema, randomness: Randomness): Genome {
  const child: Record<string, GenomeSection> = {};
  for (const [section, genes] of Object.entries(schema)) {
    child[section] = crossSection(first[section] ?? {}, second[section] ?? {}, genes, randomness, section);
  }
  return mutate(child, schema, CROSS_DEPTH, randomness.fork('cross mutation'));
}

// An individual's genome: the base, mutated once for each generation after the first, by the
// individual and the generation, so the same generation always gives the same result (scrubbing
// back and forth). Only `shared` and the section its kind names move; it's handed back flat, shared's
// genes then its own, as a reader takes them. A kind with no section has shared's alone.
export function individualGenome(
  base: Genome,
  schema: GenomeSchema,
  individual: Individual,
  depth: number,
  randomness: Randomness,
): GenomeSection {
  const sections = [SHARED_SECTION, individual.kind];
  let genome = base;
  for (let generation = 2; generation <= individual.generation; generation++) {
    const own = randomness.fork(`${individual.id}:${generation}`);
    genome = mutate(genome, schema, depth, own, sections);
  }
  return { ...genome[SHARED_SECTION], ...genome[individual.kind] };
}

// A genome flat, every section's genes in one object, for what reads the genome whole (a floor)
export function flatGenome(genome: Genome): GenomeSection {
  return Object.fromEntries(Object.values(genome).flatMap((section) => Object.entries(section)));
}

function mutateSection(
  values: GenomeSection,
  genes: Readonly<Record<string, Gene<GeneValue>>>,
  depth: number,
  randomness: Randomness,
  section: string,
): GenomeSection {
  const mutated: Record<string, GeneValue> = { ...values };
  for (const [name, gene] of Object.entries(genes)) {
    const own = randomness.fork(`${section}.${name}`);
    const value = values[name];
    // a gene moves only where its first draw is within the depth
    if (value === undefined || own.next() > depth) {
      continue;
    }
    mutated[name] = gene.mutate(value, depth, own);
  }
  return mutated;
}

function crossSection(
  first: GenomeSection,
  second: GenomeSection,
  genes: Readonly<Record<string, Gene<GeneValue>>>,
  randomness: Randomness,
  section: string,
): GenomeSection {
  const child: Record<string, GeneValue> = {};
  for (const [name, gene] of Object.entries(genes)) {
    const own = randomness.fork(`cross ${section}.${name}`);
    const one = first[name];
    const other = second[name];
    if (one === undefined || other === undefined) {
      continue;
    }
    child[name] = gene.cross ? gene.cross(one, other, own) : parentOf(one, other, own);
  }
  return child;
}

// One parent's value, as a gene with no cross() of its own is crossed
function parentOf(first: GeneValue, second: GeneValue, randomness: Randomness): GeneValue {
  return randomness.next() < 0.5 ? first : second;
}
