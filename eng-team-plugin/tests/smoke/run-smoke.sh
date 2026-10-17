#!/usr/bin/env bash
# End-to-end smoke test: one tiny idea through the whole eng-team lifecycle
# (init → discover → research → architect → build → test → document → review),
# autonomous mode, no subagents (sequential roles), then deterministic checks.
# Usage: tests/smoke/run-smoke.sh [workdir]   (default: a fresh temp dir)
set -u
PLUGIN="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${1:-$(mktemp -d)}"
mkdir -p "$WORK" && cd "$WORK" || exit 1
git init -q 2>/dev/null; git config user.email smoke@example.com; git config user.name smoke

IDEA='A tiny Node.js command-line tool that converts temperatures between Celsius and Fahrenheit (e.g. `node convert.js 100 C` prints `212 F`). Personal tool, no personal data, no cloud, runs locally. Use node --test for tests.'

echo "== running eng-team lifecycle in $WORK"
claude -p "Use the eng-team skill in autonomous mode to take this idea from start to finish through every phase (init, discover, research, architect, build, test, document, review): $IDEA" \
  --plugin-dir "$PLUGIN" --model sonnet --permission-mode acceptEdits \
  --allowedTools "Read Write Edit Glob Grep Skill Bash(node:*) Bash(npm:*) Bash(git:*) Bash(ls:*) Bash(mkdir:*) Bash(cat:*)" \
  --disallowedTools "Agent WebFetch WebSearch" \
  --max-budget-usd 3 > smoke-transcript.txt 2>&1
echo "== lifecycle finished (exit $?); checking results"

pass=0; fail=0
check() { if eval "$2" >/dev/null 2>&1; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1"; fail=$((fail+1)); fi; }

check "state.md exists"                 "test -f .eng-team/state.md"
check "profile.md exists"               "test -f .eng-team/profile.md"
for g in init discover research architect build test document review; do
  check "gate $g passed/skipped"        "grep -Ei '^\| *$g *\| *(passed|skipped|forced) *\|' .eng-team/state.md"
done
check "brief written"                   "test -f docs/brief.md"
check "architecture written"            "test -f docs/architecture.md"
check "at least one ADR"                "ls docs/adr/*.md"
check "testing doc written"             "test -f docs/testing.md"
check "review report written"           "ls docs/reviews/*.md"
check "docs carry Audience: line"       "grep -l '^Audience:' docs/brief.md docs/architecture.md docs/testing.md"
check "converter exists"                "ls *.js src/*.js 2>/dev/null | grep -q ."
check "project tests pass"              "node --test"
check "converter works (100 C → 212)"   "node \$(ls convert.js src/convert.js bin/*.js 2>/dev/null | head -1) 100 C | grep -q 212"

echo "== $pass passed, $fail failed  (workdir: $WORK, transcript: smoke-transcript.txt)"
[ "$fail" -eq 0 ]
