#!/bin/bash
# cwd is the run workspace; $0 is the absolute path of this script.
set -euo pipefail
cp -R "$(dirname "$0")/../../fixtures/m-engagement/." .
rm -f docs/engineering/engagement/responses-forsvarsteamet.md docs/engineering/engagement/workflow-forsvarsteamet-utredning.md
test -f docs/engineering/engagement/ENGAGEMENT.md
