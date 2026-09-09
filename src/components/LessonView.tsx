import { MotionConfig } from 'framer-motion';
import { lessons } from '../lessons';
import { useLiveLesson } from '../live-text';
import { Boundary, Nav, Plate, PromptCard, Figure, Reveal, ScrollProgress, asset, CodeCard, rawText } from './ui';

type Lesson = (typeof lessons)[number];

function QA({ q, a, n }: { q: string; a: string; n: number }) {
  return (
    <div
      className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.3)' }}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent)/0.15)] text-sm font-bold text-[hsl(var(--accent))]">
          {n}
        </div>
        <div>
          <p className="font-medium leading-relaxed">{q}</p>
          <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            <span className="font-medium text-[hsl(var(--foreground)/0.85)]">AI:</span> {a}
          </p>
        </div>
      </div>
    </div>
  );
}

function VsCard({ label, text, good }: { label: string; text: string; good?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-6 ${good ? 'border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--surface))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))]'} `}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.3)' }}
    >
      <div className={`text-xs font-semibold ${good ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--muted-foreground))]'}`}>{label}</div>
      <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--foreground)/0.9)]">{text}</p>
    </div>
  );
}

export default function LessonView({ lesson: baked }: { lesson: Lesson }) {
  const lesson = useLiveLesson(baked);
  const hasIt = 'iterations' in lesson && lesson.iterations.length > 0;
  const stepWord = ('stepWord' in lesson && lesson.stepWord) || 'รอบที่';
  const idx = lessons.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? lessons[idx - 1] : undefined;
  const next = idx < lessons.length - 1 ? lessons[idx + 1] : undefined;
  const base = import.meta.env.BASE_URL;
  const pill =
    'flex min-h-[44px] items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-6 py-3 font-medium transition-transform duration-150 hover:-translate-y-0.5';

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative">
        <ScrollProgress />
        <Nav current={lesson.id} lessons={lessons.map((l) => ({ id: l.id, num: l.num, nav: l.nav }))} />

        {/* ── lesson header ── */}
        <Boundary>
          <header className="relative mx-auto max-w-6xl scroll-mt-20 px-6 pb-4 pt-28 md:pt-36">
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-16 right-0 select-none text-[7rem] font-bold leading-none text-transparent [-webkit-text-stroke:2px_hsl(var(--accent)/0.5)] md:-top-24 md:text-[10rem]"
              >
                {lesson.num}
              </span>
              <Reveal>
                <p className="kicker">{lesson.kicker}</p>
                <h1 className="mt-3 text-4xl md:text-5xl">{lesson.heading}</h1>
                <p className="mt-5 max-w-3xl whitespace-pre-line leading-relaxed text-[hsl(var(--muted-foreground))]">{lesson.body}</p>
              </Reveal>
            </div>
          </header>
        </Boundary>

        {/* ── multi-iteration flow (lesson 1): refs + N rounds ── */}
        {hasIt && (
          <>
            {'refs' in lesson && (
            <Boundary>
              <section aria-labelledby={`refs-${lesson.id}`} className="mx-auto max-w-6xl px-6 py-10 md:py-14">
                <Reveal>
                  <p className="kicker">{'refsKicker' in lesson && lesson.refsKicker ? lesson.refsKicker : 'เตรียมของ'}</p>
                  <h2 id={`refs-${lesson.id}`} className="mt-3 text-2xl md:text-3xl">
                    {'refsHeading' in lesson && lesson.refsHeading ? lesson.refsHeading : 'รูปอ้างอิงทั้งสาม'}
                  </h2>
                  <p className="mt-3 max-w-3xl leading-relaxed text-[hsl(var(--muted-foreground))]">{lesson.refsIntro}</p>
                </Reveal>
                <div className="mt-8 grid gap-5 sm:grid-cols-3">
                  {lesson.refs.map((r, i) => (
                    <Reveal key={r.file} delay={0.08 + i * 0.07}>
                      <figure
                        className="h-full overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]"
                        style={{ boxShadow: '0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.3)' }}
                      >
                        <img
                          src={asset(r.file)}
                          alt={r.label}
                          loading="lazy"
                          decoding="async"
                          className="h-48 w-full bg-[hsl(var(--surface-2))] object-contain p-3"
                        />
                        <figcaption className="p-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                          <span className="font-medium text-[hsl(var(--foreground)/0.9)]">{r.label}</span>
                          <br />
                          {r.note}
                        </figcaption>
                      </figure>
                    </Reveal>
                  ))}
                </div>
              </section>
            </Boundary>
            )}

            <Boundary>
              <section aria-labelledby={`it-${lesson.id}`} className="mx-auto max-w-6xl px-6 py-10 md:py-14">
                <Reveal>
                  <p className="kicker">{'itKicker' in lesson && lesson.itKicker ? lesson.itKicker : 'วนปรับ prompt'}</p>
                  <h2 id={`it-${lesson.id}`} className="mt-3 text-2xl md:text-3xl">
                    {'itHeading' in lesson && lesson.itHeading
                      ? lesson.itHeading
                      : `${lesson.iterations.length} รอบ — จากพรอมป์รวมภาพ สู่มีมที่ใช้จริง`}
                  </h2>
                  <p className="mt-3 max-w-3xl leading-relaxed text-[hsl(var(--muted-foreground))]">{lesson.iterationsIntro}</p>
                </Reveal>
                <div className="mt-10 space-y-16">
                  {lesson.iterations.map((it, i) => (
                    <Reveal key={it.n}>
                      <article>
                        <div className="mb-5 flex items-center gap-4">
                          <div
                            aria-hidden="true"
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${
                              i === lesson.iterations.length - 1
                                ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                                : 'bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]'
                            }`}
                          >
                            {it.n}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{stepWord} {it.n}</div>
                            <h3 className="text-xl">{it.delta}</h3>
                          </div>
                        </div>
                        <div className={`grid items-stretch gap-6 md:grid-cols-2 ${i % 2 === 1 ? 'md:[direction:rtl]' : ''}`}>
                          <div className="md:[direction:ltr]">
                            <PromptCard
                              label={`Prompt · ${stepWord} ${it.n}`}
                              text={it.prompt}
                              strong={i === lesson.iterations.length - 1}
                            />
                          </div>
                          <div className="md:[direction:ltr]">
                            <Figure file={it.img} cap={it.cap} alt={it.cap} tall contain />
                          </div>
                        </div>
                      </article>
                    </Reveal>
                  ))}
                </div>
              </section>
            </Boundary>
          </>
        )}

        {/* ── real session dialogue (iterations lessons that carry Q&A) ── */}
        {hasIt && lesson.asks.length > 0 && (
          <Boundary>
            <section aria-labelledby={`qa-${lesson.id}`} className="mx-auto max-w-6xl px-6 py-10 md:py-14">
              <Reveal>
                <p className="kicker">บทสนทนาจริงใน session</p>
                <h2 id={`qa-${lesson.id}`} className="mt-3 text-2xl md:text-3xl">AI ถาม/รายงานอะไร — ผมตอบอะไร</h2>
                {'asksIntro' in lesson && (
                  <p className="mt-3 max-w-3xl leading-relaxed text-[hsl(var(--muted-foreground))]">{lesson.asksIntro}</p>
                )}
              </Reveal>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {lesson.asks.map((ask, i) => (
                  <Reveal key={i} delay={0.08 + i * 0.06}>
                    <QA q={ask.q} a={ask.a} n={i + 1} />
                  </Reveal>
                ))}
              </div>
            </section>
          </Boundary>
        )}

        {/* ── two-round flow (lessons without iterations) ── */}
        {!hasIt && (
        <>
        {/* ── round 1: zero-shot ── */}
        <Boundary>
          <section aria-labelledby={`r1-${lesson.id}`} className="mx-auto max-w-6xl px-6 py-10 md:py-14">
            <Reveal>
              <p className="kicker">รอบที่ 1</p>
              <h2 id={`r1-${lesson.id}`} className="mt-3 text-2xl md:text-3xl">Prompt แรก (zero-shot) และผลลัพธ์</h2>
            </Reveal>
            <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2">
              <Reveal delay={0.08}>
                <PromptCard label="Prompt แรก · zero-shot" text={lesson.prompt1} />
              </Reveal>
              <Reveal delay={0.16}>
                <Figure file={lesson.result1.file || undefined} cap={lesson.result1.cap} alt={lesson.result1.cap} tall={!lesson.result1.file} contain={!!lesson.result1.file} />
              </Reveal>
            </div>
          </section>
        </Boundary>

        {/* ── dialogue ── */}
        <Boundary>
          <section aria-labelledby={`qa-${lesson.id}`} className="mx-auto max-w-6xl px-6 py-10 md:py-14">
            <Reveal>
              <p className="kicker">ปรับ Prompt ด้วยการถาม</p>
              <h2 id={`qa-${lesson.id}`} className="mt-3 text-2xl md:text-3xl">ถาม–ตอบ เพื่อดึงรายละเอียดที่ควรระบุ</h2>
            </Reveal>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {lesson.asks.map((ask, i) => (
                <Reveal key={i} delay={0.08 + i * 0.07}>
                  <QA q={ask.q} a={ask.a} n={i + 1} />
                </Reveal>
              ))}
            </div>
          </section>
        </Boundary>

        {/* ── round 2: few-shot — the new result lands here, after the dialogue ── */}
        <Boundary>
          <section aria-labelledby={`r2-${lesson.id}`} className="mx-auto max-w-6xl px-6 py-10 md:py-14">
            <Reveal>
              <p className="kicker">รอบที่ 2</p>
              <h2 id={`r2-${lesson.id}`} className="mt-3 text-2xl md:text-3xl">Prompt ใหม่ (few-shot) และผลลัพธ์</h2>
            </Reveal>
            {lesson.plate ? (
              <>
                <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2">
                  <Reveal delay={0.08}>
                    <PromptCard label="Prompt ใหม่ · few-shot (สังเคราะห์จากบทสนทนา)" text={lesson.prompt2} strong />
                  </Reveal>
                  <Reveal delay={0.16}>
                    <VsCard label="ผลลัพธ์ใหม่ · few-shot" text={lesson.result2.summary} good />
                  </Reveal>
                </div>
                <Reveal delay={0.2}>
                  <Plate src={asset(lesson.plate)} alt={lesson.plateAlt} fallbackId={lesson.id} caption={lesson.plateCap} />
                </Reveal>
              </>
            ) : 'result2Full' in lesson && lesson.result2Full ? (
              <>
                <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2">
                  <Reveal delay={0.08}>
                    <PromptCard label="Prompt ใหม่ · few-shot (สังเคราะห์จากบทสนทนา)" text={lesson.prompt2} strong />
                  </Reveal>
                  <Reveal delay={0.16}>
                    <VsCard label="ผลลัพธ์ใหม่ · few-shot" text={lesson.result2.summary} good />
                  </Reveal>
                </div>
                <Reveal delay={0.2}>
                  <Figure file={lesson.result2.file || undefined} cap={lesson.result2.cap} alt={lesson.result2.cap} full />
                </Reveal>
              </>
            ) : (
              <>
                <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2">
                  <Reveal delay={0.08}>
                    <PromptCard label="Prompt ใหม่ · few-shot (สังเคราะห์จากบทสนทนา)" text={lesson.prompt2} strong />
                  </Reveal>
                  <Reveal delay={0.16}>
                    <Figure file={lesson.result2.file || undefined} cap={lesson.result2.cap} alt={lesson.result2.cap} tall contain={!!lesson.result2.file} />
                  </Reveal>
                </div>
                <Reveal delay={0.2}>
                  <p className="mt-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{lesson.result2.summary}</p>
                </Reveal>
              </>
            )}
          </section>
        </Boundary>
        </>
        )}

        {/* ── real source files (lessons that ship actual code) ── */}
        {'code' in lesson && lesson.code.length > 0 && (
          <Boundary>
            <section aria-labelledby={`code-${lesson.id}`} className="mx-auto max-w-6xl px-6 py-10 md:py-14">
              <Reveal>
                <p className="kicker">ไฟล์จริง</p>
                <h2 id={`code-${lesson.id}`} className="mt-3 text-2xl md:text-3xl">โค้ดต้นฉบับที่ใช้จริง — เปิดดูและดาวน์โหลดได้</h2>
              </Reveal>
              <div className="mt-8 space-y-6">
                {lesson.code.map((c, i) => (
                  <Reveal key={c.file} delay={0.06 + i * 0.06}>
                    <CodeCard label={c.label} text={rawText(c.file)} />
                  </Reveal>
                ))}
              </div>
            </section>
          </Boundary>
        )}

        {/* ── reflection ── */}
        <Boundary>
          <section aria-labelledby={`re-${lesson.id}`} className="mx-auto max-w-6xl px-6 py-10 md:py-14">
            <Reveal>
              <div
                className="overflow-hidden rounded-3xl p-8 md:p-12"
                style={{
                  background:
                    'radial-gradient(120% 120% at 50% 0%, hsl(var(--accent) / 0.14), transparent 60%), hsl(var(--surface))',
                  boxShadow: '0 2px 4px rgba(0,0,0,.35), 0 16px 48px rgba(0,0,0,.4)',
                }}
              >
                <h2 id={`re-${lesson.id}`} className="text-2xl md:text-3xl">สะท้อนการเรียนรู้</h2>
                <p className="mt-4 max-w-3xl leading-relaxed text-[hsl(var(--foreground)/0.92)]">{lesson.tip}</p>
                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <VsCard label={hasIt ? `${stepWord} 1 · เริ่มต้น` : 'ผลลัพธ์แรก · zero-shot'} text={lesson.result1.summary} />
                  <VsCard label={hasIt ? `${stepWord} ${lesson.iterations.length} · ฉบับสุดท้าย` : 'ผลลัพธ์ใหม่ · few-shot'} text={lesson.result2.summary} good />
                </div>
              </div>
            </Reveal>
          </section>
        </Boundary>

        {/* ── links + prev/next ── */}
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-4 md:pb-24">
          {lesson.links.length > 0 && (
            <Reveal>
              <div className="flex flex-wrap items-center gap-4">
                {lesson.links.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[44px] items-center gap-2 rounded-full bg-[hsl(var(--accent))] px-6 py-3 font-semibold text-[hsl(var(--accent-foreground))] shadow-[0_0_32px_hsl(var(--accent)/0.3)] transition-transform duration-150 hover:-translate-y-0.5"
                  >
                    {l.label}
                    <span aria-hidden="true" className="text-[0.8em] opacity-70">↗</span>
                  </a>
                ))}
              </div>
            </Reveal>
          )}
          <Reveal delay={0.1}>
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[hsl(var(--border))] pt-8">
              {prev ? (
                <a href={`${base}lesson/${prev.id}`} className={pill}>
                  ← {prev.num} · {prev.nav}
                </a>
              ) : (
                <span />
              )}
              <a href={base} className={pill}>
                ⚡ กลับหน้าหลัก
              </a>
              {next ? (
                <a href={`${base}lesson/${next.id}`} className={pill}>
                  {next.nav} · {next.num} →
                </a>
              ) : (
                <span />
              )}
            </div>
          </Reveal>
        </section>

        <footer className="mx-auto max-w-6xl px-6 pb-10 pt-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <p>
            พลังของ Prompt · การบ้าน 6 แง่ —{' '}
            <a className="underline decoration-[hsl(var(--accent))] underline-offset-4" href={`${base}credits.md`}>
              ดูรายละเอียดการสร้างสื่อ
            </a>
          </p>
        </footer>
      </main>
    </MotionConfig>
  );
}
