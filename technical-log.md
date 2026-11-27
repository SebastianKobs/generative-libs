# Technical log

A record of the libraries' changes: a change, its tests, its tooling and setup, and fixes to existing behavior. Newest first.

Sources: **Request** = the user asked for it. **Default** = a starting value chosen while building.
Files: by path from the repo root.
Commits: the labels and their logs are in `.githooks/rule-based-commit-logging/labels.yml`, the entry form and the hash rule in `.githooks/rule-based-commit-logging/claude-rule.md`.

---

## 2026-11-27

- `pending` TECHNICAL: **the seeded generator a real export of `randomness/`, `seededRandomness(seed)` in TypeScript, its algorithm as the tests' helper had it (mulberry32, a fork by FNV-1a of `${seed}:${name}`); the helper a re-export of it, so the tests importing it stay as they are;** an app hands the same seeded draws in at run time as the tests do, the other libraries still import no generator. Its draws checked against those recorded from the helper before the move. *(Source: Request)* Files: `randomness/seeded.ts`, `randomness/index.ts`, `randomness/test/seeded-randomness.js`, `randomness/test/randomness.test.js`, `randomness/README.md`, `README.md`, `technical-log.md`

## 2026-11-21

- `51dea71` TECHNICAL: **GEN1: the list of code folders named `CODE_FOLDERS`, its reader `inCodeFolders()`, every reader renamed with them;** one name in both mounts, so Stim Garden reads each by one loop. *(Source: Request: "CODE_FOLDERS")* Files: `test/libraries.js`, `test/unit/module-rules.test.js`, `tools/find-clones.js`, `technical-log.md`
- `140457b` TECHNICAL: **mounted in a project, nothing is installed here: Node and npx find the tools in the project's `node_modules/`, the Makefile finds `ts-code-checks` as Node finds a package;** as audio-libs does (`695034c` there), so both mounts read one install. *(Source: Request)* Files: `Makefile`, `CLAUDE.md`, `README.md`
- `7df8db9` TECHNICAL: **generative-libs made from audio-libs' `generative/`, its history carried over by `git filter-repo` and moved to the root, with audio-libs' tooling pared to these seven libraries, its own `make test-unit` passing alone;** the rules are free of any medium and nothing in audio-libs read them, so a project takes them without an audio stack. *(Source: Request)* Files: `package.json`, `Makefile`, `tsconfig.json`, `.oxlintrc.json`, `.prettierrc.json`, `.prettierignore`, `knip.json`, `.gitignore`, `.claude/settings.json`, `.githooks/`, `CLAUDE.md`, `README.md`, `technical-log.md`, `LICENSE`, `tools/`, `test/`, `randomness/test/near.js`, `*/README.md`, `*/*.ts`, `*/test/*.test.js`
