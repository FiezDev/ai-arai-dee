#!/usr/bin/env python3
"""render_design.py — render a df-deep-build design/ doc pack to HTML.

Source of truth = markdown under design/. This script is the *view*.

Audience + language model (no toggles — structure does the work):
  * Each section has an easy part and a technical part, BOTH always shown:
      ::: plain  -> easy callout, rendered with NO label (content speaks).
      ::: tech   -> technical callout, label "🔧 Technical detail · รายละเอียดเชิงเทคนิค",
                    sitting right under the easy part as REINFORCEMENT (not a
                    separate section; not hidden). Non-IT reads the easy part and
                    understands; IT reads both for more depth.
  * English and Thai are SEPARATE DOCUMENTS. Inside a callout, `{en}` / `{th}`
    on their own line (or `[EN]`/`[TH]` prefixes) tag the language; the renderer
    emits ONE html file per language present:
      both  ->  <out>_en.html  +  <out>_th.html
      one   ->  <out>_<lang>.html
      none  ->  <out>.html          (content has no {en}/{th} tags)

Example source:
    ::: plain
    {en}
    Easy explanation in English.
    {th}
    คำอธิบายภาษาไทย。
    :::

    ::: tech
    {en}
    Engineering reinforcement (tables/code/mermaid all fine).
    {th}
    รายละเอียดสำหรับวิศวกร
    :::

stdlib only. Run: python3 render_design.py [design_dir] [out_html]
ponytail: minimal markdown subset. Not a full parser.
"""
import html
import os
import re
import sys
from pathlib import Path

# 3.9 portability: compiled once — backslashes inside f-string expressions
# are PEP 701 (3.12+); keep them out of the f-strings (T0, AC-T0-2).
_UL_RE = re.compile(r"^\s*[-*]\s+")
_OL_RE = re.compile(r"^\s*\d+\.\s+")

MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"
MERMAID_SRC = os.environ.get("MERMAID_SRC", MERMAID_CDN)

TECH_LABEL_EN = "🔧 Technical detail"
TECH_LABEL_TH = "🔧 รายละเอียดเชิงเทคนิค"

CSS = """
*{box-sizing:border-box}body{margin:0;font:15px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:#1f2328;background:#fff}
.layout{display:flex;min-height:100vh}
.sidebar{width:248px;flex:0 0 248px;background:#f6f8fa;border-right:1px solid #d0d7de;padding:18px 14px;position:sticky;top:0;height:100vh;overflow:auto}
.sidebar h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#656d76;margin:0 0 10px}
.sidebar .file{display:block;color:#1f2328;text-decoration:none;padding:5px 8px;border-radius:6px;font-size:14px;font-weight:600;margin-top:10px}
.sidebar .file:hover,.sidebar .file.cur{background:#ddf4ff}
.sidebar .sub{display:block;color:#6a737d;text-decoration:none;padding:2px 6px 2px 18px;margin-left:12px;border-left:2px solid #d0d7de;border-radius:0 4px 4px 0;font-size:12px;font-weight:400}
.sidebar .sub:hover{background:#eaeef2;color:#1f2328;border-left-color:#0969da}
.content{flex:1;padding:20px 44px 32px;max-width:980px}
.langbar{padding:8px 44px;background:#f6f8fa;border-bottom:1px solid #d0d7de;font-size:13px;color:#57606a}
.langbar a{color:#0969da;text-decoration:none;font-weight:600;margin-right:14px}
section[data-file]{margin-bottom:48px;padding-bottom:12px;border-bottom:1px solid #eaecef}
h1{font-size:26px;border-bottom:1px solid #d0d7de;padding-bottom:8px}
h2{font-size:20px;margin-top:30px;border-bottom:1px solid #eaecef;padding-bottom:6px}
h3{font-size:16px;margin-top:22px}
code{background:#eff1f3;padding:1px 5px;border-radius:4px;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
pre{background:#f6f8fa;padding:12px 14px;border-radius:8px;overflow:auto;border:1px solid #e0e3e6}
pre code{background:none;padding:0}
table{border-collapse:collapse;margin:10px 0}th,td{border:1px solid #d0d7de;padding:6px 10px;text-align:left}
th{background:#f6f8fa}tr:nth-child(even){background:#fafbfc}
a{color:#0969da}
.callout{border-radius:10px;padding:2px 16px;margin:14px 0;border:1px solid}
.callout .lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:3px 0;display:block}
.callout.plain{background:#eafff1;border-color:#a7e9c3}
.callout.tech{background:#f3f6fb;border-color:#cdd9ec;margin-top:4px}.callout.tech .lbl{color:#3b5b8c}
"""

CALLOUT_OPEN = re.compile(r"^:::\s*(plain|tech)\b\s*$", re.I)
SEG_LINE = re.compile(r"^\s*\[(EN|TH)\]\s*(.*)$", re.I)
LANG_TAG = re.compile(r"^\s*\{(en|th)\}\s*$", re.I)


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "section"


def heading_slug(text: str) -> str:
    t = text.split("·")[0]
    t = re.sub(r"`([^`]+)`", r"\1", t)
    t = re.sub(r"\*+", "", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    return slugify(t)


def inline(s: str) -> str:
    s = html.escape(s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
    return s


def _lang_slice(text: str, lang: str) -> str:
    """For a bilingual heading 'Title · หัวข้อ', return the slice for `lang`."""
    if lang and " · " in text:
        parts = text.split(" · ", 1)
        return (parts[0] if lang == "en" else parts[1]).strip()
    return text


def _md_to_html(md: str) -> str:
    lines = md.splitlines()
    out, i, n = [], 0, len(lines)
    while i < n:
        line = lines[i]
        m = re.match(r"^```(\w*)", line)
        if m:
            lang = m.group(1); body, i = [], i + 1
            while i < n and not lines[i].startswith("```"):
                body.append(lines[i]); i += 1
            i += 1
            raw = "\n".join(body)
            out.append(f'<pre class="mermaid">\n{raw}\n</pre>' if lang == "mermaid"
                       else f"<pre><code>{html.escape(raw)}</code></pre>")
            continue
        if "|" in line and i + 1 < n and re.match(r"^\s*\|?[\s:|-]+\|?\s*$", lines[i + 1]) and "|" in lines[i + 1]:
            header = [c.strip() for c in line.strip().strip("|").split("|")]; i += 2; rows = []
            while i < n and "|" in lines[i] and lines[i].strip():
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")]); i += 1
            t = "<table><thead><tr>" + "".join(f"<th>{inline(h)}</th>" for h in header) + "</tr></thead><tbody>"
            for r in rows:
                t += "<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>"
            out.append(t + "</tbody></table>"); continue
        mh = re.match(r"^(#{1,4})\s+(.*)", line)
        if mh:
            lvl = len(mh.group(1)); out.append(f"<h{lvl}>{inline(mh.group(2))}</h{lvl}>"); i += 1; continue
        if re.match(r"^\s*[-*]\s+", line):
            items = []
            while i < n and re.match(r"^\s*[-*]\s+", lines[i]):
                items.append(f"<li>{inline(_UL_RE.sub('', lines[i]))}</li>"); i += 1
            out.append("<ul>" + "".join(items) + "</ul>"); continue
        if re.match(r"^\s*\d+\.\s+", line):
            items = []
            while i < n and re.match(r"^\s*\d+\.\s+", lines[i]):
                items.append(f"<li>{inline(_OL_RE.sub('', lines[i]))}</li>"); i += 1
            out.append("<ol>" + "".join(items) + "</ol>"); continue
        if not line.strip():
            i += 1; continue
        para = []
        while (i < n and lines[i].strip()
               and not re.match(r"^(#{1,4}\s|```|\s*[-*]\s|\s*\d+\.\s)", lines[i])):
            para.append(lines[i]); i += 1
        out.append(f"<p>{inline(' '.join(para))}</p>")
    return "\n".join(out)


def _segments(inner_md: str) -> list:
    """Ordered list of (lang, html) chunks from a callout body, in SOURCE ORDER.

    Language-NEUTRAL blocks — fenced code/mermaid and GFM tables — are tagged
    'both' (they appear in EVERY language file; you translate prose, not
    diagrams). Prose is tagged by the current '{en}'/'{th}' tag (or '[EN]'/
    '[TH]' prefix); prose before any tag is 'both'. Order is preserved so a
    diagram between two sentences stays between them — not hoisted above the
    intro — when each language file is assembled.
    """
    chunks = []
    state = {"lang": "both", "lines": []}

    def flush():
        if state["lines"]:
            body = "\n".join(state["lines"]).strip()
            if body:
                chunks.append((state["lang"], _md_to_html(body)))
        state["lines"] = []

    lines = inner_md.splitlines()
    i, n = 0, len(lines)
    while i < n:
        ln = lines[i]
        s = ln.strip().lower()
        if s == "{en}":
            flush(); state["lang"] = "en"; i += 1; continue
        if s == "{th}":
            flush(); state["lang"] = "th"; i += 1; continue
        m = SEG_LINE.match(ln)
        if m:
            new_lang = m.group(1).lower()
            if new_lang != state["lang"]:
                flush(); state["lang"] = new_lang
            prose = m.group(2)
            if prose.strip():
                state["lines"].append(prose)
            i += 1; continue
        # neutral: fenced code / mermaid -> 'both'; flush prose first to keep order
        if re.match(r"^```", ln):
            flush()
            block = [ln]; i += 1
            while i < n and not lines[i].startswith("```"):
                block.append(lines[i]); i += 1
            if i < n:
                block.append(lines[i]); i += 1  # closing fence
            body = "\n".join(block).strip()
            if body:
                chunks.append(("both", _md_to_html(body)))
            continue
        # neutral: GFM table -> 'both'; flush prose first to keep order
        if "|" in ln and i + 1 < n and re.match(r"^\s*\|?[\s:|-]+\|?\s*$", lines[i + 1]) and "|" in lines[i + 1]:
            flush()
            block = [ln]; i += 1; block.append(lines[i]); i += 1
            while i < n and "|" in lines[i] and lines[i].strip():
                block.append(lines[i]); i += 1
            body = "\n".join(block).strip()
            if body:
                chunks.append(("both", _md_to_html(body)))
            continue
        state["lines"].append(ln); i += 1
    flush()
    return chunks


def _emit_callout(kind: str, inner_md: str, lang: str) -> str:
    """Render ONE callout for `lang`: neutral visuals ('both') + that language's
    prose, JOINED IN SOURCE ORDER. Empty -> '' (callout omitted in that lang)."""
    chunks = _segments(inner_md)
    body = "".join(html for (cl, html) in chunks if cl == "both" or cl == lang)
    if not body.strip():
        return ""
    label = ""
    if kind == "tech":
        lbl = TECH_LABEL_TH if lang == "th" else TECH_LABEL_EN
        label = f'<span class="lbl">{inline(lbl)}</span>'
    return f'<div class="callout {kind}">{label}{body}</div>'


def convert(md: str, prefix: str, lang: str) -> str:
    """Convert a design .md to HTML for a single language."""
    lines = md.splitlines()
    out, i, n = [], 0, len(lines)
    while i < n:
        line = lines[i]

        mo = CALLOUT_OPEN.match(line)
        if mo:
            kind = mo.group(1).lower(); body, i = [], i + 1
            while i < n and not lines[i].startswith(":::"):
                body.append(lines[i]); i += 1
            i += 1
            callout = _emit_callout(kind, "\n".join(body), lang)
            if callout:
                out.append(callout)
            continue

        m = re.match(r"^```(\w*)", line)
        if m:
            langf = m.group(1); body, i = [], i + 1
            while i < n and not lines[i].startswith("```"):
                body.append(lines[i]); i += 1
            i += 1
            raw = "\n".join(body)
            out.append(f'<pre class="mermaid">\n{raw}\n</pre>' if langf == "mermaid"
                       else f"<pre><code>{html.escape(raw)}</code></pre>")
            continue

        if "|" in line and i + 1 < n and re.match(r"^\s*\|?[\s:|-]+\|?\s*$", lines[i + 1]) and "|" in lines[i + 1]:
            header = [c.strip() for c in line.strip().strip("|").split("|")]; i += 2; rows = []
            while i < n and "|" in lines[i] and lines[i].strip():
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")]); i += 1
            t = "<table><thead><tr>" + "".join(f"<th>{inline(h)}</th>" for h in header) + "</tr></thead><tbody>"
            for r in rows:
                t += "<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>"
            out.append(t + "</tbody></table>"); continue

        mh = re.match(r"^(#{1,4})\s+(.*)", line)
        if mh:
            lvl = len(mh.group(1)); text = _lang_slice(mh.group(2), lang); idattr = ""
            if lvl >= 2 and prefix:
                idattr = f' id="{prefix}-{heading_slug(mh.group(2))}"'
            out.append(f"<h{lvl}{idattr}>{inline(text)}</h{lvl}>"); i += 1; continue

        if re.match(r"^\s*(-{3,}|\*{3,})\s*$", line):
            out.append("<hr>"); i += 1; continue
        if re.match(r"^\s*[-*]\s+", line):
            items = []
            while i < n and re.match(r"^\s*[-*]\s+", lines[i]):
                items.append(f"<li>{inline(_UL_RE.sub('', lines[i]))}</li>"); i += 1
            out.append("<ul>" + "".join(items) + "</ul>"); continue
        if re.match(r"^\s*\d+\.\s+", line):
            items = []
            while i < n and re.match(r"^\s*\d+\.\s+", lines[i]):
                items.append(f"<li>{inline(_OL_RE.sub('', lines[i]))}</li>"); i += 1
            out.append("<ol>" + "".join(items) + "</ol>"); continue
        if not line.strip():
            i += 1; continue
        para = []
        while (i < n and lines[i].strip()
               and not re.match(r"^(#{1,4}\s|:::|```|\s*[-*]\s|\s*\d+\.\s|\s*([-*]){3,}\s*$)", lines[i])):
            para.append(lines[i]); i += 1
        out.append(f"<p>{inline(' '.join(para))}</p>")
    return "\n".join(out)


DIAGRAM_TYPES = {"erDiagram", "stateDiagram", "stateDiagram-v2", "sequenceDiagram",
                 "flowchart", "graph", "journey", "classDiagram", "gantt", "pie", "mindmap"}


def validate_mermaid(body: str) -> list:
    issues = []
    lines = [l for l in body.strip().splitlines() if l.strip()]
    first = lines[0] if lines else ""
    kw = first.split()[0] if first.split() else ""
    if kw not in DIAGRAM_TYPES:
        issues.append(f"unknown/missing diagram keyword '{kw}' (first line: {first!r})")
    if kw == "erDiagram":
        stripped = re.sub(r"[|}o*]+\s*-+\s*[|{o*]+", "", body)
        if stripped.count("{") != stripped.count("}"):
            issues.append("erDiagram: unbalanced entity-block { } braces")
    if kw == "sequenceDiagram" and "->>" not in body and "-->" not in body:
        issues.append("sequenceDiagram: no message arrow (->>/-->)")
    if kw in ("stateDiagram", "stateDiagram-v2", "flowchart", "graph") and "-->" not in body and "---" not in body:
        issues.append(f"{kw}: no edge (-->/---)")
    if kw == "journey" and "section" not in body and "title" not in body:
        issues.append("journey: missing title/section")
    return issues


def validate_pack(design_dir: Path, files: list):
    errs, warns = [], []
    link_re = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
    mock_re = re.compile(r"(?:design/)?mocks/[\w./-]+\.(?:png|jpg|jpeg|webp|svg)")
    for p in files:
        name, md = p.name, p.read_text(encoding="utf-8")
        for m in re.finditer(r"```mermaid\n(.*?)```", md, re.S):
            for iss in validate_mermaid(m.group(1)):
                errs.append(f"{name}: malformed mermaid — {iss}")
        for tgt in link_re.findall(md):
            if tgt.startswith(("http://", "https://", "#", "mailto:")):
                continue
            base = tgt.split("#")[0]
            if base and not (design_dir / base).exists() and not (design_dir.parent / base).exists():
                warns.append(f"{name}: link target not found: {tgt}")
        for ref in mock_re.findall(md):
            if not (design_dir / ref).exists() and not (design_dir.parent / ref).exists():
                warns.append(f"{name}: mock asset not found: {ref}")
        # inline {en}/{th} (not on its own line) is silently ignored by the
        # renderer (it only matches the tag alone on a line) -> warn so authors
        # notice the tag leaked into prose instead of splitting the language.
        for ln in md.splitlines():
            im = re.search(r"\{(en|th)\}", ln, re.I)
            if im and ln.strip().lower() not in ("{en}", "{th}"):
                warns.append(f"{name}: inline tag {{{im.group(1)}}} must be on its own line: {ln.strip()[:60]!r}")
    return errs, warns


def _detect_langs(files: list) -> list:
    """Which languages appear (via {en}/{th} or [EN]/[TH] tags). [] => single-language."""
    langs = set()
    for p in files:
        md = p.read_text(encoding="utf-8")
        if re.search(r"\{en\}|\[EN\]", md):
            langs.add("en")
        if re.search(r"\{th\}|\[TH\]", md):
            langs.add("th")
    return sorted(langs)


def _out_path(out_html: Path, lang) -> Path:
    if lang is None:
        return out_html
    return out_html.with_name(f"{out_html.stem}_{lang}{out_html.suffix}")


def _render_one(files, lang, title_name, design_dir):
    sections, nav = [], []
    for p in files:
        md = p.read_text(encoding="utf-8")
        sid = slugify(p.stem)
        hm = re.search(r"^#\s+(.+)$", md, re.M)
        label = hm.group(1).strip() if hm else p.stem
        sections.append(f'<section data-file="{html.escape(p.name)}" id="{sid}">\n{convert(md, sid, lang)}\n</section>')
        nav.append(f'<a class="file" href="#{sid}">{inline(_lang_slice(label, lang))}</a>')
        for h2 in re.findall(r"^##\s+(.+)$", md, re.M):
            nav.append(f'<a class="sub" href="#{sid}-{heading_slug(h2)}">{inline(_lang_slice(h2, lang))}</a>')
    lang_name = {"en": "English", "th": "ภาษาไทย", None: ""}.get(lang, "")
    title = f"Design — {title_name}" + (f" ({lang_name})" if lang_name else "")
    return f"""<!doctype html>
<html lang="{lang or 'en'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>{CSS}</style>
</head><body>
<div class="layout">
<nav class="sidebar"><h2>Design Doc — TOC</h2>{chr(10).join(nav)}</nav>
<main class="content">
{chr(10).join(sections)}
</main></div>
<script src="{MERMAID_SRC}"></script>
<script>mermaid.initialize({{startOnLoad:true,theme:'neutral',securityLevel:'loose'}});</script>
</body></html>
"""


def render(design_dir: Path, out_html: Path) -> str:
    design_dir = design_dir.resolve()
    files = sorted(p for p in design_dir.glob("*.md"))
    if not files:
        return f"No .md files found in {design_dir}"

    errs, warns = validate_pack(design_dir, files)
    for w in warns:
        print(f"warn: {w}", file=sys.stderr)
    if errs:
        for e in errs:
            print(f"ERROR: {e}", file=sys.stderr)
        print(f"\nrender ABORTED: {len(errs)} error(s). Fix design/ before regenerating.", file=sys.stderr)
        sys.exit(1)

    title_name = design_dir.parent.name or design_dir.name or "design"
    langs = _detect_langs(files) or [None]
    written = []
    for lang in langs:
        p = _out_path(out_html, lang)
        p.write_text(_render_one(files, lang, title_name, design_dir), encoding="utf-8")
        written.append(str(p))
    return f"rendered {len(files)} files x {len(langs)} lang(s) -> {', '.join(written)}"


def main() -> None:
    design_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "design")
    out_html = Path(sys.argv[2] if len(sys.argv) > 2 else "design.html")
    print(render(design_dir, out_html))


if __name__ == "__main__":
    main()
