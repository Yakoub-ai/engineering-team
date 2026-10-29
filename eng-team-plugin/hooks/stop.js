'use strict';
/**
 * eng-team Stop hook: Claude may not finish a turn in an eng-team project
 * after code changed this session without a change receipt that shows its
 * evidence. Code changed = an eng-builder or eng-tester dispatch in the
 * dispatch log since this session started (session.js records the start).
 * Blocks once per stop (stop_hook_active lets the next stop through), and
 * fails open: this is a completeness check, not the security floor.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { entries } = require('./queue.js');

const RECEIPTS = path.join('docs', 'engineering', 'receipts');
const REQUIRED = ['Verified', 'Not verified', 'Approvals needed'];
const sessionFile = (root, sessionId) =>
  path.join(root, '.eng-team', '.cache', 'sessions', `${crypto.createHash('sha256').update(String(sessionId)).digest('hex').slice(0, 32)}.json`);

/** Record when this session started (called by session.js). */
function markSessionStart(root, sessionId, now = Date.now()) {
  if (!sessionId) return;
  const f = sessionFile(root, sessionId);
  if (fs.existsSync(f)) return; // resume or compact keeps the first start
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ start: now }));
}

/** @returns {number|null} ms timestamp of the last code-changing dispatch since `since` */
function lastChange(root, since) {
  let text = '';
  try {
    text = fs.readFileSync(path.join(root, '.eng-team', '.cache', 'dispatch-log.jsonl'), 'utf8');
  } catch {
    return null;
  }
  let last = null;
  for (const line of text.split('\n')) {
    try {
      const e = JSON.parse(line);
      const t = Date.parse(e.ts);
      if ((e.agent === 'eng-builder' || e.agent === 'eng-tester') && t >= since && (last === null || t > last)) last = t;
    } catch {
      /* skip */
    }
  }
  return last;
}

/** @returns {{file: string, text: string, mtime: number}|null} newest receipt */
function newestReceipt(root) {
  let best = null;
  try {
    for (const name of fs.readdirSync(path.join(root, RECEIPTS))) {
      if (!name.endsWith('.md')) continue;
      const file = path.join(root, RECEIPTS, name);
      const mtime = fs.statSync(file).mtimeMs;
      if (!best || mtime > best.mtime) best = { file, mtime };
    }
  } catch {
    return null;
  }
  return best && { ...best, text: fs.readFileSync(best.file, 'utf8') };
}

/** Body of a `## <name>` section, guidance comments removed. */
function section(text, name) {
  const m = new RegExp(`^##\\s+${name}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'm').exec(text);
  return m ? m[1].replace(/<!--[\s\S]*?-->/g, '').trim() : null;
}

/**
 * @param {object} input parsed Stop hook stdin
 * @returns {string|null} reason to block, or null
 */
function check(input, root) {
  if (!input || input.stop_hook_active) return null;
  if (!fs.existsSync(path.join(root, '.eng-team', 'state.md'))) return null;
  let start;
  try {
    start = JSON.parse(fs.readFileSync(sessionFile(root, input.session_id), 'utf8')).start;
  } catch {
    return null;
  }
  const changed = lastChange(root, start);
  if (changed === null) return null;
  const how = `Write or refresh docs/engineering/receipts/<YYYY-MM-DD>-<run>.md from templates/receipt.md (eng-team skill), then finish.`;
  const r = newestReceipt(root);
  if (!r || r.mtime < changed) return `eng-team: code changed in this session (last builder/tester dispatch ${new Date(changed).toISOString()}) but there is no change receipt since then. ${how}`;
  const missing = REQUIRED.filter((s) => !section(r.text, s));
  if (missing.length) return `eng-team: the receipt ${path.relative(root, r.file)} has empty or missing sections: ${missing.join(', ')}. ${how}`;
  if (!/`[^`\n]+`/.test(section(r.text, 'Verified'))) return `eng-team: the receipt's Verified section names no command you ran (\`command\` → result). ${how}`;
  const unlisted = entries(root).filter((e) => e.status === 'pending' && !r.text.includes(e.id)).map((e) => e.id);
  if (unlisted.length) return `eng-team: pending approvals ${unlisted.join(', ')} are not in the receipt's Approvals needed. ${how}`;
  return null;
}

module.exports = { check, markSessionStart, section };

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let reason = null;
    try {
      const input = JSON.parse(raw);
      reason = check(input, process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
    } catch {
      return;
    }
    if (reason) process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
  });
}
