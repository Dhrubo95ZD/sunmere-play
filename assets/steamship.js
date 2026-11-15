// The valley's steam ship (Part Ten, "The Far Shore"): built in Harrowmouth from the Makers' drawings.
// A long riveted iron hull (34 m, 8 m beam) with a raked stem, a counter stern and a brass-capped bulwark; a flat planked
// deck with railings; square deckhouses (aft house, engine casing, bridge house with a wheelhouse on top); three square
// funnels in a fore-aft line that smoke gently; glowing furnace vents along the waterline; two cargo hatches; a stern screw
// and rudder (the screw is a solid disc); a gangway down to the pier and mooring ropes to iron bollards on the pier.
// Content rules: no spokes (the screw and the windlass drums are solid), no masts or yards (no crosses), no flags, no
// domes or round cowls (ventilators and funnels are square), nothing radiating; checked from straight above.
//
// buildSteamship(opts) returns a Group in ship space: +z is the bow, +x the starboard side (the side the gangway is on),
// y = 0 is the waterline. opts (all in ship space, so the caller converts from world):
//   gangway: [x, y, z]    where the gangway foot rests (on the pier); its head hinges on the starboard bulwark at that z
//   bollards: [[x, y, z]] pier bollards (y = the pier top); ropes: [[chockZ, bollardIndex]] lines from deck chocks to them
//   iceBow: true          the armoured ice bow of Chapter 33 (plain iron plate over the bow, a flat forefoot bar); built as its
//                         own mesh, root.userData.iceBow, so a caller can hide it until the refit
// userData: steamship (true), update(dt, t) (bob, smoke, glow flicker, gangway), dispose(), gangwayFoot (V3), body (the
// bobbing group), stats { meshes, tris }.
import * as THREE from 'three';
import { Builder, box, rbox, cyl, tube, V3, lerp, sstep } from './kit.js';
import { wear, bdisc, plate, vent, stack, PI } from './bossParts.js';
import { glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { puffTex } from '../engine/textures.js';
import { G } from '../engine/globals.js';

// ---------------------------------------------------------------- hull lines (metres)
const HB = 4.0;          // half beam
const DECK = 2.6;        // main deck above the waterline
const KEEL = -2.0;       // keel depth amidships
const N = 72;            // sections along the hull
const zBow = (y) => 15.7 + 0.28 * (y - KEEL);                 // raked stem: 15.7 at the keel, 17 at the deck
const zSt = (y) => -17 + Math.max(0, -y) * 0.45;              // counter stern, cut up under water for the screw
const zn = (u) => -17 + 34 * u;
function halfW(u) {
  const z = zn(u);
  if (z > 3) { const t = Math.min(1, (z - 3) / 14); return HB * Math.pow(Math.max(0, 1 - t * t), 0.62); }
  if (z < -7) { const t = (-7 - z) / 10; return HB - 1.05 * t * t; }
  return HB;
}
const keelY = (u) => KEEL + 1.15 * sstep(0.8, 1, u) + 0.25 * sstep(0.12, 0, u);
const bulH = (u) => 0.32 + 0.8 * sstep(0.8, 1, u);            // bulwark: low along the waist, rising to the bow
// a point on the starboard shell at section u, fullness s (0 keel .. 1 side) and nominal height y
function shell(u, s, y) {
  let yy = y;
  if (y < -0.4) yy = -0.4 + (y + 0.4) * (keelY(u) + 0.4) / (KEEL + 0.4);
  let k = s;
  if (yy < 0 && u < 0.16) k *= 1 - 0.6 * (1 - u / 0.16) * Math.min(1, -yy / 1.4);
  return [k * halfW(u) * (1 + 0.03 * Math.max(0, yy) / DECK), yy, lerp(zSt(yy), zBow(yy), u)];
}
// section u for a ship-space z at height y (inverse of the lerp above)
const uAt = (z, y) => Math.min(1, Math.max(0, (z - zSt(y)) / (zBow(y) - zSt(y))));
const sideX = (z, y) => shell(uAt(z, y), 1, y)[0];
// outward plan normal of the starboard side at z (for rivets and ports)
function sideN(z, y) {
  const e = 0.2, dx = sideX(z + e, y) - sideX(z - e, y);
  return V3(2 * e, 0, -dx).normalize();
}

// a grid surface from rows of [x, y, z] points; flipped so the normal at probe row/col points along `out`
function grid(rows, out, pi = Math.floor(rows.length / 2), pj = 0) {
  const nr = rows.length, nc = rows[0].length, pos = [], idx = [];
  for (const r of rows) for (const p of r) pos.push(p[0], p[1], p[2]);
  for (let i = 0; i < nr - 1; i++) for (let j = 0; j < nc - 1; j++) {
    const a = i * nc + j, b = (i + 1) * nc + j, c = i * nc + j + 1, d = (i + 1) * nc + j + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal, k = pi * nc + pj;
  if (n.getX(k) * out[0] + n.getY(k) * out[1] + n.getZ(k) * out[2] < 0) {
    for (let t = 0; t < idx.length; t += 3) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
    g.setIndex(idx); g.computeVertexNormals();
  }
  return g;
}
const mirror = (rows) => rows.map((r) => r.map(([x, y, z]) => [-x, y, z]));
const Y = V3(0, 1, 0), Z = V3(0, 0, 1);
const qTo = (from, n) => new THREE.Quaternion().setFromUnitVectors(from, n);

// ---------------------------------------------------------------- smoke: one soft-puff Points cloud for all three funnels
let smokeMat = null;
function smokeMaterial() {
  if (smokeMat) return smokeMat;
  smokeMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, pxScale: { value: 500 } }]),
    vertexShader: `attribute float size; attribute float alpha; attribute float rot; attribute vec3 tint;
      uniform float pxScale; varying float vA; varying float vR; varying vec3 vC;
      #include <fog_pars_vertex>
      void main() {
        vA = alpha; vR = rot; vC = tint;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = alpha > 0.002 ? size * pxScale / max(0.1, -mvPosition.z) : 0.0;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D map; varying float vA; varying float vR; varying vec3 vC;
      #include <fog_pars_fragment>
      void main() {
        vec2 q = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR);
        q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
        if (dot(q, q) > 0.25) discard;
        vec4 tx = texture2D(map, q + 0.5);
        gl_FragColor = vec4(vC * tx.rgb, tx.a * vA);
        if (gl_FragColor.a < 0.004) discard;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true,
  });
  smokeMat.uniforms.map.value = puffTex();
  return smokeMat;
}
const _sz = new THREE.Vector2();
function smokeScale(renderer, scene, camera) {
  const rt = renderer.getRenderTarget();
  const h = rt ? rt.height : renderer.getDrawingBufferSize(_sz).y;
  smokeMat.uniforms.pxScale.value = h * 0.5 * camera.projectionMatrix.elements[5];
}

// ---------------------------------------------------------------- deck fittings
// a square deckhouse on the deck: painted walls, brass base and eaves strips, an overhanging roof with a brass rim,
// square windows (brass frames, dark glass) and panelled doors
function house(b, o) {
  const { z0, z1, w, y0 = DECK, h, wall = '#d2c6a8', roof = '#4a3c30', winSide = 0, winEnd = 0, doorEnd = 0, doorSide = 0, lit = [], seed = 1, winH = 0.55, winY = 0.58 } = o;
  const L = z1 - z0, zc = (z0 + z1) / 2, yc = y0 + h / 2;
  b.add(rbox(w, h, L, 0.06, 2), 'wPaint', { p: [0, yc, zc], c: wear(wall, 0.12, seed) });
  b.add(rbox(w + 0.06, 0.16, L + 0.06, 0.03, 1), 'wPaint', { p: [0, y0 + 0.08, zc], c: '#3a3634' });
  b.add(rbox(w + 0.04, 0.07, L + 0.04, 0.02, 1), 'wBrass', { p: [0, y0 + h - 0.12, zc] });
  b.add(rbox(w + 0.36, 0.14, L + 0.36, 0.04, 1), 'wPaint', { p: [0, y0 + h + 0.07, zc], c: wear(roof, 0.2, seed + 1) });
  b.add(rbox(w + 0.4, 0.05, L + 0.4, 0.02, 1), 'wBrass', { p: [0, y0 + h + 0.02, zc] });
  const win = (p, q, k, glow) => {
    b.add(box(0.66, winH + 0.1, 0.06), 'wBrass', { p, q });
    const g = V3(0, 0, 0.025).applyQuaternion(q);
    b.add(box(0.54, winH - 0.02, 0.03), glow ? 'wGlowAmber' : 'wDark', { p: [p[0] + g.x, p[1] + g.y, p[2] + g.z], q, c: glow ? '#7a6a50' : '#26323c' });
    const m = V3(0, 0, 0.05).applyQuaternion(q);
    b.add(box(0.04, winH, 0.03), 'wBrass', { p: [p[0] + m.x, p[1] + m.y, p[2] + m.z], q });
  };
  const door = (p, q) => {
    b.add(rbox(0.8, 1.7, 0.08, 0.03, 1), 'woodDark', { p, q, c: '#8a6a4a' });
    b.add(rbox(0.6, 0.6, 0.04, 0.02, 1), 'woodDark', { p: [p[0], p[1] + 0.4, p[2]], q, c: '#6a4e36', s: 1 });
    const hv = V3(0.28, -0.05, 0.06).applyQuaternion(q);
    b.add(cyl(0.035, 0.035, 0.08, 6), 'wBrass', { p: [p[0] + hv.x, p[1] + hv.y, p[2] + hv.z], r: [PI / 2, 0, 0] });
  };
  let li = 0;
  for (const sx of [-1, 1]) {
    const q = qTo(Z, V3(sx, 0, 0));
    for (let i = 0; i < winSide; i++) {
      const z = z0 + (i + 0.5) * L / winSide;
      if (doorSide && Math.abs(z - zc) < 0.7) { if (i === Math.floor(winSide / 2)) door([sx * (w / 2 + 0.03), y0 + 0.88, zc], q); continue; }
      win([sx * (w / 2 + 0.02), y0 + h * winY + 0.2, z], q, i, lit.includes(li++));
    }
  }
  for (const sz of [-1, 1]) {
    const q = qTo(Z, V3(0, 0, sz)), zf = sz > 0 ? z1 + 0.02 : z0 - 0.02;
    const n = winEnd, dz = doorEnd === sz;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * w / n;
      if (dz && Math.abs(x) < 0.7) continue;
      win([x, y0 + h * winY + 0.2, zf], q, i, lit.includes(li++));
    }
    if (dz) door([0, y0 + 0.88, zf + sz * 0.02], q);
  }
}
// a cargo hatch: a riveted coaming, a tarpaulin over the boards, iron battens and wedge cleats
function hatch(b, z0, z1, w, seed) {
  const L = z1 - z0, zc = (z0 + z1) / 2;
  b.add(rbox(w, 0.62, L, 0.05, 1), 'wPaint', { p: [0, DECK + 0.2, zc], c: wear('#34403f', 0.2, seed) });
  b.add(rbox(w + 0.12, 0.08, L + 0.12, 0.02, 1), 'wIron', { p: [0, DECK + 0.48, zc], c: '#5a5650' });
  b.add(rbox(w - 0.1, 0.12, L - 0.1, 0.05, 2), 'cloth', { p: [0, DECK + 0.56, zc], c: wear('#59604a', 0.22, seed + 1) });
  for (let i = 0; i < 3; i++) b.add(box(w + 0.02, 0.05, 0.1), 'wIron', { p: [0, DECK + 0.63, z0 + (i + 0.5) * L / 3], c: '#4a4844' });
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) b.add(box(0.06, 0.12, 0.18), 'wIron', { p: [sx * (w / 2 + 0.05), DECK + 0.38, z0 + 0.3 + i * (L - 0.6) / 3], c: '#4a4844' });
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) b.add(cyl(0.025, 0.025, 0.03, 6), 'wBrass', { p: [sx * (w / 2 + 0.005), DECK + 0.1, z0 + 0.2 + i * (L - 0.4) / 5], r: [0, 0, PI / 2] });
}
// a square trunk ventilator with a square hood facing forward (never a round cowl)
function ventilator(b, x, z, h, face = 1) {
  b.add(rbox(0.42, h, 0.42, 0.04, 1), 'wPaint', { p: [x, DECK + h / 2, z], c: '#d2c6a8' });
  b.add(rbox(0.5, 0.42, 0.62, 0.05, 1), 'wPaint', { p: [x, DECK + h + 0.1, z + face * 0.1], c: '#d2c6a8' });
  b.add(box(0.36, 0.3, 0.04), 'wDark', { p: [x, DECK + h + 0.08, z + face * 0.42], c: '#1a1614' });
  b.add(rbox(0.52, 0.05, 0.64, 0.02, 1), 'wBrass', { p: [x, DECK + h + 0.33, z + face * 0.1] });
}
// twin mooring bitts (two short iron posts on a plate)
function bitts(b, x, y, z, along = 'z') {
  b.add(rbox(along === 'z' ? 0.42 : 1.0, 0.06, along === 'z' ? 1.0 : 0.42, 0.02, 1), 'wIron', { p: [x, y + 0.03, z], c: '#3a3836' });
  for (const k of [-1, 1]) {
    const p = along === 'z' ? [x, y, z + k * 0.3] : [x + k * 0.3, y, z];
    b.add(cyl(0.11, 0.12, 0.48, 10), 'wIron', { p: [p[0], y + 0.27, p[2]], c: '#2e2c2a' });
    b.add(cyl(0.15, 0.15, 0.05, 10), 'wIron', { p: [p[0], y + 0.52, p[2]], c: '#3a3836' });
  }
}

export function buildSteamship(opts = {}) {
  const root = new THREE.Group();
  root.name = 'steamship';
  root.userData.steamship = true;
  const body = new THREE.Group();
  root.add(body);
  const b = new Builder(410);

  // ---------------------------------------------------------------- the hull shell, in three paint bands
  const U = Array.from({ length: N + 1 }, (_, i) => i / N);
  const band = (prof, c, mat = 'wPaint') => {
    const rows = U.map((u) => prof(u).map(([s, y]) => shell(u, s, y)));
    for (const side of [1, -1]) {
      const R = side > 0 ? rows : mirror(rows);
      b.add(grid(R, [side, 0, 0], N >> 1, R[0].length - 1), mat, { c });
    }
  };
  const UNDER = [[0, KEEL], [0.3, -1.97], [0.58, -1.85], [0.78, -1.62], [0.9, -1.3], [0.97, -0.9], [1, -0.4], [1, -0.05]];
  band(() => UNDER, wear('#6e3026', 0.18, 3));
  band(() => [[1, -0.05], [1, 0.42]], '#1c1c1e');
  band((u) => [[1, 0.42], [1, 1.2], [1, 2.0], [1, DECK], [1, DECK + bulH(u)]], wear('#33434a', 0.2, 4));
  // bulwark inner face and its top, then the deck itself
  const inner = (u, y) => { const [x, , z] = shell(u, 1, y); return [Math.max(0, x - 0.1), y, z + (u > 0.995 ? -0.1 : 0)]; };
  {
    const rowsIn = U.map((u) => [inner(u, DECK - 0.02), inner(u, DECK + bulH(u))]);
    const rowsTop = U.map((u) => [inner(u, DECK + bulH(u)), shell(u, 1, DECK + bulH(u))]);
    for (const side of [1, -1]) {
      const m = (R) => (side > 0 ? R : mirror(R));
      b.add(grid(m(rowsIn), [-side, 0, 0], N >> 1, 0), 'wPaint', { c: '#8a8478' });
      b.add(grid(m(rowsTop), [0, 1, 0], N >> 1, 0), 'wPaint', { c: '#33434a' });
    }
    const deckRows = U.map((u) => { const [x, , z] = inner(u, DECK); return [[-x, DECK, z], [0, DECK, z], [x, DECK, z]]; });
    b.add(grid(deckRows, [0, 1, 0]), 'wood', { c: '#c0a27a', us: 0.9 });
  }
  // the transom: a fan over the stern section from the keel up to the bulwark top, and the stern bulwark's inner face
  {
    const prof = [...UNDER, [1, 0.42], [1, 1.2], [1, 2.0], [1, DECK], [1, DECK + bulH(0)]];
    const pts = prof.map(([s, y]) => shell(0, s, y));
    const ring = [...pts, ...pts.slice().reverse().map(([x, y, z]) => [-x, y, z])];
    const c = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length, a[2] + p[2] / ring.length], [0, 0, 0]);
    const rows = [ring, ring.map(() => c)];
    b.add(grid(rows, [0, 0, -1], 0, 3), 'wPaint', { c: (x, y) => (y < -0.05 ? [0.16, 0.035, 0.025] : y < 0.42 ? [0.012, 0.012, 0.013] : [0.034, 0.05, 0.058]) });
    const xo = shell(0, 1, DECK)[0];
    b.add(box(2 * xo - 0.1, bulH(0), 0.12), 'wPaint', { p: [0, DECK + bulH(0) / 2, zSt(DECK) + 0.06], c: '#8a8478' });
    b.add(box(2 * xo - 0.1, 0.04, 0.12), 'wPaint', { p: [0, DECK + bulH(0) + 0.0, zSt(DECK) + 0.06], c: '#33434a' });
  }

  // ---------------------------------------------------------------- strakes, rivets, ports, the brass capping rail
  const along = (y, off, u0 = 0, u1 = 1, n = 40) => Array.from({ length: n + 1 }, (_, i) => {
    const u = lerp(u0, u1, i / n), [x, yy, z] = shell(u, 1, y);
    return V3(x + off, yy, z);
  });
  for (const side of [1, -1]) {
    const flip = (pts) => (side > 0 ? pts : pts.map((p) => V3(-p.x, p.y, p.z)));
    // lap seams (thin iron strips) and the brass rubbing strake at the deck line
    for (const y of [0.78, 1.42, 2.06]) b.add(tube(flip(along(y, 0.012, 0.004, 0.985)), 0.022, 4, 120, { capEnd: false }), 'wIron', { c: '#2a3438' });
    b.add(tube(flip(along(DECK - 0.04, 0.03, 0.002, 0.99)), 0.075, 6, 140, { capEnd: false }), 'wBrass', {});
    b.add(tube(flip(along(1.1, 0.03, 0.03, 0.96)), 0.05, 5, 120, { capEnd: false }), 'wIron', { c: '#2e2c2a' });
    // capping rail along the bulwark top (follows the sheer up to the bow)
    const cap = U.filter((u, i) => i % 2 === 0).map((u) => { const [x, y, z] = shell(u, 1, DECK + bulH(u)); return V3(side * (x - 0.05), y + 0.03, z); });
    b.add(tube(cap, 0.075, 6, 140, { capEnd: false }), 'wBrass', {});
    // rivet rows along each seam and up the frames every 3 m
    const rivet = (z, y) => {
      const n = sideN(z, y), x = sideX(z, y) + 0.012;
      b.add(cyl(0.032, 0.036, 0.04, 5, 1, true), 'wIron', { p: [side * x, y, z], q: qTo(Y, V3(side * n.x, 0, n.z)), c: '#4a5458' });
    };
    for (const y of [0.7, 0.86, 1.34, 1.5, 1.98, 2.14]) for (let z = -16.6; z < 16.2; z += 0.6) if (sideX(z, y) > 0.25) rivet(z, y);
    for (let z = -15; z < 14; z += 3) for (let y = 0.55; y < 2.4; y += 0.22) if (sideX(z, y) > 0.25) rivet(z, y);
    // square ports along the topsides (rounded corners, brass frames, dark glass), clear of the vents and the gangway
    for (let z = -14.4; z < 12.5; z += 1.8) {
      if (side > 0 && Math.abs(z - (opts.gangway ? opts.gangway[2] : -11)) < 1.1) continue;
      const y = 1.76, n = sideN(z, y), x = sideX(z, y), q = qTo(Z, V3(side * n.x, 0, n.z));
      b.add(rbox(0.42, 0.36, 0.06, 0.025, 1), 'wBrass', { p: [side * (x + 0.02), y, z], q });
      b.add(box(0.3, 0.24, 0.05), 'wDark', { p: [side * (x + 0.04), y, z], q, c: '#22303a' });
    }
    // furnace vents at the waterline along the engine room
    for (const z of [-3.6, -1.2, 1.2, 3.6]) {
      const x = sideX(z, 0.48);
      b.addBuilder(vent(1.0, 0.42, { frame: 'wDark', frameC: '#2a2622', n: 3, depth: 0.1 }), { p: [side * (x + 0.04), 0.5, z], r: [0, side * PI / 2, 0] });
      b.add(rbox(1.14, 0.08, 0.14, 0.02, 1), 'wBrass', { p: [side * (x + 0.03), 0.76, z], r: [0, side * PI / 2, 0] });
    }
    // fenders hanging over the side (starboard: against the pier)
    if (side > 0) for (const z of [-14.2, -7.6, -2.4, 4.4, 10.6]) {
      const x = sideX(z, 1.7), top = shell(uAt(z, DECK), 1, DECK + bulH(uAt(z, DECK)))[1];
      b.add(cyl(0.2, 0.2, 0.8, 10), 'cloth', { p: [x + 0.22, 1.55, z], c: '#6a5a40' });
      for (const y of [1.25, 1.85]) b.add(cyl(0.21, 0.21, 0.05, 10), 'cloth', { p: [x + 0.22, y, z], c: '#4a3e2c' });
      b.add(cyl(0.025, 0.025, top - 1.9, 4), 'cloth', { p: [x + 0.1, (top + 1.9) / 2, z], r: [0, 0, 0.08], c: '#8a7450' });
    }
  }

  // ---------------------------------------------------------------- railings on the bulwark (waist and stern; the bow has the high bulwark)
  const gz = opts.gangway ? opts.gangway[2] : -11;
  {
    const railU1 = uAt(13.2, DECK);
    const pts = (side, h, u0, u1) => { const out = []; for (let i = 0; i <= 40; i++) { const u = lerp(u0, u1, i / 40), [x, y, z] = shell(u, 1, DECK + bulH(u)); out.push(V3(side * (x - 0.06), y + h, z)); } return out; };
    for (const side of [1, -1]) {
      const spans = side > 0 ? [[0.0, uAt(gz - 0.75, DECK)], [uAt(gz + 0.75, DECK), railU1]] : [[0.0, railU1]];
      for (const [u0, u1] of spans) {
        for (const h of [0.42, 0.8]) b.add(tube(pts(side, h, u0, u1), 0.032, 5, 60, { capEnd: true, capStart: true }), 'wIron', { c: '#4a4a4c' });
        const zA = shell(u0, 1, DECK)[2], zB = shell(u1, 1, DECK)[2], n = Math.max(1, Math.round((zB - zA) / 1.5));
        for (let i = 0; i <= n; i++) {
          const u = lerp(u0, u1, i / n), [x, y, z] = shell(u, 1, DECK + bulH(u));
          b.add(cyl(0.03, 0.035, 0.84, 6), 'wBrass', { p: [side * (x - 0.06), y + 0.42, z] });
        }
      }
    }
    // across the stern
    const xs = shell(0, 1, DECK + bulH(0))[0] - 0.06, zs = zSt(DECK) + 0.06, ys = DECK + bulH(0);
    for (const h of [0.42, 0.8]) b.add(tube([V3(-xs, ys + h, zs), V3(xs, ys + h, zs)], 0.032, 5, 8, { capEnd: false }), 'wIron', { c: '#4a4a4c' });
    for (let i = 1; i < 4; i++) b.add(cyl(0.03, 0.035, 0.84, 6), 'wBrass', { p: [-xs + i * xs / 2, ys + 0.42, zs] });
  }

  // ---------------------------------------------------------------- deckhouses, funnels, hatches, fittings
  // the aft house (crew quarters), a gangway landing ahead of it
  house(b, { z0: -15.6, z1: -12.4, w: 4.2, h: 2.1, winSide: 3, winEnd: 3, doorEnd: 1, lit: [1, 4], seed: 11 });
  hatch(b, -9.4, -6.6, 3.0, 21);
  // the engine casing with three square funnels in a line, skylights between them and square ventilators at its corners
  const ENG = { z0: -5.2, z1: 5.2, w: 5.0, h: 2.1 };
  house(b, { ...ENG, winSide: 6, winEnd: 2, doorEnd: -1, wall: '#c8bc9e', seed: 12 });
  const roofY = DECK + ENG.h + 0.14;
  const FUN = [-3.5, 0, 3.5], FW = 1.5, FH = 5.6, RAKE = -0.06;
  const smokeAt = [];
  for (const [k, z] of FUN.entries()) {
    b.add(rbox(FW + 0.5, 0.36, FW + 0.5, 0.06, 1), 'wPaint', { p: [0, roofY + 0.18, z], c: '#2a2c30' });
    b.add(rbox(FW + 0.62, 0.08, FW + 0.62, 0.03, 1), 'wBrass', { p: [0, roofY + 0.36, z] });
    b.addBuilder(stack(FW, FH, { mat: 'wPaint', c: '#2c2e32', trim: 'wBrass', trimC: 0xffffff, seed: 30 + k }), { p: [0, roofY + 0.3, z], r: [RAKE, 0, 0] });
    // a copper steam pipe up the aft face of each funnel, ending in a short square cap
    const ph = FH * 0.9;
    b.add(cyl(0.07, 0.07, ph, 8), 'wCopper', { p: [0.4, roofY + 0.3 + ph / 2, z - FW / 2 - 0.14 - Math.sin(-RAKE) * ph / 2], r: [RAKE, 0, 0] });
    b.add(rbox(0.2, 0.2, 0.2, 0.03, 1), 'wBrass', { p: [0.4, roofY + 0.3 + ph + 0.05, z - FW / 2 - 0.14 - Math.sin(-RAKE) * ph] });
    const top = FH + FW * 0.42;
    smokeAt.push(V3(0, roofY + 0.3 + top * Math.cos(RAKE), z + top * Math.sin(RAKE)));
  }
  for (const z of [-1.75, 1.75]) {
    b.add(rbox(1.4, 0.32, 1.0, 0.04, 1), 'wPaint', { p: [-1.2, roofY + 0.16, z], c: '#d2c6a8' });
    b.add(box(1.2, 0.04, 0.8), 'wDark', { p: [-1.2, roofY + 0.33, z], c: '#2a3640' });
    for (let i = 0; i < 4; i++) b.add(box(0.03, 0.05, 0.86), 'wBrass', { p: [-1.62 + i * 0.28, roofY + 0.36, z] });
  }
  for (const [x, z, f] of [[-2.0, -5.9, -1], [2.0, -5.9, -1], [-2.0, 5.9, 1], [2.0, 5.9, 1]]) ventilator(b, x, z, 1.5, f);
  // the bridge house and the wheelhouse on top, with a railed bridge deck round it
  const BR = { z0: 6.6, z1: 9.8, w: 4.4, h: 2.1 };
  house(b, { ...BR, winSide: 3, winEnd: 3, doorEnd: -1, seed: 13 });
  const bdY = DECK + BR.h + 0.14;
  house(b, { z0: 7.3, z1: 9.5, w: 3.2, y0: bdY, h: 1.85, winSide: 3, winEnd: 4, doorEnd: -1, wall: '#d8ccb0', winH: 0.7, winY: 0.5, seed: 14 });
  {
    const x = BR.w / 2 + 0.1, y = bdY, z0 = BR.z0 - 0.12, z1 = BR.z1 + 0.12;
    const loop = [V3(-x, y, z0), V3(-x, y, z1), V3(x, y, z1), V3(x, y, z0)];
    for (const h of [0.45, 0.9]) for (let i = 0; i < 4; i++) {
      if (i === 3) continue; // open at the back (the ladder side)
      b.add(tube([loop[i].clone().setY(y + h), loop[(i + 1) % 4].clone().setY(y + h)], 0.03, 5, 6, { capEnd: false }), 'wIron', { c: '#4a4a4c' });
    }
    for (const [px, pz] of [[-x, z0], [-x, (z0 + z1) / 2], [-x, z1], [0, z1], [x, z1], [x, (z0 + z1) / 2], [x, z0]]) b.add(cyl(0.03, 0.035, 0.92, 6), 'wBrass', { p: [px, y + 0.46, pz] });
    // a ladder up the back of the bridge house
    for (const sx of [-0.35, 0.35]) b.add(box(0.06, BR.h + 0.9, 0.06), 'wIron', { p: [1.3 + sx, DECK + (BR.h + 0.9) / 2, z0 - 0.2], r: [-0.18, 0, 0], c: '#3a3a3c' });
    for (let i = 0; i < 7; i++) b.add(box(0.7, 0.04, 0.08), 'wIron', { p: [1.3, DECK + 0.3 + i * 0.36, z0 - 0.2 - (0.3 + i * 0.36 - (BR.h + 0.9) / 2) * Math.tan(0.18) - 0.06], c: '#4a4a4c' });
  }
  hatch(b, 10.4, 12.9, 3.0, 22);
  // the bow: a windlass with solid drums between two bitts, fairleads at the bulwark
  {
    const z = 14.4;
    b.add(rbox(1.6, 0.5, 0.7, 0.05, 1), 'wPaint', { p: [0, DECK + 0.25, z], c: '#3a4448' });
    for (const sx of [-1, 1]) {
      b.add(bdisc(0.32, 0.36, 0.05, 18), 'wIron', { p: [sx * 0.95, DECK + 0.42, z], r: [0, 0, PI / 2], c: '#3a3836' });
      b.add(rbox(0.4, 0.18, 0.18, 0.02, 1), 'wBrass', { p: [sx * 0.95, DECK + 0.42, z] }); // square drum nut, no disc in a ring
      b.add(rbox(0.06, 0.12, 0.2, 0.02, 1), 'wBrass', { p: [sx * 1.17, DECK + 0.6, z] });
    }
    b.add(cyl(0.06, 0.06, 2.4, 8), 'wIron', { p: [0, DECK + 0.42, z], r: [0, 0, PI / 2], c: '#5a5650' });
    for (const sx of [-1, 1]) bitts(b, sx * 1.45, DECK, 12.95 + 0.4);
  }
  // stern and waist bitts, and the starboard chocks the mooring lines run through
  for (const sx of [-1, 1]) { bitts(b, sx * 2.0, DECK, -16.0); bitts(b, sx * 3.0, DECK, -4.0 + (sx > 0 ? 0 : 0.5)); }
  const chock = (z) => {
    const u = uAt(z, DECK), [x, y] = shell(u, 1, DECK + bulH(u));
    b.add(rbox(0.22, 0.16, 0.5, 0.05, 1), 'wBrass', { p: [x - 0.05, y + 0.08, z] });
    return [x - 0.05, y + 0.14, z];
  };
  // deck cargo: a few lashed crates by the aft hatch, coal sacks by the casing
  for (const [x, z, s, r] of [[-1.2, -10.6, 0.9, 0.1], [-1.4, -11.5, 0.7, -0.2], [-0.4, -11.2, 0.6, 0.3]]) b.add(rbox(s, s, s, 0.03, 1), 'wood', { p: [x, DECK + s / 2, z], r: [0, r, 0], c: '#a88a60' });
  for (const [x, z] of [[-2.0, -6.2], [-1.6, -6.0], [2.1, 6.2]]) b.add(rbox(0.55, 0.32, 0.4, 0.12, 2), 'cloth', { p: [x, DECK + 0.16, z], c: '#7a6e58' });

  // ---------------------------------------------------------------- the screw (a solid disc with a raised boss) and the rudder
  {
    const z = -16.7, y = -1.05;
    b.add(cyl(0.12, 0.12, 1.4, 10), 'wIron', { p: [0, y, z + 0.7], r: [PI / 2, 0, 0], c: '#3a3836' });
    b.add(bdisc(0.95, 0.2, 0.06, 28), 'wBronze', { p: [0, y, z], r: [PI / 2, 0, 0] });
    b.add(bdisc(0.32, 0.42, 0.06, 16), 'wBronze', { p: [0, y, z], r: [PI / 2, 0, 0], c: '#c8a070' });
    b.add(rbox(0.16, 0.3, 0.26, 0.03, 1), 'wBronze', { p: [0, y + 0.55, z - 0.12], c: '#a08050' });
    b.add(cyl(0.08, 0.08, 1.9, 8), 'wIron', { p: [0, -0.9, -17.05], c: '#3a3836' }); // the stock runs up into the hull, under the water
    b.addBuilder(plate(1.1, 2.3, 0.14, { mat: 'wPaint', c: '#6e3026', trim: 'wIron', trimC: '#3a3836', boltMat: 'wIron', lips: true, inset: false, seed: 40 }), { p: [0, -1.05, -17.95], r: [0, PI / 2, 0] });
  }

  body.add(b.build());

  // ---------------------------------------------------------------- the armoured ice bow (opts.iceBow, Chapter 33)
  // a second skin of plain iron plate over the bow from below the waterline to the bulwark, laid in square plates with lapped
  // seams and rivet rows, and a heavy flat forefoot bar down the stem. Smooth and blunt: no teeth, no spikes, no ram.
  // Its own mesh (root.userData.iceBow) so a pier can show or hide it as the story stands.
  if (opts.iceBow) {
    const ib = new Builder(411), Z0 = 5.0, Y0 = -1.5, OFF = 0.07;
    const yTop = (u) => DECK + bulH(u) - 0.12;
    const u0 = uAt(Z0, 0), NU = 26, YS = [0, 0.2, 0.4, 0.6, 0.8, 1];
    // a point on the plate skin: section t (0 at Z0 .. 1 at the stem), height fraction f (Y0 .. the bulwark top)
    const skin = (t, f, side, off = OFF) => {
      const u = lerp(u0, 1, t), y = lerp(Y0, yTop(u), f), [x, yy, z] = shell(u, 1, y);
      const n = t > 0.985 ? V3(0, 0, 1) : sideN(z, yy);
      return [side * (x + n.x * off), yy, z + n.z * off];
    };
    const rowsFor = (side) => Array.from({ length: NU + 1 }, (_, i) => YS.map((f) => skin(i / NU, f, side)));
    const IRON = wear('#9aa2a4', 0.14, 5);
    for (const side of [1, -1]) {
      ib.add(grid(rowsFor(side), [side, 0, 0], NU >> 1, 0), 'wPaint', { c: IRON });
      // the top edge folded back onto the bulwark, so the plate reads as thick from above
      const lip = Array.from({ length: NU + 1 }, (_, i) => [skin(i / NU, 1, side), skin(i / NU, 1, side, -0.04)]);
      ib.add(grid(lip, [0, 1, 0], NU >> 1, 0), 'wPaint', { c: '#868e90' });
      // lapped seams: two along the bow, and butt seams every 1.6 m aft to fore
      for (const f of [0.34, 0.68]) ib.add(tube(Array.from({ length: 25 }, (_, i) => V3(...skin(i / 24 * 0.985, f, side, OFF + 0.015))), 0.03, 4, 48, { capEnd: false }), 'wIron', { c: '#5a6266' });
      for (let z = Z0 + 0.15; z < 15.2; z += 1.6) {
        const t = (uAt(z, 0) - u0) / (1 - u0);
        if (t <= 0 || t >= 0.97) continue;
        ib.add(tube(YS.map((f) => V3(...skin(t, f, side, OFF + 0.015))), 0.028, 4, 10, { capEnd: false }), 'wIron', { c: '#5a6266' });
        // rivet heads down each butt seam
        for (let f = 0.06; f < 0.97; f += 0.11) { const [x, y, zz] = skin(t, f, side, OFF + 0.02); ib.add(cyl(0.04, 0.045, 0.04, 5, 1, true), 'wIron', { p: [x, y, zz], q: qTo(Y, V3(side, 0, 0).normalize()), c: '#6a7276' }); }
      }
    }
    // the forefoot: a flat iron bar down the stem from the bulwark to below the waterline, curving back under the forefoot
    const stem = [];
    for (let i = 0; i <= 8; i++) { const [, yy, z] = shell(1, 1, lerp(DECK + bulH(1) - 0.1, -0.4, i / 8)); stem.push(V3(0, yy, z + 0.12)); }
    { const [, yy, z] = shell(1, 1, KEEL); stem.push(V3(0, yy - 0.05, z + 0.06)); }
    for (const u of [0.97, 0.94, 0.91, 0.88]) { const [, yy, z] = shell(u, 0, KEEL); stem.push(V3(0, yy - 0.1, z)); }
    ib.add(tube(stem, 0.13, 6, 40, { capEnd: true, capStart: true }), 'wIron', { c: '#7a8286' });
    for (let i = 1; i < 8; i += 2) ib.add(cyl(0.05, 0.055, 0.06, 6, 1, true), 'wIron', { p: [stem[i].x, stem[i].y, stem[i].z + 0.13], q: qTo(Y, Z), c: '#7a8286' });
    const mesh = ib.build();
    mesh.name = 'iceBow';
    body.add(mesh);
    root.userData.iceBow = mesh;
  }

  // ---------------------------------------------------------------- glows (furnace vents, the gangway lamp)
  const glows = [];
  for (const side of [1, -1]) for (const z of [-3.6, -1.2, 1.2, 3.6]) {
    // one flat glow on each waterline vent's face (round halos between the vents read as pairs of lamps)
    const g = slotGlow(0xff8a30, 1.05, 0.46, 0.42, { ry: side * PI / 2 }); g.position.set(side * (sideX(z, 0.48) + 0.1), 0.5, z); body.add(g); glows.push(g);
  }

  // ---------------------------------------------------------------- the gangway (in ship space, not bobbing; its head follows the bob)
  let gang = null, gangHead = null, gangFoot = null;
  if (opts.gangway) {
    const [fx, fy, fz] = opts.gangway;
    const u = uAt(fz, DECK);
    const [hx, hy] = shell(u, 1, DECK + bulH(u));
    gangHead = V3(hx - 0.1, hy + 0.06, fz);
    gangFoot = V3(fx, fy, fz);
    const len = Math.hypot(fx - gangHead.x, fy - gangHead.y), W2 = 0.6;
    gang = new THREE.Group();
    gang.position.copy(gangHead);
    root.add(gang);
    const gb = new Builder(420);
    // a planked walkway with cleats, two side stringers, stanchions and hand ropes, a brass roller at the foot
    gb.add(box(len, 0.06, W2 * 2 - 0.12), 'wood', { p: [len / 2, 0.02, 0], c: '#b08e66' });
    for (let x = 0.25; x < len - 0.1; x += 0.32) gb.add(box(0.05, 0.04, W2 * 2 - 0.2), 'woodDark', { p: [x, 0.07, 0], c: 0xffffff });
    for (const sz of [-1, 1]) {
      gb.add(rbox(len + 0.08, 0.16, 0.08, 0.02, 1), 'wIron', { p: [len / 2, 0.02, sz * W2], c: '#3e4246' });
      for (let i = 0; i < 4; i++) {
        const x = 0.15 + i * (len - 0.3) / 3;
        gb.add(cyl(0.025, 0.03, 0.95, 6), 'wBrass', { p: [x, 0.5, sz * W2], r: [0, 0, 0] });
      }
      gb.add(box(len - 0.25, 0.04, 0.04), 'wBrass', { p: [len / 2, 0.95, sz * W2] });
      gb.add(box(len - 0.25, 0.025, 0.025), 'wIron', { p: [len / 2, 0.55, sz * W2], c: '#5a5650' });
    }
    gb.add(bdisc(0.09, W2 * 2 + 0.1, 0.02, 12), 'wBrass', { p: [len - 0.02, -0.06, 0], r: [PI / 2, 0, 0] });
    gb.add(rbox(0.4, 0.06, W2 * 2 + 0.1, 0.02, 1), 'wBrass', { p: [0.05, -0.01, 0] });
    const gm = gb.build();
    // the gangway's own axes: +x down the walkway; posts stay vertical-ish by leaning them back with the slope (set below)
    gang.add(gm);
    gang.userData.len = len;
    // a foot plate on the pier and a landing step on deck
    const fb = new Builder(421);
    fb.add(rbox(0.6, 0.04, W2 * 2 + 0.3, 0.02, 1), 'wIron', { p: [fx - 0.1, fy + 0.02, fz], c: '#4a4844' });
    fb.add(rbox(0.8, 0.22, 1.4, 0.03, 1), 'wood', { p: [hx - 0.55, DECK + 0.11, fz], c: '#a88a60' });
    fb.add(rbox(0.82, 0.04, 1.42, 0.01, 1), 'wBrass', { p: [hx - 0.55, DECK + 0.23, fz] });
    body.add(fb.build());
    const lamp = glowSprite(0xffc870, 1.0, 0.5); lamp.position.set(hx - 0.2, DECK + 1.72, fz - 0.95); body.add(lamp); glows.push(lamp);
    const lb = new Builder(422);
    lb.add(cyl(0.04, 0.05, 1.3, 6), 'wIron', { p: [hx - 0.2, DECK + bulH(u) + 0.3, fz - 0.8], c: '#3a3a3c' });
    lb.add(rbox(0.22, 0.28, 0.22, 0.04, 1), 'wBrass', { p: [hx - 0.2, DECK + 1.6, fz - 0.8] });
    lb.add(box(0.15, 0.2, 0.15), 'wGlowAmber', { p: [hx - 0.2, DECK + 1.6, fz - 0.8] });
    body.add(lb.build());
  }

  // ---------------------------------------------------------------- mooring: iron bollards on the pier and ropes from the chocks
  if (opts.bollards?.length) {
    const mb = new Builder(430);
    for (const [x, y, z] of opts.bollards) {
      mb.add(rbox(0.9, 0.06, 0.5, 0.02, 1), 'wIron', { p: [x, y + 0.03, z], c: '#3a3836' });
      mb.add(cyl(0.13, 0.15, 0.48, 10), 'wIron', { p: [x, y + 0.27, z], c: '#2a2826' });
      mb.add(cyl(0.19, 0.19, 0.07, 12), 'wIron', { p: [x, y + 0.53, z], c: '#3a3836' });
    }
    for (const [cz, bi] of opts.ropes || []) {
      const a = V3(...chock(cz)), [bx, by, bz] = opts.bollards[bi], e = V3(bx, by + 0.44, bz);
      const d = a.distanceTo(e), sag = 0.05 + d * 0.012, pts = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12, p = a.clone().lerp(e, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
      mb.add(tube(pts, 0.05, 6, 24, { capEnd: false }), 'cloth', { c: '#c8b088' });
      // a few turns round the bollard
      mb.add(cyl(0.17, 0.17, 0.1, 10), 'cloth', { p: [bx, by + 0.42, bz], c: '#7a6444' });
    }
    root.add(mb.build());
  }

  // ---------------------------------------------------------------- smoke (ship space, rises from the funnel caps)
  const MAXP = 90;
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAXP * 3), size = new Float32Array(MAXP), alpha = new Float32Array(MAXP), rot = new Float32Array(MAXP), tint = new Float32Array(MAXP * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  pGeo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  pGeo.setAttribute('rot', new THREE.BufferAttribute(rot, 1));
  pGeo.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  pGeo.boundingSphere = new THREE.Sphere(V3(0, 16, 0), 40);
  const puffs = new THREE.Points(pGeo, smokeMaterial());
  puffs.onBeforeRender = smokeScale;
  puffs.renderOrder = 3;
  root.add(puffs);
  const P = Array.from({ length: MAXP }, () => ({ age: 99, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, vr: 0, s0: 1, s1: 3, op: 0.3, c: 0.5 }));
  const emitT = smokeAt.map((_, i) => i * 0.23);
  const _q = new THREE.Quaternion(), _w = V3();
  const C0 = [0.30, 0.29, 0.28], C1 = [0.62, 0.6, 0.57];
  function emit(at) {
    const p = P.find((q) => q.age >= q.life);
    if (!p) return;
    p.age = 0; p.life = 6 + Math.random() * 2;
    p.x = at.x + (Math.random() - 0.5) * 0.6; p.y = at.y + body.position.y; p.z = at.z + (Math.random() - 0.5) * 0.6;
    p.vx = (Math.random() - 0.5) * 0.25; p.vy = 1.2 + Math.random() * 0.5; p.vz = -0.15 + (Math.random() - 0.5) * 0.25;
    p.r = Math.random() * 6; p.vr = (Math.random() - 0.5) * 0.4;
    p.s0 = 1.0 + Math.random() * 0.4; p.s1 = 4.2 + Math.random() * 1.6; p.op = 0.26 + Math.random() * 0.1; p.c = Math.random();
  }

  let time = 0;
  root.userData.body = body;
  root.userData.gangwayFoot = gangFoot;
  root.userData.update = (dt = 0, t) => {
    dt = Math.min(dt || 0, 0.1);
    time = t ?? time + dt;
    // a gentle swell: slow heave, a little roll and pitch
    body.position.y = 0.05 * Math.sin(time * 0.55) + 0.02 * Math.sin(time * 1.31 + 1.2);
    body.rotation.z = 0.007 * Math.sin(time * 0.42 + 0.4);
    body.rotation.x = 0.0025 * Math.sin(time * 0.37 + 2.1);
    if (gang) {
      // the head rides on the bulwark; the foot stays on the pier
      const hy = gangHead.y + body.position.y + body.rotation.z * gangHead.x;
      gang.position.set(gangHead.x, hy, gangHead.z);
      gang.rotation.z = -Math.atan2(hy - gangFoot.y, gangFoot.x - gangHead.x);
    }
    for (const g of glows) g.userData.update(dt, time);
    // smoke: each funnel puffs gently, the wind carries it (world wind turned into ship space)
    for (let i = 0; i < smokeAt.length; i++) { emitT[i] -= dt; if (emitT[i] <= 0) { emitT[i] += 0.5 + Math.random() * 0.25; emit(smokeAt[i]); } }
    root.getWorldQuaternion(_q).invert();
    const wd = G.windDir.value, ws = G.windStrength.value;
    _w.set(wd.x, 0, wd.y).applyQuaternion(_q);
    const nk = 1 - 0.6 * G.night.value;
    for (let i = 0; i < MAXP; i++) {
      const p = P[i];
      if (p.age < p.life) {
        p.age += dt;
        const k = Math.min(1, p.age / p.life);
        p.x += (p.vx + _w.x * 1.6 * ws * k) * dt; p.z += (p.vz + _w.z * 1.6 * ws * k) * dt;
        p.y += p.vy * (1 - 0.6 * k) * dt; p.r += p.vr * dt;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        size[i] = lerp(p.s0, p.s1, Math.sqrt(k)); rot[i] = p.r;
        alpha[i] = p.op * Math.min(1, k * 6) * (1 - k) * (1 - k * 0.3);
        const c = lerp(0, 1, Math.min(1, k * 1.6)) * 0.7 + p.c * 0.3;
        tint[i * 3] = lerp(C0[0], C1[0], c) * nk; tint[i * 3 + 1] = lerp(C0[1], C1[1], c) * nk; tint[i * 3 + 2] = lerp(C0[2], C1[2], c) * nk;
      } else alpha[i] = 0;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.size.needsUpdate = true; pGeo.attributes.alpha.needsUpdate = true;
    pGeo.attributes.rot.needsUpdate = true; pGeo.attributes.tint.needsUpdate = true;
  };
  root.userData.dispose = () => {
    root.traverse((o) => { if (o.isSprite) o.material.dispose(); else if (o.isMesh || o.isPoints) o.geometry.dispose(); });
  };
  // warm up a few seconds of smoke so the funnels are already smoking when the harbour loads
  for (let i = 0; i < 60; i++) root.userData.update(0.1, i * 0.1);
  let meshes = 0, tris = 0;
  root.traverse((m) => { if (m.isMesh) { meshes++; tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; } });
  root.userData.stats = { meshes, sprites: glows.length, points: 1, tris: Math.round(tris) };
  return root;
}
