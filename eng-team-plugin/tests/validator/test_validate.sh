#!/usr/bin/env bash
# Builds a minimal valid plugin, asserts the validator passes, then applies one
# mutation per check and asserts the validator fails naming that check.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
VALIDATE="$HERE/../../scripts/validate.sh"
fails=0

make_good() {
  local d="$1"
  mkdir -p "$d/.claude-plugin" "$d/agents" "$d/skills/eng-team/phases" \
           "$d/skills/eng-team/templates" "$d/skills/eng-team/stacks"
  echo '{"name":"eng-team","version":"2.0.0"}' > "$d/.claude-plugin/plugin.json"
  mkdir -p "$d/skills/eng-team/roles" "$d/commands"
  local a tools types=""
  for a in researcher architect builder tester tech-writer security-engineer compliance-officer \
           data-engineer platform-engineer sre qa-engineer integration-engineer ai-engineer product-engineer; do
    tools="Read, Grep, Glob"
    case "$a" in builder|tester) tools="Read, Grep, Glob, Write, Edit, Bash";; tech-writer) tools="Read, Grep, Glob, Write, Edit";; esac
    printf -- '---\nname: eng-%s\ndescription: "%s"\ntools: %s\n---\nDenied by eng-team guard: do not retry; return HARD-STOP: <reason>.\n' \
      "$a" "$a" "$tools" > "$d/agents/eng-$a.md"
    printf -- '# %s\n**Mission:** x\n**Owns:** x\n## Method\nx\n## Output\nx\n' "$a" > "$d/skills/eng-team/roles/$a.md"
    types="$types \`eng-team:eng-$a\`"
  done
  printf -- '---\ndescription: "build"\n---\nLoad skill eng-team:eng-team.\n' > "$d/commands/eng-build.md"
  printf -- '---\nname: eng-team\ndescription: orchestrator\n---\nRun `phases/build.md`. Dispatch `eng-builder`, then command `eng-build`. Types:%s\n' "$types" > "$d/skills/eng-team/SKILL.md"
  cat > "$d/skills/eng-team/phases/build.md" <<'EOF'
# Phase: build
## Purpose
x
## Inputs
x
## Steps
x
## Exit criteria
x
## Autonomous mode
x
EOF
  cat > "$d/skills/eng-team/templates/profile.md" <<'EOF'
# Profile
```yaml
name:
stacks: []
regulated:
  financial_entity: no
```
EOF
  cat > "$d/skills/eng-team/stacks/azure.md" <<'EOF'
---
id: azure
kind: stack
status: reviewed
tier: plugin
sources:
  - title: Azure Well-Architected
    url: https://learn.microsoft.com/azure/well-architected/
    accessed: 2026-10-15
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: profile.stacks contains "azure" AND profile.regulated.financial_entity != "yes"
---
# Stack pack: Azure
- check
EOF
}

expect_pass() {
  local d; d="$(mktemp -d)"; make_good "$d"
  if "$VALIDATE" "$d" >/dev/null; then echo "ok   good plugin passes"
  else echo "FAIL good plugin should pass:"; "$VALIDATE" "$d"; fails=$((fails+1)); fi
}

expect_fail() {   # $1 = check name, $2 = mutation (bash run inside plugin dir)
  local d; d="$(mktemp -d)"; make_good "$d"
  (cd "$d" && eval "$2")
  local out; out="$("$VALIDATE" "$d" 2>&1)"; local rc=$?
  if [ $rc -ne 0 ] && grep -q "^$1:" <<<"$out"; then echo "ok   $1 detected"
  else echo "FAIL expected '$1' error, got rc=$rc:"; echo "$out"; fails=$((fails+1)); fi
}

expect_exit() {   # $1 = label, $2 = expected rc, $3 = mutation, rest = validator args
  local label="$1" want="$2" mut="$3"; shift 3
  local d; d="$(mktemp -d)"; make_good "$d"
  (cd "$d" && eval "$mut")
  "$VALIDATE" "$d" "$@" >/dev/null 2>&1; local rc=$?
  if [ $rc -eq "$want" ]; then echo "ok   $label"
  else echo "FAIL $label: expected rc=$want, got rc=$rc"; fails=$((fails+1)); fi
}

expect_pass
expect_exit "--only unknown check exits 2" 2 ":" --only refz
expect_exit "--only filters to named check" 0 "echo 'See \`phases/missing.md\`.' >> skills/eng-team/SKILL.md" --only packs
expect_fail rights      "sed -i.bak 's/tools: Read, Grep, Glob$/tools: Read, Grep, Glob, Write/' agents/eng-architect.md"
expect_fail refs         "echo 'See \`phases/missing.md\`.' >> skills/eng-team/SKILL.md"
expect_fail applies      "sed -i.bak 's/profile.stacks contains/profile.cloud contains/' skills/eng-team/stacks/azure.md"
expect_fail packs        "sed -i.bak '/^review_by:/d' skills/eng-team/stacks/azure.md"
expect_fail headings     "sed -i.bak '/^## Exit criteria/d' skills/eng-team/phases/build.md"
expect_fail placeholders "echo 'TODO finish' >> skills/eng-team/SKILL.md"
expect_fail handoffs     "sed -i.bak 's/^name: eng-sre/name: eng-srx/' agents/eng-sre.md"
expect_fail handoffs     "rm skills/eng-team/roles/sre.md"
expect_fail handoffs     "echo 'Use \`eng-team:eng-ghost\`.' >> skills/eng-team/SKILL.md"
expect_fail handoffs     "echo 'Use \`eng-ghost\`.' >> skills/eng-team/SKILL.md"
expect_fail handoffs     "sed -i.bak 's/eng-team:eng-sre//' skills/eng-team/SKILL.md"
expect_fail handoffs     "echo 'else use a general-purpose agent' >> skills/eng-team/SKILL.md"
expect_fail handoffs     "sed -i.bak 's/HARD-STOP/STOP/' agents/eng-sre.md"
expect_fail handoffs     "sed -i.bak 's/eng-team guard/guard/' agents/eng-qa-engineer.md"
expect_fail handoffs     "sed -i.bak 's/^tools: Read, Grep, Glob\$/tools: Read, Grep, Glob, Bash/' agents/eng-sre.md"
expect_exit "handoffs passes on good plugin" 0 ":" --only handoffs
expect_fail frontmatter  "printf 'no frontmatter\n' > agents/eng-broken.md"

[ $fails -eq 0 ] && echo "ALL VALIDATOR TESTS PASSED" || { echo "$fails validator test(s) failed"; exit 1; }
