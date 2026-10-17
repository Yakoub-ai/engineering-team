import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createEmbedder } from '../lib/embed.js';
import { buildIndex, saveIndex, loadIndex, updateIndex, reindexFile, search } from '../lib/index.js';
import { copyFixture, cleanup } from './helpers.js';

const TOPICS = ['alpha', 'beta', 'gamma', 'delta'];

/** Deterministic topic embedder: one axis per topic word, 5 dims, normalised. */
function fakeEmbedder() {
  const seen = [];
  return {
    model: 'fake-topics',
    seen,
    async embed(texts) {
      return texts.map((t) => {
        seen.push(t);
        const v = TOPICS.map((w) => (t.toLowerCase().match(new RegExp(w, 'g')) || []).length);
        v.push(0.5); // shared "other" axis keeps topic-less text off the topic axes
        const norm = Math.hypot(...v);
        return Float32Array.from(v.map((x) => x / norm));
      });
    },
  };
}

const semantic = (idx) => idx.edges.filter((e) => e.type === 'semantic');

async function withTopics(fn) {
  const dir = copyFixture();
  try {
    fs.writeFileSync(path.join(dir, 'docs/one.md'), '# One\n\nalpha alpha alpha notes\n');
    fs.writeFileSync(path.join(dir, 'docs/two.md'), '# Two\n\nalpha alpha plus a little beta\n');
    fs.writeFileSync(path.join(dir, 'docs/three.md'), '# Three\n\ngamma gamma gamma delta\n');
    await fn(dir);
  } finally {
    cleanup(dir);
  }
}

test('createEmbedder returns null (no throw) when the package is absent', async (t) => {
  let installed = true;
  try {
    await import('@huggingface/transformers');
  } catch {
    installed = false;
  }
  if (installed) return t.skip('@huggingface/transformers is installed');
  const dir = copyFixture();
  try {
    assert.equal(await createEmbedder({ cacheDir: path.join(dir, 'models') }), null);
  } finally {
    cleanup(dir);
  }
});

test('with an embedder: semantic edges (>= 0.6) and semantic label', async () => {
  await withTopics(async (dir) => {
    const idx = await buildIndex(dir, { embedder: fakeEmbedder() });
    assert.equal(idx.semantic, 'embeddings');
    assert.ok(!idx.edges.some((e) => e.type === 'lexical'));
    const e = semantic(idx).find((x) => [x.from, x.to].includes('docs/one.md') && [x.from, x.to].includes('docs/two.md'));
    assert.ok(e && e.score >= 0.6 && e.score <= 1);
    assert.ok(!semantic(idx).some((x) => [x.from, x.to].includes('docs/three.md') && [x.from, x.to].includes('docs/one.md')),
      'unrelated topics stay below the threshold');
    assert.ok(!semantic(idx).some((x) => x.from.endsWith('.js') && x.to.endsWith('.js')), 'no code-code edges');
    assert.ok(semantic(idx).every((x) => x.from !== x.to));
  });
});

test('semantic edges keep at most 5 neighbours per node', async () => {
  await withTopics(async (dir) => {
    for (let i = 0; i < 9; i++) fs.writeFileSync(path.join(dir, `docs/a${i}.md`), `# A${i}\n\nalpha alpha ${i}\n`);
    const idx = await buildIndex(dir, { embedder: fakeEmbedder() });
    assert.ok(semantic(idx).length > 0);
    assert.ok(semantic(idx).length <= 5 * idx.nodes.filter((n) => !n.id.includes('#')).length);
  });
});

test('without an embedder the index stays lexical and carries no vectors', async () => {
  await withTopics(async (dir) => {
    const idx = await buildIndex(dir, { embedder: null });
    assert.equal(idx.semantic, 'lexical');
    assert.ok(!idx.nodes.some((n) => n.vec));
    assert.equal(semantic(idx).length, 0);
  });
});

test('incremental update re-embeds only changed files and persists vectors', async () => {
  await withTopics(async (dir) => {
    const first = fakeEmbedder();
    saveIndex(dir, await buildIndex(dir, { embedder: first }));
    const loaded = loadIndex(dir);
    assert.equal(loaded.semantic, 'embeddings');
    assert.equal(loaded.model, 'fake-topics');
    const vec = loaded.nodes.find((n) => n.id === 'docs/one.md').vec;
    assert.ok(Array.isArray(vec) && vec.every((x) => Math.round(x * 1e4) / 1e4 === x));

    fs.writeFileSync(path.join(dir, 'docs/one.md'), '# One\n\nalpha alpha alpha alpha now\n');
    const second = fakeEmbedder();
    const idx = await updateIndex(dir, { embedder: second });
    assert.deepEqual(idx.lastUpdate.read, ['docs/one.md']);
    assert.ok(second.seen.length >= 1);
    assert.ok(second.seen.every((t) => !t.includes('gamma')), 'unchanged files not re-embedded');
    assert.equal(idx.semantic, 'embeddings');
    const e = semantic(idx).find((x) => [x.from, x.to].includes('docs/one.md') && [x.from, x.to].includes('docs/two.md'));
    assert.ok(e, 'edges are recomputed from stored plus new vectors');

    const third = fakeEmbedder();
    await updateIndex(dir, { embedder: third });
    assert.equal(third.seen.length, 0);
  });
});

test('adding an embedder to a lexical index embeds everything once', async () => {
  await withTopics(async (dir) => {
    saveIndex(dir, await buildIndex(dir));
    const emb = fakeEmbedder();
    const idx = await updateIndex(dir, { embedder: emb });
    assert.equal(idx.semantic, 'embeddings');
    assert.ok(idx.nodes.every((n) => Array.isArray(n.vec)));
    assert.ok(emb.seen.length >= idx.nodes.length);
  });
});

test('a different model invalidates stored vectors', async () => {
  await withTopics(async (dir) => {
    saveIndex(dir, await buildIndex(dir, { embedder: fakeEmbedder() }));
    const other = { ...fakeEmbedder(), model: 'other-model' };
    const idx = await updateIndex(dir, { embedder: other });
    assert.equal(idx.model, 'other-model');
    assert.ok(idx.lastUpdate.read.length > 3);
  });
});

test('embedder failure falls back to lexical', async () => {
  await withTopics(async (dir) => {
    const broken = { model: 'x', async embed() { throw new Error('boom'); } };
    const idx = await buildIndex(dir, { embedder: broken });
    assert.equal(idx.semantic, 'lexical');
    assert.ok(!idx.nodes.some((n) => n.vec));
  });
});

test('reindexFile embeds the changed file', async () => {
  await withTopics(async (dir) => {
    const emb = fakeEmbedder();
    const idx = await buildIndex(dir, { embedder: emb });
    emb.seen.length = 0;
    fs.writeFileSync(path.join(dir, 'docs/three.md'), '# Three\n\ndelta delta only\n');
    await reindexFile(dir, idx, 'docs/three.md', { embedder: emb });
    assert.equal(idx.semantic, 'embeddings');
    assert.ok(emb.seen.length >= 1 && emb.seen.every((t) => t.includes('delta')));
  });
});

test('search uses embeddings when the index has them and an embedder is given', async () => {
  await withTopics(async (dir) => {
    const emb = fakeEmbedder();
    const idx = await buildIndex(dir, { embedder: emb });
    // "gamma" never appears in docs/one.md or two.md; TF-IDF cannot rank by anything but term match.
    const hits = await search(idx, 'gamma', { embedder: emb, limit: 3 });
    assert.equal(hits[0].node.id, 'docs/three.md');
    assert.equal(hits[0].node.vec, undefined);
    assert.equal(hits[0].node.tokens, undefined);
    const kinded = await search(idx, 'alpha', { embedder: emb, kinds: ['doc'] });
    assert.ok(kinded.every((h) => h.node.kind === 'doc'));
  });
});

test('search falls back to TF-IDF without an embedder or when embedding fails', async () => {
  await withTopics(async (dir) => {
    const idx = await buildIndex(dir, { embedder: fakeEmbedder() });
    const plain = await search(idx, 'zeppelin');
    assert.equal(plain[0].node.id, 'docs/guide.md');
    const broken = { model: 'fake-topics', async embed() { throw new Error('boom'); } };
    assert.equal((await search(idx, 'zeppelin', { embedder: broken }))[0].node.id, 'docs/guide.md');
  });
});
