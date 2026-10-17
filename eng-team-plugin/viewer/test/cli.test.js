import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFixture, cleanup } from './helpers.js';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'eng-view.js');

test('index prints counts and writes the index file', () => {
  const dir = copyFixture();
  try {
    const r = spawnSync('node', [BIN, 'index', '--project', dir, '--no-semantic'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /eng-view: indexed \d+ nodes, \d+ edges \(lexical\)/);
    assert.ok(fs.existsSync(path.join(dir, '.eng-team', '.cache', 'index', 'index.json')));
  } finally {
    cleanup(dir);
  }
});

test('unknown command exits non-zero with usage', () => {
  const r = spawnSync('node', [BIN, 'bogus'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /usage/i);
});

test('serve prints its URL and answers /api/graph', async () => {
  const dir = copyFixture();
  const child = spawn('node', [BIN, 'serve', '--project', dir, '--port', '0', '--no-semantic'], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('serve did not print a URL')), 15000);
      let out = '';
      child.stdout.on('data', (d) => {
        out += d;
        const m = /eng-view: (http:\/\/127\.0\.0\.1:\d+)/.exec(out);
        if (m) {
          clearTimeout(timer);
          resolve(m[1]);
        }
      });
    });
    const res = await fetch(`${url}/api/graph`);
    assert.equal(res.status, 200);
    assert.ok((await res.json()).nodes.length > 0);
  } finally {
    child.kill();
    cleanup(dir);
  }
});
