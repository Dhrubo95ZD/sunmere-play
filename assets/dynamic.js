// Animated props: glow halos, swinging hanging lanterns, flames, smoke. Each returns an Object3D
// with userData.update(dt, t) which the owner calls every frame.
import * as THREE from 'three';
import { Builder, cyl, cone, torus, box, lathe, sphere, rgb } from './kit.js';
import { glowTex, flameTex, puffTex } from '../engine/textures.js';
import { G, QUALITY } from '../engine/globals.js';
import { GlowPoint } from './glowfield.js';
import { walkOnDemand, skipWhenHidden } from '../game/freeze.js';

const LANTERN_COLORS = {
  yellow: { mat: 'glowYellow', light: 0xffc24a },
  green: { mat: 'glowGreen', light: 0x9ae84a },
  purple: { mat: 'glowPurple', light: 0xb070ff },
  teal: { mat: 'glowTeal', light: 0x40e0d0 },
};

// Glow halos are drawn by the scene's glow field (glowfield.js: one instanced draw for all of them); the returned
// GlowPoint keeps the old sprite's API. window.SUNMERE_GLOW_SPRITES = 1 (set before load) or sessionStorage
// 'sunmere:glowsprites' = 1 brings back real sprites (A/B checks).
const GLOW_SPRITES = (() => { try { return typeof window !== 'undefined' && !!(window.SUNMERE_GLOW_SPRITES || sessionStorage.getItem('sunmere:glowsprites') === '1'); } catch { return false; } })();
export function glowSprite(color = 0xffc860, size = 1.5, intensity = 0.8) {
  if (!GLOW_SPRITES) return new GlowPoint(color, size, intensity);
  const m = new THREE.SpriteMaterial({ map: glowTex(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: intensity, fog: true });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  s.renderOrder = 10;
  const base = intensity, ph = Math.random() * 10;
  s.userData.update = (dt, t) => { m.opacity = base * (0.88 + 0.08 * Math.sin(t * 3.1 + ph) + 0.04 * Math.sin(t * 7.7 + ph)) * (1 + 0.9 * G.night.value); };
  s.userData.glow = { color, size };
  return s;
}

// Lantern body (hexagonal brass cage with glowing glass), origin at the hanging ring.
export function lanternBuilder(color = 'yellow', s = 1, b = new Builder(3), o = [0, 0, 0]) {
  const lc = LANTERN_COLORS[color] || LANTERN_COLORS.yellow;
  const at = (x, y, z) => [o[0] + x * s, o[1] + y * s, o[2] + z * s];
  const gold = { c: 0xffffff };
  b.add(torus(0.05 * s, 0.014 * s, 6, 14), 'gold', { p: at(0, -0.05, 0), r: [0, Math.PI / 2, 0], ...gold });
  // top cap: hexagonal pyramid with a collar
  b.add(cone(0.17 * s, 0.14 * s, 6), 'gold', { p: at(0, -0.16, 0), flat: true, ...gold });
  b.add(cyl(0.18 * s, 0.18 * s, 0.035 * s, 6), 'gold', { p: at(0, -0.245, 0), flat: true, ...gold });
  // glass core
  b.add(cyl(0.12 * s, 0.12 * s, 0.3 * s, 6), lc.mat, { p: at(0, -0.42, 0), flat: true, c: 0xffffff });
  // bars
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add(box(0.025 * s, 0.32 * s, 0.025 * s), 'gold', { p: at(Math.cos(a) * 0.145, -0.42, Math.sin(a) * 0.145), r: [0, -a, 0], ...gold });
  }
  // (no band round the middle of the glass: with the upright bars it drew a + on every pane; content rule)
  // bottom cap + finial
  b.add(cyl(0.17 * s, 0.13 * s, 0.04 * s, 6), 'gold', { p: at(0, -0.595, 0), flat: true, ...gold });
  b.add(cone(0.1 * s, 0.12 * s, 6), 'gold', { p: at(0, -0.675, 0), r: [Math.PI, 0, 0], flat: true, ...gold });
  b.add(sphere(0.03 * s, 8, 6), 'gold', { p: at(0, -0.75, 0), ...gold });
  return b;
}

// v116: where the player is (world.js sets it every frame): lanterns swing only within SWING_R metres of it
export const swingFocus = new THREE.Vector3(1e9, 0, 1e9);
const SWING_R = QUALITY.mobile ? 16 : 28;

// Hanging lantern on a chain that swings with the wind. Origin = hook point.
export function hangingLantern(color = 'yellow', len = 0.9, s = 1) {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const b = new Builder(7);
  // chain links
  const links = Math.max(2, Math.round(len / 0.07));
  for (let i = 0; i < links; i++) {
    b.add(torus(0.03 * s, 0.008 * s, 4, 8), 'iron', { p: [0, -i * (len / links) - 0.03, 0], r: [0, i % 2 ? Math.PI / 2 : 0, Math.PI / 2], c: 0xffffff });
  }
  lanternBuilder(color, s, b, [0, -len, 0]);
  const body = b.build();
  pivot.add(body);
  const lc = LANTERN_COLORS[color] || LANTERN_COLORS.yellow;
  const glow = glowSprite(lc.light, 1.6 * s, 0.75);
  glow.position.set(0, -len - 0.42 * s, 0);
  pivot.add(glow);
  const ph = Math.random() * 10;
  let ax = 0, az = 0, vx = 0, vz = 0, still = true; // (built at rest: still until its owner first steps it near the player)
  // v116: a lantern swings only within SWING_R of the player (swingFocus, set by world.js each frame). Past SWING_R + 4 m it
  // eases to rest over ~2 s and then stands still: userData.shadowStill tells the static shadow cache (engine/shadowCache.js
  // 'W' switches) to draw it into the cached map while it is still, and to draw it as a dynamic caster again the moment it
  // swings. A still step returns false, so the walk on demand skips its matrices (freeze.js walkOnDemand).
  root.userData.shadowSwitch = true;
  root.userData.shadowStill = true;
  root.userData.update = (dt, t) => {
    const e = root.matrixWorld.elements, dx = e[12] - swingFocus.x, dz = e[14] - swingFocus.z, d2 = dx * dx + dz * dz;
    if (still) {
      if (d2 > SWING_R * SWING_R) return false;
      still = false; root.userData.shadowStill = false;
    }
    if (d2 > (SWING_R + 4) * (SWING_R + 4)) { // settling: no wind push, the swing dies away, then it stands still
      const k = Math.exp(-dt * 2.5);
      ax *= k; az *= k; vx = 0; vz = 0;
      if (Math.abs(ax) < 0.003 && Math.abs(az) < 0.003) { ax = az = 0; still = true; root.userData.shadowStill = true; }
      pivot.rotation.set(ax, 0, az);
      return true;
    }
    // damped pendulum driven by wind gusts
    const w = G.windStrength.value;
    const wd = G.windDir.value;
    const gust = 0.55 + 0.45 * Math.sin(t * 0.42 + ph * 0.3);
    const fx = wd.y * 0.18 * w * gust + Math.sin(t * 1.3 + ph) * 0.05 * w;
    const fz = -wd.x * 0.18 * w * gust + Math.sin(t * 1.1 + ph * 1.7) * 0.05 * w;
    const k = 9.8 / Math.max(0.3, len);
    vx += (fx - ax) * k * dt - vx * 1.2 * dt;
    vz += (fz - az) * k * dt - vz * 1.2 * dt;
    ax += vx * dt; az += vz * dt;
    pivot.rotation.set(ax, 0, az);
    glow.userData.update(dt, t);
    return true;
  };
  return walkOnDemand(root); // the scene walk only redoes it after a swing step (owners update lanterns near the player)
}

// Flickering fire: layered flame sprites + embers + light.
export function fire(scale = 1, { light = true } = {}) {
  const g = new THREE.Group();
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.SpriteMaterial({ map: flameTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffffff });
    const s = new THREE.Sprite(m);
    s.center.set(0.5, 0.05);
    g.add(s);
    flames.push({ s, ph: Math.random() * 10, ox: (Math.random() - 0.5) * 0.25 * scale, oz: (Math.random() - 0.5) * 0.25 * scale, k: 0.6 + Math.random() * 0.6 });
  }
  const halo = glowSprite(0xff8a30, 3.2 * scale, 0.55);
  halo.position.y = 0.4 * scale;
  g.add(halo);
  // the world's pooled point lights pick up fires near the camera (see World.updateLights)
  if (light) g.userData.lightSpot = { color: 0xff9a40, k: scale, y: 0.6 * scale };
  g.userData.update = (dt, t) => {
    for (const f of flames) {
      const h = scale * f.k * (0.9 + 0.25 * Math.sin(t * 9 + f.ph) + 0.15 * Math.sin(t * 17 + f.ph * 2));
      f.s.scale.set(h * 0.55, h, 1);
      f.s.position.set(f.ox + Math.sin(t * 5 + f.ph) * 0.03, 0, f.oz);
    }
    halo.userData.update(dt, t);
  };
  return walkOnDemand(g);
}

// Rising smoke column (chimneys, campfires, machine stacks).
export function smoke({ rate = 3, life = 4, size = 0.9, rise = 1.2, color = 0xcfc8c0, opacity = 0.45, spread = 0.25 } = {}) {
  const g = new THREE.Group();
  const pool = [];
  const max = Math.ceil(rate * life) + 2;
  for (let i = 0; i < max; i++) {
    const m = new THREE.SpriteMaterial({ map: puffTex(), color, depthWrite: false, transparent: true, opacity: 0 });
    const s = skipWhenHidden(new THREE.Sprite(m));
    s.visible = false;
    g.add(s);
    pool.push({ s, age: life + 1, vx: 0, vz: 0, rot: 0 });
  }
  let acc = 0;
  const base = new THREE.Color(color);
  g.userData.update = (dt) => {
    const nk = 1 - 0.65 * G.night.value;
    acc += dt * (g.userData.rate ?? rate);
    while (acc > 1) {
      acc -= 1;
      const p = pool.find((q) => q.age > life);
      if (p) { p.age = 0; p.vx = (Math.random() - 0.5) * spread; p.vz = (Math.random() - 0.5) * spread; p.s.position.set(0, 0, 0); p.s.visible = true; p.s.material.rotation = Math.random() * 6; p.rot = (Math.random() - 0.5) * 0.6; }
    }
    const wd = G.windDir.value, w = G.windStrength.value;
    for (const p of pool) {
      if (p.age > life) continue;
      p.age += dt;
      const k = p.age / life;
      p.s.position.x += (p.vx + wd.x * 0.5 * w * k) * dt;
      p.s.position.z += (p.vz + wd.y * 0.5 * w * k) * dt;
      p.s.position.y += rise * (1 - k * 0.5) * dt;
      p.s.material.rotation += p.rot * dt;
      p.s.scale.setScalar(size * (0.4 + k * 1.6));
      p.s.material.opacity = opacity * Math.min(1, k * 5) * (1 - k);
      p.s.material.color.copy(base).multiplyScalar(nk);
      if (p.age > life) p.s.visible = false;
    }
  };
  return walkOnDemand(g);
}

// Build a tree/prop asset result ({builder, lanterns, glows, ...}) into a ready Object3D.
export function assemble(res, { shadow = true } = {}) {
  const g = res.builder.build({ shadow });
  const dyn = [];
  for (const l of res.lanterns || []) {
    const h = hangingLantern(l.color, l.len, l.scale || 1);
    h.position.fromArray(l.p);
    g.add(h); dyn.push(h);
  }
  for (const gl of res.glows || []) {
    const s = glowSprite(gl.color, gl.size, gl.intensity ?? 0.6);
    s.position.fromArray(gl.p);
    g.add(s); dyn.push(s);
  }
  for (const f of res.fires || []) {
    const fi = fire(f.scale || 1, { light: f.light !== false });
    fi.position.fromArray(f.p);
    g.add(fi); dyn.push(fi);
  }
  for (const sm of res.smokes || []) {
    const s = smoke(sm.opts || {});
    s.position.fromArray(sm.p);
    g.add(s); dyn.push(s);
  }
  for (const d of res.dynamics || []) { g.add(d); dyn.push(d); }
  // (v116: false when nothing in it moved this step, e.g. its lanterns all stand still: the walk on demand skips it then)
  // (v116 review: true too when the group itself was placed anew, e.g. a Homestead furnishing moved to another spot by
  // a plain position.set: the walk on demand relies on this update to see it)
  const was = new Float64Array(8).fill(NaN);
  const placed = () => {
    const p = g.position, q = g.quaternion, v = [p.x, p.y, p.z, q.x, q.y, q.z, q.w, g.scale.x];
    let ch = false; for (let i = 0; i < 8; i++) if (v[i] !== was[i]) { was[i] = v[i]; ch = true; }
    return ch;
  };
  g.userData.update = (dt, t) => { let moved = placed(); for (const d of dyn) if (d.userData.update?.(dt, t) !== false) moved = true; return moved; };
  g.userData.collider = res.collider;
  // walked on demand only when it holds nothing but our own lanterns, glows, fires and smoke (builders' own moving
  // parts in res.dynamics may be driven from outside)
  // (v115) its own meshes stand still (the update only drives the lanterns, glows, fires, smoke and the res.dynamics, each
  // with its own update): the static shadow cache draws them (engine/shadowCache.js; it redraws if the whole group is
  // moved), those moving parts stay dynamic casters
  g.userData.shadowStatic = true;
  return res.dynamics?.length ? g : walkOnDemand(g);
}
