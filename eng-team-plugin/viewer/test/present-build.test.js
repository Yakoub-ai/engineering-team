import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildOutputs, parseDoc } from '../lib/present.js';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'eng-view.js');

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eng-present-'));
  process.env.ENG_TEAM_HOME = path.join(dir, 'no-home');
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

const BRIEF = '# Acme — Brief\n\nLast verified against: abc123\n\n## Problem\n<!-- guidance: drop me -->\nUsers wait <script>alert(1)</script> days.\n\n## Proposed solution\nA portal.\n\n## Cost and risk\n\n## Decisions needed\n1. Pick a cloud.\n';
const PRODUCT = '# Acme — Product\n\n## Purpose\nWhy it exists.\n\n## Use cases\n| ID | Actor |\n|---|---|\n';

test('parseDoc splits sections, drops guidance comments and ignores headings in code fences', () => {
  const d = parseDoc('# T\nLast verified against: x1\n\n## A\n<!-- g -->\nbody\n```\n## not a heading\n```\n\n## B\n');
  assert.equal(d.title, 'T');
  assert.equal(d.verified, 'x1');
  assert.deepEqual(Object.keys(d.sections), ['A', 'B']);
  assert.match(d.sections.A, /not a heading/);
  assert.doesNotMatch(d.sections.A, /drop|g -->/);
});

test('build writes escaped, script-free outputs, reports gaps, and is incremental', () => {
  const dir = project({
    'docs/engineering/product/brief.md': BRIEF,
    'docs/engineering/product/product.md': PRODUCT,
    'docs/engineering/decisions/0001-sqlite.md': '# ADR-0001: Use SQLite\n\nStatus: Accepted\n',
  });
  try {
    const first = buildOutputs(dir);
    assert.deepEqual(first.results.map((r) => r.status), ['built', 'built', 'built', 'built']);
    const html = fs.readFileSync(path.join(dir, 'docs/present/brief.html'), 'utf8');
    assert.match(html, /&lt;script&gt;alert\(1\)/);
    assert.doesNotMatch(html, /<script/i);
    assert.match(html, /Content-Security-Policy/);
    assert.match(html, /<h1>Acme<\/h1>/);
    assert.doesNotMatch(html, /Verified against|class="(kicker|tags|source)"/);
    assert.doesNotMatch(html, /drop me/);
    const cheat = first.results.find((r) => r.name === 'cheatsheet');
    assert.ok(cheat.gaps.some((g) => g.title === 'How it works'));
    assert.ok(!cheat.gaps.some((g) => g.title === 'Decisions'));
    assert.match(fs.readFileSync(path.join(dir, 'docs/present/cheatsheet.html'), 'utf8'), /Use SQLite/);

    assert.deepEqual(buildOutputs(dir).results.map((r) => r.status), ['unchanged', 'unchanged', 'unchanged', 'unchanged']);

    fs.appendFileSync(path.join(dir, 'docs/engineering/product/brief.md'), '2. Pick a region.\n');
    const third = buildOutputs(dir).results;
    assert.equal(third.find((r) => r.name === 'brief').status, 'built');
    assert.equal(third.find((r) => r.name === 'cheatsheet').status, 'unchanged');

    assert.equal(buildOutputs(dir, { force: true, only: ['brief'] }).results[0].status, 'built');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a table with only its header rows counts as a gap', () => {
  const dir = project({ 'docs/engineering/product/product.md': PRODUCT });
  try {
    const cheat = buildOutputs(dir, { only: ['cheatsheet'] }).results[0];
    assert.ok(cheat.gaps.some((g) => g.title === 'Who it is for'));
    assert.ok(!cheat.gaps.some((g) => g.title === 'What it is'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('gitignored, secret-bearing and symlinked sources are not read', () => {
  const dir = project({
    '.gitignore': 'docs/engineering/product/\n',
    'docs/engineering/product/brief.md': BRIEF,
    'docs/engineering/architecture.md': '# A\n\n## Key flows\nkey ghp_abcdefghijklmnopqrstuvwxyz0123456789 here\n',
  });
  try {
    const r = buildOutputs(dir, { only: ['brief'] }).results[0];
    assert.equal(r.sections, 0);
    const c = buildOutputs(dir, { only: ['cheatsheet'] }).results[0];
    assert.ok(c.gaps.some((g) => g.title === 'How it works'));
    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'docs/present/cheatsheet.html'), 'utf8'), /ghp_/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('refuses to write output through a symlinked docs/present', () => {
  const dir = project({ 'docs/engineering/product/brief.md': BRIEF });
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'eng-elsewhere-'));
  try {
    fs.symlinkSync(elsewhere, path.join(dir, 'docs/present'));
    assert.throws(() => buildOutputs(dir), /refusing to write/);
    assert.deepEqual(fs.readdirSync(elsewhere), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(elsewhere, { recursive: true, force: true });
  }
});

test('theme changes rebuild; unknown output is rejected', () => {
  const dir = project({ 'docs/engineering/product/brief.md': BRIEF });
  try {
    buildOutputs(dir, { only: ['brief'] });
    fs.mkdirSync(path.join(dir, '.eng-team'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.eng-team', 'theme.json'), JSON.stringify({ preset: 'midnight' }));
    const r = buildOutputs(dir, { only: ['brief'] });
    assert.equal(r.results[0].status, 'built');
    assert.deepEqual(r.theme, { name: 'midnight', source: 'project' });
    assert.throws(() => buildOutputs(dir, { only: ['nope'] }), /unknown output/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cli build prints status and gap lines', () => {
  const dir = project({ 'docs/engineering/product/brief.md': BRIEF });
  try {
    const r = spawnSync('node', [BIN, 'build', '--project', dir, '--only', 'brief'], { encoding: 'utf8', env: { ...process.env, ENG_TEAM_HOME: path.join(dir, 'no-home') } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /eng-view: built docs\/present\/brief\.html \(\d+ sections, \d+ gaps\)/);
    assert.match(r.stdout, /eng-view: gap brief: Cost and risk/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('deck paginates long sections into slides and summary builds; both stay script-free', async () => {
  const { paginate } = await import('../lib/present.js');
  const long = ['| a | b |', '|---|---|', ...Array.from({ length: 14 }, (_, i) => `| r${i} | v |`)].join('\n');
  const pages = paginate(long);
  assert.ok(pages.length >= 3);
  assert.ok(pages.every((p) => p.startsWith('| a | b |\n|---|---|')), 'header repeats on every slide');
  assert.equal(paginate('```\n' + 'x\n'.repeat(30) + '```').length, 1, 'code is never split');

  const rows = Array.from({ length: 30 }, (_, i) => `- point number ${i} with some words to take space`).join('\n');
  const dir = project({
    'docs/engineering/product/brief.md': `# Acme — Brief\n\n## Problem\n${rows}\n\n## Proposed solution\nA portal. It is fast.\n`,
    'docs/engineering/product/product.md': '# Acme — Product\n\n## Purpose\nAcme makes approvals quick. Really.\n',
  });
  try {
    const r = buildOutputs(dir, { only: ['deck', 'summary'] });
    assert.deepEqual(r.results.map((x) => x.status), ['built', 'built']);
    const deck = fs.readFileSync(path.join(dir, 'docs/present/deck.html'), 'utf8');
    assert.match(deck, /The problem \(1\/\d+\)/);
    assert.doesNotMatch(deck, /tagline|kicker|Verified against/);
    assert.match(deck, /\d+ \/ \d+/);
    assert.doesNotMatch(deck, /<script/i);
    assert.match(deck, /Content-Security-Policy/);
    assert.match(fs.readFileSync(path.join(dir, 'docs/present/product-summary.html'), 'utf8'), /Purpose/);
    assert.deepEqual(buildOutputs(dir, { only: ['deck', 'summary'] }).results.map((x) => x.status), ['unchanged', 'unchanged']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
