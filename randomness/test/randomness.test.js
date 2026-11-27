// Randomness (randomness/): the seeded draws every rule can be handed, the same for the same seed and fork name
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededRandomness } from '../index.ts';

// Four draws each, recorded from the tests' helper (test/seeded-randomness.js) before it moved into the library:
// a seed's own stream, a fork of it, and a fork of that fork
const RECORDED = {
  0: {
    own: [0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111],
    plants: [0.8683014020789415, 0.6850936338305473, 0.5444400536362082, 0.5410999124869704],
    plantsCross: [0.11920658126473427, 0.09173200908116996, 0.09748061560094357, 0.7278758645989001],
  },
  1: {
    own: [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741],
    plants: [0.923072540666908, 0.5008811720181257, 0.4585686994250864, 0.10725035076029599],
    plantsCross: [0.7189181570429355, 0.012645491864532232, 0.7995930041652173, 0.4759131430182606],
  },
  42: {
    own: [0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693],
    plants: [0.14084032201208174, 0.6859323340468109, 0.3233027171809226, 0.7394051973242313],
    plantsCross: [0.14008454722352326, 0.5245735419448465, 0.6947562301065773, 0.004045633831992745],
  },
  4294967295: {
    own: [0.8964226141106337, 0.189478256739676, 0.7156526781618595, 0.9440599093213677],
    plants: [0.8539849803783, 0.5910328621976078, 0.5622295420616865, 0.9141885947901756],
    plantsCross: [0.24985808599740267, 0.03757877042517066, 0.5240842869970948, 0.07740994496271014],
  },
};

function drawsOf(randomness) {
  return Array.from({ length: 4 }, () => randomness.next());
}

test("seededRandomness(): the same draws as the tests' helper drew, for each seed, its fork and a fork of that", () => {
  for (const [seed, recorded] of Object.entries(RECORDED)) {
    const number = Number(seed);
    assert.deepEqual(drawsOf(seededRandomness(number)), recorded.own, `seed ${seed}`);
    assert.deepEqual(drawsOf(seededRandomness(number).fork('plants')), recorded.plants, `seed ${seed}, plants`);
    assert.deepEqual(
      drawsOf(seededRandomness(number).fork('plants').fork('cross')),
      recorded.plantsCross,
      `seed ${seed}, plants then cross`,
    );
  }
});

test('seededRandomness(): a fork is the same whatever was drawn before it', () => {
  const drawnFirst = seededRandomness(42);
  drawsOf(drawnFirst);
  assert.deepEqual(drawsOf(drawnFirst.fork('plants')), RECORDED[42].plants);
});
