#!/usr/bin/env python3
"""Structural validator for the eng-team plugin (stdlib only).

Usage: validate.py [plugin_root] [--only check1,check2]
Checks: frontmatter, refs, packs, applies, rights, headings, placeholders.
Prints '<check>: <path>: <message>' per error; exit 1 if any.
"""
import pathlib
import re
import sys

CHECKS = ["frontmatter", "refs", "packs", "applies", "rights", "headings", "placeholders"]

READ_ONLY = {"Read", "Grep", "Glob"}
CONTEXT7 = {
    "mcp__context7__resolve-library-id", "mcp__context7__query-docs",
    "mcp__plugin_context7_context7__resolve-library-id",
    "mcp__plugin_context7_context7__query-docs",
}
ALLOWED_TOOLS = {
    "eng-builder": READ_ONLY | {"Write", "Edit", "Bash"},
    "eng-tester": READ_ONLY | {"Write", "Edit", "Bash"},
    "eng-tech-writer": READ_ONLY | {"Write", "Edit"},
    "eng-researcher": READ_ONLY | {"WebFetch", "WebSearch"} | CONTEXT7,
}
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
REF_RE = re.compile(r"`((?:roles|phases|challenger|stacks|compliance|practices|templates|shared)/[\w.-]+\.md)`")
FIELD_RE = re.compile(r"profile\.([A-Za-z_][\w.]*)")
PLACEHOLDER_RE = re.compile(r"\b(TODO|TBD|FIXME)\b")


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
    args, only, i = [], None, 0
    while i < len(argv):
        a = argv[i]
        if a == "--only":
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
                allowed = ALLOWED_TOOLS.get(name, READ_ONLY)
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

    for e in errors:
        print(e)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
