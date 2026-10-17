import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFixture, cleanup } from './helpers.js';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'eng-view.js');

/** Spawn the MCP server, send raw lines, resolve with the parsed reply lines. */
function converse(dir, lines, expected) {
  const child = spawn('node', [BIN, 'mcp', '--project', dir], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.resume();
  return new Promise((resolve, reject) => {
    const replies = [];
    let buf = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout')); }, 20000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        replies.push(JSON.parse(buf.slice(0, nl)));
        buf = buf.slice(nl + 1);
      }
      if (replies.length >= expected) {
        clearTimeout(timer);
        child.kill();
        resolve(replies);
      }
    });
    child.stdin.write(lines.map((l) => `${typeof l === 'string' ? l : JSON.stringify(l)}\n`).join(''));
  });
}

const msg = (id, method, params) => ({ jsonrpc: '2.0', id, method, params });

test('initialize and tools/list leave the project untouched', async () => {
  const dir = copyFixture();
  try {
    fs.rmSync(path.join(dir, '.eng-team'), { recursive: true, force: true });
    await converse(dir, [msg(1, 'initialize', {}), msg(2, 'tools/list')], 2);
    assert.equal(fs.existsSync(path.join(dir, '.eng-team')), false);
  } finally {
    cleanup(dir);
  }
});

test('malformed JSON and non-object messages get errors and the server keeps going', async () => {
  const dir = copyFixture();
  try {
    const r = await converse(dir, ['{not json', '5', '[]', msg(9, 'ping')], 4);
    assert.equal(r[0].error.code, -32700);
    assert.equal(r[1].error.code, -32600);
    assert.equal(r[2].error.code, -32600);
    assert.deepEqual(r[3].result, {});
  } finally {
    cleanup(dir);
  }
});

test('changed_since maps git changes to nodes', async () => {
  const dir = copyFixture();
  try {
    const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, stdio: 'pipe' });
    git('init', '-q');
    git('add', '-A');
    git('commit', '-q', '-m', 'one');
    fs.appendFileSync(path.join(dir, 'docs/guide.md'), '\nmore\n');
    git('commit', '-q', '-am', 'two');
    const [res] = await converse(dir, [msg(1, 'tools/call', { name: 'changed_since', arguments: { commit: 'HEAD~1' } })], 1);
    assert.notEqual(res.result.isError, true);
    const { changes } = JSON.parse(res.result.content[0].text);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].status, 'M');
    assert.equal(changes[0].path, 'docs/guide.md');
    assert.ok(changes[0].nodes.some((n) => n.id === 'docs/guide.md'));
  } finally {
    cleanup(dir);
  }
});
