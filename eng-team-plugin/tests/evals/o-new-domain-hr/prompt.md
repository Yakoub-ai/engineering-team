---
name: o-new-domain-hr
tags: [engage, questionnaire, agent-formulated, non-legal]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, WebFetch, WebSearch]
---
Use the eng-team plugin's engagement flow (/eng-engage). The scope is in docs/engineering/engagement/ENGAGEMENT.md: an HR onboarding team, English. There is no shipped questionnaire module for HR, so formulate one as the flow describes and save it as the module id hr-onboarding. Then write the English pre-meeting pack for the HR team to docs/engineering/engagement/premeeting-hr-onboarding-en.md, ready to paste into an email.
