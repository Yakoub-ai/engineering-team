import path from 'node:path';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for HTML content and attribute values. */
function esc(text) {
  return text.replace(/[&<>"']/g, (c) => ESC[c]);
}

/* ---------- links ---------- */

/** Resolve a relative link against the document; null when it leaves the project. */
function projectPath(target, basePath) {
  const clean = target.split('#')[0].split('?')[0];
  if (!clean) return null;
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch { /* keep raw */ }
  const joined = decoded.startsWith('/')
    ? decoded.slice(1)
    : path.posix.join(path.posix.dirname(basePath || ''), decoded);
  const norm = path.posix.normalize(joined);
  if (!norm || norm === '.' || norm === '..' || norm.startsWith('../') || norm.includes('\0')) return null;
  return norm;
}

function renderLink(label, target, basePath) {
  const url = target.trim();
  if (url.startsWith('#')) return `<a href="${esc(url)}">${label}</a>`;
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return label;
  const rel = projectPath(url, basePath);
  return rel ? `<a href="#" data-path="${esc(rel)}">${label}</a>` : label;
}

/* ---------- inline ---------- */

const MARK = '\u0000';

/** Render inline markup of raw text; stashed fragments are restored at the end. */
function inline(raw, basePath, stash = []) {
  let text = raw.split(MARK).join('');
  const hold = (html) => `${MARK}${stash.push(html) - 1}${MARK}`;
  text = text.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (m, ticks, code) => hold(`<code>${esc(code.trim())}</code>`));
  text = text.replace(/\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g, (m, label, url) => (
    hold(renderLink(inlineEmphasis(label, stash), url, basePath))
  ));
  text = inlineEmphasis(text, stash);
  return restore(text, stash);
}

function inlineEmphasis(text, stash) {
  let out = text.split(MARK).map((part, i) => (i % 2 ? part : esc(part))).join(MARK);
  out = out.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>');
  out = out.replace(/\*(?=[^\s*])([\s\S]*?[^\s*])\*/g, '<em>$1</em>');
  out = out.replace(/(^|[^\w])_(?=[^\s_])([\s\S]*?[^\s_])_(?!\w)/g, '$1<em>$2</em>');
  out = out.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
  return out;
}

function restore(text, stash) {
  let out = text;
  for (let i = 0; i < 5 && out.includes(MARK); i++) {
    out = out.replace(/\u0000(\d+)\u0000/g, (m, n) => stash[Number(n)] ?? '');
  }
  return out;
}

/* ---------- blocks ---------- */

const RE_FENCE = /^\s*```\s*([\w+-]*)/;
const RE_HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RE_HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const RE_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const RE_TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function isBlockStart(line, next) {
  return RE_FENCE.test(line) || RE_HEADING.test(line) || RE_HR.test(line) || RE_ITEM.test(line)
    || /^\s*>/.test(line) || isTableStart(line, next);
}

function isTableStart(line, next) {
  return line.includes('|') && next !== undefined && next.includes('-') && RE_TABLE_SEP.test(next);
}

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

function alignOf(cell) {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  return left ? 'left' : right ? 'right' : '';
}

function renderTable(lines, i, basePath) {
  const head = splitRow(lines[i]);
  const aligns = splitRow(lines[i + 1]).map(alignOf);
  const cell = (tag, text, n) => {
    const cls = aligns[n] ? ` class="align-${aligns[n]}"` : '';
    return `<${tag}${cls}>${inline(text, basePath)}</${tag}>`;
  };
  let j = i + 2;
  const rows = [];
  while (j < lines.length && lines[j].includes('|') && lines[j].trim()) {
    const cells = splitRow(lines[j]);
    rows.push(`<tr>${head.map((_, n) => cell('td', cells[n] ?? '', n)).join('')}</tr>`);
    j++;
  }
  const thead = `<thead><tr>${head.map((h, n) => cell('th', h, n)).join('')}</tr></thead>`;
  return { html: `<table>${thead}<tbody>${rows.join('')}</tbody></table>`, next: j };
}

function renderFence(lines, i) {
  const lang = RE_FENCE.exec(lines[i])[1];
  const body = [];
  let j = i + 1;
  while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) body.push(lines[j++]);
  const cls = lang ? ` class="language-${esc(lang)}"` : '';
  return { html: `<pre><code${cls}>${esc(body.join('\n'))}</code></pre>`, next: j + 1 };
}

function renderList(lines, i, basePath) {
  const items = [];
  let j = i;
  while (j < lines.length) {
    const m = RE_ITEM.exec(lines[j]);
    if (m) {
      const item = { indent: m[1].replace(/\t/g, '    ').length, ordered: /\d/.test(m[2]), text: m[3], children: [] };
      if (items.length && item.indent === items[0].indent && item.ordered !== items[0].ordered) break;
      items.push(item);
    } else if (lines[j].trim() && /^\s+/.test(lines[j]) && items.length) {
      items[items.length - 1].text += ` ${lines[j].trim()}`;
    } else if (!lines[j].trim() && RE_ITEM.test(lines[j + 1] ?? '')) {
      // blank line between items of the same list
    } else break;
    j++;
  }
  return { html: listHtml(nestItems(items), basePath), next: j };
}

function nestItems(items) {
  const root = { indent: -1, children: [] };
  const stack = [root];
  for (const item of items) {
    while (stack.length > 1 && stack[stack.length - 1].indent >= item.indent) stack.pop();
    stack[stack.length - 1].children.push(item);
    stack.push(item);
  }
  return root.children;
}

function listHtml(items, basePath) {
  if (!items.length) return '';
  const tag = items[0].ordered ? 'ol' : 'ul';
  const lis = items.map((it) => `<li>${itemText(it.text, basePath)}${listHtml(it.children, basePath)}</li>`);
  return `<${tag}>${lis.join('')}</${tag}>`;
}

function itemText(text, basePath) {
  const task = /^\[([ xX])\]\s+(.*)$/.exec(text);
  if (!task) return inline(text, basePath);
  const checked = task[1] === ' ' ? '' : ' checked';
  return `<input type="checkbox" disabled${checked}> ${inline(task[2], basePath)}`;
}

function renderQuote(lines, i, basePath) {
  const body = [];
  let j = i;
  while (j < lines.length && /^\s*>/.test(lines[j])) body.push(lines[j++].replace(/^\s*> ?/, ''));
  return { html: `<blockquote>${renderBlocks(body, basePath)}</blockquote>`, next: j };
}

function renderParagraph(lines, i, basePath) {
  const buf = [lines[i]];
  let j = i + 1;
  while (j < lines.length && lines[j].trim() && !isBlockStart(lines[j], lines[j + 1])) buf.push(lines[j++]);
  return { html: `<p>${inline(buf.map((l) => l.trim()).join(' '), basePath)}</p>`, next: j };
}

function renderBlocks(lines, basePath) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let res;
    let m;
    if (!line.trim()) { i++; continue; }
    if (RE_FENCE.test(line)) res = renderFence(lines, i);
    else if ((m = RE_HEADING.exec(line))) res = { html: `<h${m[1].length}>${inline(m[2], basePath)}</h${m[1].length}>`, next: i + 1 };
    else if (RE_HR.test(line)) res = { html: '<hr>', next: i + 1 };
    else if (/^\s*>/.test(line)) res = renderQuote(lines, i, basePath);
    else if (isTableStart(line, lines[i + 1])) res = renderTable(lines, i, basePath);
    else if (RE_ITEM.test(line)) res = renderList(lines, i, basePath);
    else res = renderParagraph(lines, i, basePath);
    out.push(res.html);
    i = res.next;
  }
  return out.join('\n');
}

/**
 * Render markdown to HTML (spec B4). All text is HTML-escaped and raw HTML is
 * never passed through. Links to files inside the project become
 * `<a href="#" data-path="rel/path">`; http(s)/mailto links open in a new tab;
 * every other scheme (javascript:, data:, ...) is dropped to plain text.
 * @param {string} markdown
 * @param {{basePath?: string}} [opts] basePath = project-relative path of the
 *   document, used to resolve relative links
 * @returns {string} HTML
 */
export function renderMarkdown(markdown, { basePath = '' } = {}) {
  return renderBlocks(String(markdown).replace(/\r\n?/g, '\n').split('\n'), basePath);
}
