'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { check, markSessionStart } = require('../stop.js');
const { enqueue } = require('../queue.js');

const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engstop-')));
const cache = path.join(proj, '.eng-team', '.cache');
const receipts = path.join(proj, 'docs', 'engineering', 'receipts');
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(receipts, { recursive: true });
fs.writeFileSync(path.join(proj, '.eng-team', 'state.md'), '# state\n');
test.after(() => fs.rmSync(proj, { recursive: true, force: true }));

const T0 = Date.now() - 60_000;
markSessionStart(proj, 'sess', T0);
const log = (agent, msAgo) =>
  fs.appendFileSync(path.join(cache, 'dispatch-log.jsonl'), JSON.stringify({ ts: new Date(Date.now() - msAgo).toISOString(), event: 'dispatch', agent }) + '\n');
const GOOD = `# Change receipt — build (2026-10-29)

## Objective
Add export.

## Changed
- T1 export endpoint

## Verified
- \`npm test\` → 42 passed

## Not verified
- DAST not run (no staging)

## Approvals needed
none
`;
const receipt = (text, name = '2026-10-29-build.md') => fs.writeFileSync(path.join(receipts, name), text);
const stop = (extra = {}) => check({ session_id: 'sess', ...extra }, proj);

test('no code change this session: no receipt needed', () => {
  log('eng-security-engineer', 1000);
  log('eng-builder', 10 * 60_000); // before this session started
  assert.equal(stop(), null);
  assert.equal(check({ session_id: 'never-started' }, proj), null);
});

test('a builder ran: stop is blocked until a fresh receipt with evidence exists', () => {
  log('eng-builder', 5000);
  assert.match(stop(), /no change receipt since then/);
  assert.equal(stop({ stop_hook_active: true }), null);
  receipt(GOOD.replace('- `npm test` → 42 passed', '- tests passed'));
  assert.match(stop(), /Verified section names no command/);
  receipt(GOOD.replace(/## Not verified\n[^\n]*\n/, '## Not verified\n<!-- guidance: x -->\n'));
  assert.match(stop(), /missing sections: Not verified/);
  receipt(GOOD);
  assert.equal(stop(), null);
});

test('pending approvals must be listed in the receipt', () => {
  enqueue(proj, { command: 'terraform destroy', reason: 'terraform' });
  assert.match(stop(), /pending approvals Q-001 are not in the receipt/);
  receipt(GOOD.replace('none', 'Q-001 | pending | terraform destroy'));
  assert.equal(stop(), null);
});

test('stop.js prints a block decision and stays silent outside eng-team projects', () => {
  log('eng-tester', 0);
  const run = (cwd) =>
    spawnSync(process.execPath, [path.join(__dirname, '..', 'stop.js')], { input: JSON.stringify({ session_id: 'sess', cwd }), env: { ...process.env, CLAUDE_PROJECT_DIR: cwd }, encoding: 'utf8' });
  const r = run(proj);
  assert.equal(JSON.parse(r.stdout).decision, 'block');
  assert.equal(run(os.tmpdir()).stdout, '');
});
