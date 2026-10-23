#!/bin/bash
# cwd is the run workspace; $0 is the absolute path of this script.
set -euo pipefail
fx="$(dirname "$0")/../../fixtures"
cp -R "$fx/i-legacy-app/." .
mkdir -p .eng-team
cp "$fx/c-autonomous/.eng-team/profile.md" "$fx/c-autonomous/.eng-team/state.md" .eng-team/
sed -i.bak 's/^autonomy: autonomous/autonomy: gated/' .eng-team/profile.md .eng-team/state.md
sed -i.bak 's/| init | passed | .eng-team\/profile.md | agent |/| init | passed | .eng-team\/profile.md | Test Owner |/' .eng-team/state.md
rm -f .eng-team/*.bak
grep -q '^autonomy: gated' .eng-team/state.md
g() { git -c user.name=dev -c user.email=dev@example.com "$@"; }
git init -q && g add -A && g commit -qm "Initial OrderDesk API"
