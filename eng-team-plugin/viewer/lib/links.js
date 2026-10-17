/** Finding-ID prefixes used by the plugin's agents. */
export const FINDING_PREFIXES = ['SEC', 'CMP', 'DAT', 'PLT', 'SRE', 'QA', 'INT', 'AI', 'PRD', 'LEAD', 'RES', 'ARC', 'BLD', 'TST', 'DOC'];

const ITEM_ID = `(?:(?:${FINDING_PREFIXES.join('|')})-\\d+|Q-\\d+|UC-\\d+|T\\d+|F\\d+|R-\\d+)`;
const DEF_RE = new RegExp(`^\\s*(#{1,6}\\s+|\\|\\s*|[-*+]\\s+)(?:\\*\\*|__|\`)?(?:Task\\s+|Finding\\s+)?(${ITEM_ID})\\b`);
const MENTION_RE = new RegExp(`\\b${ITEM_ID}\\b`, 'g');

function itemKind(id, fileKind) {
  if (/^(T|F)\d+$/.test(id) || /^R-/.test(id)) return fileKind === 'plan' ? 'plan-task' : null;
  if (id.startsWith('Q-')) return 'question';
  if (id.startsWith('UC-')) return 'use-case';
  return 'finding';
}

function itemTitle(line) {
  return line
    .replace(/^\s*(#{1,6}\s+|[-*+]\s+)/, '')
    .replace(/[|*_`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/**
 * Find in-file items (plan tasks, findings, questions, use cases) defined by
 * a heading, table row or list item that starts with their ID.
 * @param {string} text markdown
 * @param {string} fileKind node kind of the file (plan-task ids only count in plans)
 * @returns {{itemId: string, kind: string, line: number, title: string, text: string}[]}
 */
export function extractItems(text, fileKind) {
  const lines = text.split(/\r?\n/);
  const defs = [];
  const seen = new Set();
  lines.forEach((l, i) => {
    const m = DEF_RE.exec(l);
    if (!m) return;
    const kind = itemKind(m[2], fileKind);
    if (!kind || seen.has(m[2])) return;
    seen.add(m[2]);
    defs.push({ itemId: m[2], kind, idx: i, heading: m[1].startsWith('#') });
  });
  const isDef = new Set(defs.map((d) => d.idx));
  return defs.map((d) => {
    let end = d.idx + 1;
    if (d.heading) {
      while (end < lines.length && !isDef.has(end) && !/^#{1,6}\s/.test(lines[end])) end++;
    }
    const body = lines.slice(d.idx, end).join('\n').trim();
    return { itemId: d.itemId, kind: d.kind, line: d.idx + 1, title: itemTitle(lines[d.idx]), text: body };
  });
}

const pad4 = (n) => String(n).padStart(4, '0');

/**
 * Extract unresolved mentions from markdown.
 * @param {string} text
 * @returns {{links: string[], refs: string[], ids: string[], slugs: string[]}} slugs are bare
 *   `NNNN-slug` tokens; callers match them only against existing decision file names
 */
export function extractMentions(text) {
  const links = new Set();
  for (const m of text.matchAll(/\[[^\]]{0,300}\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = m[1].split('#')[0].split('?')[0];
    if (target && !/^[a-z][a-z0-9+.-]*:/i.test(target)) links.add(safeDecode(target));
  }
  const refs = new Set();
  for (const token of text.split(/[\s`'"()[\]<>,]+/)) {
    if (token.length > 300) continue;
    const m = PATH_LINE_RE.exec(token.replace(/[.;!?]+$/, ''));
    if (m) refs.add(clean(m[1]));
  }
  for (const m of text.matchAll(/`([^`\n]{1,300})`/g)) {
    const r = PATH_RE.exec(m[1]);
    if (r) refs.add(clean(r[1]));
  }
  const ids = new Set();
  for (const m of text.matchAll(/\bADR[-\s](\d{1,4})\b/g)) ids.add(`ADR-${pad4(m[1])}`);
  for (const m of text.matchAll(/decisions\/(\d{1,4})-/g)) ids.add(`ADR-${pad4(m[1])}`);
  const slugs = new Set();
  for (const m of text.matchAll(/(?<![\w-])(\d{4}-[a-z][a-z0-9]*(?:-[a-z0-9]+)*)/g)) slugs.add(m[1]);
  for (const m of text.matchAll(MENTION_RE)) ids.add(m[0]);
  return { links: [...links], refs: [...refs], ids: [...ids], slugs: [...slugs] };
}

const PATH_PART = '((?:\\.{1,2}\\/)?(?:[\\w@-][\\w@.-]*\\/)*[\\w@-][\\w@.-]*\\.\\w+)';
const PATH_LINE_RE = new RegExp(`^${PATH_PART}:\\d+$`);
const PATH_RE = new RegExp(`^${PATH_PART}(?::\\d+)?$`);
const clean = (p) => p.replace(/^\.\//, '');

function safeDecode(s) {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}

/**
 * Extract relative import specifiers from source code.
 * JS/TS: raw specifiers starting with "."; Python: ".mod", "..pkg.sub" or
 * ".:name" for `from . import name`.
 * @param {string} text
 * @param {'js'|'py'} lang
 * @returns {string[]}
 */
export function extractImports(text, lang) {
  const out = [];
  if (lang === 'js') {
    for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"\n]+)['"]/g)) {
      if (m[1].startsWith('.')) out.push(m[1]);
    }
  } else if (lang === 'py') {
    for (const m of text.matchAll(/^\s*from\s+(\.+[\w.]*)\s+import\s+(.+)$/gm)) {
      if (/^\.+$/.test(m[1])) {
        for (const name of m[2].replace(/[()]/g, '').split(',')) {
          const n = name.trim().split(/\s+as\s+/)[0];
          if (n && n !== '*') out.push(`${m[1]}:${n}`);
        }
      } else out.push(m[1]);
    }
  }
  return [...new Set(out)];
}
