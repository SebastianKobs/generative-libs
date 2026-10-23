// ---------- libs/generative/articulation/mark: what a hand makes along a stroke, with no medium in it ----------

// What the hand does with its load
export type Gesture = 'drip' | 'pour' | 'fling' | 'splatter';

// The hand's qualities, each 0 to 1 unless said
//   viscosity: 0 runs thin and far, 1 stays in fat round marks
//   height: how far it falls: higher, a wider throw and a thinner thread
//   speed: the hand's own: fast stretches the line thin and throws far
//   load: what's on the brush: more, a longer line before it runs out
//   reach: how far a throw carries, 1 as usual
export interface Hand {
  readonly gesture: Gesture;
  readonly viscosity: number;
  readonly height: number;
  readonly speed: number;
  readonly load: number;
  readonly reach?: number;
}

// How a flick's marks are thrown: 'splatter' dots, 'fling' streaks, 'drip' dots with tails
export type FlickManner = 'splatter' | 'fling' | 'drip';

// Where a mark is on the stroke, when the hand reaches it, and what the hand makes there
//   along: the place on the stroke, 0 at its start, 1 at its end
//   beat: the time the hand reaches it (a line: where it ends)
//   intensity: the load left, 1 full, falling to 0.35 as the load runs out
//   weight: the stroke's thickness there, unitless: thick for thick, plentiful loads, thin where
//     the hand is fast and the load falls far; every `size` is in weights
export interface MarkPlace {
  readonly along: number;
  readonly beat: number;
  readonly x: number;
  readonly y: number;
  readonly intensity: number;
  readonly weight: number;
}

// A stretch of the stroke made: `from` its start, `duration` how long it took, `size` the share of
// the weight it is made at
export interface LineMark extends MarkPlace {
  readonly kind: 'line';
  readonly from: { readonly x: number; readonly y: number; readonly beat: number };
  readonly duration: number;
  readonly size: number;
}

// A stretch the load left unmade
export interface BreakMark extends MarkPlace {
  readonly kind: 'break';
}

// A point on the stroke: `size`, and `tail`, how far it trails
export interface BeadMark extends MarkPlace {
  readonly kind: 'bead';
  readonly size: number;
  readonly tail: number;
}

// Where the hand slows and a thick load gathers
export interface PoolMark extends MarkPlace {
  readonly kind: 'pool';
  readonly size: number;
}

// A round mark: the landing, a dot of a splatter
export interface BlotMark extends MarkPlace {
  readonly kind: 'blot';
  readonly size: number;
}

// Marks thrown off the stroke
//   count: how many; heading and fan: the direction they leave in and the angle they spread over
//   throw: how far they go, in the plane's units; scatter: how far, in weights (a splatter's dots)
//   progress: for the flick of what's left once the load has run out, how far past the run-out the
//     stroke has come, 0 to 1
export interface FlickMark extends MarkPlace {
  readonly kind: 'flick';
  readonly manner: FlickManner;
  readonly count: number;
  readonly heading: number;
  readonly fan: number;
  readonly size: number;
  readonly throw?: number;
  readonly scatter?: number;
  readonly progress?: number;
}

// What `articulate()` makes: marks each with its place, its time, its kind and its intensity
export type Mark = LineMark | BreakMark | BeadMark | PoolMark | BlotMark | FlickMark;

// A line of a throw whose shape only the caller knows: from where it starts to where it ends, no time
export interface SweepLine {
  readonly kind: 'line';
  readonly from: { readonly along: number };
  readonly along: number;
  readonly intensity: number;
  readonly weight: number;
  readonly size: number;
}

// The flick off the end of a throw: its `heading` relative to the stroke's direction there
export interface SweepFlick {
  readonly kind: 'flick';
  readonly along: number;
  readonly intensity: number;
  readonly count: number;
  readonly throw: number;
  readonly heading: number;
  readonly fan: number;
  readonly manner: FlickManner;
}

// What `sweep()` makes
export type SweepMark = SweepLine | SweepFlick;
