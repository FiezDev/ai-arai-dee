import * as THREE from 'three';

export type WaveUniforms = {
  uTime: { value: number };
  uFocus: { value: number };
  uHeight: { value: number };
  uViewport: { value: THREE.Vector2 };
  uSpan: { value: number };
  uScrollSpin: { value: number };
};

const flow = `
  uniform float uScrollSpin;
  vec3 foldedStream(float x, float lane) {
    float phase = x * .55 - uTime * .58;
    float fold = lane * 3.8 + x * .72 - uTime * .36;
    float envelope = .5 + .35 * sin(x * .31 + uTime * .24);
    float y = -.5 + sin(phase) * .5 + sin(x * 1.03 + uTime * .21) * .22;
    y += sin(fold) * envelope + lane * .25;
    float z = lane * 1.8 + cos(fold) * .55 + sin(x * .28 - uTime * .2) * .55;
    float depthOffset = -smoothstep(-2., 8., x) * 2.4;
    z += depthOffset;
    float spiral = x * .63 - uTime * .32;
    y += cos(spiral + lane) * .1;
    z += sin(spiral + lane) * .17;
    vec2 tube = vec2((y + .5) * 1.85, z - depthOffset);
    float c = cos(uScrollSpin);
    float s = sin(uScrollSpin);
    return vec3(x, -.5 + c * tube.x - s * tube.y, depthOffset + s * tube.x + c * tube.y);
  }
`;

const grainVertex = `
  uniform float uTime;
  uniform float uFocus;
  uniform float uHeight;
  uniform vec2 uViewport;
  uniform float uSpan;
  attribute vec4 aData;
  attribute vec4 aStyle;
  attribute vec3 aFlow;
  varying vec2 vUv;
  varying float vBlur;
  varying float vEnergy;
  varying float vTone;
  varying float vKind;
  ${flow}
  void main() {
    float kind = aStyle.w;
    float x = mod(aData.x / 32. * uSpan + uTime * aFlow.x + uSpan * .5, uSpan) - uSpan * .5;
    vec3 p = foldedStream(x, aFlow.y);
    p.yz += aData.yz;
    if (kind < .5) {
      p.y += sin(x * 3.6 + aFlow.y * 11. - uTime * 1.1) * .07;
      p.z += cos(x * 2.2 - aFlow.y * 9. + uTime * .8) * .1;
    }
    if (kind > 2.5 && kind < 3.5) {
      p = vec3(x, aData.y + sin(uTime * .32 + aData.w) * .25, aData.z);
    }
    if (kind > 3.5) p.y += sin(uTime * .65 + aData.w) * .65;
    vec4 viewPosition = modelViewMatrix * vec4(p, 1.);
    float distance = max(-viewPosition.z, .1);
    float sizeScale = kind > 2.5 && kind < 3.5 ? 1.5 : 1.25;
    float sharpSize = aStyle.x * uHeight / 900. * 13. / distance * sizeScale;
    float defocus = abs(distance - uFocus) / distance;
    float blurSize = max(defocus * 62. - .8, 0.) * uHeight / 900. * sizeScale;
    float size = min(sqrt(sharpSize * sharpSize + blurSize * blurSize), 125. * sizeScale);
    vBlur = smoothstep(1.5, 10., blurSize);
    float packet = pow(.5 + .5 * sin(x * .88 - uTime * .95 + aFlow.y * 2.), 5.);
    vEnergy = aStyle.z * pow(sharpSize / max(size, 1.), 2.);
    if (kind < 2.5) vEnergy *= .6 + packet * 1.3;
    vEnergy *= .83 + .17 * sin(uTime * (1.1 + aFlow.z) + aData.w * 3.);
    vTone = aStyle.y;
    vKind = kind;
    vUv = uv;
    vec2 shape = position.xy;
    float angle = kind > 3.5 ? .25 * cos(x * .5 - uTime) : aData.w;
    if (kind > 3.5) shape.x *= mix(2.3, 1., vBlur);
    else shape.x *= mix(.72 + aFlow.z * .35, 1., vBlur);
    shape = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * shape;
    gl_Position = projectionMatrix * viewPosition;
    gl_Position.xy += shape * size / uViewport * gl_Position.w;
  }
`;

const grainFragment = `
  varying vec2 vUv;
  varying float vBlur;
  varying float vEnergy;
  varying float vTone;
  varying float vKind;
  void main() {
    vec2 p = vUv * 2. - 1.;
    float r = length(p);
    if (r > 1.) discard;
    float grain = exp(-r * r * 4.) + exp(-r * r * 24.) * .55;
    float bead = (1. - smoothstep(.25, .82, r)) * .85 + exp(-r * r * 32.) * .8;
    float lens = (1. - smoothstep(.6, 1., r)) * .65;
    float shape = mix(grain, bead, step(.5, vKind) * (1. - step(1.5, vKind)));
    float alpha = mix(shape, lens, vBlur) * vEnergy;
    vec3 color = mix(vec3(.9, .25, .015), vec3(1.35, .66, .13), vTone);
    color = mix(color, vec3(1.8, 1.2, .42), exp(-r * r * 14.) * (1. - vBlur) * .55);
    gl_FragColor = vec4(color, alpha);
  }
`;

type Layer = { kind: number; count: number; name: string };

export function createWaveLayers(uniforms: WaveUniforms, mobile: boolean) {
  const group = new THREE.Group();
  const resources: (THREE.BufferGeometry | THREE.Material)[] = [];
  let seed = 2741;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: grainVertex, fragmentShader: grainFragment,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  resources.push(material);
  const layers: Layer[] = [
    { kind: 0, count: mobile ? 4400 : 8500, name: 'folded-sheet' },
    { kind: 1, count: mobile ? 1100 : 2100, name: 'beaded-ribbons' },
    { kind: 2, count: mobile ? 800 : 1600, name: 'rear-dust' },
    { kind: 3, count: mobile ? 20 : 36, name: 'foreground' },
    { kind: 4, count: mobile ? 180 : 360, name: 'drifting-flecks' },
  ];

  for (const layer of layers) {
    const data: number[] = [];
    const styles: number[] = [];
    const motion: number[] = [];
    for (let i = 0; i < layer.count; i++) {
      const x = (random() - .5) * 32;
      let lane = random() * 2 - 1;
      let y = (random() - .5) * .12;
      let z = (random() - .5) * .22;
      let size = 2.8 + random() * 3.7;
      let strength = .65 + random() * .6;
      let speed = .55 + random() * .18;
      if (layer.kind === 1) {
        lane = (i % 4) / 3 * 2 - 1;
        y *= 1.6;
        size = 4 + Math.pow(random(), 2) * 7;
        strength = 1 + random() * .8;
        speed = .72 + lane * .09;
      } else if (layer.kind === 2) {
        y = (random() + random() - 1) * 1.2;
        z = -3.8 - random() * 2;
        size = 4 + random() * 6;
        strength = .8;
        speed = .16 + random() * .08;
      } else if (layer.kind === 3) {
        y = (random() - .5) * 5;
        z = 5.5 + random() * 3;
        size = 5 + random() * 7;
        strength = 6 + random() * 7;
        speed = 1.5 + random() * .9;
      } else if (layer.kind === 4) {
        y = (random() - .5) * 4.8;
        z = (random() - .5) * 8;
        size = 3 + random() * 6;
        strength = .9;
        speed = .8 + random();
      }
      data.push(x, y, z, random() * Math.PI * 2);
      styles.push(size, random(), strength, layer.kind);
      motion.push(speed, lane, random());
    }
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.setAttribute('aData', new THREE.InstancedBufferAttribute(new Float32Array(data), 4));
    geometry.setAttribute('aStyle', new THREE.InstancedBufferAttribute(new Float32Array(styles), 4));
    geometry.setAttribute('aFlow', new THREE.InstancedBufferAttribute(new Float32Array(motion), 3));
    geometry.instanceCount = layer.count;
    resources.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = layer.name;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  const ribbonPositions: number[] = [];
  const ribbonUVs: number[] = [];
  const ribbonLanes: number[] = [];
  const indices: number[] = [];
  const count = mobile ? 4 : 6;
  const segments = 240;
  for (let strand = 0; strand < count; strand++) {
    const start = ribbonPositions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      for (const side of [-1, 1]) {
        ribbonPositions.push(u * 32 - 16, side, 0);
        ribbonUVs.push(u, (side + 1) / 2);
        ribbonLanes.push(strand / (count - 1) * 2 - 1);
      }
      if (i < segments) {
        const vertex = start + i * 2;
        indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2);
      }
    }
  }
  const ribbonGeometry = new THREE.BufferGeometry();
  ribbonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ribbonPositions, 3));
  ribbonGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(ribbonUVs, 2));
  ribbonGeometry.setAttribute('aLane', new THREE.Float32BufferAttribute(ribbonLanes, 1));
  ribbonGeometry.setIndex(indices);
  const ribbonMaterial = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      uniform float uFocus;
      uniform vec2 uViewport;
      uniform float uSpan;
      attribute float aLane;
      varying vec2 vUv;
      varying float vFocus;
      varying float vLane;
      ${flow}
      void main() {
        float x = position.x / 32. * uSpan;
        vec3 center = foldedStream(x, aLane);
        center.y -= .18 + sin(x * .36 + aLane * 2. - uTime * .32) * .24;
        vec3 next = foldedStream(x + .04, aLane);
        next.y -= .18 + sin((x + .04) * .36 + aLane * 2. - uTime * .32) * .24;
        vec4 viewCenter = modelViewMatrix * vec4(center, 1.);
        vec4 clip = projectionMatrix * viewCenter;
        vec4 clipNext = projectionMatrix * modelViewMatrix * vec4(next, 1.);
        vec2 tangent = normalize((clipNext.xy / clipNext.w - clip.xy / clip.w) * uViewport);
        vec2 normal = vec2(-tangent.y, tangent.x);
        vFocus = 1. - smoothstep(1., 5., abs(-viewCenter.z - uFocus));
        float width = 1.3 + (1. - vFocus) * 2.;
        clip.xy += normal * position.y * width / uViewport * clip.w;
        gl_Position = clip;
        vUv = uv;
        vLane = aLane;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vFocus;
      varying float vLane;
      void main() {
        float edge = pow(max(1. - abs(vUv.y * 2. - 1.), 0.), 1.5);
        float pulse = pow(.5 + .5 * sin(vUv.x * 25. - uTime * 1.3 + vLane * 3.), 16.);
        float fade = smoothstep(0., .12, vUv.x) * (1. - smoothstep(.88, 1., vUv.x));
        vec3 gold = mix(vec3(.8, .37, .045), vec3(2.5, 1.5, .45), pulse);
        gl_FragColor = vec4(gold, edge * fade * (.18 + pulse * .6) * (.2 + vFocus * .8));
      }
    `,
  });
  resources.push(ribbonGeometry, ribbonMaterial);
  const ribbons = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
  ribbons.name = 'light-filaments';
  ribbons.frustumCulled = false;
  group.add(ribbons);
  return { group, dispose: () => resources.forEach((resource) => resource.dispose()) };
}
