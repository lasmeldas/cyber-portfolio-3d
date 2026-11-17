// Checks the JavaScript ports in lab/ against fixtures produced by the real Python tools
// (passguard and authwatch). Regenerate the fixtures with tests/make_fixtures.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze } from '../lab/passguard.js';
import { parseLines, detect } from '../lab/authwatch.js';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));

test('passguard port matches the Python tool on every sample password', () => {
  for (const { input, result } of fixtures.passwords) {
    assert.deepEqual(analyze(input), result, `password ${JSON.stringify(input)}`);
  }
});

test('authwatch port matches the Python tool on every sample log', () => {
  fixtures.logs.forEach((log, i) => {
    const opts = { threshold: log.opts.threshold, window: log.opts.window, sprayUsers: log.opts.spray_users };
    for (const k of Object.keys(opts)) if (opts[k] === undefined) delete opts[k];
    assert.deepEqual(detect(parseLines(log.text, log.year), opts), log.alerts, `log #${i}`);
  });
});

import { knnPredict, kmeans } from '../lab/ml.js';

test('k-NN port matches ml-from-scratch on random data, ties included', () => {
  fixtures.knn.forEach((c, i) => assert.deepEqual(knnPredict(c.X, c.y, c.k, c.Q), c.pred, `case ${i}`));
});

test('k-means finds three obvious groups, repeatably', () => {
  const X = [];
  for (const [cx, cy] of [[0, 0], [10, 0], [5, 9]]) for (let i = 0; i < 12; i++) X.push([cx + ((i * 7) % 5) / 10, cy + ((i * 3) % 5) / 10]);
  const a = kmeans(X, 3, { seed: 1 });
  const b = kmeans(X, 3, { seed: 1 });
  assert.deepEqual(a.labels, b.labels);
  for (let g = 0; g < 3; g++) assert.equal(new Set(a.labels.slice(g * 12, g * 12 + 12)).size, 1);
  assert.equal(new Set(a.labels).size, 3);
  assert.equal(kmeans(X.slice(0, 2), 3), null);
});
