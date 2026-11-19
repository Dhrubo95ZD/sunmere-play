// Skill choreography: a unique keyframed animation + effect timeline for every skill.
// Angles in degrees. Bones: arm x<0 raises forward/up; armR z<0 / armL z>0 lifts out to the side;
// fore x<0 bends the elbow; weapon pitch = arm.x + fore.x + hand.x (-90 up, 0 forward, +90 down);
// spine/chest x>0 bends forward, y>0 twists left; thigh x<0 swings forward, shin x>0 bends the knee.
// root: hips offset [x, y, z] (z forward). turn: whole-body spin (deg, + = to the left).
import { compileClip } from './anim.js';
import { SKILLS, SKILL_BY_ID } from '/sunmere-play/shared/classes.js';
import { FUSION_BY_ID } from '/sunmere-play/shared/fusions.js';
import { CORE_BY_ID } from '/sunmere-play/shared/kit.js'; // (S10: the Deadeye's new contact times; its core skills keep their legacy ids) // (S4: a fusion's own clip times itself by the fusion's hit)
import { STANCES } from './anim.js';
import * as THREE from 'three';
import { HUMANOID } from '../assets/rig.js';

const P = (...o) => Object.assign({}, ...o);
const LG = { thighL: [-14, 0, 4], shinL: [26], footL: [-12], thighR: [-6, 0, -4], shinR: [18], footR: [-12] };
const L = {
  guard: LG,
  lungeL: { thighL: [-62, 0, 6], shinL: [58], footL: [6], thighR: [30, 0, -4], shinR: [24], footR: [30] },
  lungeR: { thighR: [-62, 0, -6], shinR: [58], footR: [6], thighL: [30, 0, 4], shinL: [24], footL: [30] },
  stepL: { thighL: [-34, 0, 6], shinL: [32], footL: [-2], thighR: [12, 0, -4], shinR: [20], footR: [10] },
  stepBack: { thighL: [10, 0, 4], shinL: [30], footL: [6], thighR: [-30, 0, -4], shinR: [36], footR: [-10] },
  wide: { thighL: [-12, 0, 22], shinL: [38], footL: [-14], thighR: [-12, 0, -22], shinR: [38], footR: [-14] },
  deep: { thighL: [-78, 0, 12], shinL: [118], footL: [-40], thighR: [-62, 0, -12], shinR: [112], footR: [-44] },
  tuck: { thighL: [-100, 0, 8], shinL: [122], footL: [12], thighR: [-74, 0, -8], shinR: [124], footR: [14] },
  air: { thighL: [-40, 0, 6], shinL: [60], footL: [20], thighR: [10, 0, -6], shinR: [70], footR: [30] },
  kneel: { thighL: [-90, 0, 6], shinL: [92], footL: [-4], thighR: [14, 0, -4], shinR: [106], footR: [56] },
  kickR: { thighR: [-104, 0, -4], shinR: [8], footR: [-16], thighL: [8, 0, 4], shinL: [22], footL: [-8] },
  sweepR: { thighR: [-40, 0, -60], shinR: [10], footR: [-10], thighL: [-70, 0, 10], shinL: [110], footL: [-30] },
  stand: { thighL: [0], shinL: [0], footL: [0], thighR: [0], shinR: [0], footR: [0] },
};
const R = { guard: [0, 0, 0], lunge: [0, -0.14, 0.28], deep: [0, -0.4, 0], kneel: [0, -0.44, -0.04], air: [0, 1.3, 0.3], high: [0, 2.2, 0.4], low: [0, -0.2, 0] };
const TRAIL = { knight: '#ffe6a0', ranger: '#e8f0c8', chemist: '#c49aff', sandblade: '#ffcf8a', warden: '#cbbd9e', herbalist: '#b8ff9a', deadeye: '#e8e4dc' };

function guard(cls) { return STANCES[cls].combat; }

// build a choreography from keys: [t, pose, {root, turn, e}] and events
function C(cls, dur, mask, keys, events, o = {}) {
  return { cls, dur, mask, keys, events, ...o };
}
const k = (t, p, x = {}) => ({ t, p, ...x });

// --------------------------------------------------------------------------
// Pose IK: arm angles solved from where the hands must be (forward kinematics over the rest skeleton),
// so bows are drawn to the face and aimed down the arrow instead of hand-tuned guesses.
const RAD = Math.PI / 180;
const REST = Object.fromEntries(HUMANOID.map(([n, par, o]) => [n, { parent: par, off: new THREE.Vector3(...o) }]));
const qE = (r) => new THREE.Quaternion().setFromEuler(new THREE.Euler((r?.[0] || 0) * RAD, (r?.[1] || 0) * RAD, (r?.[2] || 0) * RAD, 'XYZ'));
const deg = (q) => { const e = new THREE.Euler().setFromQuaternion(q, 'XYZ'); return [e.x, e.y, e.z].map((v) => Math.round((v / RAD) * 10) / 10); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function fk(pose) {
  const W = {};
  const get = (n) => {
    if (W[n]) return W[n];
    const d = REST[n], q = qE(pose[n]);
    if (!d.parent) return (W[n] = { p: d.off.clone(), q });
    const P0 = get(d.parent);
    return (W[n] = { p: d.off.clone().applyQuaternion(P0.q).add(P0.p), q: P0.q.clone().multiply(q) });
  };
  return get;
}
// two-bone arm IK in character space. wrist: target for the hand bone; pole: where the elbow points;
// hand axes in character space: y toward the wrist side of the fist, z the grip axis (sign picked for the least wrist twist)
function armIK(get, side, wrist, pole, hy, hz, fixedZ = false) {
  const clav = get('clav' + side), S = get('arm' + side).p;
  const a = REST['fore' + side].off.length(), c = REST['hand' + side].off.length();
  const T = wrist.clone();
  let d = T.distanceTo(S);
  if (d > (a + c) * 0.998) { d = (a + c) * 0.998; T.sub(S).setLength(d).add(S); }
  const u = T.clone().sub(S).normalize();
  const x0 = (a * a - c * c + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x0 * x0));
  const pv = pole.clone().sub(S); pv.addScaledVector(u, -pv.dot(u)).normalize();
  const E = S.clone().addScaledVector(u, x0).addScaledVector(pv, h);
  const yA = S.clone().sub(E).normalize();
  const w = T.clone().sub(E); const zA = w.addScaledVector(yA, -w.dot(yA)).normalize();
  const qArmW = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(yA, zA), yA, zA));
  const bend = Math.acos(THREE.MathUtils.clamp(E.clone().sub(S).normalize().dot(T.clone().sub(E).normalize()), -1, 1));
  const qForeW = qArmW.clone().multiply(qE([-bend / RAD, 0, 0]));
  if (typeof hy === 'function') hy = hy(E, T);
  let best = null;
  for (const sgn of fixedZ ? [1] : [1, -1]) {
    // the grip axis is kept exactly; the fist's other axis bends to suit it (wrist)
    const z = hz.clone().normalize().multiplyScalar(sgn), y = hy.clone(); y.addScaledVector(z, -y.dot(z)).normalize();
    const qHandW = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z));
    const hd = deg(qForeW.clone().invert().multiply(qHandW));
    const cost = Math.abs(hd[0]) + Math.abs(hd[1]) + Math.abs(hd[2]);
    if (!best || cost < best.cost) best = { hd, cost };
  }
  return { ['arm' + side]: deg(clav.q.clone().invert().multiply(qArmW)), ['fore' + side]: [Math.round((-bend / RAD) * 10) / 10, 0, 0], ['hand' + side]: best.hd };
}
// One-hand weapon pose: wrist at `at`, weapon (blade, haft, rod) pointing along `dir`, elbow toward `pole`.
// Returns the torso merged with the solved arm, so keys read as "where the weapon is" rather than joint angles.
function wield(torso, at, dir, pole, side = 'R', hy = null) {
  const get = fk(torso);
  const S = get('arm' + side).p;
  const pv = pole ? V(...pole) : S.clone().add(V(side === 'R' ? -0.3 : 0.3, -0.2, 0.1));
  const out = { ...torso, ...armIK(get, side, V(...at), pv, hy || ((E, T) => E.clone().sub(T)), V(...dir), true) };
  out['hand' + side].ik = true; // solved, so the sweep lint below knows the roll is intended
  return out;
}
// Flat sweep pose: the right wrist on a level arc around the (twisted) right shoulder at angle a
// (deg; 0 straight ahead, + toward the left side), the blade level and pointing out along the arc,
// `lead` degrees ahead of the wrist. The torso twists with the swing while the head keeps facing the target.
function arc(a, o = {}) {
  const tw = o.twist ?? THREE.MathUtils.clamp(a, -110, 110) * 0.5;
  const torso = { spine: [o.bend ?? 10, tw * 0.6, o.roll ?? 0], chest: [o.chest ?? 4, tw * 0.4, 0], neck: [0, -tw * 0.35, 0], head: [o.headX ?? 4, -tw * 0.5, 0], ...(o.torso || {}) };
  const get = fk(torso);
  const S = get('armR').p;
  const r = o.r ?? 0.44, dy = o.dy ?? -0.2;
  const ra = a * RAD, la = (a + (o.lead ?? 0)) * RAD;
  const at = [S.x + Math.sin(ra) * r, S.y + dy, S.z + Math.cos(ra) * r];
  const dir = [Math.sin(la) * Math.cos((o.tilt ?? 0) * RAD), Math.sin((o.tilt ?? 0) * RAD), Math.cos(la) * Math.cos((o.tilt ?? 0) * RAD)];
  // fist turned so the blade lies flat to the cut (knuckles up), elbow kept down
  const hy = (E, T) => V(0, 1, 0).addScaledVector(E.clone().sub(T).normalize(), 0.35);
  return wield(torso, at, dir, o.pole || [S.x - 0.15, S.y - 0.8, S.z + 0.15], 'R', hy);
}
// how far the hips drop when this leg pose stands with its lowest foot on the ground (what the animator's
// foot planting will do), so weapon targets can be placed in world terms
const ANKLE_REST = (() => { const g = fk({}); return g('footL').p.y; })();
function legDrop(legs) {
  const g = fk(legs);
  return ANKLE_REST - Math.min(g('footL').p.y, g('footR').p.y);
}
// Overhead blow that lands the weapon head on a point in front of the feet (character space, flat ground):
// dir is the haft direction at impact, len the head's distance along the haft from the hand; the hips drop the
// leg pose will cause (and the root's forward shift) are taken out so the head really lands there.
function slamAt(torso, legs, head, dir, len, rootZ = 0, pole = null, twoHands = false) {
  const drop = legDrop(legs);
  const d = V(...dir).normalize();
  const w = V(...head).addScaledVector(d, -len);
  const at = [w.x, w.y - drop, w.z - rootZ];
  const out = wield(torso, at, [d.x, d.y, d.z], pole || [-0.6, 0.8, 0.2]);
  if (!twoHands) return out;
  // the off hand grips lower on the haft
  const l = V(...at).addScaledVector(d, -0.26);
  return wield(out, [l.x + 0.04, l.y, l.z], [d.x, d.y, d.z], [0.6, 0.8, 0.2], 'L');
}
// weapon raised overhead, haft back over the right shoulder
function overhead(torso, twoHands = false) {
  const out = wield(torso, [-0.2, 1.96, -0.04], [0.1, 0.4, -0.91], [-0.7, 1.75, 0.25]);
  return twoHands ? wield(out, [-0.12, 1.86, 0.18], [0.1, 0.4, -0.91], [0.6, 1.7, 0.25], 'L') : out;
}
// Swing keys from angles: wind -> mid ('in', accelerating) -> contact ('linear', at the hit time) -> follow ('out')
// -> settle. Segment lengths come from a constant peak angular speed v (deg/s), so the blade never stalls at the hit.
// seq: { wind, mid, hit, follow, end } each [angle, poseFn(angle) extras]; tHit seconds; returns keys.
function swing(dur, tHit, s, pose, v = 1300, settle = 0.13) {
  const tC = tHit / dur;
  const T2 = Math.abs(s.hit - s.mid) / v / dur, T1 = (2 * Math.abs(s.mid - s.wind)) / v / dur, T3 = (2 * Math.abs(s.follow - s.hit)) / v / dur;
  const keys = [
    k(tC - T2 - T1, ...pose(s.wind, 'wind', 'smooth')),
    k(tC - T2, ...pose(s.mid, 'mid', 'in')),
    k(tC, ...pose(s.hit, 'hit', 'linear')),
    k(tC + T3, ...pose(s.follow, 'follow', 'out')),
  ];
  if (s.end != null) keys.push(k(tC + T3 + settle / dur, ...pose(s.end, 'end')));
  return keys;
}
// Leap slam landing: from the cocked apex key A (arriving 'out') to the contact key B, through a touch-down key
// `tail` seconds before contact where the blow is g of the way through (pose blended) and the legs reach for the
// ground. The fall eases in from the apex hang and runs straight through the touch-down, so the foot planting that
// takes over as the hips near the ground gets a few frames instead of yanking the body down in one; the contact
// frame is then held. g is picked so the blade's speed carries over the touch-down key without a kink.
const LAND = { thighL: [-30, 0, 6], shinL: [30], footL: [-10], thighR: [-10, 0, -6], shinR: [24], footR: [-10] };
function mixPose(a, b, g) {
  const o = {};
  for (const n of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[n] || b[n], y = b[n] || a[n];
    o[n] = [0, 1, 2].map((i) => (x[i] || 0) + ((y[i] || 0) - (x[i] || 0)) * g);
    if (x.ik || y.ik) o[n].ik = true;
  }
  return o;
}
function slamFall(dur, A, B, g, rootM, tail = 0.06) {
  return [
    k(B.t - tail / dur, P(mixPose(A.p, B.p, g), LAND), { root: rootM, e: 'in' }),
    { ...B, e: 'linear' },
    k(B.t + 0.035 / dur, {}, { hold: true }),
  ];
}
// Archer pose: torso turned side-on, head looking down the arrow, bow arm straight toward the target,
// string hand anchored under the right jaw (draw 0..1 from the string at rest to the anchor), release flings it back.
function archer({ torso, pitch = 0, draw = 1, release = 0, anchor = [-0.08, -0.01, 0.13], reach = 0.62, cant = 8 }) {
  const dir = V(0, Math.sin(pitch * RAD), Math.cos(pitch * RAD));
  const left = V(1, 0, 0), upP = new THREE.Vector3().crossVectors(dir, left); // up, square to the arrow
  const pose = { neck: [0, 18, 0], ...torso };
  let get = fk(pose);
  const qHeadW = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(dir, V(0, 0, 0), V(0, 1, 0)));
  pose.head = deg(get('neck').q.clone().invert().multiply(qHeadW));
  get = fk(pose);
  const H = get('head');
  const A = V(...anchor).applyQuaternion(H.q).add(H.p);
  // bow: grip on the arrow line one draw length ahead of the anchor; grip axis canted a touch
  const bowDir = draw >= 1 ? dir : V(0, Math.sin((pitch - 12 * (1 - draw)) * RAD), Math.cos((pitch - 12 * (1 - draw)) * RAD));
  const gripAxis = upP.clone().multiplyScalar(Math.cos(cant * RAD)).addScaledVector(left, -Math.sin(cant * RAD));
  const grip = A.clone().addScaledVector(bowDir, reach * (0.86 + 0.14 * Math.min(1, draw))).addScaledVector(upP, -0.05);
  const wristL = grip.clone().addScaledVector(bowDir, -0.06).addScaledVector(gripAxis, -0.02);
  const sL = get('armL').p, sR = get('armR').p;
  const bow = armIK(get, 'L', wristL, sL.clone().add(V(0.3, -0.3, 0)), bowDir.clone().negate(), gripAxis);
  // string hand: from the string at rest (just behind the grip) to the anchor, then flung back past the ear
  const rest = grip.clone().addScaledVector(bowDir, -0.17);
  const hook = rest.clone().lerp(A, Math.min(1, draw)).addScaledVector(dir, -0.18 * release).add(V(-0.05 * release, 0.02 * release, 0));
  const wristR = hook.clone().addScaledVector(dir, -0.07);
  const str = armIK(get, 'R', wristR, sR.clone().add(V(0.45, 0.08, -0.1)), dir.clone().negate().add(V(-0.25 * release, 0, 0)), upP);
  return { ...pose, ...bow, ...str };
}

const DEF = {};

// Stances solved from where the weapon should sit, written into the shared table before any clip reads a guard:
// the knight's guard keeps the blade canted out and forward (the helm slit stays clear), and the casters hold
// their staff and rod beside the hood or goggles instead of in front of them.
{
  const get = fk({});
  const hy = (E, T) => E.clone().sub(T);
  const S = (at, dir, pole) => { const o = armIK(get, 'R', V(...at), V(...pole), hy, V(...dir).normalize(), true); o.handR.ik = true; return o; };
  STANCES.knight.combat = { ...STANCES.knight.combat, ...S([-0.3, 1.24, 0.3], [-0.57, 0.77, 0.28], [-0.75, 1.0, 0.0]) };
  for (const c of ['chemist', 'herbalist']) {
    STANCES[c].idle = { ...STANCES[c].idle, ...S([-0.31, 1.0, 0.12], [-0.16, 0.985, -0.06], [-0.7, 1.1, -0.2]) };
    STANCES[c].combat = { ...STANCES[c].combat, ...S([-0.33, 1.1, 0.22], [-0.2, 0.975, 0.02], [-0.7, 1.1, -0.1]) };
  }
}

// ============================== KNIGHT ====================================
{
  const G = P(guard('knight'), { spine: [8, 0, 0], chest: [0, 0, 0] });
  const GL = P(G, LG);
  const SH = { armL: [-48, 72, 26], foreL: [-100, 0, 0] };
  const T = TRAIL.knight;
  // Valiant Strike: sword rises over the right shoulder, cuts diagonally through the target, ends low by the left hip
  const KT = {
    lift: { spine: [6, -12, 0], chest: [0, -6, 0], neck: [0, 6, 0], head: [0, 12, 0] },
    wind: { spine: [2, -30, 0], chest: [-6, -18, 0], neck: [0, 12, 0], head: [0, 30, 0] },
    cut: { spine: [16, 24, 0], chest: [8, 16, 0], neck: [0, -8, 0], head: [6, -26, 0] },
    end: { spine: [20, 36, 0], chest: [8, 22, 0], neck: [0, -10, 0], head: [8, -32, 0] },
  };
  DEF.k_valiant = C('knight', 0.8, 'full', [
    k(0, GL, { root: R.guard }),
    k(0.1, P(SH, wield(KT.lift, [-0.32, 1.58, 0.16], [0.05, 0.9, 0.42], [-0.6, 1.3, 0.2]), LG), { root: [0, -0.02, 0] }),
    k(0.32, P(SH, wield(KT.wind, [-0.3, 1.9, -0.06], [0.3, 0.62, -0.72], [-0.75, 1.55, 0.2]), L.stepBack), { root: [0, -0.04, -0.06] }),
    k(0.43, P(SH, wield(KT.cut, [-0.02, 1.34, 0.52], [0.56, -0.3, 0.77], [-0.5, 1.1, 0.25]), L.lungeL), { root: [0, -0.12, 0.22], e: 'snap' }),
    k(0.58, P(SH, wield(KT.end, [0.2, 1.02, 0.34], [0.5, -0.72, -0.48], [-0.35, 0.85, 0.35]), L.lungeL), { root: [0, -0.12, 0.22] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.22, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.25, stop: 0.05 }, { t: 0.62, e: 'trail', on: false }, { t: 0.26, e: 'sound', s: 'swing' }], { strike: 0.17 });

  DEF.k_bash = C('knight', 0.75, 'full', [
    k(0, GL),
    k(0.22, P(G, { spine: [-4, -26, 0], armL: [-40, 80, 40], foreL: [-110, 0, 0], armR: [-20, 0, -30] }, L.stepBack), { root: [0, -0.06, -0.08] }),
    k(0.38, P(G, { spine: [22, 24, 0], chest: [8, 18, 0], armL: [-88, 18, 6], foreL: [-28, -20, 0], armR: [-10, 0, -40], head: [10, -10, 0] }, L.lungeL), { root: [0, -0.1, 0.32], e: 'snap' }),
    k(0.55, P(G, { spine: [16, 14, 0], armL: [-74, 30, 10], foreL: [-50, 0, 0] }, L.stepL), { root: [0, -0.06, 0.2] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 'hit', e: 'impact', kind: 'shield', shake: 0.45, stop: 0.08 }, { t: 0.36, e: 'dust' }, { t: 0.3, e: 'sound', s: 'whoosh' }]);

  // Rising Cut: the blade starts low behind the right hip, is driven up the front through the target (the contact
  // key sits on the hit, arm level ahead) and carried on up to overhead. Every key-to-key swing of the arm is well
  // under 180 deg (20 -> -72 -> -158 -> -152 -> guard), so the clip compiler's short way round is always up the front;
  // with one 218 deg step to -190 it went round behind the back and spun a full turn on the way back to guard.
  DEF.k_rising = C('knight', 0.82, 'full', [
    k(0, GL),
    k(0.2, P(SH, { spine: [26, -26, 6], chest: [8, -16, 0], armR: [20, -10, -30], foreR: [-20, 0, 0], handR: [40, 0, 0], head: [-6, 18, 0] }, L.deep), { root: [0, -0.32, 0] }),
    k(0.3 / 0.82, P(SH, { spine: [10, 4, 0], chest: [0, 4, 0], armR: [-72, 14, -24], foreR: [-14, 0, 0], handR: [36, 0, 0], head: [-8, 2, 0] }, L.stepL), { root: [0, -0.1, 0.06], e: 'snap' }),
    k(0.54, P(SH, { spine: [-14, 26, -6], chest: [-10, 18, 0], armR: [-160, 30, -10], foreR: [-10, 0, 0], handR: [-10, 0, 0], head: [-20, -10, 0] }, P(L.stand, { thighR: [-20, 0, -4], shinR: [10] })), { root: [0, 0.18, 0.1] }),
    k(0.68, P(SH, { spine: [-6, 18, 0], armR: [-152, 20, -20], foreR: [-30, 0, 0] }), { root: [0, 0.05, 0.05] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.2, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.3, stop: 0.05 }, { t: 0.66, e: 'trail', on: false }, { t: 0.3, e: 'dust' }], { strike: 0.14 });

  DEF.k_rally = C('knight', 1.15, 'full', [
    k(0, GL),
    k(0.22, P(G, { spine: [24, 0, 0], armR: [-60, 0, -10], foreR: [-30, 0, 0], handR: [120, 0, 0], armL: [-40, 60, 20] }, L.kneel), { root: R.kneel }),
    k(0.45, P(G, { spine: [-14, 0, 0], chest: [-12, 0, 0], head: [-22, 0, 0], armR: [-60, 0, -10], foreR: [-20, 0, 0], handR: [110, 0, 0], armL: [-170, 30, 30], foreL: [-40, 0, 0] }, L.wide), { root: [0, -0.04, 0], e: 'snap' }),
    k(0.7, P(G, { spine: [-10, 0, 0], chest: [-14, 0, 0], head: [-18, 0, 0], armL: [-168, 26, 36], foreL: [-30, 0, 0] }, L.wide), {}),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.24, e: 'impact', kind: 'earth', at: 'front1', shake: 0.25 }, { t: 0.48, e: 'ring', color: '#ffd870', r: 14 }, { t: 0.5, e: 'aura', color: '#ffd870', dur: 2 }, { t: 0.48, e: 'sound', s: 'shout' }]);

  // Cleaving Arc: blade drawn back level behind the right hip, cut flat through a wide arc at waist height
  const LW = P(L.wide, { thighL: [-20, 0, 20], shinL: [40] });
  DEF.k_cleave = C('knight', 0.95, 'full', [
    k(0, GL),
    k(0.19, P(SH, arc(-115, { lead: -30, dy: -0.12, r: 0.38 }), LW), { root: [0, -0.1, 0] }),
    ...swing(0.95, 0.4, { wind: -125, mid: -60, hit: 5, follow: 70, end: 100 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -35 : role === 'mid' ? -15 : role === 'hit' ? 0 : 25, dy: -0.26 }), LW), { root: [0, -0.06, role === 'wind' ? -0.04 : 0.08], e }]),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.24, e: 'trail', on: true, color: T, w: 1.3 }, { t: 'hit', e: 'impact', kind: 'sweep', at: 'cone', r: 4.5, shake: 0.3, stop: 0.06 }, { t: 0.64, e: 'trail', on: false }, { t: 0.42, e: 'dust' }]);

  DEF.k_lunge = C('knight', 0.75, 'full', [
    k(0, GL),
    k(0.2, P(SH, { spine: [4, -30, 0], armR: [10, -30, -30], foreR: [-80, 0, 0], handR: [-10, 0, 0] }, L.stepBack), { root: [0, -0.1, -0.12] }),
    k(0.42, P(SH, { spine: [30, 22, 0], chest: [6, 10, 0], armR: [-92, 10, -4], foreR: [0, 0, 0], handR: [0, 0, 0], head: [-20, -10, 0] }, P(L.lungeL, { thighL: [-80, 0, 6], shinL: [70] })), { root: [0, -0.24, 0.5], e: 'snap' }),
    k(0.62, P(SH, { spine: [24, 16, 0], armR: [-86, 10, -4] }), { root: [0, -0.2, 0.4] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.22, e: 'dash' }, { t: 0.3, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'pierce', shake: 0.3, stop: 0.06 }, { t: 0.6, e: 'trail', on: false }]);

  DEF.k_guard = C('knight', 0.9, 'full', [
    k(0, GL),
    k(0.3, P(G, { spine: [18, -10, 0], chest: [6, 0, 0], armL: [-84, 76, 30], foreL: [-110, 0, 0], armR: [-40, 0, -20], foreR: [-90, 0, 0], handR: [40, 0, 0], head: [10, 0, 0] }, L.deep), { root: [0, -0.34, 0], e: 'snap' }),
    k(0.7, P(G, { spine: [18, -10, 0], armL: [-86, 76, 30], foreL: [-108, 0, 0] }, L.deep), { root: [0, -0.34, 0] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.3, e: 'impact', kind: 'shield', at: 'self', shake: 0.2 }, { t: 0.3, e: 'dust' }]); // (no aura ring: 10.2, and from above it sat inside Turning Riposte's ring)

  // Twin Slash: a flat forehand cut right-to-left, the blade carried round, then a flat backhand cut back across
  const twin = (dur, h1, h2, legs1, legs2, end = -80) => [
    ...swing(dur, h1, { wind: -95, mid: -45, hit: 5, follow: 60 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -30 : role === 'follow' ? 20 : -5, dy: -0.22 }), legs1), { root: [0, -0.04, role === 'wind' ? 0.04 : 0.12], e }], 1400),
    ...swing(dur, h2, { wind: 105, mid: 50, hit: -5, follow: -65, end }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? 30 : role === 'follow' || role === 'end' ? -20 : 5, dy: -0.2, r: role === 'wind' ? 0.36 : 0.44 }), legs2), { root: [0, -0.06, 0.22], e }], 1400),
  ];
  DEF.k_twin = C('knight', 0.95, 'full', [
    k(0, GL),
    ...twin(0.95, 0.24, 0.5, L.stepL, L.lungeL),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.08, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.2, stop: 0.045 }, { t: 'hit2', e: 'impact', kind: 'slash', shake: 0.25, stop: 0.06 }, { t: 0.66, e: 'trail', on: false }]);

  // Skybreaker: the sword comes up over the head on the way up and is cocked back at the top of the leap; the body
  // hangs a beat, then the fall and the blow accelerate together onto the point of the strike
  const SKY_A = k(0.4, P(SH, { spine: [-16, 0, 0], chest: [-10, 0, 0], armR: [-190, 0, -10], foreR: [-30, 0, 0], handR: [40, 0, 0], head: [-10, 0, 0] }, L.tuck), { root: [0, 2.1, 2.0], e: 'out' });
  const SKY_B = k(0.626, P(SH, { spine: [40, 0, 0], chest: [10, 0, 0], armR: [-70, 0, -10], foreR: [-4, 0, 0], handR: [40, 0, 0], head: [20, 0, 0] }, L.deep), { root: [0, -0.4, 4.0] });
  DEF.k_skybreaker = C('knight', 1.15, 'full', [
    k(0, GL),
    k(0.16, P(SH, { spine: [24, 0, 0], armR: [-30, 0, -20], foreR: [-40, 0, 0] }, L.deep), { root: R.deep }),
    SKY_A,
    ...slamFall(1.15, SKY_A, SKY_B, 0.65, [0, 0.5, 3.6]),
    k(0.76, P(SH, { spine: [36, 0, 0], armR: [-60, 0, -10], foreR: [-4, 0, 0], handR: [50, 0, 0] }, L.deep), { root: [0, -0.38, 4.0], e: 'out' }),
    k(1, GL, { root: [0, 0, 4.0], e: 'smooth' }),
  ], [{ t: 0.17, e: 'dust' }, { t: 0.16, e: 'leap' }, { t: 0.42, e: 'trail', on: true, color: T, w: 1.2 }, { t: 'hit', e: 'impact', kind: 'earth', at: 'self', r: 4, shake: 0.9, stop: 0.09 }, { t: 'hit', e: 'decal', kind: 'crack', r: 3.5 }, { t: 0.75, e: 'trail', on: false }], { endRoot: [0, 0, 4.0] });

  DEF.k_wind = C('knight', 1.4, 'full', [
    k(0, GL),
    k(0.25, P(G, { spine: [30, 0, 0], head: [30, 0, 0], armR: [-40, 0, -14], foreR: [-40, 0, 0], handR: [110, 0, 0], armL: [-20, 40, 20], foreL: [-60, 0, 0] }, L.kneel), { root: R.kneel }),
    k(0.55, P(G, { spine: [22, 0, 0], chest: [-6, 0, 0], head: [-10, 0, 0], armR: [-40, 0, -14], foreR: [-40, 0, 0], handR: [110, 0, 0] }, L.kneel), { root: [0, -0.42, -0.04] }),
    k(0.8, P(G, { spine: [14, 0, 0], chest: [-12, 0, 0], head: [-20, 0, 0] }, L.kneel), { root: R.kneel }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.3, e: 'motes', color: '#ffe08a', n: 40, dur: 1.4 }, { t: 0.85, e: 'impact', kind: 'heal', at: 'self' }]);

  DEF.k_spin = C('knight', 0.95, 'full', [
    k(0, GL, { turn: 0 }),
    // coil the other way, then the whole body turns with the blade held level and straight out to the right
    k(0.2, P(SH, arc(-60, { lead: -10, dy: -0.22, twist: -40 }), L.wide), { root: [0, -0.2, 0], turn: 40 }),
    k(0.55, P(SH, arc(-88, { lead: 12, dy: -0.22, twist: -20 }), L.wide), { root: [0, -0.24, 0], turn: -300, e: 'linear' }),
    k(0.72, P(SH, arc(-40, { lead: 25, dy: -0.24, twist: 10 }), L.wide), { root: [0, -0.18, 0], turn: -360, e: 'out' }),
    k(1, GL, { root: R.guard, turn: -360 }),
  ], [{ t: 0.22, e: 'trail', on: true, color: T, w: 1.4 }, { t: 'hit', e: 'impact', kind: 'sweep', at: 'self', r: 4, shake: 0.35 }, { t: 0.64, e: 'ring', color: '#ffe6a0', r: 4.5 }, { t: 0.58, e: 'trail', on: false }, { t: 0.3, e: 'dust' }]);
  // (review 18 Nov) the trail stops at about 300 deg (0.58) and the ring opens only once it has faded: from straight above
  // the ring round the arc of the trail read as an arc inside a ring (Turning Riposte, Sidewind Cut)

  // Pommel Strike: the hilt drawn back by the right ear with the blade turned up and back over the shoulder, then the
  // fist punched straight out so the pommel lands on the hit, the blade riding back along the forearm. Solved poses:
  // the old joint-angle wind-up flipped the blade over backward out of the guard (the tip whipped at 67 m/s).
  const PM = (sp, at, dir) => P(SH, wield({ spine: [sp[0], sp[1], 0], chest: [sp[0] * 0.3, sp[1] * 0.45, 0], head: [sp[0] * 0.3, -sp[1] * 0.8, 0] }, at, dir, [-0.7, 1.05, 0]));
  DEF.k_pommel = C('knight', 0.55, 'upper', [
    k(0, G),
    k(0.17, PM([-4, -24], [-0.32, 1.4, 0.04], [-0.3, 0.75, -0.59])),
    k(0.2 / 0.55, PM([20, 20], [-0.12, 1.34, 0.52], [-0.35, 0.6, -0.72]), { e: 'snap' }),
    k(0.62, PM([16, 16], [-0.16, 1.3, 0.44], [-0.35, 0.62, -0.7])),
    k(1, G),
  ], [{ t: 'hit', e: 'impact', kind: 'blunt', shake: 0.3, stop: 0.06 }], { strike: 0.1 });

  DEF.k_shieldthrow = C('knight', 0.9, 'upper', [
    k(0, G),
    k(0.3, P(G, { spine: [0, 50, 0], chest: [-6, 30, 0], armL: [-80, -30, 70], foreL: [-110, 0, 0], head: [0, -30, 0] })),
    k(0.44, P(G, { spine: [16, -40, 0], chest: [8, -24, 0], armL: [-90, 20, 10], foreL: [-6, 0, 0], head: [0, 10, 0] }), { e: 'snap' }),
    k(0.7, P(G, { spine: [12, -30, 0], armL: [-60, 0, 30], foreL: [-60, 0, 0] })),
    k(1, G),
  ], [{ t: 0.44, e: 'proj', kind: 'shield', from: 'L', spin: 18, ret: true }, { t: 0.44, e: 'hideAttach', bone: 'foreL', dur: 0.95 }, { t: 0.4, e: 'sound', s: 'whoosh' }]);

  DEF.k_riposte = C('knight', 1.05, 'full', [
    k(0, GL),
    // parry: blade raised across the front, rising to the left, catching the blow
    k(0.27, P(SH, wield({ spine: [0, -20, 0], chest: [-4, -6, 0], head: [0, 14, 0] }, [-0.16, 1.42, 0.36], [0.62, 0.72, 0.3], [-0.6, 1.2, 0.1]), L.stepBack), { root: [0, -0.1, -0.15], e: 'out' }),
    k(0.32, P(SH, wield({ spine: [-2, -24, 0], chest: [-4, -8, 0], head: [0, 16, 0] }, [-0.18, 1.44, 0.32], [0.6, 0.74, 0.28], [-0.6, 1.2, 0.1]), L.stepBack), { root: [0, -0.12, -0.16] }),
    // the answer: a flat forehand cut stepping in (a shorter draw-back, so the blade leaves the parry unhurried)
    ...swing(1.05, 0.55, { wind: -80, mid: -40, hit: 10, follow: 65, end: 80 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -30 : role === 'follow' || role === 'end' ? 22 : 0, dy: -0.2 }), role === 'wind' ? L.stepBack : L.lungeL), { root: role === 'wind' ? [0, -0.12, -0.1] : [0, -0.12, 0.3], e }], 1050),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.3, e: 'impact', kind: 'parry', at: 'weapon' }, { t: 0.45, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.4, stop: 0.08 }, { t: 0.72, e: 'trail', on: false }]);

  DEF.k_charge = C('knight', 1.0, 'full', [
    k(0, GL),
    k(0.12, P(SH, { spine: [26, 0, 0], armL: [-84, 50, 20], foreL: [-90, 0, 0], armR: [10, 0, -30], foreR: [-60, 0, 0], handR: [40, 0, 0] }, L.lungeL), { root: [0, -0.16, 0.2] }),
    k(0.3, P(SH, { spine: [28, 0, 0], armL: [-88, 40, 14], foreL: [-80, 0, 0] }, L.lungeR), { root: [0, -0.18, 2.5] }),
    k(0.42, P(SH, { spine: [30, 0, 0], armL: [-88, 40, 14], foreL: [-80, 0, 0] }, L.lungeL), { root: [0, -0.2, 5.0] }),
    k(0.52, P(SH, { spine: [12, 20, 0], armL: [-96, 20, 4], foreL: [-30, 0, 0] }, L.lungeL), { root: [0, -0.14, 6.6], e: 'snap' }),
    k(1, GL, { root: [0, 0, 6.6] }),
  ], [{ t: 0.1, e: 'dash' }, { t: 0.2, e: 'dust' }, { t: 0.35, e: 'dust' }, { t: 'hit', e: 'impact', kind: 'shield', shake: 0.6, stop: 0.09 }], { endRoot: [0, 0, 6.6] });

  DEF.k_sunder = C('knight', 0.95, 'full', [
    k(0, GL),
    // a quick lift overhead, then a long whip-eased drive down so the point lands in the ground ahead
    // (the arm stops just short of straight up, so the lift goes up the front and not round behind the hip)
    k(0.16, P(SH, { spine: [-10, 0, 0], chest: [-8, 0, 0], armR: [-160, 10, -14], foreR: [-40, 0, 0], handR: [15, 0, 0], head: [-14, 0, 0] }, L.stand), { root: [0, 0.06, 0] }),
    k(0.44, P(SH, { spine: [46, 0, 0], chest: [14, 0, 0], armR: [-60, 10, -10], foreR: [-10, 0, 0], handR: [88, 0, 0], head: [24, 0, 0] }, L.lungeL), { root: [0, -0.32, 0.3], e: 'snap' }),
    k(0.64, P(SH, { spine: [44, 0, 0], armR: [-56, 10, -10], foreR: [-10, 0, 0], handR: [90, 0, 0] }, L.lungeL), { root: [0, -0.3, 0.3] }),
    k(0.82, P(SH, { spine: [22, 0, 0], chest: [4, 0, 0], armR: [-60, 10, -14], foreR: [-40, 0, 0], handR: [20, 0, 0] }, L.stepL), { root: [0, -0.12, 0.12] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.2, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'pierce', shake: 0.45, stop: 0.07 }, { t: 'hit', e: 'decal', kind: 'crack', r: 1.4, at: 'front1' }, { t: 0.6, e: 'trail', on: false }], { strike: 0.26 });

  DEF.k_shout = C('knight', 0.95, 'full', [
    k(0, GL),
    k(0.2, P(G, { spine: [20, 0, 0], chest: [10, 0, 0], armR: [10, 0, -40], foreR: [-50, 0, 0], armL: [10, 40, 50], foreL: [-60, 0, 0] }, L.wide), { root: [0, -0.16, 0] }),
    k(0.38, P(G, { spine: [-18, 0, 0], chest: [-16, 0, 0], head: [-28, 0, 0], armR: [-30, 0, -70], foreR: [-30, 0, 0], handR: [-30, 0, 0], armL: [-30, 50, 70], foreL: [-40, 0, 0] }, L.wide), { root: [0, -0.12, 0], e: 'snap' }),
    k(0.7, P(G, { spine: [-14, 0, 0], chest: [-14, 0, 0], head: [-24, 0, 0] }, L.wide), {}),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.38, e: 'ring', color: '#ff9a6a', r: 10 }, { t: 0.4, e: 'ring', color: '#ffd8a0', r: 7, delay: 0.1 }, { t: 0.38, e: 'shake', amt: 0.35 }, { t: 0.38, e: 'sound', s: 'shout' }, { t: 0.38, e: 'dust' }]);

  DEF.k_arcwave = C('knight', 1.0, 'full', [
    k(0, GL),
    k(0.185, P(SH, { spine: [-6, -40, 0], chest: [-6, -20, 0], armR: [-160, -20, -30], foreR: [-35, 0, 0], handR: [20, 0, 0] }, L.stepBack), { root: [0, 0, -0.1] }),
    k(0.42, P(SH, { spine: [40, 20, 0], chest: [12, 10, 0], armR: [-40, 20, -10], foreR: [0, 0, 0], handR: [50, 0, 0], head: [16, 0, 0] }, L.lungeL), { root: [0, -0.3, 0.3], e: 'snap' }),
    k(0.62, P(SH, { spine: [38, 20, 0], armR: [-30, 20, -10], handR: [65, 0, 0] }, L.lungeL), { root: [0, -0.3, 0.3] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.2, e: 'trail', on: true, color: T, w: 1.3 }, { t: 0.43, e: 'wave', kind: 'dust', len: 16 }, { t: 0.43, e: 'shake', amt: 0.4 }, { t: 0.66, e: 'trail', on: false }], { strike: 0.25 });

  DEF.k_unbreakable = C('knight', 1.1, 'full', [
    k(0, GL),
    k(0.25, P(G, { spine: [20, 0, 0], armR: [-80, 0, -60], foreR: [-80, 0, 0], handR: [-60, 0, 0], armL: [-80, 60, 40], foreL: [-90, 0, 0] }, L.deep), { root: R.deep }),
    k(0.48, P(G, { spine: [-12, 0, 0], chest: [-10, 0, 0], head: [-14, 0, 0], armR: [-170, 0, -20], foreR: [-20, 0, 0], handR: [-10, 0, 0], armL: [-150, 30, 30], foreL: [-60, 0, 0] }, L.wide), { root: [0, -0.06, 0], e: 'snap' }),
    k(0.75, P(G, { spine: [-10, 0, 0], armR: [-168, 0, -20], foreR: [-20, 0, 0], armL: [-148, 30, 30], foreL: [-60, 0, 0] }, L.wide), {}),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.48, e: 'flash', color: '#ffe8a0' }, { t: 0.48, e: 'aura', color: '#ffd060', dur: 2.5 }, { t: 0.5, e: 'ring', color: '#ffe8a0', r: 5 }, { t: 0.3, e: 'dust' }]);

  DEF.k_kingsfall = C('knight', 1.75, 'full', [
    k(0, GL),
    // two flat cuts (forehand, backhand), a crouch, a leap and the crushing landing exactly on the third hit
    ...twin(1.75, 0.32, 0.74, L.lungeL, L.lungeR, null),
    // the backhand's follow-through drops into the crouch with the blade carried low on the right, the sword is
    // cocked overhead on a short hop, and the fall and the blow land together as one whip-eased stroke
    k(0.512, P(SH, { spine: [20, 0, 0], armR: [-100, 0, -24], foreR: [-50, 0, 0], handR: [40, 0, 0] }, L.deep), { root: [0, -0.22, 0.7] }),
    ...(() => {
      const A = k(0.565, P(SH, { spine: [-10, 0, 0], armR: [-172, 0, -8], foreR: [-20, 0, 0], handR: [60, 0, 0] }, L.tuck), { root: [0, 0.8, 2.0], e: 'smooth' });
      const B = k(0.663, P(SH, wield({ spine: [40, 0, 0], chest: [12, 0, 0], head: [16, 0, 0] }, [-0.12, 1.02, 0.55], [0.05, -0.55, 0.83], [-0.5, 0.8, 0.2]), L.deep), { root: [0, -0.42, 3.2] });
      return [A, ...slamFall(1.75, A, B, 0.55, [0, 0.5, 2.9], 0.05)];
    })(),
    k(0.88, P(SH, wield({ spine: [36, 0, 0], chest: [10, 0, 0], head: [14, 0, 0] }, [-0.12, 1.04, 0.52], [0.05, -0.5, 0.86], [-0.5, 0.8, 0.2]), L.deep), { root: [0, -0.4, 3.2], e: 'out' }),
    k(1, GL, { root: [0, 0, 3.2], e: 'smooth' }),
  ], [{ t: 0.05, e: 'trail', on: true, color: '#fff0b0', w: 1.4 }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.3, stop: 0.05 }, { t: 'hit2', e: 'impact', kind: 'slash', shake: 0.35, stop: 0.06 }, { t: 0.5, e: 'leap' },
    { t: 'hit3', e: 'impact', kind: 'earth', at: 'self', r: 5, shake: 1.2, stop: 0.12 }, { t: 'hit3', e: 'decal', kind: 'crater', r: 4.5 }, { t: 'hit3', e: 'ring', color: '#ffe0a0', r: 7 }, { t: 0.92, e: 'trail', on: false }], { endRoot: [0, 0, 3.2] });

  // ---- S5 fusion clips (combat_design.md 5.1): each fusion on its own DEF, so its contacts time from the fusion's hit
  // (a borrowed DEF timed itself by the legacy skill's) and its beats sit inside the 18-rock budget (fx.js fuseBudget).
  // High Ledger: a keyed hop (root +1.6 m) with three flat cuts that stay parallel (forehand, backhand, forehand a hand
  // lower), contacts at the fusion's 0.24 / 0.50 / 0.76 s on the floating machine; no slam, so no crater and no rocks
  {
    const HL = 1.15, hop = (t) => (t < 0.08 ? 0 : t < 0.24 ? 1.6 * Math.sin(((t - 0.08) / 0.16) * Math.PI / 2) : t < 0.78 ? 1.6 - 0.25 * ((t - 0.24) / 0.54) : t < 0.98 ? 1.35 * (1 - ((t - 0.78) / 0.2) ** 2) : 0);
    const cut3 = swing(HL, 0.76, { wind: -95, mid: -45, hit: 5, follow: 60, end: 40 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -30 : role === 'follow' ? 20 : -5, dy: -0.32 }), L.air), { root: [0, -0.04, 0.14], e }], 1400);
    const keys = [...twin(HL, 0.24, 0.5, L.air, L.air), ...cut3].map((q) => ({ ...q, root: [q.root?.[0] || 0, (q.root?.[1] || 0) + hop(q.t * HL), q.root?.[2] || 0] }));
    DEF.kf_highledger = C('knight', HL, 'full', [k(0, GL), ...keys, k(1, GL, { root: R.guard })],
      [{ t: 0.02, e: 'dust' }, { t: 0.08, e: 'leap' }, { t: 0.1, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', at: 'target', shake: 0.2 }, { t: 'hit2', e: 'impact', kind: 'slash', at: 'target', shake: 0.2 },
        { t: 'hit3', e: 'impact', kind: 'slash', at: 'target', shake: 0.4 }, { t: 0.82, e: 'trail', on: false }, { t: 0.97, e: 'dust' }]);
  }
  // Kingsfall: the old clip, on the fusion's timing; the two cuts are T2 (fusions.js tiers) so the slam keeps 10 rocks
  DEF.kf_kingsfall = { ...DEF.k_kingsfall };
  // Pierce the Line: the chain's overhead drops into a low thrust that runs on through the line and stops 1.6 m past the
  // machine it was aimed at (toTarget behind; through: the hero is not pushed back by the machines it passes), a dust lane
  // along the ground, the trail a short smear, and the Knight ends behind them facing on
  DEF.kf_pierce = C('knight', 0.9, 'full', [
    k(0, GL),
    k(0.18, P(SH, { spine: [4, -30, 0], armR: [10, -30, -30], foreR: [-80, 0, 0], handR: [-10, 0, 0] }, L.stepBack), { root: [0, -0.14, -0.1] }),
    k(0.32 / 0.9, P(SH, { spine: [30, 22, 0], chest: [6, 10, 0], armR: [-92, 10, -4], foreR: [0, 0, 0], handR: [0, 0, 0], head: [-20, -10, 0] }, P(L.lungeL, { thighL: [-80, 0, 6], shinL: [70] })), { root: [0, -0.26, 1.6], e: 'snap' }),
    k(0.5, P(SH, { spine: [26, 18, 0], armR: [-88, 10, -4] }, L.lungeR), { root: [0, -0.24, 3.4], e: 'linear' }),
    k(0.66, P(SH, { spine: [20, 12, 0], armR: [-80, 10, -4] }, L.lungeL), { root: [0, -0.2, 4.4], e: 'out' }),
    k(1, GL, { root: [0, 0, 4.6], e: 'smooth' }),
  ], [{ t: 0.16, e: 'dash' }, { t: 0.2, e: 'wave', kind: 'dust', len: 7 }, { t: 0.28, e: 'trail', on: true, color: T, w: 0.7 }, { t: 'hit', e: 'impact', kind: 'pierce', shake: 0.4 }, { t: 0.48, e: 'trail', on: false }, { t: 0.7, e: 'dust' }],
  { endRoot: [0, 0, 4.6], toTarget: { gap: -1.6, max: 9, behind: true }, through: true });
  // Upheaval: the shield rim scoops low under the stunned machine (a deep crouch, shield arm driving up), then the rising cut
  // carries it up; the machine goes 2.6 m (fusions.js liftH) with gravel falling off it
  DEF.kf_upheaval = C('knight', 0.95, 'full', [
    k(0, GL),
    k(0.16, P(SH, { spine: [34, -10, 0], chest: [10, -6, 0], armL: [-20, 60, 40], foreL: [-60, 0, 0], armR: [20, -10, -30], foreR: [-20, 0, 0], handR: [40, 0, 0], head: [-6, 10, 0] }, L.deep), { root: [0, -0.42, 0.05] }),
    k(0.3 / 0.95, P(SH, { spine: [6, 6, 0], chest: [-4, 4, 0], armL: [-120, 40, 20], foreL: [-30, 0, 0], armR: [-80, 14, -24], foreR: [-14, 0, 0], handR: [36, 0, 0], head: [-14, 2, 0] }, L.stepL), { root: [0, -0.08, 0.14], e: 'snap' }),
    k(0.5, P(SH, { spine: [-16, 20, -6], chest: [-12, 14, 0], armL: [-150, 30, 20], foreL: [-20, 0, 0], armR: [-160, 30, -10], foreR: [-10, 0, 0], handR: [-10, 0, 0], head: [-24, -6, 0] }, P(L.stand, { thighR: [-20, 0, -4], shinR: [10] })), { root: [0, 0.2, 0.14] }),
    k(0.7, P(SH, { spine: [-6, 14, 0], armL: [-110, 40, 20], armR: [-150, 20, -20], foreR: [-30, 0, 0] }), { root: [0, 0.05, 0.1] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.1, e: 'dust' }, { t: 0.18, e: 'trail', on: true, color: T, w: 1.2 }, { t: 'hit', e: 'impact', kind: 'shield', shake: 0.5 }, { t: 'hit', e: 'sound', s: 'scrape' }, { t: 0.6, e: 'trail', on: false }]); // (one contact, one light: the budget's 1 per fusion)
  // ---- level 42 and 45 (the Cinder Reach) ----
  // Breaching Cut: the sword lifted high over the right shoulder on a back step, then a steep diagonal cut stepping in;
  // the contact is held a beat (the plate splits) before the blade is carried on down past the left hip
  DEF.k_breach = C('knight', 1.05, 'full', [
    k(0, GL),
    k(0.14, P(SH, wield({ spine: [4, -14, 0], chest: [0, -6, 0], neck: [0, 6, 0], head: [0, 12, 0] }, [-0.32, 1.62, 0.14], [0.05, 0.9, 0.42], [-0.6, 1.3, 0.2]), LG), { root: [0, -0.02, 0] }),
    k(0.34, P(SH, wield({ spine: [-2, -34, 0], chest: [-6, -18, 0], neck: [0, 12, 0], head: [0, 32, 0] }, [-0.3, 1.96, -0.08], [0.28, 0.62, -0.73], [-0.75, 1.55, 0.2]), L.stepBack), { root: [0, 0.02, -0.08] }),
    k(0.5 / 1.05, P(SH, wield({ spine: [26, 26, 0], chest: [10, 16, 0], neck: [0, -8, 0], head: [8, -26, 0] }, [-0.02, 1.24, 0.56], [0.52, -0.4, 0.75], [-0.5, 1.1, 0.25]), L.lungeL), { root: [0, -0.22, 0.3], e: 'snap' }),
    k(0.66, P(SH, wield({ spine: [30, 36, 0], chest: [10, 22, 0], neck: [0, -10, 0], head: [10, -32, 0] }, [0.22, 0.96, 0.36], [0.48, -0.76, -0.44], [-0.35, 0.85, 0.35]), L.lungeL), { root: [0, -0.22, 0.3] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.3, e: 'trail', on: true, color: T, w: 1.2 }, { t: 0.3, e: 'sound', s: 'swing' }, { t: 'hit', e: 'impact', kind: 'shatter', shake: 0.55, stop: 0.1 }, { t: 'hit', e: 'sparks', at: 'weaponR', dur: 0.25 }, { t: 0.7, e: 'trail', on: false }], { strike: 0.2 });

  // Hold the Line: the kite shield driven down into the ground ahead, then the whole body turns once with the blade
  // held level and straight out; the turn runs through the hit at an even speed and the finish is held, braced
  DEF.k_holdline = C('knight', 1.5, 'full', [
    k(0, GL, { turn: 0 }),
    k(0.16, P(G, { spine: [24, -16, 0], chest: [8, -6, 0], armL: [-60, 50, 30], foreL: [-80, 0, 0], armR: [-30, 0, -30], foreR: [-50, 0, 0], handR: [30, 0, 0], head: [12, 8, 0] }, L.deep), { root: [0, -0.36, 0.08], turn: 0, e: 'snap' }),
    k(0.27, P(SH, arc(-60, { lead: -10, dy: -0.22, twist: -40 }), L.wide), { root: [0, -0.22, 0], turn: 30 }),
    k(0.36, P(SH, arc(-80, { lead: 4, dy: -0.22, twist: -26 }), L.wide), { root: [0, -0.24, 0], turn: -60, e: 'in' }),
    k(0.66 / 1.5, P(SH, arc(-88, { lead: 12, dy: -0.22, twist: -20 }), L.wide), { root: [0, -0.24, 0], turn: -170, e: 'linear' }),
    k(0.6, P(SH, arc(-60, { lead: 22, dy: -0.24, twist: 0 }), L.wide), { root: [0, -0.22, 0], turn: -330, e: 'out' }),
    k(0.64, P(SH, arc(-40, { lead: 25, dy: -0.24, twist: 10 }), L.wide), { root: [0, -0.24, 0], turn: -360 }),
    k(0.76, P(SH, arc(-40, { lead: 25, dy: -0.25, twist: 10 }), L.wide), { root: [0, -0.26, 0], turn: -360 }),
    k(1, GL, { root: R.guard, turn: -360 }),
  ], [{ t: 0.16, e: 'impact', kind: 'shield', at: 'front1', shake: 0.35 }, { t: 0.16, e: 'decal', kind: 'crack', r: 1.4, at: 'front1' }, { t: 0.16, e: 'dust' }, { t: 0.26, e: 'trail', on: true, color: '#fff0b0', w: 1.4 },
    { t: 'hit', e: 'impact', kind: 'sweep', at: 'self', r: 5, shake: 0.6, stop: 0.09 }, { t: 'hit', e: 'ring', color: '#ffe6a0', r: 5.5 }, { t: 0.5, e: 'dust' }, { t: 0.62, e: 'ring', color: '#ff9a6a', r: 8 }, { t: 0.62, e: 'sound', s: 'shout' }, { t: 0.68, e: 'trail', on: false }]);
  // ---- level 47 and 50 (the Rime Steps) ----
  // Millrace Sweep: the blade drawn back low behind the right hip on a wide crouch, then swept flat and low through the
  // legs of everything in front (the contact key on the hit, at an even speed) and carried round to the left
  DEF.k_millrace = C('knight', 0.95, 'full', [
    k(0, GL),
    k(0.09, mixPose(GL, P(SH, arc(-112, { lead: -30, dy: -0.3, r: 0.38, bend: 16 }), LW), 0.5), { root: [0, -0.1, 0] }),
    k(0.18, P(SH, arc(-112, { lead: -30, dy: -0.3, r: 0.38, bend: 16 }), LW), { root: [0, -0.2, 0] }),
    ...swing(0.95, 0.42, { wind: -122, mid: -60, hit: 5, follow: 72, end: 96 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -35 : role === 'mid' ? -15 : role === 'hit' ? 0 : 24, dy: -0.4, bend: 22, tilt: -8 }), role === 'wind' ? LW : L.lungeL), { root: role === 'wind' ? [0, -0.24, -0.02] : [0, -0.3, 0.22], e }], 1200),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.22, e: 'trail', on: true, color: T, w: 1.3 }, { t: 0.3, e: 'sound', s: 'swing' }, { t: 'hit', e: 'impact', kind: 'sweep', at: 'cone', r: 5, shake: 0.35, stop: 0.06 }, { t: 'hit', e: 'cloud', kind: 'chill', r: 3, cone: true }, { t: 0.66, e: 'trail', on: false }]);
  // Sluicegate Blow: the kite shield rammed into the machine (held, the gate shut), then the sword lifted over the
  // right shoulder as the knight steps in and brought down steeply onto the seam; the second contact is held
  {
    const RAM = P(G, { spine: [22, 24, 0], chest: [8, 18, 0], armL: [-88, 18, 6], foreL: [-28, -20, 0], armR: [-10, 0, -40], head: [10, -10, 0] });
    const CUT = (sp, at, dir) => P(SH, wield({ spine: sp, chest: [10, sp[1] * 0.6, 0], neck: [0, -8, 0], head: [8, -sp[1], 0] }, at, dir, [-0.5, 1.1, 0.25]));
    DEF.k_sluicegate = C('knight', 1.4, 'full', [
      k(0, GL),
      k(0.13, P(G, { spine: [-4, -26, 0], armL: [-40, 80, 40], foreL: [-110, 0, 0], armR: [-20, 0, -30] }, L.stepBack), { root: [0, -0.06, -0.08] }),
      k(0.3 / 1.4, P(RAM, L.lungeL), { root: [0, -0.12, 0.34], e: 'snap' }),
      k(0.3, P(RAM, L.lungeL), { root: [0, -0.12, 0.34] }),
      k(0.4, P(SH, wield({ spine: [6, -14, 0], chest: [0, -6, 0], neck: [0, 6, 0], head: [0, 12, 0] }, [-0.32, 1.6, 0.16], [0.05, 0.9, 0.42], [-0.6, 1.3, 0.2]), L.stepL), { root: [0, -0.04, 0.34] }),
      k(0.5, P(SH, wield({ spine: [-2, -32, 0], chest: [-6, -18, 0], neck: [0, 12, 0], head: [0, 30, 0] }, [-0.3, 1.94, -0.06], [0.28, 0.62, -0.73], [-0.75, 1.55, 0.2]), L.stand), { root: [0, 0.04, 0.34] }),
      k(0.85 / 1.4, P(CUT([28, 24, 0], [-0.02, 1.2, 0.58], [0.5, -0.44, 0.75]), L.lungeL), { root: [0, -0.24, 0.6], e: 'snap' }),
      k(0.7, P(CUT([28, 26, 0], [-0.01, 1.18, 0.57], [0.5, -0.46, 0.74]), L.lungeL), { root: [0, -0.24, 0.6] }),
      k(0.8, P(SH, wield({ spine: [30, 34, 0], chest: [10, 22, 0], neck: [0, -10, 0], head: [10, -32, 0] }, [0.22, 0.98, 0.38], [0.48, -0.76, -0.44], [-0.35, 0.85, 0.35]), L.lungeL), { root: [0, -0.22, 0.6] }),
      k(1, GL, { root: [0, 0, 0.6], e: 'smooth' }),
    ], [{ t: 'hit', e: 'impact', kind: 'shield', shake: 0.5, stop: 0.08 }, { t: 'hit', e: 'dust' }, { t: 0.36, e: 'trail', on: true, color: T, w: 1.3 }, { t: 0.5, e: 'sound', s: 'swing' },
      { t: 'hit2', e: 'impact', kind: 'shatter', shake: 0.65, stop: 0.11 }, { t: 'hit2', e: 'sparks', at: 'weaponR', dur: 0.25 }, { t: 0.78, e: 'trail', on: false }], { strike: 0.2, endRoot: [0, 0, 0.6] });
  }
  // ---- level 52 and 55 (the Windward Heights) ----
  // Crosswind Cut: the blade gathered across the body by the left side, then a flat backhand at chest height from left
  // to right on a step in with the right foot (the contact key on the hit, at an even speed) and carried out to the right
  DEF.k_crosswind = C('knight', 0.95, 'full', [
    k(0, GL),
    k(0.17, P(SH, arc(36, { lead: 14, dy: -0.12, r: 0.4 }), L.stepL), { root: [0, -0.04, 0.02] }),
    ...swing(0.95, 0.4, { wind: 92, mid: 46, hit: -5, follow: -62, end: -76 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? 30 : role === 'follow' || role === 'end' ? -22 : 5, dy: -0.1, r: role === 'wind' ? 0.36 : 0.46, bend: 10 }), role === 'wind' ? L.stepL : L.lungeR), { root: role === 'wind' ? [0, -0.06, 0.04] : [0, -0.14, 0.26], e }], 1100),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.2, e: 'trail', on: true, color: T, w: 1.3 }, { t: 0.3, e: 'sound', s: 'swing' }, { t: 'hit', e: 'impact', kind: 'sweep', at: 'cone', r: 5, shake: 0.4, stop: 0.07 }, { t: 'hit', e: 'cloud', kind: 'chill', r: 3, cone: true }, { t: 0.66, e: 'trail', on: false }]);
  // Windwall Advance: the kite shield pulled in on a back step and driven forward into the machines (held, braced like a
  // board against the wind), then the sword drawn back beside the right shoulder, point forward, and thrust out flat over
  // the shield's rim on a long lunge; the thrust is held at full reach
  {
    const RAM = P(G, { spine: [22, 24, 0], chest: [8, 18, 0], armL: [-88, 18, 6], foreL: [-28, -20, 0], armR: [-10, 0, -40], head: [10, -10, 0] });
    const BRACE = { armL: [-82, 20, 8], foreL: [-36, -20, 0], handL: [0, 0, 0] };
    const THR = (sp, at, dir, pole) => P(wield({ spine: sp, chest: [6, sp[1] * 0.5, 0], neck: [0, -6, 0], head: [8, -sp[1] * 0.8, 0] }, at, dir, pole), BRACE);
    DEF.k_windwall = C('knight', 1.45, 'full', [
      k(0, GL),
      k(0.12, P(G, { spine: [-4, -26, 0], armL: [-40, 80, 40], foreL: [-110, 0, 0], armR: [-20, 0, -30] }, L.stepBack), { root: [0, -0.06, -0.08] }),
      k(0.34 / 1.45, P(RAM, L.lungeL), { root: [0, -0.12, 0.34], e: 'snap' }),
      k(0.31, P(RAM, L.lungeL), { root: [0, -0.12, 0.36] }),
      k(0.42, P(THR([10, -12, 0], [-0.32, 1.3, 0.04], [0.04, 0.12, 1], [-0.7, 1.05, -0.3]), L.stepL), { root: [0, -0.06, 0.38] }),
      k(0.5, P(THR([6, -20, 0], [-0.33, 1.34, -0.04], [0.04, 0.1, 1], [-0.72, 1.1, -0.36]), L.stepL), { root: [0, -0.06, 0.38] }),
      k(0.84 / 1.45, P(THR([24, 14, 0], [-0.1, 1.36, 0.6], [0.08, 0.0, 1], [-0.6, 1.05, 0.1]), P(L.lungeL, { thighL: [-72, 0, 6], shinL: [70] })), { root: [0, -0.24, 0.66], e: 'snap' }),
      k(0.69, P(THR([24, 14, 0], [-0.1, 1.35, 0.59], [0.08, -0.02, 1], [-0.6, 1.05, 0.1]), P(L.lungeL, { thighL: [-72, 0, 6], shinL: [70] })), { root: [0, -0.24, 0.66] }),
      k(1, GL, { root: [0, 0, 0.66], e: 'smooth' }),
    ], [{ t: 0.06, e: 'sound', s: 'whoosh' }, { t: 'hit', e: 'impact', kind: 'shield', at: 'cone', r: 5, shake: 0.5, stop: 0.08 }, { t: 'hit', e: 'cloud', kind: 'chill', r: 3.5, cone: true }, { t: 'hit', e: 'dust' },
      { t: 0.4, e: 'trail', on: true, color: T, w: 1.2 }, { t: 'hit2', e: 'impact', kind: 'pierce', at: 'cone', r: 5, shake: 0.65, stop: 0.11 }, { t: 'hit2', e: 'cloud', kind: 'chill', r: 4, cone: true }, { t: 0.74, e: 'trail', on: false }], { strike: 0.16, endRoot: [0, 0, 0.66] });
  }
  // ---- level 57 and 60 (Tidewater Sound) ----
  // Tidebreak Cut: the sword gathered high over the left shoulder on a short step back, then brought down on a long
  // diagonal from high left to low right through the target on a hard step in (contact on the hit, an even speed),
  // finishing low by the right hip; sea spray flies off the blow
  DEF.k_tidebreak = C('knight', 0.95, 'full', [
    k(0, GL),
    k(0.16, P(SH, arc(70, { lead: 30, dy: 0.08, r: 0.38, tilt: 30, bend: 2 }), L.stepBack), { root: [0, -0.02, -0.04] }),
    ...swing(0.95, 0.46, { wind: 96, mid: 50, hit: -4, follow: -58, end: -72 }, (a, role, e) => {
      const f = Math.min(1, Math.max(0, (96 - a) / 168));
      return [P(SH, arc(a, { lead: role === 'wind' ? 28 : role === 'follow' || role === 'end' ? -22 : 4, dy: 0.1 - 0.5 * f, tilt: 34 - 64 * f, bend: 4 + 18 * f, r: role === 'wind' ? 0.38 : 0.46 }), role === 'wind' ? L.stepBack : L.lungeR), { root: role === 'wind' ? [0, -0.02, -0.04] : [0, -0.16, 0.26], e }];
    }, 1100),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.14, e: 'trail', on: true, color: T, w: 1.3 }, { t: 0.26, e: 'sound', s: 'swing' }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.35, stop: 0.07 }, { t: 'hit', e: 'impact', kind: 'seaspray' }, { t: 0.72, e: 'trail', on: false }]);
  // Sea Wall: the kite shield lifted and driven down edge-first into the ground ahead on a deep crouch (the first
  // contact, held), then the sword swept flat round the front from right to left over the shield's rim on wide feet
  // (the second contact, at an even speed), and the guard taken back up
  {
    const DOWN = P(G, { spine: [30, 10, 0], chest: [8, 6, 0], armL: [-60, 30, 20], foreL: [-30, 0, 0], armR: [-30, 0, -30], foreR: [-50, 0, 0], head: [14, -6, 0] }, L.deep);
    DEF.k_seawall = C('knight', 1.4, 'full', [
      k(0, GL),
      k(0.12, P(G, { spine: [-6, -10, 0], armL: [-120, 40, 30], foreL: [-60, 0, 0], armR: [-20, 0, -30] }, L.stepBack), { root: [0, 0.02, -0.06] }),
      k(0.36 / 1.4, DOWN, { root: [0, -0.36, 0.1], e: 'snap' }),
      k(0.34, DOWN, { root: [0, -0.36, 0.1] }),
      ...swing(1.4, 0.86, { wind: -110, mid: -56, hit: 4, follow: 70, end: 88 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -28 : role === 'mid' ? -12 : role === 'hit' ? 0 : 22, dy: -0.2, bend: 16 }), L.wide), { root: [0, -0.24, 0.1], e }], 1150),
      k(1, GL, { root: [0, 0, 0.1], e: 'smooth' }),
    ], [{ t: 'hit', e: 'impact', kind: 'shield', at: 'front1', shake: 0.55, stop: 0.09 }, { t: 'hit', e: 'impact', kind: 'seaspray', at: 'front1', r: 5 },{ t: 'hit', e: 'decal', kind: 'crack', r: 1.4, at: 'front1' },
      { t: 0.48, e: 'trail', on: true, color: T, w: 1.3 }, { t: 0.52, e: 'sound', s: 'swing' }, { t: 'hit2', e: 'impact', kind: 'sweep', at: 'self', r: 5, shake: 0.5, stop: 0.08 }, { t: 'hit2', e: 'cloud', kind: 'seaspray', r: 5, at: 'self' }, { t: 0.8, e: 'trail', on: false }], { endRoot: [0, 0, 0.1] });
  }
  // ---- level 62 and 65 (the Rainward Gorge) ----
  // Slipface Cut: the sword gathered high over the right shoulder on a short step back, then brought down steeply
  // from high right to low left through the target on a hard step in (contact on the hit, an even speed), finishing
  // low by the left knee; wet red mud flies off the blow
  DEF.k_slipface = C('knight', 0.95, 'full', [
    k(0, GL),
    k(0.16, P(SH, arc(-70, { lead: -30, dy: 0.1, r: 0.38, tilt: -30, bend: 2 }), L.stepBack), { root: [0, -0.02, -0.04] }),
    ...swing(0.95, 0.44, { wind: -100, mid: -52, hit: 4, follow: 56, end: 70 }, (a, role, e) => {
      const f = Math.min(1, Math.max(0, (a + 100) / 170));
      return [P(SH, arc(a, { lead: role === 'wind' ? -28 : role === 'follow' || role === 'end' ? 22 : -4, dy: 0.14 - 0.56 * f, tilt: -36 + 66 * f, bend: 4 + 20 * f, r: role === 'wind' ? 0.38 : 0.46 }), role === 'wind' ? L.stepBack : L.lungeL), { root: role === 'wind' ? [0, -0.02, -0.04] : [0, -0.18, 0.26], e }];
    }, 1100),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.14, e: 'trail', on: true, color: T, w: 1.3 }, { t: 0.26, e: 'sound', s: 'swing' }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.35, stop: 0.07 }, { t: 'hit', e: 'impact', kind: 'mud' }, { t: 0.72, e: 'trail', on: false }]);
  // Dry-Stone Wall (capstone): the kite shield lifted and set down hard and square on the ground ahead on a low,
  // wide crouch (the first contact, held), then the sword swept back round the front from left to right over the
  // shield's rim on wide feet (the second contact, at an even speed), and the guard taken back up; stone dust and wet
  // grit jump off the ground at the shield
  {
    const SET = P(G, { spine: [24, -8, 0], chest: [6, -4, 0], armL: [-54, 24, 16], foreL: [-36, 0, 0], armR: [-30, 0, -30], foreR: [-50, 0, 0], head: [12, 4, 0] }, L.wide);
    DEF.k_drystone = C('knight', 1.4, 'full', [
      k(0, GL),
      k(0.12, P(G, { spine: [-6, -12, 0], armL: [-110, 36, 26], foreL: [-56, 0, 0], armR: [-20, 0, -30] }, L.stepBack), { root: [0, 0.02, -0.06] }),
      k(0.36 / 1.4, SET, { root: [0, -0.3, 0.08], e: 'snap' }),
      k(0.34, SET, { root: [0, -0.3, 0.08] }),
      ...swing(1.4, 0.86, { wind: 104, mid: 52, hit: -4, follow: -66, end: -84 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? 26 : role === 'mid' ? 12 : role === 'hit' ? 0 : -22, dy: -0.18, bend: 16 }), L.wide), { root: [0, -0.22, 0.08], e }], 1150),
      k(1, GL, { root: [0, 0, 0.08], e: 'smooth' }),
    ], [{ t: 'hit', e: 'impact', kind: 'shield', at: 'front1', shake: 0.55, stop: 0.09 }, { t: 'hit', e: 'impact', kind: 'stonechip', at: 'front1', r: 5 }, { t: 'hit', e: 'decal', kind: 'crack', r: 1.2, at: 'front1' },
      { t: 0.52, e: 'sound', s: 'swing' }, { t: 'hit2', e: 'impact', kind: 'sweep', at: 'self', r: 5, shake: 0.5, stop: 0.08 }, { t: 'hit2', e: 'cloud', kind: 'mud', r: 5, at: 'self' }], { endRoot: [0, 0, 0.08] }); // no swing trail: the sweep round the front read as a ring round him
  }
}

// ============================== S4: authored clips and root curves (combat_design.md 7) ==============================
// A DEF may carry `ual`: the hero body's authored clips (art_src/hero/build_body.py) over its keys, { mask: 'full' | 'body'
// (arms left to the keys), segs: [[clip, t0, t1, c0?, c1?], ...] in seconds, end?: s after which the keys take over }
// (heroBody.js ualPose). `toTarget` { gap, max }: the root travel is scaled so the hero lands gap m short of the target
// (entities.js playSkill). Old body (?herobody=0): the keys alone, as before.
// leapRoot: a leap's root curve (7.1) { t0 take-off, t1 top, t2 leaving the top, t3 landing (s), h height (m), float
// (extra rise while hanging), dist (m), atTop / atEnd (share of the travel at the top and when leaving it) }: ease-out up,
// ease-in down, keyed every 1/60 s. Height is the client's; the travel is real movement (endRoot).
function leapRoot(dur, o) {
  const { t0, t1, t2, t3, h, float = 0, dist = 0, atTop = 0.35, atEnd = 0.45 } = o;
  const y = (t) => (t <= t0 ? 0 : t < t1 ? h * (1 - (1 - (t - t0) / (t1 - t0)) ** 2) : t < t2 ? h + float * Math.sin((Math.PI * (t - t1)) / (t2 - t1)) : t < t3 ? h * (1 - ((t - t2) / (t3 - t2)) ** 2) : 0);
  const z = (t) => (t <= t0 ? 0 : t < t1 ? dist * atTop * (1 - (1 - (t - t0) / (t1 - t0)) ** 2) : t < t2 ? dist * (atTop + ((atEnd - atTop) * (t - t1)) / (t2 - t1)) : t < t3 ? dist * (atEnd + (1 - atEnd) * ((t - t2) / (t3 - t2)) ** 2) : dist);
  const keys = [];
  for (let t = t0; t < t3 - 1e-6; t += 1 / 60) keys.push(k(t / dur, {}, { root: [0, +y(t).toFixed(4), +z(t).toFixed(4)], e: 'linear' }));
  keys.push(k(t3 / dur, {}, { root: [0, 0, dist], e: 'linear' }));
  return keys;
}
{
  const G = P(guard('knight'), { spine: [8, 0, 0], chest: [0, 0, 0] }), GL = P(G, LG), T = TRAIL.knight;
  // Stormfall (5.1, the owner's dragoon move), 1.25 s, its beat sheet: 0.00 crouch, dust, whoosh; 0.12 take-off, root 0 to
  // 5 m in 0.26 s, a 2 m dust column, rocks, camera lift, cloak streaming down; 0.38-0.58 the hang (its clip at 0.6x), a
  // short line of light along the edge; 0.58 the plunge (0.12 s to the ground, trail); 0.70-0.72 the T4 contact (the
  // server's hit at 0.72): earth, two rings 80 ms apart, crater, the machine slammed down; 0.82 crack (the tier's release);
  // 1.25 back to guard. The travel lands it 1 m short of the machine it vaults past. (S4 review: the plunge smear only covers
  // the last 0.04 s, or from 5 m it read as an upright beam; the camera lifts 3.5 m, not 2, so the 5 m top stays in view)
  const SF = 1.25, SFD = 4.0;
  DEF.kf_stormfall = C('knight', SF, 'full', [
    k(0, GL),
    ...leapRoot(SF, { t0: 0.12, t1: 0.38, t2: 0.58, t3: 0.70, h: 5, float: 0.12, dist: SFD }),
    k(1, GL, { root: [0, 0, SFD], e: 'smooth' }),
  ], [{ t: 0, e: 'sound', s: 'whoosh' }, { t: 0.02 / SF, e: 'dust' }, { t: 0.12 / SF, e: 'leap' }, { t: 0.12 / SF, e: 'column', h: 2, rocks: 5 },
    { t: 0.12 / SF, e: 'camlift', up: 3.5, back: 3, dur: 1.0 },
    { t: 0.46 / SF, e: 'trail', on: true, color: T, w: 0.5 }, { t: 0.5 / SF, e: 'trail', on: false },
    { t: 0.66 / SF, e: 'trail', on: true, color: T, w: 0.9 }, { t: 'hit', e: 'impact', kind: 'earth', at: 'self', r: 2.3 },
    { t: 'hit', e: 'ring', color: '#e8d8c0', r: 5, delay: 0.08 }, { t: 'hit', e: 'decal', kind: 'crater', r: 3.5 }, { t: 0.7 / SF, e: 'trail', on: false }],
  { endRoot: [0, 0, SFD], toTarget: { gap: 1.0, max: 6 },
    ual: { mask: 'full', segs: [['Leap_Rise', 0, 0.38], ['Air_Hang_Loop', 0.38, 0.58, 0, 0.12], ['Dive_Strike', 0.56, 0.70], ['Slam_Land', 0.70, SF]] } });
  // Skybreaker on the same clips and root curve (2.2 m, lands 1.4 m short of the target; the old fixed 4 m landed short or long)
  const SB = DEF.k_skybreaker.dur;
  DEF.k_skybreaker = C('knight', SB, 'full', [
    k(0, GL),
    ...leapRoot(SB, { t0: 0.16, t1: 0.42, t2: 0.52, t3: 0.72, h: 2.2, float: 0.05, dist: 4.0, atTop: 0.5, atEnd: 0.6 }),
    k(1, GL, { root: [0, 0, 4.0], e: 'smooth' }),
  ], DEF.k_skybreaker.events, { endRoot: [0, 0, 4.0], toTarget: { gap: 1.4, max: 9 },
    ual: { mask: 'full', segs: [['Leap_Rise', 0, 0.42, 0, 0.42], ['Air_Hang_Loop', 0.42, 0.52, 0, 0.06], ['Dive_Strike', 0.5, 0.72], ['Slam_Land', 0.72, SB]] } });
  // Battering Line: the lunge runs on into the shield charge (body), the keyed bash on the arms; Anvil Fall: the throw comes
  // up out of Stormfall's kneeling landing; Turning Riposte: the parry beat before the turn; Sidewind Cut: the turn itself
  // is the authored spin (the keys' whole-body turn taken out, or it would turn twice)
  // (S5: from the game camera it read as a plain bash; the Knight now runs on 3 m shield-first behind the machine he carries,
  // over a dust wake, and the machine slides with its own dust trail, game.js 'knock')
  const carry = (t) => 3 * Math.min(1, Math.max(0, (t - 0.38) / 0.42)) ** 0.8;
  DEF.kf_battering = { ...DEF.k_bash, keys: DEF.k_bash.keys.map((q) => ({ ...q, root: [q.root?.[0] || 0, q.root?.[1] || 0, (q.root?.[2] || 0) + carry(q.t)] })),
    events: [...DEF.k_bash.events, { t: 0.04, e: 'dash' }, { t: 0.4, e: 'wave', kind: 'dust', len: 4 }, { t: 0.8, e: 'dust' }], endRoot: [0, 0, 3],
    ual: { mask: 'body', segs: [['Shield_Charge_Loop', 0, 0.42, 0, 0.42]], end: 0.42 } };
  DEF.kt_anvilfall = { ...DEF.k_shieldthrow, ual: { mask: 'body', segs: [['Slam_Land', 0, 0.36, 0.04, 0.4]], end: 0.3 } };
  DEF.kf_riposte = { ...DEF.k_spin, ual: { mask: 'full', segs: [['Parry_Riposte', 0, 0.17, 0.06, 0.2]], end: 0.15 } };
  const sd = DEF.k_spin.dur;
  DEF.kf_sidewind = { ...DEF.k_spin, keys: DEF.k_spin.keys.map(({ turn, ...q }) => q), ual: { mask: 'full', segs: [['Spin_Attack_Loop', 0.19 * sd, 0.7 * sd, 0, 0.417]], end: 0.7 * sd } };
}

// ============================== RANGER ====================================
// combat stance solved like the draws: bow held low in front, top limb forward and up, string toward the body,
// the string hand resting on the string ready to draw (written into the shared stance table before the ranger clips read it)
{
  const get = fk({});
  const gripAxis = V(0.05, 0.8, 0.6).normalize();
  const bowHand = armIK(get, 'L', V(0.2, 1.06, 0.3), V(0.55, 0.9, 0.1), V(-0.3, -0.1, -0.95), gripAxis, true);
  const strHand = armIK(get, 'R', V(0.04, 1.1, 0.2), V(-0.45, 1.0, -0.25), (E, T) => E.clone().sub(T), V(0.1, 0.75, 0.65), true);
  STANCES.ranger.combat = { ...STANCES.ranger.combat, ...bowHand, ...strHand };
}
{
  const G = P(guard('ranger'), { spine: [6, 0, 0] });
  const GL = P(G, LG);
  // draw poses solved by archer(): side-on torso, bow arm at the target, string hand at the jaw
  const T_AIM = { hips: [0, -30, 0], spine: [4, -50, 0], chest: [0, -12, 0] };
  const T_NOCK = { hips: [0, -24, 0], spine: [4, -38, 0], chest: [0, -8, 0], neck: [0, 14, 0] };
  const lean = (t, x, y = 0) => ({ ...t, spine: [t.spine[0] + x, t.spine[1] + y, 0] });
  const set = (o = {}) => ({
    AIM: archer({ torso: o.torso || T_AIM, pitch: o.pitch || 0, anchor: o.anchor, reach: o.reach }),
    NOCK: archer({ torso: o.nockTorso || o.torso || T_NOCK, pitch: o.pitch || 0, draw: 0.3, reach: o.reach }),
    REL: archer({ torso: lean(o.torso || T_AIM, 0, -4), pitch: o.pitch || 0, anchor: o.anchor, reach: o.reach, release: 1 }),
  });
  const { AIM, NOCK, REL } = set();
  const DEEP = set({ torso: lean(T_AIM, 2, -6), anchor: [-0.1, 0.02, 0.05], reach: 0.66 });           // to the ear: aimed / piercing shots
  const HIGH = set({ torso: lean(T_AIM, -16), nockTorso: lean(T_NOCK, -8), pitch: 52 });              // volley into the sky
  const LOB = set({ torso: lean(T_AIM, -10), nockTorso: lean(T_NOCK, -6), pitch: 30 });               // smoke arrow
  const ARC = set({ torso: lean(T_AIM, -14), nockTorso: lean(T_NOCK, -6), pitch: 40 });               // arcing shot
  const LOW = set({ torso: lean(T_AIM, 10), pitch: -16 });                                            // pinning / crippling, aimed at the legs
  const DOWN = set({ torso: lean(T_AIM, 34), nockTorso: lean(T_NOCK, 26), pitch: -55 });             // from the air, straight down
  const SIDE = { thighL: [-22, 0, 12], shinL: [22], footL: [-8], thighR: [8, 0, -14], shinR: [22], footR: [-6] }; // hips come from the solved torso
  const shot = (dur, drawAt, relAt, extra = {}) => [
    k(0, GL),
    k(drawAt * 0.5, P(NOCK, SIDE)),
    k(drawAt, P(AIM, SIDE)),
    k(relAt, P(AIM, SIDE)),
    k(relAt + 0.06, P(REL, SIDE), { e: 'snap' }),
    k(1, GL),
  ];
  DEF.r_quick = C('ranger', 0.7, 'full', shot(0.7, 0.3, 0.36), [{ t: 0.05, e: 'bowstring', pull: 0 }, { t: 0.12, e: 'bowstring', pull: 1 }, { t: 0.4, e: 'proj', kind: 'arrow', from: 'bow' }, { t: 0.4, e: 'bowstring', pull: 0 }, { t: 0.4, e: 'sound', s: 'bow' }]);
  DEF.r_aimed = C('ranger', 1.9, 'full', [
    k(0, GL),
    k(0.15, P(DEEP.NOCK, SIDE)),
    k(0.45, P(DEEP.AIM, SIDE)),
    k(0.78, P(DEEP.AIM, SIDE, { spine: [7, -58, 0] })),
    k(0.83, P(DEEP.REL, SIDE), { e: 'snap' }),
    k(1, GL),
  ], [{ t: 0.13, e: 'bowstring', pull: 1 }, { t: 0.3, e: 'motes', color: '#fff0c0', n: 14, at: 'bow', dur: 1 }, { t: 0.82, e: 'proj', kind: 'arrow', from: 'bow', big: true }, { t: 0.82, e: 'bowstring', pull: 0 }, { t: 0.82, e: 'shake', amt: 0.2 }, { t: 0.82, e: 'sound', s: 'bow' }]);
  DEF.r_twin = C('ranger', 0.95, 'full', [
    k(0, GL), k(0.18, P(AIM, SIDE)), k(0.26, P(REL, SIDE), { e: 'snap' }), k(0.36, P(NOCK, SIDE)), k(0.44, P(AIM, SIDE)), k(0.5, P(REL, SIDE), { e: 'snap' }), k(1, GL),
  ], [{ t: 0.15, e: 'bowstring', pull: 1 }, { t: 0.26, e: 'proj', kind: 'arrow', from: 'bow' }, { t: 0.26, e: 'bowstring', pull: 0 }, { t: 0.32, e: 'bowstring', pull: 1 }, { t: 0.5, e: 'proj', kind: 'arrow', from: 'bow' }, { t: 0.5, e: 'bowstring', pull: 0 }]);
  DEF.r_volley = C('ranger', 1.2, 'full', [
    k(0, GL),
    k(0.2, P(HIGH.NOCK, SIDE)),
    k(0.42, P(HIGH.AIM, L.wide), { root: [0, -0.1, 0] }),
    k(0.5, P(HIGH.REL, L.wide), { root: [0, -0.1, 0], e: 'snap' }),
    k(1, GL),
  ], [{ t: 0.18, e: 'bowstring', pull: 1 }, { t: 0.5, e: 'proj', kind: 'arrow', from: 'bow', up: true }, { t: 0.5, e: 'bowstring', pull: 0 }, { t: 0.92, e: 'rain', kind: 'arrow', r: 5, n: 22 }]);
  DEF.r_cripple = C('ranger', 0.8, 'full', [
    k(0, GL),
    k(0.2, P(LOW.NOCK, L.kneel), { root: R.kneel }),
    k(0.36, P(LOW.AIM, L.kneel), { root: R.kneel }),
    k(0.44, P(LOW.REL, L.kneel), { root: R.kneel, e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.18, e: 'bowstring', pull: 1 }, { t: 0.44, e: 'proj', kind: 'arrow', from: 'bow', low: true }, { t: 0.44, e: 'bowstring', pull: 0 }]);
  DEF.r_disengage = C('ranger', 0.85, 'full', [
    k(0, GL),
    k(0.12, P(G, { spine: [20, 0, 0] }, L.deep), { root: R.deep }),
    k(0.35, P(G, { spine: [-50, 0, 0], chest: [-20, 0, 0], head: [-40, 0, 0], armL: [-160, 0, 30], armR: [-160, 0, -30] }, L.tuck), { root: [0, 1.6, -2.4], e: 'out' }),
    k(0.55, P(G, { spine: [-120, 0, 0], chest: [-30, 0, 0], head: [-30, 0, 0], armL: [-120, 0, 40], armR: [-120, 0, -40] }, L.tuck), { root: [0, 1.4, -4.6] }),
    k(0.75, P(G, { spine: [20, 0, 0] }, L.deep), { root: [0, -0.3, -6.6], e: 'in' }),
    k(1, GL, { root: [0, 0, -6.6] }),
  ], [{ t: 0.12, e: 'dust' }, { t: 0.1, e: 'dash' }, { t: 0.75, e: 'dust' }], { endRoot: [0, 0, -6.6] });
  DEF.r_pierce = C('ranger', 1.05, 'full', [
    k(0, GL),
    k(0.2, P(DEEP.NOCK, L.wide), { root: [0, -0.12, 0] }),
    k(0.44, P(DEEP.AIM, L.wide), { root: [0, -0.16, -0.04] }),
    k(0.5, P(DEEP.REL, L.wide), { root: [0, -0.16, -0.12], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.18, e: 'bowstring', pull: 1 }, { t: 0.5, e: 'proj', kind: 'arrow', from: 'bow', pierce: true, big: true }, { t: 0.5, e: 'bowstring', pull: 0 }, { t: 0.5, e: 'shake', amt: 0.25 }, { t: 0.5, e: 'dust' }]);
  DEF.r_trap = C('ranger', 0.85, 'full', [
    k(0, GL),
    k(0.3, P(G, { spine: [30, -20, 0], armR: [30, 0, -20], foreR: [-30, 0, 0], head: [20, 0, 0] }, L.lungeR), { root: [0, -0.2, 0.1] }),
    k(0.5, P(G, { spine: [24, 20, 0], armR: [-70, 0, -10], foreR: [-10, 0, 0], handR: [-30, 0, 0] }, L.lungeR), { root: [0, -0.2, 0.15], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.2, e: 'holdItem', side: 'R', item: 'trap', on: true }, { t: 0.5, e: 'holdItem', side: 'R', item: 'trap', on: false }, { t: 0.5, e: 'proj', kind: 'trap', from: 'R', arc: 0.5, ground: true }]);
  DEF.r_barrage = C('ranger', 2.0, 'full', (() => {
    const keys = [k(0, GL), k(0.06, P(AIM, SIDE))];
    for (let i = 0; i < 6; i++) { const t0 = 0.1 + i * 0.14; keys.push(k(t0, P(AIM, SIDE))); keys.push(k(t0 + 0.04, P(REL, SIDE), { e: 'snap' })); keys.push(k(t0 + 0.09, P(NOCK, SIDE))); }
    keys.push(k(1, GL));
    return keys;
  })(), (() => { const ev = []; for (let i = 0; i < 6; i++) { const t0 = 0.1 + i * 0.14; ev.push({ t: t0 - 0.05, e: 'bowstring', pull: 1 }, { t: t0 + 0.04, e: 'proj', kind: 'arrow', from: 'bow' }, { t: t0 + 0.04, e: 'bowstring', pull: 0 }); } return ev; })());
  DEF.r_dagger = C('ranger', 0.7, 'full', [
    k(0, GL),
    // a backhand rake with the knife: drawn across to the left shoulder, whipped flat out to the right
    k(0.12, P(G, arc(70, { lead: 40, dy: -0.1, r: 0.3 }), L.stepL), { root: [0, -0.04, 0.06] }),
    ...swing(0.7, 0.22, { wind: 95, mid: 45, hit: -10, follow: -70, end: -80 }, (a, role, e) => [P(G, arc(a, { lead: role === 'wind' ? 40 : role === 'mid' ? 15 : role === 'hit' ? -5 : -25, dy: -0.18, r: role === 'wind' ? 0.3 : 0.42 }), role === 'wind' ? L.stepL : L.lungeL), { root: role === 'wind' ? [0, -0.04, 0.08] : [0, -0.06, 0.22], e }], 1500),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.12, e: 'holdItem', side: 'R', item: 'dagger', on: true }, { t: 0.2, e: 'trail', on: true, side: 'R', color: '#e8f0e0', w: 0.5 }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.2 }, { t: 0.5, e: 'trail', on: false }, { t: 0.9, e: 'holdItem', side: 'R', item: 'dagger', on: false }]);
  DEF.r_mark = C('ranger', 0.75, 'upper', [
    k(0, G),
    k(0.35, P(G, { spine: [0, 20, 0], armR: [-95, 10, -10], foreR: [-4, 0, 0], handR: [-10, 0, 0], head: [0, -10, 0] }), { e: 'snap' }),
    k(0.65, P(G, { spine: [0, 20, 0], armR: [-95, 10, -10], foreR: [-4, 0, 0] })),
    k(1, G),
  ], [{ t: 0.38, e: 'impact', kind: 'mark', at: 'target' }]);
  DEF.r_explosive = C('ranger', 1.0, 'full', [
    k(0, GL),
    k(0.18, P(NOCK, SIDE)),
    k(0.36, P(AIM, SIDE)),
    k(0.42, P(AIM, SIDE)),
    k(0.48, P(REL, SIDE), { e: 'snap' }),
    k(1, GL),
  ], [{ t: 0.18, e: 'motes', color: '#ff9a40', n: 10, at: 'handR', dur: 0.4 }, { t: 0.16, e: 'bowstring', pull: 1 }, { t: 0.48, e: 'proj', kind: 'firearrow', from: 'bow', impact: 'fire' }, { t: 0.48, e: 'bowstring', pull: 0 }]);
  DEF.r_kick = C('ranger', 0.8, 'full', [
    k(0, GL),
    k(0.2, P(G, { spine: [-10, -20, 0], armL: [-40, 0, 40], armR: [-20, 0, -40] }, { thighR: [-60, 0, -4], shinR: [110], footR: [10], thighL: [-10, 0, 4], shinL: [24] }), { root: [0, -0.04, 0] }),
    k(0.36, P(G, { spine: [-26, -10, 0], chest: [-10, 0, 0], armL: [-50, 0, 60], armR: [-30, 0, -60] }, L.kickR), { root: [0, 0.04, 0.1], e: 'snap' }),
    k(0.55, P(G, { spine: [-10, 0, 0] }, { thighR: [-40, 0, -4], shinR: [90] }), {}),
    k(1, GL, { root: R.guard }),
  ], [{ t: 'hit', e: 'impact', kind: 'blunt', shake: 0.35, stop: 0.06 }, { t: 0.36, e: 'dust' }]);
  DEF.r_smoke = C('ranger', 1.0, 'full', [
    k(0, GL), k(0.2, P(LOB.NOCK, SIDE)), k(0.42, P(LOB.AIM, SIDE)), k(0.5, P(LOB.REL, SIDE), { e: 'snap' }), k(1, GL),
  ], [{ t: 0.18, e: 'bowstring', pull: 1 }, { t: 0.5, e: 'proj', kind: 'arrow', from: 'bow', arc: 0.5, impact: 'smoke', ground: true }, { t: 0.5, e: 'bowstring', pull: 0 }]);
  DEF.r_arcing = C('ranger', 1.05, 'full', [
    k(0, GL), k(0.2, P(ARC.NOCK, SIDE)), k(0.44, P(ARC.AIM, SIDE)), k(0.5, P(ARC.REL, SIDE), { e: 'snap' }), k(1, GL),
  ], [{ t: 0.18, e: 'bowstring', pull: 1 }, { t: 0.5, e: 'proj', kind: 'arrow', from: 'bow', arc: 1.4 }, { t: 0.5, e: 'bowstring', pull: 0 }]);
  DEF.r_rapid = C('ranger', 1.0, 'full', [
    k(0, GL),
    k(0.3, P(G, { spine: [-6, 0, 0], chest: [-12, 0, 0], head: [-16, 0, 0], armL: [-30, 0, 30], armR: [-30, 0, -30] }, L.wide)),
    k(0.6, P(G, { spine: [10, 0, 0], chest: [4, 0, 0], head: [6, 0, 0] }, L.wide)),
    k(1, GL),
  ], [{ t: 0.35, e: 'aura', color: '#e0f0a0', dur: 1.5 }, { t: 0.35, e: 'motes', color: '#f0ffd0', n: 20, dur: 1 }]);
  DEF.r_fan = C('ranger', 1.0, 'full', [
    k(0, GL), k(0.18, P(NOCK, L.wide)), k(0.34, P(AIM, L.wide, { spine: [4, -40, 0] }), { root: [0, -0.1, 0] }), k(0.4, P(REL, L.wide, { spine: [4, -76, 0] }), { e: 'snap' }), k(1, GL, { root: R.guard }),
  ], [{ t: 0.16, e: 'bowstring', pull: 1 }, { t: 0.4, e: 'proj', kind: 'arrow', from: 'bow', fan: 5, spread: 50 }, { t: 0.4, e: 'bowstring', pull: 0 }]);
  DEF.r_pin = C('ranger', 0.95, 'full', [
    k(0, GL), k(0.2, P(LOW.NOCK, SIDE)), k(0.32, P(LOW.AIM, SIDE)), k(0.38, P(LOW.REL, SIDE), { e: 'snap' }), k(1, GL),
  ], [{ t: 0.18, e: 'bowstring', pull: 1 }, { t: 0.38, e: 'proj', kind: 'arrow', from: 'bow', impact: 'pin' }, { t: 0.38, e: 'bowstring', pull: 0 }]);
  DEF.r_roll = C('ranger', 1.1, 'full', [
    k(0, GL, { turn: 0 }),
    k(0.12, P(G, { spine: [40, 0, 0] }, L.deep), { root: [0, -0.4, 0], turn: 90 }),
    k(0.3, P(G, { spine: [100, 0, 0], chest: [30, 0, 0], head: [40, 0, 0] }, L.tuck), { root: [0, -0.5, 1.8], turn: 90, e: 'linear' }),
    k(0.45, P(G, { spine: [200, 0, 0], chest: [30, 0, 0] }, L.tuck), { root: [0, -0.55, 3.6], turn: 90, e: 'linear' }),
    k(0.52, P(NOCK, L.kneel), { root: [0, -0.44, 4.4], turn: 0 }),
    k(0.6, P(AIM, L.kneel), { root: [0, -0.44, 4.4], turn: 0 }),
    k(0.66, P(REL, L.kneel), { root: [0, -0.44, 4.4], e: 'snap' }),
    k(1, GL, { root: [0, 0, 4.4] }),
  ], [{ t: 0.1, e: 'dash' }, { t: 0.14, e: 'dust' }, { t: 0.5, e: 'bowstring', pull: 1 }, { t: 0.66, e: 'proj', kind: 'arrow', from: 'bow' }, { t: 0.66, e: 'bowstring', pull: 0 }], { endRoot: [0, 0, 4.4], rollSide: true });
  DEF.r_thousand = C('ranger', 1.9, 'full', [
    k(0, GL),
    k(0.12, P(G, { spine: [20, 0, 0] }, L.deep), { root: R.deep }),
    k(0.3, P(DOWN.NOCK, L.tuck), { root: [0, 4.2, 0.4], e: 'out' }),
    k(0.4, P(DOWN.AIM, L.air), { root: [0, 4.8, 0.5] }),
    k(0.44, P(DOWN.REL, L.air), { root: [0, 4.9, 0.5], e: 'snap' }),
    k(0.5, P(DOWN.AIM, L.air), { root: [0, 4.9, 0.5] }),
    k(0.54, P(DOWN.REL, L.air), { root: [0, 4.85, 0.5], e: 'snap' }),
    k(0.6, P(DOWN.AIM, L.air), { root: [0, 4.7, 0.5] }),
    k(0.64, P(DOWN.REL, L.air), { root: [0, 4.5, 0.5], e: 'snap' }),
    k(0.82, P(G, { spine: [24, 0, 0] }, L.deep), { root: [0, -0.4, 0.5], e: 'in' }),
    k(1, GL, { root: [0, 0, 0.5] }),
  ], [{ t: 0.12, e: 'dust' }, { t: 0.28, e: 'bowstring', pull: 1 }, { t: 0.44, e: 'proj', kind: 'arrow', from: 'bow', down: true }, { t: 0.54, e: 'proj', kind: 'arrow', from: 'bow', down: true }, { t: 0.64, e: 'proj', kind: 'arrow', from: 'bow', down: true },
    { t: 0.66, e: 'bowstring', pull: 0 }, { t: 0.47, e: 'rain', kind: 'arrow', r: 7, n: 50, dur: 0.9 }, { t: 0.82, e: 'dust' }], { endRoot: [0, 0, 0.5] });

  // ---- level 42 and 45 (the Cinder Reach) ----
  // Ripsaw Arrow: a quick full draw and release; the serrated head throws metal flecks where it lands
  DEF.r_ripsaw = C('ranger', 0.95, 'full', [
    k(0, GL), k(0.18, P(NOCK, SIDE)), k(0.36, P(AIM, SIDE)), k(0.42, P(AIM, SIDE, { spine: [5, -54, 0] })), k(0.48, P(REL, SIDE), { e: 'snap' }), k(0.74, mixPose(P(REL, SIDE), GL, 0.5)), k(1, GL),
  ], [{ t: 0.16, e: 'bowstring', pull: 1 }, { t: 0.48, e: 'proj', kind: 'arrow', from: 'bow', impact: 'shatter' }, { t: 0.48, e: 'bowstring', pull: 0 }, { t: 0.48, e: 'sound', s: 'bow' }]);
  // Deadweight Shot: dropped on one knee and braced, the iron-weighted arrow drawn to the ear and held through the
  // cast, then sent flat through the line; the release kicks the shoulders back
  DEF.r_deadweight = C('ranger', 1.65, 'full', [
    k(0, GL),
    k(0.07, mixPose(GL, P(DEEP.NOCK, L.kneel), 0.5), { root: [0, -0.22, -0.02] }),
    k(0.14, P(DEEP.NOCK, L.kneel), { root: R.kneel }),
    k(0.42, P(DEEP.AIM, L.kneel), { root: R.kneel }),
    k(0.8, P(DEEP.AIM, L.kneel, { spine: [6, -58, 0] }), { root: [0, -0.46, -0.02] }),
    k(1.4 / 1.65, P(DEEP.REL, L.kneel), { root: [0, -0.44, -0.1], e: 'snap' }),
    k(0.93, mixPose(P(DEEP.REL, L.kneel), GL, 0.5), { root: [0, -0.22, -0.05] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.12, e: 'bowstring', pull: 1 }, { t: 0.2, e: 'motes', color: '#fff0c0', n: 16, at: 'bow', dur: 1 }, { t: 0.85, e: 'proj', kind: 'arrow', from: 'bow', pierce: true, big: true }, { t: 0.85, e: 'bowstring', pull: 0 },
    { t: 0.85, e: 'shake', amt: 0.35 }, { t: 0.85, e: 'dust' }, { t: 0.86, e: 'wave', kind: 'dust', len: 14 }, { t: 0.85, e: 'sound', s: 'bow' }]);
  // ---- level 47 and 50 (the Rime Steps) ----
  // Chisel Arrow: nocked on a step forward, drawn deep and held a breath, then loosed; the square head splits plate
  DEF.r_chisel = C('ranger', 0.9, 'full', [
    k(0, GL),
    k(0.08, mixPose(GL, P(DEEP.NOCK, SIDE), 0.5), { root: [0, -0.01, 0.06] }),
    k(0.16, P(DEEP.NOCK, SIDE), { root: [0, -0.02, 0.12] }),
    k(0.36, P(DEEP.AIM, SIDE), { root: [0, -0.04, 0.22] }),
    k(0.46, P(DEEP.AIM, SIDE, { spine: [6, -56, 0] }), { root: [0, -0.04, 0.22] }),
    k(0.46 / 0.9, P(DEEP.REL, SIDE), { root: [0, -0.04, 0.2], e: 'snap' }),
    k(0.76, mixPose(P(DEEP.REL, SIDE), GL, 0.5), { root: [0, -0.02, 0.2] }),
    k(1, GL, { root: [0, 0, 0.2] }),
  ], [{ t: 0.14, e: 'bowstring', pull: 1 }, { t: 0.51, e: 'proj', kind: 'arrow', from: 'bow', impact: 'shatter' }, { t: 0.51, e: 'bowstring', pull: 0 }, { t: 0.51, e: 'sound', s: 'bow' }], { endRoot: [0, 0, 0.2] });
  // Hail of Bodkins: feet set wide, three high shots loosed one after another up into the sky (drawn through the cast,
  // re-nocked quickly between), and the heavy arrows come down together on the ground ahead
  DEF.r_hail = C('ranger', 1.6, 'full', [
    k(0, GL),
    k(0.05, mixPose(GL, P(HIGH.NOCK, SIDE), 0.5)),
    k(0.1, P(HIGH.NOCK, SIDE)),
    k(0.28, P(HIGH.AIM, L.wide), { root: [0, -0.1, 0] }),
    k(0.4, P(HIGH.AIM, L.wide, { spine: [-14, -52, 0] }), { root: [0, -0.12, 0] }),
    k(0.45, P(HIGH.REL, L.wide), { root: [0, -0.1, 0], e: 'snap' }),
    k(0.53, P(HIGH.NOCK, L.wide), { root: [0, -0.1, 0] }),
    k(0.59, P(HIGH.AIM, L.wide), { root: [0, -0.1, 0] }),
    k(0.63, P(HIGH.REL, L.wide), { root: [0, -0.1, 0], e: 'snap' }),
    k(0.71, P(HIGH.NOCK, L.wide), { root: [0, -0.1, 0] }),
    k(0.77, P(HIGH.AIM, L.wide), { root: [0, -0.1, 0] }),
    k(0.81, P(HIGH.REL, L.wide), { root: [0, -0.1, 0], e: 'snap' }),
    k(0.9, mixPose(P(HIGH.REL, L.wide), GL, 0.5), { root: [0, -0.05, 0] }),
    k(1, GL),
  ], [{ t: 0.08, e: 'bowstring', pull: 1 }, { t: 0.45, e: 'proj', kind: 'arrow', from: 'bow', up: true }, { t: 0.45, e: 'bowstring', pull: 0 }, { t: 0.47, e: 'sound', s: 'bow' }, { t: 0.5, e: 'bowstring', pull: 1 },
    { t: 0.63, e: 'proj', kind: 'arrow', from: 'bow', up: true }, { t: 0.63, e: 'bowstring', pull: 0 }, { t: 0.68, e: 'bowstring', pull: 1 }, { t: 0.81, e: 'proj', kind: 'arrow', from: 'bow', up: true }, { t: 0.81, e: 'bowstring', pull: 0 },
    { t: 'hit', e: 'rain', kind: 'arrow', r: 6, n: 45, dur: 0.75 }, { t: 'hit', e: 'shake', amt: 0.3 }]);
  // ---- level 52 and 55 (the Windward Heights) ----
  // Tether Arrow: nocked low, the corded arrow drawn and aimed down at the legs, held a breath, then loosed
  DEF.r_tether = C('ranger', 0.95, 'full', [
    k(0, GL),
    k(0.08, mixPose(GL, P(LOW.NOCK, SIDE), 0.5), { root: [0, -0.02, 0] }),
    k(0.16, P(LOW.NOCK, SIDE), { root: [0, -0.04, 0] }),
    k(0.34, P(LOW.AIM, SIDE), { root: [0, -0.06, 0.04] }),
    k(0.42, P(LOW.AIM, SIDE, { spine: [12, -54, 0] }), { root: [0, -0.06, 0.04] }),
    k(0.46 / 0.95, P(LOW.REL, SIDE), { root: [0, -0.06, 0.02], e: 'snap' }),
    k(0.76, mixPose(P(LOW.REL, SIDE), GL, 0.5), { root: [0, -0.03, 0.02] }),
    k(1, GL),
  ], [{ t: 0.14, e: 'bowstring', pull: 1 }, { t: 0.484, e: 'proj', kind: 'arrow', from: 'bow', impact: 'pin' }, { t: 0.484, e: 'bowstring', pull: 0 }, { t: 0.484, e: 'sound', s: 'bow' }, { t: 'hit', e: 'impact', kind: 'net', shake: 0.15 }]);
  // Ridgeline Salvo: four full draws and releases in a fast, even string, each re-nocked straight off the last, the feet
  // edging forward a little with every shot; the last release kicks the shoulders back
  {
    const rel = [0.4, 0.66, 0.92, 1.18].map((t) => t / 1.5);
    DEF.r_ridgeline = C('ranger', 1.5, 'full', [
      k(0, GL),
      k(0.06, mixPose(GL, P(NOCK, SIDE), 0.5)),
      k(0.12, P(NOCK, SIDE)),
      k(0.21, P(AIM, SIDE), { root: [0, -0.04, 0] }),
      ...rel.flatMap((u, i) => [
        // the string hand comes back from the release through a half-way key, so the elbow never folds more than ~60 deg a key
        ...(i ? [k(u - 0.128, mixPose(P(REL, SIDE), P(NOCK, SIDE), 0.5), { root: [0, -0.04, 0.05 * i - 0.02] }), k(u - 0.1, P(NOCK, SIDE), { root: [0, -0.04, 0.05 * i] }), k(u - 0.05, P(AIM, SIDE), { root: [0, -0.04, 0.05 * i] })] : []),
        k(u, P(REL, SIDE), { root: [0, -0.04, 0.05 * i + 0.02], e: 'snap' }),
      ]),
      k(0.9, mixPose(P(REL, SIDE), GL, 0.5), { root: [0, -0.02, 0.17] }),
      k(1, GL, { root: [0, 0, 0.17] }),
    ], [{ t: 0.1, e: 'bowstring', pull: 1 }, ...rel.flatMap((u, i) => [{ t: u, e: 'proj', kind: 'arrow', from: 'bow', impact: 'shatter' }, { t: u, e: 'bowstring', pull: 0 }, { t: u, e: 'sound', s: 'bow' }, ...(i < 3 ? [{ t: u + 0.05, e: 'bowstring', pull: 1 }] : [])]),
      { t: 'hit4', e: 'shake', amt: 0.25 }], { endRoot: [0, 0, 0.17] });
  }
  // ---- level 57 and 60 (Tidewater Sound) ----
  // Tar-Head Arrow: the tarred head held low a moment while it drips (nocked), drawn level to the jaw, held a breath
  // and loosed; it lands in a black splash of tar
  DEF.r_tarhead = C('ranger', 0.95, 'full', [
    k(0, GL),
    k(0.08, mixPose(GL, P(LOW.NOCK, SIDE), 0.5), { root: [0, -0.02, 0] }),
    k(0.18, P(LOW.NOCK, SIDE), { root: [0, -0.04, 0] }),
    k(0.34, P(AIM, SIDE), { root: [0, -0.04, 0.06] }),
    k(0.42, P(AIM, SIDE, { spine: [6, -54, 0] }), { root: [0, -0.04, 0.06] }),
    k(0.46 / 0.95, P(REL, SIDE), { root: [0, -0.04, 0.04], e: 'snap' }),
    k(0.76, mixPose(P(REL, SIDE), GL, 0.5), { root: [0, -0.02, 0.04] }),
    k(1, GL),
  ], [{ t: 0.14, e: 'bowstring', pull: 1 }, { t: 0.484, e: 'proj', kind: 'arrow', from: 'bow', impact: 'tar' }, { t: 0.484, e: 'bowstring', pull: 0 }, { t: 0.484, e: 'sound', s: 'bow' }]);
  // Spring Tide (capstone): down on one knee, drawn deep to the ear and held through the cast, loosed, re-nocked
  // straight off the string still kneeling, drawn and loosed again down the same line; each heavy arrow tears a wake
  // of spray along the ground
  DEF.r_springtide = C('ranger', 1.5, 'full', [
    k(0, GL),
    k(0.06, mixPose(GL, P(DEEP.NOCK, L.kneel), 0.5), { root: [0, -0.22, -0.02] }),
    k(0.13, P(DEEP.NOCK, L.kneel), { root: R.kneel }),
    k(0.36, P(DEEP.AIM, L.kneel), { root: R.kneel }),
    k(0.52, P(DEEP.AIM, L.kneel, { spine: [6, -58, 0] }), { root: [0, -0.46, -0.02] }),
    k(0.9 / 1.5, P(DEEP.REL, L.kneel), { root: [0, -0.44, -0.08], e: 'snap' }),
    k(0.66, mixPose(P(DEEP.REL, L.kneel), P(DEEP.NOCK, L.kneel), 0.5), { root: [0, -0.44, -0.06] }),
    k(0.7, P(DEEP.NOCK, L.kneel), { root: R.kneel }),
    k(0.79, P(DEEP.AIM, L.kneel), { root: R.kneel }),
    k(1.3 / 1.5, P(DEEP.REL, L.kneel), { root: [0, -0.44, -0.1], e: 'snap' }),
    k(0.94, mixPose(P(DEEP.REL, L.kneel), GL, 0.5), { root: [0, -0.22, -0.05] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.1, e: 'bowstring', pull: 1 }, { t: 0.16, e: 'motes', color: '#e4eef0', n: 14, at: 'bow', dur: 0.6 },
    { t: 'hit', e: 'proj', kind: 'arrow', from: 'bow', pierce: true, big: true }, { t: 'hit', e: 'bowstring', pull: 0 }, { t: 'hit', e: 'sound', s: 'bow' }, { t: 'hit', e: 'wave', kind: 'water', len: 18 }, { t: 'hit', e: 'shake', amt: 0.25 },
    { t: 0.68, e: 'bowstring', pull: 1 },
    { t: 'hit2', e: 'proj', kind: 'arrow', from: 'bow', pierce: true, big: true }, { t: 'hit2', e: 'bowstring', pull: 0 }, { t: 'hit2', e: 'sound', s: 'bow' }, { t: 'hit2', e: 'wave', kind: 'water', len: 18 }, { t: 'hit2', e: 'shake', amt: 0.35 }]);
  // ---- level 62 and 65 (the Rainward Gorge) ----
  // Ash Stake Arrow: the heavy stake arrow nocked low, drawn and aimed down at the track plates, held a breath and
  // loosed; it drives in with a wet splash of mud
  DEF.r_stake = C('ranger', 0.95, 'full', [
    k(0, GL),
    k(0.08, mixPose(GL, P(LOW.NOCK, SIDE), 0.5), { root: [0, -0.04, 0] }),
    k(0.18, P(LOW.NOCK, SIDE), { root: [0, -0.06, 0] }),
    k(0.34, P(LOW.AIM, SIDE), { root: [0, -0.08, 0.04] }),
    k(0.42, P(LOW.AIM, SIDE, { spine: [12, -54, 0] }), { root: [0, -0.08, 0.04] }),
    k(0.46 / 0.95, P(LOW.REL, SIDE), { root: [0, -0.08, 0.02], e: 'snap' }),
    k(0.76, mixPose(P(LOW.REL, SIDE), GL, 0.5), { root: [0, -0.04, 0.02] }),
    k(1, GL),
  ], [{ t: 0.14, e: 'bowstring', pull: 1 }, { t: 0.484, e: 'proj', kind: 'arrow', from: 'bow', impact: 'mud', big: true }, { t: 0.484, e: 'bowstring', pull: 0 }, { t: 0.484, e: 'sound', s: 'bow' }]);
  // Cloudburst (capstone): on wide feet, the bow tipped nearly straight up; four arrows nocked, drawn and loosed as
  // fast as the bow allows, then a hard rush of arrows and rain-wet mud comes down on the ground ahead, four times
  {
    const STEEP = set({ torso: lean(T_AIM, -22), nockTorso: lean(T_NOCK, -10), pitch: 68 });
    const rel = [0.42, 0.55, 0.68, 0.81];
    const keys = [k(0, GL), k(0.05, mixPose(GL, P(STEEP.NOCK, SIDE), 0.5)), k(0.1, P(STEEP.NOCK, SIDE)), k(0.28, P(STEEP.AIM, L.wide), { root: [0, -0.12, 0] }), k(0.38, P(STEEP.AIM, L.wide, { spine: [-18, -52, 0] }), { root: [0, -0.14, 0] })];
    rel.forEach((u, i) => { keys.push(k(u, P(STEEP.REL, L.wide), { root: [0, -0.12, 0], e: 'snap' })); if (i < 3) { keys.push(k(u + 0.05, P(STEEP.NOCK, L.wide), { root: [0, -0.12, 0] }), k(u + 0.1, P(STEEP.AIM, L.wide), { root: [0, -0.12, 0] })); } });
    keys.push(k(0.9, mixPose(P(STEEP.REL, L.wide), GL, 0.5), { root: [0, -0.06, 0] }), k(1, GL));
    DEF.r_cloudburst = C('ranger', 1.6, 'full', keys.map((q) => (q.t === rel[0] ? { ...q, e: 'snap' } : q)), [{ t: 0.08, e: 'bowstring', pull: 1 },
      ...rel.flatMap((u, i) => [{ t: u, e: 'proj', kind: 'arrow', from: 'bow', up: true }, { t: u, e: 'bowstring', pull: 0 }, { t: u + 0.01, e: 'sound', s: 'bow' }, ...(i < 3 ? [{ t: u + 0.05, e: 'bowstring', pull: 1 }] : [])]),
      { t: 'hit', e: 'rain', kind: 'arrow', r: 6, n: 60, dur: 1.0 }, { t: 'hit', e: 'cloud', kind: 'mud', r: 6 }, { t: 'hit2', e: 'impact', kind: 'mud', at: 'target', r: 3 }, { t: 'hit3', e: 'shake', amt: 0.25 }, { t: 'hit4', e: 'impact', kind: 'mud', at: 'target', r: 4 }, { t: 'hit4', e: 'shake', amt: 0.35 }]);
  }

  // ============================== S11: the Ranger's new kit (combat_design_fusion.md 4.2) ==============================
  // Every shot is drawn on the solved archer poses (AIM, NOCK, REL), the bow always side-on and the arrows flying parallel
  // (a twin pair leaves the string together, never fanned); the planted moves use the authored clips (Backflip, Kneel_Aim,
  // Throw_Underhand) on the body with the arms keyed. Effects are wood, rope, chalk, dust and splinters; a rain falls at one
  // slant and lands stitched (uneven). Contact times come from the new kit (kit.js / fusions.js), so the arrow leaves the
  // string on the server's contact; Piercing Arrow's clip waits at full draw while it is held (drawHold, game.js).
  {
    const K11 = (id, step) => { const s = CORE_BY_ID[id]; return step && s?.chain ? s.chain[step - 1] : s; };
    const TS = (h, i) => (h.ts ? h.ts[Math.min(i, h.ts.length - 1)] : h.t + i * (h.gap || 0));
    const arrow = (t, o = {}) => ({ t, e: 'proj', kind: 'arrow', from: 'bow', trail: 'streak', ...o }); // (a thin pale streak, never a glow)
    const str = (t, pull) => ({ t, e: 'bowstring', pull });
    const R11 = (id, dur, mask, keys, ev, o) => (DEF[id] = C('ranger', dur, mask, keys, ev, o));
    const DIS = set({ torso: lean(T_AIM, 18), nockTorso: lean(T_NOCK, 12), pitch: -28 }); // (from the top of a flip, down at the machine)
    const STEEP = set({ torso: lean(T_AIM, -22), nockTorso: lean(T_NOCK, -10), pitch: 68 });
    // ---- Quick Shot: a short nock, draw and loose on the upper body (on the run); the third step looses Twin Arrows, two on
    // the string together, a hand's width apart
    const quick = (id, step) => {
      const h = K11('r_quick', step).hit, d = 0.62, tr = h.t, twin = (h.n || 1) > 1;
      const keys = [k(0, GL), k((tr - 0.16) / d, P(NOCK, SIDE)), k((tr - 0.05) / d, P(AIM, SIDE)), k(tr / d, P(AIM, SIDE), { hold: true }), k((tr + 0.05) / d, P(REL, SIDE), { e: 'snap' }), k(0.82, mixPose(P(REL, SIDE), GL, 0.5)), k(1, GL)];
      R11(id, d, 'full', keys, [str((tr - 0.14) / d, 1), arrow('hit'), ...(twin ? [arrow('hit2')] : []), str('hit', 0), { t: 'hit', e: 'sound', s: 'bow' }], { skill: 'r_quick', hit: h, step });
    };
    quick('r_quick', 1); quick('r_quick_2', 2); quick('r_quick_3', 3);
    // Fletcher's Rhythm: the third step looses three side by side
    { const h = { ...K11('r_quick', 3).hit, n: 3 }; DEF.r_quick_3r = { ...DEF.r_quick_3, hit: h, events: [...DEF.r_quick_3.events, arrow('hit3')] }; }
    // ---- Disengage (0.85 s): a crouch, the Backflip 8 m back (root up 1.7 m), at the top the bow comes round onto the machine
    // and looses (the server's contact, 0.30), a crouched landing
    const flipBack = (D, dist, h, tUp, tLand) => { const out = []; for (let t = tUp + 1 / 60; t < tLand - 1e-6; t += 1 / 60) { const u = (t - tUp) / (tLand - tUp); out.push(k(t / D, {}, { root: [0, +(h * Math.sin(Math.PI * u)).toFixed(3), +(-dist * (1 - (1 - u) ** 1.6)).toFixed(3)], e: 'linear' })); } return out; };
    {
      const D = 0.85, h = K11('r_disengage').hit, tr = h.t;
      const keys = [k(0, GL), k(0.08 / D, P(G, { spine: [22, 0, 0] }, L.deep), { root: [0, -0.32, 0] }), ...flipBack(D, 8, 1.7, 0.08, 0.66),
        k((tr - 0.1) / D, P(DIS.NOCK, L.tuck)), k((tr - 0.02) / D, P(DIS.AIM, L.tuck)), k(tr / D, P(DIS.AIM, L.tuck), { hold: true }), k((tr + 0.05) / D, P(DIS.REL, L.air), { e: 'snap' }),
        k(0.66 / D, P(G, { spine: [22, 0, 0] }, L.deep), { root: [0, -0.32, -8] }), k(1, GL, { root: [0, 0, -8] })];
      R11('r_disengage', D, 'full', keys.sort((a, b) => a.t - b.t).filter((q, i, a) => i === 0 || q.t > a[i - 1].t + 1e-4), [{ t: 0.02, e: 'sound', s: 'gust' }, { t: 0.08 / D, e: 'dust' }, { t: 0.08 / D, e: 'dash' }, str((tr - 0.1) / D, 1), arrow('hit', { time: 0.08 }), str('hit', 0), { t: 'hit', e: 'sound', s: 'bow' }, { t: 0.66 / D, e: 'dust' }],
        { hit: h, endRoot: [0, 0, -8], ual: { mask: 'body', segs: [['Backflip', 0.08, 0.66, 0.08, 0.72]], end: 0.64 } });
    }
    // ---- Volley (1.15 s): the bow tipped up, a dozen loosed high; they come down on the machine in three stitched waves
    // (each wave starts falling 0.35 s before its contact)
    {
      const D = 1.15, h = K11('r_volley').hit, tr = 0.32;
      R11('r_volley', D, 'full', [k(0, GL), k(0.12 / D, P(HIGH.NOCK, SIDE)), k(0.26 / D, P(HIGH.AIM, L.wide), { root: [0, -0.1, 0] }), k(tr / D, P(HIGH.REL, L.wide), { root: [0, -0.1, 0], e: 'snap' }), k(0.6 / D, mixPose(P(HIGH.REL, L.wide), GL, 0.5)), k(1, GL)],
        [str(0.1 / D, 1), arrow(tr / D, { up: true }), arrow((tr + 0.02) / D, { up: true }), str(tr / D, 0), { t: tr / D, e: 'sound', s: 'bow' },
          ...[0, 1, 2].map((i) => ({ t: (TS(h, i) - 0.35) / D, e: 'rain', kind: 'arrow', r: 4.5, n: 5, dur: 0.12 })), { t: 'hit3', e: 'shake', amt: 0.15 }], { hit: h });
    }
    // ---- Snare Trap (0.85 s): Throw_Underhand, the snare swung low and let go; it lands on the server's contact
    {
      const D = 0.85, h = K11('r_trap').hit, rel = 0.36;
      R11('r_trap', D, 'full', [k(0, GL), k(0.22 / D, P(G, { spine: [30, -20, 0], armR: [30, 0, -20], foreR: [-30, 0, 0], head: [20, 0, 0] }, L.lungeR), { root: [0, -0.2, 0.1] }),
        k(rel / D, P(G, { spine: [24, 20, 0], armR: [-70, 0, -10], foreR: [-10, 0, 0], handR: [-30, 0, 0] }, L.lungeR), { root: [0, -0.2, 0.15], e: 'snap' }), k(1, GL)],
        [{ t: 0.12 / D, e: 'holdItem', side: 'R', item: 'trap', on: true }, { t: rel / D, e: 'holdItem', side: 'R', item: 'trap', on: false }, { t: rel / D, e: 'proj', kind: 'trap', from: 'R', arc: 0.5, ground: true, time: h.t - rel }, { t: rel / D, e: 'sound', s: 'whoosh' }],
        { hit: h, ual: { mask: 'body', segs: [['Throw_Underhand', 0, 0.6, 0, 0.667]], end: 0.6 } });
    }
    // ---- Piercing Arrow (1.5 s): nocked, drawn to the ear by 0.45 s and held; at full draw (0.98) the clip waits while the key
    // is held (drawHold), the loose 0.04 s after, the shoulders kicked back, a line of dust down the path
    {
      const D = 1.5, h = K11('r_pierce').hit, tr = h.t;
      R11('r_pierce', D, 'full', [k(0, GL), k(0.15 / D, P(DEEP.NOCK, SIDE)), k(0.45 / D, P(DEEP.AIM, SIDE)), k(0.98 / D, P(DEEP.AIM, SIDE, { spine: [7, -58, 0] })), k(tr / D, P(DEEP.AIM, SIDE, { spine: [7, -58, 0] }), { hold: true }), k((tr + 0.06) / D, P(DEEP.REL, SIDE), { e: 'snap' }), k(0.88, mixPose(P(DEEP.REL, SIDE), GL, 0.5)), k(1, GL)],
        [str(0.13 / D, 1), arrow('hit', { pierce: true, big: true, time: 0.1 }), str('hit', 0), { t: 'hit', e: 'shake', amt: 0.22 }, { t: 'hit', e: 'sound', s: 'bow' }, { t: 'hit', e: 'wave', kind: 'dust', len: 10 }],
        { hit: h, drawHold: { at: 0.98 / D, rel: tr / D } });
    }
    // ---- Marked Target (0.6 s): a quick loose on the run; the blunt head bursts in a puff of pale chalk on the plate
    { const h = K11('r_mark').hit, d = 0.6, tr = h.t; R11('r_mark', d, 'full', [k(0, GL), k((tr - 0.16) / d, P(NOCK, SIDE)), k((tr - 0.04) / d, P(AIM, SIDE)), k(tr / d, P(AIM, SIDE), { hold: true }), k((tr + 0.05) / d, P(REL, SIDE), { e: 'snap' }), k(1, GL)], [str((tr - 0.14) / d, 1), arrow('hit', { impact: 'chalk' }), str('hit', 0), { t: 'hit', e: 'sound', s: 'bow' }], { hit: h }); }
    // ---- Thousand Arrows (3.3 s): on wide feet the bow tipped steeply up, arrow after arrow loosed high (every 0.32 s), and
    // the rain comes down on the machine for 3 s at one slant
    {
      const D = 3.3, h = K11('r_thousand').hit, rel = [0.3, 0.62, 0.94, 1.26, 1.58, 1.9, 2.22, 2.54];
      const keys = [k(0, GL), k(0.12 / D, P(STEEP.NOCK, SIDE)), k(0.24 / D, P(STEEP.AIM, L.wide), { root: [0, -0.12, 0] })];
      rel.forEach((u, i) => { keys.push(k(u / D, P(STEEP.REL, L.wide), { root: [0, -0.12, 0], e: 'snap' })); if (i < rel.length - 1) keys.push(k((u + 0.12) / D, P(STEEP.NOCK, L.wide), { root: [0, -0.12, 0] }), k((u + 0.26) / D, P(STEEP.AIM, L.wide), { root: [0, -0.12, 0] })); });
      keys.push(k(2.9 / D, mixPose(P(STEEP.REL, L.wide), GL, 0.5)), k(1, GL));
      R11('r_thousand', D, 'full', keys, [str(0.1 / D, 1), ...rel.flatMap((u, i) => [arrow(u / D, { up: true }), str(u / D, 0), { t: u / D, e: 'sound', s: 'bow' }, ...(i < rel.length - 1 ? [str((u + 0.1) / D, 1)] : [])]),
        { t: (h.t - 0.35) / D, e: 'rain', kind: 'arrow', r: 7.5, n: 54, dur: 2.5 }, { t: 'hit9', e: 'shake', amt: 0.15 }], { hit: h });
    }

    // ---- the fusions (each opens fx.fuseBudget; no lights; at most two rings a beat)
    // Highwire Volley (1.1 s, the signature): out of Disengage's flip (it starts at the flip's height and carries on up and
    // back to 3.2 m), the body tipped over the bow drawn straight down, a 0.15 s own slow beat at the top, the loose, and the
    // twelve arrows come down on the spot he left in a stitched line; a crouched landing
    {
      const D = 1.1, f = FUSION_BY_ID.rf_highwire, h = f.hit, tr = 0.3;
      const y = (t) => (t < tr ? 1.5 + 1.7 * (1 - (1 - t / tr) ** 2) : t < 0.82 ? 3.2 * (1 - ((t - tr) / 0.52) ** 2) : 0);
      const keys = [k(0, P(DOWN.NOCK, L.tuck), { root: [0, 1.5, 0] })];
      for (let t = 1 / 60; t < 0.82 - 1e-6; t += 1 / 60) keys.push(k(t / D, {}, { root: [0, +Math.max(0, y(t)).toFixed(3), +(-4 * Math.min(1, t / 0.82)).toFixed(3)], e: 'linear' }));
      keys.push(k((tr - 0.08) / D, P(DOWN.AIM, L.air)), k(tr / D, P(DOWN.AIM, L.air), { hold: true }), k((tr + 0.05) / D, P(DOWN.REL, L.air), { e: 'snap' }), k(0.6 / D, P(DOWN.AIM, L.air)), k(0.82 / D, P(G, { spine: [24, 0, 0] }, L.deep), { root: [0, -0.34, -4] }), k(1, GL, { root: [0, 0, -4], e: 'smooth' }));
      R11('rf_highwire', D, 'full', keys.sort((a, b) => a.t - b.t).filter((q, i, a) => i === 0 || q.t > a[i - 1].t + 1e-4), [
        { t: 0.02, e: 'camlift', up: 1.6, back: 2.4, dur: 1.0 }, str(0.04, 1), { t: (tr - 0.05) / D, e: 'hitstop', dur: 0.15, self: true },
        arrow(tr / D, { down: true, impact: 'pin' }), arrow((tr + 0.01) / D, { down: true, impact: 'pin' }), str(tr / D, 0), { t: tr / D, e: 'sound', s: 'bow' },
        { t: (TS(h, 0) - 0.35) / D, e: 'rain', kind: 'arrow', at: 'castA', stitch: true, r: 4, n: 12, dur: TS(h, 3) - TS(h, 0) }, { t: 'hit4', e: 'shake', amt: 0.3 }, { t: 0.82 / D, e: 'dust' }],
        { endRoot: [0, 0, -4], ual: { mask: 'body', segs: [['Backflip', 0, 0.3, 0.36, 0.6], ['Air_Hang_Loop', 0.3, 0.62, 0, 0.32], ['Slam_Land', 0.8, D, 0.1, 0.42]] } });
    }
    // Rolling Shot (0.75 s): up out of the tumble on one knee, three arrows loosed from the kneel as he rises (the last heavy)
    {
      const D = 0.75, h = FUSION_BY_ID.rf_rolling.hit, keys = [k(0, P(NOCK, L.kneel), { root: R.kneel })];
      for (let i = 0; i < 3; i++) { const t = TS(h, i); keys.push(k((t - 0.03) / D, P(AIM, L.kneel), { root: R.kneel }), k(t / D, P(AIM, L.kneel), { root: R.kneel, hold: true }), k((t + 0.04) / D, P(REL, L.kneel), { root: R.kneel, e: 'snap' }), k((t + 0.08) / D, P(NOCK, L.kneel), { root: R.kneel })); }
      keys.push(k(0.82, mixPose(P(REL, L.kneel), GL, 0.5), { root: [0, -0.2, 0] }), k(1, GL));
      R11('rf_rolling', D, 'full', keys.filter((q, i, a) => i === 0 || q.t > a[i - 1].t + 1e-4), [{ t: 0.01, e: 'dust' }, { t: 0.02, e: 'sound', s: 'gust' }, ...[0, 1, 2].flatMap((i) => [arrow(i ? 'hit' + (i + 1) : 'hit', { big: i === 2, time: 0.06 }), { t: i ? 'hit' + (i + 1) : 'hit', e: 'sound', s: 'bow' }])], {});
    }
    // Tripwire Burst (0.75 s): a quick deep draw and an arrow into his own snare: the snare bursts (game.js 'trapgone') in
    // splinters and flying rope with one ring of dust
    {
      const D = 0.75, tr = FUSION_BY_ID.rf_tripwire.hit.t - 0.08;
      R11('rf_tripwire', D, 'full', [k(0, GL), k(0.08 / D, P(DEEP.NOCK, SIDE)), k((tr - 0.04) / D, P(DEEP.AIM, SIDE, { spine: [12, -54, 0] })), k(tr / D, P(DEEP.AIM, SIDE, { spine: [12, -54, 0] }), { hold: true }), k((tr + 0.05) / D, P(DEEP.REL, SIDE), { e: 'snap' }), k(0.8, mixPose(P(DEEP.REL, SIDE), GL, 0.5)), k(1, GL)],
        [str(0.06 / D, 1), arrow(tr / D, { low: true, time: 0.08, impact: 'pin' }), str(tr / D, 0), { t: tr / D, e: 'sound', s: 'bow' }, { t: 'hit', e: 'shake', amt: 0.3 }], {});
    }
    // Ridgeline Salvo (1.1 s): the bow tipped up, three loosed high, and the volley lands along the line the arrow flew, one
    // stretch after another away from him (rainline), dust at each
    {
      const D = 1.1, h = FUSION_BY_ID.rf_ridgeline.hit, tr = 0.14;
      R11('rf_ridgeline', D, 'full', [k(0, GL), k(0.06 / D, P(HIGH.AIM, L.wide), { root: [0, -0.1, 0] }), k(tr / D, P(HIGH.REL, L.wide), { root: [0, -0.1, 0], e: 'snap' }), k(0.6 / D, mixPose(P(HIGH.REL, L.wide), GL, 0.4)), k(1, GL)],
        [arrow(tr / D, { up: true }), arrow((tr + 0.02) / D, { up: true }), arrow((tr + 0.04) / D, { up: true }), { t: tr / D, e: 'sound', s: 'bow' },
          { t: (h.t - 0.35) / D, e: 'rainline', n: 16, len: 14, dur: (h.n - 1) * h.gap + 0.05 }, { t: 'hit7', e: 'shake', amt: 0.3 }], {});
    }
    // Ricochet Bodkin (0.6 s): a quick loose on the run; the glances from machine to machine are game.js 'bounce'
    { const d = 0.6, h = FUSION_BY_ID.rf_ricochet.hit, tr = h.t; R11('rf_ricochet', d, 'full', [k(0, GL), k((tr - 0.14) / d, P(NOCK, SIDE)), k((tr - 0.04) / d, P(AIM, SIDE)), k(tr / d, P(AIM, SIDE), { hold: true }), k((tr + 0.05) / d, P(REL, SIDE), { e: 'snap' }), k(1, GL)], [str(0.04, 1), arrow('hit', { impact: 'chalk', big: true }), str('hit', 0), { t: 'hit', e: 'sound', s: 'bow' }], {}); }
    // Cloudburst (2.6 s): the steep bow loosed as fast as it goes, and a dense rain on the volley's ground for 2 s, the
    // ground pocked with shafts
    {
      const D = 2.6, h = FUSION_BY_ID.rf_cloudburst.hit, rel = [0.14, 0.38, 0.62, 0.86, 1.1, 1.34];
      const keys = [k(0, P(STEEP.AIM, L.wide), { root: [0, -0.12, 0] })];
      rel.forEach((u, i) => { keys.push(k(u / D, P(STEEP.REL, L.wide), { root: [0, -0.12, 0], e: 'snap' })); if (i < rel.length - 1) keys.push(k((u + 0.08) / D, P(STEEP.NOCK, L.wide), { root: [0, -0.12, 0] }), k((u + 0.2) / D, P(STEEP.AIM, L.wide), { root: [0, -0.12, 0] })); });
      keys.push(k(2.3 / D, mixPose(P(STEEP.REL, L.wide), GL, 0.5)), k(1, GL));
      R11('rf_cloudburst', D, 'full', keys, [...rel.flatMap((u) => [arrow(u / D, { up: true }), { t: u / D, e: 'sound', s: 'bow' }]), { t: (h.t - 0.35) / D, e: 'rain', kind: 'arrow', r: 4.5, n: 60, dur: (h.n - 1) * h.gap }, { t: 'hit6', e: 'cloud', kind: 'dust', r: 4 }, { t: 'hit12', e: 'shake', amt: 0.35 }], {});
    }
    // Spring Snare (1.2 s): a stamp on the snare's bar (it snaps up and throws the machine), the vault off it 12 m back and up
    // 3.5 m on the Backflip, two loose-downs of three arrows each from the top, a crouched landing
    {
      const D = 1.2, h = FUSION_BY_ID.rf_springsnare.hit, t1 = TS(h, 1), t2 = TS(h, 2);
      const keys = [k(0, GL), k(0.1 / D, P(G, { spine: [24, 0, 0] }, L.deep), { root: [0, -0.32, 0] }), ...flipBack(D, 12, 3.5, 0.12, 0.95)];
      for (const t of [t1, t2]) keys.push(k((t - 0.08) / D, P(DOWN.AIM, L.air)), k(t / D, P(DOWN.AIM, L.air), { hold: true }), k((t + 0.04) / D, P(DOWN.REL, L.air), { e: 'snap' }));
      keys.push(k(0.95 / D, P(G, { spine: [24, 0, 0] }, L.deep), { root: [0, -0.34, -12] }), k(1, GL, { root: [0, 0, -12], e: 'smooth' }));
      R11('rf_springsnare', D, 'full', keys.sort((a, b) => a.t - b.t).filter((q, i, a) => i === 0 || q.t > a[i - 1].t + 1e-4), [
        { t: 'hit', e: 'impact', kind: 'net', at: 'target' }, { t: 'hit', e: 'dust' }, { t: 0.12 / D, e: 'camlift', up: 2.2, back: 3, dur: 1.1 }, { t: 0.12 / D, e: 'dash' },
        ...[t1, t2].flatMap((t) => [arrow((t - 0.01) / D, { down: true, time: 0.2, impact: 'pin' }), arrow(t / D, { down: true, time: 0.2, impact: 'pin' }), arrow((t + 0.01) / D, { down: true, time: 0.2, impact: 'pin' }), { t: t / D, e: 'sound', s: 'bow' }]), str(0.2 / D, 1),
        { t: 0.95 / D, e: 'dust' }],
        { endRoot: [0, 0, -12], ual: { mask: 'body', segs: [['Leap_Rise', 0, 0.12, 0.05, 0.3], ['Backflip', 0.12, 0.55, 0.1, 0.7], ['Air_Hang_Loop', 0.55, 0.9, 0, 0.35], ['Slam_Land', 0.92, D, 0.1, 0.42]] } });
    }
    // Long Draw (1.45 s): down on one knee (Kneel_Aim on the body), the full draw held on the chalk, a 0.1 s still beat, the
    // loose: dust kicked up at his knee and a line of dust down the path; T4 at the machine
    {
      const D = 1.45, tr = FUSION_BY_ID.rf_longdraw.hit.t;
      R11('rf_longdraw', D, 'full', [k(0, GL), k(0.12 / D, P(DEEP.NOCK, L.kneel), { root: R.kneel }), k(0.5 / D, P(DEEP.AIM, L.kneel), { root: R.kneel }), k((tr - 0.02) / D, P(DEEP.AIM, L.kneel, { spine: [6, -58, 0] }), { root: R.kneel }), k(tr / D, P(DEEP.AIM, L.kneel, { spine: [6, -58, 0] }), { root: R.kneel, hold: true }), k((tr + 0.06) / D, P(DEEP.REL, L.kneel), { root: [0, -0.44, -0.1], e: 'snap' }), k(0.86, mixPose(P(DEEP.REL, L.kneel), GL, 0.5), { root: [0, -0.22, -0.05] }), k(1, GL)],
        [str(0.1 / D, 1), { t: (tr - 0.1) / D, e: 'hitstop', dur: 0.1, self: true }, arrow('hit', { pierce: true, big: true }), str('hit', 0), { t: 'hit', e: 'sound', s: 'bow' }, { t: 'hit', e: 'dust' }, { t: 'hit', e: 'wave', kind: 'dust', len: 16 }, { t: 'hit', e: 'shake', amt: 0.35 }],
        { ual: { mask: 'body', segs: [['Kneel_Aim', 0, 0.3, 0, 0.42], ['Kneel_Aim', 0.3, 1.05, 0.42, 0.45], ['Kneel_Aim', 1.05, D, 0.8, 1.0]] } });
    }
    // Closed Ground (1.75 s, the triad): three volleys loosed high one after another; each comes down on the burst trap's
    // ground (the machines the tripwire holds), the last breaking them
    {
      const D = 1.75, h = FUSION_BY_ID.rt_closedground.hit, rel = [0.16, 0.52, 0.88];
      const keys = [k(0, P(HIGH.AIM, L.wide), { root: [0, -0.1, 0] })];
      rel.forEach((u, i) => { keys.push(k(u / D, P(HIGH.REL, L.wide), { root: [0, -0.1, 0], e: 'snap' })); if (i < 2) keys.push(k((u + 0.1) / D, P(HIGH.NOCK, L.wide), { root: [0, -0.1, 0] }), k((u + 0.26) / D, P(HIGH.AIM, L.wide), { root: [0, -0.1, 0] })); });
      keys.push(k(1.45 / D, mixPose(P(HIGH.REL, L.wide), GL, 0.5)), k(1, GL));
      R11('rt_closedground', D, 'full', keys, [...rel.flatMap((u) => [arrow(u / D, { up: true }), arrow((u + 0.02) / D, { up: true }), { t: u / D, e: 'sound', s: 'bow' }]),
        ...[0, 1, 2].map((i) => ({ t: (TS(h, i) - 0.35) / D, e: 'rain', kind: 'arrow', r: 4, n: 14, dur: 0.14 })), { t: 'hit3', e: 'ring', color: '#c8b898', r: 4 }, { t: 'hit3', e: 'shake', amt: 0.45 }], {});
    }
  }
}

// ============================== CHEMIST ===================================
{
  const G = P(guard('chemist'), { spine: [6, 0, 0] });
  const GL = P(G, LG);
  const ROD = { armR: [-30, 0, -10], foreR: [-70, 0, 0], handR: [10, 0, 0] };
  // overhand throw with the left hand
  const throwKeys = (dur, relT, o = {}) => [
    k(0, GL),
    k(relT * 0.55, P(ROD, { spine: [-6, 40, 0], chest: [-8, 20, 0], armL: [-150, 30, 50], foreL: [-90, 0, 0], handL: [-30, 0, 0], head: [0, -30, 0] }, L.stepBack, o.wind || {}), { root: [0, -0.04, -0.1] }),
    k(relT, P(ROD, { spine: [24, -30, 0], chest: [10, -20, 0], armL: [-110, -10, 10], foreL: [-10, 0, 0], handL: [20, 0, 0], head: [8, 10, 0] }, L.lungeL, o.rel || {}), { root: [0, -0.14, 0.22], e: 'snap' }),
    k(relT + 0.15, P(ROD, { spine: [26, -36, 0], armL: [-60, -20, 10], foreL: [-30, 0, 0] }), { root: [0, -0.12, 0.2] }),
    k(1, GL, { root: R.guard }),
  ];
  const C1 = (id, dur, keys, ev, o) => (DEF[id] = C('chemist', dur, 'full', keys, ev, o));
  // Fire Flask: the flask is shaken (channel sway) while the chemist leans back further and further, elbow climbing,
  // then winds right back and hurls it
  C1('c_fire', 1.4, [
    k(0, GL),
    k(0.2, P(ROD, { spine: [6, 0, 0], chest: [-2, 0, 0], armL: [-60, 0, 20], foreL: [-90, 0, 0], handL: [-40, 0, 0], head: [16, 0, 0] })),
    k(0.62, P(ROD, { spine: [-14, 18, 0], chest: [-6, 10, 0], head: [-10, -10, 0], armL: [-82, 12, 30], foreL: [-130, 0, 0], handL: [-30, 0, 0] }, L.stepBack), { root: [0, -0.04, -0.06] }),
    k(0.7, P(ROD, { spine: [-10, 44, 0], chest: [-8, 22, 0], armL: [-160, 30, 50], foreL: [-90, 0, 0], head: [0, -30, 0] }, L.stepBack), { root: [0, -0.04, -0.1] }),
    k(0.78, P(ROD, { spine: [26, -30, 0], chest: [10, -20, 0], armL: [-110, -10, 10], foreL: [-6, 0, 0], handL: [20, 0, 0] }, L.lungeL), { root: [0, -0.14, 0.22], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.12, e: 'holdItem', side: 'L', item: 'flaskFire', on: true }, { t: 0.2, e: 'motes', color: '#ff8a30', n: 16, at: 'handL', dur: 0.9 }, { t: 0.79, e: 'holdItem', side: 'L', item: 'flaskFire', on: false }, { t: 0.79, e: 'proj', kind: 'flask', item: 'flaskFire', from: 'L', arc: 1, impact: 'fire', spin: 10 }],
    { channel: { from: 0.2, to: 0.66, hz: 2.2, bones: { armL: [6, 0, 4], foreL: [-10], handL: [14, 0, 0], spine: [3, 4, 0], head: [2, 0, 0] } } });
  C1('c_acid', 0.9, [
    k(0, GL),
    k(0.28, P(ROD, { spine: [8, 50, 0], armL: [-40, -20, 90], foreL: [-60, 0, 0], handL: [0, 0, 0] }, L.stepBack), { root: [0, -0.06, -0.06] }),
    k(0.46, P(ROD, { spine: [20, -40, 0], armL: [-90, 30, 40], foreL: [-10, 0, 0] }, L.lungeL), { root: [0, -0.14, 0.2], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.08, e: 'holdItem', side: 'L', item: 'flaskAcid', on: true }, { t: 0.46, e: 'holdItem', side: 'L', item: 'flaskAcid', on: false }, { t: 0.46, e: 'proj', kind: 'flask', item: 'flaskAcid', from: 'L', arc: 0.6, impact: 'acid', spin: 14 }]);
  // Rod Strike: the rod is raised back over the head, then brought down so the brass head lands in front
  const CL = { armL: [-40, 0, 30], foreL: [-60, 0, 0] };
  C1('c_staff', 0.8, [
    k(0, GL),
    k(0.24, P(CL, wield({ spine: [-4, -20, 0], chest: [-6, -8, 0], head: [-4, 18, 0] }, [-0.26, 1.9, 0.04], [0.12, 0.72, -0.68], [-0.65, 1.7, 0.25]), L.stepBack), { root: [0, -0.04, -0.06], e: 'out' }),
    k(0.38, P(CL, wield({ spine: [22, 14, 0], chest: [10, 8, 0], head: [8, -14, 0] }, [-0.1, 1.26, 0.5], [0.18, -0.45, 0.87], [-0.55, 1.1, 0.2]), L.lungeL), { root: [0, -0.12, 0.2], e: 'snap' }),
    k(0.52, P(CL, wield({ spine: [26, 18, 0], chest: [10, 10, 0], head: [8, -18, 0] }, [-0.06, 1.02, 0.42], [0.15, -0.8, 0.58], [-0.5, 0.82, 0.2]), L.lungeL), { root: [0, -0.12, 0.2] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.26, e: 'trail', on: true, color: '#e0b060', along: 1.0 }, { t: 'hit', e: 'impact', kind: 'blunt', shake: 0.25, stop: 0.05 }, { t: 0.6, e: 'trail', on: false }], { strike: 0.18 });
  C1('c_chill', 0.9, [
    k(0, GL),
    // wound up with a big twist, then a full-arm thrust with a step; the recoil is held a moment
    k(0.25, P(ROD, { spine: [-4, 35, 0], chest: [-4, 14, 0], head: [0, -30, 0], armL: [-40, 0, 30], foreL: [-120, 0, 0], handL: [-60, 0, 0] }, L.stepBack), { root: [0, -0.03, -0.06] }),
    k(0.42, P(ROD, { spine: [18, -12, 0], chest: [6, -6, 0], head: [4, 10, 0], armL: [-95, 0, -6], foreL: [0, 0, 0], handL: [30, 0, 0] }, L.lungeL), { root: [0, -0.1, 0.12], e: 'snap' }),
    k(0.55, P(ROD, { spine: [-6, -8, 0], chest: [-4, -4, 0], armL: [-80, 0, 0], foreL: [-12, 0, 0], handL: [10, 0, 0] }, L.lungeL), { root: [0, -0.08, 0.1], e: 'out' }),
    k(0.68, P(ROD, { spine: [-4, -6, 0], armL: [-76, 0, 4], foreL: [-18, 0, 0] }, L.lungeL), { root: [0, -0.08, 0.1] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.42, e: 'cloud', kind: 'chill', r: 7, cone: true, selfStop: 0.04 }]);
  C1('c_volatile', 1.7, [
    k(0, GL),
    ...[0.12, 0.22, 0.32, 0.42, 0.52, 0.62].map((t, i) => k(t, P(ROD, { spine: [6, 10, 0], armL: [-70, 0, 20], foreL: [-100 + (i % 2) * 30, 0, 0], handL: [-30 + (i % 2) * 40, 0, 0], head: [20, 0, 0] }))),
    k(0.74, P(ROD, { spine: [-10, 44, 0], chest: [-8, 22, 0], armL: [-165, 30, 50], foreL: [-90, 0, 0] }, L.stepBack), { root: [0, -0.04, -0.12] }),
    k(0.86, P(ROD, { spine: [28, -32, 0], chest: [10, -20, 0], armL: [-110, -10, 10], foreL: [-6, 0, 0] }, L.lungeL), { root: [0, -0.16, 0.24], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.08, e: 'holdItem', side: 'L', item: 'flaskVolatile', on: true }, { t: 0.15, e: 'motes', color: '#c0ff60', n: 30, at: 'handL', dur: 1.0 }, { t: 0.87, e: 'holdItem', side: 'L', item: 'flaskVolatile', on: false }, { t: 0.87, e: 'proj', kind: 'flask', item: 'flaskVolatile', from: 'L', arc: 1.1, impact: 'bigfire', spin: 16 }]);
  C1('c_smokebomb', 0.8, [
    k(0, GL),
    k(0.25, P(ROD, { spine: [-6, 0, 0], armL: [-150, 0, 30], foreL: [-60, 0, 0] })),
    k(0.42, P(ROD, { spine: [40, 0, 0], armL: [-20, 0, 20], foreL: [-10, 0, 0], head: [20, 0, 0] }, L.deep), { root: R.deep, e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.1, e: 'holdItem', side: 'L', item: 'bomb', on: true }, { t: 0.42, e: 'holdItem', side: 'L', item: 'bomb', on: false }, { t: 0.42, e: 'cloud', kind: 'smoke', r: 5, at: 'self' }, { t: 0.42, e: 'flash', color: '#ffffff' }]);
  C1('c_tar', 1.0, throwKeys(1.0, 0.68, { wind: { armL: [-100, 20, 40] } }), [{ t: 0.1, e: 'holdItem', side: 'L', item: 'pot', on: true }, { t: 0.68, e: 'holdItem', side: 'L', item: 'pot', on: false }, { t: 0.68, e: 'proj', kind: 'flask', item: 'pot', from: 'L', arc: 0.9, impact: 'tar', ground: true, spin: 6 }]);
  C1('c_spark', 1.2, [
    k(0, GL),
    k(0.25, P({ spine: [10, 20, 0], armR: [-80, 0, -10], foreR: [-30, 0, 0], handR: [-50, 0, 0], armL: [-70, 0, 10], foreL: [-60, 0, 0], handL: [0, 0, 0] }, L.wide), { root: [0, -0.12, 0] }),
    k(0.45, P({ spine: [16, 20, 0], armR: [-86, 0, -10], foreR: [-20, 0, 0], handR: [-60, 0, 0], armL: [-74, 0, 10], foreL: [-50, 0, 0] }, L.wide), { root: [0, -0.14, 0] }),
    k(0.8, P({ spine: [16, 20, 0], armR: [-86, 0, -10], foreR: [-20, 0, 0], handR: [-60, 0, 0] }, L.wide), { root: [0, -0.14, 0] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.4, e: 'sparks', at: 'rod', dur: 0.6, cone: true }, { t: 0.4, e: 'spinGear', dur: 0.8 }]);
  C1('c_concussion', 0.9, [
    k(0, GL),
    k(0.2, P(ROD, { spine: [-8, 0, 0], armL: [-150, 0, 30], foreL: [-80, 0, 0] })),
    k(0.36, P(ROD, { spine: [46, 0, 0], armL: [-10, 0, 20], foreL: [-6, 0, 0], head: [20, 0, 0] }, L.deep), { root: R.deep, e: 'snap' }),
    k(0.5, P(ROD, { spine: [-20, 0, 0], armL: [-60, 0, 60], armR: [-60, 0, -60] }, L.stepBack), { root: [0, 0.1, -0.5] }),
    k(1, GL, { root: [0, 0, -0.5] }),
  ], [{ t: 0.08, e: 'holdItem', side: 'L', item: 'bomb', on: true }, { t: 0.36, e: 'holdItem', side: 'L', item: 'bomb', on: false }, { t: 'hit', e: 'impact', kind: 'blast', at: 'self', r: 5, shake: 0.6, stop: 0.05 }, { t: 'hit', e: 'ring', color: '#ffd8a0', r: 6 }], { endRoot: [0, 0, -0.5] });
  C1('c_draught', 1.25, [
    k(0, GL),
    k(0.25, P(ROD, { spine: [0, 0, 0], armL: [-120, 40, 10], foreL: [-130, 0, 0], handL: [-40, 0, 0], head: [0, 0, 0] })),
    k(0.6, P(ROD, { spine: [-12, 0, 0], chest: [-8, 0, 0], head: [-36, 0, 0], armL: [-150, 30, 10], foreL: [-140, 0, 0], handL: [-80, 0, 0] })),
    k(0.8, P(ROD, { spine: [4, 0, 0], armL: [-40, 20, 20], foreL: [-60, 0, 0] })),
    k(1, GL),
  ], [{ t: 0.1, e: 'holdItem', side: 'L', item: 'flaskHeal', on: true }, { t: 0.8, e: 'holdItem', side: 'L', item: 'flaskHeal', on: false }, { t: 0.82, e: 'impact', kind: 'heal', at: 'self' }]);
  C1('c_shrapnel', 1.1, [
    k(0, GL),
    k(0.3, P(ROD, { spine: [20, 30, 0], armL: [20, 0, 20], foreL: [-30, 0, 0] }, L.lungeL), { root: [0, -0.2, 0.06] }),
    k(0.5, P(ROD, { spine: [14, -10, 0], armL: [-90, 0, 0], foreL: [-6, 0, 0], handL: [-20, 0, 0] }, L.lungeL), { root: [0, -0.18, 0.2], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.1, e: 'holdItem', side: 'L', item: 'grenade', on: true }, { t: 0.5, e: 'holdItem', side: 'L', item: 'grenade', on: false }, { t: 0.5, e: 'proj', kind: 'flask', item: 'grenade', from: 'L', arc: 0.35, impact: 'shrapnel', ground: true, bounce: 3, spin: 20 }]);
  C1('c_corrosive', 1.1, throwKeys(1.1, 0.6, { wind: { armL: [-170, 10, 30] } }), [{ t: 0.1, e: 'holdItem', side: 'L', item: 'jar', on: true }, { t: 0.6, e: 'holdItem', side: 'L', item: 'jar', on: false }, { t: 0.6, e: 'proj', kind: 'flask', item: 'jar', from: 'L', arc: 1.0, impact: 'acidcloud', ground: true, spin: 8 }]);
  C1('c_flash', 0.95, [
    k(0, GL),
    k(0.3, P(ROD, { spine: [-6, 0, 0], armL: [-120, 0, 20], foreL: [-80, 0, 0], head: [0, 0, 0] })),
    k(0.46, P(ROD, { spine: [12, 0, 0], armL: [-96, 0, 0], foreL: [0, 0, 0], handL: [-20, 0, 0], head: [0, 50, 0] }, L.stepL), { root: [0, -0.06, 0.1], e: 'snap' }),
    k(0.6, P(ROD, { spine: [6, 0, 0], armL: [-60, 0, 20], foreL: [-60, 0, 0], head: [10, 60, 0], armR: [-60, 0, -10], foreR: [-120, 0, 0] })),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.1, e: 'holdItem', side: 'L', item: 'bomb', on: true }, { t: 0.46, e: 'holdItem', side: 'L', item: 'bomb', on: false }, { t: 0.48, e: 'flash', color: '#ffffff', big: true, at: 'front3' }, { t: 0.48, e: 'shake', amt: 0.25 }]);
  C1('c_catalyst', 1.0, [
    k(0, GL),
    k(0.2, P({ spine: [16, 0, 0], head: [30, 0, 0], armR: [-50, -20, 10], foreR: [-110, 0, 0], handR: [0, 0, 0], armL: [-50, 20, -10], foreL: [-110, 0, 0], handL: [0, 0, 0] })),
    k(0.4, P({ spine: [16, 0, 0], head: [30, 0, 0], armR: [-56, -24, 14], foreR: [-120, 0, 0], handR: [-40, 0, 0], armL: [-50, 20, -14], foreL: [-100, 0, 0], handL: [40, 0, 0] })),
    k(0.6, P({ spine: [16, 0, 0], head: [30, 0, 0], armR: [-50, -20, 10], foreR: [-110, 0, 0], handR: [0, 0, 0], armL: [-56, 24, -10], foreL: [-120, 0, 0], handL: [-50, 0, 0] })),
    k(1, GL),
  ], [{ t: 0.12, e: 'holdItem', side: 'L', item: 'flaskVolatile', on: true }, { t: 0.4, e: 'motes', color: '#c49aff', n: 26, at: 'handL', dur: 0.6 }, { t: 0.7, e: 'holdItem', side: 'L', item: 'flaskVolatile', on: false }, { t: 0.66, e: 'aura', color: '#c49aff', dur: 1.5 }]);
  C1('c_chain', 1.2, [
    k(0, GL),
    k(0.14, P(ROD, { spine: [-6, 40, 0], armL: [-150, 30, 50], foreL: [-90, 0, 0] }, L.stepBack)),
    k(0.26, P(ROD, { spine: [22, -30, 0], armL: [-110, -10, 10], foreL: [-6, 0, 0] }, L.stepL), { e: 'snap' }),
    k(0.36, P(ROD, { spine: [-6, 44, 0], armL: [-150, 30, 50], foreL: [-90, 0, 0] }, L.stepBack)),
    k(0.46, P(ROD, { spine: [22, -10, 0], armL: [-100, -10, 0], foreL: [-6, 0, 0] }, L.stepL), { e: 'snap' }),
    k(0.56, P(ROD, { spine: [-6, 30, 0], armL: [-40, -20, 90], foreL: [-60, 0, 0] }, L.stepBack)),
    k(0.66, P(ROD, { spine: [22, -50, 0], armL: [-90, 30, 40], foreL: [-10, 0, 0] }, L.lungeL), { root: [0, -0.12, 0.2], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [0.26, 0.46, 0.66].flatMap((t, i) => [{ t: t - 0.14, e: 'holdItem', side: 'L', item: 'flaskFire', on: true }, { t, e: 'holdItem', side: 'L', item: 'flaskFire', on: false }, { t, e: 'proj', kind: 'flask', item: ['flaskFire', 'flaskAcid', 'flaskVolatile'][i], from: 'L', arc: 0.7, impact: ['fire', 'acid', 'fire'][i], spin: 14, spread: (i - 1) * 3 }]));
  C1('c_naphtha', 1.3, [
    k(0, GL),
    k(0.2, P({ spine: [10, 0, 0], armR: [-80, 0, -10], foreR: [-10, 0, 0], handR: [-60, 0, 0], armL: [-60, 0, 10], foreL: [-70, 0, 0] }, L.wide), { root: [0, -0.14, 0] }),
    k(0.4, P({ spine: [14, -30, 0], armR: [-86, -20, -10], foreR: [-4, 0, 0], handR: [-70, 0, 0] }, L.wide), { root: [0, -0.16, 0] }),
    k(0.65, P({ spine: [14, 30, 0], armR: [-86, 20, -10], foreR: [-4, 0, 0], handR: [-70, 0, 0] }, L.wide), { root: [0, -0.16, 0] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.35, e: 'spray', kind: 'oil', dur: 0.4 }, { t: 0.58, e: 'wave', kind: 'fire', len: 12 }]);
  C1('c_vault', 1.0, [
    k(0, GL),
    k(0.15, P({ spine: [30, 0, 0], armR: [-60, 0, -10], foreR: [-10, 0, 0], handR: [80, 0, 0], armL: [-60, 0, 10], foreL: [-30, 0, 0] }, L.deep), { root: R.deep }),
    k(0.35, P({ spine: [-40, 0, 0], armR: [-160, 0, -10], foreR: [-10, 0, 0], handR: [120, 0, 0], armL: [-150, 0, 20] }, L.tuck), { root: [0, 2.2, -2.8], e: 'out' }),
    k(0.6, P({ spine: [-10, 0, 0], armR: [-90, 0, -20] }, L.air), { root: [0, 1.4, -6.0] }),
    k(0.8, P({ spine: [24, 0, 0] }, L.deep), { root: [0, -0.32, -8.0], e: 'in' }),
    k(1, GL, { root: [0, 0, -8.0] }),
  ], [{ t: 0.1, e: 'dash' }, { t: 0.15, e: 'dust' }, { t: 0.8, e: 'dust' }], { endRoot: [0, 0, -8.0] });
  C1('c_vigor', 1.1, [
    k(0, GL),
    k(0.3, P(ROD, { spine: [-10, 0, 0], armL: [-150, 10, 20], foreL: [-60, 0, 0], head: [-20, 0, 0] }, L.deep), { root: [0, -0.26, 0] }),
    k(0.5, P(ROD, { spine: [-20, 0, 0], armL: [-180, 0, 10], foreL: [-6, 0, 0], head: [-34, 0, 0] }, L.stand), { root: [0, 0.08, 0], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.1, e: 'holdItem', side: 'L', item: 'flaskElixir', on: true }, { t: 0.52, e: 'holdItem', side: 'L', item: 'flaskElixir', on: false }, { t: 0.54, e: 'proj', kind: 'flask', item: 'flaskElixir', from: 'L', up: true, impact: 'elixir' }, { t: 0.66, e: 'ring', color: '#a0ffd0', r: 14 }]);
  C1('c_clockwork', 1.1, [
    k(0, GL),
    k(0.3, P(ROD, { spine: [50, 0, 0], head: [30, 0, 0], armL: [-60, 0, 10], foreL: [-30, 0, 0] }, L.kneel), { root: R.kneel }),
    k(0.55, P(ROD, { spine: [50, 0, 0], armL: [-50, 0, 10], foreL: [-20, 0, 0], handL: [40, 0, 0] }, L.kneel), { root: R.kneel }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.1, e: 'holdItem', side: 'L', item: 'clockbomb', on: true }, { t: 0.55, e: 'holdItem', side: 'L', item: 'clockbomb', on: false }, { t: 0.55, e: 'placeBomb', delay: 1.8 }]);
  C1('c_grand', 2.1, [
    k(0, GL),
    k(0.2, P({ spine: [40, 0, 0], armR: [-60, 0, -10], foreR: [-30, 0, 0], armL: [-60, 0, 10], foreL: [-30, 0, 0], head: [20, 0, 0] }, L.deep), { root: R.deep }),
    k(0.45, P({ spine: [-24, 0, 0], chest: [-14, 0, 0], armR: [-180, 0, -20], foreR: [-50, 0, 0], armL: [-180, 0, 20], foreL: [-50, 0, 0], head: [-20, 0, 0] }, L.wide), { root: [0, -0.08, 0] }),
    k(0.62, P({ spine: [-28, 0, 0], armR: [-190, 0, -20], foreR: [-70, 0, 0], armL: [-190, 0, 20], foreL: [-70, 0, 0] }, L.stepBack), { root: [0, -0.04, -0.1] }),
    k(0.74, P({ spine: [34, 0, 0], armR: [-100, 0, -10], foreR: [-6, 0, 0], armL: [-100, 0, 10], foreL: [-6, 0, 0], head: [10, 0, 0] }, L.lungeL), { root: [0, -0.18, 0.3], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.15, e: 'holdItem', side: 'both', item: 'cask', on: true }, { t: 0.74, e: 'holdItem', side: 'both', item: 'cask', on: false }, { t: 0.74, e: 'proj', kind: 'flask', item: 'cask', from: 'chest', arc: 1.3, impact: 'grand', ground: true, spin: 5 }]);

  // ---- level 42 and 45 (the Cinder Reach) ----
  // Thermite Charge: the tin is struck against the rod to light it (sparks), then thrown overhand
  C1('c_thermite', 1.05, [
    k(0, GL),
    k(0.14, P(ROD, { spine: [10, 10, 0], head: [18, -6, 0], armL: [-64, 10, 20], foreL: [-100, 0, 0], handL: [-20, 0, 0] })),
    k(0.26, P(ROD, { spine: [12, 12, 0], head: [20, -6, 0], armL: [-70, 16, 14], foreL: [-110, 0, 0], handL: [10, 0, 0] })),
    k(0.42, P(ROD, { spine: [-6, 40, 0], chest: [-8, 20, 0], armL: [-150, 30, 50], foreL: [-90, 0, 0], handL: [-30, 0, 0], head: [0, -30, 0] }, L.stepBack), { root: [0, -0.04, -0.1] }),
    k(0.56, P(ROD, { spine: [24, -30, 0], chest: [10, -20, 0], armL: [-110, -10, 10], foreL: [-10, 0, 0], handL: [20, 0, 0], head: [8, 10, 0] }, L.lungeL), { root: [0, -0.14, 0.22], e: 'snap' }),
    k(0.71, P(ROD, { spine: [26, -36, 0], armL: [-60, -20, 10], foreL: [-30, 0, 0] }), { root: [0, -0.12, 0.2] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.08, e: 'holdItem', side: 'L', item: 'grenade', on: true }, { t: 0.24, e: 'sparks', at: 'handL', dur: 0.3 }, { t: 0.26, e: 'motes', color: '#fff0c0', n: 14, at: 'handL', dur: 0.5 },
    { t: 0.56, e: 'holdItem', side: 'L', item: 'grenade', on: false }, { t: 0.56, e: 'proj', kind: 'flask', item: 'grenade', from: 'L', arc: 0.8, impact: 'bigfire', ground: true, spin: 12 }]);
  // Boiler Bomb: the sealed canister is shaken while the pressure builds (the cast), lifted overhead in both hands
  // and heaved forward with a full step
  C1('c_boiler', 2.2, [
    k(0, GL),
    k(0.12, P({ spine: [20, 0, 0], head: [24, 0, 0], armR: [-56, -10, -10], foreR: [-80, 0, 0], armL: [-56, 10, 10], foreL: [-80, 0, 0] }, L.wide), { root: [0, -0.12, 0] }),
    k(0.5, P({ spine: [22, 0, 0], head: [26, 0, 0], armR: [-60, -12, -10], foreR: [-84, 0, 0], armL: [-60, 12, 10], foreL: [-84, 0, 0] }, L.wide), { root: [0, -0.14, 0] }),
    k(0.62, P({ spine: [-10, 0, 0], chest: [-8, 0, 0], armR: [-150, 0, -20], foreR: [-50, 0, 0], armL: [-150, 0, 20], foreL: [-50, 0, 0], head: [-14, 0, 0] }, L.stand), { root: [0, 0.02, 0] }),
    k(0.72, P({ spine: [-26, 0, 0], chest: [-14, 0, 0], armR: [-188, 0, -20], foreR: [-70, 0, 0], armL: [-188, 0, 20], foreL: [-70, 0, 0], head: [-18, 0, 0] }, L.stepBack), { root: [0, -0.04, -0.12] }),
    k(0.8, P({ spine: [32, 0, 0], armR: [-100, 0, -10], foreR: [-6, 0, 0], armL: [-100, 0, 10], foreL: [-6, 0, 0], head: [10, 0, 0] }, L.lungeL), { root: [0, -0.18, 0.3], e: 'snap' }),
    k(0.88, P({ spine: [30, 0, 0], armR: [-80, 0, -10], foreR: [-10, 0, 0], armL: [-80, 0, 10], foreL: [-10, 0, 0], head: [10, 0, 0] }, L.lungeL), { root: [0, -0.18, 0.3] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.08, e: 'holdItem', side: 'both', item: 'bomb', on: true }, { t: 0.14, e: 'motes', color: '#e8f0ff', n: 30, at: 'handL', dur: 1.0 }, { t: 0.8, e: 'holdItem', side: 'both', item: 'bomb', on: false },
    { t: 0.8, e: 'proj', kind: 'flask', item: 'bomb', from: 'chest', arc: 1.1, impact: 'blast', ground: true, spin: 6 }, { t: 0.93, e: 'cloud', kind: 'smoke', r: 7 }],
    { channel: { from: 0.14, to: 0.5, hz: 3.0, bones: { armL: [6, 0, 3], armR: [6, 0, -3], foreL: [-8], foreR: [-8], spine: [2, 0, 0], head: [2, 0, 0] } } });
  // ---- level 47 and 50 (the Rime Steps) ----
  // Quicklime Flask: meltwater tipped into the flask of lime (it starts to steam), a short shake, then a sidearm throw
  // across the body
  C1('c_quicklime', 1.0, [
    k(0, GL),
    k(0.14, P(ROD, { spine: [10, 8, 0], head: [20, -6, 0], armL: [-62, 14, 18], foreL: [-104, 0, 0], handL: [-16, 0, 0] })),
    k(0.3, P(ROD, { spine: [12, 10, 0], head: [22, -6, 0], armL: [-68, 20, 14], foreL: [-112, 0, 0], handL: [12, 0, 0] })),
    k(0.44, P(ROD, { spine: [-2, 44, 0], chest: [-6, 20, 0], armL: [-80, -20, 70], foreL: [-60, 0, 0], handL: [-10, 0, 0], head: [0, -34, 0] }, L.stepBack), { root: [0, -0.06, -0.08] }),
    k(0.6, P(ROD, { spine: [20, -34, 0], chest: [8, -18, 0], armL: [-92, 30, 14], foreL: [-12, 0, 0], handL: [20, 0, 0], head: [6, 14, 0] }, L.lungeL), { root: [0, -0.14, 0.22], e: 'snap' }),
    k(0.74, P(ROD, { spine: [22, -40, 0], armL: [-70, 40, 10], foreL: [-30, 0, 0] }, L.lungeL), { root: [0, -0.12, 0.2] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.08, e: 'holdItem', side: 'L', item: 'flaskAcid', on: true }, { t: 0.2, e: 'motes', color: '#f4f4ec', n: 16, at: 'handL', dur: 0.45 }, { t: 0.22, e: 'trailSmoke', side: 'L', dur: 0.35 },
    { t: 0.6, e: 'holdItem', side: 'L', item: 'flaskAcid', on: false }, { t: 0.6, e: 'proj', kind: 'flask', item: 'flaskAcid', from: 'L', arc: 0.8, impact: 'smoke', spin: 10 }, { t: 0.6, e: 'sound', s: 'whoosh' }],
    { channel: { from: 0.3, to: 0.4, hz: 6, bones: { armL: [4, 0, 2], foreL: [-6], handL: [10, 0, 0] } } });
  // Frostpack Drum: the drum hugged low and shaken while the salts dissolve (the cast), swung back between the knees,
  // then heaved underarm up and out with the whole body rising; it bursts in a spreading cloud of frost
  C1('c_frostpack', 2.2, [
    k(0, GL),
    k(0.1, P({ spine: [26, 0, 0], head: [22, 0, 0], armR: [-50, -10, -8], foreR: [-50, 0, 0], armL: [-50, 10, 8], foreL: [-50, 0, 0] }, L.wide), { root: [0, -0.2, 0] }),
    k(0.5, P({ spine: [28, 0, 0], head: [24, 0, 0], armR: [-54, -12, -8], foreR: [-56, 0, 0], armL: [-54, 12, 8], foreL: [-56, 0, 0] }, L.wide), { root: [0, -0.22, 0] }),
    k(0.64, P({ spine: [40, 0, 0], chest: [8, 0, 0], head: [30, 0, 0], armR: [0, -6, -10], foreR: [-16, 0, 0], armL: [0, 6, 10], foreL: [-16, 0, 0] }, L.deep), { root: [0, -0.36, -0.04] }),
    k(0.74, P({ spine: [-8, 0, 0], chest: [-6, 0, 0], head: [-10, 0, 0], armR: [-100, 0, -10], foreR: [-8, 0, 0], armL: [-100, 0, 10], foreL: [-8, 0, 0] }, L.stepL), { root: [0, 0.02, 0.18], e: 'snap' }),
    k(0.84, P({ spine: [-12, 0, 0], chest: [-8, 0, 0], head: [-14, 0, 0], armR: [-128, 0, -14], foreR: [-14, 0, 0], armL: [-128, 0, 14], foreL: [-14, 0, 0] }, L.stepL), { root: [0, 0.04, 0.2] }),
    k(0.92, mixPose(P({ spine: [-12, 0, 0], chest: [-8, 0, 0], head: [-14, 0, 0], armR: [-128, 0, -14], foreR: [-14, 0, 0], armL: [-128, 0, 14], foreL: [-14, 0, 0] }, L.stepL), GL, 0.5), { root: [0, 0.02, 0.1] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.06, e: 'holdItem', side: 'both', item: 'bomb', on: true }, { t: 0.12, e: 'motes', color: '#e0f4ff', n: 30, at: 'handL', dur: 1.0 }, { t: 0.14, e: 'trailSmoke', side: 'L', dur: 0.8 },
    { t: 0.74, e: 'holdItem', side: 'both', item: 'bomb', on: false }, { t: 0.74, e: 'proj', kind: 'flask', item: 'bomb', from: 'chest', arc: 1.1, impact: 'blast', ground: true, spin: 4 }, { t: 0.74, e: 'sound', s: 'whoosh' },
    { t: 0.92, e: 'cloud', kind: 'chill', r: 7, thick: true }],
    { channel: { from: 0.12, to: 0.5, hz: 3.2, bones: { armL: [6, 0, 3], armR: [6, 0, -3], foreL: [-8], foreR: [-8], spine: [2, 0, 0], head: [2, 0, 0] } } });
  // ---- level 52 and 55 (the Windward Heights) ----
  // Carbide Flare: the flask's water bulb cracked against the brass head of the rod (it hisses and smokes), then a quick
  // overhand throw with a step in
  C1('c_carbide', 1.0, [
    k(0, GL),
    k(0.14, P(ROD, { spine: [10, 10, 0], head: [18, -6, 0], armL: [-64, 10, 20], foreL: [-100, 0, 0], handL: [-20, 0, 0] })),
    k(0.24, P(ROD, { spine: [12, 12, 0], head: [20, -6, 0], armL: [-70, 16, 14], foreL: [-110, 0, 0], handL: [14, 0, 0] })),
    k(0.42, P(ROD, { spine: [-6, 40, 0], chest: [-8, 20, 0], armL: [-148, 30, 48], foreL: [-90, 0, 0], handL: [-30, 0, 0], head: [0, -30, 0] }, L.stepBack), { root: [0, -0.04, -0.1] }),
    k(0.6, P(ROD, { spine: [24, -30, 0], chest: [10, -20, 0], armL: [-110, -10, 10], foreL: [-10, 0, 0], handL: [20, 0, 0], head: [8, 10, 0] }, L.lungeL), { root: [0, -0.14, 0.22], e: 'snap' }),
    k(0.74, P(ROD, { spine: [26, -36, 0], armL: [-62, -20, 10], foreL: [-30, 0, 0] }, L.lungeL), { root: [0, -0.12, 0.2] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.08, e: 'holdItem', side: 'L', item: 'flaskFire', on: true }, { t: 0.24, e: 'sparks', at: 'handL', dur: 0.15 }, { t: 0.25, e: 'trailSmoke', side: 'L', dur: 0.35 }, { t: 0.26, e: 'motes', color: '#fff8e0', n: 12, at: 'handL', dur: 0.35 },
    { t: 0.6, e: 'holdItem', side: 'L', item: 'flaskFire', on: false }, { t: 0.6, e: 'proj', kind: 'flask', item: 'flaskFire', from: 'L', arc: 0.8, impact: 'bigfire', spin: 10 }, { t: 0.6, e: 'sound', s: 'whoosh' }]);
  // Ridge Charge: the paper charge held to the rod's flint wheel until the fuse catches, then held out while it burns
  // down (the cast, sparks spitting), lifted back over the left shoulder on a long back step and hurled far overhand
  C1('c_ridgecharge', 2.2, [
    k(0, GL),
    k(0.07, P(ROD, { spine: [10, 10, 0], head: [18, -6, 0], armL: [-64, 10, 20], foreL: [-100, 0, 0], handL: [-20, 0, 0] })),
    k(0.14, P(ROD, { spine: [12, 12, 0], head: [20, -6, 0], armL: [-70, 16, 14], foreL: [-108, 0, 0], handL: [10, 0, 0] })),
    k(0.24, P(ROD, { spine: [8, 4, 0], head: [12, -2, 0], armL: [-58, 24, 26], foreL: [-70, 0, 0], handL: [0, 0, 0] }, L.wide), { root: [0, -0.1, 0] }),
    k(0.54, P(ROD, { spine: [10, 6, 0], head: [14, -2, 0], armL: [-60, 26, 26], foreL: [-74, 0, 0], handL: [4, 0, 0] }, L.wide), { root: [0, -0.12, 0] }),
    k(0.64, P(ROD, { spine: [-10, 44, 0], chest: [-10, 22, 0], armL: [-150, 30, 50], foreL: [-92, 0, 0], handL: [-30, 0, 0], head: [0, -32, 0] }, L.stepBack), { root: [0, -0.04, -0.14] }),
    k(1.6 / 2.2, P(ROD, { spine: [28, -34, 0], chest: [12, -22, 0], armL: [-108, -12, 10], foreL: [-8, 0, 0], handL: [22, 0, 0], head: [10, 12, 0] }, L.lungeL), { root: [0, -0.18, 0.26], e: 'snap' }),
    k(0.8, P(ROD, { spine: [30, -38, 0], armL: [-60, -20, 10], foreL: [-30, 0, 0] }, L.lungeL), { root: [0, -0.16, 0.24] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.05, e: 'holdItem', side: 'L', item: 'grenade', on: true }, { t: 0.13, e: 'sparks', at: 'handL', dur: 0.5 }, { t: 0.14, e: 'trailSmoke', side: 'L', dur: 0.55 }, { t: 0.15, e: 'motes', color: '#ffc070', n: 24, at: 'handL', dur: 0.55 },
    { t: 1.6 / 2.2, e: 'holdItem', side: 'L', item: 'grenade', on: false }, { t: 1.6 / 2.2, e: 'proj', kind: 'flask', item: 'grenade', from: 'L', arc: 1.0, impact: 'blast', ground: true, spin: 8 }, { t: 1.6 / 2.2, e: 'sound', s: 'whoosh' },
    { t: 'hit', e: 'cloud', kind: 'smoke', r: 7 }, { t: 'hit', e: 'shake', amt: 0.6 }, { t: 'hit', e: 'dust' }],
    { channel: { from: 0.24, to: 0.54, hz: 2.4, bones: { armL: [3, 0, 2], foreL: [-4], handL: [8, 0, 0], head: [2, 0, 0] } } });
  // ---- level 57 and 60 (Tidewater Sound) ----
  // Brine Flask: the flask of boiled brine held up before the face and swirled until the vitriol takes (it steams),
  // then a low sidearm throw across the body on a step in; it bursts in a stinging grey-green spray
  C1('c_brine', 1.0, [
    k(0, GL),
    k(0.14, P(ROD, { spine: [6, 6, 0], head: [10, -4, 0], armL: [-84, 14, 18], foreL: [-100, 0, 0], handL: [-10, 0, 0] })),
    k(0.3, P(ROD, { spine: [8, 8, 0], head: [12, -4, 0], armL: [-88, 18, 16], foreL: [-104, 0, 0], handL: [10, 0, 0] })),
    k(0.44, P(ROD, { spine: [0, 46, 0], chest: [-6, 22, 0], armL: [-70, -24, 74], foreL: [-56, 0, 0], handL: [-10, 0, 0], head: [0, -36, 0] }, L.stepBack), { root: [0, -0.08, -0.08] }),
    k(0.6, P(ROD, { spine: [22, -36, 0], chest: [8, -20, 0], armL: [-86, 34, 12], foreL: [-12, 0, 0], handL: [20, 0, 0], head: [6, 16, 0] }, L.lungeL), { root: [0, -0.16, 0.24], e: 'snap' }),
    k(0.74, P(ROD, { spine: [24, -42, 0], armL: [-66, 40, 10], foreL: [-30, 0, 0] }, L.lungeL), { root: [0, -0.14, 0.22] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.08, e: 'holdItem', side: 'L', item: 'flaskAcid', on: true }, { t: 0.16, e: 'motes', color: '#e8f0e8', n: 14, at: 'handL', dur: 0.4 }, { t: 0.18, e: 'trailSmoke', side: 'L', dur: 0.3 },
    { t: 0.6, e: 'holdItem', side: 'L', item: 'flaskAcid', on: false }, { t: 0.6, e: 'proj', kind: 'flask', item: 'flaskAcid', from: 'L', arc: 0.7, impact: 'brine', spin: 10 }, { t: 0.6, e: 'sound', s: 'whoosh' }],
    { channel: { from: 0.14, to: 0.36, hz: 4, bones: { armL: [3, 0, 3], foreL: [-6], handL: [14, 0, 0] } } });
  // Boiling Tar Pot (capstone): the iron pot held in both hands down by the rod's heater until the tar spits (the cast,
  // steam off the pot), then swung back low between the knees on a deep crouch and heaved underarm up and out with the
  // whole body rising; it bursts in a black splash of boiling tar
  {
    const HOLD = (x) => P({ spine: [18 + x, 0, 0], head: [20 + x, 0, 0], armR: [-44 - x, -8, -10], foreR: [-60, 0, 0], handR: [10, 0, 0], armL: [-48 - x, 12, 8], foreL: [-60 - x, 0, 0] }, L.wide);
    const UP = (x) => P({ spine: [-8 - x * 0.2, 0, 0], chest: [-6, 0, 0], head: [-10 - x * 0.2, 0, 0], armR: [-100 - x, 0, -10], foreR: [-8 - x * 0.3, 0, 0], armL: [-100 - x, 0, 10], foreL: [-8 - x * 0.3, 0, 0] }, L.stepL);
    C1('c_tarpot', 2.2, [
      k(0, GL),
      k(0.1, HOLD(0), { root: [0, -0.14, 0] }),
      k(0.5, HOLD(2), { root: [0, -0.16, 0] }),
      k(0.64, P({ spine: [40, 0, 0], chest: [8, 0, 0], head: [30, 0, 0], armR: [0, -6, -10], foreR: [-16, 0, 0], armL: [0, 6, 10], foreL: [-16, 0, 0] }, L.deep), { root: [0, -0.36, -0.04] }),
      k(0.74, UP(0), { root: [0, 0.02, 0.18], e: 'snap' }),
      k(0.84, UP(20), { root: [0, 0.04, 0.2] }),
      k(0.92, mixPose(UP(20), GL, 0.5), { root: [0, 0.02, 0.1] }),
      k(1, GL, { root: R.guard }),
    ], [{ t: 0.06, e: 'holdItem', side: 'both', item: 'pot', on: true }, { t: 0.1, e: 'sparks', at: 'rod', dur: 0.2 }, { t: 0.12, e: 'motes', color: '#ffc070', n: 20, at: 'handL', dur: 0.9 }, { t: 0.14, e: 'trailSmoke', side: 'L', dur: 0.8 },
      { t: 0.74, e: 'holdItem', side: 'both', item: 'pot', on: false }, { t: 0.74, e: 'proj', kind: 'flask', item: 'pot', from: 'chest', arc: 1.1, impact: 'tarpot', ground: true, spin: 3, r: 6 }, { t: 0.74, e: 'sound', s: 'whoosh' },
      { t: 'hit', e: 'shake', amt: 0.45 }, { t: 'hit', e: 'cloud', kind: 'smoke', r: 5 }],
      { channel: { from: 0.12, to: 0.5, hz: 3.0, bones: { armL: [5, 0, 3], armR: [5, 0, -3], foreL: [-6], foreR: [-6], spine: [2, 0, 0], head: [2, 0, 0] } } });
  }
  // ---- level 62 and 65 (the Rainward Gorge) ----
  // Kiln Lime Flask: the flask of fresh kiln lime held up before the face and shaken once so the lime settles, then a low
  // sidearm throw across the body on a step in; it bursts on the wet plating in a hot white boil of steam
  C1('c_kilnlime', 1.0, [
    k(0, GL),
    k(0.14, P(ROD, { spine: [6, 6, 0], head: [10, -4, 0], armL: [-80, 12, 18], foreL: [-104, 0, 0], handL: [-14, 0, 0] })),
    k(0.3, P(ROD, { spine: [8, 8, 0], head: [12, -4, 0], armL: [-86, 16, 16], foreL: [-100, 0, 0], handL: [14, 0, 0] })),
    k(0.44, P(ROD, { spine: [0, 48, 0], chest: [-6, 22, 0], armL: [-66, -26, 76], foreL: [-54, 0, 0], handL: [-10, 0, 0], head: [0, -36, 0] }, L.stepBack), { root: [0, -0.08, -0.08] }),
    k(0.6, P(ROD, { spine: [22, -38, 0], chest: [8, -20, 0], armL: [-84, 36, 12], foreL: [-12, 0, 0], handL: [20, 0, 0], head: [6, 16, 0] }, L.lungeL), { root: [0, -0.16, 0.24], e: 'snap' }),
    k(0.74, P(ROD, { spine: [24, -42, 0], armL: [-66, 40, 10], foreL: [-30, 0, 0] }, L.lungeL), { root: [0, -0.14, 0.22] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.08, e: 'holdItem', side: 'L', item: 'flaskLime', on: true }, { t: 0.18, e: 'trailSmoke', side: 'L', dur: 0.24 },
    { t: 0.6, e: 'holdItem', side: 'L', item: 'flaskLime', on: false }, { t: 0.6, e: 'proj', kind: 'flask', item: 'flaskLime', from: 'L', arc: 0.7, impact: 'lime', spin: 10 }, { t: 0.6, e: 'sound', s: 'whoosh' }],
    { channel: { from: 0.14, to: 0.36, hz: 3, bones: { armL: [3, 0, 3], foreL: [-6], handL: [14, 0, 0] } } });
  // Lime Mortar Drum (capstone): the sealed iron drum held in both hands against the hip while its fuse is lit on the
  // rod's flint wheel (sparks, the cast), swung back low on a deep crouch and heaved underarm up and out with the whole
  // body rising; it bursts in a low, flat splash of hot grey mortar that steams where the rain meets it
  {
    const HOLD = (x) => P({ spine: [16 + x, 10, 0], head: [18 + x, -6, 0], armR: [-44 - x, -8, -10], foreR: [-64, 0, 0], handR: [10, 0, 0], armL: [-40 - x, 14, 10], foreL: [-66 - x, 0, 0] }, L.wide);
    const UP = (x) => P({ spine: [-8 - x * 0.2, 0, 0], chest: [-6, 0, 0], head: [-10 - x * 0.2, 0, 0], armR: [-96 - x, 0, -10], foreR: [-8 - x * 0.3, 0, 0], armL: [-96 - x, 0, 10], foreL: [-8 - x * 0.3, 0, 0] }, L.stepL);
    C1('c_limemortar', 2.2, [
      k(0, GL),
      k(0.1, HOLD(0), { root: [0, -0.12, 0] }),
      k(0.5, HOLD(3), { root: [0, -0.14, 0] }),
      k(0.64, P({ spine: [42, 0, 0], chest: [8, 0, 0], head: [30, 0, 0], armR: [0, -6, -10], foreR: [-16, 0, 0], armL: [0, 6, 10], foreL: [-16, 0, 0] }, L.deep), { root: [0, -0.38, -0.04] }),
      k(0.74, UP(0), { root: [0, 0.02, 0.18], e: 'snap' }),
      k(0.84, UP(20), { root: [0, 0.04, 0.2] }),
      k(0.92, mixPose(UP(20), GL, 0.5), { root: [0, 0.02, 0.1] }),
      k(1, GL, { root: R.guard }),
    ], [{ t: 0.06, e: 'holdItem', side: 'both', item: 'drum', on: true }, { t: 0.1, e: 'sparks', at: 'rod', dur: 0.4 }, { t: 0.14, e: 'trailSmoke', side: 'L', dur: 0.8 },
      { t: 0.74, e: 'holdItem', side: 'both', item: 'drum', on: false }, { t: 0.74, e: 'proj', kind: 'flask', item: 'drum', from: 'chest', arc: 1.1, impact: 'mortar', ground: true, spin: 3, r: 6 }, { t: 0.74, e: 'sound', s: 'whoosh' },
      { t: 'hit', e: 'shake', amt: 0.5 }, { t: 'hit', e: 'cloud', kind: 'mud', r: 6 }],
      { channel: { from: 0.12, to: 0.5, hz: 3.0, bones: { armL: [4, 0, 3], armR: [4, 0, -3], foreL: [-5], foreR: [-5], spine: [2, 0, 0], head: [2, 0, 0] } } });
  }
}

// ============================== SANDBLADE =================================
{
  const G = P(guard('sandblade'), { spine: [10, 0, 0] });
  const GL = P(G, LG);
  const SH = { armL: [-44, 70, 24], foreL: [-98, 0, 0] };
  const T = TRAIL.sandblade;
  const S1 = (id, dur, mask, keys, ev, o) => (DEF[id] = C('sandblade', dur, mask, keys, ev, o));
  // forehand then backhand, both flat
  const sweep2 = (dur, h1, h2, legs1, legs2, end = -80, v = 1050) => [
    ...swing(dur, h1, { wind: -64, mid: -35, hit: 5, follow: 46 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -24 : role === 'follow' ? 20 : -5, dy: -0.2 }), legs1), { root: [0, -0.04, role === 'wind' ? 0.04 : 0.14], e }], v),
    ...swing(dur, h2, { wind: 88, mid: 42, hit: -5, follow: -65, end }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? 30 : role === 'follow' || role === 'end' ? -20 : 5, dy: -0.2, r: role === 'wind' ? 0.36 : 0.44 }), legs2), { root: [0, -0.06, 0.26], e }], v),
  ];
  // Sand Slash: blade drawn back low on the right, whipped flat across the target, carried round to the left
  S1('s_slash', 0.62, 'full', [
    k(0, GL),
    ...swing(0.62, 0.22, { wind: -64, mid: -35, hit: 5, follow: 65, end: 85 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -26 : role === 'mid' ? -12 : role === 'hit' ? 0 : 22, dy: -0.2 }), role === 'wind' ? L.stepBack : L.stepL), { root: role === 'wind' ? [0, -0.02, -0.02] : [0, -0.04, 0.14], e }], 1050),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.12, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.2, stop: 0.045 }, { t: 0.56, e: 'trail', on: false }]);
  S1('s_twin', 0.8, 'full', [
    k(0, GL),
    ...sweep2(0.8, 0.2, 0.42, L.lungeL, L.lungeR),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.06, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.2, stop: 0.045 }, { t: 'hit2', e: 'impact', kind: 'slash', shake: 0.25, stop: 0.055 }, { t: 0.7, e: 'trail', on: false }]);
  S1('s_dust', 0.8, 'full', [
    k(0, GL),
    k(0.22, P(SH, { spine: [10, 0, 0] }, { thighR: [30, 0, -6], shinR: [60], footR: [40], thighL: [-30, 0, 4], shinL: [50] }), { root: [0, -0.16, 0] }),
    k(0.36, P(SH, { spine: [-14, 0, 0], armR: [-20, 0, -60] }, { thighR: [-80, 0, -6], shinR: [20], footR: [-10], thighL: [-20, 0, 4], shinL: [40] }), { root: [0, -0.12, 0.06], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.36, e: 'cloud', kind: 'sand', r: 3, cone: true }, { t: 'hit', e: 'impact', kind: 'sand', shake: 0.15 }]);
  S1('s_whirl', 0.95, 'full', [
    k(0, GL, { turn: 0 }),
    k(0.15, P(SH, arc(-60, { lead: -10, dy: -0.24, twist: -40 }), L.wide), { root: [0, -0.22, 0], turn: 40 }),
    k(0.45, P(SH, arc(-88, { lead: 12, dy: -0.24, twist: -20 }), L.wide), { root: [0, -0.24, 0], turn: -320, e: 'linear' }),
    k(0.75, P(SH, arc(-88, { lead: 12, dy: -0.24, twist: -20 }), L.wide), { root: [0, -0.24, 0], turn: -650, e: 'linear' }),
    k(1, GL, { root: R.guard, turn: -720, e: 'inOut' }),
  ], [{ t: 0.15, e: 'trail', on: true, color: T, w: 1.3 }, { t: 'hit', e: 'impact', kind: 'sweep', at: 'self', r: 4 }, { t: 'hit2', e: 'impact', kind: 'sweep', at: 'self', r: 4 }, { t: 0.3, e: 'cloud', kind: 'sand', r: 4, at: 'self' }, { t: 0.82, e: 'trail', on: false }]);
  // the blade is carried low out ahead through the dash (it used to flick from over the shoulder
  // down past the front in the first 0.1 s, 70 m/s at the tip relative to the body)
  S1('s_step', 0.55, 'full', [
    k(0, GL),
    k(0.2, P(SH, { spine: [30, 0, 0], armR: [10, 0, -40], foreR: [-30, 0, 0], handR: [0, 0, 0] }, L.lungeL), { root: [0, -0.2, 2.5] }),
    k(0.45, P(SH, { spine: [24, 0, 0], armR: [0, 0, -40], foreR: [-30, 0, 0], handR: [0, 0, 0] }, L.lungeR), { root: [0, -0.18, 5.5] }),
    k(1, GL, { root: [0, 0, 6.5] }),
  ], [{ t: 0.05, e: 'dash' }, { t: 0.05, e: 'cloud', kind: 'sand', r: 2, at: 'self' }, { t: 0.5, e: 'cloud', kind: 'sand', r: 2, at: 'self' }], { endRoot: [0, 0, 6.5] });
  S1('s_ram', 0.85, 'full', [
    k(0, GL),
    k(0.18, P(G, { spine: [24, -20, 0], armL: [-80, 40, 30], foreL: [-90, 0, 0] }, L.stepBack), { root: [0, -0.1, -0.06] }),
    k(0.32, P(G, { spine: [30, 10, 0], armL: [-86, 20, 10], foreL: [-60, 0, 0] }, L.lungeR), { root: [0, -0.16, 2.2] }),
    k(0.42, P(G, { spine: [20, 20, 0], armL: [-92, 10, 4], foreL: [-30, 0, 0] }, L.lungeL), { root: [0, -0.14, 3.4], e: 'snap' }),
    k(1, GL, { root: [0, 0, 3.4] }),
  ], [{ t: 0.15, e: 'dash' }, { t: 0.25, e: 'cloud', kind: 'sand', r: 1.5, at: 'self' }, { t: 'hit', e: 'impact', kind: 'shield', shake: 0.45, stop: 0.07 }], { endRoot: [0, 0, 3.4] });
  S1('s_needle', 0.65, 'full', [
    k(0, GL),
    k(0.22, P(SH, wield({ spine: [0, -30, 0], chest: [-2, -10, 0], head: [0, 30, 0] }, [-0.36, 1.2, -0.12], [0.08, 0.06, 1], [-0.7, 1.0, -0.2]), L.stepBack), { root: [0, -0.1, -0.1] }),
    k(0.369, P(SH, wield({ spine: [22, 20, 0], chest: [6, 6, 0], head: [0, -22, 0] }, [-0.06, 1.28, 0.62], [0.04, -0.02, 1], [-0.6, 1.0, 0.2]), P(L.lungeL, { thighL: [-74, 0, 6] })), { root: [0, -0.2, 0.42], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.28, e: 'trail', on: true, color: T, w: 0.6 }, { t: 'hit', e: 'impact', kind: 'pierce', shake: 0.25, stop: 0.05 }, { t: 0.55, e: 'trail', on: false }]);
  S1('s_feint', 0.95, 'full', [
    k(0, GL),
    k(0.18, P(SH, { spine: [10, -30, 0], armR: [-120, -20, -60], foreR: [-30, 0, 0] }, L.stepL), { root: [0, -0.06, 0.1] }),
    k(0.28, P(SH, { spine: [12, 30, 0], armR: [-80, 30, 10], foreR: [-20, 0, 0] }), { e: 'snap' }),
    k(0.38, P(SH, { spine: [0, 0, 20], armR: [-40, 0, -30], foreR: [-60, 0, 0] }, L.stepBack), { root: [-0.4, -0.12, -0.1] }),
    k(0.55, P(SH, { spine: [20, 30, -10], armR: [-90, 30, 0], foreR: [-4, 0, 0] }, L.lungeL), { root: [0.2, -0.14, 0.3], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.25, e: 'trail', on: true, color: T }, { t: 0.42, e: 'impact', kind: 'mark', at: 'target' }, { t: 0.7, e: 'trail', on: false }]);
  S1('s_scorch', 1.15, 'full', [
    k(0, GL),
    k(0.25, P({ armL: [-70, 40, 10], foreL: [-80, 0, 0] }, wield({ spine: [10, 10, 0], head: [16, -6, 0] }, [-0.12, 1.2, 0.4], [0.95, 0.12, 0.28], [-0.6, 0.9, 0.2]), L.wide), { root: [0, -0.12, 0] }),
    k(0.45, P({ armL: [-62, 30, 6], foreL: [-50, 0, 0] }, wield({ spine: [10, -4, 0], head: [16, 4, 0] }, [-0.16, 1.2, 0.4], [0.95, 0.12, 0.28], [-0.6, 0.9, 0.2]), L.wide), { root: [0, -0.12, 0] }),
    k(0.6, P({ armL: [-70, 40, 10], foreL: [-80, 0, 0] }, wield({ spine: [10, 10, 0], head: [16, -6, 0] }, [-0.12, 1.2, 0.4], [0.95, 0.12, 0.28], [-0.6, 0.9, 0.2]), L.wide), { root: [0, -0.12, 0] }),
    k(0.78, P(SH, { spine: [-6, 0, 0], armR: [-170, 0, -20], foreR: [-10, 0, 0], handR: [-10, 0, 0] }, L.wide), { root: [0, -0.04, 0], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.25, e: 'sparks', at: 'weaponR', dur: 0.5 }, { t: 0.62, e: 'bladeGlow', color: '#ff8a30', dur: 10 }, { t: 0.78, e: 'flash', color: '#ffb060' }]);
  S1('s_leap', 1.05, 'full', [
    k(0, GL),
    k(0.14, P(SH, { spine: [24, 0, 0], armR: [-30, 0, -30] }, L.deep), { root: R.deep }),
    // blade cocked overhead at the top of the leap; the fall and the cut accelerate together onto the landing
    ...(() => {
      const A = k(0.33, P(SH, { spine: [-10, 0, 0], armR: [-190, 0, -10], foreR: [-30, 0, 0], handR: [35, 0, 0] }, L.tuck), { root: [0, 1.7, 2.0], e: 'out' });
      const B = k(0.59, P(SH, { spine: [46, 0, 0], armR: [-50, 0, -10], foreR: [0, 0, 0], handR: [60, 0, 0] }, L.deep), { root: [0, -0.4, 4.4] });
      return [A, ...slamFall(1.05, A, B, 0.615, [0, 0.5, 4.0], 0.065)];
    })(),
    k(0.76, P(SH, { spine: [40, 0, 0], armR: [-50, 0, -10], handR: [64, 0, 0] }, L.deep), { root: [0, -0.38, 4.4], e: 'out' }),
    k(1, GL, { root: [0, 0, 4.4], e: 'smooth' }),
  ], [{ t: 0.14, e: 'leap' }, { t: 0.15, e: 'cloud', kind: 'sand', r: 2, at: 'self' }, { t: 0.4, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'sand', at: 'self', r: 3.5, shake: 0.6, stop: 0.08 }, { t: 'hit', e: 'ring', color: '#e8c890', r: 4 }, { t: 0.75, e: 'trail', on: false }], { endRoot: [0, 0, 4.4] });
  S1('s_evasion', 0.8, 'full', [
    k(0, GL),
    k(0.2, P(SH, { spine: [10, 0, 24] }, L.wide), { root: [0.5, -0.18, 0] }),
    k(0.45, P(SH, { spine: [10, 0, -24] }, L.wide), { root: [-0.5, -0.18, 0] }),
    k(0.7, P(SH, { spine: [14, 0, 0] }, L.stepBack), { root: [0, -0.1, -0.3] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.2, e: 'cloud', kind: 'sand', r: 1.5, at: 'self' }, { t: 0.45, e: 'aura', color: '#f0d8a0', dur: 1.2 }]);
  S1('s_rend', 0.85, 'full', [
    k(0, GL),
    // one unbroken weave: a flat forehand, the blade turned round at the left into a flat backhand, turned round
    // again high on the right into a descending diagonal forehand; every cut passes the target at full speed and
    // each follow-through is the next cut's wind, so the blade never has to stop and restart in a frame or two
    k(0.065, P(SH, arc(-100, { lead: -30, dy: -0.2 }), L.stepL), { root: [0, -0.04, 0.06], e: 'smooth' }),
    k(0.135, P(SH, arc(-60, { lead: -10, dy: -0.2 }), L.stepL), { root: [0, -0.04, 0.1], e: 'in' }),
    k(0.188, P(SH, arc(5, { lead: -5, dy: -0.2 }), L.stepL), { root: [0, -0.04, 0.12], e: 'linear' }),
    k(0.282, P(SH, arc(68, { lead: 30, dy: -0.18, r: 0.36 }), L.stepL), { root: [0, -0.05, 0.16], e: 'out' }),
    k(0.376, P(SH, arc(-5, { lead: 5, dy: -0.2 }), L.lungeR), { root: [0, -0.06, 0.24], e: 'in' }),
    k(0.47, P(SH, arc(-66, { lead: -30, dy: -0.08, r: 0.38, tilt: 16 }), L.lungeR), { root: [0, -0.05, 0.26], e: 'out' }),
    k(0.565, P(SH, arc(5, { lead: -5, dy: -0.26, tilt: -10 }), L.lungeL), { root: [0, -0.1, 0.32], e: 'in' }),
    k(0.67, P(SH, arc(62, { lead: 22, dy: -0.34, tilt: -18 }), L.lungeL), { root: [0, -0.12, 0.34], e: 'out' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.02, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', stop: 0.04 }, { t: 'hit2', e: 'impact', kind: 'slash', stop: 0.04 }, { t: 'hit3', e: 'impact', kind: 'slash', shake: 0.25, stop: 0.06 }, { t: 0.72, e: 'trail', on: false }]);
  S1('s_devil', 2.4, 'full', [
    k(0, GL, { turn: 0 }),
    k(0.08, P(arc(-70, { lead: -10, dy: -0.22, twist: -30 }), { armL: [-80, 0, 80], foreL: [-20, 0, 0] }, L.wide), { root: [0, -0.2, 0], turn: 20 }),
    ...[0.2, 0.35, 0.5, 0.65, 0.8].map((t, i) => k(t, P(arc(-88, { lead: 12, dy: -0.22, twist: -15 }), { armL: [-80, 0, 80], foreL: [-20, 0, 0] }, L.wide), { root: [0, -0.22, 0], turn: -360 * (i + 1) * 0.75, e: 'linear' })),
    k(0.92, P(SH, arc(-40, { lead: 20, dy: -0.22 }), L.wide), { root: [0, -0.2, 0], turn: -360 * 4, e: 'out' }),
    k(1, GL, { root: R.guard, turn: -360 * 4 }),
  ], [{ t: 0.08, e: 'trail', on: true, color: T, w: 1.3 }, { t: 0.1, e: 'vortex', kind: 'sand', r: 4.5, dur: 2.1 }, { t: 0.9, e: 'trail', on: false }]);
  S1('s_shieldspin', 0.9, 'upper', [
    k(0, G),
    k(0.3, P(G, { spine: [0, 60, 0], chest: [-6, 30, 0], armL: [-80, -40, 70], foreL: [-120, 0, 0], head: [0, -40, 0] })),
    k(0.42, P(G, { spine: [16, -50, 0], chest: [8, -24, 0], armL: [-90, 20, 0], foreL: [-6, 0, 0] }), { e: 'snap' }),
    k(1, G),
  ], [{ t: 0.42, e: 'proj', kind: 'roundshield', from: 'L', spin: 24, ret: true }, { t: 0.42, e: 'hideAttach', bone: 'foreL', dur: 0.95 }]);
  S1('s_sweep', 0.85, 'full', [
    k(0, GL, { turn: 0 }),
    // dropped low on one knee, the blade skimming level just off the ground as the body spins
    // the spin is spread over a longer turn: it gathers speed out of the coil, runs level through the hit and
    // winds down into the last quarter turn
    k(0.14, P(SH, arc(-70, { lead: -10, dy: -0.32, bend: 30, twist: -30 }), L.sweepR), { root: [0, -0.5, 0], turn: 35 }),
    k(0.3, P(SH, arc(-85, { lead: 6, dy: -0.32, bend: 30, twist: -16 }), L.sweepR), { root: [0, -0.52, 0], turn: -70, e: 'in' }),
    k(0.42, P(SH, arc(-90, { lead: 12, dy: -0.32, bend: 30, twist: -10 }), L.sweepR), { root: [0, -0.52, 0], turn: -228, e: 'linear' }),
    k(0.64, P(SH, arc(-50, { lead: 20, dy: -0.28, bend: 24 }), L.sweepR), { root: [0, -0.46, 0], turn: -360, e: 'out' }),
    k(1, GL, { root: R.guard, turn: -360 }),
  ], [{ t: 0.16, e: 'trail', on: true, color: T, w: 1.2 }, { t: 'hit', e: 'impact', kind: 'sand', at: 'self', r: 3.5, shake: 0.3 }, { t: 0.32, e: 'cloud', kind: 'sand', r: 3.5, at: 'self' }, { t: 0.62, e: 'trail', on: false }]);
  S1('s_finish', 1.0, 'full', [
    k(0, GL),
    k(0.22, P(SH, { spine: [-14, 20, 0], chest: [-10, 10, 0], armR: [-185, 20, -20], foreR: [-25, 0, 0], handR: [35, 0, 0], head: [-10, 0, 0] }, L.stepBack), { root: [0, 0.04, -0.1] }),
    k(0.48, P(SH, { spine: [50, -10, 0], chest: [16, 0, 0], armR: [-50, 0, -10], foreR: [0, 0, 0], handR: [60, 0, 0], head: [24, 0, 0] }, P(L.lungeL, { thighL: [-84, 0, 6], shinL: [90] })), { root: [0, -0.4, 0.5], e: 'snap' }),
    k(0.7, P(SH, { spine: [48, -10, 0], armR: [-46, 0, -10], handR: [62, 0, 0] }, L.lungeL), { root: [0, -0.38, 0.5] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.26, e: 'trail', on: true, color: '#ffb070', w: 1.2 }, { t: 'hit', e: 'impact', kind: 'execute', shake: 0.7, stop: 0.12 }, { t: 0.7, e: 'trail', on: false }], { strike: 0.26 });
  S1('s_cloak', 0.8, 'full', [
    k(0, GL),
    k(0.3, P(SH, { spine: [30, 0, 0], armR: [-60, 0, -40], foreR: [-120, 0, 0] }, L.deep), { root: R.deep }),
    k(0.6, P(SH, { spine: [30, 0, 0] }, L.deep), { root: R.deep }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.3, e: 'cloud', kind: 'sand', r: 3, at: 'self', thick: true }, { t: 0.35, e: 'fadeSelf', to: 0.25, dur: 3 }]);
  S1('s_hamstring', 0.7, 'full', [
    k(0, GL),
    // a low flat cut at the legs from a deep lunge
    // drawn back high on the right (close to the raised guard blade, so the draw is short), then cut down and
    // across to skim level at the legs
    ...swing(0.7, 0.24, { wind: -90, mid: -45, hit: 5, follow: 60, end: 75 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -30 : role === 'follow' || role === 'end' ? 20 : -5, dy: role === 'wind' ? -0.12 : role === 'mid' ? -0.32 : -0.4, bend: role === 'wind' ? 16 : 30, tilt: role === 'wind' ? 28 : role === 'mid' ? 6 : -8 }), role === 'wind' ? L.stepBack : L.lungeL), { root: role === 'wind' ? [0, -0.18, 0] : [0, -0.4, 0.3], e }], 1150),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.2, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', at: 'targetLow', shake: 0.2 }, { t: 0.56, e: 'trail', on: false }]);
  S1('s_counter', 1.05, 'full', [
    k(0, GL),
    // shield up and the blade already drawn back low on the right while the blow is caught, so the answer starts close
    k(0.2, P(arc(-80, { lead: -30, dy: -0.3, twist: -20 }), { armL: [-90, 74, 30], foreL: [-108, 0, 0] }, L.deep), { root: [0, -0.3, 0] }),
    k(0.36, P(arc(-84, { lead: -30, dy: -0.3, twist: -22 }), { armL: [-90, 74, 30], foreL: [-108, 0, 0] }, L.deep), { root: [0, -0.3, 0] }),
    ...swing(1.05, 0.6, { wind: -100, mid: -45, hit: 10, follow: 65, end: 80 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -30 : role === 'follow' || role === 'end' ? 22 : 0, dy: -0.2 }), role === 'wind' ? L.deep : L.lungeL), { root: role === 'wind' ? [0, -0.26, 0] : [0, -0.16, 0.36], e }], 1250),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.3, e: 'impact', kind: 'parry', at: 'shieldL' }, { t: 0.5, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.4, stop: 0.08 }, { t: 0.78, e: 'trail', on: false }]);
  S1('s_thousand', 1.6, 'full', (() => {
    const keys = [k(0, GL)];
    // dashes zig-zag forward (never back), one landing on each of the six hits
    const pts = [[1.1, 1.6], [-1.2, 3.0], [1.2, 4.4], [-1.1, 5.8], [0.9, 7.1], [0, 8]];
    pts.forEach(([x, z], i) => {
      const t = 0.125 + i * 0.125;
      // alternate flat forehand / backhand cuts, each finishing as the dash lands
      keys.push(k(t, P(SH, arc(i % 2 ? -40 : 40, { lead: i % 2 ? -20 : 20, dy: -0.2, bend: 20 }), i % 2 ? L.lungeR : L.lungeL), { root: [x, -0.16, z], turn: i % 2 ? 15 : -15, e: 'snap' }));
    });
    keys.push(k(0.9, P(SH, wield({ spine: [30, 0, 0], chest: [8, 0, 0], head: [12, 0, 0] }, [-0.3, 1.1, 0.3], [-0.2, -0.45, 0.87], [-0.6, 0.9, 0.1]), L.deep), { root: [0, -0.4, 8], turn: 0 }));
    keys.push(k(1, GL, { root: [0, 0, 8] }));
    return keys;
  })(), [{ t: 0.05, e: 'trail', on: true, color: '#ffd8a0', w: 1.2 }, ...[0, 1, 2, 3, 4, 5].map((i) => ({ t: 0.125 + i * 0.125, e: 'cloud', kind: 'sand', r: 1.4, at: 'self' })),
    { t: 'hit', e: 'impact', kind: 'slash', at: 'self', r: 6 }, { t: 'hit3', e: 'impact', kind: 'slash', at: 'self', r: 6 }, { t: 'hit6', e: 'impact', kind: 'sand', at: 'self', r: 6, shake: 0.6, stop: 0.1 }, { t: 0.9, e: 'trail', on: false }], { endRoot: [0, 0, 8] });

  // ---- level 42 and 45 (the Cinder Reach) ----
  // Glasscutter: a long flat draw-cut from a deep lunge; the blade is drawn across the target along its whole edge,
  // the contact held a beat, and carried far round to the left
  const GLUNGE = P(L.lungeL, { thighL: [-72, 0, 6], shinL: [74] });
  S1('s_glass', 0.85, 'full', [
    k(0, GL),
    ...swing(0.85, 0.32, { wind: -95, mid: -48, hit: 5, follow: 72, end: 92 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -30 : role === 'mid' ? -14 : role === 'hit' ? -4 : 24, dy: role === 'wind' ? -0.16 : -0.24, bend: role === 'wind' ? 10 : 20 }), role === 'wind' ? L.stepBack : GLUNGE), { root: role === 'wind' ? [0, -0.06, -0.04] : [0, -0.3, 0.34], e }], 1000),
    k(0.76, P(SH, arc(92, { lead: 24, dy: -0.24, bend: 20 }), GLUNGE), { root: [0, -0.3, 0.34] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.14, e: 'trail', on: true, color: '#ffe0b0', w: 1.1 }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.4, stop: 0.08 }, { t: 'hit', e: 'sparks', at: 'weaponR', dur: 0.2 }, { t: 0.66, e: 'trail', on: false }]);
  // Sirocco: a descending forehand diagonal, a descending backhand diagonal that crosses it, its follow-through
  // carried on up into the overhead lift, and a falling finisher onto the third hit, held
  const SLUNGE = P(L.lungeL, { thighL: [-80, 0, 6], shinL: [86] });
  S1('s_sirocco', 1.55, 'full', [
    k(0, GL),
    ...swing(1.55, 0.24, { wind: -92, mid: -48, hit: 5, follow: 60 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -26 : role === 'follow' ? 20 : -5, dy: role === 'wind' ? -0.04 : role === 'mid' ? -0.14 : role === 'hit' ? -0.24 : -0.36, tilt: role === 'wind' ? 26 : role === 'mid' ? 12 : role === 'hit' ? -4 : -18 }), L.stepL), { root: [0, -0.06, role === 'wind' ? 0.04 : 0.14], e }], 1150),
    ...swing(1.55, 0.6, { wind: 96, mid: 48, hit: -5, follow: -30 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? 28 : role === 'follow' ? -16 : 5, dy: role === 'wind' ? -0.04 : role === 'mid' ? -0.14 : role === 'hit' ? -0.24 : -0.16, r: role === 'wind' ? 0.36 : 0.44, tilt: role === 'wind' ? 24 : role === 'mid' ? 10 : role === 'hit' ? -6 : 10 }), L.lungeR), { root: [0, -0.08, 0.28], e }], 1150),
    k(0.72 / 1.55, P(SH, wield({ spine: [-2, 8, 0], chest: [-4, 4, 0], head: [-4, -6, 0] }, [-0.34, 1.62, 0.2], [0.05, 0.95, 0.3], [-0.7, 1.3, 0.1]), L.stand), { root: [0, 0.02, 0.3] }),
    k(0.8 / 1.55, P(SH, wield({ spine: [-10, 10, 0], chest: [-8, 4, 0], head: [-10, -6, 0] }, [-0.28, 1.84, 0.0], [0.15, 0.72, -0.68], [-0.7, 1.6, 0.2]), L.stand), { root: [0, 0.04, 0.3] }),
    k(0.96 / 1.55, P(SH, wield({ spine: [40, 0, 0], chest: [12, 0, 0], head: [16, 0, 0] }, [-0.12, 1.1, 0.55], [0.05, -0.45, 0.89], [-0.5, 0.85, 0.2]), SLUNGE), { root: [0, -0.38, 0.62], e: 'snap' }),
    k(0.74, P(SH, wield({ spine: [38, 0, 0], chest: [10, 0, 0], head: [14, 0, 0] }, [-0.12, 1.08, 0.52], [0.05, -0.52, 0.85], [-0.5, 0.85, 0.2]), SLUNGE), { root: [0, -0.36, 0.62] }),
    k(1, GL, { root: [0, 0, 0.62], e: 'smooth' }),
  ], [{ t: 0.04, e: 'trail', on: true, color: '#ffc880', w: 1.2 }, { t: 0.05, e: 'cloud', kind: 'sand', r: 1.6, at: 'self' }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.25, stop: 0.05 }, { t: 'hit2', e: 'impact', kind: 'slash', shake: 0.3, stop: 0.05 },
    { t: 'hit3', e: 'impact', kind: 'execute', shake: 0.75, stop: 0.12 }, { t: 'hit3', e: 'cloud', kind: 'sand', r: 2.5, at: 'self' }, { t: 0.78, e: 'trail', on: false }], { strike: 0.16, endRoot: [0, 0, 0.62] });
  // ---- level 47 and 50 (the Rime Steps) ----
  // Undertow: a low backhand from the left drags the guard aside, its follow-through carried straight round into the
  // wind-up of a forehand that steps in after it (no stop between: one current)
  S1('s_undertow', 0.9, 'full', [
    k(0, GL),
    k(0.1, P(SH, arc(40, { lead: 20, dy: -0.16, r: 0.36 }), L.stepL), { root: [0, -0.06, 0.02] }),
    ...swing(0.9, 0.3, { wind: 88, mid: 44, hit: -5, follow: -50 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? 28 : role === 'follow' ? -20 : 5, dy: role === 'wind' ? -0.22 : -0.34, r: role === 'wind' ? 0.36 : 0.44, bend: 18 }), L.stepL), { root: [0, -0.14, 0.12], e }], 1050),
    ...swing(0.9, 0.6, { wind: -64, mid: -34, hit: 5, follow: 58, end: 78 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -24 : role === 'follow' || role === 'end' ? 20 : -5, dy: -0.24, bend: 16 }), L.lungeR), { root: [0, -0.16, 0.34], e }], 1050),
    k(1, GL, { root: [0, 0, 0.34], e: 'smooth' }),
  ], [{ t: 0.08, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.2, stop: 0.045 }, { t: 'hit', e: 'cloud', kind: 'sand', r: 1.4, at: 'self' }, { t: 'hit2', e: 'impact', kind: 'slash', shake: 0.3, stop: 0.06 }, { t: 0.82, e: 'trail', on: false }], { endRoot: [0, 0, 0.34] });
  // Cascade: forehand, backhand, forehand, each wide and flat, each a step further in and a little lower, tumbling one
  // into the next; the last ends in a deep lunge and is held
  const CLUNGE = P(L.lungeL, { thighL: [-76, 0, 6], shinL: [80] });
  S1('s_cascade', 1.35, 'full', [
    k(0, GL),
    ...swing(1.35, 0.3, { wind: -92, mid: -48, hit: 5, follow: 55 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -26 : role === 'follow' ? 20 : -5, dy: role === 'wind' ? -0.12 : -0.18 }), L.stepL), { root: [0, -0.06, role === 'wind' ? 0.04 : 0.2], e }], 1150),
    ...swing(1.35, 0.62, { wind: 90, mid: 45, hit: -5, follow: -55 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? 28 : role === 'follow' ? -18 : 5, dy: role === 'wind' ? -0.18 : -0.26, r: role === 'wind' ? 0.36 : 0.44, bend: 16 }), L.lungeR), { root: [0, -0.12, 0.44], e }], 1150),
    ...swing(1.35, 0.94, { wind: -88, mid: -45, hit: 5, follow: 50, end: 66 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -26 : role === 'follow' || role === 'end' ? 18 : -5, dy: role === 'wind' ? -0.24 : -0.36, bend: 24 }), CLUNGE), { root: [0, -0.3, 0.72], e }], 1150),
    k(0.92, P(SH, arc(66, { lead: 18, dy: -0.36, bend: 24 }), CLUNGE), { root: [0, -0.3, 0.72] }),
    k(1, GL, { root: [0, 0, 0.72], e: 'smooth' }),
  ], [{ t: 0.04, e: 'trail', on: true, color: '#ffd0a0', w: 1.3 }, { t: 'hit', e: 'impact', kind: 'sweep', at: 'cone', r: 5, shake: 0.25, stop: 0.05 }, { t: 'hit2', e: 'impact', kind: 'sweep', at: 'cone', r: 5, shake: 0.3, stop: 0.05 },
    { t: 'hit3', e: 'impact', kind: 'execute', shake: 0.6, stop: 0.1 }, { t: 'hit3', e: 'cloud', kind: 'sand', r: 2.5, at: 'self' }, { t: 0.9, e: 'trail', on: false }], { endRoot: [0, 0, 0.72] });
  // ---- level 52 and 55 (the Windward Heights) ----
  // Scouring Edge: the blade dropped low behind the right hip, then a rising cut up across the front, through the target
  // at chest height (contact on the hit, an even speed), and carried on up to the left shoulder; it scoops a spray of grit
  S1('s_scour', 0.8, 'full', [
    k(0, GL),
    k(0.17, P(SH, arc(-50, { lead: -14, dy: -0.24, tilt: -6, bend: 10 }), L.stepBack), { root: [0, -0.06, -0.02] }),
    ...swing(0.8, 0.36, { wind: -104, mid: -52, hit: 5, follow: 64, end: 78 }, (a, role, e) => {
      const f = Math.min(1, Math.max(0, (a + 104) / 168));
      return [P(SH, arc(a, { lead: role === 'wind' ? -26 : role === 'follow' || role === 'end' ? 20 : -4, dy: -0.44 + 0.4 * f, tilt: -24 + 50 * f, bend: 18 - 10 * f }), role === 'wind' ? L.stepBack : L.lungeL), { root: role === 'wind' ? [0, -0.16, -0.02] : [0, -0.1, 0.2], e }];
    }, 1050),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.12, e: 'trail', on: true, color: T, w: 1.2 }, { t: 0.2, e: 'sound', s: 'swing' }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.3, stop: 0.06 }, { t: 'hit', e: 'cloud', kind: 'chill', r: 2.2, cone: true }, { t: 0.7, e: 'trail', on: false }]);
  // Whiteout: a counter-turn, then one full turn on wide feet with the scimitar held out flat (three hits as it comes
  // round, about 500 deg/s), easing out of the spin straight into a last flat forehand across the front
  S1('s_whiteout', 1.55, 'full', [
    k(0, GL, { turn: 0 }),
    k(0.1, P(SH, arc(-60, { lead: -10, dy: -0.24, twist: -40 }), L.wide), { root: [0, -0.22, 0], turn: 30 }),
    k(0.3 / 1.55, P(SH, arc(-88, { lead: 12, dy: -0.24, twist: -20 }), L.wide), { root: [0, -0.24, 0], turn: -6, e: 'in' }),
    k(0.6 / 1.55, P(SH, arc(-88, { lead: 12, dy: -0.24, twist: -20 }), L.wide), { root: [0, -0.24, 0], turn: -159, e: 'linear' }),
    k(0.9 / 1.55, P(SH, arc(-88, { lead: 12, dy: -0.24, twist: -20 }), L.wide), { root: [0, -0.24, 0], turn: -312, e: 'linear' }),
    ...swing(1.55, 1.2, { wind: -100, mid: -50, hit: 5, follow: 55, end: 70 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -20 : role === 'mid' ? -10 : role === 'hit' ? 0 : 20, dy: -0.24 }), role === 'wind' ? L.wide : L.lungeL), { root: role === 'wind' ? [0, -0.24, 0] : [0, -0.2, 0.2], turn: -360, e: role === 'wind' ? 'out' : e }], 1100),
    k(0.92, P(SH, arc(70, { lead: 20, dy: -0.24 }), L.lungeL), { root: [0, -0.2, 0.2], turn: -360 }),
    k(1, GL, { root: R.guard, turn: -360, e: 'smooth' }),
  ], [{ t: 0.12, e: 'trail', on: true, color: '#e8f4ff', w: 1.3 }, { t: 0.12, e: 'sound', s: 'whoosh' }, { t: 'hit', e: 'impact', kind: 'sweep', at: 'self', r: 4.5 }, { t: 'hit', e: 'cloud', kind: 'chill', r: 4.5, at: 'self' },
    { t: 'hit2', e: 'impact', kind: 'sweep', at: 'self', r: 4.5 }, { t: 'hit3', e: 'impact', kind: 'sweep', at: 'self', r: 4.5 }, { t: 'hit3', e: 'cloud', kind: 'chill', r: 5, at: 'self' },
    { t: 'hit4', e: 'impact', kind: 'execute', shake: 0.55, stop: 0.1 }, { t: 0.9, e: 'trail', on: false }]);
  // ---- level 57 and 60 (Tidewater Sound) ----
  // Riptide: a low forward cut in under the guard on a long lunge (the first contact), then the blade drawn back out
  // across the front from left to right as the sandblade steps back (the second contact), like a rip current pulling
  // the legs away
  S1('s_riptide', 0.85, 'full', [
    k(0, GL),
    ...swing(0.85, 0.3, { wind: -70, mid: -36, hit: 4, follow: 34 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -24 : role === 'follow' ? 16 : -4, dy: -0.42, r: role === 'wind' ? 0.38 : 0.48, bend: 22, tilt: -10 }), role === 'wind' ? L.stepL : L.lungeL), { root: role === 'wind' ? [0, -0.1, 0.04] : [0, -0.28, 0.3], e }], 1100),
    ...swing(0.85, 0.6, { wind: 60, mid: 34, hit: -4, follow: -52, end: -66 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? 20 : role === 'follow' || role === 'end' ? -20 : 4, dy: -0.34, bend: 16 }), L.stepBack), { root: [0, -0.14, 0.12], e }], 1100),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.06, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.2, stop: 0.045 }, { t: 'hit', e: 'impact', kind: 'seaspray' }, { t: 'hit2', e: 'impact', kind: 'slash', shake: 0.3, stop: 0.06 }, { t: 'hit2', e: 'cloud', kind: 'seaspray', r: 2, cone: true }, { t: 0.84, e: 'trail', on: false }]);
  // Tidal Bore (capstone): three cuts that come on like the bore up a creek, each a long step further in: a rising
  // forehand, a falling backhand and a last flat forehand on a deep lunge, held; spray runs on along the ground
  {
    const BL = P(L.lungeL, { thighL: [-76, 0, 6], shinL: [80] });
    S1('s_tidalbore', 1.4, 'full', [
      k(0, GL),
      ...swing(1.4, 0.3, { wind: -92, mid: -46, hit: 5, follow: 52 }, (a, role, e) => { const f = Math.min(1, Math.max(0, (a + 92) / 144)); return [P(SH, arc(a, { lead: role === 'wind' ? -26 : role === 'follow' ? 18 : -5, dy: -0.4 + 0.3 * f, tilt: -16 + 32 * f, bend: 14 }), L.stepL), { root: [0, -0.08, role === 'wind' ? 0.06 : 0.3], e }]; }, 1150),
      ...swing(1.4, 0.62, { wind: 88, mid: 44, hit: -5, follow: -52 }, (a, role, e) => { const f = Math.min(1, Math.max(0, (88 - a) / 140)); return [P(SH, arc(a, { lead: role === 'wind' ? 26 : role === 'follow' ? -18 : 5, dy: -0.06 - 0.32 * f, tilt: 20 - 34 * f, r: role === 'wind' ? 0.36 : 0.44, bend: 16 }), L.lungeR), { root: [0, -0.14, 0.7], e }]; }, 1150),
      ...swing(1.4, 0.94, { wind: -88, mid: -44, hit: 5, follow: 50, end: 64 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -26 : role === 'follow' || role === 'end' ? 18 : -5, dy: -0.3, bend: 24 }), BL), { root: [0, -0.3, 1.1], e }], 1150),
      k(0.92, P(SH, arc(64, { lead: 18, dy: -0.3, bend: 24 }), BL), { root: [0, -0.3, 1.1] }),
      k(1, GL, { root: [0, 0, 1.1], e: 'smooth' }),
    ], [{ t: 0.04, e: 'trail', on: true, color: '#e4eef0', w: 1.3 }, { t: 'hit', e: 'impact', kind: 'sweep', at: 'cone', r: 6, shake: 0.25, stop: 0.05 }, { t: 'hit', e: 'cloud', kind: 'seaspray', r: 3, cone: true },
      { t: 'hit2', e: 'impact', kind: 'sweep', at: 'cone', r: 6, shake: 0.3, stop: 0.05 }, { t: 'hit2', e: 'cloud', kind: 'seaspray', r: 3, cone: true },
      { t: 'hit3', e: 'impact', kind: 'execute', shake: 0.6, stop: 0.1 }, { t: 'hit3', e: 'wave', kind: 'water', len: 8 }, { t: 0.9, e: 'trail', on: false }], { endRoot: [0, 0, 1.1] });
  }
  // ---- level 62 and 65 (the Rainward Gorge) ----
  // Undercut: a low cut drawn in level under the plating on a deep lunge (the first contact), then the blade pulled back
  // out along the same low line from left to right as the sandblade rises and steps back (the second contact)
  S1('s_undercut', 0.85, 'full', [
    k(0, GL),
    ...swing(0.85, 0.3, { wind: 74, mid: 38, hit: -4, follow: -36 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? 24 : role === 'follow' ? -16 : 4, dy: -0.5, r: role === 'wind' ? 0.38 : 0.5, bend: 26, tilt: 4 }), role === 'wind' ? L.stepL : P(L.lungeL, { thighL: [-74, 0, 6], shinL: [78] })), { root: role === 'wind' ? [0, -0.12, 0.04] : [0, -0.34, 0.32], e }], 1100),
    ...swing(0.85, 0.6, { wind: -58, mid: -30, hit: 4, follow: 50, end: 64 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -20 : role === 'follow' || role === 'end' ? 20 : -4, dy: -0.44, bend: 20 }), L.stepBack), { root: [0, -0.18, 0.12], e }], 1100),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.06, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', shake: 0.2, stop: 0.045 }, { t: 'hit', e: 'impact', kind: 'mud' }, { t: 'hit2', e: 'impact', kind: 'slash', shake: 0.3, stop: 0.06 }, { t: 'hit2', e: 'cloud', kind: 'mud', r: 2, cone: true }, { t: 0.84, e: 'trail', on: false }]);
  // Landslide (capstone): three cuts coming downhill, each a long step further in: a falling forehand, a falling
  // backhand and a last heavy cut down and across on a deep lunge, held; mud and loose stone run on along the ground
  {
    const BL = P(L.lungeL, { thighL: [-78, 0, 6], shinL: [82] });
    S1('s_landslide', 1.4, 'full', [
      k(0, GL),
      ...swing(1.4, 0.3, { wind: 90, mid: 44, hit: -5, follow: -52 }, (a, role, e) => { const f = Math.min(1, Math.max(0, (90 - a) / 142)); return [P(SH, arc(a, { lead: role === 'wind' ? 26 : role === 'follow' ? -18 : 5, dy: 0.02 - 0.36 * f, tilt: 24 - 40 * f, bend: 14 }), L.stepL), { root: [0, -0.08, role === 'wind' ? 0.06 : 0.3], e }]; }, 1150),
      ...swing(1.4, 0.62, { wind: -90, mid: -46, hit: 5, follow: 52 }, (a, role, e) => { const f = Math.min(1, Math.max(0, (a + 90) / 142)); return [P(SH, arc(a, { lead: role === 'wind' ? -26 : role === 'follow' ? 18 : -5, dy: 0.0 - 0.36 * f, tilt: -24 + 40 * f, r: role === 'wind' ? 0.36 : 0.44, bend: 16 }), L.lungeR), { root: [0, -0.16, 0.7], e }]; }, 1150),
      ...swing(1.4, 0.94, { wind: 96, mid: 48, hit: -5, follow: -56, end: -70 }, (a, role, e) => { const f = Math.min(1, Math.max(0, (96 - a) / 166)); return [P(SH, arc(a, { lead: role === 'wind' ? 26 : role === 'follow' || role === 'end' ? -18 : 5, dy: 0.06 - 0.5 * f, tilt: 30 - 56 * f, bend: 24 }), BL), { root: [0, -0.32, 1.1], e }]; }, 1150),
      k(0.92, P(SH, arc(-70, { lead: -18, dy: -0.44, tilt: -26, bend: 24 }), BL), { root: [0, -0.32, 1.1] }),
      k(1, GL, { root: [0, 0, 1.1], e: 'smooth' }),
    ], [{ t: 0.04, e: 'trail', on: true, color: '#b8805a', w: 1.3 }, { t: 'hit', e: 'impact', kind: 'sweep', at: 'cone', r: 6, shake: 0.25, stop: 0.05 }, { t: 'hit', e: 'cloud', kind: 'mud', r: 3, cone: true },
      { t: 'hit2', e: 'impact', kind: 'sweep', at: 'cone', r: 6, shake: 0.3, stop: 0.05 }, { t: 'hit2', e: 'cloud', kind: 'mud', r: 3, cone: true },
      { t: 'hit3', e: 'impact', kind: 'execute', shake: 0.6, stop: 0.1 }, { t: 'hit3', e: 'wave', kind: 'mud', len: 9 }, { t: 0.9, e: 'trail', on: false }], { endRoot: [0, 0, 1.1] });
  }
}

// ============================== WARDEN ====================================
{
  const G = P(guard('warden'), { spine: [8, 0, 0] });
  const GL = P(G, LG);
  const SH = { armL: [-50, 74, 28], foreL: [-100, 0, 0] };
  const T = TRAIL.warden;
  const W1 = (id, dur, mask, keys, ev, o) => (DEF[id] = C('warden', dur, mask, keys, ev, o));
  // Hammer Blow: hammer cocked back over the right shoulder, swung flat through the target, carried round to the left
  W1('w_blow', 1.0, 'full', [
    k(0, GL),
    k(0.32, P(SH, wield({ spine: [6, -55, 0], chest: [0, -24, 0], head: [0, 55, 0] }, [-0.32, 1.62, -0.25], [-0.1, 0.55, -0.83], [-0.6, 1.3, 0.1]), L.wide), { root: [0, -0.16, -0.06] }),
    k(0.43, P(SH, wield({ spine: [18, 40, 0], chest: [6, 26, 0], head: [6, -46, 0] }, [0.0, 1.3, 0.5], [0.75, 0.05, 0.66], [-0.45, 1.0, 0.2]), L.lungeL), { root: [0, -0.2, 0.2], e: 'snap' }),
    k(0.6, P(SH, wield({ spine: [20, 56, 0], chest: [6, 30, 0], head: [6, -60, 0] }, [0.3, 1.2, 0.3], [0.7, -0.2, -0.68], [-0.1, 0.9, 0.45]), L.lungeL), { root: [0, -0.2, 0.2] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.22, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'blunt', shake: 0.5, stop: 0.08 }, { t: 0.66, e: 'trail', on: false }], { strike: 0.19 });
  W1('w_slam', 0.85, 'full', [
    k(0, GL),
    k(0.22, P(G, { spine: [-2, -30, 0], armL: [-40, 80, 50], foreL: [-110, 0, 0] }, L.stepBack), { root: [0, -0.08, -0.1] }),
    k(0.38, P(G, { spine: [26, 26, 0], armL: [-90, 16, 4], foreL: [-24, -20, 0] }, L.lungeL), { root: [0, -0.14, 0.34], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 'hit', e: 'impact', kind: 'shield', shake: 0.55, stop: 0.09 }, { t: 0.38, e: 'dust' }]);
  W1('w_pound', 1.1, 'full', [
    k(0, GL),
    // hammer hauled overhead, then driven down so the head lands just in front of the lead foot
    k(0.3, P(SH, overhead({ spine: [-14, 0, 0], chest: [-10, 0, 0], head: [-12, 0, 0] }), L.stand), { root: [0, 0.06, 0] }),
    k(0.5, P(SH, slamAt({ spine: [28, 0, 0], chest: [14, 0, 0], head: [14, 0, 0] }, L.lungeL, [-0.04, 0.16, 1.18], [0.06, -0.6, 0.8], 0.85, 0.1), L.lungeL), { root: [0, -0.3, 0.1], e: 'snap' }),
    k(0.72, P(SH, slamAt({ spine: [26, 0, 0], chest: [12, 0, 0], head: [12, 0, 0] }, L.lungeL, [-0.04, 0.18, 1.15], [0.06, -0.56, 0.83], 0.85, 0.1), L.lungeL), { root: [0, -0.3, 0.1] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.3, e: 'trail', on: true, color: T, w: 1.3, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'earth', at: 'front1', r: 5, shake: 0.8, stop: 0.1 }, { t: 'hit', e: 'decal', kind: 'crack', r: 3, at: 'front1' }, { t: 'hit', e: 'ring', color: '#d8c0a0', r: 5.5, at: 'front1' }, { t: 0.7, e: 'trail', on: false }]);
  W1('w_challenge', 0.95, 'full', [
    k(0, GL),
    k(0.22, P({ spine: [-6, 0, 0], armL: [-70, 60, 30], foreL: [-90, 0, 0], armR: [-130, 30, -20], foreR: [-80, 0, 0], handR: [0, 0, 0] }, L.wide), { root: [0, -0.12, 0] }),
    k(0.32, P({ spine: [10, 0, 0], armL: [-70, 60, 30], foreL: [-90, 0, 0], armR: [-80, 50, 0], foreR: [-60, 0, 0], handR: [0, 0, 0] }, L.wide), { root: [0, -0.14, 0], e: 'snap' }),
    k(0.45, P({ spine: [-6, 0, 0], armL: [-70, 60, 30], foreL: [-90, 0, 0], armR: [-130, 30, -20], foreR: [-80, 0, 0] }, L.wide)),
    k(0.55, P({ spine: [-18, 0, 0], chest: [-14, 0, 0], head: [-24, 0, 0], armL: [-70, 60, 30], foreL: [-90, 0, 0], armR: [-80, 50, 0], foreR: [-60, 0, 0] }, L.wide), { e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.32, e: 'impact', kind: 'clang', at: 'shieldL' }, { t: 0.55, e: 'impact', kind: 'clang', at: 'shieldL' }, { t: 0.56, e: 'ring', color: '#ff8a5a', r: 12 }, { t: 0.56, e: 'shake', amt: 0.35 }]);
  W1('w_wall', 1.0, 'full', [
    k(0, GL),
    k(0.32, P({ spine: [28, -6, 0], chest: [8, 0, 0], armL: [-60, 50, 10], foreL: [-60, 0, 0], armR: [-60, 0, -20], foreR: [-80, 0, 0], handR: [40, 0, 0], head: [16, 0, 0] }, L.deep), { root: [0, -0.4, 0], e: 'snap' }),
    k(0.75, P({ spine: [28, -6, 0], armL: [-62, 50, 10], foreL: [-62, 0, 0] }, L.deep), { root: [0, -0.4, 0] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.32, e: 'impact', kind: 'earth', at: 'front1', shake: 0.45, stop: 0.05 }, { t: 0.34, e: 'aura', color: '#9ab8ff', dur: 2 }, { t: 0.32, e: 'decal', kind: 'crack', r: 1.6, at: 'front1' }]);
  W1('w_bulwark', 1.05, 'full', [
    k(0, GL),
    k(0.14, P(G, { spine: [30, 0, 0], armL: [-86, 50, 20], foreL: [-90, 0, 0], armR: [-10, 0, -30], foreR: [-80, 0, 0], handR: [60, 0, 0] }, L.lungeL), { root: [0, -0.16, 0.2] }),
    k(0.3, P(G, { spine: [30, 0, 0], armL: [-88, 44, 14], foreL: [-80, 0, 0] }, L.lungeR), { root: [0, -0.18, 2.2] }),
    k(0.42, P(G, { spine: [32, 0, 0], armL: [-88, 44, 14], foreL: [-80, 0, 0] }, L.lungeL), { root: [0, -0.2, 4.4] }),
    k(0.52, P(G, { spine: [14, 20, 0], armL: [-96, 20, 4], foreL: [-30, 0, 0] }, L.lungeL), { root: [0, -0.14, 5.6], e: 'snap' }),
    k(1, GL, { root: [0, 0, 5.6] }),
  ], [{ t: 0.12, e: 'dash' }, { t: 0.22, e: 'dust' }, { t: 0.36, e: 'dust' }, { t: 0.46, e: 'dust' }, { t: 'hit', e: 'impact', kind: 'shield', shake: 0.7, stop: 0.1 }], { endRoot: [0, 0, 5.6] });
  // Uppercut Smash: hammer low behind the right hip, driven up the front through the target (the contact key sits on
  // the hit) and on up overhead; every key-to-key arm swing stays well under 180 deg so the compiler's short way round
  // is up the front (one 230 deg step to -200 sent it round behind the back)
  W1('w_uppercut', 1.0, 'full', [
    k(0, GL),
    k(0.23, P(SH, { spine: [30, -30, 0], armR: [22, -10, -40], foreR: [-20, 0, 0], handR: [60, 0, 0] }, L.deep), { root: [0, -0.36, 0] }),
    k(0.38, P(SH, { spine: [8, 4, 0], chest: [-2, 4, 0], armR: [-70, 14, -28], foreR: [-14, 0, 0], handR: [40, 0, 0], head: [-8, 0, 0] }, L.stepL), { root: [0, -0.12, 0.08], e: 'snap' }),
    k(0.55, P(SH, { spine: [-20, 30, 0], chest: [-12, 20, 0], armR: [-158, 30, -10], foreR: [-10, 0, 0], handR: [-10, 0, 0], head: [-20, 0, 0] }, P(L.stand, { thighR: [-20, 0, -4] })), { root: [0, 0.16, 0.14] }),
    k(0.7, P(SH, { spine: [-10, 20, 0], armR: [-152, 20, -20], foreR: [-30, 0, 0] })),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.24, e: 'trail', on: true, color: T, w: 1.3, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'blunt', shake: 0.55, stop: 0.08 }, { t: 0.3, e: 'dust' }, { t: 0.72, e: 'trail', on: false }], { strike: 0.15 });
  W1('w_iron', 1.05, 'full', [
    k(0, GL),
    k(0.3, P({ spine: [20, 0, 0], chest: [10, 0, 0], armR: [-40, 0, -50], foreR: [-110, 0, 0], handR: [0, 0, 0], armL: [-40, 50, 40], foreL: [-110, 0, 0], head: [10, 0, 0] }, L.wide), { root: [0, -0.2, 0] }),
    k(0.5, P({ spine: [-10, 0, 0], chest: [-10, 0, 0], armR: [-30, 0, -70], foreR: [-120, 0, 0], armL: [-30, 50, 70], foreL: [-120, 0, 0], head: [-12, 0, 0] }, L.wide), { root: [0, -0.12, 0], e: 'snap' }),
    k(0.75, P({ spine: [-8, 0, 0], armR: [-30, 0, -70], foreR: [-120, 0, 0], armL: [-30, 50, 70], foreL: [-120, 0, 0] }, L.wide)),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.5, e: 'flash', color: '#c8d8ff' }, { t: 0.5, e: 'aura', color: '#b8c8e8', dur: 2 }, { t: 0.5, e: 'shake', amt: 0.2 }]);
  W1('w_split', 1.2, 'full', [
    k(0, GL),
    k(0.27, P(SH, { spine: [-18, 0, 0], armR: [-200, 0, -14], foreR: [-35, 0, 0], handR: [15, 0, 0] }, L.stand), { root: [0, 0.08, 0] }),
    k(0.5, P(SH, { spine: [50, 0, 0], chest: [16, 0, 0], armR: [-60, 0, -10], foreR: [0, 0, 0], handR: [66, 0, 0], head: [24, 0, 0] }, L.lungeL), { root: [0, -0.42, 0.3], e: 'snap' }),
    k(0.75, P(SH, { spine: [46, 0, 0], armR: [-56, 0, -10], handR: [68, 0, 0] }, L.lungeL), { root: [0, -0.4, 0.3] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.29, e: 'trail', on: true, color: T, w: 1.3, along: 0.85 }, { t: 0.52, e: 'wave', kind: 'rock', len: 14 }, { t: 0.52, e: 'shake', amt: 0.35 }, { t: 0.52, e: 'hitstop', dur: 0.05, self: true }, { t: 0.76, e: 'trail', on: false }], { strike: 0.28 });
  W1('w_toss', 1.0, 'upper', [
    k(0, G),
    // a longer throw from the cocked key, so the hammer leaves the hand near 60 m/s rather than 71
    k(0.26, P(SH, { spine: [-10, -40, 0], armR: [-200, -20, -20], foreR: [-60, 0, 0], handR: [-30, 0, 0] })),
    k(0.45, P(SH, { spine: [26, 30, 0], armR: [-90, 20, -10], foreR: [0, 0, 0], handR: [20, 0, 0] }), { e: 'snap' }),
    k(0.6, P(SH, { spine: [20, 20, 0], armR: [-60, 0, -20], foreR: [-30, 0, 0] })),
    k(1, G),
  ], [{ t: 0.45, e: 'proj', kind: 'hammer', from: 'R', spin: 14, ret: true }, { t: 0.45, e: 'hideAttach', bone: 'weaponR', dur: 1.2 }]);
  W1('w_fortify', 1.2, 'full', [
    k(0, GL),
    k(0.3, P({ spine: [30, 0, 0], head: [30, 0, 0], armR: [-60, 0, -10], foreR: [-20, 0, 0], handR: [90, 0, 0], armL: [-40, 50, 20], foreL: [-90, 0, 0] }, L.kneel), { root: R.kneel }),
    k(0.6, P({ spine: [20, 0, 0], chest: [-8, 0, 0], head: [-6, 0, 0] }, L.kneel), { root: R.kneel }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.3, e: 'impact', kind: 'earth', at: 'front1', shake: 0.2 }, { t: 0.4, e: 'motes', color: '#a0d0ff', n: 30, dur: 1 }, { t: 0.55, e: 'aura', color: '#a8ffb0', dur: 1.5 }]);
  W1('w_combo', 1.25, 'full', [
    k(0, GL),
    k(0.12, P(G, { spine: [-2, -30, 0], armL: [-40, 80, 50], foreL: [-110, 0, 0] }, L.stepBack)),
    k(0.24, P(G, { spine: [24, 24, 0], armL: [-90, 16, 4], foreL: [-24, -20, 0] }, L.stepL), { root: [0, -0.1, 0.16], e: 'snap' }),
    ...swing(1.25, 0.64, { wind: -110, mid: -50, hit: 5, follow: 40 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -30 : role === 'follow' ? 20 : -5, dy: -0.22 }), role === 'wind' ? L.wide : L.lungeL), { root: role === 'wind' ? [0, -0.1, 0.16] : [0, -0.12, 0.3], e }], 1200),
    k(0.64, P(G, { spine: [-2, -30, 0], armL: [-40, 80, 50], foreL: [-110, 0, 0] }, L.stepL), { root: [0, -0.1, 0.3] }),
    k(0.78, P(G, { spine: [28, 26, 0], armL: [-92, 14, 4], foreL: [-20, -20, 0] }, L.lungeL), { root: [0, -0.16, 0.5], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 'hit', e: 'impact', kind: 'shield', shake: 0.3 }, { t: 0.36, e: 'trail', on: true, color: T, along: 0.85 }, { t: 'hit2', e: 'impact', kind: 'blunt', shake: 0.35 }, { t: 0.58, e: 'trail', on: false }, { t: 'hit3', e: 'impact', kind: 'shield', shake: 0.5, stop: 0.08 }]);
  W1('w_ring', 1.35, 'full', [
    k(0, GL),
    // the hammer swung level round above the head, side to side, gathering speed, then brought down
    k(0.15, P(SH, overhead({ spine: [-10, 0, 0], head: [-8, 0, 0] }), L.wide), { root: [0, -0.1, 0] }),
    ...[0.27, 0.39, 0.51, 0.63].map((t, i) => {
      const f = (i % 2 ? -1 : 1) * 80 * (0.75 + i * 0.08), r = f * RAD;
      return k(t, P(SH, wield({ spine: [-10, f * 0.25, 0], chest: [-6, f * 0.15, 0], head: [-8, -f * 0.3, 0] }, [-0.1 + Math.sin(r) * 0.14, 1.98, 0.06 + Math.cos(r) * 0.14], [Math.sin(r), 0.12, Math.cos(r)], [-0.7, 1.6, 0.1]), L.wide), { root: [0, -0.1, 0] });
    }),
    k(0.704, P(SH, slamAt({ spine: [28, 0, 0], chest: [14, 0, 0], head: [14, 0, 0] }, L.deep, [-0.04, 0.16, 1.1], [0.06, -0.62, 0.78], 0.85, 0.1), L.deep), { root: [0, -0.42, 0.1], e: 'snap' }),
    k(0.85, P(SH, slamAt({ spine: [26, 0, 0], chest: [12, 0, 0], head: [12, 0, 0] }, L.deep, [-0.04, 0.18, 1.08], [0.06, -0.58, 0.81], 0.85, 0.1), L.deep), { root: [0, -0.4, 0.1] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.15, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'earth', at: 'front1', r: 6, shake: 0.9, stop: 0.1 }, { t: 'hit', e: 'ring', color: '#ffe0a0', r: 6.5 }, { t: 'hit', e: 'decal', kind: 'crack', r: 3.5, at: 'front1' }, { t: 0.8, e: 'trail', on: false }]);
  W1('w_intercept', 1.0, 'full', [
    k(0, GL),
    k(0.15, P(G, { spine: [24, 0, 0] }, L.deep), { root: R.deep }),
    k(0.4, P(G, { spine: [-6, 0, 0], armL: [-120, 50, 20], foreL: [-60, 0, 0] }, L.tuck), { root: [0, 2.8, 5.0], e: 'out' }),
    k(0.64, P(G, { spine: [30, 0, 0], armL: [-80, 60, 20], foreL: [-90, 0, 0] }, L.deep), { root: [0, -0.4, 9.5], e: 'in' }),
    k(1, GL, { root: [0, 0, 9.5] }),
  ], [{ t: 0.15, e: 'leap' }, { t: 0.15, e: 'dust' }, { t: 'hit', e: 'impact', kind: 'earth', at: 'self', r: 3, shake: 0.6, stop: 0.06 }, { t: 'hit', e: 'decal', kind: 'crack', r: 2 }], { endRoot: [0, 0, 9.5] });
  W1('w_laststand', 1.05, 'full', [
    k(0, GL),
    k(0.22, P({ spine: [36, 0, 0], head: [20, 0, 0], armR: [-20, 0, -30], foreR: [-80, 0, 0], armL: [-40, 50, 30], foreL: [-90, 0, 0] }, L.deep), { root: R.deep }),
    k(0.42, P({ spine: [-24, 0, 0], chest: [-20, 0, 0], head: [-34, 0, 0], armR: [-150, 0, -50], foreR: [-30, 0, 0], handR: [-30, 0, 0], armL: [-110, 50, 60], foreL: [-60, 0, 0] }, L.wide), { root: [0, -0.06, 0], e: 'snap' }),
    k(0.72, P({ spine: [-20, 0, 0], chest: [-18, 0, 0], head: [-30, 0, 0] }, L.wide), {}),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.42, e: 'ring', color: '#ff7050', r: 8 }, { t: 0.42, e: 'shake', amt: 0.45 }, { t: 0.44, e: 'impact', kind: 'heal', at: 'self' }, { t: 0.44, e: 'aura', color: '#ff9a7a', dur: 2 }]);
  W1('w_stomp', 0.95, 'full', [
    k(0, GL),
    k(0.28, P(G, { spine: [-10, 0, 0], armR: [-40, 0, -50], armL: [-40, 50, 40] }, { thighR: [-110, 0, -10], shinR: [100], footR: [0], thighL: [0, 0, 6], shinL: [16] }), { root: [0, 0.1, 0] }),
    k(0.45, P(G, { spine: [24, 0, 0], armR: [-20, 0, -60], armL: [-20, 50, 60] }, L.wide), { root: [0, -0.3, 0], e: 'snap' }),
    k(0.7, P(G, { spine: [20, 0, 0] }, L.wide), { root: [0, -0.28, 0] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 'hit', e: 'impact', kind: 'earth', at: 'self', r: 6, shake: 0.85, stop: 0.07 }, { t: 'hit', e: 'ring', color: '#c8b090', r: 6.5 }, { t: 'hit', e: 'decal', kind: 'crack', r: 2.5 }]);
  W1('w_shatter', 1.2, 'full', [
    k(0, GL),
    k(0.25, P(SH, { spine: [-22, 10, 0], chest: [-14, 0, 0], armR: [-200, 10, -14], foreR: [-30, 0, 0], handR: [15, 0, 0], head: [-16, 0, 0] }, L.stand), { root: [0, 0.1, -0.06] }),
    k(0.5, P(SH, { spine: [52, 0, 0], chest: [16, 0, 0], armR: [-70, 0, -10], foreR: [0, 0, 0], handR: [52, 0, 0], head: [26, 0, 0] }, L.lungeL), { root: [0, -0.4, 0.34], e: 'snap' }),
    k(0.72, P(SH, { spine: [48, 0, 0], armR: [-64, 0, -10], handR: [62, 0, 0] }, L.lungeL), { root: [0, -0.38, 0.34] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.27, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'shatter', shake: 0.8, stop: 0.12 }, { t: 0.72, e: 'trail', on: false }], { strike: 0.3 });
  W1('w_deflect', 0.7, 'upper', [
    k(0, G),
    k(0.3, P(G, { spine: [10, -20, 0], armL: [-100, 50, 20], foreL: [-80, -30, 0] }), { e: 'snap' }),
    k(0.7, P(G, { spine: [10, -20, 0], armL: [-100, 50, 20], foreL: [-80, -30, 0] })),
    k(1, G),
  ], [{ t: 0.3, e: 'impact', kind: 'parry', at: 'shieldL' }, { t: 0.3, e: 'aura', color: '#c8e0ff', dur: 1 }]);
  W1('w_pulverize', 1.5, 'full', [
    k(0, GL),
    ...swing(1.5, 0.38, { wind: -115, mid: -55, hit: 5, follow: 60 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -30 : role === 'follow' ? 20 : -5, dy: -0.22 }), role === 'wind' ? L.wide : L.lungeL), { root: role === 'wind' ? [0, -0.1, 0] : [0, -0.12, 0.2], e }], 1200),
    // a short backhand follow-through that carries on up into the overhead lift
    ...swing(1.5, 0.76, { wind: 105, mid: 50, hit: -5, follow: -22 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? 30 : role === 'follow' ? -20 : 5, dy: role === 'follow' ? -0.1 : -0.2, r: role === 'wind' ? 0.36 : 0.44 }), L.lungeR), { root: [0, -0.12, 0.4], e }], 1200),
    k(0.625, P(SH, overhead({ spine: [-18, 0, 0], chest: [-8, 0, 0], head: [-10, 0, 0] }), L.stand), { root: [0, 0.06, 0.4] }),
    k(0.76, P(SH, slamAt({ spine: [28, 0, 0], chest: [14, 0, 0], head: [14, 0, 0] }, L.deep, [-0.04, 0.16, 1.1], [0.06, -0.62, 0.78], 0.85, 0.5), L.deep), { root: [0, -0.42, 0.5], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.1, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'blunt', shake: 0.4 }, { t: 'hit2', e: 'impact', kind: 'blunt', shake: 0.45 }, { t: 'hit3', e: 'impact', kind: 'earth', at: 'front1', shake: 0.8, stop: 0.1 }, { t: 'hit3', e: 'decal', kind: 'crack', r: 2, at: 'front1' }, { t: 0.86, e: 'trail', on: false }]);
  W1('w_colossus', 1.8, 'full', [
    k(0, GL),
    k(0.14, P(SH, { spine: [34, 0, 0], armR: [-30, 0, -30], foreR: [-30, 0, 0] }, L.deep), { root: [0, -0.46, 0] }),
    // a huge leap with the hammer cocked overhead at its top; the body hangs at the apex, then the long fall and the
    // blow accelerate together all the way down onto the landing
    ...(() => {
      const A = k(0.3, P(SH, { spine: [-20, 0, 0], chest: [-10, 0, 0], armR: [-190, 0, -10], foreR: [-30, 0, 0], handR: [50, 0, 0], head: [-16, 0, 0] }, L.tuck), { root: [0, 2.8, 3.8], e: 'smooth' });
      const B = k(0.528, P(SH, { spine: [56, 0, 0], chest: [16, 0, 0], armR: [-66, 0, -10], foreR: [0, 0, 0], handR: [70, 0, 0], head: [26, 0, 0] }, L.deep), { root: [0, -0.46, 8.0] });
      return [A, ...slamFall(1.8, A, B, 0.68, [0, 0.6, 7.4], 0.075)];
    })(),
    k(0.75, P(SH, { spine: [50, 0, 0], armR: [-60, 0, -10], handR: [72, 0, 0] }, L.deep), { root: [0, -0.44, 8.0], e: 'out' }),
    k(1, GL, { root: [0, 0, 8.0], e: 'smooth' }),
  ], [{ t: 0.14, e: 'leap' }, { t: 0.15, e: 'dust' }, { t: 0.3, e: 'trail', on: true, color: '#d8e4ff', w: 1.5, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'earth', at: 'self', r: 7, shake: 1.3, stop: 0.14 }, { t: 'hit', e: 'decal', kind: 'crater', r: 5.5 }, { t: 'hit', e: 'ring', color: '#ffe0b0', r: 8 }, { t: 0.72, e: 'trail', on: false }], { endRoot: [0, 0, 8.0] });

  // ---- level 42 and 45 (the Cinder Reach) ----
  // Anvil Drop: the hammer hauled straight up overhead as the warden rises on his toes, then dropped onto the target
  // with the whole body sinking under it; the contact is held like a forge blow
  W1('w_anvil', 1.25, 'full', [
    k(0, GL),
    k(0.14, P(SH, { spine: [10, 0, 0], armR: [-60, 0, -20], foreR: [-50, 0, 0], handR: [20, 0, 0] }, LG), { root: [0, -0.06, 0] }),
    k(0.32, P(SH, overhead({ spine: [-18, 0, 0], chest: [-10, 0, 0], head: [-14, 0, 0] }), L.stand), { root: [0, 0.1, 0] }),
    k(0.62 / 1.25, P(SH, slamAt({ spine: [34, 0, 0], chest: [14, 0, 0], head: [16, 0, 0] }, L.deep, [-0.04, 0.5, 1.18], [0.06, -0.56, 0.83], 0.85, 0.24), L.deep), { root: [0, -0.42, 0.24], e: 'snap' }),
    k(0.7, P(SH, slamAt({ spine: [32, 0, 0], chest: [12, 0, 0], head: [14, 0, 0] }, L.deep, [-0.04, 0.48, 1.16], [0.06, -0.54, 0.84], 0.85, 0.24), L.deep), { root: [0, -0.42, 0.24] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.24, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'blunt', shake: 0.8, stop: 0.12 }, { t: 'hit', e: 'sparks', at: 'weaponR', dur: 0.25 }, { t: 'hit', e: 'dust' }, { t: 0.72, e: 'trail', on: false }], { strike: 0.24 });
  // Pile Driver: two overhead blows into the ground ahead, the second from higher and deeper; each contact is held
  W1('w_piledriver', 1.6, 'full', [
    k(0, GL),
    k(0.2, P(SH, overhead({ spine: [-14, 0, 0], chest: [-10, 0, 0], head: [-12, 0, 0] }), L.stand), { root: [0, 0.06, 0] }),
    k(0.56 / 1.6, P(SH, slamAt({ spine: [28, 0, 0], chest: [14, 0, 0], head: [14, 0, 0] }, L.lungeL, [-0.04, 0.16, 1.18], [0.06, -0.6, 0.8], 0.85, 0.1), L.lungeL), { root: [0, -0.3, 0.1], e: 'snap' }),
    k(0.44, P(SH, slamAt({ spine: [26, 0, 0], chest: [12, 0, 0], head: [12, 0, 0] }, L.lungeL, [-0.04, 0.18, 1.15], [0.06, -0.56, 0.83], 0.85, 0.1), L.lungeL), { root: [0, -0.3, 0.1] }),
    k(0.52, P(SH, { spine: [4, 0, 0], armR: [-110, 0, -16], foreR: [-30, 0, 0], handR: [30, 0, 0] }, L.stand), { root: [0, 0.0, 0.1] }),
    k(0.6, P(SH, overhead({ spine: [-20, 0, 0], chest: [-12, 0, 0], head: [-14, 0, 0] }), L.stand), { root: [0, 0.14, 0.1] }),
    k(1.16 / 1.6, P(SH, slamAt({ spine: [36, 0, 0], chest: [16, 0, 0], head: [16, 0, 0] }, L.deep, [-0.04, 0.16, 1.12], [0.06, -0.62, 0.78], 0.85, 0.2), L.deep), { root: [0, -0.44, 0.2], e: 'snap' }),
    k(0.86, P(SH, slamAt({ spine: [34, 0, 0], chest: [14, 0, 0], head: [14, 0, 0] }, L.deep, [-0.04, 0.18, 1.1], [0.06, -0.58, 0.81], 0.85, 0.2), L.deep), { root: [0, -0.42, 0.2] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.12, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'earth', at: 'front1', shake: 0.6, stop: 0.08 }, { t: 'hit', e: 'decal', kind: 'crack', r: 2, at: 'front1' },
    { t: 'hit2', e: 'impact', kind: 'earth', at: 'self', r: 6, shake: 1.1, stop: 0.12 }, { t: 'hit2', e: 'wave', kind: 'rock', len: 6 }, { t: 'hit2', e: 'decal', kind: 'crater', r: 4.5 }, { t: 'hit2', e: 'ring', color: '#ffe0b0', r: 6.5 }, { t: 0.9, e: 'trail', on: false }]);
  // ---- level 47 and 50 (the Rime Steps) ----
  // Trip Hammer: three short, even chops like a water-driven trip hammer, the hammer cocked only to the shoulder and
  // dropped onto the target; each contact sits on its hit and is held a beat
  {
    const COCK = (sp) => P(SH, wield({ spine: [sp, 0, 0], chest: [-4, 0, 0], head: [-4, 0, 0] }, [-0.3, 1.6, 0.16], [0.06, 0.9, -0.42], [-0.7, 1.4, 0.15]), L.stepL);
    const CHOP = (sp, y) => P(SH, slamAt({ spine: [sp, 0, 0], chest: [10, 0, 0], head: [10, 0, 0] }, L.lungeL, [-0.04, y, 1.2], [0.06, -0.42, 0.9], 0.85, 0.16), L.lungeL);
    const hits = [0.36, 0.66, 0.96];
    W1('w_triphammer', 1.3, 'full', [
      k(0, GL),
      ...hits.flatMap((h, i) => [
        k((h - 0.14) / 1.3, COCK(-4 - i * 2), { root: [0, -0.04, 0.1 + i * 0.06] }),
        k(h / 1.3, CHOP(22 + i * 3, 0.78 - i * 0.06), { root: [0, -0.22, 0.16 + i * 0.06], e: 'snap' }),
      ]),
      k(0.86, CHOP(30, 0.64), { root: [0, -0.22, 0.28] }),
      k(1, GL, { root: R.guard, e: 'smooth' }),
    ], [{ t: 0.12, e: 'trail', on: true, color: T, w: 1.2, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'blunt', shake: 0.3, stop: 0.05 }, { t: 'hit2', e: 'impact', kind: 'blunt', shake: 0.35, stop: 0.05 },
      { t: 'hit3', e: 'impact', kind: 'blunt', shake: 0.55, stop: 0.09 }, { t: 'hit3', e: 'sparks', at: 'weaponR', dur: 0.2 }, { t: 0.88, e: 'trail', on: false }], { strike: 0.12 });
  }
  // Icefall Breaker: the warden gathers low, rises with the hammer hauled overhead, and drives it into the ground ahead;
  // the contact is held while a rolling crack of heaved stone and ice runs out along the line
  W1('w_icefall', 1.35, 'full', [
    k(0, GL),
    k(0.14, P(SH, { spine: [22, 0, 0], armR: [-40, 0, -20], foreR: [-60, 0, 0], handR: [30, 0, 0] }, L.deep), { root: [0, -0.32, 0] }),
    k(0.25, P(SH, { spine: [6, 0, 0], armR: [-110, 0, -18], foreR: [-40, 0, 0], handR: [30, 0, 0] }, L.stand), { root: [0, -0.04, 0] }),
    k(0.37, P(SH, overhead({ spine: [-20, 0, 0], chest: [-12, 0, 0], head: [-14, 0, 0] }), L.stand), { root: [0, 0.14, 0.04] }),
    k(0.7 / 1.35, P(SH, slamAt({ spine: [38, 0, 0], chest: [16, 0, 0], head: [16, 0, 0] }, L.deep, [-0.04, 0.14, 1.14], [0.06, -0.62, 0.78], 0.85, 0.22), L.deep), { root: [0, -0.44, 0.22], e: 'snap' }),
    k(0.68, P(SH, slamAt({ spine: [36, 0, 0], chest: [14, 0, 0], head: [14, 0, 0] }, L.deep, [-0.04, 0.16, 1.12], [0.06, -0.58, 0.81], 0.85, 0.22), L.deep), { root: [0, -0.42, 0.22] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.12, e: 'dust' }, { t: 0.3, e: 'trail', on: true, color: '#d8ecff', w: 1.5, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'earth', at: 'front1', shake: 0.9, stop: 0.12 }, { t: 'hit', e: 'decal', kind: 'crack', r: 2.4, at: 'front1' },
    { t: 'hit', e: 'wave', kind: 'rock', len: 16 }, { t: 'hit', e: 'cloud', kind: 'chill', r: 3, cone: true }, { t: 0.7, e: 'trail', on: false }], { strike: 0.22 });
  // ---- level 52 and 55 (the Windward Heights) ----
  // Counterweight Sweep: the hammer let hang back low behind the right hip on a wide stance, then swung flat and low
  // through everything in front like a lift's counterweight (contact on the hit, an even speed) and carried round left
  const LWW = P(L.wide, { thighL: [-20, 0, 20], shinL: [40] });
  W1('w_counterweight', 1.05, 'full', [
    k(0, GL),
    k(0.1, mixPose(GL, P(SH, arc(-110, { lead: -30, dy: -0.32, r: 0.38, bend: 16 }), LWW), 0.5), { root: [0, -0.1, 0] }),
    k(0.22, P(SH, arc(-112, { lead: -32, dy: -0.34, r: 0.38, bend: 18 }), LWW), { root: [0, -0.2, -0.02] }),
    ...swing(1.05, 0.48, { wind: -120, mid: -62, hit: 5, follow: 66, end: 84 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -32 : role === 'mid' ? -14 : role === 'hit' ? 0 : 22, dy: -0.36, bend: 20, tilt: -6 }), role === 'wind' ? LWW : L.lungeL), { root: role === 'wind' ? [0, -0.22, -0.02] : [0, -0.28, 0.22], e }], 1000),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.2, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 0.3, e: 'sound', s: 'swing' }, { t: 'hit', e: 'impact', kind: 'blunt', at: 'cone', r: 5, shake: 0.55, stop: 0.09 }, { t: 'hit', e: 'dust' }, { t: 'hit', e: 'cloud', kind: 'chill', r: 3, cone: true }, { t: 0.72, e: 'trail', on: false }], { strike: 0.2 });
  // Brake Block: the tower shield drawn in on a back step and jammed hard into the machine (held, the brake set), then,
  // with the shield still pressed in, the hammer hauled up over the right shoulder and dropped onto the top of the
  // jammed machine; the second contact is held like a forge blow
  {
    const JAM = { armL: [-88, 16, 4], foreL: [-26, -20, 0] };
    W1('w_brakeblock', 1.5, 'full', [
      k(0, GL),
      k(0.1, P(G, { spine: [-2, -30, 0], armL: [-52, 68, 38], foreL: [-104, 0, 0] }, L.stepBack), { root: [0, -0.08, -0.1] }),
      k(0.32 / 1.5, P(G, { spine: [26, 26, 0], head: [10, -16, 0] }, JAM, L.lungeL), { root: [0, -0.14, 0.34], e: 'snap' }),
      k(0.29, P(G, { spine: [26, 26, 0], head: [10, -16, 0] }, JAM, L.lungeL), { root: [0, -0.14, 0.36] }),
      k(0.4, P(G, { spine: [14, 12, 0], armR: [-60, 0, -20], foreR: [-50, 0, 0], handR: [20, 0, 0], head: [6, -8, 0] }, JAM, L.lungeL), { root: [0, -0.1, 0.36] }),
      k(0.5, P(overhead({ spine: [-18, 0, 0], chest: [-10, 0, 0], head: [-14, 0, 0] }), JAM, L.stand), { root: [0, 0.02, 0.36] }),
      k(0.92 / 1.5, P(slamAt({ spine: [24, 0, 0], chest: [10, 0, 0], head: [12, 0, 0] }, L.lungeL, [-0.04, 0.62, 1.18], [0.06, -0.56, 0.83], 0.85, 0.24), JAM, L.lungeL), { root: [0, -0.16, 0.36], e: 'snap' }),
      k(0.7, P(slamAt({ spine: [23, 0, 0], chest: [10, 0, 0], head: [12, 0, 0] }, L.lungeL, [-0.04, 0.6, 1.16], [0.06, -0.54, 0.84], 0.85, 0.24), JAM, L.lungeL), { root: [0, -0.16, 0.36] }),
      k(0.84, P(G, { spine: [18, 0, 0], chest: [6, 0, 0], armR: [-40, 0, -20], foreR: [-60, 0, 0], handR: [30, 0, 0], head: [8, 0, 0] }, L.stepL), { root: [0, -0.14, 0.18] }),
      k(1, GL, { root: R.guard, e: 'smooth' }),
    ], [{ t: 'hit', e: 'impact', kind: 'shield', shake: 0.6, stop: 0.1 }, { t: 'hit', e: 'dust' }, { t: 0.42, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 0.5, e: 'sound', s: 'swing' },
      { t: 'hit2', e: 'impact', kind: 'blunt', shake: 0.9, stop: 0.13 }, { t: 'hit2', e: 'sparks', at: 'weaponR', dur: 0.3 }, { t: 'hit2', e: 'dust' }, { t: 0.76, e: 'trail', on: false }], { strike: 0.2 });
  }
  // ---- level 57 and 60 (Tidewater Sound) ----
  // Spud Drop: the hammer hauled straight up overhead with the body rising onto the toes, then driven straight down
  // into the ground before the feet like the spud post of a dredge; the contact is held, deep in the crouch, in a
  // splash of wet silt
  W1('w_spud', 1.15, 'full', [
    k(0, GL),
    k(0.14, P(SH, { spine: [24, 0, 0], armR: [-40, 0, -20], foreR: [-60, 0, 0], handR: [30, 0, 0] }, L.deep), { root: [0, -0.3, 0] }),
    k(0.24, P(SH, { spine: [6, 0, 0], armR: [-110, 0, -18], foreR: [-40, 0, 0], handR: [30, 0, 0] }, L.stand), { root: [0, 0.02, 0] }),
    k(0.34, P(SH, overhead({ spine: [-22, 0, 0], chest: [-12, 0, 0], head: [-16, 0, 0] }), L.stand), { root: [0, 0.14, 0.02] }),
    k(0.42, P(SH, overhead({ spine: [-24, 0, 0], chest: [-14, 0, 0], head: [-18, 0, 0] }), L.stand), { root: [0, 0.16, 0.02] }),
    k(0.6 / 1.15, P(SH, slamAt({ spine: [40, 0, 0], chest: [16, 0, 0], head: [16, 0, 0] }, L.deep, [-0.04, 0.12, 0.96], [0.04, -0.86, 0.5], 0.85, 0.1), L.deep), { root: [0, -0.44, 0.1], e: 'snap' }),
    k(0.66, P(SH, slamAt({ spine: [38, 0, 0], chest: [14, 0, 0], head: [14, 0, 0] }, L.deep, [-0.04, 0.14, 0.96], [0.04, -0.84, 0.54], 0.85, 0.1), L.deep), { root: [0, -0.42, 0.1] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.1, e: 'dust' }, { t: 0.3, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 0.38, e: 'sound', s: 'swing' }, { t: 'hit', e: 'impact', kind: 'blunt', at: 'front1', shake: 0.7, stop: 0.11 }, { t: 'hit', e: 'impact', kind: 'silt', at: 'front1', r: 2 }, { t: 0.72, e: 'trail', on: false }], { strike: 0.2 });
  // Breakwater (capstone): the tower shield drawn in on a back step and heaved forward into the machines on a long
  // lunge (held, like a breakwater taking the wave), then, the shield still pressed in, the hammer swung up over the
  // right shoulder and brought down flat behind its rim; the second contact is held
  {
    const HEAVE = { armL: [-96, 14, 4], foreL: [-22, -18, 0] };
    const LL = P(L.lungeL, { thighL: [-70, 0, 6], shinL: [66] });
    W1('w_breakwater', 1.5, 'full', [
      k(0, GL),
      k(0.1, P(G, { spine: [-4, -30, 0], armL: [-50, 70, 40], foreL: [-104, 0, 0] }, L.stepBack), { root: [0, -0.1, -0.12] }),
      k(0.34 / 1.5, P(G, { spine: [22, 22, 0], head: [6, -14, 0] }, HEAVE, LL), { root: [0, -0.18, 0.42], e: 'snap' }),
      k(0.3, P(G, { spine: [20, 22, 0], head: [6, -14, 0] }, HEAVE, LL), { root: [0, -0.18, 0.44] }),
      k(0.4, P(G, { spine: [12, 10, 0], armR: [-60, 0, -20], foreR: [-50, 0, 0], handR: [20, 0, 0], head: [4, -8, 0] }, HEAVE, L.lungeL), { root: [0, -0.12, 0.44] }),
      k(0.5, P(overhead({ spine: [-16, 0, 0], chest: [-10, 0, 0], head: [-12, 0, 0] }), HEAVE, L.stand), { root: [0, 0.02, 0.44] }),
      k(0.89 / 1.5, P(slamAt({ spine: [26, 0, 0], chest: [10, 0, 0], head: [12, 0, 0] }, L.lungeL, [-0.04, 0.5, 1.2], [0.06, -0.5, 0.86], 0.85, 0.3), HEAVE, L.lungeL), { root: [0, -0.18, 0.44], e: 'snap' }),
      k(0.68, P(slamAt({ spine: [25, 0, 0], chest: [10, 0, 0], head: [12, 0, 0] }, L.lungeL, [-0.04, 0.48, 1.18], [0.06, -0.48, 0.87], 0.85, 0.3), HEAVE, L.lungeL), { root: [0, -0.18, 0.44] }),
      k(0.84, P(G, { spine: [18, 0, 0], chest: [6, 0, 0], armR: [-40, 0, -20], foreR: [-60, 0, 0], handR: [30, 0, 0], head: [8, 0, 0] }, L.stepL), { root: [0, -0.14, 0.2] }),
      k(1, GL, { root: R.guard, e: 'smooth' }),
    ], [{ t: 'hit', e: 'impact', kind: 'shield', at: 'cone', r: 6, shake: 0.6, stop: 0.1 }, { t: 'hit', e: 'cloud', kind: 'seaspray', r: 4, cone: true }, { t: 'hit', e: 'dust' }, { t: 0.42, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 0.5, e: 'sound', s: 'swing' },
      { t: 'hit2', e: 'impact', kind: 'blunt', at: 'cone', r: 6, shake: 0.85, stop: 0.12 }, { t: 'hit2', e: 'impact', kind: 'seaspray', at: 'cone', r: 6 }, { t: 0.78, e: 'trail', on: false }], { strike: 0.2 });
  }
  // ---- level 62 and 65 (the Rainward Gorge) ----
  // Pile Hammer: the hammer hauled up two-handed high over the head with the body rising onto the toes and held a
  // beat at the top like a pile driver's weight, then dropped straight down onto the machine; the contact is held,
  // deep in the crouch, in a spray of timber splinters and mud (no swing trail: the overhead arc read as a ring round him)
  W1('w_pilehammer', 1.15, 'full', [
    k(0, GL),
    k(0.12, P(SH, { spine: [22, 0, 0], armR: [-40, 0, -20], foreR: [-60, 0, 0], handR: [30, 0, 0] }, L.deep), { root: [0, -0.26, 0] }),
    k(0.24, P(SH, overhead({ spine: [-18, 0, 0], chest: [-10, 0, 0], head: [-14, 0, 0] }), L.stand), { root: [0, 0.12, 0] }),
    k(0.42, P(SH, overhead({ spine: [-26, 0, 0], chest: [-16, 0, 0], head: [-20, 0, 0] }), L.stand), { root: [0, 0.18, 0.02] }),
    k(0.6 / 1.15, P(SH, slamAt({ spine: [36, 0, 0], chest: [14, 0, 0], head: [14, 0, 0] }, L.deep, [-0.04, 0.3, 1.0], [0.04, -0.8, 0.6], 0.85, 0.16), L.deep), { root: [0, -0.4, 0.12], e: 'snap' }),
    k(0.68, P(SH, slamAt({ spine: [35, 0, 0], chest: [13, 0, 0], head: [13, 0, 0] }, L.deep, [-0.04, 0.32, 1.0], [0.04, -0.78, 0.62], 0.85, 0.16), L.deep), { root: [0, -0.38, 0.12] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.08, e: 'dust' }, { t: 0.4, e: 'sound', s: 'swing' }, { t: 'hit', e: 'impact', kind: 'blunt', shake: 0.75, stop: 0.12 }, { t: 'hit', e: 'impact', kind: 'splinters', at: 'front1' }], { strike: 0.2 });
  // Crib Wall (capstone): the tower shield drawn in on a back step and driven forward and down into the machines on a
  // long low lunge, set square like the face of a crib wall (held), then, the shield still set, the hammer swung up
  // over the right shoulder and brought down behind its rim like the next log dropped on the crib; held
  {
    const SET = { armL: [-84, 14, 4], foreL: [-30, -18, 0] };
    const LL = P(L.lungeL, { thighL: [-74, 0, 6], shinL: [74] });
    W1('w_cribwall', 1.5, 'full', [
      k(0, GL),
      k(0.1, P(G, { spine: [-4, -28, 0], armL: [-50, 70, 40], foreL: [-104, 0, 0] }, L.stepBack), { root: [0, -0.1, -0.12] }),
      k(0.34 / 1.5, P(G, { spine: [28, 18, 0], head: [10, -12, 0] }, SET, LL), { root: [0, -0.26, 0.4], e: 'snap' }),
      k(0.3, P(G, { spine: [26, 18, 0], head: [10, -12, 0] }, SET, LL), { root: [0, -0.26, 0.42] }),
      k(0.4, P(G, { spine: [14, 8, 0], armR: [-60, 0, -20], foreR: [-50, 0, 0], handR: [20, 0, 0], head: [4, -8, 0] }, SET, L.lungeL), { root: [0, -0.16, 0.42] }),
      k(0.5, P(overhead({ spine: [-14, 0, 0], chest: [-8, 0, 0], head: [-10, 0, 0] }), SET, L.stand), { root: [0, 0.0, 0.42] }),
      k(0.89 / 1.5, P(slamAt({ spine: [30, 0, 0], chest: [12, 0, 0], head: [12, 0, 0] }, L.lungeL, [-0.04, 0.44, 1.2], [0.06, -0.56, 0.82], 0.85, 0.28), SET, LL), { root: [0, -0.24, 0.42], e: 'snap' }),
      k(0.68, P(slamAt({ spine: [29, 0, 0], chest: [12, 0, 0], head: [12, 0, 0] }, L.lungeL, [-0.04, 0.42, 1.18], [0.06, -0.54, 0.83], 0.85, 0.28), SET, LL), { root: [0, -0.24, 0.42] }),
      k(0.84, P(G, { spine: [18, 0, 0], chest: [6, 0, 0], armR: [-40, 0, -20], foreR: [-60, 0, 0], handR: [30, 0, 0], head: [8, 0, 0] }, L.stepL), { root: [0, -0.14, 0.2] }),
      k(1, GL, { root: R.guard, e: 'smooth' }),
    ], [{ t: 'hit', e: 'impact', kind: 'shield', at: 'cone', r: 6, shake: 0.6, stop: 0.1 }, { t: 'hit', e: 'cloud', kind: 'mud', r: 4, cone: true }, { t: 'hit', e: 'dust' }, { t: 0.5, e: 'sound', s: 'swing' },
      { t: 'hit2', e: 'impact', kind: 'blunt', at: 'cone', r: 6, shake: 0.85, stop: 0.12 }, { t: 'hit2', e: 'impact', kind: 'splinters', at: 'cone', r: 6 }], { strike: 0.2 });
  }
}

// ============================== HERBALIST =================================
{
  const G = P(guard('herbalist'), { spine: [6, 0, 0] });
  const GL = P(G, LG);
  const STAFF = { armR: [-28, 0, -10], foreR: [-70, 0, 0], handR: [10, 0, 0] };
  const toss = (relT, item, impact, extra = {}) => ({
    keys: [
      k(0, GL),
      k(relT * 0.6, P(STAFF, { spine: [-4, 30, 0], armL: [-40, -10, 30], foreL: [-60, 0, 0], handL: [20, 0, 0] }, L.stepBack), { root: [0, -0.04, -0.06] }),
      k(relT, P(STAFF, { spine: [16, -20, 0], armL: [-120, 10, 10], foreL: [-10, 0, 0], handL: [-10, 0, 0] }, L.stepL), { root: [0, -0.08, 0.14], e: 'snap' }),
      k(1, GL, { root: R.guard }),
    ],
  });
  const H1 = (id, dur, keys, ev, o) => (DEF[id] = C('herbalist', dur, 'full', keys, ev, o));
  H1('h_salve', 1.6, [
    k(0, GL),
    k(0.2, P(STAFF, { spine: [14, 0, 0], head: [24, 0, 0], armL: [-60, 20, 10], foreL: [-100, 0, 0], handL: [-20, 0, 0] })),
    // kneading the salve: hunched over it, working closer and harder toward the toss
    k(0.6, P(STAFF, { spine: [20, 12, 0], chest: [6, 4, 0], head: [28, -6, 0], armL: [-74, 28, 18], foreL: [-122, 0, 0], handL: [16, 0, 0] }), { root: [0, -0.04, 0] }),
    k(0.78, P(STAFF, { spine: [-4, 30, 0], armL: [-40, -10, 30], foreL: [-60, 0, 0], handL: [20, 0, 0] }, L.stepBack)),
    k(0.88, P(STAFF, { spine: [16, -20, 0], armL: [-120, 10, 10], foreL: [-10, 0, 0] }, L.stepL), { root: [0, -0.08, 0.14], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.12, e: 'holdItem', side: 'L', item: 'salve', on: true }, { t: 0.2, e: 'motes', color: '#9aff7a', n: 20, at: 'handL', dur: 1.0 }, { t: 0.88, e: 'holdItem', side: 'L', item: 'salve', on: false }, { t: 0.88, e: 'proj', kind: 'salve', from: 'L', arc: 0.5, impact: 'heal' }],
    { channel: { from: 0.2, to: 0.74, hz: 2.4, bones: { armL: [5, 0, 3], foreL: [-9], handL: [14, 0, 0], spine: [2, 3, 0], head: [3, 0, 0] } } });
  // Staff Sweep: staff trailed low behind the right side, swept wide and low across the front, round to the left
  const HL = { armL: [-60, 0, 40], foreL: [-80, 0, 0] };
  H1('h_sweep', 0.8, [
    k(0, GL),
    // a level arc round the right shoulder (staff carried low and flat, never swung down through vertical under the
    // hand), contact early in the sweep and the rest carried through after it
    ...swing(0.8, 0.3, { wind: -100, mid: -45, hit: 10, follow: 70, end: 88 }, (a, role, e) => [P(HL, arc(a, { lead: role === 'wind' ? -30 : role === 'mid' ? -12 : role === 'hit' ? 0 : 22, dy: -0.26, tilt: -10, bend: 14 }), role === 'wind' ? L.wide : L.lungeL), { root: role === 'wind' ? [0, -0.14, 0] : [0, -0.16, 0.16], e }], 1100, 0.16),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.16, e: 'trail', on: true, color: '#c8ff9a', along: 1.0 }, { t: 'hit', e: 'impact', kind: 'blunt', shake: 0.2 }, { t: 0.66, e: 'trail', on: false }, { t: 0.38, e: 'motes', color: '#b8ff8a', n: 8, at: 'weaponR' }]);
  H1('h_dart', 0.85, [
    k(0, GL),
    k(0.3, P(STAFF, { spine: [4, 20, 0], head: [10, -10, 0], armL: [-120, 40, 10], foreL: [-130, 0, 0], handL: [-60, 0, 0] })),
    k(0.4, P(STAFF, { spine: [10, 16, 0], head: [16, -10, 0], armL: [-124, 40, 10], foreL: [-134, 0, 0], handL: [-62, 0, 0], chest: [-10, 0, 0] }), { e: 'snap' }),
    k(1, GL),
  ], [{ t: 0.15, e: 'holdItem', side: 'L', item: 'blowgun', on: true }, { t: 0.41, e: 'proj', kind: 'dart', from: 'head' }, { t: 0.8, e: 'holdItem', side: 'L', item: 'blowgun', on: false }]);
  { const t = toss(0.62); H1('h_poultice', 0.75, t.keys, [{ t: 0.1, e: 'holdItem', side: 'L', item: 'poultice', on: true }, { t: 0.62, e: 'holdItem', side: 'L', item: 'poultice', on: false }, { t: 0.62, e: 'proj', kind: 'salve', item: 'poultice', from: 'L', arc: 0.5, impact: 'hot' }]); }
  H1('h_net', 1.0, [
    k(0, GL),
    k(0.3, P(STAFF, { spine: [-8, 50, 0], armL: [-100, -40, 80], foreL: [-30, 0, 0] }, L.stepBack), { root: [0, -0.06, -0.08] }),
    k(0.5, P(STAFF, { spine: [20, -40, 0], armL: [-100, 40, 20], foreL: [-6, 0, 0] }, L.lungeL), { root: [0, -0.12, 0.2], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.1, e: 'holdItem', side: 'L', item: 'net', on: true }, { t: 0.5, e: 'holdItem', side: 'L', item: 'net', on: false }, { t: 0.5, e: 'proj', kind: 'net', from: 'L', arc: 0.4, impact: 'net' }]);
  H1('h_smoke', 1.1, [
    k(0, GL),
    k(0.25, P(STAFF, { spine: [10, 0, 0], armL: [-60, 0, 20], foreL: [-90, 0, 0], handL: [-40, 0, 0] })),
    k(0.45, P(STAFF, { spine: [4, 30, 0], armL: [-90, 30, 50], foreL: [-60, 0, 0] }), { e: 'inOut' }),
    k(0.65, P(STAFF, { spine: [4, -30, 0], armL: [-90, -30, 10], foreL: [-60, 0, 0] })),
    k(1, GL),
  ], [{ t: 0.15, e: 'holdItem', side: 'L', item: 'herbBundle', on: true }, { t: 0.2, e: 'trailSmoke', side: 'L', dur: 0.8 }, { t: 0.5, e: 'cloud', kind: 'herb', r: 7, at: 'self' }, { t: 0.9, e: 'holdItem', side: 'L', item: 'herbBundle', on: false }]);
  H1('h_tonic', 2.3, [
    k(0, GL),
    k(0.12, P(STAFF, { spine: [14, 0, 0], head: [26, 0, 0], armL: [-56, 20, 10], foreL: [-110, 0, 0] })),
    ...[0.25, 0.37, 0.49, 0.61, 0.73].map((t, i) => k(t, P(STAFF, { spine: [14, 0, 0], head: [26, 0, 0], armL: [-60, 20 + (i % 2) * 20, 10], foreL: [-110 + (i % 2) * 20, 0, 0], handL: [(i % 2) * 40 - 20, 0, 0] }))),
    k(0.82, P(STAFF, { spine: [-4, 30, 0], armL: [-40, -10, 30], foreL: [-60, 0, 0] }, L.stepBack)),
    k(0.9, P(STAFF, { spine: [16, -20, 0], armL: [-120, 10, 10], foreL: [-10, 0, 0] }, L.stepL), { root: [0, -0.08, 0.14], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.1, e: 'holdItem', side: 'L', item: 'tonic', on: true }, { t: 0.25, e: 'motes', color: '#7affb0', n: 40, at: 'handL', dur: 1.4 }, { t: 0.89, e: 'holdItem', side: 'L', item: 'tonic', on: false }, { t: 0.89, e: 'proj', kind: 'salve', item: 'tonic', from: 'L', arc: 0.4, impact: 'bigheal' }]);
  // Staff Flurry: three straight jabs, the staff levelled at the target and driven out from a chamber by the right
  // hip, the lantern head landing on each hit (the server's hits are 0.18 s apart from 0.18 s). Each chamber is
  // 0.085 s before its contact. The old clip flicked the upright staff over the shoulder between jabs (70+ m/s at
  // the head, and pointing behind the body at the first two hits).
  const FJ = (sp, at, dir, pole) => P(wield({ spine: [sp[0], sp[1], 0], chest: [sp[0] * 0.3, sp[1] * 0.5, 0], head: [sp[0] * 0.2, -sp[1] * 0.8, 0] }, at, dir, pole), { armL: [-60, 0, 20], foreL: [-80, 0, 0] });
  const FH = [0, 1, 2].map((i) => (0.18 + i * 0.18) / 0.85);
  const FJAB = [
    { at: [-0.12, 1.24, 0.56], dir: [0.06, 0.04, 1] },
    { at: [-0.1, 1.32, 0.56], dir: [0.08, 0.12, 1] },
    { at: [-0.1, 1.18, 0.62], dir: [0.06, -0.02, 1], sp: [22, 22], root: [0, -0.12, 0.24] },
  ];
  H1('h_flurry', 0.85, [
    k(0, GL),
    ...FJAB.flatMap((j, i) => [
      k(FH[i] - 0.085 / 0.85, P(FJ([4, -20], [-0.3, 1.1, 0.04], [0.14, 0.32, 0.94], [-0.75, 0.8, -0.2]), L.stepBack), { root: [0, -0.05, i ? 0.08 : -0.02] }),
      k(FH[i], P(FJ(j.sp || [16, 18], j.at, j.dir, [-0.6, 0.9, 0.1]), L.lungeL), { root: j.root || [0, -0.1, 0.18], e: 'snap' }),
    ]),
    k(0.84, P(FJ([12, 14], [-0.2, 1.18, 0.44], [0.08, 0.2, 1], [-0.65, 0.9, 0]), L.lungeL), { root: [0, -0.08, 0.14] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 'hit', e: 'impact', kind: 'blunt' }, { t: 'hit2', e: 'impact', kind: 'blunt' }, { t: 'hit3', e: 'impact', kind: 'blunt', shake: 0.25 }], { strike: 0.08 });
  H1('h_sneeze', 0.95, [
    k(0, GL),
    k(0.3, P(STAFF, { spine: [10, 0, 0], head: [16, 0, 0], armL: [-110, 30, 0], foreL: [-120, 0, 0], handL: [-20, 0, 0] })),
    k(0.42, P(STAFF, { spine: [20, 0, 0], chest: [-10, 0, 0], head: [-6, 0, 0], armL: [-96, 0, 0], foreL: [-20, 0, 0], handL: [20, 0, 0] }, L.stepL), { root: [0, -0.06, 0.1], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.42, e: 'cloud', kind: 'powder', r: 7, cone: true }]);
  H1('h_revive', 1.75, [
    k(0, GL),
    k(0.25, P({ spine: [10, 0, 0], armR: [-100, 0, -10], foreR: [-20, 0, 0], handR: [-60, 0, 0], armL: [-100, 0, 10], foreL: [-20, 0, 0], handL: [0, 0, 0] }, L.wide), { root: [0, -0.1, 0] }),
    k(0.5, P({ spine: [24, 0, 0], head: [30, 0, 0], armR: [-70, 0, -10], foreR: [-10, 0, 0], handR: [-20, 0, 0], armL: [-70, 0, 10], foreL: [-10, 0, 0] }, L.kneel), { root: R.kneel, e: 'snap' }),
    k(0.85, P({ spine: [-10, 0, 0], chest: [-14, 0, 0], head: [-20, 0, 0], armL: [-150, 0, 40], foreL: [-20, 0, 0] }, L.kneel), { root: R.kneel }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.5, e: 'impact', kind: 'earth', at: 'front1', shake: 0.15 }, { t: 0.52, e: 'lanternFlare', dur: 1.2 }, { t: 0.6, e: 'cloud', kind: 'herb', r: 10, at: 'self' }, { t: 0.88, e: 'ring', color: '#b8ff9a', r: 14 }]);
  H1('h_bandage', 2.2, [
    k(0, GL),
    k(0.15, P(STAFF, { spine: [24, 0, 0], head: [30, 20, 0], armL: [-50, 40, -10], foreL: [-120, 0, 0], handL: [0, 0, 0] }, L.kneel), { root: R.kneel }),
    ...[0.3, 0.45, 0.6, 0.75].map((t, i) => k(t, P(STAFF, { spine: [24, 0, 0], head: [30, 20, 0], armL: [-50 + (i % 2) * 20, 40, -10 - (i % 2) * 20], foreL: [-120 + (i % 2) * 30, 0, 0], handL: [(i % 2) * 40, 0, 0] }, L.kneel), { root: R.kneel })),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.15, e: 'holdItem', side: 'L', item: 'bandage', on: true }, { t: 0.3, e: 'motes', color: '#e0ffd0', n: 30, dur: 1.4 }, { t: 0.9, e: 'holdItem', side: 'L', item: 'bandage', on: false }]);
  { const t = toss(0.55); H1('h_antidote', 0.75, t.keys, [{ t: 0.1, e: 'holdItem', side: 'L', item: 'flaskAntidote', on: true }, { t: 0.55, e: 'holdItem', side: 'L', item: 'flaskAntidote', on: false }, { t: 0.55, e: 'proj', kind: 'flask', item: 'flaskAntidote', from: 'L', arc: 0.4, impact: 'cleanse', spin: 10 }]); }
  H1('h_seed', 1.0, [
    k(0, GL),
    k(0.4, P(STAFF, { spine: [-8, 46, 0], armL: [-160, 30, 50], foreL: [-90, 0, 0] }, L.stepBack), { root: [0, -0.04, -0.1] }),
    k(0.6, P(STAFF, { spine: [24, -30, 0], armL: [-110, -10, 10], foreL: [-6, 0, 0] }, L.lungeL), { root: [0, -0.14, 0.2], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.12, e: 'holdItem', side: 'L', item: 'seedpod', on: true }, { t: 0.6, e: 'holdItem', side: 'L', item: 'seedpod', on: false }, { t: 0.6, e: 'proj', kind: 'flask', item: 'seedpod', from: 'L', arc: 0.9, impact: 'seed', ground: true, spin: 8 }]);
  { const t = toss(0.6); H1('h_bark', 0.75, t.keys, [{ t: 0.1, e: 'holdItem', side: 'L', item: 'barkpaste', on: true }, { t: 0.6, e: 'holdItem', side: 'L', item: 'barkpaste', on: false }, { t: 0.6, e: 'proj', kind: 'salve', item: 'barkpaste', from: 'L', arc: 0.4, impact: 'bark' }]); }
  H1('h_lantern', 0.95, [
    k(0, GL),
    k(0.28, P({ spine: [16, -30, 0], armR: [-10, -20, -40], foreR: [-40, 0, 0], handR: [60, 0, 0], armL: [-40, 0, 30], foreL: [-60, 0, 0] }, L.deep), { root: [0, -0.3, 0] }),
    // the lantern lifts up the front: a midway key keeps every step under 110 degrees so the arm never wraps round behind
    k(0.38, P({ spine: [0, -4, 0], armR: [-90, -10, -30], foreR: [-30, 0, 0], handR: [70, 0, 0], armL: [-40, 0, 30], foreL: [-60, 0, 0] }, L.stand), { root: [0, -0.05, 0] }),
    k(0.46, P({ spine: [-16, 20, 0], chest: [-10, 0, 0], armR: [-160, 10, -10], foreR: [-10, 0, 0], handR: [100, 0, 0], head: [-20, 0, 0] }, L.stand), { root: [0, 0.1, 0], e: 'snap' }),
    k(0.7, P({ spine: [-10, 20, 0], armR: [-155, 10, -10], foreR: [-20, 0, 0], handR: [95, 0, 0] }), {}),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.47, e: 'flash', color: '#c8ff8a', big: true, at: 'weaponTip' }, { t: 0.47, e: 'lanternFlare', dur: 0.6 }, { t: 0.47, e: 'ring', color: '#d8ffa0', r: 6 }]);
  H1('h_brew', 1.2, [
    k(0, GL),
    k(0.25, P(STAFF, { spine: [-4, 0, 0], armL: [-120, 40, 10], foreL: [-130, 0, 0], handL: [-40, 0, 0] })),
    k(0.5, P(STAFF, { spine: [-14, 0, 0], head: [-34, 0, 0], armL: [-150, 30, 10], foreL: [-140, 0, 0], handL: [-80, 0, 0] })),
    k(0.66, P(STAFF, { spine: [10, 0, 0], head: [0, 0, 0], armL: [-60, 0, 30], foreL: [-30, 0, 0] }), { e: 'snap' }),
    k(1, GL),
  ], [{ t: 0.1, e: 'holdItem', side: 'L', item: 'tonic', on: true }, { t: 0.62, e: 'holdItem', side: 'L', item: 'tonic', on: false }, { t: 0.67, e: 'cloud', kind: 'mist', r: 10, at: 'self' }, { t: 0.7, e: 'ring', color: '#9affc0', r: 14 }]);
  H1('h_swift', 0.9, [
    k(0, GL),
    k(0.3, P(STAFF, { spine: [-6, 0, 0], armL: [-130, 30, 10], foreL: [-130, 0, 0], handL: [-60, 0, 0], head: [-20, 0, 0] })),
    k(0.55, P(STAFF, { spine: [6, 0, 0], armL: [-90, 0, 50], foreL: [-30, 0, 0], handL: [0, 0, 0] }), { e: 'snap' }),
    k(1, GL),
  ], [{ t: 0.1, e: 'holdItem', side: 'L', item: 'cup', on: true }, { t: 0.55, e: 'holdItem', side: 'L', item: 'cup', on: false }, { t: 0.55, e: 'ring', color: '#e0ff9a', r: 14 }, { t: 0.55, e: 'aura', color: '#e0ff9a', dur: 1.5 }]);
  H1('h_uproot', 1.0, [
    k(0, GL),
    // staff raised in both hands, then driven down so the lantern end strikes the ground ahead (back straight, not folded over)
    k(0.32, P(overhead({ spine: [-16, 0, 0], chest: [-8, 0, 0], head: [-14, 0, 0] }, true), L.stand), { root: [0, 0.08, 0] }),
    k(0.5, P(slamAt({ spine: [26, 0, 0], chest: [12, 0, 0], head: [10, 0, 0] }, L.lungeL, [0.0, 0.14, 1.45], [0.04, -0.5, 0.86], 1.2, 0.3, null, true), L.lungeL), { root: [0, -0.3, 0.3], e: 'snap' }),
    k(0.7, P(slamAt({ spine: [24, 0, 0], chest: [10, 0, 0], head: [10, 0, 0] }, L.lungeL, [0.0, 0.16, 1.42], [0.04, -0.46, 0.88], 1.2, 0.3, null, true), L.lungeL), { root: [0, -0.3, 0.3] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.3, e: 'trail', on: true, color: '#c8ff9a', w: 1.2, along: 1.0 }, { t: 'hit', e: 'impact', kind: 'earth', at: 'front1', shake: 0.5, stop: 0.07 }, { t: 'hit', e: 'motes', color: '#8acc4a', n: 18, at: 'front1' }, { t: 0.72, e: 'trail', on: false }]);
  { const t = toss(0.6); H1('h_sap', 0.75, t.keys, [{ t: 0.1, e: 'holdItem', side: 'L', item: 'sap', on: true }, { t: 0.6, e: 'holdItem', side: 'L', item: 'sap', on: false }, { t: 0.6, e: 'proj', kind: 'salve', item: 'sap', from: 'L', arc: 0.4, impact: 'sap' }]); }
  H1('h_remedy', 1.55, [
    k(0, GL),
    k(0.25, P({ spine: [30, 0, 0], head: [30, 0, 0], armR: [-60, 0, -10], foreR: [-20, 0, 0], handR: [80, 0, 0], armL: [-60, 0, 10], foreL: [-60, 0, 0] }, L.kneel), { root: R.kneel }),
    k(0.6, P({ spine: [-20, 0, 0], chest: [-16, 0, 0], head: [-30, 0, 0], armR: [-170, 0, -20], foreR: [-10, 0, 0], handR: [-10, 0, 0], armL: [-160, 0, 40], foreL: [-20, 0, 0] }, L.wide), { root: [0, -0.04, 0], e: 'snap' }),
    k(0.85, P({ spine: [-18, 0, 0], chest: [-14, 0, 0], head: [-28, 0, 0], armR: [-168, 0, -20], armL: [-158, 0, 40] }, L.wide), {}),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.3, e: 'motes', color: '#d0ff9a', n: 40, dur: 1 }, { t: 0.62, e: 'lanternFlare', dur: 1.2 }, { t: 0.62, e: 'petals', r: 14, n: 140 }, { t: 0.62, e: 'ring', color: '#c8ffb0', r: 18 }, { t: 0.62, e: 'flash', color: '#e8ffd0' }]);

  // ---- level 42 and 45 (the Cinder Reach) ----
  { const t = toss(0.6); H1('h_tincture', 0.75, t.keys, [{ t: 0.08, e: 'holdItem', side: 'L', item: 'tonic', on: true }, { t: 0.2, e: 'motes', color: '#9aff7a', n: 10, at: 'handL', dur: 0.4 }, { t: 0.6, e: 'holdItem', side: 'L', item: 'tonic', on: false }, { t: 0.6, e: 'proj', kind: 'salve', item: 'tonic', from: 'L', arc: 0.4, impact: 'heal' }]); }
  // Camphor Mist: the jar is held against the hot lantern head while it warms (the cast), then staff and jar are
  // raised overhead together and the vapour bursts out over the party
  H1('h_camphor', 1.5, [
    k(0, GL),
    k(0.16, P({ spine: [14, 10, 0], head: [20, -8, 0], armR: [-64, -10, -14], foreR: [-50, 0, 0], handR: [40, 0, 0], armL: [-66, 30, 10], foreL: [-90, 0, 0], handL: [-20, 0, 0] }, L.wide), { root: [0, -0.12, 0] }),
    k(0.52, P({ spine: [18, 12, 0], head: [24, -8, 0], armR: [-68, -12, -14], foreR: [-54, 0, 0], handR: [44, 0, 0], armL: [-70, 34, 8], foreL: [-96, 0, 0], handL: [-10, 0, 0] }, L.wide), { root: [0, -0.14, 0] }),
    k(0.62, P(wield({ spine: [0, 4, 0], chest: [-6, 0, 0], head: [-6, 0, 0] }, [-0.34, 1.62, 0.3], [-0.08, 0.97, 0.2], [-0.75, 1.4, 0.0]), { armL: [-120, 10, 20], foreL: [-40, 0, 0] }, L.stand), { root: [0, -0.02, 0] }),
    k(1.1 / 1.5, P(wield({ spine: [-14, 0, 0], chest: [-12, 0, 0], head: [-24, 0, 0] }, [-0.3, 2.02, 0.18], [-0.06, 0.98, 0.16], [-0.8, 1.8, 0.0]), { armL: [-160, 0, 36], foreL: [-20, 0, 0] }, L.wide), { root: [0, -0.04, 0], e: 'snap' }),
    k(0.86, P(wield({ spine: [-12, 0, 0], chest: [-10, 0, 0], head: [-22, 0, 0] }, [-0.3, 1.98, 0.18], [-0.06, 0.98, 0.16], [-0.8, 1.8, 0.0]), { armL: [-156, 0, 36], foreL: [-20, 0, 0] }, L.wide), {}),
    k(0.93, P(wield({ spine: [-2, 0, 0], chest: [-4, 0, 0], head: [-8, 0, 0] }, [-0.33, 1.5, 0.24], [-0.12, 0.97, 0.1], [-0.75, 1.3, 0.0]), { armL: [-96, 10, 30], foreL: [-50, 0, 0] }, L.wide), { root: [0, -0.06, 0] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.1, e: 'holdItem', side: 'L', item: 'jar', on: true }, { t: 0.18, e: 'motes', color: '#d0ffc0', n: 30, at: 'handL', dur: 1.0 }, { t: 0.2, e: 'trailSmoke', side: 'L', dur: 0.5 }, { t: 0.74, e: 'holdItem', side: 'L', item: 'jar', on: false },
    { t: 0.74, e: 'lanternFlare', dur: 1.0 }, { t: 0.74, e: 'cloud', kind: 'mist', r: 12, at: 'self' }, { t: 0.75, e: 'ring', color: '#c8ffb0', r: 18 }, { t: 0.76, e: 'motes', color: '#e8ffd8', n: 40, dur: 1.2 }],
    { channel: { from: 0.18, to: 0.5, hz: 2.0, bones: { armL: [4, 0, 3], foreL: [-6], handL: [10, 0, 0], spine: [2, 2, 0] } } });
  // ---- level 47 and 50 (the Rime Steps) ----
  // Snowmelt Draught: the vial is warmed against the lantern a moment, then lobbed underhand, the arm swinging back
  // past the hip and forward up the front
  H1('h_snowmelt', 0.85, [
    k(0, GL),
    k(0.18, P(STAFF, { spine: [10, 6, 0], head: [18, -6, 0], armL: [-62, 22, 12], foreL: [-104, 0, 0], handL: [-20, 0, 0] })),
    k(0.42, P(STAFF, { spine: [16, -6, 0], head: [10, 4, 0], armL: [18, 0, 16], foreL: [-22, 0, 0], handL: [10, 0, 0] }, L.stepBack), { root: [0, -0.08, -0.04] }),
    k(0.5 / 0.85, P(STAFF, { spine: [6, -10, 0], head: [2, 6, 0], armL: [-72, 4, 10], foreL: [-10, 0, 0], handL: [-20, 0, 0] }, L.stepL), { root: [0, -0.06, 0.12], e: 'snap' }),
    k(0.74, P(STAFF, { spine: [2, -10, 0], armL: [-98, 6, 10], foreL: [-20, 0, 0], handL: [-20, 0, 0] }, L.stepL), { root: [0, -0.04, 0.12] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.08, e: 'holdItem', side: 'L', item: 'flaskAntidote', on: true }, { t: 0.18, e: 'motes', color: '#e8f8ff', n: 12, at: 'handL', dur: 0.4 }, { t: 0.59, e: 'holdItem', side: 'L', item: 'flaskAntidote', on: false },
    { t: 0.59, e: 'proj', kind: 'salve', item: 'flaskAntidote', from: 'L', arc: 0.5, impact: 'cleanse' }]);
  // Willowbark Steam: kneel with the staff held low so the lantern pan sits by the knee, plunge the bark bundle into it
  // and stir (the cast), then rise and lift the staff high as the steam rolls out over the party
  H1('h_willowsteam', 1.6, [
    k(0, GL),
    k(0.12, P(wield({ spine: [18, 6, 0], chest: [4, 0, 0], head: [2, -6, 0] }, [-0.32, 0.74, 0.34], [-0.1, 0.5, 0.86], [-0.7, 0.7, 0.0]), { armL: [-50, 20, 6], foreL: [-80, 0, 0], handL: [10, 0, 0] }, L.deep), { root: R.deep }),
    k(0.3, P(wield({ spine: [20, 8, 0], chest: [4, 0, 0], head: [4, -6, 0] }, [-0.32, 0.72, 0.36], [-0.1, 0.48, 0.87], [-0.7, 0.7, 0.0]), { armL: [-40, 30, -4], foreL: [-50, 0, 0], handL: [30, 0, 0] }, L.deep), { root: R.deep }),
    k(0.6, P(wield({ spine: [20, 8, 0], chest: [4, 0, 0], head: [4, -6, 0] }, [-0.32, 0.72, 0.36], [-0.1, 0.48, 0.87], [-0.7, 0.7, 0.0]), { armL: [-46, 34, -8], foreL: [-56, 0, 0], handL: [24, 0, 0] }, L.deep), { root: R.deep }),
    k(0.7, P(wield({ spine: [6, 4, 0], chest: [-4, 0, 0], head: [-4, 0, 0] }, [-0.34, 1.35, 0.42], [-0.07, 0.72, 0.69], [-0.75, 1.3, 0.0]), { armL: [-90, 10, 20], foreL: [-50, 0, 0] }, L.stand), { root: [0, -0.06, 0] }),
    k(1.3 / 1.6, P(wield({ spine: [6, 0, 0], chest: [0, 0, 0], head: [0, 0, 0] }, [-0.3, 1.55, 0.62], [-0.05, 0.55, 0.83], [-0.8, 1.8, 0.0]), { armL: [-100, 0, 30], foreL: [-40, 0, 0] }, L.wide), { root: [0, -0.04, 0], e: 'snap' }),
    k(0.9, P(wield({ spine: [5, 0, 0], chest: [0, 0, 0], head: [0, 0, 0] }, [-0.3, 1.52, 0.6], [-0.05, 0.55, 0.83], [-0.8, 1.8, 0.0]), { armL: [-96, 0, 30], foreL: [-40, 0, 0] }, L.wide), {}),
    k(0.95, P(wield({ spine: [-2, 0, 0], chest: [-4, 0, 0], head: [-8, 0, 0] }, [-0.33, 1.5, 0.24], [-0.12, 0.97, 0.1], [-0.75, 1.3, 0.0]), { armL: [-90, 10, 30], foreL: [-50, 0, 0] }, L.wide), { root: [0, -0.06, 0] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.06, e: 'holdItem', side: 'L', item: 'herbBundle', on: true }, { t: 0.2, e: 'trailSmoke', side: 'L', dur: 0.7 }, { t: 0.22, e: 'motes', color: '#f0f8ff', n: 30, at: 'handL', dur: 1.0 }, { t: 0.66, e: 'holdItem', side: 'L', item: 'herbBundle', on: false },
    { t: 0.81, e: 'lanternFlare', dur: 1.0 }, { t: 0.81, e: 'cloud', kind: 'mist', r: 12, at: 'self' }, { t: 0.82, e: 'ring', color: '#c8ffb0', r: 18 }, { t: 0.83, e: 'motes', color: '#f0fff0', n: 40, dur: 1.2 }],
    { channel: { from: 0.3, to: 0.6, hz: 2.2, bones: { armL: [6, 4, 0], foreL: [-8], handL: [12, 0, 0], spine: [2, 2, 0] } } });
  // ---- level 52 and 55 (the Windward Heights) ----
  // Pine Pitch Salve: hunched over the pad of pitch and wool, kneading it soft against the chest, then the pad tossed
  // with a short back-and-forward swing of the arm
  H1('h_pitch', 0.85, [
    k(0, GL),
    k(0.16, P(STAFF, { spine: [16, 8, 0], chest: [4, 2, 0], head: [24, -4, 0], armL: [-64, 22, 12], foreL: [-108, 0, 0], handL: [-14, 0, 0] })),
    k(0.32, P(STAFF, { spine: [20, 12, 0], chest: [6, 4, 0], head: [28, -6, 0], armL: [-72, 28, 16], foreL: [-120, 0, 0], handL: [16, 0, 0] }), { root: [0, -0.04, 0] }),
    k(0.46, P(STAFF, { spine: [-4, 30, 0], armL: [-40, -10, 30], foreL: [-60, 0, 0], handL: [20, 0, 0] }, L.stepBack), { root: [0, -0.04, -0.06] }),
    k(0.5 / 0.85, P(STAFF, { spine: [16, -20, 0], armL: [-118, 10, 10], foreL: [-10, 0, 0], handL: [-10, 0, 0] }, L.stepL), { root: [0, -0.08, 0.14], e: 'snap' }),
    k(0.74, P(STAFF, { spine: [12, -18, 0], armL: [-96, 10, 10], foreL: [-20, 0, 0], handL: [-10, 0, 0] }, L.stepL), { root: [0, -0.06, 0.12] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.06, e: 'holdItem', side: 'L', item: 'sap', on: true }, { t: 0.2, e: 'trailSmoke', side: 'L', dur: 0.25 }, { t: 0.2, e: 'motes', color: '#ffd890', n: 12, at: 'handL', dur: 0.3 },
    { t: 0.588, e: 'holdItem', side: 'L', item: 'sap', on: false }, { t: 0.588, e: 'proj', kind: 'salve', item: 'sap', from: 'L', arc: 0.4, impact: 'sap' }]);
  // Spruce Broth Spray: the hot jar held before the chest and swirled while the broth comes to the boil (the cast),
  // then drawn across to the right and swung out in a wide flat arc to out on the left, throwing the hot spray over the
  // party; standing all the way through, the staff upright in the right hand
  {
    const KET = (sp, at, dir, legs) => P(STAFF, wield({ spine: sp, chest: [2, sp[1] * 0.5, 0], head: [4, -sp[1] * 0.6, 0] }, at, dir, [0.62, 1.0, -0.05], 'L'), legs);
    H1('h_sprucebroth', 1.6, [
      k(0, GL),
      k(0.12, P(STAFF, { spine: [12, 6, 0], head: [18, -4, 0], armL: [-58, 18, 12], foreL: [-96, 0, 0], handL: [-10, 0, 0] }, L.wide), { root: [0, -0.1, 0] }),
      k(0.5, P(STAFF, { spine: [14, 8, 0], head: [20, -4, 0], armL: [-60, 20, 10], foreL: [-100, 0, 0], handL: [-6, 0, 0] }, L.wide), { root: [0, -0.1, 0] }),
      k(0.62, KET([6, -22, 0], [-0.12, 1.2, 0.34], [-0.55, 0.1, 0.83], L.wide), { root: [0, -0.06, 0] }),
      k(0.7, KET([4, -28, 0], [-0.16, 1.22, 0.3], [-0.62, 0.1, 0.78], L.wide), { root: [0, -0.06, 0] }),
      k(1.3 / 1.6, KET([4, 14, 0], [0.34, 1.3, 0.42], [0.55, 0.12, 0.83], L.stepL), { root: [0, -0.06, 0.08], e: 'snap' }),
      k(0.88, KET([4, 26, 0], [0.5, 1.28, 0.2], [0.85, 0.12, 0.5], L.stepL), { root: [0, -0.06, 0.08] }),
      k(0.94, KET([4, 8, 0], [0.24, 1.18, 0.3], [0.5, 0.4, 0.75], L.stepL), { root: [0, -0.04, 0.04] }),
      k(1, GL, { root: R.guard }),
    ], [{ t: 0.06, e: 'holdItem', side: 'L', item: 'jar', on: true }, { t: 0.14, e: 'trailSmoke', side: 'L', dur: 0.62 }, { t: 0.16, e: 'motes', color: '#f0fff0', n: 26, at: 'handL', dur: 0.9 },
      { t: 0.81, e: 'cloud', kind: 'mist', r: 12, at: 'self' }, { t: 0.82, e: 'motes', color: '#e0ffd8', n: 40, dur: 1.2 }, { t: 0.83, e: 'sound', s: 'whoosh' }, { t: 0.96, e: 'holdItem', side: 'L', item: 'jar', on: false }],
      { channel: { from: 0.14, to: 0.5, hz: 2.4, bones: { armL: [3, 4, 4], foreL: [-6], handL: [12, 0, 0], spine: [1, 2, 0] } } });
  }
  // ---- level 57 and 60 (Tidewater Sound) ----
  // Samphire Poultice: the linen-bound poultice warmed against the lantern a moment, swung back past the hip and tossed
  // underhand up the front to the ally
  H1('h_samphire', 0.85, [
    k(0, GL),
    k(0.16, P(STAFF, { spine: [8, 10, 0], head: [16, -8, 0], armL: [-58, 26, 10], foreL: [-100, 0, 0], handL: [-16, 0, 0] })),
    k(0.3, P(STAFF, { spine: [10, 12, 0], head: [16, -8, 0], armL: [-60, 30, 8], foreL: [-104, 0, 0], handL: [-6, 0, 0] })),
    k(0.44, P(STAFF, { spine: [16, -8, 0], head: [10, 6, 0], armL: [20, 0, 18], foreL: [-20, 0, 0], handL: [10, 0, 0] }, L.stepBack), { root: [0, -0.08, -0.04] }),
    k(0.5 / 0.85, P(STAFF, { spine: [4, -12, 0], head: [0, 8, 0], armL: [-76, 4, 10], foreL: [-12, 0, 0], handL: [-20, 0, 0] }, L.stepL), { root: [0, -0.06, 0.12], e: 'snap' }),
    k(0.74, P(STAFF, { spine: [0, -12, 0], armL: [-100, 6, 10], foreL: [-20, 0, 0], handL: [-20, 0, 0] }, L.stepL), { root: [0, -0.04, 0.12] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.06, e: 'holdItem', side: 'L', item: 'bandage', on: true }, { t: 0.16, e: 'trailSmoke', side: 'L', dur: 0.25 }, { t: 0.16, e: 'motes', color: '#c8ff9a', n: 12, at: 'handL', dur: 0.3 },
    { t: 0.588, e: 'holdItem', side: 'L', item: 'bandage', on: false }, { t: 0.588, e: 'proj', kind: 'salve', item: 'bandage', from: 'L', arc: 0.5, impact: 'hot' }]);
  // Marsh Kettle Steam (capstone): the staff tipped forward on wide feet so the lantern pan sits before the chest, the
  // marsh herbs held over it and stirred while the brine boils (the cast), then the staff lifted high overhead as the
  // steam rolls out over the party
  H1('h_saltkettle', 1.6, [
    k(0, GL),
    k(0.14, P(wield({ spine: [10, 4, 0], chest: [2, 0, 0], head: [10, -4, 0] }, [-0.3, 1.1, 0.42], [-0.04, 0.62, 0.78], [-0.7, 0.9, 0.0]), { armL: [-70, 20, 10], foreL: [-80, 0, 0], handL: [10, 0, 0] }, L.wide), { root: [0, -0.12, 0] }),
    k(0.5, P(wield({ spine: [12, 6, 0], chest: [2, 0, 0], head: [12, -4, 0] }, [-0.3, 1.08, 0.44], [-0.04, 0.6, 0.8], [-0.7, 0.9, 0.0]), { armL: [-74, 24, 8], foreL: [-86, 0, 0], handL: [20, 0, 0] }, L.wide), { root: [0, -0.14, 0] }),
    k(0.66, P(wield({ spine: [2, 2, 0], chest: [-4, 0, 0], head: [-4, 0, 0] }, [-0.34, 1.5, 0.3], [-0.08, 0.9, 0.4], [-0.75, 1.4, 0.0]), { armL: [-110, 10, 24], foreL: [-40, 0, 0] }, L.stand), { root: [0, -0.02, 0] }),
    k(1.3 / 1.6, P(wield({ spine: [-14, 0, 0], chest: [-12, 0, 0], head: [-24, 0, 0] }, [-0.3, 2.02, 0.18], [-0.06, 0.98, 0.16], [-0.8, 1.8, 0.0]), { armL: [-150, 0, 40], foreL: [-20, 0, 0] }, L.wide), { root: [0, -0.04, 0], e: 'snap' }),
    k(0.9, P(wield({ spine: [-12, 0, 0], chest: [-10, 0, 0], head: [-22, 0, 0] }, [-0.3, 1.98, 0.18], [-0.06, 0.98, 0.16], [-0.8, 1.8, 0.0]), { armL: [-146, 0, 40], foreL: [-20, 0, 0] }, L.wide), {}),
    k(0.95, P(wield({ spine: [-2, 0, 0], chest: [-4, 0, 0], head: [-8, 0, 0] }, [-0.33, 1.5, 0.24], [-0.12, 0.97, 0.1], [-0.75, 1.3, 0.0]), { armL: [-90, 10, 30], foreL: [-50, 0, 0] }, L.wide), { root: [0, -0.06, 0] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.08, e: 'holdItem', side: 'L', item: 'herbBundle', on: true }, { t: 0.12, e: 'lanternFlare', dur: 0.6 }, { t: 0.16, e: 'trailSmoke', side: 'L', dur: 0.6 }, { t: 0.18, e: 'motes', color: '#e8f4ee', n: 30, at: 'handL', dur: 1.0 }, { t: 0.6, e: 'holdItem', side: 'L', item: 'herbBundle', on: false },
    { t: 0.81, e: 'cloud', kind: 'mist', r: 12, at: 'self' }, { t: 0.81, e: 'cloud', kind: 'seaspray', r: 8, at: 'self' },{ t: 0.83, e: 'motes', color: '#f0fff0', n: 40, dur: 1.2 }],
    { channel: { from: 0.16, to: 0.5, hz: 2.2, bones: { armL: [6, 4, 0], foreL: [-8], handL: [12, 0, 0], spine: [2, 2, 0] } } });
  // ---- level 62 and 65 (the Rainward Gorge) ----
  // Moss Dressing: the linen-bound moss pad held to the lantern a moment so the pine water steams, swung back past the
  // hip and tossed underhand up the front to the ally
  H1('h_moss', 0.85, [
    k(0, GL),
    k(0.16, P(STAFF, { spine: [8, 12, 0], head: [16, -8, 0], armL: [-56, 28, 10], foreL: [-98, 0, 0], handL: [-16, 0, 0] })),
    k(0.3, P(STAFF, { spine: [10, 14, 0], head: [16, -8, 0], armL: [-58, 32, 8], foreL: [-102, 0, 0], handL: [-6, 0, 0] })),
    k(0.44, P(STAFF, { spine: [18, -8, 0], head: [10, 6, 0], armL: [24, 0, 18], foreL: [-20, 0, 0], handL: [10, 0, 0] }, L.stepBack), { root: [0, -0.1, -0.04] }),
    k(0.5 / 0.85, P(STAFF, { spine: [4, -12, 0], head: [0, 8, 0], armL: [-78, 4, 10], foreL: [-12, 0, 0], handL: [-20, 0, 0] }, L.stepL), { root: [0, -0.06, 0.12], e: 'snap' }),
    k(0.74, P(STAFF, { spine: [0, -12, 0], armL: [-100, 6, 10], foreL: [-20, 0, 0], handL: [-20, 0, 0] }, L.stepL), { root: [0, -0.04, 0.12] }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.06, e: 'holdItem', side: 'L', item: 'bandage', on: true }, { t: 0.16, e: 'trailSmoke', side: 'L', dur: 0.25 }, { t: 0.16, e: 'motes', color: '#d8f0c8', n: 10, at: 'handL', dur: 0.3 },
    { t: 0.588, e: 'holdItem', side: 'L', item: 'bandage', on: false }, { t: 0.588, e: 'proj', kind: 'salve', item: 'bandage', from: 'L', arc: 0.5, impact: 'hot' }]);
  // Cedar Bark Steam (capstone): the staff tipped forward on wide feet so the lantern pan sits before the chest, the
  // curl of cedar bark and bracken dropped onto it and pressed down while it smokes (the cast), then the staff swept
  // out low and wide from side to side as the thick resin steam rolls over the party
  H1('h_cedarsteam', 1.6, [
    k(0, GL),
    k(0.14, P(wield({ spine: [12, 4, 0], chest: [2, 0, 0], head: [12, -4, 0] }, [-0.3, 1.06, 0.44], [-0.04, 0.6, 0.8], [-0.7, 0.9, 0.0]), { armL: [-66, 22, 10], foreL: [-84, 0, 0], handL: [14, 0, 0] }, L.wide), { root: [0, -0.14, 0] }),
    k(0.5, P(wield({ spine: [16, 6, 0], chest: [4, 0, 0], head: [14, -4, 0] }, [-0.3, 1.02, 0.46], [-0.04, 0.58, 0.82], [-0.7, 0.9, 0.0]), { armL: [-60, 24, 8], foreL: [-92, 0, 0], handL: [24, 0, 0] }, L.wide), { root: [0, -0.18, 0] }),
    k(0.66, P(wield({ spine: [10, 30, 0], chest: [4, 10, 0], head: [6, -10, 0] }, [0.1, 1.2, 0.6], [0.5, 0.2, 0.84], [-0.4, 1.0, 0.2]), { armL: [-60, 30, 30], foreL: [-30, 0, 0] }, L.wide), { root: [0, -0.16, 0] }),
    k(1.3 / 1.6, P(wield({ spine: [12, -30, 0], chest: [4, -10, 0], head: [6, 10, 0] }, [-0.7, 1.2, 0.5], [-0.6, 0.2, 0.78], [-0.9, 1.0, -0.2]), { armL: [-70, 10, 40], foreL: [-30, 0, 0] }, L.wide), { root: [0, -0.18, 0], e: 'snap' }),
    k(0.9, P(wield({ spine: [12, -32, 0], chest: [4, -10, 0], head: [6, 10, 0] }, [-0.72, 1.2, 0.48], [-0.6, 0.2, 0.78], [-0.9, 1.0, -0.2]), { armL: [-70, 10, 40], foreL: [-30, 0, 0] }, L.wide), {}),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.08, e: 'holdItem', side: 'L', item: 'herbBundle', on: true }, { t: 0.12, e: 'lanternFlare', dur: 0.6 }, { t: 0.16, e: 'trailSmoke', side: 'L', dur: 0.6 }, { t: 0.3, e: 'holdItem', side: 'L', item: 'herbBundle', on: false },
    { t: 0.66, e: 'cloud', kind: 'resin', r: 8, at: 'self' }, { t: 0.81, e: 'cloud', kind: 'mist', r: 12, at: 'self' }, { t: 0.81, e: 'cloud', kind: 'resin', r: 12, at: 'self' }, { t: 0.82, e: 'sound', s: 'whoosh' }],
    { channel: { from: 0.16, to: 0.5, hz: 2.0, bones: { armL: [4, 2, 0], foreL: [-8], handL: [10, 0, 0], spine: [2, 2, 0] } } });
}

// ============================== DEADEYE ===================================
// Gunner poses: a pistol's barrel runs on down the forearm out of the fist (client/assets/weapons.js pistol), so a pistol
// is aimed by putting the wrist on a line out from the shoulder and turning the fist so the barrel lies along the aim, the
// grip's top up (canted a touch inward). When both pistols are up they always point the same way: never crossed.
// aim: [pitch, yaw] deg (yaw + to the left); o.at a fixed wrist place instead of the reach along the aim line.
const D2 = (pitch, yaw = 0) => [Math.sin(yaw * RAD) * Math.cos(pitch * RAD), Math.sin(pitch * RAD), Math.cos(yaw * RAD) * Math.cos(pitch * RAD)];
function gunArm(torso, side, aim, o = {}) {
  const get = fk(torso);
  const S = get('arm' + side).p, sx = side === 'R' ? -1 : 1;
  const A = V(...aim).normalize();
  const W = o.at ? V(...o.at) : S.clone().addScaledVector(A, o.reach ?? 0.545).add(V(-sx * (o.inward ?? 0.05), -(o.drop ?? 0.03), 0));
  const up = V(...(o.up || [-sx * 0.12, 1, 0])); up.addScaledVector(A, -up.dot(A)).normalize();
  const pole = o.pole ? V(...o.pole) : S.clone().add(V(sx * 0.35, -0.4, -0.12));
  const arm = armIK(get, side, W, pole, A.clone().negate(), up, true);
  arm['hand' + side].ik = true;
  return arm;
}
// the stances, solved from where the barrels should point (written into the shared table before the clips read them)
{
  const both = (at, pitch, extra = {}) => ({ ...gunArm({}, 'R', D2(pitch), { at: [-at[0], at[1], at[2]], ...extra }), ...gunArm({}, 'L', D2(pitch), { at, ...extra }) });
  STANCES.deadeye.idle = { ...STANCES.deadeye.idle, ...both([0.27, 0.96, 0.1], -72) };
  STANCES.deadeye.combat = { ...STANCES.deadeye.combat, ...both([0.21, 1.1, 0.3], -26) };
  STANCES.deadeye.run = { ...STANCES.deadeye.run, ...both([0.25, 1.02, 0.16], -56) };
}
{
  const G = P(guard('deadeye'), { spine: [4, 0, 0] });
  const GL = P(G, LG);
  // torsos: one shoulder brought forward for a one-arm shot (the head keeps facing the target), square for both pistols
  const TOR = {
    R: { spine: [4, 16, 0], chest: [0, 8, 0], neck: [0, -8, 0], head: [0, -14, 0] },
    L: { spine: [4, -16, 0], chest: [0, -8, 0], neck: [0, 8, 0], head: [0, 14, 0] },
    B: { spine: [6, 0, 0], chest: [2, 0, 0] },
  };
  const lean = (t, x) => ({ ...t, spine: [t.spine[0] + x, t.spine[1], t.spine[2] || 0] });
  // one pistol up on the line; kick 0..1 is the recoil (the barrel thrown up, the wrist back, the shoulders rocked)
  const AIM = (side, o = {}) => {
    const kick = o.kick || 0, tor = lean(o.torso || TOR[side], -3 * kick);
    const arm = gunArm(tor, side, D2((o.pitch ?? 2) + 16 * kick * (o.kickK ?? 1), o.yaw ?? 0), { reach: (o.reach ?? 0.545) - 0.06 * kick, drop: (o.drop ?? 0.03) - 0.03 * kick });
    return P(G, tor, o.other || {}, arm);
  };
  // both pistols up and parallel; kR / kL the recoil of each
  const BOTH = (o = {}) => {
    const kk = Math.max(o.kR || 0, o.kL || 0), tor = lean(o.torso || TOR.B, -3 * kk * (o.kickK ?? 1));
    const a = (side, k1) => gunArm(tor, side, D2((o.pitch ?? 2) + 16 * k1 * (o.kickK ?? 1), o.yaw ?? 0), { reach: (o.reach ?? 0.53) - 0.06 * k1, inward: o.inward ?? 0.1, drop: o.drop ?? 0.05 });
    return P(G, tor, a('R', o.kR || 0), a('L', o.kL || 0));
  };
  // pistols at the hip, barrels forward (or tipped down: pitch)
  const HIP = (o = {}) => {
    const tor = o.torso || { spine: [10, 0, 0], chest: [4, 0, 0], head: [-6, 0, 0] };
    const a = (side, k1) => gunArm(tor, side, D2((o.pitch ?? -4) + 16 * k1), { at: [(side === 'R' ? -1 : 1) * (o.x ?? 0.22), (o.y ?? 1.06) + 0.03 * k1, (o.z ?? 0.34) - 0.05 * k1] });
    return P(G, tor, o.sides === 'R' ? {} : a('L', o.kL || 0), o.sides === 'L' ? {} : a('R', o.kR || 0));
  };
  // a free left hand (the left pistol held in it, barrel kept pointing the way the hand goes), e.g. a throw
  const LEFT = (torso, at, aim, pole) => gunArm(torso, 'L', aim, { at, pole: pole || [0.62, 1.1, -0.1] });
  const TUCK = { armR: [-46, 0, -8], foreR: [-128, 0, 0], handR: [50, 0, 0], armL: [-46, 0, 8], foreL: [-128, 0, 0], handL: [50, 0, 0] };
  // the skill's own release times (shared/classes.js hit.t + i * gap), so the shots leave the barrel when the sim fires
  const HT = (id, def, i = 0) => { const h = SKILL_BY_ID[id]?.hit; return h ? h.t + i * (h.gap || 0) : def + i * 0.16; };
  const D1 = (id, dur, mask, keys, ev, o) => (DEF[id] = C('deadeye', dur, mask, keys, ev, o));
  // one quick shot: the pistol snaps up onto the line, fires on the release, kicks up and back, settles to the guard
  const shot1 = (dur, side, tf, o = {}) => [
    k(0, G),
    k(Math.max(0.04, (tf - (o.raise ?? 0.1)) / dur), AIM(side, o), { e: 'snap' }),
    k(tf / dur, AIM(side, o), { hold: true }),
    k((tf + 0.05) / dur, AIM(side, { ...o, kick: o.big ? 1.4 : 1 }), { e: 'out' }),
    k(Math.min(0.9, (tf + 0.22) / dur), AIM(side, { ...o, kick: 0.15 })),
    k(1, G),
  ];
  const ball = (side, extra = {}) => ({ t: 'hit', e: 'proj', kind: 'ball', from: 'muzzle' + side, ...extra });

  // Snap Shot: the basic shot, right pistol then left (entities.js plays the mirrored twin every other cast)
  { const tf = HT('d_snap', 0.2);
    D1('d_snap', 0.55, 'upper', shot1(0.55, 'R', tf), [ball('R')], { alt: 'd_snap_l' });
    D1('d_snap_l', 0.55, 'upper', shot1(0.55, 'L', tf), [ball('L')], { skill: 'd_snap' }); }
  // Paired Shot: both arms level and parallel, right then left
  { const t1 = HT('d_pair', 0.2), t2 = HT('d_pair', 0.2, 1), d = 0.8;
    D1('d_pair', d, 'upper', [
      k(0, G), k((t1 - 0.12) / d, BOTH(), { e: 'snap' }), k(t1 / d, BOTH(), { hold: true }),
      k((t1 + 0.05) / d, BOTH({ kR: 1 }), { e: 'out' }), k(t2 / d, BOTH({ kR: 0.2 })), k((t2 + 0.05) / d, BOTH({ kR: 0.1, kL: 1 }), { e: 'out' }),
      k((t2 + 0.24) / d, BOTH({ kL: 0.15 })), k(1, G),
    ], [ball('R'), ball('L', { t: 'hit2' })]); }
  // Quick Reload: the left pistol to its holster, the right broken open muzzle-up before the chest; powder poured from the
  // flask, two strokes of the ramrod, the lock snapped shut level and the left pistol drawn again
  {
    const T = { spine: [10, 6, 0], chest: [4, 2, 0], neck: [0, 0, 0], head: [16, -4, 0] };
    const UPR = gunArm(T, 'R', D2(74, 12), { at: [-0.07, 1.08, 0.33] });
    const LH = (at, aim) => LEFT(T, at, aim, [0.6, 1.0, -0.2]);
    const HIPL = LH([0.27, 1.0, 0.06], D2(-80));
    const POUR = LH([-0.02, 1.56, 0.42], D2(-70, 30)), RAM0 = LH([-0.03, 1.66, 0.4], D2(-80, 20)), RAM1 = LH([-0.04, 1.52, 0.38], D2(-80, 20));
    D1('d_reload', 1.0, 'upper', [
      k(0, G),
      k(0.12, P(G, T, gunArm(T, 'R', D2(30, 6), { at: [-0.12, 1.12, 0.34] }), HIPL)),
      k(0.2, P(G, T, UPR, LH([0.12, 1.3, 0.34], D2(-40, 20)))),
      k(0.26, P(G, T, UPR, POUR)), k(0.42, P(G, T, UPR, POUR)),
      k(0.5, P(G, T, UPR, RAM0)), k(0.56, P(G, T, UPR, RAM1), { e: 'in' }), k(0.62, P(G, T, UPR, RAM0)), k(0.68, P(G, T, UPR, RAM1), { e: 'in' }),
      k(0.76, P(G, T, gunArm(T, 'R', D2(10, 4), { at: [-0.16, 1.14, 0.36] }), HIPL), { e: 'out' }),
      k(0.82, P(G, T, gunArm(T, 'R', D2(-20, 0), { at: [-0.19, 1.12, 0.34] }), HIPL)),
      k(1, G),
    ], [{ t: 0.12, e: 'hideAttach', bone: 'weaponL', dur: 0.72 }, { t: 0.14, e: 'holdItem', side: 'L', item: 'powderflask', on: true }, { t: 0.2, e: 'sound', s: 'click' },
      { t: 0.27, e: 'powder', side: 'L', dur: 0.15 }, { t: 0.46, e: 'holdItem', side: 'L', item: 'powderflask', on: false }, { t: 0.46, e: 'holdItem', side: 'L', item: 'ramrod', on: true },
      { t: 0.56, e: 'sound', s: 'ram' }, { t: 0.72, e: 'holdItem', side: 'L', item: 'ramrod', on: false }, { t: 0.8, e: 'sound', s: 'click' }]);
  }
  // Combat Roll: a forward shoulder roll with both pistols tucked to the chest, up again at the guard
  D1('d_roll', 0.8, 'full', [
    k(0, GL),
    k(0.12, P(G, TUCK, { spine: [40, 0, 0] }, L.deep), { root: [0, -0.4, 0.4] }),
    k(0.32, P(G, TUCK, { spine: [110, 0, 0], chest: [30, 0, 0], head: [40, 0, 0] }, L.tuck), { root: [0, -0.5, 2.2], e: 'linear' }),
    k(0.5, P(G, TUCK, { spine: [210, 0, 0], chest: [30, 0, 0] }, L.tuck), { root: [0, -0.55, 4.0], e: 'linear' }),
    k(0.66, P(G, TUCK, { spine: [30, 0, 0] }, L.kneel), { root: [0, -0.4, 5.2] }),
    k(1, GL, { root: [0, 0, 5.6] }),
  ], [{ t: 0.08, e: 'dash' }, { t: 0.14, e: 'dust' }, { t: 0.66, e: 'dust' }], { endRoot: [0, 0, 5.6] });
  // Powder Burn: a low shot from the right hip; the burning wadding smoulders on the plate
  { const tf = HT('d_powderburn', 0.22), d = 0.6;
    D1('d_powderburn', d, 'upper', [
      k(0, G), k((tf - 0.1) / d, HIP({ sides: 'R' }), { e: 'snap' }), k(tf / d, HIP({ sides: 'R' }), { hold: true }),
      k((tf + 0.05) / d, HIP({ sides: 'R', kR: 1 }), { e: 'out' }), k((tf + 0.22) / d, HIP({ sides: 'R', kR: 0.15 })), k(1, G),
    ], [ball('R', { impact: 'burn' })]); }
  // Knee Shot: the right pistol aimed low at a leg joint
  { const tf = HT('d_knee', 0.2);
    D1('d_knee', 0.6, 'upper', shot1(0.6, 'R', tf, { pitch: -14, torso: lean(TOR.R, 8) }), [ball('R', { low: true })]); }
  // Scatter Charge: both pistols at the hip loaded with loose shot, fired together on a step back
  { const tf = HT('d_scatter', 0.3), d = 0.75;
    D1('d_scatter', d, 'full', [
      k(0, GL), k((tf - 0.14) / d, P(HIP({ y: 1.04 }), L.wide), { root: [0, -0.12, 0], e: 'out' }), k(tf / d, P(HIP({ y: 1.04 }), L.wide), { root: [0, -0.12, 0], hold: true }),
      k((tf + 0.06) / d, P(HIP({ y: 1.04, kR: 1, kL: 1 }), L.stepBack), { root: [0, -0.1, -0.22], e: 'out' }), k((tf + 0.3) / d, P(HIP({ kR: 0.2, kL: 0.2 }), L.stepBack), { root: [0, -0.06, -0.22] }),
      k(1, GL, { root: [0, 0, -0.22] }),
    ], [{ t: 'hit', e: 'muzzle', side: 'R', scatter: true }, { t: 'hit', e: 'muzzle', side: 'L', scatter: true }, { t: 'hit', e: 'impact', kind: 'ball', at: 'front3', shake: 0.25 }], { endRoot: [0, 0, -0.22] }); }
  // Slide Shot: a run-in drop into a knee slide, the right pistol fired mid-slide, up again at the far end
  { const tf = HT('d_slide', 0.5), d = 1.0, AK = (kick) => AIM('R', { torso: { spine: [-2, 18, 0], chest: [0, 8, 0], neck: [0, -8, 0], head: [-4, -14, 0] }, kick });
    D1('d_slide', d, 'full', [
      k(0, GL),
      k(0.14, P(G, { spine: [18, 0, 0] }, L.lungeL), { root: [0, -0.14, 1.0] }),
      k(0.3, P(AK(0), L.kneel), { root: [0, -0.42, 2.8], e: 'linear' }),
      k(tf / d, P(AK(0), L.kneel), { root: [0, -0.44, 4.4] }),
      k((tf + 0.05) / d, P(AK(1), L.kneel), { root: [0, -0.44, 4.8], e: 'out' }),
      k(0.74, P(AK(0.1), L.kneel), { root: [0, -0.42, 5.4] }),
      k(1, GL, { root: [0, 0, 5.4] }),
    ], [{ t: 0.1, e: 'dash' }, { t: 0.3, e: 'dust' }, { t: 0.45, e: 'dust' }, { t: 0.62, e: 'dust' }, ball('R')], { endRoot: [0, 0, 5.4] }); }
  // Grip Strike: a backhand rake with the right pistol's butt, drawn across to the left shoulder and whipped out to the right
  D1('d_grip', 0.7, 'full', [
    k(0, GL),
    k(0.12, P(G, arc(70, { lead: 40, dy: -0.1, r: 0.3 }), L.stepL), { root: [0, -0.04, 0.06] }),
    ...swing(0.7, HT('d_grip', 0.22), { wind: 95, mid: 45, hit: -10, follow: -70, end: -80 }, (a, role, e) => [P(G, arc(a, { lead: role === 'wind' ? 40 : role === 'mid' ? 15 : role === 'hit' ? -5 : -25, dy: -0.16, r: role === 'wind' ? 0.3 : 0.42 }), role === 'wind' ? L.stepL : L.lungeL), { root: role === 'wind' ? [0, -0.04, 0.08] : [0, -0.06, 0.22], e }], 1500),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.12, e: 'sound', s: 'swing' }, { t: 'hit', e: 'impact', kind: 'clang', shake: 0.3, stop: 0.05 }]);
  // Fan the Hammer: the right pistol held out, the left hand (its own pistol pointing the same way) brought over it and
  // swept down across the hammer for each of the six shots
  { const d = 1.45, T = { spine: [6, 8, 0], chest: [2, 4, 0], neck: [0, -4, 0], head: [0, -8, 0] };
    const FR = (kick) => gunArm(lean(T, -2 * kick), 'R', D2(2 + 14 * kick), { reach: 0.54 - 0.04 * kick });
    const FL = (lo) => gunArm(T, 'L', D2(4 - 6 * lo), { at: [-0.03 - 0.03 * lo, 1.6 - 0.06 * lo, 0.4 + 0.06 * lo], pole: [0.55, 1.2, -0.1] });
    const keys = [k(0, G), k(Math.max(0.04, (HT('d_fan', 0.18) - 0.12) / d), P(G, T, FR(0), FL(0)), { e: 'out' })];
    for (let i = 0; i < 6; i++) { const t = HT('d_fan', 0.18, i) / d; keys.push(k(t - 0.02, P(G, T, FR(0), FL(1)), { e: 'in' }), k(t + 0.035, P(G, T, FR(0.6), FL(0.4)), { e: 'out' }), k(t + 0.09, P(G, T, FR(0.1), FL(0))) ); }
    keys.push(k(1, G));
    D1('d_fan', d, 'upper', keys.filter((q, i, a) => i === 0 || q.t > a[i - 1].t), [0, 1, 2, 3, 4, 5].map((i) => ball('R', { t: i ? 'hit' + (i + 1) : 'hit' }))); }
  // Chalk Mark: a flick of the left wrist sends a chalk pellet at the target
  { const tf = HT('d_chalk', 0.3), d = 0.6, T = { spine: [4, -10, 0], chest: [0, -6, 0], head: [0, 10, 0] };
    D1('d_chalk', d, 'upper', [
      k(0, G), k(0.18, P(G, T, LEFT(T, [0.3, 1.5, 0.08], D2(60, 10)))), k(tf / d, P(G, T, LEFT(T, [0.2, 1.42, 0.46], D2(6, 0))), { e: 'out' }),
      k((tf + 0.14) / d, P(G, T, LEFT(T, [0.2, 1.36, 0.44], D2(-4, 0)))), k(1, G),
    ], [{ t: 0.06, e: 'holdItem', side: 'L', item: 'chalk', on: true }, { t: tf / d, e: 'holdItem', side: 'L', item: 'chalk', on: false }, { t: tf / d, e: 'proj', kind: 'chalk', from: 'L', arc: 0.15 }]); }
  // Smoke Charge: a paper cartridge lobbed high from the left hand; it bursts into a low bank of powder smoke
  { const d = 0.9, T = { spine: [2, -12, 0], chest: [-2, -6, 0], head: [-8, 10, 0] };
    D1('d_smoke', d, 'full', [
      k(0, GL), k(0.2, P(G, T, LEFT(T, [0.3, 0.98, -0.12], D2(-70, 0)), L.stepBack), { root: [0, -0.06, -0.05] }),
      k(0.36, P(G, T, LEFT(T, [0.24, 1.62, 0.4], D2(40, 0)), L.stepL), { root: [0, -0.04, 0.08], e: 'out' }),
      k(0.56, P(G, T, LEFT(T, [0.22, 1.42, 0.44], D2(10, 0)), L.stepL), { root: [0, -0.04, 0.08] }),
      k(1, GL, { root: R.guard }),
    ], [{ t: 0.06, e: 'holdItem', side: 'L', item: 'cartridge', on: true }, { t: 0.36, e: 'holdItem', side: 'L', item: 'cartridge', on: false },
      { t: 0.36, e: 'proj', kind: 'cartridge', from: 'L', arc: 0.7, ground: true, spin: 9, r: 5 }]); }
  // Ricochet: an angled shot that skips off the plate into the machines beside it
  { const tf = HT('d_ricochet', 0.22);
    D1('d_ricochet', 0.6, 'upper', shot1(0.6, 'R', tf, { yaw: 8, pitch: -3, torso: { spine: [4, 22, 0], chest: [0, 10, 0], neck: [0, -10, 0], head: [0, -18, 0] } }), [ball('R', { impact: 'ricochet' })]); }
  // Recoil Jump: the right pistol fired into the ground at the feet, the kick and a jet of dust carry him back in a hop;
  // the left pistol answers from the air
  { const tf = HT('d_recoil', 0.15), d = 0.85, DN = P(G, { spine: [22, 0, 0], chest: [6, 0, 0], head: [10, 0, 0] }, gunArm({ spine: [22, 0, 0], chest: [6, 0, 0] }, 'R', D2(-62), { reach: 0.48 }));
    D1('d_recoil', d, 'full', [
      k(0, GL), k(tf / d, P(DN, L.deep), { root: [0, -0.3, 0], e: 'out' }),
      k(0.3, P(G, { spine: [-14, 0, 0], chest: [-6, 0, 0] }, gunArm({ spine: [-14, 0, 0], chest: [-6, 0, 0] }, 'L', D2(-8)), L.air), { root: [0, 1.0, -2.6], e: 'out' }),
      k(0.5, P(G, { spine: [-6, 0, 0] }, L.air), { root: [0, 0.7, -5.0] }),
      k(0.72, P(G, { spine: [24, 0, 0] }, L.deep), { root: [0, -0.32, -6.6], e: 'in' }),
      k(1, GL, { root: [0, 0, -6.6] }),
    ], [{ t: 'hit', e: 'muzzle', side: 'R', ground: true, big: true }, { t: 'hit', e: 'dash' }, { t: 0.34, e: 'proj', kind: 'ball', from: 'muzzleL' }, { t: 0.72, e: 'dust' }], { endRoot: [0, 0, -6.6] }); }
  // Paper Cartridges: a cartridge drawn from the belt, torn open before the chest in a puff of powder, then the box flicked
  // out to the side for the others
  { const d = 0.95, T = { spine: [8, -8, 0], chest: [2, -4, 0], head: [10, 6, 0] };
    D1('d_cartridge', d, 'upper', [
      k(0, G), k(0.16, P(G, T, LEFT(T, [0.2, 1.0, 0.18], D2(-70, 0)))), k(0.34, P(G, T, LEFT(T, [0.06, 1.28, 0.34], D2(-30, 20)))),
      k(0.42, P(G, T, LEFT(T, [0.08, 1.3, 0.36], D2(-30, 26)))), k(0.6, P(G, { spine: [4, -24, 0], chest: [0, -10, 0], head: [0, 18, 0] }, LEFT({ spine: [4, -24, 0], chest: [0, -10, 0] }, [0.5, 1.36, 0.22], D2(4, 60))), { e: 'out' }),
      k(0.74, P(G, T, LEFT(T, [0.4, 1.3, 0.24], D2(-10, 40)))), k(1, G),
    ], [{ t: 0.14, e: 'holdItem', side: 'L', item: 'cartridge', on: true }, { t: 0.4, e: 'powder', side: 'L', dur: 0.08, puff: true }, { t: 0.62, e: 'holdItem', side: 'L', item: 'cartridge', on: false },
      { t: 0.62, e: 'sound', s: 'whoosh' }]); }
  // Iron Slug: feet wide, both arms out level and side by side, the right pistol's heavy slug sent through the line
  { const tf = HT('d_slug', 0.4), d = 0.85, B = (kR) => BOTH({ inward: 0.16, reach: 0.55, kR, kickK: 1.3 });
    D1('d_slug', d, 'upper', [
      k(0, GL), k((tf - 0.2) / d, P(B(0), L.wide), { root: [0, -0.08, 0], e: 'snap' }), k(tf / d, P(B(0), L.wide), { root: [0, -0.08, 0], hold: true }),
      k((tf + 0.06) / d, P(B(1), L.wide), { root: [0, -0.06, -0.12], e: 'out' }), k((tf + 0.28) / d, P(B(0.2), L.wide), { root: [0, -0.06, -0.12] }), k(1, GL, { root: R.guard }),
    ], [ball('R', { pierce: true, big: true }), { t: 'hit', e: 'wave', kind: 'dust', len: 10 }]); }
  // Priming Burst: both pistols tipped down, loose priming powder shaken out at the feet goes off in a string of bangs
  { const d = 0.75, DN = HIP({ pitch: -82, y: 1.0, z: 0.22, torso: { spine: [16, 0, 0], chest: [4, 0, 0], head: [14, 0, 0] } });
    D1('d_priming', d, 'full', [
      k(0, GL), k(0.12, P(DN, L.wide), { root: [0, -0.14, 0] }), k(0.3, P(DN, L.wide), { root: [0, -0.16, 0] }),
      k(0.46, P(G, { spine: [-4, 0, 0] }, L.stepBack), { root: [0, -0.04, -0.2], e: 'out' }), k(1, GL, { root: [0, 0, -0.2] }),
    ], [{ t: 0.04, e: 'powder', side: 'R', dur: 0.12 }, { t: 0.04, e: 'powder', side: 'L', dur: 0.12 }, { t: 'hit', e: 'bangs', n: 8, r: 5 }, { t: 'hit', e: 'shake', amt: 0.3 }], { endRoot: [0, 0, -0.2] }); }
  // Chain Shot: the left pistol loaded with two balls on a short chain that wrap round the legs
  { const tf = HT('d_chain', 0.25);
    D1('d_chain', 0.65, 'upper', shot1(0.65, 'L', tf, { pitch: -8 }), [{ t: 'hit', e: 'proj', kind: 'chainshot', from: 'muzzleL', spin: 14, low: true }]); }
  // Quickdraw: the right pistol swept up from beside the hip straight onto the line in one movement
  { const tf = HT('d_quick', 0.12), d = 0.5, DRAW = P(G, TOR.R, gunArm(TOR.R, 'R', D2(-84), { at: [-0.28, 0.98, 0.04] }));
    D1('d_quick', d, 'upper', [
      k(0, G), k(0.04 / d, DRAW, { e: 'out' }), k(tf / d, AIM('R'), { e: 'snap' }), k((tf + 0.04) / d, AIM('R', { kick: 1.2 }), { e: 'out' }),
      k((tf + 0.2) / d, AIM('R', { kick: 0.1 })), k(1, G),
    ], [ball('R'), { t: 0.02, e: 'sound', s: 'click' }]); }
  // Powder Storm: a sidestep out and back in round the target, five shots right and left into the ground about it until
  // the place is full of smoke and spark strikes
  { const d = 1.9, n = 5, keys = [k(0, GL)];
    for (let i = 0; i < n; i++) {
      const t = HT('d_storm', 0.5, i) / d, side = i % 2 ? 'L' : 'R', sw = i % 2 ? -1 : 1;
      const tor = { spine: [10, sw * 14, 0], chest: [4, sw * 8, 0], neck: [0, -sw * 8, 0], head: [8, -sw * 14, 0] };
      const legs = i % 2 ? L.stepL : P(L.stepL, { thighR: [-30, 0, -10], thighL: [10, 0, 10] });
      keys.push(k(t - 0.05, P(AIM(side, { torso: tor, pitch: -14 }), legs), { root: [sw * 0.5, -0.1, 0] }));
      keys.push(k(t + 0.03, P(AIM(side, { torso: tor, pitch: -14, kick: 0.9 }), legs), { root: [sw * 0.55, -0.1, 0], e: 'out' }));
    }
    keys.push(k(1, GL, { root: R.guard }));
    D1('d_storm', d, 'full', keys.filter((q, i, a) => i === 0 || q.t > a[i - 1].t), [
      ...[0, 1, 2, 3, 4].map((i) => ({ t: i ? 'hit' + (i + 1) : 'hit', e: 'proj', kind: 'ball', from: i % 2 ? 'muzzleL' : 'muzzleR', ground: true, scatter: 4.5 })),
      { t: 'hit', e: 'cloud', kind: 'gunsmoke', r: 6 }, { t: 'hit3', e: 'cloud', kind: 'gunsmoke', r: 5 }, { t: 'hit5', e: 'shake', amt: 0.3 },
    ]); }
  // Last Round: the heavy charge saved for the end: one arm out, a slow settle onto the line, a big kick
  { const tf = HT('d_lastround', 0.25), d = 0.95;
    D1('d_lastround', d, 'upper', [
      k(0, G), k(0.06, AIM('R', { pitch: 12, reach: 0.44 }), { e: 'snap' }), k(tf / d, AIM('R'), { hold: false }),
      k((tf + 0.06) / d, AIM('R', { kick: 1.6 }), { e: 'out' }), k((tf + 0.4) / d, AIM('R', { kick: 0.2 })), k(1, G),
    ], [ball('R', { big: true })]); }
  // Breach Charge (capstone): feet planted wide, both arms locked out level and side by side through the cast, the
  // double-loaded charge fired from both together; a big recoil rocks him back a step
  { const tf = HT('d_breach', 1.0), d = 1.55, B = (kk) => BOTH({ inward: 0.15, reach: 0.55, kR: kk, kL: kk, kickK: 1.4, torso: { spine: [8, 0, 0], chest: [4, 0, 0], head: [2, 0, 0] } });
    const WL = P(L.wide, { thighL: [-22, 0, 20], shinL: [42], thighR: [-6, 0, -20], shinR: [34] });
    D1('d_breach', d, 'full', [
      k(0, GL), k(0.16, P(B(0), WL), { root: [0, -0.16, 0], e: 'out' }), k(tf / d - 0.02, P(B(0), WL), { root: [0, -0.18, 0] }),
      k(tf / d, P(B(0), WL), { root: [0, -0.18, 0], hold: true }),
      k((tf + 0.07) / d, P(B(1), WL), { root: [0, -0.12, -0.32], e: 'out' }), k((tf + 0.3) / d, P(B(0.25), WL), { root: [0, -0.14, -0.36] }),
      k(1, GL, { root: [0, 0, -0.36] }),
    ], [{ t: 0.12, e: 'sound', s: 'click' }, { t: 0.2, e: 'sound', s: 'click' }, { t: 0.3, e: 'muzzle', side: 'R', dry: true },
      ball('R', { pierce: true, big: true }), ball('L', { pierce: true, big: true }), { t: 'hit', e: 'shake', amt: 0.55 }, { t: 'hit', e: 'wave', kind: 'dust', len: 14 }, { t: 'hit', e: 'dust' }], { endRoot: [0, 0, -0.36] }); }
  // Plate Splitter: a two-handed aim, the right pistol's hardened ball sent at a rivet line
  { const tf = HT('d_splitter', 0.22), d = 0.65, B = (kR) => BOTH({ inward: 0.16, kR });
    D1('d_splitter', d, 'upper', [
      k(0, G), k((tf - 0.12) / d, B(0), { e: 'snap' }), k(tf / d, B(0), { hold: true }), k((tf + 0.05) / d, B(1.1), { e: 'out' }), k((tf + 0.24) / d, B(0.15)), k(1, G),
    ], [ball('R', { big: true }), { t: 'hit', e: 'sound', s: 'clang' }]); }
  // Pressure Volley (capstone): both pistols tilted high, three square steam canisters thumped out right, left, right;
  // they burst over the ground ahead in shot and steam
  { const d = 1.6, hit = (i) => HT('d_pressure', 0.9, i), FT = 0.6, keys = [k(0, G)];
    for (let i = 0; i < 3; i++) { const t = (hit(i) - FT) / d; keys.push(k(t - 0.03, BOTH({ pitch: 38 }), { raise: true }), k(t + 0.03, BOTH({ pitch: 38, kR: i % 2 ? 0 : 0.8, kL: i % 2 ? 0.8 : 0 }), { e: 'out' })); }
    keys.push(k(1, G));
    D1('d_pressure', d, 'upper', keys.filter((q, i, a) => i === 0 || q.t > a[i - 1].t).map((q) => (q.raise ? { ...q, e: 'snap' } : q)), [0, 1, 2].map((i) => ({ t: (hit(i) - FT) / d, e: 'proj', kind: 'canister', from: i % 2 ? 'muzzleL' : 'muzzleR', arc: 1, ground: true, scatter: 3, time: FT, spin: 6, snd: 'thump', r: 3 }))); }
  // Hot Shot: a furnace-heated ball, the wrist flicked up onto the line; the plate it strikes keeps smouldering
  { const tf = HT('d_hotshot', 0.22), d = 0.6;
    D1('d_hotshot', d, 'upper', [
      k(0, G), k(Math.max(0.04, (tf - 0.12) / d), AIM('R', { pitch: -30, reach: 0.44 }), { e: 'snap' }), k(tf / d, AIM('R'), { e: 'out' }),
      k((tf + 0.05) / d, AIM('R', { kick: 1 }), { e: 'out' }), k((tf + 0.22) / d, AIM('R', { kick: 0.15 })), k(1, G),
    ], [ball('R', { impact: 'hotball' })]); }
  // Both Pistols Dry (capstone): an even string of shots, right and left, both arms out level; then the hammers fall on
  // empty pans, one click from each
  { const d = 1.75, keys = [k(0, G), k(Math.max(0.04, (HT('d_dry', 0.2) - 0.12) / d), BOTH())];
    for (let i = 0; i < 6; i++) { const t = HT('d_dry', 0.2, i) / d, R1 = i % 2 === 0; keys.push(k(t, BOTH({ kR: R1 ? 0 : 0.15, kL: R1 ? 0.15 : 0 }), { hold: i === 0 }), k(t + 0.03, BOTH({ kR: R1 ? 1 : 0, kL: R1 ? 0 : 1 }), { e: 'out' })); }
    const tc = HT('d_dry', 0.2, 5) / d + 0.12;
    keys.push(k(tc, BOTH({ pitch: 0 })), k(tc + 0.1, BOTH({ pitch: -2 })), k(tc + 0.2, BOTH({ pitch: -10 })), k(1, G));
    D1('d_dry', d, 'upper', keys.filter((q, i, a) => i === 0 || q.t > a[i - 1].t).map((q, i) => (i === 1 ? { ...q, e: 'snap' } : q)), [
      ...[0, 1, 2, 3, 4, 5].map((i) => ball(i % 2 ? 'L' : 'R', { t: i ? 'hit' + (i + 1) : 'hit' })),
      { t: tc + 0.02, e: 'muzzle', side: 'R', dry: true }, { t: tc + 0.11, e: 'muzzle', side: 'L', dry: true },
    ]); }
  // ---- level 57 and 60 (Tidewater Sound) ----
  // Rock Salt Load: the pistol brought up from low on the right and squeezed off quickly; the salt bursts white
  { const tf = HT('d_saltshot', 0.22), d = 0.6;
    D1('d_saltshot', d, 'upper', [
      k(0, G), k(Math.max(0.04, (tf - 0.12) / d), AIM('R', { pitch: -20, reach: 0.46 }), { e: 'snap' }), k(tf / d, AIM('R'), { e: 'out' }),
      k((tf + 0.05) / d, AIM('R', { kick: 1.1 }), { e: 'out' }), k((tf + 0.22) / d, AIM('R', { kick: 0.15 })), k(1, G),
    ], [ball('R', { impact: 'salt' })]); }
  // Broadside (capstone): feet planted wide and square, both pistols up level side by side and fired together, three
  // times; each pair kicks both barrels up and rocks him back a little, and the arms come back onto the line between
  { const d = 1.5, WL = P(L.wide, { thighL: [-20, 0, 18], shinL: [40], thighR: [-6, 0, -18], shinR: [32] }), B = (kk) => BOTH({ inward: 0.14, reach: 0.54, kR: kk, kL: kk, kickK: 1.2 });
    const keys = [k(0, GL), k(Math.max(0.04, (HT('d_broadside', 0.3) - 0.14) / d), P(B(0), WL), { root: [0, -0.14, 0], e: 'snap' })];
    for (let i = 0; i < 3; i++) { const t = HT('d_broadside', 0.3, i) / d; keys.push(k(t, P(B(0), WL), { root: [0, -0.16, -0.06 * i], hold: true }), k(t + 0.05 / d, P(B(1), WL), { root: [0, -0.12, -0.06 * i - 0.08], e: 'out' }), k(t + 0.24 / d, P(B(0.1), WL), { root: [0, -0.15, -0.06 * i - 0.06] })); }
    keys.push(k(1, GL, { root: [0, 0, -0.18] }));
    D1('d_broadside', d, 'full', keys.filter((q, i, a) => i === 0 || q.t > a[i - 1].t).map((q, i) => (i === 1 ? { ...q, e: 'snap' } : q)), [
      ...[0, 1, 2].flatMap((i) => { const h = i ? 'hit' + (i + 1) : 'hit'; return [ball('R', { t: h, big: true }), ball('L', { t: h, big: true }), { t: h, e: 'shake', amt: 0.25 + 0.1 * i }]; }),
      { t: 'hit3', e: 'cloud', kind: 'gunsmoke', r: 3 },
    ], { endRoot: [0, 0, -0.18] }); }
  // ---- level 62 and 65 (the Rainward Gorge) ----
  // Gravel Load: the pistol brought up from low on the right and fired down at the tracks; grey gravel bursts off them
  { const tf = HT('d_gravel', 0.22), d = 0.6;
    D1('d_gravel', d, 'upper', [
      k(0, G), k(Math.max(0.04, (tf - 0.12) / d), AIM('R', { pitch: -24, reach: 0.46 }), { e: 'snap' }), k(tf / d, AIM('R', { pitch: -8 }), { e: 'out' }),
      k((tf + 0.05) / d, AIM('R', { pitch: -8, kick: 1.1 }), { e: 'out' }), k((tf + 0.22) / d, AIM('R', { pitch: -8, kick: 0.15 })), k(1, G),
    ], [ball('R', { impact: 'gravel' })]); }
  // Rolling Fire (capstone): down on one knee, the pistols fired one after the other at an even beat, right, left,
  // right, left, each laid low along the ground at the tracks; each shot kicks its barrel up and the arm comes back
  // onto the line for the next
  { const d = 1.6, KN = L.kneel, n = 4;
    const keys = [k(0, GL), k(Math.max(0.04, (HT('d_rollingfire', 0.3) - 0.16) / d), P(AIM('R', { pitch: -6 }), KN), { root: R.kneel, e: 'snap' })];
    for (let i = 0; i < n; i++) { const side = i % 2 ? 'L' : 'R', t = HT('d_rollingfire', 0.3, i) / d; keys.push(k(t, P(AIM(side, { pitch: -6 }), KN), { root: R.kneel, hold: true }), k(t + 0.05 / d, P(AIM(side, { pitch: -6, kick: 1.1 }), KN), { root: [0, -0.42, -0.08], e: 'out' }), k(t + 0.2 / d, P(AIM(i % 2 ? 'R' : 'L', { pitch: -6, kick: 0.1 }), KN), { root: R.kneel })); }
    keys.push(k(0.92, mixPose(P(AIM('L', { pitch: -6 }), KN), GL, 0.5), { root: [0, -0.22, -0.04] }), k(1, GL));
    D1('d_rollingfire', d, 'full', keys.filter((q, i, a) => i === 0 || q.t > a[i - 1].t).map((q, i) => (i === 1 ? { ...q, e: 'snap' } : q)), [
      ...[0, 1, 2, 3].flatMap((i) => { const h = i ? 'hit' + (i + 1) : 'hit'; return [ball(i % 2 ? 'L' : 'R', { t: h, impact: 'gravel' }), { t: h, e: 'shake', amt: 0.15 + 0.06 * i }]; }),
      { t: 'hit4', e: 'cloud', kind: 'gunsmoke', r: 3 },
    ]); }

  // ============================== S10: the Deadeye's new kit (combat_design.md 5.5) ==============================
  // Gun-kata in a long road coat: every core shot plays on the upper body over the running legs (BLEND), the planted moves
  // on the authored clips (Pistols_Twin_Shoot, Kneel_Aim, Backflip, Leap_Rise, Air_Hang_Loop, Slide_*), the pistols always
  // held parallel (never crossed), muzzle smoke a plain puff pushed along the barrel (fx.muzzle: no flash, no star), spent
  // brass flicked out of the pan side, gravel off the ground. Contact times from the new kit (kit.js / fusions.js), so the
  // ball leaves the barrel on the server's contact; multi-shots on their uneven hit.ts.
  {
    const K10 = (id, step) => { const s = CORE_BY_ID[id]; return step && s?.chain ? s.chain[step - 1] : s; };
    const brass = (side, t = 'hit') => ({ t, e: 'brass', side });
    const TS = (h, i) => (h.ts ? h.ts[Math.min(i, h.ts.length - 1)] : h.t + i * (h.gap || 0));
    const B2 = (o = {}) => BOTH({ inward: 0.12, kickK: 1.2, ...o });
    const DOWN2 = (tor) => P(G, tor, gunArm(tor, 'R', D2(-72), { reach: 0.46 }), gunArm(tor, 'L', D2(-72), { reach: 0.46 })); // (both barrels at the ground by the feet)
    // ---- Snap Shot: the right pistol, the left, then both together (each step its own clip)
    { const h = K10('d_snap', 1).hit; D1('d_snap', 0.5, 'upper', shot1(0.5, 'R', h.t), [ball('R'), brass('R')], { hit: h }); }
    { const h = K10('d_snap', 2).hit; D1('d_snap_2', 0.5, 'upper', shot1(0.5, 'L', h.t), [ball('L'), brass('L')], { skill: 'd_snap', hit: h, step: 2 }); }
    {
      const h = K10('d_snap', 3).hit, d = 0.6, tf = h.t;
      const keys3 = [k(0, G), k((tf - 0.12) / d, B2(), { e: 'snap' }), k(tf / d, B2(), { hold: true }), k((tf + 0.05) / d, B2({ kR: 1.1, kL: 1.1 }), { e: 'out' }), k((tf + 0.24) / d, B2({ kR: 0.15, kL: 0.15 })), k(1, G)];
      D1('d_snap_3', d, 'upper', keys3, [ball('R'), ball('L'), brass('R'), brass('L')], { skill: 'd_snap', hit: h, step: 3 });
      // Hot Shot (the Snap Shot Form): the third pair are furnace-heated balls that burn on the plate
      D1('d_snap_hot', d, 'upper', keys3, [ball('R', { impact: 'hotball' }), ball('L', { impact: 'hotball' }), brass('R'), brass('L')], { skill: 'd_snap', hit: h, step: 3 });
    }
    // ---- Paired Shot: both arms up level on Pistols_Twin_Shoot's raise, both barrels fired as one, both kick
    {
      const h = K10('d_pair').hit, d = 0.62, tf = h.t;
      D1('d_pair', d, 'upper', [k(0, G), k((tf - 0.12) / d, B2(), { e: 'snap' }), k(tf / d, B2(), { hold: true }), k((tf + 0.05) / d, B2({ kR: 1.25, kL: 1.25 }), { e: 'out' }), k((tf + 0.26) / d, B2({ kR: 0.15, kL: 0.15 })), k(1, G)],
        [ball('R', { big: true }), ball('L', { big: true }), brass('R'), brass('L')], { hit: h, ual: { mask: 'upper', segs: [['Pistols_Twin_Shoot', 0, tf, 0, 0.083]], end: tf } });
    }
    // ---- Recoil Jump: crouch on Leap_Rise with both barrels at the feet, the blast into the ground, then the kick carries him
    // up and back 7 m in the Backflip, landing crouched (Slam_Land); the arms stay keyed so the pistols never swing out wide
    const recoil = (id, dist, fwd, o = {}) => {
      const h = K10('d_recoil').hit, D = 0.95, tf = h.t, s = fwd ? 1 : -1, H = o.h || 1.5;
      const DN = DOWN2({ spine: [22, 0, 0], chest: [6, 0, 0], head: [10, 0, 0] });
      const keys = [k(0, GL), k(tf / D, P(DN, L.deep), { root: [0, -0.3, 0], e: 'out' })];
      for (let t = tf + 1 / 60; t < 0.72 - 1e-6; t += 1 / 60) { const u = (t - tf) / (0.72 - tf); keys.push(k(t / D, {}, { root: [0, +(H * Math.sin(Math.PI * u) - 0.3 * (1 - u)).toFixed(3), +(s * dist * (1 - (1 - u) ** 2)).toFixed(3)], e: 'linear' })); }
      keys.push(k(0.72 / D, P(G, { spine: [24, 0, 0] }, L.deep), { root: [0, -0.32, s * dist] }), k(1, GL, { root: [0, 0, s * dist] }));
      D1(id, D, 'full', keys.filter((q, i, a) => i === 0 || q.t > a[i - 1].t), [
        { t: 'hit', e: 'muzzle', side: 'R', ground: true, big: true }, { t: 'hit', e: 'muzzle', side: 'L', ground: true, big: true }, { t: 'hit', e: 'gravelSpray', n: 10, back: !fwd }, { t: 'hit', e: 'dash' },
        brass('R'), brass('L'), { t: 0.72 / D, e: 'dust' }, { t: 0.74 / D, e: 'gravelSpray', n: 5, back: fwd }],
      { skill: 'd_recoil', hit: h, endRoot: [0, 0, s * dist], ual: { mask: 'body', segs: fwd ? [['Leap_Rise', 0, 0.3, 0, 0.3], ['Air_Hang_Loop', 0.3, 0.6, 0, 0.3], ['Slam_Land', 0.68, D, 0.1, 0.58]] : [['Leap_Rise', 0, tf, 0, 0.15], ['Backflip', tf, 0.74, 0.25, 0.7], ['Slam_Land', 0.74, D, 0.2, 0.58]] } });
    };
    recoil('d_recoil', 7, false);
    recoil('d_recoil_fwd', 7, true); // (Forward Recoil: thrown forward instead, no flip)
    // ---- Knee Shot: the right pistol aimed low at a leg joint on the pistol clips (aim down, then the shot), over the run
    { const h = K10('d_knee').hit; D1('d_knee', 0.6, 'upper', shot1(0.6, 'R', h.t, { pitch: -14, torso: lean(TOR.R, 8) }), [ball('R', { low: true }), brass('R')], { hit: h, ual: { mask: 'upper', segs: [['Pistol_Aim_Down', 0, h.t, 0, 0.16], ['Pistol_Shoot', h.t, 0.5, 0.12, 0.5]], end: 0.45 } }); }
    // ---- Scatter Charge: from the hip on a step back, the twin-shoot raise first
    DEF.d_scatter = { ...DEF.d_scatter, hit: K10('d_scatter').hit, events: [...DEF.d_scatter.events, brass('R'), brass('L'), { t: 'hit', e: 'cloud', kind: 'gunsmoke', r: 2.5, cone: true }],
      ual: { mask: 'upper', segs: [['Pistols_Twin_Shoot', 0, 0.3, 0, 0.083], ['Pistols_Twin_Shoot', 0.3, 0.5, 0.083, 0.2]], end: 0.5 } };
    // ---- Fan the Hammer: the left palm sweeps the hammer for each of the six shots, on the new kit's uneven times
    {
      const h = K10('d_fan').hit, d = 1.0, T = { spine: [6, 8, 0], chest: [2, 4, 0], neck: [0, -4, 0], head: [0, -8, 0] };
      const FR = (kick) => gunArm(lean(T, -2 * kick), 'R', D2(2 + 14 * kick), { reach: 0.54 - 0.04 * kick });
      const FL = (lo) => gunArm(T, 'L', D2(4 - 6 * lo), { at: [-0.03 - 0.03 * lo, 1.6 - 0.06 * lo, 0.4 + 0.06 * lo], pole: [0.55, 1.2, -0.1] });
      const keys = [k(0, G), k(Math.max(0.04, (TS(h, 0) - 0.1) / d), P(G, T, FR(0), FL(0)), { e: 'out' })];
      for (let i = 0; i < 6; i++) { const t = TS(h, i) / d; keys.push(k(t - 0.02, P(G, T, FR(0), FL(1)), { e: 'in' }), k(t + 0.03, P(G, T, FR(0.6), FL(0.4)), { e: 'out' }), k(t + 0.06, P(G, T, FR(0.1), FL(0)))); }
      keys.push(k(1, G));
      D1('d_fan', d, 'upper', keys.filter((q, i, a) => i === 0 || q.t > a[i - 1].t), [...[0, 1, 2, 3, 4, 5].map((i) => ball('R', { t: i ? 'hit' + (i + 1) : 'hit' })), brass('R', 'hit2'), brass('R', 'hit4'), brass('R', 'hit6')], { hit: h });
    }
    // ---- Quickdraw: the draw is the same; spent brass after
    DEF.d_quick = { ...DEF.d_quick, hit: K10('d_quick').hit, events: [...DEF.d_quick.events, brass('R')] };

    // ---- the fusions (each opens fx.fuseBudget: at most 18 rocks; no lights; at most two rings a beat)
    // Recoil Vault (1.15 s, the signature): 0.06 both barrels into the ground (shotbig x2, two gravel sprays, a shake), the
    // body thrown up and back on the Backflip (root +2.8 m, 8 m back), 0.50 and 0.62 the apex shots down at the machine with
    // smoke streaks hanging in the air, 0.85 the landing in Slide_Exit with a dust and gravel spray
    {
      const D = 1.15, f = FUSION_BY_ID.df_recoilvault, h = f.hit, t1 = TS(h, 1), t2 = TS(h, 2);
      const DN = DOWN2({ spine: [24, 0, 0], chest: [8, 0, 0], head: [12, 0, 0] });
      const AT = (kR, kL) => B2({ pitch: -18, kR, kL, torso: { spine: [-4, 0, 0], chest: [-2, 0, 0], head: [8, 0, 0] } });
      const keys = [k(0, GL), k(0.06 / D, P(DN, L.deep), { root: [0, -0.32, 0], e: 'out' })];
      const y = (t) => (t < 0.42 ? 2.8 * (1 - (1 - (t - 0.06) / 0.36) ** 2) : t < 0.66 ? 2.8 - 0.25 * ((t - 0.42) / 0.24) : 2.55 * (1 - ((t - 0.66) / 0.19) ** 2));
      const z = (t) => -8 * (t < 0.66 ? 0.8 * (1 - (1 - (t - 0.06) / 0.6) ** 2) : 0.8 + 0.2 * ((t - 0.66) / 0.19));
      for (let t = 0.06 + 1 / 60; t < 0.85 - 1e-6; t += 1 / 60) keys.push(k(t / D, {}, { root: [0, +Math.max(0, y(t)).toFixed(3), +z(t).toFixed(3)], e: 'linear' }));
      keys.push(k(0.85 / D, P(G, B2({ kR: 0.2, kL: 0.2 }), L.kneel), { root: [0, -0.42, -8] }), k(1, GL, { root: [0, 0, -8.4], e: 'smooth' }));
      // the arms come round onto the machine for the apex shots (keyed: the flip's body carries them)
      const arms = [k((t1 - 0.08) / D, AT(0, 0)), k(t1 / D, AT(0, 0), { hold: true }), k((t1 + 0.04) / D, AT(1.1, 0), { e: 'out' }), k(t2 / D, AT(0.2, 0)), k((t2 + 0.04) / D, AT(0.1, 1.1), { e: 'out' }), k((t2 + 0.16) / D, AT(0.1, 0.2))];
      const all = [...keys, ...arms].sort((a, b) => a.t - b.t).filter((q, i, a) => i === 0 || q.t > a[i - 1].t + 1e-4);
      DEF.df_recoilvault = C('deadeye', D, 'full', all, [
        { t: 'hit', e: 'muzzle', side: 'R', ground: true, big: true }, { t: 'hit', e: 'muzzle', side: 'L', ground: true, big: true }, { t: 'hit', e: 'gravelSpray', n: 12, back: true }, { t: 'hit', e: 'gravelSpray', n: 10, back: true, side: 1 },
        { t: 'hit', e: 'shake', amt: 0.35 }, { t: 0.06 / D, e: 'camlift', up: 1.2, back: 2.2, dur: 1.0 }, brass('R'), brass('L'),
        ball('R', { t: 'hit2' }), ball('L', { t: 'hit3' }), { t: 'hit2', e: 'airSmoke', side: 'R' }, { t: 'hit3', e: 'airSmoke', side: 'L' }, brass('R', 'hit2'), brass('L', 'hit3'),
        { t: 0.85 / D, e: 'dust' }, { t: 0.86 / D, e: 'gravelSpray', n: 6, back: false }],
      { endRoot: [0, 0, -8.4], ual: { mask: 'body', segs: [['Leap_Rise', 0, 0.06, 0, 0.12], ['Backflip', 0.06, 0.42, 0.25, 0.64], ['Air_Hang_Loop', 0.42, 0.78, 0, 0.36], ['Slide_Exit', 0.8, D, 0, 0.5]] } });
    }
    // Overhead Pair (1.1 s): a forward recoil arc over the machine (both barrels kicked off the ground behind him), at the top
    // a held beat (his own stop, 0.1 s) and both pistols straight down into it (two soft puffs), then down behind it: one ring
    {
      const D = 1.1, h = FUSION_BY_ID.df_overhead.hit, tf = h.t - 0.1; // (the clip's shot sits 0.1 s early: the held beat makes up the time)
      const DWN = (kk) => P(G, { spine: [34, 0, 0], chest: [10, 0, 0], head: [30, 0, 0] }, gunArm({ spine: [34, 0, 0], chest: [10, 0, 0] }, 'R', D2(-84 + 10 * kk), { reach: 0.5 - 0.05 * kk }), gunArm({ spine: [34, 0, 0], chest: [10, 0, 0] }, 'L', D2(-84 + 10 * kk), { reach: 0.5 - 0.05 * kk }));
      const keys = [k(0, GL), k(0.08 / D, P(DOWN2({ spine: [20, 0, 0], chest: [6, 0, 0] }), L.deep), { root: [0, -0.3, 0] }), ...leapRoot(D, { t0: 0.1, t1: 0.36, t2: 0.5, t3: 0.74, h: 3.6, float: 0.1, dist: 6, atTop: 0.48, atEnd: 0.58 }),
        k((tf - 0.08) / D, DWN(0)), k(tf / D, DWN(0), { hold: true }), k((tf + 0.05) / D, DWN(1), { e: 'out' }), k(0.74 / D, P(G, B2({ kR: 0.2, kL: 0.2 }), L.deep), { root: [0, -0.34, 6] }), k(1, GL, { root: [0, 0, 6], e: 'smooth' })];
      DEF.df_overhead = C('deadeye', D, 'full', keys.sort((a, b) => a.t - b.t).filter((q, i, a) => i === 0 || q.t > a[i - 1].t + 1e-4), [
        { t: 0.08 / D, e: 'muzzle', side: 'R', ground: true }, { t: 0.08 / D, e: 'muzzle', side: 'L', ground: true }, { t: 0.1 / D, e: 'leap' }, { t: 0.1 / D, e: 'camlift', up: 2.0, back: 2.6, dur: 1.0 },
        { t: (tf - 0.04) / D, e: 'hitstop', dur: 0.1, self: true }, { t: tf / D, e: 'proj', kind: 'ball', from: 'muzzleR', big: true }, { t: tf / D, e: 'proj', kind: 'ball', from: 'muzzleL', big: true }, brass('R', tf / D), brass('L', tf / D),
        { t: 0.74 / D, e: 'ring', color: '#cfc6b4', r: 3.2 }, { t: 0.74 / D, e: 'dust' }],
      { endRoot: [0, 0, 6], toTarget: { gap: -2.6, max: 18, behind: true }, through: true, ual: { mask: 'body', segs: [['Leap_Rise', 0, 0.36, 0, 0.458], ['Air_Hang_Loop', 0.36, 0.56, 0, 0.2], ['Dive_Strike', 0.56, 0.72, 0.1, 0.33], ['Slam_Land', 0.72, D, 0.1, 0.58]] } });
    }
    // Plate Splitter (0.75 s): both arms up on the twin-shoot raise, both hardened balls into the rivet line together: plate
    // chips and sparks off the staggered machine
    {
      const D = 0.75, tf = FUSION_BY_ID.df_platesplitter.hit.t;
      D1('df_platesplitter', D, 'upper', [k(0, G), k((tf - 0.12) / D, B2({ inward: 0.16 }), { e: 'snap' }), k(tf / D, B2({ inward: 0.16 }), { hold: true }), k((tf + 0.05) / D, B2({ inward: 0.16, kR: 1.3, kL: 1.3 }), { e: 'out' }), k((tf + 0.28) / D, B2({ inward: 0.16, kR: 0.15, kL: 0.15 })), k(1, G)],
        [ball('R', { big: true, impact: 'plates' }), ball('L', { big: true }), brass('R'), brass('L')], { ual: { mask: 'upper', segs: [['Pistols_Twin_Shoot', 0, tf, 0, 0.083]], end: tf } });
    }
    // Chain Shot (0.8 s): both pistols together send the two balls on their straight chain, spinning flat as one bar (it never
    // crosses itself), wrapping the machine and the one beside it; the chain's rattle
    {
      const D = 0.8, tf = FUSION_BY_ID.df_chainshot.hit.t;
      D1('df_chainshot', D, 'upper', [k(0, G), k((tf - 0.12) / D, B2({ pitch: -8, inward: 0.18 }), { e: 'snap' }), k(tf / D, B2({ pitch: -8, inward: 0.18 }), { hold: true }), k((tf + 0.05) / D, B2({ pitch: -8, inward: 0.18, kR: 1.1, kL: 1.1 }), { e: 'out' }), k((tf + 0.28) / D, B2({ kR: 0.1, kL: 0.1 })), k(1, G)],
        [{ t: 'hit', e: 'muzzle', side: 'R' }, { t: 'hit', e: 'proj', kind: 'chainshot', from: 'muzzleL', spin: 14, low: true, time: 0.16 }, { t: 'hit', e: 'sound', s: 'chain' }, brass('R'), brass('L')], { ual: { mask: 'upper', segs: [['Pistols_Twin_Shoot', 0, tf, 0, 0.083]], end: tf } });
    }
    // Point Blank (0.95 s): a step in through the smoke; 0.20 the pistol grip cracked across the plate on Melee_Hook (T2); 0.50
    // both barrels against it (T4): the machine thrown back trailing smoke
    {
      const D = 0.95, h = FUSION_BY_ID.df_pointblank.hit, t1 = TS(h, 1);
      const PB = (kk) => B2({ inward: 0.14, reach: 0.4, pitch: -6, kR: kk, kL: kk, kickK: 1.5, torso: { spine: [14, 0, 0], chest: [6, 0, 0], head: [4, 0, 0] } });
      DEF.df_pointblank = C('deadeye', D, 'full', [
        k(0, GL), k(0.12 / D, P(G, { spine: [18, -10, 0] }, L.lungeL), { root: [0, -0.16, 2.6], e: 'out' }),
        k(0.3 / D, P(G, { spine: [10, 20, 0] }, L.stepL), { root: [0, -0.1, 3.4] }),
        k((t1 - 0.1) / D, P(PB(0), L.wide), { root: [0, -0.14, 3.6], e: 'snap' }), k(t1 / D, P(PB(0), L.wide), { root: [0, -0.14, 3.6], hold: true }),
        k((t1 + 0.06) / D, P(PB(1.2), L.stepBack), { root: [0, -0.1, 3.3], e: 'out' }), k((t1 + 0.3) / D, P(PB(0.2), L.stepBack), { root: [0, -0.06, 3.2] }), k(1, GL, { root: [0, 0, 3.2], e: 'smooth' }),
      ], [{ t: 0.02, e: 'dash' }, { t: 0.04, e: 'cloud', kind: 'gunsmoke', r: 1.6, at: 'self' }, { t: 'hit', e: 'impact', kind: 'clang', at: 'target' },
        { t: 'hit2', e: 'muzzle', side: 'R', big: true }, { t: 'hit2', e: 'muzzle', side: 'L', big: true }, { t: 'hit2', e: 'impact', kind: 'ball', at: 'target' }, { t: 'hit2', e: 'smokeTrail', dur: 0.7 }, brass('R', 'hit2'), brass('L', 'hit2')],
      { endRoot: [0, 0, 3.2], toTarget: { gap: 1.2, max: 7 }, ual: { mask: 'body', segs: [['Melee_Hook', 0.08, 0.36, 0.05, 0.42]], end: 0.36 } });
    }
    // Broadside (1.6 s): down on one knee on Kneel_Aim (the body), the arms keyed: right, left, right, left at the uneven
    // gaps, each pair of balls heavy, smoke piling up in front. Twelve Rounds (Six Chambers): the same kneel, both cylinders
    // emptied right and left, twelve shots
    const kneelFire = (id, n, skill, hitRec, D) => {
      const KN = L.kneel, keys = [k(0, GL), k(Math.max(0.04, (TS(hitRec, 0) - 0.16) / D), P(AIM('R', { pitch: -6 }), KN), { root: R.kneel, e: 'snap' })];
      for (let i = 0; i < n; i++) { const side = i % 2 ? 'L' : 'R', t = TS(hitRec, i) / D; keys.push(k(t, P(AIM(side, { pitch: -6 }), KN), { root: R.kneel, hold: true }), k(t + 0.04 / D, P(AIM(side, { pitch: -6, kick: 1.2 }), KN), { root: [0, -0.42, -0.08], e: 'out' }), k(t + 0.1 / D, P(AIM(i % 2 ? 'R' : 'L', { pitch: -6, kick: 0.1 }), KN), { root: R.kneel })); }
      keys.push(k(0.94, mixPose(P(AIM('L', { pitch: -6 }), KN), GL, 0.5), { root: [0, -0.22, -0.04] }), k(1, GL));
      const evs = [];
      for (let i = 0; i < n; i++) { const hh = i ? 'hit' + (i + 1) : 'hit'; evs.push(ball(i % 2 ? 'L' : 'R', { t: hh, big: n <= 4 }), { t: hh, e: 'shake', amt: n <= 4 ? 0.18 + 0.05 * i : 0.08 }); if (i % 2 === 1 && (n <= 4 || i % 4 === 3)) evs.push({ t: hh, e: 'cloud', kind: 'gunsmoke', r: 1.0 + 0.2 * Math.min(i, 4), cone: true }); /* (small: the smoke piles up in front, he stays in sight) */ if (i % 3 === 0) evs.push(brass(i % 2 ? 'L' : 'R', hh)); }
      DEF[id] = C('deadeye', D, 'full', keys.filter((q, i, a) => i === 0 || q.t > a[i - 1].t + 1e-4), evs, { skill, hit: hitRec, ual: { mask: 'body', segs: [['Kneel_Aim', 0, 0.3, 0, 0.42], ['Kneel_Aim', 0.3, D - 0.3, 0.42, 0.45], ['Kneel_Aim', D - 0.3, D, 0.8, 1.0]] } });
    };
    kneelFire('df_broadside', 4, 'df_broadside', FUSION_BY_ID.df_broadside.hit, 1.6);
    kneelFire('df_twelve', 12, 'df_broadside', { ...FUSION_BY_ID.df_broadside.hit, n: 12, ts: [0.34, 0.42, 0.52, 0.59, 0.7, 0.78, 0.9, 0.97, 1.08, 1.16, 1.27, 1.36] }, 1.7);
    // Slide Shot (0.7 s): still low out of the slide, on one knee, both barrels tipped up and the loose shot fired upward; a
    // gravel spray along the slide behind him
    {
      const D = 0.7, tf = FUSION_BY_ID.df_slideshot.hit.t;
      const UP = (kk) => P(HIP({ pitch: 18 + 10 * kk, y: 0.92, kR: kk, kL: kk, torso: { spine: [-6, 0, 0], chest: [-4, 0, 0], head: [-8, 0, 0] } }), L.kneel);
      DEF.df_slideshot = C('deadeye', D, 'full', [k(0, P(UP(0), {}), { root: [0, -0.44, 0] }), k(tf / D, UP(0), { root: [0, -0.44, 0.2], hold: true }), k((tf + 0.06) / D, UP(1), { root: [0, -0.42, 0.1], e: 'out' }), k(0.62, UP(0.15), { root: [0, -0.4, 0.1] }), k(1, GL, { root: [0, 0, 0.1], e: 'smooth' })],
        [{ t: 'hit', e: 'muzzle', side: 'R', scatter: true }, { t: 'hit', e: 'muzzle', side: 'L', scatter: true }, { t: 'hit', e: 'impact', kind: 'gravel', at: 'cone' }, { t: 0.02, e: 'gravelSpray', n: 10, back: true }, brass('R'), brass('L')],
      { endRoot: [0, 0, 0.1], ual: { mask: 'body', segs: [['Slide_Exit', 0, 0.12, 0.05, 0.12], ['Kneel_Aim', 0.12, 0.45, 0.25, 0.42], ['Kneel_Aim', 0.45, D, 0.8, 1.0]] } });
    }
    // Last Round (0.85 s): both pistols raised slowly onto the line, a held breath (a 0.15 s still pose, a click of the locks),
    // then the heavy double charge: a big kick that rocks him back
    {
      const D = 0.85, tf = FUSION_BY_ID.df_lastround.hit.t, LB = (kk) => B2({ inward: 0.16, reach: 0.55, kR: kk, kL: kk, kickK: 1.6, torso: { spine: [8, 0, 0], chest: [4, 0, 0], head: [2, 0, 0] } });
      D1('df_lastround', D, 'upper', [k(0, G), k(0.12 / D, LB(0), { e: 'out' }), k(0.15 / D, LB(0), { hold: true }), k(tf / D - 0.005, LB(0), { hold: true }), k(tf / D, LB(0), { hold: true }), k((tf + 0.07) / D, LB(1), { e: 'out' }), k((tf + 0.34) / D, LB(0.2)), k(1, G)],
        [{ t: 0.14 / D, e: 'sound', s: 'click' }, ball('R', { big: true }), ball('L', { big: true }), { t: 'hit', e: 'shake', amt: 0.4 }, brass('R'), brass('L')], { ual: { mask: 'upper', segs: [['Pistols_Twin_Shoot', 0, 0.15, 0, 0.083]], end: 0.15 } });
    }
    // Falling Storm (1.6 s, the triad): both barrels kick him up off the ground once more (4 m), then a slow drop with the
    // right pistol fanned straight down, twelve shots scattered over 8 m round the machine at uneven gaps, gun smoke hanging
    // round him; Slam_Land, one ring at the last shot
    {
      const D = 1.6, h = FUSION_BY_ID.dt_fallingstorm.hit;
      const T = { spine: [30, 8, 0], chest: [10, 4, 0], neck: [0, -4, 0], head: [24, -8, 0] };
      const FR = (kick) => gunArm(T, 'R', D2(-70 + 12 * kick), { reach: 0.5 - 0.04 * kick });
      const FL = (lo) => gunArm(T, 'L', D2(-64 - 6 * lo), { at: [-0.03 - 0.03 * lo, 1.38 - 0.06 * lo, 0.44 + 0.04 * lo], pole: [0.55, 1.2, -0.1] });
      const y = (t) => (t < 0.06 ? 0 : t < 0.3 ? 4 * (1 - (1 - (t - 0.06) / 0.24) ** 2) : t < 1.22 ? 4 - 3.4 * ((t - 0.3) / 0.92) ** 1.6 : Math.max(0, 0.6 * (1 - ((t - 1.22) / 0.08))));
      const keys = [k(0, GL), k(0.05 / D, P(DOWN2({ spine: [20, 0, 0], chest: [6, 0, 0] }), L.deep), { root: [0, -0.3, 0] })];
      for (let t = 0.06 + 1 / 60; t < 1.3 - 1e-6; t += 1 / 60) keys.push(k(t / D, {}, { root: [0, +y(t).toFixed(3), 0], e: 'linear' }));
      for (let i = 0; i < 12; i++) { const t = TS(h, i); keys.push(k((t - 0.02) / D, P(G, T, FR(0), FL(1)), { e: 'in' }), k((t + 0.03) / D, P(G, T, FR(0.6), FL(0.3)), { e: 'out' })); }
      keys.push(k(1.3 / D, P(G, { spine: [24, 0, 0] }, L.deep), { root: [0, -0.32, 0] }), k(1, GL, { root: [0, 0, 0], e: 'smooth' }));
      DEF.dt_fallingstorm = C('deadeye', D, 'full', keys.sort((a, b) => a.t - b.t).filter((q, i, a) => i === 0 || q.t > a[i - 1].t + 1e-4), [
        { t: 0.05 / D, e: 'muzzle', side: 'R', ground: true, big: true }, { t: 0.05 / D, e: 'muzzle', side: 'L', ground: true, big: true }, { t: 0.06 / D, e: 'leap' }, { t: 0.06 / D, e: 'camlift', up: 2.4, back: 3, dur: 1.4 },
        ...Array.from({ length: 12 }, (_, i) => ({ t: i ? 'hit' + (i + 1) : 'hit', e: 'proj', kind: 'ball', from: 'muzzleR', ground: true, scatter: 4 })),
        ...[1, 4, 7, 10].map((i) => brass('R', 'hit' + (i + 1))), { t: 'hit6', e: 'cloud', kind: 'gunsmoke', r: 3 },
        { t: 'hit12', e: 'ring', color: '#cfc6b4', r: 4 }, { t: 'hit12', e: 'shake', amt: 0.5 }, { t: 1.3 / D, e: 'dust' }],
      { ual: { mask: 'body', segs: [['Leap_Rise', 0, 0.3, 0.1, 0.458], ['Air_Hang_Loop', 0.3, 0.8, 0, 0.5], ['Air_Hang_Loop', 0.8, 1.24, 0, 0.44], ['Slam_Land', 1.24, D, 0.1, 0.58]] } });
    }
  }
}

// --------------------------------------------------------------------------
// Strike timing pass. Every 'snap' key is a contact: the segment into it becomes a whip (slow last bit of wind-up,
// hard acceleration into the hit) lasting at least ~0.12s, the contact pose is held for a beat, and the
// follow-through leaves it decelerating ('out'). Explicit 'whip'/'in'/'linear' keys are left as authored.
function retime(keys, dur, strike = 0.12) {
  const out = keys.map((q) => ({ ...q }));
  for (let i = 1; i < out.length; i++) {
    const kk = out[i];
    if (kk.e !== 'snap') continue;
    kk.e = 'whip';
    const prev = out[i - 1], prev2 = out[i - 2];
    const want = kk.t - strike / dur;
    if (prev2 && prev.t > want) prev.t = Math.max(want, prev2.t + Math.min(0.07 / dur, (prev.t - prev2.t) * 0.6));
    const next = out[i + 1];
    const ht = kk.t + 0.035 / dur;
    if (next && next.t - ht > 0.05 / dur) { out.splice(i + 1, 0, { t: ht, p: {}, hold: true }); i++; }
    const ft = out[i + 1];
    if (ft && !ft.e && i + 2 < out.length) ft.e = 'out';
  }
  return out;
}
// Robed casters: lunges are shallower so the knee never punches through the robe (kneels and squats keep their depth)
function robeLegs(keys) {
  return keys.map((q) => {
    if (!q.p) return q;
    let p = q.p;
    for (const s of ['L', 'R']) {
      const th = p['thigh' + s], sh = p['shin' + s];
      if (th && th[0] < -45 && (!sh || sh[0] < 75)) { if (p === q.p) p = { ...p }; p['thigh' + s] = [-45, th[1] || 0, th[2] || 0]; }
    }
    return p === q.p ? q : { ...q, p };
  });
}
// Clips that play on the upper body while the legs keep running: every basic attack, and the instant shots and throws.
const BLEND = new Set([
  'k_valiant', 'k_pommel', 'k_shieldthrow', 's_slash', 's_slash_2', 's_slash_3', 's_slash_4', 's_shieldspin', 'w_blow', 'w_blow_2', 'w_blow_3', 'w_toss', 'c_staff', 'h_sweep',
  'r_quick', 'r_twin', 'r_pierce', 'r_explosive', 'r_smoke', 'r_arcing', 'r_fan', 'r_pin', 'r_mark', 'r_volley', 'r_barrage',
  'c_acid', 'c_tar', 'c_shrapnel', 'c_corrosive', 'c_chain', 'c_flash',
  'h_dart', 'h_poultice', 'h_net', 'h_antidote', 'h_bark', 'h_sap', 'h_seed',
  // the Deadeye fires on the run: every shot plays on the upper body (Powder Storm and Pressure Volley too)
  'd_snap', 'd_snap_l', 'd_pair', 'd_reload', 'd_powderburn', 'd_knee', 'd_fan', 'd_chalk', 'd_ricochet', 'd_cartridge', 'd_slug', 'd_chain', 'd_quick',
  'd_lastround', 'd_splitter', 'd_hotshot', 'd_dry', 'd_storm', 'd_pressure', 'd_saltshot', 'd_gravel',
  'd_snap_2', 'd_snap_3', 'd_snap_hot', 'df_platesplitter', 'df_chainshot', 'df_lastround', // (S10: the new kit's shots on the run)
  'r_quick_2', 'r_quick_3', 'r_quick_3r', 'rf_ricochet', // (S11: the Ranger's shots on the run)
]);
const MELEE = new Set(['slash', 'blunt', 'pierce', 'sweep', 'shield', 'sand', 'execute', 'shatter', 'earth']);

// ============================== S8: the Sandblade's new kit (combat_design.md 5.3) ==============================
// The four steps of Sand Slash each have a clip (s_slash, s_slash_2..4: forehand, backhand, a jab with the shield rim, a
// stepping diagonal; each trail is off before the next starts, so no two cross); Counter Stance is a held stance and its
// answer a clip of its own (s_counter_hit, the server's 'counter'); Desert Step lands behind the machine; and the nine
// fusions. Spins that turn faster than the trail fades leave no blade trail (it would close into a ring from above): the
// sand carries them. Every effect is sand, grit, sparks or heat; at most two rings a beat; rocks within fx.js fuseBudget.
{
  const G = P(guard('sandblade'), { spine: [10, 0, 0] }), GL = P(G, LG), T = TRAIL.sandblade;
  const SH = { armL: [-44, 70, 24], foreL: [-98, 0, 0] };
  const SHUP = { armL: [-86, 74, 28], foreL: [-108, 0, 0] }; // (the round shield raised in front)
  const S8 = (id, dur, keys, ev, o = {}) => (DEF[id] = C('sandblade', dur, 'full', keys, ev, o));
  // ---- Sand Slash, steps 2-4 (step 1 is the old s_slash clip, a flat forehand)
  S8('s_slash_2', 0.55, [
    k(0, GL),
    ...swing(0.55, 0.2, { wind: 92, mid: 46, hit: -5, follow: -62, end: -78 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? 30 : role === 'follow' || role === 'end' ? -20 : 5, dy: -0.28, r: role === 'wind' ? 0.36 : 0.44 }), role === 'wind' ? L.stepL : L.lungeR), { root: [0, -0.06, role === 'wind' ? 0.04 : 0.2], e }], 1100),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.04, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash' }, { t: 0.62, e: 'trail', on: false }], { skill: 's_slash', hit: { t: 0.2 }, step: 2 });
  // the shield rim driven straight out at the seam (left arm), the blade held back low
  S8('s_slash_3', 0.5, [
    k(0, GL),
    k(0.14, P(G, { spine: [6, 30, 0], chest: [2, 14, 0], armL: [-40, 60, 50], foreL: [-120, 0, 0], armR: [-20, 0, -40], foreR: [-40, 0, 0], head: [0, -20, 0] }, L.stepBack), { root: [0, -0.06, -0.06] }),
    k(0.36, P(G, { spine: [18, -26, 0], chest: [6, -14, 0], armL: [-92, 14, 6], foreL: [-12, 0, 0], armR: [-10, 0, -50], foreR: [-50, 0, 0], head: [6, 18, 0] }, L.lungeL), { root: [0, -0.16, 0.34], e: 'snap' }),
    k(0.6, P(G, { spine: [14, -18, 0], armL: [-84, 20, 10], foreL: [-30, 0, 0] }, L.lungeL), { root: [0, -0.12, 0.32] }),
    k(1, GL, { root: [0, 0, 0.3], e: 'smooth' }),
  ], [{ t: 0.08, e: 'sound', s: 'whoosh' }, { t: 'hit', e: 'impact', kind: 'shield', at: 'target' }, { t: 'hit', e: 'dust' }], { skill: 's_slash', hit: { t: 0.18 }, step: 3, endRoot: [0, 0, 0.3] });
  // a stepping cut down from high on the right to low on the left, the heavier last step
  S8('s_slash_4', 0.7, [
    k(0, GL),
    k(0.12, P(SH, arc(-72, { lead: -30, dy: 0.12, r: 0.38, tilt: -32, bend: 2 }), L.stepBack), { root: [0, -0.02, -0.04] }),
    ...swing(0.7, 0.3, { wind: -100, mid: -52, hit: 4, follow: 56, end: 70 }, (a, role, e) => {
      const f = Math.min(1, Math.max(0, (a + 100) / 170));
      return [P(SH, arc(a, { lead: role === 'wind' ? -28 : role === 'follow' || role === 'end' ? 22 : -4, dy: 0.14 - 0.56 * f, tilt: -36 + 66 * f, bend: 4 + 20 * f, r: role === 'wind' ? 0.38 : 0.46 }), role === 'wind' ? L.stepBack : P(L.lungeL, { thighL: [-72, 0, 6], shinL: [70] })), { root: role === 'wind' ? [0, -0.02, -0.04] : [0, -0.22, 0.42], e }];
    }, 1150),
    k(1, GL, { root: [0, 0, 0.4], e: 'smooth' }),
  ], [{ t: 0.1, e: 'trail', on: true, color: T, w: 1.2 }, { t: 'hit', e: 'impact', kind: 'slash' }, { t: 'hit', e: 'impact', kind: 'sand', at: 'target' }, { t: 0.7, e: 'trail', on: false }], { skill: 's_slash', hit: { t: 0.3 }, step: 4, endRoot: [0, 0, 0.4] });
  // ---- Desert Step: the blur ends 1.6 m behind the machine (through it), low; sand where it starts, along it and where it ends
  DEF.s_step = { ...DEF.s_step, events: [{ t: 0.03, e: 'dash' }, { t: 0.03, e: 'cloud', kind: 'sand', r: 1.6, at: 'self' }, { t: 0.05, e: 'sandtrail', dur: 0.22, rate: 90 }, { t: 0.5, e: 'cloud', kind: 'sand', r: 1.6, at: 'self' }, { t: 'hit', e: 'impact', kind: 'slash', at: 'target' }],
    toTarget: { gap: -1.6, max: 8, behind: true }, through: true, ual: { mask: 'body', segs: [['Slide_Start', 0, 0.22, 0.1, 0.5], ['Slide_Exit', 0.22, 0.55, 0, 0.5]], end: 0.5 } };
  // ---- Searing Edge (the Needle Thrust Form): the same thrust with the edge heated, a dull red that cools over 2 s
  DEF.s_needle_hot = { ...DEF.s_needle, skill: 's_needle', events: [...DEF.s_needle.events, { t: 0.02, e: 'bladeGlow', color: '#e0602a', dur: 2 }] };
  // ---- Counter Stance: low behind the raised round shield, blade drawn back, held for the second; the answer is its own clip
  DEF.s_counter = C('sandblade', 1.15, 'full', [
    k(0, GL),
    k(0.12, P(arc(-84, { lead: -30, dy: -0.32, twist: -20 }), SHUP, L.deep), { root: [0, -0.32, -0.04], e: 'out' }),
    k(0.85, P(arc(-86, { lead: -30, dy: -0.32, twist: -22 }), SHUP, L.deep), { root: [0, -0.32, -0.04] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.05, e: 'dust' }, { t: 0.1, e: 'sound', s: 'scrape' }], { skill: 's_counter' });
  DEF.s_counter_hit = C('sandblade', 0.7, 'full', [
    k(0, P(arc(-86, { lead: -30, dy: -0.32, twist: -22 }), SHUP, L.deep), { root: [0, -0.32, -0.04] }),
    k(0.12, P(arc(-90, { lead: -30, dy: -0.3, twist: -26 }), SHUP, L.stepBack), { root: [-0.35, -0.24, 0] }),
    ...swing(0.7, 0.28, { wind: -100, mid: -48, hit: 6, follow: 62, end: 78 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? -30 : role === 'follow' || role === 'end' ? 22 : 0, dy: -0.2 }), role === 'wind' ? L.deep : L.lungeL), { root: role === 'wind' ? [-0.4, -0.26, 0] : [-0.45, -0.16, 0.34], e }], 1300),
    k(1, GL, { root: [-0.45, 0, 0.3], e: 'smooth' }),
  ], [{ t: 0, e: 'impact', kind: 'parry', at: 'shieldL' }, { t: 0.1, e: 'trail', on: true, color: T }, { t: 'hit', e: 'impact', kind: 'slash', at: 'target' }, { t: 0.7, e: 'trail', on: false }], { skill: 's_counter', hit: { t: 0.28 }, endRoot: [-0.45, 0, 0.3] });

  // ---- the fusions
  // Sandspout (1.4 s): a crouch, three rising spins (root 0 to 3.5 m) inside a column of sand puffs, one at the top, a dive
  // cut down onto the machines (T4 at 0.90, the server's fifth contact): a ring r4 and sand thrown out as puffs. The spins
  // turn faster than a trail fades, so the blade leaves none until the dive
  {
    const D = 1.4;
    S8('sf_sandspout', D, [
      k(0, GL),
      ...leapRoot(D, { t0: 0.1, t1: 0.66, t2: 0.78, t3: 0.9, h: 3.5, float: 0.1, dist: 0 }),
      k(1, GL, { root: [0, 0, 0], e: 'smooth' }),
    ], [{ t: 0, e: 'sound', s: 'whoosh' }, { t: 0.02 / D, e: 'dust' }, { t: 0.1 / D, e: 'leap' }, { t: 0.1 / D, e: 'sandcol', dur: 0.7, h: 3.8, r: 1.6 },
      { t: 0.1 / D, e: 'camlift', up: 2.2, back: 2.6, dur: 1.1 }, { t: 0.12 / D, e: 'sound', s: 'whirr' }, { t: 0.42 / D, e: 'sound', s: 'whirr' },
      { t: 'hit', e: 'impact', kind: 'slash', at: 'target' }, { t: 'hit2', e: 'impact', kind: 'slash', at: 'target' }, { t: 'hit3', e: 'impact', kind: 'slash', at: 'target' }, { t: 'hit4', e: 'impact', kind: 'slash', at: 'target' },
      { t: 0.7 / D, e: 'cloud', kind: 'sand', r: 3.5, at: 'self' }, { t: 0.79 / D, e: 'trail', on: true, color: T, w: 0.9 },
      { t: 'hit5', e: 'impact', kind: 'sand', at: 'self', r: 4 }, { t: 'hit5', e: 'ring', color: '#d8c090', r: 4 }, { t: 'hit5', e: 'sandburst', r: 4, n: 30 }, { t: 0.98 / D, e: 'trail', on: false }],
    { ual: { mask: 'full', segs: [['Leap_Rise', 0, 0.12, 0, 0.12], ['Spin_Attack_Loop', 0.12, 0.3], ['Spin_Attack_Loop', 0.3, 0.48], ['Spin_Attack_Loop', 0.48, 0.66], ['Spin_Attack_Loop', 0.66, 0.8], ['Dive_Strike', 0.78, 0.9], ['Slam_Land', 0.9, D]] } });
  }
  // Glasscutter (0.75 s): the slide's last stride into a straight thrust at the seam; a hot line along the blade, a stop
  // of 0.1 s, a thin spray of dark oil and sparks off the edge
  S8('sf_glasscutter', 0.75, [
    k(0, P(SH, { spine: [26, 0, 0], armR: [0, 0, -40], foreR: [-30, 0, 0] }, L.lungeR), { root: [0, -0.2, 0] }),
    k(0.12 / 0.75, P(SH, wield({ spine: [6, -30, 0], chest: [-2, -10, 0], head: [0, 30, 0] }, [-0.36, 1.18, -0.12], [0.08, 0.06, 1], [-0.7, 1.0, -0.2]), L.deep), { root: [0, -0.3, 0.1] }),
    k(0.2 / 0.75, P(SH, wield({ spine: [24, 22, 0], chest: [6, 6, 0], head: [0, -22, 0] }, [-0.06, 1.26, 0.66], [0.04, -0.02, 1], [-0.6, 1.0, 0.2]), P(L.lungeL, { thighL: [-80, 0, 6], shinL: [80] })), { root: [0, -0.26, 0.5], e: 'snap' }),
    k(0.6, P(SH, wield({ spine: [22, 20, 0], chest: [6, 6, 0], head: [0, -20, 0] }, [-0.06, 1.25, 0.64], [0.04, -0.03, 1], [-0.6, 1.0, 0.2]), P(L.lungeL, { thighL: [-78, 0, 6], shinL: [78] })), { root: [0, -0.26, 0.5] }),
    k(1, GL, { root: [0, 0, 0.5], e: 'smooth' }),
  ], [{ t: 0.02, e: 'bladeGlow', color: '#ff9a40', dur: 0.7 }, { t: 0.1, e: 'trail', on: true, color: '#ffb070', w: 0.55 }, { t: 'hit', e: 'impact', kind: 'pierce', at: 'target' },
    { t: 'hit', e: 'sparks', at: 'weaponTip', dur: 0.18 }, { t: 'hit', e: 'impact', kind: 'oil', at: 'target' }, { t: 0.5, e: 'trail', on: false }],
  { endRoot: [0, 0, 0.5], ual: { mask: 'body', segs: [['Slide_Exit', 0, 0.2, 0.2, 0.5]], end: 0.2 } });
  // Sirocco (1.0 s): three dashes through the machine on a W seen from above (always on forward, never crossing itself),
  // a flat cut each (forehand, backhand, forehand at three heights), three fading sand shapes left behind; the third a T4
  {
    const D = 1.0, pts = [[1.1, 1.7], [-1.0, 3.2], [0.9, 4.7]], hits = [0.16, 0.34, 0.52];
    const keys = [k(0, GL), k(0.06 / D, P(SH, arc(-60, { lead: -20, dy: -0.2 }), L.deep), { root: [0, -0.3, 0], e: 'smooth' })];
    pts.forEach(([x, z], i) => {
      const fore = i % 2 === 0;
      keys.push(k((hits[i] - 0.05) / D, P(SH, arc(fore ? -70 : 70, { lead: fore ? -20 : 20, dy: -0.15 - 0.1 * i, bend: 18 }), fore ? L.lungeR : L.lungeL), { root: [x * 0.6, -0.18, z - 0.7], turn: fore ? -12 : 12, e: 'in' }));
      keys.push(k(hits[i] / D, P(SH, arc(fore ? 30 : -30, { lead: fore ? 20 : -20, dy: -0.15 - 0.1 * i, bend: 18 }), fore ? L.lungeL : L.lungeR), { root: [x, -0.16, z], turn: fore ? -12 : 12, e: 'snap' }));
    });
    keys.push(k(0.72, P(SH, arc(30, { lead: 20, dy: -0.36, bend: 24 }), L.deep), { root: [0.6, -0.36, 4.9], turn: 0, e: 'out' }));
    keys.push(k(1, GL, { root: [0.5, 0, 4.9], e: 'smooth' }));
    S8('sf_sirocco', D, keys, [{ t: 0.04, e: 'dash' }, { t: 0.06, e: 'sandtrail', dur: 0.55, rate: 70 },
      ...hits.map((h, i) => [{ t: (h - 0.09) / D, e: 'trail', on: true, color: T, w: 0.8 }, { t: i ? 'hit' + (i + 1) : 'hit', e: 'impact', kind: 'slash', at: 'target' }, { t: (h + 0.07) / D, e: 'trail', on: false }]).flat(),
      { t: 'hit3', e: 'impact', kind: 'sand', at: 'target' }, { t: 0.74, e: 'dust' }],
    { endRoot: [0.5, 0, 4.9], toTarget: { gap: -2.4, max: 7, behind: true }, through: true });
  }
  // Dust Whirl (0.9 s): the kick throws the sand, then one turn on the authored spin as the sand rises into a column round
  // him (fx 'vortex', 4 s, follows the hero; the server's 'column' event ends it); a soft top, no disc; T0 ticks from the zone
  S8('sf_dustwhirl', 0.9, [
    k(0, GL),
    k(0.1, P(SH, { spine: [10, 0, 0] }, { thighR: [30, 0, -6], shinR: [60], footR: [40], thighL: [-30, 0, 4], shinL: [50] }), { root: [0, -0.16, 0] }),
    k(0.2, P(SH, { spine: [-14, 0, 0], armR: [-20, 0, -60] }, { thighR: [-80, 0, -6], shinR: [20], footR: [-10], thighL: [-20, 0, 4], shinL: [40] }), { root: [0, -0.12, 0.06], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.2, e: 'cloud', kind: 'sand', r: 3, cone: true }, { t: 0.25, e: 'sound', s: 'whirr' }, { t: 0.28, e: 'vortex', r: 3, dur: 4, hold: true }, { t: 'hit', e: 'impact', kind: 'sand', at: 'self', r: 3.5 }],
  { ual: { mask: 'full', segs: [['Kick_Front', 0, 0.24, 0.1, 0.36], ['Spin_Attack_Loop', 0.24, 0.62]], end: 0.62 } });
  // Thousand Cuts (1.3 s): five short dashes through the machine on a zig-zag that never crosses itself (low sand streaks,
  // no blade trail), out of reach; down on one knee at 0.8 with the blade held out flat to the right; 0.1 s of nothing; at
  // 0.9 every cut lands at once: five spark sprays on the machine, T4, crack, camera punch
  {
    const D = 1.3, pts = [[1.0, 1.1], [-1.0, 2.1], [1.0, 3.1], [-1.0, 4.1], [0.5, 4.9]];
    const keys = [k(0, GL), k(0.08 / D, P(SH, { spine: [30, 0, 0] }, L.deep), { root: [0, -0.4, 0] })];
    pts.forEach(([x, z], i) => keys.push(k((0.14 + i * 0.12) / D, P(SH, arc(i % 2 ? -40 : 40, { lead: i % 2 ? -20 : 20, dy: -0.2, bend: 20 }), i % 2 ? L.lungeR : L.lungeL), { root: [x, -0.18, z], turn: i % 2 ? 15 : -15, e: 'snap' })));
    const KNEEL = P(wield({ spine: [24, 30, 0], chest: [8, 12, 0], head: [10, -20, 0] }, [-0.62, 1.0, 0.1], [-0.98, -0.05, 0.15], [-0.9, 1.2, -0.2]), SH, L.kneel);
    keys.push(k(0.78 / D, KNEEL, { root: [0.3, -0.44, 5.1], turn: 0, e: 'out' }));
    keys.push(k(0.88, KNEEL, { root: [0.3, -0.44, 5.1] }));
    keys.push(k(1, GL, { root: [0.3, 0, 5.1], e: 'smooth' }));
    S8('sf_thousand', D, keys, [{ t: 0.06 / D, e: 'dash' }, { t: 0.12 / D, e: 'sandtrail', dur: 0.62, rate: 80 }, { t: 0.12 / D, e: 'fadeSelf', to: 0.55, dur: 0.66 },
      { t: 'hit5', e: 'multispark', n: 5 }, { t: 'hit5', e: 'impact', kind: 'slash', at: 'target' }, { t: 'hit5', e: 'sandburst', r: 2.5, n: 14 }],
    { endRoot: [0.3, 0, 5.1], toTarget: { gap: -2.6, max: 7, behind: true }, through: true });
  }
  // Riptide (0.85 s): the parry beat (sparks off the rim), then six short flat cuts alternating sides at two heights (so the
  // trails lie in parallel bands, never an X); the last a step-in that knocks it down
  {
    const D = 0.85, hits = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
    const keys = [k(0, P(arc(-86, { lead: -30, dy: -0.3, twist: -22 }), SHUP, L.deep), { root: [0, -0.3, 0] })];
    hits.forEach((h, i) => {
      const fore = i % 2 === 0, dy = fore ? -0.12 : -0.3;
      keys.push(k((h - 0.045) / D, P(SH, arc(fore ? -60 : 60, { lead: fore ? -20 : 20, dy, bend: 14 }), i === 5 ? L.lungeL : L.stepL), { root: [0, -0.14, 0.1 + 0.05 * i], e: 'in' }));
      keys.push(k(h / D, P(SH, arc(fore ? 20 : -20, { lead: fore ? 10 : -10, dy, bend: 14 }), i === 5 ? P(L.lungeL, { thighL: [-72, 0, 6], shinL: [70] }) : L.stepL), { root: [0, i === 5 ? -0.24 : -0.14, 0.12 + 0.05 * i + (i === 5 ? 0.3 : 0)], e: 'snap' }));
    });
    keys.push(k(1, GL, { root: [0, 0, 0.5], e: 'smooth' }));
    S8('sf_riptide', D, keys, [{ t: 0, e: 'impact', kind: 'parry', at: 'shieldL' }, { t: 0.04 / D, e: 'trail', on: true, color: T, w: 0.7 },
      ...['hit', 'hit2', 'hit3', 'hit4', 'hit5'].map((h, i) => ({ t: h, e: 'impact', kind: i % 2 ? 'nick' : 'slash', at: 'target' })), { t: 'hit6', e: 'impact', kind: 'sand', at: 'target' }, { t: 'hit6', e: 'impact', kind: 'slash', at: 'target' }, { t: 0.64 / D, e: 'trail', on: false }],
    { endRoot: [0, 0, 0.5] });
  }
  // Sand Line (0.85 s): two turns of the authored spin carried 7 m along the line (the travel is the dash's), puffs of sand
  // spiralling off along it; no blade trail (the turn outruns its fade)
  S8('sf_sandline', 0.85, [
    k(0, GL),
    k(0.08 / 0.85, P(SH, { spine: [24, 0, 0] }, L.deep), { root: [0, -0.3, 0] }),
    k(0.2 / 0.85, {}, { root: [0, -0.1, 2.0], e: 'linear' }),
    k(0.5 / 0.85, {}, { root: [0, -0.1, 5.0], e: 'linear' }),
    k(0.72 / 0.85, {}, { root: [0, -0.2, 7.0], e: 'out' }),
    k(1, GL, { root: [0, 0, 7.0], e: 'smooth' }),
  ], [{ t: 0.04, e: 'dash' }, { t: 0.09, e: 'sandtrail', dur: 0.62, rate: 90 }, { t: 0.1, e: 'sound', s: 'whirr' }, { t: 'hit', e: 'impact', kind: 'sweep', at: 'self', r: 3 }, { t: 'hit2', e: 'impact', kind: 'sweep', at: 'self', r: 3 }, { t: 'hit2', e: 'impact', kind: 'sand', at: 'self', r: 3 }, { t: 0.86, e: 'dust' }],
  { endRoot: [0, 0, 7.0], toTarget: { gap: -2.5, max: 9, behind: true }, through: true, ual: { mask: 'full', segs: [['Spin_Attack_Loop', 0.08, 0.38], ['Spin_Attack_Loop', 0.38, 0.68]], end: 0.7 } });
  // Whiteout (0.75 s): the kick out of the sidestep throws a thick wall of pale sand where he lands (the server's 'sandcloud'
  // puts the other where the step began), and he fades into it for the second he is out of reach
  S8('sf_whiteout', 0.75, [
    k(0, P(G, { spine: [24, 0, 0] }, L.deep), { root: [0, -0.3, 0] }),
    k(0.14, P(SH, { spine: [10, 0, 0] }, { thighR: [30, 0, -6], shinR: [60], footR: [40], thighL: [-30, 0, 4], shinL: [50] }), { root: [0, -0.16, 0] }),
    k(0.3, P(SH, { spine: [-14, 0, 0], armR: [-20, 0, -60] }, { thighR: [-80, 0, -6], shinR: [20], footR: [-10], thighL: [-20, 0, 4], shinL: [40] }), { root: [0, -0.12, 0.06], e: 'snap' }),
    k(1, GL, { root: R.guard }),
  ], [{ t: 0.3, e: 'cloud', kind: 'sand', r: 4.5, at: 'self', thick: true }, { t: 0.3, e: 'sandburst', r: 3, n: 20 }, { t: 0.32, e: 'fadeSelf', to: 0.3, dur: 1.0 }, { t: 'hit', e: 'impact', kind: 'sand', at: 'self', r: 4.5 }],
  { ual: { mask: 'full', segs: [['Kick_Front', 0, 0.42, 0.06, 0.4]], end: 0.42 } });
  // Sandstorm Drop (1.3 s): up the column (4.5 m), a beat at the top, then head-first down through it onto the machines: T4+,
  // one ring (the column's fall made the other), sand thrown out
  {
    const D = 1.3;
    S8('st_sandstorm', D, [
      k(0, GL),
      ...leapRoot(D, { t0: 0.1, t1: 0.42, t2: 0.6, t3: 0.78, h: 4.5, float: 0.12, dist: 1.0 }),
      k(1, GL, { root: [0, 0, 1.0], e: 'smooth' }),
    ], [{ t: 0, e: 'sound', s: 'whoosh' }, { t: 0.1 / D, e: 'leap' }, { t: 0.1 / D, e: 'sandcol', dur: 0.62, h: 4.8, r: 1.8, rate: 90 }, { t: 0.1 / D, e: 'camlift', up: 2.8, back: 3, dur: 1.0 },
      { t: 0.6 / D, e: 'trail', on: true, color: T, w: 0.9 }, { t: 'hit', e: 'impact', kind: 'sand', at: 'self', r: 4.5 }, { t: 'hit', e: 'ring', color: '#d8c090', r: 4.5 },
      { t: 'hit', e: 'sandburst', r: 4.5, n: 34 }, { t: 'hit', e: 'decal', kind: 'crack', r: 2.5 }, { t: 0.8 / D, e: 'trail', on: false }],
    { endRoot: [0, 0, 1.0], ual: { mask: 'full', segs: [['Leap_Rise', 0, 0.42], ['Air_Hang_Loop', 0.42, 0.6, 0, 0.12], ['Dive_Strike', 0.58, 0.78], ['Slam_Land', 0.78, D]] } });
  }
}

// ============================== S9: the Warden's new kit (combat_design.md 5.2) ==============================
// Slow heavy swings from a wide planted stance; the hammer drags dust, never light (TRAIL.warden is the colour of dust).
// Hammer Blow's three steps each have a clip on one of Sword_Heavy_Combo's three swings (the body; the hammer arm keyed:
// a flat swing from the side, a backhand, an overhead); Ground Pound is Hammer_Overhead; Challenge is ONE strike on the
// shield rim (one clang, never a beat); Brace is the tower shield set square with no movement. Every crack is a seam that
// runs one way along a line (fx.js fissure), never a star from above; at most two rings a beat; rocks inside fuseBudget.
{
  const G = P(guard('warden'), { spine: [8, 0, 0] }), GL = P(G, LG), T = TRAIL.warden, HC = 'Sword_Heavy_Combo';
  const SH = { armL: [-50, 74, 28], foreL: [-100, 0, 0] };
  const SHUP = { armL: [-84, 76, 30], foreL: [-110, 0, 0] }; // (the tower shield raised square in front)
  const W9 = (id, dur, keys, ev, o = {}) => (DEF[id] = C('warden', dur, 'full', keys, ev, o));
  // ---- Hammer Blow: step 1 is the old side swing on the combo's first swing; 2 a backhand; 3 an overhead
  DEF.w_blow = { ...DEF.w_blow, events: [...DEF.w_blow.events, { t: 'hit', e: 'dust' }], ual: { mask: 'body', segs: [[HC, 0, 0.62, 0, 0.62]], end: 0.62 } };
  W9('w_blow_2', 0.85, [
    k(0, GL),
    ...swing(0.85, 0.42, { wind: 105, mid: 50, hit: -5, follow: -50, end: -64 }, (a, role, e) => [P(SH, arc(a, { lead: role === 'wind' ? 30 : role === 'follow' || role === 'end' ? -20 : 5, dy: -0.2, r: role === 'wind' ? 0.36 : 0.44, bend: 12 }), role === 'wind' ? L.wide : L.lungeR), { root: [0, -0.14, role === 'wind' ? 0.05 : 0.22], e }], 1100),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.1, e: 'trail', on: true, color: T, w: 1.2, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'blunt', at: 'target' }, { t: 'hit', e: 'dust' }, { t: 0.66, e: 'trail', on: false }],
  { skill: 'w_blow', hit: { t: 0.42 }, step: 2, ual: { mask: 'body', segs: [[HC, 0, 0.62, 1.4, 2.02]], end: 0.62 } });
  W9('w_blow_3', 1.05, [
    k(0, GL),
    k(0.12, P(SH, { spine: [12, 0, 0], armR: [-60, 0, -20], foreR: [-50, 0, 0], handR: [20, 0, 0] }, LG), { root: [0, -0.06, 0] }),
    k(0.3, P(SH, overhead({ spine: [-18, 0, 0], chest: [-10, 0, 0], head: [-14, 0, 0] }), L.stand), { root: [0, 0.1, 0.04] }),
    k(0.5 / 1.05, P(SH, slamAt({ spine: [34, 0, 0], chest: [14, 0, 0], head: [16, 0, 0] }, L.lungeL, [-0.04, 0.5, 1.2], [0.06, -0.56, 0.83], 0.85, 0.26), L.lungeL), { root: [0, -0.34, 0.26], e: 'snap' }),
    k(0.66, P(SH, slamAt({ spine: [32, 0, 0], chest: [12, 0, 0], head: [14, 0, 0] }, L.lungeL, [-0.04, 0.48, 1.18], [0.06, -0.54, 0.84], 0.85, 0.26), L.lungeL), { root: [0, -0.32, 0.26] }),
    k(1, GL, { root: [0, 0, 0.26], e: 'smooth' }),
  ], [{ t: 0.24, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'blunt', at: 'target' }, { t: 'hit', e: 'dust' }, { t: 'hit', e: 'groundSparks' }, { t: 0.62, e: 'trail', on: false }],
  { skill: 'w_blow', hit: { t: 0.5 }, step: 3, endRoot: [0, 0, 0.26], ual: { mask: 'body', segs: [[HC, 0, 0.8, 2.07, 2.87]], end: 0.8 } });
  // ---- Ground Pound on Hammer_Overhead (its contact, 0.43 s, is the server's hit); Forward Fault opens a line instead
  W9('w_pound', 1.0, [
    k(0, GL),
    k(0.22, P(SH, overhead({ spine: [-16, 0, 0], chest: [-10, 0, 0], head: [-12, 0, 0] }), L.stand), { root: [0, 0.06, 0] }),
    k(0.43, P(SH, slamAt({ spine: [30, 0, 0], chest: [14, 0, 0], head: [14, 0, 0] }, L.lungeL, [-0.04, 0.16, 1.18], [0.06, -0.6, 0.8], 0.85, 0.1), L.lungeL), { root: [0, -0.3, 0.1], e: 'snap' }),
    k(0.66, P(SH, slamAt({ spine: [28, 0, 0], chest: [12, 0, 0], head: [12, 0, 0] }, L.lungeL, [-0.04, 0.18, 1.15], [0.06, -0.56, 0.83], 0.85, 0.1), L.lungeL), { root: [0, -0.3, 0.1] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.12, e: 'trail', on: true, color: T, w: 1.3, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'earth', at: 'front1', r: 5 }, { t: 0.62, e: 'trail', on: false }],
  { hit: { t: 0.43 }, ual: { mask: 'full', segs: [['Hammer_Overhead', 0, 0.875]], end: 0.8 } });
  DEF.w_pound_fault = { ...DEF.w_pound, skill: 'w_pound', events: [DEF.w_pound.events[0], { t: 'hit', e: 'impact', kind: 'blunt', at: 'front1' }, { t: 'hit', e: 'fissure', len: 10, dur: 0.35, spikes: 1, start: 1.2 }, DEF.w_pound.events[2]] };
  // ---- Challenge: the hammer drawn back and brought once onto the shield rim; one clang, one ring of dust 10 m out
  W9('w_challenge', 0.9, [
    k(0, GL),
    k(0.2, P({ spine: [-6, 10, 0], armL: [-70, 60, 30], foreL: [-90, 0, 0], armR: [-140, 30, -24], foreR: [-80, 0, 0], handR: [0, 0, 0] }, L.wide), { root: [0, -0.12, 0] }),
    k(0.32, P({ spine: [14, -6, 0], armL: [-70, 60, 30], foreL: [-90, 0, 0], armR: [-78, 52, 0], foreR: [-58, 0, 0], handR: [0, 0, 0] }, L.wide), { root: [0, -0.18, 0], e: 'snap' }),
    k(0.55, P({ spine: [12, -6, 0], armL: [-70, 60, 30], foreL: [-90, 0, 0], armR: [-76, 50, 0], foreR: [-60, 0, 0] }, L.wide), { root: [0, -0.16, 0] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 'hit', e: 'impact', kind: 'clang', at: 'shieldL' }, { t: 'hit', e: 'ring', color: '#cbbd9e', r: 10 }, { t: 'hit', e: 'dust' }], { hit: { t: 0.32 } });
  // ---- Bulwark Charge: the shield charge on the body, landing at the machine; Earthsplitter: one fissure that runs out
  DEF.w_bulwark = { ...DEF.w_bulwark, toTarget: { gap: 1.2, max: 12 }, ual: { mask: 'body', segs: [['Shield_Dash', 0, 0.14, 0, 0.14], ['Shield_Charge_Loop', 0.14, 0.5, 0, 0.5]], end: 0.5 } };
  DEF.w_split = { ...DEF.w_split, events: [DEF.w_split.events[0], { t: 'hit', e: 'impact', kind: 'blunt', at: 'front1' }, { t: 'hit', e: 'fissure', len: 12, dur: 0.45, spikes: 2, start: 1.2 }, { t: 'hit', e: 'shake', amt: 0.3 }, DEF.w_split.events.at(-1)] };

  // ---- the fusions
  // Colossus Drop (1.25 s): a heavy take-off with a dust column and rocks, the hammer two-handed overhead at the apex (the
  // shield arm held out low, never spread), down with the hammer leading, T4 at 0.78: a crater, two rings (r3 then r6),
  // three short rock spikes at uneven spacing
  {
    const D = 1.25;
    W9('wf_colossus', D, [
      k(0, GL),
      ...leapRoot(D, { t0: 0.1, t1: 0.45, t2: 0.55, t3: 0.78, h: 3.5, float: 0.1, dist: 0 }),
      k(1, GL, { root: [0, 0, 0], e: 'smooth' }),
    ], [{ t: 0, e: 'sound', s: 'whoosh' }, { t: 0.1 / D, e: 'leap' }, { t: 0.1 / D, e: 'column', h: 3, rocks: 8 }, { t: 0.1 / D, e: 'camlift', up: 2.0, back: 2.4, dur: 1.0 },
      { t: 0.5 / D, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'earth', at: 'self', r: 3 }, { t: 'hit', e: 'ring', color: '#cbbd9e', r: 6, delay: 0.14 },
      { t: 'hit', e: 'decal', kind: 'crater', r: 3 }, { t: 'hit', e: 'rockspikes', n: 3, rMin: 1.8, rMax: 3.2 }, { t: 0.86 / D, e: 'trail', on: false }],
    { ual: { mask: 'full', segs: [['Leap_Rise', 0, 0.45, 0, 0.458], ['Hammer_Overhead', 0.45, 0.82, 0, 0.47], ['Slam_Land', 0.82, D, 0.1, 0.58]] } });
  }
  // Pile Driver (1.1 s): the charge runs on 2.5 m into the overhead blow; T4 with a crater on the machines it carried
  W9('wf_piledriver', 1.1, [
    k(0, GL),
    k(0.24 / 1.1, P(G, SHUP, { spine: [24, 0, 0] }, L.lungeL), { root: [0, -0.16, 2.5], e: 'out' }),
    k(1, GL, { root: [0, 0, 2.5], e: 'smooth' }),
  ], [{ t: 0.02, e: 'dash' }, { t: 0.12, e: 'dust' }, { t: 0.3, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'earth', at: 'target', r: 4 },
    { t: 'hit', e: 'decal', kind: 'crater', r: 3, at: 'target' }, { t: 0.62, e: 'trail', on: false }],
  { endRoot: [0, 0, 2.5], toTarget: { gap: 1.0, max: 3 }, ual: { mask: 'full', segs: [['Shield_Charge_Loop', 0, 0.28, 0, 0.5], ['Hammer_Overhead', 0.28, 0.66, 0.15, 0.6]] } });
  // Bastion Combo: shield, hammer, shield on the old combo's keys, dust at each step; the last throws the machine 5 m
  DEF.wf_bastion = { ...DEF.w_combo, skill: 'wf_bastion', events: [...DEF.w_combo.events, { t: 'hit', e: 'dust' }, { t: 'hit2', e: 'dust' }, { t: 'hit3', e: 'dust' }, { t: 'hit3', e: 'wave', kind: 'dust', len: 4 }],
    ual: { mask: 'body', segs: [['Shield_OneShot', 0, 0.3, 0.1, 0.5], ['Sword_Heavy_Combo', 0.36, 0.74, 2.2, 2.6], ['Shield_OneShot', 0.74, 1.1, 0.1, 0.5]], end: 1.05 } };
  // Fault Line (1.0 s): the overhead blow, then two fissures from points 1.5 m apart, 14 deg uneven, one after the other
  W9('wf_faultline', 1.0, [
    k(0, GL),
    k(0.24, P(SH, overhead({ spine: [-18, 0, 0], chest: [-10, 0, 0], head: [-14, 0, 0] }), L.stand), { root: [0, 0.08, 0] }),
    k(0.5, P(SH, slamAt({ spine: [36, 0, 0], chest: [16, 0, 0], head: [16, 0, 0] }, L.deep, [-0.04, 0.14, 1.14], [0.06, -0.62, 0.78], 0.85, 0.2), L.deep), { root: [0, -0.42, 0.2], e: 'snap' }),
    k(0.72, P(SH, slamAt({ spine: [34, 0, 0], chest: [14, 0, 0], head: [14, 0, 0] }, L.deep, [-0.04, 0.16, 1.12], [0.06, -0.58, 0.81], 0.85, 0.2), L.deep), { root: [0, -0.4, 0.2] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.14, e: 'trail', on: true, color: T, w: 1.4, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'blunt', at: 'front1' }, { t: 'hit', e: 'fissure', len: 12, off: 0.75, ang: -5, dur: 0.4, spikes: 2, branch: -1 },
    { t: 'hit2', e: 'fissure', len: 12, off: -0.75, ang: 9, dur: 0.4, spikes: 2, branch: 1 }, { t: 0.6, e: 'trail', on: false }],
  { ual: { mask: 'full', segs: [['Hammer_Overhead', 0.05, 0.53, 0, 0.45]], end: 0.8 } });
  // Trip Hammer (0.8 s): out of the overhead, a short smash into the ground (sparks off the stone, T2), then at once an
  // upswing through the machine (T3, lifts it)
  W9('wf_triphammer', 0.8, [
    k(0, P(SH, slamAt({ spine: [30, 0, 0], chest: [12, 0, 0], head: [14, 0, 0] }, L.lungeL, [-0.04, 0.5, 1.18], [0.06, -0.54, 0.84], 0.85, 0.26), L.lungeL), { root: [0, -0.3, 0] }),
    k(0.1 / 0.8, P(SH, wield({ spine: [2, 0, 0], chest: [-4, 0, 0], head: [-4, 0, 0] }, [-0.3, 1.6, 0.16], [0.06, 0.9, -0.42], [-0.7, 1.4, 0.15]), L.stepL), { root: [0, -0.06, 0.06] }),
    k(0.2 / 0.8, P(SH, slamAt({ spine: [34, 0, 0], chest: [14, 0, 0], head: [16, 0, 0] }, L.deep, [-0.04, 0.12, 1.1], [0.06, -0.7, 0.7], 0.85, 0.14), L.deep), { root: [0, -0.4, 0.14], e: 'snap' }),
    k(0.32 / 0.8, P(SH, { spine: [30, -30, 0], armR: [22, -10, -40], foreR: [-20, 0, 0], handR: [60, 0, 0] }, L.deep), { root: [0, -0.36, 0.14] }),
    k(0.42 / 0.8, P(SH, { spine: [8, 4, 0], chest: [-2, 4, 0], armR: [-70, 14, -28], foreR: [-14, 0, 0], handR: [40, 0, 0], head: [-8, 0, 0] }, L.stepL), { root: [0, -0.12, 0.2], e: 'snap' }),
    k(0.6 / 0.8, P(SH, { spine: [-20, 30, 0], chest: [-12, 20, 0], armR: [-158, 30, -10], foreR: [-10, 0, 0], handR: [-10, 0, 0], head: [-20, 0, 0] }, P(L.stand, { thighR: [-20, 0, -4] })), { root: [0, 0.14, 0.24] }),
    k(1, GL, { root: [0, 0, 0.24], e: 'smooth' }),
  ], [{ t: 0.04, e: 'trail', on: true, color: T, w: 1.3, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'blunt', at: 'front1' }, { t: 'hit', e: 'groundSparks' }, { t: 'hit2', e: 'impact', kind: 'blunt', at: 'target' }, { t: 'hit2', e: 'dust' }, { t: 0.82, e: 'trail', on: false }],
  { endRoot: [0, 0, 0.24] });
  // Earthbreaker Charge (1.25 s): the shield dash with the right arm dragging the hammer through the ground, sparks all the
  // way and a scrape; the furrow opens behind him and erupts 0.5 s later, a rolling eruption chasing the Warden
  {
    const D = 1.25, DRAG = { armR: [34, 0, -34], foreR: [-12, 0, 0], handR: [72, 0, 0] };
    W9('wf_earthbreaker', D, [
      k(0, GL),
      k(0.06 / D, P(G, SHUP, DRAG, { spine: [26, 0, 0] }, L.lungeL), { root: [0, -0.18, 0.3] }),
      k(0.45 / D, P(G, SHUP, DRAG, { spine: [28, 0, 0] }, L.lungeR), { root: [0, -0.2, 9.0], e: 'linear' }),
      k(0.56 / D, P(G, SH, DRAG, { spine: [18, 0, 0] }, L.deep), { root: [0, -0.3, 10.0], e: 'out' }),
      k(1, GL, { root: [0, 0, 10.0], e: 'smooth' }),
    ], [{ t: 0.02, e: 'dash' }, { t: 0.04, e: 'groundSparks', dur: 0.46, rate: 50 }, { t: 0.05, e: 'sound', s: 'scrape' }, { t: 'hit', e: 'fissure', at: 'castFrom', start: 0.6, len: 9, dur: 0.3, step: 1.1, erupt: 0.2, spikes: 1 },
      { t: 'hit', e: 'impact', kind: 'shield', at: 'target' }, { t: 'hit2', e: 'impact', kind: 'earth', at: 'self', r: 2 }],
    { endRoot: [0, 0, 10.0], toTarget: { gap: -2.4, max: 10, behind: true }, through: true, ual: { mask: 'body', segs: [['Shield_Dash', 0, 0.5, 0, 0.6]], end: 0.5 } });
  }
  // Breakwater (0.85 s): out of the Brace, the tower shield heaved forward: a rolling wall of dust and grit 8 m long
  {
    const D = 0.85, HEAVE = { armL: [-96, 14, 4], foreL: [-22, -18, 0] }, LL = P(L.lungeL, { thighL: [-70, 0, 6], shinL: [66] });
    W9('wf_breakwater', D, [
      k(0, P(G, SHUP, { spine: [22, 0, 0] }, L.deep), { root: [0, -0.3, 0] }),
      k(0.16 / D, P(G, { spine: [-4, -26, 0], armL: [-52, 70, 40], foreL: [-104, 0, 0] }, L.stepBack), { root: [0, -0.12, -0.1] }),
      k(0.3 / D, P(G, { spine: [22, 22, 0], head: [6, -14, 0] }, HEAVE, LL), { root: [0, -0.2, 0.44], e: 'snap' }),
      k(0.62 / D, P(G, { spine: [20, 22, 0], head: [6, -14, 0] }, HEAVE, LL), { root: [0, -0.2, 0.46] }),
      k(1, GL, { root: [0, 0, 0.46], e: 'smooth' }),
    ], [{ t: 0, e: 'impact', kind: 'parry', at: 'shieldL' }, { t: 'hit', e: 'impact', kind: 'shield', at: 'cone', r: 8 }, { t: 'hit', e: 'dustfront', len: 8, dur: 0.45 }],
    { endRoot: [0, 0, 0.46], ual: { mask: 'body', segs: [['Shield_OneShot', 0.1, 0.6, 0.1, 0.7]], end: 0.6 } });
  }
  // Intercept (0.9 s): the shield charge to the ally (the server's cast names the ally), then the shield set square to
  // face what threatens them
  W9('wf_intercept', 0.9, [
    k(0, GL),
    k(0.08 / 0.9, P(G, SHUP, { spine: [26, 0, 0] }, L.lungeL), { root: [0, -0.16, 0.3] }),
    k(0.42 / 0.9, P(G, SHUP, { spine: [28, 0, 0] }, L.lungeR), { root: [0, -0.18, 7.6], e: 'linear' }),
    k(0.52 / 0.9, P(G, SHUP, { spine: [20, 0, 0], head: [10, 0, 0] }, L.deep), { root: [0, -0.3, 8.0], e: 'out' }),
    k(0.8, P(G, SHUP, { spine: [18, 0, 0] }, L.deep), { root: [0, -0.28, 8.0] }),
    k(1, GL, { root: [0, 0, 8.0], e: 'smooth' }),
  ], [{ t: 0.02, e: 'dash' }, { t: 0.2, e: 'dust' }, { t: 0.38, e: 'dust' }, { t: 'hit', e: 'impact', kind: 'clang', at: 'shieldL' }, { t: 'hit', e: 'dust' }],
  { endRoot: [0, 0, 8.0], toTarget: { gap: 1.4, max: 14 }, ual: { mask: 'body', segs: [['Shield_Charge_Loop', 0.06, 0.44, 0, 0.5]], end: 0.46 } });
  // Hammerfall (1.0 s, the triad): from the crater one more overhead blow; a fissure runs out toward the machine and the
  // whole line erupts (one ring, at the blow)
  W9('wt_hammerfall', 1.0, [
    k(0, P(G, LG, { spine: [30, 0, 0] }, L.deep), { root: [0, -0.3, 0] }),
    k(0.26, P(SH, overhead({ spine: [-20, 0, 0], chest: [-12, 0, 0], head: [-14, 0, 0] }), L.stand), { root: [0, 0.12, 0.04] }),
    k(0.55, P(SH, slamAt({ spine: [38, 0, 0], chest: [16, 0, 0], head: [16, 0, 0] }, L.deep, [-0.04, 0.14, 1.14], [0.06, -0.62, 0.78], 0.85, 0.22), L.deep), { root: [0, -0.44, 0.22], e: 'snap' }),
    k(0.75, P(SH, slamAt({ spine: [36, 0, 0], chest: [14, 0, 0], head: [14, 0, 0] }, L.deep, [-0.04, 0.16, 1.12], [0.06, -0.58, 0.81], 0.85, 0.22), L.deep), { root: [0, -0.42, 0.22] }),
    k(1, GL, { root: [0, 0, 0.22], e: 'smooth' }),
  ], [{ t: 0.16, e: 'trail', on: true, color: T, w: 1.5, along: 0.85 }, { t: 'hit', e: 'impact', kind: 'earth', at: 'front1', r: 3 }, { t: 'hit', e: 'fissure', len: 14, dur: 0.35, spikes: 2, erupt: 0.05, start: 1.4 },
    { t: 0.64, e: 'trail', on: false }],
  { endRoot: [0, 0, 0.22], ual: { mask: 'full', segs: [['Hammer_Overhead', 0.1, 0.58, 0, 0.45]], end: 0.8 } });
}

// ============================== DODGE (S1, combat_design.md 2.4) ==============================
// Every class: a low shoulder roll the way you move (4 m, the evade covers the first 0.3 s; the push-off crouch comes
// first, 0.1 s) and, with no direction held, a quick hop back. Arms tucked, coat and cloak trail behind (no wings).
// Played as root motion (travel); the server only keeps the evade window, the charges and Opening (shared/feel.js).
for (const cls of Object.keys(TRAIL)) {
  const G = P(guard(cls), { spine: [8, 0, 0] }), GL = P(G, LG);
  const TK = { armL: [-60, 30, 30], foreL: [-110, 0, 0], armR: [-50, 0, -30], foreR: [-100, 0, 0], head: [30, 0, 0] };
  const dist = cls === 'sandblade' ? 2.5 : cls === 'ranger' ? 5 : 4;
  DEF['dodge_' + cls] = C(cls, 0.55, 'full', [
    k(0, GL),
    k(0.1 / 0.55, P(G, TK, { spine: [34, 0, 0] }, L.deep), { root: [0, -0.38, 0.25] }),
    k(0.2 / 0.55, P(G, TK, { spine: [120, 0, 0], chest: [30, 0, 0] }, L.tuck), { root: [0, -0.55, dist * 0.42], e: 'linear' }),
    k(0.3 / 0.55, P(G, TK, { spine: [230, 0, 0], chest: [30, 0, 0] }, L.tuck), { root: [0, -0.6, dist * 0.8], e: 'linear' }),
    k(0.38 / 0.55, P(G, TK, { spine: [30, 0, 0] }, L.kneel), { root: [0, -0.42, dist * 0.97] }),
    k(1, GL, { root: [0, 0, dist] }),
  ], [{ t: 0.02, e: 'sound', s: 'gust' }, { t: 0.1 / 0.55, e: 'dust' }, { t: 0.38 / 0.55, e: 'dust' }], { endRoot: [0, 0, dist], dodge: true });
  DEF['dodgeb_' + cls] = C(cls, 0.5, 'full', [
    k(0, GL),
    k(0.1 / 0.5, P(G, { spine: [24, 0, 0] }, L.deep), { root: [0, -0.3, 0.05] }),
    k(0.24 / 0.5, P(G, { spine: [-14, 0, 0], chest: [-8, 0, 0], armL: [-40, 40, 30], armR: [-30, 0, -40] }, L.tuck), { root: [0, 0.42, -dist * 0.55], e: 'out' }),
    k(0.34 / 0.5, P(G, { spine: [18, 0, 0] }, L.deep), { root: [0, -0.28, -dist * 0.95], e: 'in' }),
    k(1, GL, { root: [0, 0, -dist] }),
  ], [{ t: 0.02, e: 'sound', s: 'gust' }, { t: 0.1 / 0.5, e: 'dust' }, { t: 0.34 / 0.5, e: 'dust' }], { endRoot: [0, 0, -dist], dodge: true });
  // Shield Step (Oathbound, S5): a low push-off, then 2 m forward behind the raised shield (Guard's arms), feet planted
  const SHL = { armL: [-84, 76, 30], foreL: [-110, 0, 0], armR: [-40, 0, -20], foreR: [-90, 0, 0], handR: [40, 0, 0], head: [10, 0, 0] };
  DEF['dodges_' + cls] = C(cls, 0.4, 'full', [
    k(0, GL),
    k(0.1 / 0.4, P(G, SHL, { spine: [22, -8, 0] }, L.deep), { root: [0, -0.3, 0.1] }),
    k(0.24 / 0.4, P(G, SHL, { spine: [20, -10, 0] }, L.lungeL), { root: [0, -0.22, 1.3], e: 'out' }),
    k(0.34 / 0.4, P(G, SHL, { spine: [18, -10, 0] }, L.deep), { root: [0, -0.3, 1.95] }),
    k(1, GL, { root: [0, 0, 2] }),
  ], [{ t: 0.02, e: 'sound', s: 'gust' }, { t: 0.1 / 0.4, e: 'dust' }, { t: 0.34 / 0.4, e: 'dust' }, { t: 0.34 / 0.4, e: 'sound', s: 'scrape' }], { endRoot: [0, 0, 2], dodge: true });
}

// the Sandblade's Sidestep (S8, 5.3): not a roll but a quick low hop 2.5 m the way you move, sand kicked off the push and
// the landing; the blade stays out and the round shield up
{
  const G = P(guard('sandblade'), { spine: [8, 0, 0] }), GL = P(G, LG), SHUP = { armL: [-80, 70, 28], foreL: [-104, 0, 0] };
  DEF.dodge_sandblade = C('sandblade', 0.42, 'full', [
    k(0, GL),
    k(0.07 / 0.42, P(G, SHUP, { spine: [22, 0, 0] }, L.deep), { root: [0, -0.32, 0.1] }),
    k(0.18 / 0.42, P(G, SHUP, { spine: [6, 0, 0] }, L.tuck), { root: [0, 0.32, 1.25], e: 'out' }),
    k(0.29 / 0.42, P(G, SHUP, { spine: [18, 0, 0] }, L.deep), { root: [0, -0.3, 2.4], e: 'in' }),
    k(1, GL, { root: [0, 0, 2.5] }),
  ], [{ t: 0.02, e: 'sound', s: 'gust' }, { t: 0.07 / 0.42, e: 'cloud', kind: 'sand', r: 1.2, at: 'self' }, { t: 0.29 / 0.42, e: 'cloud', kind: 'sand', r: 1.2, at: 'self' }], { endRoot: [0, 0, 2.5], dodge: true });
}
// the Warden's Brace (S9, 5.2): no movement at all; he drops into the wide stance behind the tower shield set square for the
// 0.4 s block, with a scrape of the shield's foot on the ground (both dodge keys play it)
{
  const G = P(guard('warden'), { spine: [8, 0, 0] }), GL = P(G, LG), SHUP = { armL: [-86, 76, 30], foreL: [-112, 0, 0] };
  const BR = P(G, SHUP, { spine: [22, 0, 0], chest: [6, 0, 0], head: [12, 0, 0], armR: [-30, 0, -30], foreR: [-70, 0, 0] }, L.wide);
  DEF.dodge_warden = DEF.dodgeb_warden = C('warden', 0.55, 'full', [
    k(0, GL),
    k(0.07 / 0.55, BR, { root: [0, -0.3, 0.02], e: 'snap' }),
    k(0.44 / 0.55, BR, { root: [0, -0.3, 0.02] }),
    k(1, GL, { root: R.guard, e: 'smooth' }),
  ], [{ t: 0.02, e: 'sound', s: 'scrape' }, { t: 0.07 / 0.55, e: 'dust' }], { dodge: true, ual: { mask: 'body', segs: [['Idle_Shield_Loop', 0.04, 0.46, 0, 0.42]], end: 0.44 } });
}

// the Deadeye's Slide (S10, 5.5): a run-in drop into a 4 m knee slide on Slide_Start, Slide_Loop and Slide_Exit (the body),
// both pistols kept low at the hips pointing ahead (the arms keyed, parallel), the coat trailing behind; gravel and dust off
// the ground. dodgef_deadeye: the same slide with Snap Shot held, the right pistol fired out of it at 0.14 s (the server's
// slide shot); the hop back stays the plain one
{
  const G = P(guard('deadeye'), { spine: [4, 0, 0] }), GL = P(G, LG);
  const hipT = { spine: [-8, 0, 0], chest: [-4, 0, 0], head: [6, 0, 0] };
  const HIPS = (kR = 0) => P(G, hipT, gunArm(hipT, 'R', D2(-4 + 16 * kR), { at: [-0.24, 1.02 + 0.03 * kR, 0.34 - 0.05 * kR] }), gunArm(hipT, 'L', D2(-4), { at: [0.24, 1.02, 0.34] }));
  const slide = (id, fire) => {
    const D = 0.55, keys = [
      k(0, GL),
      k(0.07 / D, P(HIPS(), { spine: [16, 0, 0] }, L.lungeL), { root: [0, -0.16, 0.5] }),
      k(0.14 / D, P(HIPS(), L.kneel), { root: [0, -0.46, 1.4], e: 'linear' }),
      ...(fire ? [k(0.16 / D, P(HIPS(1), L.kneel), { root: [0, -0.46, 1.7], e: 'out' }), k(0.24 / D, P(HIPS(0.15), L.kneel), { root: [0, -0.46, 2.4] })] : []),
      k(0.34 / D, P(HIPS(), L.kneel), { root: [0, -0.44, 3.3], e: 'linear' }),
      k(0.44 / D, P(HIPS(), L.deep), { root: [0, -0.3, 3.85] }),
      k(1, GL, { root: [0, 0, 4] }),
    ];
    DEF[id] = C('deadeye', D, 'full', keys, [{ t: 0.02, e: 'sound', s: 'gust' }, { t: 0.07 / D, e: 'dust' }, { t: 0.12 / D, e: 'gravelSpray', n: 8, back: true }, { t: 0.3 / D, e: 'gravelSpray', n: 5, back: true }, { t: 0.44 / D, e: 'dust' },
      ...(fire ? [{ t: 0.14 / D, e: 'proj', kind: 'ball', from: 'muzzleR' }, { t: 0.14 / D, e: 'brass', side: 'R' }] : [])],
    { endRoot: [0, 0, 4], dodge: true, ual: { mask: 'body', segs: [['Slide_Start', 0, 0.14, 0.3, 0.6], ['Slide_Loop', 0.14, 0.36, 0, 0.5], ['Slide_Exit', 0.36, D, 0.05, 0.5]], end: 0.5 } });
  };
  slide('dodge_deadeye', false);
  slide('dodgef_deadeye', true);
}

// ============================== S12: the Chemist's new kit (combat_design_fusion.md 4.3) ==============================
// The rod stays in the right hand; flasks, the tar pot and the cask go out of the left (both hands for the cask) on the
// authored clips (Throw_Underhand, Staff_Push_Enter/_Shoot, Leap_Rise, Air_Hang_Loop, Slam_Land, Pole_Vault) with the arms
// keyed. Contact times come from the new kit (kit.js / fusions.js; the legacy records share the ids, so every DEF names its
// hit). A thrown flask lands on the server's contact; a bomb's burst, the puddles and clouds and the arcs between machines
// are drawn from the server's words (game.js 'bomb', 'boom', 'czone', 'cpop', 'sparkarc'). Flasks are blue, green or
// white; at most one ring a beat.
{
  const K12 = (id, step) => { const s = CORE_BY_ID[id]; return step && s?.chain ? s.chain[step - 1] : s; };
  const TS = (h, i) => (h.ts ? h.ts[Math.min(i, h.ts.length - 1)] : h.t + i * (h.gap || 0));
  const G = P(guard('chemist'), { spine: [6, 0, 0] }), GL = P(G, LG);
  const ROD = { armR: [-30, 0, -10], foreR: [-70, 0, 0], handR: [10, 0, 0] };
  const C12 = (id, dur, keys, ev, o) => (DEF[id] = C('chemist', dur, 'full', keys, ev, o));
  const WIND = P(ROD, { spine: [-6, 40, 0], chest: [-8, 20, 0], armL: [-150, 30, 50], foreL: [-90, 0, 0], handL: [-30, 0, 0], head: [0, -30, 0] });
  const REL = P(ROD, { spine: [24, -30, 0], chest: [10, -20, 0], armL: [-110, -10, 10], foreL: [-10, 0, 0], handL: [20, 0, 0], head: [8, 10, 0] });
  const SIDEW = P(ROD, { spine: [8, 50, 0], armL: [-40, -20, 90], foreL: [-60, 0, 0], handL: [0, 0, 0] });
  const SIDER = P(ROD, { spine: [20, -40, 0], armL: [-90, 30, 40], foreL: [-10, 0, 0] });
  const PUSHW = P({ spine: [-4, 35, 0], chest: [-4, 14, 0], head: [0, -30, 0], armR: [-60, 0, -10], foreR: [-60, 0, 0], armL: [-60, 0, 30], foreL: [-80, 0, 0] });
  const PUSH = P({ spine: [18, -12, 0], chest: [6, -6, 0], head: [4, 10, 0], armR: [-95, 0, -6], foreR: [0, 0, 0], handR: [30, 0, 0], armL: [-90, 0, 10], foreL: [-20, 0, 0] });
  const UNDER0 = P(ROD, { spine: [30, 20, 0], armL: [30, 0, 20], foreL: [-30, 0, 0], head: [20, 0, 0] }), UNDER1 = P(ROD, { spine: [24, -20, 0], armL: [-70, 0, 10], foreL: [-10, 0, 0], handL: [-30, 0, 0] });
  const CASK0 = P({ spine: [44, 0, 0], armR: [10, 0, -10], foreR: [-20, 0, 0], armL: [10, 0, 10], foreL: [-20, 0, 0], head: [24, 0, 0] }), CASK1 = P({ spine: [-8, 0, 0], armR: [-100, 0, -10], foreR: [-8, 0, 0], armL: [-100, 0, 10], foreL: [-8, 0, 0] });
  const out = (pose, legs, g = 0.5) => mixPose(P(pose, legs), GL, g);
  const flask = (t, item, fly, o = {}) => ({ t, e: 'proj', kind: 'flask', item, from: 'L', arc: 0.6, impact: 'flaskland', spin: 14, time: Math.max(0.1, fly), ...o });
  const shake = (t, amt) => ({ t, e: 'shake', amt });
  // ---- Acid Flask: three flasks on the run (upper body): overhand, a side-arm from the other side, a heavier overhand
  const acid = (id, step) => {
    const h = K12('c_acid', step).hit, d = 0.62, rel = h.t - 0.12, side = step === 2;
    const keys = side ? [k(0, GL), k((rel - 0.16) / d, P(SIDEW, L.stepBack), { root: [0, -0.06, -0.06] }), k(rel / d, P(SIDER, L.lungeL), { root: [0, -0.14, 0.2], e: 'snap' }), k(0.82, out(SIDER, L.lungeL)), k(1, GL)]
      : [k(0, GL), k((rel - 0.16) / d, P(WIND, L.stepBack), { root: [0, -0.04, -0.1] }), k(rel / d, P(REL, L.lungeL), { root: [0, -0.14, 0.22], e: 'snap' }), k(0.82, out(REL, L.lungeL)), k(1, GL)];
    C12(id, d, keys, [{ t: 0.03, e: 'holdItem', side: 'L', item: 'flaskAcid', on: true }, { t: rel / d, e: 'holdItem', side: 'L', item: 'flaskAcid', on: false }, flask(rel / d, 'flaskAcid', 0.12, { impact: 'acid', r: step === 3 ? 2.5 : 0, arc: step === 3 ? 0.8 : 0.5 }), { t: rel / d, e: 'sound', s: 'whoosh' }], { skill: 'c_acid', hit: h, step });
  };
  acid('c_acid', 1); acid('c_acid_2', 2); acid('c_acid_3', 3);
  for (const id of ['c_acid_2', 'c_acid_3']) BLEND.add(id);
  // ---- Tar Pot (0.9 s): Throw_Underhand, the iron pot swung low and let go; it bursts on the machine on the contact
  { const D = 0.9, h = K12('c_tar').hit, rel = 0.36;
    C12('c_tar', D, [k(0, GL), k(0.2 / D, P(UNDER0, L.lungeL), { root: [0, -0.2, 0.1] }), k(rel / D, P(UNDER1, L.lungeL), { root: [0, -0.2, 0.15], e: 'snap' }), k(0.8, out(UNDER1, L.lungeL)), k(1, GL)],
      [{ t: 0.06 / D, e: 'holdItem', side: 'L', item: 'pot', on: true }, { t: rel / D, e: 'holdItem', side: 'L', item: 'pot', on: false }, flask(rel / D, 'pot', h.t - rel, { arc: 0.7, ground: true, spin: 6 }), { t: rel / D, e: 'sound', s: 'whoosh' }],
      { hit: h, ual: { mask: 'body', segs: [['Throw_Underhand', 0, 0.6, 0, 0.667]], end: 0.6 } }); }
  // ---- Spark Gear (0.75 s): the gear spun against its flint (sparks), the rod pushed out and the arc leaps to the machine
  const rodPush = (id, h, D, ev, o = {}) => C12(id, D, [k(0, GL), k(Math.max(0.05, h.t - 0.2) / D, P(PUSHW, L.stepBack), { root: [0, -0.03, -0.06] }), k(h.t / D, P(PUSH, L.lungeL), { root: [0, -0.1, 0.14], e: 'snap' }), k(0.72, out(PUSH, L.lungeL, 0.35)), k(1, GL)], ev,
    { hit: h, ual: { mask: 'body', segs: [['Staff_Push_Enter', 0, Math.max(0.05, h.t - 0.15), 0.1, 0.5], ['Staff_Push_Shoot', Math.max(0.05, h.t - 0.15), D, 0, 0.5]], end: D * 0.8 }, ...o });
  { const h = K12('c_spark').hit;
    rodPush('c_spark', h, 0.75, [{ t: 0.02, e: 'spinGear', dur: 0.5 }, { t: 0.04, e: 'sparks', at: 'rod', dur: 0.22 }, { t: 'hit', e: 'rodArc' }, { t: 'hit', e: 'sound', s: 'hiss' }]); }
  // ---- Volatile Mixture (0.8 s): a quick shake (the flask hisses), wound back and thrown; it lies there with its fuse burning
  { const D = 0.8, h = K12('c_volatile').hit, rel = 0.34;
    const SH = (i) => P(ROD, { spine: [6, 10, 0], armL: [-70, 0, 20], foreL: [-100 + (i % 2) * 30, 0, 0], handL: [-30 + (i % 2) * 40, 0, 0], head: [20, 0, 0] });
    C12('c_volatile', D, [k(0, GL), k(0.06 / D, SH(0)), k(0.12 / D, SH(1)), k(0.18 / D, SH(2)), k(0.26 / D, P(WIND, L.stepBack), { root: [0, -0.04, -0.12] }), k(rel / D, P(REL, L.lungeL), { root: [0, -0.16, 0.24], e: 'snap' }), k(0.84, out(REL, L.lungeL)), k(1, GL)],
      [{ t: 0.02, e: 'holdItem', side: 'L', item: 'flaskElixir', on: true }, { t: 0.04, e: 'trailSmoke', side: 'L', dur: 0.25 }, { t: rel / D, e: 'holdItem', side: 'L', item: 'flaskElixir', on: false }, flask(rel / D, 'flaskElixir', h.t - rel, { arc: 1.0, ground: true, spin: 16 }), { t: rel / D, e: 'sound', s: 'whoosh' }], { hit: h }); }
  // ---- Chill Powder (0.8 s): the rod thrust and a cone of cold-pack salts blown 10 m ahead (white, rime on what it touches)
  { const h = K12('c_chill').hit;
    rodPush('c_chill', h, 0.8, [{ t: 0.03, e: 'sound', s: 'whoosh' }, { t: (h.t - 0.04) / 0.8, e: 'cloud', kind: 'chill', r: 9, cone: true }, { t: 'hit', e: 'sound', s: 'hiss' }]); }
  // ---- Rod Vault: the old vault back on the keys, with the body's take-off, hang and landing
  DEF.c_vault = { ...DEF.c_vault, hit: K12('c_vault').hit, events: [...DEF.c_vault.events, { t: 0.12, e: 'sound', s: 'whoosh' }], ual: { mask: 'body', segs: [['Leap_Rise', 0.1, 0.3, 0.05, 0.4], ['Air_Hang_Loop', 0.3, 0.62, 0, 0.32], ['Slam_Land', 0.72, 1.0, 0.1, 0.5]], end: 0.95 } };
  // ---- Grand Detonation (1.2 s): the cask hugged low and heaved underarm with both hands, rolling to a stop by the machine
  const cask = (id, h, D, rel, ev = [], o = {}) => C12(id, D, [k(0, GL), k(0.15 / D, P(CASK0, L.deep), { root: R.deep }), k((rel - 0.12) / D, P(CASK0, { spine: [48, 0, 0] }, L.deep), { root: [0, -0.4, -0.06] }), k(rel / D, P(CASK1, L.stepL), { root: [0, 0.02, 0.2], e: 'snap' }), k(0.82, out(CASK1, L.stepL)), k(1, GL)],
    [{ t: 0.04 / D, e: 'holdItem', side: 'both', item: 'cask', on: true }, { t: rel / D, e: 'holdItem', side: 'both', item: 'cask', on: false }, { t: rel / D, e: 'proj', kind: 'flask', item: 'cask', from: 'chest', arc: 0.25, impact: 'flaskland', ground: true, spin: 4, time: Math.max(0.1, h.t - rel) }, { t: rel / D, e: 'sound', s: 'whoosh' }, ...ev],
    { hit: h, ual: { mask: 'body', segs: [['Throw_Underhand', 0, Math.min(D, rel + 0.3), 0, 0.667]], end: Math.min(D, rel + 0.3) }, ...o });
  cask('c_grand', K12('c_grand').hit, 1.2, 0.5);

  // ---- the fusions (each opens fx.fuseBudget; one light, at most one ring a beat)
  // Tarfire (0.75 s, the signature): the gear spun, the rod pushed down at the puddle and a spark ribbon runs into the tar;
  // the flame sheets rise from the puddle's edge inward (the server's czone turns it to fire)
  { const f = FUSION_BY_ID.cf_tarfire;
    rodPush('cf_tarfire', f.hit, 0.75, [{ t: 0.01, e: 'spinGear', dur: 0.4 }, { t: 0.02, e: 'sparks', at: 'rod', dur: 0.2 }, { t: 'hit', e: 'rodArc', ground: true, color: '#ffe6b8', dur: 0.3 }, { t: 'hit', e: 'sound', s: 'fire' }, shake('hit', 0.3)]); }
  // Corrosive Charge and Thermal Shock (0.75 s): the bomb thrown straight off the last throw (the acid flask green, the cold
  // flask white); the burst is the server's boom
  for (const [id, item] of [['cf_corrosive', 'flaskAcid'], ['cf_thermalshock', 'flaskLime']]) {
    const f = FUSION_BY_ID[id], D = 0.75, rel = 0.3;
    C12(id, D, [k(0, P(WIND, L.stepBack), { root: [0, -0.04, -0.1] }), k(0.16 / D, P(WIND, { spine: [-10, 46, 0] }, L.stepBack), { root: [0, -0.04, -0.14] }), k(rel / D, P(REL, L.lungeL), { root: [0, -0.16, 0.24], e: 'snap' }), k(0.82, out(REL, L.lungeL)), k(1, GL)],
      [{ t: 0.01, e: 'holdItem', side: 'L', item, on: true }, { t: rel / D, e: 'holdItem', side: 'L', item, on: false }, flask(rel / D, item, f.hit.t - rel, { arc: 0.9, ground: true, spin: 16 }), { t: rel / D, e: 'sound', s: 'whoosh' }], {});
  }
  // Pitch Vault (0.95 s): a second, lower vault back off the rod with the pot tipped out behind him (tar spraying down along
  // the path; the strip itself is the server's czone)
  { const D = 0.95, h = FUSION_BY_ID.cf_pitchvault.hit;
    C12('cf_pitchvault', D, [k(0, P(ROD, { spine: [24, 0, 0] }, L.deep), { root: [0, -0.3, 0] }), ...leapRoot(D, { t0: 0.04, t1: 0.26, t2: 0.36, t3: 0.56, h: 1.7, float: 0.05, dist: -4, atTop: 0.4, atEnd: 0.55 }),
      k(0.6, P(G, { spine: [24, 0, 0] }, L.deep), { root: [0, -0.32, -4] }), k(1, GL, { root: [0, 0, -4], e: 'smooth' })],
      [{ t: 0.02, e: 'dash' }, { t: 0.02, e: 'holdItem', side: 'L', item: 'pot', on: true }, { t: 0.1 / D, e: 'spray', dur: 0.35 }, { t: h.t / D, e: 'holdItem', side: 'L', item: 'pot', on: false }, { t: 'hit', e: 'impact', kind: 'tar', at: 'target' }, { t: 0.58, e: 'dust' }],
      { endRoot: [0, 0, -4], ual: { mask: 'body', segs: [['Leap_Rise', 0, 0.26, 0.05, 0.4], ['Air_Hang_Loop', 0.26, 0.4, 0, 0.14], ['Slam_Land', 0.5, D, 0.1, 0.5]], end: 0.9 } }); }
  // Flash Steam (0.8 s): the hot rod driven into the salts: a huge cone of white steam rolls 10 m forward, a hiss and a boom
  { const f = FUSION_BY_ID.cf_flashsteam;
    rodPush('cf_flashsteam', f.hit, 0.8, [{ t: 0.01, e: 'sparks', at: 'rod', dur: 0.2 }, { t: (f.hit.t - 0.02) / 0.8, e: 'cloud', kind: 'steam', r: 10, cone: true }, { t: 'hit', e: 'sound', s: 'hiss' }, { t: 'hit', e: 'sound', s: 'boom' }, shake('hit', 0.45)]); }
  // Chain Reaction (1.2 s): the cask heaved; his puddles and bombs go off in turn toward it (the server's cpop and boom)
  cask('cf_chainreaction', FUSION_BY_ID.cf_chainreaction.hit, 1.2, 0.5);
  // Blast Vault (1.3 s): the rod planted on his own bomb (it bursts under him, the server's first contact), flung 12 m up on
  // a 16 m arc onto the machine with a smoke ribbon behind, the landing slam T4 with one ring and a crater
  { const D = 1.3, h = FUSION_BY_ID.cf_blastvault.hit, tl = TS(h, 1);
    C12('cf_blastvault', D, [k(0, P(ROD, { spine: [26, 0, 0] }, L.deep), { root: [0, -0.32, 0] }), ...leapRoot(D, { t0: 0.1, t1: 0.48, t2: 0.62, t3: tl, h: 12, float: 0.2, dist: 14, atTop: 0.5, atEnd: 0.62 }), k(1, GL, { root: [0, 0, 14], e: 'smooth' })],
      [{ t: 'hit', e: 'impact', kind: 'blast', at: 'self', r: 3 }, { t: 0.1 / D, e: 'leap' }, { t: 0.1 / D, e: 'camlift', up: 6, back: 5, dur: 1.2 }, { t: 0.12 / D, e: 'selfSmoke', dur: 0.75 },
        { t: 'hit2', e: 'impact', kind: 'earth', at: 'self', r: 3.5 }, { t: 'hit2', e: 'decal', kind: 'crater', r: 3 }, shake('hit2', 0.7)],
      { endRoot: [0, 0, 14], toTarget: { gap: 1.2, max: 16 }, ual: { mask: 'full', segs: [['Pole_Vault', 0, 0.22, 0.3, 0.6], ['Leap_Rise', 0.2, 0.48, 0.2, 0.458], ['Air_Hang_Loop', 0.48, 0.62, 0, 0.2], ['Dive_Strike', 0.62, tl], ['Slam_Land', tl, D]] } }); }
  // Galvanic Arc (0.7 s): the gear spun on the rod; the arc goes to the machine and on through every Corroded one (sparkarc)
  rodPush('cf_galvanic', FUSION_BY_ID.cf_galvanic.hit, 0.7, [{ t: 0.01, e: 'spinGear', dur: 0.45 }, { t: 0.02, e: 'sparks', at: 'rod', dur: 0.2 }, { t: 'hit', e: 'rodArc', color: '#b8e4ff', dur: 0.3 }, { t: 'hit', e: 'sound', s: 'hiss' }, shake('hit', 0.3)]);
  // the Furnace Cask (1.2 s, the triad): the cask rolled low into the burning tar
  cask('ct_furnacedrum', FUSION_BY_ID.ct_furnacedrum.hit, 1.2, 0.48, [{ t: 0.02, e: 'sound', s: 'fire' }]);
}
// the Chemist's Side Hop (S12): a short 4 m hop the way he moves, a puff of smoke left where he was, the rod held up
{
  const G = P(guard('chemist'), { spine: [8, 0, 0] }), GL = P(G, LG), RODUP = { armR: [-60, 0, -16], foreR: [-80, 0, 0] };
  const hop = (id, dir) => (DEF[id] = C('chemist', 0.45, 'full', [
    k(0, GL),
    k(0.07 / 0.45, P(G, RODUP, { spine: [22, 0, 0] }, L.deep), { root: [0, -0.3, 0.1 * dir] }),
    k(0.2 / 0.45, P(G, RODUP, { spine: [4, 0, 0] }, L.tuck), { root: [0, 0.45, 2.0 * dir], e: 'out' }),
    k(0.32 / 0.45, P(G, RODUP, { spine: [18, 0, 0] }, L.deep), { root: [0, -0.3, 3.9 * dir], e: 'in' }),
    k(1, GL, { root: [0, 0, 4 * dir] }),
  ], [{ t: 0.02, e: 'sound', s: 'gust' }, { t: 0.06 / 0.45, e: 'cloud', kind: 'smoke', r: 1.3, at: 'self' }, { t: 0.32 / 0.45, e: 'dust' }], { endRoot: [0, 0, 4 * dir], dodge: true }));
  hop('dodge_chemist', 1); hop('dodgeb_chemist', -1);
}

// compile: resolve 'hit', 'hit2'.. into normalized times from the skill's impact timing
export const CHOREO = {};
for (const [id, def] of Object.entries(DEF)) {
  const sk = SKILL_BY_ID[def.skill || id] || FUSION_BY_ID[def.skill || id]; // (a mirrored twin, e.g. 'd_snap_l', times itself by its skill; S4: a fusion's own DEF by the fusion)
  const hit = def.hit || sk?.hit || { t: def.dur * 0.4 }; // (S8: a chain step's clip carries its own contact time)
  const n = hit.n || 1, gap = hit.gap || 0;
  const resolveT = (t) => {
    if (typeof t !== 'string') return t;
    const i = t === 'hit' ? 0 : Number(t.slice(3)) - 1;
    return Math.min(0.98, (hit.ts ? hit.ts[Math.min(i, hit.ts.length - 1)] : hit.t + Math.min(i, n - 1) * gap) / def.dur); // (hit.ts: uneven contacts, S10)
  };
  // every melee contact gets a hit-stop: big hits already stop the world; the rest stick the attacker's own swing
  const events = def.events.map((e) => {
    const o = { ...e, t: resolveT(e.t) };
    if (e.e === 'impact' && typeof e.t === 'string' && MELEE.has(e.kind) && !e.stop) o.selfStop = (e.shake || 0) >= 0.4 ? 0.07 : 0.045;
    // S1: a contact names its skill and hit, so fx.js takes the stop, shake, camera and sound from the tier (shared/feel.js)
    if (sk && typeof e.t === 'string' && /^hit\d*$/.test(e.t)) { o.sk = sk.id; o.hi = e.t === 'hit' ? 0 : Number(e.t.slice(3)) - 1; if (def.step) o.step = def.step; }
    return o;
  });
  // S1 sound timing (combat_design.md 2.9): the whoosh 0.08-0.12 s before a melee contact, never on the key press
  // (added where the clip has no swing sound of its own in that span)
  if (sk && sk.hit && ['melee', 'cone', 'aoe', 'line'].includes(sk.hit.kind) && events.some((e) => e.e === 'impact' && e.hi === 0 && MELEE.has(e.kind))) {
    const hT = hit.t / def.dur, near = (e) => e.e === 'sound' && /swing|whoosh|whirr/.test(e.s) && e.t >= hT - 0.16 / def.dur && e.t <= hT;
    for (const e of events) if (near(e) || (e.e === 'sound' && /swing|whoosh/.test(e.s) && e.t > hT - 0.25 / def.dur && e.t <= hT)) e.t = Math.max(0, hT - 0.1 / def.dur); // (the clip's own swing, put on the beat)
    if (!events.some(near) && hit.t > 0.12) events.push({ t: hT - 0.1 / def.dur, e: 'sound', s: def.events.some((e) => e.e === 'trail' && (e.w || 1) >= 1.2) ? 'whirr' : 'swing' });
  }
  events.sort((a, b) => a.t - b.t);
  // lint: a blade rolled about its own length while it trails reads as a stiff upright sweep; use arc()/wield()
  if (events.some((e) => e.e === 'trail') && def.keys.some((q) => q.p?.handR && !q.p.handR.ik && Math.abs(q.p.handR[2] || 0) > 30)) console.warn(`[choreo] ${id}: handR z-roll over 30 deg in a trailed swing; build the sweep with arc()/wield()`);
  let keys = retime(def.keys, def.dur, def.strike);
  if (def.cls === 'chemist' || def.cls === 'herbalist') keys = robeLegs(keys);
  for (let i = 1; i < keys.length; i++) if (keys[i].t < keys[i - 1].t) console.warn(`[choreo] ${id}: key ${i} out of order (${keys[i - 1].t.toFixed(3)} > ${keys[i].t.toFixed(3)})`);
  const mask = BLEND.has(id) ? 'blend' : def.mask;
  const clip = compileClip({ dur: def.dur, mask, keys, events, travel: !!def.endRoot, plant: true, channel: def.channel, ual: def.ual });
  if (def.through) clip.through = true; // (S5 Pierce the Line: runs through the machines it passes, game.js)
  CHOREO[id] = { ...def, mask, clip, events };
}

export function choreoFor(id) { return CHOREO[id]; }
// the clip a cast plays (S8): a Form's clip where one exists (Twin Cut: s_twin), else a chain step's own (s_slash_2..4)
export const clipOf = (id, step, form) => (form && CHOREO[form] ? form : step > 1 && CHOREO[id + '_' + step] ? id + '_' + step : id);
export function skillClipsFor(cls) {
  const out = {};
  for (const s of SKILLS[cls] || []) if (CHOREO[s.id]) out[s.name] = CHOREO[s.id].clip;
  return out;
}
