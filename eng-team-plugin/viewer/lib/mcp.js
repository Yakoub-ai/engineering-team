import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { updateIndex, buildIndex, search } from './index.js';
import { classify, readText } from './scan.js';
import { cleanRel, resolveNoSymlink, isIndexedFile } from './project-files.js';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'eng-team-context', version: '0.1.0' };
const SNIPPET_MAX = 300;
const DOC_LINE_CAP = 2000;
const REFRESH_MS = 2000;
const SEMANTIC_EDGES = new Set(['semantic', 'lexical']);

const TOOLS = [
  {
    name: 'search_context',
    description: 'Search the project engineering record and code; returns ranked items with path, line, title, snippet and score.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text query' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 8 },
        kinds: { type: 'array', items: { type: 'string' }, description: 'Restrict to node kinds (doc, spec, plan, decision, finding, code, ...)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_related',
    description: 'Items connected to a node or file: explicit links first, then semantic/lexical neighbours.',
    inputSchema: {
      type: 'object',
      properties: {
        id_or_path: { type: 'string', description: 'Node id (path or path#ID) or project-relative path' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
      },
      required: ['id_or_path'],
    },
  },
  {
    name: 'changed_since',
    description: 'Files changed between a git commit and HEAD, mapped to index nodes.',
    inputSchema: {
      type: 'object',
      properties: { commit: { type: 'string', description: 'Commit, tag or branch to compare from' } },
      required: ['commit'],
    },
  },
  {
    name: 'get_doc',
    description: 'Text of an indexed project file (docs in full; code capped at 2000 lines). Excluded files are refused.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Project-relative path' } },
      required: ['path'],
    },
  },
];

/** Error that becomes a tool result with isError: true. */
class ToolError extends Error {}

const log = (msg) => process.stderr.write(`eng-team-viewer: ${msg}\n`);
const textResult = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });
const snippet = (s) => String(s ?? '').slice(0, SNIPPET_MAX);

/**
 * Create the MCP handler for one project. The index is built or loaded on the
 * first tool call and refreshed incrementally afterwards.
 * @param {{projectDir: string, embedder?: object|null, getEmbedder?: () => Promise<object|null>}} opts
 *   `getEmbedder` creates the embedder lazily on the first tool call, so nothing is written to the project before then
 * @returns {{handle: (msg: object) => Promise<object|null>, run: (input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream) => Promise<void>}}
 */
export function createMcp({ projectDir, embedder = null, getEmbedder = null }) {
  const root = fs.realpathSync(path.resolve(projectDir));
  let index = null;
  let refreshedAt = 0;
  let chain = Promise.resolve();

  async function currentIndex() {
    if (getEmbedder) {
      embedder = await getEmbedder();
      getEmbedder = null;
    }
    if (index && Date.now() - refreshedAt < REFRESH_MS) return index;
    try {
      // Only manage a cache in projects that already use .eng-team/; never create it.
      index = await updateIndex(root, { embedder, previous: index ?? undefined, persist: 'existing' });
    } catch (err) {
      log(`index update failed, rebuilding: ${err.message}`);
      index = await buildIndex(root, { embedder });
    }
    refreshedAt = Date.now();
    return index;
  }

  async function searchContext(args) {
    if (typeof args.query !== 'string' || !args.query.trim()) throw new ToolError('query must be a non-empty string');
    const limit = clampInt(args.limit, 8, 1, 50);
    const kinds = Array.isArray(args.kinds) && args.kinds.length ? args.kinds.map(String) : undefined;
    const hits = await search(await currentIndex(), args.query, { limit, kinds, embedder });
    return textResult({ results: hits.map(({ node, score }) => describe(node, score)) });
  }

  function describe(node, score) {
    return { id: node.id, kind: node.kind, path: node.path, line: node.line ?? null, title: node.title, snippet: snippet(node.summary), score };
  }

  async function getRelated(args) {
    const key = typeof args.id_or_path === 'string' ? args.id_or_path.trim() : '';
    if (!key) throw new ToolError('id_or_path must be a non-empty string');
    const idx = await currentIndex();
    const byId = new Map(idx.nodes.map((n) => [n.id, n]));
    const node = byId.get(key) || byId.get(cleanRel(key) || '');
    if (!node) throw new ToolError(`no indexed node for ${key}`);
    const limit = clampInt(args.limit, 10, 1, 100);
    const items = [];
    for (const e of idx.edges) {
      if (e.from !== node.id && e.to !== node.id) continue;
      const other = byId.get(e.from === node.id ? e.to : e.from);
      if (other) items.push({ ...describe(other, e.score ?? null), edge: e.type, direction: e.from === node.id ? 'out' : 'in' });
    }
    const rank = (i) => (SEMANTIC_EDGES.has(i.edge) ? 1 : 0);
    items.sort((a, b) => rank(a) - rank(b) || (b.score ?? 0) - (a.score ?? 0));
    return textResult({ id: node.id, related: items.slice(0, limit) });
  }

  async function changedSince(args) {
    const commit = typeof args.commit === 'string' ? args.commit.trim() : '';
    if (!/^[A-Za-z0-9][A-Za-z0-9._\/~^@-]*$/.test(commit)) throw new ToolError('commit must be a commit, tag or branch name');
    let out;
    try {
      out = execFileSync('git', ['-c', 'core.quotePath=false', 'diff', '--name-status', '-z', `${commit}..HEAD`, '--'], {
        cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024,
      });
    } catch (err) {
      throw new ToolError(gitFailure(err));
    }
    const idx = await currentIndex();
    const changes = parseNameStatusZ(out).map(({ status, paths }) => {
      const file = paths[paths.length - 1];
      const nodes = idx.nodes.filter((n) => n.path === file).map((n) => ({ id: n.id, kind: n.kind, title: n.title }));
      return { status, path: file, ...(paths.length > 1 ? { from: paths[0] } : {}), nodes };
    });
    return textResult({ commit, changes });
  }

  async function getDoc(args) {
    const rel = cleanRel(args.path);
    if (!rel) throw new ToolError('invalid path');
    if (!classify(rel)) throw new ToolError('not found');
    const idx = await currentIndex();
    const abs = resolveNoSymlink(root, rel);
    if (!abs || !isIndexedFile(root, idx, rel)) throw new ToolError('not found');
    const text = readText(abs);
    if (text === null) throw new ToolError('not found');
    if (classify(rel).type !== 'code') return textResult(text);
    const lines = text.split('\n');
    if (lines.length <= DOC_LINE_CAP) return textResult(text);
    return textResult(`${lines.slice(0, DOC_LINE_CAP).join('\n')}\n[truncated at ${DOC_LINE_CAP} of ${lines.length} lines]`);
  }

  const HANDLERS = { search_context: searchContext, get_related: getRelated, changed_since: changedSince, get_doc: getDoc };

  async function callTool(params) {
    const handler = Object.hasOwn(HANDLERS, params?.name) ? HANDLERS[params.name] : null;
    if (!handler) return { ...textResult(`unknown tool: ${params?.name}`), isError: true };
    try {
      return await handler(params.arguments && typeof params.arguments === 'object' ? params.arguments : {});
    } catch (err) {
      if (!(err instanceof ToolError)) log(`tool ${params.name} failed: ${err.stack || err.message}`);
      const message = err instanceof ToolError ? err.message : 'internal error';
      return { ...textResult(message), isError: true };
    }
  }

  async function dispatch(msg) {
    switch (msg.method) {
      case 'initialize':
        return { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO };
      case 'ping':
        return {};
      case 'tools/list':
        return { tools: TOOLS };
      case 'tools/call':
        return callTool(msg.params);
      default: {
        const err = new Error(`method not found: ${msg.method}`);
        err.rpcCode = -32601;
        throw err;
      }
    }
  }

  /**
   * Handle one JSON-RPC message.
   * @param {object} msg
   * @returns {Promise<object|null>} the response, or null for notifications
   */
  async function handle(msg) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      return rpcError(msg?.id ?? null, -32600, 'invalid request');
    }
    if (msg.id === undefined || msg.id === null) return null;
    try {
      return { jsonrpc: '2.0', id: msg.id, result: await dispatch(msg) };
    } catch (err) {
      if (!err.rpcCode) log(`request ${msg.method} failed: ${err.stack || err.message}`);
      return rpcError(msg.id, err.rpcCode || -32603, err.rpcCode ? err.message : 'internal error');
    }
  }

  /**
   * Serve newline-delimited JSON-RPC on the given streams (default stdio).
   * Resolves when input ends and all work is flushed.
   */
  function run(input = process.stdin, output = process.stdout) {
    const rl = readline.createInterface({ input, crlfDelay: Infinity });
    const write = (obj) => output.write(`${JSON.stringify(obj)}\n`);
    rl.on('line', (line) => {
      if (!line.trim()) return;
      // Serialise so index refreshes never overlap.
      chain = chain.then(async () => {
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          return write(rpcError(null, -32700, 'parse error'));
        }
        const batch = Array.isArray(msg);
        if (batch && !msg.length) return write(rpcError(null, -32600, 'invalid request'));
        const replies = [];
        for (const m of batch ? msg : [msg]) {
          const r = await handle(m);
          if (r) replies.push(r);
        }
        if (batch) {
          if (replies.length) write(replies);
        } else if (replies.length) {
          write(replies[0]);
        }
      }).catch((err) => log(`unexpected error: ${err.stack || err.message}`));
    });
    return new Promise((resolve) => rl.on('close', () => chain.then(resolve)));
  }

  return { handle, run };
}

/** Map a failed `git diff` to a stable, specific message. */
function gitFailure(err) {
  if (err.code === 'ENOENT') return 'git unavailable';
  if (err.code === 'ENOBUFS' || /maxBuffer/i.test(err.message)) return 'too many changes; narrow the range';
  if (/not a git repository/i.test(String(err.stderr))) return 'not a git repository';
  return 'unknown commit';
}

/** Parse `git diff --name-status -z` output into {status, paths} entries. */
function parseNameStatusZ(out) {
  const tokens = out.split('\0');
  const entries = [];
  for (let i = 0; i < tokens.length && tokens[i]; ) {
    const status = tokens[i++];
    const count = /^[RC]/.test(status) ? 2 : 1;
    entries.push({ status, paths: tokens.slice(i, i + count) });
    i += count;
  }
  return entries;
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function clampInt(value, dflt, min, max) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : dflt;
}
