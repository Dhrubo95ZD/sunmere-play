// Visual effects: GPU billboard particles, weapon trails, rings, decals, debris, projectiles, auras, clouds,
// held items and the event runner used by skill choreography.
import * as THREE from 'three';
import { Builder, lumpy, ico, cone, cyl, sphere, torus, box, lathe, rbox, gear } from '../assets/kit.js';
import { flaskMesh, arrowMesh, kiteShield, roundShield, warhammer, dagger } from '../assets/characters.js';
import { placeString } from '../assets/weapons.js';
import { lookChange } from '../assets/charMerge.js';
import { mulberry32 } from '/sunmere-play/shared/noise.js';
import { tierOf, tierInfo } from '/sunmere-play/shared/feel.js';
import { skillOf } from '/sunmere-play/shared/fusions.js'; // (S2: the new kit and fusions by id; legacy skills otherwise)
import { SETTINGS } from '../engine/settings.js';
import { QUALITY as GFX } from '../engine/globals.js';
// effect lights in the fixed pool (a fixed count: lights added or removed recompile every lit material). High keeps 4,
// phones 2; QUALITY.fxLights, or half of QUALITY.lights, overrides
export const fxLightCount = () => GFX.fxLights ?? (GFX.lights != null ? Math.max(1, Math.floor(GFX.lights / 2)) : GFX.mobile ? 2 : 4);

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = mulberry32(99);
const r = (a = 0, b = 1) => a + (b - a) * rnd();
const rv = (s = 1) => V(r(-1, 1), r(-1, 1), r(-1, 1)).normalize().multiplyScalar(s);
const col = (c) => new THREE.Color(c);
// shared palette for the physical hit kit (particles only read their colour, so these are never mutated)
const C_DUST = col('#d4c4a2'), C_GRIT = col('#5a4a3a'), C_STEAM = col('#ecebe6'), C_DARK = col('#14100c'), C_WHITE = col('#ffffff'), C_COOL = col('#7a1c06'), C_GATHER = col('#ffd080');
// impact marks (crack / crater / scorch / smudge): at most this many on the ground at once
const MARK_MAX = 5;

// ---------------------------------------------------------------- atlas
function atlasTexture() {
  const W = 512, H = 256, C = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const cell = (i, fn) => { x.save(); x.translate((i % 4) * C, Math.floor(i / 4) * C); fn(); x.restore(); };
  const radial = (stops) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 62); stops.forEach(([o, s]) => g.addColorStop(o, s)); return g; };
  // 0 glow
  cell(0, () => { x.fillStyle = radial([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.7)'], [0.55, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(0, 0, C, C); });
  // 1 streak (vertical)
  cell(1, () => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.save(); x.translate(64, 64); x.scale(0.16, 1); x.translate(-64, -64); x.fillRect(0, 0, C, C); x.restore(); });
  // 2 puff
  cell(2, () => {
    for (let i = 0; i < 14; i++) {
      const px = 64 + r(-24, 24), py = 64 + r(-24, 24), rr = r(18, 34);
      const g = x.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, 'rgba(255,255,255,0.32)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, C, C);
    }
  });
  // 3 flame
  cell(3, () => {
    const g = x.createRadialGradient(64, 82, 2, 64, 70, 54);
    g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.3, 'rgba(255,190,70,0.95)'); g.addColorStop(0.65, 'rgba(255,90,20,0.5)'); g.addColorStop(1, 'rgba(180,30,0,0)');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(64, 6); x.bezierCurveTo(100, 50, 112, 90, 64, 122); x.bezierCurveTo(16, 90, 28, 50, 64, 6); x.fill();
  });
  // 4 shard
  cell(4, () => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(64, 14); x.lineTo(96, 70); x.lineTo(58, 116); x.lineTo(36, 60); x.closePath(); x.fill(); x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.moveTo(64, 14); x.lineTo(58, 116); x.lineTo(36, 60); x.closePath(); x.fill(); });
  // 5 leaf
  cell(5, () => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(64, 10); x.quadraticCurveTo(110, 60, 64, 118); x.quadraticCurveTo(18, 60, 64, 10); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 3; x.beginPath(); x.moveTo(64, 14); x.lineTo(64, 114); x.stroke(); });
  // 6 droplet
  cell(6, () => { const g = x.createRadialGradient(56, 74, 2, 64, 72, 40); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0.6)'); x.fillStyle = g; x.beginPath(); x.moveTo(64, 20); x.bezierCurveTo(90, 60, 98, 100, 64, 108); x.bezierCurveTo(30, 100, 38, 60, 64, 20); x.fill(); });
  // 7 petal
  cell(7, () => { const g = x.createRadialGradient(54, 54, 4, 64, 64, 50); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0.75)'); x.fillStyle = g; x.beginPath(); x.ellipse(64, 64, 34, 50, 0.4, 0, Math.PI * 2); x.fill(); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const TEX = { glow: 0, streak: 1, puff: 2, flame: 3, shard: 4, leaf: 5, drop: 6, petal: 7 };

// ---------------------------------------------------------------- particles
class Particles {
  constructor(scene, camera, max, additive, atlas) {
    this.camera = camera;
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    this.pos = new Float32Array(max * 3); this.colr = new Float32Array(max * 4); this.data = new Float32Array(max * 3);
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iColor', new THREE.InstancedBufferAttribute(this.colr, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iData', new THREE.InstancedBufferAttribute(this.data, 3).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0;
    this.geo = g;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { tAtlas: { value: atlas } },
      vertexShader: /* glsl */ `
        attribute vec3 iPos; attribute vec4 iColor; attribute vec3 iData;
        varying vec2 vUv; varying vec4 vColor;
        void main() {
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          float c = cos(iData.y), s = sin(iData.y);
          vec2 p = position.xy * iData.x;
          mv.xy += vec2(c * p.x - s * p.y, s * p.x + c * p.y);
          gl_Position = projectionMatrix * mv;
          float tx = mod(iData.z, 4.0), ty = floor(iData.z / 4.0);
          vUv = vec2((uv.x + tx) * 0.25, (uv.y + (1.0 - ty)) * 0.5);
          vColor = iColor;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tAtlas; varying vec2 vUv; varying vec4 vColor;
        void main() { vec4 t = texture2D(tAtlas, vUv); gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a); if (gl_FragColor.a < 0.004) discard; }`,
    });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 20 : 19;
    scene.add(this.mesh);
    this.list = [];
  }
  spawn(p) { if (this.list.length < this.max) this.list.push(p); }
  update(dt) {
    const cam = this.camera;
    const L = this.list;
    let w = 0;
    const tmp = V(), tmp2 = V();
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vel.y -= (p.grav ?? 0) * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - (p.drag ?? 0) * dt));
      if (p.swirl) { const a = p.swirl * dt; const x = p.pos.x - p.cx, z = p.pos.z - p.cz; p.pos.x = p.cx + x * Math.cos(a) - z * Math.sin(a); p.pos.z = p.cz + x * Math.sin(a) + z * Math.cos(a); }
      p.pos.addScaledVector(p.vel, dt);
      if (p.floor !== undefined && p.pos.y < p.floor) { p.pos.y = p.floor; p.vel.y *= -(p.bounce ?? 0.3); p.vel.x *= 0.6; p.vel.z *= 0.6; }
      p.rot += (p.spin ?? 0) * dt;
      const k = p.age / p.life;
      const size = p.size * (p.grow ? 1 + p.grow * k : 1) * (p.shrink ? 1 - k * p.shrink : 1);
      const fadeIn = p.fadeIn ? Math.min(1, p.age / p.fadeIn) : 1;
      const a = p.alpha * fadeIn * (1 - Math.pow(k, p.fadePow ?? 1.5));
      let rot = p.rot;
      if (p.stretch) {
        // orient streaks along their screen-space motion
        tmp.copy(p.pos).project(cam); tmp2.copy(p.pos).addScaledVector(p.vel, 0.03).project(cam);
        rot = Math.atan2(tmp2.y - tmp.y, (tmp2.x - tmp.x) * cam.aspect) - Math.PI / 2;
      }
      this.pos[w * 3] = p.pos.x; this.pos[w * 3 + 1] = p.pos.y; this.pos[w * 3 + 2] = p.pos.z;
      const c = p.c2 ? tmp.set(p.color.r + (p.c2.r - p.color.r) * k, p.color.g + (p.c2.g - p.color.g) * k, p.color.b + (p.c2.b - p.color.b) * k) : p.color;
      this.colr[w * 4] = c.r ?? c.x; this.colr[w * 4 + 1] = c.g ?? c.y; this.colr[w * 4 + 2] = c.b ?? c.z; this.colr[w * 4 + 3] = a;
      this.data[w * 3] = size * (p.stretch ? p.stretch : 1); this.data[w * 3 + 1] = rot; this.data[w * 3 + 2] = p.tex;
      L[w] = p;
      w++;
    }
    L.length = w;
    this.geo.instanceCount = w;
    this.geo.attributes.iPos.needsUpdate = true;
    this.geo.attributes.iColor.needsUpdate = true;
    this.geo.attributes.iData.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- trails
// A swing ribbon: timestamped hilt/tip samples, Catmull-Rom smoothed every frame so the arc stays round even
// at low frame rates. The fresh edge near the tip burns white-hot (above 1, so the bloom catches it) and the
// body fades and narrows toward the tail.
const TRAIL_LIFE = 0.23, TRAIL_SUB = 4, TRAIL_MAX = 48;
const TRAIL_CAP = (TRAIL_MAX - 1) * TRAIL_SUB + 1;
const crU = (p0, p1, p2, p3, t, out) => {
  const t2 = t * t, t3 = t2 * t;
  return out.set(
    0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3));
};
const _ta = new THREE.Vector3(), _tb = new THREE.Vector3();
class Trail {
  constructor(scene, color, width = 1) {
    this.s = []; // { a: hilt, b: tip, t: birth time }, newest first
    this.time = 0; this.width = width;
    const g = new THREE.BufferGeometry();
    this.posArr = new Float32Array(TRAIL_CAP * 2 * 3);
    this.uvArr = new Float32Array(TRAIL_CAP * 2 * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tuv', new THREE.BufferAttribute(this.uvArr, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < TRAIL_CAP - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: col(color) }, uK: { value: 1 }, uTime: { value: 0 } },
      vertexShader: 'attribute vec2 tuv; varying vec2 vT; void main(){ vT = tuv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform vec3 uColor; uniform float uK, uTime; varying vec2 vT;
        float h1(float x) { return fract(sin(x * 91.7) * 43758.5453); }
        float n1(float x) { float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
        void main() {
          float u = clamp(vT.x, 0.0, 1.0), v = clamp(vT.y, 0.0, 1.0);
          float core = smoothstep(0.72, 1.0, v) * pow(1.0 - u, 3.0);
          float body = pow(v, 1.2) * pow(1.0 - u, 1.25) * (0.7 + 0.3 * n1(u * 12.0 - uTime * 6.0 + v * 3.0));
          float edge = smoothstep(0.0, 0.12, v) * smoothstep(1.0, 0.94, v); // soft long edges, no hard rim
          vec3 c = mix(uColor, vec3(1.0, 0.98, 0.92), core) * (body * 1.5 + core * 2.8);
          float a = clamp(body * 1.2 + core, 0.0, 1.0) * edge * uK;
          gl_FragColor = vec4(c, a);
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 18;
    scene.add(this.mesh);
    this.active = true; this.fade = 1;
  }
  push(pa, pb) {
    const head = this.s[0];
    // skip duplicate samples (hit-stop frames) so the spline does not kink
    if (head && head.b.distanceToSquared(pb) < 1e-6 && head.a.distanceToSquared(pa) < 1e-6) { head.t = this.time; return; }
    this.s.unshift({ a: pa.clone(), b: pb.clone(), t: this.time });
    if (this.s.length > TRAIL_MAX) this.s.pop();
  }
  update(dt) {
    this.time += dt;
    this.mat.uniforms.uTime.value = this.time;
    const life = TRAIL_LIFE * (this.width > 1 ? 1.15 : 1);
    while (this.s.length && this.time - this.s[this.s.length - 1].t > life) this.s.pop();
    if (!this.active) this.fade -= dt * 3;
    const S = this.s, n = S.length;
    let k = 0;
    if (n >= 2) {
      const write = (a, b, age) => {
        const u = Math.min(1, age / life);
        // width ramp: the full blade length when fresh, narrowing toward the tip as the tail ages
        const hk = 0.15 + 0.6 * u;
        this.posArr[k * 6] = a.x + (b.x - a.x) * hk; this.posArr[k * 6 + 1] = a.y + (b.y - a.y) * hk; this.posArr[k * 6 + 2] = a.z + (b.z - a.z) * hk;
        this.posArr[k * 6 + 3] = b.x; this.posArr[k * 6 + 4] = b.y; this.posArr[k * 6 + 5] = b.z;
        this.uvArr[k * 4] = u; this.uvArr[k * 4 + 1] = 0; this.uvArr[k * 4 + 2] = u; this.uvArr[k * 4 + 3] = 1;
        k++;
      };
      for (let i = 0; i < n - 1 && k < TRAIL_CAP - 1; i++) {
        const p0 = S[Math.max(0, i - 1)], p1 = S[i], p2 = S[i + 1], p3 = S[Math.min(n - 1, i + 2)];
        for (let j = 0; j < TRAIL_SUB; j++) {
          const t = j / TRAIL_SUB;
          crU(p0.a, p1.a, p2.a, p3.a, t, _ta); crU(p0.b, p1.b, p2.b, p3.b, t, _tb);
          write(_ta, _tb, this.time - (p1.t + (p2.t - p1.t) * t));
        }
      }
      const L = S[n - 1]; write(L.a, L.b, this.time - L.t);
    }
    this.mesh.geometry.setDrawRange(0, Math.max(0, k - 1) * 6);
    this.mat.uniforms.uK.value = Math.max(0, Math.min(1, this.fade));
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.tuv.needsUpdate = true;
    return this.active || (this.fade > 0 && this.s.length > 1);
  }
  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}

// ---------------------------------------------------------------- contact shadows
// A soft dark blob under every character, mob and ridden runabout: one instanced draw, a cheap stand-in for
// ambient occlusion where feet and wheels meet the ground.
class ContactShadows {
  constructor(scene, max = 160) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.35, 'rgba(0,0,0,0.85)'); grd.addColorStop(0.7, 'rgba(0,0,0,0.3)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(2, 2); geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({ map: tex, color: 0x0c0a14, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; this.mesh.count = 0;
    this.max = max; this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.sv = V(); this.pv = V(); this.up = V(0, 1, 0);
    scene.add(this.mesh);
  }
  update(src, cam) {
    let n = 0;
    if (src?.views) {
      for (const v of src.views.values()) {
        if (n >= this.max) break;
        if (!v.root?.parent || !v.root.visible || (v.dead && (v.deadT || 0) > 18)) continue;
        if (cam && v.pos.distanceToSquared(cam.position) > 110 * 110) continue;
        let r;
        if (v.mounted) r = 1.25;
        else if (v.ty === 'm') r = THREE.MathUtils.clamp((v.root.userData.height || v.char?.userData?.height || 2) * 0.3, 0.45, 3);
        else r = 0.55;
        this.pv.set(v.pos.x, v.pos.y + 0.05, v.pos.z);
        if (v.mounted) this.q.setFromAxisAngle(this.up, v.ry); else this.q.identity();
        this.m4.compose(this.pv, this.q, this.sv.set(r * (v.mounted ? 0.8 : 1), 1, r * (v.mounted ? 1.3 : 1)));
        this.mesh.setMatrixAt(n++, this.m4);
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- props used by effects
const ITEM_FLASK = { flaskLime: 'wCloth', flaskFire: 'wGlowAmber', flaskAcid: 'wGlowGreen', flaskVolatile: 'wGlowPurple', flaskHeal: 'wGlowRed', flaskElixir: 'wGlowBlue', flaskAntidote: 'wGlowBlue', tonic: 'wGlowGreen', salve: 'wGlowGreen', poultice: 'wGlowGreen', sap: 'wGlowAmber', barkpaste: 'wGlowAmber' };
function itemMesh(item) {
  if (ITEM_FLASK[item]) {
    if (['salve', 'poultice', 'sap', 'barkpaste'].includes(item)) {
      const b = new Builder(3);
      b.add(sphere(0.06, 10, 8), ITEM_FLASK[item], { c: 0xffffff });
      b.add(box(0.1, 0.02, 0.1), 'wCloth', { p: [0, 0.05, 0], c: '#c8b890' });
      return b.build({ shadow: false });
    }
    return flaskMesh(ITEM_FLASK[item]);
  }
  const b = new Builder(5);
  switch (item) {
    case 'bomb': case 'grenade':
      b.add(sphere(0.075, 12, 10), 'wDark', { c: 0xffffff });
      b.add(cyl(0.02, 0.02, 0.04, 8), 'wBrass', { p: [0, 0.08, 0], c: 0xffffff });
      b.add(sphere(0.015, 6, 4), 'wGlowAmber', { p: [0, 0.11, 0], c: 0xffffff });
      if (item === 'grenade') for (let i = 0; i < 3; i++) b.add(torus(0.076, 0.006, 4, 16), 'wBrass', { p: [0, -0.03 + i * 0.03, 0], r: [Math.PI / 2, 0, 0], c: 0xffffff });
      break;
    case 'pot': case 'jar':
      b.add(lathe([[0.001, -0.07], [0.06, -0.065], [0.08, -0.02], [0.07, 0.04], [0.04, 0.07], [0.045, 0.085], [0.001, 0.085]], 12), item === 'pot' ? 'wWood' : 'wGlowGreen', { c: item === 'pot' ? '#5a3a22' : 0xffffff });
      b.add(cyl(0.035, 0.035, 0.02, 10), 'wLeather', { p: [0, 0.09, 0], c: '#3a2616' });
      break;
    case 'cask':
      b.add(lathe([[0.001, -0.22], [0.15, -0.22], [0.19, -0.1], [0.2, 0], [0.19, 0.1], [0.15, 0.22], [0.001, 0.22]], 16), 'wWood', { c: '#8a5a32' });
      for (const y of [-0.15, 0, 0.15]) b.add(torus(0.195, 0.01, 4, 20), 'wDark', { p: [0, y, 0], r: [Math.PI / 2, 0, 0], c: 0xffffff });
      b.add(cyl(0.012, 0.012, 0.12, 6), 'wCloth', { p: [0, 0.27, 0], c: '#c8b890' });
      break;
    case 'drum': // the Lime Mortar Drum: a squat iron drum, straight sides, flat ends, flush hoops (no barrel belly), a short fuse
      b.add(cyl(0.15, 0.15, 0.3, 16), 'wDark', { c: '#5a5a56' });
      for (const y of [-0.11, 0.11]) b.add(cyl(0.153, 0.153, 0.025, 16), 'wDark', { p: [0, y, 0], c: '#3a3a38' });
      b.add(cyl(0.012, 0.012, 0.08, 6), 'wCloth', { p: [0, 0.19, 0], c: '#c8b890' });
      break;
    case 'clockbomb':
      b.add(cyl(0.12, 0.12, 0.12, 16), 'wBrass', { c: 0xffffff });
      b.add(gear(12, 0.09, 0.11, 0.02, { hole: 0.02, spokes: 4 }), 'wDark', { p: [0, 0.07, 0], r: [Math.PI / 2, 0, 0], c: 0xffffff });
      b.add(sphere(0.025, 8, 6), 'wGlowRed', { p: [0, 0.1, 0.05], c: 0xffffff });
      break;
    case 'trap':
      b.add(gear(14, 0.12, 0.15, 0.025, { hole: 0.04 }), 'wDark', { r: [Math.PI / 2, 0, 0], c: 0xffffff });
      break;
    case 'dagger': return dagger();
    case 'blowgun': b.add(cyl(0.015, 0.015, 0.5, 8), 'wWood', { r: [Math.PI / 2, 0, 0], p: [0, 0, 0.2], c: 0xffffff }); break;
    case 'net': b.add(ico(0.12, 1), 'wLeather', { c: '#8a7a5a', flat: true }); break;
    case 'herbBundle':
      b.add(cyl(0.03, 0.04, 0.16, 8), 'wCloth', { c: '#6a8a3a' });
      b.add(sphere(0.02, 6, 4), 'wGlowAmber', { p: [0, 0.09, 0], c: 0xffffff });
      break;
    case 'bandage': b.add(cyl(0.05, 0.05, 0.06, 12), 'wCloth', { r: [0, 0, Math.PI / 2], c: '#efe6d0' }); break;
    case 'seedpod': b.add(lumpy(ico(0.07, 1), 0.015, 20, 3), 'wWood', { c: '#7a5a2a' }); break;
    case 'cup': b.add(lathe([[0.001, 0], [0.04, 0], [0.05, 0.07], [0.045, 0.075], [0.001, 0.01]], 12), 'wWood', { c: '#8a6a3a' }); break;
    // the Deadeye's kit: a flat brass powder flask, a ramrod, a paper cartridge, a chalk pellet, an iron ball, two balls on
    // a short chain, a square steam canister (nothing self-lit)
    case 'powderflask':
      b.add(rbox(0.07, 0.09, 0.026, 0.012), 'wBrass', { c: 0xffffff });
      b.add(cyl(0.009, 0.012, 0.05, 8), 'wIron', { p: [0, 0.065, 0], c: 0xffffff });
      break;
    case 'ramrod': b.add(cyl(0.005, 0.005, 0.3, 6), 'wWood', { p: [0, -0.1, 0], c: '#5a3a20' }); b.add(cyl(0.008, 0.008, 0.02, 6), 'wBrass', { p: [0, -0.25, 0], c: 0xffffff }); break;
    case 'cartridge': b.add(cyl(0.014, 0.014, 0.07, 8), 'wCloth', { r: [0, 0, Math.PI / 2], c: '#e8dcc0' }); b.add(cyl(0.0145, 0.0145, 0.015, 8), 'wCloth', { p: [0.03, 0, 0], r: [0, 0, Math.PI / 2], c: '#8a7a60' }); break;
    case 'chalk': b.add(rbox(0.035, 0.035, 0.035, 0.01), 'wCloth', { c: '#f4f0e6' }); break;
    case 'ball': b.add(sphere(0.022, 8, 6), 'wDark', { c: 0xffffff }); break;
    case 'chainshot':
      for (const sx of [-1, 1]) b.add(sphere(0.03, 10, 8), 'wIron', { p: [sx * 0.09, 0, 0], c: '#5a5a60' });
      b.add(cyl(0.006, 0.006, 0.15, 5), 'wIron', { r: [0, 0, Math.PI / 2], c: '#3a3a40' });
      break;
    case 'canister':
      b.add(rbox(0.11, 0.11, 0.15, 0.012), 'wIron', { c: '#6a6a70' });
      for (const z of [-0.05, 0.05]) b.add(box(0.116, 0.116, 0.018), 'wBrass', { p: [0, 0, z], c: 0xffffff });
      b.add(box(0.03, 0.006, 0.03), 'wDark', { p: [0, 0.058, 0], c: 0xffffff });
      break;
    default: b.add(sphere(0.05, 8, 6), 'wGlowAmber', { c: 0xffffff });
  }
  return b.build({ shadow: false });
}

// ---------------------------------------------------------------- FX main
export class FX {
  constructor(scene, camera, { heightAt = () => 0, rig = null, sfx = null } = {}) {
    this.scene = scene; this.camera = camera; this.heightAt = heightAt; this.rig = rig; this.sfx = sfx;
    const atlas = atlasTexture();
    this.add = new Particles(scene, camera, 6500, true, atlas);
    this.alpha = new Particles(scene, camera, 4500, false, atlas);
    this.marks = []; // live impact-mark decals, oldest first
    this.trails = [];
    this.timed = [];
    this.hitstopT = 0;
    // pooled lights (fixed count avoids shader recompiles)
    this.lights = [];
    for (let i = 0, n = fxLightCount(); i < n; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); l.visible = true; scene.add(l); this.lights.push({ l, t: 0, dur: 0, peak: 0, owner: null, seen: 0 }); }
    this.frameN = 0;
    // rock debris
    const rg = lumpy(ico(0.5, 0), 0.08, 3, 7);
    const rm = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.95, flatShading: true });
    this.debris = new THREE.InstancedMesh(rg, rm, 120);
    this.debris.castShadow = true;
    this.debris.count = 0;
    this.debris.frustumCulled = false;
    scene.add(this.debris);
    this.debrisList = [];
    this.spikeGeo = cone(0.5, 1, 6);
    this.spikeMat = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.9, flatShading: true });
    this.decalTex = this.makeDecalTextures();
    this.contact = new ContactShadows(scene);
    this.shadowSource = null; // the EntityManager (set by the game)
    this.ringTex = this.makeRingTexture();
  }

  // F3: the effect materials made on demand (sword trails, rings, telegraphs, ground marks, arcs, spikes) compiled once
  // behind the loading screen, on copies in a scene of their own (lit like the world), so a first cast does not stall on
  // a shader build. The copies are kept: three frees a program (and forgets its shader code) when the last material
  // using it is disposed, so every effect that disposes its material on the way out compiled afresh the next time
  async warm(renderer, camera, litBy) {
    const tmp = new THREE.Scene(), made = [];
    const keep = (o) => { o.frustumCulled = false; tmp.add(o); made.push(o); return o; };
    const t = new Trail(tmp, '#ffffff', 1); made.push(t.mesh);
    const plane = new THREE.PlaneGeometry(1, 1);
    keep(new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: this.ringTex, color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    keep(new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: this.telegraphTex(), color: '#ff3a20', transparent: true, depthWrite: false, opacity: 0.5, blending: THREE.AdditiveBlending })));
    keep(new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: this.decalTex.crack, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
    keep(new THREE.Mesh(this.spikeGeo, this.spikeMat));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    keep(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    try { await renderer.compileAsync(tmp, camera, litBy); } catch (e) { console.warn('[fx warm]', e?.message || e); }
    finally { for (const o of made) tmp.remove(o); this._warmKeep = made.map((o) => o.material); }
  }

  makeRingTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 60, 128, 128, 126);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,255,255,0.15)'); g.addColorStop(0.9, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  makeDecalTextures() {
    const mk = (fn) => { const c = document.createElement('canvas'); c.width = c.height = 256; fn(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    // impact marks: soft, irregular dark smudges built from offset blotches (no cracks, no radiating lines);
    // blotch centre + radius stays inside the canvas so every edge fades to nothing
    const blotchy = (x, n, spread, rMin, rMax, rgb, a0) => {
      for (let i = 0; i < n; i++) {
        const ang = r(0, 6.28), d = Math.sqrt(rnd()) * spread, px = 128 + Math.cos(ang) * d, py = 128 + Math.sin(ang) * d, rr = r(rMin, rMax);
        const g = x.createRadialGradient(px, py, 0, px, py, rr);
        g.addColorStop(0, `rgba(${rgb},${a0})`); g.addColorStop(0.55, `rgba(${rgb},${a0 * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
        x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      }
    };
    const smudge = mk((x) => { blotchy(x, 9, 40, 40, 80, '44,32,22', 0.27); blotchy(x, 5, 22, 18, 40, '22,16,11', 0.3); });
    const crack = smudge; // 'crack' events (slams) now leave the same crack-free impact smudge
    const crater = mk((x) => { blotchy(x, 12, 46, 46, 78, '58,44,30', 0.26); blotchy(x, 7, 28, 24, 52, '20,15,10', 0.42); });
    const scorch = mk((x) => { blotchy(x, 10, 38, 42, 82, '24,16,10', 0.36); blotchy(x, 4, 16, 20, 40, '12,8,6', 0.45); });
    const tar = mk((x) => { for (let i = 0; i < 9; i++) { const g = x.createRadialGradient(128 + r(-50, 50), 128 + r(-50, 50), 0, 128, 128, r(40, 90)); g.addColorStop(0, 'rgba(14,12,10,0.9)'); g.addColorStop(1, 'rgba(14,12,10,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); } });
    // the hunter's mark: one bold ring round a soft glow (no arrowheads or crosshair marks)
    const mark = mk((x) => { const g = x.createRadialGradient(128, 128, 10, 128, 128, 96); g.addColorStop(0, 'rgba(255,110,70,0.35)'); g.addColorStop(1, 'rgba(255,90,60,0)'); x.fillStyle = g; x.beginPath(); x.arc(128, 128, 96, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(255,90,60,0.95)'; x.lineWidth = 12; x.beginPath(); x.arc(128, 128, 100, 0, Math.PI * 2); x.stroke(); });
    return { crack, crater, scorch, smudge, tar, mark };
  }

  ground(p) { return this.heightAt(p.x, p.z); }

  // ---------------------------------------------------------------- particle presets
  emit(kind, pos, o = {}) {
    const n = Math.round((o.n ?? 10) * (o.scale ?? 1));
    const cc = col(o.color ?? '#ffffff');
    const dir = o.dir;
    let gy; const fy = () => (gy ??= this.ground(pos)); // one height sample per burst, not per particle
    let fd, fs; // 'fan': blow direction (flat) and its sideways axis
    if (kind === 'fan') { fd = dir ? V(dir.x, 0, dir.z) : V(1, 0, 0); if (fd.lengthSq() < 1e-4) fd.set(1, 0, 0); fd.normalize(); fs = V(-fd.z, 0, fd.x); }
    for (let i = 0; i < n; i++) {
      const base = { pos: pos.clone().add(o.spread ? rv(r(0, o.spread)) : V()), age: 0, rot: r(0, 6.28), color: cc };
      let p;
      switch (kind) {
        case 'sparks': {
          let v = dir ? dir.clone().normalize().multiplyScalar(r(4, 9)).add(rv(r(1, 4))) : rv(r(3, 9));
          if (!dir) v.y = Math.abs(v.y) * 0.8 + 1;
          p = { ...base, vel: v, life: r(0.2, 0.5), size: r(0.05, 0.11) * (o.size ?? 1), tex: TEX.streak, stretch: 3.2, grav: 12, drag: 2, alpha: 1, floor: fy() + 0.02 };
          this.add.spawn(p); break;
        }
        // directional spark fan: most of the sparks carry on along the blow, splayed sideways and a little up
        case 'fan': {
          const v = fd.clone().multiplyScalar(r(3.5, 10) * (o.speed ?? 1)).addScaledVector(fs, r(-1, 1) * (o.width ?? 4.5)).add(V(0, r(-0.6, 3.2), 0)).add(rv(r(0, 1.4)));
          p = { ...base, vel: v, life: r(0.14, 0.38), size: r(0.065, 0.13) * (o.size ?? 1), tex: TEX.streak, stretch: 3.8, grav: 10, drag: 2.6, alpha: 1, floor: fy() + 0.02 };
          this.add.spawn(p); break;
        }
        // hot metal flecks: small glowing bits that pop up, fall, bounce once off the floor and cool to dull red
        case 'flecks': {
          const v = (dir ? V(dir.x, 0, dir.z).normalize().multiplyScalar(r(1, 3.5)) : V()).add(rv(r(1.2, 3.5))); v.y = Math.abs(v.y) + r(2.2, 4.6);
          p = { ...base, vel: v, life: r(0.75, 1.25), size: r(0.045, 0.08) * (o.size ?? 1), tex: TEX.glow, grav: 15, drag: 0.5, alpha: 1, c2: o.c2 ? col(o.c2) : C_COOL, floor: fy() + 0.03, bounce: 0.42, fadePow: 3 };
          this.add.spawn(p); break;
        }
        // ground-hugging dust ring: puffs thrown outward along the floor (random angles, so no spoke pattern)
        case 'ringdust': {
          const a = r(0, 6.28), R = o.r ?? 0.6, sp = r(0.65, 1.15) * (o.speed ?? 3.2), h = o.h ?? 1, d0 = R * r(0.15, 0.45);
          p = { ...base, pos: V(pos.x + Math.cos(a) * d0, fy() + r(0.08, 0.3) * h, pos.z + Math.sin(a) * d0), color: o.color ? cc : C_DUST, vel: V(Math.cos(a) * sp, r(0.1, 0.65) * h, Math.sin(a) * sp), life: r(0.55, 1.05) * (o.lifeK ?? 1), size: r(0.5, 0.95) * (o.size ?? 1), tex: TEX.puff, drag: 2.7, alpha: o.alpha ?? 0.6, grow: 1.9, spin: r(-1, 1), fadeIn: 0.04 };
          this.alpha.spawn(p); break;
        }
        // grit: little dark stone chips
        case 'grit': {
          const v = rv(r(2, 5) * (o.speed ?? 1)); v.y = Math.abs(v.y) * 1.2 + 1.5;
          p = { ...base, color: o.color ? cc : C_GRIT, vel: v, life: r(0.5, 0.9), size: r(0.04, 0.09) * (o.size ?? 1), tex: TEX.shard, grav: 16, spin: r(-14, 14), alpha: 1, floor: fy() + 0.02, bounce: 0.25 };
          this.alpha.spawn(p); break;
        }
        // steam: a quick white jet (along `dir`) or a rising puff
        case 'steam': {
          const v = dir ? dir.clone().normalize().multiplyScalar(r(1.5, 3.5) * (o.speed ?? 1)) : V(r(-0.4, 0.4), r(1.2, 2.6) * (o.speed ?? 1), r(-0.4, 0.4));
          v.add(rv(r(0, 0.5)));
          p = { ...base, color: o.color ? cc : C_STEAM, vel: v, life: r(0.5, 1.0) * (o.lifeK ?? 1), size: r(0.3, 0.6) * (o.size ?? 1), tex: TEX.puff, drag: 2.2, grav: -1.5, alpha: o.alpha ?? 0.45, grow: 2.4, spin: r(-1.5, 1.5), fadeIn: 0.05 };
          this.alpha.spawn(p); break;
        }
        // sparks drawn in toward a point (a weapon tip winding up)
        case 'gather': {
          const off = rv(r(0.3, 0.6));
          p = { ...base, color: o.color ? cc : C_GATHER, pos: pos.clone().add(off), vel: off.clone().multiplyScalar(-1 / 0.2), life: 0.2, size: r(0.03, 0.06), tex: TEX.streak, stretch: 2.4, alpha: 0.9, fadeIn: 0.05 };
          this.add.spawn(p); break;
        }
        case 'embers': p = { ...base, vel: V(r(-1, 1), r(1, 3.5), r(-1, 1)), life: r(0.8, 1.8), size: r(0.04, 0.09), tex: TEX.glow, drag: 0.5, grav: -0.5, alpha: 1, c2: col('#ff4010') }; this.add.spawn(p); break;
        case 'flash': p = { ...base, vel: V(), life: o.life ?? 0.18, size: o.size ?? 2.4, tex: TEX.glow, alpha: o.alpha ?? 1, grow: 0.6, fadePow: 1 }; this.add.spawn(p); i = n; break;
        case 'glow': p = { ...base, vel: V(), life: o.life ?? 0.6, size: o.size ?? 1.5, tex: TEX.glow, alpha: o.alpha ?? 0.6, fadePow: 2 }; this.add.spawn(p); i = n; break;
        case 'flame': p = { ...base, vel: V(r(-1.2, 1.2), r(1.5, 4.5), r(-1.2, 1.2)).multiplyScalar(o.speed ?? 1), life: r(0.35, 0.8), size: r(0.5, 1.1) * (o.size ?? 1), tex: TEX.flame, drag: 1.5, grav: -2, alpha: 1, grow: 0.4, shrink: 0.3 }; this.add.spawn(p); break;
        case 'smoke': p = { ...base, color: col(o.color ?? '#6a645c'), vel: V(r(-0.6, 0.6), r(0.6, 1.8), r(-0.6, 0.6)).multiplyScalar(o.speed ?? 1), life: r(1.4, 2.8) * (o.lifeK ?? 1), size: r(0.8, 1.5) * (o.size ?? 1), tex: TEX.puff, drag: 0.8, alpha: o.alpha ?? 0.55, grow: 1.6, spin: r(-0.5, 0.5), fadeIn: 0.2 }; this.alpha.spawn(p); break;
        case 'dust': {
          const v = rv(r(1, 3)); v.y = Math.abs(v.y) * 0.6 + 0.3;
          p = { ...base, color: col(o.color ?? '#b8a07a'), vel: v.multiplyScalar(o.speed ?? 1), life: r(0.6, 1.2), size: r(0.5, 1.0) * (o.size ?? 1), tex: TEX.puff, drag: 2.5, alpha: o.alpha ?? 0.6, grow: 1.4, spin: r(-1, 1) };
          this.alpha.spawn(p); break;
        }
        case 'shards': { const v = rv(r(3, 7)); v.y = Math.abs(v.y) + 2; p = { ...base, color: col(o.color ?? '#d8eef0'), vel: v, life: r(0.5, 1.0), size: r(0.06, 0.14), tex: TEX.shard, grav: 14, spin: r(-12, 12), alpha: 1, floor: fy() + 0.02 }; this.alpha.spawn(p); break; }
        case 'drops': { const v = rv(r(2, 5)); v.y = Math.abs(v.y) + 1.5; p = { ...base, vel: v, life: r(0.5, 0.9), size: r(0.07, 0.14), tex: TEX.drop, grav: 12, alpha: 0.95, floor: fy() + 0.02 }; (o.additive ? this.add : this.alpha).spawn(p); break; }
        case 'leaves': p = { ...base, color: col(o.color ?? '#7aa83a'), vel: V(r(-2, 2), r(1, 3.5), r(-2, 2)), life: r(1.2, 2.4), size: r(0.12, 0.2), tex: TEX.leaf, grav: 2.2, drag: 1.6, spin: r(-5, 5), alpha: 1 }; this.alpha.spawn(p); break;
        case 'motes': p = { ...base, pos: pos.clone().add(V(r(-1, 1) * (o.r ?? 0.6), r(0, 1.6), r(-1, 1) * (o.r ?? 0.6))), vel: V(r(-0.2, 0.2), r(0.5, 1.6), r(-0.2, 0.2)), life: r(0.8, 1.6), size: r(0.06, 0.14), tex: TEX.glow, alpha: 1, fadeIn: 0.2 }; this.add.spawn(p); break;
        case 'petals': p = { ...base, color: col(rnd() < 0.5 ? '#ffd8e8' : '#fffbe8'), pos: pos.clone().add(V(r(-0.4, 0.4), r(0.5, 1.5), r(-0.4, 0.4))), vel: V(r(-4, 4), r(2, 5), r(-4, 4)), life: r(1.5, 2.6), size: r(0.1, 0.16), tex: TEX.petal, grav: 1.6, drag: 1.4, spin: r(-6, 6), alpha: 1, swirl: r(1, 2.5), cx: pos.x, cz: pos.z }; this.alpha.spawn(p); break;
        case 'sand': { const v = rv(r(1.5, 4)); v.y = Math.abs(v.y) * 0.5 + 0.4; p = { ...base, color: col(rnd() < 0.5 ? '#e8cc96' : '#c8a46a'), vel: v.multiplyScalar(o.speed ?? 1), life: r(0.7, 1.4), size: r(0.4, 0.9) * (o.size ?? 1), tex: TEX.puff, drag: 2, alpha: 0.7, grow: 1.5, spin: r(-1, 1) }; this.alpha.spawn(p); break; }
      }
    }
  }

  // soft: a minor pop that is simply skipped when every pooled light is busy (never steals a big flash's light)
  light(pos, color, intensity = 8, dur = 0.3, dist = 10, soft = false) {
    const free = this.lights.find((x) => !x.owner && (x.dur === 0 || x.t >= x.dur));
    if (!free && soft) return;
    let s = free;
    if (!s) for (const x of this.lights) if (!x.owner && (!s || x.t / x.dur > s.t / s.dur)) s = x;
    if (!s) return;
    s.l.position.copy(pos); s.l.color.set(color); s.l.distance = dist; s.l.decay = 1.6; s.t = 0; s.dur = dur; s.peak = intensity;
  }
  // a steady light held by an owner (a boss machine's furnace) for as long as it is refreshed every frame: one of the
  // pool's lights, so no light is added to the scene. At most half the pool is held; a holder that stops calling
  // gives its light back the next frame.
  steadyLight(owner, pos, color, intensity, dist = 12, decay = 1.6) {
    let s = this.lights.find((x) => x.owner === owner);
    if (!s) {
      if (this.lights.filter((x) => x.owner).length >= Math.floor(this.lights.length / 2)) return;
      s = this.lights.find((x) => !x.owner && (x.dur === 0 || x.t >= x.dur));
      if (!s) return;
      s.owner = owner;
    }
    s.seen = this.frameN;
    s.l.position.copy(pos); s.l.color.set(color); s.l.distance = dist; s.l.decay = decay; s.l.intensity = intensity;
  }

  ring(pos, color, radius = 4, dur = 0.55, o = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.ringTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos); m.position.y = this.ground(pos) + 0.08;
    m.renderOrder = 17;
    this.scene.add(m);
    // two rings on the same spot in the same beat (an impact kind's ring and the clip's own) read as concentric bands
    // from above: the second starts 80 ms after the first (combat_design.md 2.8; S1 feel review)
    let delay = o.delay || 0;
    const now = this.clockT || 0, LR = this._lastRing;
    // (review 18 Nov: 80 ms apart, both were still on screen together, two concentric bands round the slam from straight
    // above (Kingsfall, Stormfall). A second ring on the same spot while the first still shows is a low dust wave instead)
    if (LR && now + delay - LR.t > -0.01 && now + delay - LR.t < LR.dur * 0.85 && Math.hypot(pos.x - LR.x, pos.z - LR.z) < 2) {
      this.scene.remove(m); m.geometry.dispose(); m.material.dispose();
      const go = () => this.emit('ringdust', V(pos.x, this.ground(pos), pos.z), { n: Math.round(10 + radius * 2), r: radius * 0.35, speed: 1.6 + radius * 0.7, size: 1.1, alpha: 0.5 });
      if (delay > 0) this.after(delay, null, go); else go();
      return;
    }
    if (LR && Math.abs(now + delay - LR.t) < 0.08 && Math.hypot(pos.x - LR.x, pos.z - LR.z) < 2) delay = LR.t + 0.08 - now;
    this._lastRing = { t: now + delay, x: pos.x, z: pos.z, dur };
    m.visible = delay === 0;
    this.after(dur + delay, (k, t) => {
      if (t < delay) return;
      m.visible = true;
      const kk = Math.min(1, (t - delay) / dur);
      const s = radius * 2 * (0.15 + 0.85 * (1 - Math.pow(1 - kk, 3)));
      m.scale.set(s, s, 1);
      m.material.opacity = (1 - kk) * 0.95;
    }, () => { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
  }

  // telegraph: a red circle on the ground that glows stronger and pulses faster as the hit nears, then the hit lands.
  // (RF.5: one plain filled circle with its rim; the old growing inner disc inside a separate ring read as a disc inside a
  // ring, like a target or an emblem, from straight above)
  telegraph(pos, radius, dur, color = '#ff3a20') {
    const y = this.ground(pos) + 0.12;
    const area = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.telegraphTex(), color, transparent: true, depthWrite: false, opacity: 0.16, blending: THREE.AdditiveBlending }));
    area.rotation.x = -Math.PI / 2; area.position.set(pos.x, y, pos.z); area.renderOrder = 16; this.scene.add(area);
    area.scale.set(radius * 2, radius * 2, 1);
    this.after(dur, (k, t) => {
      const ph = t * (6 + 14 * k);
      area.material.opacity = (0.2 + 0.5 * k) * (0.8 + 0.2 * Math.sin(ph));
    }, () => { this.scene.remove(area); area.geometry.dispose(); area.material.dispose(); });
    return area; // (a Broken boss's cut wind-up hides it: game.js)
  }
  telegraphTex() {
    if (this._tTex) return this._tTex;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.75, 'rgba(255,255,255,0.6)'); g.addColorStop(0.97, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(64, 64, 63, 0, Math.PI * 2); x.fill();
    this._tTex = new THREE.CanvasTexture(c);
    return this._tTex;
  }

  // terrain-conforming decal
  // Impact marks (crack / crater / scorch / smudge) are short-lived (at most 4 s), never stack on a mark that
  // was just laid in the same spot (a slam's own mark plus its decal event), and at most MARK_MAX live at
  // once: the oldest is faded out quickly to make room.
  decal(kind, pos, radius = 2, life = 6) {
    const isMark = kind === 'crack' || kind === 'crater' || kind === 'scorch' || kind === 'smudge';
    if (isMark) {
      life = Math.min(life, 4);
      for (const d of this.marks) if (d.e.t < 0.3 && radius <= d.r * 1.35 && Math.hypot(d.x - pos.x, d.z - pos.z) < Math.max(0.8, d.r * 0.6)) return d.m;
      while (this.marks.length >= MARK_MAX) { const old = this.marks.shift(); old.e.t = Math.max(old.e.t, old.e.dur - 0.25); }
    }
    const seg = 10;
    const g = new THREE.PlaneGeometry(radius * 2, radius * 2, seg, seg);
    g.rotateX(-Math.PI / 2);
    if (isMark) g.rotateY(r(0, 6.28)); // vary the smudge's shape hit to hit
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, this.heightAt(pos.x + p.getX(i), pos.z + p.getZ(i)) + 0.04);
    g.translate(pos.x, 0, pos.z);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.decalTex[kind] || this.decalTex.crack, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.y = 0;
    m.renderOrder = 5;
    this.scene.add(m);
    // marks soften over their last 60 %; other decals (tar, hunter's mark) hold and fade over the last 20 %
    const fadeT = life * (isMark ? 0.6 : 0.2);
    const entry = this.after(life, (k, t) => { m.material.opacity = Math.max(0, Math.min(1, (entry.dur - t) / fadeT, isMark ? t / 0.08 : 1)); }, () => {
      this.scene.remove(m); g.dispose(); m.material.dispose();
      if (rec) { const i = this.marks.indexOf(rec); if (i >= 0) this.marks.splice(i, 1); }
    });
    const rec = isMark ? { m, e: entry, x: pos.x, z: pos.z, r: radius } : null;
    if (rec) this.marks.push(rec);
    return m;
  }

  // a fusion's debris budget (combat_design.md 10.3, S5): from the fusion's first frame to a second after its clip, its
  // beats share at most 18 rocks (8 on phones), and the live rocks stay under the same cap: the oldest (an earlier skill's,
  // already lying on the ground) are taken out first. entities.js playSkill opens it for a fusion's clip
  fuseBudget(dur) { const cap = GFX.mobile ? 8 : 18; this._fb = { until: (this.clockT || 0) + dur + 1, left: cap, cap }; }
  rocks(pos, n = 10, power = 1) {
    const fb = this._fb && (this.clockT || 0) <= this._fb.until ? this._fb : null;
    if (fb) { n = Math.min(n, fb.left); fb.left -= n; if (n > 0) this.debrisList.splice(0, Math.max(0, this.debrisList.length + n - fb.cap)); }
    for (let i = 0; i < n; i++) {
      if (this.debrisList.length >= 120) break;
      const v = rv(r(2, 6) * power); v.y = Math.abs(v.y) * 1.2 + 3 * power;
      this.debrisList.push({ p: pos.clone().add(V(r(-0.5, 0.5), 0.2, r(-0.5, 0.5))), v, s: r(0.08, 0.26) * power, rot: V(r(0, 6), r(0, 6), r(0, 6)), w: rv(r(4, 12)), age: 0, life: r(1.4, 2.4) });
    }
  }

  spike(pos, h = 1.4, life = 1.6) {
    const m = new THREE.Mesh(this.spikeGeo, this.spikeMat);
    m.castShadow = true;
    const gy = this.ground(pos);
    m.position.set(pos.x, gy - h, pos.z);
    m.rotation.set(r(-0.3, 0.3), r(0, 6), r(-0.3, 0.3));
    const s = r(0.6, 1.0);
    m.scale.set(s * 0.8, h, s * 0.8);
    this.scene.add(m);
    this.after(life, (k) => {
      const up = k < 0.12 ? k / 0.12 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      m.position.y = gy - h * 0.55 + (h * 0.55 + h * 0.1) * (up > 0.999 ? 1 : 1 - Math.pow(1 - up, 3)) - h * 0.1;
    }, () => this.scene.remove(m));
  }

  after(dur, update, done) { const e = { t: 0, dur, update, done }; this.timed.push(e); return e; }
  // a crackling electric arc between two points: a jagged line re-drawn every frame for a moment, a flash at the end
  arc(from, to, color = '#a8dcff', dur = 0.3) {
    const N = 14, pos = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mats = [new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })];
    const lines = mats.map((m) => new THREE.Line(geo, m));
    for (const l of lines) { l.frustumCulled = false; l.renderOrder = 25; this.scene.add(l); }
    const d = to.clone().sub(from), L = d.length();
    const jag = () => {
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1), k = Math.sin(t * Math.PI) * Math.min(0.9, L * 0.06);
        pos[i * 3] = from.x + d.x * t + (Math.random() - 0.5) * k * 2;
        pos[i * 3 + 1] = from.y + d.y * t + (Math.random() - 0.5) * k * 2;
        pos[i * 3 + 2] = from.z + d.z * t + (Math.random() - 0.5) * k * 2;
      }
      geo.attributes.position.needsUpdate = true;
    };
    jag();
    this.emit('flash', to, { size: 1.6, color });
    this.emit('sparks', to, { n: 14, color });
    this.light(to, color, 7, 0.2, 9);
    this.sound('tick'); this.sound('hiss', 0.6);
    this.after(dur, (k) => { jag(); mats[0].opacity = 1 - k; mats[1].opacity = (1 - k) * 0.7; }, () => { for (const l of lines) this.scene.remove(l); geo.dispose(); mats.forEach((m) => m.dispose()); });
  }

  trail(getA, getB, color, width = 1) {
    const t = new Trail(this.scene, color, width);
    const entry = { trail: t, getA, getB };
    this.trails.push(entry);
    return { stop: () => { t.active = false; } };
  }

  cloud(kind, pos, radius = 4, dur = 3, o = {}) {
    const preset = {
      smoke: { color: '#8a847c', alpha: 0.6, size: 1.8 }, chill: { color: '#dff4ff', alpha: 0.55, size: 1.2, add: '#a8e0ff' },
      sand: { color: '#d8bc88', alpha: 0.6, size: 1.2 }, acid: { color: '#7ac040', alpha: 0.45, size: 1.6 },
      herb: { color: '#9ac870', alpha: 0.35, size: 1.6, add: '#c8ff9a' }, powder: { color: '#e8d890', alpha: 0.6, size: 1.0 },
      mist: { color: '#c8f0e0', alpha: 0.35, size: 1.6, add: '#b8ffd8' },
      // Tidewater (level 57-60 skills): a low drift of sea spray, and a brown haze of flung silt
      seaspray: { color: '#e4eef0', alpha: 0.45, size: 1.3, low: true }, silt: { color: '#7a6a52', alpha: 0.55, size: 1.4, low: true },
      // the Rainward Gorge (level 62-65 skills): a low spray of flung red mud, and a thick resin steam off cedar bark
      mud: { color: '#7a4a32', alpha: 0.5, size: 1.3, low: true }, resin: { color: '#e8e0d0', alpha: 0.4, size: 1.7 },
      // the Deadeye's Smoke Charge: a low, uneven bank of grey powder smoke (no glow)
      gunsmoke: { color: '#9a948a', alpha: 0.72, size: 2.7, low: true, dens: 1.6 },
    }[kind] || { color: '#888', alpha: 0.5, size: 1.4 };
    const dir = o.dir;
    let acc = 0;
    const rate = (o.burst ? 0 : 14) * Math.min(2, radius / 3) * (preset.dens || 1);
    const spawnOne = (burst) => {
      let p;
      if (dir) { const d = r(0.5, radius); p = pos.clone().addScaledVector(dir, d).add(V(r(-1, 1) * d * 0.4, 0, r(-1, 1) * d * 0.4)); }
      else { const a = r(0, 6.28), d = Math.sqrt(rnd()) * radius; p = pos.clone().add(V(Math.cos(a) * d, 0, Math.sin(a) * d)); }
      p.y = this.ground(p) + (preset.low ? r(0.1, 0.8) : r(0.2, 1.2)); // (low: a bank that hugs the ground)
      this.alpha.spawn({ pos: p, vel: V(r(-0.4, 0.4), preset.low ? r(0.02, 0.25) : r(0.1, 0.6), r(-0.4, 0.4)).add(burst && dir ? dir.clone().multiplyScalar(r(2, 5)) : V()), age: 0, life: r(1.5, 2.6), size: preset.size * r(0.8, 1.4), tex: TEX.puff, drag: 1.2, alpha: preset.alpha, grow: 1.2, spin: r(-0.4, 0.4), rot: r(0, 6), color: col(preset.color), fadeIn: 0.3 });
      if (preset.add && rnd() < 0.3) this.emit('motes', p, { n: 1, color: preset.add, r: 0.3 });
    };
    for (let i = 0; i < 18 * Math.min(2.2, radius / 3) * (preset.dens || 1); i++) spawnOne(true);
    if (dur > 0.5) this.after(dur, (k, t, dt) => { acc += rate * dt; while (acc > 1) { acc--; spawnOne(false); } });
  }

  // projectile: mesh flying from a to b in `time` (arc height), spin, trail kind, onHit
  projectile(mesh, a, b, { time = 0.5, arc = 0, spin = 0, align = true, trail = null, onHit = null, scale = 1, bounce = 0 } = {}) {
    this.scene.add(mesh);
    mesh.scale.setScalar(scale);
    const prev = a.clone();
    const h = arc * Math.max(1.5, a.distanceTo(b) * 0.25);
    let trailAcc = 0;
    this.after(time, (k, t, dt) => {
      const p = a.clone().lerp(b, k);
      p.y += Math.sin(k * Math.PI) * h;
      mesh.position.copy(p);
      if (align && p.distanceToSquared(prev) > 1e-6) { mesh.lookAt(p.clone().add(p.clone().sub(prev))); mesh.rotateX(Math.PI / 2); }
      if (spin) mesh.rotateZ(spin * dt);
      if (trail) {
        trailAcc += dt * 60;
        while (trailAcc > 1) { trailAcc--; if (trail === 'ballsmoke') { if (rnd() < 0.5) this.alpha.spawn({ pos: p.clone(), vel: V(0, r(0.1, 0.4), 0), age: 0, life: r(0.35, 0.6), size: r(0.1, 0.18), tex: TEX.puff, alpha: 0.3, grow: 1.6, rot: r(0, 6), color: col('#9a948a') }); } else if (trail === 'smoke') this.emit('smoke', p, { n: 1, size: 0.3, alpha: 0.35, lifeK: 0.4 }); else if (trail === 'fire') { this.emit('flame', p, { n: 1, size: 0.35, speed: 0.2 }); } else if (trail === 'motes') this.emit('motes', p, { n: 1, color: mesh.userData.trailColor || '#b8ff9a', r: 0.05 }); else if (trail === 'sparkle') this.add.spawn({ pos: p.clone(), vel: V(), age: 0, life: 0.25, size: 0.08, tex: TEX.glow, alpha: 0.7, rot: 0, color: col(mesh.userData.trailColor || '#ffffff') }); }
      }
      prev.copy(p);
    }, () => { this.scene.remove(mesh); onHit?.(b.clone()); });
  }

  shake(a) { this.rig?.addShake(a); }
  // hit-stop is scoped: only the characters in `who` (EntityViews or character Object3Ds: the attacker and the
  // target) freeze for d seconds; every EntityView reads its own char.userData.hitstopT (see EntityView.update),
  // so other players, mobs, particles and the camera keep running. With no scope it is a no-op.
  hitstop(d, who) {
    if (!(d > 0) || !who) return;
    for (const w of Array.isArray(who) ? who : [who]) {
      const ch = w?.char || w;
      if (ch?.userData) ch.userData.hitstopT = Math.max(ch.userData.hitstopT || 0, d);
    }
  }
  // the old global slow-down, kept for callers that still multiply by it (the gallery); always 1 now
  timeScale() { return this.hitstopT > 0 ? 0.06 : 1; }

  // ---------------------------------------------------------------- composite impacts
  // the blow's flat direction: the attacker's facing, a projectile's flight, or (with neither) camera-sideways so
  // a directional fan still reads across the screen
  hitDir(o) {
    if (o.dir) { const d = V(o.dir.x, 0, o.dir.z); if (d.lengthSq() > 1e-4) return d.normalize(); }
    const e = this.camera.matrixWorld.elements, s = rnd() < 0.5 ? 1 : -1;
    return V(e[0] * s, 0, e[2] * s).normalize();
  }
  // a tiny dark-to-bright hit core: a brief dark smudge with a hot white pinpoint blooming over it
  hitCore(p, s = 1, color = '#fff2d0', life = 0.12) {
    this.alpha.spawn({ pos: p.clone(), vel: V(), age: 0, rot: r(0, 6.28), life: 0.13, size: s * 0.75, tex: TEX.puff, alpha: 0.6, color: C_DARK, grow: 0.7, fadePow: 1 });
    this.add.spawn({ pos: p.clone(), vel: V(), age: 0, rot: 0, life: life * 0.6, size: s * 0.4, tex: TEX.glow, alpha: 1, color: C_WHITE, grow: 1.6, fadePow: 1 });
    this.emit('flash', p, { size: s * 1.3, color, life });
  }
  // layered dust wall for slams: a fast low skirt along the floor and a slower, taller billow behind it
  dustWall(p, R) {
    this.emit('ringdust', p, { n: Math.round(10 + R * 3), r: R * 0.4, speed: 2.2 + R * 0.9, size: 1 + R * 0.08 });
    this.emit('ringdust', p, { n: Math.round(6 + R * 2), r: R * 0.3, speed: 1.2 + R * 0.5, size: 1.4 + R * 0.1, h: 2.2, lifeK: 1.4, alpha: 0.5 });
  }
  impact(kind, pos, o = {}) {
    const g = this.ground(pos);
    const up = pos.clone(); up.y = Math.max(pos.y, g + 1.0);
    const at = o.r ? pos.clone().setY(g + 0.2) : up;
    const dir = this.hitDir(o);
    switch (kind) {
      // melee edge: tiny dark-to-bright core, a spark fan carried along the blow, a few hot flecks that bounce
      case 'slash':
        this.hitCore(up, 1.0, '#fff2d0');
        this.emit('fan', up, { n: 16, dir, color: '#ffe6a8' });
        this.emit('flecks', up, { n: 5, dir, color: '#ffc070' });
        if (o.r) this.emit('ringdust', at, { n: 10, r: o.r, speed: 1.5 + o.r * 0.6 });
        this.light(up, '#ffe0a0', 4, 0.12, 8, true); this.sound('hit'); break;
      case 'sweep':
        this.hitCore(up, 0.9, '#fff2d0');
        this.emit('fan', up, { n: 10, dir, color: '#ffe6a8', width: 3.2 }); // (review 18 Nov: width 6 fanned out of the spin's contact like rays)
        this.emit('flecks', up, { n: 4, dir, color: '#ffc070' });
        this.emit('ringdust', at, { n: 12, r: o.r || 1.2, speed: 1.6 + (o.r || 1.2) * 0.6 });
        this.sound('hit'); break;
      case 'pierce':
        this.hitCore(up, 0.8, '#fff6e0');
        this.emit('fan', up, { n: 12, dir, color: '#fff0d0', width: 1.8, speed: 1.15 });
        this.emit('flecks', up, { n: 3, dir, color: '#ffd090' });
        this.emit('dust', up, { n: 2, size: 0.45, alpha: 0.45 });
        this.light(up, '#ffe8c0', 3, 0.1, 7, true); this.sound('hit'); break;
      // metal on metal: bright white spray, a quick blue-white flash
      case 'shield': case 'clang': case 'parry':
        this.hitCore(up, 1.2, '#cfe0ff', 0.1);
        // one-sided: everything flies off along the blow, so the spray never reads as a radiating burst
        this.emit('sparks', up, { n: 6, color: '#ffffff', size: 1.15, dir });
        // (review 18 Nov) a narrower spray: at width 6 a thrown shield's clang, seen along the throw from behind the hero,
        // splayed into rays round a point behind his head (a sunburst; Anvil Fall's return)
        this.emit('fan', up, { n: 14, dir, color: '#f4f8ff', width: 2.6 });
        this.emit('flecks', up, { n: 4, color: '#fff4e0', c2: '#ff7020' });
        this.light(up, '#d8e8ff', 6, 0.12, 9); this.sound('clang'); break;
      // blunt: thud of dust thrown along the floor under the target, grit, a small soft light pop
      case 'blunt':
        this.hitCore(up, 1.1, '#ffe0b0');
        this.emit('sparks', up, { n: 6, color: '#ffc070' });
        this.emit('ringdust', pos.clone().setY(g), { n: 16, r: 0.8, speed: 3.4, size: 0.95, alpha: 0.7 });
        this.emit('grit', up, { n: 8 });
        this.emit('dust', up, { n: 3, size: 0.7 });
        this.light(up, '#ffd8a0', 3.5, 0.1, 7, true); this.sound('thud'); break;
      case 'execute':
        this.hitCore(up, 1.8, '#ffb070');
        this.emit('fan', up, { n: 22, dir, color: '#ffd090', width: 5 });
        this.emit('sparks', up, { n: 10, color: '#ffd090' });
        this.emit('flecks', up, { n: 10, dir, color: '#ffb060' });
        this.emit('ringdust', pos.clone().setY(g), { n: 16, r: 1, speed: 3.6, size: 0.9 });
        this.emit('grit', up, { n: 6 });
        this.decal('smudge', pos.clone().setY(g), 1.3, 2.5);
        this.light(up, '#ffa060', 9, 0.25); this.sound('thud'); break;
      case 'shatter':
        this.hitCore(up, 1.3, '#f0f4ff');
        this.emit('shards', up, { n: 16, color: '#b8c0c8' });
        this.emit('fan', up, { n: 12, dir, color: '#fff0d0', width: 5 });
        this.emit('grit', up, { n: 10 });
        this.emit('ringdust', pos.clone().setY(g), { n: 12, r: 1, speed: 3.4 });
        this.decal('smudge', pos.clone().setY(g), 1.2, 2.5);
        this.sound('clang'); break;
      // big slams: a layered dust wall (fast low skirt + slow taller billow), rocks, grit, a steam puff,
      // the existing ground shockwave, and a short-lived impact smudge on the bigger ones
      case 'earth': {
        const R = o.r || 2, p = pos.clone().setY(g);
        this.rocks(p, Math.round(8 + R * 2), Math.min(1.6, 0.7 + R * 0.12));
        this.dustWall(p, R);
        this.emit('dust', p.clone().setY(g + 0.3), { n: 4 + R, spread: R * 0.3, size: 1.2 });
        this.emit('grit', p.clone().setY(g + 0.3), { n: 6 + R, speed: 1.2 });
        this.emit('steam', p.clone().setY(g + 0.2), { n: 3, size: 1.2 });
        this.ring(p, '#e8d8c0', R * 1.1, 0.5);
        if (R >= 3) this.decal('smudge', p, R * 0.55, 3);
        this.light(p.clone().setY(g + 0.8), '#ffd8a8', 3 + R * 0.5, 0.12, 6 + R, true);
        this.sound('boom');
        break;
      }
      case 'blast': {
        const R = o.r || 3, p = pos.clone().setY(g);
        this.hitCore(up, 2.4, '#fff0c0', 0.16);
        this.dustWall(p, R);
        this.emit('sparks', up, { n: 20, color: '#ffc070' });
        this.emit('flecks', up, { n: 8, color: '#ffb060' });
        this.emit('steam', p.clone().setY(g + 0.3), { n: 4, size: 1.3 });
        this.emit('smoke', p.clone().setY(g + 0.5), { n: 4, spread: 0.8, size: 0.9, alpha: 0.4 });
        this.rocks(p, 8, 1);
        this.decal('scorch', p, Math.min(3, R * 0.5), 3.5);
        this.light(up, '#ffc080', 10, 0.25, 14); this.sound('boom'); break;
      }
      case 'fire': this.emit('flame', at, { n: 18, spread: 0.6 }); this.emit('embers', at, { n: 16, spread: 0.8 }); this.emit('smoke', at, { n: 6, spread: 0.6 }); this.emit('shards', at, { n: 8, color: '#e8f0ff' }); this.light(at, '#ff8030', 10, 0.6, 12); this.decal('scorch', at, 1.6, 5); this.sound('glass'); this.sound('fire'); break;
      case 'bigfire': for (let i = 0; i < 3; i++) this.emit('flame', at.clone().add(V(r(-1, 1), 0, r(-1, 1))), { n: 18, spread: 0.8, size: 1.4 }); this.emit('embers', at, { n: 40, spread: 1.5 }); this.emit('smoke', at, { n: 18, spread: 1.4, size: 1.6 }); this.ring(at, '#ffa050', 4.5, 0.5); this.light(at, '#ff7020', 16, 0.8, 16); this.shake(0.5); this.decal('scorch', at, 3.2, 7); this.sound('boom'); break;
      case 'grand': {
        const p = at.clone();
        this.emit('flash', p.clone().setY(g + 2), { size: 10, color: '#fff4d0', life: 0.3 });
        for (let i = 0; i < 6; i++) this.emit('flame', p.clone().add(V(r(-2.5, 2.5), r(0, 1), r(-2.5, 2.5))), { n: 22, spread: 1.2, size: 2.2, speed: 1.6 });
        // mushroom column of smoke
        for (let i = 0; i < 40; i++) this.alpha.spawn({ pos: p.clone().add(V(r(-1.5, 1.5), r(0, 2), r(-1.5, 1.5))), vel: V(r(-1.4, 1.4), r(4, 9), r(-1.4, 1.4)), age: 0, life: r(2.5, 4), size: r(2, 3.4), tex: TEX.puff, drag: 1.1, alpha: 0.7, grow: 2.2, spin: r(-0.4, 0.4), rot: r(0, 6), color: col('#4a403a'), fadeIn: 0.15 });
        this.emit('embers', p, { n: 90, spread: 3 });
        this.rocks(p, 24, 1.8);
        this.dustWall(p.clone().setY(g), 7);
        this.ring(p, '#ffb060', 9, 0.7); this.ring(p, '#fff0c0', 6, 0.45, { delay: 0.1 });
        this.light(p.clone().setY(g + 3), '#ff7a20', 30, 1.2, 30);
        this.shake(1.3); this.hitstop(0.08, o.who);
        this.decal('scorch', p, 6, 10);
        this.sound('boom'); this.sound('boom');
        break;
      }
      case 'acid': this.emit('drops', at, { n: 22, color: '#8ee04a', additive: true }); this.emit('smoke', at, { n: 8, color: '#7ab040', alpha: 0.4 }); this.emit('shards', at, { n: 8 }); this.sound('glass'); this.sound('hiss'); break;
      case 'acidcloud': this.emit('shards', at, { n: 10 }); this.cloud('acid', pos, 5, 6); this.sound('glass'); this.sound('hiss'); break;
      case 'tar': this.emit('drops', at, { n: 18, color: '#1a1410' }); this.decal('tar', pos, 3.4, 6); this.sound('splat'); break;
      case 'shrapnel': this.hitCore(up, 1.6, '#fff0c0'); this.emit('sparks', up, { n: 22, color: '#ffc060' }); this.emit('flecks', up, { n: 6, color: '#ffb060' }); this.emit('grit', up, { n: 6 }); this.emit('ringdust', pos.clone().setY(g), { n: 8, r: 0.8, speed: 3 }); this.emit('smoke', at, { n: 8, size: 0.9 }); this.light(up, '#ffb060', 8, 0.2); this.shake(0.3); this.sound('boom'); break;
      case 'smoke': this.cloud('smoke', pos, 5, 5); this.sound('puff'); break;
      case 'heal': case 'bigheal': case 'hot': case 'cleanse': {
        const c = kind === 'cleanse' ? '#e8fbff' : '#a8ff7a';
        this.emit('motes', pos.clone().setY(g), { n: kind === 'bigheal' ? 50 : 26, color: c, r: 0.7 });
        this.emit('motes', pos.clone().setY(g), { n: kind === 'bigheal' ? 14 : 8, color: kind === 'cleanse' ? '#fff8e0' : '#e8f890', r: 0.5 });
        this.emit('steam', pos.clone().setY(g + 0.3), { n: kind === 'bigheal' ? 5 : 3, color: kind === 'cleanse' ? '#e8f8ff' : '#d8f4c4', alpha: 0.28, size: 1.1, speed: 0.6 });
        this.emit('glow', up, { size: kind === 'bigheal' ? 3.4 : 2.2, color: c, alpha: 0.5, life: 0.7 });
        this.ring(pos, c, kind === 'bigheal' ? 2.2 : 1.6, 0.6);
        this.emit('leaves', up, { n: kind === 'hot' ? 8 : 4, color: '#8acc4a' });
        this.sound('heal');
        break;
      }
      case 'bark': case 'sap': this.emit('motes', pos.clone().setY(g), { n: 24, color: '#ffc860', r: 0.6 }); this.emit('glow', up, { size: 2, color: '#ffb040', alpha: 0.5 }); this.sound('heal'); break;
      case 'elixir': this.emit('drops', up.clone().setY(up.y + 2), { n: 30, color: '#9adcff', additive: true }); this.emit('flash', up.clone().setY(up.y + 2), { size: 3, color: '#c0f0ff' }); this.sound('glass'); break;
      case 'mark': { const d = this.decal('mark', pos, 1.3, 2.2); this.emit('flash', up, { size: 1.6, color: '#ff7050' }); break; }
      case 'sand': this.emit('sand', at, { n: 16, spread: o.r ? o.r * 0.4 : 0.6 }); this.sound('puff'); break;
      case 'net': this.emit('leaves', up, { n: 10, color: '#a08a5a' }); this.sound('thud'); break;
      case 'pin': this.hitCore(up, 0.5, '#fff0d0'); this.emit('dust', at, { n: 3, size: 0.55 }); this.emit('sparks', up, { n: 5 }); this.emit('grit', up, { n: 4 }); break;
      case 'seed': this.emit('leaves', up, { n: 16 }); this.emit('dust', at, { n: 10, color: '#8a6a3a' }); this.emit('drops', at, { n: 10, color: '#6a9a2a' }); this.sound('thud'); break;
      // ---- the Deadeye's shot: a ragged spray of sparks thrown off one side of the plate, a grey puff, grit (no light)
      case 'ball': case 'hotball': case 'burn': {
        const side = V(-dir.z, 0, dir.x).multiplyScalar(rnd() < 0.5 ? 1 : -1);
        this.emit('fan', up, { n: o.big ? 14 : 8, dir: dir.clone().multiplyScalar(0.4).add(side), color: '#ffd890', width: 2.2, speed: 0.8 });
        this.emit('grit', up, { n: o.big ? 6 : 3, speed: 0.8 });
        this.emit('smoke', up, { n: o.big ? 3 : 1, size: 0.45, alpha: 0.4, lifeK: 0.5, color: '#8a847c' });
        // a hot ball or burning wadding: the plate keeps smouldering a moment (rising grey smoke, never a glow)
        if (kind !== 'ball') { let acc = 0; this.after(1.6, (k, t, dt) => { acc += dt * 9; while (acc > 1) { acc--; this.emit('smoke', up.clone().add(V(r(-0.2, 0.2), r(-0.3, 0.2), r(-0.2, 0.2))), { n: 1, size: 0.4, alpha: 0.35 * (1 - k), lifeK: 0.6, color: kind === 'burn' ? '#6a645c' : '#4a4642', speed: 0.6 }); } }); }
        this.sound(o.big ? 'clang' : 'hit'); break;
      }
      // the ball skips: a hit, then two or three spark pings off the plating beside it
      case 'ricochet': {
        this.impact('ball', pos, o);
        for (let i = 0; i < 3; i++) this.after(0.08 + i * 0.09, null, () => { const p = up.clone().add(V(r(-2.2, 2.2), r(-0.5, 0.3), r(-2.2, 2.2))); this.emit('fan', p, { n: 5, dir: rv(1), color: '#ffe0a0', width: 1.6, speed: 0.7 }); this.sound('tick'); });
        break;
      }
      // two balls on a chain wrap the legs: a clank, dust kicked up round the feet
      case 'chainwrap': this.emit('fan', up.clone().setY(g + 0.5), { n: 8, dir, color: '#ffe0a0', width: 3 }); this.emit('ringdust', pos.clone().setY(g), { n: 10, r: 0.6, speed: 2 }); this.sound('chain'); this.sound('clang'); break;
      // a chalk pellet bursts into white dust on the plate
      case 'chalk': this.emit('dust', up, { n: 6, size: 0.5, color: '#f2eee4', alpha: 0.75, speed: 0.8 }); this.emit('grit', up, { n: 3, color: '#e8e4da' }); this.sound('puff'); break;
      // a square steam canister bursts over the ground: shot thrown along the floor, a jet of white steam, dust
      case 'canister': {
        const p = pos.clone().setY(g);
        this.emit('steam', p.clone().setY(g + 0.6), { n: 10, size: 1.4, alpha: 0.5, speed: 1.6 });
        for (let i = 0; i < 3; i++) { const d = rv(1); d.y = 0.15; this.emit('fan', p.clone().setY(g + 0.4), { n: 6, dir: d, color: '#ffd890', width: 2, speed: 0.9 }); }
        this.dustWall(p, o.r || 3);
        this.emit('grit', p.clone().setY(g + 0.3), { n: 8 });
        this.sound('boom'); this.sound('hiss'); break;
      }
      // a paper cartridge bursts into a low bank of powder smoke
      case 'gunsmoke': this.cloud('gunsmoke', pos, o.r || 5, 5); this.emit('ringdust', pos.clone().setY(g), { n: 12, r: 1, speed: 2.5, color: '#8a847c' }); this.sound('puff'); break;
      // ---- Tidewater (level 57-60 skills): water, mud, brine, salt and tar, all physical ----
      // sea water thrown off a blow: white-grey drops, a low drift of spray and a wet skirt along the ground
      case 'seaspray': {
        this.hitCore(up, 0.8, '#f0f6f8');
        this.emit('drops', up, { n: 26, color: '#d8e8ee' });
        this.emit('steam', up, { n: 4, color: '#eef4f6', alpha: 0.3, size: 1.2, speed: 1.2 });
        this.emit('ringdust', at.clone().setY(g + 0.1), { n: 10, r: o.r ? o.r * 0.3 : 0.6, speed: 2.2, color: '#cfdde2' });
        if (o.r) this.cloud('seaspray', pos, o.r * 0.7, 1.2);
        this.sound('splat'); break;
      }
      // wet silt flung up by a heavy blow into the ground: brown clods, a mud smear and a brown haze
      case 'silt': {
        const p = pos.clone().setY(g);
        this.hitCore(up, 1.0, '#e8dcc0');
        this.emit('drops', p.clone().setY(g + 0.3), { n: 30, color: '#5a4a34' });
        this.emit('dust', p.clone().setY(g + 0.2), { n: 8, color: '#7a6a52', size: 1.1 });
        this.dustWall(p, o.r || 2);
        this.decal('smudge', p, (o.r || 2) * 0.8, 5);
        this.sound('splat'); this.sound('thud'); break;
      }
      // boiled brine and vitriol: grey-green drops, white salt flecks and a stinging steam
      case 'brine': {
        this.emit('drops', at, { n: 24, color: '#9ab8a0' });
        this.emit('grit', at, { n: 10, color: '#f2f0e8' });
        this.emit('steam', at, { n: 6, color: '#dfe8e0', alpha: 0.4, size: 1.3, speed: 1.0 });
        this.emit('shards', at, { n: 8 });
        this.sound('glass'); this.sound('hiss'); break;
      }
      // a charge of rock salt: white grit bursting across the plating and a puff of white dust
      case 'salt':
        this.hitCore(up, 0.7, '#fff8ec');
        this.emit('grit', up, { n: 16, color: '#f4f2ea' });
        this.emit('dust', up, { n: 4, size: 0.6, color: '#ece8de', alpha: 0.7 });
        this.emit('fan', up, { n: 8, dir, color: '#fffaf0' });
        break;
      // a pot of boiling pine tar bursting: black splash, a wide tar stain, white steam off the hot tar
      case 'tarpot': {
        const p = pos.clone().setY(g);
        this.emit('drops', p.clone().setY(g + 0.5), { n: 60, color: '#1a1410' });
        this.emit('drops', p.clone().setY(g + 1.2), { n: 30, color: '#2a2018' });
        this.emit('dust', p.clone().setY(g + 0.3), { n: 6, color: '#2a2420', size: 1.2, alpha: 0.6 });
        this.emit('steam', p.clone().setY(g + 0.4), { n: 12, color: '#e8e4dc', alpha: 0.45, size: 1.6, speed: 1.2 });
        this.emit('smoke', p.clone().setY(g + 0.3), { n: 5, color: '#4a4440', alpha: 0.4 });
        this.decal('tar', p, o.r || 5, 7);
        this.sound('splat'); this.sound('hiss'); break;
      }
      // ---- the Rainward Gorge (level 62-65 skills): mud, stone, lime, timber and gravel, all physical ----
      // wet red-brown gorge mud flung off a blow: clods, muddy water and a smear on the ground
      case 'mud': {
        const p = pos.clone().setY(g);
        this.hitCore(up, 0.8, '#e8d8c0');
        this.emit('drops', up, { n: 22, color: '#6a3a22' });
        this.emit('drops', p.clone().setY(g + 0.3), { n: 14, color: '#8a5a3a' });
        this.emit('dust', p.clone().setY(g + 0.2), { n: 4, color: '#7a4a32', size: 0.9, alpha: 0.5 });
        if (o.r) { this.decal('smudge', p, o.r * 0.6, 5); this.cloud('mud', pos, o.r * 0.7, 1.2); }
        this.sound('splat'); break;
      }
      // a shield set down hard on stony ground: grey stone chips, grit and a puff of stone dust
      case 'stonechip': {
        const p = pos.clone().setY(g);
        this.emit('grit', p.clone().setY(g + 0.3), { n: 18, color: '#8a8a84' });
        this.emit('shards', p.clone().setY(g + 0.3), { n: 10, color: '#a8a49a' });
        this.emit('dust', p.clone().setY(g + 0.2), { n: 6, color: '#9a968c', size: 1.0, alpha: 0.6 });
        this.emit('drops', p.clone().setY(g + 0.2), { n: 10, color: '#6a5a4a' });
        this.sound('thud'); break;
      }
      // burnt lime bursting on wet plating: white chalky lumps and a hard boil of white steam where the rain meets it
      case 'lime':
        this.emit('grit', at, { n: 16, color: '#f2f0e8' });
        this.emit('dust', at, { n: 6, size: 0.8, color: '#eeeae0', alpha: 0.75 });
        this.emit('steam', at, { n: 10, color: '#f4f4f0', alpha: 0.5, size: 1.4, speed: 1.4 });
        this.emit('shards', at, { n: 8 });
        this.sound('glass'); this.sound('hiss'); break;
      // a drum of lime mortar bursting: a low, flat grey splash, a wide grey stain that sets, steam off the hot lime
      case 'mortar': {
        const p = pos.clone().setY(g);
        this.emit('drops', p.clone().setY(g + 0.4), { n: 56, color: '#8a8880' });
        this.emit('drops', p.clone().setY(g + 0.9), { n: 24, color: '#b8b4aa' });
        this.emit('ringdust', p.clone().setY(g + 0.1), { n: 16, r: 1.2, speed: 3.2, color: '#a8a49a' });
        this.emit('steam', p.clone().setY(g + 0.4), { n: 14, color: '#f0eee8', alpha: 0.5, size: 1.6, speed: 1.2 });
        this.emit('shards', p.clone().setY(g + 0.4), { n: 6, color: '#d8d4ca' });
        this.decal('smudge', p, o.r || 5, 7);
        this.shake(0.3);
        this.sound('splat'); this.sound('hiss'); break;
      }
      // a heavy blow on timber and wet ground: pale wood splinters, bark chips and mud
      case 'splinters': {
        const p = pos.clone().setY(g);
        this.emit('shards', up, { n: 16, color: '#c8a070' });
        this.emit('flecks', up, { n: 6, color: '#8a6a44' });
        this.emit('drops', p.clone().setY(g + 0.3), { n: 20, color: '#6a3a22' });
        this.emit('dust', p.clone().setY(g + 0.2), { n: 5, color: '#7a5a3a', size: 1.0, alpha: 0.5 });
        if (o.r) this.decal('smudge', p, o.r * 0.5, 5);
        this.sound('thud'); break;
      }
      // a charge of river gravel: grey grit bursting across the tracks and a puff of grey dust
      case 'gravel':
        this.hitCore(up, 0.6, '#f0ece4');
        this.emit('grit', up, { n: 16, color: '#7a7a74' });
        this.emit('shards', up, { n: 6, color: '#9a968c' });
        this.emit('dust', up, { n: 3, size: 0.6, color: '#8a8680', alpha: 0.6 });
        break;
      default: this.hitCore(up, 0.9, '#ffffff'); this.emit('sparks', up, { n: 10 }); this.emit('dust', up, { n: 2, size: 0.5 });
    }
    if (o.shake) this.shake(o.shake);
    if (o.stop) this.hitstop(o.stop, o.who);
  }

  // the same noise twice on one frame (an impact kind's own `hit` and the tier layer's `hit`) only doubled its loudness and
  // phased; one copy per frame (S1 feel review)
  sound(s) {
    if (this._sndF !== this.frameN) { this._sndF = this.frameN; (this._sndSet ||= new Set()).clear(); }
    if (this._sndSet.has(s)) return;
    this._sndSet.add(s);
    this.sfx?.play(s);
  }

  // S1 tier layers on a contact (combat_design.md 2.1, 2.8, 2.9), on top of the impact kind's own core and sparks:
  // the hit-stop on the attacker and target, the sound layers on this frame (and `crack` as the stop releases), more
  // directional sparks, debris from the rock pool (0 / 4 / 10 / 16 for T1-T4), a dust puff at the target's feet 0.03 s
  // later, one plain dust ring from T3 (never a second where the kind already threw one), a mark on T4 slams, and for your
  // own hits the camera (shove, punch) and a short buzz on phones. o: { at, feet, dir, who, local, kind, slam, ranged, upgrade }
  tierHit(T, o) {
    const t = T.tier;
    if (!t) { if (!o.upgrade) this.sound('tick'); return; }
    const stopOn = SETTINGS.hitstop !== false;
    if (stopOn && T.stop) this.hitstop(T.stop, o.ranged ? [o.who?.[1]] : o.who);
    if (o.local) this.shake(T.shake); else if (t >= 4) this.shake(T.shake * 0.5);
    for (const s of T.snd) this.sound(s);
    if (t === 3 && o.kind !== 'shield' && o.kind !== 'clang') this.sound('clang'); // (plate: every enemy is a machine)
    if (T.duck) this.sfx?.duck?.(T.duck);
    if (T.crack) this.after(stopOn ? T.stop : 0.02, null, () => this.sound('crack'));
    const dir = o.dir || V(1, 0, 0), at = o.at, feet = (o.feet || at).clone();
    feet.y = this.ground(feet);
    const spk = [0, 0, 6, 12, 20, 26][t];
    if (spk && !o.upgrade) this.emit('fan', at, { n: GFX.mobile ? Math.ceil(spk / 2) : spk, dir, color: '#ffe0a0' });
    const ROCKY = new Set(['earth', 'grand', 'blast']);
    const deb = [0, 0, 4, 10, 16, 16][t];
    if (deb && !ROCKY.has(o.kind)) this.rocks(feet.clone().setY(feet.y + 0.5), GFX.mobile ? Math.ceil(deb / 2) : deb, 0.32 + t * 0.06);
    const RINGED = new Set(['sweep', 'blunt', 'execute', 'shatter', 'earth', 'blast', 'grand']);
    this.after(0.03, null, () => {
      this.emit('dust', feet.clone().setY(feet.y + 0.15), { n: 2 + t * 2, spread: 0.3, size: 0.55 + t * 0.12, alpha: 0.5 });
      if (t >= 3 && !RINGED.has(o.kind)) this.emit('ringdust', feet, { n: 8 + t * 3, r: 0.5, speed: 2 + t * 0.4, size: 0.8 });
    });
    if (t >= 4 && o.slam) this.decal('crack', feet, 2.2, 4);
    if (o.local) {
      this.rig?.shove?.(dir, T.kick, o.slam ? -0.6 : 0);
      if (T.punch) this.rig?.punch?.(T.punch, t >= 4 ? 0.2 : 0.14);
      if (t >= 3 && GFX.mobile && SETTINGS.vibrate !== false) try { navigator.vibrate?.(t >= 4 ? 28 : 14); } catch { /* no vibration */ }
    }
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    if (this.hitstopT > 0) this.hitstopT -= dt;
    this.frameN++;
    this.clockT = (this.clockT || 0) + dt; // (FX's own clock: when a shot in flight reaches its target, see runProjectile)
    this.contact.update(this.shadowSource, this.camera);
    this.add.update(dt); this.alpha.update(dt);
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const e = this.trails[i];
      if (e.trail.active) e.trail.push(e.getA(), e.getB());
      if (!e.trail.update(dt)) { e.trail.dispose(this.scene); this.trails.splice(i, 1); }
    }
    for (let i = this.timed.length - 1; i >= 0; i--) {
      const t = this.timed[i];
      t.t += dt;
      t.update?.(Math.min(1, t.t / t.dur), t.t, dt);
      if (t.t >= t.dur) { t.done?.(); this.timed.splice(i, 1); }
    }
    for (const s of this.lights) {
      if (s.owner) { if (s.seen >= this.frameN - 1) continue; s.owner = null; s.dur = 0; }
      if (s.dur > 0 && s.t < s.dur) { s.t += dt; const k = s.t / s.dur; s.l.intensity = s.peak * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85); }
      else s.l.intensity = 0;
    }
    // debris physics
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let n = 0;
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      d.age += dt;
      if (d.age > d.life) { this.debrisList.splice(i, 1); continue; }
      d.v.y -= 18 * dt;
      d.p.addScaledVector(d.v, dt);
      const gy = this.heightAt(d.p.x, d.p.z) + d.s * 0.4;
      if (d.p.y < gy) { d.p.y = gy; d.v.y *= -0.35; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.6); }
      d.rot.addScaledVector(d.w, dt);
      const s = d.s * (d.age > d.life - 0.4 ? (d.life - d.age) / 0.4 : 1);
      m4.compose(d.p, q.setFromEuler(e.set(d.rot.x, d.rot.y, d.rot.z)), V(s, s, s));
      this.debris.setMatrixAt(n++, m4);
    }
    this.debris.count = n;
    this.debris.instanceMatrix.needsUpdate = true;
  }

  // ======================================================================
  // run a choreography event. ctx: { char, animator, cls, origin(V3 feet), yaw, target(V3), targetEnt, color, held:{} }
  run(ev, ctx) {
    const char = ctx.char, bones = char.userData.bones;
    const fwd = V(Math.sin(ctx.yaw), 0, Math.cos(ctx.yaw));
    const feet = () => char.getWorldPosition(V());
    const tgt = () => (ctx.targetEnt?.pos ? ctx.targetEnt.pos.clone() : ctx.target ? ctx.target.clone() : feet().addScaledVector(fwd, 3));
    const front = (d) => feet().addScaledVector(fwd, d);
    const where = (at) => {
      if (at === 'self') return feet();
      if (at === 'front1') return front(1.4);
      if (at === 'front3') return front(3);
      if (at === 'weapon' || at === 'weaponR') return ctx.animator.weaponPoint('R', 0.8);
      if (at === 'weaponTip') return ctx.animator.weaponPoint('R', 1.2);
      if (at === 'shieldL') return bones.foreL.localToWorld(V(0.15, -0.15, 0.1));
      if (at === 'handL') return bones.handL.localToWorld(V(0, -0.08, 0));
      if (at === 'handR') return bones.handR.localToWorld(V(0, -0.08, 0));
      if (at === 'bow') return bones.handL.localToWorld(V(0, -0.06, 0.1));
      if (at === 'rod') return ctx.animator.weaponPoint('R', 1.2);
      if (at === 'targetLow') { const t = tgt(); t.y = this.ground(t) + 0.4; return t; }
      if (at === 'cone') return front(2);
      return tgt();
    };
    switch (ev.e) {
      case 'trail': {
        if (ev.on) {
          ctx.trails = ctx.trails || {};
          const side = ev.side || 'R';
          const along = ev.along ?? (side === 'R' ? 0.95 : 0.3);
          const bone = bones['weapon' + side];
          ctx.trails[side]?.stop();
          ctx.trails[side] = this.trail(() => bone.localToWorld(V(0, 0, along * 0.25)), () => bone.localToWorld(V(0, 0, along)), ev.color || '#ffffff', ev.w);
          if ((ev.w || 1) >= 1.2) this.windup(ctx, feet, fwd); // heavy swings telegraph themselves
        } else { for (const k of Object.keys(ctx.trails || {})) ctx.trails[k].stop(); ctx.trails = {}; }
        break;
      }
      case 'impact': {
        // a spin's contact (k_spin: Turning Riposte, Sidewind Cut) sits on the machine it reached and sprays away from the
        // hero, so from above there is no spark burst at the hero's centre inside the spin's ring (review 18 Nov, 10.2)
        // (a self-cast spin has no target here: the contact goes to the blade's tip, out at the edge of the swing)
        const spinOn = ev.at === 'self' && ev.kind === 'sweep';
        const spinT = spinOn && ctx.targetEnt?.pos && ctx.targetEnt.pos.distanceTo(feet()) < (ev.r || 4) + 1.5;
        const p = spinT ? where('target').setY(feet().y + 1.1) : spinOn ? where('weaponTip') : ev.at ? where(ev.at) : where('target');
        const dir = spinOn ? p.clone().sub(feet()).setY(0).normalize() : fwd.clone();
        if (spinOn && dir.lengthSq() < 0.5) dir.copy(fwd);
        const sk = ctx.as ? skillOf(ctx.as) : ev.sk ? skillOf(ev.sk) : null; // (a fusion playing another clip: its own tier)
        if (sk) {
          // S1: the skill's tier (shared/feel.js) owns the stop, shake, camera and sound layers; the kind keeps its look
          let T = tierOf(sk, ev.hi || 0);
          if ((ctx.pendHt || 0) > T.tier) T = tierInfo(ctx.pendHt); // (the server already said: a break or a lift, T3)
          ctx.pendHt = 0;
          if (ctx.targetEnt) { ctx.targetEnt.slamHitAt = performance.now(); if (ctx.targetEnt.react?.slam) ctx.targetEnt.react.slam.go = true; } // (a fusion's slam starts on the blade's contact, entities.js)
          this.impact(ev.kind, p, { r: spinOn ? undefined : ev.r, dir, who: [char, ctx.targetEnt] });
          const tp = ctx.targetEnt?.pos && (spinOn || !(ev.at === 'self' && ev.r)) ? ctx.targetEnt.pos.clone() : p.clone();
          this.tierHit(T, { at: p, feet: tp, dir, who: [char, ctx.targetEnt], local: !!ctx.local, kind: ev.kind, slam: ev.kind === 'earth' || (ev.at === 'self' && !!ev.r && !spinOn) });
          // (a self-cast round contact, a spin with no target, covers every machine it reached: '*', so the server's word for
          // each of them does not play the tier a second time; review 18 Nov, Turning Riposte threw 48 rocks)
          if (ctx.src) ctx.src.lastImpact = { at: performance.now(), tier: T.tier, tgt: ctx.targetEnt?.id ?? (ev.at === 'self' && ev.r ? '*' : undefined) };
        } else this.impact(ev.kind, p, { r: ev.r, shake: ev.shake, stop: ev.stop, dir, who: [char, ctx.targetEnt] });
        if (ev.at === 'cone') { for (let i = -2; i <= 2; i++) { const d = fwd.clone().applyAxisAngle(V(0, 1, 0), i * 0.35); this.emit('sparks', feet().addScaledVector(d, 3).setY(feet().y + 1), { n: 4, color: '#ffe8b0' }); } }
        break;
      }
      case 'ring': this.ring(ev.at === 'target' ? tgt() : ev.at === 'front1' ? front(1.4) : feet(), ev.color, ev.r, 0.6, { delay: ev.delay }); break;
      case 'shake': this.shake(ev.amt); break;
      case 'hitstop': this.hitstop(ev.dur, ev.self ? [char] : [char, ctx.targetEnt]); break; // (self: the weapon meets the ground at a ranged release; the target stops on arrival)
      case 'sound': this.sound(ev.s); break;
      case 'dust': this.emit('dust', feet().add(V(0, 0.15, 0)), { n: 8, spread: 0.4, color: this.ground(feet()) > -99 ? '#b8a07a' : '#b8a07a' }); break;
      case 'dash': case 'leap': {
        const f = feet();
        this.emit('dust', f.clone().add(V(0, 0.15, 0)), { n: 10, spread: 0.5 });
        this.emit('grit', f.clone().add(V(0, 0.2, 0)), { n: 4, speed: 0.8 });
        if (ev.e === 'leap') this.emit('ringdust', f, { n: 8, r: 0.4, speed: 2.2, size: 0.7 });
        this.sound('whoosh'); break;
      }
      // S4 (Stormfall's take-off): a dust column up to ev.h m over the take-off point with a few rocks, and the camera's lift
      // for the own hero (camera.js lift: up, back, for dur s)
      case 'column': { const f = feet(), h = ev.h || 2; for (let i = 0; i < 5; i++) this.emit('dust', f.clone().add(V(0, 0.2 + (i / 4) * (h - 0.2), 0)), { n: 3, spread: 0.25 + i * 0.05, size: 0.8, speed: 1.2 }); if (ev.rocks) this.rocks(f.clone().add(V(0, 0.3, 0)), ev.rocks, 0.5); break; }
      case 'camlift': if (ctx.local) this.rig?.lift?.(ev.up ?? 2, ev.back ?? 2.5, ev.dur ?? 1); break;
      case 'flash': { const p = ev.at ? where(ev.at) : feet().add(V(0, 1.2, 0)); this.emit('flash', p, { size: ev.big ? 7 : 3, color: ev.color, life: ev.big ? 0.35 : 0.2 }); this.light(p, ev.color, ev.big ? 20 : 8, 0.35, 16); if (ev.big) this.sound('boom'); break; }
      case 'motes': {
        const dur = ev.dur || 0.01, n = ev.n || 20;
        const p0 = () => (ev.at ? where(ev.at) : feet());
        if (dur <= 0.05) this.emit('motes', p0(), { n, color: ev.color });
        else {
          // a channel at the hand also vents thin wisps of steam from the kit (alchemist flasks, salves)
          let acc = 0, wisp = 0;
          this.after(dur, (k, t, dt) => {
            acc += (n / dur) * dt;
            while (acc > 1) { acc--; this.emit('motes', p0(), { n: 1, color: ev.color, r: ev.at ? 0.15 : 0.6 }); }
            if (ev.at) { wisp += dt * 7; while (wisp > 1) { wisp--; this.emit('steam', p0(), { n: 1, size: 0.35, alpha: 0.28, lifeK: 0.6, speed: 0.5 }); } }
          });
        }
        break;
      }
      case 'aura': {
        { const f = feet(); for (let i = 0; i < 2; i++) { const a = r(0, 6.28); this.emit('steam', f.clone().add(V(0, 0.25, 0)), { n: 2, dir: V(Math.cos(a), 0.5, Math.sin(a)), size: 0.8, alpha: 0.35 }); } }
        const glowS = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.ringTex, color: ev.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        glowS.rotation.x = -Math.PI / 2;
        this.scene.add(glowS);
        let acc = 0;
        this.after(ev.dur || 1.5, (k, t, dt) => {
          const p = feet();
          glowS.position.set(p.x, this.ground(p) + 0.06, p.z);
          const s = 2.2 + Math.sin(t * 6) * 0.1;
          glowS.scale.set(s, s, 1);
          glowS.material.opacity = (k < 0.1 ? k / 0.1 : 1 - Math.max(0, k - 0.6) / 0.4) * 0.7;
          acc += dt * 26;
          while (acc > 1) { acc--; this.emit('motes', p, { n: 1, color: ev.color, r: 0.5 }); }
        }, () => { this.scene.remove(glowS); glowS.geometry.dispose(); glowS.material.dispose(); });
        break;
      }
      case 'decal': { const p = ev.at ? where(ev.at) : feet(); this.decal(ev.kind, p, ev.r || 2, ev.kind === 'crater' ? 4 : 3.5); break; }
      case 'wave': {
        const len = ev.len || 12, start = feet();
        let done = 0;
        this.after(len / 20, (k) => {
          const upto = Math.floor(k * len);
          while (done < upto) {
            done++;
            const p = start.clone().addScaledVector(fwd, done + 0.5);
            p.y = this.ground(p) + 0.2;
            if (ev.kind === 'dust') { this.emit('dust', p, { n: 4, size: 1.2, speed: 1.5 }); if (done % 2 === 0) this.emit('sparks', p, { n: 2, color: '#ffe0a0' }); }
            else if (ev.kind === 'mud') { this.emit('drops', p, { n: 5, color: '#6a3a22' }); if (done % 2 === 0) this.emit('grit', p, { n: 3, color: '#7a7268' }); if (done % 3 === 0) this.emit('dust', p, { n: 1, color: '#7a4a32', size: 0.9, alpha: 0.5 }); }
            else if (ev.kind === 'water') { this.emit('drops', p, { n: 5, color: '#d8e8ee' }); if (done % 2 === 0) this.emit('steam', p, { n: 1, color: '#eef4f6', alpha: 0.3, size: 0.9, speed: 0.8 }); }
            else if (ev.kind === 'fire') { this.emit('flame', p, { n: 5, size: 1.1, spread: 0.4 }); this.emit('embers', p, { n: 3 }); if (done % 3 === 0) this.light(p, '#ff7a20', 6, 0.5); }
            else if (ev.kind === 'rock') { this.spike(p.clone().add(V(r(-0.4, 0.4), 0, r(-0.4, 0.4))), r(0.9, 1.8), 1.8); if (done % 2) this.rocks(p, 2, 0.6); this.emit('dust', p, { n: 3 }); }
          }
        });
        if (ev.kind === 'rock') this.sound('boom');
        break;
      }
      case 'cloud': {
        if (ev.cone) this.cloud(ev.kind, feet().addScaledVector(fwd, 0.6), ev.r || 5, 0.8, { dir: fwd });
        else this.cloud(ev.kind, ev.at === 'self' ? feet() : tgt(), ev.r || 4, ev.thick ? 2.5 : 3.5);
        this.sound('puff');
        break;
      }
      case 'vortex': {
        const c = feet();
        let acc = 0;
        this.after(ev.dur || 2, (k, t, dt) => {
          const p = feet();
          acc += dt * 40;
          while (acc > 1) { acc--; const a = r(0, 6.28), d = r(0.8, ev.r || 4); this.alpha.spawn({ pos: p.clone().add(V(Math.cos(a) * d, r(0.1, 2.2), Math.sin(a) * d)), vel: V(0, r(0.3, 1.2), 0), age: 0, life: r(0.6, 1.1), size: r(0.4, 0.8), tex: TEX.puff, alpha: 0.55, grow: 0.8, color: col('#dcc08a'), swirl: 7, cx: p.x, cz: p.z, rot: r(0, 6), fadeIn: 0.1 }); }
        });
        break;
      }
      case 'sparks': {
        let acc = 0;
        this.after(ev.dur || 0.5, (k, t, dt) => {
          const p = where(ev.at || 'weaponR');
          acc += dt * 60;
          while (acc > 1) { acc--; this.emit('sparks', p, { n: 1, color: '#ffd080', dir: ev.cone ? fwd.clone().add(V(0, 0.2, 0)) : undefined }); }
        });
        this.sound('grind');
        break;
      }
      case 'spray': {
        let acc = 0;
        this.after(ev.dur || 0.4, (k, t, dt) => {
          const p = where('rod');
          acc += dt * 80;
          while (acc > 1) { acc--; const v = fwd.clone().multiplyScalar(r(6, 10)).add(V(r(-1, 1), r(1, 3), r(-1, 1))); this.alpha.spawn({ pos: p.clone(), vel: v, age: 0, life: r(0.5, 0.9), size: r(0.08, 0.16), tex: TEX.drop, grav: 14, alpha: 0.9, rot: 0, color: col('#3a2a14'), floor: this.ground(p) + 0.03 }); }
        });
        break;
      }
      case 'rain': {
        const c = tgt(); const R = ev.r || 5, n = ev.n || 20, dur = ev.dur || 0.6;
        let spawned = 0;
        this.after(dur, (k) => {
          const want = Math.floor(k * n);
          while (spawned < want) {
            spawned++;
            const a = r(0, 6.28), d = Math.sqrt(rnd()) * R;
            const land = c.clone().add(V(Math.cos(a) * d, 0, Math.sin(a) * d)); land.y = this.ground(land);
            const from = land.clone().add(V(r(-1, 1), 14, r(-1, 1)));
            const m = arrowMesh();
            this.projectile(m, from, land, { time: 0.35, onHit: (p) => { this.emit('dust', p.clone().setY(p.y + 0.1), { n: 2, size: 0.6 }); const stuck = arrowMesh(); stuck.position.copy(p); stuck.rotation.set(r(-0.3, 0.3) + Math.PI, 0, r(-0.3, 0.3)); stuck.position.y += 0.35; this.scene.add(stuck); this.after(2.5, null, () => this.scene.remove(stuck)); } });
          }
        });
        break;
      }
      case 'proj': this.runProjectile(ev, ctx, where, tgt, fwd, feet); break;
      case 'holdItem': {
        ctx.held = ctx.held || {};
        const sides = ev.side === 'both' ? ['L'] : [ev.side];
        for (const s of sides) {
          const key = s + ':' + ev.item;
          if (ev.on) {
            if (!ctx.held[key]) { const m = itemMesh(ev.item); m.position.set(s === 'L' ? 0.02 : -0.02, -0.12, 0.04); bones['hand' + s].add(m); ctx.held[key] = m; }
            ctx.held[key].visible = true;
            if (ev.side === 'both') ctx.held[key].position.set(-0.2, -0.12, 0.1);
          } else if (ctx.held[key]) ctx.held[key].visible = false;
        }
        break;
      }
      case 'hideAttach': {
        // (v115 review) a merged player carries its pieces in the one mesh: back to per-kind first, merged again after
        if (char.userData.merged && char.userData.unmerge) { lookChange(char); char.userData.remergeAt = performance.now() + (ev.dur || 1) * 1000 + 200; }
        const bone = bones[ev.bone];
        const objs = bone.children.filter((c) => !c.isBone);
        objs.forEach((o) => (o.visible = false));
        this.after(ev.dur || 1, null, () => objs.forEach((o) => (o.visible = true)));
        break;
      }
      case 'bowstring': char.userData.bowPull = ev.pull; break;
      case 'placeBomb': {
        const p = front(1.2); p.y = this.ground(p);
        const m = itemMesh('clockbomb'); m.position.copy(p).add(V(0, 0.06, 0)); m.scale.setScalar(1.6);
        this.scene.add(m);
        let blink = 0;
        this.after(ev.delay || 1.8, (k, t, dt) => { blink += dt * (4 + k * 14); m.children.forEach((c) => (c.visible = true)); if (Math.floor(blink) % 2 === 0) this.emit('glow', p.clone().add(V(0, 0.3, 0)), { size: 0.5, color: '#ff4030', life: 0.08 }); if (Math.floor(blink * 2) % 4 === 0) this.sound('tick'); }, () => { this.scene.remove(m); this.impact('bigfire', p.clone().add(V(0, 0.3, 0))); this.impact('earth', p, { r: 4 }); this.shake(0.8); });
        break;
      }
      case 'bladeGlow': {
        let acc = 0;
        this.after(ev.dur || 8, (k, t, dt) => { acc += dt * 14; while (acc > 1) { acc--; const p = ctx.animator.weaponPoint('R', r(0.2, 0.85)); this.add.spawn({ pos: p, vel: V(r(-0.2, 0.2), r(0.3, 1), r(-0.2, 0.2)), age: 0, life: r(0.3, 0.6), size: r(0.05, 0.1), tex: TEX.glow, alpha: 1, rot: 0, color: col(ev.color || '#ff8a30'), c2: col('#ff3010') }); } });
        break;
      }
      case 'fadeSelf': {
        const mats = Object.values(char.userData.mats || {});
        mats.forEach((m) => { m.transparent = true; m.needsUpdate = true; });
        this.after(ev.dur || 3, (k) => { const o = k < 0.1 ? 1 - (1 - ev.to) * (k / 0.1) : k > 0.9 ? ev.to + (1 - ev.to) * ((k - 0.9) / 0.1) : ev.to; mats.forEach((m) => (m.opacity = o)); }, () => mats.forEach((m) => { m.opacity = 1; m.transparent = false; m.needsUpdate = true; }));
        break;
      }
      case 'trailSmoke': { let acc = 0; this.after(ev.dur || 0.8, (k, t, dt) => { acc += dt * 30; while (acc > 1) { acc--; this.emit('smoke', where('hand' + (ev.side || 'L')), { n: 1, size: 0.35, alpha: 0.4, color: '#a8b890', lifeK: 0.6 }); } }); break; }
      case 'lanternFlare': { const p = () => ctx.animator.weaponPoint('R', 1.2); this.light(p(), '#a8ff6a', 14, ev.dur || 1, 14); let acc = 0; this.after(ev.dur || 1, (k, t, dt) => { acc += dt * 30; while (acc > 1) { acc--; this.emit('motes', p(), { n: 1, color: '#c8ff9a', r: 0.2 }); } this.emit('glow', p(), { size: 2.5 * (1 - k * 0.5), color: '#c8ff8a', life: 0.06, alpha: 0.6 }); }); break; }
      case 'petals': { const c = feet(); this.emit('petals', c, { n: ev.n || 100 }); this.emit('motes', c, { n: 60, color: '#e8ffd0', r: 3 }); break; }
      case 'spinGear': break;
      // the Deadeye: a shot with no ball to follow (a cone of loose shot, a shot into the ground): the muzzle alone
      // (side 'R', 'L' or 'alt'); dry: the hammer falls on an empty pan, a click and a thread of smoke only
      case 'muzzle': {
        const U = char.userData, side = ev.side === 'alt' ? ((U.gunN = (U.gunN || 0) + 1) % 2 ? 'R' : 'L') : ev.side || 'R';
        if (ev.dry) { const { p } = this.muzzlePoint(char, side); this.emit('smoke', p, { n: 1, size: 0.18, alpha: 0.3, lifeK: 0.4, speed: 0.3, color: '#a8a29a' }); this.sound('click'); break; }
        const m = this.muzzle(char, side, { big: ev.big });
        // loose shot: a cone of small sparks and grit thrown out along the barrel
        if (ev.scatter) { this.emit('fan', m.p.clone().addScaledVector(m.d, 0.4), { n: 7, dir: m.d, color: '#ffd890', width: 2.5, speed: 0.9, size: 0.6 }); this.emit('grit', m.p.clone().addScaledVector(m.d, 0.6), { n: 6, speed: 1.2 }); this.emit('smoke', m.p.clone().addScaledVector(m.d, 0.8), { n: 4, size: 0.7, alpha: 0.45, color: '#9a948a', lifeK: 0.6 }); }
        // a shot into the ground at the feet (Recoil Jump): dust and a steam jet thrown up
        if (ev.ground) { const f = feet(); this.emit('ringdust', f, { n: 14, r: 0.5, speed: 3 }); this.emit('steam', f.clone().add(V(0, 0.3, 0)), { n: 4, dir: V(0, 1, 0), size: 0.9, alpha: 0.45, speed: 1.4 }); this.emit('grit', f.clone().add(V(0, 0.2, 0)), { n: 6 }); }
        break;
      }
      // powder poured from the flask into a pistol's muzzle (a thin grey trickle), or the dust of a torn cartridge
      case 'powder': {
        let acc = 0;
        this.after(ev.dur || 0.3, (k, t, dt) => { acc += dt * 40; while (acc > 1) { acc--; this.alpha.spawn({ pos: where('hand' + (ev.side || 'L')).add(V(r(-0.02, 0.02), -0.04, r(-0.02, 0.02))), vel: V(r(-0.1, 0.1), r(-1.6, -0.8), r(-0.1, 0.1)), age: 0, life: r(0.25, 0.45), size: r(0.03, 0.06), tex: TEX.puff, grav: 3, alpha: 0.8, rot: 0, color: col('#3a3632') }); } });
        if (ev.puff) this.emit('dust', where('hand' + (ev.side || 'L')), { n: 4, size: 0.4, color: '#b8b0a0', alpha: 0.6, speed: 0.6 });
        this.sound(ev.puff ? 'puff' : 'pour');
        break;
      }
      // loose priming powder tipped at the feet goes off in a ragged string of small bangs: low uneven sparks and
      // drifting smoke scattered round the feet (random spots, so never a ring or a radiating burst)
      case 'bangs': {
        const c = feet(), n = ev.n || 7, R = ev.r || 4;
        for (let i = 0; i < n; i++) this.after(0.03 + i * 0.05 + r(0, 0.03), null, () => {
          const a = r(0, 6.28), d = Math.sqrt(rnd()) * R, p = c.clone().add(V(Math.cos(a) * d, 0, Math.sin(a) * d)); p.y = this.ground(p) + 0.15;
          this.emit('fan', p, { n: 4, dir: V(r(-1, 1), 0.5, r(-1, 1)), color: '#ffd080', width: 1.5, speed: 0.5 });
          this.emit('smoke', p, { n: 1, size: 0.7, alpha: 0.45, color: '#8a847c', lifeK: 0.7 });
          this.sound(i % 2 ? 'shot' : 'thump');
        });
        this.emit('ringdust', c, { n: 10, r: 1, speed: 2.4, color: '#9a948a' });
        break;
      }
    }
  }

  // heavy wind-up: steam vents sideways at the feet, a little dust lifts, sparks are drawn to the weapon tip
  windup(ctx, feet, fwd) {
    const f = feet(), side = V(-fwd.z, 0, fwd.x);
    for (const s of [1, -1]) this.emit('steam', f.clone().addScaledVector(side, 0.25 * s).add(V(0, 0.3, 0)), { n: 2, dir: side.clone().multiplyScalar(s).add(V(0, 0.45, 0)).addScaledVector(fwd, -0.3), size: 0.7, alpha: 0.4, lifeK: 0.8 });
    this.emit('ringdust', f, { n: 6, r: 0.3, speed: 1.4, h: 0.6, size: 0.6, alpha: 0.45 });
    if (typeof ctx.animator?.weaponPoint !== 'function') return;
    let acc = 0;
    this.after(0.22, (k, t, dt) => { acc += dt * 40; while (acc > 1) { acc--; this.emit('gather', ctx.animator.weaponPoint('R', 1.0), { n: 1 }); } });
  }

  // the Deadeye: where a pistol's muzzle is now, and which way its barrel points (the pistol in that fist: weapons.js
  // userData.muzzle; a hand with no pistol fires from just ahead of the fist)
  muzzlePoint(char, side) {
    const bones = char.userData.bones, bone = bones['weapon' + side];
    let gun = null;
    for (const c of bone?.children || []) if (c.visible !== false && !c.isBone) c.traverse((o) => { if (!gun && o.userData?.muzzle && o.visible !== false) gun = o; });
    if (gun) { const p = gun.localToWorld(gun.userData.muzzle.clone()); const d = gun.localToWorld(gun.userData.muzzle.clone().add(V(0, 0, 0.2))).sub(p).normalize(); return { p, d }; }
    const h = bones['hand' + side], p = h.localToWorld(V(0, -0.3, 0.08));
    return { p, d: h.localToWorld(V(0, -0.5, 0.08)).sub(p).normalize() };
  }
  // a pistol shot at the muzzle: a grey puff pushed out along the barrel, a few uneven sparks thrown off one side (the
  // pan side, never all round), a thin wisp of steam from the breech on a heavy charge. No flash and no light.
  muzzle(char, side, o = {}) {
    const { p, d } = this.muzzlePoint(char, side);
    const s = o.big ? 1.6 : 1;
    for (let i = 0; i < (o.big ? 6 : 3); i++) this.alpha.spawn({ pos: p.clone().addScaledVector(d, r(0, 0.25) * s), vel: d.clone().multiplyScalar(r(1.2, 3) * s).add(V(r(-0.3, 0.3), r(0.2, 0.7), r(-0.3, 0.3))), age: 0, life: r(0.8, 1.5), size: r(0.28, 0.5) * s, tex: TEX.puff, drag: 2.2, alpha: 0.5, grow: 2, spin: r(-1, 1), rot: r(0, 6), color: col('#a8a29a'), fadeIn: 0.03 });
    const sideV = new THREE.Vector3().crossVectors(d, V(0, 1, 0)); if (sideV.lengthSq() < 1e-4) sideV.set(1, 0, 0); sideV.normalize().multiplyScalar(side === 'L' ? -1 : 1);
    for (let i = 0; i < (o.big ? 5 : 3); i++) this.add.spawn({ pos: p.clone().addScaledVector(sideV, 0.03), vel: d.clone().multiplyScalar(r(0.5, 1.5)).addScaledVector(sideV, r(1.5, 3.5)).add(V(r(-0.4, 0.4), r(0.3, 1.4), r(-0.4, 0.4))), age: 0, life: r(0.15, 0.35), size: r(0.03, 0.06), tex: TEX.streak, stretch: 2, grav: 10, drag: 2, alpha: 1, rot: 0, color: col(i % 2 ? '#ffd080' : '#ffb860') });
    if (o.big) this.emit('steam', p.clone().addScaledVector(d, -0.2), { n: 2, dir: V(0, 1, 0).addScaledVector(sideV, 0.4), size: 0.4, alpha: 0.35, lifeK: 0.7, speed: 0.6 });
    this.sound(o.snd || (o.big ? 'shotbig' : 'shot'));
    this.shake(o.big ? 0.22 : 0.04);
    return { p, d };
  }

  runProjectile(ev, ctx, where, tgt, fwd, feet) {
    const bones = ctx.char.userData.bones;
    // the Deadeye's pistols: 'muzzleR' / 'muzzleL', or 'muzzle' (a counter on the character flips right and left each shot)
    if (typeof ev.from === 'string' && ev.from.startsWith('muzzle')) {
      const U = ctx.char.userData, side = ev.from === 'muzzleR' ? 'R' : ev.from === 'muzzleL' ? 'L' : ((U.gunN = (U.gunN || 0) + 1) % 2 ? 'R' : 'L');
      const m = this.muzzle(ctx.char, side, { big: ev.big, snd: ev.snd });
      ev = { ...ev, fromP: m.p };
    }
    let from = ev.fromP ? ev.fromP.clone() : ev.from === 'bow' ?bones.handL.localToWorld(V(0, -0.06, 0.15)) : ev.from === 'L' ? bones.handL.localToWorld(V(0, -0.1, 0)) : ev.from === 'R' ? bones.handR.localToWorld(V(0, -0.1, 0)) : ev.from === 'head' ? bones.head.localToWorld(V(0, 0.08, 0.2)) : bones.chest.localToWorld(V(0, 0.1, 0.4));
    let to = tgt();
    if (!ctx.targetEnt && !ctx.target) to = feet().addScaledVector(fwd, 14);
    if (ev.ground) to.y = this.ground(to) + 0.1; else to.y = Math.max(to.y + 1.1, this.ground(to) + 1.0);
    if (ev.low) to.y = this.ground(to) + 0.4;
    const dist = from.distanceTo(to);
    const fast = ev.kind === 'arrow' || ev.kind === 'firearrow' || ev.kind === 'dart';
    const ball = ev.kind === 'ball';
    const time = Math.max(ball ? 0.08 : 0.12, dist / (ball ? 70 : fast ? 48 : ev.kind === 'shield' || ev.kind === 'roundshield' || ev.kind === 'hammer' ? 24 : 20));
    const impactKind = ev.impact || ({ arrow: 'pierce', firearrow: 'fire', dart: 'pin', shield: 'shield', roundshield: 'shield', hammer: 'blunt', net: 'net', trap: 'pin', salve: 'heal', ball: 'ball', chainshot: 'chainwrap', canister: 'canister', cartridge: 'gunsmoke', chalk: 'chalk' })[ev.kind] || 'blunt';
    const make = () => {
      switch (ev.kind) {
        case 'arrow': case 'firearrow': { const m = arrowMesh(); if (ev.kind === 'firearrow') m.userData.trailColor = '#ff8a30'; return m; }
        case 'dart': { const m = arrowMesh(); m.scale.setScalar(0.35); return m; }
        case 'shield': return kiteShield();
        case 'roundshield': return roundShield();
        case 'hammer': return warhammer();
        case 'net': return itemMesh('net');
        case 'trap': return itemMesh('trap');
        case 'salve': { const m = itemMesh(ev.item || 'salve'); m.userData.trailColor = ev.item === 'sap' || ev.item === 'barkpaste' ? '#ffc060' : '#a8ff7a'; return m; }
        case 'ball': case 'chainshot': case 'canister': case 'cartridge': case 'chalk': { const m = itemMesh(ev.kind); if (ev.big) m.scale.setScalar(1.5); return m; }
        default: { const m = itemMesh(ev.item || 'flaskFire'); m.userData.trailColor = '#ffffff'; return m; }
      }
    };
    const shots = ev.fan ? Array.from({ length: ev.fan }, (_, i) => (i - (ev.fan - 1) / 2) * ((ev.spread || 40) / (ev.fan - 1)) * Math.PI / 180) : [((ev.spread || 0) * Math.PI) / 180];
    for (const ang of shots) {
      let dest = to.clone();
      if (ang) { const d = to.clone().sub(feet()); d.applyAxisAngle(V(0, 1, 0), ang); dest = feet().add(d); dest.y = to.y; }
      if (ev.up) { dest = from.clone().add(V(0, 18, 0)).addScaledVector(fwd, 2); }
      if (ev.down) { const t2 = tgt(); dest = t2.clone().add(V(r(-2, 2), 0, r(-2, 2))); dest.y = this.ground(dest); }
      if (ev.pierce) dest = from.clone().addScaledVector(dest.clone().sub(from).setY(0).normalize(), 30).setY(from.y);
      // shots spread over a patch of ground round the target (the Deadeye's Powder Storm, Pressure Volley)
      if (ev.scatter) { const a = r(0, 6.28), d = Math.sqrt(rnd()) * ev.scatter; dest.add(V(Math.cos(a) * d, 0, Math.sin(a) * d)); if (ev.ground) dest.y = this.ground(dest) + 0.1; }
      const mesh = make();
      const flyT = ev.time ?? (ev.up ? 0.45 : ev.pierce ? (ball ? 0.42 : 0.55) : time * (ev.arc ? 1.25 : 1));
      // a shot at a target: its contact (tier stop, sound, sparks) waits for the shot to land, not the server's word (S1 review)
      if (ctx.targetEnt && ctx.targetEnt !== ctx.src && !ev.up && !ev.pierce && !ev.down && !ev.scatter && !ang) ctx.targetEnt.shotDue = Math.max(ctx.targetEnt.shotDue || 0, (this.clockT || 0) + flyT);
      const spin = ev.spin || 0;
      const arc = ev.arc || 0;
      const align = fast || ev.kind === 'dart';
      const trail = ev.kind === 'firearrow' ? 'fire' : fast ? 'sparkle' : ev.kind === 'salve' ? 'motes' : ev.kind === 'flask' ? 'smoke' : ball ? 'ballsmoke' : ev.kind === 'canister' ? 'smoke' : null;
      this.projectile(mesh, from, dest, {
        time: ev.time ?? (ev.up ? 0.45 : ev.pierce ? (ball ? 0.42 : 0.55) : time * (arc ? 1.25 : 1)), arc, spin, align, trail,
        onHit: (p) => {
          if (ev.up) return;
          // a contact the server reported before this shot was fired plays now, as it lands (entities.js hit, S1 review)
          const pt = ctx.targetEnt?.pendHit;
          if (pt && !ang) { ctx.targetEnt.pendHit = null; pt(); }
          if (ev.bounce) { for (let i = 0; i < ev.bounce; i++) this.after(0.25 * i + 0.01, null, () => this.impact('shrapnel', p.clone().add(V(r(-1.5, 1.5), 0, r(-1.5, 1.5))))); return; }
          this.impact(impactKind, p, { r: ev.r ?? (ev.ground ? 3 : 0), dir: dest.clone().sub(from), big: ev.big });
          if (ev.ret) {
            const back = make();
            this.projectile(back, p, bones.handL.localToWorld(V()), { time: time * 0.9, spin, align: false });
          }
          if (fast && !ev.pierce) { const stuck = make(); stuck.position.copy(p); stuck.lookAt(p.clone().add(dest.clone().sub(from))); stuck.rotateX(Math.PI / 2); this.scene.add(stuck); this.after(1.2, null, () => this.scene.remove(stuck)); }
        },
      });
    }
    if (!ev.fromP) this.sound(fast ? 'bow' : 'throw');
  }
}

// keep the drawn bow string attached to the right hand
export function updateBowString(char) {
  const bow = char.userData.bow;
  if (!bow) return;
  const st = bow.userData.string;
  // while drawing, the string follows the fingers once they are behind its resting line (so it bends as the
  // hand pulls back, with no pop); on release it snaps straight
  const want = char.userData.bowPull || 0;
  const pos = st.line.geometry.attributes.position;
  const mid = new THREE.Vector3(0, 0, st.tipZ);
  let pull = 0;
  if (want > 0.01) {
    const hand = char.userData.bones.handR.localToWorld(new THREE.Vector3(0, -0.07, 0.01));
    const local = bow.worldToLocal(hand);
    const behind = THREE.MathUtils.smoothstep(local.z - st.tipZ, -0.02, 0.1);
    pull = Math.min(1, want) * behind * (1 - THREE.MathUtils.smoothstep(Math.hypot(local.x, local.y), 0.2, 0.45));
    mid.lerp(local, pull);
  }
  pos.setXYZ(1, mid.x, mid.y, mid.z);
  pos.needsUpdate = true;
  placeString(st, mid);
  // nocked arrow: from the string at the fingers, past the grip, while the string is drawn
  if (!st.arrow) { st.arrow = arrowMesh(); st.arrow.visible = false; bow.add(st.arrow); }
  const a = st.arrow;
  a.visible = pull > 0.05;
  if (a.visible) {
    // the arrow rests on top of the bow hand: aim from the nock at a point just above the grip (world up)
    const restW = bow.localToWorld(new THREE.Vector3()).add(new THREE.Vector3(0, 0.045, 0));
    const dir = bow.worldToLocal(restW).sub(mid).normalize();
    a.position.copy(mid);
    a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }
}
