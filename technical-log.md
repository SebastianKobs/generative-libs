# Technical log

A record of the libraries' changes: a change, its tests, its tooling and setup, and fixes to existing behavior. Newest first.

Sources: **Request** = the user asked for it. **Default** = a starting value chosen while building.
Files: by path from the repo root.
Commits: the labels and their logs are in `.githooks/rule-based-commit-logging/labels.yml`, the entry form and the hash rule in `.githooks/rule-based-commit-logging/claude-rule.md`.

---

## 2026-11-21

- `7df8db9` TECHNICAL: **generative-libs made from audio-libs' `generative/`, its history carried over by `git filter-repo` and moved to the root, with audio-libs' tooling pared to these seven libraries, its own `make test-unit` passing alone;** the rules are free of any medium and nothing in audio-libs read them, so a project takes them without an audio stack. *(Source: Request)* Files: `package.json`, `Makefile`, `tsconfig.json`, `.oxlintrc.json`, `.prettierrc.json`, `.prettierignore`, `knip.json`, `.gitignore`, `.claude/settings.json`, `.githooks/`, `CLAUDE.md`, `README.md`, `technical-log.md`, `LICENSE`, `tools/`, `test/`, `randomness/test/near.js`, `*/README.md`, `*/*.ts`, `*/test/*.test.js`
