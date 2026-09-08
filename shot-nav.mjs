import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto("http://127.0.0.1:4399/ai-arai-dee/lesson/image/", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
await p.screenshot({ path: "shot-nav.png", clip: { x: 0, y: 0, width: 1440, height: 340 } });
await b.close();
