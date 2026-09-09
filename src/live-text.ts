import { useEffect, useMemo, useReducer } from 'react';

// ─ real-time text layer ─────────────────────────────────────────────────────
// LIVE_TEXT_URL points at a JSON file (site-text.json format: flat key→text map).
// The page fetches it on load; if it parses, every text swaps to the live
// version instantly (refresh = new text, no rebuild). The old "== key" text
// format is also accepted. If the URL is empty or unreachable, the baked-in
// text from the build is used.
export const LIVE_TEXT_URL = 'https://raw.githubusercontent.com/FiezDev/ai-arai-dee/main/src/site-text.json'; // ← ใส่ URL ของ site-text.json ที่นี่เพื่อเปิด real-time text

let cache: Record<string, string> | null = null;
let started = false;
const subs = new Set<() => void>();

export function parseText(src: string): Record<string, string> | null {
  const s = src.trim();
  if (s.startsWith('{')) {
    try {
      const obj: unknown = JSON.parse(s);
      const out: Record<string, string> = {};
      if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          if (typeof v === 'string') out[k] = v;
        }
      }
      return out;
    } catch {
      return null; // broken JSON → keep baked text
    }
  }
  // legacy "== key" format
  const out: Record<string, string> = {};
  let key: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (key !== null) out[key] = buf.join('\n').replace(/^\n+|\n+$/g, '');
    buf = [];
  };
  for (const line of s.split(/\r?\n/)) {
    const m = /^== (.+)$/.exec(line);
    if (m) {
      flush();
      key = m[1].trim();
    } else if (key !== null) {
      buf.push(line);
    }
  }
  flush();
  return out;
}

export function useLiveText(): Record<string, string> | null {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    subs.add(force);
    if (!started && LIVE_TEXT_URL) {
      started = true;
      const bust = `${LIVE_TEXT_URL}${LIVE_TEXT_URL.includes('?') ? '&' : '?'}t=${Date.now()}`;
      fetch(bust, { cache: 'no-store' })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((src) => {
          const parsed = parseText(src);
          if (parsed) {
            cache = parsed;
            subs.forEach((f) => f());
          }
        })
        .catch(() => {
          /* keep baked text */
        });
    }
    return () => {
      subs.delete(force);
    };
  }, []);
  return cache;
}

/** live value if present and non-empty, otherwise the baked fallback */
export function lt(T: Record<string, string> | null, key: string, fallback: string): string {
  if (T) {
    const v = T[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return fallback;
}

/**
 * Wrap a baked lesson object so every text field resolves live-first.
 * Structure (ids, images, hrefs) always comes from the build.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useLiveLesson<T extends Record<string, any>>(lesson: T): T {
  const T_ = useLiveText();
  return useMemo(() => {
    if (!T_) return lesson;
    const id = lesson.id as string;
    const g = (k: string, fb: string) => lt(T_, k, fb);
    const k = (n: string) => `lesson.${id}.${n}`;
    const out: Record<string, unknown> = {
      ...lesson,
      nav: g(k('nav'), lesson.nav),
      kicker: g(k('kicker'), lesson.kicker),
      heading: g(k('heading'), lesson.heading),
      body: g(k('body'), lesson.body),
      tip: g(k('tip'), lesson.tip),
      prompt1: g(k('prompt1'), lesson.prompt1),
      prompt2: g(k('prompt2'), lesson.prompt2),
      plateCap: g(k('plateCap'), lesson.plateCap),
      result1: {
        ...lesson.result1,
        cap: g(k('result1.cap'), lesson.result1.cap),
        summary: g(k('result1.summary'), lesson.result1.summary),
      },
      result2: {
        ...lesson.result2,
        cap: g(k('result2.cap'), lesson.result2.cap),
        summary: g(k('result2.summary'), lesson.result2.summary),
      },
    };
    if ('refsKicker' in lesson) out.refsKicker = g(k('refsKicker'), lesson.refsKicker);
    if ('refsHeading' in lesson) out.refsHeading = g(k('refsHeading'), lesson.refsHeading);
    if ('refsIntro' in lesson) out.refsIntro = g(k('refsIntro'), lesson.refsIntro);
    if ('refs' in lesson) {
      out.refs = lesson.refs.map((r: { file: string; label: string; note: string }, i: number) => ({
        ...r,
        label: g(k(`ref.${i + 1}.label`), r.label),
        note: g(k(`ref.${i + 1}.note`), r.note),
      }));
    }
    if ('itKicker' in lesson) out.itKicker = g(k('itKicker'), lesson.itKicker);
    if ('itHeading' in lesson) out.itHeading = g(k('itHeading'), lesson.itHeading);
    if ('stepWord' in lesson) out.stepWord = g(k('stepWord'), lesson.stepWord);
    if ('iterationsIntro' in lesson) out.iterationsIntro = g(k('iterationsIntro'), lesson.iterationsIntro);
    if ('iterations' in lesson) {
      out.iterations = lesson.iterations.map(
        (it: { n: number; delta: string; prompt: string; img: string; cap: string }, i: number) => ({
          ...it,
          delta: g(k(`iter.${i + 1}.delta`), it.delta),
          prompt: g(k(`iter.${i + 1}.prompt`), it.prompt),
          cap: g(k(`iter.${i + 1}.cap`), it.cap),
        }),
      );
    }
    if ('asksIntro' in lesson) out.asksIntro = g(k('asksIntro'), lesson.asksIntro);
    out.asks = lesson.asks.map((a: { q: string; a: string }, i: number) => ({
      q: g(k(`ask.${i + 1}.q`), a.q),
      a: g(k(`ask.${i + 1}.a`), a.a),
    }));
    out.links = lesson.links.map((x: { label: string; href: string; note: string }, i: number) => ({
      ...x,
      label: g(k(`link.${i + 1}.label`), x.label),
    }));
    if ('code' in lesson) {
      out.code = lesson.code.map((c: { label: string; file: string }, i: number) => ({
        ...c,
        label: g(k(`code.${i + 1}.label`), c.label),
      }));
    }
    return out as T;
  }, [lesson, T_]);
}
