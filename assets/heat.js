// Upgrade visuals (plan C): the heat of +7..+10 gear and the Prismatic sheen, on every character, at no extra draw calls.
//   +7 dull red seams; +8 cherry seams and a straw temper tint; +9 bright orange seams, a faint body glow and temper bands;
//   +10 a yellow-white core with a cherry rim, sparks on hits and a thin steam wisp. Prismatic (q6): a thin-film oxide
//   sheen in the specular reflection only (straw, bronze, peacock, blue), never emissive, never an aura.
// Physical only (content rules): the blackbody ramp of hot steel and the temper colours it takes, nothing else.
// How it is drawn (the GLSL is engine/materials.js patchHeat, one shared uniform set HEAT_U):
//   - weapons, shields, shoulder pieces and Dragonslayer models: their metal meshes swap to a shared heat material per
//     (material, stage, sheen), cached here (a handful of materials in use at a time; the draw calls stay the same)
//   - worn body armour and cloak fittings: the per-vertex attribute `upg` on the character's own meshes (heatCharMat /
//     upgAttr below; characters.js fills it slot by slot), so a character stays one draw call per mesh
//   - cloth never heats: only metal fittings (trims, buckles, studs, clasps) on a cloth piece show the heat
// Particles (steam wisps and hit sparks) go through the FX pools, capped: desktop Full the 8 nearest +10 characters
// within 20 m; phones (and Simple anywhere) only your own character as you attack; Off none.
import * as THREE from 'three';
import { freshMat, patchHeat, patchWorld, HEAT_U } from '../engine/materials.js';
import { SETTINGS } from '../engine/settings.js';
import { IS_MOBILE } from '../engine/platform.js';

export const HEAT_STAGES = [7, 8, 9, 10];
export const PARTICLE_CAP = { desktop: 8, range: 20, attackHold: 1.4 };
// the materials that are metal (they heat and take the sheen); wood, leather, cloth, paint and glass never do
export const HEAT_METALS = new Set(['wSteel', 'wEdge', 'wSteelDark', 'wIronW', 'wQ3', 'wQ4', 'wQ5', 'wQ6', 'wGold', 'wBrass', 'wIron', 'wBronze', 'wCopper', 'wDark', 'wMetal', 'wArmour', 'wMail', 'wTrim', 'wTrimPolish', 'ds_plate']);

// ?upgfx=full|simple|off overrides the option (bench and tests; not saved)
let forced = null;
try { forced = new URLSearchParams(location.search).get('upgfx'); } catch { /* no location */ }
export function upgradeFxMode() {
  const m = forced || SETTINGS.upgradeFx || (IS_MOBILE ? 'simple' : 'full');
  return m === 'off' || m === 'simple' ? m : 'full';
}
export function syncHeatFx() { const m = upgradeFxMode(); HEAT_U.uHeatFx.value = m === 'off' ? 0 : m === 'simple' ? 1 : 2; return m; }
syncHeatFx();

// ---- shared heat materials (weapons, shields, shoulder pieces, Dragonslayer plates)
const cache = new Map();
export const heatMatCount = () => cache.size;
export function heatMat(src, stage = 0, film = 0) {
  stage = stage >= 7 ? Math.min(10, stage | 0) : 0; film = film ? 1 : 0;
  if (!src || (!stage && !film)) return src;
  const key = `${src.uuid}:${stage}:${film}`;
  let m = cache.get(key);
  if (!m) {
    m = freshMat(src.name);
    if (!m) { m = src.clone(); patchWorld(m, { cloud: true }); m.name = src.name; }
    patchHeat(m, 'uniform');
    m.userData.upg.value.set(stage, film);
    m.userData.heatOf = src;
    cache.set(key, m);
  }
  return m;
}
const heatable = (mat) => !!mat && (HEAT_METALS.has(mat.name) || mat.userData?.heatable);
// put a built object (weapon, shield, shoulder piece, GLB) at a heat stage and sheen: its metal meshes take the shared heat
// materials, everything else stays. Calling it again (any stage, 0 to go back) is safe; the choice is kept on the object
// (obj.userData.heat) so a model that loads later (Dragonslayer GLBs) can take it too.
export function heatObject(obj, stage = 0, film = 0) {
  if (!obj) return obj;
  obj.userData.heat = [stage | 0, film ? 1 : 0];
  obj.traverse((m) => {
    if (!m.isMesh || Array.isArray(m.material)) return;
    const base = m.userData.heatBase || m.material;
    if (!heatable(base)) return;
    m.userData.heatBase = base;
    m.material = heatMat(base, stage, film);
  });
  return obj;
}

// ---- character meshes: per-vertex heat
// a character material (metal, trim) that reads the `upg` attribute; every mesh drawn with it needs the attribute
export function heatCharMat(mat) {
  if (mat && !mat.userData.heatAttr) { patchHeat(mat, 'attr'); mat.userData.heatAttr = true; }
  return mat;
}
// the geometry's `upg` attribute (heat stage, sheen), made on first use (zeros)
export function upgAttr(geo) {
  let a = geo.getAttribute('upg');
  if (!a || a.count !== geo.attributes.position.count) { a = new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2); geo.setAttribute('upg', a); }
  return a;
}
// fill a whole geometry with one value
export function fillUpg(geo, stage = 0, film = 0) {
  const a = upgAttr(geo), A = a.array;
  for (let i = 0; i < A.length; i += 2) { A[i] = stage; A[i + 1] = film; }
  a.needsUpdate = true;
  return a;
}
// every mesh of a character drawn with a heat-reading material gets the attribute (zeros where it has none)
export function upgCover(root) {
  root.traverse((m) => { if (m.isMesh && m.material?.userData?.heatAttr && !m.geometry.getAttribute('upg')) upgAttr(m.geometry); });
}

// ---- particles
const _p = new THREE.Vector3(), _box = new THREE.Box3();
const now = () => performance.now() / 1000;
// the point half-way up a held weapon's blade (local +Y is the blade), world space
function bladePoint(obj, out) {
  if (obj.userData.heatTipY == null) {
    obj.updateWorldMatrix(true, true);
    _box.makeEmpty();
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
    obj.traverse((m) => { if (m.isMesh && m.visible !== false && m.geometry) { m.geometry.computeBoundingBox?.(); const b = m.geometry.boundingBox; if (b) _box.union(b.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))); } });
    obj.userData.heatTipY = _box.isEmpty() ? 0.6 : _box.max.y;
  }
  return obj.localToWorld(out.set(0, obj.userData.heatTipY * 0.62, 0));
}
const heatOf = (v) => v?.char?.userData?.heatHand || 0;
// may this view throw particles now (the caps)
function allowed(v, mgr, mode) {
  if (mode === 'off' || heatOf(v) < 10) return false;
  const local = v.id === mgr.localId;
  if (mode === 'simple' || IS_MOBILE) return local && now() - (v.heatAtkT || -9) < PARTICLE_CAP.attackHold;
  return !!mgr.heatNear?.has(v.id);
}
// an attack starts: phones and Simple show the local player's heat effects for a moment
export function heatAttack(v) { if (heatOf(v) >= 10) v.heatAtkT = now(); }
// a hit lands: sparks off the target where a +10 weapon struck it
export function heatHit(src, target, fx) {
  const mgr = src?.mgr, mode = upgradeFxMode();
  if (!mgr || !fx?.emit || !target?.pos || !allowed(src, mgr, mode)) return;
  _p.copy(target.pos); _p.y += 1.1;
  const dir = new THREE.Vector3().subVectors(target.pos, src.pos).setY(0);
  if (dir.lengthSq() > 1e-4) { dir.normalize(); _p.addScaledVector(dir, -0.35); }
  fx.emit('sparks', _p.clone(), { n: IS_MOBILE ? 5 : 8, color: '#ffd27a', size: 0.85, dir: dir.lengthSq() ? dir.clone().negate().setY(0.5) : null });
}
// per frame (EntityManager.update): the set of views allowed wisps (4 Hz), then a thin steam wisp off each +10 blade
export function heatTick(mgr, dt, fx) {
  const mode = syncHeatFx();
  if (mode === 'off' || !fx?.emit) return;
  mgr.heatT = (mgr.heatT ?? 0) - dt;
  if (mgr.heatT <= 0) {
    mgr.heatT = 0.25;
    const me = mgr.views.get(mgr.localId), list = [];
    if (me && !IS_MOBILE && mode === 'full') for (const v of mgr.views.values()) {
      if (heatOf(v) < 10 || v.culled || v.dead) continue;
      const d = v.id === mgr.localId ? 0 : v.pos.distanceTo(me.pos);
      if (d <= PARTICLE_CAP.range) list.push([d, v.id]);
    }
    list.sort((a, b) => a[0] - b[0]);
    mgr.heatNear = new Set(list.slice(0, PARTICLE_CAP.desktop).map((e) => e[1]));
  }
  const ids = mode === 'full' && !IS_MOBILE ? mgr.heatNear : [mgr.localId];
  for (const id of ids || []) {
    const v = mgr.views.get(id);
    if (!v || !allowed(v, mgr, mode) || v.mounted || v.onScreen === false) continue;
    v.heatWispAcc = (v.heatWispAcc || 0) + dt * 3.5; // about three and a half thin puffs a second
    if (v.heatWispAcc < 1) continue;
    v.heatWispAcc -= Math.floor(v.heatWispAcc);
    const obj = v.char.userData.heatObj;
    if (!obj || !obj.parent) continue;
    fx.emit('steam', bladePoint(obj, _p).clone(), { n: 1, size: 0.16, alpha: 0.16, lifeK: 0.9, speed: 0.3, spread: 0.05 });
  }
}
