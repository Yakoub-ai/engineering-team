#!/bin/bash
# cwd is the run workspace; $0 is the absolute path of this script.
set -euo pipefail
cp -R "$(dirname "$0")/../../fixtures/b-planted-api/." .
# Declare a stack for which no curated pack exists.
sed -i.bak 's/^stacks: \[web\]/stacks: [web, sap-btp]/' .eng-team/profile.md
rm -f .eng-team/profile.md.bak
grep -q 'sap-btp' .eng-team/profile.md
