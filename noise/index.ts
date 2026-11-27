// ---------- noise: correlated noise drawn from a handed-in Randomness, a step at a time ----------
// Its parts: pink (1/f) noise by Voss-McCartney (pink.ts); a random walk held within ±limit (drift.ts); noise pulled back
// toward its mean (mean-reverting.ts); a normal draw beneath it (normal.ts). Each keeps its state in its instance and
// moves only when its caller steps it. Uses only randomness/
export { Drift, type DriftShape } from './drift.ts';
export { MeanRevertingNoise, type MeanRevertingShape } from './mean-reverting.ts';
export { normalDraw } from './normal.ts';
export { PinkNoise } from './pink.ts';
