import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildIndex, saveIndex, loadIndex, updateIndex, reindexFile, search } from '../lib/index.js';
import { copyFixture, cleanup, FIXTURE } from './helpers.js';

const hasEdge = (idx, from, to, type) => idx.edges.some((e) => e.from === from && e.to === to && e.type === type);
const node = (idx, id) => idx.nodes.find((n) => n.id === id);

test('exclusions: no .env, node_modules or gitignored content', async () => {
  const dir = copyFixture();
  try {
    const idx = await buildIndex(dir);
    assert.ok(!idx.nodes.some((n) => /\.env|node_modules|^ignored\//.test(n.path)));
    assert.ok(!JSON.stringify(idx).includes('do-not-index'));
    assert.ok(!idx.files['.env']);
  } finally {
    cleanup(dir);
  }
});

test('kinds are assigned per spec', async () => {
  const dir = copyFixture();
  try {
    const idx = await buildIndex(dir);
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

test('contains, id, ref, imports and link edges', async () => {
  const dir = copyFixture();
  try {
    const idx = await buildIndex(dir);
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

test('lexical edges link similar documents', async () => {
  const dir = copyFixture();
  try {
    const text = '# Caching\n\nredis cache eviction ttl invalidation strategy layered cache keys\n';
    fs.writeFileSync(path.join(dir, 'docs/cache-a.md'), text);
    fs.writeFileSync(path.join(dir, 'docs/cache-b.md'), text.replace('Caching', 'Caches'));
    const idx = await buildIndex(dir);
    const e = idx.edges.find((x) => x.type === 'lexical' && [x.from, x.to].includes('docs/cache-a.md'));
    assert.ok(e && e.score >= 0.35);
    assert.ok(!idx.edges.some((x) => x.type === 'lexical' && x.from.endsWith('.js') && x.to.endsWith('.js')));
  } finally {
    cleanup(dir);
  }
});

test('index saved at .eng-team/.cache/index/index.json and loadable', async () => {
  const dir = copyFixture();
  try {
    assert.equal(loadIndex(dir), null);
    saveIndex(dir, await buildIndex(dir));
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

test('updateIndex re-reads only the changed file', async () => {
  const dir = copyFixture();
  try {
    saveIndex(dir, await buildIndex(dir));
    fs.writeFileSync(path.join(dir, 'src/b.js'), 'export function b() {\n  return "quokkaterm";\n}\n');
    const idx = await updateIndex(dir, { embedder: null });
    assert.deepEqual(idx.lastUpdate.read, ['src/b.js']);
    assert.ok(hasEdge(idx, 'src/a.js', 'src/b.js', 'imports'), 'edges survive incremental update');
    assert.equal((await search(idx, 'quokkaterm'))[0].node.id, 'src/b.js');
    assert.equal(loadIndex(dir).lastUpdate, undefined);
    const again = await updateIndex(dir, {});
    assert.deepEqual(again.lastUpdate.read, []);
  } finally {
    cleanup(dir);
  }
});

test('updateIndex picks up added and deleted files', async () => {
  const dir = copyFixture();
  try {
    saveIndex(dir, await buildIndex(dir));
    fs.writeFileSync(path.join(dir, 'docs/new.md'), '# New\n\nSee [guide](guide.md).\n');
    fs.rmSync(path.join(dir, 'src/b.js'));
    const idx = await updateIndex(dir, {});
    assert.deepEqual(idx.lastUpdate.read, ['docs/new.md']);
    assert.ok(hasEdge(idx, 'docs/new.md', 'docs/guide.md', 'link'));
    assert.equal(node(idx, 'src/b.js'), undefined);
    assert.ok(!hasEdge(idx, 'src/a.js', 'src/b.js', 'imports'));
  } finally {
    cleanup(dir);
  }
});

test('reindexFile refreshes one file in place', async () => {
  const dir = copyFixture();
  try {
    const idx = await buildIndex(dir);
    fs.writeFileSync(path.join(dir, 'docs/guide.md'), '# Guide\n\nNow about the narwhalword.\n');
    const out = await reindexFile(dir, idx, 'docs/guide.md');
    assert.equal(out, idx);
    assert.deepEqual(idx.lastUpdate.read, ['docs/guide.md']);
    assert.equal((await search(idx, 'narwhalword'))[0].node.id, 'docs/guide.md');
  } finally {
    cleanup(dir);
  }
});

test('search ranks the expected doc first and honours kinds and limit', async () => {
  const dir = copyFixture();
  try {
    const idx = await buildIndex(dir);
    const hits = await search(idx, 'zeppelin');
    assert.equal(hits[0].node.id, 'docs/guide.md');
    assert.ok(hits[0].score > 0);
    assert.equal(hits[0].node.tokens, undefined);
    assert.equal((await search(idx, 'sqlite', { kinds: ['decision'] }))[0].node.kind, 'decision');
    assert.equal((await search(idx, 'orders', { limit: 1 })).length, 1);
    assert.deepEqual((await search(idx, 'xyznonexistentterm')), []);
  } finally {
    cleanup(dir);
  }
});

test('plan-task ids do not fan out across plans', async () => {
  const dir = copyFixture();
  try {
    const p2 = 'docs/engineering/plans/2026-02-02-other.md';
    fs.writeFileSync(path.join(dir, p2), '# Other plan\n\n### T1: Different\n\nbody\n');
    fs.writeFileSync(path.join(dir, 'docs/engineering/handovers/0002-a.md'), '# H2\n\nFinished T1 today.\n');
    fs.writeFileSync(path.join(dir, 'docs/engineering/handovers/0003-b.md'), '# H3\n\nFinished T1 per [plan](../plans/2026-02-02-other.md).\n');
    const idx = await buildIndex(dir);
    const plan = 'docs/engineering/plans/2026-01-01-demo.md';
    const h2 = 'docs/engineering/handovers/0002-a.md';
    const h3 = 'docs/engineering/handovers/0003-b.md';
    assert.ok(!idx.edges.some((e) => e.from === h2 && e.type === 'id'), 'ambiguous T1 gets no edge');
    assert.ok(hasEdge(idx, h3, `${p2}#T1`, 'id'));
    assert.ok(!hasEdge(idx, h3, `${plan}#T1`, 'id'));
  } finally {
    cleanup(dir);
  }
});

test('a single plan defining T2 resolves for an unlinked mention', async () => {
  const dir = copyFixture();
  try {
    fs.writeFileSync(path.join(dir, 'docs/note.md'), '# Note\n\nT2 is blocked.\n');
    assert.ok(hasEdge(await buildIndex(dir), 'docs/note.md', 'docs/engineering/plans/2026-01-01-demo.md#T2', 'id'));
  } finally {
    cleanup(dir);
  }
});

test('ambiguous finding ids prefer linked files, else add no edge', async () => {
  const dir = copyFixture();
  try {
    fs.writeFileSync(path.join(dir, 'docs/security/second.md'), '# Second\n\n### SEC-001: Other\n\nx\n');
    fs.writeFileSync(path.join(dir, 'docs/m1.md'), '# M1\n\nSee SEC-001.\n');
    fs.writeFileSync(path.join(dir, 'docs/m2.md'), '# M2\n\nSee SEC-001 in [r](security/second.md).\n');
    const idx = await buildIndex(dir);
    assert.ok(!idx.edges.some((e) => e.from === 'docs/m1.md' && e.type === 'id'));
    assert.ok(hasEdge(idx, 'docs/m2.md', 'docs/security/second.md#SEC-001', 'id'));
    assert.ok(!hasEdge(idx, 'docs/m2.md', 'docs/security/report.md#SEC-001', 'id'));
  } finally {
    cleanup(dir);
  }
});

test('bare NNNN-slug in a handover is not an ADR mention; exact decision basename is', async () => {
  const dir = copyFixture();
  try {
    const h = 'docs/engineering/handovers/0002-x.md';
    const dec = 'docs/engineering/decisions/0001-use-sqlite.md';
    fs.writeFileSync(path.join(dir, h), '# H\n\nSee handover 0001-lead for context.\n');
    let idx = await buildIndex(dir);
    assert.ok(!idx.edges.some((e) => e.from === h && e.type === 'id'));
    fs.writeFileSync(path.join(dir, h), '# H\n\nSee 0001-use-sqlite for context.\n');
    idx = await buildIndex(dir);
    assert.ok(hasEdge(idx, h, dec, 'id'));
  } finally {
    cleanup(dir);
  }
});

test('symlinked cache dir is not written through', async () => {
  const dir = copyFixture();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'eng-view-out-'));
  try {
    fs.mkdirSync(path.join(dir, '.eng-team'), { recursive: true });
    fs.symlinkSync(outside, path.join(dir, '.eng-team', '.cache'));
    const idx = await buildIndex(dir);
    const logged = [];
    const realWrite = process.stderr.write;
    process.stderr.write = (chunk) => { logged.push(String(chunk)); return true; };
    try {
      saveIndex(dir, idx);
      assert.equal(loadIndex(dir), null);
    } finally {
      process.stderr.write = realWrite;
    }
    assert.deepEqual(fs.readdirSync(outside), []);
    assert.ok(logged.some((l) => l.includes('unsafe index cache path')));
    process.stderr.write = (chunk) => { logged.push(String(chunk)); return true; };
    const before = logged.length;
    try {
      saveIndex(dir, idx);
      saveIndex(dir, idx);
    } finally {
      process.stderr.write = realWrite;
    }
    assert.equal(logged.length, before, 'warning is logged once per process');
  } finally {
    cleanup(dir);
    cleanup(outside);
  }
});

test('index from another project or with a bad shape is ignored', async () => {
  const dir = copyFixture();
  try {
    const idx = await buildIndex(dir);
    saveIndex(dir, idx);
    const file = path.join(dir, '.eng-team', '.cache', 'index', 'index.json');
    const write = (o) => fs.writeFileSync(file, JSON.stringify(o));
    assert.ok(loadIndex(dir));
    write({ ...idx, project: '/somewhere/else' });
    assert.equal(loadIndex(dir), null);
    write({ ...idx, nodes: [{ id: 1, path: 'x' }] });
    assert.equal(loadIndex(dir), null);
    write({ ...idx, edges: [{ from: 'a' }] });
    assert.equal(loadIndex(dir), null);
    write({ ...idx, files: [] });
    assert.equal(loadIndex(dir), null);
  } finally {
    cleanup(dir);
  }
});

test('reindexFile without an embedder keeps existing vectors and the embeddings label', async () => {
  const dir = copyFixture();
  try {
    const embedder = {
      model: 'fake-model',
      embed: async (texts) => texts.map((t) => [t.length % 7 + 1, 1, 0.5]),
    };
    const idx = await buildIndex(dir, { embedder });
    assert.equal(idx.semantic, 'embeddings');
    fs.writeFileSync(path.join(dir, 'docs/guide.md'), '# Guide\n\nNow about the narwhalword.\n');
    await reindexFile(dir, idx, 'docs/guide.md');
    assert.equal(idx.semantic, 'embeddings');
    assert.equal(idx.model, 'fake-model');
    assert.ok(Array.isArray(node(idx, 'src/a.js').vec), 'unchanged node keeps its vector');
    assert.equal(node(idx, 'docs/guide.md').vec, undefined, 're-read node has no vector until the next embedder-backed update');
    assert.equal((await search(idx, 'narwhalword'))[0].node.id, 'docs/guide.md');
  } finally {
    cleanup(dir);
  }
});
