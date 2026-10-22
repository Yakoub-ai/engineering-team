import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseGitignore, readIndexable } from './scan.js';
import { resolveNoSymlink } from './project-files.js';
import { renderMarkdown } from './markdown.js';
import { resolveTheme, themeCss } from './theme.js';
import { render } from './template.js';

const TEMPLATES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const OUT_DIR = 'docs/present';
const MANIFEST_PARTS = ['.eng-team', '.cache', 'present'];
const BUILDER_VERSION = 1;

const P = {
  product: 'docs/engineering/product/product.md',
  brief: 'docs/engineering/product/brief.md',
  architecture: 'docs/engineering/architecture.md',
  status: 'docs/engineering/STATUS.md',
  context: '.eng-team/context.md',
};
const DECISIONS_DIR = 'docs/engineering/decisions';

/* ---------- reading sources ---------- */

/** Reads project files without following symlinks, skipping gitignored paths and anything that looks like a secret. */
function createReader(projectDir) {
  const root = fs.realpathSync(projectDir);
  let ignored = () => false;
  try {
    ignored = parseGitignore(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'));
  } catch { /* no .gitignore */ }
  const parts = (rel) => rel.split('/').map((_, i, a) => a.slice(0, i + 1).join('/'));
  const blocked = (rel) => parts(rel).some((p, i, a) => ignored(p, i < a.length - 1));
  const cache = new Map();
  return {
    root,
    read(rel) {
      if (cache.has(rel)) return cache.get(rel);
      let text = null;
      const abs = blocked(rel) ? null : resolveNoSymlink(root, rel);
      if (abs && fs.statSync(abs).size <= 512 * 1024) text = readIndexable(abs, rel);
      cache.set(rel, text);
      return text;
    },
    list(relDir) {
      if (blocked(relDir)) return [];
      try {
        return fs.readdirSync(path.join(root, relDir)).filter((n) => n.endsWith('.md')).sort().map((n) => `${relDir}/${n}`);
      } catch {
        return [];
      }
    },
  };
}

/** Parse a template-shaped markdown doc: title, header metadata and H2 sections. Template guidance comments are dropped. */
export function parseDoc(markdown) {
  if (markdown == null) return null;
  const text = markdown.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const doc = { title: '', verified: '', sections: {} };
  let current = null;
  let fence = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const h = !fence && /^(#{1,2}) (.+?)\s*$/.exec(line);
    if (h && h[1] === '#' && !doc.title) doc.title = h[2];
    else if (h && h[1] === '##') {
      current = h[2];
      doc.sections[current] = [];
    } else if (current) doc.sections[current].push(line);
    else if (/^Last verified against:/i.test(line)) doc.verified = line.replace(/^[^:]+:\s*/, '').trim();
  }
  for (const k of Object.keys(doc.sections)) doc.sections[k] = doc.sections[k].join('\n').trim();
  return doc;
}

/** True when a section has real content: not empty, not a `<placeholder>`, and not a table with only its header rows. */
function hasContent(body) {
  const lines = (body ?? '').trim().split('\n').filter((l) => l.trim());
  if (!lines.length) return false;
  if (lines.length === 1 && /^(<[^>]*>|tbd|todo|n\/a|none yet)$/i.test(lines[0].trim())) return false;
  return !(lines.every((l) => l.trim().startsWith('|')) && lines.length < 3);
}

/* ---------- output definitions ---------- */

/**
 * Each section lists the doc sections it is made of: [file key, heading]. A section is built when at least one
 * piece has real content; otherwise it is reported as a gap.
 */
const CHEATSHEET = [
  { id: 'what', title: 'What it is', audiences: ['everyone'], pieces: [['product', 'Purpose'], ['brief', 'Proposed solution']] },
  { id: 'who', title: 'Who it is for', audiences: ['product'], pieces: [['product', 'Users and personas'], ['product', 'Use cases']] },
  { id: 'how', title: 'How it works', audiences: ['engineering'], pieces: [['architecture', 'Context (C4 level 1)'], ['architecture', 'Containers (C4 level 2)'], ['architecture', 'Key flows']] },
  { id: 'stack', title: 'Stack and components', audiences: ['engineering'], pieces: [['context', 'Stack'], ['context', 'Components']] },
  { id: 'quality', title: 'Quality and security', audiences: ['engineering', 'security'], pieces: [['architecture', 'Quality attributes'], ['architecture', 'Security testing strategy']] },
  { id: 'decisions', title: 'Decisions', audiences: ['everyone'], decisions: true },
  { id: 'status', title: 'Where we are', audiences: ['exec', 'product'], pieces: [['status', 'Gates'], ['status', 'Current focus and next action']] },
  { id: 'risks', title: 'Risks and open questions', audiences: ['exec', 'security'], pieces: [['brief', 'Cost and risk'], ['status', 'Open questions'], ['status', 'Open Critical and High findings']] },
  { id: 'scope', title: 'Constraints and non-goals', audiences: ['product'], pieces: [['product', 'Constraints'], ['product', 'Non-goals']] },
];

const BRIEF = [
  { id: 'problem', title: 'Problem', audiences: ['sponsors'], pieces: [['brief', 'Problem']] },
  { id: 'solution', title: 'Proposed solution', audiences: ['sponsors'], pieces: [['brief', 'Proposed solution']] },
  { id: 'cost', title: 'Cost and risk', audiences: ['sponsors'], pieces: [['brief', 'Cost and risk']] },
  { id: 'decisions-needed', title: 'Decisions needed', audiences: ['sponsors'], pieces: [['brief', 'Decisions needed']] },
  { id: 'status', title: 'Status', audiences: ['sponsors'], pieces: [['brief', 'Status'], ['status', 'Current focus and next action']] },
];

export const OUTPUTS = {
  cheatsheet: { file: 'cheatsheet.html', kind: 'Cheatsheet', spec: CHEATSHEET },
  brief: { file: 'brief.html', kind: 'Brief', spec: BRIEF },
};

function decisionRows(reader) {
  const rows = [];
  for (const rel of reader.list(DECISIONS_DIR)) {
    const doc = parseDoc(reader.read(rel));
    if (!doc) continue;
    const status = /^\s*(?:\*\*)?Status:?(?:\*\*)?:?\s*(.+)$/im.exec(reader.read(rel) ?? '')?.[1]?.trim() ?? '';
    rows.push({ rel, title: doc.title.replace(/^ADR[- ]?\d+[:.\s-]*/i, '') || path.posix.basename(rel, '.md'), status });
  }
  return rows;
}

function buildSections(spec, reader, docs) {
  const sections = [];
  const gaps = [];
  const used = new Set();
  for (const s of spec) {
    let md = '';
    const sources = [];
    if (s.decisions) {
      const rows = decisionRows(reader);
      if (rows.length) {
        md = ['| Decision | Status |', '|---|---|', ...rows.map((r) => `| [${r.title.replace(/[[\]|]/g, ' ')}](${r.rel}) | ${r.status.replace(/\|/g, '/')} |`)].join('\n');
        sources.push(`${DECISIONS_DIR}/`);
        rows.forEach((r) => used.add(r.rel));
      }
    } else {
      for (const [key, heading] of s.pieces) {
        const body = docs[key]?.sections[heading];
        if (!hasContent(body)) continue;
        md += `${md ? '\n\n' : ''}${s.pieces.length > 1 && heading !== s.title ? `### ${heading}\n\n` : ''}${body}`;
        sources.push(`${P[key]} › ${heading}`);
        used.add(P[key]);
      }
    }
    if (md) sections.push({ id: s.id, title: s.title, audiences: s.audiences, html: renderMarkdown(md), source: sources.join('; ') });
    else gaps.push({ title: s.title, source: s.decisions ? `${DECISIONS_DIR}/` : [...new Set(s.pieces.map(([k]) => P[k]))].join(', ') });
  }
  return { sections, gaps, used };
}

/* ---------- build ---------- */

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const readTpl = (name) => fs.readFileSync(path.join(TEMPLATES, name), 'utf8');

/** A real directory inside the project, created if needed; refuses symlinks so output can't leave the project. */
function safeDir(root, rel) {
  let cur = root;
  for (const part of rel.split('/')) {
    cur = path.join(cur, part);
    let st = null;
    try {
      st = fs.lstatSync(cur);
    } catch { /* missing */ }
    if (st && (st.isSymbolicLink() || !st.isDirectory())) throw new Error(`refusing to write through ${path.relative(root, cur)} (symlink or not a directory)`);
    if (!st) fs.mkdirSync(cur);
  }
  return cur;
}

function writeAtomic(dir, name, content) {
  const target = path.join(dir, name);
  try {
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`refusing to overwrite symlink ${name}`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, { mode: 0o644 });
  fs.renameSync(tmp, target);
}

/**
 * Build presentation outputs into docs/present/. Deterministic (no LLM): outputs are re-rendered only when a
 * source file, the theme or the builder changed, or when `force` is set.
 * @returns {{theme: {name: string, source: string}, results: {name: string, file: string, status: 'built'|'unchanged', sections: number, gaps: {title: string, source: string}[]}[]}}
 */
export function buildOutputs(projectDir, { only = Object.keys(OUTPUTS), force = false } = {}) {
  for (const name of only) if (!Object.hasOwn(OUTPUTS, name)) throw new Error(`unknown output "${name}" (available: ${Object.keys(OUTPUTS).join(', ')})`);
  const reader = createReader(projectDir);
  const docs = Object.fromEntries(Object.entries(P).map(([k, rel]) => [k, parseDoc(reader.read(rel))]));
  const { theme, source } = resolveTheme(reader.root);
  const css = themeCss(theme);
  const pageCss = readTpl('page.css');
  const pageTpl = readTpl('page.html');
  const project = docs.product?.title?.replace(/\s+—\s+Product$/, '') || docs.brief?.title?.replace(/\s+—\s+Brief$/, '') || path.basename(reader.root);
  const verified = docs.status?.verified || docs.product?.verified || '';

  const outDir = safeDir(reader.root, OUT_DIR);
  const cacheDir = safeDir(reader.root, MANIFEST_PARTS.join('/'));
  const manifestFile = path.join(cacheDir, 'manifest.json');
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch { /* first build */ }

  const results = [];
  for (const name of only) {
    const def = OUTPUTS[name];
    const { sections, gaps, used } = buildSections(def.spec, reader, docs);
    const inputHash = sha(JSON.stringify([BUILDER_VERSION, name, theme, sections, gaps, project, verified, sha(pageCss + pageTpl)]));
    const exists = fs.existsSync(path.join(outDir, def.file));
    let status = 'unchanged';
    if (force || !exists || manifest[name]?.hash !== inputHash) {
      const html = render(pageTpl, { title: `${project} — ${def.kind}`, css, pageCss, kind: def.kind, project, verified, sections, gaps });
      writeAtomic(outDir, def.file, html);
      status = 'built';
    }
    manifest[name] = { hash: inputHash, sources: [...used].sort() };
    results.push({ name, file: `${OUT_DIR}/${def.file}`, status, sections: sections.length, gaps });
  }
  writeAtomic(cacheDir, 'manifest.json', JSON.stringify(manifest, null, 2));
  return { theme: { name: theme.name, source }, results };
}
