#!/bin/sh
# eng-team doctor: read-only check of what /eng-view, /eng-present and the hooks need.
# Prints findings and install hints; never installs, writes or contacts the network.
# Exit 0 when everything required is present, 1 otherwise.
root=$(cd "$(dirname "$0")/.." && pwd)
bad=0
ok() { printf 'ok    %s\n' "$1"; }
warn() { printf 'warn  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; bad=1; }

case "$(uname -s 2>/dev/null)" in
  Darwin) node_hint='brew install node  (or https://nodejs.org)' ;;
  Linux) node_hint='your package manager (e.g. apt install nodejs), nvm, or https://nodejs.org' ;;
  *) node_hint='https://nodejs.org (Windows: run Claude Code from WSL or Git Bash)' ;;
esac

if command -v node >/dev/null 2>&1; then
  v=$(node --version 2>/dev/null)
  major=${v#v}; major=${major%%.*}
  case "$major" in
    ''|*[!0-9]*) fail "node reports an unreadable version ($v)" ;;
    *) if [ "$major" -ge 18 ]; then ok "node $v"; else fail "node $v is too old; need 18 or newer: $node_hint"; fi ;;
  esac
else
  fail "node not found. /eng-view, /eng-present and the security hooks need Node 18+. Install: $node_hint"
  warn "without node the guard blocks risky calls inside eng-team projects and skips everywhere else"
fi

command -v git >/dev/null 2>&1 && ok "git $(git --version | cut -d' ' -f3)" || warn "git not found; handovers and receipts work, change tracking does not"

if [ -f "$root/viewer/bin/eng-view.js" ]; then ok "viewer present"; else fail "viewer/bin/eng-view.js missing; reinstall the plugin"; fi
[ -f "$root/hooks/guard.js" ] && ok "guard present" || fail "hooks/guard.js missing; reinstall the plugin"

if [ -n "${CLAUDE_PLUGIN_DATA:-}" ] && [ -d "$CLAUDE_PLUGIN_DATA/viewer-deps/node_modules/@huggingface/transformers" ]; then
  ok "semantic search layer installed"
else
  warn "semantic search layer not installed (optional; /eng-view offers it once, ~25 MB, otherwise TF-IDF is used)"
fi

command -v python3 >/dev/null 2>&1 && ok "python3 (only needed to run the plugin validator)" || warn "python3 not found (only needed for scripts/validate.sh)"

if [ "$bad" -eq 0 ]; then echo "doctor: ready"; else echo "doctor: fix the FAIL lines above, then run again"; fi
exit "$bad"
