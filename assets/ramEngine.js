// The Ram Engine (LF.6, shared/ramEngine.js): the Makers' tracked ram engine that players drive against the Wall-Layer's
// yard on the Harrow Coast, and the yard's pieces (stone walls, the square gatehouse, the gates, the piles by the road).
// The engine: two track units of plain solid disc idlers, road wheels and return rollers under a square timber frame;
// a heavy square iron ram head on a square timber beam that runs on two parallel slide rails between two portals (two
// posts and a flat head beam each); a square boiler house with one square stack on the right of the back, a square
// coal bunker on the left, a square box for the ram weights between them, and two parallel driving levers at the back.
// Front is +z (the ram head). Content rules: nothing face-like (no lamps at all; the firebox shows one plain slot on the
// boiler's outer flank, never a pair), solid discs only (no spokes, no teeth), no X bracing, no rings or emblems, every
// part square from straight above, the timber laid parallel.
import * as THREE from 'three';
import { Builder, box, rbox, lathe } from './kit.js';
import { smoke } from './dynamic.js';

const PI = Math.PI;
const TIMBER = '#f2e2ca', TIMBER2 = '#dcc8aa', IRON = '#c0b8b0', IRON2 = '#a49c94', TRIM = '#d8b878', LINK = '#9a928a';
const disc = (r, w, seg = 24) => { const e = Math.min(r * 0.14, w * 0.3); return lathe([[0.001, -w / 2], [r - e, -w / 2], [r, -w / 2 + e], [r, w / 2 - e], [r - e, w / 2], [0.001, w / 2]], seg); };
const part = (fn, seed = 1) => { const b = new Builder(seed); fn(b); return b.build(); };
const pivot = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

// one track unit at x: frame plate, idler discs at both ends, road wheels, return rollers, and two runs of flat links
function trackUnit(root, x, sx, seed) {
  const L = 5.2, W = 0.6, R = 0.48, wheels = [], runs = [];
  const side = pivot(root, x, 0, 0);
  side.add(part((b) => {
    b.add(rbox(0.16, 0.5, L - 1.0, 0.03), 'wRust', { p: [-sx * 0.12, 0.5, 0], c: IRON2 });
    // the skirt over the top run's outer face: a plain plate with a lip along its top
    b.add(rbox(0.06, 0.34, L - 0.6, 0.02), 'wRust', { p: [sx * (W / 2 + 0.04), 0.8, 0], c: IRON });
    b.add(box(0.1, 0.05, L - 0.6), 'wRust', { p: [sx * (W / 2 + 0.05), 0.99, 0], c: TRIM });
  }, seed));
  const wheel = (y, z, r, w, c) => { const p = pivot(side, 0, y, z); p.add(part((b) => { b.add(disc(r, w), 'wRust', { r: [0, 0, PI / 2], c }); b.add(box(w + 0.02, r * 0.34, r * 0.3), 'wRust', { p: [0, r * 0.38, r * 0.2], c: TRIM }); }, seed + 7)); p.userData.r = r; wheels.push(p); };
  for (const ez of [-1, 1]) wheel(R, ez * (L / 2 - R), R, W * 0.86, '#a09888');
  for (let i = 0; i < 4; i++) wheel(0.32, -1.35 + i * 0.9, 0.3, W * 0.7, '#968e80');
  for (const z of [-0.9, 0.9]) wheel(0.92, z, 0.12, W * 0.5, '#a09888');
  const pitch = 0.22, n = Math.floor((L - 2 * R) / pitch);
  for (const [y, dir] of [[0.04, 1], [0.97, -1]]) {
    const run = pivot(side, 0, y, 0);
    run.add(part((b) => { for (let i = 0; i <= n; i++) { const z = -L / 2 + R + i * pitch; b.add(box(W, 0.07, pitch * 0.84), 'wRust', { p: [0, 0, z], c: i % 2 ? LINK : '#7a746c' }); } }, seed + 2));
    runs.push({ run, dir, span: pitch });
  }
  // the links round each idler: a short band of links laid on the disc's face (plain, no teeth)
  side.add(part((b) => { for (const ez of [-1, 1]) for (let k = 1; k < 6; k++) { const a = (k / 6) * PI, z = ez * (L / 2 - R) + ez * Math.sin(a) * (R + 0.03), y = R - Math.cos(a) * (R + 0.03); b.add(box(W, 0.07, 0.2), 'wRust', { p: [0, y, z], r: [ez * a, 0, 0], c: LINK }); } }, seed + 3));
  return { wheels, runs };
}

export function buildRamEngine() {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const tracks = [trackUnit(body, -1.15, -1, 4401), trackUnit(body, 1.15, 1, 4411)];
  const FY = 1.08; // the frame's underside
  body.add(part((b) => {
    // the square timber frame: two long beams, three cross beams (all parallel), a deck of planks along it
    for (const sx of [-1, 1]) b.add(rbox(0.32, 0.32, 5.6, 0.03), 'wood', { p: [sx * 0.85, FY + 0.16, 0], c: TIMBER2 });
    // (the cross beams run between the long beams' inner faces, never past them: from above the frame is a ladder of T's)
    for (const z of [-2.5, -0.2, 2.5]) b.add(rbox(1.38, 0.26, 0.3, 0.03), 'wood', { p: [0, FY + 0.13, z], c: TIMBER });
    for (let i = 0; i < 7; i++) b.add(box(0.22, 0.06, 5.0), 'wood', { p: [-0.69 + i * 0.23, FY + 0.35, 0], c: i % 2 ? TIMBER : '#e6d4b8' });
    // iron corner plates on the frame (flat, square)
    for (const sx of [-1, 1]) for (const z of [-2.65, 2.65]) b.add(box(0.36, 0.36, 0.06), 'wRust', { p: [sx * 0.85, FY + 0.16, z], c: IRON });
    // the slide rails for the ram beam (two parallel iron bars) on low timber sleepers
    for (const sx of [-1, 1]) b.add(box(0.12, 0.12, 4.8), 'wSteel', { p: [sx * 0.34, FY + 0.5, 0.2], c: 0xffffff });
    for (const z of [-1.6, 0.2, 2.0]) b.add(box(1.0, 0.1, 0.24), 'wood', { p: [0, FY + 0.42, z], c: TIMBER2 });
    // two portals over the ram: two square posts and a flat head beam each, nothing crossed
    for (const z of [2.3, -1.0]) {
      for (const sx of [-1, 1]) b.add(rbox(0.22, 1.5, 0.22, 0.03), 'wood', { p: [sx * 0.62, FY + 1.1, z], c: TIMBER2 });
      b.add(rbox(1.5, 0.22, 0.3, 0.03), 'wood', { p: [0, FY + 1.93, z], c: TIMBER });
      b.add(box(1.54, 0.05, 0.34), 'wRust', { p: [0, FY + 2.06, z], c: IRON });
    }
    // a flat plank roof from portal to portal over the ram: from above one plain rectangle, no beam crossing the ram
    b.add(box(1.62, 0.08, 3.64), 'wood', { p: [0, FY + 2.12, 0.65], c: TIMBER2 });
    for (const sx of [-1, 1]) b.add(box(0.08, 0.16, 3.64), 'wood', { p: [sx * 0.81, FY + 2.08, 0.65], c: TIMBER });
    // the boiler house (right of the back): square, a flat roof, one plain firebox slot on its outer flank, one square stack
    b.add(rbox(1.05, 1.3, 1.5, 0.05), 'wRust', { p: [0.92, FY + 1.0, -1.85], c: 0xffffff });
    b.add(box(1.15, 0.08, 1.6), 'wRust', { p: [0.92, FY + 1.69, -1.85], c: IRON });
    for (const y of [0.55, 1.2]) b.add(box(1.09, 0.05, 1.54), 'wBrass', { p: [0.92, FY + y, -1.85], c: 0xffffff });
    b.add(box(0.36, 2.2, 0.36), 'wRust', { p: [0.92, FY + 2.75, -2.15], c: '#6a625a' });
    b.add(box(0.44, 0.1, 0.44), 'wBrass', { p: [0.92, FY + 3.85, -2.15], c: 0xffffff });
    b.add(box(0.03, 0.22, 0.6), 'wGlowOrange', { p: [1.46, FY + 0.6, -1.85] });
    // the coal bunker (left of the back): an open square bin of planks with coal heaped in it
    for (const sx of [-1, 1]) b.add(box(0.06, 0.6, 1.4), 'wood', { p: [-0.92 + sx * 0.48, FY + 0.65, -1.85], c: TIMBER });
    for (const z of [-1, 1]) b.add(box(1.0, 0.6, 0.06), 'wood', { p: [-0.92, FY + 0.65, -1.85 + z * 0.7], c: TIMBER2 });
    b.add(rbox(0.86, 0.3, 1.26, 0.1), 'rock', { p: [-0.92, FY + 0.72, -1.85], c: '#3a3836' });
    for (const [x, z, r] of [[-1.1, -2.2, 0.4], [-0.75, -1.9, 1.1], [-1.05, -1.5, 2.0], [-0.8, -1.3, 0.7]]) b.add(rbox(0.26, 0.14, 0.22, 0.05), 'rock', { p: [x, FY + 0.9, z], r: [0, r, 0], c: '#2e2c2a' });
    // the box for the ram weights between them (open at the top; the weights in it are shown by count)
    for (const sx of [-1, 1]) b.add(box(0.05, 0.42, 0.8), 'wRust', { p: [sx * 0.34, FY + 0.6, -2.0], c: IRON });
    for (const z of [-1, 1]) b.add(box(0.72, 0.42, 0.05), 'wRust', { p: [0, FY + 0.6, -2.0 + z * 0.38], c: IRON });
    // the two driving levers at the back: parallel iron bars rising from the rear cross beam, square grips
    for (const sx of [-1, 1]) {
      b.add(box(0.07, 1.0, 0.07), 'wRust', { p: [sx * 0.26, FY + 0.1, -2.95], r: [-0.25, 0, 0], c: IRON });
      b.add(box(0.12, 0.2, 0.12), 'wLeather', { p: [sx * 0.26, FY + 0.6, -3.08], r: [-0.25, 0, 0], c: 0xffffff });
    }
    // a tow plate at the front under the ram and the back
    for (const z of [-2.95, 2.95]) b.add(rbox(2.0, 0.3, 0.14, 0.04), 'wRust', { p: [0, FY - 0.06, z], c: IRON2 });
  }, 4420));
  // the ram: a square timber beam on the slides and the heavy square iron head (a plain face plate, nothing on it)
  const ram = pivot(body, 0, FY + 0.82, 0.4);
  ram.add(part((b) => {
    b.add(rbox(0.5, 0.5, 4.2, 0.04), 'wood', { p: [0, 0, 0], c: '#f4e6d0' });
    b.add(box(0.54, 0.54, 0.08), 'wRust', { p: [0, 0, -2.12], c: IRON });
    b.add(rbox(1.1, 1.0, 0.8, 0.06), 'wRust', { p: [0, 0.05, 2.4], c: '#8e887e' });
    b.add(box(0.96, 0.86, 0.06), 'wSteel', { p: [0, 0.05, 2.82], c: 0xffffff });
    b.add(box(1.14, 0.08, 0.84), 'wBrass', { p: [0, 0.57, 2.4], c: 0xffffff });
  }, 4430));
  // the weights in their box (shown by count)
  const weights = [];
  for (let i = 0; i < 3; i++) { const w = part((b) => { b.add(rbox(0.5, 0.17, 0.5, 0.03), 'wRust', { c: '#7a7670' }); b.add(box(0.2, 0.05, 0.08), 'wBrass', { p: [0, 0.1, 0], c: 0xffffff }); }, 4440 + i); w.position.set(0, FY + 0.5 + i * 0.18, -2.0); body.add(w); weights.push(w); }
  const sm = smoke({ rate: 3, life: 3, size: 0.8, rise: 1.8, color: 0x8a8580, opacity: 0.5, spread: 0.3 });
  sm.position.set(0.92, FY + 4.0, -2.15); body.add(sm);
  root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

  let dist = 0, stroke = -1, wN = -1;
  const S = { v: 0, w: 1, stall: false };
  root.userData.height = 4.2;
  root.userData.ram = {
    set(st) { S.v = st.v || 0; S.stall = !!st.stall; if (st.w !== wN) { wN = st.w; weights.forEach((w, i) => { w.visible = i < st.w; }); } },
    strike() { stroke = 0; },
    // the ram head's front face in the engine's own space at this moment (for the dust of a blow)
    headZ() { return ram.position.z + 2.85; },
    update(dt) {
      dist += S.v * dt;
      for (const T of tracks) {
        for (const w of T.wheels) w.rotation.x = dist / w.userData.r;
        for (const R of T.runs) { const m = ((dist % R.span) + R.span) % R.span; R.run.position.z = R.dir > 0 ? -m : m - R.span; }
      }
      // the stroke: out fast (0.15 s), back slowly on the slides (0.9 s)
      if (stroke >= 0) {
        stroke += dt;
        const k = stroke < 0.15 ? stroke / 0.15 : Math.max(0, 1 - (stroke - 0.15) / 0.9);
        ram.position.z = 0.4 + 1.2 * k;
        if (stroke > 1.05) { stroke = -1; ram.position.z = 0.4; }
      }
      // a little shake while it runs; smoke thick when it works, none when it is stalled
      body.position.y = Math.abs(S.v) > 0.05 ? Math.sin(dist * 9) * 0.012 : 0;
      sm.userData.rate = S.stall ? 0 : Math.abs(S.v) > 0.05 ? 7 : 2.5;
      sm.userData.update(dt);
    },
  };
  return root;
}

// a gate's two leaves (front faces -z, the road side): upright planks side by side, three flat iron straps on each leaf
// (parallel), nothing diagonal. The straps run from the hinge and stop well short of the meeting edge, so the seam between
// the leaves never runs through a strap (shut, or lying flat from above, that read as a cross). Each leaf is a group hinged at its outer edge (x = -w/2 and +w/2)
export function buildGateLeaves(w = 6, h = 3.8, seed = 4450) {
  const g = new THREE.Group(), leaves = [];
  for (const sx of [-1, 1]) {
    const hinge = pivot(g, sx * w / 2, 0, 0);
    hinge.add(part((b) => {
      const lw = w / 2 - 0.04, n = 6;
      for (let i = 0; i < n; i++) b.add(box(lw / n - 0.02, h, 0.18), 'wood', { p: [-sx * (lw / n) * (i + 0.5), h / 2, 0], c: i % 2 ? '#e4d0b4' : '#f2e2ca' });
      const sl = lw - 0.75, sxc = -sx * (0.05 + sl / 2);
      for (const y of [0.7, h - 0.7]) b.add(box(sl, 0.18, 0.06), 'wRust', { p: [sxc, y, -0.12], c: IRON2 });
      b.add(box(sl, 0.12, 0.06), 'wRust', { p: [sxc, h / 2, -0.12], c: IRON2 });
    }, seed + sx));
    leaves.push(hinge);
  }
  return { group: g, leaves };
}

// a stack of square iron ram weights on a timber pallet
export function buildWeightPile(seed = 4460) {
  const b = new Builder(seed);
  b.add(box(1.8, 0.14, 1.4), 'wood', { p: [0, 0.07, 0], c: TIMBER2 });
  for (let l = 0; l < 2; l++) for (let i = 0; i < 6; i++) b.add(rbox(0.5, 0.17, 0.5, 0.03), 'wRust', { p: [-0.56 + (i % 3) * 0.56, 0.23 + l * 0.18, i < 3 ? -0.3 : 0.3], c: l % 2 ? '#7a7670' : '#6e6a64' });
  b.add(box(0.1, 1.2, 0.1), 'wood', { p: [0.95, 0.6, -0.65], c: TIMBER });
  return b;
}
// sacks of steam coal laid in two parallel rows in a square plank bin, a few lumps spilled
export function buildCoalPile(seed = 4470) {
  const b = new Builder(seed);
  for (const sx of [-1, 1]) b.add(box(0.08, 0.5, 1.6), 'wood', { p: [sx * 0.95, 0.25, 0], c: TIMBER });
  b.add(box(1.98, 0.5, 0.08), 'wood', { p: [0, 0.25, -0.8], c: TIMBER2 });
  for (let i = 0; i < 6; i++) b.add(rbox(0.55, 0.36, 0.7, 0.14), 'wCloth', { p: [-0.6 + (i % 3) * 0.6, 0.2 + Math.floor(i / 3) * 0.3, -0.35 + Math.floor(i / 3) * 0.5], c: i % 2 ? '#c8b89a' : '#d4c4a4' });
  for (const [x, z, r] of [[-0.6, 0.98, 0.3], [-0.1, 1.1, 1.2], [0.45, 0.95, 2.1]]) b.add(rbox(0.22, 0.12, 0.18, 0.04), 'rock', { p: [x, 0.06, z], r: [0, r, 0], c: '#2e2c2a' });
  return b;
}
// what a hero carries from the piles: a square iron weight, or a sack of coal (front of the chest, both hands)
export function buildCarried(kind) {
  return part((b) => {
    if (kind === 'weight') b.add(rbox(0.46, 0.17, 0.46, 0.03), 'wRust', { c: '#7a7670' });
    else b.add(rbox(0.5, 0.34, 0.62, 0.14), 'wCloth', { c: '#d4c4a4' });
  }, 4480);
}
