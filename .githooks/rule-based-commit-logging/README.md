# Rule-based commit logging

Commits whose message starts with a label, such as `DESIGN:` or `TECHNICAL:`, get an entry in a log file. The entry starts with the commit's short hash. The label decides which log it goes in. The rule is written for [Claude Code](https://claude.com/claude-code), Anthropic's coding assistant, which writes the entries. A git hook fills in the hashes.

## Files

| File | What it's for |
|---|---|
| `labels.yml` | Each label and its log, with a comment saying what the label is for |
| `claude-rule.md` | The rule Claude follows: suggest labels, write log entries, mark them `pending` |
| `log-commit-hash.sh` | Fills a commit's hash into its log entries. `../post-commit` runs it |

## How it works

1. Claude makes a change and suggests labels for it. You confirm or change them.
2. Claude adds an entry to each log those labels go in, with `` `pending` `` in place of the hash, since a commit can't contain its own hash. Then it commits, for example `TECHNICAL: add a lint step`:
   ```
   - `pending` TECHNICAL: **What changed and why.**
   ```
3. The `post-commit` hook reads the labels and looks up their logs in `labels.yml`. Each log's `pending` becomes the short hash, and the hook commits that as `Log <hash> in <log>`. That commit has no label, so it isn't logged itself.

The hook only warns, and never blocks a commit. It warns when:
- a labeled commit has no `pending` entry;
- a label isn't in `labels.yml`, such as a typo;
- a log has uncommitted changes, which it then leaves alone.

It does nothing during a rebase, merge, cherry-pick or revert.

## Setup

1. **Enable the hook,** once per clone. Git doesn't do this when cloning:
   ```
   git config core.hooksPath .githooks
   ```
2. **Let Claude read the rule:** Claude Code reads `CLAUDE.md` in the repo root at the start of every session, and `@path` lines in it pull in other files. This line is already there:
   ```
   @.githooks/rule-based-commit-logging/claude-rule.md
   ```
   `claude-rule.md` in turn pulls in `labels.yml`, so Claude knows the labels.

People can follow the same rule by hand: write the entry with `pending`, commit with a label, and the hook does the rest.

## Changing labels or logs

Edit `labels.yml`. Each line is `LABEL: path/to/log`, with the path from the repo root:

```yaml
TECHNICAL: technical-log.md     # tooling, setup and repo housekeeping
```

- A commit with several labels goes in each of their logs, once per log.
- **Keep the lines flat:** no nesting, and no spaces in paths. The hook reads the file with `sed`, not a YAML parser.
- A log must exist before its first entry. Entries are Markdown list items that start with `` - `pending` ``.

## In another repo

1. Copy `.githooks/` with its `post-commit`. Both scripts must be executable, so copy with `cp -p`, or run `chmod +x`.
2. Set your labels and logs in `labels.yml`.
3. Add the `@…/claude-rule.md` line to that repo's `CLAUDE.md`.
4. Run the `git config` line above.
