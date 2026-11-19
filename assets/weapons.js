// Weapons and shields, built in code. Local +Y is the blade direction, the origin is the centre of the grip.
// Every builder takes the item quality (1 common .. 6 prismatic) and the model itself grows with it:
//   q1 dull iron and plain leather       q2 polished steel, brass fittings
//   q3 gold inlay and a gem in the quality colour
//   q4 a bigger, more aggressive silhouette with a polished channel in the quality colour
//   q5 its own shape and polished gold edges
//   q6 (Prismatic) the legendary shape in a tempered steel (wQ6); its colour play is the thin-film sheen in the reflection
//      and the +7..+10 heat is laid on afterwards (client/assets/heat.js heatObject, from setCharWeapon)
// Nothing on a weapon or shield is self-lit: the quality accents (wQ3..wQ5) are polished metals, never glows.
// Blades have a real diamond cross-section (a ridge down the middle, honed edge bevels) so one face always catches
// the light; a flat slab only ever showed the sky.
// Content rules: no guard that makes a sword read as a cross face-on (guards are compact oval collars), no radiating
// emblems on shields, no spoked wheels.
import * as THREE from 'three';
import { Builder, box, rbox, cyl, cone, sphere, ico, torus, lathe, extrude, tube, gear, lerp, V3 } from './kit.js';
import { lanternBuilder } from './dynamic.js';
import { G } from '../engine/globals.js';
import { dsHolder } from './dragonslayer.js';

const PI = Math.PI;
export const QCOLOR = [0, 0x9d9d9d, 0x3ad65a, 0x3a8aff, 0xb45aff, 0xffc23a, 0xff6ad5];

// the look of each quality tier
function tier(q = 1) {
  q = Math.max(1, Math.min(6, q | 0));
  return {
    q,
    blade: q <= 1 ? 'wIronW' : 'wSteel', // the blade body
    edge: q >= 5 ? 'wQ5' : q <= 1 ? 'wSteel' : 'wEdge', // honed edge bevels (legendary: polished gold, not a glow)
    fuller: q >= 4 ? 'wQ' + q : 'wSteelDark',
    trim: q >= 3 ? 'wGold' : q === 2 ? 'wBrass' : 'wIron',
    gem: q >= 3 ? 'wQ' + q : null,
    big: q >= 5 ? 1.18 : q >= 4 ? 1.1 : 1,
    grip: q >= 4 ? '#2a1610' : q >= 3 ? '#3a1c12' : q === 2 ? '#4a2e1a' : '#5a4030',
  };
}

// ---------------------------------------------------------------------------------------------- geometry helpers
// A blade with a diamond cross-section. samples: [y, xa, xb, ridgeX, t] from the base to the tip, where xa/xb are the
// two edges, ridgeX the line of the centre ridge and t its half-thickness. Returns { body, edges }: the flat faces between
// the edge bevels and the ridge, and the narrow honed bevels along both edges (a separate, brighter material).
function bladeGeo(samples, bevel = 0.012) {
  const body = [], edges = [], uvB = [], uvE = [];
  const len = samples[samples.length - 1][0] - samples[0][0] || 1;
  const rails = samples.map(([y, xa, xb, rx, t]) => {
    const w = Math.max(1e-4, xb - xa), e = Math.min(bevel, w * 0.3), tE = t * 0.3;
    return { y, A: [xa, 0], bA: [xa + e, tE], R: [rx, t], bB: [xb - e, tE], B: [xb, 0], xa, w };
  });
  const quad = (out, uv, p0, p1, p2, p3, outward) => {
    // p0,p1 on sample i; p3,p2 on sample i+1. flip so the normal points to the outward side (+z front, -z back)
    const n = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p3, p0));
    const tri = n.z * outward >= 0 ? [p0, p1, p2, p0, p2, p3] : [p0, p2, p1, p0, p3, p2];
    for (const p of tri) { out.push(p.x, p.y, p.z); uv.push((p.x + 0.2) * 3, (p.y - samples[0][0]) / len); }
  };
  for (let i = 0; i < rails.length - 1; i++) {
    const r0 = rails[i], r1 = rails[i + 1];
    for (const side of [1, -1]) {
      const P = (r, k) => V3(r[k][0], r.y, r[k][1] * side);
      quad(edges, uvE, P(r0, 'A'), P(r0, 'bA'), P(r1, 'bA'), P(r1, 'A'), side);
      quad(body, uvB, P(r0, 'bA'), P(r0, 'R'), P(r1, 'R'), P(r1, 'bA'), side);
      quad(body, uvB, P(r0, 'R'), P(r0, 'bB'), P(r1, 'bB'), P(r1, 'R'), side);
      quad(edges, uvE, P(r0, 'bB'), P(r0, 'B'), P(r1, 'B'), P(r1, 'bB'), side);
    }
  }
  // close the base
  const r0 = rails[0];
  const cap = [V3(r0.A[0], r0.y, 0), V3(r0.R[0], r0.y, r0.R[1]), V3(r0.B[0], r0.y, 0), V3(r0.R[0], r0.y, -r0.R[1])];
  for (const tri of [[0, 2, 1], [0, 3, 2]]) for (const k of tri) { body.push(cap[k].x, cap[k].y, cap[k].z); uvB.push(0, 0); }
  const make = (pos, uv) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals(); // non-indexed: every facet keeps its own normal, so the ridge reads crisp
    return g;
  };
  return { body: make(body, uvB), edges: make(edges, uvE) };
}
// add a blade to a builder: body + bevels (+ a fuller or polished channel down the middle of each face)
function addBlade(b, T, samples, { fuller = 0.72, fullerW = 0.012, bevel = 0.012, at = [0, 0, 0] } = {}) {
  const g = bladeGeo(samples, bevel);
  b.add(g.body, T.blade, { p: at, uv: 'keep', c: 0xffffff });
  b.add(g.edges, T.edge, { p: at, uv: 'keep', c: 0xffffff });
  if (fuller > 0) {
    const y0 = samples[0][0], y1 = y0 + (samples[samples.length - 1][0] - y0) * fuller, mid = samples[0][3];
    const t = samples[0][4];
    for (const side of [1, -1]) b.add(box(fullerW * T.big, y1 - y0, 0.004), T.fuller, { p: [at[0] + mid, at[1] + (y0 + y1) / 2 + 0.01, at[2] + side * (t * 0.82)], c: 0xffffff });
  }
}
function wrapGrip(b, len, r, color = '#4a2e1a', y0 = 0) {
  b.add(cyl(r, r, len, 10), 'wLeather', { p: [0, y0, 0], c: color });
  for (let i = 0; i < 6; i++) b.add(torus(r * 1.05, r * 0.2, 4, 12), 'wLeather', { p: [0, y0 - len / 2 + (i + 0.5) * len / 6, 0], r: [PI / 2 + 0.25, 0, 0], c: '#20140c' });
}
// a compact oval collar guard (never wider than about 1.6x the blade: no cross silhouette)
function collarGuard(b, T, w, y) {
  b.add(lathe([[0.001, -0.022], [w * 0.5, -0.016], [w * 0.62, 0], [w * 0.5, 0.016], [0.001, 0.022]], 16), T.trim, { p: [0, y, 0], s: [1, 1, 0.55], c: 0xffffff });
  if (T.gem) for (const s of [1, -1]) b.add(ico(0.017 * T.big, 0), T.gem, { p: [0, y, s * w * 0.3], flat: true, c: 0xffffff });
}
function pommel(b, T, y, r = 0.034) {
  if (T.q <= 1) b.add(sphere(r, 10, 8), 'wIron', { p: [0, y, 0], c: 0xffffff });
  else if (T.q === 2) b.add(ico(r * 1.05, 1), 'wBrass', { p: [0, y, 0], flat: true, c: 0xffffff });
  else {
    b.add(lathe([[0.001, -r], [r * 0.9, -r * 0.7], [r * 1.1, 0], [r * 0.9, r * 0.7], [0.001, r]], 12), T.trim, { p: [0, y, 0], c: 0xffffff });
    b.add(ico(r * 0.55, 0), T.gem, { p: [0, y - r * 0.9, 0], flat: true, c: 0xffffff });
  }
}

// ---------------------------------------------------------------------------------------------- embers (legendary)
// A thin stream of rising sparks along a blade or head: one Points object driven by the global clock, so it costs
// nothing per frame on the CPU. pts are in the weapon's local space; the sparks rise in world space.
const EMBER_VS = `attribute float phase; uniform float time; uniform float size; varying float vA;
void main() {
  float k = fract(time * 0.42 + phase);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.y += k * 0.38; wp.x += sin(phase * 37.0 + time * 2.3) * 0.035 * k; wp.z += cos(phase * 23.0 + time * 1.9) * 0.035 * k;
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  vA = (1.0 - k) * smoothstep(0.0, 0.12, k);
  gl_PointSize = size * 320.0 / max(0.6, -mv.z);
}`;
const EMBER_FS = `uniform vec3 color; varying float vA;
void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vA; gl_FragColor = vec4(color * 1.8 * a, a); }`;
export function embers(color, pts, size = 0.05) {
  const geo = new THREE.BufferGeometry();
  const pos = [], ph = [];
  pts.forEach((p, i) => { pos.push(p.x, p.y, p.z); ph.push((i * 0.618) % 1); });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('phase', new THREE.Float32BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { time: G.time, color: { value: new THREE.Color(color) }, size: { value: size } }, vertexShader: EMBER_VS, fragmentShader: EMBER_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false; p.castShadow = false; p.userData.embers = true;
  return p;
}
const along = (y0, y1, n, x = 0, jitter = 0.02) => Array.from({ length: n }, (_, i) => V3(x + (((i * 7919) % 13) / 13 - 0.5) * jitter * 2, lerp(y0, y1, (i + 0.5) / n), 0));
function finish(b, T, emberPts, tip) {
  const g = b.build();
  // (legendary weapons no longer trail rising embers: no magic glows on weapons; emberPts kept for the callers)
  if (tip) g.userData.tip = tip;
  g.userData.quality = T.q;
  return g;
}

// ---------------------------------------------------------------------------------------------- swords and knives
export function longsword(q = 1, o = {}) {
  const T = tier(q), s = T.big, b = new Builder(1);
  const L = 0.98 * (q >= 4 ? 1.06 : 1), w0 = 0.042 * s, t = 0.012;
  const y0 = 0.12;
  const S = [[y0, -w0, w0, 0, t], [y0 + 0.5 * L, -w0 * 0.92, w0 * 0.92, 0, t], [y0 + 0.74 * L, -w0 * 0.82, w0 * 0.82, 0, t * 0.9], [y0 + 0.9 * L, -w0 * 0.5, w0 * 0.5, 0, t * 0.7], [y0 + L, 0, 0, 0, 0.001]];
  if (q >= 5) S.splice(1, 0, [y0 + 0.08, -w0 * 0.7, w0 * 0.7, 0, t], [y0 + 0.14, -w0 * 1.08, w0 * 1.08, 0, t]); // a waisted ricasso that flares out: its own shape
  if (o.fork) {
    // Keeper of the Valley: the blade splits along its own axis for the last quarter into two prongs
    const yf = y0 + 0.74 * L;
    addBlade(b, T, S.filter((r) => r[0] <= yf).concat([[yf, -w0 * 0.82, w0 * 0.82, 0, t * 0.9]]), { fullerW: 0.014 });
    for (const sx of [-1, 1]) {
      const c = sx * w0 * 0.5;
      addBlade(b, T, [[yf - 0.004, c - w0 * 0.34, c + w0 * 0.34, c, t * 0.8], [yf + 0.16 * L, c - w0 * 0.24 + sx * 0.006, c + w0 * 0.24 + sx * 0.006, c + sx * 0.006, t * 0.6], [y0 + L * 1.02, c + sx * 0.012, c + sx * 0.012, c + sx * 0.012, 0.001]], { fuller: 0, bevel: 0.008 });
    }
  } else addBlade(b, T, S, { fullerW: 0.014 });
  if (q >= 3) for (const sd of [1, -1]) for (const sx of [-1, 1]) b.add(box(0.004, 0.16, 0.003), 'wGold', { p: [sx * w0 * 0.55, y0 + 0.14, sd * t * 0.62], c: 0xffffff }); // gold inlay at the base
  collarGuard(b, T, 0.1 * s, 0.1);
  wrapGrip(b, 0.2, 0.022, T.grip);
  pommel(b, T, -0.125, 0.036);
  const g = finish(b, T, q >= 5 ? along(y0 + 0.2, y0 + L * 0.9, 14) : null, V3(0, y0 + L, 0));
  if (o.fork) {
    // a polished gold shard floats between the prongs and turns slowly (not self-lit)
    const sb = new Builder(91); sb.add(rbox(0.024, 0.09, 0.012, 0.004), 'wQ5', { c: 0xffffff });
    const shard = sb.build({ shadow: false }); shard.position.set(0, y0 + L * 0.93, 0);
    shard.traverse((m) => { if (m.isMesh) m.onBeforeRender = () => { shard.rotation.y = G.time.value * 0.8; }; });
    g.add(shard);
  }
  return g;
}

export function scimitar(q = 1, o = {}) {
  const T = tier(q), s = T.big, b = new Builder(8);
  const S = [], N = 10, L = 0.86 * (q >= 4 ? 1.06 : 1);
  for (let i = 0; i <= N; i++) {
    const u = i / N, y = 0.1 + u * L;
    const c = 0.11 * u * u * s; // the curve sweeps toward the edge side
    let w = lerp(0.03, 0.058, Math.min(1, u / 0.8)) * s; // widening toward the tip
    if (u > 0.8) w *= 1 - (u - 0.8) / 0.2;
    const notch = o.notch && u > 0.42 && u < 0.6 ? w * 0.4 : 0; // Sandsplitter's Fang: a stepped notch in the spine
    const spine = c - w * 0.25 + notch, edge = c + w;
    S.push([y, spine, Math.max(spine + 1e-3, edge), c + w * 0.05, i === N ? 0.001 : 0.011]);
  }
  addBlade(b, T, S, { fuller: 0, bevel: 0.016 });
  for (const sd of [1, -1]) b.add(tube(S.slice(0, 7).map(([y, , , rx, t]) => V3(rx, y + 0.02, sd * t * 0.86)), 0.0055 * s, 5, 16), T.fuller, { uv: 'keep', c: 0xffffff });
  collarGuard(b, T, 0.085 * s, 0.09);
  wrapGrip(b, 0.18, 0.021, q >= 3 ? '#6a1a14' : '#7a2a1e');
  b.add(cone(0.028, 0.06, 10), T.trim, { p: [0, -0.115, 0], r: [PI, 0, 0], c: 0xffffff });
  if (T.gem) b.add(ico(0.016, 0), T.gem, { p: [0, -0.15, 0], flat: true, c: 0xffffff });
  return finish(b, T, q >= 5 ? S.slice(2, 10).map(([y, , xb]) => V3(xb - 0.01, y, 0)) : null, V3(S[N][2], S[N][0], 0));
}

export function dagger(q = 1) {
  const T = tier(q), s = T.big, b = new Builder(14);
  const w = 0.028 * s;
  addBlade(b, T, [[0.07, -w, w, 0, 0.009], [0.2, -w * 1.08, w * 1.08, 0, 0.009], [0.32, -w * 0.5, w * 0.5, 0, 0.006], [0.39, 0, 0, 0, 0.001]], { fuller: 0.5, fullerW: 0.008, bevel: 0.008 });
  collarGuard(b, T, 0.07, 0.065);
  wrapGrip(b, 0.11, 0.017, T.grip);
  pommel(b, T, -0.07, 0.022);
  return finish(b, T, q >= 5 ? along(0.1, 0.34, 6) : null);
}

// ---------------------------------------------------------------------------------------------- axe, mace, hammer
export function battleAxe(q = 1, o = {}) {
  const T = tier(q), s = T.big * 0.86, b = new Builder(15);
  b.add(cyl(0.026, 0.03, 1.12, 10), 'wWood', { p: [0, 0.35, 0], c: 0xffffff });
  b.add(cyl(0.034, 0.03, 0.06, 10), T.trim, { p: [0, -0.21, 0], c: 0xffffff }); // butt cap
  // a bearded head: upper horn, a near-straight honed edge, a long beard sweeping back to the haft
  const sh = new THREE.Shape();
  sh.moveTo(0.02, 0.09); sh.lineTo(0.16 * s, 0.13 * s); sh.quadraticCurveTo(0.22 * s, 0.15 * s, 0.24 * s, 0.1 * s);
  sh.lineTo(0.26 * s, -0.12 * s); sh.quadraticCurveTo(0.24 * s, -0.22 * s, 0.17 * s, -0.24 * s);
  sh.quadraticCurveTo(0.1 * s, -0.12 * s, 0.03, -0.07); sh.closePath();
  const y = 0.82;
  b.add(extrude(sh, 0.014, 0.012, 10), q <= 1 ? 'wIronW' : 'wSteel', { p: [0, y, 0], c: 0xffffff });
  if (o.double) b.add(extrude(sh, 0.014, 0.012, 10), 'wSteel', { p: [0, y, 0], s: [-0.8, 0.8, 1], c: 0xffffff }); // Halbrek's Splitter: a second, smaller bit behind
  // the honed edge: a bright strip along the front of the bit (polished gold on a legendary)
  const e0 = V3(0.24 * s, y + 0.1 * s, 0), e1 = V3(0.26 * s, y - 0.12 * s, 0), e2 = V3(0.19 * s, y - 0.225 * s, 0);
  for (const [a, c] of [[e0, e1], [e1, e2]]) {
    const d = new THREE.Vector3().subVectors(c, a), L = d.length(), m = a.clone().add(c).multiplyScalar(0.5);
    b.add(box(0.016, L + 0.01, 0.034), T.edge, { p: [m.x + 0.006, m.y, 0], r: [0, 0, -Math.atan2(d.x, d.y)], c: 0xffffff });
  }
  // eye socket, poll block on the back, langets down the haft, rivets
  b.add(rbox(0.07, 0.17, 0.064, 0.015), T.trim === 'wGold' ? 'wIron' : T.trim, { p: [0, y, 0], c: 0xffffff });
  b.add(rbox(0.06, 0.08, 0.05, 0.012), 'wIron', { p: [-0.06, y, 0], c: 0xffffff });
  for (const sz of [-1, 1]) b.add(box(0.03, 0.2, 0.006), 'wIron', { p: [0, y - 0.18, sz * 0.03], c: 0xffffff });
  for (const ry of [-0.12, -0.2, -0.26]) for (const sz of [-1, 1]) b.add(sphere(0.008, 6, 4), T.trim, { p: [0, y + ry, sz * 0.034], c: 0xffffff });
  if (T.gem) for (const sz of [-1, 1]) b.add(ico(0.02, 0), T.gem, { p: [0.11 * s, y - 0.02, sz * 0.02], flat: true, c: 0xffffff });
  if (q >= 4) b.add(box(0.01, 0.2 * s, 0.03), 'wQ' + q, { p: [0.17 * s, y - 0.02, 0], c: 0xffffff }); // polished channel inside the edge
  if (o.double) b.add(box(0.014, 0.17 * s, 0.03), 'wQ5', { p: [-0.205 * s, y - 0.01, 0], c: 0xffffff });
  wrapGrip(b, 0.22, 0.032, T.grip, -0.08);
  return finish(b, T, q >= 5 ? Array.from({ length: 10 }, (_, i) => new THREE.Vector3().lerpVectors(e0, e2, i / 9)) : null, V3(0.2, y, 0));
}

export function flangedMace(q = 1) {
  const T = tier(q), s = T.big, b = new Builder(19);
  b.add(cyl(0.024, 0.028, 0.64, 10), 'wWood', { p: [0, 0.18, 0], c: 0xffffff });
  const y = 0.58;
  // a ribbed head: seven rounded ribs round a core (rounded and odd in number, so it never reads as a star from above)
  b.add(cyl(0.05 * s, 0.05 * s, 0.2 * s, 14), 'wIron', { p: [0, y, 0], c: 0xffffff });
  const rib = lathe([[0.001, -0.1], [0.035, -0.085], [0.05, -0.02], [0.045, 0.05], [0.028, 0.095], [0.001, 0.1]], 10);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * PI * 2;
    b.add(rib, q <= 1 ? 'wIronW' : 'wSteel', { p: [Math.cos(a) * 0.05 * s, y, Math.sin(a) * 0.05 * s], s: [0.55 * s, s, 0.55 * s], c: 0xffffff });
  }
  for (const dy of [-0.11, 0.11]) b.add(cyl(0.062 * s, 0.062 * s, 0.025, 14), T.trim, { p: [0, y + dy * s, 0], c: 0xffffff });
  b.add(cone(0.028 * s, 0.08 * s, 10), q <= 1 ? 'wIron' : 'wSteel', { p: [0, y + 0.16 * s, 0], c: 0xffffff });
  if (T.gem) b.add(torus(0.064 * s, 0.008, 6, 20), T.gem, { p: [0, y - 0.11 * s, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  if (q >= 4) b.add(cyl(0.052 * s, 0.052 * s, 0.03, 14), 'wQ' + q, { p: [0, y, 0], c: 0xffffff });
  wrapGrip(b, 0.18, 0.025, T.grip);
  pommel(b, T, -0.11, 0.03);
  return finish(b, T, q >= 5 ? along(y - 0.08, y + 0.1, 10, 0, 0.06) : null, V3(0, y, 0));
}

export function warhammer(q = 1) {
  const T = tier(q), s = T.big, b = new Builder(10);
  b.add(cyl(0.026, 0.03, 0.98, 10), 'wWood', { p: [0, 0.3, 0], c: 0xffffff });
  wrapGrip(b, 0.24, 0.032, T.grip, -0.05);
  const y = 0.86;
  // a flat striking face on one side, a short squared pick on the other, iron bands with rivets
  b.add(rbox(0.22 * s, 0.17 * s, 0.17 * s, 0.022), q <= 1 ? 'wIronW' : 'wIron', { p: [0.04 * s, y, 0], c: 0xffffff });
  b.add(rbox(0.07 * s, 0.2 * s, 0.2 * s, 0.02), q <= 1 ? 'wIronW' : 'wSteel', { p: [0.18 * s, y, 0], c: 0xffffff }); // striking face
  const pick = new THREE.Shape(); pick.moveTo(0, -0.06); pick.lineTo(0, 0.06); pick.lineTo(-0.2, 0.012); pick.lineTo(-0.22, -0.01); pick.closePath();
  b.add(extrude(pick, 0.07 * s, 0.01, 4), q <= 1 ? 'wIronW' : 'wSteel', { p: [-0.07 * s, y, 0], s: [s, s, 1], c: 0xffffff });
  for (const dx of [-0.03, 0.1]) {
    b.add(box(0.022, 0.18 * s, 0.18 * s), T.q >= 4 ? 'wGold' : 'wIron', { p: [dx * s, y, 0], c: q >= 4 ? 0xffffff : '#5a5a60' });
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) b.add(sphere(0.009, 6, 4), T.trim, { p: [dx * s, y + sy * 0.05 * s, sz * 0.092 * s], c: 0xffffff });
  }
  if (T.gem) for (const sz of [-1, 1]) b.add(ico(0.024, 0), T.gem, { p: [0.04 * s, y, sz * 0.088 * s], flat: true, c: 0xffffff });
  if (q >= 4) b.add(rbox(0.012, 0.16 * s, 0.16 * s, 0.004), 'wQ' + q, { p: [0.218 * s, y, 0], c: 0xffffff }); // the polished rim of the striking face
  b.add(cone(0.045, 0.15, 10), q >= 3 ? T.trim : 'wIron', { p: [0.04 * s, y + 0.15 * s, 0], c: 0xffffff });
  b.add(sphere(0.036, 10, 8), T.trim, { p: [0, -0.19, 0], c: 0xffffff });
  return finish(b, T, q >= 5 ? along(y - 0.08, y + 0.08, 10, 0.2 * s, 0.03) : null, V3(0.2, y, 0));
}

// ---------------------------------------------------------------------------------------------- staves and rods
export function reactorRod(q = 1) {
  const T = tier(q), s = q >= 4 ? 1.15 : 1, b = new Builder(6);
  const brass = q <= 1 ? 'wBrass' : q >= 3 ? 'wGold' : 'wBrass';
  b.add(cyl(0.022, 0.024, 1.15, 10), brass, { p: [0, 0.3, 0], c: q <= 1 ? '#c8a070' : 0xffffff });
  wrapGrip(b, 0.26, 0.028, T.grip, 0);
  b.add(cyl(0.034, 0.028, 0.08, 10), brass, { p: [0, -0.3, 0], c: 0xffffff });
  const y0 = 0.98, glass = q >= 5 ? 'wQ5' : q >= 4 ? 'wQ4' : 'wReagent';
  // the reactor chamber: a tube of tinted reagent (polished metal from Epic) between brass caps, held by four rods
  b.add(cyl(0.052 * s, 0.052 * s, 0.22 * s, 16), glass, { p: [0, y0, 0], c: 0xffffff });
  for (const dy of [-0.13, 0.13]) {
    b.add(cyl(0.074 * s, 0.074 * s, 0.045, 18), brass, { p: [0, y0 + dy * s, 0], c: 0xffffff });
    b.add(torus(0.074 * s, 0.009, 5, 18), brass, { p: [0, y0 + dy * s + (dy > 0 ? 0.022 : -0.022), 0], r: [PI / 2, 0, 0], c: 0xffffff });
  }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; b.add(cyl(0.008, 0.008, 0.26 * s, 6), 'wDark', { p: [Math.cos(a) * 0.066 * s, y0, Math.sin(a) * 0.066 * s], c: 0xffffff }); }
  // a solid side gear (no spokes) and a flint wheel
  b.add(gear(12, 0.06, 0.075, 0.022, { hole: 0.015, spokes: 0, bevel: 0.004 }), brass, { p: [0.09 * s, y0 - 0.02, 0], r: [0, PI / 2, 0], c: 0xffffff });
  b.add(cyl(0.025, 0.025, 0.03, 12), 'wDark', { p: [0.09 * s, y0 + 0.09, 0], r: [0, 0, PI / 2], c: 0xffffff });
  b.add(cyl(0.03, 0.03, 0.018, 14), brass, { p: [0, y0 - 0.22 * s, 0.036], r: [PI / 2, 0, 0], c: 0xffffff });
  b.add(cyl(0.024, 0.024, 0.02, 14), 'wCloth', { p: [0, y0 - 0.22 * s, 0.038], r: [PI / 2, 0, 0], c: '#f0e8d0' });
  b.add(cyl(0.02, 0.036, 0.08, 10), brass, { p: [0, y0 + 0.21 * s, 0], c: 0xffffff });
  if (T.gem) b.add(ico(0.02, 0), T.gem, { p: [0, y0 + 0.27 * s, 0], flat: true, c: 0xffffff });
  if (q >= 4) for (let i = 0; i < 3; i++) b.add(torus(0.032, 0.006, 5, 14), 'wCopper', { p: [0, 0.6 + i * 0.06, 0], r: [PI / 2, 0, 0], c: 0xffffff }); // copper coils below the chamber
  return finish(b, T, q >= 5 ? along(y0 - 0.08, y0 + 0.1, 10, 0, 0.05) : null, V3(0, y0 + 0.26 * s, 0));
}

export function gearStaff(q = 1) {
  const T = tier(q), b = new Builder(6);
  b.add(cyl(0.024, 0.028, 1.7, 10), 'wWood', { p: [0, 0.35, 0], c: 0xffffff });
  for (const y of [-0.45, 0.1, 0.9]) b.add(torus(0.029, 0.009, 5, 12), 'wBrass', { p: [0, y, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  // solid gears with a square axle block: no ring, no glowing orb (a tool head, not a wand)
  b.add(gear(16, 0.16, 0.19, 0.03, { hole: 0, bevel: 0.006 }), T.q >= 3 ? 'wGold' : 'wBrass', { p: [0, 1.36, 0], c: 0xffffff });
  b.add(gear(10, 0.07, 0.09, 0.028, { hole: 0, bevel: 0.005 }), 'wBrass', { p: [0.12, 1.22, 0.01], c: 0xffffff });
  b.add(box(0.06, 0.06, 0.05), 'wIron', { p: [0, 1.36, 0], c: 0xffffff });
  b.add(cone(0.03, 0.08, 8), 'wBrass', { p: [0, -0.56, 0], r: [PI, 0, 0], c: 0xffffff });
  return finish(b, T, null, V3(0, 1.36, 0));
}

export function herbStaff(q = 1) {
  const T = tier(q), b = new Builder(12);
  b.add(cyl(0.024, 0.028, 1.62, 10), 'wWood', { p: [0, 0.28, 0], c: '#8a6038' }); // the core the strands twist round
  for (const ph of [0, PI * 2 / 3, PI * 4 / 3]) {
    const pts = [];
    for (let i = 0; i <= 26; i++) {
      const t = i / 26, y = -0.5 + t * 1.62, r = 0.03;
      pts.push(V3(Math.cos(t * 13 + ph) * r, y, Math.sin(t * 13 + ph) * r));
    }
    b.add(tube(pts, (t) => lerp(0.017, 0.012, t), 6, 70), 'wWood', { uv: 'keep', c: 0xffffff });
  }
  // a carved head: three branches curling out and back, carrying the lantern
  const top = 1.12;
  for (const [ph, len] of [[0.2, 0.34], [2.3, 0.3], [4.2, 0.32]]) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12, a = ph + u * 1.4, r = Math.sin(u * PI * 0.85) * len;
      pts.push(V3(Math.cos(a) * r, top + u * 0.26 - Math.pow(u, 3) * 0.08, Math.sin(a) * r));
    }
    b.add(tube(pts, (t) => lerp(0.03, 0.012, t), 6, 30), 'wWood', { uv: 'keep', c: 0xffffff });
  }
  // a cluster of large leaves round the head (gold-leafed on Legendary, polished bands from Epic)
  const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.quadraticCurveTo(0.045, 0.06, 0, 0.13); leaf.quadraticCurveTo(-0.045, 0.06, 0, 0);
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, r = 0.08 + (i % 3) * 0.06;
    const mat = q >= 5 && i % 2 === 0 ? 'wQ5' : 'wCloth';
    b.add(extrude(leaf, 0.004, 0.002, 4), mat, { p: [Math.cos(a) * r, top + 0.04 + (i % 4) * 0.06, Math.sin(a) * r], r: [0.5, -a, -0.9], s: 1.3, c: i % 2 ? '#8ac84a' : '#62a034' });
  }
  if (q >= 4) for (let i = 0; i < 3; i++) b.add(torus(0.032, 0.006, 5, 14), 'wQ' + q, { p: [0, 0.25 + i * 0.3, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  if (T.gem) b.add(ico(0.03, 0), T.gem, { p: [0, top + 0.08, 0], flat: true, c: 0xffffff });
  const g = finish(b, T, q >= 5 ? along(top, top + 0.3, 10, 0, 0.12) : null, V3(0.15, top, 0));
  const lantern = lanternBuilder('yellow', 0.7, new Builder(13)).build({ shadow: false }); // (S14: a warm oil flame behind the glass, like the S13 effects; was bright green)
  lantern.position.set(0.17, top + 0.18, 0);
  g.add(lantern);
  return g;
}

// ---------------------------------------------------------------------------------------------- bow and arrow
export function recurveBow(q = 1) {
  const T = tier(q), b = new Builder(3);
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18 - 0.5, y = t * 1.36, u = Math.abs(t) / 0.5;
    // working limbs bend toward the string; the last stretch flicks forward hard (recurve)
    const z = u < 0.8 ? 0.21 * Math.pow(u, 1.7) : 0.21 * Math.pow(0.8, 1.7) - (u - 0.8) * 0.5;
    pts.push(V3(0, y, z / 0.75)); // pre-stretched: the limb is flattened in depth below
  }
  // flat, tapered limbs: wide on the face, thin in the bending direction
  b.add(tube(pts, (t) => lerp(0.03, 0.014, Math.abs(t - 0.5) * 2), 8, 40), q >= 3 ? 'wWood' : 'wWood', { uv: 'keep', s: [1.7, 1, 0.75], c: q >= 4 ? '#5a3020' : 0xffffff });
  // a chunky riser with a leather grip and brass plates
  b.add(rbox(0.055, 0.24, 0.06, 0.012), 'wWood', { c: '#5a3a20' });
  b.add(cyl(0.034, 0.034, 0.13, 10), 'wLeather', { c: '#2a1a10' });
  for (const sy of [-1, 1]) b.add(box(0.06, 0.05, 0.064), T.trim, { p: [0, sy * 0.1, 0], c: 0xffffff });
  const tipZ = 0.21 * Math.pow(0.8, 1.7), tipY = 0.8 * 0.68; // the string leaves the limbs where the recurve begins
  for (const sy of [-1, 1]) {
    const tp = pts[sy > 0 ? 18 : 0];
    b.add(cone(0.02, 0.07, 8), q >= 3 ? 'wGold' : 'wBrass', { p: [0, sy * 0.69, tp.z * 0.75], r: [sy > 0 ? 0 : PI, 0, 0], c: q <= 1 ? '#d8c8a8' : 0xffffff }); // nocks
  }
  if (T.gem) b.add(ico(0.018, 0), T.gem, { p: [0, 0.14, -0.034], flat: true, c: 0xffffff });
  if (q >= 4) for (const sy of [-1, 1]) {
    const seg = pts.filter((_, i) => (sy > 0 ? i >= 11 && i <= 16 : i >= 2 && i <= 7)).map((p) => V3(p.x * 1.7 + 0.026, p.y, p.z * 0.75));
    b.add(tube(seg, 0.005, 5, 12), 'wQ' + q, { uv: 'keep', c: 0xffffff }); // polished inlay along each limb
  }
  const g = finish(b, T, q >= 5 ? pts.filter((_, i) => i % 2 === 0).map((p) => V3(0.02, p.y, p.z * 0.75)) : null);
  // the string: two thin rods from the nocks to a middle point that follows the drawing hand (see fx.updateBowString)
  // a 1-pixel line vanished at game distance. The old line stays (hidden) as the place the middle point is kept.
  const sg = new THREE.BufferGeometry().setFromPoints([V3(0, tipY, tipZ), V3(0, 0, tipZ), V3(0, -tipY, tipZ)]);
  const line = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: 0xe8e0c8 }));
  line.name = 'bowstring'; line.visible = false;
  g.add(line);
  const smat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8 });
  const segs = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 1, 5, 1, true), smat); m.castShadow = false; g.add(m); return m; });
  g.userData.string = { line, tipZ, segs, top: V3(0, tipY, tipZ), bottom: V3(0, -tipY, tipZ) };
  placeString(g.userData.string, V3(0, 0, tipZ));
  return g;
}
// aim the two string rods from the nocks to the middle point
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
export function placeString(st, mid) {
  if (!st.segs) return;
  [[st.top, st.segs[0]], [st.bottom, st.segs[1]]].forEach(([end, m]) => {
    _d.subVectors(mid, end); const L = _d.length();
    m.position.copy(end).addScaledVector(_d, 0.5);
    m.scale.set(1, L, 1);
    m.quaternion.setFromUnitVectors(_up, _d.normalize());
  });
}

export function arrowMesh() {
  const b = new Builder(4);
  b.add(cyl(0.009, 0.009, 0.8, 6), 'wWood', { p: [0, 0.4, 0], c: 0xffffff });
  b.add(cone(0.022, 0.08, 6), 'wSteel', { p: [0, 0.84, 0], c: 0xffffff });
  for (let i = 0; i < 3; i++) b.add(box(0.003, 0.11, 0.038), 'wCloth', { p: [0, 0.07, 0], r: [0, (i / 3) * PI, 0], c: '#e8e0c8' });
  return b.build({ shadow: false });
}

export function flaskMesh(mat = 'wGlowAmber') {
  const b = new Builder(7);
  b.add(lathe([[0.001, -0.06], [0.05, -0.055], [0.06, -0.02], [0.045, 0.03], [0.018, 0.05], [0.018, 0.085], [0.001, 0.085]], 12), mat, { c: 0xffffff });
  b.add(cyl(0.02, 0.018, 0.025, 8), 'wWood', { p: [0, 0.095, 0], c: 0xffffff });
  return b.build({ shadow: false });
}

// ---------------------------------------------------------------------------------------------- shields
// The camera sits behind the player, so the back of a shield is what players see most: planks, straps, buckles, a
// padded cushion. Fronts carry plain heraldry: a horizontal chevron band, never a sun, a ring of beads or a target.
function shieldBack(b, w, h, z) {
  for (let i = 0; i < 5; i++) b.add(box(w / 5 - 0.006, h, 0.014), 'wWood', { p: [-w / 2 + (i + 0.5) * w / 5, 0, z], c: i % 2 ? '#7a5230' : '#6a4628' });
  for (const sy of [-1, 1]) b.add(box(w * 0.98, 0.035, 0.018), 'wIron', { p: [0, sy * h * 0.4, z - 0.006], c: '#5a5a60' });
  for (const sy of [-0.14, 0.12]) {
    b.add(box(0.05, 0.03, 0.03), 'wLeather', { p: [0, sy, z - 0.02], c: '#3a2616' });
    b.add(box(w * 0.5, 0.03, 0.012), 'wLeather', { p: [0, sy, z - 0.026], c: '#4e3420' });
    b.add(box(0.026, 0.034, 0.016), 'wBrass', { p: [w * 0.2, sy, z - 0.03], c: 0xffffff });
  }
  b.add(rbox(0.09, 0.2, 0.03, 0.01), 'wLeather', { p: [0, -0.01, z - 0.014], c: '#5a3a22' }); // forearm cushion
}
export function kiteShield(q = 1) {
  const T = tier(q), b = new Builder(2);
  const s = new THREE.Shape();
  s.moveTo(0, -0.42); s.quadraticCurveTo(0.26, -0.15, 0.25, 0.18); s.quadraticCurveTo(0.24, 0.32, 0, 0.34); s.quadraticCurveTo(-0.24, 0.32, -0.25, 0.18); s.quadraticCurveTo(-0.26, -0.15, 0, -0.42);
  b.add(extrude(s, 0.035, 0.015, 16), 'wPaint', { c: '#2c4a9a' });
  const rim = new THREE.Shape(s.getPoints(40));
  rim.holes.push(new THREE.Path(s.getPoints(40).map((p) => new THREE.Vector2(p.x * 0.88, p.y * 0.9 + 0.005)).reverse()));
  b.add(extrude(rim, 0.05, 0.008, 16), q >= 3 ? 'wGold' : q === 2 ? 'wBrass' : 'wIron', { c: 0xffffff });
  // a downward chevron band at the upper third
  const ch = new THREE.Shape(); ch.moveTo(-0.22, 0.17); ch.lineTo(0, 0.04); ch.lineTo(0.22, 0.17); ch.lineTo(0.22, 0.24); ch.lineTo(0, 0.11); ch.lineTo(-0.22, 0.24); ch.closePath();
  b.add(extrude(ch, 0.01, 0.004, 4), q >= 3 ? 'wGold' : 'wPaint', { p: [0, 0, 0.026], c: q >= 3 ? 0xffffff : '#e8dcc0' });
  if (T.gem) b.add(ico(0.03, 0), T.gem, { p: [0, -0.12, 0.034], s: [1, 1.3, 0.6], flat: true, c: 0xffffff });
  if (q >= 4) b.add(extrude(rim, 0.054, 0.002, 16), 'wQ' + q, { s: [1.012, 1.012, 0.2], p: [0, 0, 0.02], c: 0xffffff });
  shieldBack(b, 0.3, 0.5, -0.03);
  const out = finish(b, T, null); out.userData.isShield = true; return out;
}
export function roundShield(q = 1) {
  const T = tier(q), b = new Builder(9);
  // a face of planks with visible seams, an iron rim with rivets on the rim only, a low boss, an off-centre brace
  const R = 0.3;
  for (let i = 0; i < 7; i++) {
    const x = -R + (i + 0.5) * (2 * R / 7), hh = Math.sqrt(Math.max(0, R * R - x * x)) * 2 - 0.01;
    b.add(box(2 * R / 7 - 0.005, hh, 0.04), 'wWood', { p: [x, 0, 0.005], c: i % 2 ? '#8a3a2a' : '#9c4430' });
  }
  b.add(torus(R, 0.022, 6, 40), q >= 3 ? 'wGold' : 'wIron', { c: 0xffffff });
  for (let gI = 0; gI < 4; gI++) for (let k = 0; k < 3; k++) { const a = gI * PI / 2 + 0.35 + k * 0.14; b.add(sphere(0.01, 6, 4), q >= 3 ? 'wGold' : 'wBrass', { p: [Math.cos(a) * (R - 0.004), Math.sin(a) * (R - 0.004), 0.026], c: 0xffffff }); }
  b.add(box(0.5, 0.04, 0.012), q >= 2 ? 'wBrass' : 'wIron', { p: [0.02, 0.04, 0.03], r: [0, 0, 0.35], c: 0xffffff });
  b.add(sphere(0.07, 16, 10, 0, PI * 2, 0, PI / 2), q >= 3 ? 'wGold' : 'wIron', { p: [0, 0, 0.03], r: [PI / 2, 0, 0], s: [1, 0.55, 1], c: 0xffffff });
  if (T.gem) b.add(ico(0.026, 0), T.gem, { p: [0, 0, 0.07], flat: true, c: 0xffffff });
  if (q >= 4) b.add(torus(R - 0.03, 0.007, 5, 40), 'wQ' + q, { p: [0, 0, 0.03], c: 0xffffff });
  shieldBack(b, 0.36, 0.42, -0.026);
  const out = finish(b, T, null); out.userData.isShield = true; return out;
}
export function towerShield(q = 1) {
  const T = tier(q), b = new Builder(11);
  const s = new THREE.Shape();
  s.moveTo(-0.27, -0.5); s.lineTo(0.27, -0.5); s.lineTo(0.3, 0.42); s.quadraticCurveTo(0, 0.56, -0.3, 0.42); s.closePath();
  b.add(extrude(s, 0.05, 0.02, 12), 'wPaint', { c: '#7a2424' }); // the warden's crimson
  const rim = new THREE.Shape(s.getPoints(30));
  rim.holes.push(new THREE.Path(s.getPoints(30).map((p) => new THREE.Vector2(p.x * 0.86, p.y * 0.9)).reverse()));
  b.add(extrude(rim, 0.065, 0.01, 12), q >= 3 ? 'wGold' : 'wBronze', { c: 0xffffff });
  // two horizontal riveted bands and a raised diamond plate (never a vertical bar: no cross)
  for (const y of [-0.28, 0.24]) {
    b.add(box(0.5, 0.05, 0.016), 'wIron', { p: [0, y, 0.034], c: '#9a9aa2' });
    for (let i = 0; i < 6; i++) b.add(sphere(0.009, 6, 4), q >= 2 ? 'wBrass' : 'wIron', { p: [-0.21 + i * 0.084, y, 0.044], c: 0xffffff });
  }
  b.add(rbox(0.24, 0.13, 0.03, 0.012), q >= 3 ? 'wGold' : 'wSteel', { p: [0, -0.02, 0.044], c: 0xffffff });
  b.add(rbox(0.18, 0.08, 0.02, 0.008), 'wPaint', { p: [0, -0.02, 0.058], c: '#4a1414' });
  if (T.gem) b.add(ico(0.04, 0), T.gem, { p: [0, -0.02, 0.07], s: [1.4, 0.9, 0.6], flat: true, c: 0xffffff });
  if (q >= 4) b.add(extrude(rim, 0.07, 0.002, 12), 'wQ' + q, { s: [1.01, 1.01, 0.2], p: [0, 0, 0.03], c: 0xffffff });
  shieldBack(b, 0.48, 0.82, -0.05);
  const out = finish(b, T, null); out.userData.isShield = true; return out;
}

// ---------------------------------------------------------------------------------------------- pistols (the Deadeye)
// Black-powder steam pistols. Local +Y runs up the grip (the grip centre at the origin, like every hilt), the barrel
// lies along +Z on top of it, so in the fist (rotated like a blade) the barrel points down the forearm and the grip's
// top sits on the index finger. userData.muzzle is the muzzle in model space (fx.js puts the smoke and sparks there).
//   q1 an iron flintlock with a plain walnut stock      q2 brass bands, butt cap and trigger guard
//   q3 gold inlay along the stock, a set stone on the lock plate      q4 a slim pressure tank under the barrel with square
//   vents, a polished channel along the barrel      q5 its own shape: a square-section barrel and a square muzzle block
//   with polished gold edges (no flash, no glow; the hammer is a solid disc, the guard never forms a + from any side)
// o.short: the off-hand sidearm (a shorter barrel, no ramrod, a darker stock); o.long: Harl's Long Barrel (legendary)
export function pistol(q = 1, o = {}) {
  const T = tier(q), s = T.big, b = new Builder(o.short ? 23 : 22);
  const L = (o.short ? 0.2 : o.long ? 0.36 : 0.27) * (q >= 4 ? 1.06 : 1) * (q >= 5 ? 1.05 : 1);
  const z0 = -0.03, yB = 0.072, rB = 0.017 * (q >= 5 ? 1.08 : 1);
  const wood = o.short ? (q >= 3 ? '#3e2214' : '#5a341c') : q >= 3 ? '#4a2614' : '#7a4424';
  const band = q <= 1 ? 'wIron' : q >= 3 ? 'wGold' : 'wBrass';
  // the stock: a grip slanting back to the butt, a wrist up into the breech and a forestock under the barrel
  b.add(rbox(0.036, 0.125, 0.048, 0.014), 'wWood', { p: [0, -0.004, -0.014], r: [0.36, 0, 0], c: wood });
  b.add(rbox(0.034, 0.05, 0.1, 0.012), 'wWood', { p: [0, 0.046, 0.0], c: wood });
  b.add(box(0.028, 0.022, L * 0.72), 'wWood', { p: [0, yB - 0.026, z0 + L * 0.36 + 0.02], c: wood });
  b.add(rbox(0.042, 0.026, 0.056, 0.008), band, { p: [0, -0.062, -0.036], r: [0.36, 0, 0], c: q <= 1 ? '#6a6a70' : 0xffffff }); // butt cap
  // the barrel: octagonal iron (square-section and longer from q5), breech block, bands and the muzzle
  if (q >= 5) b.add(rbox(rB * 2.1, rB * 2.1, L, 0.004), T.blade, { p: [0, yB, z0 + L / 2], c: 0xffffff });
  else b.add(cyl(rB, rB * 1.08, L, 8), q <= 1 ? 'wIronW' : 'wSteel', { p: [0, yB, z0 + L / 2], r: [PI / 2, 0, 0], c: 0xffffff, flat: true });
  b.add(rbox(0.04, 0.04, 0.05, 0.008), q <= 1 ? 'wIron' : 'wSteel', { p: [0, yB - 0.004, z0 + 0.02], c: q <= 1 ? '#7a7a80' : 0xffffff });
  for (const t of o.short ? [0.6] : [0.42, 0.78]) b.add(rbox(0.046, 0.044, 0.02, 0.005), band, { p: [0, yB - 0.006, z0 + L * t], c: q <= 1 ? '#5a5a60' : 0xffffff });
  if (q >= 5) {
    b.add(rbox(0.05, 0.05, 0.034, 0.006), 'wSteel', { p: [0, yB, z0 + L - 0.012], c: 0xffffff }); // square muzzle block
    for (const sy of [-1, 1]) b.add(box(0.052, 0.006, 0.036), 'wQ5', { p: [0, yB + sy * 0.025, z0 + L - 0.012], c: 0xffffff });
  } else b.add(cyl(rB * 1.25, rB * 1.25, 0.018, 8), band, { p: [0, yB, z0 + L - 0.008], r: [PI / 2, 0, 0], c: q <= 1 ? '#5a5a60' : 0xffffff, flat: true });
  b.add(cyl(rB * 0.55, rB * 0.55, 0.004, 10), 'wDark', { p: [0, yB, z0 + L + 0.001], r: [PI / 2, 0, 0], c: 0xffffff }); // the bore
  // the lock: a flat plate on the side, a solid-disc hammer cocked back on top, a small pan
  b.add(rbox(0.008, 0.032, 0.07, 0.003), q <= 1 ? 'wIron' : 'wSteel', { p: [0.02, yB - 0.016, z0 + 0.0], c: q <= 1 ? '#8a8a90' : 0xffffff });
  b.add(cyl(0.017, 0.017, 0.012, 14), q <= 1 ? 'wIron' : 'wSteel', { p: [0.004, yB + 0.028, z0 - 0.018], r: [0, 0, PI / 2], c: q <= 1 ? '#8a8a90' : 0xffffff });
  b.add(rbox(0.01, 0.024, 0.012, 0.003), q <= 1 ? 'wIron' : 'wSteel', { p: [0.004, yB + 0.012, z0 - 0.006], c: q <= 1 ? '#8a8a90' : 0xffffff });
  if (T.gem) b.add(ico(0.008, 0), T.gem, { p: [0.025, yB - 0.016, z0 + 0.012], flat: true, c: 0xffffff });
  // trigger guard (an arc hanging under the wrist) and the trigger inside it
  b.add(torus(0.021, 0.0035, 5, 12, PI), band, { p: [0, 0.028, 0.012], r: [0, PI / 2, PI], c: q <= 1 ? '#5a5a60' : 0xffffff });
  b.add(box(0.005, 0.022, 0.006), 'wIron', { p: [0, 0.018, 0.01], r: [-0.3, 0, 0], c: '#4a4a50' });
  if (!o.short) b.add(cyl(0.0045, 0.0045, L * 0.86, 6), 'wWood', { p: [0, yB - 0.042, z0 + L * 0.45 + 0.02], r: [PI / 2, 0, 0], c: '#5a3a20' }); // ramrod
  if (q >= 3) for (const sx of [-1, 1]) b.add(box(0.002, 0.008, L * 0.5), 'wGold', { p: [sx * 0.0145, yB - 0.026, z0 + L * 0.4], c: 0xffffff }); // gold inlay
  if (q >= 4) {
    // a slim rectangular pressure tank under the forestock with two square steam vents
    b.add(rbox(0.026, 0.024, L * 0.42, 0.006), q >= 5 ? 'wSteel' : 'wBrass', { p: [0, yB - 0.052, z0 + L * 0.4], c: 0xffffff });
    for (const t of [0.28, 0.5]) b.add(box(0.012, 0.004, 0.012), 'wDark', { p: [0, yB - 0.066, z0 + L * t], c: 0xffffff });
    b.add(box(0.006, 0.004, L * 0.6), 'wQ' + Math.min(5, q), { p: [0, yB + rB * 1.02, z0 + L * 0.55], c: 0xffffff }); // polished channel
  }
  const g = finish(b, T, null, V3(0, yB, z0 + L));
  g.userData.muzzle = V3(0, yB, z0 + L + 0.01);
  g.userData.pistol = true;
  g.scale.setScalar(o.short ? 1 : s > 1 ? 1.04 : 1);
  return g;
}
export function sidearm(q = 1) { return pistol(q, { short: true }); }

// ---------------------------------------------------------------------------------------------- lookup
export const WEAPON_MODEL = { sword: longsword, axe: battleAxe, mace: flangedMace, hammer: warhammer, scimitar: scimitar, rod: reactorRod, staff: herbStaff, bow: recurveBow, dagger: dagger, pistol: pistol };
export const SHIELD_MODEL = { kite: kiteShield, round: roundShield, tower: towerShield };
// named legendaries with their own model (the item's model field; the look string reads 'sword@keeper')
export const LEG_MODEL = {
  keeper: (q) => longsword(q, { fork: true }), splitter: (q) => battleAxe(q, { double: true }), fang: (q) => scimitar(q, { notch: true }),
  // the Dragonslayer set (client/assets/dragonslayer.js): the GLB, with the built legendary shown while it loads
  ds_knight_sword: (q) => dsHolder('ds_knight_sword', longsword(q)),
  ds_ranger_bow: (q) => dsHolder('ds_ranger_bow', recurveBow(q)),
  ds_chemist_rod: (q) => dsHolder('ds_chemist_rod', reactorRod(q)),
  ds_sandblade_scimitar: (q) => dsHolder('ds_sandblade_scimitar', scimitar(q)),
  ds_warden_hammer: (q) => dsHolder('ds_warden_hammer', warhammer(q)),
  ds_herbalist_staff: (q) => dsHolder('ds_herbalist_staff', herbStaff(q)),
  // the Deadeye: Harl's Long Barrel ('pistol@longbarrel') and the Dragonslayer Hand Cannon (v107: the GLB, the built
  // legendary pistol while it loads)
  longbarrel: (q) => pistol(q, { long: true }), leg_pistol: (q) => pistol(q, { long: true }),
  ds_deadeye_pistol: (q) => dsHolder('ds_deadeye_pistol', pistol(q)),
};
// off-hand weapons held in the left fist (setCharOffhand): 'sidearm' and its named twins ('sidearm@ds_deadeye_pistol_l':
// the Hand Cannon's GLB mirrored, smaller and darker; client/assets/dragonslayer.js)
export const SIDEARM_MODEL = { sidearm, ds_deadeye_pistol_l: (q) => dsHolder('ds_deadeye_pistol_l', sidearm(q)) };
// shields with a model of their own (the offhand look reads 'kite@ds_knight_shield')
export const LEG_SHIELD = {
  ds_knight_shield: (q) => dsHolder('ds_knight_shield', kiteShield(q)),
  ds_warden_shield: (q) => dsHolder('ds_warden_shield', towerShield(q)),
  ds_sandblade_buckler: (q) => dsHolder('ds_sandblade_buckler', roundShield(q)),
};
