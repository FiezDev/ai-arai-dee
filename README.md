# ใช้ AI ทำอะไรดี (ai-arai-dee)

One-page Thai parallax storytelling SPA — Astro 5 + one React island (framer-motion 12) +
Tailwind 4. All imagery/video generated via the official Higgsfield CLI. Live:
**https://fiezdev.github.io/ai-arai-dee/**

## สิ่งที่ได้ (what you get)

8 sections: hero (video bg + pause) → intro → 4 use-case chapters (parallax plates) →
3-step how-to → CTA + credits. Dark cinematic theme, Thai gold accent, Anuphan display
font, `prefers-reduced-motion` fully honored (probe-enforced), WCAG AA contrast.

## Dev

```bash
pnpm install
pnpm dev        # local dev at /ai-arai-dee/
pnpm build      # static build → dist/
pnpm preview    # serve dist at http://127.0.0.1:4321/ai-arai-dee/
```

## Gates

```bash
node scripts/probe.mjs   # FULL contract, knob-less: builds, previews, asserts
#   8 sections · video readyState · parallax delta on all plates · images loaded
#   · reduced-motion context (plates still) · 0 console errors · freshness token
# Interim-only knobs: MIN_SECTIONS / VIDEO=0 / PARALLAX=0 / REDUCED_MOTION=0
```

UI review: `ui-review-report.md` (df-ui-review, 6 agents, verdict SHIP-READY).

## Regenerating assets (Higgsfield CLI)

Auth once (`higgsfield auth login`, `higgsfield workspace set <id>`), then:

```bash
bash scripts/gen-assets.sh <hero|intro|chapter-content|chapter-work|chapter-learn|chapter-life>
bash scripts/gen-assets.sh wait-all        # polls PENDING rows, downloads, magic-byte checks
bash scripts/postprocess-assets.sh         # webp ≤600KB + 960w + poster + 540p video
ffmpeg -y -i src/assets/hero.mp4 -vf "scale=960:540,eq=saturation=0.9:contrast=1.05" -c:v libx264 -crf 26 -preset slow -an -movflags +faststart src/assets/hero-540.mp4
node scripts/probe.mjs                     # must stay green
```

Spend guards are mechanical: cumulative pre-flight vs the 60-credit cap, FORCE=1 to
overwrite, PENDING ledger rows at create-time, abandoned jobs stay tracked
(`public/credits.md` — numeric balance only, never account details).

## Deploy

GitHub Actions on push to `main` → Pages. Base path `/ai-arai-dee/`; site media are ESM
imports (Vite hashes + base-corrects them). Pages source must be "GitHub Actions"
(Settings → Pages, one-time).
