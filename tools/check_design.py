#!/usr/bin/env python3
"""check_design.py — integrity checker for the df-deep-build living design doc.

The design doc declares an "AC bridge" — every acceptance criterion carries an
AC-<TaskId>-<n> ID linking design layers -> tasks -> tests -> report. This makes
that bridge MACHINE-CHECKED instead of aspirational. stdlib only.

Run (from a project root):
  python3 tools/check_design.py docs/spec/<date>-task-<slug>/design/ \\
      --tasks docs/spec/<date>-task-<slug>/tasks.md
  # exit 0 = clean · 1 = AC-bridge ERRORS (dangling/orphan) · 2 = warnings only

Checks:
  1. AC bridge closed loop
     - dangling:  an AC referenced in a design layer or report but NOT defined
                  in tasks.md  -> ERROR (exit 1)
     - orphan:    an AC defined in tasks.md but referenced in NO design layer
                  -> WARN
     - unreported:an AC defined in tasks.md but absent from every report      -> WARN
  2. Coverage table — per defined AC: which design layer(s) + report row(s).
  3. duplicate-claim advisory — a short quoted token repeated across >=3 layers
     (a drift risk: e.g. a port or model name stated divergently) -> WARN.

ponytail: no AST, no deps. If tasks.md is absent, the dangling check is skipped
(advisory only) and we still report design<->report consistency.
"""
from __future__ import annotations  # 3.9 floor: PEP 604 below (T0, AC-T0-1)

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

AC_RE = re.compile(r"\bAC-[A-Z0-9]+-\d+\b")          # AC-T4-1, AC-SEC-2
# a quoted/port-like token worth de-duping: backticked or "key: value"-ish
QUOTE_RE = re.compile(r"`([^`\n]{4,60})`")


def acs_in(text: str) -> set:
    return set(AC_RE.findall(text or ""))


def load(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def collect(design_dir: Path, tasks_path: Path | None):
    """Return (defined, design_map, report_map, layer_files, quoted)."""
    defined = acs_in(load(tasks_path)) if tasks_path else set()

    design_map, report_map = defaultdict(set), defaultdict(set)
    layer_files, quoted = [], defaultdict(set)
    for p in sorted(design_dir.glob("*.md")):
        txt = load(p)
        ids = acs_in(txt)
        if not ids:
            continue
        if "report" in p.stem:
            for i in ids:
                report_map[i].add(p.name)
        else:
            for i in ids:
                design_map[i].add(p.name)
            layer_files.append(p.name)
        for q in QUOTE_RE.findall(txt):
            quoted[q].add(p.name)
    return defined, design_map, report_map, layer_files, quoted


def _has(d: Path, name: str) -> bool:
    return (d / name).exists()


def _has_api_doc(d: Path) -> bool:
    return _has(d, "openapi.yaml") or _has(d, "openapi.json") or bool(list(d.glob("*__03-api.md")))


# Per project-type required project-level docs (file-existence checks). Other types
# (monorepo/library/cli/ai-automation) have standards.md *sections* as their
# required docs — enforced by the plan phase + LLM, not a regex, so not listed here.
REQUIRED_DOCS = {
    "frontend":  [("design-system.md (component inventory + tokens)", lambda d: _has(d, "design-system.md"))],
    "mobile":    [("design-system.md (component inventory + tokens)", lambda d: _has(d, "design-system.md"))],
    "fullstack": [("design-system.md", lambda d: _has(d, "design-system.md")),
                  ("API doc (openapi.yaml/json or a *__03-api.md)", _has_api_doc)],
    "backend":   [("API doc (openapi.yaml/json or a *__03-api.md)", _has_api_doc)],
}


def detect_type(design_dir: Path):
    """Read 'Project type:' from standards.md if present (else None)."""
    s = design_dir / "standards.md"
    if not s.exists():
        return None
    m = re.search(r"Project type:\*\*\s*`?([a-z-]+)`?", s.read_text(encoding="utf-8"), re.I)
    return m.group(1).strip().lower() if m else None


def check_required_docs(design_dir: Path, ptype: str):
    """Missing required-doc warnings for the project type (empty = compliant)."""
    reqs = REQUIRED_DOCS.get((ptype or "").strip().lower())
    if not reqs:
        return []  # no file-level rules for this type
    missing = []
    for label, pred in reqs:
        try:
            ok = pred(design_dir)
        except Exception:
            ok = False
        if not ok:
            missing.append(f"MISSING REQUIRED DOC ({ptype}): {label}")
    return missing


def main() -> int:
    ap = argparse.ArgumentParser(description="df-deep-build design-doc integrity checker")
    ap.add_argument("design_dir", help="design/ dir (shared + <feature>__<layer>.md)")
    ap.add_argument("--tasks", help="path to the build's tasks.md (AC authority)")
    ap.add_argument("--feature", help="scope to one feature's files (substring match)")
    ap.add_argument("--type", help="project type (frontend/backend/fullstack/...); else read from standards.md")
    args = ap.parse_args()

    design_dir = Path(args.design_dir).resolve()
    tasks_path = Path(args.tasks).resolve() if args.tasks else None
    if not design_dir.is_dir():
        print(f"ERROR: design dir not found: {design_dir}", file=sys.stderr)
        return 1

    defined, design_map, report_map, layer_files, quoted = collect(design_dir, tasks_path)
    if args.feature:
        f = args.feature
        design_map = {k: {x for x in v if f in x} for k, v in design_map.items()}
        report_map = {k: {x for x in v if f in x} for k, v in report_map.items()}

    all_refs = set(design_map) | set(report_map)
    errors, warns = [], []

    # project-type required-docs enforcement (Core gate, extended)
    ptype = args.type or detect_type(design_dir)
    if ptype:
        warns.extend(check_required_docs(design_dir, ptype))

    # 1. AC bridge
    if defined:
        dangling = sorted(all_refs - defined)
        orphan = sorted(defined - set(design_map))
        unreported = sorted(defined - set(report_map))
        for a in dangling:
            loc = sorted((design_map.get(a, set()) | report_map.get(a, set())))
            errors.append(f"DANGLING AC: {a} referenced in {loc} but NOT defined in tasks.md")
        for a in orphan:
            warns.append(f"ORPHAN AC:    {a} defined in tasks.md but in no design layer")
        for a in unreported:
            warns.append(f"UNREPORTED AC:{a} defined in tasks.md but absent from report")
    else:
        warns.append("no tasks.md / no AC IDs found there — skipping dangling check; "
                     "reporting design<->report consistency only")
        only_design = sorted(set(design_map) - set(report_map))
        for a in only_design:
            warns.append(f"DESIGN-ONLY:  {a} in design layers but no report row")

    # 2. Coverage table
    print("=== AC coverage ===")
    if defined:
        print(f"{'AC':<14}{'design layer(s)':<42}{'report'}")
        for a in sorted(defined):
            d = ", ".join(sorted(design_map.get(a, set()))) or "—"
            r = "✓" if a in report_map else "✗"
            print(f"{a:<14}{d:<42}{r}")
    else:
        for a in sorted(all_refs):
            d = ", ".join(sorted(design_map.get(a, set()))) or "—"
            r = "✓" if a in report_map else "✗"
            print(f"{a:<14}{d:<42}{r}")
    print(f"\ntotal ACs: defined={len(defined)} design={len(design_map)} report={len(report_map)}")

    # 3. duplicate-claim advisory
    dups = {q: files for q, files in quoted.items() if len(files) >= 3}
    if dups:
        print("\n=== duplicate-claim advisory (token in >=3 layers — verify they agree) ===")
        for q, files in sorted(dups.items(), key=lambda kv: -len(kv[1]))[:10]:
            warns.append(f"DUP-CLAIM:    `{q}` in {sorted(files)}")
            print(f"  `{q}` -> {sorted(files)}")

    # verdict
    print("\n=== verdict ===")
    for e in errors:
        print("  ERROR  " + e)
    for w in warns:
        print("  warn   " + w)
    if not errors and not warns:
        print("  clean — AC bridge closed, no drift signals.")
    if errors:
        print(f"\nFAIL: {len(errors)} AC-bridge error(s).")
        return 1
    print("\nOK." if not warns else f"\nOK with {len(warns)} warning(s).")
    return 0 if not warns else 2


if __name__ == "__main__":
    sys.exit(main())
