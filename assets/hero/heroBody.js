// Hero rework stage 2 / combat stage S0 (docs/ai/hero_rework.md "Stage 2", docs/ai/combat_design.md section 12): the new
// skinned base body on the UAL skeleton for every humanoid (heroes, townsfolk, guards, companions, bots, raiders), behind
// ?herobody=1 or the Options toggle (SETTINGS.heroBody); ?herobody=0 forces the old body. On by default since the S0 perf review (18 Nov: phone bench +7 % CPU).
//
// How it fits the game without changing any caller:
// - characters.js builds every character as before (outfit pieces, armour, cloaks, weapons on the old rig.js skeleton),
//   except that baseBody() hands its colours to this file instead of building the blocky body: the new body's six colour
//   regions (skin, shirt, trousers, boots, gloves, belt) are written per look into ordinary rig parts (cloth, leather,
//   metal, dark), so the body joins the per-kind meshes and charMerge merges it with the rest (one draw per character).
// - The character's skeleton is the old bones plus the 35 UAL bones (one Skeleton, the UAL bones after the old ones, with
//   their own bind inverses), so the body and every worn piece share one SkinnedMesh per kind.
// - The UAL bones hang under 'heroWrap' (a Bone at HERO_SCALE, so the matrix walks treat it like the rig) on the
//   character root. An AnimationMixer per character plays the locomotion clips (hero_clips.glb) on them.
// - The old Animator (anim.js) keeps running exactly as today, and every skill, flinch, death, sit, ride and emote it
//   poses is copied onto the UAL bones by the retarget layer (R5 point 4): q_ual_world = q_old_world * Rref, where Rref is
//   the UAL bone's rest rotation in character space, with the arms first turned from the T-pose to hanging (the old rig's
//   rest). The legs and pelvis come from the mixer, the upper body from the skill (upper/lower split, spine_01 50/50);
//   standing skills and full-body moves take the legs too (anim.js actLegW).
// - Afterwards the old bones are moved onto the new body (rotation and joint position), so every outfit piece, helm,
//   pauldron, cloak chain, holster and weapon (on weaponR/L, set to the UAL hand sockets) follows the new body.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { IS_MOBILE } from '../../engine/platform.js';
import { SETTINGS } from '../../engine/settings.js';
import { rgb } from '../kit.js';

export const HERO_SCALE = 1.14;
const HAS_DOM = typeof window !== 'undefined' && typeof document !== 'undefined';
const QS = HAS_DOM ? window.location?.search || '' : '';
let ON = HAS_DOM && !/[?&]herobody=0/.test(QS) && (/[?&]herobody=1/.test(QS) || SETTINGS.heroBody !== false);
const LO = IS_MOBILE || /[?&]herolo=1/.test(QS);
export const HERO_STATS = { on: false, lod: LO ? 'lo' : 'hi', chars: 0, bodyTris: 0, loadMs: 0, err: '' };

// old rig bone <- UAL bone (the retarget map, hero_rework.md stage 2 section 2)
const MAP = {
  pelvis: 'hips', spine_01: 'spine', spine_03: 'chest', neck_01: 'neck', Head: 'head',
  clavicle_l: 'clavL', upperarm_l: 'armL', lowerarm_l: 'foreL', hand_l: 'handL',
  clavicle_r: 'clavR', upperarm_r: 'armR', lowerarm_r: 'foreR', hand_r: 'handR',
  thigh_l: 'thighL', calf_l: 'shinL', foot_l: 'footL', thigh_r: 'thighR', calf_r: 'shinR', foot_r: 'footR',
};
const OLD_ORDER = ['hips', 'spine', 'chest', 'neck', 'head', 'clavL', 'armL', 'foreL', 'handL', 'clavR', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const OLD_PARENT = { hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', clavL: 'chest', armL: 'clavL', foreL: 'armL', handL: 'foreL', clavR: 'chest', armR: 'clavR', foreR: 'armR', handR: 'foreR', thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR' };
const LOWER = /^(root|pelvis|thigh_|calf_|foot_|ball_)/;
const ARM = /^(clavicle_|upperarm_|lowerarm_|hand_)/;
const FINGER = /^(middle_|thumb_)/;
// locomotion clips: [clip, ground speed at HERO_SCALE (m/s), measured with tools/hero/s0/clip_speeds.mjs, rounded up for
// the stance travel the foot range under-reads]
const LOCO = {
  F: [['Walk_Loop', 1.25], ['Jog_Fwd_Loop', 3.2], ['Sprint_Loop', 4.4]],
  B: [['Walk_Back_Loop', 1.25], ['Jog_Back_Loop', 3.2]],
  L: [['Walk_Strafe_L_Loop', 1.15], ['Strafe_L_Loop', 2.9]],
  R: [['Walk_Strafe_R_Loop', 1.15], ['Strafe_R_Loop', 2.9]],
};
// the standing clip in combat by class (the legs; the arms keep the class stance through the retarget layer)
const COMBAT_IDLE = { knight: 'Sword_Idle', sandblade: 'Sword_Idle', warden: 'Sword_Idle', raider: 'Sword_Idle', deadeye: 'Pistol_Idle_Loop' };
// townsfolk and anyone with empty hands swing the clip's own arms; armed classes keep today's arm stances (weapons held
// as designed) on the clip's torso
const CLIP_ARMS = new Set(['villager']);

let H = null; // the loaded body and clips (one LOD)
const v3q = new THREE.Quaternion(), v3 = new THREE.Vector3(), v3b = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), m4 = new THREE.Matrix4();

async function load() {
  const t0 = performance.now();
  const loader = new GLTFLoader();
  const base = new URL('./', import.meta.url).href;
  const [bodyG, clipG] = await Promise.all([loader.loadAsync(base + (LO ? 'hero_body_lo.glb' : 'hero_body.glb')), loader.loadAsync(base + 'hero_clips.glb')]);
  const scene = bodyG.scene;
  scene.updateMatrixWorld(true);
  let mesh = null;
  scene.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  if (!mesh) throw new Error('no body mesh');
  const bones = mesh.skeleton.bones, idx = new Map(bones.map((b, i) => [b, i]));
  const S = HERO_SCALE, Sm = new THREE.Matrix4().makeScale(S, S, S), Sinv = new THREE.Matrix4().makeScale(1 / S, 1 / S, 1 / S);
  const B = bones.map((b, i) => {
    const d = { name: b.name, i, parent: idx.has(b.parent) ? idx.get(b.parent) : -1, pos: b.position.clone(), quat: b.quaternion.clone(), scl: b.scale.clone() };
    if (d.parent < 0) { // fold the (identity) HeroRig node into the top bone
      const m = new THREE.Matrix4().multiplyMatrices(b.parent ? b.parent.matrixWorld : new THREE.Matrix4(), b.matrix);
      m.decompose(d.pos, d.quat, d.scl);
    }
    // rest in character space (wrapper at the origin, scaled)
    const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
    b.matrixWorld.decompose(wp, wq, ws);
    d.W = wq; d.P = wp.multiplyScalar(S);
    d.inv = mesh.skeleton.boneInverses[i].clone().multiply(Sinv);
    return d;
  });
  const byName = Object.fromEntries(B.map((d) => [d.name, d]));
  const sockets = [];
  scene.traverse((o) => { if (/^socket_/.test(o.name) && idx.has(o.parent)) sockets.push({ name: o.name, parent: idx.get(o.parent), pos: o.position.clone(), quat: o.quaternion.clone() }); });
  // alignment: the old rig's rest has the arms hanging; the UAL rest is a T-pose. Rref = A * W (A turns the arm down)
  const down = new THREE.Vector3(0, -1, 0);
  for (const d of B) {
    let A = new THREE.Quaternion();
    if (ARM.test(d.name) && !/^clavicle_/.test(d.name)) {
      const side = d.name.endsWith('_l') ? 1 : -1;
      A.setFromUnitVectors(new THREE.Vector3(side, 0, 0), down);
    }
    d.A = A;
    d.Rref = A.clone().multiply(d.W);
    d.RrefInv = d.Rref.clone().invert();
    d.old = MAP[d.name] || null;
    d.group = LOWER.test(d.name) ? 'L' : d.name === 'spine_01' ? 'S' : ARM.test(d.name) ? 'A' : FINGER.test(d.name) ? 'F' : 'T';
  }
  // the body geometry in character space (bind = the T-pose rest): v' = S * bindMatrix * v; bone inverses IBM * S^-1
  let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(Sm, mesh.bindMatrix));
  const RG = g.attributes._region;
  if (!RG) throw new Error('no _region');
  const tri = g.attributes.position.count / 3, regTri = new Uint8Array(tri);
  for (let t = 0; t < tri; t++) regTri[t] = Math.round(RG.getX(t * 3));
  // landmarks for placing the old rig's bones on the new body (outfit pieces were built around the old body)
  const P = g.attributes.position, SI = g.attributes.skinIndex;
  const band = (reg, y0, y1) => { let n = 0, sy = 0, zmin = 1e9, zmax = -1e9, xmax = 0; for (let i = 0; i < P.count; i++) { if (reg !== null && Math.round(RG.getX(i)) !== reg) continue; const y = P.getY(i); if (y < y0 || y > y1) continue; n++; sy += y; const z = P.getZ(i); zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); xmax = Math.max(xmax, Math.abs(P.getX(i))); } return n ? { y: sy / n, z: (zmin + zmax) / 2, depth: zmax - zmin, half: xmax, n } : null; };
  const beltB = band(5, 0, 3) || { y: byName.pelvis.P.y + 0.07, z: 0 };
  const shoulderY = byName.upperarm_l.P.y;
  const chestY = shoulderY - 0.19; // the old rig: chest bone 0.19 below the shoulder joints
  const chestB = band(1, chestY - 0.03, chestY + 0.03) || { z: 0 };
  const neckY = byName.neck_01.P.y;
  const headB = band(0, neckY + 0.06, 3) || { y: byName.Head.P.y + 0.1, z: 0, half: 0.12 };
  const off = {
    hips: new THREE.Vector3(0, beltB.y, beltB.z).sub(byName.pelvis.P),
    chest: new THREE.Vector3(0, chestY, chestB.z).sub(byName.spine_03.P),
  };
  // spine: between the hips and chest landmarks as the old rig has it (1.12 between 1.0 and 1.32)
  const hipsL = byName.pelvis.P.clone().add(off.hips), chestL = byName.spine_03.P.clone().add(off.chest);
  off.spine = hipsL.clone().lerp(chestL, 0.12 / 0.32).sub(byName.spine_01.P);
  // the old head centre is 0.11 above its bone (the dark egg, x1.1); helms fit the new egg by the head bone's scale
  const egg = headB.y;
  off.head = new THREE.Vector3(0, egg - 0.11 - byName.Head.P.y, (headB.z || 0) - 0.01 - byName.Head.P.z);
  const headK = Math.min(1.12, Math.max(0.88, (headB.half || 0.125) / 0.1265));
  // clips (phones: the finger tracks are stripped: 12 frozen bones)
  const clips = {};
  for (const c of clipG.animations) {
    if (IS_MOBILE) c.tracks = c.tracks.filter((t) => !FINGER.test(t.name));
    clips[c.name] = c;
  }
  const info = { tris: tri, verts: P.count };
  HERO_STATS.bodyTris = tri; HERO_STATS.loadMs = Math.round(performance.now() - t0);
  return { B, byName, sockets, geo: g, regTri, off, headK, clips, info, landmarks: { belt: beltB, chest: chestB, head: headB } };
}

if (ON) {
  try { H = await load(); HERO_STATS.on = true; } catch (e) { console.warn('[heroBody] off:', e); HERO_STATS.err = String(e?.message || e); ON = false; H = null; }
}
export function heroOn() { return ON && !!H; }
export function heroData() { return H; }

// ---- the body as rig parts, coloured per look
const REG = ['skin', 'shirt', 'pants', 'boot', 'glove', 'belt'];
const partCache = new Map();
// cut: the trousers above this height (character space) are left out, under a long robe (robe())
function bodyParts(N, look, cut = Infinity) {
  const kindOf = (r) => (r === 0 ? 'dark' : r === 3 ? (look.bootKind === 'metal' ? 'metal' : 'leather') : r === 4 ? (look.gloveKind === 'metal' ? 'metal' : 'leather') : r === 5 ? 'leather' : 'cloth');
  const key = N + '|' + REG.map((r) => look[r]).join(',') + '|' + look.bootKind + look.gloveKind + '|' + cut;
  const hit = partCache.get(key);
  if (hit) return hit;
  const g = H.geo, A = g.attributes, cols = REG.map((r) => rgb(look[r] || '#555555'));
  const tris = {};
  const PY = g.attributes.position;
  for (let t = 0; t < H.regTri.length; t++) {
    if (H.regTri[t] === 2 && PY.getY(t * 3) > cut && PY.getY(t * 3 + 1) > cut && PY.getY(t * 3 + 2) > cut) continue;
    (tris[kindOf(H.regTri[t])] ||= []).push(t);
  }
  const out = {};
  for (const [kind, list] of Object.entries(tris)) {
    const n = list.length * 3;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), si = new Float32Array(n * 4), sw = new Float32Array(n * 4);
    let o = 0;
    for (const t of list) for (let k = 0; k < 3; k++, o++) {
      const i = t * 3 + k, r = H.regTri[t], c = cols[r];
      pos[o * 3] = A.position.getX(i); pos[o * 3 + 1] = A.position.getY(i); pos[o * 3 + 2] = A.position.getZ(i);
      const ny = A.normal.getY(i);
      nor[o * 3] = A.normal.getX(i); nor[o * 3 + 1] = ny; nor[o * 3 + 2] = A.normal.getZ(i);
      if (A.uv) { uv[o * 2] = A.uv.getX(i) * 3; uv[o * 2 + 1] = A.uv.getY(i) * 3; }
      // the rig's painted light: top faces a little brighter, undersides darker (rig.js addW)
      const kk = 1 + ny * 0.16;
      col[o * 3] = c[0] * kk; col[o * 3 + 1] = c[1] * kk; col[o * 3 + 2] = c[2] * kk;
      for (let j = 0; j < 4; j++) { si[o * 4 + j] = A.skinIndex.getComponent(i, j) + N; sw[o * 4 + j] = A.skinWeight.getComponent(i, j); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geo.userData.heroBody = true;
    out[kind] = geo;
  }
  if (partCache.size > 64) partCache.clear();
  partCache.set(key, out);
  return out;
}

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const NOOP = () => {};
// weights over a ladder of [clip, speed]: piecewise linear in speed
function ladder(list, sp, out, k) {
  if (k <= 0) return;
  if (sp <= list[0][1]) { out.set(list[0][0], (out.get(list[0][0]) || 0) + k); return; }
  for (let i = 0; i + 1 < list.length; i++) {
    const [a, sa] = list[i], [b, sb] = list[i + 1];
    if (sp <= sb) { const t = (sp - sa) / (sb - sa); out.set(a, (out.get(a) || 0) + k * (1 - t)); out.set(b, (out.get(b) || 0) + k * t); return; }
  }
  const last = list[list.length - 1][0];
  out.set(last, (out.get(last) || 0) + k);
}
const SPEED = new Map(Object.values(LOCO).flat());

// ---- the clip sampler (S0 perf review): replaces one three.js AnimationMixer per character. The mixer cost a third of
// post() on the phone preset (12 actions walked, 39 property bindings applied, Euler sync on every write) for what is a
// weighted blend of 1-3 clips of 24 fps quaternion tracks. Same result: each clip sampled linearly (STEP tracks held),
// blended by weight (normalised lerp), and a total weight under 1 topped up with the rest pose, as the mixer's
// "original state" did.
function clipTable(name) {
  const ST = (H.ST ||= {});
  if (ST[name] !== undefined) return ST[name];
  const c = H.clips[name];
  if (!c) return (ST[name] = null);
  const s = { name, dur: c.duration || 1, rot: [], pos: [] };
  for (const t of c.tracks) {
    const dot = t.name.lastIndexOf('.'), d = H.byName[t.name.slice(0, dot)], prop = t.name.slice(dot + 1);
    if (!d || t.times.length === 0) continue;
    const e = { i: d.i, times: t.times, values: t.values, step: t.getInterpolation() === THREE.InterpolateDiscrete };
    if (prop === 'quaternion') s.rot.push(e); else if (prop === 'position') s.pos.push(e);
  }
  return (ST[name] = s);
}
// the key pair round t: sets SK / SU (index, fraction)
let SK = 0, SU = 0;
function seek(e, t) {
  const T = e.times, n = T.length;
  if (n < 2 || t <= T[0]) { SK = 0; SU = 0; return; }
  if (t >= T[n - 1]) { SK = n - 2; SU = 1; return; }
  let k = Math.floor(((t - T[0]) / (T[n - 1] - T[0])) * (n - 1)); // (uniform keys: exact; otherwise a start to walk from)
  if (k > n - 2) k = n - 2;
  while (k > 0 && T[k] > t) k--;
  while (k < n - 2 && T[k + 1] < t) k++;
  SK = k; SU = e.step ? 0 : (t - T[k]) / (T[k + 1] - T[k] || 1);
}
const QA = new Float32Array(256 * 4), QW = new Float32Array(256), PA = new Float32Array(256 * 3), PW = new Float32Array(256);
// blends the clips [[table, time, weight]...] into the bones' own position and rotation (every bone written)
function sampleInto(ub, list, nList) {
  const B = H.B, nB = B.length;
  QA.fill(0, 0, nB * 4); QW.fill(0, 0, nB); PA.fill(0, 0, nB * 3); PW.fill(0, 0, nB);
  for (let l = 0; l < nList; l++) {
    const [s, t, w] = list[l];
    for (const e of s.rot) {
      seek(e, t);
      const v = e.values, a = SK * 4, b = a + 4, u = SU;
      let bx = v[b], by = v[b + 1], bz = v[b + 2], bw = v[b + 3];
      if (v[a] * bx + v[a + 1] * by + v[a + 2] * bz + v[a + 3] * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
      let x = v[a] + (bx - v[a]) * u, y = v[a + 1] + (by - v[a + 1]) * u, z = v[a + 2] + (bz - v[a + 2]) * u, ww = v[a + 3] + (bw - v[a + 3]) * u;
      const o = e.i * 4;
      if (QA[o] * x + QA[o + 1] * y + QA[o + 2] * z + QA[o + 3] * ww < 0) { x = -x; y = -y; z = -z; ww = -ww; }
      const L = Math.sqrt(x * x + y * y + z * z + ww * ww) || 1, k = w / L;
      QA[o] += x * k; QA[o + 1] += y * k; QA[o + 2] += z * k; QA[o + 3] += ww * k; QW[e.i] += w;
    }
    for (const e of s.pos) {
      seek(e, t);
      const v = e.values, a = SK * 3, b = a + 3, u = SU, o = e.i * 3;
      PA[o] += (v[a] + (v[b] - v[a]) * u) * w; PA[o + 1] += (v[a + 1] + (v[b + 1] - v[a + 1]) * u) * w; PA[o + 2] += (v[a + 2] + (v[b + 2] - v[a + 2]) * u) * w; PW[e.i] += w;
    }
  }
  for (let i = 0; i < nB; i++) {
    const d = B[i], bq = ub[i].quaternion, bp = ub[i].position, rq = d.quat, o = i * 4, r = 1 - QW[i];
    let x = QA[o], y = QA[o + 1], z = QA[o + 2], ww = QA[o + 3];
    if (r > 0) { const sg = x * rq.x + y * rq.y + z * rq.z + ww * rq.w < 0 ? -r : r; x += rq.x * sg; y += rq.y * sg; z += rq.z * sg; ww += rq.w * sg; }
    const L = Math.sqrt(x * x + y * y + z * z + ww * ww);
    if (L > 1e-6) bq.set(x / L, y / L, z / L, ww / L); else bq.copy(rq);
    const pr = 1 - PW[i], p = i * 3;
    if (PW[i] >= 1) bp.set(PA[p] / PW[i], PA[p + 1] / PW[i], PA[p + 2] / PW[i]); else if (PW[i] > 0) bp.set(PA[p] + d.pos.x * pr, PA[p + 1] + d.pos.y * pr, PA[p + 2] + d.pos.z * pr); else bp.copy(d.pos);
  }
}

// ---- per character
export function heroRig(kind) { return heroOn() ? new HeroRig(kind) : null; }

class HeroRig {
  constructor(kind) { this.kind = kind; this.look = null; this.N = 0; }
  // characters.js baseBody: o = the outfit's colours
  body(rb, o) {
    const suit = o.suit ?? '#3a3550';
    const look = {
      skin: '#141210', shirt: o.sleeve ?? suit, pants: o.pants ?? suit, boot: o.boot ?? '#4a3220', glove: o.glove ?? '#4a3424',
      belt: o.belt ?? '#3a2616', bootKind: o.bootKind, gloveKind: o.gloveKind,
    };
    this.look = look;
    this.pushed = [];
    for (const [kind, geo] of Object.entries(bodyParts(rb.def.length, look))) { rb.parts[kind].push(geo); this.pushed.push([kind, geo]); }
  }
  // characters.js robeSkirt (S0 review): the new body's run lifts the thigh far higher than the old body did, and it came
  // out through the front of every long robe; the thighs inside the robe are left out (the boots and shins still show
  // below the hem and stride out of it as before)
  robe(rb, hemY) {
    if (!this.pushed || !(hemY < 0.75)) return;
    for (const [kind, geo] of this.pushed) { const a = rb.parts[kind], i = a.indexOf(geo); if (i >= 0) a.splice(i, 1); }
    this.pushed = [];
    const cut = Math.max(hemY + 0.14, H.byName.calf_l.P.y + 0.1);
    for (const [kind, geo] of Object.entries(bodyParts(rb.def.length, this.look, +cut.toFixed(2)))) { rb.parts[kind].push(geo); this.pushed.push([kind, geo]); }
  }
  // rig.js build: the UAL bones join the character's skeleton after the old ones
  addBones(root, list) {
    const wrap = new THREE.Bone();
    wrap.name = 'heroWrap';
    wrap.scale.setScalar(HERO_SCALE);
    root.add(wrap);
    this.N = list.length;
    // (S0 perf review) nothing reads these bones' Euler .rotation: their quaternions skip three's Euler sync, which cost a
    // rotation-matrix decompose on every write (the rest reset, the mixer and the retarget pass: ~100 per hero per frame)
    const ub = H.B.map((d) => { const b = new THREE.Bone(); b.quaternion._onChange(NOOP); b.name = d.name; b.position.copy(d.pos); b.quaternion.copy(d.quat); b.scale.copy(d.scl); return b; });
    wrap.quaternion._onChange(NOOP);
    // (S0 perf review) the renderer's scene walks (projectObject, both passes) need not visit the 35 bones and sockets of
    // every character: nothing under the wrapper draws (the skeleton reads the bones directly, wrapUpdate sets them)
    wrap.visible = false;
    H.B.forEach((d, i) => (d.parent >= 0 ? ub[d.parent] : wrap).add(ub[i]));
    this.sock = {};
    for (const s of H.sockets) { const o = new THREE.Object3D(); o.name = s.name; o.position.copy(s.pos); o.quaternion.copy(s.quat); o.updateMatrix(); ub[s.parent].add(o); this.sock[s.name] = o; }
    this.wrap = wrap; this.ub = ub;
    list.push(...ub);
  }
  fixInverses(skel) { for (let i = 0; i < H.B.length; i++) skel.boneInverses[this.N + i].copy(H.B[i].inv); }
  // characters.js buildCharacter, once the rig is built
  finish(root) {
    const U = root.userData;
    this.root = root;
    U.hero = this;
    HERO_STATS.chars++;
    const ob = U.bones;
    this.ob = ob;
    this.mapOld = H.B.map((d) => (d.old ? ob[d.old] : null));
    // where the outfit's bones sit on the new body at rest (old frame offsets from the mapped UAL joint)
    this.dOff = {};
    for (const n of OLD_ORDER) this.dOff[n] = H.off[n] || null;
    for (const n of OLD_ORDER) if (ob[n] && !ob[n].userData.hrRest) ob[n].userData.hrRest = ob[n].position.clone();
    for (const n of ['weaponR', 'weaponL']) if (ob[n] && !ob[n].userData.hrRest) ob[n].userData.hrRest = ob[n].position.clone();
    if (ob.head) ob.head.scale.setScalar(H.headK); // helms and hoods fit the new head
    // the clips (sampled by hand: clipTable / sampleInto above); loco clips are phase-synced, the rest run on this.tClip
    this.acts = new Map();
    const names = new Set(['Idle_Loop', 'Jump_Loop', ...SPEED.keys()]);
    const ci = COMBAT_IDLE[U.kind || this.kind];
    if (ci) names.add(ci);
    this.combatIdle = ci || null;
    for (const n of names) { const s = clipTable(n); if (s) this.acts.set(n, s); }
    this.phase = 0; this.tClip = 0;
    this.sl = []; // the [table, time, weight] list post() hands to sampleInto
    // the standing clips stand turned (UAL Idle_Loop faces ~30-40 deg off): measured once, turned back in post()
    H.yaw ||= {};
    for (const n of ['Idle_Loop', ci]) if (n && H.yaw[n] === undefined && this.acts.has(n)) {
      sampleInto(this.ub, [[this.acts.get(n), 0, 1]], 1);
      const q = new THREE.Quaternion(), fwd = new THREE.Vector3();
      let yaw = 0;
      for (const bn of ['pelvis', 'spine_03']) {
        q.identity();
        const chain = []; for (let d = H.byName[bn]; d; d = d.parent >= 0 ? H.B[d.parent] : null) chain.unshift(d.i);
        for (const i of chain) q.multiply(this.ub[i].quaternion);
        q.multiply(q2.copy(H.byName[bn].W).invert()); // the clip's turn of this bone from its rest
        fwd.set(0, 0, 1).applyQuaternion(q);
        yaw += Math.atan2(fwd.x, fwd.z) / 2;
      }
      H.yaw[n] = yaw;
    }
    this.Qf = H.B.map(() => new THREE.Quaternion());
    this.Pf = H.B.map(() => new THREE.Vector3());
    this.actList = [...this.acts].map(([n, s]) => ({ n, s, loco: SPEED.has(n), dur: s.dur }));
    this.obArr = OLD_ORDER.map((n) => ob[n] || null);
    this.dOffArr = OLD_ORDER.map((n) => this.dOff[n]);
    this.Qo = OLD_ORDER.map(() => new THREE.Quaternion());
    this.Qn = OLD_ORDER.map(() => new THREE.Quaternion());
    this.Pn = OLD_ORDER.map(() => new THREE.Vector3());
    this.Qroot = new THREE.Quaternion(); this.dh = new THREE.Vector3(); this.anchor = new THREE.Quaternion();
    // the scene walk and the Animator's refresh reach the new bones through the wrapper: world matrices from the pose
    const self = this;
    this.wrap.updateMatrixWorld = function () { if (!self.inAnim) self.wrapUpdate(); };
    this.wrap.updateWorldMatrix = function () { self.wrapUpdate(); };
    this.clipArms = CLIP_ARMS.has(U.kind || this.kind);
    this.post(null, 0);
  }
  // a gear band's reach (characters.js gearReach): a body vertex bound to the UAL skeleton, as it would sit on the
  // old rig at rest (so the band code measures the new body round the old bone axes)
  oldRest(bi, x, y, z, out) {
    let d = H.B[bi - this.N];
    if (!d) return out.set(x, y, z);
    while (d && !d.old) d = d.parent >= 0 ? H.B[d.parent] : null;
    if (!d) return out.set(x, y, z);
    // Q'_b at UAL rest = W * Rref^-1 = A^-1; P'_b = P_u + Q'_b * dOff
    const Qb = q1.copy(d.A).invert();
    const Pb = v3b.copy(this.dOff[d.old] || v3b.set(0, 0, 0)).applyQuaternion(Qb).add(d.P);
    out.set(x, y, z).sub(Pb).applyQuaternion(Qb.invert());
    const R = this.root.userData.rest[d.old];
    return out.add(v3.set(R[0], R[1], R[2]));
  }
  // anim.js update(), first thing: the old bones back at their own rest offsets (the Animator's IK reads them)
  pre(anim) {
    const OB = this.obArr;
    for (let k = 0; k < OB.length; k++) { const b = OB[k]; if (b) b.position.copy(b.userData.hrRest); }
    this.inAnim = true; // (the Animator's own matrix refresh need not touch the new bones: post() sets them)
    // the old rig's foot IK only matters while a skill owns the legs (the clips plant their own feet)
    if (anim && !anim._heroIK) { anim._heroIK = anim.solveLegs; const self = this; anim.solveLegs = function (dt) { if (self.lastWL > 0 || this.action || this.dead) return this._heroIK(dt); this.plantLift = 0; }; }
  }
  // anim.js: nothing for the retarget layer to carry (a townsperson walking or standing, no skill, flinch or death)
  // (the flinch counts as over at the threshold anim.js stops advancing flinchT at: 0.6, or 0.95 for kind 2)
  clipOnly(anim) { return this.clipArms && !anim.action && !anim.dead && !anim.drop && !(anim.flinchT < (anim.flinchKind === 2 ? 0.95 : 0.6)); }
  // per-LOD tables for post() (built once)
  static tables() {
    if (H.T) return H.T;
    const OI = Object.fromEntries(OLD_ORDER.map((n, k) => [n, k]));
    const T = {
      par: Int16Array.from(H.B, (d) => d.parent),
      grp: Uint8Array.from(H.B, (d) => ({ L: 0, S: 1, T: 2, A: 3, F: 4 })[d.group]),
      oi: Int16Array.from(H.B, (d) => (d.old ? OI[d.old] : -1)),
      oldPar: Int16Array.from(OLD_ORDER, (n) => (OLD_PARENT[n] === 'root' ? -1 : OI[OLD_PARENT[n]])),
      uOf: Int16Array.from(OLD_ORDER, (n) => H.B.findIndex((d) => d.old === n)),
      i01: H.byName.spine_01.i, i02: H.byName.spine_02.i, i03: H.byName.spine_03.i, iPel: H.byName.pelvis.i,
      iSpine: OI.spine, iChest: OI.chest, iHips: OI.hips,
      hands: [['weaponR', 'socket_hand_r', OI.handR, H.byName.hand_r.i], ['weaponL', 'socket_hand_l', OI.handL, H.byName.hand_l.i]],
    };
    return (H.T = T);
  }
  // anim.js update(), last thing (anim null: the rest pose at build time)
  post(anim, dt) {
    const T = HeroRig.tables(), B = H.B, ub = this.ub, S = HERO_SCALE, nB = B.length;
    // ---- 1. mixer weights (locomotion clips, phase-synced; standing clips turned back to face forward)
    const sp = anim ? anim.speed : 0, moveK = anim ? clamp(sp / 1.2, 0, 1) : 0, air = anim ? clamp(anim.air, 0, 1) : 0;
    const combat = anim ? anim.combat : 0, md = anim ? anim.moveDir || 0 : 0;
    const W = this._wm || (this._wm = new Map());
    W.clear();
    const ground = 1 - air, ci = this.combatIdle;
    W.set('Idle_Loop', (1 - moveK) * ground * (ci ? 1 - combat : 1));
    if (ci) W.set(ci, (1 - moveK) * ground * combat);
    if (moveK > 0) {
      const c = Math.cos(md), s = Math.sin(md);
      let wF = Math.max(0, c), wB = Math.max(0, -c), wS = Math.abs(s);
      const t = wF + wB + wS || 1; wF /= t; wB /= t; wS /= t;
      const k = moveK * ground, vs = Math.max(sp, 0.3);
      if (wF > 0) ladder(LOCO.F, vs, W, k * wF);
      if (wB > 0) ladder(LOCO.B, vs, W, k * wB);
      if (wS > 0) ladder(s > 0 ? LOCO.L : LOCO.R, vs, W, k * wS);
      let stride = 0, tw = 0;
      for (const [n, w] of W) { const v = SPEED.get(n); if (v && w > 0) { stride += w * v * H.clips[n].duration; tw += w; } }
      if (tw > 0) this.phase = (this.phase + (dt * sp) / (stride / tw)) % 1;
    }
    W.set('Jump_Loop', air);
    // (S0 review) UAL's Jog and Sprint lean the trunk 26 and 40 deg forward: at the game's run speeds (5.9-6.8 m/s, always
    // Sprint_Loop) every hero ran head-down like a sprinter. Stood back up at spine_01 to about 14-16 deg, the MMO run.
    const leanFix = (W.get('Jog_Fwd_Loop') || 0) * 0.2 + (W.get('Sprint_Loop') || 0) * 0.5;
    // (S0 review: no pose may leak on from a skill or the last frame: sampleInto writes every bone, rest-blended)
    this.tClip = (this.tClip + dt) % 3600;
    const sl = this.sl;
    let nl = 0;
    for (const e of this.actList) {
      const w = W.get(e.n) || 0;
      if (w <= 1e-4) continue;
      const it = sl[nl] || (sl[nl] = [null, 0, 0]);
      it[0] = e.s; it[1] = e.loco ? this.phase * e.dur : this.tClip % e.dur; it[2] = w; nl++;
    }
    sampleInto(ub, sl, nl);
    // ---- 2. retarget weights: upper body from the skill, legs when the skill owns them
    const dead = anim?.dead ? 1 : 0;
    const wU = anim ? clamp(Math.max(anim.actW || 0, dead, (anim.flinch || 0) * 0.6), 0, 1) : 1;
    const wL = anim ? clamp(Math.max(anim.actLegW || 0, dead), 0, 1) : 1;
    const wA = this.clipArms ? wU : 1;
    this.inAnim = false; this.lastWL = wL;
    // ---- 3. the old pose in character space
    const OB = this.obArr, Qo = this.Qo, nO = OB.length;
    const Qroot = this.Qroot.copy(this.ob.root.quaternion);
    for (let k = 0; k < nO; k++) { const b = OB[k]; if (!b) continue; const p = T.oldPar[k]; Qo[k].multiplyQuaternions(p < 0 ? Qroot : Qo[p], b.quaternion); }
    const hipsRest = OB[T.iHips].userData.hrRest;
    const dh = this.dh.copy(OB[T.iHips].position).sub(hipsRest).multiplyScalar(1.12).applyQuaternion(Qroot);
    // ---- 4. the wrapper: the Animator's turn and the action's root offset (not the old loco bob: the clips bob)
    const wrap = this.wrap;
    if (anim) { const ro = anim.rootOffset; wrap.position.set(ro.x, ro.y - (anim.locoHipsY || 0), ro.z).applyQuaternion(Qroot); } else wrap.position.set(0, 0, 0);
    let yaw = anim ? anim.turnOffset || 0 : 0;
    if (H.yaw) { yaw -= (H.yaw.Idle_Loop || 0) * (W.get('Idle_Loop') || 0) * (1 - wL); if (ci && H.yaw[ci]) yaw -= H.yaw[ci] * (W.get(ci) || 0) * (1 - wL); }
    wrap.quaternion.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
    const Qwrap = wrap.quaternion, Pwrap = wrap.position;
    // ---- 5. the final pose top-down (character space)
    const Qf = this.Qf, Pf = this.Pf, anchor = this.anchor;
    for (let i = 0; i < nB; i++) {
      const bone = ub[i], pi = T.par[i];
      const pq = pi >= 0 ? Qf[pi] : Qwrap, pp = pi >= 0 ? Pf[pi] : Pwrap;
      Pf[i].copy(bone.position).multiplyScalar(S).applyQuaternion(pq).add(pp);
      const q = Qf[i].multiplyQuaternions(pq, bone.quaternion);
      const g = T.grp[i], oi = T.oi[i];
      let w = 0;
      if (oi >= 0) w = g === 0 ? wL : g === 1 ? 0.5 * (wL + wU) : g === 2 ? wU : g === 3 ? wA : 0;
      else if (i === T.i02) w = wU;
      if (w > 0) {
        const ret = q1;
        if (i === T.i02) ret.copy(Qo[T.iSpine]).slerp(Qo[T.iChest], 0.5); else ret.copy(Qo[oi]);
        if (g === 3) ret.premultiply(anchor); // arms ride the chest as the clip moves it
        ret.multiply(B[i].Rref);
        if (w >= 1) q.copy(ret); else q.slerp(ret, w);
      }
      q.normalize(); // (the packed int16 tracks are not quite unit; Quaternion.invert assumes unit)
      if (i === T.iPel && wL > 0) {
        // the old hips' travel on the pelvis rest (the in-place clips leave travel to the root offsets)
        v3.copy(B[i].P).applyQuaternion(Qroot).add(dh);
        Pf[i].lerp(v3, wL);
      }
      // (S0 perf review: the pose is not written back into the bones' own position and rotation any more: every reader
      // takes Qf / Pf (wrapUpdate, step 6, the hand sockets) and sampleInto rewrites every bone each frame)
      // the run lean fix turns the pose only (Qf), never the bone's own rotation: the mixer leaves a bone it blends at
      // under full weight partly as last frame left it, so a fix written there would pile up frame on frame
      if (i === T.i01 && leanFix > 0.001) {
        const k = leanFix * (1 - w), s2 = Math.sin(-k / 2);
        q.premultiply(q1.copy(Qwrap).multiply(v3q.set(s2, 0, 0, Math.cos(k / 2))).multiply(q2.copy(Qwrap).invert()));
      }
      if (i === T.i03) anchor.copy(q).multiply(B[i].RrefInv).multiply(q1.copy(Qo[T.iChest]).invert());
    }
    // ---- 6. the old bones onto the new body: rotation Qf * Rref^-1, joint at the UAL joint plus the landmark offset
    const Qn = this.Qn, Pn = this.Pn, dOff = this.dOffArr;
    for (let k = 0; k < nO; k++) {
      const u = T.uOf[k], b = OB[k];
      if (u < 0 || !b) continue;
      Qn[k].multiplyQuaternions(Qf[u], B[u].RrefInv);
      Pn[k].copy(Pf[u]);
      if (dOff[k]) Pn[k].add(v3.copy(dOff[k]).applyQuaternion(Qn[k]));
      const p = T.oldPar[k];
      const qi = q2.copy(p < 0 ? Qroot : Qn[p]).invert();
      b.quaternion.multiplyQuaternions(qi, Qn[k]);
      if (p < 0) b.position.copy(Pn[k]).applyQuaternion(qi); else b.position.copy(Pn[k]).sub(Pn[p]).applyQuaternion(qi);
    }
    // weapons into the hand sockets (not while a dropped weapon lies on the ground)
    if (!anim?.drop) for (const [wn, sn, hk, hi] of T.hands) {
      const wb = this.ob[wn], s = this.sock[sn];
      if (!wb || !s) continue;
      v3.copy(s.position).multiplyScalar(S).applyQuaternion(Qf[hi]).add(Pf[hi]);
      wb.position.copy(v3).sub(Pn[hk]).applyQuaternion(q2.copy(Qn[hk]).invert());
    }
    // matrices: the old rig by its own walk, the new bones straight from the character-space pose
    this.ob.root.updateMatrixWorld(true);
    this.wrapUpdate();
  }
  // the UAL bones' world matrices from the pose post() computed (cheaper than three's walk); the scene walk and the
  // Animator's own refresh reach them through wrap.updateMatrixWorld
  wrapUpdate() {
    const cm = this.root.matrixWorld, Qf = this.Qf, Pf = this.Pf, ub = this.ub, S = HERO_SCALE;
    for (let i = 0; i < ub.length; i++) { m4.compose(Pf[i], Qf[i], v3b.set(S, S, S)); ub[i].matrixWorld.multiplyMatrices(cm, m4); }
    for (const k in this.sock) { const s = this.sock[k]; s.matrixWorld.multiplyMatrices(s.parent.matrixWorld, s.matrix); }
  }
}
// (tests only: tools check the clip sampler against three's AnimationMixer)
export const heroSamplerTest = { clipTable: (n) => clipTable(n), sampleInto: (ub, list) => sampleInto(ub, list, list.length) };
