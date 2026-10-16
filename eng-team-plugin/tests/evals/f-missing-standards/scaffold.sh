#!/bin/bash
# cwd is the run workspace; $0 is the absolute path of this script.
set -euo pipefail
cp -R "$(dirname "$0")/../../fixtures/b-planted-api/." .
# Point the federation standards at a path that does not exist.
sed -i.bak 's|^standards:.*|standards: /nonexistent/standards   # stated|' .eng-team/profile.md
rm -f .eng-team/profile.md.bak
grep -q '^standards: /nonexistent/standards' .eng-team/profile.md
