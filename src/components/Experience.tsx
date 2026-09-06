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

/* ── ErrorBoundary: one section's error cannot blank the page (stress S4) ── */
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

/* ── Reveal: SSR-visible (initial={false} + pre-mount 'show'), hidden only after
     mount until in view — JS-off readers still get every word (stress S4) ── */
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
  const inView = useInView(ref, { once: true, margin: '-12%' });
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const show = !mounted || reduce || inView;
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={
        reduce
          ? { opacity: 1, y: 0 }
          : { opacity: show ? 1 : 0, y: show ? 0 : 28 }
      }
      transition={reduce ? { duration: 0 } : { duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ── Parallax plate: translateY driven by section scroll progress.
     PRIMARY reduced-motion gate is this code (stress S1) — under reduce the
     transform is pinned to 0 and the probe must see identical values. ── */
function Plate({ src, srcSet, alt, fallbackId }: { src: string; srcSet?: string; alt: string; fallbackId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const plateY = useTransform(scrollYProgress, [0, 1], ['-11vh', '11vh']);
  return (
    <div
      ref={ref}
      className="relative my-8 aspect-[21/9] w-full overflow-hidden rounded-2xl bg-[hsl(var(--surface-2))]"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,.35), 0 4px 12px rgba(0,0,0,.35), 0 12px 32px rgba(0,0,0,.35)' }}
    >
      {src ? (
        <motion.div
          data-parallax-plate
          className="absolute inset-x-0 -top-[12vh] h-[calc(100%+24vh)]"
          style={{ y: reduce ? '0px' : plateY, willChange: 'transform' }}
        >
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
        </motion.div>
      ) : (
        /* documented CSS fallback plate (stress R6) — still a parallax plate */
        <motion.div
          data-parallax-plate
          className="absolute inset-x-0 -top-[12vh] h-[calc(100%+24vh)]"
          style={{
            y: reduce ? '0px' : plateY,
            willChange: 'transform',
            background:
              'radial-gradient(120% 90% at 30% 20%, hsl(var(--accent) / .18), transparent 55%), radial-gradient(100% 80% at 75% 80%, hsl(228 40% 20% / .9), transparent 60%), hsl(var(--surface-2))',
          }}
          aria-hidden={alt ? undefined : true}
        >
          <span className="sr-only">{alt || `ภาพประกอบ ${fallbackId}`}</span>
        </motion.div>
      )}
      {/* ink scrim keeps text-side contrast stable while the plate moves */}
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
  const video = asset('hero.mp4') || asset('hero.webm');
  const poster = asset('hero-poster.jpg');
  const words = ['ใช้', 'AI', 'ทำอะไรดี'];

  return (
    <section
      data-section="hero"
      className="relative flex min-h-[100dvh] items-end overflow-hidden pb-24 md:items-center md:pb-0"
    >
      <motion.div
        className="absolute inset-0"
        style={{ y: reduce ? '0px' : heroY, willChange: 'transform' }}
      >
        {video ? (
          <video
            className="h-full w-full object-cover"
            src={video}
            poster={poster || undefined}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            aria-hidden="true"
            style={{ filter: 'saturate(0.9) contrast(1.05)' }}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                'radial-gradient(120% 90% at 70% 30%, hsl(var(--accent) / .16), transparent 55%), hsl(var(--background))',
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, hsl(var(--background) / .55), hsl(var(--background) / .25) 45%, hsl(var(--background) / .9))' }}
        />
      </motion.div>

      <div className="relative mx-auto w-full max-w-6xl px-6">
        <h1 className="flex flex-wrap items-baseline gap-x-5 text-6xl font-bold tracking-tight md:text-8xl">
          {words.map((w, i) => (
            <motion.span
              key={w}
              initial={false}
              animate={reduce ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.65, ease: EASE, delay: 0.15 + i * 0.09 }}
              style={{ textShadow: '0 4px 40px hsl(var(--background) / .8)' }}
            >
              {w === 'AI' ? <span className="text-[hsl(var(--accent))]">{w}</span> : w}
            </motion.span>
          ))}
        </h1>
        <Reveal delay={0.55} className="mt-6 max-w-xl text-lg text-[hsl(var(--muted-foreground))] md:text-xl">
          <p>{content.hero.sub}</p>
        </Reveal>
        <Reveal delay={0.75} className="mt-12">
          <div
            className="inline-flex items-center gap-3 rounded-full border border-[hsl(var(--border))] px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]"
            aria-hidden="true"
          >
            <motion.span
              className="inline-block h-2 w-2 rounded-full bg-[hsl(var(--accent))]"
              animate={reduce ? undefined : { y: [0, 6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            {content.hero.scrollHint}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Intro() {
  const c = content.intro;
  return (
    <section data-section="intro" className="mx-auto max-w-4xl px-6 py-24 md:py-36">
      <Reveal>
        <p className="kicker">{c.kicker}</p>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className="mt-4 text-3xl md:text-5xl">{c.heading}</h2>
      </Reveal>
      <Reveal delay={0.16}>
        <p className="mt-6 text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">{c.body}</p>
      </Reveal>
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {c.stats.map((s, i) => (
          <Reveal key={s.value} delay={0.2 + i * 0.08}>
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
      <Plate src={asset('intro.webp')} srcSet={asset('intro-960.webp')} alt={ALT.intro} fallbackId="intro" />
    </section>
  );
}

function Chapter({ ch, flip }: { ch: (typeof content.chapters)[number]; flip: boolean }) {
  return (
    <section data-section={`chapter-${ch.id}`} className="mx-auto max-w-6xl px-6 py-16 md:py-28">
      <div className={`grid items-center gap-8 md:grid-cols-5 ${flip ? 'md:[direction:rtl]' : ''}`}>
        <div className="md:col-span-3 md:[direction:ltr]">
          <Plate
            src={asset(`${ch.id}.webp`)}
            srcSet={asset(`${ch.id}-960.webp`)}
            alt={ALT[ch.id] ?? ''}
            fallbackId={ch.id}
          />
        </div>
        <div className="relative md:col-span-2 md:[direction:ltr]">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 right-0 select-none text-[7rem] font-bold leading-none text-[hsl(var(--foreground) / 0.05)] md:text-[9rem]"
          >
            {ch.num}
          </span>
          <Reveal>
            <p className="kicker">{ch.kicker}</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-3 text-3xl md:text-4xl">{ch.heading}</h2>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-4 text-[hsl(var(--muted-foreground))]">{ch.body}</p>
          </Reveal>
          <ul className="mt-6 space-y-3">
            {ch.examples.map((ex, i) => (
              <Reveal key={i} delay={0.18 + i * 0.07}>
                <li className="flex gap-3 leading-relaxed">
                  <span aria-hidden="true" className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--accent))]" />
                  <span>{ex}</span>
                </li>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={0.45}>
            <p className="mt-6 rounded-xl border border-[hsl(var(--accent) / 0.25)] bg-[hsl(var(--accent) / 0.07)] p-4 text-sm leading-relaxed">
              {ch.tip}
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
    <section data-section="howto" className="mx-auto max-w-5xl px-6 py-24 md:py-36">
      <Reveal>
        <p className="kicker">{c.kicker}</p>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className="mt-4 text-3xl md:text-5xl">{c.heading}</h2>
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
    <section data-section="cta" className="mx-auto max-w-5xl px-6 pb-16 pt-12 md:pb-28">
      <Reveal>
        <div
          className="overflow-hidden rounded-3xl p-10 text-center md:p-16"
          style={{
            background:
              'radial-gradient(120% 120% at 50% 0%, hsl(var(--accent) / 0.16), transparent 60%), hsl(var(--surface))',
            boxShadow: '0 2px 4px rgba(0,0,0,.35), 0 16px 48px rgba(0,0,0,.4)',
          }}
        >
          <h2 className="mx-auto max-w-3xl text-3xl md:text-4xl">{c.heading}</h2>
          <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-[hsl(var(--muted-foreground))]">{c.body}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {c.links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-6 py-3 font-medium transition-transform duration-150 hover:-translate-y-0.5"
              >
                {l.label}
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{l.note}</span>
              </a>
            ))}
          </div>
        </div>
      </Reveal>
      <Reveal delay={0.15}>
        <footer className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <p>
            ใช้ AI ทำอะไรดี ·{' '}
            <a className="underline decoration-[hsl(var(--accent))] underline-offset-4" href="credits.md">
              {content.cta.creditsLine}
            </a>
          </p>
        </footer>
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
      <main className="grain relative">
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
      </main>
    </MotionConfig>
  );
}
