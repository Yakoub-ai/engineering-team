import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { listPresets, loadPreset, validateTheme, resolveTheme, themeCss, themeSummary } from '../lib/theme.js';
import { render, esc } from '../lib/template.js';

const FONTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fonts');

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eng-theme-'));
  fs.mkdirSync(path.join(dir, 'project', '.eng-team'), { recursive: true });
  process.env.ENG_TEAM_HOME = path.join(dir, 'home');
  return dir;
}

test('every preset validates and renders css', () => {
  assert.ok(listPresets().length >= 5);
  for (const p of listPresets()) {
    const css = themeCss(loadPreset(p));
    assert.match(css, /:root\{--bg:#/);
    assert.match(css, /@font-face/);
  }
});

test('bundled fonts match their checksums', () => {
  for (const line of fs.readFileSync(path.join(FONTS, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
    const [sum, file] = line.split(/\s+/);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(FONTS, file))).digest('hex'), sum, file);
  }
});

test('validateTheme rejects css injection and unknown fonts', () => {
  const ok = loadPreset('clean');
  assert.throws(() => validateTheme({ ...ok, colors: { ...ok.colors, bg: 'red;}body{display:none' } }), /bg/);
  assert.throws(() => validateTheme({ ...ok, fonts: { ...ok.fonts, body: 'Comic Sans' } }), /body/);
  assert.throws(() => loadPreset('../etc/passwd'), /unknown preset/);
});

test('resolveTheme: default, shared, project, and use-shared switch', () => {
  const dir = tmp();
  const project = path.join(dir, 'project');
  assert.equal(resolveTheme(project).source, 'default');

  fs.mkdirSync(process.env.ENG_TEAM_HOME, { recursive: true });
  fs.writeFileSync(path.join(process.env.ENG_TEAM_HOME, 'theme.json'), JSON.stringify({ preset: 'midnight' }));
  assert.deepEqual([resolveTheme(project).source, resolveTheme(project).theme.name], ['shared', 'midnight']);

  const pf = path.join(project, '.eng-team', 'theme.json');
  fs.writeFileSync(pf, JSON.stringify({ preset: 'editorial' }));
  assert.deepEqual([resolveTheme(project).source, resolveTheme(project).theme.name], ['project', 'editorial']);

  fs.writeFileSync(pf, JSON.stringify({ use: 'shared' }));
  assert.equal(resolveTheme(project).theme.name, 'midnight');

  fs.rmSync(process.env.ENG_TEAM_HOME, { recursive: true });
  assert.throws(() => resolveTheme(project), /no shared theme/);
  fs.rmSync(dir, { recursive: true });
});

test('themeSummary lists colors and fonts', () => {
  const s = themeSummary(loadPreset('clean'));
  assert.match(s, /accent: #1f5fbf/);
  assert.match(s, /heading font: Inter/);
});

test('render escapes values, supports each/if and raw', () => {
  assert.equal(render('<p>{{t}}</p>', { t: '<script>x</script>' }), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
  assert.equal(render('{{{h}}}', { h: '<b>ok</b>' }), '<b>ok</b>');
  assert.equal(render('{{#each xs}}[{{n}}{{@index}}]{{/each}}', { xs: [{ n: 'a' }, { n: 'b' }] }), '[a0][b1]');
  assert.equal(render('{{#each xs}}{{this}},{{/each}}', { xs: ['<', 'b'] }), '&lt;,b,');
  assert.equal(render('{{#if a}}Y{{/if}}{{#if b}}N{{/if}}', { a: [1], b: [] }), 'Y');
  assert.equal(render('{{#each s}}{{#each i}}{{this}}{{/each}};{{/each}}', { s: [{ i: [1, 2] }, { i: [3] }] }), '12;3;');
  assert.equal(render('{{missing.x}}|{{__proto__}}', {}), '|');
  assert.equal(esc(null), '');
});
