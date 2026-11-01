'use strict';
/**
 * Local branch deletes the guard can prove lose nothing. Only a plain
 * `git branch -d|-D <one literal name>` qualifies; everything else stays a
 * destructive command. A commit counts as kept when another branch contains
 * it, or when the default or current branch has the same patch (cherry-pick). Git is run read-only with argument arrays (no shell),
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

/** Full refnames of the default branch(es) and the current branch, excluding `name`. */
function upstreams(cwd, name) {
  const out = [];
  const add = (ref) => {
    if (ref && ref !== `refs/heads/${name}` && !out.includes(ref) && git(cwd, ['rev-parse', '--verify', '--quiet', ref]).code === 0) out.push(ref);
  };
  const od = git(cwd, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
  if (od.code === 0) add(od.out);
  for (const d of DEFAULTS) add(`refs/heads/${d}`);
  const head = git(cwd, ['symbolic-ref', '--quiet', 'HEAD']);
  if (head.code === 0) add(head.out);
  return out;
}

/** True when every commit on `name` is in another branch, or its patch is on the default or current branch. */
function branchSafe(cwd, name) {
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
  if (refs.out.split('\n').some((r) => r && r !== `refs/heads/${name}` && !/^refs\/remotes\/[^/]+\/HEAD$/.test(r))) return true;
  // Cherry-picked work has new hashes: compare patches against the default and current branch.
  const ups = upstreams(cwd, name);
  if (!ups.length) return false;
  const others = git(cwd, ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes']);
  if (others.code !== 0) return false;
  const not = others.out.split('\n').filter((r) => r && r !== `refs/heads/${name}` && !/\/HEAD$/.test(r));
  // A unique merge commit may carry its own changes; patch-ids cannot vouch for it.
  const merges = git(cwd, ['rev-list', '--merges', tip.out, '--not', ...not]);
  if (merges.code !== 0 || merges.out) return false;
  const uniq = git(cwd, ['rev-list', tip.out, '--not', ...not]);
  if (uniq.code !== 0) return false;
  const left = new Set(uniq.out.split('\n').filter(Boolean));
  for (const up of ups) {
    const ch = git(cwd, ['cherry', up, tip.out]);
    if (ch.code !== 0) continue;
    for (const line of ch.out.split('\n')) if (line.startsWith('- ')) left.delete(line.slice(2).trim());
  }
  return left.size === 0;
}

/**
 * True when `cmd` deletes one local branch that is not current or default and
 * whose commits are all kept elsewhere (see branchSafe).
 */
const losslessBranchDelete = (cmd, cwd) => branchSafe(cwd, branchOf(cmd));

/** True when a queued plain branch delete's branch no longer exists (git answers "missing", not an error). */
function branchGone(cmd, cwd) {
  const name = branchOf(cmd);
  if (!name) return false;
  return git(cwd, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]).code === 1 && git(cwd, ['rev-parse', '--git-dir']).code === 0;
}

module.exports = { git, branchOf, branchSafe, losslessBranchDelete, branchGone };
