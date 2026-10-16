#!/bin/bash
# cwd is the run workspace; $0 is the absolute path of this script.
set -euo pipefail
fx="$(dirname "$0")/../../fixtures"
cp -R "$fx/a-vague-brief/." .
# Gated init asks one profile question per turn, so a single-turn eval would never reach
# discover. Start from an initialised, gated project whose current phase is discover.
mkdir -p .eng-team
cp "$fx/c-autonomous/.eng-team/profile.md" "$fx/c-autonomous/.eng-team/state.md" .eng-team/
sed -i.bak 's/^autonomy: autonomous/autonomy: gated/' .eng-team/profile.md .eng-team/state.md
sed -i.bak 's/| init | passed | .eng-team\/profile.md | agent |/| init | passed | .eng-team\/profile.md | Test Owner |/' .eng-team/state.md
rm -f .eng-team/*.bak
grep -q '^autonomy: gated' .eng-team/state.md
