#!/usr/bin/env bash
# Structural validator for the eng-team plugin. See validate.py for checks.
exec python3 -I "$(cd "$(dirname "$0")" && pwd)/validate.py" "$@"
