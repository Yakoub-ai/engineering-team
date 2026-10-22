import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createServer } from '../lib/server.js';
import { copyFixture, cleanup } from './helpers.js';

async function withServer(fn) {
  const dir = copyFixture();
  fs.mkdirSync(path.join(dir, 'docs/engineering/product'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs/engineering/product/product.md'), '# Acme — Product\n\n## Purpose\nQuick approvals.\n\n## Use cases\n| ID | Actor |\n|---|---|\n| UC-1 | Staff |\n');
  process.env.ENG_TEAM_HOME = path.join(dir, 'no-home');
  const server = createServer({ projectDir: dir });
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
  const post = (url, obj, headers = { 'X-Eng-View': '1' }) => call('POST', url, { body: JSON.stringify(obj ?? {}), headers });
  try {
    await fn({ dir, call, post });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    server.closeAllConnections?.();
    cleanup(dir);
  }
}

test('present: status, build, serve with strict CSP, and "used in" sources', async () => {
  await withServer(async ({ call, post }) => {
    const before = (await call('GET', '/api/present')).json;
    assert.equal(before.outputs.find((o) => o.name === 'deck').exists, false);
    assert.ok(before.presets.includes('midnight'));
    assert.equal((await call('GET', '/present/deck.html')).status, 404);

    const built = await post('/api/present/build', { only: ['cheatsheet', 'overview'] });
    assert.equal(built.status, 200);
    assert.deepEqual(built.json.results.map((r) => r.status), ['built', 'built']);

    const after = (await call('GET', '/api/present')).json;
    const cheat = after.outputs.find((o) => o.name === 'cheatsheet');
    assert.equal(cheat.exists, true);
    assert.ok(cheat.sources.includes('docs/engineering/product/product.md'));
    assert.deepEqual(after.outputs.find((o) => o.name === 'overview').sources, []);

    const page = await call('GET', '/present/cheatsheet.html');
    assert.equal(page.status, 200);
    assert.match(page.headers['content-security-policy'], /default-src 'none'.*frame-ancestors 'self'/);
    assert.doesNotMatch(page.text, /<script/i);
    assert.match((await call('GET', '/present/docs-overview.html')).text, /Docs|Documents|Document/);
    assert.equal((await call('GET', '/present/..%2f..%2fREADME.md')).status, 404);
    assert.equal((await call('GET', '/present/other.html')).status, 404);
  });
});

test('present: writes need the header, a valid body and known names', async () => {
  await withServer(async ({ post, call, dir }) => {
    assert.equal((await post('/api/present/build', {}, {})).status, 403);
    assert.equal((await post('/api/present/build', { only: ['nope'] })).status, 400);
    assert.equal((await post('/api/present/build', { only: [] })).status, 400);
    assert.equal((await post('/api/present/theme', { preset: '../x' }, {})).status, 403);
    assert.equal((await post('/api/present/theme', { preset: '../x' })).status, 422);
    assert.equal((await post('/api/present/theme', { preset: 'midnight' })).json.theme.name, 'midnight');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, '.eng-team/theme.json'), 'utf8')), { preset: 'midnight' });
    assert.equal((await call('GET', '/api/present')).json.theme.source, 'project');
    assert.equal((await call('PUT', '/api/present/build')).status, 405);
  });
});

test('needs: groups come from the product doc and flag empty ones', async () => {
  await withServer(async ({ call }) => {
    const { groups } = (await call('GET', '/api/needs')).json;
    const uc = groups.find((g) => g.title === 'Use cases');
    assert.match(uc.html, /UC-1/);
    assert.equal(uc.path, 'docs/engineering/product/product.md');
    assert.equal(groups.find((g) => g.title === 'Non-goals').html, '');
  });
});
