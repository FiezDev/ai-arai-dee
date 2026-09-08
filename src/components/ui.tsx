import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { lt, useLiveText } from '../live-text';
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';

/* ── media: ESM-imported from src/assets (Vite emits base-correct hashed URLs) ── */
const media = import.meta.glob(['../assets/*', '!../assets/hero*.mp4', '!../assets/hero*.webm'], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
export const asset = (name: string): string => media[`../assets/${name}`] ?? '';

/* ── raw text files from src/assets (for showing real source code) ── */
const raws = import.meta.glob('../assets/*.tex', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;
export const rawText = (name: string): string => raws[`../assets/${name}`] ?? '';

export const EASE = [0.23, 1, 0.32, 1] as const;

/* ── ErrorBoundary: one section's error cannot blank the page ── */
export class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
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

/* ── Reveal: SSR-visible; hidden only after mount until in view ── */
export function Reveal({
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

/* ── Parallax plate: translateY driven by section scroll progress ── */
export function Plate({ src, srcSet, alt, fallbackId, caption }: { src: string; srcSet?: string; alt: string; fallbackId: string; caption?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const plateY = useTransform(scrollYProgress, [0, 1], ['-8vh', '8vh']);
  return (
    <div ref={ref}>
      <div
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
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(180deg, hsl(var(--background) / .25), transparent 40%, hsl(var(--background) / .45))' }}
        />
      </div>
      {caption ? (
        <p className="-mt-4 mb-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{caption}</p>
      ) : null}
    </div>
  );
}

/* ── top pill menu: home + 6 lessons + guide ── */
export function Nav({ current, lessons }: { current?: string; lessons: readonly { id: string; num: string; nav: string }[] }) {
  const [scrolled, setScrolled] = useState(false);
  const T = useLiveText();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const base = import.meta.env.BASE_URL;
  const pill =
    'whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors';
  const normal = `${pill} text-[hsl(var(--foreground)/0.8)] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--foreground))]`;
  const active = `${pill} bg-[hsl(var(--surface-2))] text-[hsl(var(--accent))]`;
  return (
    <nav
      aria-label="เมนูบทเรียน"
      className="fixed inset-x-0 top-3 z-[55] flex justify-center px-3"
      style={{ opacity: scrolled ? 1 : 0.9 }}
    >
      <div
        className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background)/0.78)] px-1.5 py-1 backdrop-blur-md"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35)' }}
      >
        <a href={base} className={!current ? `${pill} text-[hsl(var(--accent))]` : `${pill} text-[hsl(var(--foreground)/0.8)] hover:bg-[hsl(var(--surface-2))]`}>
          ⚡ หน้าหลัก
        </a>
        {lessons.map((l) => (
          <a key={l.id} href={`${base}lesson/${l.id}`} className={current === l.id ? active : normal}>
            <span aria-hidden="true" className="mr-1 text-[hsl(var(--accent)/0.85)]">{l.num}</span>
            {lt(T, `lesson.${l.id}.nav`, l.nav)}
          </a>
        ))}
        <a href={`${base}canva-mcp-guide.html`} className={normal}>
          คู่มือ Canva
        </a>
      </div>
    </nav>
  );
}

/* ── prompt card (lesson pages) ── */
export function PromptCard({ label, text, strong }: { label: string; text: string; strong?: boolean }) {
  return (
    <div
      className={`h-full rounded-2xl border p-5 ${
        strong
          ? 'border-[hsl(var(--accent)/0.45)] bg-[hsl(var(--surface))]'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))]'
      }`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.3)' }}
    >
      <div className={`text-xs font-semibold ${strong ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
        {label}
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[hsl(var(--foreground)/0.92)]">{text}</p>
    </div>
  );
}

/* ── evidence figure (lesson pages) ── */
export function Figure({ file, cap, alt, tall, contain, full }: { file?: string; cap: string; alt?: string; tall?: boolean; contain?: boolean; full?: boolean }) {
  return (
    <figure
      className="h-full overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.3)' }}
    >
      {file ? (
        <img
          src={asset(file)}
          alt={alt ?? cap}
          loading="lazy"
          decoding="async"
          className={
            full
              ? 'w-full object-contain'
              : `w-full ${contain ? 'bg-[hsl(var(--surface-2))] object-contain p-2' : 'object-cover object-top'} ${tall ? 'max-h-[26rem]' : 'max-h-80'}`
          }
        />
      ) : (
        <div
          className="flex h-full min-h-40 items-center justify-center p-8 text-center"
          role="img"
          aria-label={cap}
          style={{ background: 'radial-gradient(120% 90% at 30% 20%, hsl(var(--accent) / .1), transparent 55%), hsl(var(--surface-2))' }}
        >
          <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{cap}</p>
        </div>
      )}
      {file ? <figcaption className="p-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{cap}</figcaption> : null}
    </figure>
  );
}

/* ── code card: shows a real source file (lesson pages) ── */
export function CodeCard({ label, text }: { label: string; text: string }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.3)' }}
    >
      <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-5 py-3 text-xs font-semibold text-[hsl(var(--accent))]">
        {label}
      </div>
      <pre className="max-h-[34rem] overflow-auto p-5 font-mono text-xs leading-relaxed text-[hsl(var(--foreground)/0.88)]">
        <code>{text}</code>
      </pre>
    </div>
  );
}

export function ScrollProgress() {
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
