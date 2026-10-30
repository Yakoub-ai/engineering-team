'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { welcome } = require('../session.js');

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engwelcome-')));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('welcome shows once, then never again', () => {
  const dir = path.join(tmp, 'data');
  assert.match(welcome(dir), /eng-init --tour/);
  assert.equal(welcome(dir), null);
});

test('welcome stays silent when the marker cannot be written', () => {
  const file = path.join(tmp, 'afile');
  fs.writeFileSync(file, 'x');
  assert.equal(welcome(path.join(file, 'sub')), null);
});

test('hook prints the welcome once as a systemMessage outside eng-team projects', () => {
  const data = path.join(tmp, 'plugin-data');
  const proj = path.join(tmp, 'plain');
  fs.mkdirSync(proj);
  const run = () =>
    spawnSync(process.execPath, [path.join(__dirname, '..', 'session.js')], {
      input: JSON.stringify({ cwd: proj, session_id: 's1' }),
      env: { ...process.env, CLAUDE_PLUGIN_DATA: data, CLAUDE_PROJECT_DIR: proj, ENG_TEAM_NO_WELCOME: '' },
      encoding: 'utf8',
    });
  const first = JSON.parse(run().stdout);
  assert.match(first.systemMessage, /eng-init --tour/);
  assert.equal(run().stdout, '');
});

test('ENG_TEAM_NO_WELCOME disables it', () => {
  process.env.ENG_TEAM_NO_WELCOME = '1';
  try {
    assert.equal(welcome(path.join(tmp, 'off')), null);
  } finally {
    delete process.env.ENG_TEAM_NO_WELCOME;
  }
});
