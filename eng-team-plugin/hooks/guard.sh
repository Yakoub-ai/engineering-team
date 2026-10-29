#!/bin/sh
# eng-team PreToolUse guard launcher. Reads the hook JSON on stdin and hands it
# to guard.js. Without Node it fails closed for eng-team subagents and for any
# call inside an eng-team project (the guard is the security floor there);
# everything else is a silent no-op so installing the plugin never disturbs
# unrelated sessions.
input=$(cat)

if ! command -v node >/dev/null 2>&1; then
  dir=${CLAUDE_PROJECT_DIR:-.}
  if printf '%s' "$input" | grep -Eq '"agent_type"[[:space:]]*:[[:space:]]*"eng-team:' ||
    [ -f "$dir/.eng-team/state.md" ] || [ -f "$dir/.eng-team/policy.json" ]; then
    echo "eng-team guard: Node 18+ is required to run eng-team safely; install Node or run this outside an eng-team project" >&2
    exit 2
  fi
  exit 0
fi

printf '%s' "$input" | node "$(dirname "$0")/guard.js"
