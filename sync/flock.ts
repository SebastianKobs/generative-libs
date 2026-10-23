// ---------- libs/generative/sync/flock: coupled oscillators falling slowly into step ----------

import type { Randomness } from '../randomness/index.ts';

// How the oscillators pull each other: every one towards the crowd, or each towards its two neighbours
export type Topology = 'all' | 'ring';

// What a flock does, changeable as it runs
//   period: beats a cycle
//   spread: how unlike the natural periods are (0 all alike)
//   coupling: how hard the oscillators pull each other
//   entrain: how hard a note pulls them to flash
export interface FlockRules {
  readonly period: number;
  readonly spread: number;
  readonly coupling: number;
  readonly entrain: number;
}

// What a flock is made of: how many oscillators, how they pull, its rules to begin with
export interface FlockShape {
  readonly count: number;
  readonly topology: Topology;
  readonly rules: FlockRules;
}

const TAU = Math.PI * 2;
const STEP_BEATS = 1 / 16;
const COUPLING_SHARE = 0.8; // the sketch's tuning: coupling 1 pulls at 0.8 of a cycle's pace
const RING_QUARTERS = 4; // a ring's notes walk round it, four to a round
const NOTE_REACH = 0.6; // how wide a note's pull spreads round the ring (squared radians)
const NORMALISH_DRAWS = 3; // three draws summed: close to a bell curve

// Phases a note pulls to flash, a Kuramoto model (each phase φᵢ pulled a little towards the
// others', so they fall slowly into step):
//   all: dφᵢ = ωᵢ + K R sin(ψ − φᵢ), pulled to the crowd's mean phase ψ, harder the more they
//        already agree (R, 0 to 1, the order: how far they agree; K the coupling)
//   ring: each pulled to its two neighbours, a phase apart, so a wave walks round the ring
// A run goes forward only, in 16ths of a beat, and keeps no copy of its past: the same events told at
// the same beats give the same phases, however its caller's frames fall.
// The caller tells each note, `advanceTo(its beat)` then `pull()`, before advancing past it.
export class Flock {
  readonly #topology: Topology;
  readonly #paces: readonly number[];
  #phases: number[];
  #rules: FlockRules;
  #steps = 0;
  #pulls = 0;

  // Each oscillator's pace and first phase are drawn from `randomness`, a pace fixed from then on
  constructor({ count, topology, rules }: FlockShape, randomness: Randomness) {
    this.#topology = topology;
    this.#rules = rules;
    const paces: number[] = [];
    const phases: number[] = [];
    for (let oscillator = 0; oscillator < count; oscillator++) {
      const normalish = randomness.next() + randomness.next() + randomness.next() - NORMALISH_DRAWS / 2;
      paces.push((TAU / rules.period) * (1 + rules.spread * normalish));
      phases.push(randomness.next() * TAU);
    }
    this.#paces = paces;
    this.#phases = phases;
  }

  // each oscillator's phase in radians, 0 the flash: read, don't change
  get phases(): readonly number[] {
    return this.#phases;
  }
  get rules(): FlockRules {
    return this.#rules;
  }
  // counts from the next step on
  set rules(rules: FlockRules) {
    this.#rules = rules;
  }

  // Steps in 16ths of a beat up to `beat`; a beat already reached does nothing
  advanceTo(beat: number): void {
    const target = Math.floor(beat / STEP_BEATS);
    while (this.#steps < target) {
      this.#step();
    }
  }

  // A note: every phase pulled towards the flash, at the beat reached. A ring's pull is
  // strongest near the quarter its count of pulls has walked to
  pull(): void {
    const noteAngle = ((this.#pulls % RING_QUARTERS) / RING_QUARTERS) * TAU;
    const { entrain } = this.#rules;
    this.#phases = this.#phases.map((phase, oscillator) => {
      return phase - entrain * this.#pullWeight(oscillator, noteAngle) * Math.sin(phase);
    });
    this.#pulls++;
  }

  #pullWeight(oscillator: number, noteAngle: number): number {
    if (this.#topology === 'all') {
      return 1;
    }
    const slotAngle = (oscillator / this.#phases.length) * TAU;
    const gap = Math.abs(Math.atan2(Math.sin(slotAngle - noteAngle), Math.cos(slotAngle - noteAngle)));
    return Math.exp(-(gap * gap) / NOTE_REACH);
  }

  #step(): void {
    const { coupling, period } = this.#rules;
    const strength = coupling * COUPLING_SHARE * (TAU / period);
    const next = this.#topology === 'ring' ? this.#ringStep(strength) : this.#crowdStep(strength);
    this.#phases = next.map((phase) => phase % TAU);
    this.#steps++;
  }

  // each phase on at its own pace, pulled to the crowd's mean phase, harder as the crowd agrees
  #crowdStep(strength: number): number[] {
    const phases = this.#phases;
    const cos = phases.reduce((sum, phase) => sum + Math.cos(phase), 0);
    const sin = phases.reduce((sum, phase) => sum + Math.sin(phase), 0);
    const order = Math.hypot(cos, sin) / phases.length;
    const mean = Math.atan2(sin, cos);
    return phases.map((phase, oscillator) => {
      return phase + (this.#paceOf(oscillator) + strength * order * Math.sin(mean - phase)) * STEP_BEATS;
    });
  }

  // each phase on at its own pace, pulled to a wave lagging round the ring by one full turn
  #ringStep(strength: number): number[] {
    const phases = this.#phases;
    const lag = TAU / phases.length;
    return phases.map((phase, oscillator) => {
      const before = phases[(oscillator + phases.length - 1) % phases.length] ?? phase;
      const after = phases[(oscillator + 1) % phases.length] ?? phase;
      const pull = (Math.sin(before - phase - lag) + Math.sin(after - phase + lag)) / 2;
      return phase + (this.#paceOf(oscillator) + strength * 2 * pull) * STEP_BEATS;
    });
  }

  #paceOf(oscillator: number): number {
    return this.#paces[oscillator] ?? 0;
  }
}
