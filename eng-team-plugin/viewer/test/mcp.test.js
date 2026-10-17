import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFixture, cleanup } from './helpers.js';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'eng-view.js');
let dir;
let child;
let buf = '';
let nextId = 1;
const pending = new Map();
const stray = [];

function onData(chunk) {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl);
    buf = buf.slice(nl + 1);
    if (!line.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      stray.push(line);
      continue;
    }
    pending.get(msg.id)?.(msg);
  }
}

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 15000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}

before(() => {
  dir = copyFixture();
  child = spawn('node', [BIN, 'mcp', '--project', dir, '--no-semantic'], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', onData);
  child.stderr.resume();
});

after(() => {
  child.kill();
  cleanup(dir);
});

test('initialize returns protocol version and server name', async () => {
  const res = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
  assert.equal(res.result.protocolVersion, '2025-06-18');
  assert.equal(res.result.serverInfo.name, 'eng-team-context');
  assert.ok(res.result.capabilities.tools);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
});

test('ping answers with an empty result', async () => {
  assert.deepEqual((await rpc('ping')).result, {});
});

test('tools/list exposes the four tools with schemas', async () => {
  const { tools } = (await rpc('tools/list')).result;
  assert.deepEqual(tools.map((t) => t.name).sort(), ['changed_since', 'get_doc', 'get_related', 'search_context']);
  for (const t of tools) assert.equal(t.inputSchema.type, 'object');
});

test('search_context finds a fixture doc', async () => {
  const res = await rpc('tools/call', { name: 'search_context', arguments: { query: 'sqlite database decision' } });
  assert.notEqual(res.result.isError, true);
  assert.ok(res.result.content[0].text.includes('docs/engineering/decisions/0001-use-sqlite.md'));
});

test('get_related returns related items for a path', async () => {
  const res = await rpc('tools/call', { name: 'get_related', arguments: { id_or_path: 'docs/engineering/decisions/0001-use-sqlite.md' } });
  assert.notEqual(res.result.isError, true);
  assert.ok(JSON.parse(res.result.content[0].text).related.length > 0);
});

test('get_related on an unknown id is a tool error', async () => {
  const res = await rpc('tools/call', { name: 'get_related', arguments: { id_or_path: 'nope/missing.md' } });
  assert.equal(res.result.isError, true);
});

test('get_doc returns a doc', async () => {
  const res = await rpc('tools/call', { name: 'get_doc', arguments: { path: 'docs/engineering/decisions/0001-use-sqlite.md' } });
  assert.notEqual(res.result.isError, true);
  assert.ok(res.result.content[0].text.length > 10);
});

test('get_doc refuses .env, traversal and missing files', async () => {
  for (const p of ['.env', '../etc/passwd', '/etc/passwd', 'docs/nope.md']) {
    const res = await rpc('tools/call', { name: 'get_doc', arguments: { path: p } });
    assert.equal(res.result.isError, true, p);
  }
});

test('changed_since reports an error text outside a git repo', async () => {
  const res = await rpc('tools/call', { name: 'changed_since', arguments: { commit: 'HEAD~1' } });
  assert.equal(res.result.isError, true);
  assert.equal(res.result.content[0].text, 'not a git repository');
  const bad = await rpc('tools/call', { name: 'changed_since', arguments: { commit: '--output=x' } });
  assert.equal(bad.result.isError, true);
});

test('unknown tool is a tool error; unknown method is -32601', async () => {
  const t = await rpc('tools/call', { name: 'nope', arguments: {} });
  assert.equal(t.result.isError, true);
  const m = await rpc('no/such/method');
  assert.equal(m.error.code, -32601);
});

test('stdout carried only JSON-RPC messages', () => {
  assert.deepEqual(stray, []);
});

/** Run the MCP server on a project, send one search_context call per entry, return when all answered. */
async function mcpSession(project, calls = 1) {
  const proc = spawn('node', [BIN, 'mcp', '--project', project, '--no-semantic'], { stdio: ['pipe', 'pipe', 'pipe'] });
  proc.stderr.resume();
  proc.stdout.setEncoding('utf8');
  const replies = [];
  let acc = '';
  const done = new Promise((resolve) => {
    proc.stdout.on('data', (chunk) => {
      acc += chunk;
      replies.length = 0;
      for (const l of acc.split('\n')) if (l.trim()) replies.push(JSON.parse(l));
      if (replies.length >= calls) resolve();
    });
  });
  const step = async (i) => {
    const msg = { jsonrpc: '2.0', id: i, method: 'tools/call', params: { name: 'search_context', arguments: { query: 'guide' } } };
    proc.stdin.write(`${JSON.stringify(msg)}\n`);
  };
  return { proc, step, done };
}

test('mcp does not create .eng-team in an unmanaged project', async () => {
  const project = copyFixture();
  fs.rmSync(path.join(project, '.eng-team'), { recursive: true, force: true });
  const s = await mcpSession(project, 1);
  try {
    await s.step(1);
    await s.done;
    assert.equal(fs.existsSync(path.join(project, '.eng-team')), false);
  } finally {
    s.proc.kill();
    cleanup(project);
  }
});

test('mcp saves the index once into an existing .eng-team and does not rewrite it when unchanged', async () => {
  const project = copyFixture();
  fs.mkdirSync(path.join(project, '.eng-team'), { recursive: true });
  const file = path.join(project, '.eng-team', '.cache', 'index', 'index.json');
  const s = await mcpSession(project, 2);
  try {
    await s.step(1);
    await new Promise((r) => setTimeout(r, 2300));
    assert.ok(fs.existsSync(file), 'index saved');
    const first = fs.statSync(file).mtimeMs;
    await s.step(2);
    await s.done;
    assert.equal(fs.statSync(file).mtimeMs, first);
  } finally {
    s.proc.kill();
    cleanup(project);
  }
});
