'use strict';
/**
 * Local branch deletes the guard can prove lose nothing. Only a plain
 * `git branch -d|-D <one literal name>` qualifies; everything else stays a
 * destructive command. Git is run read-only with argument arrays (no shell),
 * repo hooks and fsmonitor off, and any error means "not proven".
 */
const { execFileSync } = require('node:child_process');

const BRANCH_DELETE = /^\s*git\s+branch\s+(?:-d|-D|--delete|--delete\s+--force|--force\s+--delete|-d\s+--force|-D\s+--force)\s+([A-Za-z0-9][\w./-]{0,200})\s*$/;
const DEFAULTS = new Set(['main', 'master', 'develop', 'trunk']);

/** @returns {string|null} the branch a plain single-branch delete names */
const branchOf = (cmd) => {
  const m = BRANCH_DELETE.exec(String(cmd || ''));
  return m ? m[1] : null;
};

/** Run git read-only. @returns {{code: number, out: string}} */
function git(cwd, args) {
  try {
    const out = execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', ...args], {
      cwd,
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
    });
    return { code: 0, out: out.trim() };
  } catch (e) {
    return { code: typeof e.status === 'number' ? e.status : -1, out: '' };
  }
}

/**
 * True when `cmd` deletes one local branch that is not current or default and
 * whose tip is contained in another local or remote-tracking branch.
 */
function losslessBranchDelete(cmd, cwd) {
  const name = branchOf(cmd);
  if (!name || DEFAULTS.has(name)) return false;
  if (git(cwd, ['check-ref-format', '--branch', name]).code !== 0) return false;
  const tip = git(cwd, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}^{commit}`]);
  if (tip.code !== 0 || !/^[0-9a-f]{40,64}$/.test(tip.out)) return false;
  const head = git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  if (head.code === 0 && head.out === name) return false;
  const remoteDefault = git(cwd, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (remoteDefault.code === 0 && remoteDefault.out.replace(/^origin\//, '') === name) return false;
  const refs = git(cwd, ['for-each-ref', '--contains', tip.out, '--format=%(refname)', 'refs/heads', 'refs/remotes']);
  if (refs.code !== 0) return false;
  return refs.out.split('\n').some((r) => r && r !== `refs/heads/${name}` && !/^refs\/remotes\/[^/]+\/HEAD$/.test(r));
}

/** True when a queued plain branch delete's branch no longer exists (git answers "missing", not an error). */
function branchGone(cmd, cwd) {
  const name = branchOf(cmd);
  if (!name) return false;
  return git(cwd, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]).code === 1 && git(cwd, ['rev-parse', '--git-dir']).code === 0;
}

module.exports = { branchOf, losslessBranchDelete, branchGone };
