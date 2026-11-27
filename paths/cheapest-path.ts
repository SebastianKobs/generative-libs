// ---------- paths/cheapest-path: the cheapest path through layers of choices (Viterbi) ----------

// What a path is chosen from: one option a layer, each option and each move between two layers costed.
//   layers: each layer's options, of any type, in the order ties are broken by
//   optionCost(layer, option): what choosing an option costs; Infinity forbids it
//   moveCost(layer, previous, option): what moving from the layer before's option into this one costs,
//     `layer` the one moved into, from 1; Infinity forbids the move
//   anchors: by layer, the options it is held to, one to fix it or several to limit it; matched as
//     includes() matches, the same value or the same object, and kept in the layer's own order
export interface PathProblem<Option> {
  readonly layers: readonly (readonly Option[])[];
  optionCost(layer: number, option: Option): number;
  moveCost(layer: number, previous: Option, option: Option): number;
  readonly anchors?: Readonly<Record<number, readonly Option[]>>;
}

// The answer: the option chosen in each layer and what the path costs, or no path at all and the
// first layer that no allowed path reaches
export type CheapestPath<Option> =
  | { readonly found: true; readonly options: readonly Option[]; readonly cost: number }
  | { readonly found: false; readonly blockedAt: number };

// The cheapest way found to one option: what it costs, and the way to the option before it on that path
interface Reach<Option> {
  readonly option: Option;
  readonly cost: number;
  readonly before: Reach<Option> | undefined;
}

// The cheapest path through the layers, by Viterbi: layer by layer, the cheapest way to reach every
// option is kept, built from the cheapest ways to the layer before; then the cheapest last option is
// walked back through where each came from. Each layer costs (its options × the layer before's) moves.
// Ties go to the earlier option: of paths that cost the same, the one whose last option comes first in
// its layer, then, going back, whose option before it comes first.
export function cheapestPath<Option>(problem: PathProblem<Option>): CheapestPath<Option> {
  let reaches: Reach<Option>[] | undefined;
  for (const [layer, options] of problem.layers.entries()) {
    const previous = reaches;
    reaches = allowedIn(options, problem.anchors?.[layer]).map((option) => reachOf(problem, layer, option, previous));
    if (!reaches.some(({ cost }) => cost < Infinity)) {
      return { found: false, blockedAt: layer };
    }
  }
  return walkedBack(cheapestOf(reaches ?? []));
}

// a layer's options held to its anchor, in the layer's own order; all of them where it has none
function allowedIn<Option>(options: readonly Option[], anchor: readonly Option[] | undefined): readonly Option[] {
  if (anchor === undefined) {
    return options;
  }
  return options.filter((option) => anchor.includes(option));
}

// The cheapest way to one option: its own cost, plus the cheapest way through the layer before and the
// move from there. In the first layer there is no layer before: its own cost alone
function reachOf<Option>(
  problem: PathProblem<Option>,
  layer: number,
  option: Option,
  previous: readonly Reach<Option>[] | undefined,
): Reach<Option> {
  const own = problem.optionCost(layer, option);
  if (previous === undefined) {
    return { option, cost: own, before: undefined };
  }
  const moves = previous.map((way) => ({ way, cost: way.cost + problem.moveCost(layer, way.option, option) }));
  const best = cheapestOf(moves);
  return { option, cost: (best?.cost ?? Infinity) + own, before: best?.way };
}

// the cheapest, the first of equal ones by a strict less-than; none of none
function cheapestOf<Way extends { readonly cost: number }>(ways: readonly Way[]): Way | undefined {
  let best: Way | undefined;
  for (const way of ways) {
    if (best === undefined || way.cost < best.cost) {
      best = way;
    }
  }
  return best;
}

// The path to a last option followed back to the first layer; no last option, no layers: an empty path
function walkedBack<Option>(last: Reach<Option> | undefined): CheapestPath<Option> {
  const options: Option[] = [];
  for (let way = last; way !== undefined; way = way.before) {
    options.unshift(way.option);
  }
  return { found: true, options, cost: last?.cost ?? 0 };
}
