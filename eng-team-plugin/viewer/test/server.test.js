import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { createServer, start } from '../lib/server.js';
import { copyFixture, cleanup } from './helpers.js';

/** Start a server on an ephemeral port, run fn(ctx), always clean up. */
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

async function withServer(fn, { embedder = null, setup, uiDir } = {}) {
  const dir = copyFixture();
  if (setup) setup(dir);
  const server = createServer({ projectDir: dir, embedder, uiDir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const call = (method, url, { body, headers = {} } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: url, headers: { Host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { /* not json */ }
        resolve({ status: res.statusCode, headers: res.headers, text: data, json });
      });
    });
    req.on('error', reject);
    req.end(body);
  });
  const put = (rel, markdown, headers = { 'X-Eng-View': '1' }) =>
    call('PUT', `/api/doc?path=${encodeURIComponent(rel)}`, { body: JSON.stringify({ markdown }), headers });
  try {
    await fn({ dir, port, call, put });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    server.closeAllConnections?.();
    cleanup(dir);
  }
}

test('GET /api/graph returns project, nodes and edges without tokens', () => withServer(async ({ call, dir }) => {
  const res = await call('GET', '/api/graph');
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.match(res.headers['content-type'], /application\/json/);
  assert.equal(res.json.project, fs.realpathSync(dir));
  assert.ok(res.json.nodes.some((n) => n.id === 'docs/guide.md'));
  assert.ok(res.json.edges.length > 0);
  assert.ok(!res.text.includes('"tokens"'));
  assert.ok(!res.text.includes('"vec"'));
}));

test('GET /api/node returns node with outgoing and incoming edges', () => withServer(async ({ call }) => {
  const res = await call('GET', '/api/node?id=src%2Fb.js');
  assert.equal(res.status, 200);
  assert.equal(res.json.node.id, 'src/b.js');
  assert.ok(res.json.incoming.some((e) => e.from === 'src/a.js' && e.type === 'imports'));
  assert.ok(Array.isArray(res.json.outgoing));
  assert.equal((await call('GET', '/api/node?id=nope')).status, 404);
}));

test('GET /api/doc: editable for docs, not for .eng-team/state.md', () => withServer(async ({ call }) => {
  const doc = await call('GET', '/api/doc?path=docs/guide.md');
  assert.equal(doc.status, 200);
  assert.equal(doc.json.path, 'docs/guide.md');
  assert.equal(doc.json.editable, true);
  assert.match(doc.json.markdown, /zeppelin/);
  assert.match(doc.json.html, /<h1>Guide<\/h1>/);
  assert.match(doc.json.html, /data-path="src\/a\.js"|<code>src\/a\.js:3<\/code>/);
  const state = await call('GET', '/api/doc?path=.eng-team/state.md');
  assert.equal(state.status, 200);
  assert.equal(state.json.editable, false);
}));

test('PUT /api/doc writes the file and re-indexes it so search finds the new word', () => withServer(async ({ call, put, dir }) => {
  const res = await put('docs/guide.md', '# Guide\n\nAbout the quokkaword.\n');
  assert.equal(res.status, 200);
  assert.equal(res.json.editable, true);
  assert.equal(fs.readFileSync(path.join(dir, 'docs/guide.md'), 'utf8'), '# Guide\n\nAbout the quokkaword.\n');
  const found = await call('GET', '/api/search?q=quokkaword&limit=3');
  assert.equal(found.status, 200);
  assert.equal(found.json.results[0].node.id, 'docs/guide.md');
  const again = await call('GET', '/api/doc?path=docs/guide.md');
  assert.match(again.json.markdown, /quokkaword/);
}));

test('PUT to code, state.md, outside the project, or non-markdown is 403 and writes nothing', () => withServer(async ({ put, dir }) => {
  const before = fs.readFileSync(path.join(dir, 'src/a.js'), 'utf8');
  for (const rel of ['src/a.js', '.eng-team/state.md', '../outside.md', 'docs/../src/a.js', '/etc/hosts', 'docs/guide.txt', 'README.md']) {
    const res = await put(rel, 'pwned');
    assert.equal(res.status, 403, rel);
  }
  assert.equal(fs.readFileSync(path.join(dir, 'src/a.js'), 'utf8'), before);
  assert.ok(!fs.existsSync(path.join(path.dirname(dir), 'outside.md')));
  assert.match(fs.readFileSync(path.join(dir, '.eng-team/state.md'), 'utf8'), /phase: build/);
}));

test('PUT allows .eng-team/*.md other than state.md', () => withServer(async ({ put, dir }) => {
  const res = await put('.eng-team/notes.md', 'x');
  assert.equal(res.status, 404, 'files must already exist');
  fs.writeFileSync(path.join(dir, '.eng-team/notes.md'), 'old');
  assert.equal((await put('.eng-team/notes.md', 'new')).status, 200);
  assert.equal(fs.readFileSync(path.join(dir, '.eng-team/notes.md'), 'utf8'), 'new');
}));

test('PUT validates the body', () => withServer(async ({ call }) => {
  const h = { 'X-Eng-View': '1' };
  assert.equal((await call('PUT', '/api/doc?path=docs/guide.md', { body: 'not json', headers: h })).status, 400);
  assert.equal((await call('PUT', '/api/doc?path=docs/guide.md', { body: '{"markdown":5}', headers: h })).status, 400);
  const big = JSON.stringify({ markdown: 'x'.repeat(2 * 1024 * 1024) });
  assert.equal((await call('PUT', '/api/doc?path=docs/guide.md', { body: big, headers: h })).status, 413);
}));

test('symlinks inside docs/ cannot be read or written through', () => withServer(async ({ call, put, dir }) => {
  const secret = path.join(os.tmpdir(), `eng-view-secret-${process.pid}.md`);
  fs.writeFileSync(secret, 'top secret');
  try {
    fs.symlinkSync(secret, path.join(dir, 'docs/link.md'));
    fs.symlinkSync(path.join(dir, 'src/a.js'), path.join(dir, 'docs/codelink.md'));
    fs.symlinkSync(os.tmpdir(), path.join(dir, 'docs/dirlink'));
    assert.equal((await put('docs/link.md', 'pwned')).status, 403);
    assert.equal((await put('docs/codelink.md', 'pwned')).status, 403);
    assert.equal((await put('docs/dirlink/new.md', 'pwned')).status, 403);
    assert.equal((await call('GET', '/api/doc?path=docs/link.md')).status, 404);
    assert.equal(fs.readFileSync(secret, 'utf8'), 'top secret');
    assert.match(fs.readFileSync(path.join(dir, 'src/a.js'), 'utf8'), /export function a/);
  } finally {
    fs.rmSync(secret, { force: true });
  }
}));

test('wrong Host is 403 on every route', () => withServer(async ({ call, port }) => {
  for (const host of ['evil.example.com', `evil.example.com:${port}`, '127.0.0.1', `127.0.0.1:${port + 1}`, `localhost.evil.com:${port}`]) {
    assert.equal((await call('GET', '/api/graph', { headers: { Host: host } })).status, 403, host);
  }
  assert.equal((await call('GET', '/', { headers: { Host: 'evil.example.com' } })).status, 403);
  assert.equal((await call('GET', '/api/graph', { headers: { Host: `localhost:${port}` } })).status, 200);
}));

test('PUT without the X-Eng-View header is 403', () => withServer(async ({ put, dir }) => {
  const res = await put('docs/guide.md', 'x', {});
  assert.equal(res.status, 403);
  assert.match(fs.readFileSync(path.join(dir, 'docs/guide.md'), 'utf8'), /zeppelin/);
  assert.equal((await put('docs/guide.md', 'x', { 'X-Eng-View': '0' })).status, 403);
}));

test('GET /api/code: code text with language; B8 exclusions are 404', () => withServer(async ({ call }) => {
  const ok = await call('GET', '/api/code?path=src/a.js');
  assert.equal(ok.status, 200);
  assert.equal(ok.json.language, 'javascript');
  assert.match(ok.json.text, /export function a/);
  for (const rel of ['.env', 'node_modules/x/index.js', 'ignored/file.md', 'nope.js', 'docs/guide.md']) {
    assert.equal((await call('GET', `/api/code?path=${encodeURIComponent(rel)}`)).status, 404, rel);
  }
  assert.equal((await call('GET', '/api/code?path=../outside.js')).status, 403);
  assert.equal((await call('GET', '/api/doc?path=.env')).status, 404);
  assert.equal((await call('GET', '/api/doc?path=ignored/file.md')).status, 404);
  assert.equal((await call('GET', '/api/doc?path=src/a.js')).status, 404);
}));

test('GET /api/timeline lists handovers in order', () => withServer(async ({ call }) => {
  const res = await call('GET', '/api/timeline');
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.handovers.map((n) => n.id), ['docs/engineering/handovers/0001-lead.md']);
}));

test('GET /api/search validates input', () => withServer(async ({ call }) => {
  assert.equal((await call('GET', '/api/search?q=zeppelin')).json.results[0].node.id, 'docs/guide.md');
  assert.deepEqual((await call('GET', '/api/search')).json.results, []);
}));

test('unknown routes 404 and unsupported methods 405', () => withServer(async ({ call }) => {
  assert.equal((await call('GET', '/api/nope')).status, 404);
  assert.equal((await call('POST', '/api/graph', { headers: { 'X-Eng-View': '1' } })).status, 405);
  assert.equal((await call('DELETE', '/api/doc?path=docs/guide.md', { headers: { 'X-Eng-View': '1' } })).status, 405);
}));

test('static UI: / and /ui/* are served from uiDir, missing is 404, traversal is blocked', async () => {
  const uiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eng-ui-'));
  fs.writeFileSync(path.join(uiDir, 'zz-test.js'), 'console.log(1)');
  fs.writeFileSync(path.join(uiDir, 'index.html'), '<!doctype html><title>t</title>');
  try {
    await withServer(async ({ call }) => {
      const js = await call('GET', '/ui/zz-test.js');
      assert.equal(js.status, 200);
      assert.match(js.headers['content-type'], /javascript/);
      assert.equal(js.headers['cache-control'], 'no-store');
      assert.equal((await call('GET', '/')).status, 200);
      assert.equal((await call('GET', '/ui/missing.js')).status, 404);
      assert.equal((await call('GET', '/ui/../package.json')).status, 404);
      assert.equal((await call('GET', '/ui/%2e%2e/package.json')).status, 404);
      assert.equal((await call('GET', '/ui/..%2fpackage.json')).status, 404);
    }, { uiDir });
  } finally {
    fs.rmSync(uiDir, { recursive: true, force: true });
  }
});

test('every response carries CSP, nosniff and no-referrer headers', () => withServer(async ({ call }) => {
  for (const url of ['/api/graph', '/api/nope', '/ui/missing.js']) {
    const res = await call('GET', url);
    assert.equal(res.headers['content-security-policy'], CSP, url);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['referrer-policy'], 'no-referrer');
  }
  const bad = await call('GET', '/api/graph', { headers: { Host: 'evil.test' } });
  assert.equal(bad.status, 403);
  assert.equal(bad.headers['content-security-policy'], CSP);
}));

test('a failing initial index build makes /api/* return 503 without an unhandled rejection', async () => {
  const rejections = [];
  const onRejection = (err) => rejections.push(err);
  process.on('unhandledRejection', onRejection);
  const realError = console.error;
  console.error = () => {};
  try {
    await withServer(async ({ call }) => {
      const res = await call('GET', '/api/graph');
      assert.equal(res.status, 503);
      assert.equal(typeof res.json.error, 'string');
      assert.equal((await call('GET', '/api/search?q=x')).status, 503);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }, { embedder: { get model() { throw new Error('boom'); }, embed: async () => [] } });
  } finally {
    console.error = realError;
    process.off('unhandledRejection', onRejection);
  }
  assert.deepEqual(rejections, []);
});

test('an over-limit body that destroys the request settles instead of hanging', () => withServer(async ({ call }) => {
  const h = { 'X-Eng-View': '1' };
  const huge = JSON.stringify({ markdown: 'x'.repeat(20 * 1024 * 1024) });
  const outcome = await call('PUT', '/api/doc?path=docs/guide.md', { body: huge, headers: h }).catch((err) => ({ status: err.code }));
  assert.ok(outcome.status === 413 || typeof outcome.status === 'string', String(outcome.status));
  assert.equal((await call('GET', '/api/graph')).status, 200);
}));

test('start() listens on 127.0.0.1 and reports the port', async () => {
  const dir = copyFixture();
  const { server, port, url } = await start({ projectDir: dir, port: 0 });
  try {
    assert.equal(server.address().address, '127.0.0.1');
    assert.equal(url, `http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    cleanup(dir);
  }
});
