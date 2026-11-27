# randomness

Where a generative rule's draws come from: an interface, and one seeded generator to hand in. The rules take a `Randomness` and import no generator; whoever uses a rule hands one in, an app or a test `seededRandomness()`, so the same seed gives the same result.

Depends on: nothing.

```ts
import { seededRandomness, type Randomness } from './index.ts';

function pickOne(options: string[], randomness: Randomness): string | undefined {
  return options[Math.floor(randomness.next() * options.length)]; // next(): a draw in [0, 1)
}
const randomness = seededRandomness(42); // the same seed, the same draws
// fork(): a stream of its own, by name
pickOne(['a', 'b'], randomness.fork('petals'));
```

| Export | What it does |
|---|---|
| `Randomness` | `next()` is a draw in [0, 1). `fork(name)` is a stream of its own, the same for the same name from the same `Randomness`, whatever was drawn before, so a rule added later leaves the others' draws as they were (`randomness.ts`). |
| `seededRandomness()` | A `Randomness` from a 32-bit seed: mulberry32 (a 32-bit state scrambled to a float) for `next()`, the seed and the name folded by FNV-1a (a string hash) for `fork()`. Quick and even, not for secrets (`seeded.ts`). |

Tests: `test/randomness.test.js`, the draws against those recorded from the tests' helper. `test/seeded-randomness.js` hands every package's tests `seededRandomness()`, and `test/near.js` compares their numbers.
