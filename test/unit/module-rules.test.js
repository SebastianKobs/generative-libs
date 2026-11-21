// The import rules (test/module-rules.js) held over the libraries; the rules' own cases are ts-code-checks' (its
// tools/module-rules.js), and without it these skip
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AUDIO_NODES, LIBRARY_LAYOUT, MODULE_STATE, SHORT_NAMES, TEST_FACE, THREE_JS } from '../module-rules.js';
import { NOT_INSTALLED, whenMissing } from '../optional-checks.js';
import { CODE_FOLDERS, inCodeFolders } from '../libraries.js';

const rules = await import('ts-code-checks/tools/module-rules.js').catch(whenMissing);
const check = (name, run) => test(name, { skip: rules === null && NOT_INSTALLED }, run);
const {
  audioNodeProblems,
  importProblems,
  nameProblems,
  orderProblems,
  packageTestProblems,
  sourcesIn,
  stateProblems,
  testFaceProblems,
  testsIn,
  threeProblems,
  unusedDependencyProblems,
} = rules ?? {};

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LIBRARIES = rules === null ? null : inCodeFolders(sourcesIn, ROOT);
const LIBRARY_TESTS = rules === null ? null : inCodeFolders(testsIn, ROOT);

// the test files at the root (test/): those across libraries, the scenarios they run, their helpers; not test/tools/, the tools' own
function rootTests() {
  const files = readdirSync(`${ROOT}test`, { recursive: true, encoding: 'utf8' }).filter(
    (path) => /\.(m?js|ts)$/.test(path) && !path.startsWith('tools/'),
  );
  return new Map(files.map((path) => [`test/${path}`, readFileSync(`${ROOT}test/${path}`, 'utf8')]));
}
// every test read as if the repo were a folder, as a project that mounts the libraries has it
function testsInAFolder() {
  const tests = new Map([...LIBRARY_TESTS, ...rootTests()]);
  return new Map([...tests].map(([path, source]) => [`${TEST_FACE.libraries}${path}`, source]));
}

check(
  'the libraries are those in test/libraries.js, and each library the layout names is a folder with its entry',
  () => {
    const named = new Set(LIBRARY_LAYOUT.order.map((path) => path.split('/')[0]));
    assert.deepEqual([...named].sort(), [...CODE_FOLDERS].sort());
    const entries = LIBRARY_LAYOUT.order.filter((path) => path.endsWith('/') && !LIBRARIES.has(`${path}index.ts`));
    assert.deepEqual(entries, [], 'each library has its index.ts');
  },
);

check('no library imports three.js', () => {
  assert.deepEqual(threeProblems(LIBRARIES, THREE_JS), []);
});

check('the libraries keep the import rules', () => {
  assert.deepEqual(importProblems(LIBRARIES, LIBRARY_LAYOUT), []);
});

check('the libraries name what they use, and only that', () => {
  assert.deepEqual(unusedDependencyProblems(LIBRARIES, LIBRARY_TESTS, LIBRARY_LAYOUT), []);
});

check("a library's tests reach only their own library and those it uses", () => {
  assert.deepEqual(packageTestProblems(LIBRARY_TESTS, LIBRARIES, LIBRARY_LAYOUT), []);
});

check('the tests reach a library through its entries or a test/ helper, or where the list says', () => {
  assert.deepEqual(testFaceProblems(testsInAFolder(), TEST_FACE), []);
});

check('no library has a module-level name under 3 characters', () => {
  assert.deepEqual(nameProblems(LIBRARIES, SHORT_NAMES), []);
});

check('no library keeps state or does anything as it loads, outside a class, but those listed', () => {
  assert.deepEqual(stateProblems(LIBRARIES, MODULE_STATE), []);
});

check('the libraries keep their order, each helper below its first caller, every function a declaration', () => {
  assert.deepEqual(orderProblems(LIBRARIES, { starters: MODULE_STATE.starters }), []);
});

check('no library makes a Web Audio node: the rules are free of any medium', () => {
  assert.deepEqual(audioNodeProblems(LIBRARIES, AUDIO_NODES), []);
});
