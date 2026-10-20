#!/bin/bash
# cwd is the run workspace; $0 is the absolute path of this script.
set -euo pipefail
cp -R "$(dirname "$0")/../../fixtures/m-engagement/." .
sed -i.bak 's/^stage: scoping/stage: recommendation/; s/^languages: \[sv\]/languages: [en]/' docs/engineering/engagement/ENGAGEMENT.md
rm -f docs/engineering/engagement/ENGAGEMENT.md.bak
grep -q '^stage: recommendation' docs/engineering/engagement/ENGAGEMENT.md
