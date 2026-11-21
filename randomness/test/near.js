// A number near another, for every library's tests, beside the seeded draws they all take:
//   - isNear(): whether it is, within a float's rounding (1e-9), or as asked;
//   - near(): an assertion that it is, its message saying by how much it may differ.
import assert from 'node:assert/strict';

const ROUNDING = 1e-9;

export function isNear(actual, expected, within = ROUNDING) {
  return Math.abs(actual - expected) <= within;
}
export function near(actual, expected, message = '', within = ROUNDING) {
  const what = message ? `${message}: ` : '';
  assert.ok(isNear(actual, expected, within), `${what}${actual}, not within ${within} of ${expected}`);
}
