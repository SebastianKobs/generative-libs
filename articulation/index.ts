// ---------- articulation: what a hand's gesture makes along a stroke, with no medium in it ----------
// Its parts: a path made into a stroke (stroke.ts); a stroke's marks from the hand's qualities, their place, time,
// kind and intensity (articulate.ts, mark.ts); a throw whose shape the caller knows (sweep.ts).
// Uses only libs/generative/randomness/. No paint, no notes: what a mark becomes is the caller's job
export { articulate, carryOf, type ArticulateOptions } from './articulate.ts';
export type {
  BeadMark,
  BlotMark,
  BreakMark,
  FlickManner,
  FlickMark,
  Gesture,
  Hand,
  LineMark,
  Mark,
  MarkPlace,
  PoolMark,
  SweepFlick,
  SweepLine,
  SweepMark,
} from './mark.ts';
export { strokeOf, USUAL_SPEED, type PathPoint, type StrokePoint } from './stroke.ts';
export { sweep, type SweepOptions } from './sweep.ts';
