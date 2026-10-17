#!/bin/bash
# cwd is the run workspace; $0 is the absolute path of this script.
set -euo pipefail
cp -R "$(dirname "$0")/../../fixtures/b-planted-api/." .
# Add a human-written paragraph that the document phase must not overwrite.
printf '\nNOTE FROM CFO: budget is capped at 40k EUR.\n' >> docs/engineering/product/brief.md
grep -q 'NOTE FROM CFO: budget is capped at 40k EUR.' docs/engineering/product/brief.md
