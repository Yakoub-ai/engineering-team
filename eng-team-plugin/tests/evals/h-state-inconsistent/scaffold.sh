#!/bin/bash
# cwd is the run workspace; $0 is the absolute path of this script.
set -euo pipefail
cp -R "$(dirname "$0")/../../fixtures/b-planted-api/." .
# Make the state inconsistent: current_phase is build, but the architect gate is open.
sed -i.bak \
  -e 's/^current_phase: .*/current_phase: build/' \
  -e 's#^| architect | passed .*#| architect | open | | | |#' \
  .eng-team/state.md
rm -f .eng-team/state.md.bak
grep -q '^current_phase: build' .eng-team/state.md
grep -q '^| architect | open' .eng-team/state.md
