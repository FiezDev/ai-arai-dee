#!/usr/bin/env bash
# postprocess: raw downloads → src/assets (webp ≤600KB + 960w derivative, poster frame)
set -euo pipefail
cd "$(dirname "$0")/.."
RAW=assets-raw; DST=src/assets; mkdir -p "$DST"

for f in "$RAW"/chapter-*.png "$RAW"/intro.png; do
  [[ -f "$f" ]] || continue
  n=$(basename "$f" .png)
  # full-size webp (quality tuned to ≤600KB)
  ffmpeg -y -loglevel error -i "$f" -c:v libwebp -quality 88 "$DST/$n.webp"
  # 960w derivative
  ffmpeg -y -loglevel error -i "$f" -vf scale=960:-1 -c:v libwebp -quality 85 "$DST/$n-960.webp"
  sz=$(stat -f%z "$DST/$n.webp")
  q=88
  while (( sz > 614400 && q > 40 )); do
    q=$((q-8))
    ffmpeg -y -loglevel error -i "$f" -c:v libwebp -quality $q "$DST/$n.webp"
    sz=$(stat -f%z "$DST/$n.webp")
  done
  echo "$n.webp: $sz bytes (q$q) + 960w"
done

if ls "$RAW"/hero.* >/dev/null 2>&1; then
  h=$(ls "$RAW"/hero.mp4 "$RAW"/hero.webm 2>/dev/null | head -1)
  ext="${h##*.}"
  cp "$h" "$DST/hero.$ext"
  ffmpeg -y -loglevel error -ss 0 -i "$DST/hero.$ext" -frames:v 1 -q:v 3 "$DST/hero-poster.jpg"
  du -k "$DST/hero.$ext" "$DST/hero-poster.jpg"
fi
ls -la "$DST"
