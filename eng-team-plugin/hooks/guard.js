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
const { readPolicy, validate, loosenings, hasGrant, engHome } = require('./policy.js');
const { enqueue } = require('./queue.js');

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const GUARDED_TOOLS = new Set(['Bash', ...WRITE_TOOLS]);
const PREFIX = 'eng-team:';
const WRITERS = new Set(['eng-builder', 'eng-tester', 'eng-tech-writer']);
const DOC_FILES = new Set(['docs/readme.md', 'docs/architecture.md', 'docs/testing.md', 'docs/runbook.md']);
const MAIN_ASK =
  'eng-team guard: rule 7 — pushes, remote changes and deploys are human-only in eng-team projects; confirm you want this.';
const MCP_ASK =
  'eng-team guard: rule 7 — this tool sends, publishes, changes access or deletes outside the project; confirm you want this.';

/**
 * Main-thread deny for destructive actions: the human runs these themselves.
 * @param {string} what rule name
 */
function denyMain(what, queued) {
  return {
    decision: 'deny',
    reason:
      `eng-team guard: destructive — ${what} needs a human. Do not retry or work around this ` +
      '(no scripts, aliases, other tools or rewording). Show the user the exact command and why it is needed, and let them run it themselves.' +
      (queued ? ` Queued as ${queued}: pause only the work that needs it, continue the rest, and tell the user to run it and then type \`/eng-team:eng-queue done ${queued}\`.` : ''),
  };
}

/**
 * Record a denied destructive command in the approval queue. Protected-file
 * changes are not queued: they have their own human path. Never throws.
 * @returns {string|null} queue id
 */
function queueDenied(root, input, what) {
  if (/^(?:changing|switching) /.test(what)) return null;
  try {
    return enqueue(root, { command: input.tool_input.command, cwd: input.cwd || root, reason: what, agent: input.agent_type });
  } catch {
    return null;
  }
}

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
const B = '(?:^|[\\s;&|(){}`\'"=/\\\\])';
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

const CLOUD = '(?:az|aws|gcloud|gsutil|databricks|kubectl|oc|doctl|heroku|flyctl|fly|vercel|firebase|netlify|wp)';
const MUTATE = '(?:create|set|update|delete|add|remove|purge|import|restore|recover|put|patch|grant|revoke|reset)';

/**
 * Destructive or access-changing operations. Denied for subagents and, inside
 * eng-team projects, for the main thread too: a human runs them.
 * @type {{name: string, re: RegExp}[]}
 */
const DESTRUCTIVE = [
  // git: lost history, lost work, deleted refs
  { name: 'force push or remote ref deletion', re: new RegExp(`${GIT}\\s+push\\b${SEG}\\s(?:-(?!-)[a-zA-Z]*[fd][a-zA-Z]*|--force(?:-with-lease)?(?:=\\S*)?|--force-if-includes|--mirror|--delete|--prune|\\+[\\w./-]+|:[\\w./-]+)(?![\\w-])`) },
  { name: 'git reset --hard', re: new RegExp(`${GIT}\\s+reset\\b${SEG}\\s--hard(?![\\w-])`) },
  { name: 'git clean -f', re: new RegExp(`${GIT}\\s+clean\\b${SEG}\\s(?:-(?!-)[a-zA-Z]*f[a-zA-Z]*|--force)(?![\\w-])`) },
  { name: 'branch deletion', re: new RegExp(`${GIT}\\s+branch\\b${SEG}\\s(?:-(?!-)[a-zA-Z]*[dD]|--delete)(?![\\w-])`) },
  { name: 'tag deletion', re: new RegExp(`${GIT}\\s+tag\\b${SEG}\\s(?:-(?!-)[a-zA-Z]*d|--delete)(?![\\w-])`) },
  { name: 'discarding uncommitted changes', re: new RegExp(`${GIT}\\s+checkout\\b${SEG}\\s(?:--(?=\\s)|-f|--force|\\.(?=\\s|$))`) },
  { name: 'discarding uncommitted changes', re: new RegExp(`${GIT}\\s+restore\\b(?!${SEG}\\s(?:--staged|-S)(?![\\w-]))`) },
  { name: 'discarding uncommitted changes', re: new RegExp(`${GIT}\\s+restore\\b${SEG}\\s(?:--worktree|-W)(?![\\w-])`) },
  { name: 'git stash drop/clear', re: new RegExp(`${GIT}\\s+stash\\s+(?:drop|clear)(?![\\w-])`) },
  { name: 'history rewrite', re: new RegExp(`${GIT}\\s+(?:filter-branch|filter-repo|replace)(?![\\w-])|${B}(?:git-filter-repo|bfg)(?![\\w-])`) },
  { name: 'history rewrite', re: new RegExp(`${GIT}\\s+(?:reflog\\s+(?:expire|delete)|update-ref\\b${SEG}\\s-d|gc\\b${SEG}--prune)(?![\\w-])`) },
  // infrastructure and cloud
  { name: 'terraform/tofu apply, destroy or state change', re: new RegExp(`${B}(?:terraform|tofu)\\b${SEG}?\\s(?:apply|destroy|state\\s+(?:rm|mv|push|replace-provider)|force-unlock|workspace\\s+delete)(?![\\w-])`) },
  { name: 'pulumi up/destroy', re: new RegExp(`${B}pulumi\\b${SEG}?\\s(?:up|destroy|stack\\s+rm)(?![\\w-])`) },
  { name: 'databricks bundle destroy', re: new RegExp(`${B}databricks\\s+bundle\\s+destroy(?![\\w-])`) },
  { name: 'databricks deploy to prod', re: new RegExp(`${B}databricks\\s+bundle\\s+deploy\\b${SEG}(?:-t|--target)(?:=|\\s+)["']?(?:prod|production|prd)(?![\\w-])`) },
  { name: 'cloud delete', re: new RegExp(`${B}${CLOUD}\\b${SEG}?\\s(?:(?:delete|remove|terminate|destroy|purge)(?:-[\\w-]+)?|rm|rb|uninstall|undeploy|prune)(?![\\w-])`) },
  { name: 'cloud delete', re: new RegExp(`${B}(?:aws\\s+s3\\s+sync|rsync)\\b${SEG}\\s--delete(?:-\\w+)?(?![\\w-])`) },
  { name: 'helm uninstall', re: new RegExp(`${B}helm\\b${SEG}?\\s(?:uninstall|delete)(?![\\w-])`) },
  { name: 'docker volume or prune', re: new RegExp(`${B}docker\\b${SEG}?\\s(?:volume\\s+(?:rm|prune)|(?:system|image|container|network|builder)\\s+prune)(?![\\w-])`) },
  { name: 'docker compose down with volumes', re: new RegExp(`${B}docker(?:-compose|\\s+compose)\\b${SEG}\\sdown\\b${SEG}\\s(?:-v|--volumes)(?![\\w-])`) },
  // access and secrets
  { name: 'permission or secret change', re: new RegExp(`${B}az\\s+(?:role\\s+(?:assignment|definition)|ad\\s+\\S+|keyvault\\s+(?:secret|key|certificate))\\s+(?:\\S+\\s+)?${MUTATE}(?:-[\\w-]+)?(?![\\w-])`) },
  { name: 'permission or secret change', re: new RegExp(`${B}az\\s+keyvault\\s+(?:set-policy|delete-policy)(?![\\w-])`) },
  { name: 'permission or secret change', re: new RegExp(`${B}az\\s+(?:devops\\s+security|repos\\s+policy)\\b${SEG}\\s${MUTATE}(?![\\w-])`) },
  { name: 'permission or secret change', re: new RegExp(`${B}aws\\s+(?:iam|secretsmanager|ssm|kms|sts)\\s+(?:create|delete|put|attach|detach|update|add|remove|tag|untag|upload|set|restore|schedule|disable|cancel|rotate|assume)-`) },
  { name: 'permission or secret change', re: new RegExp(`${B}gcloud\\b${SEG}\\s(?:add-iam-policy-binding|remove-iam-policy-binding|set-iam-policy)(?![\\w-])`) },
  { name: 'permission or secret change', re: new RegExp(`${B}gcloud\\s+(?:secrets|iam|kms)\\b${SEG}\\s(?:create|delete|update|add|destroy|disable|undelete)(?![\\w-])`) },
  { name: 'permission or secret change', re: new RegExp(`${B}databricks\\s+(?:secrets|permissions|grants|account|users|groups|service-principals|token-management|tokens)\\s+(?:put|put-\\S+|delete|delete-\\S+|set|update|create|patch|remove)(?![\\w-])`) },
  { name: 'permission or secret change', re: new RegExp(`${B}kubectl\\b${SEG}?\\screate\\s+(?:secret|role|clusterrole|rolebinding|clusterrolebinding|serviceaccount)(?![\\w-])`) },
  { name: 'permission or secret change', re: new RegExp(`${B}gh\\s+(?:secret|variable|ssh-key|gpg-key)\\s+(?:set|delete|remove|add)(?![\\w-])`) },
  { name: 'repository or release deletion', re: new RegExp(`${B}gh\\s+(?:repo|release)\\s+delete(?![\\w-])`) },
  // disks and bulk deletes
  { name: 'disk wipe', re: new RegExp(`${B}(?:mkfs(?:\\.\\w+)?|wipefs|shred|fdisk|parted|diskutil\\s+erase\\w*)(?![\\w-])`) },
  { name: 'disk wipe', re: new RegExp(`${B}dd\\b${SEG}\\sof=`) },
  { name: 'bulk delete with find', re: new RegExp(`${B}find\\b${SEG}\\s(?:-delete|-exec\\s+rm)(?![\\w-])`) },
  { name: 'piping into a shell (can hide any command)', re: /\|\s*(?:sudo\s+)?(?:\S*\/)?(?:sh|bash|zsh|dash|ksh)(?=\s|$)/ },
];

const SQL_CLIENT = new RegExp(
  `${B}(?:psql|mysql|mariadb|sqlite3|sqlcmd|snowsql|duckdb|clickhouse(?:-client)?|cockroach\\s+sql|bq\\s+query|databricks\\s+(?:sql|api)|spark-sql|beeline|trino|presto|mongosh|mongo|redis-cli)(?![\\w-])`
);
const SQL_RULES = [
  { name: 'SQL DROP', re: /\bDROP\s+(?:TABLE|DATABASE|SCHEMA|VIEW|CATALOG|INDEX|USER|ROLE|FUNCTION|PROCEDURE|SEQUENCE|VOLUME|MATERIALIZED\s+VIEW|EXTERNAL\s+LOCATION)\b/i },
  { name: 'SQL TRUNCATE', re: /\bTRUNCATE\b/i },
  { name: 'SQL ALTER TABLE … DROP', re: /\bALTER\s+TABLE\b[^;]*\bDROP\b/i },
  { name: 'SQL GRANT/REVOKE', re: /\b(?:GRANT|REVOKE)\s+\w/i },
  { name: 'data store wipe', re: /\b(?:FLUSHALL|FLUSHDB)\b|\.drop(?:Database)?\s*\(|\b(?:deleteMany|remove)\s*\(\s*\{\s*\}\s*\)/i },
];

/** DELETE/UPDATE statements without WHERE. */
function unboundedWrite(sql) {
  for (const m of sql.matchAll(/\b(DELETE\s+FROM|UPDATE\s+\S+\s+SET)\b([^;]*)/gi))
    if (!/\bWHERE\b/i.test(m[2])) return `SQL ${m[1].split(/\s+/)[0].toUpperCase()} without WHERE`;
  return null;
}

/**
 * SQL run through a database client, including small SQL files it reads.
 * @returns {string|null}
 */
function sqlViolation(cmd, cwd) {
  if (!SQL_CLIENT.test(cmd)) return null;
  const texts = [cmd];
  for (const m of cmd.matchAll(/(?:\s(?:-f|--file|-i|--input|--queries)(?:=|\s+)|\s<\s*)["']?([^\s"';&|<>]+)/g)) {
    try {
      const f = path.resolve(cwd, m[1]);
      if (fs.statSync(f).size <= 1024 * 1024) texts.push(fs.readFileSync(f, 'utf8'));
    } catch {
      /* unreadable file: only the command text is checked */
    }
  }
  for (const t of texts) {
    for (const r of SQL_RULES) if (r.re.test(t)) return r.name;
    const u = unboundedWrite(t);
    if (u) return u;
  }
  return null;
}

/** Build and cache directories that a recursive rm may clear without a human. */
const REGEN = new Set([
  'node_modules', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.turbo', '.parcel-cache', '.cache',
  'coverage', '.nyc_output', 'target', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.tox',
  '.venv', 'venv', 'tmp', '.tmp', '.gradle', '.terraform',
]);

/**
 * Recursive rm inside the project. Allowed only for build/cache directories
 * and paths that do not exist; anything else may be uncommitted or ignored
 * work (.env, local databases, state files) that git cannot bring back.
 * @returns {string|null}
 */
function rmInsideViolation(tok, projectDir, cwd) {
  if (/^"?\$\{?TMPDIR\}?(?:\/|$)/.test(tok)) return null;
  if (unknownExpansion(tok)) return `recursive rm of an unresolvable path (${tok})`;
  const glob = /[*?[]/.test(tok);
  const abs = path.resolve(cwd || projectDir, tok);
  const rel = relInside(realpathNearest(path.resolve(projectDir)), realpathNearest(abs));
  if (rel === null) return null; // outside the project: handled by outsideProject
  const segs = rel.split('/');
  const fixed = glob ? segs.slice(0, segs.findIndex((s) => /[*?[]/.test(s))) : segs;
  if (fixed.some((s) => REGEN.has(s))) return null;
  if (!glob && rel !== '' && !fs.existsSync(abs)) return null;
  return `recursive rm of project files (${tok})`;
}

/** `"git" push` → `git push`: quoting a single word must not hide it. */
const unquoteWords = (cmd) => cmd.replace(/(["'])([\w./\\-]+)\1/g, '$2');

/**
 * Destructive checks shared by subagents and the main thread.
 * @returns {string|null} rule name
 */
function destructiveCheck(raw, projectDir, cwd) {
  const cmd = unquoteWords(raw);
  for (const r of DESTRUCTIVE) if (r.re.test(cmd)) return r.name;
  const flat = cmd.replace(/\s+/g, ' ');
  for (const extra of readPolicy(projectDir).policy.destructive_extra)
    if (flat.includes(extra.trim().replace(/\s+/g, ' '))) return `repo policy: ${extra.trim()}`;
  const s = sqlViolation(cmd, cwd || projectDir);
  if (s) return s;
  const rms = invocations(cmd, 'rm').filter((toks) => toks.some((t) => /^-[a-zA-Z]*[rR]/.test(t) || t === '--recursive'));
  for (const toks of [...rms, ...invocations(cmd, 'rimraf|del-cli|trash')]) {
    for (const t of operands(toks)) {
      if (t === '/' || t === '/*') return 'recursive rm of /';
      if (outsideProject(t, projectDir, cwd)) return `recursive rm outside the project (${t})`;
      const v = rmInsideViolation(t, projectDir, cwd);
      if (v) return v;
    }
  }
  return protectedBash(cmd);
}

// ---------------------------------------------------------------- protected files

/** Project files only a human may change: the guard's own policy, settings and approvals. */
const PROTECTED = ['.eng-team/policy.json', '.eng-team/approvals', '.claude/settings.json', '.claude/settings.local.json'];
const PLUGIN_ROOT = path.resolve(__dirname, '..');

/**
 * @param {string} abs real absolute path
 * @returns {string|null} why the path is protected
 */
function protectedPath(abs, root) {
  const rel = relInside(realpathNearest(root), abs);
  if (rel !== null) {
    const lower = rel.toLowerCase();
    const hit = PROTECTED.find((p) => lower === p || lower.startsWith(p + '/'));
    if (hit) return hit;
  }
  if (relInside(realpathNearest(PLUGIN_ROOT), abs) !== null) return 'the eng-team plugin';
  if (relInside(realpathNearest(engHome()), abs) !== null) return '~/.eng-team (approval grants)';
  const home = os.homedir();
  for (const f of ['settings.json', 'settings.local.json'])
    if (abs === realpathNearest(path.join(home, '.claude', f))) return `~/.claude/${f}`;
  return null;
}

/** Writing a protected file from Bash (redirection, sed -i, cp, a script …). */
function protectedBash(cmd) {
  const write = /(?<![\d&])>(?!&)|\b(?:tee|cp|mv|rm|ln|install|truncate|dd|chmod|chown|touch|rsync|unlink)\b|\b(?:sed|perl)\b[^|;&\n]*\s-i/;
  const run = /\b(?:python3?|node|ruby|perl|php|deno|bun)\b/;
  const config =
    /\.claude\/settings|\.eng-team\/(?:policy|approvals)|(?:\.claude|\.eng-team)(?=[/\s"']|$)[^\n]*\b(?:settings(?:\.local)?\.json|policy\.json|approvals)\b/i;
  if (config.test(cmd) && (write.test(cmd) || run.test(cmd))) return 'changing eng-team policy, settings or approvals';
  if (/(?:~|\$\{?HOME\}?|\/home\/[^/\s]+|\/Users\/[^/\s]+|\/root)\/\.eng-team\b|\.eng-team\/grants/.test(cmd) && (write.test(cmd) || run.test(cmd)))
    return 'changing eng-team approval grants';
  if (/\.eng-team\b[^\n]*\b(?:state|profile)\.md|\b(?:state|profile)\.md\b[^\n]*\.eng-team/.test(cmd) && /\bautonomous\b/.test(cmd) && (write.test(cmd) || run.test(cmd)))
    return 'switching to autonomous mode from the shell';
  // Running the plugin's own scripts (node …/dispatch-log.js) is fine; changing them is not.
  if (/\/plugins\/\S*eng-team|eng-team-plugin\/hooks/.test(cmd) && write.test(cmd)) return 'changing the eng-team plugin';
  return null;
}

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

/** Redirection / tee targeting outside the project (recursive rm is in destructiveCheck). */
function outsideWriteViolation(cmd, projectDir, cwd) {
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
function bashViolation(raw, projectDir, cwd) {
  const cmd = unquoteWords(raw);
  const x = destructiveCheck(cmd, projectDir, cwd);
  if (x) return `rule 7 — destructive: ${x} needs a human`;
  for (const r of RULES) if (r.re.test(cmd)) return `rule 7 — ${r.name} is human-only`;
  const n = networkViolation(cmd);
  if (n) return `rule 7 — ${n} is human-only`;
  const d = outsideWriteViolation(cmd, projectDir, cwd);
  if (d) return `rule 7 — ${d} is human-only`;
  return null;
}

/** MCP tools that send, publish, change access or delete. */
const MCP_DESTRUCTIVE =
  /(?:^|[_-])(?:send|publish|unpublish|post|delete|remove|destroy|drop|purge|trash|archive|merge|deploy|push|transfer|pay|refund|grant|revoke|share|invite)(?:[_-]|$)/i;
const mcpDestructive = (tool) => MCP_DESTRUCTIVE.test(tool.slice(tool.lastIndexOf('__') + 2));

/** An eng-team project: initialised state or a policy file. */
const isEngProject = (root) =>
  fs.existsSync(path.join(root, '.eng-team', 'state.md')) || fs.existsSync(path.join(root, '.eng-team', 'policy.json'));

/** Main-thread check: pushes, remote changes, PR create/merge and deploy CLIs. */
function mainThreadAsk(cmd) {
  if (RULES.some((r) => r.main && r.re.test(cmd))) return true;
  return new RegExp(`${B}gh\\s+pr\\s+(?:create|merge)(?![\\w-])`).test(cmd);
}

// ---------------------------------------------------------------- policy and autonomy

const UNATTENDED = new Set(['bypassPermissions', 'dontAsk']);
const AUTONOMOUS_LINE = /^[\s|>*-]*`?autonomy`?\s*[:|]\s*`?autonomous\b/im;

/** File content after a Write/Edit/MultiEdit, or null when it cannot be computed. */
function contentAfter(tool, ti, abs) {
  if (tool === 'Write') return typeof ti.content === 'string' ? ti.content : null;
  let cur = '';
  try {
    cur = fs.readFileSync(abs, 'utf8');
  } catch {
    /* new file */
  }
  const edits = tool === 'MultiEdit' ? ti.edits : tool === 'Edit' ? [ti] : null;
  if (!Array.isArray(edits)) return null;
  for (const e of edits) {
    if (!e || typeof e.old_string !== 'string' || typeof e.new_string !== 'string') return null;
    cur = e.replace_all ? cur.split(e.old_string).join(e.new_string) : cur.replace(e.old_string, () => e.new_string);
  }
  return cur;
}

const policyDeny = (why) => ({
  decision: 'deny',
  reason: `eng-team guard: policy — ${why}. Do not retry or work around this; tell the user.`,
});

/**
 * Main-thread change to .eng-team/policy.json. Creating it is allowed (init);
 * changing it needs the human to have typed /eng-team:eng-policy this session.
 * The result must be valid, and anything that loosens it asks the human
 * (denied when nobody is there to answer).
 */
function policyWrite(input, abs, root) {
  const next = contentAfter(input.tool_name, input.tool_input || {}, abs);
  if (next === null) return policyDeny('the change to .eng-team/policy.json cannot be checked');
  let parsed;
  try {
    parsed = JSON.parse(next);
  } catch (e) {
    return policyDeny(`.eng-team/policy.json would not be valid JSON (${e.message})`);
  }
  const errs = validate(parsed);
  if (errs.length) return policyDeny(`.eng-team/policy.json would be invalid: ${errs.join('; ')}`);
  const exists = fs.existsSync(abs);
  if (exists && !hasGrant(input.session_id, 'policy'))
    return policyDeny('changing .eng-team/policy.json needs the user to type /eng-team:eng-policy first (it opens a 30-minute window)');
  const lost = loosenings(readPolicy(root).policy, parsed);
  if (!lost.length) return null;
  if (UNATTENDED.has(input.permission_mode))
    return policyDeny(`this loosens the policy (${lost.join('; ')}) and needs a human, but the session runs in ${input.permission_mode} mode`);
  return { decision: 'ask', reason: `eng-team policy: this loosens the policy: ${lost.join('; ')}. Approve only if you asked for it.` };
}

/**
 * Main-thread change to state.md or profile.md that switches autonomy to
 * autonomous: needs the human to have typed --autonomous (or --auto) on an
 * eng-team command this session, and a valid policy whose max_mode allows it.
 */
function autonomyWrite(input, abs, root) {
  const next = contentAfter(input.tool_name, input.tool_input || {}, abs);
  let cur = '';
  try {
    cur = fs.readFileSync(abs, 'utf8');
  } catch {
    /* new file */
  }
  // A malformed Edit (no strings) fails in the tool itself.
  if (next === null || !AUTONOMOUS_LINE.test(next) || AUTONOMOUS_LINE.test(cur)) return null;
  const { policy, state } = readPolicy(root);
  if (state !== 'ok') return policyDeny(`autonomous mode needs a valid .eng-team/policy.json (it is ${state}); the user can run /eng-team:eng-policy`);
  if (policy.max_mode !== 'autonomous') return policyDeny('the repo policy caps this project at gated (max_mode); only the user can raise it with /eng-team:eng-policy');
  if (!hasGrant(input.session_id, 'autonomous'))
    return policyDeny('autonomous mode starts only when the user types --autonomous (or --auto) on an eng-team command and confirms');
  return null;
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
  if (typeof tool !== 'string') return null;
  const isMcp = tool.startsWith('mcp__');
  if (!GUARDED_TOOLS.has(tool) && !isMcp) return null;
  const root = projectDir || input.cwd || process.cwd();
  const ti = input.tool_input || {};
  const agent = typeof input.agent_type === 'string' ? input.agent_type : '';
  const target = tool === 'NotebookEdit' ? ti.notebook_path : ti.file_path;

  if (!agent) {
    if (!isEngProject(root)) return null;
    if (isMcp) return mcpDestructive(tool) ? { decision: 'ask', reason: MCP_ASK } : null;
    if (WRITE_TOOLS.has(tool)) {
      if (typeof target !== 'string' || !target) return null;
      const abs = realpathNearest(path.resolve(input.cwd || root, target));
      const rel = (relInside(realpathNearest(root), abs) || '').toLowerCase();
      if (rel === '.eng-team/policy.json') return policyWrite(input, abs, root);
      if (rel === '.eng-team/state.md' || rel === '.eng-team/profile.md') return autonomyWrite(input, abs, root);
      const p = protectedPath(abs, root);
      return p ? denyMain(`changing ${p}`) : null;
    }
    if (typeof ti.command !== 'string') return null;
    const x = destructiveCheck(ti.command, path.resolve(root), input.cwd);
    if (x) return denyMain(x, isEngProject(root) ? queueDenied(path.resolve(root), input, x) : null);
    return mainThreadAsk(ti.command) ? { decision: 'ask', reason: MAIN_ASK } : null;
  }
  if (!agent.startsWith(PREFIX)) return null;

  const role = agent.slice(PREFIX.length);
  if (isMcp) return mcpDestructive(tool) ? deny(`rule 7 — ${tool} sends, publishes or deletes outside the project and is human-only`) : null;
  if (!WRITERS.has(role))
    return deny(`rule 5 — ${role || 'this agent'} is read-only and may not use ${tool}`);
  if (WRITE_TOOLS.has(tool)) {
    if (typeof target === 'string' && target) {
      const p = protectedPath(realpathNearest(path.resolve(input.cwd || root, target)), root);
      if (p) return deny(`rule 7 — changing ${p} is human-only`);
    }
    return checkWritePath(role, target, root, input.cwd);
  }
  if (typeof ti.command !== 'string') return null;
  if (role === 'eng-tech-writer') return deny('rule 5 — tech-writer has no shell access');
  const x = destructiveCheck(ti.command, path.resolve(root), input.cwd);
  if (x) {
    const q = isEngProject(root) ? queueDenied(path.resolve(root), input, x) : null;
    return deny(`rule 7 — destructive: ${x} needs a human${q ? ` (queued as ${q}; your task waits for it)` : ''}`);
  }
  const v = bashViolation(ti.command, path.resolve(root), input.cwd);
  return v ? deny(v) : null;
}

module.exports = { decide };

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    const projectDir = process.env.CLAUDE_PROJECT_DIR;
    let input;
    let result = null;
    try {
      input = JSON.parse(raw);
      result = decide(input, { projectDir: projectDir || input.cwd });
    } catch (e) {
      // Fail closed where the guard is the security floor; stay silent elsewhere.
      const engAgent = /"agent_type"\s*:\s*"eng-team:/.test(raw);
      let engProject = false;
      try {
        engProject = isEngProject(projectDir || (input && input.cwd) || process.cwd());
      } catch {
        engProject = true;
      }
      if (!engAgent && !engProject) return;
      result = { decision: 'deny', reason: `eng-team guard: the guard failed (${String(e && e.message).slice(0, 120)}), so this call is blocked. Tell the user.` };
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
