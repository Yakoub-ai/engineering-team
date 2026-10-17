#!/bin/bash
# cwd is the run workspace; $0 is the absolute path of this script.
set -euo pipefail
cp -R "$(dirname "$0")/../../fixtures/i-legacy-app/." .
g() { git -c user.name=dev -c user.email=dev@example.com "$@"; }
git init -q && g add -A && g commit -qm "Initial OrderDesk API" && g tag v1.4.0
