#!/bin/bash
# cwd is the run workspace; $0 is the absolute path of this script.
set -euo pipefail
cp -R "$(dirname "$0")/../../fixtures/m-engagement/." .
rm -f docs/engineering/engagement/responses-forsvarsteamet.md docs/engineering/engagement/workflow-forsvarsteamet-utredning.md
cat > docs/engineering/engagement/ENGAGEMENT.md <<'EOT'
# Fictional Retail AB — Engagement

Audience: the consultant
Last verified against: 2026-10-20

stage: scoping
client: Fictional Retail AB (fictional)
domain: hr
country: se
languages: [en]
client_type: retail company, 600 employees
decision_maker: HR director
budget_owner: HR director
approved_by:
approved_on:

## Teams
| Team | Areas | Attendees (roles) | Status |
|---|---|---|---|
| HR onboarding | onboarding, employee data | HR manager, two HR coordinators, IT service desk lead | scoped |

## Open items
| ID | Item | Owner | Date |
|---|---|---|---|

## Files
EOT
test -f docs/engineering/engagement/ENGAGEMENT.md
