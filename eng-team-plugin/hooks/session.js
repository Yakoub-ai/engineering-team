'use strict';
/**
 * eng-team SessionStart hook: validates .eng-team/policy.json in eng-team
 * projects and gives Claude a one-line policy summary. A missing or invalid
 * policy fails closed (gated, autonomous off) and warns the human.
 */
const fs = require('node:fs');
const path = require('node:path');
const { readPolicy } = require('./policy.js');
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

module.exports = { summary };

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let s = null;
    try {
      const input = JSON.parse(raw);
      const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
      s = summary(root);
      if (s) markSessionStart(root, input.session_id);
    } catch {
      return;
    }
    if (!s) return;
    const out = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: s.context } };
    if (s.systemMessage) out.systemMessage = s.systemMessage;
    process.stdout.write(JSON.stringify(out) + '\n');
  });
}
