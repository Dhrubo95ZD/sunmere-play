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
import { patchWorld, freshMat, cutDepthMaterial } from '../../engine/materials.js';
import { IS_MOBILE } from '../../engine/platform.js';
import { texTint } from './parts.js';

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
  m.name = 'cgt_' + name;
  return m;
}
function load(name) {
  if (!HAS_DOM) return Promise.resolve(null);
  const url = new URL(`../models/houses/${name}.glb`, import.meta.url).href;
  return tripoLoader().loadAsync(url).then((gltf) => {
    const parts = [], mats = new Map();
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!mats.has(src)) mats.set(src, makeMat(name, src));
      let n = o; while (n.parent && n.parent !== gltf.scene) n = n.parent; // the mesh's top node: roof / upper / walls
      parts.push({ geo, mat: mats.get(src), kind: /^roof/.test(n.name) ? 'roof' : /^upper/.test(n.name) ? 'upper' : 'walls' });
    });
    return { parts };
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
