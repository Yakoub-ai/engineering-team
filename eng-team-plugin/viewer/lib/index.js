import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { scanProject, readText } from './scan.js';
import { extractItems, extractMentions, extractImports } from './links.js';
import { tokenize, termFreq, buildTfidf, queryVector, cosine, topNeighbours } from './similarity.js';

const INDEX_VERSION = 1;
const LEXICAL_THRESHOLD = 0.35;
const LEXICAL_K = 5;
const SEMANTIC_THRESHOLD = 0.6;
const SEMANTIC_K = 5;
const EMBED_CHARS = 1500;
const JS_EXT = new Set(['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx']);
const JS_RESOLVE_EXT = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json'];

/* ---------- parsing one file ---------- */

function langOf(rel) {
  const ext = path.posix.extname(rel).slice(1).toLowerCase();
  if (JS_EXT.has(ext)) return 'js';
  return ext === 'py' ? 'py' : null;
}

function collapse(text, max) {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

function markdownMeta(rel, text) {
  const heading = /^#\s+(.+)$/m.exec(text);
  const title = heading ? heading[1].trim() : path.posix.basename(rel, '.md');
  const para = text.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).find((p) => p && !p.startsWith('#'));
  return { title, summary: collapse(para || '', 300) };
}

function codeMeta(rel, text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return { title: path.posix.basename(rel), summary: collapse(lines.slice(0, 3).join(' '), 200) };
}

function makeNode(fields, text) {
  const tf = termFreq([...tokenize(fields.title), ...tokenize(fields.title), ...tokenize(text)]);
  // `_text` is transient: consumed (and removed) by embedNodes during build.
  return { ...fields, tokens: tf, _text: `${fields.title}. ${text}`.slice(0, EMBED_CHARS) };
}

function parseFile(entry, text) {
  const isCode = entry.type === 'code';
  const meta = isCode ? codeMeta(entry.path, text) : markdownMeta(entry.path, text);
  const nodes = [makeNode({ id: entry.path, kind: entry.kind, path: entry.path, ...meta }, text)];
  const raw = {};
  if (isCode) {
    const lang = langOf(entry.path);
    const imports = lang ? extractImports(text, lang) : [];
    if (imports.length) raw.imports = imports;
    return { nodes, raw };
  }
  for (const item of extractItems(text, entry.kind)) {
    nodes.push(makeNode({
      id: `${entry.path}#${item.itemId}`, kind: item.kind, path: entry.path,
      title: item.title, line: item.line, summary: collapse(item.text, 300),
    }, item.text));
  }
  const mentions = extractMentions(text);
  for (const key of ['links', 'refs', 'ids', 'slugs']) if (mentions[key].length) raw[key] = mentions[key];
  return { nodes, raw };
}

/* ---------- edge resolution ---------- */

function resolveFrom(fromPath, target) {
  const joined = target.startsWith('/')
    ? path.posix.normalize(target.slice(1))
    : path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), target));
  return joined.startsWith('..') ? null : joined;
}

function jsCandidates(base) {
  const noExt = base.replace(/\.(m|c)?jsx?$/, '');
  const stems = noExt === base ? [base] : [base, noExt];
  const out = [];
  for (const s of stems) {
    out.push(s, ...JS_RESOLVE_EXT.map((e) => s + e), ...JS_RESOLVE_EXT.map((e) => `${s}/index${e}`));
  }
  return out;
}

function pyCandidates(from, spec) {
  const [mod, name] = spec.split(':');
  const dots = /^\.+/.exec(mod)[0].length;
  let dir = path.posix.dirname(from);
  for (let i = 1; i < dots; i++) dir = path.posix.dirname(dir);
  const rest = mod.slice(dots).split('.').filter(Boolean);
  if (name) rest.push(name);
  const base = path.posix.normalize(path.posix.join(dir, ...rest));
  return [`${base}.py`, `${base}/__init__.py`];
}

function resolveImport(from, spec, files) {
  const lang = langOf(from);
  const cands = lang === 'py' ? pyCandidates(from, spec) : jsCandidates(resolveFrom(from, spec) || '');
  return cands.find((c) => c && files.has(c) && c !== from) || null;
}

function definitionMaps(nodes) {
  const defs = new Map();
  const add = (key, id) => defs.set(key, [...(defs.get(key) || []), id]);
  for (const n of nodes) {
    if (n.id.includes('#')) add(n.id.split('#')[1], n.id);
    else if (n.kind === 'decision') {
      const num = /^(\d+)-/.exec(path.posix.basename(n.path))?.[1] || /ADR-(\d+)/.exec(n.title)?.[1];
      if (num) add(`ADR-${String(num).padStart(4, '0')}`, n.id);
    }
  }
  return defs;
}

const isPlanTaskId = (id) => /^(?:[TF]\d+|R-\d+)$/.test(id);

/**
 * Decide which definitions a mentioned ID points at. Plan-task IDs repeat in
 * every plan, so they resolve only through explicit links or a unique plan.
 */
function resolveIdTargets(id, from, defIds, explicitTargets, kindByPath) {
  if (!defIds.length || defIds.some((d) => d.split('#')[0] === from)) return [];
  const linked = defIds.filter((d) => explicitTargets.has(d.split('#')[0]));
  if (isPlanTaskId(id)) {
    const inPlans = linked.filter((d) => kindByPath.get(d.split('#')[0]) === 'plan');
    if (inPlans.length) return inPlans;
    const plans = defIds.filter((d) => kindByPath.get(d.split('#')[0]) === 'plan');
    return plans.length === 1 && defIds.length === 1 ? plans : [];
  }
  if (defIds.length === 1) return defIds;
  return linked;
}

function explicitEdges(nodes, files) {
  const edges = new Map();
  const add = (from, to, type) => {
    if (from !== to) edges.set(`${from}\0${to}\0${type}`, { from, to, type });
  };
  const fileSet = new Set(nodes.filter((n) => !n.id.includes('#')).map((n) => n.path));
  const defs = definitionMaps(nodes);
  const kindByPath = new Map(nodes.filter((n) => n.id === n.path).map((n) => [n.path, n.kind]));
  for (const n of nodes) if (n.id.includes('#')) add(n.path, n.id, 'contains');
  for (const [from, info] of Object.entries(files)) {
    if (!fileSet.has(from)) continue;
    const explicitTargets = new Set();
    for (const t of info.links || []) {
      const to = resolveFrom(from, t);
      if (to && fileSet.has(to)) {
        add(from, to, 'link');
        explicitTargets.add(to);
      }
    }
    for (const r of info.refs || []) {
      const to = [resolveFrom('', r), resolveFrom(from, r)].find((c) => c && fileSet.has(c));
      if (to) {
        add(from, to, 'ref');
        explicitTargets.add(to);
      }
    }
    for (const id of info.ids || []) {
      for (const to of resolveIdTargets(id, from, defs.get(id) || [], explicitTargets, kindByPath)) add(from, to, 'id');
    }
    for (const slug of info.slugs || []) {
      for (const n of nodes) {
        if (n.kind === 'decision' && n.id === n.path && path.posix.basename(n.path, '.md') === slug) add(from, n.id, 'id');
      }
    }
    for (const spec of info.imports || []) {
      const to = resolveImport(from, spec, fileSet);
      if (to) add(from, to, 'imports');
    }
  }
  return edges;
}

function lexicalEdges(nodes, explicit) {
  const fileNodes = nodes.filter((n) => !n.id.includes('#'));
  const kindOf = new Map(fileNodes.map((n) => [n.id, n.kind]));
  const { vectors } = buildTfidf(fileNodes.map((n) => ({ id: n.id, tf: n.tokens || {} })));
  const pairKey = (a, b) => (a < b ? `${a}\0${b}` : `${b}\0${a}`);
  const linkedPairs = new Set([...explicit.values()].map((e) => pairKey(e.from, e.to)));
  const neighbours = topNeighbours(vectors, {
    k: LEXICAL_K,
    threshold: LEXICAL_THRESHOLD,
    filter: (a, b) => !(kindOf.get(a) === 'code' && kindOf.get(b) === 'code'),
  });
  const seen = new Set();
  const out = [];
  for (const [from, hits] of neighbours) {
    for (const { id: to, score } of hits) {
      const key = pairKey(from, to);
      if (seen.has(key) || linkedPairs.has(key)) continue;
      seen.add(key);
      out.push({ from, to, type: 'lexical', score: Math.round(score * 1000) / 1000 });
    }
  }
  return out;
}

/* ---------- build / update ---------- */

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

function gitCommit(root) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

function groupByPath(nodes) {
  const map = new Map();
  for (const n of nodes) map.set(n.path, [...(map.get(n.path) || []), n]);
  return map;
}

/* ---------- embeddings ---------- */

const round4 = (x) => Math.round(x * 1e4) / 1e4;

/**
 * Embed every node still lacking a vector (`vec`, a number array rounded to
 * 4 decimals, stored on the node in index.json). Reused nodes keep theirs.
 * @returns {Promise<boolean>} true when every node now has a vector
 */
async function embedNodes(nodes, embedder) {
  const todo = nodes.filter((n) => !n.vec);
  try {
    const vecs = todo.length ? await embedder.embed(todo.map((n) => n._text || n.title)) : [];
    if (vecs.length !== todo.length) return false;
    todo.forEach((n, i) => { n.vec = Array.from(vecs[i], round4); });
    return true;
  } catch {
    return false;
  }
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

const norm = (v) => Math.sqrt(dot(v, v)) || 1;

function pairKeyOf(a, b) {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

function semanticEdges(nodes, explicit) {
  const files = nodes.filter((n) => !n.id.includes('#') && Array.isArray(n.vec));
  const norms = new Map(files.map((n) => [n.id, norm(n.vec)]));
  const linked = new Set([...explicit.values()].map((e) => pairKeyOf(e.from, e.to)));
  const seen = new Set();
  const out = [];
  for (const a of files) {
    const hits = [];
    for (const b of files) {
      if (a === b || (a.kind === 'code' && b.kind === 'code') || a.vec.length !== b.vec.length) continue;
      const score = dot(a.vec, b.vec) / (norms.get(a.id) * norms.get(b.id));
      if (score >= SEMANTIC_THRESHOLD) hits.push({ id: b.id, score });
    }
    hits.sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : 1));
    for (const { id, score } of hits.slice(0, SEMANTIC_K)) {
      const key = pairKeyOf(a.id, id);
      if (seen.has(key) || linked.has(key)) continue;
      seen.add(key);
      out.push({ from: a.id, to: id, type: 'semantic', score: Math.round(score * 1000) / 1000 });
    }
  }
  return out;
}

/* ---------- build ---------- */

async function build(root, previous, force, embedder = null, keepEmbeddings = false) {
  const keepVecs = keepEmbeddings && !embedder && previous?.semantic === 'embeddings';
  const prevFiles = previous?.version === INDEX_VERSION ? previous.files : {};
  const prevNodes = groupByPath(previous?.version === INDEX_VERSION ? previous.nodes : []);
  const vecsStale = Boolean(embedder) && previous?.model !== embedder.model;
  const reusable = (rel) => {
    const list = prevNodes.get(rel);
    return Boolean(list) && (!embedder || (!vecsStale && list.every((n) => Array.isArray(n.vec))));
  };
  const nodes = [];
  const files = {};
  const read = [];
  let reused = 0;
  for (const entry of scanProject(root)) {
    const old = prevFiles[entry.path];
    const unchanged = old && old.mtime === entry.mtime && old.size === entry.size && !force.has(entry.path);
    if (unchanged && reusable(entry.path)) {
      files[entry.path] = old;
      nodes.push(...prevNodes.get(entry.path));
      reused++;
      continue;
    }
    const text = readText(entry.abs);
    if (text === null) continue;
    const hash = sha1(text);
    if (old && old.sha1 === hash && reusable(entry.path) && !force.has(entry.path)) {
      files[entry.path] = { ...old, mtime: entry.mtime, size: entry.size };
      nodes.push(...prevNodes.get(entry.path));
      reused++;
      continue;
    }
    const parsed = parseFile(entry, text);
    files[entry.path] = { mtime: entry.mtime, size: entry.size, sha1: hash, ...parsed.raw };
    nodes.push(...parsed.nodes);
    read.push(entry.path);
  }
  const embedded = keepVecs || (Boolean(embedder) && await embedNodes(nodes, embedder));
  for (const n of nodes) {
    delete n._text;
    if (!embedded) delete n.vec;
  }
  const explicit = explicitEdges(nodes, files);
  const similar = embedded ? semanticEdges(nodes, explicit) : lexicalEdges(nodes, explicit);
  const edges = [...explicit.values(), ...similar];
  return {
    version: INDEX_VERSION,
    project: root,
    builtAt: new Date().toISOString(),
    commit: gitCommit(root),
    nodes,
    edges,
    files,
    semantic: embedded ? 'embeddings' : 'lexical',
    ...(embedded ? { model: embedder ? embedder.model : previous.model } : {}),
    lastUpdate: { read, reused },
  };
}

/**
 * Build the index for a project. With `previous`, unchanged files (same
 * mtime+size, or same sha1) are reused and only changed files are parsed.
 * `index.lastUpdate` = {read: [paths parsed], reused: n} (not persisted).
 * @param {string} projectDir
 * @param {{embedder?: object|null, previous?: object|null}} [opts] embedder is the
 *   optional semantic layer ({embed, model}); null (or a failing embedder) means
 *   lexical (TF-IDF) edges. With one, nodes carry `vec` and edges are `semantic`.
 * @returns {Promise<object>} index
 */
export async function buildIndex(projectDir, { embedder = null, previous = null } = {}) {
  return build(path.resolve(projectDir), previous, new Set(), embedder);
}

const CACHE_PARTS = ['.eng-team', '.cache', 'index'];

const warned = new Set();

/** Log a warning to stderr, once per process per distinct message. */
function warn(msg) {
  if (warned.has(msg)) return;
  warned.add(msg);
  process.stderr.write(`eng-team-viewer: ${msg}\n`);
}

/**
 * Check every component of a cache dir under the project is a real directory
 * inside the project root (no symlinks). Optionally creates missing components.
 * @param {string} root project root
 * @param {boolean} create create missing components
 * @param {string[]} [parts] path components below root (default: the index cache)
 * @returns {string|null} cache dir, or null when missing/unsafe
 */
export function safeCacheDir(root, create, parts = CACHE_PARTS) {
  let realRoot;
  try {
    realRoot = fs.realpathSync(root);
  } catch {
    return null;
  }
  let cur = root;
  for (const part of parts) {
    cur = path.join(cur, part);
    let st = null;
    try {
      st = fs.lstatSync(cur);
    } catch { /* missing */ }
    if (!st && create) {
      fs.mkdirSync(cur);
      st = fs.lstatSync(cur);
    }
    if (!st) return null;
    const inside = !st.isSymbolicLink() && st.isDirectory() && isInside(realRoot, fs.realpathSync(cur));
    if (!inside) {
      warn(`ignoring unsafe index cache path ${cur}`);
      return null;
    }
  }
  return cur;
}

function isInside(realRoot, target) {
  return target === realRoot || target.startsWith(realRoot + path.sep);
}

/**
 * Persist the index at <project>/.eng-team/.cache/index/index.json.
 * Skips (logging to stderr) when the cache path is a symlink or escapes the project.
 * @param {string} projectDir
 * @param {object} index
 */
export function saveIndex(projectDir, index) {
  const root = path.resolve(projectDir);
  let dir;
  try {
    dir = safeCacheDir(root, true);
  } catch (err) {
    warn(`cannot prepare index cache: ${err.message}`);
    return;
  }
  if (!dir) return;
  const file = path.join(dir, 'index.json');
  const { lastUpdate, ...persisted } = index;
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    const fd = fs.openSync(tmp, 'wx');
    try {
      fs.writeFileSync(fd, JSON.stringify(persisted));
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
  } catch (err) {
    warn(`cannot save index: ${err.message}`);
    try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
  }
}

const isStr = (v) => typeof v === 'string';

function validShape(idx, root) {
  return Boolean(idx) && idx.version === INDEX_VERSION && idx.project === root
    && Array.isArray(idx.nodes) && Array.isArray(idx.edges)
    && idx.files !== null && typeof idx.files === 'object' && !Array.isArray(idx.files)
    && idx.nodes.every((n) => n && isStr(n.id) && isStr(n.path))
    && idx.edges.every((e) => e && isStr(e.from) && isStr(e.to));
}

/**
 * Load the saved index.
 * @param {string} projectDir
 * @returns {object|null} null when missing, unsafe, unreadable, of another
 *   version or project, or malformed
 */
export function loadIndex(projectDir) {
  const root = path.resolve(projectDir);
  try {
    const dir = safeCacheDir(root, false);
    if (!dir) return null;
    const file = path.join(dir, 'index.json');
    if (fs.lstatSync(file).isSymbolicLink()) {
      warn(`ignoring symlinked index file ${file}`);
      return null;
    }
    const idx = JSON.parse(fs.readFileSync(file, 'utf8'));
    return validShape(idx, root) ? idx : null;
  } catch {
    return null;
  }
}

/** True when `next` differs from `previous` in anything worth persisting. */
function indexChanged(previous, next) {
  if (!previous) return true;
  if (next.lastUpdate.read.length) return true;
  if (previous.semantic !== next.semantic || previous.model !== next.model || previous.commit !== next.commit) return true;
  const a = Object.keys(previous.files);
  const b = Object.keys(next.files);
  return a.length !== b.length || b.some((f) => !Object.hasOwn(previous.files, f));
}

/**
 * Load the saved index (if any), re-read only changed files, save and return it.
 * The file is rewritten only when the index changed.
 * @param {string} projectDir
 * @param {{embedder?: object|null, previous?: object|null, persist?: boolean|'existing'}} [opts]
 *   `previous` overrides the on-disk index as the incremental base (in-memory use);
 *   `persist` false never writes, 'existing' writes only when `<project>/.eng-team/`
 *   already exists (never creating it), true (default) always may write
 * @returns {Promise<object>} index
 */
export async function updateIndex(projectDir, { embedder = null, previous, persist = true } = {}) {
  const prev = previous === undefined ? loadIndex(projectDir) : previous;
  const index = await buildIndex(projectDir, { embedder, previous: prev });
  if (persist && indexChanged(prev, index) && (persist !== 'existing' || isDir(path.join(path.resolve(projectDir), '.eng-team')))) {
    saveIndex(projectDir, index);
  }
  return index;
}

function isDir(p) {
  try {
    return fs.lstatSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Re-read one file (after an edit) and refresh `index` in place.
 * @param {string} projectDir
 * @param {object} index index to mutate
 * @param {string} relPath project-relative posix path
 * @param {{embedder?: object|null}} [opts] without an embedder, an embeddings index
 *   keeps its vectors and label; the re-read file's nodes just have no vector until
 *   the next embedder-backed update
 * @returns {Promise<object>} the same index object
 */
export async function reindexFile(projectDir, index, relPath, { embedder = null } = {}) {
  const next = await build(path.resolve(projectDir), index, new Set([relPath]), embedder, true);
  Object.assign(index, next);
  delete index._tfidf;
  return index;
}

/* ---------- search ---------- */

function searchModel(index) {
  if (!index._tfidf) {
    const model = buildTfidf(index.nodes.map((n) => ({ id: n.id, tf: n.tokens || {} })));
    Object.defineProperty(index, '_tfidf', { value: model, enumerable: false, configurable: true, writable: true });
  }
  return index._tfidf;
}

async function embeddingScorer(index, query, embedder) {
  if (!embedder || index.semantic !== 'embeddings' || embedder.model !== index.model) return null;
  try {
    const [q] = await embedder.embed([query]);
    if (!q) return null;
    const qn = norm(q);
    return (node) => (Array.isArray(node.vec) && node.vec.length === q.length ? dot(q, node.vec) / (qn * norm(node.vec)) : 0);
  } catch {
    return null;
  }
}

function tfidfScorer(index, query) {
  const { idf, vectors } = searchModel(index);
  const q = queryVector(idf, query);
  if (!Object.keys(q).length) return null;
  return (node) => cosine(q, vectors.get(node.id));
}

/**
 * Rank nodes against a free-text query. Uses embeddings when the index has
 * them and a matching `embedder` is given (and works); otherwise TF-IDF cosine.
 * @param {object} index
 * @param {string} query
 * @param {{limit?: number, kinds?: string[], embedder?: object|null}} [opts]
 * @returns {Promise<{node: object, score: number}[]>} nodes are returned without tokens/vec
 */
export async function search(index, query, { limit = 8, kinds, embedder = null } = {}) {
  const scorer = (await embeddingScorer(index, query, embedder)) || tfidfScorer(index, query);
  if (!scorer) return [];
  const hits = [];
  for (const node of index.nodes) {
    if (kinds && !kinds.includes(node.kind)) continue;
    const score = scorer(node);
    if (score > 0) hits.push({ node, score });
  }
  hits.sort((a, b) => b.score - a.score || (a.node.id < b.node.id ? -1 : 1));
  return hits.slice(0, limit).map(({ node, score }) => {
    const { tokens, vec, ...rest } = node;
    return { node: rest, score: Math.round(score * 1000) / 1000 };
  });
}
