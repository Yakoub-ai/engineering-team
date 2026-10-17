#!/bin/bash
# cwd is the run workspace; $0 is the absolute path of this script.
# Commit 1 is the fixture. Commit 2 adds only CLAUDE.md and .eng-team/context.md, so a
# snapshot taken at commit 1 differs from HEAD by those two non-code files.
set -euo pipefail
cp -R "$(dirname "$0")/../../fixtures/i-legacy-app/." .
g() { git -c user.name=dev -c user.email=dev@example.com "$@"; }
git init -q && g add -A && g commit -qm "Initial OrderDesk API"
SHA=$(git rev-parse --short HEAD)
mkdir -p .eng-team
cat > CLAUDE.md <<'EOF'
# OrderDesk

OrderDesk: order lookup API. Team convention: all SQL goes through src/db.js.
EOF
cat > .eng-team/context.md <<EOF
# Context snapshot

Last scanned commit: $SHA
Scanned: 2026-10-10
Scope: full

## Components

| Component | Path | Purpose | Evidence |
|---|---|---|---|
| HTTP server | src/server.js | Express routes for order lookup | src/server.js |
| Database access | src/db.js | All SQL queries against Postgres | src/db.js |

## Stack

- Node.js with Express (package.json)
- PostgreSQL (src/db.js)
- Deployed on Fly.io (fly.toml)

## Data stores and data classes

- Postgres orders and customers tables. Data classes: personal, including personnummer (src/db.js)

## External services

- None found.

## Entry points

- HTTP routes in src/server.js

## Key facts

- All SQL goes through src/db.js (CLAUDE.md)

## Conflicts

- None.
EOF
g add -A && g commit -qm "Add CLAUDE.md and eng-team context snapshot"
