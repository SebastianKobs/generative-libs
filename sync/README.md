# generative/sync

Coupled oscillators falling slowly into step (a Kuramoto model: each phase pulled a little toward the others'), a note pulling them to flash: the more a source is played, the more they agree. No drawing: what a phase becomes, a light, a pulse or a voice, is the caller's. Run forward in time, with no past kept.

Depends on: `generative/randomness`.

```ts
import { Flock } from './index.ts';
const rules = { period: 2.4, spread: 0.12, coupling: 0.5, entrain: 0.2 };
const flock = new Flock({ count: 24, topology: 'all', rules }, randomness.fork('flock plant 3')); // paces and first phases drawn from it
flock.advanceTo(8); // steps in 16ths up to beat 8
flock.pull(); // a note at the beat reached: the phases pulled toward the flash (phase 0)
flock.phases; // each oscillator's phase in radians, read-only
flock.rules = { ...rules, coupling: 0.9 }; // from the next step on
```

How it works:

1. A flock is run forward in 16ths of a beat and keeps no copy of its past: the same notes told at the same beats give the same phases, so a garden grown again from its recording draws alike.
2. The caller tells each note before advancing past its beat: `advanceTo(its beat)`, then `pull()`. A beat already reached does nothing, so a flock never goes back.
3. Topology `'all'` pulls each oscillator to the crowd's mean phase, harder the more they agree. `'ring'` pulls each to its two neighbors, a wave walking round, a note pulling hardest near the quarter its count of pulls has walked to.

| Export | What it does |
|---|---|
| `new Flock(shape, randomness)`: `advanceTo()`, `pull()`, `phases`, `rules` | The oscillators, their phases and the rules they follow, which may change from the next step on (`flock.ts`). |
| `FlockShape`, `FlockRules`, `Topology` | A flock's count, topology and rules; the rules are `period`, `spread`, `coupling` and `entrain`; the topology is `'all'` or `'ring'` (`flock.ts`). |

Tests: `test/sync.test.js`, on a seeded `Randomness`.
