// ---------- trails: a slime mould's agents on a field, food drawing them, seeds letting more loose ----------
// Its parts: a field run forward in half-beat quanta, no copy of its past kept (trail-field.ts); where agents ran,
// on a grid finer than the field (traffic.ts). Uses only libs/generative/randomness/.
// No drawing: ink, an image or a heat map made of the traffic is the caller's
export { TrailField, type TrailRules, type Tint, type Tints } from './trail-field.ts';
export { TRAFFIC_GRID } from './traffic.ts';
