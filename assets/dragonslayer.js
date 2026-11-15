// The Dragonslayer set (shared/data.js DRAGONSLAYER): nine Tripo models, cut down and split into moving parts in Blender
// (tools/tripo/ds/ds_build.py; parts and steam vents in ./dragonslayerParts.js). Each comes as a holder that shows the
// built weapon or shield (the fallback) until its GLB is in, then the GLB, scaled and placed like the built one
// (weapons: +Y along the blade, the grip centre at the origin; shields: face +Z, centred on the forearm).
//   - phones load <name>_lo.glb (about 5k triangles, 512 textures); the phone build ships only those (mobile/build.mjs)
//   - the parts named seam_* are the heated core: their red texels glow faintly (a slow pulse of red-hot steel, never a
//     magic glow); seam_fill* are plain red-hot core boxes hidden inside the shell, seen only when the plates part
//   - out of combat everything rests; in combat (the animator's combat blend) the parts move to their battle offsets
//     (plates slide out, blades part, pistons run out, lantern panels ease open a little), and every attack vents white
//     steam from the model's vents (FX 'steam'). All per-frame transforms on a handful of nodes, driven from
//     client/game/entities.js only for characters whose animator runs (the same distance gating as the rig).
import * as THREE from 'three';
import { tripoLoader, tripoEnabled } from './tripoModels.js';
import { patchWorld } from '../engine/materials.js';
import { IS_MOBILE } from '../engine/platform.js';
import { G } from '../engine/globals.js';
import { DS_PARTS } from './dragonslayerParts.js';
import { heatObject } from './heat.js';

// how each model sits: len = its height in metres in the hand (weapons) or [w, h, depth squash] (shields), grip = the
// height of the grip centre in the GLB's own units (0 at its foot), z = a shield's push off the forearm
const FIT = {
  ds_knight_sword: { len: 1.45, grip: 0.13 },
  ds_ranger_bow: { len: 1.45, grip: 0.51 },
  ds_chemist_rod: { len: 1.3, grip: 0.2 },
  ds_sandblade_scimitar: { len: 1.22, grip: 0.12 },
  ds_warden_hammer: { len: 1.35, grip: 0.3 },
  ds_herbalist_staff: { len: 1.9, grip: 0.3 },
  ds_knight_shield: { len: 0.8, grip: 0.53, depth: 1, z: 0.04 },
  ds_warden_shield: { len: 1.0, grip: 0.5, depth: 0.6, z: 0.08 },
  ds_sandblade_buckler: { len: 0.56, grip: 0.49, depth: 0.7, z: 0.05 },
  // the Deadeye's pistols (v107): the GLB lies barrel along +x, up +y; in the fist it sits like the built pistol
  // (weapons.js pistol: +Y up the grip, the barrel along +Z, the grip centre at the origin). pistol: len = its overall
  // length in metres, grip = [x, y] of the grip centre and muzzle = [x, y] of the muzzle in the GLB's units. The Sidearm
  // is the same model (file), mirrored, a little smaller and its enamel darker
  ds_deadeye_pistol: { pistol: true, len: 0.4, grip: [-0.35, 0.15], muzzle: [0.49, 0.36] },
  ds_deadeye_pistol_l: { pistol: true, file: 'ds_deadeye_pistol', len: 0.34, grip: [-0.35, 0.15], muzzle: [0.49, 0.36], mirror: true, tint: 0.72 },
};
export const DS_MODELS = Object.keys(FIT);
const fileOf = (name) => FIT[name]?.file || name; // the GLB a model loads (the Sidearm borrows the Hand Cannon's)
export const isDsModel = (m) => !!FIT[m];
const MOVE = 1.25; // battle offsets a little larger than authored, so they read at play distance

// the heat: one shared value for every seam material, a slow uneven pulse
const HEAT = { value: 0.35 };
const store = new Map(); // name -> { nodes: [{ name, geo, src, p, q, s }] }
const waits = new Map();
let seamMat = null, fillMat = null;
const mats = new Map(); // src material (+ tint) -> [plain, seam]

function material(src, seam, tint = 1) {
  const mk = tint === 1 ? src : `${src.uuid}|${tint}`;
  let pair = mats.get(mk);
  if (!pair) {
    const make = (glow) => {
      const m = new THREE.MeshStandardMaterial({ map: src.map || null, normalMap: src.normalMap || null, roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide });
      if (tint !== 1) m.color.setScalar(tint); // the Sidearm's darker enamel
      if (m.normalMap) m.normalScale.copy(src.normalScale || new THREE.Vector2(1, -1)).multiplyScalar(0.9);
      patchWorld(m, { cloud: true });
      if (glow) {
        // red-hot seams: only the crimson texels of the core parts, a faint physical glow (no bloom-bright magic)
        const pre = m.onBeforeCompile;
        m.onBeforeCompile = (sh, r) => {
          pre(sh, r);
          sh.uniforms.uDsHeat = HEAT;
          sh.fragmentShader = 'uniform float uDsHeat;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += uDsHeat * smoothstep(0.16, 0.42, diffuseColor.r - max(diffuseColor.g, diffuseColor.b)) * vec3(0.9, 0.16, 0.04);`);
        };
        m.customProgramCacheKey = () => 'dsSeam';
      }
      m.name = glow ? 'ds_seam' : 'ds_plate';
      if (!glow) m.userData.heatable = true; // the plates take the upgrade heat and the Prismatic sheen (heat.js)
      return m;
    };
    pair = [make(false), make(true)];
    mats.set(mk, pair);
  }
  return pair[seam ? 1 : 0];
}
function coreMat() {
  if (!fillMat) {
    fillMat = new THREE.MeshStandardMaterial({ color: 0x3a0a05, emissive: 0xff3a12, emissiveIntensity: 0.6, roughness: 0.7, metalness: 0.2 });
    patchWorld(fillMat, { cloud: true });
    fillMat.name = 'ds_core';
  }
  return fillMat;
}

function load(name) {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const url = new URL(`./models/${name}${IS_MOBILE ? '_lo' : ''}.glb`, import.meta.url).href;
  return tripoLoader().loadAsync(url).then((gltf) => {
    const nodes = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      // each part keeps its own pivot (the node's place); its geometry stays in the part's own space
      const holder = o.parent && o.parent !== gltf.scene && !o.parent.isScene ? o.parent : o;
      const geo = o.geometry; geo.computeBoundingSphere();
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'tangent'].includes(k)) geo.deleteAttribute(k);
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      for (const t of [src.map, src.normalMap]) if (t) t.anisotropy = IS_MOBILE ? 2 : 8;
      const pname = holder.name || o.name;
      nodes.push({ name: pname, geo, src, p: holder.position.clone(), q: holder.quaternion.clone(), s: holder.scale.clone(), local: holder === o ? null : o.matrix.clone() });
    });
    const box = new THREE.Box3();
    gltf.scene.traverse((o) => { if (o.isMesh) box.expandByObject(o); });
    store.set(name, { nodes, box });
    return true;
  }).catch((e) => { console.warn(`[dragonslayer] ${name}.glb did not load: ${e?.message || e}`); return false; });
}
function need(name) {
  if (!waits.has(name)) waits.set(name, load(name));
  return waits.get(name);
}
export function dsReady(name) { return store.has(fileOf(name)); }
export function dsWhenReady(name) { return need(fileOf(name)); }

// build the GLB copy: a group in the GLB's own units with one child per part
function build(name) {
  const file = fileOf(name), M = store.get(file), tint = FIT[name]?.tint || 1;
  const g = new THREE.Group(); g.name = 'ds_' + name;
  const parts = [];
  const spec = DS_PARTS[file]?.parts || {};
  for (const n of M.nodes) {
    const node = new THREE.Group(); node.name = n.name;
    node.position.copy(n.p); node.quaternion.copy(n.q); node.scale.copy(n.s);
    const mat = n.name.startsWith('seam_fill') ? coreMat() : material(n.src, n.name.startsWith('seam_'), tint);
    const mesh = new THREE.Mesh(n.geo, mat);
    if (n.local) mesh.applyMatrix4(n.local);
    mesh.castShadow = !n.name.startsWith('seam_fill'); mesh.receiveShadow = true;
    node.add(mesh); g.add(node);
    const B = spec[n.name];
    if (B) parts.push({ node, p0: n.p.clone(), r0: new THREE.Euler().setFromQuaternion(n.q), t: new THREE.Vector3(...B.t).multiplyScalar(MOVE), r: B.r ? new THREE.Vector3(...B.r).multiplyScalar(MOVE) : null });
  }
  return { g, parts };
}

// the holder that goes into the hand or onto the forearm: fallback first, the GLB once it is in
export function dsHolder(name, fallback) {
  const F = FIT[name];
  const hold = new THREE.Group(); hold.name = 'dsHolder';
  if (fallback) { fallback.userData.dsFallback = true; hold.add(fallback); }
  // keep the fallback's markers (a shield's isShield, a weapon's tip) on the holder
  if (fallback?.userData.isShield) hold.userData.isShield = true;
  if (fallback?.userData.tip) hold.userData.tip = fallback.userData.tip;
  // the bow's drawn string (client/game/fx.js updateBowString) stays the built bow's; it hides with it once the GLB
  // (whose own string is part of the model) is in
  if (fallback?.userData.string) hold.userData.string = fallback.userData.string;
  // a pistol: the holster (entities.js) and the muzzle smoke (fx.js muzzlePoint) read these off the holder
  if (fallback?.userData.pistol) hold.userData.pistol = true;
  if (fallback?.userData.muzzle) hold.userData.muzzle = fallback.userData.muzzle.clone().multiply(fallback.scale);
  hold.userData.quality = 5;
  const file = fileOf(name);
  const ctl = { name, file, k: 0, parts: [], model: null, vents: (DS_PARTS[file]?.vents || []).map((v) => new THREE.Vector3(...v)), puff: 0 };
  hold.userData.ds = ctl;
  const put = () => {
    if (ctl.model) return;
    const { g, parts } = build(name);
    const M = store.get(file);
    if (F.pistol) {
      // barrel (+x) to +Z, up stays +Y: a quarter turn about y maps the GLB's (x, y, z) to (-z, y, x); the mirrored
      // Sidearm flips the GLB's z (the holder's x). The grip centre goes to the origin.
      const s = F.len / (M.box.max.x - M.box.min.x || 1), m = F.mirror ? -1 : 1, gz = (M.box.min.z + M.box.max.z) / 2;
      g.rotation.y = -Math.PI / 2;
      g.scale.set(s, s, s * m);
      g.position.set(m * s * gz, -s * F.grip[1], -s * F.grip[0]);
      hold.userData.muzzle = new THREE.Vector3(0, s * (F.muzzle[1] - F.grip[1]), s * (F.muzzle[0] - F.grip[0]) + 0.01);
    } else {
    const h = M.box.max.y - M.box.min.y || 1, s = F.len / h;
    g.scale.set(s, s, s * (F.depth ?? 1));
    g.position.set(-(M.box.min.x + M.box.max.x) / 2 * s, -(M.box.min.y + F.grip) * s, (F.z || 0) - (M.box.min.z + M.box.max.z) / 2 * s * (F.depth ?? 1));
    }
    hold.add(g);
    if (fallback) fallback.visible = false;
    ctl.model = g; ctl.parts = parts;
    // a heat stage or sheen chosen before the model was in (setCharWeapon / setCharOffhand put it on the holder)
    if (hold.userData.heat) heatObject(g, ...hold.userData.heat);
    apply(ctl);
  };
  if (!tripoEnabled()) return hold;
  if (store.has(file)) put(); else need(file).then((ok) => { if (ok) put(); });
  return hold;
}

function apply(ctl) {
  const e = ctl.k * ctl.k * (3 - 2 * ctl.k);
  for (const P of ctl.parts) {
    P.node.position.copy(P.p0).addScaledVector(P.t, e);
    if (P.r) P.node.rotation.set(P.r0.x + P.r.x * e, P.r0.y + P.r.y * e, P.r0.z + P.r.z * e);
  }
}

// every character's Dragonslayer pieces, refreshed by setCharWeapon / setCharOffhand
export function dsRefresh(root) {
  const B = root.userData.bones, list = [];
  for (const bn of ['weaponR', 'weaponL', 'foreL']) for (const c of B?.[bn]?.children || []) if (c.userData.ds) list.push(c);
  root.userData.dsList = list.length ? list : null;
}

let lastHeatT = -1;
// per frame, before the animator runs (it refreshes the rig's matrices afterwards). combat: the animator's 0..1 blend
export function dsUpdate(root, dt, combat) {
  const L = root.userData.dsList;
  if (!L) return;
  // the shared heat: a slow breath with a little flicker, brighter while anyone near is fighting
  const t = G.time.value;
  if (t !== lastHeatT) { lastHeatT = t; HEAT.value = 0.22 + 0.1 * Math.sin(t * 1.7) + 0.04 * Math.sin(t * 6.3 + 1.1); if (fillMat) fillMat.emissiveIntensity = 0.5 + 0.25 * Math.sin(t * 2.1); }
  const target = combat > 0.5 ? 1 : 0;
  for (const h of L) {
    const c = h.userData.ds;
    if (!c.model) continue;
    const k0 = c.k;
    c.k += Math.sign(target - c.k) * Math.min(Math.abs(target - c.k), dt * 2.2); // about half a second either way
    if (c.k !== k0) apply(c);
  }
}

// an attack: white steam from each vent of every piece the character carries (only near the camera)
const _v = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
export function dsAttack(root, fx) {
  const L = root.userData.dsList;
  if (!L || !fx?.emit) return;
  for (const h of L) {
    const c = h.userData.ds;
    if (!c.model || c.k < 0.3) continue;
    c.model.updateWorldMatrix(true, false);
    c.model.localToWorld(_c.set(0, (store.get(c.file)?.box.max.y || 1) * 0.55, 0));
    for (const v of c.vents) {
      c.model.localToWorld(_v.copy(v));
      _d.subVectors(_v, _c); _d.y = Math.max(0.2, _d.y + 0.25);
      fx.emit('steam', _v.clone(), { n: 2, dir: _d.normalize(), size: 0.32, alpha: 0.42, lifeK: 0.7, speed: 0.6 });
    }
  }
}
