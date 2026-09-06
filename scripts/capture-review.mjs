#!/usr/bin/env node
// capture-review.mjs — build the df-ui-review evidence bundle (this Mac: Playwright,
// per zenith CLAUDE.md; agent-browser is the Linux-box tool).
// Outputs to .reviews/capture/: desktop/mobile section shots, throttled scroll video,
// keyboard-walk notes, reduced-motion shots.
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const out = `${root}.reviews/capture`;
mkdirSync(out, { recursive: true });
execSync('pnpm build', { cwd: root, stdio: 'pipe' });
const server = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', '4321'], { cwd: root, stdio: 'ignore', detached: true });
const SITE = 'http://127.0.0.1:4321/ai-arai-dee/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUp() {
  for (let i = 0; i < 30; i++) { try { if ((await fetch(SITE)).ok) return true; } catch {} await sleep(500); }
  throw new Error('preview never came up');
}

const log = [];
const shot = async (page, name) => { await page.screenshot({ path: `${out}/${name}.png` }); log.push(`${name}.png`); };

try {
  await waitUp();
  const browser = await chromium.launch();

  // ── desktop 1440×900: per-section shots + full page ──
  const d = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dp = await d.newPage();
  await dp.goto(SITE, { waitUntil: 'networkidle' });
  await sleep(1500);
  const sections = dp.locator('[data-section]');
  const n = await sections.count();
  for (let i = 0; i < n; i++) {
    await sections.nth(i).scrollIntoViewIfNeeded();
    await sleep(900);
    await shot(dp, `desktop_s${i + 1}_${(await sections.nth(i).getAttribute('data-section'))}`);
  }
  await dp.evaluate(() => window.scrollTo(0, 0));
  await sleep(600);
  await dp.screenshot({ path: `${out}/desktop_full.png`, fullPage: true });
  log.push('desktop_full.png');

  // ── keyboard walk ──
  const kb = [];
  for (let i = 0; i < 12; i++) {
    await dp.keyboard.press('Tab');
    kb.push(await dp.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return 'body';
      const style = getComputedStyle(el);
      return `${el.tagName}.${String(el.className).slice(0, 40)} outline=${style.outlineStyle} ${style.outlineWidth}`;
    }));
  }
  writeFileSync(`${out}/keyboard-walk.txt`, kb.join('\n'));
  log.push('keyboard-walk.txt');
  await d.close();

  // ── mobile 390×844 + throttled scroll VIDEO (stress FOR3) ──
  const m = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    recordVideo: { dir: out, size: { width: 390, height: 844 } },
  });
  const mp = await m.newPage();
  const cdp = await m.newCDPSession(mp);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await mp.goto(SITE, { waitUntil: 'networkidle' });
  await sleep(1800);
  await shot(mp, 'mobile_hero');
  // slow scroll through the whole page — the video judges jank
  await mp.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y <= h; y += 220) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 110)); }
    await new Promise((r) => setTimeout(r, 500));
    window.scrollTo(0, 0);
  });
  await sleep(800);
  await shot(mp, 'mobile_end');
  const video = mp.video();
  await m.close();
  const vpath = await video.path();
  log.push(`video: ${vpath}`);
  writeFileSync(`${out}/manifest.txt`, log.join('\n'));
  console.log(`captured:\n${log.join('\n')}`);
  await browser.close();
} finally {
  try { process.kill(-server.pid, 'SIGKILL'); } catch {}
}
