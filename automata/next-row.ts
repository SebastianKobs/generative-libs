// ---------- generative/automata/next-row: a one-row automaton's next row, by a rule number ----------

// Each cell's next state is read from itself and its two neighbours (left, middle, right) as a number
// 0 to 7, the rule's bit of that number: rule 90 is left xor right. The row wraps round
export function nextRow(row: Uint8Array, rule: number): Uint8Array {
  const next = new Uint8Array(row.length);
  for (let cell = 0; cell < row.length; cell++) {
    const left = row[(cell + row.length - 1) % row.length] ?? 0;
    const middle = row[cell] ?? 0;
    const right = row[(cell + 1) % row.length] ?? 0;
    next[cell] = (rule >> ((left << 2) | (middle << 1) | right)) & 1;
  }
  return next;
}
