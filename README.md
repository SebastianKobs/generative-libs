# generative

The rules the visual ideas found, free of any medium: for a patch, a pattern, a phrase or a look. Part of [the libraries](../README.md).

- [`randomness/`](randomness/README.md): where a draw comes from, an interface handed in.
- [`genetics/`](genetics/README.md): values varied a little at a time, crossed, every step kept in a lineage.
- [`rewriting/`](rewriting/README.md): an L-system's letters rewritten by a production, a production as a gene.
- [`automata/`](automata/README.md): a one-row automaton's next row by a rule number, a rule as a gene.
- [`articulation/`](articulation/README.md): what a hand's gesture makes along a stroke: marks with their place, time, kind and intensity, no paint, no notes.
- [`sync/`](sync/README.md): coupled oscillators falling slowly into step, a note pulling them to flash, run forward.
- [`trails/`](trails/README.md): a slime mould's agents on a field, food drawing them, seeds letting more loose, run forward.

Reads: nothing outside the group; `genetics/`, `rewriting/`, `automata/`, `articulation/`, `sync/` and `trails/` each read `randomness/` alone, not each other: the genes of `rewriting/` and `automata/` fit genetics' `Gene` by their shape. Not even `base/`: the seeded random is handed in, so the group travels alone.
