'use strict';
/**
 * eng-team UserPromptExpansion hook. This event fires only when the human
 * types a slash command, never when Claude invokes one, so it is the place to
 * record human intent the guard can trust:
 *   /eng-team:eng-policy …              → 30-minute window to edit .eng-team/policy.json
 *   /eng-team:eng… --autonomous|--auto  → this session may switch to autonomous mode
 *   /eng-team:eng-queue done|reject Q-n [Q-m …] → the human ran (or refused) queued commands
 *   /eng-team:eng-queue (any arguments)         → entries whose `rm` is verifiably already done close themselves
 * UserPromptSubmit fires for every message the human types (never for file
 * contents, tool output or subagent reports), so it grants the narrow overrides:
 *   --skip …  or "skip the <gate|phase|task>"  → 10-minute window to mark a gate skipped
 *   --force … or "force the <gate|phase>"      → 10-minute window to mark a gate forced
 *   a message naming the policy                → 30-minute window to edit .eng-team/policy.json
 * (loosening a policy still asks; autonomous mode and queue approvals stay command-only).
 * Grants are per session and live in ~/.eng-team/grants/ (guard-protected).
 */
const { writeGrant } = require('./policy.js');
const { mark, parseMark, reconcile } = require('./queue.js');

/**
 * @param {object} input parsed hook stdin
 * @returns {string[]} grant kinds written and queue entries marked
 */
const SKIP = /(?:^|\s)--skip(?=\s|$)|\bskip\b[^.\n]{0,30}\b(?:gate|phase|task|step)\b/i;
const FORCE = /(?:^|\s)--force(?=\s|$)|\bforce\b[^.\n]{0,30}\b(?:gate|phase|task|step)\b/i;
const POLICY = /\b(?:policy|max_mode|destructive_extra|human_required_paths|approval_ttl_hours)\b/i;

/** Natural-language and flag overrides in a message the human typed. @returns {string[]} */
function recordPrompt(input, now) {
  const text = String(input.prompt || '').slice(0, 4000);
  const out = [];
  for (const [kind, re] of [['skip', SKIP], ['force', FORCE], ['policy', POLICY]])
    if (re.test(text) && writeGrant(input.session_id, kind, now)) out.push(kind);
  return out;
}

function record(input, now = Date.now(), root = process.env.CLAUDE_PROJECT_DIR || (input && input.cwd)) {
  if (input && input.hook_event_name === 'UserPromptSubmit') return recordPrompt(input, now);
  if (!input || input.hook_event_name !== 'UserPromptExpansion' || input.expansion_type !== 'slash_command') return [];
  const name = String(input.command_name || '');
  const args = String(input.command_args || '');
  const out = [];
  if (/^(?:eng-team:)?eng-policy$/.test(name) && writeGrant(input.session_id, 'policy', now)) out.push('policy');
  if (/^(?:eng-team:)?eng(?:-[a-z-]+)?$/.test(name) && /(?:^|\s)--(?:auto|autonomous)(?=\s|$)/.test(args) && writeGrant(input.session_id, 'autonomous', now))
    out.push('autonomous');
  if (root && /^(?:eng-team:)?eng-queue$/.test(name)) {
    for (const id of reconcile(root, now)) out.push(`auto:${id}`);
    const q = parseMark(args);
    if (q) for (const id of q.ids) if (mark(root, id, q.status, now)) out.push(`queue:${id}`);
  }
  return out;
}

module.exports = { record };

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    try {
      record(JSON.parse(raw));
    } catch {
      /* no grant is the safe outcome */
    }
  });
}
