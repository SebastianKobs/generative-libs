# generative/randomness

Where a generative rule's draws come from, as an interface only: the rules import no generator and depend on nothing. Whoever uses a rule hands in a seeded one, the app its own seeded draws, a test `test/seeded-randomness.js`.

Depends on: nothing.

```ts
import type { Randomness } from './index.ts';

function pickOne(options: string[], randomness: Randomness): string | undefined {
  return options[Math.floor(randomness.next() * options.length)]; // next(): a draw in [0, 1)
}
// randomness: the one handed in; fork(): a stream of its own, by name
pickOne(['a', 'b'], randomness.fork('petals'));
```

| Export | What it does |
|---|---|
| `Randomness` | `next()` is a draw in [0, 1). `fork(name)` is a stream of its own, the same for the same name from the same `Randomness`, whatever was drawn before, so a rule added later leaves the others' draws as they were (`randomness.ts`). |

Tests: none of its own, an interface has no behavior. `test/seeded-randomness.js` is a helper for every package of the group's tests: `seededRandomness(seed)`, mulberry32 (a 32-bit state scrambled to a float) with a string hash for `fork()`.
