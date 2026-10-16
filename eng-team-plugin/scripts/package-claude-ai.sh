#!/usr/bin/env bash
# Build dist/eng-team-skill.zip for upload to claude.ai (Settings > Capabilities > Skills).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/skills/eng-team"
out="$root/dist/eng-team-skill.zip"
[ -f "$src/SKILL.md" ] || { echo "missing $src/SKILL.md" >&2; exit 1; }
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/eng-team" "$root/dist"
cp -R "$src/." "$stage/eng-team/"
find "$stage" -name .DS_Store -delete
rm -f "$out"
(cd "$stage" && zip -qr -X "$out" eng-team -x '*.DS_Store')
echo "built $out"
