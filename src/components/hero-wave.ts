import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createWaveLayers, type WaveUniforms } from './hero-wave-layers';

export type HeroWave = { setPaused: (paused: boolean) => void; dispose: () => void };

export function createHeroWave(host: HTMLDivElement, paused: boolean, onFailure: () => void): HeroWave {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const constrained = host.clientWidth < 768 || window.matchMedia('(pointer: coarse)').matches
    || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4)
    || (memory !== undefined && memory <= 4);
  const pixelBudget = constrained ? 600_000 : 1_200_000;
  let qualityScale = 1;
  let targetFPS = constrained ? 24 : 30;
  let slowFrames = 0;
  const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' });
  renderer.setClearColor('#010206');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.dataset.heroWave = '';
  canvas.dataset.heroQuality = constrained ? 'low' : 'balanced';
  canvas.style.cssText = 'display:block;width:100%;height:100%;position:absolute;inset:0;pointer-events:none';
  canvas.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 70);
  const uniforms: WaveUniforms = {
    uTime: { value: 0 },
    uHeight: { value: 900 },
    uFocus: { value: 13 },
    uViewport: { value: new THREE.Vector2(1, 1) },
    uSpan: { value: 32 },
    uScrollSpin: { value: 0 },
  };
  let composer: EffectComposer | undefined;
  const cleanups: (() => void)[] = [];
  let disposed = false;
  let failed = false;
  let frame = 0;
  let visible = host.getBoundingClientRect().bottom > 0;
  let previous = 0;
  let lastRender = 0;
  let pointerX = 0;
  let pointerY = 0;
  let baseDistance = 13;
  let lastScrollY = Math.max(0, window.scrollY);
  let scrollSpinTarget = 0;
  let wheelActiveUntil = 0;

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    lastRender = 0;
    slowFrames = 0;
    lastScrollY = Math.max(0, window.scrollY);
    scrollSpinTarget = uniforms.uScrollSpin.value;
    wheelActiveUntil = 0;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stop();
    canvas.remove();
    cleanups.forEach((cleanup) => cleanup());
    renderer.dispose();
    renderer.forceContextLoss();
  };
  const fail = () => {
    if (failed || disposed) return;
    failed = true;
    stop();
    onFailure();
  };
  const draw = () => {
    try { composer?.render(0); } catch { fail(); }
  };

  try {
    const layers = createWaveLayers(uniforms, constrained);
    scene.add(layers.group);
    cleanups.push(layers.dispose);
    const floatTargets = renderer.extensions.has('EXT_color_buffer_float');
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType,
    });
    composer = new EffectComposer(renderer, target);
    const pipeline = composer;
    cleanups.push(() => pipeline.dispose());
    const renderPass = new RenderPass(scene, camera);
    const output = new OutputPass();
    composer.addPass(renderPass);
    composer.addPass(output);
    cleanups.push(() => renderPass.dispose(), () => output.dispose());

    const resize = () => {
      if (disposed || failed) return;
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      baseDistance = camera.aspect < 1 ? 16 : 13;
      uniforms.uSpan.value = Math.max(32,
        2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (baseDistance + 8) * camera.aspect * 1.45 + 5);
      uniforms.uFocus.value = baseDistance;
      uniforms.uHeight.value = height;
      camera.position.z = baseDistance;
      camera.lookAt(0, -.1, 0);
      camera.updateProjectionMatrix();
      const ratio = Math.min(window.devicePixelRatio || 1, constrained ? 1 : 1.25,
        Math.sqrt(pixelBudget / (width * height)),
        renderer.capabilities.maxTextureSize / Math.max(width, height)) * qualityScale;
      renderer.setPixelRatio(ratio);
      composer?.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      composer?.setSize(width, height);
      uniforms.uViewport.value.set(width, height);
      draw();
    };
    const queueScrollSpin = (pixels: number, gain = .2) => {
      const screens = THREE.MathUtils.clamp(pixels / uniforms.uHeight.value, -1, 1);
      scrollSpinTarget = THREE.MathUtils.clamp(scrollSpinTarget + screens * gain,
        uniforms.uScrollSpin.value - .25, uniforms.uScrollSpin.value + .25);
    };
    const tick = (now: number) => {
      frame = 0;
      if (disposed || failed || paused || !visible || document.hidden) return;
      frame = requestAnimationFrame(tick);
      if (lastRender && now - lastRender < 1000 / targetFPS - 1) return;
      const gap = previous ? now - previous : 0;
      slowFrames = gap > (qualityScale === 1 ? 70 : 95) ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      // Lower GPU load after sustained slow frames; keep the poster as a last resort.
      if (slowFrames >= 12) {
        if (qualityScale < 1) { fail(); return; }
        qualityScale = .7;
        targetFPS = 20;
        slowFrames = 0;
        canvas.dataset.heroQuality = 'reduced';
        resize();
      }
      const delta = previous ? Math.min((now - previous) / 1000, .06) : 0;
      previous = lastRender = now;
      uniforms.uTime.value += delta;
      const scrollY = Math.max(0, window.scrollY);
      if (performance.now() > wheelActiveUntil) queueScrollSpin(scrollY - lastScrollY);
      lastScrollY = scrollY;
      // Limit both rotation speed and queued movement, including long anchor jumps.
      const spinGap = scrollSpinTarget - uniforms.uScrollSpin.value;
      uniforms.uScrollSpin.value += Math.abs(spinGap) < .0001 ? spinGap
        : THREE.MathUtils.clamp(spinGap * (1 - Math.exp(-delta * 6.5)), -delta * .3, delta * .3);
      const ease = 1 - Math.exp(-delta * 8);
      camera.position.x += (pointerX * 2.4 - camera.position.x) * ease;
      camera.position.y += (.65 + pointerY - camera.position.y) * ease;
      const focusTarget = camera.position.z - .1
        + Math.sin(uniforms.uTime.value * .28) * .5 + pointerY * 1.1;
      uniforms.uFocus.value += (focusTarget - uniforms.uFocus.value) * (1 - Math.exp(-delta * 1.6));
      camera.lookAt(0, -.1, 0);
      draw();
    };
    const sync = () => {
      if (disposed || failed || paused || !visible || document.hidden) stop();
      else if (!frame) {
        lastScrollY = Math.max(0, window.scrollY);
        frame = requestAnimationFrame(tick);
      }
    };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || paused || !visible || document.hidden) return;
      const bounds = host.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        resetPointer();
        return;
      }
      pointerX = THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
      pointerY = THREE.MathUtils.clamp(1 - (event.clientY - bounds.top) / bounds.height * 2, -1, 1);
    };
    const resetPointer = () => { pointerX = pointerY = 0; };
    const wheel = (event: WheelEvent) => {
      if (disposed || failed || paused || !visible || document.hidden) return;
      // Wheel input also works at page boundaries; suppress its matching native scroll.
      wheelActiveUntil = performance.now() + 350;
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? uniforms.uHeight.value : 1;
      queueScrollSpin(event.deltaY * unit, .24);
    };
    const contextLost = (event: Event) => { event.preventDefault(); fail(); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    const resizer = new ResizeObserver(resize);
    cleanups.push(() => observer.disconnect(), () => resizer.disconnect());
    const listen = (target: EventTarget, name: string, listener: EventListener) => {
      target.addEventListener(name, listener, { passive: name !== 'webglcontextlost' });
      cleanups.push(() => target.removeEventListener(name, listener));
    };
    listen(window, 'pointermove', pointer as EventListener);
    listen(window, 'wheel', wheel as EventListener);
    listen(document.documentElement, 'pointerleave', resetPointer);
    listen(document, 'visibilitychange', sync);
    listen(canvas, 'webglcontextlost', contextLost);
    renderer.debug.onShaderError = () => { throw new Error('Hero wave shader failed to compile'); };
    camera.position.set(0, .65, host.clientWidth / host.clientHeight < 1 ? 16 : 13);
    camera.lookAt(0, -.1, 0);
    resize();
    if (failed) throw new Error('Hero wave failed to render');
    host.appendChild(canvas);
    observer.observe(host);
    resizer.observe(host);
    sync();
    return { setPaused: (value) => { paused = value; sync(); }, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
