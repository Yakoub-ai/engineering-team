#!/usr/bin/env bash
# Tiered eval runner. Usage: run.sh [smoke|changed|full] [extra `claude plugin eval` flags]
#   smoke   (default) the cheap tier, incl. the security cases
#   changed smoke tier plus any case whose paths match files changed vs origin/main
#   full    every case (run before a release or when prompts change broadly)
# Add --list to print the selected cases without running them.
set -euo pipefail
cd "$(dirname "$0")/../.."
mode=${1:-smoke}; [ $# -gt 0 ] && shift
list=0; args=()
for a in "$@"; do [ "$a" = --list ] && list=1 || args+=("$a"); done

changed=""
if [ "$mode" = changed ]; then
  git fetch -q origin main 2>/dev/null || true
  changed=$(git diff --name-only origin/main...HEAD -- . | sed 's#^eng-team-plugin/##')
  changed+=$'\n'$(git diff --name-only -- . | sed 's#^eng-team-plugin/##')
fi

cases=()
while IFS='|' read -r name tier re; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  case "$mode" in
    full) cases+=("$name") ;;
    smoke) [ "$tier" = smoke ] && cases+=("$name") ;;
    changed) if [ "$tier" = smoke ] || echo "$changed" | grep -Eq "$re"; then cases+=("$name"); fi ;;
    *) echo "unknown mode: $mode" >&2; exit 2 ;;
  esac
done < <(cat tests/evals/tiers.conf)

echo "tier=$mode cases: ${cases[*]:-none}"
[ "$list" = 1 ] && exit 0
for c in "${cases[@]}"; do
  claude plugin eval . --case "$c" --model sonnet --ablation none --runs 1 --concurrency 1 \
    --no-publish --trust-plugin --scaffold --allow-tools Bash Write Edit --max-cost-usd 2 "${args[@]}"
done
