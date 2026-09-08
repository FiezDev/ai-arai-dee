import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const site = process.env.SITE || 'http://127.0.0.1:4325/ai-arai-dee/';
const output = new URL('../.reviews/threejs-hero/startup/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
const legacyRequests = [];
const errors = [];

function track(page) {
  page.on('request', (request) => {
    if (['image', 'media'].includes(request.resourceType())
      && /\/hero(?:-poster[^/]*|[^/]*\.(?:mp4|webm))(?:\?|$)/.test(request.url())) {
      legacyRequests.push(request.url());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
}

async function checkBackground(page, label) {
  assert.equal(await page.locator('video').count(), 0, `${label}: no video element`);
  assert.equal(await page.locator('[data-hero-background] img').count(), 0, `${label}: no poster element`);
  assert.equal(await page.locator('[data-hero-background]').evaluate((element) =>
    getComputedStyle(element).backgroundImage), 'none', `${label}: no poster background`);
  assert.deepEqual(legacyRequests, [], `${label}: no legacy media downloads`);
}

try {
  const ssr = await browser.newContext({ javaScriptEnabled: false });
  const initial = await ssr.newPage();
  track(initial);
  await initial.goto(site, { waitUntil: 'networkidle' });
  await checkBackground(initial, 'before hydration');
  assert.ok(await initial.locator('main h1').isVisible());
  await ssr.close();
  console.log('PASS server-rendered page has no video or poster before JavaScript');

  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    track(page);
    let release;
    let intercepted;
    const held = new Promise((resolve) => { release = resolve; });
    const requested = new Promise((resolve) => { intercepted = resolve; });
    await page.route('**/*hero-wave*', async (route) => {
      intercepted();
      await held;
      await route.continue();
    });
    try {
      await page.goto(site, { waitUntil: 'domcontentloaded' });
      let timer;
      try {
        await Promise.race([requested, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Three.js import not requested')), 15000);
        })]);
      } finally {
        clearTimeout(timer);
      }
      await page.waitForTimeout(1500);
      assert.equal(await page.locator('canvas[data-hero-wave]').count(), 0);
      await checkBackground(page, `${name}: delayed Three.js import`);
      await page.screenshot({ path: new URL(`${name}-loading.png`, output).pathname });
    } finally {
      release();
    }
    const canvas = page.locator('canvas[data-hero-wave]');
    await canvas.waitFor();
    await checkBackground(page, `${name}: Three.js ready`);
    await page.screenshot({ path: new URL(`${name}-ready.png`, output).pathname });
    await canvas.evaluate((element) => element.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await canvas.waitFor({ state: 'detached' });
    await checkBackground(page, `${name}: context loss`);
    await context.close();
    console.log(`PASS ${name}: slow startup, ready scene and context loss never show or download legacy media`);
  }

  const reduced = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await reduced.newPage();
  track(page);
  await page.goto(site, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('canvas[data-hero-wave]').count(), 0);
  await checkBackground(page, 'reduced motion');
  await reduced.close();
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS reduced motion has no video or poster; no page errors');
} finally {
  await browser.close();
}
