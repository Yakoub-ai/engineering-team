'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engpol-home-')));
process.env.ENG_TEAM_HOME = home;
const { validate, readPolicy, loosenings, writeGrant, hasGrant, DEFAULTS } = require('../policy.js');
const { record } = require('../intent.js');
const { summary } = require('../session.js');
const { decide } = require('../guard.js');

const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engpol-')));
fs.mkdirSync(path.join(proj, '.eng-team'));
const STATE = path.join(proj, '.eng-team', 'state.md');
const POLICY = path.join(proj, '.eng-team', 'policy.json');
fs.writeFileSync(STATE, '# state\ncurrent_phase: build\nautonomy: gated\n');
test.after(() => {
  fs.rmSync(proj, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

const pol = (o = {}) => JSON.stringify({ ...DEFAULTS, ...o }, null, 2);
const setPolicy = (o) => (o === null ? fs.rmSync(POLICY, { force: true }) : fs.writeFileSync(POLICY, typeof o === 'string' ? o : pol(o)));
let sid = 0;
const session = () => `s-${++sid}`;
const main = (tool_name, tool_input, extra = {}) =>
  decide({ cwd: proj, tool_name, tool_input, session_id: 'none', permission_mode: 'default', ...extra }, { projectDir: proj });
const writePolicy = (content, extra) => main('Write', { file_path: POLICY, content }, extra);
const expand = (session_id, command_name, command_args = '') =>
  record({ hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', session_id, command_name, command_args });

test('validate: accepts the defaults and rejects bad shapes', () => {
  assert.deepEqual(validate({ ...DEFAULTS }), []);
  assert.deepEqual(validate({ version: 1, max_mode: 'gated' }), []);
  for (const bad of [null, [], 'x', { version: 2, max_mode: 'gated' }, { version: 1, max_mode: 'yolo' }, { version: 1, max_mode: 'gated', extra: 1 },
    { version: 1, max_mode: 'gated', destructive_extra: [''] }, { version: 1, max_mode: 'gated', credentials_scoped: 'yes' },
    { version: 1, max_mode: 'gated', approval_ttl_hours: 0 }, { version: 1, max_mode: 'gated', approval_ttl_hours: 500 }])
    assert.ok(validate(bad).length > 0, JSON.stringify(bad));
});

test('readPolicy: missing and invalid fail closed to gated defaults', () => {
  setPolicy(null);
  assert.equal(readPolicy(proj).state, 'missing');
  setPolicy('{not json');
  assert.deepEqual([readPolicy(proj).state, readPolicy(proj).policy.max_mode], ['invalid', 'gated']);
  setPolicy({ max_mode: 'yolo' });
  assert.equal(readPolicy(proj).policy.max_mode, 'gated');
  setPolicy({ max_mode: 'autonomous' });
  assert.deepEqual([readPolicy(proj).state, readPolicy(proj).policy.max_mode], ['ok', 'autonomous']);
  setPolicy(null);
});

test('loosenings: only changes that give something up', () => {
  const base = { ...DEFAULTS, human_required_paths: ['infra/**'], destructive_extra: ['make nuke'] };
  assert.deepEqual(loosenings(base, { ...base, destructive_extra: ['make nuke', 'x'], approval_ttl_hours: 4 }), []);
  const l = loosenings(base, { ...base, max_mode: 'autonomous', human_required_paths: [], destructive_extra: [], credentials_scoped: true, approval_ttl_hours: 48 });
  assert.equal(l.length, 5);
});

test('grants: per session, per kind, expire', () => {
  const s = session();
  assert.equal(hasGrant(s, 'policy'), false);
  writeGrant(s, 'policy');
  assert.equal(hasGrant(s, 'policy'), true);
  assert.equal(hasGrant(s, 'autonomous'), false);
  assert.equal(hasGrant('other', 'policy'), false);
  assert.equal(hasGrant(s, 'policy', Date.now() + 31 * 60 * 1000), false);
  assert.equal(writeGrant('', 'policy'), false);
  assert.equal(writeGrant(s, 'root'), false);
});

test('intent: only user-typed eng-team commands grant', () => {
  const s = session();
  assert.deepEqual(expand(s, 'eng-team:eng-policy', 'raise max_mode'), ['policy']);
  assert.deepEqual(expand(s, 'eng-team:eng', '--autonomous build the api'), ['autonomous']);
  assert.deepEqual(expand(session(), 'eng-team:eng-build', 'x --auto'), ['autonomous']);
  assert.deepEqual(expand(session(), 'eng-team:eng', 'say --autonomously'), []);
  assert.deepEqual(expand(session(), 'other:eng-policy'), []);
  assert.deepEqual(expand(session(), 'deploy', '--autonomous'), []);
  assert.deepEqual(record({ hook_event_name: 'UserPromptSubmit', session_id: 'x', command_name: 'eng-team:eng-policy' }), []);
  assert.deepEqual(record({ hook_event_name: 'UserPromptExpansion', expansion_type: 'mcp_prompt', session_id: 'x', command_name: 'eng-policy' }), []);
});

test('policy.json: create is allowed, loosening the defaults asks', () => {
  setPolicy(null);
  assert.equal(writePolicy(pol()), null);
  assert.equal(writePolicy(pol({ destructive_extra: ['make nuke'] })), null);
  assert.equal(writePolicy(pol({ max_mode: 'autonomous' }))?.decision, 'ask');
  assert.equal(writePolicy(pol({ max_mode: 'autonomous' }), { permission_mode: 'bypassPermissions' })?.decision, 'deny');
  assert.equal(writePolicy('{bad')?.decision, 'deny');
  assert.equal(writePolicy(pol({ max_mode: 'yolo' }))?.decision, 'deny');
  assert.equal(main('Write', { file_path: POLICY })?.decision, 'deny');
});

test('policy.json: changes need the user-typed command; loosening still asks', () => {
  setPolicy({ human_required_paths: ['infra/**'] });
  const tighten = pol({ human_required_paths: ['infra/**', 'auth/**'] });
  assert.match(writePolicy(tighten)?.reason, /type \/eng-team:eng-policy/);
  const s = session();
  expand(s, 'eng-team:eng-policy');
  assert.equal(writePolicy(tighten, { session_id: s }), null);
  assert.equal(writePolicy(pol(), { session_id: s })?.decision, 'ask');
  assert.equal(writePolicy(pol(), { session_id: s, permission_mode: 'dontAsk' })?.decision, 'deny');
  const edit = { file_path: POLICY, old_string: '"max_mode": "gated"', new_string: '"max_mode": "autonomous"' };
  assert.equal(main('Edit', edit)?.decision, 'deny');
  assert.equal(main('Edit', edit, { session_id: s })?.decision, 'ask');
  assert.equal(main('Edit', { ...edit, new_string: '"max_mode": "root"' }, { session_id: s })?.decision, 'deny');
  setPolicy(null);
});

test('policy.json: subagents and Bash cannot touch it', () => {
  setPolicy({});
  const s = session();
  expand(s, 'eng-team:eng-policy');
  const sub = decide({ agent_type: 'eng-team:eng-builder', cwd: proj, session_id: s, tool_name: 'Write', tool_input: { file_path: POLICY, content: pol() } }, { projectDir: proj });
  assert.equal(sub?.decision, 'deny');
  for (const c of [`echo '{}' > .eng-team/policy.json`, `cp /tmp/p .eng-team/policy.json`, `node -e "require('fs').writeFileSync('.eng-team/policy.json','{}')"`])
    assert.equal(main('Bash', { command: c }, { session_id: s })?.decision, 'deny', c);
  setPolicy(null);
});

test('autonomous: needs policy, max_mode, and the user-typed flag', () => {
  const toAuto = { file_path: STATE, old_string: 'autonomy: gated', new_string: 'autonomy: autonomous' };
  const s = session();
  setPolicy(null);
  assert.match(main('Edit', toAuto, { session_id: s })?.reason, /needs a valid \.eng-team\/policy\.json/);
  setPolicy({});
  assert.match(main('Edit', toAuto, { session_id: s })?.reason, /caps this project at gated/);
  setPolicy({ max_mode: 'autonomous' });
  assert.match(main('Edit', toAuto, { session_id: s })?.reason, /user types --autonomous/);
  expand(s, 'eng-team:eng', '--autonomous');
  assert.equal(main('Edit', toAuto, { session_id: s }), null);
  assert.equal(main('Write', { file_path: path.join(proj, '.eng-team', 'profile.md'), content: 'owner: x\nautonomy: autonomous  # stated\n' }, { session_id: 'other' })?.decision, 'deny');
  assert.equal(main('Edit', { file_path: STATE, old_string: 'current_phase: build', new_string: 'current_phase: test' }), null);
  assert.equal(main('Bash', { command: "sed -i 's/autonomy: gated/autonomy: autonomous/' .eng-team/state.md" })?.decision, 'deny');
  fs.writeFileSync(STATE, '# state\nautonomy: autonomous\n');
  assert.equal(main('Edit', { file_path: STATE, old_string: 'autonomy: autonomous', new_string: 'autonomy: gated' }), null);
  fs.writeFileSync(STATE, '# state\ncurrent_phase: build\nautonomy: gated\n');
  setPolicy(null);
});

test('grants store is protected', () => {
  for (const c of [`echo x > ${home}/.eng-team/grants/a.json`, 'touch ~/.eng-team/grants/a.json', 'cp a $HOME/.eng-team/grants/'])
    assert.equal(main('Bash', { command: c })?.decision, 'deny', c);
  assert.equal(main('Write', { file_path: path.join(home, '.eng-team', 'grants', 'x.json'), content: '{}' })?.decision, 'deny');
});

test('destructive_extra from the policy is enforced', () => {
  setPolicy({ destructive_extra: ['make  nuke', 'wp db reset'] });
  assert.equal(main('Bash', { command: 'make nuke' })?.decision, 'deny');
  assert.equal(main('Bash', { command: 'wp   db reset --yes' })?.decision, 'deny');
  assert.equal(main('Bash', { command: 'make build' }), null);
  setPolicy(null);
});

test('session summary: warns and fails closed when the policy is missing or invalid', () => {
  setPolicy(null);
  assert.match(summary(proj).systemMessage, /no \.eng-team\/policy\.json\. Running gated/);
  setPolicy('{bad');
  assert.match(summary(proj).systemMessage, /invalid/);
  setPolicy({ max_mode: 'autonomous' });
  const ok = summary(proj);
  assert.equal(ok.systemMessage, undefined);
  assert.match(ok.context, /max_mode autonomous/);
  assert.equal(summary(home), null);
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'session.js')], { input: JSON.stringify({ cwd: proj }), env: { ...process.env, CLAUDE_PROJECT_DIR: proj }, encoding: 'utf8' });
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.hookEventName, 'SessionStart');
  setPolicy(null);
});
