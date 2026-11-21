// ---------- rewriting: an L-system's letters rewritten by a production rule, a production as a gene ----------
// Its parts: a letter and the id it keeps (letter.ts); the string rewritten a generation at a time (rewrite.ts);
// a production mutated within its limits, fitting genetics' Gene by its shape (production-gene.ts).
// Uses only generative/randomness/. No turtle: drawing the letters is the caller's job
export { letter, type Letter } from './letter.ts';
export { productionGene, type ProductionLimits } from './production-gene.ts';
export { rewrite } from './rewrite.ts';
