# generative

The rules the visual ideas found, free of any medium: for a patch, a pattern, a phrase or a look. Part of [the libraries](../README.md).

- [`randomness/`](randomness/README.md): where a draw comes from.
- [`genetics/`](genetics/README.md): values varied a little at a time, crossed.
- [`rewriting/`](rewriting/README.md): an L-system rewritten by a production.
- [`automata/`](automata/README.md): a one-row automaton by a rule number.
- [`articulation/`](articulation/README.md): what a gesture makes along a stroke.
- [`sync/`](sync/README.md): coupled oscillators falling into step.
- [`trails/`](trails/README.md): a slime mold's agents on a field.

Reads: nothing outside the group; `genetics/`, `rewriting/`, `automata/`, `articulation/`, `sync/` and `trails/` each read `randomness/` alone, not each other: the genes of `rewriting/` and `automata/` fit genetics' `Gene` by their shape. Not even `libs/base/`: the seeded random is handed in, so the group travels alone.
