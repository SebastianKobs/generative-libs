# The generative libraries

Generative rules, free of any medium: for a patch, a pattern, a phrase or a look. Each is a folder: its entry (`genetics/index.ts`), its README, its tests in a folder beside it (`genetics/test/`). A library imports only those its row in the import test names (`test/module-rules.js`), each through its entry.

- [`randomness/`](randomness/README.md): where a draw comes from.
- [`genetics/`](genetics/README.md): values varied a little at a time, crossed.
- [`rewriting/`](rewriting/README.md): an L-system rewritten by a production.
- [`automata/`](automata/README.md): a one-row automaton by a rule number.
- [`articulation/`](articulation/README.md): what a gesture makes along a stroke.
- [`sync/`](sync/README.md): coupled oscillators falling into step.
- [`trails/`](trails/README.md): a slime mold's agents on a field.

Reads: nothing outside the libraries; `genetics/`, `rewriting/`, `automata/`, `articulation/`, `sync/` and `trails/` each read `randomness/` alone, not each other: the genes of `rewriting/` and `automata/` fit genetics' `Gene` by their shape. The seeded random is handed in, so each library travels alone.

## Using them

Take the libraries you need: copy their folders, or mount this repo as a git submodule, and import each library through its entry. The TypeScript runs as it is: Node strips the types, and a bundler such as Vite reads it. The libraries need no npm package.

- **Draws handed in.** Every rule takes a `Randomness` (`randomness/index.ts`): `next()` a draw in [0, 1), `fork(name)` a stream of its own. The tests' seeded one is `randomness/test/seeded-randomness.js`, beside `near.js`, which the tests compare numbers with.
- **Time is the caller's.** A rule that runs in time is advanced by its caller, to a beat or a step, and keeps no past.
- **Mounted in a project.** The project clones it with `git submodule update --init`. Changes are made and committed in the mount: once per clone, `git config core.hooksPath .githooks` there, so a labeled commit's hash is filled into `technical-log.md`, and `npm install` for the checks; `make test-unit` runs before each commit. The project then moves its pin to the new commit.

## How they're tested

`make test-unit` runs the type check, the format check, the linter, Knip, the class members check and the clone finder, then every library's tests (`*/test/`) and those across libraries (`test/unit/`) in Node, their memory capped. The checks come from `ts-code-checks`, an optional dependency: without it they're skipped. The docs are held by `test/unit/docs-rules.test.js`: every path exists, each README's face is its library's exports and its `Depends on:` line its row in `test/module-rules.js`, American spelling.
