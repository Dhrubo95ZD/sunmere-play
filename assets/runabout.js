// The Brass Runabout: a clockwork steam road engine that players ride (no animals in Sunmere).
// Three marks with their own silhouettes, all built at vehicle scale around a seated rider:
//   Mk I   Workshop Cart     short wheelbase, open wooden tub, short boiler with one tall straight stack, coil springs, coal sack
//   Mk II  Road Engine       long horizontal boiler, big rear drivers, one wide flat stack, swept fenders, plough, iron cab rail
//   Mk III Deepway Explorer  long and low, bronze shroud with straight verdigris ribs, six wheels, swept-back square exhaust stacks
// Wheels are layered solid discs (no spokes) with one crank pin and one counterweight, so the turning reads. Side rods and
// pistons really work, each axle rides its own spring, the body leans into turns, the stack chuffs twice per turn of the
// drivers and the glowing fire vents and lit pressure gauge are the hero details; the front is a flat square smokebox with one full-width lamp bar.
// Front is +z, the rider's hips sit at userData.seat (in body space); userData.body is the sprung body group.
//   userData.update(dt, speed, turnRate, lodDist)  drives everything above (lodDist: metres from the local player)
//   userData.state  { steer (-1..1), run (0..1), accel }  read by the rider pose
import * as THREE from 'three';
import { Builder, box, rbox, cyl, sphere, torus, lathe, extrude, tube, lumpy, V3 } from './kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { puffTex } from '../engine/textures.js';
import { G } from '../engine/globals.js';
import { PAINTS } from '/sunmere-play/shared/data.js';

const PI = Math.PI;
const part = (fn, seed = 3) => { const b = new Builder(seed); fn(b); return b.build(); };
// fold every mesh under a group of built parts (all at identity) into one mesh per material: one draw call per material
function mergeGroup(group, shadowMats = null) {
  group.updateMatrixWorld(true);
  const byMat = new Map();
  group.traverse((m) => { if (!m.isMesh) return; if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push(m.geometry.clone().applyMatrix4(m.matrixWorld)); m.geometry.dispose(); });
  const out = new THREE.Group();
  for (const [mat, list] of byMat) {
    const mesh = new THREE.Mesh(list.length > 1 ? mergeGeometries(list, false) : list[0], mat);
    if (list.length > 1) for (const g of list) g.dispose();
    mesh.castShadow = !mat.transparent && (!shadowMats || shadowMats.has(mat.name));
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}
const pivot = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const METAL = { brass: 'wBrass', copper: 'wCopper', iron: 'wDark', bronze: 'wBronze', gold: 'wGold' };
const METAL_TINT = { iron: '#5a5a62' };
// bands and fittings that contrast with the boiler skin
const BAND = { brass: 'wCopper', copper: 'wBrass', iron: 'wBrass', bronze: 'wVerdigris', gold: 'wDark' };
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };
const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

// ---- smoke and steam: one shared soft-puff material for every cart's Points cloud (size in metres, rotating puffs)
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
// point sizes are in pixels: scale metres by the target height and the camera's focal length each draw
function smokeScale(renderer, scene, camera) {
  const rt = renderer.getRenderTarget();
  const h = rt ? rt.height : renderer.getDrawingBufferSize(_sz).y;
  smokeMat.uniforms.pxScale.value = h * 0.5 * camera.projectionMatrix.elements[5];
}

// ---- the three marks
const SPEC = {
  1: {
    seat: [0, 0.69, -0.5], rail: 0.94, floor: 0.12, wellZ: [-0.82, 0.0], wellX: 0.42,
    front: { z: 0.86, r: 0.36, x: 0.56, w: 0.15 }, rear: [{ z: -0.74, r: 0.36, x: 0.58, w: 0.16 }],
    boiler: { r: 0.26, y: 0.84, z0: 0.12, z1: 0.86, box: 0.18 }, frameY: 0.46, frame: [-1.14, 1.12],
    rod: { L: 0.6, cyl: 0.22 }, tender: { z0: -0.84, z1: -1.16, top: 0.94 },
  },
  2: {
    seat: [0, 0.69, -0.5], rail: 0.98, floor: 0.12, wellZ: [-0.8, 0.06], wellX: 0.44,
    front: { z: 0.94, r: 0.36, x: 0.56, w: 0.16 }, rear: [{ z: -0.72, r: 0.5, x: 0.64, w: 0.22 }],
    boiler: { r: 0.3, y: 0.92, z0: 0.14, z1: 1.04, box: 0.22 }, frameY: 0.5, frame: [-1.32, 1.3],
    rod: { L: 0.7, cyl: 0.25 }, tender: { z0: -0.82, z1: -1.32, top: 0.96 },
  },
  3: {
    seat: [0, 0.65, -0.42], rail: 0.9, floor: 0.1, wellZ: [-0.74, 0.12], wellX: 0.44,
    front: { z: 1.08, r: 0.32, x: 0.58, w: 0.16 }, rear: [{ z: -0.26, r: 0.36, x: 0.64, w: 0.18 }, { z: -1.14, r: 0.36, x: 0.64, w: 0.18 }],
    boiler: { r: 0.27, y: 0.74, z0: 0.2, z1: 1.14, box: 0.2 }, frameY: 0.42, frame: [-1.5, 1.42],
    rod: { L: 0.55, cyl: 0.22 }, tender: { z0: -0.76, z1: -1.46, top: 0.86 },
  },
};

// ---- a layered solid wheel (axle along x). phase: the crank pin's angle. Returns the spinning group.
function wheelB(r, w, P, phase, bodyMat, bodyCol, metalMat, metalC) {
  const rho = r * 0.55;
  const b = new Builder(11);
  {
    const R = [0, 0, PI / 2], RT = [0, PI / 2, 0];
    const rf = r - 0.07;
    // tread tyre (rubber-like, not metal), widened to the wheel width
    b.add(torus(r - 0.062, 0.062, 8, 20), 'wLeather', { r: RT, s: [1, 1, w / 0.124], c: '#2a2522' });
    // one plain painted face disc (no inner dish, no inner ring) with a rolled rim lip at its very edge
    b.add(cyl(rf, rf, w - 0.02, 20), bodyMat, { r: R, c: bodyCol });
    for (const sx of [-1, 1]) {
      b.add(torus(rf, 0.018, 5, 20), metalMat, { r: RT, p: [sx * (w / 2 - 0.012), 0, 0], c: metalC });
      // a square axle nut and six square bolt heads straight on the face (nothing round set into the disc)
      b.add(rbox(0.03, r * 0.26, r * 0.26, 0.008), metalMat, { p: [sx * (w / 2 + 0.004), 0, 0], c: metalC });
      for (let k = 0; k < 6; k++) {
        const a = k * PI / 3 + 0.3;
        b.add(box(0.02, 0.034, 0.034), metalMat, { p: [sx * (w / 2 - 0.002), Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4], r: [a, 0, 0], c: metalC });
      }
    }
    // the crank: a throw plate from the hub out to the pin boss, and a counterweight block on the opposite side
    const cs = Math.cos(phase), sn = Math.sin(phase);
    b.add(rbox(w + 0.03, rho + 0.1, 0.11, 0.025), 'wLeather', { r: [phase, 0, 0], p: [0, cs * rho * 0.5, sn * rho * 0.5], c: '#4a4642' });
    b.add(cyl(0.05, 0.05, w + 0.1, 10), metalMat, { r: R, p: [0, cs * rho, sn * rho], c: metalC });
    b.add(rbox(w + 0.02, r * 0.2, r * 0.48, 0.02), 'wPaint', { r: [phase + PI, 0, 0], p: [0, -cs * r * 0.64, -sn * r * 0.64], c: P.trim });
  }
  return b;
}

// a flat arc band fender (extruded crescent-free band with a rolled lip), axle at the origin, extruded along x
function fenderGeo(r, w, a0 = 0.25, a1 = PI - 0.25) {
  const ri = r + 0.05, ro = r + 0.1;
  const s = new THREE.Shape();
  s.absarc(0, 0, ro, a0, a1, false);
  s.absarc(0, 0, ri, a1, a0, true);
  s.closePath();
  return extrude(s, w + 0.1, 0.012, 20);
}

// a square-section stack rising y=0..h from (x, y0, z): w wide (x) by d deep (z), a wider square cap band at the top,
// and a long thin dark slot for the outlet (a narrow rectangle, never a round hole in a ring when seen from above)
function squareStack(b, x, y0, z, h, w, d, mat, c, capMat, capC) {
  b.add(rbox(w, h, d, 0.015), mat, { p: [x, y0 + h / 2, z], c });
  b.add(rbox(w + 0.05, 0.06, d + 0.05, 0.012), capMat, { p: [x, y0 + h - 0.03, z], c: capC });
  b.add(rbox(w + 0.03, 0.03, d + 0.03, 0.01), capMat, { p: [x, y0 + h * 0.45, z], c: capC });
  b.add(box(w * 0.72, 0.012, 0.03), 'wDark', { p: [x, y0 + h + 0.001, z], c: '#0a0808' });
}

export function buildRunabout(paintId = 'brass', mk = 1) {
  mk = Math.max(1, Math.min(3, Math.round(mk) || 1));
  const P = PAINTS[paintId] || PAINTS.brass;
  const S = SPEC[mk];
  const wood = P.paint === false;
  const bodyMat = wood ? 'wWood' : 'wPaint';
  const bodyCol = wood ? '#e2c49a' : P.body;
  const metalKey = P.metal || 'brass';
  const metalMat = METAL[metalKey] || 'wBrass';
  const metalC = METAL_TINT[metalKey] || 0xffffff;
  const bandMat = BAND[metalKey] || 'wBrass';
  const trim = P.trim || '#d9a650';
  const fitMat = mk >= 3 ? 'wBronze' : metalKey === 'iron' ? 'wBrass' : metalMat; // small fittings
  const { boiler: B, seat: ST } = S;
  const seatZ = ST[2], hipY = ST[1];

  const root = new THREE.Group();
  root.name = 'runabout';
  const body = pivot(root, 0, 0, 0);
  const mats = []; // per-cart materials to dispose with the cart (they are few)
  const stat = new THREE.Group(); // every static body part, merged into one mesh per material once built

  // ---------------------------------------------------------------- the sprung body
  stat.add(part((b) => {
    const [fz0, fz1] = S.frame, fl = fz1 - fz0, fzc = (fz0 + fz1) / 2;
    // two frame rails with cross members
    const [wa, wb] = S.wellZ;
    for (const sx of [-1, 1]) {
      for (const [z0, z1] of [[wb, fz1], [fz0, wa]]) b.add(rbox(0.07, 0.1, z1 - z0, 0.02), 'wIron', { p: [sx * 0.36, S.frameY, (z0 + z1) / 2], c: '#5a5650' });
      b.add(rbox(0.07, 0.07, wb - wa + 0.1, 0.02), 'wIron', { p: [sx * 0.36, S.floor - 0.05, (wa + wb) / 2], c: '#5a5650' }); // dropped under the footplate
      for (const z of [wa, wb]) b.add(box(0.07, S.frameY - S.floor + 0.05, 0.08), 'wIron', { p: [sx * 0.36, (S.frameY + S.floor) / 2 - 0.02, z], c: '#4a4642' });
    }
    for (const z of [fz0 + 0.06, fz1 - 0.06, (wb + fz1) / 2]) b.add(box(0.72, 0.06, 0.08), 'wIron', { p: [0, S.frameY, z], c: '#4a4642' });
    // front buffer beam
    b.add(rbox(0.96, 0.14, 0.1, 0.03), bodyMat, { p: [0, S.frameY, fz1], c: bodyCol });
    b.add(box(0.98, 0.016, 0.012), 'wPaint', { p: [0, S.frameY + 0.035, fz1 + 0.052], c: trim });

    // ---- the driver's well: dropped floor, side panels up to the rider's ribs, a bright top rim
    const [wz0, wz1] = S.wellZ, wl = wz1 - wz0, wzc = (wz0 + wz1) / 2, WX = S.wellX;
    b.add(rbox(WX * 2, 0.06, wl, 0.02), 'wWood', { p: [0, S.floor, wzc], c: '#9a7048' }); // footplate
    for (let i = 0; i < 4; i++) b.add(box(WX * 2 - 0.06, 0.008, 0.02), 'wIron', { p: [0, S.floor + 0.032, wz1 - 0.12 - i * 0.12], c: '#5a5650' }); // tread strips
    const panH = S.rail - S.floor, panY = (S.rail + S.floor) / 2;
    for (const sx of [-1, 1]) {
      if (mk === 1) {
        // open wooden tub: four planks with dark gaps and iron straps
        for (let i = 0; i < 4; i++) b.add(rbox(0.05, panH / 4 - 0.012, wl, 0.012), 'wWood', { p: [sx * WX, S.floor + panH * (i + 0.5) / 4, wzc], c: wood ? '#d6b086' : bodyCol });
        for (const z of [wz0 + 0.08, wzc, wz1 - 0.08]) b.add(box(0.06, panH, 0.04), 'wIron', { p: [sx * WX, panY, z], c: '#4a4642' });
      } else {
        b.add(rbox(0.05, panH, wl, 0.02), bodyMat, { p: [sx * WX, panY, wzc], c: bodyCol });
        // pin-stripe 2 cm inside the panel edge
        const px = sx * (WX + 0.027);
        b.add(box(0.006, 0.012, wl - 0.08), 'wPaint', { p: [px, S.rail - 0.05, wzc], c: trim });
        b.add(box(0.006, 0.012, wl - 0.08), 'wPaint', { p: [px, S.floor + 0.08, wzc], c: trim });
        for (const z of [wz0 + 0.04, wz1 - 0.04]) b.add(box(0.006, panH - 0.13, 0.012), 'wPaint', { p: [px, panY + 0.015, z], c: trim });
        if (mk === 3) b.add(rbox(0.012, panH - 0.22, wl - 0.2, 0.01), 'wVerdigris', { p: [sx * (WX + 0.026), panY + 0.015, wzc] });
      }
      // top rim line (catches the light from above)
      b.add(rbox(0.08, 0.035, wl + 0.04, 0.012), mk === 2 ? 'wIron' : 'wPaint', { p: [sx * WX, S.rail + 0.01, wzc], c: mk === 2 ? '#3a3836' : trim });
      if (mk === 2) for (let i = 0; i < 8; i++) b.add(sphere(0.016, 6, 4), 'wBrass', { p: [sx * WX, S.rail + 0.032, wz0 + 0.06 + i * (wl - 0.12) / 7] }); // riveted iron cab rail
    }
    // the seat: cushion, low back, a box under it
    b.add(rbox(0.6, hipY - 0.12 - S.floor, 0.36, 0.03), wood ? 'wWood' : bodyMat, { p: [0, (hipY - 0.12 + S.floor) / 2, seatZ - 0.04], c: shade(bodyCol, 0.8) });
    b.add(rbox(0.6, 0.11, 0.44, 0.05), 'wLeather', { p: [0, hipY - 0.1, seatZ - 0.02], c: P.seat });
    b.add(rbox(0.6, 0.34, 0.1, 0.05), 'wLeather', { p: [0, hipY + 0.11, seatZ - 0.28], r: [-0.14, 0, 0], c: P.seat });
    for (const sx of [-1, 1]) for (const y of [0.03, 0.17]) b.add(sphere(0.018, 6, 4), fitMat, { p: [sx * 0.15, hipY + y, seatZ - 0.22] }); // buttons

    // ---- the raised tender behind the seat
    const T = S.tender, tl = T.z0 - T.z1, tzc = (T.z0 + T.z1) / 2, th = T.top - S.frameY;
    if (mk === 1) {
      // a small crate with a rope-lashed coal sack on it
      b.add(rbox(0.74, 0.34, tl, 0.025), 'wWood', { p: [0, S.frameY + 0.2, tzc], c: wood ? '#c9a07a' : bodyCol });
      for (const z of [T.z0 - 0.04, T.z1 + 0.04]) b.add(box(0.76, 0.36, 0.03), 'wIron', { p: [0, S.frameY + 0.2, z], c: '#4a4642' });
      b.add(lumpy(sphere(0.25, 12, 8), 0.05, 2.4, 7), 'wCloth', { p: [0, T.top - 0.12, tzc], s: [1.35, 0.6, 0.9], c: '#a88a5e' });
      for (const x of [-0.16, 0.16]) b.add(torus(0.23, 0.014, 5, 20), 'wLeather', { p: [x, T.top - 0.11, tzc], r: [0, PI / 2, 0], s: [0.66, 1, 1], c: '#c8a878' });
      b.add(lumpy(sphere(0.07, 8, 6), 0.02, 3, 3), 'wDark', { p: [0.22, S.frameY + 0.42, T.z0 - 0.06], c: '#2a2826' });
    } else {
      // water tank sides in the body colour with a coal bunker on top
      b.add(rbox(0.96, th, tl, 0.04), bodyMat, { p: [0, S.frameY + th / 2, tzc], c: bodyCol });
      b.add(rbox(1.0, 0.04, tl + 0.04, 0.015), mk === 3 ? 'wBronze' : 'wPaint', { p: [0, T.top, tzc], c: mk === 3 ? 0xffffff : trim });
      // coal: a low bed of loose lumps (no smooth mound)
      b.add(box(0.86, 0.04, tl - 0.1), 'wRust', { p: [0, T.top + 0.005, tzc], c: '#2a2624' });
      for (let i = 0; i < 22; i++) {
        const u = b.r(-1, 1), v = b.r(-1, 1), hgt = (1 - Math.max(Math.abs(u), Math.abs(v)) * 0.8);
        b.add(lumpy(new THREE.IcosahedronGeometry(b.r(0.06, 0.1), 0), 0.02, 4, i), 'wRust', { p: [u * 0.36, T.top + 0.03 + hgt * 0.06, tzc + v * (tl / 2 - 0.1)], r: [b.r(0, 3), b.r(0, 3), 0], s: [1, 0.7, 1], c: i % 3 ? '#262220' : '#3a3430', flat: true });
      }
      for (const sx of [-1, 1]) {
        const px = sx * 0.484;
        b.add(box(0.006, 0.012, tl - 0.1), 'wPaint', { p: [px, T.top - 0.07, tzc], c: trim });
        b.add(box(0.006, 0.012, tl - 0.1), 'wPaint', { p: [px, S.frameY + 0.08, tzc], c: trim });
        for (const z of [T.z0 - 0.05, T.z1 + 0.05]) b.add(box(0.006, th - 0.15, 0.012), 'wPaint', { p: [px, S.frameY + th / 2, z], c: trim });
        if (mk === 3) b.add(rbox(0.012, th - 0.24, tl - 0.24, 0.01), 'wVerdigris', { p: [sx * 0.482, S.frameY + th / 2, tzc] });
      }
      // makers' plate, tool box and drag chain under the tender
      b.add(rbox(0.36, 0.1, 0.02, 0.01), fitMat, { p: [0, S.frameY + th * 0.55, T.z1 - 0.02] });
      b.add(rbox(0.5, 0.14, 0.2, 0.02), 'wIron', { p: [0, S.frameY - 0.12, tzc], c: '#3a3836' });
      const chain = []; for (let i = 0; i <= 8; i++) { const t = i / 8; chain.push(V3(0.3, S.frameY - 0.05 - Math.sin(t * PI) * 0.14, T.z0 - t * (tl - 0.1))); }
      b.add(tube(chain, 0.012, 5, 16), 'wIron', { c: '#4a4642' });
    }
    // rear lamp-plate in trim
    b.add(box(0.5, 0.02, 0.012), 'wPaint', { p: [0, S.frameY + 0.04, T.z1 - 0.01], c: trim });

    // ---- the horizontal boiler
    const bl = B.z1 - B.z0, bzc = (B.z0 + B.z1) / 2;
    if (mk === 3) {
      // bronze shroud: a long barrel with straight verdigris ribs running fore and aft (parallel lines from above; the old
      // curved chevron ribs over the top showed as nested arcs round the gauge from the rider's seat)
      b.add(cyl(B.r, B.r, bl, 24), 'wBronze', { r: [PI / 2, 0, 0], p: [0, B.y, bzc] });
      for (const a of [-1.05, -0.45, 0.45, 1.05]) b.add(rbox(0.03, 0.022, bl - 0.12, 0.008), 'wVerdigris', { p: [Math.sin(a) * (B.r + 0.006), B.y + Math.cos(a) * (B.r + 0.006), bzc], r: [0, 0, -a] });
      // a teal-glass strip along the shroud flank (dark, unlit)
      for (const sx of [-1, 1]) b.add(rbox(0.02, 0.05, bl - 0.2, 0.01), 'wDark', { p: [sx * (B.r - 0.02), B.y - B.r * 0.6, bzc], c: '#2a2826' });
    } else {
      b.add(cyl(B.r, B.r, bl, 24), metalMat, { r: [PI / 2, 0, 0], p: [0, B.y, bzc], c: metalC });
      const nb = mk === 1 ? 2 : 3;
      for (let i = 0; i < nb; i++) b.add(torus(B.r + 0.008, 0.016, 5, 24), bandMat, { p: [0, B.y, B.z0 + 0.08 + i * (bl - 0.16) / Math.max(1, nb - 1)] });
      // boiler cladding rivets along the top seam
      for (let i = 0; i < 7; i++) b.add(sphere(0.013, 6, 4), bandMat, { p: [0, B.y + B.r + 0.004, B.z0 + 0.12 + i * (bl - 0.24) / 6] });
    }
    b.add(rbox(0.09, 0.08, 0.09, 0.015), 'wDark', { p: [0, B.y + B.r + 0.02, B.z0 + 0.1], c: '#3a3836' }); // gauge mount
    // saddle supports down to the frame
    for (const z of [B.z0 + 0.12, B.z1 - 0.12]) b.add(rbox(0.5, B.y - S.frameY, 0.1, 0.02), 'wIron', { p: [0, (B.y + S.frameY) / 2 - 0.05, z], c: '#3a3836' });
    // backhead plate facing the rider, with a shut fire door and its handle (the glow shows at the front and flanks)
    b.add(rbox(B.r * 2 + 0.05, B.r * 2 + 0.03, 0.04, 0.02), 'wDark', { p: [0, B.y, B.z0 - 0.01], c: '#3a3634' }); // square plate, hides the round barrel end
    b.add(rbox(0.26, 0.14, 0.03, 0.012), 'wDark', { p: [0, B.y - B.r * 0.4, B.z0 - 0.03], c: '#4a4642' });
    b.add(box(0.12, 0.018, 0.03), fitMat, { p: [0, B.y - B.r * 0.4, B.z0 - 0.05] });
    // smokebox: a square, flat-faced housing over the boiler's front end (wider than the barrel, so nothing round shows
    // from the front), a trim line along its top edge, and one full-width horizontal lamp bar high across the flat face
    const sbW = B.r * 2 + 0.1, sbH = B.r * 2 + 0.06, sbz = B.z1 + B.box / 2, sbF = B.z1 + B.box;
    b.add(rbox(sbW, sbH, B.box + 0.02, 0.03), 'wDark', { p: [0, B.y, sbz], c: '#3a3836' });
    b.add(rbox(sbW - 0.04, sbH - 0.04, 0.02, 0.01), 'wDark', { p: [0, B.y, sbF + 0.01], c: '#4a4642' }); // flat front plate
    b.add(box(sbW + 0.01, 0.022, B.box + 0.03), 'wPaint', { p: [0, B.y + sbH / 2 - 0.02, sbz], c: trim });
    b.add(box(sbW + 0.01, 0.018, 0.012), 'wPaint', { p: [0, B.y - sbH / 2 + 0.05, sbF + 0.022], c: trim }); // low trim line, full width
    b.add(rbox(sbW - 0.02, 0.1, 0.05, 0.015), fitMat, { p: [0, B.y + sbH * 0.22, sbF + 0.03] }); // lamp bar housing, full width
    b.add(box(sbW - 0.08, 0.05, 0.012), 'glowYellow', { p: [0, B.y + sbH * 0.22, sbF + 0.058] });
    // side glow vents along the boiler's lower flanks (seen from the chase camera)
    for (const sx of [-1, 1]) b.add(rbox(0.02, 0.035, bl * 0.55, 0.01), 'wGlowOrange', { p: [sx * (B.r * 0.86), B.y - B.r * 0.5, bzc - bl * 0.1] });
    // ash pan under the boiler
    b.add(rbox(0.36, 0.08, bl * 0.5, 0.02), 'wDark', { p: [0, B.y - B.r - 0.04, B.z0 + bl * 0.3], c: '#2a2826' });

    // ---- lamps: only the full-width lamp bar across the smokebox face (above); no separate lamps that could pair into eyes

    // ---- the plough (Mk II): three slanted bars, not a grid
    if (mk === 2) {
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
        const y = 0.12 + i * 0.12;
        b.add(rbox(0.5, 0.05, 0.04, 0.015), 'wIron', { p: [sx * 0.24, y, S.frame[1] + 0.2 - i * 0.07], r: [0, sx * 0.55, 0], c: '#3a3836' });
      }
      for (const sx of [-1, 1]) b.add(box(0.04, 0.4, 0.04), 'wIron', { p: [sx * 0.3, 0.3, S.frame[1] + 0.06], r: [0.3, 0, 0], c: '#3a3836' });
      b.add(box(0.02, 0.36, 0.06), 'wPaint', { p: [0, 0.27, S.frame[1] + 0.24], r: [0.25, 0, 0], c: trim });
    }

    // ---- springs over the axles
    const axles = [S.front, ...S.rear];
    for (const a of axles) for (const sx of [-1, 1]) {
      const x = sx * 0.36, y0 = a.r + 0.04;
      if (mk === 1) {
        // exposed coil spring from axle up to the frame rail
        const pts = []; const h = S.frameY - 0.05 - y0;
        for (let k = 0; k <= 40; k++) { const t = k / 40, ang = t * PI * 2 * 5; pts.push(V3(x + Math.cos(ang) * 0.045, y0 + t * h, a.z + Math.sin(ang) * 0.045)); }
        b.add(tube(pts, 0.011, 5, 80, { capEnd: false }), metalMat === 'wDark' ? 'wBrass' : metalMat, { c: metalC });
      } else {
        // leaf spring: three stacked arched leaves
        for (let k = 0; k < 3; k++) {
          const len = 0.56 - k * 0.14, pts = [];
          for (let q = 0; q <= 8; q++) { const t = q / 8 - 0.5; pts.push(V3(x, y0 + 0.06 + k * 0.022 - (0.25 - t * t) * 0.16, a.z + t * len)); }
          b.add(tube(pts, 0.011, 4, 12), 'wIron', { s: 1, c: '#4a4642' });
        }
      }
    }
  }));

  // ---- the rear fenders (in the body), swept forward along the flanks on Mk II / III
  for (const a of S.rear) {
    const f = part((b) => {
      for (const sx of [-1, 1]) {
        b.add(fenderGeo(a.r, a.w, mk >= 2 ? 0.12 : 0.3, PI - (mk >= 2 ? 0.12 : 0.3)), 'wPaint', { r: [0, PI / 2, 0], p: [sx * a.x, a.r, a.z], c: wood ? '#6e4426' : bodyCol });
        b.add(torus(a.r + 0.1, 0.012, 5, 30, PI - (mk >= 2 ? 0.24 : 0.6)), 'wPaint', { r: [0, PI / 2, mk >= 2 ? 0.12 : 0.3], p: [sx * (a.x + a.w / 2 + 0.062), a.r, a.z], c: trim });
      }
    });
    stat.add(f);
  }
  if (mk >= 2) {
    // running boards from the rear fender forward and down to the front axle line
    stat.add(part((b) => {
      const R0 = S.rear[0], F = S.front;
      for (const sx of [-1, 1]) {
        const z0 = R0.z + (R0.r + 0.08) * 0.99, y0 = R0.r + (R0.r + 0.08) * 0.12, z1 = F.z - F.r - 0.12, y1 = F.r + 0.08;
        const len = Math.hypot(z1 - z0, y1 - y0), ang = Math.atan2(y0 - y1, z1 - z0);
        b.add(rbox(0.2, 0.035, len + 0.04, 0.012), 'wPaint', { p: [sx * (R0.x - 0.02), (y0 + y1) / 2, (z0 + z1) / 2], r: [ang, 0, 0], c: wood ? '#6e4426' : bodyCol });
        b.add(box(0.008, 0.012, len), 'wPaint', { p: [sx * (R0.x + 0.082), (y0 + y1) / 2 + 0.008, (z0 + z1) / 2], r: [ang, 0, 0], c: trim });
      }
    }));
  }

  // ---------------------------------------------------------------- stacks, exhausts and the gauge
  const smokeAt = []; // body-space emitter points for the chuffs
  stat.add(part((b) => {
    const top = B.y + B.r;
    if (mk === 1) {
      // one tall straight square-section stack (a thin slot outlet, so from above it is a line, not a hole in a ring)
      const h = 0.82, z = B.z1 - 0.08;
      squareStack(b, 0, top - 0.04, z, h, 0.14, 0.14, 'wDark', '#3a3836', metalMat, metalC);
      smokeAt.push(V3(0, top + h, z));
    } else if (mk === 2) {
      // one wide, flat stack across the boiler (a single broad slot, not a pair of round stacks side by side)
      const h = 0.58, z = B.z1 + B.box * 0.4;
      squareStack(b, 0, top - 0.02, z, h, 0.42, 0.13, 'wDark', '#3a3836', metalMat, metalC);
      for (const sx of [-1, 1]) smokeAt.push(V3(sx * 0.12, top + h, z));
      // a flat-topped sand box between the boiler and the stacks (no domes)
      b.add(rbox(0.22, 0.14, 0.26, 0.03), metalMat, { p: [0, top + 0.05, (B.z0 + B.z1) / 2], c: metalC });
      b.add(rbox(0.26, 0.03, 0.3, 0.01), bandMat, { p: [0, top + 0.125, (B.z0 + B.z1) / 2] });
    } else {
      // two exhausts that leave the smokebox and sweep back along the top, ending in square-section stacks behind the rider
      for (const sx of [-1, 1]) {
        // they leave the smokebox low on its flanks and run back beside the shroud, never rising over the flat front
        // (rising from its top they stood up like a pair of horns over the lamp bar)
        const pts = [V3(sx * 0.2, B.y + B.r * 0.2, B.z1 + 0.04), V3(sx * 0.33, B.y + B.r * 0.35, B.z1 - 0.14), V3(sx * 0.38, B.y + B.r * 0.5, B.z0 + 0.1),
          V3(sx * 0.5, S.rail + 0.1, S.wellZ[1] - 0.2), V3(sx * 0.52, S.rail + 0.1, S.wellZ[0] + 0.1), V3(sx * 0.47, S.tender.top + 0.1, S.tender.z1 + 0.2), V3(sx * 0.45, S.tender.top + 0.18, S.tender.z1 - 0.08)];

        b.add(tube(pts, 0.05, 10, 60, { capEnd: false }), metalKey === 'bronze' ? 'wCopper' : metalMat, { c: metalC });
        // a square-section bronze stack sleeved over the end, pointing back and up, its outlet face a solid flat plate
        // (the round pipe end and the old round lip around a dark disc read as a pair of eyes from the rider's view)
        const end = pts[pts.length - 1], prev = pts[pts.length - 2], d = end.clone().sub(prev).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d);
        b.add(rbox(0.13, 0.2, 0.13, 0.015), 'wBronze', { q, p: [end.x + d.x * 0.02, end.y + d.y * 0.02, end.z + d.z * 0.02] });
        b.add(rbox(0.16, 0.04, 0.16, 0.01), 'wBronze', { q, p: [end.x + d.x * 0.1, end.y + d.y * 0.1, end.z + d.z * 0.1] });
        // one plain dark square collar where the pipe runs fore and aft beside the rider (no rings; no teal pair either side)
        { const P2 = pts[4]; b.add(rbox(0.13, 0.13, 0.04, 0.012), 'wIron', { p: [P2.x, P2.y, P2.z], c: '#3a3836' }); }
        smokeAt.push(end.clone().addScaledVector(d, 0.14));
      }
    }
  }));

  // the fire shows only in the flank vents and under the boiler: nothing lit sits centred on the front (a lit grille in
  // the middle of a round front read as a face). fireMat lights the ash-pan's lower lip; fireGlow is a flat plane under it.
  const fireMat = new THREE.MeshStandardMaterial({ color: 0xffb070, emissive: 0xff6a18, emissiveIntensity: 2.4, roughness: 0.4 });
  mats.push(fireMat);
  const panY = B.y - B.r - 0.085, panZ = B.z0 + (B.z1 - B.z0) * 0.3, panL = (B.z1 - B.z0) * 0.5;
  const panLip = new THREE.Mesh(box(0.3, 0.012, panL - 0.06), fireMat);
  panLip.position.set(0, panY, panZ); panLip.castShadow = false; body.add(panLip);
  const fireGlow = slotGlow(0xff8a30, 0.34, panL, 0.6, { rx: PI / 2 }); fireGlow.position.set(0, panY - 0.01, panZ); body.add(fireGlow);
  const panGlow = glowSprite(0xff7a20, 1.1, 0.35); panGlow.position.set(0, B.y - B.r - 0.12, B.z0 + (B.z1 - B.z0) * 0.3); body.add(panGlow);

  // the pressure gauge on top of the boiler, tilted back toward the rider and the chase camera
  const gauge = pivot(body, mk === 3 ? 0 : 0.0, B.y + B.r + 0.07, B.z0 + 0.1);
  gauge.rotation.x = -(PI - 0.85); // face up and back, toward the rider and the chase camera
  // a warm, softly lit dial on every mark (a bright teal one on Mk III sat between the two exhaust stacks from behind)
  const gaugeMat = new THREE.MeshStandardMaterial({ color: 0xf4ead0, emissive: 0xffd890, emissiveIntensity: 0.45, roughness: 0.5 });
  mats.push(gaugeMat);
  gauge.add(part((b) => {
    // a square dial in a square bezel (a round lit face in a ring read as a disc in a ring from above)
    b.add(rbox(0.17, 0.17, 0.03, 0.01), fitMat);
    for (const sy of [-1, 1]) { b.add(box(0.17, 0.022, 0.02), fitMat, { p: [0, sy * 0.074, 0.018] }); b.add(box(0.022, 0.17, 0.02), fitMat, { p: [sy * 0.074, 0, 0.018] }); }
  }));
  const face = new THREE.Mesh(box(0.13, 0.13, 0.012), gaugeMat);
  face.position.z = 0.018; gauge.add(face);
  const needle = pivot(gauge, 0, 0, 0.028);
  needle.add(part((b) => { b.add(box(0.008, 0.06, 0.006), 'wDark', { p: [0, 0.026, 0], c: '#1a1414' }); b.add(box(0.02, 0.02, 0.01), 'wDark', { c: '#1a1414' }); }));
  // (the old Mk III teal strip on the backhead sat between the two exhaust lips; it is gone)

  // lamp glow over the full-width lamp bar on the smokebox face (on in daylight at 30%, full at night)
  const lampGlows = [];
  {
    const sbW = B.r * 2 + 0.1, sbH = B.r * 2 + 0.06;
    const g = slotGlow(0xffd890, sbW - 0.06, 0.08, 0.5); g.position.set(0, B.y + sbH * 0.22, B.z1 + B.box + 0.07); body.add(g); lampGlows.push(g);
  }

  // ---- the steering tiller: a column rising in front of the rider with a bowed yoke (no wheel)
  const tiller = pivot(body, 0, S.floor, seatZ + 0.68);
  tiller.rotation.x = -0.14; // raked back toward the rider
  const grip = { y: hipY + 0.16 - S.floor, x: 0.3 };

  tiller.add(part((b) => {
    b.add(cyl(0.028, 0.034, grip.y, 10), 'wIron', { p: [0, grip.y / 2, 0], c: '#3a3836' });
    b.add(cyl(0.05, 0.06, 0.06, 12), fitMat, { p: [0, 0.03, 0] });
    b.add(cyl(0.04, 0.04, 0.05, 12), fitMat, { p: [0, grip.y - 0.02, 0] });
    const pts = [V3(-grip.x, grip.y - 0.02, -0.1), V3(-grip.x * 0.7, grip.y - 0.01, -0.01), V3(0, grip.y, 0.03), V3(grip.x * 0.7, grip.y - 0.01, -0.01), V3(grip.x, grip.y - 0.02, -0.1)];
    b.add(tube(pts, 0.018, 8, 24, { capEnd: true, capStart: true }), 'wIron', { c: '#4a4642' });
    for (const sx of [-1, 1]) b.add(cyl(0.026, 0.026, 0.11, 10), 'wIron', { r: [0, 0, PI / 2], p: [sx * (grip.x - 0.02), grip.y - 0.02, -0.09], c: '#3a2014' });
  }));
  tiller.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  // steering linkage: a drag rod from the column foot forward under the boiler
  stat.add(part((b) => { b.add(cyl(0.018, 0.018, S.front.z - seatZ - 0.68, 8), 'wIron', { r: [PI / 2, 0, 0], p: [0.08, S.frameY - 0.08, (S.front.z + seatZ + 0.68) / 2], c: '#3a3836' }); }));
  // fold the static body into one mesh per material; only the big panels and metal cast shadows (not trim, rivets or glow)
  body.add(mergeGroup(stat, new Set([bodyMat, metalMat, 'wBronze', 'wIron', 'wDark', 'wWood', 'wLeather', 'wCloth'])));

  // ---------------------------------------------------------------- wheels, each axle on its own pivot
  const axleGroups = [];
  const blurMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(mix(bodyCol, trim, 0.35)), transparent: true, opacity: 0, depthWrite: false, roughness: 0.6, side: THREE.DoubleSide });
  mats.push(blurMat);
  const blurs = [];
  // wheels: only the tyre and the painted face throw shadows (rims and trim stripes add draw calls, not shape)
  const wheelShadows = (g) => { for (const m of g.children) m.castShadow = m.material.name === 'wLeather' || m.material.name === bodyMat; return g; };
  const mkAxle = (a, steer) => {
    const ax = pivot(root, 0, a.r, a.z);
    // the axle bar
    const axleBar = (b, sx) => b.add(cyl(0.035, 0.035, a.x - 0.3, 10), 'wLeather', { r: [0, 0, PI / 2], p: [sx * (a.x + 0.3) / 2, 0, 0], c: '#3a3632' });
    // anti-strobe: soft discs that fade in over the faces at speed (one merged mesh per pivot)
    const rings = (xs) => {
      const gs = xs.map((x) => { const g = new THREE.RingGeometry(a.r * 0.3, a.r * 0.8, 20); g.rotateY(Math.sign(x) * PI / 2); g.translate(x, 0, 0); return g; });
      const m = new THREE.Mesh(mergeGeometries(gs, false), blurMat); for (const g of gs) g.dispose();
      m.renderOrder = 2; m.castShadow = false; m.receiveShadow = false; blurs.push(m); return m;
    };
    const phaseOf = (sx) => (sx > 0 ? 0 : PI / 2); // left and right cranks quartered, as on a real engine
    const wheels = [];
    if (!steer) {
      // a fixed axle: both wheels and the bar turn together, so they are one spinning part
      const b = new Builder(11);
      for (const sx of [-1, 1]) { b.addBuilder(wheelB(a.r, a.w, { ...P, trim }, phaseOf(sx), bodyMat, bodyCol, metalMat, metalC), { p: [sx * a.x, 0, 0] }); axleBar(b, sx); }
      const spin = wheelShadows(b.build());
      ax.add(spin);
      ax.add(rings([-1, 1].flatMap((sx) => [sx * a.x - (a.w / 2 + 0.03), sx * a.x + (a.w / 2 + 0.03)])));
      wheels.push({ st: ax, spin, sx: 0, phase: 0 });
    } else {
      ax.add(part((b) => { for (const sx of [-1, 1]) axleBar(b, sx); }));
      for (const sx of [-1, 1]) {
        const st = pivot(ax, sx * a.x, 0, 0);
        const spin = wheelShadows(wheelB(a.r, a.w, { ...P, trim }, phaseOf(sx), bodyMat, bodyCol, metalMat, metalC).build());
        st.add(spin);
        st.add(rings([-(a.w / 2 + 0.03), a.w / 2 + 0.03]));
        // cycle fenders turn with the front wheels
        st.add(part((b) => {
          b.add(fenderGeo(a.r, a.w, 0.35, PI - 0.15), 'wPaint', { r: [0, PI / 2, 0], c: wood ? '#6e4426' : bodyCol });
          b.add(torus(a.r + 0.1, 0.012, 5, 30, PI - 0.5), 'wPaint', { r: [0, PI / 2, 0.35], p: [sx * (a.w / 2 + 0.062), 0, 0], c: trim });
          b.add(box(0.03, 0.03, 0.03), 'wPaint', { p: [-sx * (a.w / 2 + 0.04), 0, 0], c: '#3a3836' });
        }));
        wheels.push({ st, spin, sx, phase: phaseOf(sx) });
      }
    }
    const A = { ax, a, steer, wheels, y0: a.r, off: 0 };
    axleGroups.push(A);
    return A;
  };
  const front = mkAxle(S.front, true);
  const rears = S.rear.map((a) => mkAxle(a, false));
  const driver = rears[0];

  // ---------------------------------------------------------------- working side rods (root space, unsprung)
  const rods = [];
  const rodPart = (len, rr, mat, c) => { const g = new THREE.Group(); g.add(part((b) => b.add(rbox(rr * 2.2, rr * 2, len, rr * 0.8), mat, { p: [0, 0, len / 2], c }))); return g; };
  const L = S.rod.L, rho = driver.a.r * 0.55;
  const cylB = new Builder(5); // both cylinders and slide bars in one part
  for (const sx of [-1, 1]) {
    const x = sx * (driver.a.x + driver.a.w / 2 + 0.065);
    const yc = driver.a.r;
    const cyl0 = driver.a.z + L + rho + 0.06, cylLen = S.rod.cyl;
    // fixed: cylinder and slide bar
    ((b) => {
      b.add(cyl(0.085, 0.085, cylLen, 20), fitMat, { r: [PI / 2, 0, 0], p: [x, yc, cyl0 + cylLen / 2] });
      for (const z of [cyl0 + 0.02, cyl0 + cylLen - 0.02]) b.add(torus(0.088, 0.014, 6, 20), 'wDark', { p: [x, yc, z], c: '#3a3836' });
      b.add(cyl(0.04, 0.04, 0.05, 10), 'wDark', { p: [x, yc + 0.1, cyl0 + cylLen / 2], c: '#3a3836' }); // steam valve (the jet comes from here)
      const sb0 = driver.a.z + L - rho - 0.08;
      b.add(box(0.03, 0.022, cyl0 - sb0), 'wIron', { p: [x, yc + 0.055, (cyl0 + sb0) / 2], c: '#6a6660' });
      b.add(box(0.03, 0.04, 0.04), 'wIron', { p: [x, yc + 0.03, sb0], c: '#4a4642' });
      b.add(box(Math.abs(x) - 0.36, 0.04, 0.04), 'wIron', { p: [sx * (0.36 + (Math.abs(x) - 0.36) / 2), yc + 0.05, sb0], c: '#4a4642' }); // bracket to the frame
      b.add(box(Math.abs(x) - 0.36, 0.04, 0.04), 'wIron', { p: [sx * (0.36 + (Math.abs(x) - 0.36) / 2), yc + 0.05, cyl0 + 0.05], c: '#4a4642' });
    })(cylB);
    const main = rodPart(1, 0.022, fitMat === 'wGold' ? 'wGold' : 'wSteel', 0xffffff);
    const piston = rodPart(1, 0.014, 'wSteel', 0xffffff);
    const head = new THREE.Group(); head.add(part((b) => b.add(rbox(0.06, 0.07, 0.1, 0.012), fitMat, {})));
    root.add(main, piston, head);
    const coupling = rears.length > 1 ? rodPart(1, 0.02, fitMat === 'wGold' ? 'wGold' : 'wSteel', 0xffffff) : null;
    if (coupling) root.add(coupling);
    rods.push({ sx, x, yc, cyl0, cylLen, main, piston, head, coupling, phase: sx > 0 ? 0 : PI / 2 });
  }
  root.add(cylB.build({ shadow: false }));
  const moving = rods.flatMap((R) => [R.main, R.piston, R.head, R.coupling].filter(Boolean));
  for (const g of moving) g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  const valveAt = rods.map((r) => V3(r.x + Math.sign(r.x) * 0.04, r.yc + 0.12, r.cyl0 + r.cylLen / 2));

  // ---------------------------------------------------------------- smoke and steam (world space, so it trails behind)
  // one Points cloud per cart with a material shared by every cart: a single draw call for all its puffs
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
  const emit = (local, from, vel, { life, size0, size1, op, color }) => {
    const p = pool.find((q) => q.age >= q.life);
    if (!p) return;
    p.age = 0; p.life = life; p.size0 = size0; p.size1 = size1; p.op = op;
    p.w.copy(local).applyMatrix4(from.matrixWorld);
    p.v.copy(vel);
    p.col.set(color); p.ang = Math.random() * 6; p.rot = (Math.random() - 0.5) * 1.2;
    live++;
  };
  let live = 0;


  // ---------------------------------------------------------------- per-frame drive
  let dist = 0, t = Math.random() * 10, steer = 0, run = 0, lastSpeed = 0, accel = 0, pitchKick = 0, chuffPhase = 0, steamT = 0, idleT = 0, skirtT = 0;
  const state = { steer: 0, run: 0, accel: 0 };
  const phases = [0, 1.3, 2.1, 3.7];
  root.userData.seat = new THREE.Vector3(ST[0], ST[1], ST[2]);
  root.userData.body = body;
  root.userData.state = state;
  root.userData.mk = mk;
  // free this cart's materials, its glow sprites' materials and every geometry it built (sprites share three's own quad)
  root.userData.dispose = () => {
    for (const m of mats) m.dispose();
    root.traverse((o) => { if (o.isSprite) o.material.dispose(); else if (o.isMesh || o.isPoints) o.geometry.dispose(); });
  };
  // distance LOD: past ~25 m from the local player no smoke, side rods or blur discs (hysteresis so it never flickers)
  let far = false;
  const setFar = (f) => { far = f; for (const g of moving) g.visible = !f; for (const m of blurs) m.visible = !f; if (f) { for (const p of pool) p.age = p.life; live = 0; puffs.visible = false; } };
  root.userData.update = (dt, speed = 0, turn = 0, lodDist = 0) => {
    dt = Math.min(dt, 0.1);
    t += dt;
    dist += speed * dt;
    run = Math.min(1, Math.abs(speed) / 9);
    const a = (speed - lastSpeed) / Math.max(dt, 1e-3); lastSpeed = speed;
    accel += (Math.max(-6, Math.min(6, a)) - accel) * (1 - Math.exp(-dt * 5));
    if (accel > 1.5) pitchKick = Math.min(1, pitchKick + dt * 4); else pitchKick = Math.max(0, pitchKick - dt * 3.3);
    steer += (Math.max(-0.45, Math.min(0.45, turn * 0.22)) - steer) * (1 - Math.exp(-dt * 6));
    const sn = steer / 0.45;
    state.steer = sn; state.run = run; state.accel = accel;

    // wheels spin by distance; front pair steers
    for (const A of axleGroups) {
      const ang = dist / A.a.r;
      for (const W of A.wheels) { W.spin.rotation.x = ang; if (A.steer) W.st.rotation.y = steer; }
    }
    tiller.rotation.y = steer * 0.45;
    // suspension: each axle bobs on its own phase, the body rides their average
    let sum = 0;
    axleGroups.forEach((A, i) => { A.off = 0.022 * Math.sin(t * 11 + phases[i % 4]) * run + 0.004 * Math.sin(t * 3 + i); A.ax.position.y = A.y0 + A.off; sum += A.off; });
    const avg = sum / axleGroups.length;
    const wb = S.front.z - S.rear[S.rear.length - 1].z;
    const rearOff = rears.reduce((s, A) => s + A.off, 0) / rears.length;
    body.position.y = avg + 0.006 * Math.sin(t * 2.2) * (1 - run); // idle shiver from the boiler
    body.rotation.z = -sn * 0.12 * run + Math.sin(t * 9) * 0.004 * run;
    body.rotation.x = -((front.off - rearOff) / wb) * 3 - 0.04 * pitchKick + Math.sin(t * 7.3) * 0.004 * run;

    // side rods: crank pin on the driver, crosshead sliding in its guide, piston into the cylinder
    const dAng = dist / driver.a.r;
    if (!far && lodDist > 27) setFar(true); else if (far && lodDist < 23) setFar(false);
    if (!far) for (const R of rods) {
      const th = dAng + R.phase;
      const py = driver.ax.position.y + Math.cos(th) * rho, pz = driver.a.z + Math.sin(th) * rho;
      const yc = R.yc + driver.off;
      const dy = py - yc, cz = pz + Math.sqrt(Math.max(0.01, L * L - dy * dy));
      R.main.position.set(R.x, py, pz);
      R.main.scale.set(1, 1, Math.hypot(cz - pz, yc - py));
      R.main.rotation.set(-Math.atan2(yc - py, cz - pz), 0, 0);
      R.head.position.set(R.x, yc, cz);
      R.piston.position.set(R.x, yc, cz);
      R.piston.scale.set(1, 1, Math.max(0.05, R.cyl0 + 0.06 - cz));
      if (R.coupling) {
        const r2 = rears[1];
        R.coupling.position.set(R.x - Math.sign(R.x) * 0.03, driver.ax.position.y + Math.cos(th) * rho, pz);
        R.coupling.rotation.set(Math.atan2(r2.ax.position.y - driver.ax.position.y, Math.abs(r2.a.z - driver.a.z)), PI, 0);
        R.coupling.scale.set(1, 1, Math.abs(r2.a.z - driver.a.z));
      }
    }

    // the fire: pulses, burns brighter as the engine works
    const nightK = G.night?.value ?? 0;
    fireMat.emissiveIntensity = 2.2 + 0.8 * Math.sin(t * 3) + 1.2 * run + 0.4 * Math.sin(t * 11.3) * run;
    fireGlow.material.opacity = (0.55 + 0.15 * Math.sin(t * 3) + 0.3 * run) * (1 + 0.6 * nightK);
    panGlow.material.opacity = (0.25 + 0.2 * run) * (1 + nightK);
    for (const g of lampGlows) g.material.opacity = 0.3 + 0.7 * nightK;
    // pressure needle tracks the work
    needle.rotation.z = 1.1 - run * 2.0 - Math.max(0, accel) * 0.05 + Math.sin(t * 13) * 0.03 * run;
    // wheel blur fades in at speed so the faces never strobe
    blurMat.opacity = Math.max(0, Math.min(0.55, (Math.abs(speed) / driver.a.r - 16) / 40));

    // smoke and steam
    if (dt > 0 && root.parent && !far) {
      root.updateWorldMatrix(true, true);
      const hard = Math.max(0, accel) / 6;
      const smokeCol = SMOKE_TMP.copy(SMOKE_LIGHT).lerp(SMOKE_DARK, Math.min(1, hard * 1.4));
      // chuff: two bursts per turn of the drivers
      const cp = dAng / PI;
      if (speed > 0.3 && Math.floor(cp) !== Math.floor(chuffPhase)) {
        for (const at of smokeAt) for (let k = 0; k < (speed > 6 ? 1 : 2); k++) emit(at, body, V3((Math.random() - 0.5) * 0.4, 1.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4), { life: 1.4, size0: 0.45, size1: 1.8, op: 0.42, color: smokeCol });
      }
      chuffPhase = cp;
      // idle wisps from the stacks
      idleT -= dt;
      if (idleT <= 0) { idleT = speed > 0.3 ? 0.35 : 0.5; for (const at of smokeAt) emit(at, body, V3(0, 0.9, 0), { life: 1.8, size0: 0.25, size1: 1.0, op: 0.28, color: 0xb0aaa2 }); }
      // steam jet from the cylinder valves while moving
      steamT -= dt;
      if (speed > 0.5 && steamT <= 0) {
        steamT = 0.09;
        for (const [i, at] of valveAt.entries()) emit(at, root, V3(Math.sign(rods[i].x) * (1.4 + Math.random()), 0.6, 0), { life: 0.32, size0: 0.08, size1: 0.42, op: 0.32, color: 0xf6f6f2 });
      }
      // Mk III: a pressure-vented steam skirt puffing at ground level
      if (mk === 3) {
        skirtT -= dt;
        if (skirtT <= 0) {
          skirtT = speed > 0.5 ? 0.16 : 0.6;
          for (const sx of [-1, 1]) emit(V3(sx * 0.5, 0.12, -0.75 + (Math.random() - 0.5) * 0.6), root, V3(sx * (0.8 + Math.random() * 0.5), 0.15, 0), { life: 0.6, size0: 0.22, size1: 0.75, op: 0.22, color: 0xeef2f0 }
);
        }
      }
      // integrate in world space, then draw relative to the cart
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
