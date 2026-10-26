# generative/articulation

What a hand's gesture makes along a stroke, with no medium in it. A stroke (points with times) and the hand's qualities go in; marks come out, each with its place along the stroke, its time, its kind and its intensity. A drawing takes the marks as paint, a score as notes: a line a legato run, a break a rest, a bead a staccato note, intensity the dynamics.

Depends on: `generative/randomness`.

```ts
import { articulate, carryOf, strokeOf, sweep, type Hand } from './index.ts';
const stroke = strokeOf([{ x: 0, y: 0, beat: 0 }, { x: 0.2, y: 0.1, beat: 4 }, { x: 0.5, y: 0.1, beat: 8 }]);
const hand: Hand = { gesture: 'pour', viscosity: 0.6, height: 0.5, speed: 0.5, load: 0.7 };
articulate(stroke, hand, randomness.fork('plant 3:1'), { upTo: 0.5, landing: 1 }); // the first half's marks, a landing first
sweep(hand, { upTo: 0.5 }); // a throw's lines thinning as they go; its flick only once the whole is made
carryOf(hand, randomness.fork('plant 3:1')); // how far one throw carries, in quarter turns
```

How it works:

1. The caller scales its coordinates to a plane where a stroke's usual pace is `USUAL_SPEED` a beat. Every distance a mark carries (`throw`, `scatter`) is in those units.
2. The caller forks one `Randomness` per stroke and repeat (a plant's id and its occurrence), so each repeat varies and the same one draws the same marks.

| Export | What it does |
|---|---|
| `strokeOf()`, `PathPoint`, `StrokePoint`, `USUAL_SPEED` | A path of points as a curve through them (Catmull-Rom), four samples a stretch. Each sample has how far along it is, so a half-made stroke is a prefix of the whole one, its time and the hand's speed (`stroke.ts`). |
| `Hand`, `Gesture` | The hand's qualities, each 0 to 1: `viscosity`, `height`, `speed`, `load` and an optional `reach`; its gesture is drip, pour, fling or splatter (`mark.ts`). |
| `Mark`, `MarkPlace`, `FlickManner` | A mark is a union by `kind`; each has a `MarkPlace`: along the stroke, beat, position, intensity and weight. A flick is thrown as splatter dots, fling streaks or drip dots with tails (`mark.ts`). |
| `LineMark`, `BreakMark`, `BeadMark`, `PoolMark`, `BlotMark`, `FlickMark` | The six kinds: a stretch made, a stretch the load left unmade, a point with a tail, where a thick load gathers, a round mark, marks thrown off the stroke (`mark.ts`). |
| `SweepMark`, `SweepLine`, `SweepFlick` | What `sweep()` makes: a throw's lines and its flick, with no time (`mark.ts`). |
| `articulate()`, `ArticulateOptions` | A stroke's marks, made as far as `upTo`, a landing first if `landing` is above 0. Each sample draws two numbers whether it is made or not, so it rolls the same however far the stroke has come (`articulate.ts`). |
| `carryOf()` | How far a throw carries, in quarter turns, from `randomness.fork('carry')` (`articulate.ts`). |
| `sweep()`, `SweepOptions` | A throw whose shape only the caller knows: a line a step thinning as it goes, a flick off its end once the whole is made (`sweep.ts`). |

Tests: `test/articulation.test.js`, on a seeded `Randomness`.
