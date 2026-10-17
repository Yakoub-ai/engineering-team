import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyFixture, cleanup } from './helpers.js';
import { resolveProjectDir, setupEmbedder, loadTransformers, depsDir, resolveInstalled } from '../lib/runtime.js';
import { createEmbedder } from '../lib/embed.js';

test('resolveProjectDir prefers flag, then CLAUDE_PROJECT_DIR, then cwd', () => {
  assert.equal(resolveProjectDir('/a', { CLAUDE_PROJECT_DIR: '/b' }), '/a');
  assert.equal(resolveProjectDir(undefined, { CLAUDE_PROJECT_DIR: '/b' }), '/b');
  assert.equal(resolveProjectDir(undefined, {}), process.cwd());
});

test('setupEmbedder returns null when disabled', async () => {
  assert.equal(await setupEmbedder('/nonexistent', { semantic: false }), null);
});

test('setupEmbedder refuses a symlinked models cache and logs to stderr', async () => {
  const dir = copyFixture();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'eng-view-out-'));
  const cache = path.join(dir, '.eng-team', '.cache');
  fs.mkdirSync(cache, { recursive: true });
  fs.symlinkSync(outside, path.join(cache, 'models'));
  const logged = [];
  const orig = process.stderr.write;
  process.stderr.write = (chunk) => { logged.push(String(chunk)); return true; };
  try {
    assert.equal(await setupEmbedder(dir, { probe: async () => {} }), null);
  } finally {
    process.stderr.write = orig;
    cleanup(dir);
    cleanup(outside);
  }
  assert.ok(logged.some((l) => l.includes('unsafe')));
});

test('setupEmbedder with cachedOnly returns null and creates nothing when no model is cached', async () => {
  const dir = copyFixture();
  try {
    assert.equal(await setupEmbedder(dir, { cachedOnly: true, probe: async () => {} }), null);
    assert.equal(fs.existsSync(path.join(dir, '.eng-team', '.cache', 'models')), false);
  } finally {
    cleanup(dir);
  }
});

test('depsDir prefers ENG_VIEW_DEPS_DIR, then CLAUDE_PLUGIN_DATA/viewer-deps, else null', () => {
  assert.equal(depsDir({ ENG_VIEW_DEPS_DIR: '/x/y', CLAUDE_PLUGIN_DATA: '/d' }), '/x/y');
  assert.equal(depsDir({ CLAUDE_PLUGIN_DATA: '/d' }), path.join('/d', 'viewer-deps'));
  assert.equal(depsDir({}), null);
});

function fakeInstall(exportsField) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-deps-'));
  const pkg = path.join(dir, 'node_modules', '@huggingface', 'transformers');
  fs.mkdirSync(path.join(pkg, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@huggingface/transformers', type: 'module', exports: exportsField }));
  fs.writeFileSync(path.join(pkg, 'dist', 'x.mjs'), 'export const marker = "from-deps-dir";\n');
  return dir;
}

test('loadTransformers imports from the deps dir first and falls back otherwise', async () => {
  const dir = fakeInstall({ node: { import: { default: './dist/x.mjs' } } });
  try {
    assert.equal(path.basename(resolveInstalled(dir)), 'x.mjs');
    const fallback = async () => ({ marker: 'fallback' });
    assert.equal((await loadTransformers({ dir, fallback })).marker, 'from-deps-dir');
    assert.equal((await loadTransformers({ dir: path.join(dir, 'nope'), fallback })).marker, 'fallback');
    assert.equal((await loadTransformers({ dir: null, fallback })).marker, 'fallback');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveInstalled rejects an entry that escapes the package directory', () => {
  const dir = fakeInstall({ node: { import: { default: '../../../../outside.mjs' } } });
  try {
    assert.equal(resolveInstalled(dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('createEmbedder returns null when the injected loader rejects', async () => {
  assert.equal(await createEmbedder({ load: async () => { throw new Error('missing'); } }), null);
});
