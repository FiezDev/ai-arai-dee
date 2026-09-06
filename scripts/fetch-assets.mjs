#!/usr/bin/env node
// fetch-assets.mjs — poll PENDING rows in public/credits.md via `higgsfield generate
// get --json`, download results (magic-byte sniff), finalize rows. One pass per call;
// loop until no PENDING remain or budget (20 min) hits. Replaces the bash wait_all
// (same state machine, design/ai-arai-dee__06-operations.md).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ledgerPath = join(root, 'public/credits.md');
const rawDir = join(root, 'assets-raw');
mkdirSync(rawDir, { recursive: true });

const CREDITS = { hero: 6, intro: 2, 'chapter-content': 2, 'chapter-work': 2, 'chapter-learn': 2, 'chapter-life': 2 };
const SNIFF = { hero: /\.(mp4|webm)$/i, default: /\.(png|jpe?g|webp)$/i };

const hf = (args) => execFileSync('higgsfield', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const node = String(process.version);

function finalize(rows, name, credits) {
  const hit = (r) => (r.startsWith(name + ' |') || r.includes('| ' + name + ' |')) && r.includes('| PENDING |');
  return rows.map((r) => (hit(r) ? r.replace('| PENDING |', `| ${credits} |`) : r));
}
function mark(rows, name, tag) {
  const hit2 = (r) => (r.startsWith(name + ' |') || r.includes('| ' + name + ' |')) && r.includes('| PENDING |');
  return rows.map((r) => (hit2(r) ? r.replace('| PENDING |', `| ${tag} |`) : r));
}

const deadline = Date.now() + 20 * 60 * 1000;
for (;;) {
  let rows = readFileSync(ledgerPath, 'utf8').splitlines?.() ?? readFileSync(ledgerPath, 'utf8').split('\n');
  const pending = rows.filter((r) => r.includes('| PENDING |'));
  if (pending.length === 0) { console.log('no PENDING rows — done.'); break; }

  for (const row of pending) {
    const [name, , job] = row.split('|').map((s) => s.trim());
    let status = '', url = '';
    try {
      const j = JSON.parse(hf(['generate', 'get', job, '--json']));
      status = j.status || '';
      url = j.result_url || '';
    } catch (e) {
      console.log(`${name}: get failed (${String(e.message).slice(0, 80)})`);
      continue;
    }
    rows = readFileSync(ledgerPath, 'utf8').split('\n');
    if (status === 'completed' && url) {
      const ext = url.split('.').pop().split('?')[0];
      const dest = join(rawDir, `${name}.${ext}`);
      let buf;
      try {
        const st = statSync(dest);
        buf = st.size > 1024 ? readFileSync(dest) : Buffer.from(await (await fetch(url)).arrayBuffer());
      } catch {
        buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      }
      const pattern = name === 'hero' ? SNIFF.hero : SNIFF.default;
      if (!pattern.test(dest)) {
        writeFileSync(ledgerPath, mark(rows, name, 'UNKNOWN').join('\n'));
        console.log(`${name}: content-type/extension rejected (${dest}) — row UNKNOWN`);
        continue;
      }
      // magic bytes: PNG/JPEG/WebP/MP4 signatures
      const magic =
        (buf[0] === 0x89 && buf[1] === 0x50) || // PNG/WebP (RIFF handled below)
        (buf[0] === 0xff && buf[1] === 0xd8) || // JPEG
        (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) || // RIFF/WebP
        (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) || // MP4 ftyp
        (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3); // webm
      writeFileSync(dest, buf);
      const credits = CREDITS[name] ?? 'UNKNOWN';
      if (magic) {
        writeFileSync(ledgerPath, finalize(rows, name, credits).join('\n'));
        console.log(`${name}: DONE (${credits} cr, ${(buf.length / 1024 / 1024).toFixed(2)} MB) → ${dest}`);
      } else {
        writeFileSync(ledgerPath, mark(rows, name, 'UNKNOWN').join('\n'));
        console.log(`${name}: magic-byte check FAILED — saved ${dest} but row UNKNOWN`);
      }
    } else if (status === 'failed') {
      writeFileSync(ledgerPath, mark(rows, name, 'FAILED').join('\n'));
      console.log(`${name}: job FAILED — row marked FAILED`);
    } else {
      console.log(`${name}: status=${status || 'unknown'} — still pending`);
    }
  }

  const still = readFileSync(ledgerPath, 'utf8').split('\n').filter((r) => r.includes('| PENDING |'));
  if (still.length === 0) break;
  if (Date.now() > deadline) { console.log('20 min budget reached — PENDING rows kept for next pass'); break; }
  await new Promise((r) => setTimeout(r, 15000));
}
console.log('fetch-assets complete.');
