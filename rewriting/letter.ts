// ---------- libs/generative/rewriting/letter: one letter of an L-system's string, and who it grew from ----------

// A letter: its character, an id kept through the generations, and the generation it was born in
export interface Letter {
  readonly character: string;
  readonly id: string;
  readonly born: number;
}

export function letter(character: string, id: string, born: number): Letter {
  return { character, id, born };
}
