'use strict';
/**
 * eng-team SessionStart hook: validates .eng-team/policy.json in eng-team
 * projects and gives Claude a one-line policy summary. A missing or invalid
 * policy fails closed (gated, autonomous off) and warns the human.
 */
const fs = require('node:fs');
const path = require('node:path');
const { readPolicy, engHome } = require('./policy.js');
const { markSessionStart } = require('./stop.js');

/**
 * @param {string} root project directory
 * @returns {{systemMessage?: string, context: string}|null} null outside eng-team projects
 */
function summary(root) {
  const eng = path.join(root, '.eng-team');
  if (!fs.existsSync(path.join(eng, 'state.md')) && !fs.existsSync(path.join(eng, 'policy.json'))) return null;
  const { policy: p, state, errors } = readPolicy(root);
  const line =
    `eng-team policy (${state}): max_mode ${p.max_mode}, credentials_scoped ${p.credentials_scoped}, ` +
    `${p.destructive_extra.length} extra destructive commands, ${p.human_required_paths.length} human-required paths. ` +
    'Destructive actions always need the human; policy changes need the human to type /eng-team:eng-policy.';
  if (state === 'ok') return { context: line };
  const why = state === 'missing' ? 'no .eng-team/policy.json' : `.eng-team/policy.json is invalid: ${errors.join('; ')}`;
  return {
    systemMessage: `eng-team: ${why}. Running gated with autonomous mode off. Run /eng-team:eng-policy to fix it.`,
    context: `${line} Policy ${state}: autonomous mode is unavailable until it is fixed.`,
  };
}

const WELCOME =
  'eng-team is installed. New here? Type /eng-team:eng-start for a 5-minute tour (modes, commands, safety rules, ' +
  '/eng-present and /eng-view), or ignore this: it is shown once. Commands failing? Run /eng-team:eng-start check.';

/**
 * Shows the first-run welcome once per install. The marker is written by this
 * hook only, in the plugin data dir (else ~/.eng-team, which the guard protects).
 * @param {string} [dir] marker directory override (tests)
 * @returns {string|null} the message, or null when already shown or disabled
 */
function welcome(dir) {
  if (process.env.ENG_TEAM_NO_WELCOME) return null;
  const base = dir || process.env.CLAUDE_PLUGIN_DATA || engHome();
  const marker = path.join(base, 'welcomed');
  try {
    if (fs.existsSync(marker)) return null;
    fs.mkdirSync(base, { recursive: true });
    fs.writeFileSync(marker, new Date().toISOString() + '\n', { flag: 'wx' });
  } catch {
    return null; // never nag when the marker cannot be stored
  }
  return WELCOME;
}

module.exports = { summary, welcome };

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let s = null;
    let hello = null;
    try {
      const input = JSON.parse(raw);
      hello = welcome();
      const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
      s = summary(root);
      if (s) markSessionStart(root, input.session_id);
    } catch {
      return;
    }
    if (!s && !hello) return;
    const out = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: s ? s.context : '' } };
    const msg = [hello, s && s.systemMessage].filter(Boolean).join('\n');
    if (msg) out.systemMessage = msg;
    process.stdout.write(JSON.stringify(out) + '\n');
  });
}
