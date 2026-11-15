// Ready-made models (Tripo 3D, made from the Codex concept art, cut down in Blender: tools/tripo/shrink.py), loaded as GLB:
//  - floodgate: the Floodgate, last boss of the Sluice Galleries (40k tris)
//  - tiller: the Runaway Tiller of Brightfield (24k tris; the Harvester, Clatterhook and Thresher keep the built model)
//  - smithy: a blacksmith's corner (brick forge with chimney, bellows, anvil on a stump, quench tub, tools, bars), 30k tris
//  - batch 20, bosses (40k tris, the Sorter 60k): gatewinder and turbineheart (Sluice Galleries), spillway (the Spillway
//    Engine, Rime Steps), wforge (the Wandering Forge), ashwright (Cinder Reach), stormplough (Windward Heights), dredge
//    (the Dune Dredge, and the Leviathan Hull tarred dark), sorter (the Great Sorter), greatpump (the Great Pump),
//    firstfurnace (the Makers' First Furnace)
//  - batch 20, mobs (24-36k tris, an 8k _lo copy with 1024 textures for phones): sandcrawler (every crawler model user),
//    driller (drillers, haulers, loaders, borers, the weighbridge and launch engine), sluicekeeper (the sluice keepers)
//  - batch 20, house props (30k tris): oven, loom, workbench, hearth (houses/interiors.js places them)
//  - batch 21 (patched in Blender, tools/tripo/patch: a plain box over the gearling's rear box, a plain plate over the
//    ore crawler's top deck, every pyramid stud made a flat square one): gearling (gearlings, scrap rollers, Old
//    Rattletrap) and orecrawler (the ore crawlers and the Gallery Bore), 24k + 8k _lo; stall (market stalls, 20k)
// Every GLB is normalised to about 1 unit on its longest side, standing on y = 0, centred in x/z, its front facing +z
// (checked against the Blender previews in tools/tripo/prev/*_*.png: the front view looks from glTF +z), except where a
// wearModel call turns it (turn: a quarter turn, for the GLBs that came out side-on).
// A model loads the first time something asks for it (wearModel, modelSlot, preload, whenReady). isReady(name) /
// cloneModel(name) / whenReady([name]). On phones (IS_MOBILE) a model with a _lo copy loads that (lo: true below; the
// phone build ships only the _lo file), and every other model's textures are halved to 1024 once loaded.
// The materials keep the baked colour and normal maps but become the game's MeshStandardMaterial with the world patches
// (fade circle round the hero, the house cut-away, cloud shadows), rough and barely metallic like the built machines.
// A tint ({ c, k, b }: pull the colour k of the way to its own brightness in the hue of c (c scaled to brightness 1),
// then times b) recolours one copy.
// A debug switch: ?notripo=1 in the URL (or setTripoEnabled(false) before building) keeps the built models everywhere.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { patchWorld } from '../engine/materials.js';
import { IS_MOBILE } from '../engine/platform.js';
import { bumpStatic } from '../game/freeze.js';

const SPEC = {
  floodgate: { rough: 0.9, metal: 0.0, normal: 0.9 },
  tiller: { rough: 0.78, metal: 0.12, normal: 0.9 },
  smithy: { rough: 0.86, metal: 0.04, normal: 0.8 },
  gatewinder: { rough: 0.84, metal: 0.08, normal: 0.9 },
  turbineheart: { rough: 0.86, metal: 0.05, normal: 0.9 },
  spillway: { rough: 0.86, metal: 0.06, normal: 0.9 },
  wforge: { rough: 0.8, metal: 0.12, normal: 0.9 },
  ashwright: { rough: 0.82, metal: 0.1, normal: 0.9 },
  stormplough: { rough: 0.84, metal: 0.08, normal: 0.9 },
  dredge: { rough: 0.8, metal: 0.1, normal: 0.9 },
  sorter: { rough: 0.82, metal: 0.08, normal: 0.9 },
  greatpump: { rough: 0.84, metal: 0.08, normal: 0.9 },
  firstfurnace: { rough: 0.9, metal: 0.02, normal: 0.9 },
  sandcrawler: { rough: 0.8, metal: 0.1, normal: 0.85, lo: true },
  driller: { rough: 0.8, metal: 0.1, normal: 0.85, lo: true },
  sluicekeeper: { rough: 0.84, metal: 0.08, normal: 0.85, lo: true },
  gearling: { rough: 0.8, metal: 0.1, normal: 0.85, lo: true },
  orecrawler: { rough: 0.82, metal: 0.1, normal: 0.85, lo: true },
  stall: { rough: 0.9, metal: 0.0, normal: 0.8 },
  oven: { rough: 0.92, metal: 0.0, normal: 0.8 },
  loom: { rough: 0.9, metal: 0.0, normal: 0.8 },
  workbench: { rough: 0.88, metal: 0.02, normal: 0.8 },
  hearth: { rough: 0.92, metal: 0.0, normal: 0.8 },
};
export const TRIPO_MODELS = Object.keys(SPEC);
const HAS_DOM = typeof window !== 'undefined' && typeof document !== 'undefined';
let enabled = HAS_DOM && !/[?&]notripo=1/.test(window.location?.search || '');
export function setTripoEnabled(on) { enabled = !!on; }
export function tripoEnabled() { return enabled; }

const store = new Map(); // name -> { parts: [{ geo, src }], box, shared: Map<tint key, Material[]> }
const waits = new Map(); // name -> Promise<boolean>

const tintKey = (t) => (t ? `${new THREE.Color(t.c ?? 0xffffff).getHexString()}_${t.k ?? 1}_${t.b ?? 1}_${t.above ?? ''}_${t.red ? 1 : 0}` : '');
function makeMat(name, src, tint = null) {
  const o = SPEC[name] || {};
  const m = new THREE.MeshStandardMaterial({
    map: src.map || null,
    normalMap: src.normalMap || null,
    color: 0xffffff,
    roughness: o.rough ?? 0.85,
    metalness: o.metal ?? 0.05,
    side: THREE.FrontSide,
  });
  // the loader already set the sign (glTF normal maps flip green when tangents come from derivatives)
  if (m.normalMap) m.normalScale.copy(src.normalScale || new THREE.Vector2(1, -1)).multiplyScalar(o.normal ?? 0.85);
  patchWorld(m, { fade: true, cut: true, cloud: true });
  if (tint) {
    // recolour after the colour map: toward the texel's own brightness times c (k of the way), then times b
    const c = new THREE.Color(tint.c ?? 0xffffff), k = tint.k ?? 1, b = tint.b ?? 1, f = (v) => Number(v).toFixed(4);
    c.multiplyScalar(1 / Math.max(1e-3, c.r * 0.299 + c.g * 0.587 + c.b * 0.114)); // the hue only
    // a masked tint (the market stall's awning): only above model height `above` (normalised units) and, with red,
    // only the red texels there (red with green and blue alike: the cloth, not the orange wood or the rusty iron); the
    // rest of the model keeps its colours
    const masked = tint.above != null || tint.red;
    const pre = m.onBeforeCompile, key0 = m.customProgramCacheKey, key = 'T' + tintKey(tint);
    m.onBeforeCompile = (sh, r) => {
      pre(sh, r);
      if (masked) {
        sh.vertexShader = 'varying float vTintY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vTintY = position.y;');
        sh.fragmentShader = 'varying float vTintY;\n' + sh.fragmentShader;
      }
      const w = masked ? `${tint.above != null ? `smoothstep(${f(tint.above - 0.015)}, ${f(tint.above + 0.015)}, vTintY)` : '1.0'} * ${tint.red ? 'smoothstep(0.15, 0.3, diffuseColor.r - max(diffuseColor.g, diffuseColor.b)) * (1.0 - smoothstep(0.04, 0.1, diffuseColor.g - diffuseColor.b))' : '1.0'}` : '1.0';
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { float tl = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), tw = ${w};
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, tl * vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)}), ${f(k)}) * ${f(b)}, tw); }`);
    };
    m.customProgramCacheKey = () => key0() + key;
  }
  m.name = 'tripo_' + name;
  return m;
}

// phones: halve a texture (2048 -> 1024) once it is in
function halve(t) {
  const img = t?.image;
  if (!img || !img.width || img.width <= 1024 || typeof createImageBitmap !== 'function') return Promise.resolve();
  return createImageBitmap(img, { resizeWidth: img.width >> 1, resizeHeight: img.height >> 1, resizeQuality: 'high' })
    .then((bmp) => { t.image = bmp; t.needsUpdate = true; img.close?.(); })
    .catch(() => {});
}

// The APK ships Draco-compressed GLBs (mobile/shrink_www.py); desktop files are plain. One shared loader handles both.
let LOADER = null;
export function tripoLoader() { return loader(); } // the shared GLB loader (Draco-ready), for client/assets/dragonslayer.js
function loader() {
  if (LOADER) return LOADER;
  LOADER = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('/sunmere-play/vendor/three/examples/jsm/libs/draco/gltf/');
  LOADER.setDRACOLoader(draco);
  return LOADER;
}

function load(name) {
  if (!HAS_DOM) return Promise.resolve(false);
  const lo = IS_MOBILE && SPEC[name]?.lo;
  const url = new URL(`./models/${name}${lo ? '_lo' : ''}.glb`, import.meta.url).href;
  return loader().loadAsync(url).then(async (gltf) => {
    const parts = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'tangent'].includes(k)) geo.deleteAttribute(k);
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      geo.userData.shared = true; // every copy shares it: the mob disposer (rig.js disposeCharGeometry) leaves it alone
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      for (const t of [src.map, src.normalMap]) if (t) t.anisotropy = IS_MOBILE ? 4 : 8;
      parts.push({ geo, src });
    });
    if (IS_MOBILE && !lo) await Promise.all(parts.flatMap((p) => [halve(p.src.map), halve(p.src.normalMap)]));
    const box = new THREE.Box3();
    for (const p of parts) box.union(p.geo.boundingBox);
    store.set(name, { parts, box, shared: new Map([['', parts.map((p) => makeMat(name, p.src))]]) });
    return true;
  }).catch((e) => { console.warn(`[tripo] ${name}.glb did not load: ${e?.message || e}`); return false; });
}
// start loading a model (once); resolves true when it is in
function need(name) {
  if (!SPEC[name]) return Promise.resolve(false);
  if (!waits.has(name)) waits.set(name, load(name));
  return waits.get(name);
}
// start loading models ahead of need (e.g. a dungeon's bosses on entry)
export function preload(names) { if (enabled) for (const n of [].concat(names)) need(n); }

export function isReady(name) { return enabled && store.has(name); }
// resolves true once that model (or, with no name, every model) is in, false if it failed or the switch is off
export function whenReady(name) {
  if (name) return need(name).then((ok) => ok && enabled);
  return Promise.all(Object.keys(SPEC).map(need)).then((all) => all.every(Boolean) && enabled);
}
// the model's bounds (normalised units), or null while it loads
export function modelBox(name) { return store.get(name)?.box.clone() || null; }
// a fresh copy: the geometry and textures are shared; own: true gives it its own materials (for a hit flash); tint: a
// recoloured copy (its materials shared by every copy with the same tint, unless own)
export function cloneModel(name, { own = false, shadow = true, tint = null } = {}) {
  const M = store.get(name);
  if (!M) return null;
  const g = new THREE.Group();
  g.name = 'tripo_' + name;
  const tk = tintKey(tint);
  if (!own && !M.shared.has(tk)) M.shared.set(tk, M.parts.map((p) => makeMat(name, p.src, tint)));
  const mats = [];
  M.parts.forEach((p, i) => {
    const mat = own ? makeMat(name, p.src, tint) : M.shared.get(tk)[i];
    const mesh = new THREE.Mesh(p.geo, mat);
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    g.add(mesh); mats.push(mat);
  });
  g.userData.tripoMats = mats;
  return g;
}

// ---------------------------------------------------------------------------------------------------------------------
// A machine's built model wearing a GLB instead: the built model is still made (its pivots, hit boxes, effects and the
// machine interface stay exactly as they were), its own meshes are hidden, and the GLB stands in its place, scaled to the
// built model's bounds, driven by simple motion: an idle bob, a rock and sway with speed, a lunge (main) or a heave and
// slam (slam) for attacks, a flinch and a warm flash when hit, a sink and tilt when it dies, all reset on revive.
//   root: the machine's root (userData.machine set), name: the GLB, o: {
//     keep: [objects]       effect objects that stay visible (smoke, water curtains), re-parented onto the GLB
//     fx: [[obj, [x, y, z], {sx, sy}]]  where each kept effect goes, in the GLB's normalised units
//     fit: 'long' | 'wide'  which horizontal side matches the built model (default the longer one)
//     stretch: [lo, hi]     how far the other axes may differ from the uniform scale (default 0.85..1.25)
//     size: k               the uniform scale times k (a GLB that is lower or shorter than the built model's bounds)
//     turn: quarter turns   the GLB turned about y first (+1: its -x end becomes the front); fx stay in its own units
//     center: [x, z]        where the GLB's middle stands in the root's space (default the middle of the built bounds)
//     tint: { c, k, b }     a recoloured copy (see makeMat)
//     plates: [{ box: [x0, y0, z0, x1, y1, z1], uv: [u, v] }]  plain panels in the GLB's own units, textured from one
//                           plain spot of its atlas (glTF uv), e.g. over the Dune Dredge's window slit
//     motion: { bob, rock, lunge, heave, flinch, sink, tilt, dieDur }   }
// When the GLB has not loaded yet the swap waits for it.
// Motion presets: a common machine, a big boss (slow, heavy, a long sinking death), one that never moves (the furnace).
export const MOTION = {
  mob: { bob: 0.02, bobHz: 11, rock: 0.015, sway: 0.02, lunge: 0.3, flinch: 0.07, sink: 0.1, tilt: 0.5, dieDur: 0.8 },
  boss: { bob: 0.03, bobHz: 6, rock: 0.005, sway: 0.008, lunge: 0.6, heave: 0, flinch: 0.03, sink: 0.5, tilt: 0.08, dieDur: 2.0 },
  fixed: { bob: 0.01, bobHz: 3, rock: 0.001, sway: 0.001, lunge: 0.12, heave: 0, flinch: 0.01, sink: 0.6, tilt: 0.02, dieDur: 2.4 },
};
export function wearModel(root, name, o = {}) {
  if (!enabled) return root;
  const go = () => { if (!root.userData.tripo) swapIn(root, name, o); };
  if (store.has(name)) go(); else need(name).then((ok) => { if (ok && enabled) go(); });
  return root;
}

const _b = new THREE.Box3();
function swapIn(root, name, o) {
  const a = root.userData.machine;
  const M = store.get(name);
  if (!a || !M) return;
  const keep = new Set(o.keep || []);
  const kept = (obj) => { for (let p = obj; p; p = p.parent) if (keep.has(p)) return true; return false; };
  // the built model's own bounds (meshes only, effects left out), in the root's space
  const s0 = root.scale.clone(), p0 = root.position.clone(), q0 = root.quaternion.clone(), par = root.parent;
  root.scale.set(1, 1, 1); root.position.set(0, 0, 0); root.quaternion.identity();
  if (par) par.remove(root);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3(), hide = [];
  root.traverse((m) => {
    if (!m.isMesh || kept(m) || !m.visible) return;
    if (m.geometry.boundingBox === null) m.geometry.computeBoundingBox();
    _b.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
    box.union(_b); hide.push(m);
  });
  root.scale.copy(s0); root.position.copy(p0); root.quaternion.copy(q0);
  if (par) par.add(root);
  if (box.isEmpty()) return;
  const sz = box.getSize(new THREE.Vector3()), g0 = M.box.getSize(new THREE.Vector3());
  // a quarter-turned GLB: its x and z sides swap (sizes and scales below are in the turned frame)
  const q = (((o.turn || 0) % 4) + 4) % 4, odd = q % 2 === 1;
  const gs = odd ? new THREE.Vector3(g0.z, g0.y, g0.x) : g0;
  const longZ = gs.z >= gs.x;
  const fitZ = o.fit === 'wide' ? false : o.fit === 'long' ? longZ : longZ;
  const s = (fitZ ? sz.z / gs.z : sz.x / gs.x) * (o.size || 1);
  const [lo, hi] = o.stretch || [0.85, 1.25];
  const cl = (v) => Math.min(s * hi, Math.max(s * lo, v));
  const sc = new THREE.Vector3(fitZ ? cl(sz.x / gs.x) : s, cl(sz.y / gs.y), fitZ ? s : cl(sz.z / gs.z));
  const sl = odd ? new THREE.Vector3(sc.z, sc.y, sc.x) : sc.clone(); // the scale in the GLB's own axes
  for (const m of hide) m.visible = false;
  // the motion pivot sits at the built model's foot, centred on its bounds (or where center says)
  const holder = new THREE.Group(); holder.name = 'tripoHolder';
  holder.position.set(o.center ? o.center[0] : (box.min.x + box.max.x) / 2, box.min.y, o.center ? o.center[1] : (box.min.z + box.max.z) / 2);
  const inner = new THREE.Group(); holder.add(inner);
  const spin = new THREE.Group(); spin.rotation.y = q * Math.PI / 2; inner.add(spin);
  const model = cloneModel(name, { own: true, tint: o.tint || null });
  for (const P of o.plates || []) {
    const [x0, y0, z0, x1, y1, z1] = P.box;
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, P.uv[0] + (uv.getX(i) - 0.5) * 0.004, P.uv[1] + (uv.getY(i) - 0.5) * 0.004);
    const mat = makeMat(name, M.parts[0].src, o.tint || null);
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
    model.add(mesh); model.userData.tripoMats.push(mat);
  }
  const cx = (M.box.min.x + M.box.max.x) / 2, cz = (M.box.min.z + M.box.max.z) / 2;
  model.scale.copy(sl);
  model.position.set(-cx * sl.x, -M.box.min.y * sl.y, -cz * sl.z);
  spin.add(model);
  root.add(holder);
  // the kept effects ride the GLB now, at the spots given in its own normalised units (turned with it)
  const _v = new THREE.Vector3();
  for (const [obj, at, k = {}] of o.fx || []) {
    if (!obj) continue;
    obj.removeFromParent();
    _v.set((at[0] - cx) * sl.x, (at[1] - M.box.min.y) * sl.y, (at[2] - cz) * sl.z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, spin.rotation.y);
    obj.position.copy(_v);
    if (k.sx) obj.scale.x *= k.sx;
    if (k.sy) obj.scale.y *= k.sy;
    if (k.s) obj.scale.multiplyScalar(k.s);
    if (k.ry != null) obj.rotation.y = k.ry;
    inner.add(obj);
  }
  const mats = model.userData.tripoMats;
  const mo = { bob: 0.02, bobHz: 11, rock: 0.015, sway: 0.02, lunge: 0.35, heave: 0, flinch: 0.06, sink: 0.1, tilt: 0.5, dieDur: 0.8, ...(o.motion || {}) };
  const H = Math.max(0.5, sz.y);
  let flash = 0, t = Math.random() * 10, spd = 0;
  const hit0 = a.hit, upd0 = a.update, rev0 = a.revive;
  // the entity view (client/game/entities.js) tips machine.p.body away from each blow and on the killing blow: outside the
  // built update it sees the GLB's motion pivot as the body, so that directional reaction still shows on the GLB
  const pBuilt = a.p, pView = { ...pBuilt, body: inner };
  a.p = pView;
  a.hit = function () { hit0.call(this); flash = 1; };
  a.revive = function () { rev0.call(this); flash = 0; inner.position.set(0, 0, 0); inner.rotation.set(0, 0, 0); };
  a.update = function (dt, speed) {
    const atk0 = this.atk;
    this.p = pBuilt;
    try { upd0.call(this, dt, speed); } finally { this.p = pView; }
    t += dt;
    // a short, faint warm flash (bright enough to read the hit, never washing a model white in a dark dungeon)
    if (flash > 0) flash = Math.max(0, flash - dt * 7);
    const e = flash > 0 ? 0.2 * Math.exp(-(1 - flash) * 4.2) : 0;
    for (const m of mats) m.emissive.setRGB(e, e * 0.94, e * 0.85);
    if (this.dead) {
      const k = Math.min(1, this.deadT / mo.dieDur), ee = 1 - Math.pow(1 - k, 2);
      inner.position.set(0, -mo.sink * ee, 0);
      inner.rotation.set(0, 0, mo.tilt * ee);
      return;
    }
    const ts = this.stun ? 0.15 : 1;
    spd += (speed - spd) * Math.min(1, dt * 5);
    const go = Math.min(1, Math.abs(spd) / 3);
    // idle: a slow breathing bob; moving: the engine judders and the body rocks and sways on its wheels or treads
    let y = Math.abs(Math.sin(t * mo.bobHz * ts)) * mo.bob * (0.35 + 0.65 * go) + Math.sin(t * 1.3) * mo.bob * 0.25;
    let rx = Math.sin(t * 7.1 * ts) * mo.rock * go + Math.sin(t * 2) * mo.rock * 0.2, rz = Math.sin(t * 4.3 * ts) * mo.sway * go, z = 0;
    // the attack (the machine's own clock: this.atk runs 0..1, -1 when idle; the built update has just stepped it)
    const u = this.atk >= 0 ? this.atk : atk0 >= 0 ? 1 : -1;
    if (u >= 0) {
      const kind = this.atkKind || 'main';
      if (kind === 'slam' && mo.heave > 0) {
        // heave up and back, then slam down, a shudder after
        const up = u < 0.55 ? u / 0.55 : u < 0.65 ? 1 - (u - 0.55) / 0.1 : 0;
        y += mo.heave * up * up;
        rx += -0.05 * up;
        if (u >= 0.65) { const k2 = (1 - u) / 0.35; rz += Math.sin(t * 40) * 0.02 * k2; y += -0.04 * mo.heave * Math.sin((u - 0.65) * 22) * k2; }
      } else {
        // wind back, lunge, settle (a slam lunges harder and shakes)
        const l = u < 0.3 ? -0.3 * (u / 0.3) : u < 0.5 ? -0.3 + 1.3 * ((u - 0.3) / 0.2) : 1 - (u - 0.5) / 0.5;
        const big = kind === 'slam' ? 1.5 : 1;
        z += l * mo.lunge * big;
        rx += l * 0.08 * big;
        if (kind === 'slam' && u > 0.45) rz += Math.sin(t * 38) * 0.03 * (1 - u);
      }
    }
    // hit: flinch back and shake
    if (this.hitT > 0) { rx -= mo.flinch * this.hitT * 0.6; rz += Math.sin(t * 40) * this.hitT * mo.flinch * 0.5; z -= mo.flinch * this.hitT * H * 0.08; }
    inner.position.set(0, y, z);
    inner.rotation.set(rx, 0, rz);
  };
  root.userData.tripo = { name, holder, inner, model, scale: sc.clone() };
  // the nameplate and health bar sit on the GLB's real height (often lower than the built model's), in the root's
  // parent units like userData.height (scaled() multiplies it afterwards when the swap came first); a view that read
  // the height before the GLB came in hears of it through onModelHeight
  const h = (box.min.y + gs.y * sc.y) * s0.y;
  root.userData.height = h;
  root.userData.onModelHeight?.(h);
}

// ---------------------------------------------------------------------------------------------------------------------
// A prop slot for a static GLB (the smithy): a group holding the built stand-in (fallback, shown until the model loads, or
// for good when it cannot), then the GLB at scale s, turned ry, its foot at p. extra(): more things (a fire in its
// firebox) added beside the GLB once it is in. The group's userData.update drives them.
// s: one scale or [sx, sy, sz]; onPut(hold): called once the GLB is in (e.g. to tag it like its house).
export function modelSlot(name, { p = [0, 0, 0], ry = 0, s = 1, fallback = null, extra = null, shadow = true, tint = null, onPut = null } = {}) {
  const g = new THREE.Group(); g.name = 'slot_' + name;
  if (fallback) g.add(fallback);
  const dyn = [];
  g.userData.update = (dt, t) => { for (const d of dyn) d.userData.update?.(dt, t); };
  const put = () => {
    if (g.userData.model) return;
    const M = store.get(name), m = cloneModel(name, { shadow, tint });
    if (!M || !m) return;
    const hold = new THREE.Group();
    hold.position.fromArray(p); hold.rotation.y = ry;
    const [sx, sy, sz] = Array.isArray(s) ? s : [s, s, s];
    m.scale.set(sx, sy, sz);
    m.position.set(-(M.box.min.x + M.box.max.x) / 2 * sx, -M.box.min.y * sy, -(M.box.min.z + M.box.max.z) / 2 * sz);
    hold.add(m);
    for (const o of extra ? extra(s) : []) { hold.add(o); dyn.push(o); }
    g.add(hold);
    if (fallback) fallback.visible = false;
    g.userData.model = hold;
    // (v116) the GLB stands still: the static shadow cache draws it (engine/shadowCache.js; its extras keep their own
    // update and stay dynamic casters), classified again now that it is in
    g.userData.shadowStatic = true; bumpStatic();
    onPut?.(hold);
  };
  if (isReady(name)) put(); else if (enabled) need(name).then((ok) => { if (ok && enabled) put(); });
  return g;
}
