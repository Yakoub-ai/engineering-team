import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scanProject, classify, parseGitignore } from '../lib/scan.js';
import { copyFixture, cleanup } from './helpers.js';

test('classify maps paths to node kinds', () => {
  const k = (p) => classify(p)?.kind;
  assert.equal(k('docs/engineering/handovers/0001-x.md'), 'handover');
  assert.equal(k('docs/engineering/decisions/0001-x.md'), 'decision');
  assert.equal(k('docs/engineering/specs/s.md'), 'spec');
  assert.equal(k('docs/engineering/plans/p.md'), 'plan');
  assert.equal(k('docs/engineering/STATUS.md'), 'status');
  assert.equal(k('docs/engineering/team-plan.md'), 'team-plan');
  assert.equal(k('README.md'), 'doc');
  assert.equal(k('.eng-team/state.md'), 'state');
  assert.equal(k('src/a.js'), 'code');
  assert.equal(k('infra/Dockerfile'), 'code');
  assert.equal(k('main.tf'), 'code');
  assert.equal(classify('logo.png'), null);
});

test('scanProject applies exclusions', () => {
  const dir = copyFixture();
  try {
    const paths = scanProject(dir).map((e) => e.path);
    assert.ok(paths.includes('src/a.js'));
    assert.ok(paths.includes('docs/guide.md'));
    assert.ok(!paths.some((p) => p.startsWith('.env')), '.env excluded');
    assert.ok(!paths.some((p) => p.includes('node_modules')), 'node_modules excluded');
    assert.ok(!paths.some((p) => p.startsWith('ignored/')), 'gitignored excluded');
  } finally {
    cleanup(dir);
  }
});

test('scanProject skips keys, big files, cache and build dirs', () => {
  const dir = copyFixture();
  try {
    fs.writeFileSync(path.join(dir, 'server.pem'), 'x');
    fs.writeFileSync(path.join(dir, 'id_rsa.md'), 'x');
    fs.writeFileSync(path.join(dir, 'big.js'), 'a'.repeat(513 * 1024));
    for (const d of ['dist', 'build', '.git', '.eng-team/.cache']) {
      fs.mkdirSync(path.join(dir, d), { recursive: true });
      fs.writeFileSync(path.join(dir, d, 'x.md'), '# x');
    }
    const paths = scanProject(dir).map((e) => e.path);
    for (const bad of ['server.pem', 'id_rsa.md', 'big.js', 'dist/x.md', 'build/x.md', '.git/x.md']) {
      assert.ok(!paths.includes(bad), bad);
    }
    assert.ok(!paths.some((p) => p.startsWith('.eng-team/.cache')));
    assert.ok(paths.includes('.eng-team/state.md'));
  } finally {
    cleanup(dir);
  }
});

test('parseGitignore handles anchors, dir-only and globs', () => {
  const ig = parseGitignore('# c\n/top.md\n*.log\ntmp/\ndocs/**/gen.md\n');
  assert.ok(ig('top.md', false));
  assert.ok(!ig('sub/top.md', false));
  assert.ok(ig('a/b/x.log', false));
  assert.ok(ig('tmp', true));
  assert.ok(!ig('tmp', false));
  assert.ok(ig('docs/a/b/gen.md', false));
  assert.ok(ig('docs/gen.md', false));
  assert.ok(!ig('docs/xgen.md', false));
  assert.ok(ig('docs/a/gen.md', false));
});

test('secret-named directories and lockfiles are excluded', () => {
  const dir = copyFixture();
  try {
    fs.mkdirSync(path.join(dir, '.env.d'));
    fs.writeFileSync(path.join(dir, '.env.d', 'x.md'), '# x');
    fs.mkdirSync(path.join(dir, 'keys.key'));
    fs.writeFileSync(path.join(dir, 'keys.key', 'x.md'), '# x');
    for (const f of ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'poetry.lock', 'Cargo.lock', 'composer.lock', 'Gemfile.lock', 'my.lock']) {
      fs.writeFileSync(path.join(dir, f), 'x');
    }
    const paths = scanProject(dir).map((e) => e.path);
    assert.ok(!paths.some((p) => p.startsWith('.env.d') || p.startsWith('keys.key') || /lock/.test(p)), paths.join());
    assert.equal(classify('package-lock.json'), null);
  } finally {
    cleanup(dir);
  }
});
