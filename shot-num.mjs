import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://127.0.0.1:4399/ai-arai-dee/lesson/image/", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
await p.screenshot({ path: "shot-num-top.png" });
const nav = await p.locator("header").first().boundingBox();
if (nav) await p.screenshot({ path: "shot-num-header.png", clip: { x: Math.max(0,nav.x-20), y: Math.max(0,nav.y-20), width: Math.min(1460,nav.width+40), height: Math.min(920,nav.height+40) } });
await b.close();
