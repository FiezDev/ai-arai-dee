#!/usr/bin/env bash
# gen-assets.sh — Higgsfield CLI asset pipeline for ai-arai-dee.
# State machine (design/ai-arai-dee__06-operations.md):
#   PRE-FLIGHT (spend guards, stress R1): abort if Σrows ≥ 60, balance < 60,
#   or target file exists without FORCE=1.
#   create (no --wait) → PENDING row → short polls (≤8m each) → download →
#   magic-byte sniff → finalize row. Abandoned jobs keep credits=UNKNOWN rows.
# Usage: [FORCE=1] bash scripts/gen-assets.sh <hero|intro|chapter-content|chapter-work|chapter-learn|chapter-life>
#        bash scripts/gen-assets.sh wait-all     # poll+download every PENDING row
set -euo pipefail
cd "$(dirname "$0")/.."

CAP=60
LEDGER=public/credits.md
RAW=assets-raw
mkdir -p "$RAW" src/assets

balance() { higgsfield account status --json 2>/dev/null | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);const s=JSON.stringify(j);const m=s.match(/"credits"\s*:\s*"?([\d.]+)/)||s.match(/([\d.]+)\s*credits/);console.log(m?m[1]:"unknown")}catch{console.log("unknown")}})'; }
spent() { awk -F' *\\| *' '/\|/ && $4 ~ /^[0-9.]+$/ {s+=$4} END{printf "%.2f", s+0}' "$LEDGER"; }
preflight() {
  local s=$(spent); local b=$(balance); local a=$(actual_spend)
  echo "pre-flight: ledger=$s today_actual_spend=$a balance=$b"
  awk "BEGIN{exit !($a >= $CAP)}" && { echo "ABORT: today actual spend $a ≥ cap $CAP"; exit 1; } || true
  awk "BEGIN{exit !($s >= $CAP)}" && { echo "ABORT: cumulative spend $s ≥ cap $CAP"; exit 1; }
  [[ "$b" == "unknown" ]] && { echo "ABORT: balance unreadable"; exit 1; }
  awk "BEGIN{exit !($b < $CAP)}" && { echo "ABORT: balance $b < cap $CAP"; exit 1; }
  return 0
}
magic_ok() { # file allowed_ext_pattern
  local f="$1" ext="$2"
  file "$f" | grep -qiE "$ext" || return 1
  return 0
}

declare -A MODEL ASPECT EXTRA PROMPT
MODEL[hero]="veo3_1_lite";        ASPECT[hero]="--aspect_ratio 16:9 --duration 6"
MODEL[intro]="nano_banana_pro";   ASPECT[intro]="--aspect_ratio 21:9 --resolution 2k"
MODEL[chapter-content]="nano_banana_pro"; ASPECT[chapter-content]="--aspect_ratio 21:9 --resolution 2k"
MODEL[chapter-work]="nano_banana_pro";    ASPECT[chapter-work]="--aspect_ratio 21:9 --resolution 2k"
MODEL[chapter-learn]="nano_banana_pro";   ASPECT[chapter-learn]="--aspect_ratio 21:9 --resolution 2k"
MODEL[chapter-life]="nano_banana_pro";    ASPECT[chapter-life]="--aspect_ratio 21:9 --resolution 2k"

PROMPT[hero]="Slow cinematic abstract loop: drifting golden amber particles and soft light filaments flowing through deep ink-indigo darkness, like a neural constellation slowly breathing, subtle film grain, high contrast, moody, seamless feel, no text, no watermark"
PROMPT[intro]="Cinematic wide abstract shot of a glowing neural constellation of warm amber light filaments drifting through deep ink-indigo darkness, soft film grain, photoreal, generous negative space, no text, no watermark"
PROMPT[chapter-content]="Cinematic scene of a Thai content creator in a dark studio at night, face softly lit by warm amber monitor glow, camera and sketches on desk, deep ink-indigo shadows, film grain, photoreal, wide composition with negative space, no text, no watermark"
PROMPT[chapter-work]="Cinematic wide shot of Bangkok skyline at dusk from a dark modern office window, warm amber city lights against deep ink-indigo twilight, lone desk silhouette in foreground, film grain, photoreal, negative space, no text, no watermark"
PROMPT[chapter-learn]="Cinematic scene of a student studying at night, soft warm amber holographic glow of floating knowledge particles above the desk, deep ink-indigo room, film grain, photoreal, wide composition, negative space, no text, no watermark"
PROMPT[chapter-life]="Cinematic cozy Thai home kitchen before dawn, warm amber glow from a smart speaker and window dawn light, deep ink-indigo shadows, steam rising from a coffee cup, film grain, photoreal, wide negative space, no text, no watermark"

create_one() { # name
  local n="$1"
  preflight
  local existing; existing=$(grep -c "^$n \|| $n \||^$n|" "$LEDGER" || true)
  local f="$RAW/$n"
  [[ -f "$f.done" && "${FORCE:-0}" != "1" ]] && { echo "ABORT: $n already generated (FORCE=1 to redo)"; exit 1; }
  local est; est=$(higgsfield generate cost "${MODEL[$n]}" --prompt "${PROMPT[$n]}" 2>/dev/null | grep -oE '[0-9.]+' | head -1)
  echo "$n: estimated $est credits — creating job"
  local out; out=$(higgsfield generate create "${MODEL[$n]}" --prompt "${PROMPT[$n]}" ${ASPECT[$n]} --json 2>&1)
  local job; job=$(echo "$out" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d)[0])}catch{console.log("")}})')
  [[ -z "$job" || "$job" == "" ]] && { echo "ABORT: no job id from create: $out"; exit 1; }
  echo "$n | ${MODEL[$n]} | $job | PENDING | ${PROMPT[$n]}" >> "$LEDGER"
  echo "$n: job $job PENDING (est $est)"
}

wait_all() { node scripts/fetch-assets.mjs; }

case "${1:-}" in
  hero|intro|chapter-content|chapter-work|chapter-learn|chapter-life) create_one "$1" ;;
  wait-all) wait_all ;;
  *) echo "usage: [FORCE=1] bash scripts/gen-assets.sh <asset|wait-all>"; exit 2 ;;
esac
