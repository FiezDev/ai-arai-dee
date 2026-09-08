import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const output = new URL('../.reviews/threejs-hero/motion/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.addInitScript(() => {
    const locations = new Map();
    const get = WebGL2RenderingContext.prototype.getUniformLocation;
    WebGL2RenderingContext.prototype.getUniformLocation = function (...args) {
      const location = get.apply(this, args);
      locations.set(location, args[1]);
      return location;
    };
    const set = WebGL2RenderingContext.prototype.uniform1f;
    WebGL2RenderingContext.prototype.uniform1f = function (...args) {
      if (locations.get(args[0]) === 'uTime') window.waveTime = args[1];
      return set.apply(this, args);
    };
  });
  await page.goto(process.env.SITE || 'http://localhost:4325/ai-arai-dee/', { waitUntil: 'networkidle' });
  await page.locator('canvas[data-hero-wave]').waitFor();
  await page.addStyleTag({ content: `
    main, [data-hero-pause], astro-dev-toolbar { visibility: hidden !important; }
    [data-hero-background] + div, .grain::after { display: none !important; }
  ` });
  const start = await page.evaluate(() => window.waveTime);
  const captures = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForFunction((target) => window.waveTime >= target, start + i * .75);
    const time = await page.evaluate(() => window.waveTime);
    const file = `frame-${String(i).padStart(2, '0')}.png`;
    await page.screenshot({ path: new URL(file, output).pathname });
    captures.push({ file, simulationSeconds: time });
  }
  await writeFile(new URL('captures.json', output), JSON.stringify(captures, null, 2));
  console.log(`Captured ${captures.length} background frames over ${(captures.at(-1).simulationSeconds - start).toFixed(2)} simulation seconds`);
} finally {
  await browser.close();
}
