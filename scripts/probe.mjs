#!/usr/bin/env node
// probe.mjs — the mechanical gate for ai-arai-dee.
//
// Contract (design/ai-arai-dee__06-operations.md):
//   DEFAULT run asserts the FULL site: title, lang=th, 0 console errors,
//   8 [data-section] roots, hero canvas ready, parallax transform delta>0
//   sampled on ALL plates, every image naturalWidth>0 — then a SECOND Playwright
//   context with reducedMotion:'reduce' asserting plate deltas == 0.
//
// Env knobs exist ONLY to narrow during interim development (final gates run the
// knob-less default):
//   MIN_SECTIONS   default 8      — minimum [data-section] roots
//   HERO=0          skip hero canvas assert
//   PARALLAX=0      skip parallax delta asserts
//   REDUCED_MOTION=0 skip the second reduced-motion context
//   BASE_PATH      default /ai-arai-dee/  — derived from astro.config base
//   PORT           default 4321
//
// Freshness: the probe rebuilds, then verifies the served HTML is byte-identical to
// dist/index.html — a stale squatter server cannot pass (stress R3).
// Port: fails fast if occupied without stopping another process.

import { spawn, execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT || 4321);
const BASE_PATH = process.env.BASE_PATH || '/ai-arai-dee/';
const MIN_SECTIONS = Number(process.env.MIN_SECTIONS || 8);
const WANT_HERO = process.env.HERO !== '0';
const WANT_PARALLAX = process.env.PARALLAX !== '0';
const WANT_REDUCED = process.env.REDUCED_MOTION !== '0';
const SITE = `http://127.0.0.1:${PORT}${BASE_PATH}`;

const failures = [];
const ok = (name) => console.log(`  ✓ ${name}`);
const fail = (name, detail) => { failures.push(`${name}: ${detail}`); console.log(`  ✗ ${name}: ${detail}`); };

function sh(cmd) { execSync(cmd, { stdio: 'pipe', cwd: new URL('..', import.meta.url).pathname }); }

async function freePort() {
  try {
    const out = execSync(`lsof -ti :${PORT} || true`, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
    if (out) {
      throw new Error(`port ${PORT} occupied; select a free port with PORT=<number>`);
    }
  } catch (e) { throw new Error(`port check failed: ${e.message}`); }
}

async function samplePlateTransforms(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-parallax-plate]')].map((el) => el.style.transform || '')
  );
}

async function main() {
  console.log('probe: build…');
  sh('pnpm build');
  const distIndex = new URL('../dist/index.html', import.meta.url).pathname;
  if (!existsSync(distIndex)) throw new Error('dist/index.html missing after build');
  const expected = readFileSync(distIndex, 'utf8');
  const legacyVideos = readdirSync(new URL('../dist/_astro/', import.meta.url))
    .filter((name) => /^hero.*\.(mp4|webm)$/.test(name));
  legacyVideos.length === 0 ? ok('build: no legacy hero videos')
    : fail('build', `legacy hero videos emitted: ${legacyVideos.join(', ')}`);

  await freePort();

  console.log(`probe: preview at ${SITE}`);
  const server = spawn('pnpm', ['preview', '--host', '127.0.0.1', `--port`, String(PORT)], {
    cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore', detached: true,
  });

  try {
    // wait for 200
    let up = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(SITE);
        if (res.ok) { up = true; break; }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!up) throw new Error(`preview never came up at ${SITE}`);

    // freshness: served HTML must be byte-identical to this build's dist/index.html
    const served = await (await fetch(SITE)).text();
    served === expected ? ok('freshness: served HTML == dist/index.html')
      : fail('freshness', 'served HTML differs from this build — stale server?');

    const browser = await chromium.launch({ channel: 'chromium' });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    await page.goto(SITE, { waitUntil: 'networkidle' });

    // title + lang
    (await page.title()).includes('ใช้ AI ทำอะไรดี') ? ok('title') : fail('title', await page.title());
    (await page.getAttribute('html', 'lang')) === 'th' ? ok('lang=th') : fail('lang', 'not th');

    // sections — EXACT ids (an error boundary's fallback section must not count)
    const EXPECTED = ['hero', 'intro', 'chapter-content', 'chapter-work', 'chapter-learn', 'chapter-life', 'howto', 'cta'];
    const ids = await page.evaluate(() => [...document.querySelectorAll('[data-section]')].map((el) => el.getAttribute('data-section')));
    const missing = EXPECTED.filter((id) => !ids.includes(id));
    const errored = ids.filter((id) => id === 'error');
    const sectionCount = ids.length - errored.length;
    sectionCount >= MIN_SECTIONS && missing.length === 0 && errored.length === 0
      ? ok(`sections ${sectionCount} (all expected ids present, none errored)`)
      : fail('sections', `count=${sectionCount} missing=[${missing}] errored=[${errored}] got=[${ids}]`);

    // wait for hydration, then scroll through the page so lazy media loads + reveals fire
    await page.waitForTimeout(1200);
    await page.evaluate(async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y <= h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
      await new Promise((r) => setTimeout(r, 700));
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 400));
    });

    // images
    const imgs = await page.evaluate(() =>
      [...document.querySelectorAll('img')].map((i) => ({ src: i.currentSrc, w: i.naturalWidth }))
    );
    const badImgs = imgs.filter((i) => i.w <= 0);
    const needImgs = MIN_SECTIONS >= 8; // full-site mode must actually have images
    badImgs.length === 0 && (!needImgs || imgs.length > 0) ? ok(`images ${imgs.length} loaded`)
      : fail('images', `${badImgs.length}/${imgs.length} unloaded: ${badImgs.map((i) => i.src).join(', ')}`);

    if (WANT_HERO) {
      const canvas = await page.locator('canvas[data-hero-wave]').count();
      const control = await page.locator('[data-hero-pause]').count();
      canvas === 1 && control === 1 ? ok('hero: one canvas and pause control')
        : fail('hero', `canvases=${canvas}, controls=${control}`);
    }

    // parallax delta — sampled on ALL plates at two scroll positions
    if (WANT_PARALLAX) {
      const plates = await page.locator('[data-parallax-plate]').count();
      if (plates === 0) fail('parallax', 'no [data-parallax-plate] elements found');
      else {
        await page.evaluate(() => window.scrollTo(0, Math.floor(document.body.scrollHeight * 0.25)));
        await page.waitForTimeout(400);
        const t1 = await samplePlateTransforms(page);
        await page.evaluate(() => window.scrollTo(0, Math.floor(document.body.scrollHeight * 0.6)));
        await page.waitForTimeout(400);
        const t2 = await samplePlateTransforms(page);
        const moved = t1.map((v, i) => v !== t2[i]);
        moved.every(Boolean) ? ok(`parallax delta on all ${plates} plates`)
          : fail('parallax', `${moved.filter((m) => !m).length}/${plates} plates static (t1=${t1.join('/')})`);
      }
    }

    // reduced motion — second context, deltas must be ZERO
    if (WANT_REDUCED) {
      const rctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
      const rpage = await rctx.newPage();
      await rpage.goto(SITE, { waitUntil: 'networkidle' });
      await rpage.waitForTimeout(1000);
      (await rpage.locator('canvas[data-hero-wave]').count()) === 0
        && (await rpage.locator('[data-hero-background]').evaluate((element) => getComputedStyle(element).backgroundImage)) === 'none'
        ? ok('reduced-motion: plain background, no poster') : fail('reduced-motion', 'hero canvas or poster present');
      await rpage.evaluate(() => window.scrollTo(0, Math.floor(document.body.scrollHeight * 0.25)));
      await rpage.waitForTimeout(400);
      const r1 = await samplePlateTransforms(rpage);
      await rpage.evaluate(() => window.scrollTo(0, Math.floor(document.body.scrollHeight * 0.6)));
      await rpage.waitForTimeout(400);
      const r2 = await samplePlateTransforms(rpage);
      const still = r1.map((v, i) => v === r2[i]);
      still.every(Boolean) ? ok('reduced-motion: all plates still')
        : fail('reduced-motion', `${still.filter((m) => !m).length} plates moved under reduce`);
      await rctx.close();
    }

    consoleErrors.length === 0 ? ok('console clean') : fail('console', consoleErrors.slice(0, 5).join(' | '));

    await browser.close();
  } finally {
    try { process.kill(-server.pid, 'SIGKILL'); } catch {}
    try { server.kill('SIGKILL'); } catch {}
  }

  if (failures.length) {
    console.error(`\nprobe FAILED (${failures.length}):`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log('\nprobe PASSED');
}

main().catch((e) => { console.error(`probe ERROR: ${e.message}`); process.exit(1); });
