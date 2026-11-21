// The docs' rules, kept over every markdown file here: the ones of CLAUDE.md that fit a library project.
//   - Every backticked path that looks like one exists, a bare name where a tracked file has it.
//   - Every library's README names every export of its entries.
//     Its face tables (headed "Export" or empty) name nothing else.
//     It has a `Depends on:` line with the libraries its row in test/module-rules.js names.
//   - No British spelling outside backticks and quotes.
// The rules are ts-code-checks' (its tools/docs-rules.js), read on this tree; without it the tests skip.
// Not read: the log, history.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LIBRARY_LAYOUT } from '../module-rules.js';
import { NOT_INSTALLED, whenMissing } from '../optional-checks.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// the libraries are at this repo's root, and their keys are written from it
const LIBRARIES = { folder: '', from: '' };
const HISTORY = new Set(['technical-log.md']);

const rules = await import('ts-code-checks/tools/docs-rules.js').catch(whenMissing);
const check = (name, run) => test(name, { skip: rules === null && NOT_INSTALLED }, run);
const { docs, files } = rules?.readTree(ROOT) ?? { docs: new Map(), files: new Set() };
const currentState = new Map([...docs].filter(([path]) => !HISTORY.has(path)));

check('every backticked path in a doc exists, from the repo root or the doc’s folder', () => {
  const problems = rules.pathProblems(currentState, files, { roots: ['.'], ignoredOf: rules.ignoredByGit(ROOT) });
  assert.deepEqual(describe(problems), []);
});

check('every library’s README names every export of its entries, and names as face only those', () => {
  assert.deepEqual(describe(rules.faceProblems(docs, exportsOf(), LIBRARIES)), []);
});

check('every library’s README has a Depends on: line with the libraries its row in module-rules.js names', () => {
  assert.deepEqual(describe(rules.dependsOnProblems(docs, LIBRARY_LAYOUT.packages, exportsOf(), LIBRARIES)), []);
});

check('no doc uses a British spelling outside backticks and quotes', () => {
  assert.deepEqual(describe(rules.britishProblems(currentState)), []);
});

function exportsOf() {
  return rules.exportsByLibrary(files, (path) => readFileSync(`${ROOT}${path}`, 'utf8'), LIBRARIES);
}

function describe(problems) {
  return [...problems].map(([key, details]) => `${key} breaks a rule of the docs: ${details.join('; ')}`);
}
