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
 * @returns {{links: string[], refs: string[], ids: string[]}}
 */
export function extractMentions(text) {
  const links = new Set();
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = m[1].split('#')[0].split('?')[0];
    if (target && !/^[a-z][a-z0-9+.-]*:/i.test(target)) links.add(safeDecode(target));
  }
  const refs = new Set();
  for (const m of text.matchAll(/(?<![\w/.@-])((?:\.{1,2}\/)?[\w@.-]+(?:\/[\w@.-]+)*\.\w+):\d+\b/g)) refs.add(clean(m[1]));
  for (const m of text.matchAll(/`([\w@./-]+\.\w+)(?::\d+)?`/g)) refs.add(clean(m[1]));
  const ids = new Set();
  for (const m of text.matchAll(/\bADR-(\d{1,4})\b/g)) ids.add(`ADR-${pad4(m[1])}`);
  for (const m of text.matchAll(/\b(\d{4})-[a-z]/g)) ids.add(`ADR-${m[1]}`);
  for (const m of text.matchAll(MENTION_RE)) ids.add(m[0]);
  return { links: [...links], refs: [...refs], ids: [...ids] };
}

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
