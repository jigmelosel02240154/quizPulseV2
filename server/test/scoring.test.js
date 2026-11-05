const test = require('node:test');
const assert = require('node:assert');
const { computeScore } = require('../src/scoring');

test('wrong answers score 0', () => assert.strictEqual(computeScore(false, 100), 0));
test('instant correct answer scores 150', () => assert.strictEqual(computeScore(true, 0, 15000), 150));
test('last-second correct answer scores 100', () => assert.strictEqual(computeScore(true, 15000, 15000), 100));
test('late answer never goes below 100', () => assert.strictEqual(computeScore(true, 99999, 15000), 100));
test('half-time answer scores 125', () => assert.strictEqual(computeScore(true, 7500, 15000), 125));
