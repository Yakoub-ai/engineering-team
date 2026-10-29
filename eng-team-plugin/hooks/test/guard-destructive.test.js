'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { decide } = require('../guard.js');

const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engguard-d-')));
for (const d of ['.eng-team', 'src', 'docs', 'migrations', '.claude']) fs.mkdirSync(path.join(proj, d));
fs.writeFileSync(path.join(proj, '.eng-team', 'state.md'), '# state\n');
fs.writeFileSync(path.join(proj, 'src', 'a.js'), '');
fs.writeFileSync(path.join(proj, 'migrations', 'down.sql'), 'BEGIN;\nDROP TABLE users;\nCOMMIT;\n');
fs.writeFileSync(path.join(proj, 'migrations', 'up.sql'), 'CREATE TABLE t (id int);\nDELETE FROM t WHERE id = 1;\n');
const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engguard-plain-')));
test.after(() => {
  fs.rmSync(proj, { recursive: true, force: true });
  fs.rmSync(plain, { recursive: true, force: true });
});

const main = (command, dir = proj) => decide({ cwd: dir, tool_name: 'Bash', tool_input: { command } }, { projectDir: dir });
const builder = (command) =>
  decide({ agent_type: 'eng-team:eng-builder', cwd: proj, tool_name: 'Bash', tool_input: { command } }, { projectDir: proj });
const mainWrite = (file_path, tool = 'Write') => decide({ cwd: proj, tool_name: tool, tool_input: { file_path } }, { projectDir: proj });

const DESTRUCTIVE = [
  // git
  'git push --force', 'git push -f origin main', 'git push origin +main', 'git push origin :old', 'git push --delete origin x',
  'git push --force-with-lease', 'git push --mirror', 'git reset --hard HEAD~1', 'git clean -fdx', 'git branch -D x', 'git branch -d x',
  'git tag -d v1', 'git checkout -- .', 'git checkout .', 'git checkout -f main', 'git restore src/a.js', 'git restore --worktree --staged a',
  'git stash clear', 'git stash drop', "git filter-branch --tree-filter 'rm x' HEAD", 'git filter-repo --path x', 'git reflog expire --all',
  'git update-ref -d refs/heads/x', 'git gc --prune=now',
  // infra and cloud
  'terraform destroy', 'terraform apply -auto-approve', 'tofu state rm x', 'pulumi destroy', 'pulumi up',
  'databricks bundle destroy', 'databricks bundle deploy -t prod', 'databricks bundle deploy --target=production', 'databricks fs rm -r dbfs:/x',
  'databricks workspace delete /x', 'az group delete -n x', 'az storage account delete -n x', 'aws s3 rm s3://b --recursive',
  'aws ec2 terminate-instances --instance-ids i', 'aws s3 sync . s3://b --delete', 'gcloud projects delete p', 'gsutil rm -r gs://b',
  'kubectl delete ns x', 'helm uninstall x', 'docker volume prune', 'docker system prune -af', 'docker compose down -v', 'rsync -a --delete src/ dst/',
  // access and secrets
  'az role assignment create --role Owner --assignee x', 'az keyvault secret set --name x --value y', 'az ad sp create-for-rbac',
  'aws iam attach-role-policy --role-name r', 'aws secretsmanager put-secret-value --secret-id x', 'gcloud projects add-iam-policy-binding p',
  'gcloud secrets versions add s', 'databricks secrets put-secret s k', 'databricks permissions set jobs 1', 'gh secret set X', 'gh repo delete x',
  'kubectl create secret generic x', 'az repos policy create --x',
  // disks, bulk deletes, hidden commands
  'mkfs.ext4 /dev/sda', 'dd if=/dev/zero of=/dev/sda', 'find . -name "*.py" -delete', 'find . -exec rm {} +', 'echo cm0gLXJmIHNyYw== | base64 -d | sh',
  'bash -c "git reset --hard"', 'sh -c \'terraform destroy\'',
  // SQL
  'psql -c "DROP TABLE users"', 'psql -c "delete from users"', 'sqlite3 db "UPDATE users SET admin=1"', 'mysql -e "TRUNCATE t"',
  'psql -c "GRANT ALL ON x TO y"', 'psql -c "ALTER TABLE t DROP COLUMN c"', 'redis-cli FLUSHALL', 'psql -f migrations/down.sql', 'psql db < migrations/down.sql',
  'databricks sql query "DROP SCHEMA x CASCADE"', "mongosh --eval 'db.users.deleteMany({})'",
  // recursive rm of real files
  'rm -rf src', 'rm -rf .', 'rm -rf *', 'rm -rf src/*', 'rm -rf $DIR', 'rm -r docs', `rm -rf ${proj}`, 'rm -rf ~/x',
  // protected files from Bash
  'echo {} > .claude/settings.json', 'cp x .eng-team/policy.json', "sed -i 's/a/b/' .claude/settings.local.json", 'cd .claude && echo x > settings.json',
  'cd .eng-team && echo {} > policy.json', 'ln -sf /tmp/x .eng-team/approvals', "python3 -c \"open('.claude/settings.json','w')\"",
];

const SAFE = [
  'git status', 'git checkout -b feat', 'git checkout main', 'git restore --staged src/a.js', 'git branch -a', 'git branch feat', 'git tag v1',
  'git stash', 'git stash pop', 'git commit -m "remove dead code"', 'git rebase main', 'git log --oneline',
  'terraform plan', 'terraform init', 'databricks bundle deploy -t dev', 'databricks bundle validate', 'az group list', 'aws s3 ls',
  'gcloud projects list', 'kubectl get pods', 'docker compose down', 'docker build .',
  'psql -c "select 1"', 'psql -c "DELETE FROM t WHERE id = 1"', 'psql -f migrations/up.sql', 'grep -rn "DROP TABLE" src', 'npm test',
  'rm -rf node_modules', 'rm -rf build/*', 'rm -rf .eng-team/.cache/x', 'rm -r does-not-exist', 'rm -rf /tmp/x', 'rm -f src/a.js',
  'cat .claude/settings.json', 'jq . .eng-team/policy.json', 'ls 2>&1 | head', 'curl -s localhost:3000 | jq .',
];

test('main thread: destructive commands are denied in eng-team projects', () => {
  for (const c of DESTRUCTIVE) {
    const r = main(c);
    assert.equal(r?.decision, 'deny', c);
    assert.match(r.reason, /^eng-team guard: destructive — .+ needs a human\. Do not retry or work around this/, c);
  }
});

test('subagents: destructive commands are denied as hard stops', () => {
  for (const c of DESTRUCTIVE) {
    const r = builder(c);
    assert.equal(r?.decision, 'deny', c);
    assert.match(r.reason, /HARD-STOP: eng-team guard: /, c);
  }
});

test('main thread: everyday commands pass', () => {
  for (const c of SAFE) assert.equal(main(c), null, c);
  assert.equal(main('git push origin main')?.decision, 'ask');
  assert.equal(main('git push -u origin feat')?.decision, 'ask');
});

test('subagents: everyday commands pass', () => {
  for (const c of SAFE) if (!/^(?:cat|jq)\b/.test(c)) assert.equal(builder(c), null, c);
});

test('outside eng-team projects the main thread is untouched', () => {
  for (const c of ['git push --force', 'rm -rf src', 'terraform destroy']) assert.equal(main(c, plain), null, c);
  assert.equal(decide({ cwd: plain, tool_name: 'mcp__slack__post_message', tool_input: {} }, { projectDir: plain }), null);
});

test('protected files: main thread writes', () => {
  assert.equal(mainWrite('.claude/settings.json')?.decision, 'deny');
  assert.equal(mainWrite(path.join(proj, '.claude/settings.local.json'), 'Edit')?.decision, 'deny');
  assert.equal(mainWrite('.eng-team/approvals/Q-1.md')?.decision, 'deny');
  assert.equal(mainWrite(path.join(__dirname, '..', 'guard.js'), 'Edit')?.decision, 'deny');
  assert.equal(mainWrite('src/a.js'), null);
  assert.equal(mainWrite('.eng-team/state.md', 'Edit'), null);
  // policy.json rules are covered in policy.test.js
});

test('protected files: symlink and case tricks', () => {
  fs.symlinkSync(path.join(proj, '.claude'), path.join(proj, 'cfg'));
  try {
    assert.equal(mainWrite('cfg/settings.json')?.decision, 'deny');
    assert.equal(mainWrite('.CLAUDE/settings.json')?.decision, 'deny');
  } finally {
    fs.rmSync(path.join(proj, 'cfg'));
  }
});

test('protected files: subagent writes', () => {
  const w = (file_path) =>
    decide({ agent_type: 'eng-team:eng-builder', cwd: proj, tool_name: 'Edit', tool_input: { file_path } }, { projectDir: proj });
  assert.equal(w('.claude/settings.json')?.decision, 'deny');
  assert.equal(w('.claude/settings.local.json')?.decision, 'deny');
});

test('MCP tools: outward or deleting tools need a human', () => {
  const m = (tool_name, agent_type) => decide({ cwd: proj, tool_name, tool_input: {}, ...(agent_type && { agent_type }) }, { projectDir: proj });
  for (const t of ['mcp__slack__slack_post_message', 'mcp__github__merge_pull_request', 'mcp__gmail__send_email', 'mcp__drive__delete_file', 'mcp__x__publish'])
    assert.equal(m(t)?.decision, 'ask', t);
  for (const t of ['mcp__github__get_file_contents', 'mcp__plugin_eng-team_eng-team-context__search_context', 'mcp__x__list_posts'])
    assert.equal(m(t), null, t);
  assert.equal(m('mcp__slack__slack_post_message', 'eng-team:eng-builder')?.decision, 'deny');
  assert.equal(m('mcp__plugin_eng-team_eng-team-context__search_context', 'eng-team:eng-architect'), null);
});

test('quoting a command word does not hide it', () => {
  for (const c of ['"git" push --force', "'rm' -rf src", 'git "reset" --hard']) assert.equal(main(c)?.decision, 'deny', c);
});

// Known gaps, kept visible on purpose: pattern matching cannot see through
// variables, interpreters or build scripts. Least-privilege credentials and
// the PostToolUse deletion check (planned) cover these, not this hook.
test('known gaps: indirection is not detected', () => {
  for (const c of ['x=rm; $x -rf src', "python3 -c \"import shutil; shutil.rmtree('src')\"", 'make clean', 'npm run nuke'])
    assert.equal(main(c), null, c);
});

test('protected-file checks do not catch neighbours', () => {
  for (const c of ['node ~/.claude/plugins/cache/m/eng-team/3.7.0/hooks/dispatch-log.js --summary .', 'cp a .claude-plugin/plugin.json',
    'cat CLAUDE.md > notes.md', 'echo hi > .claude/agents/x.md', 'echo x > .eng-team/state.md'])
    assert.equal(main(c), null, c);
  assert.equal(main('cp x ~/.claude/plugins/cache/m/eng-team/hooks/guard.js')?.decision, 'deny');
});
