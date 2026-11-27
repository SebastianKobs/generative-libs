// ---------- paths: the cheapest path through layers of choices ----------
// Its part: one option chosen a layer, each option and each move costed, the cheapest path kept by Viterbi, with anchors
// and forbidden costs (cheapest-path.ts). Uses nothing
export { cheapestPath, type CheapestPath, type PathProblem } from './cheapest-path.ts';
