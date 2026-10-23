# sync

Coupled oscillators falling slowly into step (a Kuramoto model: each phase pulled a little towards the others'), a note pulling them to flash: the more a source is played, the more they agree. A flock is run forward in 16ths of a beat and keeps no copy of its past: the same notes told at the same beats give the same phases, so a garden grown again from its recording draws alike. No drawing: what a phase becomes, a light, a pulse or a voice, is the caller's. It uses only `libs/generative/randomness/`.

```ts
import { Flock } from './index.ts';
const rules = { period: 2.4, spread: 0.12, coupling: 0.5, entrain: 0.2 };
const flock = new Flock({ count: 24, topology: 'all', rules }, randomness.fork('flock plant 3'));   // paces and first phases drawn from it
flock.advanceTo(8);     // steps in 16ths up to beat 8
flock.pull();           // a note at the beat reached: the phases pulled towards the flash (phase 0)
flock.phases;           // each oscillator's phase in radians, read-only
flock.rules = { ...rules, coupling: 0.9 };   // from the next step on
```

The caller tells each note before advancing past its beat: `advanceTo(its beat)`, then `pull()`. A beat already reached does nothing, so a flock never goes back. `topology` is `'all'` (each pulled to the crowd's mean phase, harder the more they agree) or `'ring'` (each to its two neighbours, a wave walking round, a note pulling hardest near the quarter its count of pulls has walked to).

| File | What it does |
|---|---|
| [`flock.ts`](flock.ts) | `Flock`: `advanceTo()`, `pull()`, `phases`, `rules`; `FlockShape`, `FlockRules` (`period`, `spread`, `coupling`, `entrain`), `Topology` |

Tested in node on a seeded `Randomness` (`test/sync.test.js`).
