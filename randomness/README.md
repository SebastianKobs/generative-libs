# randomness

Where a generative rule's draws come from, as an interface only, so the rules import no generator and depend on nothing. Whoever uses a rule hands in a seeded one: the app its own seeded draws, a test `test/seeded-randomness.js`.

```ts
import type { Randomness } from './index.ts';
function pickOne(options: string[], randomness: Randomness): string | undefined {
  return options[Math.floor(randomness.next() * options.length)];   // next(): a draw in [0, 1)
}
pickOne(['a', 'b'], randomness.fork('petals'));   // fork(): a stream of its own, by name
```

| File | What it does |
|---|---|
| [`randomness.ts`](randomness.ts) | `Randomness`: `next()`, a draw in [0, 1); `fork(name)`, a stream of its own, the same for the same name from the same `Randomness`, whatever was drawn before, so a rule added later leaves the others' draws as they were |

Tested through the genetics' tests, on `test/seeded-randomness.js`: `seededRandomness(seed)`, mulberry32 (a 32-bit state scrambled to a float) and a string hash for `fork()`. A helper, not a test, for every package of the group's tests.
