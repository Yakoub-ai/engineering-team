import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { containsSecret } from '../lib/secrets.js';
import { buildIndex, updateIndex, search } from '../lib/index.js';
import { createMcp } from '../lib/mcp.js';
import { createServer } from '../lib/server.js';
import { copyFixture, cleanup } from './helpers.js';

// Fake credentials are assembled at runtime so no realistic token sits in the source.
const AWS = `AKIA${'ABCDEFGH12345678'}`;
const GH = `ghp_${'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6'}`;
const PEM = `-----BEGIN ${'RSA PRIVATE KEY'}-----\n${'MIIEowIBAAKCAQEA7vbqajDw4o6gJy8UtmIbkcpn'.repeat(2)}\n-----END RSA PRIVATE KEY-----`;
const GCP = JSON.stringify({ type: 'service_account', project_id: 'demo', private_key: 'fake-key-material', client_email: 'a@demo.iam' }, null, 2);

const rule = (text, opts) => containsSecret(text, opts)?.rule ?? null;

test('token rules detect high-confidence credentials', () => {
  const cases = [
    ['pem-private-key', PEM],
    ['pem-private-key', `-----BEGIN OPENSSH PRIVATE KEY-----\n${'b3BlbnNzaC1rZXktdjEAAAAABG5vbmU'.repeat(2)}`],
    ['gcp-service-account', GCP],
    ['aws-access-key', `const k = "${AWS}";`],
    ['aws-access-key', `id=ASIA${'ZYXWVUTS12345678'}`],
    ['github-token', `token ${GH}`],
    ['github-token', `github_pat_${'11ABCDEFG0abcdefghij'}_${'k3j2h1g0f9e8d7c6b5a4'}`],
    ['slack-token', `xoxb-${'123456789012'}-${'abcdefghijkl'}`],
    ['stripe-key', `sk_${'live'}_${'4eC39HqLyjWDarjtT1zdp7dc'}`],
    ['stripe-key', `rk_${'live'}_${'4eC39HqLyjWDarjtT1zdp7dc'}`],
    ['google-api-key', `AIza${'SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q'}`],
    ['anthropic-key', `sk-ant-${'api03-abcdEFGH1234ijklMNOP5678'}`],
    ['openai-key', `sk-${'proj-abcdEFGH1234ijklMNOP5678qrst'}`],
    ['openai-key', `sk-${'abcdEFGH1234ijklMNOP5678qrstUVWX'}`],
  ];
  for (const [expected, text] of cases) assert.equal(rule(text), expected, text.slice(0, 40));
});

test('token rules ignore placeholders and mentions', () => {
  const negatives = [
    'AWS key AKIAIOSFODNN7EXAMPLE is the documented sample',
    `AKIA${'X'.repeat(16)}`,
    'use ghp_ tokens for CI',
    `ghp_${'x'.repeat(36)}`,
    'sk-ant-... goes here',
    'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx',
    'class="sk-some-long-css-class-name-here"',
    'task-description-for-something-quite-long',
    '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
    'Generate a key with `openssl genrsa`; it starts with -----BEGIN RSA PRIVATE KEY-----',
    '{"type": "service_account"} without any key material',
    'xoxb-token',
    'AIza-short',
  ];
  for (const text of negatives) assert.equal(rule(text), null, text);
});

test('generic rule flags literal assignments', () => {
  const positives = [
    'password = "hunter2hunter2"',
    "DB_PASSWORD: 'p4ssw0rd-long'",
    'POSTGRES_PASSWORD: s3cretvalue99',
    'api_key = "k8Jd92hsLq0x"',
    'const apiKey = "k8Jd92hsLq0x";',
    '"client_secret": "abcd1234efgh5678"',
    'token=a1b2c3d4e5f6',
    'private_key: "base64material0"',
  ];
  for (const text of positives) assert.equal(rule(text), 'generic-secret-assignment', text);
});

test('generic rule skips placeholders, references and short values', () => {
  const negatives = [
    'password = "${DB_PASSWORD}"',
    'password: $(cat /run/secrets/pw)',
    'password = process.env.DB_PASSWORD_VALUE',
    'password = os.environ["DB_PASSWORD"]',
    'api_key = "<your api key here>"',
    'secret: "{{ vault.secret }}"',
    'password: "example-password-1"',
    'password: "changeme123"',
    'token: "xxxxxxxxxxxx"',
    'token: "************"',
    'api_key = "your_api_key_1"',
    'password: "dummy-pass-1"',
    'password: "test-password-1"',
    'password: "placeholder1"',
    'secret: "REDACTED-value1"',
    'password = "short"',
    'password: requiredString',
    'token: 123456789012',
    'password: "has some spaces 123"',
    'const token = getTokenFromRequest(req)',
    'The password: is stored in the vault',
  ];
  for (const text of negatives) assert.equal(rule(text), null, text);
});

test('generic rule can be disabled for docs', () => {
  assert.equal(rule('password: "hunter2hunter2"', { generic: false }), null);
  assert.equal(rule(`key ${AWS}`, { generic: false }), 'aws-access-key');
});

test('only the first 512 KB is scanned and pathological input is fast', () => {
  assert.equal(rule(`${'a'.repeat(512 * 1024)}\n${AWS}`), null);
  const start = Date.now();
  containsSecret(`password${'-'.repeat(200000)}`);
  containsSecret(`${'password '.repeat(30000)}`);
  containsSecret(`-----BEGIN PRIVATE KEY-----${' '.repeat(200000)}`);
  assert.ok(Date.now() - start < 3000);
});

/* ---------- integration ---------- */

function plant(dir) {
  fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'config', 'gcp-sa.json'), GCP);
  fs.writeFileSync(path.join(dir, 'src-config.js'), `export const aws = "${AWS}"; // zebracorn\n`);
  fs.writeFileSync(path.join(dir, 'docs', 'notes-secret.md'), `# Notes\n\nzebracorn token ${GH}\n`);
  fs.writeFileSync(path.join(dir, 'docs', 'howto.md'), '# Howto\n\nzebracorn: set `password: "hunter2hunter2"` in your env.\n');
}

const SECRET_FILES = ['config/gcp-sa.json', 'src-config.js', 'docs/notes-secret.md'];

async function withProject(fn) {
  const dir = copyFixture();
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  plant(dir);
  try {
    await fn(dir);
  } finally {
    cleanup(dir);
  }
}

test('files with secret content are not indexed or searchable', async () => {
  await withProject(async (dir) => {
    const index = await buildIndex(dir);
    const paths = new Set(index.nodes.map((n) => n.path));
    for (const f of SECRET_FILES) assert.ok(!paths.has(f), f);
    assert.ok(paths.has('docs/howto.md'), 'mention-only doc stays indexed');
    const hits = await search(index, 'zebracorn', { limit: 50 });
    assert.deepEqual(hits.map((h) => h.node.path), ['docs/howto.md']);
    assert.ok(!JSON.stringify(index).includes(AWS));
    assert.ok(!JSON.stringify(index).includes('fake-key-material'));
  });
});

test('excluded files are never embedded and logged once without the value', async () => {
  await withProject(async (dir) => {
    const embedded = [];
    const logged = `config/log-${process.pid}-${Date.now()}.json`; // fresh path: the log is once per process
    fs.writeFileSync(path.join(dir, logged), GCP);
    const embedder = { model: 'm', embed: async (texts) => { embedded.push(...texts); return texts.map(() => [1, 0]); } };
    const lines = [];
    const orig = process.stderr.write;
    process.stderr.write = (chunk) => { lines.push(String(chunk)); return true; };
    try {
      let index = await buildIndex(dir, { embedder });
      index = await updateIndex(dir, { embedder, previous: index, persist: false });
      await updateIndex(dir, { embedder, previous: index, persist: false });
    } finally {
      process.stderr.write = orig;
    }
    assert.ok(!embedded.some((t) => t.includes(AWS) || t.includes('fake-key-material')));
    const excluded = lines.filter((l) => l.includes('excluded'));
    assert.equal(excluded.filter((l) => l.includes(logged)).length, 1);
    assert.ok(excluded.includes(`eng-team-viewer: excluded ${logged} (possible secret: gcp-service-account)\n`));
    assert.ok(!lines.join('').includes(AWS));
  });
});

test('MCP get_doc refuses secret files, including ones that gained a secret after indexing', async () => {
  await withProject(async (dir) => {
    const mcp = createMcp({ projectDir: dir });
    const call = (name, args) => mcp.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
    for (const f of SECRET_FILES) {
      const res = (await call('get_doc', { path: f })).result;
      assert.equal(res.isError, true, f);
      assert.equal(res.content[0].text, 'not found');
    }
    const search1 = (await call('search_context', { query: 'zebracorn' })).result.content[0].text;
    assert.ok(!search1.includes('src-config.js'));
    // Indexed first, secret added later.
    const ok = (await call('get_doc', { path: 'docs/howto.md' })).result;
    assert.ok(!ok.isError);
    fs.writeFileSync(path.join(dir, 'docs', 'howto.md'), `# Howto\n\n${GH}\n`);
    const gone = (await call('get_doc', { path: 'docs/howto.md' })).result;
    assert.equal(gone.isError, true);
  });
});

test('HTTP /api/doc and /api/code refuse secret files', async () => {
  await withProject(async (dir) => {
    const server = createServer({ projectDir: dir });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const get = (url) => new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: url, headers: { Host: `127.0.0.1:${port}` } }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, text: data }));
      }).on('error', reject);
    });
    try {
      for (const f of ['config/gcp-sa.json', 'src-config.js']) {
        const r = await get(`/api/code?path=${encodeURIComponent(f)}`);
        assert.equal(r.status, 404, f);
        assert.ok(!r.text.includes('fake-key-material') && !r.text.includes(AWS));
      }
      assert.equal((await get('/api/doc?path=docs/notes-secret.md')).status, 404);
      assert.equal((await get('/api/doc?path=docs/howto.md')).status, 200);
      const graph = JSON.parse((await get('/api/graph')).text);
      assert.ok(!graph.nodes.some((n) => SECRET_FILES.includes(n.path)));
    } finally {
      await new Promise((resolve) => server.close(resolve));
      server.closeAllConnections?.();
    }
  });
});
