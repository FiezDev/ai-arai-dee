import { useEffect, useRef, useState } from 'react';
import type { HeroWave } from './hero-wave';

type Props = { poster: string; paused: boolean; onReady: (ready: boolean) => void };

export default function HeroBackground({ poster, paused, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const wave = useRef<HeroWave | null>(null);
  const pausedRef = useRef(paused);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
    wave.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    onReady(false);
    if (reduced) return;
    let cancelled = false;
    const fail = () => {
      if (cancelled) return;
      wave.current?.dispose();
      wave.current = null;
      onReady(false);
    };
    void import('./hero-wave').then(({ createHeroWave }) => {
      if (cancelled || !host.current) return;
      wave.current = createHeroWave(host.current, pausedRef.current, fail);
      onReady(true);
    }).catch(fail);
    return () => {
      cancelled = true;
      wave.current?.dispose();
      wave.current = null;
    };
  }, [reduced, onReady]);

  return (
    <div
      ref={host}
      data-hero-background=""
      className="pointer-events-none absolute inset-0 bg-cover bg-center"
      aria-hidden="true"
      style={{ backgroundColor: '#080b14', backgroundImage: poster ? `url(${poster})` : undefined }}
    />
  );
}
