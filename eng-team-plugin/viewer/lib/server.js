import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateIndex, buildIndex, reindexFile, saveIndex, search } from './index.js';
import { classify, readText } from './scan.js';
import { renderMarkdown } from './markdown.js';
import { cleanRel, isEditablePath, resolveNoSymlink, isIndexedFile } from './project-files.js';

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
 * @param {{projectDir: string, port?: number, embedder?: object|null, uiDir?: string}} opts
 *   `uiDir` is the static UI directory (default viewer/ui); `embedder` is the one optional semantic embedder ({embed, model}); it is
 *   passed to every index update, re-index and search call.
 * @returns {http.Server}
 */
export function createServer({ projectDir, embedder = null, uiDir = DEFAULT_UI_DIR }) {
  const root = fs.realpathSync(path.resolve(projectDir));
  let index = null;
  let indexError = null;
  let queue = updateIndex(root, { embedder })
    .catch(() => buildIndex(root, { embedder }))
    .then((built) => { index = built; })
    .catch((err) => {
      indexError = err;
      console.error(`eng-view: index build failed: ${err?.message ?? err}`);
    });

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
      await queue;
      if (indexError) throw new HttpError(503, 'index unavailable');
      return api(req, res, url);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method not allowed');
    return serveStatic(res, url.pathname, uiDir);
  }

  async function api(req, res, url) {
    const route = url.pathname;
    const q = url.searchParams;
    if (route === '/api/doc' && req.method === 'PUT') return sendJson(res, 200, await putDoc(req, q.get('path')));
    if (req.method !== 'GET') throw new HttpError(405, 'method not allowed');
    switch (route) {
      case '/api/graph': return sendJson(res, 200, graph());
      case '/api/node': return sendJson(res, 200, nodeInfo(q.get('id')));
      case '/api/doc': return sendJson(res, 200, getDoc(q.get('path')));
      case '/api/code': return sendJson(res, 200, getCode(q.get('path')));
      case '/api/search': return sendJson(res, 200, await runSearch(q.get('q'), q.get('limit')));
      case '/api/timeline': return sendJson(res, 200, timeline());
      default: throw new HttpError(404, 'not found');
    }
  }

  function graph() {
    return {
      project: root,
      semantic: index.semantic,
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

  function timeline() {
    return { handovers: index.nodes.filter((n) => n.kind === 'handover').sort(handoverOrder).map(publicNode) };
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
    const text = readText(abs);
    if (text === null) throw new HttpError(404, 'not found');
    return { rel, text };
  }

  function docPayload(rel, markdown) {
    return { path: rel, markdown, html: renderMarkdown(markdown, { basePath: rel }), editable: isEditablePath(rel) };
  }

  function getDoc(input) {
    const { rel, text } = readable(input, ['doc', 'state']);
    return docPayload(rel, text);
  }

  function getCode(input) {
    const { rel, text } = readable(input, ['code']);
    return { path: rel, text, language: languageOf(rel) };
  }

  async function putDoc(req, input) {
    if (req.headers['x-eng-view'] !== '1') throw new HttpError(403, 'missing X-Eng-View header');
    const rel = cleanRel(input);
    if (!rel || !isEditablePath(rel)) throw new HttpError(403, 'not editable');
    const markdown = parseMarkdownBody(await readBody(req));
    return exclusive(async () => {
      const abs = resolveNoSymlink(root, rel);
      if (!abs) throw new HttpError(isLinkedPath(rel) ? 403 : 404, 'not writable');
      if (!isIndexedFile(root, index, rel)) throw new HttpError(404, 'not found');
      fs.writeFileSync(abs, markdown);
      await reindexFile(root, index, rel, { embedder });
      try { saveIndex(root, index); } catch { /* cache is best-effort */ }
      return docPayload(rel, markdown);
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
  return body.markdown;
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
export function start({ projectDir, port = DEFAULT_PORT, embedder = null, uiDir }) {
  const server = createServer({ projectDir, embedder, uiDir });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, () => {
      const actual = server.address().port;
      resolve({ server, port: actual, url: `http://${HOST}:${actual}` });
    });
  });
}
