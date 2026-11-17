// CGTrader house shells (v109): free Royalty Free house models (tools/cgtrader/SOURCES.md, credits in
// client/assets/tex/CREDITS.txt) stand in for the built walls, roofs, windows and chimneys of the houses whose site
// carries a `shell` (shared/houses.js CGT_SHELLS). tools/cgtrader/finalize.py made them game-ready: door to the front,
// centred on the wall box, floor at y = 0, door holes in the enterable ones, meshes roof / upper / walls.
//   cgtEnabled()                 false with ?nocgt=1 or ?notripo=1 in the URL (the built houses everywhere)
//   preloadShells(names)         start loading (once)
//   shellGroup(specs) -> Promise<THREE.Group | null>
//       every shelled house of a settlement group, one InstancedMesh per model part (a model used by three houses is
//       one draw per part, not three), in WORLD coordinates. The materials are the game's own: MeshStandardMaterial,
//       rough and not metallic, with the world patches (fade circle round the hero, the house cut-away, cloud shadows),
//       so the cut-away takes the walls down to the wainscot and the roofs and upper floors away like any built house;
//       their shadows go through the cut-aware depth material. A part painted "cgt_<material>__<tint>" in Blender is
//       the game's own material of that name (the farmhouse's thatch, the desert house's dark wood shutters).
import * as THREE from 'three';
import { tripoLoader } from '../tripoModels.js';
import { patchWorld, freshMat, cutDepthMaterial, patchWallDetail } from '../../engine/materials.js';
import { IS_MOBILE } from '../../engine/platform.js';
import { texTint } from './parts.js';
import { G } from '../../engine/globals.js';
import { paneOf, movePane } from '../kit.js';

const HAS_DOM = typeof window !== 'undefined' && typeof document !== 'undefined';
let enabled = HAS_DOM && !/[?&](nocgt|notripo)=1/.test(window.location?.search || '');
export function cgtEnabled() { return enabled; }
export function setCgtEnabled(on) { enabled = !!on; }

// a grade per model so the bought textures sit with the painted ones: c multiplies the texture colour, sat pulls it
// toward its own brightness (1 = as painted; the straw and the red tiles were hotter than the game's thatch and tiles)
const GRADE = {
  thatched_cottage: { c: 0xe4dccf, sat: 0.62 }, thatched_farm: { c: 0xe4dccf, sat: 0.62 },
  red_cottage: { c: 0xe6ddd6, sat: 0.55 }, red_cottage_bg: { c: 0xe6ddd6, sat: 0.55 },
  wooden_shed: { c: 0xf4efe8, sat: 0.85 }, farmhouse: { c: 0xf4f0ea, sat: 0.85 },
  desert_house: { c: 0xf2ece4, sat: 0.85 }, egypt_house_002: { c: 0xf4eee6, sat: 0.85 }, egypt_house_005: { c: 0xf4eee6, sat: 0.85 }, egypt_house_007: { c: 0xf4eee6, sat: 0.85 },
  egypt_house_001: { c: 0xf4eee6, sat: 0.85 }, egypt_house_003: { c: 0xf4eee6, sat: 0.85 }, egypt_house_004: { c: 0xf4eee6, sat: 0.85 }, egypt_house_006: { c: 0xf4eee6, sat: 0.85 }, egypt_house_008: { c: 0xf4eee6, sat: 0.85 }, egypt_house_009: { c: 0xf4eee6, sat: 0.85 },
};

// (LF.1) models whose window glass is a dark cell of their palette atlas: [u0, v0, u1, v1] of that cell. By night those
// texels light up warm with the built houses' glass (G.winLit), and each pane gets the window glow on the wall (world.js)
// The thatched houses' windows are closed plank shutters (the same flat board as their door and timbers): no lit texels,
// only the glow round them on the wall, for the pieces of shutter size standing clear of the ground (shut: true)
const SHUT = [0.28, 0.38, 0.61, 0.77, 'shut'];
const WIN = { red_cottage: [0.667, 0.667, 1, 1], red_cottage_bg: [0.667, 0.667, 1, 1], thatched_cottage: SHUT, thatched_farm: SHUT };
function winGlow(m, R) {
  const pre = m.onBeforeCompile, key0 = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    pre(sh, r);
    sh.uniforms.uWinLit = G.winLit;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWinLit;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  #ifdef USE_MAP
  { float wl = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float wk = uWinLit * (1.0 - smoothstep(0.006, 0.03, wl)) * step(${R[0].toFixed(3)}, vMapUv.x) * step(${R[1].toFixed(3)}, vMapUv.y) * step(vMapUv.x, ${R[2].toFixed(3)}) * step(vMapUv.y, ${R[3].toFixed(3)});
    totalEmissiveRadiance += vec3(1.0, 0.62, 0.24) * 0.95 * wk; }
  #endif`);
  };
  m.customProgramCacheKey = () => key0() + 'W';
}
// the panes of that cell: its vertical triangles, joined where they share corners, one pane per joined piece
function winPanes(geo, R) {
  const p = geo.attributes.position, uv = geo.attributes.uv, idx = geo.index, nT = (idx ? idx.count : p.count) / 3;
  if (!uv) return [];
  const vi = (k) => (idx ? idx.getX(k) : k), key = (i) => `${Math.round(p.getX(i) * 50)},${Math.round(p.getY(i) * 50)},${Math.round(p.getZ(i) * 50)}`;
  const par = new Map(), find = (a) => { while (par.get(a) !== a) { par.set(a, par.get(par.get(a))); a = par.get(a); } return a; };
  const tris = [];
  for (let t = 0; t < nT; t++) {
    const a = vi(t * 3), b = vi(t * 3 + 1), c = vi(t * 3 + 2);
    const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3, v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
    if (u < R[0] || v < R[1] || u > R[2] || v > R[3]) continue;
    const ks = [key(a), key(b), key(c)];
    for (const k of ks) if (!par.has(k)) par.set(k, k);
    par.set(find(ks[1]), find(ks[0])); par.set(find(ks[2]), find(ks[0]));
    tris.push([a, b, c, ks[0]]);
  }
  const groups = new Map();
  for (const T of tris) { const r = find(T[3]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(T); }
  const out = [];
  for (const list of groups.values()) {
    const arr = new Float32Array(list.length * 9);
    list.forEach((T, j) => { for (let q = 0; q < 3; q++) { arr[j * 9 + q * 3] = p.getX(T[q]); arr[j * 9 + q * 3 + 1] = p.getY(T[q]); arr[j * 9 + q * 3 + 2] = p.getZ(T[q]); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pn = paneOf(g);
    if (pn && R[4] === 'shut' && !(pn.w > 0.15 && pn.w < 0.7 && pn.h > 0.3 && pn.h < 0.75 && pn.c[1] - pn.h > 0.5)) continue;
    if (pn) out.push(R[4] === 'shut' ? { ...pn, shut: true } : pn);
  }
  if (R[4] !== 'shut') return out;
  // a shutter is two leaves, each with a face and a back: one glow per window, over the leaves' whole width
  const win = [];
  for (const pn of out) {
    const t = -pn.c[0] * pn.n[1] + pn.c[2] * pn.n[0];
    const W = win.find((q) => Math.hypot(q.c[0] - pn.c[0], q.c[1] - pn.c[1], q.c[2] - pn.c[2]) < 0.9 && q.n[0] * pn.n[0] + q.n[1] * pn.n[1] > 0.9);
    if (!W) { win.push({ ...pn, t0: t - pn.w, t1: t + pn.w, k: 1 }); continue; }
    W.t0 = Math.min(W.t0, t - pn.w); W.t1 = Math.max(W.t1, t + pn.w); W.h = Math.max(W.h, pn.h);
    for (let i = 0; i < 3; i++) W.c[i] = (W.c[i] * W.k + pn.c[i]) / (W.k + 1);
    W.k++;
  }
  return win.map((W) => { const tm = (W.t0 + W.t1) / 2, tc = -W.c[0] * W.n[1] + W.c[2] * W.n[0], d = tm - tc;
    return { c: [W.c[0] - W.n[1] * d, W.c[1], W.c[2] + W.n[0] * d], n: W.n, w: (W.t1 - W.t0) / 2, h: W.h, shut: true }; });
}

const loads = new Map(); // name -> Promise<{ parts: [{ geo, mat, kind }] } | null>
function makeMat(name, src) {
  const g = /^cgt_([A-Za-z]+)(?:__([0-9a-f]{6}))?/.exec(src.name || '');
  if (g) { // the game's own material (a fresh copy: no vertex colours on a model; the tint goes on the colour)
    const m = freshMat(g[1]);
    if (m) {
      m.vertexColors = false;
      const t = texTint(g[1], '#' + (g[2] || 'ffffff'));
      if (Array.isArray(t)) m.color.setRGB(t[0], t[1], t[2]); else m.color.set(t);
      m.side = THREE.DoubleSide; m.name = 'cgt_' + name + '_' + g[1]; m.needsUpdate = true;
      return m;
    }
  }
  const m = new THREE.MeshStandardMaterial({
    map: src.map || null, normalMap: src.normalMap || null, color: GRADE[name]?.c ?? 0xffffff,
    roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
  });
  if (m.map) m.map.anisotropy = IS_MOBILE ? 4 : 8;
  if (m.normalMap) m.normalScale.copy(src.normalScale || new THREE.Vector2(1, -1)).multiplyScalar(0.7);
  patchWorld(m, { fade: true, cut: true, cloud: true });
  patchWallDetail(m); // (LF.2) plaster grain and roughness on the walls (desktop presets only)
  const sat = GRADE[name]?.sat ?? 1;
  if (sat !== 1) {
    const pre = m.onBeforeCompile, key0 = m.customProgramCacheKey;
    m.onBeforeCompile = (sh, r) => {
      pre(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, ${sat.toFixed(3)});`);
    };
    m.customProgramCacheKey = () => key0() + 'S' + sat;
  }
  if (WIN[name] && WIN[name][4] !== 'shut') winGlow(m, WIN[name]);
  m.name = 'cgt_' + name;
  return m;
}
function load(name) {
  if (!HAS_DOM) return Promise.resolve(null);
  const url = new URL(`../models/houses/${name}.glb`, import.meta.url).href;
  return tripoLoader().loadAsync(url).then((gltf) => {
    const parts = [], mats = new Map(), panes = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!mats.has(src)) mats.set(src, makeMat(name, src));
      if (WIN[name] && src.map) for (const pn of winPanes(geo, WIN[name])) panes.push(pn);
      let n = o; while (n.parent && n.parent !== gltf.scene) n = n.parent; // the mesh's top node: roof / upper / walls
      parts.push({ geo, mat: mats.get(src), kind: /^roof/.test(n.name) ? 'roof' : /^upper/.test(n.name) ? 'upper' : 'walls' });
    });
    return { parts, panes };
  }).catch((e) => { console.warn(`[cgt] ${name}.glb did not load: ${e?.message || e}`); return null; });
}
function need(name) { if (!loads.has(name)) loads.set(name, load(name)); return loads.get(name); }
export function preloadShells(names) { if (enabled) for (const n of names) need(n); }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0);
export function shellGroup(specs) {
  const by = new Map();
  for (const S of specs) if (S.shell) { if (!by.has(S.shell)) by.set(S.shell, []); by.get(S.shell).push(S); }
  if (!enabled || !by.size) return Promise.resolve(null);
  return Promise.all([...by.keys()].map(need)).then((models) => {
    const out = new THREE.Group();
    out.name = 'cgtShells';
    [...by.entries()].forEach(([name, list], i) => {
      const M = models[i];
      if (!M) return;
      // (LF.1) their lit panes, placed with each house (world.js lays the window glow on the wall round them)
      for (const S of list) { _m.compose(_p.set(S.x, S.floorY, S.z), _q.setFromAxisAngle(_y, S.rot), _s); for (const pn of M.panes || []) (out.userData.panes ||= []).push(movePane(pn, _m)); }
      for (const P of M.parts) {
        const mesh = new THREE.InstancedMesh(P.geo, P.mat, list.length);
        list.forEach((S, k) => mesh.setMatrixAt(k, _m.compose(_p.set(S.x, S.floorY, S.z), _q.setFromAxisAngle(_y, S.rot), _s)));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingBox(); mesh.computeBoundingSphere();
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.customDepthMaterial = cutDepthMaterial(); // (the cut takes the hidden roof's shadow too)
        mesh.name = `cgt_${name}_${P.kind}`;
        mesh.userData.cgt = name; mesh.userData.kind = P.kind;
        out.add(mesh);
      }
    });
    return out;
  });
}
