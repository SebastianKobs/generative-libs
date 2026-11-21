// ---------- trails: a slime mould's agents on a field, food drawing them, seeds letting more loose ----------
// Its parts: a field run forward in half-beat quanta, no copy of its past kept (trail-field.ts); fields on a grid of
// tiles handing agents over at the seams (trail-tiles.ts); where agents ran, on a grid finer than the field
// (traffic.ts). Uses only generative/randomness/.
// No drawing: ink, an image or a heat map made of the traffic is the caller's
export { TrailField, type TrailRules, type Tint, type Tints } from './trail-field.ts';
export { TrailTiles, type Tile, type TileField } from './trail-tiles.ts';
export { TRAFFIC_GRID, Traffic } from './traffic.ts';
