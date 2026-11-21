// ---------- the libraries, and their files read as the checks read them ----------
// ts-code-checks' sourcesIn() and testsIn() read one folder, and here the libraries sit beside the tests, the tools and node_modules:
// each library is read alone, its files named by their paths from the root.
import { join } from 'node:path';

// the libraries, each a folder at the root (README.md); the import rules' layout (test/module-rules.js) holds every one
export const LIBRARY_FOLDERS = Object.freeze([
  'articulation',
  'automata',
  'genetics',
  'randomness',
  'rewriting',
  'sync',
  'trails',
]);

// the files the reader finds in each library, by path from the root → text; the reader is sourcesIn() or testsIn()
export function inLibraries(read, root) {
  return new Map(
    LIBRARY_FOLDERS.flatMap((library) =>
      [...read(join(root, library))].map(([path, text]) => [`${library}/${path}`, text]),
    ),
  );
}
