// ---------- libs/generative/trails/trail-tiles: fields on a grid of tiles, handing agents over at the seams ----------

import type { Randomness } from '../randomness/index.ts';
import { foodReach, QUANTUM_BEATS, type TrailRules, type Tint, TrailField, type Traveller } from './trail-field.ts';

// A tile's place on the grid, across and down, from 0
export interface Tile {
  readonly across: number;
  readonly down: number;
}
// A tile and the field running in it
export interface TileField {
  readonly tile: Tile;
  readonly field: TrailField;
}

// A world of tiles, each a field, so threads can grow across the seams between them.
// Places are in tile units: (1.25, 0.5) is a quarter into tile 1, halfway down tile 0.
// A field is made where a food reaches it or a seed falls in it, and nowhere else, so an empty
// stretch of world costs nothing. An agent stepping past a tile's plane passes into the tile
// beyond where it has a field, and turns away where it hasn't (the fields' 'pass' edges).
// Every field is stepped one quantum at a time, tile by tile, row by row, and then the
// agents that left are handed on in that order: the same events told at the same beats give
// the same traffic in every tile, in one go or in small steps.
// `wrapAcross` is the tiles a side of a world that wraps round: the tile after the last is the first.
export class TrailTiles {
  readonly #randomness: Randomness;
  readonly #wrapAcross: number | undefined;
  readonly #made: TileField[] = []; // in the order they were made
  readonly #inOrder: TileField[] = []; // by tile, row by row: the order they're stepped in
  #rules: TrailRules;
  #quanta = 0;

  constructor(rules: TrailRules, randomness: Randomness, wrapAcross?: number) {
    this.#rules = rules;
    this.#randomness = randomness;
    this.#wrapAcross = wrapAcross;
  }

  // the fields made so far, each with its tile, in the order they were made
  get fields(): readonly TileField[] {
    return this.#made;
  }
  get rules(): TrailRules {
    return this.#rules;
  }
  // reaches every field, counting from its next quantum on
  set rules(rules: TrailRules) {
    this.#rules = rules;
    for (const { field } of this.#made) {
      field.rules = rules;
    }
  }

  // A food at a place: laid in every tile it reaches, in each one's own plane
  food(x: number, y: number): void {
    for (const { tile, at } of this.#tilesReached(x, y)) {
      this.#fieldIn(tile).food(at.x, at.y);
    }
  }
  // The food at a place taken away, from every tile it was laid in
  foodGone(x: number, y: number): void {
    for (const { tile, at } of this.#tilesReached(x, y)) {
      this.#fieldIn(tile).foodGone(at.x, at.y);
    }
  }
  // A seed at a place: agents let loose in its own tile, `perSeed` if the number isn't said
  seed(x: number, y: number, tint?: Tint, agents?: number): void {
    const tile = { across: Math.floor(x), down: Math.floor(y) };
    this.#fieldIn(tile).seed(x - tile.across, y - tile.down, tint, agents);
  }

  // Runs every quantum that ends by `beat` in every tile; a beat already reached does nothing
  advanceTo(beat: number): void {
    const target = Math.floor(beat / QUANTUM_BEATS);
    while (this.#quanta < target) {
      this.#quanta++;
      for (const { field } of this.#inOrder) {
        field.advanceTo(this.#quanta * QUANTUM_BEATS);
      }
      this.#handOverLeavers();
    }
  }

  // Each agent that left a field goes into the field beyond, as it stands in that one's plane
  #handOverLeavers(): void {
    for (const { tile, field } of this.#inOrder) {
      for (const leaver of field.leavers) {
        const across = Math.floor(leaver.x);
        const down = Math.floor(leaver.y);
        this.#fieldIn({ across: tile.across + across, down: tile.down + down }).arrive(
          inPlaneOf(leaver, { across, down }),
        );
      }
      field.clearLeavers();
    }
  }

  // The tiles a food at a place reaches, each with the place in its plane; a tile past the world's edge is the one round
  #tilesReached(x: number, y: number): { tile: Tile; at: { x: number; y: number } }[] {
    const reach = foodReach(this.#rules);
    const reached = [];
    for (let down = Math.floor(y - reach); down < Math.ceil(y + reach); down++) {
      for (let across = Math.floor(x - reach); across < Math.ceil(x + reach); across++) {
        reached.push({ tile: { across, down }, at: { x: x - across, y: y - down } });
      }
    }
    return reached;
  }

  // The field in a tile, made on the beat the tiles have reached if there is none
  #fieldIn(tile: Tile): TrailField {
    const placed = this.#wrapped(tile);
    const found = this.#made.find((made) => sameTile(made.tile, placed));
    if (found) {
      return found.field;
    }
    const field = new TrailField(
      this.#rules,
      this.#randomness.fork(`tile ${placed.across},${placed.down}`),
      (across, down) => this.#has({ across: placed.across + across, down: placed.down + down }),
    );
    field.advanceTo(this.#quanta * QUANTUM_BEATS);
    const made = { tile: placed, field };
    this.#made.push(made);
    this.#inOrder.push(made);
    this.#inOrder.sort((first, second) => first.tile.down - second.tile.down || first.tile.across - second.tile.across);
    return field;
  }
  #has(tile: Tile): boolean {
    const placed = this.#wrapped(tile);
    return this.#made.some((made) => sameTile(made.tile, placed));
  }
  #wrapped({ across, down }: Tile): Tile {
    const side = this.#wrapAcross;
    if (side === undefined) {
      return { across, down };
    }
    return { across: ((across % side) + side) % side, down: ((down % side) + side) % side };
  }
}

function sameTile(first: Tile, second: Tile): boolean {
  return first.across === second.across && first.down === second.down;
}

// An agent that left a plane, as it stands in the plane of the tile `by` tiles across and down from it
function inPlaneOf(leaver: Traveller, by: Tile): Traveller {
  return {
    ...leaver,
    x: leaver.x - by.across,
    y: leaver.y - by.down,
    homeX: leaver.homeX - by.across,
    homeY: leaver.homeY - by.down,
  };
}
