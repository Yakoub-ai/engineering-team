import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildIndex, saveIndex, loadIndex, updateIndex, reindexFile, search } from '../lib/index.js';
import { copyFixture, cleanup, FIXTURE } from './helpers.js';

const hasEdge = (idx, from, to, type) => idx.edges.some((e) => e.from === from && e.to === to && e.type === type);
const node = (idx, id) => idx.nodes.find((n) => n.id === id);

test('exclusions: no .env, node_modules or gitignored content', () => {
  const dir = copyFixture();
  try {
    const idx = buildIndex(dir);
    assert.ok(!idx.nodes.some((n) => /\.env|node_modules|^ignored\//.test(n.path)));
    assert.ok(!JSON.stringify(idx).includes('do-not-index'));
    assert.ok(!idx.files['.env']);
  } finally {
    cleanup(dir);
  }
});

test('kinds are assigned per spec', () => {
  const dir = copyFixture();
  try {
    const idx = buildIndex(dir);
    const kind = (id) => node(idx, id)?.kind;
    assert.equal(kind('docs/engineering/STATUS.md'), 'status');
    assert.equal(kind('docs/engineering/team-plan.md'), 'team-plan');
    assert.equal(kind('docs/engineering/handovers/0001-lead.md'), 'handover');
    assert.equal(kind('docs/engineering/decisions/0001-use-sqlite.md'), 'decision');
    assert.equal(kind('docs/engineering/plans/2026-01-01-demo.md'), 'plan');
    assert.equal(kind('docs/guide.md'), 'doc');
    assert.equal(kind('src/a.js'), 'code');
    assert.equal(kind('.eng-team/state.md'), 'state');
    assert.equal(kind('docs/engineering/plans/2026-01-01-demo.md#T1'), 'plan-task');
    assert.equal(kind('docs/security/report.md#SEC-001'), 'finding');
    assert.equal(kind('docs/engineering/questions.md#Q-1'), 'question');
    assert.equal(node(idx, 'docs/security/report.md#SEC-001').line, 3);
    assert.equal(idx.version, 1);
    assert.equal(idx.semantic, 'lexical');
  } finally {
    cleanup(dir);
  }
});

test('contains, id, ref, imports and link edges', () => {
  const dir = copyFixture();
  try {
    const idx = buildIndex(dir);
    const plan = 'docs/engineering/plans/2026-01-01-demo.md';
    const ho = 'docs/engineering/handovers/0001-lead.md';
    assert.ok(hasEdge(idx, plan, `${plan}#T1`, 'contains'));
    assert.ok(hasEdge(idx, plan, `${plan}#T2`, 'contains'));
    assert.ok(hasEdge(idx, 'docs/security/report.md', 'docs/security/report.md#SEC-001', 'contains'));
    assert.ok(hasEdge(idx, ho, 'docs/engineering/decisions/0001-use-sqlite.md', 'id'));
    assert.ok(hasEdge(idx, ho, 'docs/security/report.md#SEC-001', 'id'));
    assert.ok(hasEdge(idx, ho, 'docs/engineering/questions.md#Q-1', 'id'));
    assert.ok(hasEdge(idx, 'docs/guide.md', 'src/a.js', 'ref'));
    assert.ok(hasEdge(idx, 'src/a.js', 'src/b.js', 'imports'));
    assert.ok(hasEdge(idx, 'docs/engineering/STATUS.md', 'docs/engineering/team-plan.md', 'link'));
    assert.ok(hasEdge(idx, 'docs/engineering/STATUS.md', plan, 'link'));
    assert.ok(!idx.edges.some((e) => e.from === e.to));
  } finally {
    cleanup(dir);
  }
});

test('lexical edges link similar documents', () => {
  const dir = copyFixture();
  try {
    const text = '# Caching\n\nredis cache eviction ttl invalidation strategy layered cache keys\n';
    fs.writeFileSync(path.join(dir, 'docs/cache-a.md'), text);
    fs.writeFileSync(path.join(dir, 'docs/cache-b.md'), text.replace('Caching', 'Caches'));
    const idx = buildIndex(dir);
    const e = idx.edges.find((x) => x.type === 'lexical' && [x.from, x.to].includes('docs/cache-a.md'));
    assert.ok(e && e.score >= 0.35);
    assert.ok(!idx.edges.some((x) => x.type === 'lexical' && x.from.endsWith('.js') && x.to.endsWith('.js')));
  } finally {
    cleanup(dir);
  }
});

test('index saved at .eng-team/.cache/index/index.json and loadable', () => {
  const dir = copyFixture();
  try {
    assert.equal(loadIndex(dir), null);
    saveIndex(dir, buildIndex(dir));
    const file = path.join(dir, '.eng-team', '.cache', 'index', 'index.json');
    assert.ok(fs.existsSync(file));
    const loaded = loadIndex(dir);
    assert.equal(loaded.version, 1);
    assert.ok(loaded.nodes.length > 5);
    assert.ok(!fs.existsSync(path.join(FIXTURE, '.eng-team', '.cache')), 'fixture untouched');
  } finally {
    cleanup(dir);
  }
});

test('updateIndex re-reads only the changed file', () => {
  const dir = copyFixture();
  try {
    saveIndex(dir, buildIndex(dir));
    fs.writeFileSync(path.join(dir, 'src/b.js'), 'export function b() {\n  return "quokkaterm";\n}\n');
    const idx = updateIndex(dir, { embedder: null });
    assert.deepEqual(idx.lastUpdate.read, ['src/b.js']);
    assert.ok(hasEdge(idx, 'src/a.js', 'src/b.js', 'imports'), 'edges survive incremental update');
    assert.equal(search(idx, 'quokkaterm')[0].node.id, 'src/b.js');
    assert.equal(loadIndex(dir).lastUpdate, undefined);
    const again = updateIndex(dir, {});
    assert.deepEqual(again.lastUpdate.read, []);
  } finally {
    cleanup(dir);
  }
});

test('updateIndex picks up added and deleted files', () => {
  const dir = copyFixture();
  try {
    saveIndex(dir, buildIndex(dir));
    fs.writeFileSync(path.join(dir, 'docs/new.md'), '# New\n\nSee [guide](guide.md).\n');
    fs.rmSync(path.join(dir, 'src/b.js'));
    const idx = updateIndex(dir, {});
    assert.deepEqual(idx.lastUpdate.read, ['docs/new.md']);
    assert.ok(hasEdge(idx, 'docs/new.md', 'docs/guide.md', 'link'));
    assert.equal(node(idx, 'src/b.js'), undefined);
    assert.ok(!hasEdge(idx, 'src/a.js', 'src/b.js', 'imports'));
  } finally {
    cleanup(dir);
  }
});

test('reindexFile refreshes one file in place', () => {
  const dir = copyFixture();
  try {
    const idx = buildIndex(dir);
    fs.writeFileSync(path.join(dir, 'docs/guide.md'), '# Guide\n\nNow about the narwhalword.\n');
    const out = reindexFile(dir, idx, 'docs/guide.md');
    assert.equal(out, idx);
    assert.deepEqual(idx.lastUpdate.read, ['docs/guide.md']);
    assert.equal(search(idx, 'narwhalword')[0].node.id, 'docs/guide.md');
  } finally {
    cleanup(dir);
  }
});

test('search ranks the expected doc first and honours kinds and limit', () => {
  const dir = copyFixture();
  try {
    const idx = buildIndex(dir);
    const hits = search(idx, 'zeppelin');
    assert.equal(hits[0].node.id, 'docs/guide.md');
    assert.ok(hits[0].score > 0);
    assert.equal(hits[0].node.tokens, undefined);
    assert.equal(search(idx, 'sqlite', { kinds: ['decision'] })[0].node.kind, 'decision');
    assert.equal(search(idx, 'orders', { limit: 1 }).length, 1);
    assert.deepEqual(search(idx, 'xyznonexistentterm'), []);
  } finally {
    cleanup(dir);
  }
});
