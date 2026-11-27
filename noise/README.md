# noise

Correlated noise, values that wander rather than jump: pink (1/f) noise, a drift held within a limit, and noise pulled back toward a mean. Each draws from a `Randomness` handed in and moves one step each time its caller steps it, so the same seed gives the same series. What a value becomes, a pitch's wobble, a timing's push or a shade, is the caller's.

Depends on: `randomness`.

```ts
import { Drift, MeanRevertingNoise, PinkNoise } from './index.ts';
const pink = new PinkNoise(12, randomness.fork('pink')); // 12 sources: about 12 octaves of 1/f
const drift = new Drift({ step: 0.02, limit: 1 }, randomness.fork('drift')); // never past ±1
const tempo = new MeanRevertingNoise({ mean: 0, rate: 0.1, spread: 0.3 }, randomness.fork('tempo'));
pink.step(); // one step on, the new value; pink.value reads it again
```

How it works:

1. Pink: several sources summed, the first re-drawn every step, each next at half the rate of the one before; a source held 2ᵏ steps adds power only below about 1/2ᵏ, so the power falls about 3 dB an octave.
2. Drift: each step moves it evenly within ±step; past an edge it comes back by what it overshot.
3. Mean-reverting: each step pulls it back toward its mean by its rate, then pushes it by a normal draw sized so its long-run spread is the one asked.

| Export | What it does |
|---|---|
| `new PinkNoise(sources, randomness)`: `step()`, `value` | Pink noise by Voss-McCartney, the mean of its sources, each even in [−1, 1), so within ±1. The slower sources take turns, one moving a step (`pink.ts`). |
| `new Drift(shape, randomness)`: `step()`, `value`; `DriftShape` | A random walk moving up to `step` a step, held within ±`limit` by reflecting at the edges, from `start` or 0 (`drift.ts`). |
| `new MeanRevertingNoise(shape, randomness)`: `step()`, `value`; `MeanRevertingShape` | A discrete Ornstein-Uhlenbeck process: pulled toward `mean` by `rate` (above 0, at most 1) a step, with `spread` its long-run standard deviation, from `start` or its mean (`mean-reverting.ts`). |
| `normalDraw()` | A normal draw, mean 0 and spread 1, from two of a `Randomness`'s draws by Box-Muller, which turns them into a radius and an angle (`normal.ts`). |

Tests: `test/noise.test.js`, on a seeded `Randomness`: the same seed the same series, the bounds over long runs, pink's slope near −1 against white's flat one, the mean and spread asked.
