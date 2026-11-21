// A file is named for what it holds: the libraries' files' names checked by ts-code-checks' file-names.js; without it these skip
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { NOT_INSTALLED, whenMissing } from '../optional-checks.js';

const names = await import('ts-code-checks/tools/file-names.js').catch(whenMissing);
const check = (name, run) => test(name, { skip: names === null && NOT_INSTALLED }, run);
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

check('a file exporting only one class or type is named for it, singular or plural, or by its ending', () => {
  const found = names.misnamedFiles(names.sourcesAsRead(ROOT, ''));
  assert.deepEqual(names.misnamedProblems(found), []);
});

check('no file named shared, common, misc, utils or helpers', () => {
  assert.deepEqual(names.vagueProblems(names.sourcesAsRead(ROOT, '')), []);
});
