#!/usr/bin/env python3
"""gate_check.py — evidence-gate ledger runner for the df-* chain.

The ledger is tasks.md itself: acceptance bullets carry optional indented
CHECK / EXPECT / EVIDENCE lines. This tool parses the ledger, reports verdicts
(--status), and — from T2 — executes CHECK commands, flips boxes and records
the deciding output as EVIDENCE.

Contract (design/gates__03-api.md):
  usage: gate_check.py [--status] [--timeout N] [file ...]
  files default to ./tasks.md — never a glob, the ledger is per-pack.
  exit 0 = all gates met or honestly ABANDONed · 1 = unmet gates remain ·
       2 = usage error or parse error.

Verdicts per criterion: MET / UNMET / LEGACY(unenforced).
  - absent CHECK+EVIDENCE lines = legacy criterion: unenforced, never failed
  - `EVIDENCE: pending` under a ticked box = UNMET ("checked but EVIDENCE pending")
  - ABANDON: <id> <reason> anywhere (outside fences) resolves that criterion
Parser rules (design/gates__02-logic.md):
  0. fenced code blocks are opaque — gate lines inside are examples (stress S2)
  1. a checkbox line opens a criterion; its AC- id is the key when present
  2. deeper-indented CHECK/EXPECT/EVIDENCE lines bind to the criterion above;
     any non-blank line at or above the bullet's indent ends binding
  3. binding NEVER depends on heading or status-line style (D6)
A file with zero CHECK lines is legacy: reported unenforced, exit-neutral.
"""
from __future__ import annotations

import argparse
import contextlib
import fcntl
import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path

AC_ID_RE = re.compile(r"\bAC-[A-Z0-9]+-\d+\b")
GATE_RE = re.compile(r"^(\s*)- \[( |x|X)\] (.*)$")
ATTR_RE = re.compile(r"^(\s+)(CHECK|EXPECT|EVIDENCE):\s?(.*)$")
ABANDON_RE = re.compile(r"^ABANDON:\s*(\S+)\s*(.*)$")
FENCE_RE = re.compile(r"^\s*```")

PENDING = "pending"


class Criterion:
    __slots__ = ("line", "checked", "text", "id", "indent",
                 "check", "expect", "evidence", "evidence_line")

    def __init__(self, line, indent, checked, text):
        self.line = line
        self.indent = indent
        self.checked = checked
        self.text = text
        m = AC_ID_RE.search(text)
        self.id = m.group(0) if m else None
        self.check = None
        self.expect = None
        self.evidence = None
        self.evidence_line = -1


def parse(text):
    """Split a ledger into (criteria, abandoned). Fence-blind."""
    criteria, abandoned = [], {}
    cur = None
    in_fence = False
    for i, raw in enumerate(text.splitlines()):
        if FENCE_RE.match(raw):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        ab = ABANDON_RE.match(raw)
        if ab:
            abandoned[ab.group(1).rstrip(":")] = ab.group(2) or "(no reason)"
            cur = None
            continue
        g = GATE_RE.match(raw)
        if g:
            cur = Criterion(i, len(g.group(1)), g.group(2).lower() == "x", g.group(3).strip())
            criteria.append(cur)
            continue
        a = ATTR_RE.match(raw)
        if a and cur is not None and len(a.group(1)) > cur.indent:
            key = a.group(2).lower()
            val = a.group(3).strip()
            if key == "check":
                cur.check = val
            elif key == "expect":
                cur.expect = val
            else:
                cur.evidence = val
                cur.evidence_line = i
            continue
        if cur is not None and raw.strip() and not raw.startswith(" " * (cur.indent + 1)):
            cur = None  # back at bullet depth or shallower: binding ends
    return criteria, abandoned


def is_pending(c: Criterion) -> bool:
    return c.evidence is None or c.evidence.strip().lower() == PENDING


def classify(criteria, abandoned):
    """→ list of (criterion, verdict, reason). LEGACY file handled by caller."""
    out = []
    for c in criteria:
        if c.id and c.id in abandoned:
            out.append((c, "ABANDONED", abandoned[c.id]))
        elif c.check is None and c.evidence is None:
            out.append((c, "UNENFORCED", "no gate lines"))
        elif not c.checked:
            out.append((c, "UNMET", "unchecked"))
        elif c.evidence is None:
            out.append((c, "UNMET", "no EVIDENCE line"))
        elif is_pending(c):
            out.append((c, "UNMET", "checked but EVIDENCE pending"))
        else:
            out.append((c, "MET", c.evidence))
    return out


def status(files):
    """Report verdicts for every file. Returns exit code."""
    total = {"met": 0, "unmet": 0, "unenforced": 0, "abandoned": 0, "legacy_files": 0}
    parse_errors = 0
    for path in files:
        try:
            text = Path(path).read_text(encoding="utf-8")
        except OSError as e:
            print(f"{path}: CANNOT READ: {e}")
            parse_errors += 1
            continue
        try:
            criteria, abandoned = parse(text)
        except Exception as e:  # defensive: a parse crash is a parse error, never a silent pass
            print(f"{path}: PARSE ERROR: {e}")
            parse_errors += 1
            continue
        if not any(c.check for c in criteria):
            legacy = len(criteria)
            total["unenforced"] += legacy
            total["legacy_files"] += 1
            print(f"{path}: legacy file — {legacy} criteria unenforced (no CHECK lines)")
            continue
        rows = classify(criteria, abandoned)
        counts = {"met": 0, "unmet": 0, "unenforced": 0, "abandoned": 0}
        for c, verdict, reason in rows:
            key = {"MET": "met", "UNMET": "unmet", "UNENFORCED": "unenforced",
                   "ABANDONED": "abandoned"}[verdict]
            counts[key] += 1
            if verdict == "UNMET":
                cid = c.id or f"line {c.line + 1}"
                print(f"  UNMET {cid} ({reason}): {c.text}")
            elif verdict == "ABANDONED":
                print(f"  ABANDONED {c.id}: {reason}")
        total["met"] += counts["met"]
        total["unmet"] += counts["unmet"]
        total["unenforced"] += counts["unenforced"]
        total["abandoned"] += counts["abandoned"]
        print(f"{path}: {len(criteria)} criteria — "
              f"{counts['met']} met, {counts['unmet']} unmet, "
              f"{counts['unenforced']} unenforced, {counts['abandoned']} abandoned")
    print(f"TOTAL: {total['met']} met, {total['unmet']} unmet, "
          f"{total['unenforced']} unenforced ({total['legacy_files']} legacy files), "
          f"{total['abandoned']} abandoned — parse errors: {parse_errors}")
    if parse_errors:
        return 2
    if total["unmet"]:
        print(f"UNMET gates remain: {total['unmet']}")
        return 1
    print("ALL MET")
    return 0


def expect_matches(expect, output):
    """Slash-wrapped EXPECT = JS-style regex; bare = substring."""
    if expect is None:
        return None  # caller falls back to exit code
    m = re.match(r"^/(.+)/([a-z]*)$", expect)
    if m:
        flags = 0
        for ch in m.group(2):
            flags |= {"i": re.I, "m": re.M, "s": re.S}.get(ch, 0)
        try:
            return re.search(m.group(1), output, flags) is not None
        except re.error:
            return False
    return expect in output


def tail(output, cap=200, per_line=100):
    """The deciding lines only: last two non-empty lines, each capped at its
    END (the deciding content lives at a line's end), joined, total-capped."""
    lines = [ln.strip()[-per_line:] for ln in output.splitlines() if ln.strip()]
    last = " | ".join(lines[-2:]) if lines else "(no output)"
    return last[:cap]


@contextlib.contextmanager
def _pack_lock(path: Path):
    """The pack flock — the ONLY critical section is the apply/reset write.
    O_NOFOLLOW: a planted symlink must not redirect or void the lock."""
    lock_path = path.parent / (path.name + ".lock")
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_APPEND | os.O_NOFOLLOW, 0o644)
    fh = os.fdopen(fd, "a", encoding="utf-8")
    try:
        fcntl.flock(fh, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(fh, fcntl.LOCK_UN)
    finally:
        fh.close()


def _apply_by_key(p: Path, updated) -> None:
    """Under the pack flock: re-read the ledger and apply results by Criterion
    key (id, else text) — never by cached line indexes, and never to a
    criterion that vanished or was concurrently satisfied."""
    fresh = p.read_text(encoding="utf-8")
    flines = fresh.splitlines()
    fcrit, _ = parse(fresh)
    by_key = {}
    for fc in fcrit:
        by_key.setdefault(fc.id or f"t:{fc.text}", fc)
    for c in updated:
        fc = by_key.get(c.id or f"t:{c.text}")
        if fc is None:
            continue  # criterion vanished mid-run: nothing to flip
        if fc.checked and not is_pending(fc):
            continue  # concurrently satisfied (or hand-proven): leave it alone
        if fc.line < len(flines):
            flines[fc.line] = flines[fc.line].replace("- [ ]", "- [x]", 1)
        if fc.evidence_line >= 0 < len(flines):
            flines[fc.evidence_line] = f"    EVIDENCE: {c.evidence}"
    p.write_text("\n".join(flines) + "\n", encoding="utf-8")


def run_mode(files, timeout, only=None):
    """Execute unmet gates' CHECKs; flip boxes + write evidence on match.
    --only AC-Tn-k scopes execution to that criterion (siblings' in-flight
    gates are never run)."""
    exit_code = 0
    for path in files:
        p = Path(path)
        updated = []
        # Lock discipline (law L2): the flock is held across the FULL
        # read->run->write cycle, CHECK subprocesses included — never-interleave
        # semantics. (The perf pass proposed executing outside the lock; REVERTED
        # deliberately: L2 + test_flock_held_across_run_cycle pin this shape, and
        # star topology serializes merges at main, so runner contention is rare.)
        try:
            text = p.read_text(encoding="utf-8")
        except OSError as e:
            print(f"{path}: CANNOT READ: {e}")
            exit_code = 2 if exit_code == 0 else exit_code
            continue
        try:
            criteria, abandoned = parse(text)
        except Exception as e:
            print(f"{path}: PARSE ERROR: {e}")
            exit_code = 2
            continue
        if not any(c.check for c in criteria):
            print(f"{path}: legacy file — {len(criteria)} criteria unenforced (no CHECK lines)")
            continue
        with _pack_lock(p):
            drift = _verify_checks_pinned(p, criteria)
            if drift:
                print(f"{path}: BLOCKED: {drift}")
                exit_code = 2
                continue
            keys = [c.id or f"t:{c.text}" for c in criteria]
            if len(set(keys)) != len(keys):
                dupes = sorted({k for k in keys if keys.count(k) > 1})
                print(f"{path}: PARSE ERROR: duplicate criterion key(s) {dupes} — "
                      f"apply-by-key cannot resolve them; fix the ledger")
                exit_code = 2
                continue
            for c in criteria:
                if c.id and c.id in abandoned:
                    continue
                if c.check is None:
                    continue  # manual gate: never executed
                if only and c.id != only:
                    continue  # scoped run: siblings untouched
                met_already = c.checked and not is_pending(c)
                if met_already:
                    continue
                try:
                    res = subprocess.run(c.check, shell=True, capture_output=True,
                                         text=True, timeout=timeout)
                    output = (res.stdout or "") + "\n" + (res.stderr or "")
                    verdict = expect_matches(c.expect, output)
                    if verdict is None:
                        verdict = res.returncode == 0
                    ok = verdict
                    why = tail(output)
                except subprocess.TimeoutExpired:
                    ok, why = False, f"timeout after {timeout}s"
                if ok:
                    c.checked = True
                    c.evidence = why
                    updated.append(c)
                    print(f"  PASS {c.id or 'line ' + str(c.line + 1)}: {c.text}")
                else:
                    print(f"  FAIL {c.id or 'line ' + str(c.line + 1)}: {c.text}")
                    print(f"       {why}")
            if updated:
                _apply_by_key(p, updated)
        # exit verdict from the FILE as written, not the in-memory copy — a
        # duplicate/vanished criterion must not diverge disk from exit code
        try:
            fcrit, fabandoned = parse(p.read_text(encoding="utf-8"))
            still_unmet = sum(1 for _, v, _ in classify(fcrit, fabandoned) if v == "UNMET")
        except Exception:
            still_unmet = 1
        print(f"{path}: {len(criteria)} criteria — {still_unmet} unmet remain after this pass")
        if still_unmet:
            exit_code = 1
    if exit_code == 0:
        print("ALL MET")
    return exit_code


def checks_manifest_path(p: Path) -> Path:
    return p.parent / (p.name + ".checks")


def lock_mode(files):
    """--lock: snapshot sha256 of every CHECK line, keyed by AC id/text.
    Run mode REFUSES a CHECK whose hash no longer matches the manifest —
    plan-time human approval of the deciding command stays pinned."""
    for path in files:
        p = Path(path)
        text = p.read_text(encoding="utf-8")
        criteria, _ = parse(text)
        manifest = {}
        for c in criteria:
            if c.check:
                manifest[c.id or f"t:{c.text}"] = hashlib.sha256(
                    c.check.encode()).hexdigest()
        mp = checks_manifest_path(p)
        mp.write_text("\n".join(f"{k} {v}" for k, v in sorted(manifest.items()))
                      + "\n", encoding="utf-8")
        print(f"{path}: locked {len(manifest)} CHECK line(s) -> {mp.name}")
    return 0


def _verify_checks_pinned(p: Path, criteria) -> str | None:
    """None = OK (or no manifest); else a reason string for the drifted check."""
    mp = checks_manifest_path(p)
    if not mp.exists():
        return None
    pinned = dict(line.split(" ", 1) for line in
                  mp.read_text(encoding="utf-8").splitlines() if " " in line)
    for c in criteria:
        key = c.id or f"t:{c.text}"
        if key in pinned and c.check:
            if hashlib.sha256(c.check.encode()).hexdigest() != pinned[key]:
                return f"{key}: CHECK drifted from the approved manifest — re-approve (plan) and re-lock"
    return None


def reset_mode(files, ac_id):
    """--reset AC-Tn-k: the ledger-compensation primitive for revert-based
    rollback — box → [ ], EVIDENCE → pending. 0 if reset, 1 if not found."""
    for path in files:
        p = Path(path)
        with _pack_lock(p):   # read+parse+write all inside: no stale-line clobber
            try:
                text = p.read_text(encoding="utf-8")
            except OSError:
                continue
            criteria, _ = parse(text)
            for c in criteria:
                if c.id != ac_id:
                    continue
                lines = text.splitlines()
                if c.line < len(lines):
                    lines[c.line] = lines[c.line].replace("- [x]", "- [ ]", 1) \
                        .replace("- [X]", "- [ ]", 1)
                if c.evidence_line >= 0 < len(lines):
                    lines[c.evidence_line] = "    EVIDENCE: pending"
                p.write_text("\n".join(lines) + "\n", encoding="utf-8")
                print(f"  RESET {ac_id} in {path}")
                return 0
    print(f"  {ac_id}: not found in any file")
    return 1


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="df-* evidence-gate ledger runner")
    ap.add_argument("files", nargs="*", default=[], help="tasks.md ledgers (default ./tasks.md)")
    ap.add_argument("--status", action="store_true", help="report only; change nothing")
    ap.add_argument("--only", metavar="AC-ID",
                    help="run mode: execute exactly this criterion's CHECKs (never siblings')")
    ap.add_argument("--reset", metavar="AC-ID",
                    help="compensation: box -> [ ] and EVIDENCE -> pending for this criterion")
    ap.add_argument("--lock", action="store_true",
                    help="snapshot CHECK-line hashes; run mode refuses drifted CHECKs afterwards")
    ap.add_argument("--timeout", type=int, default=120, help="per-check timeout seconds (run mode)")
    args = ap.parse_args(argv)
    files = args.files or ["./tasks.md"]
    if args.status:
        return status(files)
    if args.reset:
        return reset_mode(files, args.reset)
    if args.lock:
        return lock_mode(files)
    return run_mode(files, args.timeout, only=args.only)


if __name__ == "__main__":
    sys.exit(main())
