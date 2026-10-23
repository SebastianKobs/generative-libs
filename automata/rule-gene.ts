// ---------- libs/generative/automata/rule-gene: a rule number as a gene, one bit flipped ----------

import type { Randomness } from '../randomness/index.ts';

const BITS_IN_A_RULE = 8;

// One of the rule's eight bits flipped: a small change of the rule. The depth is unused: one change
// a mutation
export function ruleGene(): { mutate(rule: number, depth: number, randomness: Randomness): number } {
  return {
    mutate(rule, _depth, randomness) {
      return rule ^ (1 << Math.floor(randomness.next() * BITS_IN_A_RULE));
    },
  };
}
