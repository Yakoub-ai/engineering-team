import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../lib/server.js';
import { copyFixture, cleanup } from './helpers.js';

const UI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui');

async function withServer(fn) {
  const dir = copyFixture();
  const server = createServer({ projectDir: dir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const get = (url) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: url, headers: { Host: `127.0.0.1:${port}` } }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }).on('error', reject);
  });
  try {
    await fn(get);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    server.closeAllConnections?.();
    cleanup(dir);
  }
}

test('server serves the real UI with correct content types', () => withServer(async (get) => {
  const page = await get('/');
  assert.equal(page.status, 200);
  assert.match(page.headers['content-type'], /text\/html/);
  assert.match(page.text, /<script src="\/ui\/app\.js"><\/script>/);
  const js = await get('/ui/app.js');
  assert.equal(js.status, 200);
  assert.match(js.headers['content-type'], /text\/javascript/);
  const css = await get('/ui/style.css');
  assert.equal(css.status, 200);
  assert.match(css.headers['content-type'], /text\/css/);
}));

test('UI makes no external requests', () => {
  for (const file of ['app.js', 'index.html', 'style.css']) {
    const text = fs.readFileSync(path.join(UI, file), 'utf8');
    const urls = text.match(/https?:\/\/[^\s"'`)]*/g) || [];
    assert.deepEqual(urls, [], `${file} references an external URL`);
    assert.doesNotMatch(text, /@import|url\(\s*['"]?\/\//, `${file} imports remote resources`);
  }
});

test('UI is CSP-clean: no inline scripts, handlers or style attributes in markup', () => {
  const html = fs.readFileSync(path.join(UI, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.doesNotMatch(html, /<style\b/i);
  assert.doesNotMatch(html, /\s(style|on[a-z]+)\s*=/i);
});

test('app.js only uses innerHTML for server-rendered markdown', () => {
  const js = fs.readFileSync(path.join(UI, 'app.js'), 'utf8');
  const uses = js.match(/\.innerHTML\s*=/g) || [];
  assert.equal(uses.length, 1);
  assert.match(js, /el\.innerHTML = html;/);
  assert.doesNotMatch(js, /insertAdjacentHTML|document\.write|eval\(/);
});
