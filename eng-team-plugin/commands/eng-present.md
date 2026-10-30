---
description: "eng-team: build the presentation outputs (cheatsheet, brief, product summary, deck) from this project's docs into docs/present/, themed, offline"
argument-hint: "[cheatsheet|brief|summary|deck|all] [--theme <preset>] [--force]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory and the Environment and tooling policy in `shared/orchestration.md`. `/eng-present` is standalone: it works in any project state, needs no `/eng-init`, never changes gate statuses, and writes only `docs/present/`, the theme file and empty sections of the source docs named below.

Steps:

1. **Check Node.** Run `node --version`; Node 18 or newer is required. If it is missing or older, run `sh ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.sh`, show its install hint for this OS and stop (never install Node yourself without asking once; see the Environment and tooling policy).
2. **Theme (only if `--theme <preset>` was given).** Presets: `clean`, `midnight`, `editorial`, `forest`, `mono`. Write `{"preset": "<name>"}` to `.eng-team/theme.json`. To use a brand shared across projects instead, the user puts a theme in `~/.eng-team/theme.json` and the project file says `{"use": "shared"}`.
3. **Build.** Run `node ${CLAUDE_PLUGIN_ROOT}/viewer/bin/eng-view.js build --project "$PWD"` plus `--only <name>` for a single output and `--force` if given. It is deterministic and costs no tokens; it re-renders only outputs whose sources, theme or builder changed. Read its `gap` lines (`gap <output>: <section> <- <source file>`).
4. **Fill gaps (only on a standard or full track, or when the user asks).** On the lean track, skip this step and just report the gaps. Otherwise dispatch one `eng-presenter` (full type `eng-team:eng-presenter`, `model` from `shared/track.md` → Models per dispatch, "Do not modify files") with the absolute paths of `roles/presenter.md`, the gap list and the source docs. Save each returned `### <path> › <section>` block into that section of that file, only if the section is currently empty (never overwrite human text), and show the user any `needs-input` questions. Then run the build again.
5. **Report** the output paths under `docs/present/` (open them in a browser; they are self-contained HTML; the deck is one 16:9 slide per screen, scroll or Page Down to move, and Print to PDF in landscape with background graphics on gives one slide per page; text and tables copy cleanly into PowerPoint), the theme used, and the remaining gaps. The viewer (`/eng-view`) has one **Present & needs** tab (wants and needs from the product doc and questions, plus a preview of each output, theme switch and Build all; also listed in the sidebar next to the docs); edit the source docs there, then Build all or run `/eng-present` again.

Arguments: $ARGUMENTS
