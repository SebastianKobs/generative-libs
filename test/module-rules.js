// ---------- the import rules' data for the libraries: their layout and lists, read by the import test (test/unit/module-rules.test.js) ----------
// The engine that applies them is ts-code-checks' tools/module-rules.js; only the data is the libraries'.
// Paths are from this repo's root: a project that mounts the libraries in a folder prefixes them.

// The libraries in their import order, the one place it's kept.
// A folder is a library, its entry its index.ts; another library is reached only through its entry, and inside one there are no
// faces. A crossing the order or the table doesn't allow fails at once.
// Each library's row is what it uses: randomness alone, so each rule is taken without the others.
export const LIBRARY_LAYOUT = Object.freeze({
  order: ['randomness/', 'genetics/', 'rewriting/', 'automata/', 'articulation/', 'sync/', 'trails/'],
  libraries: [],
  packages: {
    'randomness/': [],
    'genetics/': ['randomness/'],
    'rewriting/': ['randomness/'],
    'automata/': ['randomness/'],
    'articulation/': ['randomness/'],
    'sync/': ['randomness/'],
    'trails/': ['randomness/'],
  },
});
// the short names a module may have: none, the rules' domain has no short words of its own
export const SHORT_NAMES = Object.freeze({ allowed: [] });
// module state: no module keeps state or acts as it loads outside a class, so every library can be made more than once.
// A list that only shrinks: none today
export const MODULE_STATE = Object.freeze({ starters: [], exceptions: {} });
// Web Audio's nodes: no library makes one, the rules are free of any medium
export const AUDIO_NODES = Object.freeze({ makers: [] });
// A test reaches a library through its entry or a helper in a test/ folder, its own library included.
// Listed by test, each with the files it still reaches past the face: a list that only shrinks.
// The tests are read as if the repo's root were a folder, generative/, as a project that mounts the libraries has them.
export const TEST_FACE = Object.freeze({
  libraries: 'generative/',
  exceptions: {},
});
// three.js: no library imports it, the rules are free of any medium
export const THREE_JS = Object.freeze({ allowed: [] });
