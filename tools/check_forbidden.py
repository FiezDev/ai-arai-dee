#!/usr/bin/env python3
"""check_forbidden.py — deterministic forbidden-pattern lint for df-deep-build.

Reads rules from design/forbidden.md (one regex per line inside the first fenced
code block; ` # reason` optional) and scans code. Any hit = a Blocker (exit 1),
not a finding to vote on — this is what makes "the same standard every time"
deterministic instead of aspirational. stdlib only.

Usage:
  # scan specific files / dirs
  python3 tools/check_forbidden.py src/ app/ --rules docs/spec/<date>-task-<slug>/design/forbidden.md
  # scan added lines of a git diff (review-time, scope to the change)
  python3 tools/check_forbidden.py --diff main...HEAD --rules docs/spec/<date>-task-<slug>/design/forbidden.md

forbidden.md shape:
  ## Rules
  ```text
  \\balert\\s*\\(        # native alert() blocks CDP — use a modal
  \\bconfirm\\s*\\(
  :\\s*any\\b           # TS `any` — type it
  ```
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

SKIP_EXT = {".md", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico",
            ".pdf", ".lock", ".sum", ".min.js", ".min.css"}


def load_rules(rules_path: Path):
    """First fenced code block in forbidden.md -> list of (regex, reason)."""
    txt = rules_path.read_text(encoding="utf-8") if rules_path.exists() else ""
    m = re.search(r"```(?:text)?\n(.*?)```", txt, re.S)
    block = m.group(1) if m else txt
    rules = []
    for line in block.splitlines():
        line = line.rstrip()
        if not line.strip() or line.strip().startswith("#"):
            continue
        if " #" in line:
            pat, reason = line.split(" #", 1)
        else:
            pat, reason = line, line.strip()
        try:
            rules.append((re.compile(pat.strip()), pat.strip(), reason.strip()))
        except re.error as e:
            print(f"warn: bad rule regex {pat!r}: {e}", file=sys.stderr)
    return rules


def scan_text(text: str, rules, label: str):
    hits = []
    for ln_no, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        # skip pure-comment lines so docs/comments mentioning a pattern don't false-fire
        # (ponytail: full-line comments only — // # * /* <!-- ; inline `code // c` is still scanned,
        #  and we don't tokenize, so a pattern inside an inline comment could still match. ceiling.)
        if stripped.startswith(("//", "#", "*", "/*", "<!--")):
            continue
        for rx, pat, reason in rules:
            if rx.search(line):
                hits.append((label, ln_no, pat, reason, line.strip()[:100]))
    return hits


def iter_files(paths):
    for p in paths:
        pr = Path(p)
        if pr.is_file():
            if pr.suffix in SKIP_EXT:
                continue
            yield pr
        elif pr.is_dir():
            for f in pr.rglob("*"):
                if f.is_file() and f.suffix not in SKIP_EXT:
                    yield f


def main() -> int:
    ap = argparse.ArgumentParser(description="df-deep-build forbidden-pattern lint")
    ap.add_argument("paths", nargs="*", help="files/dirs to scan")
    ap.add_argument("--diff", metavar="RANGE", help="scan added lines of `git diff RANGE`")
    ap.add_argument("--rules", required=True, help="forbidden.md path (task-specific, e.g. docs/spec/<date>-task-<slug>/design/forbidden.md)")
    args = ap.parse_args()

    rules_path = Path(args.rules)
    rules = load_rules(rules_path)
    if not rules:
        print(f"no rules loaded from {rules_path} — nothing to check.", file=sys.stderr)
        return 0

    hits = []
    if args.diff:
        out = subprocess.run(["git", "diff", args.diff, "--unified=0"],
                             capture_output=True, text=True).stdout
        cur_file = None
        for line in out.splitlines():
            if line.startswith("+++ b/"):
                cur_file = line[6:]
            elif line.startswith("+") and not line.startswith("+++"):
                for rx, pat, reason in rules:
                    if rx.search(line[1:]):
                        hits.append((cur_file or "?", 0, pat, reason, line[1:].strip()[:100]))
    else:
        for f in iter_files(args.paths):
            try:
                hits += scan_text(f.read_text(encoding="utf-8", errors="ignore"), rules, str(f))
            except Exception as e:
                print(f"warn: skip {f}: {e}", file=sys.stderr)

    # report
    if hits:
        print(f"FORBIDDEN: {len(hits)} hit(s) — auto-Blocker:\n")
        for label, ln, pat, reason, snippet in hits:
            where = f"{label}:{ln}" if ln else label
            print(f"  {where}  [{pat}]  {reason}")
            print(f"    -> {snippet}")
        print(f"\nFAIL: {len(hits)} forbidden-pattern hit(s). Fix before merge.")
        return 1
    print(f"OK: 0 forbidden-pattern hits ({len(rules)} rules).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
