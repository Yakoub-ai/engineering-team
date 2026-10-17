'use strict';
/* eng-team viewer UI. Plain browser JS, no external requests.
   Untrusted text is only ever inserted with textContent; the single innerHTML
   use is the server-rendered (already escaped) markdown in renderDoc. */
(function () {
  const KIND_COLORS = {
    doc: '#8a8a86', handover: '#e07b39', decision: '#9065b0', spec: '#2383e2', plan: '#0f9d76',
    'plan-task': '#7bc9ad', finding: '#d44c47', question: '#cb912f', 'use-case': '#d15796',
    code: '#529cca', status: '#448361', 'team-plan': '#a0852a', state: '#b0b0ac',
  };
  const ITEM_KINDS = new Set(['plan-task', 'finding', 'question', 'use-case']);
  const SEMANTIC = new Set(['semantic', 'lexical']);
  const GROUPS = [
    ['Overview', (n) => n.kind === 'status' || n.kind === 'team-plan' || /(^|\/)questions\.md$/.test(n.path)],
    ['Product', (n) => n.kind !== 'code' && /(^|\/)(product|prd|use-cases?)(\/|[-_.])/i.test(n.path)],
    ['Specs', (n) => n.kind === 'spec'],
    ['Plans', (n) => n.kind === 'plan'],
    ['Decisions', (n) => n.kind === 'decision'],
    ['Handovers', (n) => n.kind === 'handover'],
    ['Security & reviews', (n) => n.kind !== 'code' && /(^|\/)(security|reviews?|audits?)(\/|[-_.])/i.test(n.path)],
    ['Other docs', (n) => n.kind === 'doc' || n.kind === 'state'],
    ['Code', (n) => n.kind === 'code'],
  ];

  const $ = (id) => document.getElementById(id);
  const state = { graph: null, byId: new Map(), byPath: new Map(), view: null, current: null, highlight: new Set(), edit: null, mapStop: null };

  /* ---------- helpers ---------- */

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }

  async function api(path, opts) {
    const res = await fetch(path, opts);
    let body = null;
    try { body = await res.json(); } catch (e) { /* non-JSON error body */ }
    if (!res.ok) {
      const err = new Error((body && body.error) || `request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  const enc = encodeURIComponent;
  const baseName = (p) => p.split('/').pop();
  const isTyping = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);

  function nodeHref(n) {
    return n.kind === 'code' ? `#/code/${enc(n.path)}${n.line ? `?line=${n.line}` : ''}` : `#/doc/${enc(n.path)}`;
  }

  function openNode(n) {
    location.hash = nodeHref(n);
  }

  /* ---------- routing ---------- */

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [pathPart, query = ''] = raw.split('?');
    const [kind, ...rest] = pathPart.split('/');
    let arg = '';
    try { arg = decodeURIComponent(rest.join('/')); } catch (e) { arg = ''; }
    return { kind: kind || 'home', arg, params: new URLSearchParams(query) };
  }

  async function route() {
    if (!state.graph) return;
    stopMap();
    state.edit = null;
    const { kind, arg, params } = parseHash();
    $('main').classList.toggle('map-mode', kind === 'map');
    setActiveNav(kind);
    try {
      if (kind === 'doc' && arg) await showDoc(arg);
      else if (kind === 'code' && arg) await showCode(arg, Number(params.get('line')) || 0);
      else if (kind === 'map') showMap();
      else if (kind === 'timeline') await showTimeline();
      else await showHome();
    } catch (err) {
      setMain(h('p', { class: 'notice', text: err.message }));
      setSide(null);
    }
    markCurrent();
  }

  function setActiveNav(kind) {
    for (const b of document.querySelectorAll('.views button')) b.classList.toggle('active', b.dataset.view === kind);
  }

  function setMain(...kids) {
    const main = $('main');
    main.replaceChildren(...kids);
    main.scrollTop = 0;
  }

  function setSide(el) {
    $('side').replaceChildren(...(el ? [el] : []));
  }

  /* ---------- sidebar tree + search ---------- */

  function buildTree() {
    const files = state.graph.nodes.filter((n) => n.id === n.path);
    const used = new Set();
    const tree = $('tree');
    tree.replaceChildren();
    for (const [name, test] of GROUPS) {
      const members = files.filter((n) => !used.has(n.id) && test(n));
      members.forEach((n) => used.add(n.id));
      if (!members.length) continue;
      members.sort(name === 'Handovers' ? byHandover : (a, b) => (a.path < b.path ? -1 : 1));
      const details = h('details', { class: 'group' },
        h('summary', {}, name, h('span', { class: 'count', text: ` (${members.length})` })),
        members.map((n) => treeItem(n)));
      if (name !== 'Code') details.open = true;
      tree.append(details);
    }
  }

  function byHandover(a, b) {
    const num = (n) => Number((/^(\d+)/.exec(baseName(n.path)) || [])[1] || Infinity);
    return num(a) - num(b) || (a.path < b.path ? -1 : 1);
  }

  function treeItem(n) {
    return h('a', { class: 'item', href: nodeHref(n), title: n.path, 'data-path': n.path },
      n.title || baseName(n.path));
  }

  function markCurrent() {
    const cur = state.current;
    for (const a of $('tree').querySelectorAll('.item')) a.classList.toggle('current', a.dataset.path === cur);
  }

  let searchTimer = null;
  async function runSearch() {
    const q = $('search').value.trim();
    const box = $('results');
    if (!q) {
      state.highlight = new Set();
      box.hidden = true;
      $('tree').hidden = false;
      box.replaceChildren();
      if (state.mapRedraw) state.mapRedraw();
      return;
    }
    let data;
    try { data = await api(`/api/search?q=${enc(q)}&limit=20`); } catch (err) {
      box.replaceChildren(h('div', { class: 'empty', text: err.message }));
      box.hidden = false;
      return;
    }
    if ($('search').value.trim() !== q) return;
    state.highlight = new Set(data.results.map((r) => r.node.id));
    $('tree').hidden = true;
    box.hidden = false;
    box.replaceChildren(...(data.results.length
      ? data.results.map((r) => h('a', { class: 'item', href: nodeHref(r.node), title: r.node.id },
        h('span', { class: 'score', text: r.score.toFixed(2) }), r.node.title || r.node.id,
        h('span', { class: 'sub', text: r.node.kind })))
      : [h('div', { class: 'empty', text: 'No matches' })]));
    if (state.mapRedraw) state.mapRedraw();
  }

  /* ---------- doc view ---------- */

  function homeNode() {
    return state.graph.nodes.find((n) => n.path === 'docs/engineering/STATUS.md')
      || state.graph.nodes.find((n) => /^readme(\.md)?$/i.test(n.path));
  }

  async function showHome() {
    const home = homeNode();
    if (!home) {
      state.current = null;
      setMain(h('h1', { text: 'eng-team viewer' }), h('p', { text: 'No STATUS.md or README found. Pick a document from the sidebar.' }));
      setSide(null);
      return;
    }
    await showDoc(home.path);
  }

  async function showDoc(p) {
    state.current = p;
    const node = state.byPath.get(p);
    if (node && node.kind === 'code') return showCode(p, 0);
    const doc = await api(`/api/doc?path=${enc(p)}`);
    renderDoc(doc);
    loadSide(p);
  }

  function renderDoc(doc) {
    const body = h('div', { class: 'doc' });
    body.innerHTML = doc.html; // server-rendered, escaped markdown (spec B4)
    const bar = h('div', { class: 'toolbar' }, h('span', { class: 'path', text: doc.path }));
    const status = h('span', { class: 'notice ok' });
    if (doc.editable) {
      bar.append(status, h('button', { type: 'button', id: 'edit-btn', onclick: () => startEdit(doc) }, 'Edit'));
    } else {
      bar.append(h('span', { class: 'badge', text: 'read-only' }));
    }
    state.edit = { doc, active: false };
    setMain(bar, body);
  }

  function startEdit(doc) {
    if (!state.edit || state.edit.active) return;
    state.edit.active = true;
    const area = h('textarea', { class: 'editor', spellcheck: 'false', 'aria-label': 'Markdown source' });
    area.value = doc.markdown;
    const msg = h('span', { class: 'notice' });
    const save = h('button', { type: 'button', class: 'primary', onclick: () => saveEdit(doc, area, msg, save) }, 'Save');
    const cancel = h('button', { type: 'button', onclick: () => renderDoc(doc) }, 'Cancel');
    const bar = h('div', { class: 'toolbar' }, h('span', { class: 'path', text: doc.path }), msg, save, cancel);
    $('main').replaceChildren(bar, area);
    area.focus();
  }

  async function saveEdit(doc, area, msg, saveBtn) {
    saveBtn.disabled = true;
    msg.textContent = 'Saving...';
    try {
      const updated = await api(`/api/doc?path=${enc(doc.path)}`, {
        method: 'PUT',
        headers: { 'X-Eng-View': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: area.value, ...(typeof doc.mtime === 'number' ? { baseMtime: doc.mtime } : {}) }),
      });
      await refreshGraph();
      renderDoc(updated);
      loadSide(updated.path);
    } catch (err) {
      msg.textContent = err.status === 409
        ? 'This file changed on disk. Cancel and reopen it to reload the latest version before saving.'
        : `Save failed: ${err.message}`;
      saveBtn.disabled = err.status === 409;
    }
  }

  function toggleEdit() {
    const btn = $('edit-btn');
    if (btn) btn.click();
  }

  /* ---------- code view ---------- */

  async function showCode(p, line) {
    state.current = p;
    const code = await api(`/api/code?path=${enc(p)}`);
    const lines = code.text.split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    const gutter = h('pre', { class: 'gutter', text: lines.map((_, i) => i + 1).join('\n') });
    const src = h('pre', { class: 'src', text: lines.join('\n') });
    const box = h('div', { class: 'codebox' }, gutter, src);
    if (line > 0 && line <= lines.length) box.append(h('div', { class: 'hl', id: 'code-hl' }));
    const abs = `${state.graph.project.replace(/\/$/, '')}/${code.path}`;
    const editor = h('a', { href: `vscode://file/${encodeURI(abs)}:${line || 1}`, text: 'open in editor' });
    const bar = h('div', { class: 'toolbar' }, h('span', { class: 'path', text: `${code.path}  (${code.language})` }),
      h('span', { class: 'badge', text: 'read-only' }), editor);
    setMain(bar, box);
    const hl = $('code-hl');
    if (hl) {
      hl.style.top = `calc(10px + ${line - 1} * 1.5em)`;
      hl.scrollIntoView({ block: 'center' });
    }
    loadSide(p);
  }

  /* ---------- backlinks / related ---------- */

  async function loadSide(p) {
    const ids = state.graph.nodes.filter((n) => n.path === p).map((n) => n.id);
    if (!ids.length) return setSide(null);
    const infos = await Promise.all(ids.map((id) => api(`/api/node?id=${enc(id)}`).catch(() => null)));
    if (state.current !== p) return;
    const mine = new Set(ids);
    const incoming = [];
    const outgoing = [];
    const related = new Map();
    for (const info of infos.filter(Boolean)) {
      for (const e of info.incoming) {
        if (SEMANTIC.has(e.type)) addRelated(related, e.from, e);
        else if (!mine.has(e.from)) incoming.push(e);
      }
      for (const e of info.outgoing) {
        if (SEMANTIC.has(e.type)) addRelated(related, e.to, e);
        else if (!mine.has(e.to) && e.type !== 'contains') outgoing.push(e);
      }
    }
    const root = h('div', { class: 'side-section' },
      sideList('Backlinks', dedupe(incoming, 'from').map((e) => edgeRow(e.from, e.type))),
      sideList('Links out', dedupe(outgoing, 'to').map((e) => edgeRow(e.to, e.type))),
      sideList('Related', [...related.values()].sort((a, b) => b.score - a.score).slice(0, 12)
        .map((r) => edgeRow(r.id, r.type, r.score))));
    setSide(root);
  }

  function addRelated(map, id, e) {
    const prev = map.get(id);
    if (!prev || (e.score || 0) > prev.score) map.set(id, { id, type: e.type, score: e.score || 0 });
  }

  function dedupe(edges, key) {
    const seen = new Set();
    return edges.filter((e) => (seen.has(e[key]) ? false : seen.add(e[key])));
  }

  function sideList(title, rows) {
    return h('div', {}, h('h3', { text: title }), rows.length ? rows : h('div', { class: 'empty', text: 'None' }));
  }

  function edgeRow(id, type, score) {
    const n = state.byId.get(id);
    if (!n) return h('div', { class: 'empty', text: id });
    return h('a', { class: 'item', href: nodeHref(n), title: n.id },
      score != null && h('span', { class: 'score', text: score.toFixed(2) }),
      h('span', { class: 'badge', text: type }), n.title || n.id);
  }

  /* ---------- timeline ---------- */

  async function showTimeline() {
    state.current = null;
    const data = await api('/api/timeline');
    const items = data.handovers.map((n) => h('li', {},
      h('span', { class: 'num', text: (/^(\d+)/.exec(baseName(n.path)) || [])[1] || '' }),
      h('a', { class: 'title', href: nodeHref(n), text: n.title || baseName(n.path) }),
      h('span', { class: 'summary', text: n.summary || '' })));
    setMain(h('h1', { text: 'Handover timeline' }),
      items.length ? h('ol', { class: 'timeline' }, items) : h('p', { text: 'No handovers yet.' }));
    setSide(null);
  }

  /* ---------- map ---------- */

  function stopMap() {
    if (state.mapStop) state.mapStop();
    state.mapStop = null;
    state.mapRedraw = null;
  }

  function showMap() {
    state.current = null;
    setSide(null);
    const all = state.graph.nodes;
    const kinds = [...new Set(all.map((n) => n.kind))].sort();
    const hideItems = all.length > 300;
    const enabled = new Set(kinds.filter((k) => !(hideItems && ITEM_KINDS.has(k))));
    const canvas = h('canvas', { class: 'map-canvas', tabindex: '0', 'aria-label': 'Project graph' });
    const bar = h('div', { class: 'map-bar' }, kinds.map((k) => {
      const box = h('input', { type: 'checkbox' });
      box.checked = enabled.has(k);
      box.addEventListener('change', () => { box.checked ? enabled.add(k) : enabled.delete(k); sim.rebuild(); });
      const sw = h('span', { class: 'swatch' });
      sw.style.background = KIND_COLORS[k] || '#888';
      return h('label', {}, box, sw, k);
    }));
    setMain(h('div', { class: 'map-wrap' }, bar, canvas,
      h('div', { class: 'map-hint', text: 'Drag to pan, scroll to zoom, click a node to open. Solid = explicit link, dashed = semantic/lexical similarity.' })));
    const sim = createMap(canvas, enabled);
    state.mapStop = sim.stop;
    state.mapRedraw = sim.draw;
  }

  function createMap(canvas, enabled) {
    const ctx = canvas.getContext('2d');
    const view = { x: 0, y: 0, k: 1 };
    let nodes = [];
    let edges = [];
    let alpha = 1;
    let raf = 0;
    let hover = null;
    let dragging = null;
    let moved = false;
    let w = 0;
    let h2 = 0;
    const colors = {};

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      for (const k of ['--fg', '--fg-soft', '--edge', '--edge-faint', '--accent', '--bg']) colors[k] = cs.getPropertyValue(k).trim();
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = r.width;
      h2 = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h2 * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function rebuild() {
      const old = new Map(nodes.map((n) => [n.id, n]));
      nodes = state.graph.nodes.filter((n) => enabled.has(n.kind)).map((n) => {
        const prev = old.get(n.id);
        const a = Math.random() * Math.PI * 2;
        const r = 60 + Math.random() * 120;
        return prev || { id: n.id, kind: n.kind, title: n.title || n.id, x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0, deg: 0 };
      });
      const byId = new Map(nodes.map((n) => [n.id, n]));
      edges = [];
      for (const e of state.graph.edges) {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (a && b) edges.push({ a, b, soft: SEMANTIC.has(e.type), score: e.score || 0 });
      }
      nodes.forEach((n) => { n.deg = 0; });
      edges.forEach((e) => { e.a.deg++; e.b.deg++; });
      alpha = 1;
      kick();
    }

    function step() {
      const n = nodes.length;
      for (let i = 0; i < n; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < n; j++) {
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 > 90000) continue;
          if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          const f = (1800 / d2) * alpha;
          const d = Math.sqrt(d2);
          a.vx += (dx / d) * f; a.vy += (dy / d) * f;
          b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
        }
      }
      for (const e of edges) {
        const dx = e.b.x - e.a.x;
        const dy = e.b.y - e.a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const rest = e.soft ? 140 : 70;
        const f = ((d - rest) / d) * (e.soft ? 0.01 : 0.04) * alpha;
        e.a.vx += dx * f; e.a.vy += dy * f;
        e.b.vx -= dx * f; e.b.vy -= dy * f;
      }
      for (const a of nodes) {
        if (a === dragging) { a.vx = 0; a.vy = 0; continue; }
        a.vx = (a.vx - a.x * 0.01 * alpha) * 0.85;
        a.vy = (a.vy - a.y * 0.01 * alpha) * 0.85;
        a.x += a.vx; a.y += a.vy;
      }
      alpha *= 0.985;
    }

    function radius(n) { return 4 + Math.min(8, Math.sqrt(n.deg) * 1.6); }
    const sx = (x) => w / 2 + view.x + x * view.k;
    const sy = (y) => h2 / 2 + view.y + y * view.k;

    function draw() {
      readColors();
      ctx.clearRect(0, 0, w, h2);
      ctx.lineWidth = 1;
      for (const soft of [false, true]) {
        ctx.beginPath();
        ctx.setLineDash(soft ? [4, 4] : []);
        ctx.strokeStyle = soft ? colors['--edge-faint'] : colors['--edge'];
        for (const e of edges) {
          if (e.soft !== soft) continue;
          ctx.moveTo(sx(e.a.x), sy(e.a.y));
          ctx.lineTo(sx(e.b.x), sy(e.b.y));
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      const dim = state.highlight.size > 0;
      for (const n of nodes) {
        const hit = state.highlight.has(n.id);
        ctx.globalAlpha = dim && !hit ? 0.25 : 1;
        ctx.fillStyle = KIND_COLORS[n.kind] || '#888';
        ctx.beginPath();
        ctx.arc(sx(n.x), sy(n.y), radius(n) * Math.sqrt(view.k), 0, Math.PI * 2);
        ctx.fill();
        if (hit || n === hover) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = colors['--accent'];
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = colors['--fg'];
      for (const n of nodes) {
        const show = n === hover || state.highlight.has(n.id) || (view.k > 1.4 && n.deg > 1);
        if (show) ctx.fillText(n.title.slice(0, 40), sx(n.x) + 8, sy(n.y) + 4);
      }
    }

    function frame() {
      raf = 0;
      for (let i = 0; i < 2 && alpha > 0.02; i++) step();
      draw();
      if (alpha > 0.02 || dragging) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }

    function pick(ev) {
      const r = canvas.getBoundingClientRect();
      const mx = ev.clientX - r.left;
      const my = ev.clientY - r.top;
      let best = null;
      let bestD = 1e9;
      for (const n of nodes) {
        const d = Math.hypot(sx(n.x) - mx, sy(n.y) - my);
        if (d < radius(n) * Math.sqrt(view.k) + 4 && d < bestD) { best = n; bestD = d; }
      }
      return best;
    }

    canvas.addEventListener('pointerdown', (ev) => {
      canvas.setPointerCapture(ev.pointerId);
      moved = false;
      dragging = pick(ev);
      canvas.dataset.lastX = ev.clientX;
      canvas.dataset.lastY = ev.clientY;
      canvas.dataset.down = '1';
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (canvas.dataset.down) {
        const dx = ev.clientX - Number(canvas.dataset.lastX);
        const dy = ev.clientY - Number(canvas.dataset.lastY);
        if (Math.abs(dx) + Math.abs(dy) > 0) moved = true;
        canvas.dataset.lastX = ev.clientX;
        canvas.dataset.lastY = ev.clientY;
        if (dragging) {
          dragging.x += dx / view.k; dragging.y += dy / view.k;
          alpha = Math.max(alpha, 0.3);
        } else { view.x += dx; view.y += dy; }
        kick();
        draw();
        return;
      }
      const n = pick(ev);
      if (n !== hover) {
        hover = n;
        canvas.title = n ? `${n.title} (${n.kind})` : '';
        draw();
      }
    });
    canvas.addEventListener('pointerup', (ev) => {
      const clicked = !moved ? pick(ev) : null;
      delete canvas.dataset.down;
      dragging = null;
      if (clicked) {
        const node = state.byId.get(clicked.id);
        if (node) openNode(node);
      }
    });
    canvas.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const f = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      view.k = Math.min(6, Math.max(0.2, view.k * f));
      draw();
    }, { passive: false });

    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    rebuild();
    requestAnimationFrame(resize);

    return {
      rebuild,
      draw,
      stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        alpha = 0;
        window.removeEventListener('resize', onResize);
      },
    };
  }

  /* ---------- wiring ---------- */

  function indexGraph(graph) {
    state.graph = graph;
    state.byId = new Map(graph.nodes.map((n) => [n.id, n]));
    state.byPath = new Map();
    for (const n of graph.nodes) if (n.id === n.path) state.byPath.set(n.path, n);
  }

  async function refreshGraph() {
    indexGraph(await api('/api/graph'));
    buildTree();
    markCurrent();
  }

  function onContentClick(ev) {
    const a = ev.target.closest && ev.target.closest('a');
    if (!a || !$('main').contains(a)) return;
    const p = a.getAttribute('data-path');
    if (p) {
      ev.preventDefault();
      const node = state.byPath.get(p);
      location.hash = node ? nodeHref(node) : `#/doc/${enc(p)}`;
    } else if ((a.getAttribute('href') || '').startsWith('#') && !(a.getAttribute('href') || '').startsWith('#/')) {
      ev.preventDefault();
      const target = document.getElementById(a.getAttribute('href').slice(1));
      if (target) target.scrollIntoView();
    }
  }

  function onKey(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === 'Escape' && document.activeElement === $('search')) {
      $('search').value = '';
      $('search').blur();
      runSearch();
      return;
    }
    if (isTyping()) return;
    if (ev.key === '/') { ev.preventDefault(); $('search').focus(); }
    else if (ev.key === 'e') toggleEdit();
    else if (ev.key === 'g') location.hash = '#/map';
  }

  async function init() {
    document.addEventListener('click', onContentClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', route);
    $('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 150); });
    $('search').addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const first = $('results').querySelector('a.item');
      if (first) { location.hash = first.getAttribute('href'); first.blur(); }
    });
    $('nav-home').addEventListener('click', () => {
      if (location.hash === '#/home') route();
      else location.hash = '#/home';
    });
    $('nav-map').addEventListener('click', () => { location.hash = '#/map'; });
    $('nav-timeline').addEventListener('click', () => { location.hash = '#/timeline'; });
    try {
      await refreshGraph();
      $('project-name').textContent = baseName(state.graph.project);
      document.title = `${baseName(state.graph.project)} - eng-team viewer`;
    } catch (err) {
      setMain(h('p', { class: 'notice', text: `Could not load the project index: ${err.message}` }));
      return;
    }
    route();
  }

  init();
})();
