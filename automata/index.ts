// ---------- automata: a one-row automaton, its rule a number and a gene ----------
// Its parts: the next row by a rule (next-row.ts); a rule mutated by a bit, fitting genetics' Gene by its
// shape (rule-gene.ts). Uses only libs/generative/randomness/. No drawing: what a row means is the caller's
export { nextRow } from './next-row.ts';
export { ruleGene } from './rule-gene.ts';
