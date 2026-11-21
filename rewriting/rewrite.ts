// ---------- generative/rewriting/rewrite: an L-system's string rewritten, a generation at a time ----------

import { letter, type Letter } from './letter.ts';

// Every letter that is the variable becomes the production. A letter that stays keeps its id;
// one grown from the variable gets `<parent id>.<its place>` and the generation it was born in
export function rewrite(axiom: readonly Letter[], production: string, generations: number, variable = 'B'): Letter[] {
  let letters: readonly Letter[] = axiom;
  for (let generation = 1; generation <= generations; generation++) {
    letters = letters.flatMap((parent) => {
      if (parent.character !== variable) {
        return [parent];
      }
      return production.split('').map((character, place) => letter(character, `${parent.id}.${place}`, generation));
    });
  }
  return [...letters];
}
