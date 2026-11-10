'use strict';
/**
 * eng-team UserPromptExpansion hook. This event fires only when the human
 * types a slash command, never when Claude invokes one, so it is the place to
 * record human intent the guard can trust:
 *   /eng-team:eng-policy …              → 30-minute window to edit .eng-team/policy.json
 *   /eng-team:eng… --autonomous|--auto  → this session may switch to autonomous mode
 *   /eng-team:eng-queue done|reject Q-n [Q-m …] → the human ran (or refused) queued commands
 *   /eng-team:eng-queue (any arguments)         → entries verifiably already done close themselves; expired ones are withdrawn
 * UserPromptSubmit fires for every message the human types (never for file
 * contents, tool output or subagent reports), so it grants the narrow overrides:
 *   --skip …  or "skip the <gate|phase|task>"  → 10-minute window to mark a gate skipped
 *   --force … or "force the <gate|phase>"      → 10-minute window to mark a gate forced
 *   a message naming the policy                → 30-minute window to edit .eng-team/policy.json
 *   any message                                → answers every open guard stop (stops.js)
 *   `approve Q-n` / `reject Q-n` in a message  → approves (Claude may run that exact command once) or rejects
 * (loosening a policy still asks; autonomous mode and queue approvals stay command-only).
 * Grants are per session and live in ~/.eng-team/grants/ (guard-protected).
 */
const { writeGrant } = require('./policy.js');
const { entries, mark, parseMark, parseChat, reconcile, withdrawExpired } = require('./queue.js');
const { answerAll } = require('./stops.js');

/**
 * @param {object} input parsed hook stdin
 * @returns {string[]} grant kinds written and queue entries marked
 */
const SKIP = /(?:^|\s)--skip(?=\s|$)|\bskip\b[^.\n]{0,30}\b(?:gate|phase|task|step)\b/i;
const FORCE = /(?:^|\s)--force(?=\s|$)|\bforce\b[^.\n]{0,30}\b(?:gate|phase|task|step)\b/i;
const POLICY = /\b(?:policy|max_mode|destructive_extra|human_required_paths|approval_ttl_hours|hygiene_keep)\b/i;

/** Natural-language and flag overrides in a message the human typed. @returns {string[]} */
function recordPrompt(input, now) {
  const text = String(input.prompt || '').slice(0, 4000);
  const out = [];
  for (const [kind, re] of [['skip', SKIP], ['force', FORCE], ['policy', POLICY]])
    if (re.test(text) && writeGrant(input.session_id, kind, now)) out.push(kind);
  return out;
}

function record(input, now = Date.now(), root = process.env.CLAUDE_PROJECT_DIR || (input && input.cwd)) {
  if (input && input.hook_event_name === 'UserPromptSubmit') {
    const out = recordPrompt(input, now);
    if (root) {
      for (const q of parseChat(input.prompt || '')) for (const id of q.ids) if (mark(root, id, q.status, now)) out.push(`queue:${id}`);
      for (const id of answerAll(root, now)) out.push(`stop:${id}`);
    }
    return out;
  }
  if (!input || input.hook_event_name !== 'UserPromptExpansion' || input.expansion_type !== 'slash_command') return [];
  const name = String(input.command_name || '');
  const args = String(input.command_args || '');
  const out = [];
  if (/^(?:eng-team:)?eng-policy$/.test(name) && writeGrant(input.session_id, 'policy', now)) out.push('policy');
  if (/^(?:eng-team:)?eng(?:-[a-z-]+)?$/.test(name) && /(?:^|\s)--(?:auto|autonomous)(?=\s|$)/.test(args) && writeGrant(input.session_id, 'autonomous', now))
    out.push('autonomous');
  if (root && /^(?:eng-team:)?eng-queue$/.test(name)) {
    for (const id of reconcile(root, now)) out.push(`auto:${id}`);
    for (const id of withdrawExpired(root, now)) out.push(`expired:${id}`);
    const q = parseMark(args);
    if (q) for (const id of q.ids) if (mark(root, id, q.status, now)) out.push(`queue:${id}`);
  }
  return out;
}

/** One line per queue entry the human just approved or rejected, with the exact command. */
function approvalNote(root, out) {
  const ids = out.filter((x) => x.startsWith('queue:')).map((x) => x.slice(6));
  if (!root || !ids.length) return null;
  const all = entries(root);
  return ids
    .map((id) => all.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => `eng-team: ${e.id} ${e.status}: \`${String(e.command).slice(0, 300)}\` in ${e.cwd}${e.status === 'approved' ? ' (runs once, within 60 minutes)' : ''}`)
    .join('\n');
}

module.exports = { record, approvalNote };

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw);
      const root = process.env.CLAUDE_PROJECT_DIR || input.cwd;
      const note = approvalNote(root, record(input, Date.now(), root));
      // Shown to the human by Claude Code, so what they approved comes from the queue file, not from Claude's summary.
      if (note) process.stdout.write(JSON.stringify({ systemMessage: note }) + '\n');
    } catch {
      /* no grant is the safe outcome */
    }
  });
}
