#!/bin/sh
# eng-team PreToolUse guard launcher. Reads the hook JSON on stdin and hands it
# to guard.js. Fails closed only for eng-team subagents when Node is missing;
# everything else (other plugins' agents, the main thread, other projects) is
# a silent no-op so installing the plugin never disturbs unrelated sessions.
input=$(cat)

if ! command -v node >/dev/null 2>&1; then
  if printf '%s' "$input" | grep -Eq '"agent_type"[[:space:]]*:[[:space:]]*"eng-team:'; then
    echo "eng-team guard: Node 18+ is required to run eng-team agents safely" >&2
    exit 2
  fi
  exit 0
fi

printf '%s' "$input" | node "$(dirname "$0")/guard.js"
