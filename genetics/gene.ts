// ---------- generative/genetics/gene: one value of a genome and how it moves: ranged, whole, a choice, a pair ----------

import type { Randomness } from '../randomness/index.ts';

// What a gene holds: a number, an option's name, or several options' names (a theme's two paints)
export type GeneValue = number | string | readonly string[];

// How one value moves: a little by a depth, and mixed with another parent's. Without cross(), a child
// takes one parent's
export interface Gene<Value extends GeneValue> {
  mutate(value: Value, depth: number, randomness: Randomness): Value;
  cross?(first: Value, second: Value, randomness: Randomness): Value;
}

// A number's range as a control has it, a position from 0 to 1 and back. The app fills it in with
// its params' taper; nothing here imports it
export interface GeneScale {
  positionOf(value: number): number;
  valueAt(position: number): number;
}

// The largest move at depth 1: a third of the travel, about the visual ideas' steps (a Default)
const REACH = 1 / 3;
const STAY_IN_POSITION = { lowest: 0, highest: 1 };

// A number moved in position space, so a step is as far at the low end of an octaves scale as at the high
export function rangedGene(scale: GeneScale): Gene<number> {
  return {
    mutate(value, depth, randomness) {
      const wander = (randomness.next() * 2 - 1) * REACH * depth;
      return scale.valueAt(clamp(scale.positionOf(value) + wander, STAY_IN_POSITION));
    },
    cross(first, second, randomness) {
      if (randomness.next() < 0.5) {
        return scale.valueAt((scale.positionOf(first) + scale.positionOf(second)) / 2);
      }
      return randomness.next() < 0.5 ? first : second;
    },
  };
}
// A whole number moved by 1 either way, held to its bounds
export function wholeGene(lowest: number, highest: number): Gene<number> {
  return {
    mutate(value, _depth, randomness) {
      return clamp(value + (randomness.next() < 0.5 ? -1 : 1), { lowest, highest });
    },
  };
}
// One option's name, switched to another now and then: with a chance of the depth
export function choiceGene(options: readonly string[]): Gene<string> {
  return {
    mutate(value, depth, randomness) {
      if (randomness.next() >= depth) {
        return value;
      }
      return drawFrom(sortedWithout(options, [value]), randomness) ?? value;
    },
  };
}
// `count` options' names, none twice: with a chance of the depth, one of them, drawn by its place,
// swapped for an option not among them, each as likely as its weight (1 where none is given)
export function choicesGene(
  options: readonly string[],
  count: number,
  weights: Readonly<Record<string, number>> = {},
): Gene<readonly string[]> {
  return {
    mutate(value, depth, randomness) {
      if (randomness.next() >= depth) {
        return value;
      }
      const place = Math.floor(randomness.next() * count);
      const swapped = drawWeighted(sortedWithout(options, value), weights, randomness);
      if (swapped === undefined) {
        return value;
      }
      return value.map((option, index) => (index === place ? swapped : option));
    },
  };
}

// The options but those given, by name, so the order they were written in changes nothing a seed grows
function sortedWithout(options: readonly string[], left: readonly string[]): string[] {
  return options.filter((option) => !left.includes(option)).sort();
}
function drawFrom(options: readonly string[], randomness: Randomness): string | undefined {
  return options[Math.floor(randomness.next() * options.length)];
}
// an option drawn as likely as its weight, 1 where none is given; one draw, as drawFrom()'s
function drawWeighted(
  options: readonly string[],
  weights: Readonly<Record<string, number>>,
  randomness: Randomness,
): string | undefined {
  const weightOf = (option: string): number => weights[option] ?? 1;
  let left = randomness.next() * options.reduce((total, option) => total + weightOf(option), 0);
  for (const option of options) {
    left -= weightOf(option);
    if (left < 0) {
      return option;
    }
  }
  return options.at(-1);
}
function clamp(value: number, bounds: { lowest: number; highest: number }): number {
  return Math.min(bounds.highest, Math.max(bounds.lowest, value));
}
