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
const { enqueue, useApproval } = require('./queue.js');
const { losslessBranchDelete } = require('./gitref.js');
const { recordStop } = require('./stops.js');

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
const TRASH_JS = path.join(__dirname, '..', 'scripts', 'trash.js');

function denyMain(what, queued) {
  const q = queued ? ` Queued as ${queued}: pause only the work that needs it, continue the rest, and ask the user to approve it (they type \`approve ${queued}\`); after that, run exactly this command once from the same directory. If they reject it, ask them what to do instead.` : '';
  // Not destructive: the shell can't be checked, the Edit tool can (grant + max_mode). Never ask the user to run it either: that skips their confirmation.
  if (/^switching to autonomous mode from the shell/.test(what))
    return {
      decision: 'deny',
      reason:
        'eng-team guard: switching to autonomous mode from the shell is not allowed. Not destructive, nothing for the user to run. ' +
        'Make the change with the Edit tool on .eng-team/state.md (autonomy: autonomous); the guard allows it there only if the user typed --autonomous or --auto on an eng-team command and the policy allows it. ' +
        'If that Edit is denied too, stay gated and start your next message with "Autonomous mode is OFF:" and the reason.',
    };
  if (/^recursive rm of project files/.test(what))
    return {
      decision: 'deny',
      reason:
        `eng-team guard: ${what} cannot be undone, so Claude may not run it. To clean up files the user asked to remove, move them to the recoverable trash instead (kept 14 days, restorable): node ${TRASH_JS} <path>... ` +
        'Only if the user wants them gone for good, show them the exact command and let them run it.' + q,
    };
  return {
    decision: 'deny',
    reason:
      `eng-team guard: destructive — ${what} needs a human. Do not retry or work around this ` +
      '(no scripts, aliases, other tools or rewording). Show the user the exact command and why it is needed, and let them run it themselves.' + q,
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

/**
 * A lane denial: the call went to the wrong place, nothing ran, and no human
 * decision is needed. The agent takes the compliant route and carries on; no
 * guard stop is opened.
 * @param {string} rule
 */
function laneDeny(rule) {
  return {
    decision: 'deny',
    reason:
      `eng-team guard: ${rule}. Not a hard stop: do not retry this call. Use the compliant route (Read or a read-only shell command to read; ` +
      "Write/Edit only for files in your lane; a `Hand-off: <role>` line for anyone else's files) and continue your task.",
  };
}

/**
 * A temp file aimed at /tmp or the session scratchpad: redirected into the
 * worktree's `.tmp/`, no guard stop. Nothing outside the project is written.
 * @param {string} role
 * @param {string} filePath
 */
function tmpRedirect(role, filePath) {
  return {
    decision: 'deny',
    reason:
      `eng-team guard: rule 7 — ${role} may not write outside the project (${filePath}). Not a hard stop: do not retry this call. ` +
      'Put temporary files in `.tmp/` at the root of your worktree (create it if needed), never commit them, remove them with `rm -r .tmp` before you return, and continue your task.',
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
 * Every way a project path can be read as a lane path: relative to the project
 * root, and relative to each git worktree or checkout nested inside it (an agent
 * worktree under `.claude/worktrees/<id>/` holds its own copy of `.eng-team/`,
 * `docs/engineering/` and settings, which a merge brings back). Deny rules apply
 * when any of these hits; the root-relative path is first.
 * @param {string} rel posix path relative to the (real) project root
 * @param {string} realRoot realpath of the project root
 * @returns {string[]}
 */
function laneRels(rel, realRoot) {
  const out = [rel];
  const segs = rel.split('/');
  const wt = /^\.claude\/worktrees\/[^/]+\/(.+)$/i.exec(rel);
  if (wt) out.push(wt[1]);
  for (let i = 1; i < segs.length; i++) {
    let nested = false;
    try {
      nested = fs.existsSync(path.join(realRoot, ...segs.slice(0, i), '.git'));
    } catch {
      /* unreadable: not a checkout */
    }
    if (nested) out.push(segs.slice(i).join('/'));
  }
  return [...new Set(out)];
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
  if (rel === null) {
    // Temp files belong in the worktree's .tmp/ (never committed, `rm -r .tmp` is allowed): redirect, nothing was written.
    if (!outsideProject(path.resolve(cwd || projectDir, filePath), projectDir, cwd)) return tmpRedirect(role, filePath);
    return deny(`rule 7 — ${role} may not write outside the project (${filePath})`);
  }
  const lanes = laneRels(rel, root).map((r) => r.toLowerCase());
  if (lanes[0].split('/').includes('.git')) return deny(`rule 7 — .git is off limits to subagents (${filePath})`);
  if (lanes.some((l) => l.split('/')[0] === '.eng-team')) return laneDeny(`rule 5 — .eng-team/** is lead-owned (${filePath})`);
  if (lanes.some((l) => l === 'docs/engineering' || l.startsWith('docs/engineering/')))
    return laneDeny(`rule 5 — docs/engineering/** is lead-owned (${filePath})`);
  const readerDoc = (l) => DOC_FILES.has(l) || l.startsWith('docs/compliance/');
  if (role === 'eng-tech-writer' && !readerDoc(lanes[0]))
    return laneDeny(
      `rule 5 — tech-writer may only write docs/README.md, docs/architecture.md, docs/testing.md, docs/runbook.md and docs/compliance/** (${filePath})`
    );
  if (role !== 'eng-tech-writer' && lanes.some(readerDoc))
    return laneDeny(`rule 5 — ${role} may not write tech-writer docs (${filePath})`);
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
  { name: 'git config of remote/url settings', re: new RegExp(`${GIT}\\s+config\\b${SEG}\\b(?:remote|url)\\.`), main: true, gitConfig: true },
  { name: 'GitHub CLI (gh/hub)', re: new RegExp(`${B}(?:gh|hub)\\s+\\S`) },
  { name: 'remote script piped to an interpreter', never: true, re: /\b(?:curl|wget)\b[^\n]*\|\s*(?:sudo\s+)?(?:\S*\/)?(?:sh|bash|zsh|dash|python3?|node|perl|ruby)(?![\w-])/ },
  { name: 'remote script piped to an interpreter', never: true, re: /(?:sh|bash|zsh|dash)\s+<\(\s*(?:curl|wget)\b/ },
  { name: 'privilege escalation (sudo/su/doas)', never: true, re: new RegExp(`${B}(?:sudo|doas)(?:\\s|$)|(?:^|[\\s;&|(){}\\x60'"=])su(?:\\s|$)`) },
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

/** Lead-only maintenance scripts: recoverable trash, worktree cleanup, closing queue entries. */
const LEAD_ONLY = /\b(?:trash|cleanup-worktrees)\.js\b|\bqueue\.js\b[^|;&\n]*\bclose\b/;

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
  // A branch whose commits are on another branch can be recovered from there.
  const lossless = losslessBranchDelete(raw, cwd || projectDir);
  for (const r of DESTRUCTIVE) if (r.re.test(cmd) && !(lossless && r.name === 'branch deletion')) return r.name;
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
  const realRoot = realpathNearest(root);
  const rel = relInside(realRoot, abs);
  if (rel !== null) {
    for (const lower of laneRels(rel, realRoot).map((r) => r.toLowerCase())) {
      const hit = PROTECTED.find((p) => lower === p || lower.startsWith(p + '/'));
      if (hit) return hit;
    }
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
  // Running or reading the plugin's files (node …/dispatch-log.js, ls …/templates) is fine; changing them is not.
  if (PLUGIN_PATH.test(cmd) && write.test(cmd) && pluginWrite(cmd, write)) return 'changing the eng-team plugin';
  return null;
}

const PLUGIN_PATH = /\/plugins\/\S*eng-team|eng-team-plugin\/hooks/;
// Ways a plugin path can reach a write in another subcommand; any of them means the whole command counts.
const INDIRECT = /^\s*(?:cd|pushd|export|eval|source|\.)\s|^\s*\w+=|\$\(|`|\b(?:xargs|find|sh|bash|zsh|env)\b|\s-t\s|--target-directory/;

/** Split a shell command on ; && || | & and newlines, outside quotes. */
function subcommands(cmd) {
  const out = [];
  let cur = '';
  let q = null;
  for (const ch of cmd) {
    if (q) {
      if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") q = ch;
    else if (ch === ';' || ch === '&' || ch === '|' || ch === '\n') {
      if (cur.trim()) out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/**
 * True when a subcommand writes to a plugin path: a redirect into it, the
 * destination of cp/install/rsync/ln, or any other writer naming it.
 * Indirection or an unclosed quote falls back to the whole command.
 */
function pluginWrite(cmd, write) {
  const parts = subcommands(cmd);
  if ((cmd.match(/["']/g) || []).length % 2 || parts.some((s) => INDIRECT.test(s))) return true;
  for (const s of parts) {
    if (!PLUGIN_PATH.test(s)) continue;
    const redirects = [...s.matchAll(/(?<![\d&])>>?(?!&)\s*(\S+)/g)];
    if (redirects.some((m) => PLUGIN_PATH.test(m[1]))) return true;
    const rest = s.replace(/(?<![\d&])>>?(?!&)\s*\S+/g, ' ');
    const toks = tokenize(rest.trim());
    if (/^(?:cp|install|rsync|ln)$/.test(path.basename(toks[0] || ''))) {
      const ops = toks.slice(1).filter((t) => !t.startsWith('-'));
      if (PLUGIN_PATH.test(ops[ops.length - 1] || '')) return true;
      continue;
    }
    if (write.test(rest)) return true;
  }
  return false;
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

// ---------------------------------------------------------------- precision: reads and literal text

/** git config flags that only read. Anything else (--add, --unset, --file, --edit, -c ...) is not a read. */
const GIT_CONFIG_READ_FLAGS = new Set([
  '--get', '--get-all', '--get-regexp', '--get-urlmatch', '-l', '--list', '--show-origin', '--show-scope',
  '--name-only', '-z', '--null', '--includes', '--no-includes', '--global', '--system', '--local', '--worktree',
  '--bool', '--int', '--bool-or-int', '--path', '--expiry-date', '--type', '--default', '--all', '--regexp',
]);
const GIT_CONFIG_READ_ANY = new Set(['--get', '--get-all', '--get-regexp', '--get-urlmatch', '-l', '--list']);
const GIT_CONFIG_AT = new RegExp(`${GIT}\\s+config\\b`, 'g');

/**
 * True when every `git config` in the command only reads a value. Reads change
 * nothing, and the guard does not police reads (a builder may already `cat`
 * any file). A value-taking flag, `-c`, an expansion or two plain operands
 * without a --get-style flag all count as writes, so unknown forms stay denied.
 * @param {string} cmd
 */
function gitConfigReadsOnly(cmd) {
  const hits = [...cmd.matchAll(GIT_CONFIG_AT)];
  if (!hits.length) return false;
  return hits.every((m) => {
    if (/\s-c\s*\S|--config-env/.test(m[0])) return false;
    const toks = tokenize(cmd.slice(m.index + m[0].length));
    let sub = null;
    if (toks[0] === 'get' || toks[0] === 'list') sub = toks.shift();
    const ops = [];
    let readFlag = Boolean(sub);
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (/[$`(]/.test(t)) return false;
      if (!t.startsWith('-')) { ops.push(t); continue; }
      const flag = t.split('=')[0];
      if (!GIT_CONFIG_READ_FLAGS.has(flag)) return false;
      if (GIT_CONFIG_READ_ANY.has(flag)) readFlag = true;
      if ((flag === '--type' || flag === '--default') && !t.includes('=')) i++;
    }
    return readFlag ? ops.length <= 2 : ops.length <= 1;
  });
}

/** Pattern rule hit, minus read-only git config lookups. */
const ruleHits = (r, cmd) => r.re.test(cmd) && !(r.gitConfig && gitConfigReadsOnly(cmd));

/** Commands that never run their arguments or stdin as code. */
const LITERAL_SAFE = new Set([
  'cat', 'echo', 'printf', 'git', 'cd', 'mkdir', 'ls', 'pwd', 'true', 'false', 'test', '[', 'grep', 'rg',
  'head', 'tail', 'wc', 'sort', 'uniq', 'diff', 'touch', 'cp', 'mv',
]);

/**
 * The command as the shell sees its structure: text inside quotes, comments
 * and heredoc bodies cannot redirect, so `>` and word breaks there are
 * blanked. Only when every command word is one that never runs text as code
 * and there is no command or process substitution; otherwise the raw command
 * is returned and scanned as before (fail closed).
 * @param {string} raw
 * @returns {string}
 */
function shellView(raw) {
  const p = shellParse(raw, sedSafe(raw) ? LITERAL_SAFE_SED : LITERAL_SAFE);
  return p.safe ? p.text : raw;
}

/**
 * shellView's parse. `words` are extra command words treated as never running
 * their text as code (the lane check adds a script-checked `sed`).
 * @returns {{text: string, safe: boolean}}
 */
function shellParse(raw, words = LITERAL_SAFE) {
  const blank = (c) => (/[\w./~$@:+,%={}-]/.test(c) ? c : '_');
  let out = '';
  let q = null;
  let unsafe = false;
  const pending = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (q === "'") { if (c === q) { q = null; out += c; } else out += blank(c); continue; }
    if (q === '"') {
      if (c === '\\') { out += '__'; i++; continue; }
      if (c === '`' || (c === '$' && raw[i + 1] === '(')) unsafe = true;
      if (c === q) { q = null; out += c; } else out += blank(c);
      continue;
    }
    if (c === '\\') { out += '_' + (raw[i + 1] === '\n' ? ' ' : blank(raw[i + 1] || '')); i++; continue; }
    if (c === '$' && raw[i + 1] === "'") unsafe = true; // $'...' has its own escapes
    if (c === "'" || c === '"') { q = c; out += c; continue; }
    if (c === '`' || (c === '$' && raw[i + 1] === '(') || (/[<>]/.test(c) && raw[i + 1] === '(')) unsafe = true;
    if (c === '#' && (i === 0 || /[\s;&|(]/.test(raw[i - 1]))) {
      const end = raw.indexOf('\n', i);
      const stop = end < 0 ? raw.length : end;
      for (; i < stop; i++) out += blank(raw[i]);
      i--;
      continue;
    }
    const h = c === '<' && raw[i + 1] === '<' && raw[i + 2] !== '<' ? /^<<(-?)[ \t]*(['"]?)([A-Za-z_][\w-]*)\2/.exec(raw.slice(i)) : null;
    if (h) {
      pending.push({ strip: h[1] === '-', literal: Boolean(h[2]), delim: h[3] });
      out += h[0];
      i += h[0].length - 1;
      continue;
    }
    out += c === '\n' && pending.length ? ' ' : c;
    if (c === '\n' && pending.length) {
      for (const d of pending.splice(0)) {
        while (i + 1 < raw.length) {
          const end = raw.indexOf('\n', i + 1);
          const line = raw.slice(i + 1, end < 0 ? raw.length : end);
          if ((d.strip ? line.replace(/^\t+/, '') : line) === d.delim) {
            out += '_'.repeat(line.length);
            i += line.length;
            if (end >= 0) { out += '\n'; i++; }
            break;
          }
          if (!d.literal && /`|\$\(/.test(line)) unsafe = true;
          out += [...line].map(blank).join('') + (end >= 0 ? '_' : '');
          i += line.length + (end >= 0 ? 1 : 0);
        }
      }
    }
  }
  if (unsafe || q) return { text: raw, safe: false };
  for (const s of subcommands(out)) {
    const toks = commandTokens(s);
    const word = path.basename(toks[0] || '');
    if (!words.has(word)) return { text: raw, safe: false };
    if (word === 'git' && toks.some((t) => /^-c|^--config-env|^--exec-path/.test(t))) return { text: raw, safe: false };
  }
  return { text: out, safe: true };
}

/** Shell keywords that may open a simple command (`do sed …`, `then cat …`). */
const SHELL_KEYWORDS = new Set(['do', 'then', 'else', 'elif', 'if', 'while', 'until', '!', '{', 'done', 'fi', 'esac']);

/** Tokens of one simple command: leading keywords and VAR=value assignments dropped; `for x in …` is a read. */
function commandTokens(s) {
  const toks = tokenize(s.trim());
  while (toks.length && (SHELL_KEYWORDS.has(toks[0]) || /^\w+=/.test(toks[0]))) toks.shift();
  if (toks[0] === 'for') return ['true'];
  return toks;
}

// ---------------------------------------------------------------- lane writes from the shell

/** Commands that only read their operands (sed without -i and with a checked script). */
const LANE_READ = new Set(['cat', 'head', 'tail', 'wc', 'grep', 'rg', 'ls', 'sort', 'uniq', 'diff', 'echo', 'printf', 'test', '[', 'true', 'false', 'pwd', 'file', 'stat', 'sed']);
const LANE_WORDS = new Set([...LITERAL_SAFE, ...LANE_READ, 'tee', 'install', 'ln', 'rm', 'rmdir', 'unlink', 'truncate', 'chmod', 'chown', 'dd', 'rsync']);
const GIT_READ = new Set(['log', 'show', 'diff', 'status', 'grep', 'ls-files', 'blame', 'cat-file', 'rev-parse', 'shortlog']);
/** sed commands that write or execute: `w file`, `W file`, `e cmd`, and the s///w and s///e flags. */
const SED_WRITE = /(?:^|[;{}\n\s'"]|\d|\$|\/)\s*[wWe](?:\s|$|['"])|\/[gpIiMm\d]*[we](?:\s|;|$|}|['"])/;
/** Every sed in the command only reads: no -i, no w/W/e commands or flags. */
const sedSafe = (raw) =>
  [...raw.matchAll(/(?:^|[\s;&|(])sed\s+([^|;&\n]*)/g)].every((m) => !SED_WRITE.test(m[1]) && !/(?:^|\s)(?:-i|--in-place|-[a-zA-Z]*i)/.test(m[1]));
const LITERAL_SAFE_SED = new Set([...LITERAL_SAFE, 'sed']);

/**
 * True when a shell command may write a path that `lane` matches. Looks at
 * write targets (redirects, tee, the destination of cp/install/ln, any
 * operand of mv/rm/touch/sed -i…), not at every path the command mentions,
 * so reading a lane file with sed, grep or cat passes. Fails closed: an
 * interpreter, an unknown command, `cd`, a variable target, or text the
 * parser cannot read counts as a write whenever a lane path is mentioned.
 * @param {string} raw
 * @param {RegExp} lane
 */
function laneWrite(raw, lane) {
  if (!lane.test(raw)) return false;
  if (RUN_VERB.test(raw)) return true;
  const sedOk = sedSafe(raw);
  const words = new Set([...LANE_WORDS].filter((w) => w !== 'sed' || sedOk));
  const p = shellParse(raw, words);
  if (!p.safe) return WRITE_VERB.test(raw) || !sedOk;
  const hits = (t) => lane.test(` ${t}`) || /[$`*?]/.test(t);
  for (const s of subcommands(p.text)) {
    for (const m of s.matchAll(/(?<![\d&])\d*>>?(?!&)\s*(\S+)/g)) if (hits(m[1])) return true;
    const toks = commandTokens(s.replace(/(?<![\d&])\d*>>?(?!&)\s*\S+/g, ' '));
    const word = path.basename(toks[0] || '');
    const ops = toks.slice(1).filter((t) => !t.startsWith('-'));
    const mentions = toks.some((t) => lane.test(` ${t}`));
    if (word === 'cd' || word === 'pushd') { if (mentions) return true; continue; }
    if (word === 'git') { if (mentions && !GIT_READ.has(ops[0])) return true; continue; }
    if (word === 'cp' || word === 'install' || word === 'ln') {
      if (toks.some((t) => /^-[a-zA-Z]*t$|^--target-directory/.test(t))) { if (toks.slice(1).some(hits)) return true; continue; }
      if (ops.length && hits(ops[ops.length - 1])) return true;
      continue;
    }
    if (word === 'tee') { if (ops.some(hits)) return true; continue; }
    if (LANE_READ.has(word)) continue;
    if (toks.slice(1).some(hits)) return true; // mv, rm, touch, mkdir, chmod, dd, rsync…
  }
  return false;
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
  const hit = RULES.find((r) => ruleHits(r, cmd));
  if (hit) return { rule: hit.name };
  const n = networkViolation(cmd);
  if (n) return { rule: n };
  const d = outsideWriteViolation(unquoteWords(shellView(raw)), projectDir, cwd);
  if (d) return { rule: d };
  return null;
}

/** Shell verbs that write a file, and interpreters that could. Shared by the subagent lane checks. */
const WRITE_VERB = /(?<![\d&])>(?!&)|\b(?:tee|cp|mv|rm|ln|install|truncate|dd|chmod|chown|touch|rsync|unlink|mkdir|rmdir)\b|\b(?:sed|perl)\b[^|;&\n]*\s-i/;
const RUN_VERB = /\b(?:python3?|node|ruby|perl|php|deno|bun)\b/;

/** A path segment `.git/` (the repo's own config, hooks and refs; worktrees share them). */
const GIT_DIR_PATH = /(?:^|[\s"'=/(,:[{])\.git\/(?!\/)/;
/** git config keys that make git run a program, or that reach outside the project. */
const GIT_EXEC_CONFIG = new RegExp(
  `${GIT}\\s+config\\b${SEG}(?:\\s--(?:global|system)\\b|\\b(?:core\\.(?:hookspath|fsmonitor|sshcommand|pager|editor|askpass|gitproxy|attributesfile|excludesfile)|alias\\.|filter\\.|diff\\.\\S*textconv|diff\\.external|merge\\.\\S*driver|include(?:if)?\\b|credential\\.|sequence\\.editor|gpg\\.\\S*program|uploadpack\\.|receivepack\\.|protocol\\.\\S*allow|submodule\\.))`,
  'i'
);
/** Lead-owned and tech-writer paths, as they appear in a shell command (any worktree copy too). */
const LEAD_LANE_PATH = /(?:^|[\s"'=/(,:[{])\.eng-team(?:\/|(?=[\s"';&|)]|$))|(?:^|[\s"'=/(,:[{])docs\/engineering\b/i;
const READER_DOC_PATH = /(?:^|[\s"'=/(,:[{])docs\/(?:compliance\b|(?:readme|architecture|testing|runbook)\.md\b)/i;

/**
 * Shell checks that only apply to eng-team subagents: code planted in .git that
 * would run in the lead's own git calls, writes into the lead's and the
 * tech-writer's lanes (rule 5 also holds for Bash, not only Write/Edit), and
 * edits through the local viewer's write API.
 * @param {string} cmd
 * @param {string} role
 * @returns {{decision:'deny',reason:string}|null}
 */
function subagentBash(cmd, role) {
  const writes = WRITE_VERB.test(cmd) || RUN_VERB.test(cmd);
  if (GIT_DIR_PATH.test(cmd) && writes) return deny('rule 7 — .git (hooks, config, refs) is off limits to subagents');
  if (GIT_EXEC_CONFIG.test(cmd) && !gitConfigReadsOnly(cmd)) return deny('rule 7 — git config that runs programs or reaches outside the project is human-only');
  if (laneWrite(cmd, LEAD_LANE_PATH))
    return laneDeny('rule 5 — .eng-team/** and docs/engineering/** are lead-owned; read them with Read or the shell, never write them');
  if (laneWrite(cmd, READER_DOC_PATH)) return laneDeny(`rule 5 — ${role} may not write tech-writer docs`);
  if (/x-eng-view/i.test(cmd)) return deny('rule 5 — the eng-view write API is for the human, not for subagents');
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
  if (RULES.some((r) => r.main && ruleHits(r, cmd))) return true;
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

const GATE_ROW = /^\|\s*([a-z-]+)\s*\|\s*(skipped|forced)\s*\|/gim;

/** A state.md gate newly set to skipped/forced needs the user's --skip/--force (or plain request) this session. */
function gateOverride(input, next, cur) {
  if (next === null) return null;
  const had = new Set([...cur.matchAll(GATE_ROW)].map((m) => `${m[1].toLowerCase()}:${m[2].toLowerCase()}`));
  for (const m of next.matchAll(GATE_ROW)) {
    const status = m[2].toLowerCase();
    if (had.has(`${m[1].toLowerCase()}:${status}`)) continue;
    const kind = status === 'skipped' ? 'skip' : 'force';
    if (!hasGrant(input.session_id, kind))
      return policyDeny(`marking the ${m[1]} gate ${status} needs the user to ask for it in their own message (for example --${kind} "<reason>")`);
  }
  return null;
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
  const gate = gateOverride(input, next, cur);
  if (gate) return gate;
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
    if (x && !/^(?:changing|switching) /.test(x) && !neverRule(ti.command) && approvedRun(root, input)) return mainThreadAsk(ti.command) ? { decision: 'ask', reason: MAIN_ASK } : null;
    if (x) return denyMain(x, isEngProject(root) ? queueDenied(path.resolve(root), input, x) : null);
    return mainThreadAsk(ti.command) ? { decision: 'ask', reason: MAIN_ASK } : null;
  }
  if (!agent.startsWith(PREFIX)) return null;
  const r = decideAgent(input, root, agent, tool, ti, target, isMcp);
  if (r && r.decision === 'deny' && !/queued as Q-|Not a hard stop/.test(r.reason) && isEngProject(root)) {
    try {
      const what = typeof ti.command === 'string' ? ti.command : `${tool} ${target || ''}`.trim();
      const id = recordStop(path.resolve(root), { agent: agent.slice(PREFIX.length), agentId: input.agent_id, tool, what, reason: r.reason });
      r.reason = r.reason.split('eng-team guard: ').join(`eng-team guard: [${id}] `);
    } catch {
      /* the denial stands either way */
    }
  }
  return r;
}

/** The subagent half of decide(). */
function decideAgent(input, root, agent, tool, ti, target, isMcp) {
  const role = agent.slice(PREFIX.length);
  if (isMcp) {
    if (!mcpDestructive(tool)) return null;
    return ATTENDED.has(input.permission_mode)
      ? { decision: 'ask', reason: `${APPROVE_ASK} (${tool} sends, publishes or deletes outside the project).` }
      : deny(`rule 7 — ${tool} sends, publishes or deletes outside the project and is human-only`);
  }
  if (!WRITERS.has(role))
    return laneDeny(`rule 5 — ${role || 'this agent'} is read-only and may not use ${tool}`);
  if (WRITE_TOOLS.has(tool)) {
    if (typeof target === 'string' && target) {
      const p = protectedPath(realpathNearest(path.resolve(input.cwd || root, target)), root);
      if (p) return deny(`rule 7 — changing ${p} is human-only`);
    }
    return checkWritePath(role, target, root, input.cwd);
  }
  if (typeof ti.command !== 'string') return null;
  if (role === 'eng-tech-writer') return laneDeny('rule 5 — tech-writer has no shell access');
  if (LEAD_ONLY.test(ti.command)) return deny('rule 7 — trash, worktree cleanup and queue closing are for the lead only');
  const lane = subagentBash(unquoteWords(ti.command), role);
  // A destructive command on a lane path is handled as destructive (queued), not as a lane redirect.
  if (lane && !(/Not a hard stop/.test(lane.reason) && destructiveCheck(ti.command, path.resolve(root), input.cwd))) return lane;
  const never = neverRule(ti.command);
  if (never) return deny(`rule 7 — ${never} is human-only`);
  const x = destructiveCheck(ti.command, path.resolve(root), input.cwd);
  const v = x ? null : bashViolation(ti.command, path.resolve(root), input.cwd);
  if (!x && !v) return null;
  // Never approvable: guard policy and settings, autonomy switches.
  if (x && /^(?:changing|switching) /.test(x)) return deny(`rule 7 — destructive: ${x} needs a human`);
  if (approvedRun(root, input)) return null;
  if (x) {
    const q = isEngProject(root) ? queueDenied(path.resolve(root), input, x) : null;
    return deny(`rule 7 — destructive: ${x} needs a human${q ? ` (queued as ${q}; your task waits for it)` : ''}`);
  }
  if (ATTENDED.has(input.permission_mode)) return { decision: 'ask', reason: `${APPROVE_ASK} (${v.rule}).` };
  const q = isEngProject(root) ? queueDenied(path.resolve(root), input, v.rule) : null;
  return deny(`rule 7 — ${v.rule} needs your approval${q ? ` (queued as ${q}; your task waits for it)` : ''}`);
}

/** Rules no approval unlocks (sudo, remote scripts piped to an interpreter). @returns {string|null} */
function neverRule(raw) {
  const cmd = unquoteWords(raw);
  const r = RULES.find((x) => x.never && x.re.test(cmd));
  return r ? r.name : null;
}

/** Permission modes in which a human sees and answers an ask. Anything else (bypass, dontAsk, auto, unknown) queues. */
const ATTENDED = new Set(['default', 'acceptEdits', 'plan']);
const APPROVE_ASK =
  'eng-team guard: rule 7 — an agent wants to run this outside its sandbox. Approve to let it run once; if you reject it, the agent stops and the lead asks you what to do instead';

/** The human approved this exact command in this directory (`approve Q-n`): allow it once. */
function approvedRun(root, input) {
  if (!isEngProject(root)) return false;
  try {
    return Boolean(useApproval(path.resolve(root), input.tool_input.command, input.cwd || root));
  } catch {
    return false;
  }
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
