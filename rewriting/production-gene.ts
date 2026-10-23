// ---------- libs/generative/rewriting/production-gene: a production rule as a gene, mutated within limits ----------

import type { Randomness } from '../randomness/index.ts';

// What a production may be
//   parts: the parts a new one is drawn from, e.g. ['F', '[+B]', '[-B]']
//   minParts, maxParts: how many parts it may hold
//   variable: the letter that is rewritten; minVariables, maxVariables: how many parts may hold it
//   (more than that grows past what can be drawn or played calmly)
export interface ProductionLimits {
  readonly parts: readonly string[];
  readonly minParts: number;
  readonly maxParts: number;
  readonly variable: string;
  readonly minVariables: number;
  readonly maxVariables: number;
}

// Where in the draw a swap, a drop or an add begins: 40 % swap, 30 % drop, 30 % add
const SWAP_BELOW = 0.4;
const DROP_BELOW = 0.7;

// One part swapped with its neighbour, dropped or added: a small change of shape. The depth is unused:
// one change a mutation. A change that leaves the limits is not made
export function productionGene(limits: ProductionLimits): {
  mutate(production: string, depth: number, randomness: Randomness): string;
} {
  return {
    mutate(production, _depth, randomness) {
      const parts = partsOf(production);
      const place = Math.floor(randomness.next() * parts.length);
      const change = randomness.next();
      const here = parts[place];
      const neighbour = parts[place + 1];
      if (change < SWAP_BELOW && here !== undefined && neighbour !== undefined) {
        parts.splice(place, 2, neighbour, here);
      } else if (change < DROP_BELOW) {
        parts.splice(place, 1);
      } else {
        const added = limits.parts[Math.floor(randomness.next() * limits.parts.length)];
        if (added === undefined) {
          return production;
        }
        parts.splice(place, 0, added);
      }
      return isWithinLimits(parts, limits) ? parts.join('') : production;
    },
  };
}

// 'F[+B][-B]F' as its parts: F, [+B], [-B], F. A branch is one part, so brackets stay balanced
function partsOf(production: string): string[] {
  return production.match(/\[[^\]]*\]|./g) ?? [];
}

function isWithinLimits(parts: readonly string[], limits: ProductionLimits): boolean {
  const branching = parts.filter((part) => part.includes(limits.variable)).length;
  return (
    parts.length >= limits.minParts
    && parts.length <= limits.maxParts
    && branching >= limits.minVariables
    && branching <= limits.maxVariables
  );
}
