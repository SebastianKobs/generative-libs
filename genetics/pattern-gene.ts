// ---------- genetics/pattern-gene: a step pattern as a gene, its levels moved a step or a hit at a time ----------

import type { Randomness } from '../randomness/index.ts';
import type { Gene } from './gene.ts';

// The kinds of change a mutation draws from, each as likely: a step's level, a hit moved, a hit added or taken
const CHANGES = 3;
const TOGGLE = 0;
const MOVE = 1;

// A step pattern: each step's level, 0 a rest and 1 to `maxLevel` (at least 1) a hit, more marked as it rises.
// A mutation, with a chance of the depth, makes one change, drawn evenly from three:
//   a toggle: one step a level up or down, turned back at 0 and at `maxLevel`;
//   a move: one hit to the step beside it, the side drawn or else the other, only onto a rest;
//   a density change: a hit added on a rest at a level drawn from 1 to `maxLevel`, or one taken away.
// The length never changes, and each level stays from 0 to `maxLevel`, a whole number.
// A cross takes a segment of steps from one parent and the rest from the other, the parents of one length.
export function patternGene(maxLevel: number): Gene<readonly number[]> {
  return {
    mutate(pattern, depth, randomness) {
      if (randomness.next() >= depth) {
        return pattern;
      }
      const change = Math.floor(randomness.next() * CHANGES);
      if (change === TOGGLE) {
        return toggled(pattern, maxLevel, randomness);
      }
      if (change === MOVE) {
        return moved(pattern, randomness);
      }
      return densityChanged(pattern, maxLevel, randomness);
    },
    cross(first, second, randomness) {
      return crossedBySegment(first, second, randomness);
    },
  };
}

// one step a level up or down, the side drawn
function toggled(pattern: readonly number[], maxLevel: number, randomness: Randomness): readonly number[] {
  const step = drawPlace(pattern.length, randomness);
  const goesDown = randomness.next() < 0.5;
  return withLevel(pattern, step, levelToggled(pattern[step] ?? 0, maxLevel, goesDown));
}
// a level one up or down, turned back at 0 and at the top
function levelToggled(level: number, maxLevel: number, goesDown: boolean): number {
  if (level >= maxLevel) {
    return level - 1;
  }
  if (level <= 0 || !goesDown) {
    return level + 1;
  }
  return level - 1;
}

// one hit swapped with the rest beside it, on the side drawn or else the other; none where both are hits
function moved(pattern: readonly number[], randomness: Randomness): readonly number[] {
  const hits = placesWhere(pattern, (level) => level > 0);
  if (hits.length === 0) {
    return pattern;
  }
  const hit = hits[drawPlace(hits.length, randomness)] ?? 0;
  const side = randomness.next() < 0.5 ? -1 : 1;
  const rest = [hit + side, hit - side].find((step) => pattern[step] === 0);
  if (rest === undefined) {
    return pattern;
  }
  return withLevel(withLevel(pattern, rest, pattern[hit] ?? 0), hit, 0);
}

// a hit added on a rest, at a level drawn from 1 to the top, or one taken away; the other where one can't be
function densityChanged(pattern: readonly number[], maxLevel: number, randomness: Randomness): readonly number[] {
  const rests = placesWhere(pattern, (level) => level === 0);
  const hits = placesWhere(pattern, (level) => level > 0);
  // drawn even where only one side can be, so the draws after it fall alike
  const wantsAHit = randomness.next() >= 0.5;
  if (rests.length > 0 && (wantsAHit || hits.length === 0)) {
    const rest = rests[drawPlace(rests.length, randomness)] ?? 0;
    return withLevel(pattern, rest, 1 + drawPlace(maxLevel, randomness));
  }
  const hit = hits[drawPlace(hits.length, randomness)];
  if (hit === undefined) {
    return pattern;
  }
  return withLevel(pattern, hit, 0);
}

// The steps from `low` up to `high`, two cuts drawn, from one parent drawn, the rest from the other
function crossedBySegment(
  first: readonly number[],
  second: readonly number[],
  randomness: Randomness,
): readonly number[] {
  const cuts = [drawPlace(first.length + 1, randomness), drawPlace(first.length + 1, randomness)];
  const low = Math.min(...cuts);
  const high = Math.max(...cuts);
  const firstOutside = randomness.next() < 0.5;
  return first.map((level, step) => {
    const inside = step >= low && step < high;
    if (inside === firstOutside) {
      return second[step] ?? level;
    }
    return level;
  });
}

// a place from 0 up to `count`, drawn evenly
function drawPlace(count: number, randomness: Randomness): number {
  return Math.floor(randomness.next() * count);
}
function placesWhere(pattern: readonly number[], isWanted: (level: number) => boolean): number[] {
  return pattern.flatMap((level, step) => (isWanted(level) ? [step] : []));
}
// a copy of the pattern, one step at a new level
function withLevel(pattern: readonly number[], step: number, level: number): readonly number[] {
  return pattern.map((old, place) => (place === step ? level : old));
}
