import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  MotionConfig,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { content } from '../content';

/* ── media: ESM-imported from src/assets (Vite emits base-correct hashed URLs) ── */
const media = import.meta.glob('../assets/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const asset = (name: string): string => media[`../assets/${name}`] ?? '';

const EASE = [0.23, 1, 0.32, 1] as const;

/* ── alt text (Thai, descriptive — a11y per AC-T10-2) ── */
const ALT: Record<string, string> = {
  intro: 'ภาพนามธรรมเส้นแสงสีทองร้อยเรียงคล้ายโครงข่ายประสาท ลอยอยู่ในความมืดสีน้ำเงินเข้ม',
  'chapter-content': 'ครีเอเตอร์ไทยกำลังทำงานในสตูดิโอมืดยามค่ำ แสงจอคอมพิวเตอร์สีทองส่องมาที่ใบหน้า',
  'chapter-work': 'ทิวทัศน์กรุงเทพยามค่ำจากหน้าต่างออฟฟิศ แสงไฟเมืองสีทองตัดกับท้องฟ้าสีน้ำเงินเข้ม',
  'chapter-learn': 'นักเรียนกำลังอ่านหนังสือยามค่ำ มีแสงอนุภาคสีทองลอยเหนือโต๊ะเรียน',
  'chapter-life': 'ครัวไทยอบอุ่นยามเช้ามืด แสงสีทองจากลำโพงอัจฉริยะและแสงเช้าที่หน้าต่าง มีไอน้ำจากแก้วกาแฟ',
};

/* ── ErrorBoundary: one section's error cannot blank the page ── */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section data-section="error" className="px-6 py-24 text-center opacity-70">
        ส่วนนี้แสดงผลไม่สมบูรณ์ — เลื่อนไปส่วนถัดไปได้เลย
      </section>
    ) : (
      this.props.children
    );
  }
}

/* ── Reveal: SSR-visible (initial={false} + pre-mount 'show'); hidden only after
     mount until in view — JS-off readers still get every word. Trigger margin 0%
     (review: reveal earlier so content is painted by the time it's comfortably
     in view on throttled devices). ── */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0% 0px -8% 0px' });
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const show = !mounted || reduce || inView;
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={reduce ? { opacity: 1, y: 0 } : { opacity: show ? 1 : 0, y: show ? 0 : 24 }}
      transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ── Parallax plate: translateY driven by section scroll progress.
     Mobile: taller 16/10 frame with smaller overscan (review R13); desktop 21/9. ── */
function Plate({ src, srcSet, alt, fallbackId }: { src: string; srcSet?: string; alt: string; fallbackId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const plateY = useTransform(scrollYProgress, [0, 1], ['-8vh', '8vh']);
  return (
    <div
      ref={ref}
      className="relative my-8 aspect-[16/10] w-full overflow-hidden rounded-2xl bg-[hsl(var(--surface-2))] md:aspect-[21/9]"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,.35), 0 4px 12px rgba(0,0,0,.35), 0 12px 32px rgba(0,0,0,.35)' }}
    >
      <motion.div
        data-parallax-plate
        className="absolute inset-x-0 -top-[6vh] h-[calc(100%+12vh)] md:-top-[12vh] md:h-[calc(100%+24vh)]"
        style={{ y: reduce ? '0px' : plateY, willChange: 'transform' }}
      >
        {src ? (
          <img
            src={src}
            srcSet={srcSet ? `${srcSet} 960w, ${src} 2048w` : undefined}
            sizes="(max-width: 768px) 100vw, 60vw"
            alt={alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            style={{ filter: 'saturate(0.88) contrast(1.05)' }}
          />
        ) : (
          /* documented CSS fallback plate — still a parallax plate */
          <div
            className="h-full w-full"
            style={{
              background:
                'radial-gradient(120% 90% at 30% 20%, hsl(var(--accent) / .18), transparent 55%), radial-gradient(100% 80% at 75% 80%, hsl(228 40% 20% / .9), transparent 60%), hsl(var(--surface-2))',
            }}
            role="img"
            aria-label={alt || `ภาพประกอบ ${fallbackId}`}
          />
        )}
      </motion.div>
      {/* ink scrim for edge contrast */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(180deg, hsl(var(--background) / .25), transparent 40%, hsl(var(--background) / .45))' }}
      />
    </div>
  );
}

/* ── sections ── */

function Hero() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 800], [0, -220]);
  const video = asset('hero-540.mp4') || asset('hero.mp4') || asset('hero.webm');
  const poster = asset('hero-poster.jpg');
  const words = content.hero.headline.split(' '); // single source: content.ts

  // WCAG 2.2.2 (A): autoplaying motion needs a pause; under reduced-motion render
  // the still poster instead of autoplaying video (review finding, critical).
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const showVideo = !reduce;
  const togglePause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { void v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
  };

  // scroll hint fades out once the visitor is moving (review: stronger cue)
  const [hintGone, setHintGone] = useState(false);
  useEffect(() => {
    const onScroll = () => setHintGone(window.scrollY > window.innerHeight * 0.5);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section
      data-section="hero"
      className="relative flex min-h-[100dvh] items-end overflow-hidden pb-24 md:items-center md:pb-0"
    >
      <motion.div
        className="absolute inset-0"
        style={{ y: reduce ? '0px' : heroY, willChange: 'transform' }}
      >
        {video && showVideo ? (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src={video}
            poster={poster || undefined}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            aria-hidden="true"
          />
        ) : (
          <div
            className="h-full w-full bg-cover bg-center"
            role="img"
            aria-label="ภาพพื้นหลังอนุภาคแสงสีทองลอยในความมืดสีน้ำเงินเข้ม"
            style={poster ? { backgroundImage: `url(${poster})` } : {
              background: 'radial-gradient(120% 90% at 70% 30%, hsl(var(--accent) / .16), transparent 55%), hsl(var(--background))',
            }}
          />
        )}
        {/* strengthened mid scrim: text zone stays ≥4.5:1 over bright video frames */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, hsl(var(--background) / .75), hsl(var(--background) / .65) 50%, hsl(var(--background) / .92))' }}
        />
      </motion.div>

      <div className="relative mx-auto w-full max-w-6xl px-6">
        <h1 className="flex flex-wrap items-baseline gap-x-5 text-6xl font-bold tracking-tight md:text-8xl">
          {words.map((w, i) => (
            <motion.span
              key={w}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.65, ease: EASE, delay: 0.15 + i * 0.09 }}
              style={{ textShadow: '0 4px 40px hsl(var(--background) / .8)' }}
            >
              {w === 'AI' ? <span className="text-[hsl(var(--accent))]">{w}</span> : w}
            </motion.span>
          ))}
        </h1>
        <Reveal delay={0.55} className="mt-6 max-w-xl text-lg text-[hsl(var(--foreground) / 0.85)] md:text-xl">
          <p>{content.hero.sub}</p>
        </Reveal>
        <Reveal delay={0.75} className="mt-12">
          <div
            aria-hidden="true"
            className="inline-flex items-center gap-3 rounded-full border border-[hsl(var(--accent) / 0.5)] bg-[hsl(var(--background) / .5)] px-6 py-3 text-sm font-medium text-[hsl(var(--foreground) / 0.9)] backdrop-blur-sm transition-opacity duration-500"
            style={{ opacity: hintGone ? 0 : 1 }}
          >
            <motion.span
              className="text-[hsl(var(--accent))]"
              animate={reduce || hintGone ? undefined : { y: [0, 5, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              ↓
            </motion.span>
            {content.hero.scrollHint}
          </div>
        </Reveal>
      </div>

      {video && showVideo && (
        <button
          type="button"
          onClick={togglePause}
          aria-label={paused ? 'เล่นวิดีโอพื้นหลัง' : 'หยุดวิดีโอพื้นหลังชั่วคราว'}
          className="absolute bottom-5 right-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background) / .6)] text-sm text-[hsl(var(--foreground) / .85)] backdrop-blur-sm transition-transform duration-150 hover:scale-105"
        >
          {paused ? '▶' : '❚❚'}
        </button>
      )}
    </section>
  );
}

function Intro() {
  const c = content.intro;
  return (
    <section data-section="intro" aria-labelledby="intro-h" className="mx-auto max-w-6xl px-6 py-24 md:py-36">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <p className="kicker">{c.kicker}</p>
          <h2 id="intro-h" className="mt-4 text-3xl md:text-4xl">{c.heading}</h2>
          <p className="mt-6 text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">{c.body}</p>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {c.stats.map((s, i) => (
            <Reveal key={s.value} delay={0.12 + i * 0.08}>
              <div
                className="rounded-2xl bg-[hsl(var(--surface))] p-6"
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.3)' }}
              >
                <div className="text-3xl font-semibold text-[hsl(var(--accent))]">{s.value}</div>
                <div className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <Plate src={asset('intro.webp')} srcSet={asset('intro-960.webp')} alt={ALT.intro} fallbackId="intro" />
    </section>
  );
}

function Chapter({ ch, flip }: { ch: (typeof content.chapters)[number]; flip: boolean }) {
  return (
    <section data-section={`chapter-${ch.id}`} aria-labelledby={`ch-${ch.id}-h`} className="mx-auto max-w-6xl px-6 py-16 md:py-28">
      <div className={`grid items-center gap-8 md:grid-cols-5 ${flip ? 'md:[direction:rtl]' : ''}`}>
        <div className="md:col-span-3 md:[direction:ltr]">
          <Plate
            src={asset(`chapter-${ch.id}.webp`)}
            srcSet={asset(`chapter-${ch.id}-960.webp`)}
            alt={ALT[`chapter-${ch.id}`] ?? ''}
            fallbackId={ch.id}
          />
        </div>
        <div className="relative md:col-span-2 md:[direction:ltr]">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-14 right-0 select-none text-[6.5rem] font-bold leading-none text-[hsl(var(--foreground) / 0.08)] md:-top-16 md:text-[9rem]"
          >
            {ch.num}
          </span>
          {/* kicker+heading+body as ONE reveal unit; bullets/tip stagger after */}
          <Reveal>
            <p className="kicker">{ch.kicker}</p>
            <h2 id={`ch-${ch.id}-h`} className="mt-3 text-3xl md:text-4xl">{ch.heading}</h2>
            <p className="mt-4 text-[hsl(var(--muted-foreground))]">{ch.body}</p>
          </Reveal>
          <ul className="mt-6 space-y-3">
            {ch.examples.map((ex, i) => (
              <Reveal key={i} delay={0.1 + i * 0.07}>
                <li className="flex gap-3 leading-relaxed">
                  <span aria-hidden="true" className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--accent))]" />
                  <span>{ex}</span>
                </li>
              </Reveal>
            ))}
          </ul>
          {/* demoted tip: neutral card, accent label only (review: examples are the payoff) */}
          <Reveal delay={0.35}>
            <p className="mt-6 rounded-xl border border-[hsl(var(--border))] p-4 text-sm leading-relaxed text-[hsl(var(--foreground) / 0.85)]">
              <span className="font-medium text-[hsl(var(--accent))]">เคล็ดลับ:</span> {ch.tip.replace(/^เคล็ดลับ: /, '')}
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function HowTo() {
  const c = content.howto;
  return (
    <section data-section="howto" aria-labelledby="howto-h" className="mx-auto max-w-6xl px-6 py-24 md:py-36">
      <Reveal>
        <p className="kicker">{c.kicker}</p>
        <h2 id="howto-h" className="mt-4 text-3xl md:text-4xl">{c.heading}</h2>
      </Reveal>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {c.steps.map((s, i) => (
          <Reveal key={s.title} delay={0.12 + i * 0.1}>
            <div className="h-full rounded-2xl bg-[hsl(var(--surface))] p-7" style={{ boxShadow: '0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.3)' }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent) / 0.15)] text-lg font-bold text-[hsl(var(--accent))]">
                {i + 1}
              </div>
              <h3 className="mt-5 text-xl">{s.title}</h3>
              <p className="mt-3 leading-relaxed text-[hsl(var(--muted-foreground))]">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  const c = content.cta;
  return (
    <section data-section="cta" aria-labelledby="cta-h" className="mx-auto max-w-6xl px-6 pb-16 pt-12 md:pb-28">
      <Reveal>
        <div
          className="overflow-hidden rounded-3xl p-10 text-center md:p-16"
          style={{
            background:
              'radial-gradient(120% 120% at 50% 0%, hsl(var(--accent) / 0.16), transparent 60%), hsl(var(--surface))',
            boxShadow: '0 2px 4px rgba(0,0,0,.35), 0 16px 48px rgba(0,0,0,.4)',
          }}
        >
          <h2 id="cta-h" className="mx-auto max-w-3xl text-3xl md:text-4xl">{c.heading}</h2>
          <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-[hsl(var(--muted-foreground))]">{c.body}</p>
          <div className="mt-10 flex flex-wrap items-start justify-center gap-4">
            {c.links.map((l, i) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${l.label} — ${l.note} (เปิดในแท็บใหม่)`}
                className={
                  i === 0
                    ? 'flex min-h-[44px] items-center gap-2 rounded-full bg-[hsl(var(--accent))] px-7 py-3 font-semibold text-[hsl(var(--accent-foreground))] shadow-[0_0_32px_hsl(var(--accent)/0.35)] transition-transform duration-150 hover:-translate-y-0.5'
                    : 'flex min-h-[44px] items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-6 py-3 font-medium transition-transform duration-150 hover:-translate-y-0.5'
                }
              >
                <span className="flex flex-col items-start text-left">
                  <span className="flex items-center gap-1.5">
                    {l.label}
                    <span aria-hidden="true" className="text-[0.8em] opacity-70">↗</span>
                  </span>
                  <span className={`text-[13px] leading-snug ${i === 0 ? 'text-[hsl(var(--accent-foreground) / 0.75)]' : 'text-[hsl(var(--foreground) / 0.72)]'}`}>
                    {l.note}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });
  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-[hsl(var(--accent))]"
      style={{ scaleX }}
    />
  );
}

export default function Experience() {
  return (
    <MotionConfig reducedMotion="user">
      {/* grain lives on <body> (index.astro) — single overlay, not doubled here */}
      <main className="relative">
        <ScrollProgress />
        <Boundary>
          <Hero />
        </Boundary>
        <Boundary>
          <Intro />
        </Boundary>
        {content.chapters.map((ch, i) => (
          <Boundary key={ch.id}>
            <Chapter ch={ch} flip={i % 2 === 1} />
          </Boundary>
        ))}
        <Boundary>
          <HowTo />
        </Boundary>
        <Boundary>
          <CTA />
        </Boundary>
        <footer className="mx-auto max-w-6xl px-6 pb-10 pt-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <p>
            ใช้ AI ทำอะไรดี · {content.cta.creditsLine} —{' '}
            <a className="underline decoration-[hsl(var(--accent))] underline-offset-4" href="credits.md">
              {content.cta.creditsLink}
            </a>
          </p>
        </footer>
      </main>
    </MotionConfig>
  );
}
