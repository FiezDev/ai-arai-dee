// lessons.ts — โครงบทเรียน 6 แง่ (id/รูป/ไฟล์/ลิงก์ อยู่ที่นี่)
// ข้อความทั้งหมด (หัวเรื่อง เนื้อหา พรอมป์ คำอธิบาย) อยู่ใน site-text.md — แก้ที่ไฟล์นั้นได้เลย
import raw from './site-text.md?raw';

function parseText(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  let key: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (key !== null) out[key] = buf.join('\n').replace(/^\n+|\n+$/g, '');
    buf = [];
  };
  for (const line of src.split(/\r?\n/)) {
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

const T = parseText(raw);
const warned = new Set<string>();
const t = (k: string): string => {
  if (!(k in T) && !warned.has(k)) {
    warned.add(k);
    console.warn(`[site-text] ไม่เจอ key นี้ใน site-text.md: ${k}`);
  }
  return T[k] ?? '';
};

export const lessons = [
  {
    id: 'image',
    num: '01',
    nav: t('lesson.image.nav'),
    kicker: t('lesson.image.kicker'),
    heading: t('lesson.image.heading'),
    body: t('lesson.image.body'),
    refsIntro: t('lesson.image.refsIntro'),
    refs: [
      { file: 'ref-face.png', label: t('lesson.image.ref.1.label'), note: t('lesson.image.ref.1.note') },
      { file: 'ref-base.jpg', label: t('lesson.image.ref.2.label'), note: t('lesson.image.ref.2.note') },
      { file: 'ref-bubble.webp', label: t('lesson.image.ref.3.label'), note: t('lesson.image.ref.3.note') },
    ],
    iterationsIntro: t('lesson.image.iterationsIntro'),
    iterations: [
      { n: 1, delta: t('lesson.image.iter.1.delta'), prompt: t('lesson.image.iter.1.prompt'), img: 'iter-1.jpg', cap: t('lesson.image.iter.1.cap') },
      { n: 2, delta: t('lesson.image.iter.2.delta'), prompt: t('lesson.image.iter.2.prompt'), img: 'iter-2.jpg', cap: t('lesson.image.iter.2.cap') },
      { n: 3, delta: t('lesson.image.iter.3.delta'), prompt: t('lesson.image.iter.3.prompt'), img: 'iter-3.jpg', cap: t('lesson.image.iter.3.cap') },
      { n: 4, delta: t('lesson.image.iter.4.delta'), prompt: t('lesson.image.iter.4.prompt'), img: 'iter-4.jpg', cap: t('lesson.image.iter.4.cap') },
      { n: 5, delta: t('lesson.image.iter.5.delta'), prompt: t('lesson.image.iter.5.prompt'), img: 'iter-5.jpg', cap: t('lesson.image.iter.5.cap') },
    ],
    prompt1: '',
    prompt2: '',
    asks: [],
    plate: '',
    plateAlt: '',
    plateCap: '',
    result1: {
      file: '',
      cap: '',
      summary: t('lesson.image.result1.summary'),
    },
    result2: {
      file: '',
      cap: '',
      summary: t('lesson.image.result2.summary'),
    },
    tip: t('lesson.image.tip'),
    links: [
      { label: t('lesson.image.link.1.label'), href: 'https://higgsfield.ai', note: '' },
    ],
  },
  {
    id: 'desmos',
    num: '02',
    nav: t('lesson.desmos.nav'),
    kicker: t('lesson.desmos.kicker'),
    heading: t('lesson.desmos.heading'),
    body: t('lesson.desmos.body'),
    prompt1: t('lesson.desmos.prompt1'),
    prompt2: t('lesson.desmos.prompt2'),
    asks: [
      { q: t('lesson.desmos.ask.1.q'), a: t('lesson.desmos.ask.1.a') },
      { q: t('lesson.desmos.ask.2.q'), a: t('lesson.desmos.ask.2.a') },
      { q: t('lesson.desmos.ask.3.q'), a: t('lesson.desmos.ask.3.a') },
    ],
    plate: 'desmos-v2.png',
    plateAlt: 'หน้าจอ Desmos ภาษาไทยแสดงเส้นโค้งการลืมสีส้ม พร้อม slider A และ S เส้นประสีแดง y=50 และจุดกำกับจุดวิกฤต 50%',
    plateCap: t('lesson.desmos.plateCap'),
    result1: {
      file: 'desmos-v1.png',
      cap: t('lesson.desmos.result1.cap'),
      summary: t('lesson.desmos.result1.summary'),
    },
    result2: {
      file: '',
      cap: '',
      summary: t('lesson.desmos.result2.summary'),
    },
    tip: t('lesson.desmos.tip'),
    links: [
      { label: t('lesson.desmos.link.1.label'), href: 'https://www.desmos.com/calculator?lang=th', note: '' },
    ],
  },
  {
    id: 'mermaid',
    num: '03',
    nav: t('lesson.mermaid.nav'),
    kicker: t('lesson.mermaid.kicker'),
    heading: t('lesson.mermaid.heading'),
    body: t('lesson.mermaid.body'),
    prompt1: t('lesson.mermaid.prompt1'),
    prompt2: t('lesson.mermaid.prompt2'),
    asks: [
      { q: t('lesson.mermaid.ask.1.q'), a: t('lesson.mermaid.ask.1.a') },
      { q: t('lesson.mermaid.ask.2.q'), a: t('lesson.mermaid.ask.2.a') },
      { q: t('lesson.mermaid.ask.3.q'), a: t('lesson.mermaid.ask.3.a') },
      { q: t('lesson.mermaid.ask.4.q'), a: t('lesson.mermaid.ask.4.a') },
    ],
    plate: '',
    plateAlt: '',
    plateCap: t('lesson.mermaid.plateCap'),
    result2Full: true,
    result1: {
      file: 'mermaid-v1.png',
      cap: t('lesson.mermaid.result1.cap'),
      summary: t('lesson.mermaid.result1.summary'),
    },
    result2: {
      file: 'mermaid-v2.png',
      cap: t('lesson.mermaid.result2.cap'),
      summary: t('lesson.mermaid.result2.summary'),
    },
    tip: t('lesson.mermaid.tip'),
    links: [
      { label: t('lesson.mermaid.link.1.label'), href: 'https://mermaid.live', note: '' },
    ],
  },
  {
    id: 'latex',
    num: '04',
    nav: t('lesson.latex.nav'),
    kicker: t('lesson.latex.kicker'),
    heading: t('lesson.latex.heading'),
    body: t('lesson.latex.body'),
    prompt1: t('lesson.latex.prompt1'),
    prompt2: t('lesson.latex.prompt2'),
    asks: [
      { q: t('lesson.latex.ask.1.q'), a: t('lesson.latex.ask.1.a') },
      { q: t('lesson.latex.ask.2.q'), a: t('lesson.latex.ask.2.a') },
    ],
    plate: '',
    plateAlt: '',
    plateCap: t('lesson.latex.plateCap'),
    code: [
      { label: t('lesson.latex.code.1.label'), file: 'cat-behavior.tex' },
      { label: t('lesson.latex.code.2.label'), file: 'cat-behavior-multicat.tex' },
    ],
    result1: {
      file: 'cat-v1.png',
      cap: t('lesson.latex.result1.cap'),
      summary: t('lesson.latex.result1.summary'),
    },
    result2: {
      file: 'cat-v2.png',
      cap: t('lesson.latex.result2.cap'),
      summary: t('lesson.latex.result2.summary'),
    },
    tip: t('lesson.latex.tip'),
    links: [
      { label: t('lesson.latex.link.1.label'), href: 'https://fiezdev.github.io/ai-arai-dee/latex/cat-behavior-multicat.tex', note: '' },
      { label: t('lesson.latex.link.2.label'), href: 'https://fiezdev.github.io/ai-arai-dee/latex/cat-behavior-multicat.pdf', note: '' },
      { label: t('lesson.latex.link.3.label'), href: 'https://www.overleaf.com', note: '' },
    ],
  },
  {
    id: 'slides',
    num: '05',
    nav: t('lesson.slides.nav'),
    kicker: t('lesson.slides.kicker'),
    heading: t('lesson.slides.heading'),
    body: t('lesson.slides.body'),
    refsKicker: t('lesson.slides.refsKicker'),
    refsHeading: t('lesson.slides.refsHeading'),
    refsIntro: t('lesson.slides.refsIntro'),
    refs: [
      { file: 'nl-shot-1.png', label: t('lesson.slides.ref.1.label'), note: t('lesson.slides.ref.1.note') },
      { file: 'nl-shot-2.png', label: t('lesson.slides.ref.2.label'), note: t('lesson.slides.ref.2.note') },
      { file: 'nl-shot-3.png', label: t('lesson.slides.ref.3.label'), note: t('lesson.slides.ref.3.note') },
      { file: 'nl-shot-4.png', label: t('lesson.slides.ref.4.label'), note: t('lesson.slides.ref.4.note') },
      { file: 'nl-shot-5.png', label: t('lesson.slides.ref.5.label'), note: t('lesson.slides.ref.5.note') },
    ],
    itKicker: t('lesson.slides.itKicker'),
    itHeading: t('lesson.slides.itHeading'),
    iterationsIntro: t('lesson.slides.iterationsIntro'),
    stepWord: t('lesson.slides.stepWord'),
    iterations: [
      { n: 1, delta: t('lesson.slides.iter.1.delta'), prompt: t('lesson.slides.iter.1.prompt'), img: 'nl-shot-1.png', cap: t('lesson.slides.iter.1.cap') },
      { n: 2, delta: t('lesson.slides.iter.2.delta'), prompt: t('lesson.slides.iter.2.prompt'), img: 'docker-guide-page1.png', cap: t('lesson.slides.iter.2.cap') },
      { n: 3, delta: t('lesson.slides.iter.3.delta'), prompt: t('lesson.slides.iter.3.prompt'), img: 'nl-shot-4.png', cap: t('lesson.slides.iter.3.cap') },
    ],
    prompt1: '',
    prompt2: '',
    asks: [],
    plate: '',
    plateAlt: '',
    plateCap: '',
    result1: {
      file: '',
      cap: '',
      summary: t('lesson.slides.result1.summary'),
    },
    result2: {
      file: '',
      cap: '',
      summary: t('lesson.slides.result2.summary'),
    },
    tip: t('lesson.slides.tip'),
    links: [
      { label: t('lesson.slides.link.1.label'), href: 'https://fiezdev.github.io/ai-arai-dee/notebooklm/docker-ai-engineering-guide.pdf', note: '' },
      { label: t('lesson.slides.link.2.label'), href: 'https://notebook.google', note: '' },
      { label: t('lesson.slides.link.3.label'), href: 'https://fiezdev.github.io/ai-arai-dee/slides.html', note: '' },
    ],
  },
  {
    id: 'web',
    num: '06',
    nav: t('lesson.web.nav'),
    kicker: t('lesson.web.kicker'),
    heading: t('lesson.web.heading'),
    body: t('lesson.web.body'),
    itKicker: t('lesson.web.itKicker'),
    itHeading: t('lesson.web.itHeading'),
    stepWord: t('lesson.web.stepWord'),
    iterationsIntro: t('lesson.web.iterationsIntro'),
    iterations: [
      { n: 1, delta: t('lesson.web.iter.1.delta'), prompt: t('lesson.web.iter.1.prompt'), img: 'araid-design.png', cap: t('lesson.web.iter.1.cap') },
      { n: 2, delta: t('lesson.web.iter.2.delta'), prompt: t('lesson.web.iter.2.prompt'), img: 'hero-poster.jpg', cap: t('lesson.web.iter.2.cap') },
      { n: 3, delta: t('lesson.web.iter.3.delta'), prompt: t('lesson.web.iter.3.prompt'), img: 'araid-desktop_s1_hero.png', cap: t('lesson.web.iter.3.cap') },
      { n: 4, delta: t('lesson.web.iter.4.delta'), prompt: t('lesson.web.iter.4.prompt'), img: 'araid-desktop_full.png', cap: t('lesson.web.iter.4.cap') },
      { n: 5, delta: t('lesson.web.iter.5.delta'), prompt: t('lesson.web.iter.5.prompt'), img: 'araid-mobile_hero.png', cap: t('lesson.web.iter.5.cap') },
    ],
    prompt1: '',
    prompt2: '',
    asksIntro: t('lesson.web.asksIntro'),
    asks: [
      { q: t('lesson.web.ask.1.q'), a: t('lesson.web.ask.1.a') },
      { q: t('lesson.web.ask.2.q'), a: t('lesson.web.ask.2.a') },
      { q: t('lesson.web.ask.3.q'), a: t('lesson.web.ask.3.a') },
      { q: t('lesson.web.ask.4.q'), a: t('lesson.web.ask.4.a') },
      { q: t('lesson.web.ask.5.q'), a: t('lesson.web.ask.5.a') },
    ],
    plate: '',
    plateAlt: '',
    plateCap: '',
    result1: {
      file: '',
      cap: '',
      summary: t('lesson.web.result1.summary'),
    },
    result2: {
      file: '',
      cap: '',
      summary: t('lesson.web.result2.summary'),
    },
    tip: t('lesson.web.tip'),
    links: [
      { label: t('lesson.web.link.1.label'), href: 'https://fiezdev.github.io/ai-arai-dee/', note: '' },
      { label: t('lesson.web.link.2.label'), href: 'https://github.com/FiezDev/ai-arai-dee', note: '' },
    ],
  },
];

export const lessonNav = lessons.map((l) => ({ id: l.id, num: l.num, nav: l.nav }));
