// Zone dressing: fountain, notice board, farmhouse, barn, wheat, flower beds, logs, reeds, lily pads,
// desert plants and rock pillars, raider palisades and racks, foundry scrap, rails, carts and coal.
import * as THREE from 'three';
import { Builder, rbox, box, cyl, cone, sphere, torus, lathe, extrude, card, tube, lumpy, ico, gear, V3, lerp, sstep, rgb } from './kit.js';
import { addRock, addTuft } from './trees.js';
import { smoke, glowSprite } from './dynamic.js';
import { G } from '../engine/globals.js';
import { waterNormalTex, waterfallTex } from '../engine/textures.js';

const PI = Math.PI;

function gable(b, w, d, h, mat, y0, { over = 0.4, thick = 0.18, x0 = 0, z0 = 0 } = {}) {
  const half = w / 2 + over, slope = Math.hypot(half, h), ang = Math.atan2(h, half);
  for (const sx of [-1, 1]) b.add(box(slope, thick, d + over * 2), mat, { p: [x0 + sx * half / 2, y0 + h / 2, z0], r: [0, 0, -sx * ang], c: 0xffffff, uv: 'box' });
  b.add(cyl(0.12, 0.12, d + over * 2 + 0.1, 8), 'beam', { p: [x0, y0 + h + 0.05, z0], r: [PI / 2, 0, 0], c: 0xffffff });
  for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) {
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
    b.add(new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: false }), 'woodDark', { p: [x0, y0, z0 + z - 0.075], c: '#e8d8c0', uv: 'box' });
  }
}

// ----------------------------------------------------------------------- water materials
// sq: a square pool of half-size `radius` (straight ripples, no rings)
export function basinWater(radius, sq = false) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: G.time, uNight: G.night, tN: { value: waterNormalTex() }, uR: { value: radius }, uSq: { value: sq ? 1 : 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */ `
        uniform float uNight;
      uniform float uTime; uniform sampler2D tN; uniform float uR; uniform float uSq; varying vec2 vP;
      void main() {
        float r = mix(length(vP), max(abs(vP.x), abs(vP.y)), uSq) / uR;
        vec3 n = texture2D(tN, vP * 0.35 + uTime * 0.03).xyz * 2.0 - 1.0;
        float rings = mix(sin(r * 28.0 - uTime * 4.0), sin((vP.x * 0.6 + vP.y) * 5.0 - uTime * 2.0) * 0.5, uSq) * 0.5 + 0.5;
        // unlit, so keep it in the scene's darker key: deep teal with bright glints and a foam rim
        vec3 c = mix(vec3(0.06, 0.2, 0.25), vec3(0.2, 0.42, 0.45), 0.35 + n.x * 0.3 + rings * 0.15 * (1.0 - r));
        c += pow(max(0.0, n.y), 18.0) * vec3(0.6, 0.55, 0.45);
        c = mix(c, vec3(0.7, 0.74, 0.72), smoothstep(0.9, 1.0, r) * 0.5);
        gl_FragColor = vec4((c) * (1.0 - 0.8 * uNight), 0.86);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(sq ? new THREE.PlaneGeometry(radius * 2, radius * 2) : new THREE.CircleGeometry(radius, 40), m);
  mesh.rotation.x = -PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}
// seg = 4 gives a square sheet (radius = half-diagonal), turned so its faces line up with the axes
export function waterCurtain(rTop, rBot, h, speed = 1.2, seg = 32) {
  const tex = waterfallTex();
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { tMap: { value: tex }, uTime: G.time, uNight: G.night, uS: { value: speed } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tMap; uniform float uTime; uniform float uS; uniform float uNight; varying vec2 vUv;
      void main(){ vec4 a = texture2D(tMap, vec2(vUv.x * 4.0, vUv.y * 0.6 + uTime * uS)); float fade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
      gl_FragColor = vec4((a.rgb * 0.78) * (1.0 - 0.8 * uNight), a.a * 0.75 * fade);
      #include <colorspace_fragment>
      }`,
  });
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, true);
  if (seg === 4) g.rotateY(Math.PI / 4);
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 3;
  return mesh;
}

// ======================================================================
// FOUNTAIN — village centrepiece
// ======================================================================
export function fountain(seed = 1) {
  const b = new Builder(seed);
  for (const [r, y, h] of [[3.6, 0.1, 0.25], [3.3, 0.32, 0.22]]) b.add(cyl(r, r + 0.1, h, 24), 'stoneLarge', { p: [0, y, 0], c: '#f0e8dc', us: 0.5 });
  // basin wall with a carved rim
  b.add(lathe([[2.75, 0.4], [3.05, 0.42], [3.1, 0.95], [3.2, 1.05], [3.2, 1.15], [2.75, 1.15], [2.7, 0.4]], 32), 'stone', { c: '#fff4e8', uv: 'box', us: 0.6 });
  b.add(torus(3.12, 0.05, 6, 48), 'gold', { p: [0, 0.98, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; b.add(rbox(0.34, 0.34, 0.06, 0.02), 'gold', { p: [Math.cos(a) * 3.11, 0.72, Math.sin(a) * 3.11], r: [0, -a + PI / 2, PI / 4], c: 0xffffff }); }
  // central pedestal with two bowls
  b.add(lathe([[0.55, 0.4], [0.5, 0.6], [0.3, 0.75], [0.26, 1.4], [0.34, 1.55], [0.001, 1.56]], 18), 'stoneLarge', { c: '#fff8ec', uv: 'box' });
  b.add(lathe([[0.001, 1.5], [0.4, 1.52], [1.0, 1.7], [1.08, 1.85], [1.0, 1.88], [0.95, 1.76], [0.001, 1.7]], 24), 'stone', { c: '#fff4e8', uv: 'box' });
  b.add(torus(1.05, 0.035, 5, 32), 'stone', { p: [0, 1.85, 0], r: [PI / 2, 0, 0], c: '#e8dccb' }); // (review) stone, not a gold ring round a gold ball (a halo from above)
  b.add(lathe([[0.18, 1.86], [0.14, 2.3], [0.2, 2.45], [0.001, 2.46]], 14), 'stoneLarge', { c: 0xffffff, uv: 'box' });
  b.add(lathe([[0.001, 2.4], [0.2, 2.42], [0.48, 2.55], [0.5, 2.65], [0.45, 2.66], [0.001, 2.58]], 18), 'stone', { c: '#fff4e8', uv: 'box' });
  b.add(sphere(0.12, 12, 10), 'stoneLarge', { p: [0, 2.78, 0], s: [1, 0.6, 1], c: '#fff8ec' });
  // flower ring around the plinth
  for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2; addTuft(b, i % 3 === 0 ? 'lavender' : 'flowers', [Math.cos(a) * 3.85, 0.05, Math.sin(a) * 3.85], 0.7, 0.45, a, 0xffffff, 2); }
  const dyn = [];
  const water = basinWater(2.72); water.position.y = 0.88; dyn.push(water);
  const upper = basinWater(0.95); upper.position.y = 1.8; dyn.push(upper);
  const top = basinWater(0.44); top.position.y = 2.6; dyn.push(top);
  const c1 = waterCurtain(1.04, 1.28, 0.95, 1.4); c1.position.y = 1.33; dyn.push(c1);
  const c2 = waterCurtain(0.47, 0.6, 0.78, 1.6); c2.position.y = 2.22; dyn.push(c2);
  const spout = waterCurtain(0.05, 0.12, 0.4, 2); spout.position.y = 2.95; dyn.push(spout);
  const mist = smoke({ rate: 6, life: 1.2, size: 0.5, rise: 0.4, color: 0xf0fbff, opacity: 0.4, spread: 0.6 });
  mist.position.y = 0.95;
  const ring = new THREE.Group(); ring.add(mist);
  // spread the mist emitter around the curtain ring
  let ang = 0;
  ring.userData.update = (dt, t) => { ang += dt * 2.3; mist.position.set(Math.cos(ang) * 1.25, 0.95, Math.sin(ang) * 1.25); mist.userData.update(dt, t); };
  dyn.push(ring);
  return { builder: b, collider: { r: 3.4 }, dynamics: dyn };
}

// ======================================================================
// NOTICE BOARD — quest board by the guild hall
// ======================================================================
export function noticeBoard(seed = 2) {
  const b = new Builder(seed);
  for (const sx of [-1, 1]) b.add(box(0.16, 2.6, 0.16), 'beam', { p: [sx * 1.0, 1.3, 0], c: 0xffffff });
  b.add(box(2.0, 1.3, 0.1), 'woodLight', { p: [0, 1.55, 0], c: 0xffffff, us: 1 });
  b.add(box(2.15, 0.1, 0.16), 'beam', { p: [0, 2.24, 0], c: 0xffffff });
  b.add(box(2.15, 0.1, 0.16), 'beam', { p: [0, 0.86, 0], c: 0xffffff });
  gable(b, 2.2, 0.5, 0.5, 'shingleWood', 2.3, { over: 0.25, thick: 0.08 });
  const papers = [[-0.6, 1.75, 0.04], [-0.1, 1.6, -0.08], [0.45, 1.8, 0.06], [0.55, 1.3, -0.1], [-0.55, 1.25, 0.12], [0.0, 1.2, 0.03]];
  for (const [x, y, r] of papers) {
    b.add(box(0.36, 0.44, 0.01), 'plaster', { p: [x, y, 0.06], r: [0, 0, r], c: '#fff8e0' });
    b.add(sphere(0.025, 6, 4), 'cloth', { p: [x, y + 0.18, 0.07], c: '#c83a2a' });
    for (let l = 0; l < 4; l++) b.add(box(0.24, 0.015, 0.012), 'cloth', { p: [x - Math.sin(r) * (0.1 - l * 0.07), y + 0.1 - l * 0.07, 0.068], r: [0, 0, r], c: '#5a4a3a' });
  }
  return { builder: b, collider: { r: 0.9 }, lanterns: [{ p: [1.25, 2.3, 0.15], len: 0.25, color: 'yellow' }] };
}

// ======================================================================
// FARMHOUSE + BARN
// ======================================================================
export function farmhouse(seed = 3) {
  const b = new Builder(seed);
  const w = 6, d = 4.6, wallH = 2.8;
  b.add(rbox(w + 0.4, 0.45, d + 0.4, 0.06), 'stoneDark', { p: [0, 0.12, 0], c: '#e8e0d0' });
  b.add(box(w, wallH, d), 'plaster', { p: [0, 0.35 + wallH / 2, 0], c: '#fff4e0' });
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, d / 2], [0, -d / 2]]) b.add(box(0.24, wallH + 0.1, 0.24), 'beam', { p: [x, 0.35 + wallH / 2, z], c: 0xffffff });
  for (const z of [-d / 2, d / 2]) b.add(box(w + 0.3, 0.22, 0.28), 'beam', { p: [0, 0.35 + wallH, z], c: 0xffffff });
  gable(b, w, d, 2.3, 'mossRoof', 0.35 + wallH, { over: 0.6, thick: 0.32 });
  // door and windows
  b.add(box(1.0, 2.0, 0.08), 'woodDark', { p: [1.2, 1.35, d / 2 + 0.03], c: 0xffffff, us: 1 });
  for (const x of [-1.6]) {
    b.add(box(0.8, 0.8, 0.06), 'glassWarm', { p: [x, 1.85, d / 2 + 0.03], c: 0xffffff });
    b.add(box(1.0, 0.1, 0.2), 'woodDark', { p: [x, 1.42, d / 2 + 0.1], c: 0xffffff });
    b.add(box(0.95, 0.2, 0.25), 'wood', { p: [x, 1.32, d / 2 + 0.2], c: '#c8a070' });
    addTuft(b, 'flowers', [x, 1.42, d / 2 + 0.2], 0.85, 0.35, 0, 0xffffff, 2);
  }
  b.add(box(0.8, 0.8, 0.06), 'glassWarm', { p: [w / 2 + 0.03, 1.85, 0], r: [0, PI / 2, 0], c: 0xffffff });
  const top = [-w / 2 + 0.8, 0.35 + wallH + 2.6, -d / 2 + 0.8];
  b.add(rbox(0.6, 3.2, 0.6, 0.05), 'stoneDark', { p: [top[0], 0.35 + wallH + 1.0, top[2]], c: '#e0d8c8' });
  // porch bench, barrels, sacks
  b.add(box(1.4, 0.1, 0.4), 'woodLight', { p: [-1.4, 0.75, d / 2 + 0.6], c: 0xffffff });
  for (let i = 0; i < 3; i++) b.add(lumpy(sphere(0.32, 10, 8), 0.04, 6, i), 'cloth', { p: [w / 2 + 0.6, 0.28 + (i === 2 ? 0.4 : 0), 1.2 + (i % 2) * 0.55], s: [1, 1.2, 0.9], c: '#d8c8a0', uv: 'box' });
  return { builder: b, colliders: [{ x: 0, z: 0, hw: w / 2 + 0.3, hd: d / 2 + 0.3 }], smokes: [{ p: top, opts: { rate: 1.5, size: 0.8 } }] };
}

export function barn(seed = 4) {
  const b = new Builder(seed);
  const w = 8, d = 10, wallH = 4.2;
  b.add(rbox(w + 0.4, 0.4, d + 0.4, 0.06), 'stoneDark', { p: [0, 0.1, 0], c: '#e0d8c8' });
  b.add(box(w, wallH, d), 'wood', { p: [0, 0.3 + wallH / 2, 0], c: '#d8604a', us: 0.8 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.3, wallH + 0.1, 0.3), 'beam', { p: [sx * w / 2, 0.3 + wallH / 2, sz * d / 2], c: '#f0e0d0' });
  b.add(box(w + 0.2, 0.2, d + 0.2), 'beam', { p: [0, 0.3 + wallH, 0], c: '#f0e0d0' });
  // tall gambrel-like roof as a steep gable
  const H = 3.6;
  const half = w / 2 + 0.5, slope = Math.hypot(half, H), ang = Math.atan2(H, half);
  for (const sx of [-1, 1]) b.add(box(slope, 0.22, d + 1.0), 'shingleWood', { p: [sx * half / 2, 0.3 + wallH + H / 2, 0], r: [0, 0, -sx * ang], c: 0xffffff });
  for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) {
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, H); s.closePath();
    b.add(new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }), 'wood', { p: [0, 0.3 + wallH, z - 0.1], c: '#d8604a', uv: 'box' });
  }
  // big double doors with white trim braces (one diagonal per leaf, both leaning the same way: RF.5, mirrored they met
  // in the middle as a big X)
  for (const sx of [-1, 1]) {
    b.add(box(1.6, 3.0, 0.1), 'wood', { p: [sx * 0.85, 1.8, d / 2 + 0.06], c: '#c8503a', us: 0.8 });
    b.add(box(1.7, 0.12, 0.12), 'plaster', { p: [sx * 0.85, 3.25, d / 2 + 0.12], c: '#fff8f0' });
    b.add(box(1.7, 0.12, 0.12), 'plaster', { p: [sx * 0.85, 0.35, d / 2 + 0.12], c: '#fff8f0' });
    b.add(box(0.12, 3.4, 0.12), 'plaster', { p: [sx * 0.85, 1.8, d / 2 + 0.12], r: [0, 0, 0.48], c: '#fff8f0' });
  }
  // hay loft with hay spilling out
  b.add(box(1.5, 1.3, 0.1), 'woodDark', { p: [0, 0.3 + wallH + 1.0, d / 2 + 0.08], c: '#3a2a1a' });
  b.add(lumpy(sphere(0.7, 12, 8), 0.1, 3, 5), 'mossRoof', { p: [0, 0.3 + wallH + 0.6, d / 2 + 0.2], s: [1.2, 0.6, 0.6], c: '#ffe8a0', uv: 'box' });
  // hay bales
  for (let i = 0; i < 7; i++) b.add(rbox(1.0, 0.55, 0.6, 0.08), 'mossRoof', { p: [w / 2 + 0.8 + (i % 2) * 0.1, 0.28 + Math.floor(i / 3) * 0.55, -2 + (i % 3) * 0.65], r: [0, b.r(-0.1, 0.1), 0], c: '#ffe8a0', uv: 'box', us: 0.8 });
  return { builder: b, colliders: [{ x: 0, z: 0, hw: w / 2 + 0.3, hd: d / 2 + 0.3 }, { x: w / 2 + 0.9, z: -1.4, hw: 0.6, hd: 1.2 }] };
}

// Golden wheat: dense rows of crossed cards over dark furrows.
export function wheatField(seed = 7, w = 10, d = 8) {
  const b = new Builder(seed);
  for (let z = -d / 2; z <= d / 2; z += 0.75) {
    b.add(box(w, 0.06, 0.55), 'dirtPlain', { p: [0, 0.0, z], c: '#7a5a34' });
    for (let x = -w / 2 + 0.3; x < w / 2; x += 0.42) {
      const h = b.r(0.95, 1.2), tint = b.r(0.85, 1.1);
      // (RF.5) two parallel cards along the row: random turns criss-crossed into a lattice of X's from above
      const ox = x + b.r(-0.1, 0.1), oz = z + b.r(-0.08, 0.08), ry = b.r(-0.06, 0.06);
      for (const dz of [-0.12, 0.12]) addTuft(b, 'wheat', [ox, 0, oz + dz], 0.85, h, ry, [tint, tint * 0.97, tint * 0.9], 1);
    }
  }
  return { builder: b };
}

export function hayBales(seed = 5) {
  const b = new Builder(seed);
  for (let i = 0; i < 5; i++) b.add(rbox(1.0, 0.55, 0.6, 0.08), 'mossRoof', { p: [(i % 3) * 1.05 - 1, 0.28 + (i >= 3 ? 0.55 : 0), (i >= 3 ? 0 : 0)], r: [0, b.r(-0.08, 0.08), 0], c: '#ffe8a0', uv: 'box', us: 0.8 });
  for (let k = 0; k < 3; k++) addTuft(b, 'grassCard', [b.r(-1.5, 1.5), 0, b.r(0.4, 0.9)], 0.6, 0.35, k, '#f0e090', 2);
  return { builder: b, collider: { r: 1.4 } };
}

export function trough(seed = 6) {
  const b = new Builder(seed);
  b.add(rbox(2.0, 0.6, 0.7, 0.05), 'woodDark', { p: [0, 0.4, 0], c: 0xffffff, us: 1 });
  b.add(box(1.85, 0.05, 0.55), 'glassWarm', { p: [0, 0.62, 0], c: '#2a5a6a' });
  for (const sx of [-0.8, 0.8]) b.add(box(0.12, 0.3, 0.75), 'beam', { p: [sx, 0.12, 0], c: 0xffffff });
  return { builder: b, collider: { r: 1.0 } };
}

// ======================================================================
// WOODLAND BITS
// ======================================================================
export function flowerBed(seed = 8, w = 3, d = 1.4) {
  const b = new Builder(seed);
  for (let i = 0; i < Math.round((w + d) * 2 / 0.4); i++) {
    const t = (i * 0.4) / ((w + d) * 2);
    const per = t * (w + d) * 2;
    let x, z;
    if (per < w) { x = -w / 2 + per; z = -d / 2; } else if (per < w + d) { x = w / 2; z = -d / 2 + per - w; } else if (per < 2 * w + d) { x = w / 2 - (per - w - d); z = d / 2; } else { x = -w / 2; z = d / 2 - (per - 2 * w - d); }
    b.add(rbox(0.38, 0.22, 0.3, 0.05), 'stoneLarge', { p: [x, 0.08, z], r: [0, b.r(0, 3), 0], c: '#f0e8dc' });
  }
  b.add(box(w - 0.2, 0.1, d - 0.2), 'dirtPlain', { p: [0, 0.06, 0], c: '#5a3a22' });
  const kinds = ['lavender', 'flowers', 'flowers', 'lavender'];
  for (let i = 0; i < Math.round(w * d * 2.2); i++) {
    const k = kinds[i % kinds.length];
    const p = [b.r(-w / 2 + 0.35, w / 2 - 0.35), 0.08, b.r(-d / 2 + 0.3, d / 2 - 0.3)];
    addTuft(b, k, p, 0.6, 0.5, b.r(0, 3), 0xffffff, 2);
  }
  return { builder: b, collider: { r: Math.max(w, d) * 0.4 } };
}

export function fallenLog(seed = 9) {
  const b = new Builder(seed);
  const L = b.r(3, 4.5), r0 = b.r(0.32, 0.45);
  const pts = [V3(-L / 2, r0 * 0.8, 0), V3(-L / 6, r0 * 0.85, b.r(-0.2, 0.2)), V3(L / 6, r0 * 0.8, b.r(-0.2, 0.2)), V3(L / 2, r0 * 0.75, 0)];
  b.add(tube(pts, (t) => r0 * (1 - t * 0.2), 10, 16, { capEnd: false }), 'bark', { uv: 'keep', c: (x, y, z, nx, ny) => { const m = sstep(0.4, 0.9, ny) * 0.8; return [1 - m * 0.15, 1 + m * 0.55, 1 - m * 0.45]; } });
  for (const [px, s] of [[-L / 2, 1], [L / 2, 0.8]]) b.add(cyl(r0 * s, r0 * s, 0.04, 14), 'woodLight', { p: [px, r0 * 0.8, 0], r: [0, 0, PI / 2], c: '#e8d0a8' });
  // shelf fungi and moss
  for (let i = 0; i < 4; i++) b.add(sphere(0.12, 10, 6, 0, PI * 2, 0, PI / 2), 'cloth', { p: [b.r(-L / 3, L / 3), r0 * 0.9, r0 * 0.85], r: [PI / 2 - 0.2, 0, 0], s: [1.2, 0.4, 1], c: '#e8a050' });
  addTuft(b, 'fern', [L / 2 + 0.4, 0, 0.5], 1.0, 0.6, 0.3);
  addTuft(b, 'grassCard', [-L / 2 - 0.2, 0, -0.4], 0.8, 0.5, 1.2);
  return { builder: b, collider: { r: 0.6 } };
}

export function stump(seed = 10) {
  const b = new Builder(seed);
  b.add(lathe([[0.62, 0], [0.5, 0.15], [0.45, 0.5], [0.45, 0.7], [0.001, 0.7]], 14), 'bark', { c: 0xffffff, uv: 'box' });
  b.add(cyl(0.44, 0.44, 0.02, 14), 'woodLight', { p: [0, 0.71, 0], c: '#f0d8b0' });
  // (RF.5) a plain cut top (growth rings drew rings round a disc from above) and three roots at uneven angles (four
  // roots at right angles drew a '+')
  for (const a of [0.4, 2.5, 4.3]) { b.add(tube([V3(Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4), V3(Math.cos(a) * 0.9, -0.15, Math.sin(a) * 0.9)], 0.1, 6, 3, { capEnd: false }), 'bark', { uv: 'keep', c: 0xffffff }); }
  return { builder: b, collider: { r: 0.6 } };
}

export function reeds(seed = 11) {
  const b = new Builder(seed);
  // (review) every clump faces nearly the same way: random facings let neighbouring clumps cross as X shapes from above
  const ry = b.r(0, 3);
  for (let i = 0; i < 9; i++) addTuft(b, 'reed', [b.r(-1, 1), 0, b.r(-0.8, 0.8)], 0.7, b.r(1.2, 1.8), ry + b.r(-0.2, 0.2), 0xffffff, 2);
  for (let i = 0; i < 6; i++) {
    const x = b.r(-0.9, 0.9), z = b.r(-0.7, 0.7), h = b.r(1.4, 1.9);
    b.add(cyl(0.012, 0.015, h, 4), 'leather', { p: [x, h / 2, z], c: '#6a8a3a', w: [0, 0.05, 0.02, 0] });
    b.add(cyl(0.04, 0.04, 0.22, 8), 'leather', { p: [x, h - 0.15, z], c: '#6a3a1a', w: [0, 0.05, 0.02, 0] });
  }
  return { builder: b };
}

export function lilyPads(seed = 12) {
  const b = new Builder(seed);
  for (let i = 0; i < 8; i++) {
    const r = b.r(0.25, 0.45);
    const g = new THREE.CircleGeometry(r, 14, 0.3, PI * 2 - 0.6);
    g.rotateX(-PI / 2);
    b.add(g, 'leather', { p: [b.r(-1.6, 1.6), 0.03, b.r(-1.6, 1.6)], r: [0, b.r(0, 6), 0], c: '#5a8a3a' });
    if (i % 3 === 0) { const x = b.r(-1.4, 1.4), z = b.r(-1.4, 1.4); for (let k = 0; k < 2; k++) b.add(sphere(0.07, 6, 4), 'cloth', { p: [x + k * 0.09, 0.08, z + k * 0.05], s: [1, 0.6, 1.2], c: '#ffd0e0' }); } // (RF.5) a plain bud pair, no six-petal ring
  }
  return { builder: b };
}

// ======================================================================
// DESERT
// ======================================================================
export function dryBush(seed = 13) {
  const b = new Builder(seed);
  for (let i = 0; i < 12; i++) {
    // (RF.5) twigs rise from their own scattered bases, mostly upright: twelve twigs from one centre drew a starburst
    const a = b.r(0, 6.28), L = b.r(0.5, 0.95), o = V3(b.r(-0.4, 0.4), 0, b.r(-0.4, 0.4)), k = b.r(0.15, 0.3);
    const p1 = o.clone().add(V3(Math.cos(a) * L * k * 0.5, L * 0.5, Math.sin(a) * L * k * 0.5)), p2 = o.clone().add(V3(Math.cos(a + b.r(-0.4, 0.4)) * L * k, L * b.r(0.7, 1.0), Math.sin(a) * L * k));
    b.add(tube([o, p1, p2], (t) => 0.03 * (1 - t) + 0.006, 4, 6), 'barkPalm', { uv: 'keep', c: '#b8a080', w: (x, y) => [0, 0.03 * y, 0, 0] });
  }
  addTuft(b, 'grassCard', [0, 0, 0], 0.9, 0.55, 0, '#e8d890', 3);
  return { builder: b };
}

export function barrelCactus(seed = 14) {
  const b = new Builder(seed);
  for (let i = 0; i < 3; i++) {
    const s = [1, 0.7, 0.55][i], x = [0, 0.55, -0.4][i], z = [0, 0.3, 0.45][i];
    const g = new THREE.SphereGeometry(0.4 * s, 16, 12);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const vx = p.getX(k), vy = p.getY(k), vz = p.getZ(k);
      const a = Math.atan2(vz, vx), rib = 1 + Math.cos(a * 12) * 0.06;
      p.setXYZ(k, vx * rib, vy * 1.25, vz * rib);
    }
    g.computeVertexNormals();
    b.add(g, 'leather', { p: [x, 0.42 * s, z], c: '#5a8a3a', paint: 0.3 });
    for (let f = 0; f < 5; f++) b.add(sphere(0.05 * s, 6, 4), 'cloth', { p: [x + Math.cos(f * 1.25) * 0.08 * s, 0.92 * s, z + Math.sin(f * 1.25) * 0.08 * s], c: f % 2 ? '#ff7aa0' : '#ffd060' });
  }
  // prickly pads
  for (let i = 0; i < 4; i++) b.add(sphere(0.28, 12, 8), 'leather', { p: [1.0 + (i % 2) * 0.2, 0.3 + i * 0.22, -0.4 + (i % 2) * 0.15], s: [1, 1.15, 0.28], r: [0, i * 0.5, (i % 2 ? -0.4 : 0.35)], c: '#6a9a40' });
  addRock(b, [-0.8, 0, -0.5], [0.35, 0.25, 0.3], seed, { mat: 'rockSand', moss: 0 });
  return { builder: b, collider: { r: 0.8 } };
}

export function sandPillar(seed = 15) {
  const b = new Builder(seed);
  const H = b.r(5, 8);
  let y = 0;
  const bands = ['#fff0d8', '#f0c890', '#ffe4c0', '#e8b880', '#fff0d8'];
  for (let i = 0; i < 5; i++) {
    const h = H / 5, r = lerp(1.6, 1.0, i / 5) * b.r(0.85, 1.1) * (i === 4 ? 1.3 : 1);
    const g = lumpy(cyl(r * 0.9, r, h, 14, 2), 0.15, 1.4, seed + i);
    b.add(g, 'rockSand', { p: [b.r(-0.1, 0.1), y + h / 2, b.r(-0.1, 0.1)], uv: 'box', us: 0.4, c: bands[i] });
    y += h * 0.95;
  }
  for (let i = 0; i < 6; i++) { const a = b.r(0, 6.28), d = b.r(1.4, 2.6); addRock(b, [Math.cos(a) * d, 0, Math.sin(a) * d], [b.r(0.3, 0.8), b.r(0.25, 0.6), b.r(0.3, 0.8)], seed + 20 + i, { mat: 'rockSand', moss: 0 }); }
  return { builder: b, collider: { r: 1.6 } };
}

// ======================================================================
// RAIDER CAMP
// ======================================================================
export function palisade(seed = 16, n = 7) {
  const b = new Builder(seed);
  for (let i = 0; i < n; i++) {
    const h = b.r(2.4, 3.0), x = (i - (n - 1) / 2) * 0.42;
    b.add(cyl(0.2, 0.22, h, 7), 'beam', { p: [x, h / 2 - 0.2, 0], r: [b.r(-0.05, 0.05), 0, b.r(-0.05, 0.05)], c: '#e8d8c0' });
    b.add(cone(0.2, 0.5, 7), 'beam', { p: [x, h - 0.2 + 0.25, 0], c: '#d8c8a8' });
  }
  for (const y of [0.6, 1.8]) b.add(box(n * 0.42, 0.06, 0.46), 'leather', { p: [0, y, 0], c: '#8a7050' });
  return { builder: b, collider: null };
}

export function weaponRack(seed = 17) {
  const b = new Builder(seed);
  for (const sx of [-1, 1]) b.add(box(0.12, 1.6, 0.12), 'beam', { p: [sx * 1.0, 0.8, 0], r: [0.15, 0, 0], c: 0xffffff });
  b.add(box(2.2, 0.1, 0.12), 'beam', { p: [0, 1.35, -0.1], c: 0xffffff });
  for (let i = 0; i < 5; i++) {
    const x = -0.8 + i * 0.4;
    b.add(cyl(0.025, 0.03, 2.0, 6), 'woodDark', { p: [x, 1.0, 0.12], r: [-0.2, 0, 0], c: 0xffffff });
    if (i % 2) b.add(cone(0.05, 0.25, 4), 'metal', { p: [x, 2.08, -0.08], r: [-0.2, 0, 0], c: 0xffffff });
    else b.add(box(0.28, 0.2, 0.03), 'iron', { p: [x + 0.1, 1.85, -0.03], r: [-0.2, 0, 0], c: 0xffffff });
  }
  return { builder: b, collider: { r: 1.0 } };
}

export function raiderBanner(seed = 18) {
  const b = new Builder(seed);
  // (RF.5) the pole stops at the hanging bar (a T): run on above the bar it drew a cross from the side
  b.add(cyl(0.06, 0.08, 4.04, 8), 'woodDark', { p: [0, 2.02, 0], c: 0xffffff });
  b.add(cyl(0.035, 0.035, 1.0, 6), 'woodDark', { p: [0, 4.0, 0], r: [0, 0, PI / 2], c: 0xffffff });
  const g = card(0.9, 1.8, 4, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < -0.6) p.setY(i, y + Math.sin(p.getX(i) * 9) * 0.12); }
  b.add(g, 'bannerRed', { p: [0, 3.05, 0.03], uv: 'keep', c: '#c8a8a0', w: (x, y) => [0, 0.02, 0, 0.14 * sstep(3.95, 2.2, y)] });
  // (review) the footing stones lie in a row under the bar: set round the pole they made a + with the bar from straight above
  for (let i = 0; i < 3; i++) b.add(rbox(0.35, 0.12, 0.35, 0.02), 'stoneDark', { p: [(i - 1) * 0.37, 0.06, 0], c: 0xffffff });
  return { builder: b, collider: { r: 0.4 } };
}

// ======================================================================
// FOUNDRY
// ======================================================================
export function scrapHeap(seed = 19) {
  const b = new Builder(seed);
  b.add(lumpy(sphere(1.6, 14, 10), 0.35, 1.2, seed, { flatBottom: 0 }), 'iron', { p: [0, 0, 0], s: [1.2, 0.55, 1], c: '#8a7a70', uv: 'box' });
  for (let i = 0; i < 6; i++) {
    const r0 = b.r(0.3, 0.7);
    b.add(gear(Math.max(24, Math.round(8 + r0 * 12)), r0, r0 * 1.2, 0.08, { hole: r0 * 0.2, spokes: 0 }), i % 2 ? 'copper' : 'brass', { p: [b.r(-1.2, 1.2), b.r(0.4, 0.9), b.r(-0.9, 0.9)], r: [b.r(-1, 1), b.r(0, 3), b.r(-1, 1)], c: '#c8a890' });
  }
  for (let i = 0; i < 5; i++) b.add(rbox(b.r(0.5, 1.0), 0.06, b.r(0.4, 0.8), 0.02), 'iron', { p: [b.r(-1.4, 1.4), b.r(0.3, 0.8), b.r(-1, 1)], r: [b.r(-0.8, 0.8), b.r(0, 3), b.r(-0.8, 0.8)], c: '#a89888' });
  for (let i = 0; i < 3; i++) b.add(cyl(0.12, 0.12, b.r(1.2, 2), 10), 'copper', { p: [b.r(-1, 1), b.r(0.4, 0.8), b.r(-0.8, 0.8)], r: [b.r(-1.4, 1.4), b.r(0, 3), b.r(-1.4, 1.4)], c: '#c89070' });
  return { builder: b, collider: { r: 1.8 } };
}

export function railTrack(seed = 20, len = 12) {
  const b = new Builder(seed);
  for (let z = -len / 2; z < len / 2; z += 0.7) b.add(box(1.6, 0.12, 0.25), 'beam', { p: [0, 0.04, z], r: [0, b.r(-0.04, 0.04), 0], c: '#a88a6a' });
  for (const sx of [-0.55, 0.55]) b.add(box(0.08, 0.12, len), 'iron', { p: [sx, 0.14, 0], c: 0xffffff });
  return { builder: b };
}

export function mineCart(seed = 21) {
  const b = new Builder(seed);
  const g = new THREE.BoxGeometry(1.1, 0.7, 1.5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 1.2); p.setZ(i, p.getZ(i) * 1.15); }
  g.computeVertexNormals();
  b.add(g, 'iron', { p: [0, 0.72, 0], c: '#8a8078' });
  for (const sy of [0.45, 1.0]) b.add(box(1.36, 0.06, 1.75), 'copper', { p: [0, sy, 0], c: 0xffffff });
  for (const sx of [-0.55, 0.55]) for (const sz of [-0.5, 0.5]) b.add(cyl(0.2, 0.2, 0.1, 12), 'iron', { p: [sx, 0.26, sz], r: [0, 0, PI / 2], c: 0xffffff });
  b.add(lumpy(sphere(0.65, 10, 8), 0.12, 3, seed, { flatBottom: 0 }), 'rock', { p: [0, 1.02, 0], s: [1, 0.45, 1.2], c: '#3a3634', uv: 'box' });
  return { builder: b, collider: { r: 0.9 } };
}

export function coalPile(seed = 22) {
  const b = new Builder(seed);
  b.add(lumpy(sphere(1.4, 14, 10), 0.3, 1.6, seed, { flatBottom: 0 }), 'rock', { s: [1.2, 0.6, 1], c: '#3a3634', uv: 'box' });
  for (let i = 0; i < 9; i++) b.add(sphere(0.06, 6, 4), 'fire', { p: [b.r(-1.2, 1.2), b.r(0.1, 0.6), b.r(-0.9, 0.9)], c: 0xffffff });
  return { builder: b, collider: { r: 1.5 }, smokes: [{ p: [0, 0.8, 0], opts: { rate: 1.2, size: 0.8, color: 0x4a4440, opacity: 0.35 } }], glows: [{ p: [0, 0.6, 0], color: 0xff6020, size: 2.4, intensity: 0.35 }] };
}
