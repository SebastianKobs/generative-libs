# Explicit targets only: plain `make` just lists them.
.DEFAULT_GOAL := help

# gitleaks, its official image, pinned by its digest (make secrets)
GITLEAKS := ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f
# the checks that know nothing of this project, ts-code-checks (package.json, an optional dependency): each target says it's skipped without it;
# found as Node finds a package, in node_modules here or, mounted in a project as one of its workspaces, in the project's
CHECKS    := $(addsuffix /tools,$(shell node -p "require('path').dirname(require.resolve('ts-code-checks/package.json'))" 2>/dev/null))
INSTALLED := $(wildcard $(CHECKS))
SKIPPED    = @echo "make $@: ts-code-checks isn't installed: skipped"
# the unit tests' memory cap; empty without ts-code-checks, which holds memory-capped.js: they run uncapped
CAPPED    := $(if $(INSTALLED),node $(CHECKS)/memory-capped.js 4G,)

help:
	@echo "make typecheck    the type check (tsc), strict; make test-unit runs it"
	@echo "make format       format the code with Prettier; make format-check checks it, and make test-unit runs that"
	@echo "make lint         the linter (Oxlint, .oxlintrc.json); make test-unit runs it"
	@echo "make knip         unused files, dependencies and exports (Knip, knip.json); make test-unit runs it"
	@echo "make knip-production  exports only the tests or the tools use: Knip's production mode (knip.json's ! entries); make test-unit runs it"
	@echo "make clones       the same code written twice, a new clone over 60 tokens failing (tools/find-clones.js, ts-code-checks' clone finder); make test-unit runs it"
	@echo "make class-members  a public class member only its own class uses, a library's faces aside (ts-code-checks' class-members.js); make test-unit runs it"
	@echo "make audit        the dependencies: npm audit's advisories, the registry's signatures"
	@echo "make secrets      what isn't committed yet, searched for secrets (gitleaks, in Docker, which has to run)"
	@echo "make test-commit  before a commit: the unit tests, the dependencies (make audit) and secrets (make secrets)"
	@echo "make test-unit    the unit tests, in node, after the type check (tsc), the format check, the linter and Knip (and in production mode),"
	@echo "                  the class members check and the clone finder; their memory capped at 4 GB (ts-code-checks' memory-capped.js),"
	@echo "                  eight files at a time, so a runaway test is killed, not the machine"

# the type check: strict, over every .ts file (tsconfig.json)
typecheck:
	npx tsc -p .
format:   # every file Prettier reads (.prettierrc.json, .prettierignore)
	npx prettier --write .
format-check:
	npx prettier --check .
lint:     # bugs, not taste: every rule in .oxlintrc.json
	npx oxlint
knip:     # what nothing uses: files, dependencies, exports (knip.json)
	npx knip --no-progress
knip-production:   # exports only the tests or the tools use: Knip's production mode, its entries those marked ! (knip.json)
	npx knip --production --no-progress
clones:   # the same code written twice: a new clone fails, the known ones listed (tools/known-clones.js)
	$(if $(INSTALLED),node --disable-warning=ExperimentalWarning tools/find-clones.js,$(SKIPPED))
# the faces: each library's entry
class-members:   # a public class member only its own class uses, a library's faces aside
	$(if $(INSTALLED),node $(CHECKS)/class-members.js tsconfig.json --faces '^(.+/)?index\.ts$$' --checked '^(articulation|automata|genetics|noise|randomness|rewriting|sync|trails)/',$(SKIPPED))
audit:    # known advisories, and the signatures; offline, it says so and passes
	$(if $(INSTALLED),node $(CHECKS)/audit.js,$(SKIPPED))
# what isn't committed yet, as one patch: the changes to what git tracks, staged or not, and the files it doesn't track yet (but those
# it ignores); searched by gitleaks, a leak named, redacted, and failing it
secrets:
	@docker info >/dev/null 2>&1 || { echo "make secrets: Docker isn't running, and gitleaks runs in it"; exit 1; }
	{ git diff HEAD; git ls-files -z --others --exclude-standard | xargs -0 -r -n1 git diff --no-index /dev/null; } \
	  | docker run --rm -i $(GITLEAKS) stdin --no-banner --redact --verbose

# the unit tests, after the type check, the format check, the linter, Knip, in production mode too, the class members check and the clone finder; their memory capped at 4 GB
# (ts-code-checks' memory-capped.js), eight files at a time, so the tests' contexts fit in it together
test-unit: typecheck format-check lint knip knip-production class-members clones
	$(if $(INSTALLED),,@echo "make test-unit: ts-code-checks isn't installed: the unit tests run uncapped")
	$(CAPPED) node --test --test-concurrency=8 "test/unit/*.test.js" "*/test/*.test.js"
# before a commit: the unit tests, the dependencies and secrets; there are no end-to-end tests here
test-commit:
	$(MAKE) -s test-unit audit secrets

.PHONY: help typecheck format format-check lint knip knip-production clones class-members audit secrets test-unit test-commit
