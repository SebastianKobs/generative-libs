// ---------- libs/generative/articulation/stroke: a path made into a stroke, samples with their time and speed ----------

// A point the hand passes, and when
export interface PathPoint {
  readonly x: number;
  readonly y: number;
  readonly beat: number;
}

// A sample of a stroke: its place, how far along the stroke it is (0 at its start, 1 at its end),
// its time and the hand's speed there (1 is the usual pace)
export interface StrokePoint {
  readonly x: number;
  readonly y: number;
  readonly along: number;
  readonly beat: number;
  readonly speed: number;
}

// The hand's usual pace in the plane's units a beat: a stroke's speed of 1
export const USUAL_SPEED = 0.06;

const SAMPLES_PER_SEGMENT = 4;
// the shortest time a stretch is taken to last, so a stretch at one beat never divides by zero
const SHORTEST_STRETCH_BEATS = 0.01;

// A path as a stroke: a curve through its points (Catmull-Rom: each stretch bends towards its
// neighbours), four samples a stretch, each carrying how far along it is (by index, so a
// half-made stroke is a prefix of the whole one), its time and the hand's speed there
export function strokeOf(path: readonly PathPoint[]): StrokePoint[] {
  const last = path.at(-1);
  if (last === undefined) {
    return [];
  }
  const stroke: StrokePoint[] = [];
  for (let stretch = 0; stretch < path.length - 1; stretch++) {
    stroke.push(...samplesOfStretch(path, stretch));
  }
  stroke.push({
    x: last.x,
    y: last.y,
    along: path.length > 1 ? 1 : 0,
    beat: last.beat,
    speed: stroke.at(-1)?.speed ?? 1,
  });
  return stroke;
}

// The samples of the stretch from path[stretch] to the next point
function samplesOfStretch(path: readonly PathPoint[], stretch: number): StrokePoint[] {
  const from = pointAt(path, stretch);
  const to = pointAt(path, stretch + 1);
  const before = pointAt(path, stretch - 1);
  const after = pointAt(path, stretch + 2);
  const sampleBeats = Math.max(SHORTEST_STRETCH_BEATS, (to.beat - from.beat) / SAMPLES_PER_SEGMENT);
  const speed = Math.hypot(to.x - from.x, to.y - from.y) / SAMPLES_PER_SEGMENT / sampleBeats / USUAL_SPEED;
  const samples: StrokePoint[] = [];
  for (let step = 0; step < SAMPLES_PER_SEGMENT; step++) {
    const fraction = step / SAMPLES_PER_SEGMENT;
    samples.push({
      x: spline(before.x, from.x, to.x, after.x, fraction),
      y: spline(before.y, from.y, to.y, after.y, fraction),
      along: (stretch * SAMPLES_PER_SEGMENT + step) / ((path.length - 1) * SAMPLES_PER_SEGMENT),
      beat: from.beat + step * ((to.beat - from.beat) / SAMPLES_PER_SEGMENT),
      speed,
    });
  }
  return samples;
}

// The path's point at an index, held to the path's ends: the first and last points are their own neighbours
function pointAt(path: readonly PathPoint[], index: number): PathPoint {
  const point = path[Math.max(0, Math.min(path.length - 1, index))];
  if (point === undefined) {
    throw new Error('pointAt() needs a path with a point');
  }
  return point;
}

// Catmull-Rom: the curve between b and c at `fraction` (0..1), bent towards a and d
function spline(a: number, b: number, c: number, d: number, fraction: number): number {
  const squared = fraction * fraction;
  const cubed = squared * fraction;
  return 0.5 * (2 * b + (-a + c) * fraction + (2 * a - 5 * b + 4 * c - d) * squared + (-a + 3 * b - 3 * c + d) * cubed);
}
