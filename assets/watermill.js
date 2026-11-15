// Sunmere Mill: a breastshot waterwheel fed by a timber flume from the pool above the fall. The wheel turns in a
// stone wheel-pit against the mill house on the south-west bank; its axle runs through the wall to the millstones.
// The water reacts: it races along the flume, pours onto the paddles, sprays where it strikes, churns into a
// drifting foam below the wheel and drips from the paddles as they rise.
// Built in a local frame: origin under the wheel centre, +z downstream, the mill house on the -x side.
import * as THREE from 'three';
import { Builder, rbox, box, cyl, cone, sphere, torus, lathe, extrude, prism, arcShape } from './kit.js';
import { addRock, addTuft } from './trees.js';
import { roofZ } from './village.js';
import { fallRibbon } from './village2.js';
import { heightAt, streamInfo } from '/sunmere-play/shared/terrain.js';
import { puffTex, waterfallTex } from '../engine/textures.js';
import { G } from '../engine/globals.js';

const PI = Math.PI;
const newRes = () => ({ fires: [], glows: [], lanterns: [], smokes: [], colliders: [], dynamics: [] });

// water running along a flat channel (local strip from z0 to z1 at height y, width w)
function flowStrip(z0, z1, y, w) {
  const geo = new THREE.PlaneGeometry(w, z1 - z0, 2, 12);
  geo.rotateX(-PI / 2);
  geo.translate(0, y, (z0 + z1) / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (z1 - z0) * 0.35);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { tMap: { value: waterfallTex() }, uTime: G.time, uNight: G.night },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */ `
        uniform float uNight;
      uniform sampler2D tMap; uniform float uTime; varying vec2 vUv;
      void main() {
        vec4 a = texture2D(tMap, vec2(vUv.x, vUv.y + uTime * 1.6));
        vec4 b = texture2D(tMap, vec2(vUv.x * 1.4 + 0.3, vUv.y * 0.7 + uTime * 2.3));
        vec3 deep = vec3(0.16, 0.36, 0.42);
        vec3 col = mix(deep, mix(a.rgb, b.rgb, 0.5), 0.55);
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        gl_FragColor = vec4((col) * (1.0 - 0.8 * uNight), (0.6 + max(a.a, b.a) * 0.35) * (0.55 + 0.45 * edge));
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 3;
  return m;
}

// small particle field: sprites (spray, drips) or flat quads lying on the water (foam)
function particles({ max = 40, rate = 12, life = 1.2, size = 0.3, color = 0xeef8ff, opacity = 0.7, flat = false, spawn, gravity = 0, drag = 0 }) {
  const g = new THREE.Group();
  const tex = puffTex();
  const pool = [];
  const flatGeo = flat ? new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2) : null;
  for (let i = 0; i < max; i++) {
    let o;
    if (flat) o = new THREE.Mesh(flatGeo, new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity: 0 }));
    else o = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity: 0 }));
    o.visible = false;
    o.renderOrder = 4;
    g.add(o);
    pool.push({ o, age: 1e9, life, v: new THREE.Vector3(), s: size, spin: 0 });
  }
  let acc = 0;
  g.userData.update = (dt) => {
    acc += dt * rate;
    while (acc > 1) {
      acc -= 1;
      const p = pool.find((q) => q.age > q.life);
      if (!p) break;
      p.age = 0; p.life = life * (0.7 + Math.random() * 0.6); p.s = size * (0.7 + Math.random() * 0.6); p.spin = (Math.random() - 0.5) * 1.5;
      spawn(p.o.position, p.v);
      p.o.visible = true;
      if (flat) p.o.rotation.y = Math.random() * 6;
    }
    for (const p of pool) {
      if (p.age > p.life) continue;
      p.age += dt;
      const k = p.age / p.life;
      p.v.y -= gravity * dt;
      p.v.multiplyScalar(1 - drag * dt);
      p.o.position.addScaledVector(p.v, dt);
      if (flat) { p.o.scale.setScalar(p.s * (0.6 + k * 1.4)); p.o.rotation.y += p.spin * dt; }
      else p.o.scale.setScalar(p.s * (0.7 + k * 0.8));
      p.o.material.opacity = opacity * Math.min(1, k * 6) * (1 - k);
      if (p.age > p.life) p.o.visible = false;
    }
  };
  return g;
}

export function watermill(wx, wz, rotY) {
  const b = new Builder(91), res = newRes();
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const W = (lx, lz) => [wx + lx * c + lz * s, wz - lx * s + lz * c];
  const ground = (lx, lz) => heightAt(...W(lx, lz));
  const level = (lx, lz) => streamInfo(...W(lx, lz)).level;
  const lvlDown = level(0, 2), lvlUp = level(0, -10);
  const bed = lvlDown - 1.3;
  const R = 2.3, Wd = 1.3, axleY = lvlDown - 0.42 + R;

  // ---------------------------------------------------------------- the mill house (land side, -x)
  const hx0 = -1.25, hx1 = -7.45, hz = 3.6, hcx = (hx0 + hx1) / 2, hw = hx0 - hx1;
  let F = -1e9;
  for (const lx of [hx0 - 0.5, hcx, hx1]) for (const lz of [-hz, 0, hz]) F = Math.max(F, ground(lx, lz));
  F += 0.12;
  // plinth from the stream bed up to the floor: the wall the wheel turns against
  b.add(rbox(hw + 0.5, F - bed + 0.1, hz * 2 + 0.5, 0.06), 'stoneLarge', { p: [hcx, (F + bed) / 2, 0], uv: 'box', us: 0.34, c: '#c8c0b0' });
  b.add(rbox(hw + 0.7, 0.18, hz * 2 + 0.7, 0.04), 'stone', { p: [hcx, F + 0.02, 0], uv: 'box', c: '#e8e0d0' });
  // ground storey: dressed stone, quoins at the corners
  const H1 = 2.6, H2 = 2.3;
  b.add(box(hw, H1, hz * 2), 'stoneLarge', { p: [hcx, F + H1 / 2, 0], uv: 'box', us: 0.34, c: '#ddd4c2' });
  for (const sx of [hx0, hx1]) for (const sz of [-hz, hz]) for (let i = 0; i < 4; i++) {
    const lng = i % 2 === 0;
    b.add(rbox(lng ? 0.7 : 0.45, 0.6, lng ? 0.45 : 0.7, 0.03), 'stone', { p: [sx + (sx > hcx ? -1 : 1) * (lng ? 0.25 : 0.12) + (sx > hcx ? 0.03 : -0.03), F + 0.32 + i * 0.62, sz + (sz > 0 ? -1 : 1) * (lng ? 0.12 : 0.25) + (sz > 0 ? 0.03 : -0.03)], uv: 'box', c: '#f2ead8' });
  }
  // upper storey: plaster in a timber frame, jettied a little over the land side
  const y2 = F + H1;
  b.add(box(hw + 0.3, 0.22, hz * 2 + 0.3), 'beam', { p: [hcx - 0.15, y2 + 0.1, 0], c: 0xffffff });
  b.add(box(hw + 0.2, H2, hz * 2 + 0.1), 'plaster', { p: [hcx - 0.2, y2 + 0.2 + H2 / 2, 0], uv: 'box', c: '#f0e4c8' });
  const top = y2 + 0.2 + H2;
  for (const sx of [hx0 + 0.05, hx1 - 0.45]) for (const sz of [-hz - 0.05, hz + 0.05]) b.add(box(0.22, H2 + 0.1, 0.22), 'beam', { p: [sx, y2 + 0.2 + H2 / 2, sz], c: 0xffffff });
  for (const sz of [-hz - 0.05, hz + 0.05]) b.add(box(hw + 0.5, 0.2, 0.24), 'beam', { p: [hcx - 0.2, top, sz], c: 0xffffff });
  for (const sx of [hx0 + 0.05, hx1 - 0.45]) b.add(box(0.24, 0.2, hz * 2 + 0.5), 'beam', { p: [sx, top, 0], c: 0xffffff });
  // studs and single-direction braces on the long walls (never crossing)
  for (const sx of [hx0 + 0.07, hx1 - 0.47]) {
    for (const lz of [-1.8, 1.8]) b.add(box(0.14, H2, 0.16), 'beam', { p: [sx, y2 + 0.2 + H2 / 2, lz], c: 0xffffff });
    for (const [lz, a] of [[-2.7, 0.55], [2.7, -0.55]]) b.add(box(0.12, 2.4, 0.13), 'beam', { p: [sx, y2 + 0.2 + H2 / 2, lz], r: [a, 0, 0], c: 0xffffff });
  }
  // roof: ridge along z (parallel to the stream), shingles, plaster gables with a loft hatch
  const rise = 2.7;
  roofZ(b, hcx - 0.2, 0, hw + 0.4, hz * 2 + 0.2, rise, top + 0.08, { mat: 'shingleWood', over: 0.6, ridge: 'beam' });
  for (const sz of [-1, 1]) {
    b.add(prism(hw + 0.3, rise, 0.24), 'plaster', { p: [hcx - 0.2, top + 0.1, sz * (hz + 0.02)], uv: 'box', c: '#f0e4c8' });
    b.add(box(0.8, 0.9, 0.06), 'woodDark', { p: [hcx - 0.2, top + 0.85, sz * (hz + 0.16)], c: '#c8a070' });
    b.add(box(0.06, 0.9, 0.08), 'beam', { p: [hcx - 0.2, top + 0.85, sz * (hz + 0.2)], c: 0xffffff });
  }
  // door on the land side (faces -x), with steps down to the path
  const dz = 1.1;
  b.add(extrude(arcShape(1.3, 2.3, 0.65), 0.1, 0.01, 12), 'woodDark', { p: [hx1 - 0.03, F, dz], r: [0, -PI / 2, 0], boxuv: true, c: '#e8d0b0' });
  b.add(extrude(arcShape(1.6, 2.5, 0.8), 0.14, 0.02, 12), 'stone', { p: [hx1 + 0.02, F - 0.05, dz], r: [0, -PI / 2, 0], boxuv: true, c: '#f0e8d8' });
  b.add(torus(0.07, 0.015, 6, 12), 'iron', { p: [hx1 - 0.12, F + 1.15, dz - 0.35], r: [0, PI / 2, 0], c: 0xffffff });
  const gd = ground(hx1 - 1.2, dz);
  for (let i = 0, n = Math.max(1, Math.ceil((F - gd) / 0.2)); i < n; i++) b.add(rbox(0.5, 0.2, 1.8, 0.03), 'stoneLarge', { p: [hx1 - 0.3 - i * 0.42, F - 0.1 - i * ((F - gd) / n), dz], uv: 'box', c: '#e0d8c8' });
  // windows: small ones in the stone, larger in the plaster; one vertical mullion each
  const win = (x, y, z, rot, w, h) => {
    const fx = Math.sin(rot), fz = Math.cos(rot);
    b.add(box(w, h, 0.06), 'glassWarm', { p: [x + fx * 0.02, y, z + fz * 0.02], r: [0, rot, 0], c: 0xffffff });
    b.add(box(w + 0.2, 0.1, 0.16), 'woodDark', { p: [x + fx * 0.06, y + h / 2 + 0.05, z + fz * 0.06], r: [0, rot, 0], c: 0xffffff });
    b.add(box(w + 0.24, 0.1, 0.22), 'stone', { p: [x + fx * 0.08, y - h / 2 - 0.05, z + fz * 0.08], r: [0, rot, 0], c: '#f0e8d8' });
    b.add(box(0.06, h, 0.08), 'woodDark', { p: [x + fx * 0.06, y, z + fz * 0.06], r: [0, rot, 0], c: 0xffffff });
    for (const sd of [-1, 1]) b.add(box(w / 2, h + 0.05, 0.05), 'wood', { p: [x + fx * 0.1 + Math.cos(rot) * sd * (w * 0.75 + 0.05), y, z + fz * 0.1 - Math.sin(rot) * sd * (w * 0.75 + 0.05)], r: [0, rot + sd * 0.35, 0], uv: 'box', c: '#7a9a58' });
  };
  win(hx1 - 0.05, F + 1.5, -1.6, -PI / 2, 0.6, 0.7);
  win(hx1 - 0.3, y2 + 1.4, -1.4, -PI / 2, 0.8, 0.9);
  win(hx1 - 0.3, y2 + 1.4, 1.6, -PI / 2, 0.8, 0.9);
  win(hx0 + 0.06, y2 + 1.4, -2.2, PI / 2, 0.7, 0.8);
  for (const sz of [-1, 1]) win(hcx, F + 1.5, sz * (hz + 0.02), sz > 0 ? 0 : PI, 0.6, 0.7);
  // hoist: a beam out over the loft door on the land side, rope and a sack hanging from it
  b.add(box(0.9, 1.0, 0.06), 'woodDark', { p: [hx1 - 0.32, y2 + 1.2, dz + 0.1], r: [0, -PI / 2, 0], uv: 'box', c: '#c8a070' });
  b.add(box(1.4, 0.18, 0.18), 'beam', { p: [hx1 - 0.95, top - 0.1, dz + 0.1], c: 0xffffff });
  b.add(cyl(0.015, 0.015, 1.5, 5), 'leather', { p: [hx1 - 1.5, top - 0.85, dz + 0.1], c: '#c8b890' });
  b.add(lathe([[0.001, 0], [0.18, 0.02], [0.24, 0.2], [0.22, 0.45], [0.12, 0.6], [0.04, 0.66], [0.001, 0.66]], 10), 'cloth', { p: [hx1 - 1.5, top - 2.25, dz + 0.1], s: [1, 1, 0.8], c: '#e8dcc0' });
  // the axle bearing in the stream wall: an iron plate in a timber frame
  b.add(rbox(0.12, 1.1, 1.1, 0.03), 'iron', { p: [hx0 + 0.04, axleY, 0], c: '#5a5e66' });
  b.add(rbox(0.1, 1.4, 0.18, 0.02), 'beam', { p: [hx0 + 0.06, axleY, -0.65], c: 0xffffff });
  b.add(rbox(0.1, 1.4, 0.18, 0.02), 'beam', { p: [hx0 + 0.06, axleY, 0.65], c: 0xffffff });
  for (const [a, rr] of [[0, 0.4], [2.1, 0.4], [4.2, 0.4]]) b.add(sphere(0.04, 6, 4), 'iron', { p: [hx0 + 0.12, axleY + Math.cos(a) * rr, Math.sin(a) * rr], c: '#8a8e96' });
  // a lantern on a bracket by the door
  b.add(box(0.6, 0.06, 0.06), 'iron', { p: [hx1 - 0.3, F + 2.55, dz - 1.15], c: 0xffffff });
  res.lanterns.push({ p: [hx1 - 0.55, F + 2.52, dz - 1.15], len: 0.3, color: 'yellow', scale: 0.9 });
  // sacks of flour, a leaning millstone, barrels and a bench by the door
  for (let i = 0; i < 6; i++) {
    const x = hx1 - 1.4 - (i % 3) * 0.5, z = -1.6 - Math.floor(i / 3) * 0.55, y = ground(x, z) + (i > 2 ? 0.0 : 0);
    b.add(lathe([[0.001, 0], [0.2, 0.02], [0.26, 0.2], [0.24, 0.42], [0.14, 0.56], [0.001, 0.6]], 10), 'cloth', { p: [x, y, z], r: [i > 2 ? 0.25 : 0, i, 0], s: [1, 0.9, 0.85], c: i % 2 ? '#efe4c8' : '#e2d4b0' });
  }
  { const x = hx1 - 0.35, z = 2.9, y = ground(x - 0.3, z);
    const ms = lathe([[0.18, -0.16], [0.82, -0.16], [0.86, -0.1], [0.86, 0.1], [0.82, 0.16], [0.18, 0.16], [0.18, -0.16]], 28);
    b.add(ms, 'stoneLarge', { p: [x - 0.35, y + 0.8, z], r: [0, 0, PI / 2 - 0.22], uv: 'box', c: '#d8d0c0' }); }
  for (const [x, z] of [[hx1 - 0.6, -2.9], [hx1 - 1.2, -3.2]]) b.add(lathe([[0.001, 0], [0.3, 0], [0.34, 0.3], [0.33, 0.62], [0.3, 0.8], [0.001, 0.8]], 14), 'wood', { p: [x, ground(x, z), z], uv: 'box', us: 1.4, c: 0xffffff });
  { const x = hx1 - 0.7, z = dz + 1.6, y = ground(x, z);
    b.add(box(0.4, 0.06, 1.6), 'wood', { p: [x, y + 0.45, z], uv: 'box', c: '#b08858' });
    for (const zz of [-0.6, 0.6]) b.add(box(0.36, 0.45, 0.08), 'woodDark', { p: [x, y + 0.22, z + zz], c: 0xffffff }); }
  for (const [x, z, k] of [[hx1 - 0.6, -3.9, 'lavender'], [hx1 - 2.0, 3.6, 'flowers'], [hcx, -hz - 0.7, 'flowers']]) addTuft(b, k, [x, ground(x, z), z], 0.9, 0.6, 0, 0xffffff, 3);
  res.colliders.push({ x: hcx - 0.15, z: 0, hw: hw / 2 + 0.25, hd: hz + 0.25 });

  // ---------------------------------------------------------------- outer pier and the axle
  const px = Wd / 2 + 0.55;
  b.add(rbox(0.75, axleY - 0.25 - bed, 1.5, 0.05), 'stoneLarge', { p: [px, (axleY - 0.25 + bed) / 2, 0], uv: 'box', us: 0.34, c: '#c8c0b0' });
  b.add(rbox(0.95, 0.14, 1.7, 0.03), 'stone', { p: [px, axleY - 0.25, 0], uv: 'box', c: '#f0e8d8' });
  b.add(rbox(0.5, 0.36, 0.6, 0.04), 'iron', { p: [px, axleY - 0.04, 0], c: '#505860' });
  for (const z of [-0.2, 0.2]) b.add(cyl(0.03, 0.03, 0.42, 6), 'iron', { p: [px, axleY, z], c: '#8a8e96' });
  b.add(cyl(0.13, 0.13, px - hx0 + 0.3, 12), 'iron', { p: [(px + hx0) / 2, axleY, 0], r: [0, 0, PI / 2], c: '#6a6e76' });
  addRock(b, [px + 0.5, lvlDown - 0.2, 1.0], [0.6, 0.5, 0.5], 931, { moss: 0.6 });
  addRock(b, [px + 0.4, lvlDown - 0.3, -1.2], [0.5, 0.45, 0.5], 932, { moss: 0.6 });
  res.colliders.push({ x: 0.2, z: 0, hw: Wd / 2 + 0.9, hd: R + 0.2 });

  // ---------------------------------------------------------------- the wheel (spins on the axle)
  const wb = new Builder(92);
  const nSeg = 24, rimR = R - 0.12;
  for (const sx of [-1, 1]) {
    const x = sx * (Wd / 2 - 0.07);
    for (let i = 0; i < nSeg; i++) {
      const a = (i + 0.5) / nSeg * PI * 2, seg = 2 * rimR * Math.sin(PI / nSeg) + 0.03;
      wb.add(box(0.12, 0.24, seg), 'wood', { p: [x, Math.cos(a) * rimR, Math.sin(a) * rimR], r: [a, 0, 0], uv: 'box', c: '#a07848' });
    }
    wb.add(torus(R, 0.028, 6, 48), 'iron', { p: [x + sx * 0.07, 0, 0], r: [0, PI / 2, 0], c: '#7a7e86' });
    // a solid boarded face inside the rim (no spokes)
    wb.add(cyl(rimR - 0.1, rimR - 0.1, 0.08, 32), 'woodDark', { p: [x, 0, 0], r: [0, 0, PI / 2], uv: 'box', c: '#8a6038' });
  }
  // paddles (radial boards) and the sole boards behind them
  const nP = 18;
  for (let i = 0; i < nP; i++) {
    const a = (i / nP) * PI * 2, rp = R - 0.32;
    wb.add(box(Wd - 0.16, 0.56, 0.06), 'wood', { p: [0, Math.cos(a) * rp, Math.sin(a) * rp], r: [a, 0, 0], uv: 'box', c: '#b08858' });
    const am = a + PI / nP, rs = R - 0.6, chord = 2 * rs * Math.sin(PI / nP) + 0.02;
    wb.add(box(Wd - 0.18, 0.05, chord), 'woodDark', { p: [0, Math.cos(am) * rs, Math.sin(am) * rs], r: [am, 0, 0], uv: 'box', c: '#7a5432' });
  }
  wb.add(cyl(0.38, 0.38, Wd + 0.2, 16), 'woodDark', { r: [0, 0, PI / 2], uv: 'box', c: '#6a4a2a' });
  for (const sx of [-1, 1]) {
    wb.add(rbox(0.1, 0.6, 0.6, 0.04), 'iron', { p: [sx * (Wd / 2 + 0.06), 0, 0], c: '#5a5e66' }); // square axle plate (no round hub ringed by bolts)
  }
  const wheel = wb.build();
  const pivot = new THREE.Group();
  pivot.position.set(0, axleY, 0);
  pivot.add(wheel);
  pivot.userData.update = (dt) => { pivot.rotation.x -= dt * 0.62; };
  res.dynamics.push(pivot);

  // ---------------------------------------------------------------- the flume from the upper pool
  const fy = Math.min(lvlUp - 0.1, axleY - 0.6), z0 = -10.5, z1 = -Math.sqrt(R * R - (axleY - fy) ** 2) - 0.1;
  const L = z1 - z0, zc = (z0 + z1) / 2;
  b.add(box(1.2, 0.08, L), 'woodLight', { p: [0, fy - 0.28, zc], uv: 'box', c: '#b89068' });
  for (const sx of [-1, 1]) b.add(box(0.08, 0.5, L), 'woodLight', { p: [sx * 0.6, fy - 0.06, zc], uv: 'box', c: '#a88058' });
  for (let z = z0 + 0.3; z < z1; z += 1.3) {
    b.add(box(1.4, 0.1, 0.12), 'beam', { p: [0, fy - 0.36, z], c: 0xffffff });
    for (const sx of [-1, 1]) b.add(box(0.1, 0.62, 0.12), 'beam', { p: [sx * 0.68, fy - 0.08, z], c: 0xffffff });
  }
  for (let z = z0 + 0.8; z < z1 - 0.4; z += 2.6) for (const sx of [-1, 1]) {
    const g0 = Math.min(ground(sx * 0.6, z), lvlUp - 0.6) - 0.3, h = fy - 0.4 - g0;
    b.add(box(0.14, h, 0.14), 'beam', { p: [sx * 0.6, g0 + h / 2, z], c: 0xffffff });
  }
  // sluice gate at the intake, raised a hand's width, with its winding wheel
  for (const sx of [-1, 1]) b.add(box(0.14, 1.5, 0.14), 'beam', { p: [sx * 0.7, fy + 0.3, z0 + 0.2], c: 0xffffff });
  b.add(box(1.6, 0.14, 0.16), 'beam', { p: [0, fy + 1.0, z0 + 0.2], c: 0xffffff });
  b.add(box(1.15, 0.5, 0.06), 'woodDark', { p: [0, fy + 0.2, z0 + 0.2], uv: 'box', c: '#8a6038' });
  b.add(cyl(0.03, 0.03, 0.55, 6), 'iron', { p: [0, fy + 0.72, z0 + 0.2], c: 0xffffff });
  b.add(cyl(0.22, 0.22, 0.04, 18), 'iron', { p: [0, fy + 1.2, z0 + 0.2], c: '#6a6e76' }); // a solid winding wheel (a rim with five spokes read as a star in a ring from above)
  b.add(box(0.04, 0.12, 0.04), 'iron', { p: [0.15, fy + 1.28, z0 + 0.2], c: '#4a4e56' }); // one off-centre crank handle
  addRock(b, [-1.2, lvlUp - 0.3, z0 + 0.4], [0.8, 0.6, 0.7], 933, { moss: 0.7 });
  addRock(b, [1.3, lvlUp - 0.35, z0 + 0.8], [0.7, 0.5, 0.6], 934, { moss: 0.7 });
  res.colliders.push({ x: 0, z: zc, hw: 0.75, hd: L / 2 });
  res.dynamics.push(flowStrip(z0 + 0.3, z1, fy - 0.08, 1.05));
  // the pour onto the paddles
  const pourTop = new THREE.Vector3(0, fy - 0.08, z1), pourBot = new THREE.Vector3(0, fy - 0.85, z1 + 0.55);
  res.dynamics.push(fallRibbon(pourTop, pourBot, 1.0, new THREE.Vector3(0, 0, 1)));

  // ---------------------------------------------------------------- how the water reacts
  // spray where the pour strikes the paddles
  res.dynamics.push(particles({ max: 36, rate: 22, life: 0.7, size: 0.38, opacity: 0.75, gravity: 6, spawn: (p, v) => { p.set((Math.random() - 0.5) * 1.0, fy - 0.8, z1 + 0.5 + Math.random() * 0.3); v.set((Math.random() - 0.5) * 1.6, 1.2 + Math.random() * 1.6, -0.4 + Math.random() * 1.6); } }));
  // churn and splash where the paddles plunge in and drive the water downstream
  res.dynamics.push(particles({ max: 40, rate: 26, life: 0.8, size: 0.45, opacity: 0.6, gravity: 5, spawn: (p, v) => { p.set((Math.random() - 0.5) * 1.2, lvlDown + 0.05, -0.6 + Math.random() * 1.8); v.set((Math.random() - 0.5) * 1.2, 1.0 + Math.random() * 1.4, 0.6 + Math.random() * 1.4); } }));
  // drips falling from the rising paddles on the downstream side
  res.dynamics.push(particles({ max: 30, rate: 16, life: 0.9, size: 0.12, color: 0xdff4ff, opacity: 0.9, gravity: 9.8, spawn: (p, v) => { const a = PI * (0.08 + Math.random() * 0.4); p.set((Math.random() - 0.5) * (Wd - 0.2), axleY - Math.cos(a) * (R - 0.05), Math.sin(a) * (R - 0.05)); v.set(0, 0.2, 0.3); } }));
  // foam riding the current away from the wheel
  res.dynamics.push(particles({ max: 60, rate: 16, life: 4.5, size: 0.8, flat: true, opacity: 0.55, color: 0xf4fbff, drag: 0.15, spawn: (p, v) => { p.set((Math.random() - 0.5) * 1.6, lvlDown + 0.03, 0.4 + Math.random() * 1.2); v.set((Math.random() - 0.5) * 0.5, 0, 0.9 + Math.random() * 0.6); } }));
  // a low mist hanging over the wheel pit
  res.smokes.push({ p: [0, lvlDown + 0.15, 0.2], opts: { rate: 2, life: 1.4, size: 0.5, rise: 0.3, color: 0xeaf6f6, opacity: 0.12, spread: 0.5 } });

  res.builder = b;
  res.floor = F;
  res.door = W(hx1 - 1.6, dz);
  return res;
}
