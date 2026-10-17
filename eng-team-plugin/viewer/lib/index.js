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
  return { ...fields, tokens: tf };
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

function build(root, previous, force) {
  const prevFiles = previous?.version === INDEX_VERSION ? previous.files : {};
  const prevNodes = groupByPath(previous?.version === INDEX_VERSION ? previous.nodes : []);
  const nodes = [];
  const files = {};
  const read = [];
  let reused = 0;
  for (const entry of scanProject(root)) {
    const old = prevFiles[entry.path];
    const unchanged = old && old.mtime === entry.mtime && old.size === entry.size && !force.has(entry.path);
    if (unchanged && prevNodes.has(entry.path)) {
      files[entry.path] = old;
      nodes.push(...prevNodes.get(entry.path));
      reused++;
      continue;
    }
    const text = readText(entry.abs);
    if (text === null) continue;
    const hash = sha1(text);
    if (old && old.sha1 === hash && prevNodes.has(entry.path) && !force.has(entry.path)) {
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
  const explicit = explicitEdges(nodes, files);
  const edges = [...explicit.values(), ...lexicalEdges(nodes, explicit)];
  return {
    version: INDEX_VERSION,
    project: root,
    builtAt: new Date().toISOString(),
    commit: gitCommit(root),
    nodes,
    edges,
    files,
    semantic: 'lexical',
    lastUpdate: { read, reused },
  };
}

/**
 * Build the index for a project. With `previous`, unchanged files (same
 * mtime+size, or same sha1) are reused and only changed files are parsed.
 * `index.lastUpdate` = {read: [paths parsed], reused: n} (not persisted).
 * @param {string} projectDir
 * @param {{embedder?: object|null, previous?: object|null}} [opts] embedder is reserved
 *   for the optional semantic layer; null means lexical (TF-IDF).
 * @returns {object} index
 */
export function buildIndex(projectDir, { embedder = null, previous = null } = {}) {
  void embedder;
  return build(path.resolve(projectDir), previous, new Set());
}

const CACHE_PARTS = ['.eng-team', '.cache', 'index'];

function warn(msg) {
  process.stderr.write(`eng-team-viewer: ${msg}\n`);
}

/**
 * Check every component of the cache dir is a real directory inside the
 * project root (no symlinks). Optionally creates missing components.
 * @returns {string|null} cache dir, or null when missing/unsafe
 */
function safeCacheDir(root, create) {
  let realRoot;
  try {
    realRoot = fs.realpathSync(root);
  } catch {
    return null;
  }
  let cur = root;
  for (const part of CACHE_PARTS) {
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

/**
 * Load the saved index (if any), re-read only changed files, save and return it.
 * @param {string} projectDir
 * @param {{embedder?: object|null}} [opts]
 * @returns {object} index
 */
export function updateIndex(projectDir, { embedder = null } = {}) {
  const index = buildIndex(projectDir, { embedder, previous: loadIndex(projectDir) });
  saveIndex(projectDir, index);
  return index;
}

/**
 * Re-read one file (after an edit) and refresh `index` in place.
 * @param {string} projectDir
 * @param {object} index index to mutate
 * @param {string} relPath project-relative posix path
 * @returns {object} the same index object
 */
export function reindexFile(projectDir, index, relPath) {
  const next = build(path.resolve(projectDir), index, new Set([relPath]));
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

/**
 * Rank nodes against a free-text query (TF-IDF cosine).
 * @param {object} index
 * @param {string} query
 * @param {{limit?: number, kinds?: string[]}} [opts]
 * @returns {{node: object, score: number}[]} nodes are returned without tokens
 */
export function search(index, query, { limit = 8, kinds } = {}) {
  const { idf, vectors } = searchModel(index);
  const q = queryVector(idf, query);
  if (!Object.keys(q).length) return [];
  const hits = [];
  for (const node of index.nodes) {
    if (kinds && !kinds.includes(node.kind)) continue;
    const score = cosine(q, vectors.get(node.id));
    if (score > 0) hits.push({ node, score });
  }
  hits.sort((a, b) => b.score - a.score || (a.node.id < b.node.id ? -1 : 1));
  return hits.slice(0, limit).map(({ node, score }) => {
    const { tokens, ...rest } = node;
    return { node: rest, score: Math.round(score * 1000) / 1000 };
  });
}
