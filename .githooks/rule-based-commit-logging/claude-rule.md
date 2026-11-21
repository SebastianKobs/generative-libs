# Rule-based commit logging

Every labeled commit gets an entry in a log, beginning with the commit's hash. This folder holds all of it, and `CLAUDE.md` imports this file.

What each file is for is in [`README.md`](README.md): this file is the rule, `labels.yml` the labels, `log-commit-hash.sh` the script that fills in the hashes.

## Labels

- **When committing, suggest the labels that fit,** and let the user confirm or change them. A commit can carry several, one after another at the start: `DESIGN: SOUND: HAPTIC: hold drone and rumble`.
- The labels, which log each goes in, and what each is for:

@labels.yml

- Commits with no label (fixes to the docs' wording, hash follow-ups) aren't logged.
- **A new label, or a new log, needs a line in `labels.yml`.**

## Hard rule: log every labeled commit with its hash

- Every commit whose message starts with a label gets an entry in that label's log that begins with the commit's short hash, e.g. `` `43c6d00` ``. A commit with labels for several logs goes in each of them, once per log: one entry, or a line for each decision it makes.
- A commit can't contain its own hash, so write the entry in the commit with `` `pending` `` in place of the hash, e.g. ``- `pending` DESIGN: **…**``. After the commit, `log-commit-hash.sh` fills in the hash and commits it as `Log <hash> in <log>`. That commit has no label, so it isn't logged itself.
  - It warns when a labeled commit has no `pending` entry in a log, or starts with a label that isn't in `labels.yml`. It skips a log that has uncommitted changes, and does nothing during a rebase, merge, cherry-pick or revert.
- When a commit also carries an existing log entry (like a design change logged while building), mark that entry `pending` rather than adding a second one.

## Entries

- **One line per decision:** the hash, the labels, the decision in bold, and why, with its source. Sub-bullets only where a reason or a value won't fit on the line, at most three. The details belong in the docs the entry points to, not in the log.
- **A commit that makes several decisions gets a line for each,** each starting `` `pending` ``; the hook fills them all.
- **Each entry ends with the files it changed,** named as its log's header says, so a topic's history is a search away.
- Entries already written stay as they are: a log is history.

## Setup

Once per clone: the steps are in [`README.md`](README.md)'s Setup.
