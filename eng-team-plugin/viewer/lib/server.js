import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateIndex, buildIndex, reindexFile, saveIndex, search } from './index.js';
import { classify, readIndexable } from './scan.js';
import { renderMarkdown } from './markdown.js';
import { cleanRel, isEditablePath, resolveNoSymlink, isIndexedFile } from './project-files.js';
import { OUTPUTS, buildOutputs, presentStatus, setTheme, needsGroups } from './present.js';

const DEFAULT_UI_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui');
const MAX_BODY = 1024 * 1024;
const DEFAULT_PORT = 4777;
const HOST = '127.0.0.1';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const PRESENT_FILES = new Set(Object.values(OUTPUTS).map((o) => o.file));
const LANGUAGES = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  py: 'python', rb: 'ruby', rs: 'rust', sh: 'bash', yml: 'yaml', kt: 'kotlin', cs: 'csharp', tf: 'hcl',
};

/** Error carrying an HTTP status. */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ---------- responses ---------- */

const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; "
  + "frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
const BASE_HEADERS = {
  'Content-Security-Policy': CSP,
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function send(res, status, body, type) {
  res.writeHead(status, { ...BASE_HEADERS, 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), 'application/json; charset=utf-8');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY * 16) req.destroy();
      else if (size <= MAX_BODY) chunks.push(chunk);
    });
    req.on('end', () => (size > MAX_BODY ? reject(new HttpError(413, 'body too large')) : resolve(Buffer.concat(chunks).toString('utf8'))));
    req.on('error', reject);
    // A destroyed request never emits 'end'; settle so the handler can answer.
    req.on('close', () => reject(new HttpError(413, 'body too large')));
  });
}

/* ---------- node helpers ---------- */

function publicNode(node) {
  const { tokens, vec, ...rest } = node;
  return rest;
}

function handoverOrder(a, b) {
  const num = (n) => Number(/^(\d+)/.exec(path.posix.basename(n.path))?.[1] ?? Infinity);
  return num(a) - num(b) || (a.path < b.path ? -1 : 1);
}

function languageOf(rel) {
  const base = path.posix.basename(rel);
  if (base === 'Dockerfile') return 'dockerfile';
  const ext = path.posix.extname(base).slice(1).toLowerCase();
  return LANGUAGES[ext] || ext || 'text';
}

/* ---------- server ---------- */

/**
 * Create the viewer HTTP server (not listening). The index is loaded from the
 * cache (or built) in the background; requests wait for it.
 * @param {{projectDir: string, embedder?: object|null, uiDir?: string, rebuildOutputs?: boolean}} opts
 *   `rebuildOutputs` re-renders already-built presentation outputs whose sources changed, at start and on refresh
 *   (never creates new ones); `uiDir` is the static UI directory (default viewer/ui); `embedder` is the one optional semantic embedder ({embed, model}); it is
 *   passed to every index update, re-index and search call.
 * @returns {http.Server}
 */
export function createServer({ projectDir, embedder = null, uiDir = DEFAULT_UI_DIR, rebuildOutputs = false }) {
  const root = fs.realpathSync(path.resolve(projectDir));
  let index = null;
  let indexError = null;
  let indexedAt = 0;
  let queue = updateIndex(root, { embedder })
    .catch(() => buildIndex(root, { embedder }))
    .then((built) => {
      index = built;
      indexedAt = Date.now();
    })
    .catch((err) => {
      indexError = err;
      console.error(`eng-view: index build failed: ${err?.message ?? err}`);
    });
  /** Reads wait only for the first load (and the stale-output rebuild); later refreshes run behind them. */
  if (rebuildOutputs) queue = queue.then(rebuildStaleOutputs);
  const loaded = queue;

  /** Incremental: only outputs that exist and whose inputs changed are re-rendered. */
  function rebuildStaleOutputs() {
    const only = presentStatus(root).outputs.filter((o) => o.exists).map((o) => o.name);
    if (!only.length) return [];
    try {
      const { results } = buildOutputs(root, { only });
      const built = results.filter((r) => r.status === 'built').map((r) => r.file);
      if (built.length) console.error(`eng-view: rebuilt ${built.join(', ')}`);
      return built;
    } catch (err) {
      console.error(`eng-view: output rebuild failed: ${err?.message ?? err}`);
      return [];
    }
  }

  /** Run fn after all earlier index work, serialising mutations. */
  const exclusive = (fn) => {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
  };

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = err instanceof HttpError ? err.status : 500;
      if (res.headersSent) return res.destroy();
      sendJson(res, status, { error: status === 500 ? 'internal error' : err.message });
    });
  });

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    checkHost(req, server);
    if (url.pathname.startsWith('/api/')) {
      await loaded;
      if (indexError) throw new HttpError(503, 'index unavailable');
      return api(req, res, url);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method not allowed');
    if (url.pathname.startsWith('/present/')) return servePresent(res, url.pathname);
    return serveStatic(res, url.pathname, uiDir);
  }

  /**
   * The index is a snapshot: built (incrementally, from the cache) when the
   * server starts and again only on POST /api/refresh. Reads never re-scan.
   * Edits made through the viewer re-index their file in putDoc.
   */
  async function postRefresh(req) {
    if (req.headers['x-eng-view'] !== '1') throw new HttpError(403, 'missing X-Eng-View header');
    return exclusive(async () => {
      index = await updateIndex(root, { embedder, previous: index });
      indexedAt = Date.now();
      const rebuilt = rebuildOutputs ? rebuildStaleOutputs() : [];
      return { indexedAt, read: index.lastUpdate.read.length, nodes: index.nodes.length, rebuilt };
    });
  }

  async function api(req, res, url) {
    const route = url.pathname;
    const q = url.searchParams;
    if (route === '/api/doc' && req.method === 'PUT') return sendJson(res, 200, await putDoc(req, q.get('path')));
    if (route === '/api/present/build' && req.method === 'POST') return sendJson(res, 200, await postBuild(req));
    if (route === '/api/present/theme' && req.method === 'POST') return sendJson(res, 200, await postTheme(req));
    if (route === '/api/refresh' && req.method === 'POST') return sendJson(res, 200, await postRefresh(req));
    if (req.method !== 'GET') throw new HttpError(405, 'method not allowed');
    switch (route) {
      case '/api/graph': return sendJson(res, 200, graph());
      case '/api/node': return sendJson(res, 200, nodeInfo(q.get('id')));
      case '/api/links': return sendJson(res, 200, links(q.get('path')));
      case '/api/doc': return sendJson(res, 200, getDoc(q.get('path')));
      case '/api/code': return sendJson(res, 200, getCode(q.get('path')));
      case '/api/search': return sendJson(res, 200, await runSearch(q.get('q'), q.get('limit')));
      case '/api/timeline': return sendJson(res, 200, timeline());
      case '/api/present': return sendJson(res, 200, presentStatus(root));
      case '/api/needs': return sendJson(res, 200, { groups: needsGroups(root) });
      default: throw new HttpError(404, 'not found');
    }
  }

  function graph() {
    return {
      project: root,
      semantic: index.semantic,
      indexedAt,
      nodes: index.nodes.map(publicNode),
      edges: index.edges,
    };
  }

  function nodeInfo(id) {
    const node = index.nodes.find((n) => n.id === id);
    if (!node) throw new HttpError(404, 'unknown node');
    return {
      node: publicNode(node),
      outgoing: index.edges.filter((e) => e.from === id),
      incoming: index.edges.filter((e) => e.to === id),
    };
  }

  /** Every edge touching any node of one file (the file and its items), in one pass, plus the outputs built from it. */
  function links(input) {
    const rel = cleanRel(input);
    if (!rel) throw new HttpError(403, 'invalid path');
    const ids = index.nodes.filter((n) => n.path === rel).map((n) => n.id);
    if (!ids.length) throw new HttpError(404, 'unknown path');
    const mine = new Set(ids);
    const outgoing = [];
    const incoming = [];
    for (const e of index.edges) {
      if (mine.has(e.from)) outgoing.push(e);
      if (mine.has(e.to)) incoming.push(e);
    }
    const outputs = presentStatus(root).outputs.filter((o) => o.sources.includes(rel)).map(({ name, kind }) => ({ name, kind }));
    return { path: rel, ids, outgoing, incoming, outputs };
  }

  /**
   * Everything dated, newest first: handovers and their revisions, receipts,
   * decisions and recent commits. `handovers` keeps the phase order.
   */
  function timeline() {
    const files = index.nodes.filter((n) => n.id === n.path);
    const events = [];
    for (const n of files) {
      if (!['handover', 'receipt', 'decision'].includes(n.kind)) continue;
      if (n.date) events.push({ date: n.date, type: n.kind, title: n.title, path: n.path, summary: n.summary || '' });
      for (const r of n.revisions || []) events.push({ date: r.date, type: 'revision', title: n.title, path: n.path, summary: r.text });
    }
    for (const c of index.history || []) events.push({ date: c.date, type: 'commit', title: c.subject, sha: c.sha });
    events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return {
      events,
      undated: files.filter((n) => ['handover', 'receipt', 'decision'].includes(n.kind) && !n.date).map(publicNode),
      handovers: files.filter((n) => n.kind === 'handover').sort(handoverOrder).map(publicNode),
    };
  }

  async function runSearch(query, rawLimit) {
    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 8, 1), 50);
    if (!query || !query.trim()) return { results: [] };
    return { results: await search(index, query, { limit, embedder }) };
  }

  /** Validate and open a readable text file of the given classified type(s). */
  function readable(input, types) {
    const rel = cleanRel(input);
    if (!rel) throw new HttpError(403, 'invalid path');
    const cls = classify(rel);
    if (!cls || !types.includes(cls.type)) throw new HttpError(404, 'not found');
    const abs = resolveNoSymlink(root, rel);
    if (!abs || !isIndexedFile(root, index, rel)) throw new HttpError(404, 'not found');
    const text = readIndexable(abs, rel);
    if (text === null) throw new HttpError(404, 'not found');
    return { rel, text, abs };
  }

  function mtimeOf(abs) {
    try {
      return fs.statSync(abs).mtimeMs;
    } catch {
      return null;
    }
  }

  function docPayload(rel, markdown, abs) {
    return { path: rel, markdown, html: renderMarkdown(markdown, { basePath: rel }), editable: isEditablePath(rel), mtime: mtimeOf(abs) };
  }

  function getDoc(input) {
    const { rel, text, abs } = readable(input, ['doc', 'state']);
    return docPayload(rel, text, abs);
  }

  function getCode(input) {
    const { rel, text } = readable(input, ['code']);
    return { path: rel, text, language: languageOf(rel) };
  }

  async function putDoc(req, input) {
    if (req.headers['x-eng-view'] !== '1') throw new HttpError(403, 'missing X-Eng-View header');
    const rel = cleanRel(input);
    if (!rel || !isEditablePath(rel)) throw new HttpError(403, 'not editable');
    const { markdown, baseMtime } = parseMarkdownBody(await readBody(req));
    return exclusive(async () => {
      const abs = resolveNoSymlink(root, rel);
      if (!abs) throw new HttpError(isLinkedPath(rel) ? 403 : 404, 'not writable');
      if (!isIndexedFile(root, index, rel)) throw new HttpError(404, 'not found');
      if (baseMtime !== undefined && mtimeOf(abs) !== baseMtime) throw new HttpError(409, 'changed on disk');
      if (rel === '.eng-team/profile.md' && switchesToAutonomous(abs, markdown))
        throw new HttpError(403, 'autonomous mode starts only from an eng-team command with --autonomous');
      fs.writeFileSync(abs, markdown);
      await reindexFile(root, index, rel, { embedder });
      indexedAt = Date.now();
      try { saveIndex(root, index); } catch { /* cache is best-effort */ }
      return docPayload(rel, markdown, abs);
    });
  }

  /** Serve a generated docs/present/*.html page. It carries its own strict CSP; only the viewer itself may frame it. */
  function servePresent(res, pathname) {
    const name = pathname.slice('/present/'.length);
    if (!PRESENT_FILES.has(name)) throw new HttpError(404, 'not found');
    const abs = resolveNoSymlink(root, `docs/present/${name}`);
    if (!abs) throw new HttpError(404, 'not found');
    const body = fs.readFileSync(abs);
    res.writeHead(200, {
      ...BASE_HEADERS,
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
      'Content-Type': MIME['.html'],
      'Content-Length': body.length,
    });
    res.end(body);
  }

  /** Mutating present routes need the same header as doc edits, and a JSON object body. */
  async function presentBody(req) {
    if (req.headers['x-eng-view'] !== '1') throw new HttpError(403, 'missing X-Eng-View header');
    let body;
    try {
      body = JSON.parse((await readBody(req)) || '{}');
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(400, 'invalid JSON');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'body must be an object');
    return body;
  }

  async function postBuild(req) {
    const body = await presentBody(req);
    const only = body.only === undefined ? Object.keys(OUTPUTS) : body.only;
    if (!Array.isArray(only) || !only.length || !only.every((n) => typeof n === 'string' && Object.hasOwn(OUTPUTS, n))) {
      throw new HttpError(400, 'only must list known outputs');
    }
    return exclusive(() => {
      try {
        return buildOutputs(root, { only, force: body.force === true });
      } catch (err) {
        throw new HttpError(422, err.message);
      }
    });
  }

  async function postTheme(req) {
    const body = await presentBody(req);
    return exclusive(() => {
      try {
        const { theme, source } = setTheme(root, body);
        return { theme: { name: theme.name, source } };
      } catch (err) {
        throw new HttpError(422, err.message);
      }
    });
  }

  /** True when any component of rel exists but is a symlink (vs. simply missing). */
  function isLinkedPath(rel) {
    let cur = root;
    for (const part of rel.split('/')) {
      cur = path.join(cur, part);
      try {
        if (fs.lstatSync(cur).isSymbolicLink()) return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  return server;
}

function parseMarkdownBody(raw) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'invalid JSON');
  }
  if (!body || typeof body.markdown !== 'string') throw new HttpError(400, 'markdown must be a string');
  if (body.baseMtime !== undefined && typeof body.baseMtime !== 'number') throw new HttpError(400, 'baseMtime must be a number');
  return { markdown: body.markdown, baseMtime: body.baseMtime };
}

const AUTONOMOUS_LINE = /^[\s|>*-]*`?autonomy`?\s*[:|]\s*`?autonomous\b/im;

/** The guard hook only lets autonomy become `autonomous` after the user typed --autonomous; the viewer must not be a way around it. */
function switchesToAutonomous(abs, next) {
  let cur = '';
  try {
    cur = fs.readFileSync(abs, 'utf8');
  } catch {
    /* new file */
  }
  return AUTONOMOUS_LINE.test(next) && !AUTONOMOUS_LINE.test(cur);
}

/** DNS-rebinding guard: Host must be 127.0.0.1:<port> or localhost:<port>. */
function checkHost(req, server) {
  const addr = server.address();
  const host = req.headers.host;
  if (!addr || typeof addr === 'string' || !host) throw new HttpError(403, 'bad host');
  if (host !== `127.0.0.1:${addr.port}` && host !== `localhost:${addr.port}`) throw new HttpError(403, 'bad host');
}

/* ---------- static UI ---------- */

function serveStatic(res, pathname, uiDir) {
  let rel = pathname === '/' ? 'index.html' : null;
  if (rel === null) {
    if (!pathname.startsWith('/ui/')) throw new HttpError(404, 'not found');
    try {
      rel = decodeURIComponent(pathname.slice('/ui/'.length));
    } catch {
      throw new HttpError(404, 'not found');
    }
  }
  const file = path.resolve(uiDir, rel);
  if (rel.includes('\0') || !file.startsWith(path.resolve(uiDir) + path.sep)) throw new HttpError(404, 'not found');
  let real;
  try {
    real = fs.realpathSync(file);
    if (!real.startsWith(fs.realpathSync(uiDir) + path.sep) || !fs.statSync(real).isFile()) throw new Error('no');
  } catch {
    throw new HttpError(404, 'not found');
  }
  const type = MIME[path.extname(real).toLowerCase()] || 'application/octet-stream';
  const body = fs.readFileSync(real);
  res.writeHead(200, { ...BASE_HEADERS, 'Content-Type': type, 'Content-Length': body.length });
  res.end(body);
}

/**
 * Create the server and start listening on 127.0.0.1.
 * @param {{projectDir: string, port?: number, embedder?: object|null}} opts port 0 = ephemeral
 * @returns {Promise<{server: http.Server, port: number, url: string}>}
 */
export function start({ projectDir, port = DEFAULT_PORT, embedder = null, uiDir, rebuildOutputs = false }) {
  const server = createServer({ projectDir, embedder, uiDir, rebuildOutputs });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, () => {
      const actual = server.address().port;
      resolve({ server, port: actual, url: `http://${HOST}:${actual}` });
    });
  });
}
