// The Deepway Crawler: a low bronze half-track from the Deepway, the second mount (Explorers' Guild deed, Revered).
// Long bronze hull with chevron-ribbed side plating, an open driver's cradle at the back, a pair of rear tracks (each a loop
// of 28 link plates that slide round the loop by distance travelled, over four sprung road wheels with plain solid discs), one
// steerable front roller drum, a sealed horizontal boiler under a slatted hood with a teal gauge strip and glowing slot vents,
// and twin exhausts run low along the hull flanks to one wide flat exhaust box across the tail. No spokes, no radiating patterns, no legs.
// Same interface as the runabout so entities.js rides it the same way:
//   userData.update(dt, speed, turnRate, lodDist)   userData.state { steer, run, accel }   userData.seat / body / dispose
// Front is +z, the rider's hips sit at userData.seat (in body space); userData.body is the sprung hull group.
import * as THREE from 'three';
import { Builder, box, rbox, cyl, torus, lathe, tube, V3 } from './kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { slotGlow } from './slotGlow.js';
import { puffTex } from '../engine/textures.js';
import { G } from '../engine/globals.js';
import { PAINTS } from '/sunmere-play/shared/data.js';

const PI = Math.PI;
const part = (fn, seed = 7) => { const b = new Builder(seed); fn(b); return b.build(); };
const pivot = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
// fold every mesh under a group of built parts into one mesh per material (one draw call per material)
function mergeGroup(group, shadowMats) {
  group.updateMatrixWorld(true);
  const byMat = new Map();
  group.traverse((m) => { if (!m.isMesh) return; if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push(m.geometry.clone().applyMatrix4(m.matrixWorld)); m.geometry.dispose(); });
  const out = new THREE.Group();
  for (const [mat, list] of byMat) {
    const mesh = new THREE.Mesh(list.length > 1 ? mergeGeometries(list, false) : list[0], mat);
    if (list.length > 1) for (const g of list) g.dispose();
    mesh.castShadow = !mat.transparent && shadowMats.has(mat.name);
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}
const METAL = { brass: 'wBrass', copper: 'wCopper', iron: 'wDark', bronze: 'wBronze', gold: 'wGold' };
const METAL_TINT = { iron: '#5a5a62' };
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };

// ---- smoke and steam: the runabout's soft-puff Points cloud (same shader; one material shared by every crawler)
const SMOKE_LIGHT = new THREE.Color(0x9a948c), SMOKE_DARK = new THREE.Color(0x3a3634), SMOKE_TMP = new THREE.Color();
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

// ---- layout (metres)
const HULL = { x: 0.6, z0: -1.4, z1: 1.4 };
const LOW = { y0: 0.5, y1: 0.78, z0: -0.2, z1: 1.25 };          // the hull's front box under the hood
const WELL = { z0: -1.36, z1: -0.17, x: 0.56, floor: 0.44, rail: 1.06 };
const SEAT = [0, 1.01, -0.95];
const TRACK = { x: 0.48, w: 0.24, yc: 0.2, r: 0.16, zr: -1.18, zf: -0.06, n: 28, lk: 0.096, th: 0.035 };
const ROAD = { r: 0.1, zs: [-0.96, -0.733, -0.507, -0.28] };
const DRUM = { z: 0.98, r: 0.22, w: 0.78 };
const BOIL = { r: 0.19, y: 0.8, z0: -0.12, z1: 1.18 };     // top at 0.99: sealed under the hood slats (1.02)
const HOOD = { y: 1.02, x: 0.4, z0: -0.16, z1: 1.2 };

// a point on a track loop (centreline, in the y-z plane) at arc length s, with the angle that turns a link's +y outward
const TL = TRACK.zf - TRACK.zr, TP = 2 * TL + 2 * PI * TRACK.r;
function loopAt(s, out) {
  const { yc, r, zr, zf } = TRACK;
  s = ((s % TP) + TP) % TP;
  if (s < TL) { out.z = zf - s; out.y = yc - r; out.a = PI; return out; }                          // bottom run, toward the back
  s -= TL;
  const arc = PI * r;
  if (s < arc) { const t = s / r; out.z = zr - r * Math.sin(t); out.y = yc - r * Math.cos(t); out.a = Math.atan2(-Math.sin(t), -Math.cos(t)); return out; } // round the sprocket
  s -= arc;
  if (s < TL) { out.z = zr + s; out.y = yc + r; out.a = 0; return out; }                           // top run, forward
  s -= TL;
  const t = s / r; out.z = zf + r * Math.sin(t); out.y = yc + r * Math.cos(t); out.a = Math.atan2(Math.sin(t), Math.cos(t)); return out; // round the idler
}

// a solid road wheel / sprocket disc (axle along x): plain dark face, bronze rim, square nut and bolts, one offset bolt plate
function discB(b, r, w, x, y, z, metalMat, metalC, plate = true) {
  const R = [0, 0, PI / 2], RT = [0, PI / 2, 0];
  b.add(cyl(r, r, w, 22), 'wDark', { r: R, p: [x, y, z], c: '#34302c' });
  for (const sx of [-1, 1]) {
    b.add(torus(r - 0.012, 0.012, 5, 22), 'wBronze', { r: RT, p: [x + sx * (w / 2), y, z] });
    // a square axle nut and six square bolt heads straight on the plain face (no darker inner dish, no round boss)
    b.add(rbox(0.03, r * 0.42, r * 0.42, 0.008), metalMat, { p: [x + sx * (w / 2 + 0.006), y, z], c: metalC });
    for (let k = 0; k < 6; k++) { const a = k * PI / 3 + 0.3; b.add(box(0.016, r * 0.13, r * 0.13), metalMat, { p: [x + sx * (w / 2 + 0.002), y + Math.cos(a) * r * 0.5, z + Math.sin(a) * r * 0.5], r: [a, 0, 0], c: metalC }); }
  }
  if (plate) for (const sx of [-1, 1]) b.add(rbox(0.014, r * 0.34, r * 0.22, 0.006), 'wBronze', { p: [x + sx * (w / 2 + 0.006), y + r * 0.62, z] });
}

export function buildCrawler(paintId = 'brass') {
  const P = PAINTS[paintId] || PAINTS.brass;
  const painted = P.paint !== false;
  const plateMat = painted ? 'wPaint' : 'wBronze';               // side plating and hood cheeks take the paint
  const plateC = painted ? P.body : 0xffffff;
  const trim = P.trim || '#d9a650';
  const ribMat = painted ? 'wPaint' : 'wVerdigris';              // chevron ribs: verdigris on bare bronze, trim on paint
  const ribC = painted ? trim : 0xffffff;
  const metalKey = P.metal || 'brass';
  const metalMat = painted ? METAL[metalKey] || 'wBronze' : 'wBronze'; // hood slats and fittings
  const metalC = METAL_TINT[metalKey] || 0xffffff;
  const seatC = P.seat || '#5a3a24';
  const [, hipY, seatZ] = SEAT;

  const root = new THREE.Group();
  root.name = 'crawler';
  const body = pivot(root, 0, 0, 0);
  const mats = [];
  const stat = new THREE.Group();

  // ---------------------------------------------------------------- the hull (sprung)
  stat.add(part((b) => {
    // belly between the tracks: the chassis box that carries the firebox and the cradle floor
    b.add(rbox(0.62, 0.26, 1.95, 0.04), 'wDark', { p: [0, 0.38, -0.36], c: '#3a3634' });
    // track fenders: long thin plates over each track, full hull width
    for (const sx of [-1, 1]) {
      b.add(rbox(0.3, 0.04, 1.62, 0.015), 'wBronze', { p: [sx * 0.46, 0.43, -0.6] });
      b.add(rbox(0.02, 0.06, 1.6, 0.008), ribMat, { p: [sx * 0.61, 0.415, -0.6], c: ribC });
    }
    // the front box under the hood
    const lh = LOW.y1 - LOW.y0, lzc = (LOW.z0 + LOW.z1) / 2, ll = LOW.z1 - LOW.z0;
    b.add(rbox(HULL.x * 2, lh, ll, 0.04), 'wBronze', { p: [0, (LOW.y0 + LOW.y1) / 2, lzc] });
    // glacis: a sloped nose plate down to a buffer bar
    const gz0 = LOW.z1 - 0.02, gy0 = LOW.y1 - 0.01, gz1 = HULL.z1, gy1 = 0.56, gl = Math.hypot(gz1 - gz0, gy0 - gy1), ga = Math.atan2(gz1 - gz0, gy0 - gy1);
    b.add(rbox(HULL.x * 2 - 0.04, gl, 0.05, 0.02), 'wBronze', { p: [0, (gy0 + gy1) / 2, (gz0 + gz1) / 2], r: [ga, 0, 0] });
    b.add(rbox(HULL.x * 2 - 0.1, 0.08, 0.1, 0.03), 'wDark', { p: [0, 0.54, HULL.z1 - 0.02], c: '#3a3634' });
    b.add(box(HULL.x * 2 - 0.2, 0.014, 0.012), 'wPaint', { p: [0, 0.565, HULL.z1 + 0.032], c: trim });
    // hull flank plating in the paint colour, a trim line along its top
    for (const sx of [-1, 1]) {
      b.add(rbox(0.02, lh - 0.06, ll - 0.1, 0.008), plateMat, { p: [sx * (HULL.x + 0.005), (LOW.y0 + LOW.y1) / 2, lzc], c: plateC });
      b.add(box(0.008, 0.014, ll - 0.08), 'wPaint', { p: [sx * (HULL.x + 0.016), LOW.y1 - 0.035, lzc], c: trim });
    }

    // ---- the driver's cradle at the back: floor plate, side walls, a low rear wall and a bright coaming
    const wl = WELL.z1 - WELL.z0, wzc = (WELL.z0 + WELL.z1) / 2, wh = WELL.rail - WELL.floor, wyc = (WELL.rail + WELL.floor) / 2;
    b.add(rbox(WELL.x * 2, 0.05, wl, 0.015), 'wDark', { p: [0, WELL.floor, wzc], c: '#3e3a36' });
    for (let i = 0; i < 5; i++) b.add(box(WELL.x * 2 - 0.1, 0.008, 0.022), 'wBronze', { p: [0, WELL.floor + 0.028, WELL.z1 - 0.16 - i * 0.12] }); // tread strips (cross bars, parallel)
    for (const sx of [-1, 1]) {
      b.add(rbox(0.06, wh, wl, 0.02), 'wBronze', { p: [sx * WELL.x, wyc, wzc] });
      b.add(rbox(0.02, wh - 0.08, wl - 0.1, 0.008), plateMat, { p: [sx * (WELL.x + 0.035), wyc, wzc], c: plateC });
      b.add(rbox(0.1, 0.035, wl + 0.04, 0.012), 'wBronze', { p: [sx * WELL.x, WELL.rail + 0.01, wzc] });
      b.add(box(0.006, 0.012, wl - 0.1), 'wPaint', { p: [sx * (WELL.x + 0.048), WELL.rail - 0.05, wzc], c: trim });
    }
    const rh = 0.42;
    b.add(rbox(WELL.x * 2 + 0.06, rh, 0.06, 0.02), 'wBronze', { p: [0, WELL.floor + rh / 2, WELL.z0 - 0.02] });
    b.add(rbox(WELL.x * 2 - 0.08, rh - 0.08, 0.02, 0.008), plateMat, { p: [0, WELL.floor + rh / 2, WELL.z0 - 0.055], c: plateC });
    b.add(rbox(WELL.x * 2 + 0.1, 0.035, 0.1, 0.012), 'wBronze', { p: [0, WELL.floor + rh, WELL.z0 - 0.02] });
    // rear: a stowage locker and a tow hook below the rear wall, a trim lamp-plate
    b.add(rbox(0.6, 0.16, 0.14, 0.02), 'wDark', { p: [0, 0.38, HULL.z0 + 0.08], c: '#3a3634' });
    b.add(rbox(0.62, 0.02, 0.16, 0.006), 'wBronze', { p: [0, 0.465, HULL.z0 + 0.08] });
    b.add(rbox(0.1, 0.06, 0.12, 0.02), 'wIron', { p: [0, 0.28, HULL.z0 + 0.02], c: '#4a4642' });
    b.add(torus(0.04, 0.014, 6, 14), 'wIron', { p: [0, 0.24, HULL.z0 - 0.04], r: [0, PI / 2, 0], c: '#4a4642' });
    b.add(rbox(0.96, 0.04, 0.02, 0.01), 'glowYellow', { p: [0, WELL.floor + 0.3, WELL.z0 - 0.07], c: '#ff7a50' }); // one full-width tail-lamp strip (a pair read as eyes)

    // ---- the seat: box, cushion and a low back
    b.add(rbox(0.6, hipY - 0.12 - WELL.floor, 0.36, 0.03), 'wBronze', { p: [0, (hipY - 0.12 + WELL.floor) / 2, seatZ - 0.04] });
    b.add(rbox(0.6, 0.11, 0.44, 0.05), 'wLeather', { p: [0, hipY - 0.1, seatZ - 0.02], c: seatC });
    b.add(rbox(0.6, 0.34, 0.1, 0.05), 'wLeather', { p: [0, hipY + 0.11, seatZ - 0.28], r: [-0.14, 0, 0], c: seatC });
    b.add(rbox(0.64, 0.04, 0.12, 0.012), 'wBronze', { p: [0, hipY + 0.29, seatZ - 0.31], r: [-0.14, 0, 0] });

    // ---- chevron ribs along both flanks, pointing forward (">" from the side; nothing crosses)
    const chev = (sx, z, yc, h, xo) => {
      const d = 0.07, hl = Math.hypot(d, h / 2);
      b.add(rbox(0.024, hl, 0.03, 0.008), ribMat, { p: [sx * xo, yc + h / 4, z + d / 2], r: [Math.atan2(-d, h / 2), 0, 0], c: ribC });
      b.add(rbox(0.024, hl, 0.03, 0.008), ribMat, { p: [sx * xo, yc - h / 4, z + d / 2], r: [Math.atan2(d, h / 2), 0, 0], c: ribC });
    };
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 6; i++) chev(sx, LOW.z0 + 0.16 + i * 0.2, (LOW.y0 + LOW.y1) / 2 - 0.01, 0.18, HULL.x + 0.02);
      for (let i = 0; i < 5; i++) chev(sx, WELL.z0 + 0.12 + i * 0.21, WELL.floor + 0.3, 0.3, WELL.x + 0.05);
    }

    // ---- the sealed boiler under the hood (seen between the slats), its saddles and backhead
    const bl = BOIL.z1 - BOIL.z0, bzc = (BOIL.z0 + BOIL.z1) / 2;
    b.add(cyl(BOIL.r, BOIL.r, bl, 22), 'wDark', { r: [PI / 2, 0, 0], p: [0, BOIL.y, bzc], c: '#4a3a2a' });
    for (const z of [BOIL.z0 + 0.05, BOIL.z1 - 0.05]) b.add(torus(BOIL.r + 0.006, 0.012, 5, 22), 'wBronze', { p: [0, BOIL.y, z] }); // end bands only (under the hood's end bars)
    for (const z of [BOIL.z0 + 0.18, BOIL.z1 - 0.18]) b.add(rbox(0.5, 0.12, 0.08, 0.02), 'wDark', { p: [0, LOW.y1 + 0.02, z], c: '#3a3634' });
    // hood: two side cheeks in paint, flat-topped slats running fore and aft (parallel from above), chamfered shoulders
    const hl = HOOD.z1 - HOOD.z0, hzc = (HOOD.z0 + HOOD.z1) / 2, cheekH = HOOD.y - LOW.y1 - 0.06;
    for (const sx of [-1, 1]) {
      b.add(rbox(0.03, cheekH, hl, 0.01), plateMat, { p: [sx * HOOD.x, LOW.y1 + cheekH / 2, hzc], c: plateC });
      b.add(box(0.006, 0.012, hl - 0.06), 'wPaint', { p: [sx * (HOOD.x + 0.017), LOW.y1 + cheekH - 0.03, hzc], c: trim });
      b.add(rbox(0.1, 0.022, hl, 0.008), metalMat, { p: [sx * (HOOD.x - 0.04), HOOD.y - 0.035, hzc], r: [0, 0, sx * 0.62], c: metalC });
    }
    for (let i = 0; i < 6; i++) b.add(rbox(0.07, 0.02, hl - 0.02, 0.008), metalMat, { p: [-0.275 + i * 0.11, HOOD.y, hzc], c: metalC });
    for (const z of [HOOD.z0 + 0.02, HOOD.z1 - 0.02]) b.add(rbox(HOOD.x * 2 + 0.02, 0.05, 0.04, 0.012), 'wBronze', { p: [0, HOOD.y - 0.02, z] });
    // hood front: a flat plate with horizontal louvres closes the boiler in (sealed, nothing round shows at the nose)
    b.add(rbox(HOOD.x * 2, HOOD.y - LOW.y1, 0.04, 0.012), 'wDark', { p: [0, (HOOD.y + LOW.y1) / 2, HOOD.z1 + 0.01], c: '#34302c' });
    for (let i = 0; i < 4; i++) b.add(rbox(HOOD.x * 2 - 0.12, 0.022, 0.03, 0.008), metalMat, { p: [0, LOW.y1 + 0.05 + i * 0.045, HOOD.z1 + 0.035], r: [-0.4, 0, 0], c: metalC });
    // backhead plate facing the rider (the teal strip lives on it, see below)
    b.add(rbox(HOOD.x * 2, HOOD.y - LOW.y1, 0.04, 0.012), 'wDark', { p: [0, (HOOD.y + LOW.y1) / 2, HOOD.z0 - 0.02], c: '#34302c' });
    b.add(rbox(0.52, 0.07, 0.04, 0.012), 'wBronze', { p: [0, 0.94, HOOD.z0 - 0.04] });
    b.add(rbox(0.16, 0.05, 0.03, 0.01), 'wIron', { p: [0, 0.82, HOOD.z0 - 0.05], c: '#4a4642' }); // the sealed firing hatch, shut

    // ---- slot vents along the flanks (glow set below) in dark frames
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.add(rbox(0.016, 0.06, 0.24, 0.01), 'wDark', { p: [sx * (HULL.x + 0.02), 0.6, 0.42 + i * 0.27], c: '#1e1a18' });
    // one full-width nose lamp bar in a bronze housing (a pair of lamps either side of the grille read as eyes over a mouth)
    b.add(rbox(1.0, 0.12, 0.12, 0.02), 'wBronze', { p: [0, 0.84, LOW.z1 - 0.02] });
    b.add(rbox(0.94, 0.06, 0.02, 0.01), 'glowYellow', { p: [0, 0.84, LOW.z1 + 0.04] });
  }));

  // ---------------------------------------------------------------- twin exhausts, low along the flanks to one flat rear box
  // (they used to curve up over the hood and rise to two stacks either side behind the rider: from the front a pair of horns).
  // Now each leaves the front box low on its flank, runs straight back just above the track fender, turns in behind the
  // cradle and feeds one wide flat exhaust box across the tail whose outlet is a single long dark slot facing back.
  const smokeAt = [];
  const EX = { y: 0.485, x: 0.67, r: 0.04, z: HULL.z0 - 0.12, w: 1.0, h: 0.11, d: 0.14 };
  stat.add(part((b) => {
    for (const sx of [-1, 1]) {
      const pts = [V3(sx * 0.55, 0.6, 1.16), V3(sx * 0.64, 0.53, 1.06), V3(sx * EX.x, EX.y, 0.86), V3(sx * EX.x, EX.y, -0.3),
        V3(sx * EX.x, EX.y, -1.22), V3(sx * 0.62, EX.y + 0.01, EX.z + 0.02), V3(sx * (EX.w / 2 - 0.04), EX.y + 0.02, EX.z)];
      b.add(tube(pts, EX.r, 10, 60, { capEnd: false }), 'wIron', { c: '#5a524a' });
      // square collars: one at the front bend (so the pipe never shows end-on as a round disc from the nose), one amidships
      b.add(rbox(0.11, 0.11, 0.04, 0.012), 'wIron', { p: [sx * EX.x, EX.y, 0.86], c: '#3a3836' });
      b.add(rbox(0.11, 0.11, 0.04, 0.012), 'wIron', { p: [sx * EX.x, EX.y, -0.3], c: '#3a3836' });
      // a flat hanger plate up to the cradle wall behind the rider
      b.add(box(0.06, 0.03, 0.05), 'wIron', { p: [sx * (EX.x - 0.04), EX.y + 0.045, -0.95], c: '#3a3836' });
    }
    // the exhaust box: one flat bronze box across the tail, a dark slot outlet along its back face and a trim lip over it
    b.add(rbox(EX.w, EX.h, EX.d, 0.02), 'wBronze', { p: [0, EX.y + 0.02, EX.z] });
    b.add(rbox(EX.w - 0.14, 0.03, 0.02, 0.008), 'wDark', { p: [0, EX.y + 0.01, EX.z - EX.d / 2 - 0.004], c: '#1a1614' });
    b.add(rbox(EX.w + 0.02, 0.016, EX.d + 0.02, 0.006), 'wBronze', { p: [0, EX.y + 0.02 + EX.h / 2, EX.z] });
    for (const x of [-0.22, 0.22]) smokeAt.push(V3(x, EX.y + 0.01, EX.z - EX.d / 2 - 0.06));
  }));

  // ---------------------------------------------------------------- glowing bits (per-crawler materials)
  const fireMat = new THREE.MeshStandardMaterial({ color: 0xffb070, emissive: 0xff6a18, emissiveIntensity: 2.4, roughness: 0.4 });
  const tealMat = new THREE.MeshStandardMaterial({ color: 0xa0fff0, emissive: 0x30d8c8, emissiveIntensity: 1.6, roughness: 0.4 });
  const tealDim = new THREE.MeshStandardMaterial({ color: 0x1a4a46, emissive: 0x0e5a54, emissiveIntensity: 0.6, roughness: 0.5 });
  mats.push(fireMat, tealMat, tealDim);
  // slot vents: three per flank, one merged mesh
  {
    const gs = [];
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const g = box(0.012, 0.024, 0.2); g.translate(sx * (HULL.x + 0.03), 0.6, 0.42 + i * 0.27); gs.push(g); }
    const vents = new THREE.Mesh(mergeGeometries(gs, false), fireMat); for (const g of gs) g.dispose();
    vents.castShadow = false; body.add(vents);
  }
  // teal gauge strip across the backhead: a dim channel and a bright level bar that rises with the work
  const stripW = 0.44, stripZ = HOOD.z0 - 0.064;
  const strip0 = new THREE.Mesh(box(stripW, 0.03, 0.008), tealDim); strip0.position.set(0, 0.94, stripZ); body.add(strip0);
  const levelG = box(1, 0.026, 0.01); levelG.translate(0.5, 0, 0);
  const level = new THREE.Mesh(levelG, tealMat); level.position.set(-stripW / 2, 0.94, stripZ - 0.002); body.add(level);
  // (the two small teal windows either side of the firing hatch read as a pair of eyes over a mouth: removed)
  for (const m of [strip0, level]) m.castShadow = false;
  // the firebox glow under the belly: a flat plane laid face-down (a round soft sprite here showed as a disc from low views)
  const fireGlow = slotGlow(0xff8a30, 0.4, 1.1, 0.35, { rx: PI / 2 }); fireGlow.position.set(0, 0.235, -0.3); body.add(fireGlow); mats.push(fireGlow.material);
  const lampGlows = [];
  { const g = slotGlow(0xffd890, 0.96, 0.08, 0.5); g.position.set(0, 0.84, LOW.z1 + 0.06); body.add(g); lampGlows.push(g); mats.push(g.material); }

  // ---- steering tiller: the runabout's column and bowed yoke at the same place relative to the seat (same driving pose)
  const tiller = pivot(body, 0, WELL.floor, seatZ + 0.68);
  tiller.rotation.x = -0.14;
  const grip = { y: hipY + 0.16 - WELL.floor, x: 0.3 };
  tiller.add(part((b) => {
    b.add(cyl(0.028, 0.034, grip.y, 10), 'wIron', { p: [0, grip.y / 2, 0], c: '#3a3836' });
    b.add(cyl(0.05, 0.06, 0.06, 12), 'wBronze', { p: [0, 0.03, 0] });
    b.add(cyl(0.04, 0.04, 0.05, 12), 'wBronze', { p: [0, grip.y - 0.02, 0] });
    const pts = [V3(-grip.x, grip.y - 0.02, -0.1), V3(-grip.x * 0.7, grip.y - 0.01, -0.01), V3(0, grip.y, 0.03), V3(grip.x * 0.7, grip.y - 0.01, -0.01), V3(grip.x, grip.y - 0.02, -0.1)];
    b.add(tube(pts, 0.018, 8, 24, { capEnd: true, capStart: true }), 'wIron', { c: '#4a4642' });
    for (const sx of [-1, 1]) b.add(cyl(0.026, 0.026, 0.11, 10), 'wIron', { r: [0, 0, PI / 2], p: [sx * (grip.x - 0.02), grip.y - 0.02, -0.09], c: '#3a2014' });
  }));
  tiller.traverse((m) => { if (m.isMesh) m.castShadow = false; });

  // fold the static hull: only the big bronze, dark and painted panels cast shadows
  body.add(mergeGroup(stat, new Set(['wBronze', 'wDark', plateMat])));

  // ---------------------------------------------------------------- running gear (unsprung, in root space)
  // sprocket (rear) and idler (front) per track, plus four sprung road wheels; each side is one spinning part per wheel
  const wheels = []; // { g, r, y0, ph }
  const mkWheel = (r, z, y, ph, plate) => {
    const g = pivot(root, 0, y, z);
    g.add(part((b) => { for (const sx of [-1, 1]) discB(b, r, TRACK.w - 0.06, sx * TRACK.x, 0, 0, metalMat, metalC, plate); b.add(cyl(0.03, 0.03, TRACK.x * 2 - 0.1, 8), 'wDark', { r: [0, 0, PI / 2], c: '#2a2624' }); }));
    g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    const W = { g, r, y0: y, ph, off: 0 }; wheels.push(W); return W;
  };
  const endR = TRACK.r - 0.03;
  mkWheel(endR, TRACK.zr, TRACK.yc, 0, true);
  mkWheel(endR, TRACK.zf, TRACK.yc, 0, true);
  const roadY = TRACK.yc - TRACK.r + TRACK.th / 2 + ROAD.r;
  const road = ROAD.zs.map((z, i) => mkWheel(ROAD.r, z, roadY, [0, 1.7, 3.1, 4.6][i], true));
  // short swing arms from each road wheel up to the fender (static; the wheels bob a few mm within them)
  {
    const arms = part((b) => { for (const sx of [-1, 1]) for (const z of ROAD.zs) b.add(rbox(0.03, 0.2, 0.05, 0.01), 'wIron', { p: [sx * (TRACK.x - TRACK.w / 2 + 0.01), roadY + 0.1, z + 0.04], r: [0.35, 0, 0], c: '#3a3836' }); }, 9);
    arms.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    root.add(arms);
  }

  // ---- the tracks: 2 x 28 link plates with a cleat each, rebuilt into one dynamic mesh every frame (one draw call)
  const linkB = new Builder(4);
  linkB.add(rbox(TRACK.w, TRACK.th, TRACK.lk, 0.008), 'wIron', { c: '#7a726a' });
  linkB.add(box(TRACK.w - 0.02, 0.016, 0.026), 'wIron', { p: [0, TRACK.th / 2 + 0.008, 0], c: '#a89a86' }); // worn-bright cleat, so the links read as they march
  linkB.add(box(0.05, 0.022, TRACK.lk * 0.6), 'wIron', { p: [0, -TRACK.th / 2 - 0.008, 0], c: '#2a2724' }); // inner guide horn
  const [{ geo: lg, mat: linkMat }] = linkB.geometries();
  const LN = TRACK.n * 2, vc = lg.attributes.position.count;
  const basePos = lg.attributes.position.array, baseNrm = lg.attributes.normal.array;
  const tGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(LN * vc * 3), tNrm = new Float32Array(LN * vc * 3);
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage));
  tGeo.setAttribute('normal', new THREE.BufferAttribute(tNrm, 3).setUsage(THREE.DynamicDrawUsage));
  for (const k of Object.keys(lg.attributes)) {
    if (k === 'position' || k === 'normal') continue;
    const A = lg.attributes[k], arr = new A.array.constructor(A.array.length * LN);
    for (let i = 0; i < LN; i++) arr.set(A.array, i * A.array.length);
    tGeo.setAttribute(k, new THREE.BufferAttribute(arr, A.itemSize));
  }
  lg.dispose();
  tGeo.boundingSphere = new THREE.Sphere(V3(0, 0.2, (TRACK.zr + TRACK.zf) / 2), 1.1);
  tGeo.boundingBox = new THREE.Box3(V3(-0.7, -0.05, TRACK.zr - 0.25), V3(0.7, 0.45, TRACK.zf + 0.25));
  const trackMesh = new THREE.Mesh(tGeo, linkMat);
  trackMesh.castShadow = true; trackMesh.receiveShadow = true; trackMesh.frustumCulled = true;
  root.add(trackMesh);
  const LP = { y: 0, z: 0, a: 0 }, spacing = TP / TRACK.n;
  let lastTrackS = null;
  const layTracks = (s0) => {
    if (lastTrackS !== null && Math.abs(s0 - lastTrackS) < 1e-5) return;
    lastTrackS = s0;
    let o = 0;
    for (let side = 0; side < 2; side++) {
      const X = side ? TRACK.x : -TRACK.x, ph = side ? spacing * 0.5 : 0; // the two tracks' links are staggered
      for (let i = 0; i < TRACK.n; i++) {
        loopAt(s0 + ph + i * spacing, LP);
        const c = Math.cos(LP.a), s = Math.sin(LP.a);
        for (let v = 0; v < vc; v++, o += 3) {
          const x = basePos[v * 3], y = basePos[v * 3 + 1], z = basePos[v * 3 + 2];
          tPos[o] = X + x; tPos[o + 1] = LP.y + y * c - z * s; tPos[o + 2] = LP.z + y * s + z * c;
          const nx = baseNrm[v * 3], ny = baseNrm[v * 3 + 1], nz = baseNrm[v * 3 + 2];
          tNrm[o] = nx; tNrm[o + 1] = ny * c - nz * s; tNrm[o + 2] = ny * s + nz * c;
        }
      }
    }
    tGeo.attributes.position.needsUpdate = true; tGeo.attributes.normal.needsUpdate = true;
  };
  // anti-strobe: a soft dark band over each loop that fades in at speed (links move faster than a frame can show)
  const blurMat = new THREE.MeshStandardMaterial({ color: 0x3a3632, transparent: true, opacity: 0, depthWrite: false, roughness: 0.8, side: THREE.DoubleSide });
  mats.push(blurMat);
  let blur;
  {
    const N = 72, pos = [], idx = [], Q = { y: 0, z: 0, a: 0 };
    for (const X of [-TRACK.x, TRACK.x]) {
      const base = pos.length / 3;
      for (let i = 0; i <= N; i++) {
        loopAt((i / N) * TP, Q);
        const oy = Math.cos(Q.a) * (TRACK.th / 2 + 0.02), oz = Math.sin(Q.a) * (TRACK.th / 2 + 0.02);
        pos.push(X - TRACK.w / 2 - 0.006, Q.y + oy, Q.z + oz, X + TRACK.w / 2 + 0.006, Q.y + oy, Q.z + oz);
        if (i < N) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      // the side faces of the band too, so it reads from the chase camera
      for (const sx of [-1, 1]) {
        const b0 = pos.length / 3;
        for (let i = 0; i <= N; i++) {
          loopAt((i / N) * TP, Q);
          const k1 = TRACK.th / 2 + 0.02, k0 = -TRACK.th / 2;
          pos.push(X + sx * (TRACK.w / 2 + 0.008), Q.y + Math.cos(Q.a) * k1, Q.z + Math.sin(Q.a) * k1, X + sx * (TRACK.w / 2 + 0.008), Q.y + Math.cos(Q.a) * k0, Q.z + Math.sin(Q.a) * k0);
          if (i < N) { const a = b0 + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    blur = new THREE.Mesh(g, blurMat); blur.renderOrder = 2; blur.castShadow = false; blur.receiveShadow = false; root.add(blur);
  }

  // ---- the front roller drum on a steering fork
  const fork = pivot(root, 0, 0, DRUM.z);
  fork.add(part((b) => {
    for (const sx of [-1, 1]) {
      b.add(rbox(0.05, 0.3, 0.14, 0.015), 'wBronze', { p: [sx * (DRUM.w / 2 + 0.05), DRUM.r + 0.12, 0] });
      b.add(rbox(0.04, 0.09, 0.09, 0.01), 'wDark', { p: [sx * (DRUM.w / 2 + 0.08), DRUM.r, 0], c: '#3a3634' }); // square axle nut on the fork
    }
    b.add(rbox(DRUM.w + 0.16, 0.05, 0.14, 0.015), 'wBronze', { p: [0, DRUM.r + 0.27, 0] });
    b.add(cyl(0.06, 0.07, 0.06, 12), 'wDark', { p: [0, DRUM.r + 0.31, 0], c: '#3a3634' }); // steering pivot into the hull
    b.add(rbox(DRUM.w, 0.025, 0.04, 0.01), 'wIron', { p: [0, DRUM.r * 0.5, -DRUM.r - 0.03], r: [0.5, 0, 0], c: '#3a3836' }); // scraper bar
  }));
  const drum = pivot(fork, 0, DRUM.r, 0);
  drum.add(part((b) => {
    b.add(cyl(DRUM.r, DRUM.r, DRUM.w, 26), 'wDark', { r: [0, 0, PI / 2], c: '#4a4440' });
    for (const x of [-DRUM.w / 2 + 0.03, 0, DRUM.w / 2 - 0.03]) b.add(torus(DRUM.r + 0.004, 0.016, 6, 26), 'wBronze', { r: [0, PI / 2, 0], p: [x, 0, 0] });
    for (const sx of [-1, 1]) {
      // plain solid end face (no inner disc or hub cap set in a ring), square bolt heads around the axle
      for (let k = 0; k < 6; k++) { const a = k * PI / 3 + 0.3; b.add(box(0.02, 0.034, 0.034), 'wBronze', { p: [sx * (DRUM.w / 2 + 0.006), Math.cos(a) * DRUM.r * 0.42, Math.sin(a) * DRUM.r * 0.42], r: [a, 0, 0] }); }
      // one filler plug off-centre so the roll reads (a single feature, not a ring of them)
      b.add(rbox(0.024, 0.06, 0.06, 0.01), 'wDark', { p: [sx * (DRUM.w / 2 + 0.012), DRUM.r * 0.5, 0], c: '#2a2624' });
    }
    // a raised seam along the drum's length, also so the roll reads
    b.add(rbox(DRUM.w - 0.1, 0.02, 0.04, 0.008), 'wBronze', { p: [0, DRUM.r + 0.005, 0] });
  }));
  drum.traverse((m) => { if (m.isMesh) m.castShadow = m.material.name === 'wDark'; });
  fork.traverse((m) => { if (m.isMesh && m.parent !== drum.children[0]) m.castShadow = false; });

  // ---------------------------------------------------------------- smoke and steam (world space)
  const NP = 56;
  const pGeo = new THREE.BufferGeometry();
  const aPos = new Float32Array(NP * 3), aSize = new Float32Array(NP), aAlpha = new Float32Array(NP), aRot = new Float32Array(NP), aTint = new Float32Array(NP * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('size', new THREE.BufferAttribute(aSize, 1).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('alpha', new THREE.BufferAttribute(aAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('rot', new THREE.BufferAttribute(aRot, 1).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('tint', new THREE.BufferAttribute(aTint, 3).setUsage(THREE.DynamicDrawUsage));
  const puffs = new THREE.Points(pGeo, smokeMaterial());
  puffs.frustumCulled = false; puffs.renderOrder = 3; puffs.visible = false;
  puffs.onBeforeRender = smokeScale;
  root.add(puffs);
  const pool = [];
  for (let i = 0; i < NP; i++) pool.push({ i, age: 9, life: 1, w: V3(), v: V3(), size0: 0.3, size1: 1, op: 0.5, rot: 0, ang: 0, col: new THREE.Color() });
  const tmpM = new THREE.Matrix4(), tmpV = V3();
  let live = 0;
  const emit = (local, from, vel, { life, size0, size1, op, color }) => {
    const p = pool.find((q) => q.age >= q.life);
    if (!p) return;
    p.age = 0; p.life = life; p.size0 = size0; p.size1 = size1; p.op = op;
    p.w.copy(local).applyMatrix4(from.matrixWorld);
    p.v.copy(vel);
    p.col.set(color); p.ang = Math.random() * 6; p.rot = (Math.random() - 0.5) * 1.2;
    live++;
  };

  // ---------------------------------------------------------------- per-frame drive
  let dist = 0, t = Math.random() * 10, steer = 0, run = 0, lastSpeed = 0, accel = 0, pitchKick = 0, chuffD = 0, idleT = 0, ventT = 0, lvl = 0;
  const state = { steer: 0, run: 0, accel: 0 };
  root.userData.seat = new THREE.Vector3(SEAT[0], SEAT[1], SEAT[2]);
  root.userData.body = body;
  root.userData.state = state;
  root.userData.kind = 'crawler';
  root.userData.dispose = () => {
    for (const m of mats) m.dispose();
    root.traverse((o) => { if (o.isSprite) o.material.dispose(); else if (o.isMesh || o.isPoints) o.geometry.dispose(); });
  };
  let far = false;
  const setFar = (f) => { far = f; blur.visible = !f; if (f) { for (const p of pool) p.age = p.life; live = 0; puffs.visible = false; } };
  root.userData.update = (dt, speed = 0, turn = 0, lodDist = 0) => {
    dt = Math.min(dt, 0.1);
    t += dt;
    const step = speed * dt;
    dist += step;
    run = Math.min(1, Math.abs(speed) / 9);
    const a = (speed - lastSpeed) / Math.max(dt, 1e-3); lastSpeed = speed;
    accel += (Math.max(-6, Math.min(6, a)) - accel) * (1 - Math.exp(-dt * 5));
    if (accel > 1.5) pitchKick = Math.min(1, pitchKick + dt * 4); else pitchKick = Math.max(0, pitchKick - dt * 3.3);
    steer += (Math.max(-0.45, Math.min(0.45, turn * 0.22)) - steer) * (1 - Math.exp(-dt * 6));
    const sn = steer / 0.45;
    state.steer = sn; state.run = run; state.accel = accel;
    if (!far && lodDist > 27) setFar(true); else if (far && lodDist < 23) setFar(false);

    // running gear: every wheel and the drum roll by distance, the links slide round the loops by the same distance
    for (const W of wheels) W.g.children[0].rotation.x = dist / W.r;
    drum.rotation.x = dist / DRUM.r;
    fork.rotation.y = steer * 0.9;
    tiller.rotation.y = steer * 0.45;
    if (!far || lastTrackS === null) layTracks(dist);
    // suspension: each road wheel bobs on its own phase; the hull rides their average, pitches off the drum and rolls into turns
    let sum = 0;
    for (const W of road) { W.off = 0.01 * Math.sin(t * 12 + W.ph) * run + 0.002 * Math.sin(t * 3.1 + W.ph); W.g.position.y = W.y0 + W.off; sum += W.off; }
    const rearOff = sum / road.length;
    const drumOff = 0.014 * Math.sin(t * 9.4 + 2.2) * run;
    fork.position.y = drumOff;
    body.position.y = (rearOff * 2 + drumOff) / 3 + 0.005 * Math.sin(t * 2.4) * (1 - run); // idle shiver from the boiler
    body.rotation.z = -sn * 0.06 * run + Math.sin(t * 8.3) * 0.003 * run;
    body.rotation.x = -((drumOff - rearOff) / (DRUM.z - (TRACK.zr + TRACK.zf) / 2)) * 2.5 - 0.03 * pitchKick + Math.sin(t * 6.7) * 0.003 * run;

    // glow: vents pulse and burn brighter with the work, the teal level bar rises with it
    const nightK = G.night?.value ?? 0;
    fireMat.emissiveIntensity = 2.0 + 0.6 * Math.sin(t * 3) + 1.4 * run + 0.4 * Math.sin(t * 10.7) * run;
    fireGlow.material.opacity = (0.25 + 0.2 * run) * (1 + nightK);
    for (const g of lampGlows) g.material.opacity = 0.3 + 0.7 * nightK;
    lvl += (0.35 + 0.6 * run + Math.max(0, accel) * 0.02 - lvl) * (1 - Math.exp(-dt * 3));
    level.scale.x = Math.max(0.02, Math.min(1, lvl + Math.sin(t * 13) * 0.015 * run)) * stripW;
    tealMat.emissiveIntensity = 1.4 + 0.5 * run;
    blurMat.opacity = Math.max(0, Math.min(0.6, (Math.abs(speed) - 3.5) / 6));

    // smoke and steam
    if (dt > 0 && root.parent && !far) {
      root.updateWorldMatrix(true, true);
      const hard = Math.max(0, accel) / 6;
      const smokeCol = SMOKE_TMP.copy(SMOKE_LIGHT).lerp(SMOKE_DARK, Math.min(1, hard * 1.4));
      chuffD += Math.abs(step);
      if (speed > 0.3 && chuffD > 1.1) {
        chuffD = 0;
        for (const at of smokeAt) emit(at, body, V3((Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.4, -0.8 - Math.random() * 0.4), { life: 1.4, size0: 0.4, size1: 1.7, op: 0.4, color: smokeCol });
      }
      idleT -= dt;
      if (idleT <= 0) { idleT = speed > 0.3 ? 0.35 : 0.55; for (const at of smokeAt) emit(at, body, V3(0, 0.8, -0.3), { life: 1.8, size0: 0.22, size1: 0.95, op: 0.26, color: 0xb0aaa2 }); }
      // steam bleeds from the boiler's blow-off under the hull flanks, low to the ground
      ventT -= dt;
      if (ventT <= 0) {
        ventT = speed > 0.5 ? 0.15 : 0.65;
        for (const sx of [-1, 1]) emit(V3(sx * 0.62, 0.42, 0.15 + (Math.random() - 0.5) * 0.3), root, V3(sx * (0.8 + Math.random() * 0.5), 0.1, -0.3), { life: 0.6, size0: 0.2, size1: 0.7, op: 0.22, color: 0xeef2f0 });
      }
      tmpM.copy(root.matrixWorld).invert();
      const wd = G.windDir?.value, ws = G.windStrength?.value || 0;
      const nk = 1 - 0.6 * nightK;
      live = 0;
      for (const p of pool) {
        const i = p.i;
        if (p.age >= p.life) { aAlpha[i] = 0; continue; }
        p.age += dt;
        if (p.age >= p.life) { aAlpha[i] = 0; continue; }
        live++;
        const k = p.age / p.life;
        p.v.multiplyScalar(Math.exp(-dt * 2.2));
        p.w.addScaledVector(p.v, dt);
        p.w.y += 0.5 * dt;
        if (wd) { p.w.x += wd.x * 0.6 * ws * k * dt; p.w.z += wd.y * 0.6 * ws * k * dt; }
        tmpV.copy(p.w).applyMatrix4(tmpM);
        aPos[i * 3] = tmpV.x; aPos[i * 3 + 1] = tmpV.y; aPos[i * 3 + 2] = tmpV.z;
        aSize[i] = p.size0 + (p.size1 - p.size0) * Math.sqrt(k);
        p.ang += p.rot * dt; aRot[i] = p.ang;
        aAlpha[i] = p.op * Math.min(1, k * 6) * (1 - k) * nk;
        aTint[i * 3] = p.col.r; aTint[i * 3 + 1] = p.col.g; aTint[i * 3 + 2] = p.col.b;
      }
      puffs.visible = live > 0;
      if (live > 0) for (const n of ['position', 'size', 'alpha', 'rot', 'tint']) pGeo.attributes[n].needsUpdate = true;
    }
  };
  root.userData.update(0, 0, 0);
  return root;
}
