// Noise (noise/): correlated noise drawn from a handed-in Randomness, a step at a time: pink by
// Voss-McCartney, a drift held within its limit, mean-reverting noise, and the normal draw beneath it
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Drift, MeanRevertingNoise, normalDraw, PinkNoise } from '../index.ts';
import { seededRandomness } from '../../randomness/test/seeded-randomness.js';
import { near } from '../../randomness/test/near.js';

const LONG_RUN = 100_000;
// the spectrum's segments: 1024 steps each, their power averaged (Welch's method, without overlap or window)
const SEGMENT = 1024;
const SEGMENTS = 64;

function seriesOf(noise, length) {
  return Array.from({ length }, () => noise.step());
}
function meanOf(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function spreadOf(values) {
  const mean = meanOf(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

// The power at each frequency bin, 1 to SEGMENT / 2 - 1, averaged over the segments
function powerSpectrum(series) {
  const power = Array.from({ length: SEGMENT / 2 }, () => 0);
  for (let segment = 0; segment < SEGMENTS; segment++) {
    const part = series.slice(segment * SEGMENT, (segment + 1) * SEGMENT);
    const mean = meanOf(part);
    const { real, imaginary } = fft(part.map((value) => value - mean));
    for (let bin = 1; bin < SEGMENT / 2; bin++) {
      power[bin] += (real[bin] ** 2 + imaginary[bin] ** 2) / SEGMENTS;
    }
  }
  return power;
}
// A radix-2 fast Fourier transform: the length a power of 2, halves split by even and odd places
function fft(values) {
  if (values.length === 1) {
    return { real: [values[0]], imaginary: [0] };
  }
  const even = fft(values.filter((_, index) => index % 2 === 0));
  const odd = fft(values.filter((_, index) => index % 2 === 1));
  const half = values.length / 2;
  const real = Array.from({ length: values.length }, () => 0);
  const imaginary = Array.from({ length: values.length }, () => 0);
  for (let bin = 0; bin < half; bin++) {
    const angle = (-2 * Math.PI * bin) / values.length;
    const turnedReal = Math.cos(angle) * odd.real[bin] - Math.sin(angle) * odd.imaginary[bin];
    const turnedImaginary = Math.cos(angle) * odd.imaginary[bin] + Math.sin(angle) * odd.real[bin];
    real[bin] = even.real[bin] + turnedReal;
    imaginary[bin] = even.imaginary[bin] + turnedImaginary;
    real[bin + half] = even.real[bin] - turnedReal;
    imaginary[bin + half] = even.imaginary[bin] - turnedImaginary;
  }
  return { real, imaginary };
}
// The slope of log power against log frequency, a least-squares line through the bins from `low` to `high`:
// −1 falls 3 dB an octave (pink), 0 is flat (white)
function spectralSlope(series, low, high) {
  const power = powerSpectrum(series);
  const points = [];
  for (let bin = low; bin <= high; bin++) {
    points.push({ x: Math.log(bin), y: Math.log(power[bin]) });
  }
  const meanX = meanOf(points.map(({ x }) => x));
  const meanY = meanOf(points.map(({ y }) => y));
  const covariance = points.reduce((sum, { x, y }) => sum + (x - meanX) * (y - meanY), 0);
  const variance = points.reduce((sum, { x }) => sum + (x - meanX) ** 2, 0);
  return covariance / variance;
}

test('normalDraw(): a mean of 0 and a spread of 1, the same for the same seed', () => {
  const randomness = seededRandomness(3);
  const draws = Array.from({ length: LONG_RUN }, () => normalDraw(randomness));
  near(meanOf(draws), 0, 'mean', 0.02);
  near(spreadOf(draws), 1, 'spread', 0.02);
  assert.equal(normalDraw(seededRandomness(9)), normalDraw(seededRandomness(9)));
  assert.ok(Number.isFinite(normalDraw({ next: () => 0, fork: () => assert.fail() })), 'a draw of 0 is no infinity');
});

test('PinkNoise: the same seed, the same series; it stays within ±1', () => {
  assert.deepEqual(
    seriesOf(new PinkNoise(12, seededRandomness(5)), 500),
    seriesOf(new PinkNoise(12, seededRandomness(5)), 500),
  );
  assert.notDeepEqual(
    seriesOf(new PinkNoise(12, seededRandomness(5)), 50),
    seriesOf(new PinkNoise(12, seededRandomness(6)), 50),
  );
  const series = seriesOf(new PinkNoise(12, seededRandomness(5)), LONG_RUN);
  assert.ok(Math.max(...series.map(Math.abs)) <= 1, 'within ±1');
});

test('PinkNoise: its power falls about 3 dB an octave, a slope near −1 on log power against log frequency; white noise stays flat', () => {
  const length = SEGMENT * SEGMENTS;
  const pink = seriesOf(new PinkNoise(16, seededRandomness(7)), length);
  const randomness = seededRandomness(7);
  const white = Array.from({ length }, () => randomness.next() * 2 - 1);
  // bins 2 to 256 of 1024: seven octaves, below where the fastest sources' steps flatten it
  near(spectralSlope(pink, 2, 256), -1, 'pink', 0.15);
  near(spectralSlope(white, 2, 256), 0, 'white', 0.1);
});

test('PinkNoise: value is the last step, and each source moves at half the rate of the one before', () => {
  const pink = new PinkNoise(4, seededRandomness(1));
  const stepped = pink.step();
  assert.equal(pink.value, stepped);
  // a randomness counting its draws: the fastest source each step, and the step's count's trailing zeros pick one slower
  // source, the first every 2nd step, the next every 4th, the last every 8th; every 8th step none is left to pick
  let drawn = 0;
  const counting = { next: () => (drawn++ % 7) / 7, fork: () => assert.fail() };
  const noise = new PinkNoise(4, counting);
  const perStep = Array.from({ length: 16 }, () => {
    const before = drawn;
    noise.step();
    return drawn - before;
  });
  assert.deepEqual(perStep, [2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 1]);
});

test('Drift: the same seed, the same series; it never leaves ±limit, however far a step goes', () => {
  const shape = { step: 0.1, limit: 1 };
  assert.deepEqual(
    seriesOf(new Drift(shape, seededRandomness(2)), 500),
    seriesOf(new Drift(shape, seededRandomness(2)), 500),
  );
  for (const { step, limit } of [shape, { step: 0.5, limit: 0.2 }, { step: 3, limit: 1 }]) {
    const series = seriesOf(new Drift({ step, limit }, seededRandomness(4)), LONG_RUN);
    assert.ok(Math.max(...series.map(Math.abs)) <= limit, `step ${step}, limit ${limit}`);
    assert.ok(Math.max(...series) > limit * 0.9 && Math.min(...series) < -limit * 0.9, 'it reaches both edges');
  }
});

test('Drift: a step moves it by at most the step size, and an edge reflects it back by what it overshot', () => {
  const series = seriesOf(new Drift({ step: 0.05, limit: 1 }, seededRandomness(8)), 10_000);
  for (let index = 1; index < series.length; index++) {
    assert.ok(Math.abs(series[index] - series[index - 1]) <= 0.05 + 1e-12, `step ${index}`);
  }
  const upward = { next: () => 0.99, fork: () => assert.fail() }; // a step of 0.98 × 0.5 up, every time
  const drift = new Drift({ step: 0.5, limit: 1, start: 0.9 }, upward);
  near(drift.value, 0.9, 'it starts where asked');
  near(drift.step(), 2 - 0.9 - 0.49, 'reflected at the edge');
});

test('MeanRevertingNoise: the same seed, the same series; its mean and spread are those asked, over a long run', () => {
  const shape = { mean: 2, rate: 0.05, spread: 0.5 };
  assert.deepEqual(
    seriesOf(new MeanRevertingNoise(shape, seededRandomness(3)), 500),
    seriesOf(new MeanRevertingNoise(shape, seededRandomness(3)), 500),
  );
  for (const rules of [shape, { mean: -1, rate: 0.5, spread: 3 }, { mean: 0, rate: 1, spread: 1 }]) {
    const series = seriesOf(new MeanRevertingNoise(rules, seededRandomness(11)), LONG_RUN * 4);
    near(meanOf(series), rules.mean, `mean, rate ${rules.rate}`, rules.spread * 0.05);
    near(spreadOf(series), rules.spread, `spread, rate ${rules.rate}`, rules.spread * 0.05);
  }
});

test('MeanRevertingNoise: it starts at its mean or where asked, and a rate pulls it back that share of the way a step', () => {
  assert.equal(new MeanRevertingNoise({ mean: 2, rate: 0.1, spread: 1 }, seededRandomness(1)).value, 2);
  const still = { next: () => 0.25, fork: () => assert.fail() }; // a normal draw of 0: cos(2π × 0.25)
  const noise = new MeanRevertingNoise({ mean: 0, rate: 0.25, spread: 1, start: 8 }, still);
  near(noise.step(), 6);
  near(noise.step(), 4.5);
});
