// ---------- the clone finder over the libraries ----------
// ts-code-checks' clones.js reads one folder; the libraries are read one by one (test/libraries.js), so a clone between two of them is found.
// The clones there are, each by its two files, are in tools/known-clones.js, a list that only shrinks.
//   node tools/find-clones.js
import { fileURLToPath } from 'node:url';
import { cloneProblems, clonesIn } from 'ts-code-checks/tools/clones.js';
import { sourcesIn } from 'ts-code-checks/tools/module-rules.js';
import { KNOWN_CLONES } from './known-clones.js';
import { inLibraries } from '../test/libraries.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

const problems = cloneProblems(clonesIn(inLibraries(sourcesIn, ROOT)), KNOWN_CLONES);
for (const problem of problems) {
  console.log(problem);
}
if (problems.length) {
  process.exit(1);
}
console.log(`clones: none new over 60 tokens, ${KNOWN_CLONES.length} known`);
