'use strict';
// False positives: read-only git config and text inside quotes, comments and heredoc bodies. Real writes stay denied.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { decide } = require('../guard.js');

const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engguard-p-')));
fs.mkdirSync(path.join(proj, '.eng-team'));
fs.writeFileSync(path.join(proj, '.eng-team', 'state.md'), '# state\n');
test.after(() => fs.rmSync(proj, { recursive: true, force: true }));

const bash = (command) =>
  decide({ agent_type: 'eng-team:eng-builder', cwd: proj, tool_name: 'Bash', tool_input: { command } }, { projectDir: proj });
const main = (command) => decide({ cwd: proj, tool_name: 'Bash', tool_input: { command } }, { projectDir: proj });

test('read-only git config lookups pass', () => {
  for (const c of [
    'git config --get remote.origin.url',
    'git config remote.origin.url',
    'git config get remote.origin.url',
    'git config --global user.email',
    'git config --global --get user.name',
    'git config --get core.hooksPath',
    'git config --show-origin --get-regexp "^url\\."',
    'git config --type bool --get core.bare',
    'git -C sub config --get remote.origin.url',
  ])
    assert.equal(bash(c), null, c);
  assert.equal(main('git config --get remote.origin.url'), null, 'main thread does not prompt on a read');
});

test('git config writes stay denied', () => {
  for (const c of [
    'git config remote.origin.url https://evil.example',
    'git config set remote.origin.url x',
    'git config --add remote.origin.url x',
    'git config --unset url.x.insteadof',
    'git config --global user.email a@b',
    'git config core.hooksPath .h',
    'git config --unset core.hooksPath',
    'git config --get remote.origin.url && git config core.hooksPath /tmp/h',
    'git config --get x $(git config core.hooksPath h)',
    'git config --file .git/config --get core.hooksPath x y',
  ])
    assert.equal(bash(c)?.decision, 'deny', c);
  assert.equal(main('git config remote.origin.url x')?.decision, 'ask');
});

test('a > inside quotes, comments or a literal heredoc body is not a redirect', () => {
  for (const c of [
    "cat > src/a.js <<'EOF'\n// logs go > ~/.cache in dev\nEOF",
    "cat > src/a.jsx <<'EOF'\nconst x = <a>/etc/hosts</a>;\nEOF",
    "mkdir -p src && cat > src/b.sh <<-\"EOF\"\n\techo hi > /etc/motd\n\tEOF",
    'echo hi # > /etc/passwd',
    "printf 'a > /etc/x'",
    "git commit -m 'redirect logs > /var/log/app'",
    'git commit -m "fix: avoid writing > ~/.npmrc"',
    "echo 'pipe it through tee ~/x'",
  ])
    assert.equal(bash(c), null, JSON.stringify(c));
});

test('real redirects and shell re-entry are still scanned', () => {
  for (const c of [
    'echo hi > ~/.bashrc',
    "cat > ~/.bashrc <<'EOF'\nx\nEOF",
    'cat <<EOF > /etc/x\nx\nEOF',
    "cat > a <<'EOF'\nok\nEOF\necho y > ~/.bashrc",
    "bash <<'EOF'\necho > ~/.bashrc\nEOF",
    "bash -c 'echo > ~/.bashrc'",
    "sh -c \"echo hi\" # > /etc/x",
    'cat > a.js <<EOF\n$(echo > ~/.x)\nEOF',
    'echo "$(echo x > ~/.y)"',
    "git -c core.x=1 commit -m 'a > ~/x'",
    "echo \\' ; bash -c 'echo > ~/y'",
    "echo $'\\'' > ~/.bashrc $'\\''",
    'echo x > "$HOME/.bashrc"',
    'cat a | tee ~/.x',
  ])
    assert.equal(bash(c)?.decision, 'deny', JSON.stringify(c));
});
