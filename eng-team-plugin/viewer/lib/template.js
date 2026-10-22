const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for HTML content and attribute values. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

function lookup(scope, expr) {
  let cur = scope;
  for (const part of expr.split('.')) {
    if (cur == null || typeof cur !== 'object' || !Object.hasOwn(cur, part)) return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Minimal deterministic template engine, no code execution.
 *   {{path}}        HTML-escaped value
 *   {{{path}}}      raw value (only for HTML the build itself produced)
 *   {{#each path}}...{{/each}}   repeat for each item; inside, `this` is the item and `@index` its position
 *   {{#if path}}...{{/if}}       render when truthy (non-empty array counts as truthy)
 * Unknown paths render as empty.
 */
export function render(tpl, data) {
  const open = /\{\{#(each|if) ([\w.]+)\}\}/g;
  const tag = /\{\{(#(?:each|if) [\w.]+|\/(?:each|if))\}\}/g;
  let out = '';
  let pos = 0;
  for (let m; (m = open.exec(tpl)); ) {
    // find the matching close tag by depth counting, so nested blocks resolve against their own scope
    tag.lastIndex = open.lastIndex;
    let depth = 1;
    let end = -1;
    for (let t; (t = tag.exec(tpl)); ) {
      depth += t[1].startsWith('#') ? 1 : -1;
      if (depth === 0) { end = t.index; break; }
    }
    if (end < 0) throw new Error(`unclosed {{#${m[1]} ${m[2]}}} block`);
    const body = tpl.slice(open.lastIndex, end);
    out += renderValues(tpl.slice(pos, m.index), data);
    const v = lookup(data, m[2]);
    if (m[1] === 'if') {
      if (Array.isArray(v) ? v.length : v) out += render(body, data);
    } else if (Array.isArray(v)) {
      out += v.map((item, idx) => render(body, typeof item === 'object' && item
        ? { ...data, ...item, '@index': idx }
        : { ...data, this: item, '@index': idx })).join('');
    }
    pos = end + tag.lastIndex - end;
    open.lastIndex = pos;
  }
  return out + renderValues(tpl.slice(pos), data);
}

function renderValues(tpl, data) {
  return tpl
    .replace(/\{\{\{([\w.@]+)\}\}\}/g, (_m, p) => String(lookup(data, p) ?? ''))
    .replace(/\{\{([\w.@]+)\}\}/g, (_m, p) => esc(lookup(data, p)));
}
