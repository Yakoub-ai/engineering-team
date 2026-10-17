import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, termFreq, buildTfidf, cosine, topNeighbours } from '../lib/similarity.js';

test('tokenize lowercases, splits camelCase and drops stopwords', () => {
  assert.deepEqual(tokenize('The fooBar-baz is 42 and Zeppelin'), ['foo', 'bar', 'baz', '42', 'zeppelin']);
});

test('cosine is 1 for identical and 0 for disjoint vectors', () => {
  assert.ok(Math.abs(cosine({ a: 1, b: 2 }, { a: 1, b: 2 }) - 1) < 1e-9);
  assert.equal(cosine({ a: 1 }, { b: 1 }), 0);
  assert.equal(cosine({}, { b: 1 }), 0);
});

test('topNeighbours ranks similar entries above threshold', () => {
  const entries = [
    { id: 'x', tf: termFreq(tokenize('database schema orders sqlite storage')) },
    { id: 'y', tf: termFreq(tokenize('database schema orders sqlite deployment')) },
    { id: 'z', tf: termFreq(tokenize('kubernetes ingress certificate rotation')) },
    { id: 'p', tf: termFreq(tokenize('alpha beta')) },
    { id: 'q', tf: termFreq(tokenize('gamma delta')) },
  ];
  const { vectors } = buildTfidf(entries);
  const n = topNeighbours(vectors, { k: 5, threshold: 0.35 });
  assert.equal(n.get('x')[0].id, 'y');
  assert.ok(n.get('x')[0].score >= 0.35);
  assert.equal(n.get('z').length, 0);
});

test('topNeighbours honours the pair filter and k', () => {
  const same = termFreq(tokenize('alpha beta gamma delta'));
  const { vectors } = buildTfidf([
    { id: 'a', tf: same }, { id: 'b', tf: same }, { id: 'c', tf: same },
    { id: 'd', tf: termFreq(tokenize('one two')) }, { id: 'e', tf: termFreq(tokenize('three four')) },
    { id: 'f', tf: termFreq(tokenize('five six')) },
  ]);
  const n = topNeighbours(vectors, { k: 1, threshold: 0.1, filter: (p, q) => !(p === 'a' && q === 'b') && !(p === 'b' && q === 'a') });
  assert.equal(n.get('a').length, 1);
  assert.equal(n.get('a')[0].id, 'c');
});

test('topNeighbours ignores terms present in more than half the documents', () => {
  const entries = ['a', 'b', 'c', 'd'].map((id) => ({ id, tf: termFreq(tokenize('common shared words')) }));
  const { vectors } = buildTfidf(entries);
  assert.equal(topNeighbours(vectors, { threshold: 0.1 }).get('a').length, 0);
});
