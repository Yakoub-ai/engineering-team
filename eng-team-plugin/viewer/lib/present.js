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

const SUMMARY = [
  { id: 'purpose', title: 'Purpose', audiences: ['everyone'], pieces: [['product', 'Purpose'], ['brief', 'Proposed solution']] },
  { id: 'users', title: 'Users', audiences: ['product'], pieces: [['product', 'Users and personas'], ['product', 'Stakeholders']] },
  { id: 'features', title: 'What it does', audiences: ['everyone'], pieces: [['product', 'Use cases'], ['product', 'Jobs to be done']] },
  { id: 'how', title: 'How it works', audiences: ['engineering'], pieces: [['architecture', 'Context (C4 level 1)'], ['architecture', 'Containers (C4 level 2)'], ['architecture', 'Key flows']] },
  { id: 'decisions', title: 'Key decisions', audiences: ['everyone'], decisions: true },
  { id: 'success', title: 'Success metrics', audiences: ['exec', 'product'], pieces: [['product', 'Success metrics']] },
  { id: 'scope', title: 'Constraints and non-goals', audiences: ['product'], pieces: [['product', 'Constraints'], ['product', 'Non-goals']] },
  { id: 'status', title: 'Status', audiences: ['exec'], pieces: [['status', 'Gates'], ['status', 'Current focus and next action']] },
];

const DECK = [
  { id: 'problem', title: 'The problem', pieces: [['brief', 'Problem']] },
  { id: 'solution', title: 'The solution', pieces: [['brief', 'Proposed solution'], ['product', 'Purpose']] },
  { id: 'users', title: 'Who it is for', pieces: [['product', 'Users and personas']] },
  { id: 'usecases', title: 'What it does', pieces: [['product', 'Use cases']] },
  { id: 'how', title: 'How it works', pieces: [['architecture', 'Context (C4 level 1)'], ['architecture', 'Containers (C4 level 2)']] },
  { id: 'flows', title: 'Key flows', pieces: [['architecture', 'Key flows']] },
  { id: 'stack', title: 'Stack and components', pieces: [['context', 'Stack'], ['context', 'Components']] },
  { id: 'quality', title: 'Quality and security', pieces: [['architecture', 'Quality attributes'], ['architecture', 'Security testing strategy']] },
  { id: 'decisions', title: 'Key decisions', decisions: true },
  { id: 'success', title: 'Success metrics', pieces: [['product', 'Success metrics']] },
  { id: 'risks', title: 'Risks', pieces: [['brief', 'Cost and risk'], ['status', 'Open Critical and High findings']] },
  { id: 'status', title: 'Where we are', pieces: [['status', 'Gates'], ['status', 'Current focus and next action']] },
  { id: 'asks', title: 'Decisions needed', pieces: [['brief', 'Decisions needed']] },
];

export const OUTPUTS = {
  cheatsheet: { file: 'cheatsheet.html', kind: 'Cheatsheet', spec: CHEATSHEET },
  brief: { file: 'brief.html', kind: 'Brief', spec: BRIEF },
  summary: { file: 'product-summary.html', kind: 'Product summary', spec: SUMMARY },
  deck: { file: 'deck.html', kind: 'Product deck', spec: DECK, layout: 'deck' },
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
      const parts = [];
      for (const [key, heading] of s.pieces) {
        const body = docs[key]?.sections[heading];
        if (!hasContent(body)) continue;
        parts.push({ heading, body });
        sources.push(`${P[key]} › ${heading}`);
        used.add(P[key]);
      }
      // sub-headings only help when several pieces share a section
      md = parts.map((x) => (parts.length > 1 ? `### ${x.heading}\n\n${x.body}` : x.body)).join('\n\n');
    }
    if (md) sections.push({ id: s.id, title: s.title, audiences: s.audiences, md, source: sources.join('; ') });
    else gaps.push({ title: s.title, source: s.decisions ? `${DECISIONS_DIR}/` : [...new Set(s.pieces.map(([k]) => P[k]))].join(', ') });
  }
  return { sections, gaps, used };
}

/* ---------- deck pagination ---------- */

const SLIDE_BUDGET = 700;

/** Split markdown into blocks that must stay together: fenced code, table rows, list items, paragraphs. */
function splitBlocks(md) {
  const blocks = [];
  let cur = null;
  const push = () => { if (cur) blocks.push(cur); cur = null; };
  let fence = false;
  for (const line of md.split('\n')) {
    if (fence) {
      cur.lines.push(line);
      if (/^\s*(```|~~~)/.test(line)) { fence = false; push(); }
      continue;
    }
    if (/^\s*(```|~~~)/.test(line)) { push(); cur = { type: 'code', lines: [line] }; fence = true; continue; }
    if (!line.trim()) { push(); continue; }
    if (line.trim().startsWith('|')) {
      if (cur?.type !== 'table') { push(); cur = { type: 'table', lines: [] }; }
      cur.lines.push(line);
    } else if (/^(\s*)([-*]|\d+\.) /.test(line)) {
      if (!/^\s/.test(line) || cur?.type !== 'list') { push(); cur = { type: 'list', lines: [] }; }
      cur.lines.push(line);
    } else if (cur?.type === 'list' && /^\s/.test(line)) {
      cur.lines.push(line);
    } else {
      if (cur?.type !== 'text') { push(); cur = { type: 'text', lines: [] }; }
      cur.lines.push(line);
    }
  }
  push();
  return blocks;
}

const cost = (b) => (b.type === 'table' ? b.lines.length * 90 : b.type === 'code' ? b.lines.length * 60 : b.lines.join(' ').length + 40);

/** Group a section's markdown into slide-sized chunks; long tables split by row with the header repeated, code is never split. */
export function paginate(md) {
  let units = [];
  for (const b of splitBlocks(md)) {
    if (b.type === 'table' && b.lines.length > 3) {
      const [head, sep, ...rows] = b.lines;
      for (let i = 0; i < rows.length; i += 6) units.push({ type: 'table', lines: [head, sep, ...rows.slice(i, i + 6)] });
    } else units.push(b);
  }
  const pages = [];
  let page = [];
  let used = 0;
  for (const u of units) {
    if (page.length && used + cost(u) > SLIDE_BUDGET) { pages.push(page); page = []; used = 0; }
    page.push(u);
    used += cost(u);
  }
  if (page.length) pages.push(page);
  return pages.map((p) => p.map((b) => b.lines.join('\n')).join('\n\n'));
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
  const baseCss = readTpl('page.css');
  const baseTpl = readTpl('page.html');
  const deckCss = readTpl('deck.css');
  const deckTpl = readTpl('deck.html');
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
    const deck = def.layout === 'deck';
    const pageTpl = deck ? deckTpl : baseTpl;
    const pageCss = deck ? deckCss : baseCss;
    const { sections, gaps, used } = buildSections(def.spec, reader, docs);
    const inputHash = sha(JSON.stringify([BUILDER_VERSION, name, theme, sections, gaps, project, verified, sha(pageCss + pageTpl)]));
    const exists = fs.existsSync(path.join(outDir, def.file));
    let status = 'unchanged';
    let count = sections.length;
    if (force || !exists || manifest[name]?.hash !== inputHash) {
      let data;
      if (deck) {
        const slides = sections.flatMap((sec) => {
          const pages = paginate(sec.md);
          return pages.map((md, i) => ({ id: pages.length > 1 ? `${sec.id}-${i + 1}` : sec.id, title: pages.length > 1 ? `${sec.title} (${i + 1}/${pages.length})` : sec.title, html: renderMarkdown(md), source: sec.source, project }));
        }).map((sl, i, all) => ({ ...sl, n: i + 2, total: all.length + 1 }));
        count = slides.length + 1;
        const tagline = (docs.product?.sections.Purpose || docs.brief?.sections['Proposed solution'] || '').replace(/<!--[\s\S]*?-->/g, '').trim().split(/(?<=[.!?])\s/)[0]?.replace(/^[-*]\s+/, '').replace(/[`*_#>]/g, '') ?? '';
        data = { title: `${project} — ${def.kind}`, css, pageCss, project, verified, tagline, slides };
      } else {
        data = { title: `${project} — ${def.kind}`, css, pageCss, kind: def.kind, project, verified, gaps, sections: sections.map((sec) => ({ ...sec, html: renderMarkdown(sec.md) })) };
      }
      writeAtomic(outDir, def.file, render(pageTpl, data));
      status = 'built';
    }
    manifest[name] = { hash: inputHash, sources: [...used].sort() };
    results.push({ name, file: `${OUT_DIR}/${def.file}`, status, sections: count, gaps });
  }
  writeAtomic(cacheDir, 'manifest.json', JSON.stringify(manifest, null, 2));
  return { theme: { name: theme.name, source }, results };
}
