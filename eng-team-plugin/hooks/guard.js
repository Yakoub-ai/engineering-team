'use strict';
/**
 * eng-team PreToolUse guard.
 *
 * Deterministic enforcement of SKILL.md rules 5 and 7 for eng-team subagents,
 * plus a confirmation prompt for pushes/deploys on the main thread inside
 * eng-team projects.
 *
 * HONESTY NOTE: this is defense in depth, not a sandbox. Bash commands are
 * scanned with regexes and a small tokenizer; a determined or obfuscating
 * actor (variable indirection, base64, scripts written then executed, aliases)
 * can get past it. It exists to turn accidental or prompt-drifted violations
 * into hard stops, not to contain a hostile process. Zero dependencies, Node 18+.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const GUARDED_TOOLS = new Set(['Bash', ...WRITE_TOOLS]);
const PREFIX = 'eng-team:';
const WRITERS = new Set(['eng-builder', 'eng-tester', 'eng-tech-writer']);
const DOC_FILES = new Set(['docs/readme.md', 'docs/architecture.md', 'docs/testing.md', 'docs/runbook.md']);
const MAIN_ASK =
  'eng-team guard: rule 7 — pushes, remote changes and deploys are human-only in eng-team projects; confirm you want this.';

/**
 * Build a deny result in the hard-stop hand-off format.
 * @param {string} rule short rule description (without the "eng-team guard: " prefix)
 * @returns {{decision: 'deny', reason: string}}
 */
function deny(rule) {
  const body = `eng-team guard: ${rule}`;
  return {
    decision: 'deny',
    reason: `${body}. Do not retry or work around this. Return \`HARD-STOP: ${body}\` to the lead.`,
  };
}

// ---------------------------------------------------------------- paths

/**
 * realpath of the nearest existing ancestor, with the missing tail re-appended,
 * so a symlinked directory cannot be used to escape the project.
 * @param {string} abs absolute path
 * @returns {string}
 */
function realpathNearest(abs) {
  let cur = abs;
  const tail = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(cur), ...tail.reverse());
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return abs;
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
}

/**
 * @param {string} root absolute directory
 * @param {string} p absolute path
 * @returns {string|null} posix-style relative path, or null if p is outside root
 */
function relInside(root, p) {
  const rel = path.relative(root, p);
  if (rel === '' ) return '';
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

/**
 * Policy for Write/Edit/MultiEdit/NotebookEdit by a writer subagent.
 * @returns {{decision:'deny',reason:string}|null}
 */
function checkWritePath(role, filePath, projectDir, cwd) {
  if (typeof filePath !== 'string' || !filePath) return null;
  const root = realpathNearest(path.resolve(projectDir));
  const abs = realpathNearest(path.resolve(cwd || projectDir, filePath));
  const rel = relInside(root, abs);
  if (rel === null) return deny(`rule 7 — ${role} may not write outside the project (${filePath})`);
  const lower = rel.toLowerCase();
  const segs = lower.split('/');
  if (segs.includes('.git')) return deny(`rule 7 — .git is off limits to subagents (${filePath})`);
  if (segs[0] === '.eng-team') return deny(`rule 5 — .eng-team/** is lead-owned (${filePath})`);
  if (lower === 'docs/engineering' || lower.startsWith('docs/engineering/'))
    return deny(`rule 5 — docs/engineering/** is lead-owned (${filePath})`);
  const isReaderDoc = DOC_FILES.has(lower) || lower.startsWith('docs/compliance/');
  if (role === 'eng-tech-writer' && !isReaderDoc)
    return deny(
      `rule 5 — tech-writer may only write docs/README.md, docs/architecture.md, docs/testing.md, docs/runbook.md and docs/compliance/** (${filePath})`
    );
  if (role !== 'eng-tech-writer' && isReaderDoc)
    return deny(`rule 5 — ${role} may not write tech-writer docs (${filePath})`);
  return null;
}

// ---------------------------------------------------------------- bash scanning

// Start of a command word: line start, whitespace, separators, quotes, $( or path slash.
const B = '(?:^|[\\s;&|(){}`\'"=/])';
const SEG = '[^;&|\\n]*';
const GIT = `${B}git(?:\\s+(?:-[Cc]\\s*\\S+|--[\\w-]+(?:=\\S+)?|-[\\w]+))*`;
const NPM = `${B}(?:npm|pnpm|yarn|bun)`;

/**
 * Pattern rules. `main: true` rules also prompt (ask) on the main thread.
 * @type {{name: string, re: RegExp, main?: boolean}[]}
 */
const RULES = [
  { name: 'git push', re: new RegExp(`${GIT}\\s+push(?![\\w-])`), main: true },
  { name: 'git remote changes', re: new RegExp(`${GIT}\\s+remote\\s+(?:add|set-url|remove|rm|rename|set-head)(?![\\w-])`), main: true },
  { name: 'git config of remote/url settings', re: new RegExp(`${GIT}\\s+config\\b${SEG}\\b(?:remote|url)\\.`), main: true },
  { name: 'GitHub CLI (gh/hub)', re: new RegExp(`${B}(?:gh|hub)\\s+\\S`) },
  { name: 'remote script piped to an interpreter', re: /\b(?:curl|wget)\b[^\n]*\|\s*(?:sudo\s+)?(?:\S*\/)?(?:sh|bash|zsh|dash|python3?|node|perl|ruby)(?![\w-])/ },
  { name: 'remote script piped to an interpreter', re: /(?:sh|bash|zsh|dash)\s+<\(\s*(?:curl|wget)\b/ },
  { name: 'privilege escalation (sudo/su/doas)', re: new RegExp(`${B}(?:sudo|doas)(?:\\s|$)|(?:^|[\\s;&|(){}\\x60'"=])su(?:\\s|$)`) },
  { name: 'package publish', re: new RegExp(`${NPM}\\s+${SEG}?publish(?![\\w-])`), main: true },
  { name: 'package publish', re: new RegExp(`${B}(?:cargo\\s+publish|twine\\s+upload)(?![\\w-])`), main: true },
  { name: 'docker push/login', re: new RegExp(`${B}docker\\b${SEG}?\\s(?:push|login)(?![\\w-])`), main: true },
  { name: 'kubectl mutation', re: new RegExp(`${B}kubectl\\b${SEG}?\\s(?:apply|delete|create|patch|replace|scale|rollout|edit|drain|cordon|taint)(?![\\w-])`), main: true },
  { name: 'helm release change', re: new RegExp(`${B}helm\\b${SEG}?\\s(?:install|upgrade|uninstall|delete|rollback)(?![\\w-])`), main: true },
  { name: 'terraform/tofu apply, destroy or import', re: new RegExp(`${B}(?:terraform|tofu)\\b${SEG}?\\s(?:apply|destroy|import)(?![\\w-])`), main: true },
  { name: 'pulumi up/destroy', re: new RegExp(`${B}pulumi\\b${SEG}?\\s(?:up|destroy)(?![\\w-])`), main: true },
  { name: 'cloud CLI mutation', re: new RegExp(`${B}(?:aws|gcloud|az)\\s${SEG}?(?:^|\\s)(?:deploy|create|delete|update|put|sync|cp|rm|mv|remove|terminate|run|apply|publish|push|invoke)(?![\\w-])`), main: true },
  { name: 'deploy CLI (firebase/vercel/netlify/fly/heroku)', re: new RegExp(`${B}(?:firebase\\s+deploy|fly\\s+deploy|flyctl|vercel|netlify|heroku)(?![\\w-])`), main: true },
  { name: 'machine-level package install', re: new RegExp(`${B}(?:brew|apt|apt-get|yum|dnf|zypper|choco|winget|snap)\\s+(?:install|add|upgrade|update|remove|uninstall|refresh)(?![\\w-])`) },
  { name: 'machine-level package install', re: new RegExp(`${B}(?:pacman\\s+-S|apk\\s+add|pipx\\s+install|cargo\\s+install|go\\s+install)`) },
  { name: 'global package install', re: new RegExp(`${NPM}\\s+(?:i|install|add|update|upgrade|link)\\b${SEG}\\s(?:-g|--global)(?![\\w-])`) },
  { name: 'global package install', re: new RegExp(`${NPM}\\s+${SEG}?(?:-g|--global)\\s${SEG}?(?:i|install|add)(?![\\w-])`) },
  { name: 'global package install', re: new RegExp(`${B}yarn\\s+global\\s+add`) },
  { name: 'user-level pip install', re: new RegExp(`${B}(?:pip3?|python3?\\s+-m\\s+pip)\\s+install\\b${SEG}--user`) },
];

/**
 * Quote-aware tokenizer for the tail of a command, stopping at an unquoted
 * separator. Quotes are stripped; an unbalanced quote swallows the rest.
 * @param {string} s
 * @returns {string[]}
 */
function tokenize(s) {
  const out = [];
  let cur = '';
  let q = null;
  let has = false;
  for (const ch of s) {
    if (q) {
      if (ch === q) q = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      q = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (ch === '\n') break;
      if (has || cur) out.push(cur);
      cur = '';
      has = false;
    } else if (ch === ';' || ch === '&' || ch === '|' || ch === ')') {
      break;
    } else cur += ch;
  }
  if (has || cur) out.push(cur);
  return out;
}

/**
 * Tokens following each occurrence of a command word.
 * @param {string} cmd full command string
 * @param {string} names regex alternation of command names
 * @returns {string[][]}
 */
function invocations(cmd, names) {
  const re = new RegExp(`${B}(?:${names})\\s+`, 'g');
  const found = [];
  let m;
  while ((m = re.exec(cmd))) found.push(tokenize(cmd.slice(m.index + m[0].length)));
  return found;
}

/** Flags that consume the next token, per network tool family. */
const ARG_FLAGS = new Set([
  '-o', '-H', '-d', '-X', '-A', '-u', '-e', '-b', '-c', '-T', '-F', '-w', '-m', '-x', '-K', '-O', '-P', '-U', '-t',
  '-p', '-i', '-l', '-J', '-L', '-R', '-D', '-E', '-I', '-S', '-W', '-s', '-q', '-X',
  '--header', '--data', '--data-raw', '--data-binary', '--data-urlencode', '--output', '--user', '--request',
  '--user-agent', '--max-time', '--connect-timeout', '--retry', '--cookie', '--form', '--upload-file', '--proxy',
  '--cacert', '--cert', '--key', '--output-document', '--directory-prefix', '--post-data', '--rsh',
]);
// -O means "remote name" (no arg) for curl but "output file" for wget; both are harmless to over-skip.

/** @returns {string[]} non-flag operands, skipping flags that take an argument */
function operands(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '--') { out.push(...tokens.slice(i + 1)); break; }
    if (t.startsWith('--') && t.includes('=')) {
      const val = t.slice(t.indexOf('=') + 1);
      if (/^--(?:url|proxy)=/.test(t)) out.push(val);
      continue;
    }
    if (t === '--url') { if (tokens[i + 1] !== undefined) out.push(tokens[++i]); continue; }
    if (t.startsWith('-') && t.length > 1) { if (ARG_FLAGS.has(t)) i++; continue; }
    out.push(t);
  }
  return out;
}

const FILE_EXT = /\.(?:json|txt|html?|js|mjs|cjs|css|log|csv|xml|ya?ml|md|tar|gz|tgz|zip|out|sh|py|tmp|bin|png|jpe?g|gif|svg|pdf|ts|lock|toml|ini|conf|pem|key|crt)$/i;

/** @returns {string|null} host part of a URL / host[:port] / user@host token, or null if not host-like */
function hostOf(tok) {
  let s = tok.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const hadScheme = s !== tok;
  s = s.replace(/^[^/@]*@/, '');
  let host;
  if (s.startsWith('[')) host = s.slice(1, s.indexOf(']') < 0 ? undefined : s.indexOf(']'));
  else host = s.split(/[/:?#]/)[0];
  if (!host) return null;
  if (hadScheme) return host.toLowerCase();
  if (/^localhost$/i.test(host) || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || tok.startsWith('[')) return host.toLowerCase();
  if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(host) && !FILE_EXT.test(host)) return host.toLowerCase();
  return null;
}

const isLocalHost = (h) => h === 'localhost' || h === '::1' || /^127(?:\.\d{1,3}){3}$/.test(h);
const unknownExpansion = (t) => /[$`]/.test(t);

/** Network tools: curl/wget (any URL operand), ssh-likes (first operand), scp/rsync (remote-form operands). */
function networkViolation(cmd) {
  for (const toks of invocations(cmd, 'curl|wget')) {
    for (const t of operands(toks)) {
      if (unknownExpansion(t)) return 'curl/wget to an unresolvable (variable) host';
      const h = hostOf(t);
      if (h && !isLocalHost(h)) return `curl/wget to non-local host ${h}`;
    }
  }
  for (const toks of invocations(cmd, 'ssh|telnet|ftp|sftp|nc|ncat|netcat|socat')) {
    const first = operands(toks)[0];
    if (first === undefined) continue;
    if (unknownExpansion(first)) return 'network tool to an unresolvable (variable) host';
    const h = first.replace(/^[^@]*@/, '').replace(/^\[|\]$/g, '').split(':')[0] || first;
    const bare = first.replace(/^[^@]*@/, '').replace(/^\[([^\]]*)\].*$/, '$1');
    if (!isLocalHost(h.toLowerCase()) && !isLocalHost(bare.toLowerCase())) return `ssh/nc-style connection to non-local host ${first}`;
  }
  for (const toks of invocations(cmd, 'scp|rsync')) {
    for (const t of operands(toks)) {
      if (unknownExpansion(t) && /:/.test(t)) return 'scp/rsync to an unresolvable host';
      const m = /^(?:[^@/\s]+@)?(\[[^\]]+\]|[^/\s:@]+):(?!\/\/)/.exec(t);
      const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(t);
      if (!m && !url) continue;
      const h = (url ? hostOf(t) : m[1].replace(/^\[|\]$/g, '')) || '';
      if (!isLocalHost(h.toLowerCase())) return `scp/rsync to non-local host ${h}`;
    }
  }
  return null;
}

/** True when a command-line path token points outside the project (and not at tmp). */
function outsideProject(tok, projectDir, cwd) {
  if (/^(?:~|\$\{?HOME\}?)(?:\/|$)/.test(tok) || /^"?\$\{?HOME\}?/.test(tok)) return true;
  if (/^\$\{?TMPDIR\}?(?:\/|$)/.test(tok)) return false;
  if (tok.includes('$') || tok.includes('`')) return false; // cannot resolve; do not guess
  if (/^\/dev\/(?:null|stdout|stderr|tty|fd\/\d+)$/.test(tok)) return false;
  const abs = path.resolve(cwd || projectDir, tok);
  const roots = [projectDir, '/tmp', os.tmpdir(), process.env.TMPDIR].filter(Boolean).map((r) => path.resolve(r));
  const real = realpathNearest(abs);
  // tmp roots count only for paths strictly inside them (never /tmp itself or its parents).
  const inside = (r, strict) => [relInside(r, abs), relInside(realpathNearest(r), real)].some((x) => x !== null && (!strict || x !== ''));
  return !roots.some((r, i) => inside(r, i > 0));
}

/** rm -r / redirection / tee targeting outside the project. */
function destructiveViolation(cmd, projectDir, cwd) {
  for (const toks of invocations(cmd, 'rm')) {
    const recursive = toks.some((t) => /^-[a-zA-Z]*[rR]/.test(t) || t === '--recursive');
    if (!recursive) continue;
    for (const t of operands(toks)) {
      if (t === '/' || t === '/*') return 'recursive rm of /';
      if (outsideProject(t, projectDir, cwd)) return `recursive rm outside the project (${t})`;
    }
  }
  const redir = /(?<![=>\-<])\d*>>?\s*(?!&)("[^"]*"|'[^']*'|[^\s;&|<>()]+)/g;
  let m;
  while ((m = redir.exec(cmd))) {
    const t = m[1].replace(/^["']|["']$/g, '');
    if (t && outsideProject(t, projectDir, cwd)) return `redirection writes outside the project (${t})`;
  }
  for (const toks of invocations(cmd, 'tee')) {
    for (const t of operands(toks)) if (outsideProject(t, projectDir, cwd)) return `tee writes outside the project (${t})`;
  }
  return null;
}

/**
 * Scan a Bash command for subagent-forbidden operations.
 * @returns {string|null} rule description, or null
 */
function bashViolation(cmd, projectDir, cwd) {
  for (const r of RULES) if (r.re.test(cmd)) return `rule 7 — ${r.name} is human-only`;
  const n = networkViolation(cmd);
  if (n) return `rule 7 — ${n} is human-only`;
  const d = destructiveViolation(cmd, projectDir, cwd);
  if (d) return `rule 7 — ${d} is human-only`;
  return null;
}

/** Main-thread check: pushes, remote changes, PR create/merge and deploy CLIs. */
function mainThreadAsk(cmd) {
  if (RULES.some((r) => r.main && r.re.test(cmd))) return true;
  return new RegExp(`${B}gh\\s+pr\\s+(?:create|merge)(?![\\w-])`).test(cmd);
}

// ---------------------------------------------------------------- decision

/**
 * Decide on a PreToolUse payload.
 * @param {object} input parsed hook stdin
 * @param {{projectDir?: string}} [opts]
 * @returns {{decision: 'deny'|'ask', reason: string}|null} null = no opinion
 */
function decide(input, { projectDir } = {}) {
  if (!input || typeof input !== 'object') return null;
  const tool = input.tool_name;
  if (!GUARDED_TOOLS.has(tool)) return null;
  const root = projectDir || input.cwd || process.cwd();
  const ti = input.tool_input || {};
  const agent = typeof input.agent_type === 'string' ? input.agent_type : '';

  if (!agent) {
    if (tool !== 'Bash' || typeof ti.command !== 'string') return null;
    if (!fs.existsSync(path.join(root, '.eng-team', 'state.md'))) return null;
    return mainThreadAsk(ti.command) ? { decision: 'ask', reason: MAIN_ASK } : null;
  }
  if (!agent.startsWith(PREFIX)) return null;

  const role = agent.slice(PREFIX.length);
  if (!WRITERS.has(role))
    return deny(`rule 5 — ${role || 'this agent'} is read-only and may not use ${tool}`);
  if (WRITE_TOOLS.has(tool)) {
    const target = tool === 'NotebookEdit' ? ti.notebook_path : ti.file_path;
    return checkWritePath(role, target, root, input.cwd);
  }
  if (typeof ti.command !== 'string') return null;
  if (role === 'eng-tech-writer') return deny('rule 5 — tech-writer has no shell access');
  const v = bashViolation(ti.command, path.resolve(root), input.cwd);
  return v ? deny(v) : null;
}

module.exports = { decide };

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return;
    }
    let result = null;
    try {
      result = decide(input, { projectDir: process.env.CLAUDE_PROJECT_DIR || input.cwd });
    } catch {
      return; // a guard bug must never wedge unrelated work
    }
    if (!result) return;
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: result.decision,
          permissionDecisionReason: result.reason,
        },
      }) + '\n'
    );
  });
}
