import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto("http://127.0.0.1:4399/ai-arai-dee/lesson/image/", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
await p.screenshot({ path: "shot-num-mob.png", fullPage: false });
await b.close();
