#!/usr/bin/env python3
"""Structural validator for the eng-team plugin (stdlib only).

Usage: validate.py [plugin_root] [--only check1,check2] [--modules <dir>]
--modules checks only the questionnaire modules in <dir> (for example .eng-team/questionnaires), with the project-module rules.
Checks: frontmatter, refs, packs, applies, rights, headings, placeholders, handoffs, questionnaires.
Prints '<check>: <path>: <message>' per error; exit 1 if any.
"""
import pathlib
import re
import sys

CHECKS = ["frontmatter", "refs", "packs", "applies", "rights", "headings", "placeholders", "handoffs", "questionnaires"]

READ_ONLY = {"Read", "Grep", "Glob"}
CONTEXT7 = {
    "mcp__context7__resolve-library-id", "mcp__context7__query-docs",
    "mcp__plugin_context7_context7__resolve-library-id",
    "mcp__plugin_context7_context7__query-docs",
}
MCP_CONTEXT = {
    f"mcp__plugin_eng-team_eng-team-context__{n}"
    for n in ("search_context", "get_related", "changed_since", "get_doc")
}
ALLOWED_TOOLS = {
    "eng-builder": READ_ONLY | MCP_CONTEXT | {"Write", "Edit", "Bash"},
    "eng-tester": READ_ONLY | MCP_CONTEXT | {"Write", "Edit", "Bash"},
    "eng-tech-writer": READ_ONLY | MCP_CONTEXT | {"Write", "Edit"},
    "eng-researcher": READ_ONLY | MCP_CONTEXT | {"WebFetch", "WebSearch"} | CONTEXT7,
}
WRITERS = {"eng-builder", "eng-tester", "eng-tech-writer"}
EXPECTED_AGENTS = [
    "eng-researcher", "eng-architect", "eng-builder", "eng-tester", "eng-tech-writer",
    "eng-security-engineer", "eng-compliance-officer", "eng-data-engineer",
    "eng-platform-engineer", "eng-sre", "eng-qa-engineer", "eng-integration-engineer",
    "eng-ai-engineer", "eng-product-engineer",
]
QUALIFIED_RE = re.compile(r"eng-team:(eng-[a-z][a-z-]*)")
BACKTICK_AGENT_RE = re.compile(r"`(eng-[a-z][a-z-]*)`")
REQUIRED_TOOLS = {
    "eng-builder": {"Write", "Edit", "Bash"},
    "eng-tester": {"Write", "Edit", "Bash"},
    "eng-tech-writer": {"Write", "Edit"},
}
PACK_DIRS = {"stacks": "stack", "compliance": "compliance", "practices": "practice"}
PACK_KEYS = ["id", "kind", "status", "tier", "sources", "reviewed_by", "review_by", "applies_when"]
PACK_BODY_MAX = 60
HEADINGS = {
    "phases": ["## Purpose", "## Inputs", "## Steps", "## Exit criteria", "## Autonomous mode"],
    "challenger": ["## Purpose", "## Protocol", "## Output"],
}
NEW_ROLES = {"researcher", "architect", "builder", "tester", "tech-writer"}
ROLE_HEADINGS = ["**Mission:**", "**Owns:**", "## Method", "## Output"]
REF_RE = re.compile(r"`((?:roles|phases|challenger|stacks|compliance|practices|templates|shared|questionnaires)/(?:[\w.-]+/)?[\w.-]+\.md)`")
FIELD_RE = re.compile(r"profile\.([A-Za-z_][\w.]*)")
PLACEHOLDER_RE = re.compile(r"\b(TODO|TBD|FIXME)\b")


Q_SCOPES = {"core", "client-type", "area", "country"}
Q_STAGES = {"pre", "meeting"}
Q_AUDIENCES = {"user", "manager", "it"}
Q_TYPES = {"open", "choice", "number", "list", "artifact"}
Q_REQUIRED = ["stage", "priority", "topic", "type", "sv", "en", "why_sv", "why_en", "fills"]
Q_HEAD_RE = re.compile(r"^### (Q-[A-Z]+-\d{2})\s*$", re.M)
Q_FIELD_RE = re.compile(r"^- ([a-z_]+): ?(.*)$")
Q_PRE_MAX = 12


def parse_questions(body):
    """Return [(id, {field: value})] for each '### Q-XXX-NN' block in a questionnaire module."""
    parts = Q_HEAD_RE.split(body)
    out = []
    for i in range(1, len(parts), 2):
        fields = {}
        for line in parts[i + 1].splitlines():
            if line.startswith("## "):
                break
            m = Q_FIELD_RE.match(line)
            if m:
                fields[m.group(1)] = m.group(2).strip()
        out.append((parts[i], fields))
    return out


def split_frontmatter(text):
    """Return (dict, body) or (None, text). Top-level keys only; continuation lines appended."""
    if not text.startswith("---\n"):
        return None, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return None, text
    fm, key = {}, None
    for line in text[4:end].splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", line)
        if m:
            key = m.group(1)
            fm[key] = m.group(2).strip()
        elif key:
            fm[key] = (fm[key] + "\n" + line).strip()
    return fm, text[end + 5:]


def profile_fields(skill):
    """Field names from the yaml block in templates/profile.md, nested as parent.child."""
    path = skill / "templates" / "profile.md"
    if not path.exists():
        return None
    block = re.search(r"```yaml\n(.*?)```", path.read_text(), re.S)
    fields, parent = set(), None
    for line in (block.group(1) if block else "").splitlines():
        top = re.match(r"^([A-Za-z_]\w*):", line)
        sub = re.match(r"^  ([A-Za-z_]\w*):", line)
        if top:
            parent = top.group(1)
            fields.add(parent)
        elif sub and parent:
            fields.add(f"{parent}.{sub.group(1)}")
    return fields


def md_files(root):
    skip = {"tests", "evals", "results"}
    return [p for p in root.rglob("*.md") if not (set(p.relative_to(root).parts) & skip)]


def main(argv):
    args, only, modules, i = [], None, None, 0
    while i < len(argv):
        a = argv[i]
        if a == "--modules":
            if i + 1 >= len(argv) or not argv[i + 1].strip():
                print("usage: --modules requires a directory of questionnaire modules", file=sys.stderr)
                return 2
            modules = argv[i + 1]
            i += 1
        elif a == "--only":
            if i + 1 >= len(argv) or not argv[i + 1].strip():
                print("usage: --only requires a value (comma-separated check names)", file=sys.stderr)
                return 2
            only = argv[i + 1]
            i += 1
        elif a.startswith("--only="):
            only = a.split("=", 1)[1]
            if not only.strip():
                print("usage: --only requires a value (comma-separated check names)", file=sys.stderr)
                return 2
        else:
            args.append(a)
        i += 1
    root = pathlib.Path(args[0] if args else pathlib.Path(__file__).resolve().parent.parent)
    run = set(only.split(",")) if only else set(CHECKS)
    if modules:
        run = {"questionnaires"}
    for name in sorted(run):
        if name not in CHECKS:
            print(f"usage: unknown check '{name}' (valid: {', '.join(CHECKS)})", file=sys.stderr)
            return 2
    skill = root / "skills" / "eng-team"
    errors = []

    def err(check, path, msg):
        if check in run:
            rel = path.relative_to(root) if path.is_absolute() and root in path.parents else path
            errors.append(f"{check}: {rel}: {msg}")

    # frontmatter + rights
    for kind, req in (("agents", ["name", "description", "tools"]), ("commands", ["description"])):
        for p in sorted((root / kind).glob("*.md")):
            fm, _ = split_frontmatter(p.read_text())
            if fm is None:
                err("frontmatter", p, "missing or unterminated frontmatter")
                continue
            for k in req:
                if not fm.get(k):
                    err("frontmatter", p, f"missing key '{k}'")
            if kind == "agents" and fm.get("tools"):
                tools = {t.strip() for t in fm["tools"].split(",") if t.strip()}
                name = fm.get("name", p.stem)
                allowed = ALLOWED_TOOLS.get(name, READ_ONLY | MCP_CONTEXT)
                extra = tools - allowed
                if extra:
                    err("rights", p, f"{name} must not have {sorted(extra)}")
                missing = REQUIRED_TOOLS.get(name, set()) - tools
                if missing:
                    err("rights", p, f"{name} needs {sorted(missing)}")
    skill_md = skill / "SKILL.md"
    if skill_md.exists():
        fm, _ = split_frontmatter(skill_md.read_text())
        if fm is None or not fm.get("name") or not fm.get("description"):
            err("frontmatter", skill_md, "SKILL.md needs name and description")

    # refs
    for p in md_files(root):
        for ref in REF_RE.findall(p.read_text()):
            if not (skill / ref).exists():
                err("refs", p, f"references missing file {ref}")

    # packs + applies
    fields = profile_fields(skill)
    for d, kind in PACK_DIRS.items():
        for p in sorted((skill / d).glob("*.md")):
            fm, body = split_frontmatter(p.read_text())
            if fm is None:
                err("packs", p, "pack has no frontmatter")
                continue
            for k in PACK_KEYS:
                if k not in fm or (k != "reviewed_by" and not fm[k]):
                    err("packs", p, f"missing key '{k}'")
            if fm.get("kind") and fm["kind"] != kind:
                err("packs", p, f"kind '{fm['kind']}' should be '{kind}'")
            if fm.get("status") and fm["status"] not in {"reviewed", "unreviewed", "deprecated"}:
                err("packs", p, f"bad status '{fm['status']}'")
            if fm.get("tier") and fm["tier"] != "plugin":
                err("packs", p, "curated packs must be tier: plugin")
            if fm.get("sources") and "url:" not in fm["sources"]:
                err("packs", p, "sources need at least one url")
            if fm.get("review_by") and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", fm["review_by"]):
                err("packs", p, "review_by must be YYYY-MM-DD")
            if len(body.strip().splitlines()) > PACK_BODY_MAX:
                err("packs", p, f"body exceeds {PACK_BODY_MAX} lines")
            aw = fm.get("applies_when", "")
            if aw and aw != "always":
                if fields is None:
                    err("applies", p, "templates/profile.md missing; cannot check fields")
                    continue
                used = FIELD_RE.findall(aw)
                if not used:
                    err("applies", p, "applies_when must be 'always' or reference profile.<field>")
                for f in used:
                    if f not in fields:
                        err("applies", p, f"unknown profile field '{f}'")

    # headings
    for d, heads in HEADINGS.items():
        for p in sorted((skill / d).glob("*.md")):
            text = p.read_text()
            for h in heads:
                if not re.search(rf"^{re.escape(h)}\s*$", text, re.M):
                    err("headings", p, f"missing heading '{h}'")
    for r in NEW_ROLES:
        p = skill / "roles" / f"{r}.md"
        if p.exists():
            text = p.read_text()
            for h in ROLE_HEADINGS:
                if h not in text:
                    err("headings", p, f"missing '{h}'")

    # placeholders
    for p in md_files(root):
        if p.name == "CHANGELOG.md":
            continue
        for n, line in enumerate(p.read_text().splitlines(), 1):
            if PLACEHOLDER_RE.search(line):
                err("placeholders", p, f"line {n}: placeholder text")

    # handoffs
    agent_names = {p.stem for p in (root / "agents").glob("*.md")}
    command_names = {p.stem for p in (root / "commands").glob("*.md")}
    for a in EXPECTED_AGENTS:
        if a not in agent_names:
            err("handoffs", root / "agents" / f"{a}.md", "expected agent file is missing")
    for p in sorted((root / "agents").glob("*.md")):
        text = p.read_text()
        fm, body = split_frontmatter(text)
        name = (fm or {}).get("name", "")
        if name != p.stem:
            err("handoffs", p, f"name '{name}' must equal filename '{p.stem}'")
        role = p.stem[len("eng-"):] if p.stem.startswith("eng-") else p.stem
        if not (skill / "roles" / f"{role}.md").exists():
            err("handoffs", p, f"no matching roles/{role}.md")
        if "HARD-STOP" not in body:
            err("handoffs", p, "agent body must mention HARD-STOP")
        if "eng-team guard" not in body:
            err("handoffs", p, "agent body must state the 'eng-team guard:' rule")
        if p.stem not in WRITERS:
            tools = {x.strip() for x in (fm or {}).get("tools", "").split(",")}
            bad = tools & {"Write", "Edit", "Bash"}
            if bad:
                err("handoffs", p, f"read-only agent must not have {sorted(bad)}")
    for d in ("skills", "commands"):
        for p in md_files(root / d):
            text = p.read_text()
            for ref in QUALIFIED_RE.findall(text):
                if ref == "eng-team":
                    continue
                if ref not in agent_names:
                    err("handoffs", p, f"eng-team:{ref} is not an agent in agents/")
            for ref in BACKTICK_AGENT_RE.findall(text):
                if ref.startswith("eng-team") or ref in agent_names or ref in command_names:
                    continue
                err("handoffs", p, f"`{ref}` is neither an agent nor a command")
    if skill_md.exists():
        sm = skill_md.read_text()
        for a in EXPECTED_AGENTS:
            if f"eng-team:{a}" not in sm:
                err("handoffs", skill_md, f"SKILL.md must list subagent_type eng-team:{a}")
    for p in md_files(skill):
        if "general-purpose" in p.read_text():
            err("handoffs", p, "no general-purpose agent substitution allowed")

    # questionnaires
    seen_q = {}
    plugin_modules = sorted((skill / "questionnaires").rglob("*.md"))
    if modules:
        for p in plugin_modules:  # ids of shipped modules are taken
            _, b = split_frontmatter(p.read_text())
            for qid, _f in parse_questions(b):
                seen_q[qid] = p.name
        mdir = pathlib.Path(modules)
        if not mdir.is_absolute() and not mdir.exists():
            mdir = root / mdir
        if not mdir.is_dir():
            print(f"usage: --modules directory not found: {modules}", file=sys.stderr)
            return 2
        qfiles = sorted(mdir.rglob("*.md"))
    else:
        qfiles = plugin_modules
    for p in qfiles:
        fm, body = split_frontmatter(p.read_text())
        if fm is None:
            err("questionnaires", p, "module has no frontmatter")
            continue
        for k in ("id", "kind", "domain", "scope", "status", "reviewed_by", "review_by", "languages"):
            if k not in fm or (k != "reviewed_by" and not fm[k]):
                err("questionnaires", p, f"missing key '{k}'")
        if fm.get("kind") and fm["kind"] != "questionnaire":
            err("questionnaires", p, "kind must be 'questionnaire'")
        scope = fm.get("scope", "")
        if scope and scope not in Q_SCOPES:
            err("questionnaires", p, f"bad scope '{scope}'")
        if fm.get("status") and fm["status"] not in {"reviewed", "unreviewed"}:
            err("questionnaires", p, f"bad status '{fm['status']}'")
        if fm.get("status") == "reviewed" and not fm.get("reviewed_by"):
            err("questionnaires", p, "reviewed module needs reviewed_by")
        if fm.get("review_by") and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", fm["review_by"]):
            err("questionnaires", p, "review_by must be YYYY-MM-DD")
        if modules and fm.get("status") != "unreviewed":
            err("questionnaires", p, "a drafted project module must be status: unreviewed")
        if scope in {"area", "country"}:
            gm = re.search(r"^## Guardrails\s*$(.*?)(?=^## |\Z)", body, re.M | re.S)
            if not gm:
                err("questionnaires", p, "missing heading '## Guardrails'")
            if "url:" not in fm.get("sources", ""):
                bullets = [l for l in (gm.group(1) if gm else "").splitlines() if l.startswith("- ")]
                unlabelled = [l for l in bullets if "needs-evidence" not in l and "opinion:" not in l]
                if not modules:
                    err("questionnaires", p, "area and country modules need sources with a url")
                elif not bullets or unlabelled:
                    err("questionnaires", p, "project module without a source url: every guardrail must be labelled needs-evidence or opinion:")
        qs = parse_questions(body)
        if scope != "country" and not qs:
            err("questionnaires", p, "module has no questions")
        pre = {a: 0 for a in Q_AUDIENCES}
        for qid, f in qs:
            if qid in seen_q:
                err("questionnaires", p, f"duplicate question id {qid} (also in {seen_q[qid]})")
            seen_q[qid] = p.name
            for k in Q_REQUIRED:
                if not f.get(k):
                    err("questionnaires", p, f"{qid}: missing field '{k}'")
            if f.get("stage") and f["stage"] not in Q_STAGES:
                err("questionnaires", p, f"{qid}: bad stage '{f['stage']}'")
            if f.get("stage") == "pre":
                for a in (x.strip() for x in f.get("audience", "user, manager").split(",")):
                    if a in pre:
                        pre[a] += 1
            if f.get("priority") and f["priority"] not in {"1", "2", "3"}:
                err("questionnaires", p, f"{qid}: priority must be 1, 2 or 3")
            if f.get("audience"):
                bad = [a.strip() for a in f["audience"].split(",") if a.strip() not in Q_AUDIENCES]
                if bad or f.get("stage") == "meeting":
                    err("questionnaires", p, f"{qid}: audience applies to pre questions and must be user, manager or it")
            if f.get("type") and f["type"] not in Q_TYPES:
                err("questionnaires", p, f"{qid}: bad type '{f['type']}'")
            if f.get("type") == "choice":
                a = [x for x in f.get("options_sv", "").split(";") if x.strip()]
                b = [x for x in f.get("options_en", "").split(";") if x.strip()]
                if len(a) < 2 or len(a) != len(b):
                    err("questionnaires", p, f"{qid}: choice needs equal numbers (2+) of options_sv and options_en")
            if "|" in f.get("sv", "") + f.get("en", ""):
                err("questionnaires", p, f"{qid}: question text must not contain '|'")
        for a, n in pre.items():
            if n > Q_PRE_MAX:
                err("questionnaires", p, f"{n} pre-meeting questions for audience '{a}' exceed {Q_PRE_MAX}")

    for e in errors:
        print(e)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
