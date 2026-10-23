// ---------- libs/generative/randomness: where a draw comes from, handed in, so nothing here imports a generator ----------

// The draws a generative rule takes, seeded by whoever hands it in
export interface Randomness {
  // a draw in [0, 1)
  next(): number;
  // a stream of its own: the same for the same name from the same Randomness, whatever was drawn before
  fork(name: string): Randomness;
}
