# articulation

What a hand's gesture makes along a stroke, with no medium in it: a stroke (points with times) and the hand's qualities go in, marks come out, each with its place along the stroke, its time, its kind and its intensity. A drawing takes the marks as paint, a score as notes (a line a legato run, a break a rest, a bead a staccato note, intensity the dynamics). It uses only `libs/generative/randomness/`: no paint, no notes.

```ts
import { articulate, carryOf, strokeOf, sweep, type Hand } from './index.ts';
const stroke = strokeOf([{ x: 0, y: 0, beat: 0 }, { x: 0.2, y: 0.1, beat: 4 }, { x: 0.5, y: 0.1, beat: 8 }]);
const hand: Hand = { gesture: 'pour', viscosity: 0.6, height: 0.5, speed: 0.5, load: 0.7 };
articulate(stroke, hand, randomness.fork('plant 3:1'), { upTo: 0.5, landing: 1 });   // the marks of the first half, a landing first
sweep(hand, { upTo: 0.5 });                    // a throw's lines thinning as they go; its flick only once the whole is made
carryOf(hand, randomness.fork('plant 3:1'));   // how far one throw carries, in quarter turns
```

The plane is the sketch's: a stroke whose usual pace is `USUAL_SPEED` a beat, so the caller scales its own coordinates to it, and every distance a mark carries (`throw`, `scatter`) is in them. A caller forks one `Randomness` per stroke and repeat (a plant's id and its occurrence), so each repeat varies and the same one draws the same marks.

| File | What it does |
|---|---|
| [`stroke.ts`](stroke.ts) | `strokeOf()`: a path of `PathPoint`s as a curve through them (Catmull-Rom), four samples a stretch, each a `StrokePoint` with how far along it is (by index, so a half-made stroke is a prefix of the whole one), its time and the hand's speed; `USUAL_SPEED` |
| [`mark.ts`](mark.ts) | `Hand` and its `Gesture` (drip, pour, fling, splatter); `Mark`, a union by `kind`: `line`, `break`, `bead`, `pool`, `blot`, `flick`; `SweepMark`: a throw's `line` and `flick` |
| [`articulate.ts`](articulate.ts) | `articulate()`: the marks of a stroke made as far as `upTo`, a landing first if asked, drawing from `randomness.fork('marks')`, two numbers a sample whether it is made or not; the load running out; `carryOf()`: how far a throw carries, from `randomness.fork('carry')` |
| [`sweep.ts`](sweep.ts) | `sweep()`: a throw whose shape only the caller knows: a line a step thinning as it goes, a flick off its end once the whole is made; no time |

Tested in node on a seeded `Randomness` (`test/articulation.test.js`).
