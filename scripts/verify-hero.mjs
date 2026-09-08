import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const site = process.env.SITE || 'http://127.0.0.1:4325/ai-arai-dee/';
const output = new URL('../.reviews/threejs-hero/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
const errors = [];
const instrument = () => {
  window.heroDraws = 0;
  window.heroCamera = '';
  window.heroFocus = null;
  window.heroScrollSpin = null;
  window.heroInstancedDraws = 0;
  window.heroMaxInstances = 0;
  const scenePrograms = new WeakSet();
  let activeProgram;
  const useProgram = WebGL2RenderingContext.prototype.useProgram;
  WebGL2RenderingContext.prototype.useProgram = function (program) {
    activeProgram = program;
    return useProgram.call(this, program);
  };
  const locations = new Map();
  const getLocation = WebGL2RenderingContext.prototype.getUniformLocation;
  WebGL2RenderingContext.prototype.getUniformLocation = function (...args) {
    const location = getLocation.apply(this, args);
    if (location) locations.set(location, args[1]);
    if (args[1] === 'uFocus') scenePrograms.add(args[0]);
    return location;
  };
  const setMatrix = WebGL2RenderingContext.prototype.uniformMatrix4fv;
  const setFloat = WebGL2RenderingContext.prototype.uniform1f;
  WebGL2RenderingContext.prototype.uniform1f = function (...args) {
    if (locations.get(args[0]) === 'uFocus') window.heroFocus = args[1];
    if (locations.get(args[0]) === 'uScrollSpin') window.heroScrollSpin = args[1];
    return setFloat.apply(this, args);
  };
  WebGL2RenderingContext.prototype.uniformMatrix4fv = function (...args) {
    if (locations.get(args[0]) === 'modelViewMatrix' && scenePrograms.has(activeProgram)) {
      window.heroCamera = JSON.stringify(Array.from(args[2]));
    }
    return setMatrix.apply(this, args);
  };
  for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const original = WebGL2RenderingContext.prototype[method];
    WebGL2RenderingContext.prototype[method] = function (...args) {
      window.heroDraws++;
      if (method.endsWith('Instanced')) {
        window.heroInstancedDraws++;
        window.heroMaxInstances = Math.max(window.heroMaxInstances, args.at(-1));
      }
      return original.apply(this, args);
    };
  }
};
const draws = (page) => page.evaluate(() => window.heroDraws);
const checkPixels = async (page, buffer) => page.evaluate(async (base64) => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let gold = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > 70 && pixels[i] > pixels[i + 2] * 1.5 && pixels[i + 1] > 25) gold++;
  }
  return { gold, total: pixels.length / 4 };
}, buffer.toString('base64'));

try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844], ['wide', 1920, 1080], ['ultrawide', 2560, 720]]) {
    // Compensate for Chromium's high-DPI wheel injection in the native wheel checks.
    const deviceScale = name === 'mobile' ? 3 : 1;
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: deviceScale });
    await ctx.addInitScript(instrument);
    const page = await ctx.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(site, { waitUntil: 'networkidle' });
    const canvas = page.locator('canvas[data-hero-wave]');
    await canvas.waitFor();
    assert.equal(typeof await page.evaluate(() => window.heroScrollSpin), 'number', `${name}: scroll rotation uniform renders`);
    assert.equal(await page.locator('[data-page-background]').evaluate((element) => getComputedStyle(element).position), 'fixed',
      `${name}: background is pinned to the viewport`);
    const budget = name === 'mobile' ? 600000 : 1200000;
    assert.ok(await canvas.evaluate((element) => element.width * element.height) <= budget,
      `${name}: render buffer stays within ${budget} pixels`);
    const start = await draws(page);
    const focusStart = await page.evaluate(() => window.heroFocus);
    await page.waitForTimeout(500);
    assert.ok(await draws(page) > start, `${name}: animation draws`);
    assert.ok(await page.evaluate(() => window.heroInstancedDraws) >= 5, `${name}: instanced scene layers render`);
    assert.equal(typeof focusStart, 'number', `${name}: focus uniform exists`);
    await page.waitForFunction((initial) => Math.abs(window.heroFocus - initial) > .01, focusStart, { timeout: 10000 });
    const frameStats = () => page.evaluate(() => ({
      time: performance.now(), frames: window.heroInstancedDraws / 5, draws: window.heroDraws,
    }));
    const frameStart = await frameStats();
    await page.waitForTimeout(1100);
    const frameEnd = await frameStats();
    const rendered = frameEnd.frames - frameStart.frames;
    assert.ok(rendered <= (frameEnd.time - frameStart.time) * .03 + 2, `${name}: background capped at 30 fps`);
    assert.ok(frameEnd.draws - frameStart.draws <= rendered * 7 + 2, `${name}: no multipass bloom cost`);
    const first = await canvas.screenshot();
    const pixels = await checkPixels(page, first);
    assert.ok(pixels.gold > 300, `${name}: visible gold pixels: ${JSON.stringify(pixels)}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`);
    await page.screenshot({ path: new URL(`${name}.png`, output).pathname });
    const cameraBefore = await page.evaluate(() => window.heroCamera);
    await page.mouse.move(width * .85, height * .2);
    await page.waitForTimeout(600);
    assert.notEqual(await page.evaluate(() => window.heroCamera), cameraBefore, `${name}: pointer moves the 3D camera`);
    const cameraX = await page.evaluate(() => {
      const m = JSON.parse(window.heroCamera);
      return -(m[0] * m[12] + m[1] * m[13] + m[2] * m[14]);
    });
    assert.ok(cameraX > 1.2, `${name}: stronger pointer travel (${cameraX.toFixed(2)})`);
    assert.notDeepEqual(await canvas.screenshot(), first, `${name}: scene changes`);
    if (name === 'desktop' || name === 'ultrawide') {
      await page.screenshot({ path: new URL(`${name}-pointer.png`, output).pathname });
    }

    await page.mouse.move(width / 2, height / 2);
    await page.waitForTimeout(1800);
    const beforeScroll = await page.evaluate(() => JSON.parse(window.heroCamera)[14]);
    const spinBefore = await page.evaluate(() => window.heroScrollSpin);
    await page.evaluate(() => window.scrollTo({ top: innerHeight * .35, behavior: 'instant' }));
    await page.waitForTimeout(600);
    const afterScroll = await page.evaluate(() => JSON.parse(window.heroCamera)[14]);
    const spinDown = await page.evaluate(() => window.heroScrollSpin);
    assert.ok(spinDown - spinBefore > .04 && spinDown - spinBefore < .09, `${name}: scrolling down gently turns the spiral`);
    assert.ok(Math.abs(afterScroll - beforeScroll) < .01, `${name}: scroll does not move the camera`);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(650);
    const spinUp = await page.evaluate(() => window.heroScrollSpin);
    assert.ok(spinUp < spinDown - .04 && Math.abs(spinUp - spinBefore) < .02, `${name}: scrolling up reverses the spiral`);
    await page.waitForTimeout(850);

    const beforeWheel = await page.evaluate(() => window.heroScrollSpin);
    await page.mouse.wheel(0, -height * .35 * deviceScale);
    await page.waitForTimeout(350);
    const wheelQuick = await page.evaluate(() => window.heroScrollSpin);
    assert.ok(beforeWheel - wheelQuick > .065 && beforeWheel - wheelQuick < .095, `${name}: wheel responds promptly without overshooting`);
    await page.waitForTimeout(300);
    const wheelUp = await page.evaluate(() => window.heroScrollSpin);
    assert.equal(await page.evaluate(() => window.scrollY), 0, `${name}: upward wheel stays at the page boundary`);
    assert.ok(beforeWheel - wheelUp > .04 && beforeWheel - wheelUp < .09, `${name}: wheel turns spiral even without page scrolling`);
    await page.mouse.wheel(0, height * .35 * deviceScale);
    await page.waitForTimeout(650);
    const wheelDown = await page.evaluate(() => window.heroScrollSpin);
    assert.ok(await page.evaluate(() => window.scrollY) > 0, `${name}: wheel preserves normal page scrolling`);
    assert.ok(wheelDown - wheelUp > .04 && wheelDown - wheelUp < .09, `${name}: wheel reverses without double-counting page scroll`);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(1500);
    const beforeLineWheel = await page.evaluate(() => window.heroScrollSpin);
    await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaMode: 1, deltaY: innerHeight * .35 / 16 })));
    await page.waitForTimeout(650);
    const lineWheel = await page.evaluate(() => window.heroScrollSpin);
    assert.ok(lineWheel - beforeLineWheel > .04 && lineWheel - beforeLineWheel < .09, `${name}: line-mode wheel is normalized`);
    await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaMode: 2, deltaY: -.35 })));
    await page.waitForTimeout(650);
    const pageWheel = await page.evaluate(() => window.heroScrollSpin);
    assert.ok(lineWheel - pageWheel > .04 && lineWheel - pageWheel < .09, `${name}: page-mode wheel is normalized`);
    await page.waitForTimeout(850);
    const beforeZoom = await page.evaluate(() => window.heroScrollSpin);
    await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 500, ctrlKey: true })));
    await page.waitForTimeout(350);
    assert.ok(Math.abs(await page.evaluate(() => window.heroScrollSpin) - beforeZoom) < .001, `${name}: zoom gestures do not spin the spiral`);

    await page.locator('[data-hero-pause]').click();
    assert.equal(await page.locator('[data-hero-pause]').getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(150);
    const stopped = await draws(page);
    const stoppedFocus = await page.evaluate(() => window.heroFocus);
    const stoppedSpin = await page.evaluate(() => window.heroScrollSpin);
    await page.mouse.move(10, 20);
    await page.mouse.wheel(0, height * .2 * deviceScale);
    await page.evaluate(() => window.scrollTo({ top: innerHeight * .2, behavior: 'instant' }));
    await page.waitForTimeout(350);
    assert.equal(await draws(page), stopped, `${name}: paused wave ignores pointer`);
    assert.equal(await page.evaluate(() => window.heroFocus), stoppedFocus, `${name}: pause freezes lens focus`);
    assert.equal(await page.evaluate(() => window.heroScrollSpin), stoppedSpin, `${name}: pause ignores scroll rotation`);
    await page.setViewportSize({ width: width - 20, height });
    await page.waitForTimeout(150);
    assert.equal(await canvas.count(), 1, `${name}: paused resize retains one canvas`);
    await page.locator('[data-hero-pause]').click();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.heroScrollSpin), stoppedSpin, `${name}: resume does not replay paused scrolling`);
    await page.evaluate(() => window.scrollTo({ top: innerHeight * 1.5, behavior: 'instant' }));
    await page.waitForTimeout(300);
    const scrolled = await draws(page);
    await page.waitForTimeout(300);
    assert.ok(await draws(page) > scrolled, `${name}: fixed background animates below the hero`);
    assert.equal((await canvas.boundingBox()).y, 0, `${name}: scrolling leaves canvas at viewport top`);
    await page.screenshot({ path: new URL(`${name}-scrolled.png`, output).pathname });
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(300);
    assert.equal((await canvas.boundingBox()).y, 0, `${name}: background reaches the footer`);
    assert.ok(await page.locator('[data-hero-pause]').isVisible(), `${name}: pause remains reachable at the footer`);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(300);
    assert.ok(await draws(page) > scrolled, `${name}: scrolling back keeps rendering`);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hidden = await draws(page);
    await page.waitForTimeout(200);
    assert.equal(await draws(page), hidden, `${name}: hidden document stops rendering`);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await canvas.waitFor({ state: 'detached', timeout: 5000 });
    assert.equal(await canvas.count(), 0, `${name}: live reduced motion removes canvas`);
    assert.equal(await page.locator('[data-hero-pause]').count(), 0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await canvas.waitFor();
    assert.equal(await canvas.count(), 1, `${name}: motion preference restores one canvas`);
    await canvas.evaluate((element) => element.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await canvas.waitFor({ state: 'detached', timeout: 5000 });
    assert.equal(await canvas.count(), 0, `${name}: context loss restores poster`);
    assert.equal(await page.locator('[data-hero-pause]').count(), 0);
    const fps = rendered / (frameEnd.time - frameStart.time) * 1000;
    console.log(`PASS ${name}: ${fps.toFixed(1)} fps, gold pixels ${pixels.gold}/${pixels.total}; scroll/wheel spin, boundary input, delta modes, zoom guard, fixed background, pointer, budgets, pause, resize, live preferences, context loss`);
    await ctx.close();
  }

  const limited = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 3 });
  await limited.addInitScript(instrument);
  await limited.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
  });
  const lpage = await limited.newPage();
  lpage.on('pageerror', (error) => errors.push(error.message));
  await lpage.goto(site, { waitUntil: 'networkidle' });
  const lightCanvas = lpage.locator('canvas[data-hero-wave]');
  await lightCanvas.waitFor();
  assert.equal(await lightCanvas.getAttribute('data-hero-quality'), 'low', 'limited hardware selects lower quality');
  assert.ok(await lightCanvas.evaluate((element) => element.width * element.height) <= 600000, 'limited hardware caps high-DPR buffer');
  assert.ok(await lpage.evaluate(() => window.heroMaxInstances) <= 4400, 'limited hardware uses the smaller particle populations');
  await limited.close();

  const slow = await browser.newContext();
  await slow.addInitScript(instrument);
  await slow.addInitScript(() => {
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => original((time) => callback(window.simulateSlowFrames ? time * 8 : time));
  });
  const spage = await slow.newPage();
  spage.on('pageerror', (error) => errors.push(error.message));
  await spage.goto(site, { waitUntil: 'networkidle' });
  const slowCanvas = spage.locator('canvas[data-hero-wave]');
  await slowCanvas.waitFor();
  await slowCanvas.evaluate((element) => {
    window.qualityChanges = [element.dataset.heroQuality];
    new MutationObserver(() => window.qualityChanges.push(element.dataset.heroQuality))
      .observe(element, { attributes: true, attributeFilter: ['data-hero-quality'] });
    window.simulateSlowFrames = true;
  });
  await slowCanvas.waitFor({ state: 'detached', timeout: 15000 });
  assert.ok(await spage.evaluate(() => window.qualityChanges.includes('reduced')), 'sustained slow frames reduce resolution before fallback');
  const fallbackDraws = await draws(spage);
  await spage.waitForTimeout(250);
  assert.equal(await draws(spage), fallbackDraws, 'slow-renderer fallback stops GPU work');
  assert.equal(await spage.locator('[data-hero-pause]').count(), 0, 'slow-renderer fallback removes inactive controls');
  assert.ok(await spage.locator('[data-page-background]').isVisible(), 'slow-renderer fallback retains fixed background');
  await slow.close();
  console.log('PASS limited-device budgets and simulated slow-frame quality reduction / poster fallback');

  const reduced = await browser.newContext({ reducedMotion: 'reduce' });
  const rpage = await reduced.newPage();
  const scripts = [];
  rpage.on('request', (request) => { if (request.resourceType() === 'script') scripts.push(request.url()); });
  await rpage.goto(site, { waitUntil: 'networkidle' });
  assert.equal(await rpage.locator('canvas[data-hero-wave]').count(), 0);
  assert.ok(!scripts.some((url) => /hero-wave[.-]|\/three[/.]/.test(url)), 'reduced motion avoids Three.js download');
  const poster = await rpage.locator('[data-hero-background]').evaluate(async (element) => {
    const url = getComputedStyle(element).backgroundImage.slice(5, -2);
    const image = new Image();
    image.src = url;
    await image.decode();
    return image.naturalWidth;
  });
  assert.ok(poster > 0, 'fallback poster loads');
  await rpage.screenshot({ path: new URL('reduced-motion.png', output).pathname });
  await reduced.close();

  const pending = await browser.newContext();
  const ppage = await pending.newPage();
  let release;
  let intercepted;
  const held = new Promise((resolve) => { release = resolve; });
  const requested = new Promise((resolve) => { intercepted = resolve; });
  await ppage.route('**/*hero-wave*', async (route) => {
    intercepted();
    await held;
    await route.continue();
  });
  await ppage.goto(site, { waitUntil: 'domcontentloaded' });
  await Promise.race([requested, new Promise((_, reject) => setTimeout(() => reject(new Error('wave import not requested')), 15000))]);
  await ppage.emulateMedia({ reducedMotion: 'reduce' });
  await ppage.waitForTimeout(100);
  release();
  await ppage.waitForLoadState('networkidle');
  assert.equal(await ppage.locator('canvas[data-hero-wave]').count(), 0, 'cancelled import cannot mount a scene');
  await pending.close();

  const unsupported = await browser.newContext();
  await unsupported.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith('webgl') ? null : original.call(this, type, ...args);
    };
  });
  const fpage = await unsupported.newPage();
  fpage.on('pageerror', (error) => errors.push(error.message));
  await fpage.goto(site, { waitUntil: 'networkidle' });
  assert.equal(await fpage.locator('canvas[data-hero-wave]').count(), 0, 'unsupported WebGL uses fallback');
  assert.ok(await fpage.locator('main h1').isVisible(), 'fallback preserves heading');
  await fpage.locator('nav a[href$="/lesson/image"]').click();
  await fpage.waitForURL('**/lesson/image');
  assert.ok(await fpage.locator('main h1').isVisible(), 'lesson navigation works');
  await unsupported.close();

  const noFloat = await browser.newContext();
  await noFloat.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function (name) {
      return name === 'EXT_color_buffer_float' ? null : original.call(this, name);
    };
  });
  const npage = await noFloat.newPage();
  npage.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  npage.on('pageerror', (error) => errors.push(error.message));
  await npage.goto(site, { waitUntil: 'networkidle' });
  const basicCanvas = npage.locator('canvas[data-hero-wave]');
  await basicCanvas.waitFor();
  const basicPixels = await checkPixels(npage, await basicCanvas.screenshot());
  assert.ok(basicPixels.gold > 300, 'no float targets: visible rendering without bloom');
  await noFloat.close();
  assert.deepEqual(errors, [], 'no browser errors');
  console.log('PASS reduced-motion startup, no Three.js request, cancelled import, poster asset, unavailable WebGL, lesson navigation, clean browser console');
} finally {
  await browser.close();
}
