// ---------- generative/genetics/lineage: a genome and every one it came from: mutate, cross, step back ----------

import type { Randomness } from '../randomness/index.ts';
import { cross, flatGenome, mutate, type Genome, type GenomeSchema, type GenomeSection } from './genome.ts';

// One genome kept: where it came from (the entries before it, by index) and what made it
export interface LineageEntry {
  genome: Genome;
  parents: readonly number[];
  label: string;
}

// The most a mutation is drawn again to move something
const MUTATE_ATTEMPTS = 8;

// Every genome made from an origin, none ever removed: no fitness, no death, what is repeated is
// mutated and every ancestor kept. `select()` makes any of them current again.
export class Lineage {
  readonly #schema: GenomeSchema;
  readonly #entries: LineageEntry[];
  #current = 0;

  constructor(origin: Genome, schema: GenomeSchema) {
    this.#schema = schema;
    this.#entries = [{ genome: origin, parents: [], label: 'origin' }];
  }

  get current(): Genome {
    return this.#entryAt(this.#current).genome;
  }
  // the current genome flat: every section's genes in one object
  get flat(): GenomeSection {
    return flatGenome(this.current);
  }
  get index(): number {
    return this.#current;
  }
  get entries(): readonly LineageEntry[] {
    return this.#entries;
  }

  // The current genome mutated, added and made current. One section alone, when given: at a depth
  // scaled up (see below), or it would move a gene or two where all the sections move many.
  // The same randomness gives the same mutation, so hand in a new one each time.
  mutate(depth: number, randomness: Randomness, section?: string): void {
    const sections = section === undefined ? undefined : [section];
    const label = section === undefined ? 'mutated' : `mutated: ${section}`;
    const scaled = this.#sectionDepth(depth, section);
    let tried = this.current;
    // the button always changes something: drawn again while a mutation moves nothing
    for (let attempt = 1; attempt <= MUTATE_ATTEMPTS && !this.#moved(tried); attempt++) {
      tried = mutate(this.current, this.#schema, scaled, randomness.fork(`attempt ${attempt}`), sections);
    }
    this.#add(tried, [this.#current], label);
  }
  // The current genome crossed with the entry `other`, added and made current
  cross(other: number, randomness: Randomness): void {
    const child = cross(this.current, this.#entryAt(other).genome, this.#schema, randomness);
    this.#add(child, [this.#current, other], 'crossed');
  }
  // Any entry made current, to step back to
  select(index: number): void {
    this.#current = index;
  }

  // One section mutated alone at the depth given would move far fewer genes than every section
  // does (playtest: "the single mutates are a bit too small compared to the all mutate"):
  // its depth scaled up by the square root of how many fewer genes it holds, at most 1.
  #sectionDepth(depth: number, section: string | undefined): number {
    if (section === undefined) {
      return depth;
    }
    const all = Object.values(this.#schema).reduce((count, genes) => count + Object.keys(genes).length, 0);
    const own = Object.keys(this.#schema[section] ?? {}).length;
    if (own === 0) {
      return depth;
    }
    return Math.min(1, depth * Math.sqrt(all / own));
  }
  #moved(genome: Genome): boolean {
    return JSON.stringify(genome) !== JSON.stringify(this.current);
  }
  #add(genome: Genome, parents: readonly number[], label: string): void {
    this.#entries.push({ genome, parents, label });
    this.#current = this.#entries.length - 1;
  }
  #entryAt(index: number): LineageEntry {
    const entry = this.#entries[index];
    if (entry === undefined) {
      throw new RangeError(`no entry ${index} in a lineage of ${this.#entries.length}`);
    }
    return entry;
  }
}
