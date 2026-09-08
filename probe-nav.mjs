import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://127.0.0.1:4399/ai-arai-dee/lesson/image/", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const data = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll("nav a, nav button, header nav a").forEach((a) => {
    const num = a.querySelector("span[aria-hidden]");
    const r = a.getBoundingClientRect();
    out.push({
      text: a.textContent.trim().replace(/\s+/g, " "),
      linkColor: getComputedStyle(a).color,
      pillBg: getComputedStyle(a.parentElement).backgroundColor,
      pillBackdrop: getComputedStyle(a.parentElement).backdropFilter,
      numColor: num ? getComputedStyle(num).color : null,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    });
  });
  const ghost = document.querySelector("header span[aria-hidden]");
  const ghostStyle = ghost ? { color: getComputedStyle(ghost).color, font: getComputedStyle(ghost).fontSize, rect: (g => ({x:Math.round(g.x),y:Math.round(g.y),w:Math.round(g.width),h:Math.round(g.height)}))(ghost.getBoundingClientRect()) } : null;
  const h1 = document.querySelector("h1");
  const h1r = h1.getBoundingClientRect();
  return { items: out, ghost: ghostStyle, h1: { x: Math.round(h1r.x), y: Math.round(h1r.y), w: Math.round(h1r.width), h: Math.round(h1r.height), color: getComputedStyle(h1).color } };
});
console.log(JSON.stringify(data, null, 1));
await b.close();
