# Credits — สื่อทั้งหมดสร้างด้วย AI (Higgsfield)

Balance before batch: 889.57 credits (ultimate plan)
Planned spend: 18 credits · **hard cap 60 credits** (mechanically enforced by scripts/gen-assets.sh pre-flight)

| Asset | Model | Aspect/Res | Est. credits |
|---|---|---|---|
| hero (video, 6s) | veo3_1_lite | 16:9 | 8 |
| hero-poster (frame 0) | ffmpeg | — | 0 |
| intro | nano_banana_pro | 21:9 · 2k | 2 |
| chapter-content | nano_banana_pro | 21:9 · 2k | 2 |
| chapter-work | nano_banana_pro | 21:9 · 2k | 2 |
| chapter-learn | nano_banana_pro | 21:9 · 2k | 2 |
| chapter-life | nano_banana_pro | 21:9 · 2k | 2 |

## Ledger (rows: file | model | job | credits | prompt)

<!-- PENDING rows appended at create-time; finalized at download. Never edit history. -->
hero | veo3_1_lite | 0f0100a2-6614-439a-a75e-657d1f1105ce | 6 | slow cinematic abstract loop, amber particles in ink-indigo darkness, no text
intro | nano_banana_pro | 96385e47-3ecc-401c-b18f-9c496f95df5f | 2 | Cinematic wide abstract shot of a glowing neural constellation of warm amber light filaments drifting through deep ink-indigo darkness, soft film grain, photoreal, generous negative space, no text, no watermark
chapter-content | nano_banana_pro | 039320d2-71bb-4d98-b35a-fce66cae131a | 2 | Cinematic scene of a Thai content creator in a dark studio at night, face softly lit by warm amber monitor glow, camera and sketches on desk, deep ink-indigo shadows, film grain, photoreal, wide composition with negative space, no text, no watermark
chapter-work | nano_banana_pro | 57a72556-c2a8-4639-90d8-73a00626a05b | 2 | Cinematic wide shot of Bangkok skyline at dusk from a dark modern office window, warm amber city lights against deep ink-indigo twilight, lone desk silhouette in foreground, film grain, photoreal, negative space, no text, no watermark
chapter-learn | nano_banana_pro | 0df6b344-67dd-40e6-a1f3-5bd3b00c242f | 2 | Cinematic scene of a student studying at night, soft warm amber holographic glow of floating knowledge particles above the desk, deep ink-indigo room, film grain, photoreal, wide composition, negative space, no text, no watermark
chapter-life | nano_banana_pro | 467b534d-2928-4fbd-82c1-aea98fc47720 | 2 | Cinematic cozy Thai home kitchen before dawn, warm amber glow from a smart speaker and window dawn light, deep ink-indigo shadows, steam rising from a coffee cup, film grain, photoreal, wide negative space, no text, no watermark

## ผลการตรวจสอบ (reconciliation)

- งานของหน้าเว็บนี้: 6 jobs (hero video + 5 ภาพ) = 16 credits · ยอดก่อนเริ่ม 889.57 → ที่ควรเหลือ 873.57 ✔ ตรงกับ ledger
- ระหว่างช่วงสร้างเว็บ มีรายการใช้ 32.5 credits (GPT Image 2.0 ×5, 12:32–12:44) ที่ไม่ได้มาจาก pipeline ของหน้าเว็บนี้ (สคริปต์ใช้แค่ nano_banana_pro + veo3_1_lite เท่านั้น) — โปรดตรวจสอบกับ session อื่นที่ใช้บัญชีเดียวกัน
