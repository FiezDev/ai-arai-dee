#!/usr/bin/env python3
"""visual_diff.py — UI regression for the df-deep-build uitest phase.

agent-browser captures TWO things per journey state: a **snapshot** (the a11y tree
as TEXT — @ref selectors, roles, names) and a **screenshot** (PNG). This tool
diffs a current capture against the baseline under design/mocks/baseline/.

stdlib-first:
  - **structural diff** of snapshot .txt — difflib. ALWAYS works, no deps. Catches
    missing/renamed/reordered elements, changed roles/labels — the regressions
    that matter, in text form (a11y-tree diffs are far less flaky than pixel ones).
  - **pixel diff** of screenshot .png — Pillow if importable; else SKIPPED with a
    note (install Pillow, or rely on structural + human eyeball). We do NOT
    reinvent a PNG decoder under ponytail.

Usage:
  visual_diff.py diff <baseline_dir> <current_dir> [--threshold PCT]
    # exit 0 = within threshold · 1 = regression beyond threshold · 2 = no baseline

The uitest SKILL does a11y judgment by reading the snapshot (LLM) + optional
axe-core; this tool owns deterministic diffing.
"""
import difflib
import sys
from pathlib import Path

PIXEL_THRESHOLD = 0.5  # % pixels changed at which a png is flagged (default)


def try_pillow():
    try:
        from PIL import Image, ImageChops  # noqa
        return True
    except Exception:
        return False


def structural_diff(base: Path, cur: Path):
    a = base.read_text(encoding="utf-8", errors="ignore").splitlines()
    b = cur.read_text(encoding="utf-8", errors="ignore").splitlines()
    ratio = difflib.SequenceMatcher(a=a, b=b).ratio()
    changed = sum(1 for _ in difflib.unified_diff(a, b, lineterm="")) // 1
    # count actual +/- lines
    plus = sum(1 for l in difflib.unified_diff(a, b, lineterm="") if l.startswith("+") and not l.startswith("+++"))
    minus = sum(1 for l in difflib.unified_diff(a, b, lineterm="") if l.startswith("-") and not l.startswith("---"))
    return ratio, plus, minus


def pixel_diff(base: Path, cur: Path, threshold=PIXEL_THRESHOLD):
    if not try_pillow():
        return None  # caller notes "skipped (no Pillow)"
    from PIL import Image, ImageChops
    ia, ib = Image.open(base).convert("RGB"), Image.open(cur).convert("RGB")
    if ia.size != ib.size:
        return {"changed_pct": 100.0, "note": f"size changed {ia.size}->{ib.size}"}
    diff = ImageChops.difference(ia, ib)
    bbox = diff.getbbox()
    if not bbox:
        return {"changed_pct": 0.0}
    hist = diff.histogram()
    nonzero = sum(hist[1:])  # any channel != 0
    total = ia.size[0] * ia.size[1] * 3
    return {"changed_pct": round(100.0 * nonzero / total, 3)}


def cmd_diff(baseline: Path, current: Path, threshold: float):
    if not baseline.is_dir():
        print(f"no baseline dir {baseline} — first run; capturing baseline.")
        return 2
    has_pillow = try_pillow()
    regressions = []
    print(f"=== UI regression: {current} vs {baseline} ===")
    print(f"pixel diff: {'Pillow' if has_pillow else 'SKIPPED (install Pillow for pixel diff)'}\n")

    files = sorted(set(p.name for p in current.iterdir()) & set(p.name for p in baseline.iterdir()))
    new = sorted(set(p.name for p in current.iterdir()) - set(p.name for p in baseline.iterdir()))
    for name in files:
        b, c = baseline / name, current / name
        if name.endswith(".txt"):
            ratio, plus, minus = structural_diff(b, c)
            status = "ok" if ratio == 1.0 else ("REGRESSION" if ratio < 0.98 else "minor")
            print(f"  {name:<32} structural similarity {ratio:.3f} (+{plus}/-{minus})  {status}")
            if ratio < 0.98:
                regressions.append(f"{name}: structural {ratio:.3f}")
        elif name.endswith((".png", ".jpg", ".jpeg", ".webp")):
            if has_pillow:
                r = pixel_diff(b, c, threshold)
                pct = r["changed_pct"]
                status = "ok" if pct < threshold else "REGRESSION"
                print(f"  {name:<32} pixel changed {pct:.3f}%  {status}")
                if pct >= threshold:
                    regressions.append(f"{name}: pixel {pct:.3f}%")
            else:
                print(f"  {name:<32} pixel diff skipped (no Pillow) — eyeball or install Pillow")
    for name in new:
        print(f"  {name:<32} NEW (not in baseline)")

    print(f"\n=== verdict: {len(regressions)} regression(s) beyond threshold ===")
    for r in regressions:
        print(f"  REGRESSION  {r}")
    if not regressions:
        print("  within threshold (or pixel diff skipped).")
    return 1 if regressions else 0


def main():
    args = sys.argv[1:]
    if not args or args[0] not in ("diff",):
        print(__doc__); sys.exit(64)
    if args[0] == "diff":
        if len(args) < 3:
            print("usage: visual_diff.py diff <baseline_dir> <current_dir> [--threshold PCT]")
            sys.exit(64)
        baseline, current = Path(args[1]), Path(args[2])
        threshold = PIXEL_THRESHOLD
        if "--threshold" in args:
            threshold = float(args[args.index("--threshold") + 1])
        sys.exit(cmd_diff(baseline, current, threshold))


if __name__ == "__main__":
    main()
