import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractItems, extractMentions, extractImports } from '../lib/links.js';

test('extractItems finds plan tasks, findings, questions and use cases', () => {
  const plan = '# P\n\n### T1: One\n\nbody\n\n### Task T2 - Two\n\n| R-01 | risk |\n';
  const ids = extractItems(plan, 'plan').map((i) => i.itemId);
  assert.deepEqual(ids, ['T1', 'T2', 'R-01']);
  const report = '# R\n\n### SEC-001: Token\n\ntext\n\n- **Q-2** question here\n- UC-3 a use case\n';
  const items = extractItems(report, 'doc');
  assert.deepEqual(items.map((i) => [i.itemId, i.kind]), [['SEC-001', 'finding'], ['Q-2', 'question'], ['UC-3', 'use-case']]);
  assert.equal(items[0].line, 3);
  assert.match(items[0].text, /text/);
});

test('extractItems ignores plan-task ids outside plans', () => {
  assert.deepEqual(extractItems('### T1: x\n', 'doc'), []);
});

test('extractMentions finds links, refs and ids', () => {
  const md = 'See [a](./x.md#top) and [web](https://e.com). Code at `src/a.js:3` and src/b.js:10, plus `docs/y.md`. ADR-0003, 0004-foo, SEC-002, Q-1.';
  const m = extractMentions(md);
  assert.deepEqual(m.links, ['./x.md']);
  assert.deepEqual([...m.refs].sort(), ['docs/y.md', 'src/a.js', 'src/b.js']);
  for (const id of ['ADR-0003', 'ADR-0004', 'SEC-002', 'Q-1']) assert.ok(m.ids.includes(id), id);
});

test('extractImports handles js and python relative imports only', () => {
  const js = "import a from './a.js';\nimport 'pkg';\nconst b = require('../b');\nexport * from \"./c\";\n";
  assert.deepEqual(extractImports(js, 'js'), ['./a.js', '../b', './c']);
  const py = 'import os\nfrom .mod import x\nfrom ..pkg.sub import y\nfrom . import z\n';
  assert.deepEqual(extractImports(py, 'py'), ['.mod', '..pkg.sub', '.:z']);
});
