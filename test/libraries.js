// ---------- the libraries, and their files read as the checks read them ----------
// ts-code-checks' sourcesIn() and testsIn() read one folder, and here the libraries sit beside the tests, the tools and node_modules:
// each library is read alone, its files named by their paths from the root.
import { join } from 'node:path';

// the folders holding code, each a library at the root (README.md); the import rules' layout (test/module-rules.js) holds every one
export const CODE_FOLDERS = Object.freeze([
  'articulation',
  'automata',
  'genetics',
  'noise',
  'randomness',
  'rewriting',
  'sync',
  'trails',
]);

// the files the reader finds in each folder, by path from the root → text; the reader is sourcesIn() or testsIn()
export function inCodeFolders(read, root) {
  return new Map(
    CODE_FOLDERS.flatMap((folder) => [...read(join(root, folder))].map(([path, text]) => [`${folder}/${path}`, text])),
  );
}
