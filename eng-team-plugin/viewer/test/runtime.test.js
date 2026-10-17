import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyFixture, cleanup } from './helpers.js';
import { resolveProjectDir, setupEmbedder } from '../lib/runtime.js';

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
