// Animation system: keyframed clips (Catmull-Rom), class stances, procedural locomotion with planted feet,
// an action layer (full / upper / blend masks), two-bone leg IK, additive layers (breathing, look-at, lean,
// flinch, channel) and verlet cloth chains.
import * as THREE from 'three';
import { CHAINS } from '../assets/rig.js';
import { G } from '../engine/globals.js';

const D = Math.PI / 180;
const UPPER = new Set(['spine', 'chest', 'neck', 'head', 'clavL', 'armL', 'foreL', 'handL', 'clavR', 'armR', 'foreR', 'handR', 'weaponR', 'weaponL']);
const LEGS = new Set(['thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR']);
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------
// interpolation
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
export const ease = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  snap: (t) => 1 - Math.pow(1 - t, 4), // fast attack then settle
  // rest to rest with the lowest peak speed of these (1.5x average, against 2x for inOut): wind-ups
  smooth: (t) => t * t * (3 - 2 * t),
  // strike: the last of the wind-up creeps (10% of the way at a third of the time), then the blade accelerates
  // hard, peaking (1.7x average) just before the contact pose and still moving when it lands on it
  whip: (t) => t * t * t * (3 - 2 * t),
  back: (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};

// Compile a clip: keys [{ t (0..1), p: {bone: [x,y,z] deg}, root: [x,y,z], turn: deg, e: ease, hold }]
// A key's ease describes how the pose ARRIVES at that key (the segment that ends on it).
// hold: the segment that ends on this key keeps the previous pose exactly (a held contact frame).
// Values carry forward between keys. loop clips wrap tangents.
// how far (deg) a joint really turns along the straight Euler path between two keys (deg triples)
const _eq0 = new THREE.Quaternion(), _eq1 = new THREE.Quaternion(), _ee = new THREE.Euler();
function eulerPathLen(a, b, n = 16) {
  let len = 0;
  _eq0.setFromEuler(_ee.set(a[0] * D, a[1] * D, a[2] * D));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    _eq1.setFromEuler(_ee.set((a[0] + (b[0] - a[0]) * t) * D, (a[1] + (b[1] - a[1]) * t) * D, (a[2] + (b[2] - a[2]) * t) * D));
    len += _eq0.angleTo(_eq1);
    _eq0.copy(_eq1);
  }
  return len / D;
}
function eulerUneven(a, b, n = 16) {
  let tot = 0, mx = 0;
  _eq0.setFromEuler(_ee.set(a[0] * D, a[1] * D, a[2] * D));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    _eq1.setFromEuler(_ee.set((a[0] + (b[0] - a[0]) * t) * D, (a[1] + (b[1] - a[1]) * t) * D, (a[2] + (b[2] - a[2]) * t) * D));
    const st = _eq0.angleTo(_eq1);
    tot += st; mx = Math.max(mx, st);
    _eq0.copy(_eq1);
  }
  return tot / D > 30 && mx > 2.4 * (tot / n);
}
// quaternion slerp between two Euler keys (radians), returned on the Euler branch nearest the straight blend so
// pose blending downstream stays continuous
const _sq0 = new THREE.Quaternion(), _sq1 = new THREE.Quaternion(), _se = new THREE.Euler();
function slerpEuler(a, b, f) {
  _sq0.setFromEuler(_se.set(a[0], a[1], a[2]));
  _sq1.setFromEuler(_se.set(b[0], b[1], b[2]));
  _sq0.slerp(_sq1, f);
  _se.setFromQuaternion(_sq0);
  const ref = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const P2 = Math.PI * 2;
  const wrap = (x, r) => x + P2 * Math.round((r - x) / P2);
  const A = [wrap(_se.x, ref[0]), wrap(_se.y, ref[1]), wrap(_se.z, ref[2])];
  const B = [wrap(_se.x + Math.PI, ref[0]), wrap(Math.PI - _se.y, ref[1]), wrap(_se.z + Math.PI, ref[2])];
  const d = (q) => Math.abs(q[0] - ref[0]) + Math.abs(q[1] - ref[1]) + Math.abs(q[2] - ref[2]);
  return d(B) < d(A) ? B : A;
}
export function compileClip(def) {
  const keys = def.keys;
  const n = keys.length;
  const bones = new Set();
  for (const k of keys) for (const b of Object.keys(k.p || {})) bones.add(b);
  const tracks = {}, slerps = {};
  for (const b of bones) {
    const vals = [];
    let last = null;
    for (const k of keys) { if (k.p && k.p[b]) last = k.p[b]; vals.push(last); }
    // fill leading nulls with the first defined value
    const first = vals.find((v) => v);
    for (let i = 0; i < vals.length; i++) if (!vals[i]) vals[i] = first;
    // keep each key on the Euler branch nearest the key before it (IK-solved poses can flip branch or wrap
    // by 360 deg), so the joint takes the short way round instead of spinning between keys
    const out = [];
    for (const v of vals) {
      let c = [v[0], v[1] || 0, v[2] || 0];
      const prev = out[out.length - 1];
      if (prev) {
        const wrap = (a, ref) => a + 360 * Math.round((ref - a) / 360);
        const alt = [c[0] + 180, 180 - c[1], c[2] + 180];
        const A = c.map((a, i) => wrap(a, prev[i])), B = alt.map((a, i) => wrap(a, prev[i]));
        const dist = (q) => Math.abs(q[0] - prev[0]) + Math.abs(q[1] - prev[1]) + Math.abs(q[2] - prev[2]);
        c = dist(B) + 1 < dist(A) ? B : A;
        // a straight Euler path that runs near gimbal lock (y near +-90) sweeps the limb through far more turn than the
        // two keys differ by, which shows as a one-frame pop; take the other branch when its real path is clearly shorter
        const o = c === A ? B : A, lc = eulerPathLen(prev, c), lo = eulerPathLen(prev, o);
        if (lo < lc * 0.8 && lc > 40) c = o;
      }
      out.push(c);
    }
    tracks[b] = out.map((v) => [v[0] * D, v[1] * D, v[2] * D]);
    // segments whose straight Euler path passes close to gimbal lock turn the joint very unevenly (most of the turn
    // crammed into a frame or two); those are sampled as a quaternion slerp instead
    const fl = out.map((v, i) => (i + 1 < out.length ? eulerUneven(v, out[i + 1]) : false));
    if (fl.some((x) => x)) slerps[b] = fl;
  }
  let rootLast = [0, 0, 0], turnLast = 0;
  const root = keys.map((k) => (k.root ? (rootLast = k.root) : rootLast));
  const turn = keys.map((k) => (k.turn !== undefined ? (turnLast = k.turn * D) : turnLast));
  const arrive = (i) => keys[def.loop ? (i + 1) % n : Math.min(n - 1, i + 1)];
  const eases = keys.map((k, i) => ease[arrive(i)?.e || 'inOut'] || ease.inOut);
  const holds = keys.map((k, i) => !!(i + 1 < n && keys[i + 1].hold));
  return { ...def, bones: [...bones], tracks, slerps, root, turn, times: keys.map((k) => k.t), eases, holds };
}

function segment(clip, u) {
  const ts = clip.times, n = ts.length;
  if (clip.loop) {
    u = ((u % 1) + 1) % 1;
    for (let i = 0; i < n; i++) {
      const t0 = ts[i], t1 = i + 1 < n ? ts[i + 1] : ts[0] + 1;
      if (u >= t0 && u < t1) return { i, j: (i + 1) % n, f: (u - t0) / (t1 - t0) };
    }
    return { i: n - 1, j: 0, f: 0 };
  }
  if (u <= ts[0]) return { i: 0, j: 0, f: 0 };
  if (u >= ts[n - 1]) return { i: n - 1, j: n - 1, f: 0 };
  for (let i = 0; i < n - 1; i++) if (u >= ts[i] && u <= ts[i + 1]) return { i, j: i + 1, f: (u - ts[i]) / (ts[i + 1] - ts[i] || 1) };
  return { i: n - 1, j: n - 1, f: 0 };
}

function sampleArr(arr, clip, s, k, loop) {
  const n = arr.length;
  if (clip.holds && clip.holds[s.i]) { const b = arr[s.i]; return typeof b === 'number' ? b : [b[0], b[1], b[2]]; }
  const idx = (q) => (loop ? ((q % n) + n) % n : Math.max(0, Math.min(n - 1, q)));
  const f = clip.eases[s.i](s.f);
  const sl = clip.slerps && clip.slerps[k];
  if (sl && sl[s.i] && s.i !== s.j) return slerpEuler(arr[s.i], arr[s.j], f);
  // a held key's neighbour is the same pose: take the tangent from the key before the hold
  const ia = clip.holds && clip.holds[idx(s.i - 1)] ? idx(s.i - 2) : idx(s.i - 1);
  const a = arr[ia], b = arr[s.i], c = arr[s.j], d = arr[idx(s.j + 1)];
  if (typeof b === 'number') return catmull(a, b, c, d, f);
  return [catmull(a[0], b[0], c[0], d[0], f), catmull(a[1], b[1], c[1], d[1], f), catmull(a[2], b[2], c[2], d[2], f)];
}

// evaluate a compiled clip at normalized time u into out pose map
export function evalClip(clip, u, out) {
  const s = segment(clip, u);
  for (const b of clip.bones) out[b] = sampleArr(clip.tracks[b], clip, s, b, clip.loop);
  out.__root = sampleArr(clip.root, clip, s, 'root', clip.loop);
  out.__turn = sampleArr(clip.turn, clip, s, 'turn', clip.loop);
  return out;
}

// ---------------------------------------------------------------------------
// Per-class gait: stride (cycle length), bob, extra forward lean (deg), knee lift, stance width, arm swing
const GAIT = {
  base: { stride: 1, bob: 1, lean: 0, lift: 1, width: 1, swing: 1 },
  knight: { stride: 1.02, bob: 1.05, lean: 1, lift: 1, width: 1.05 },
  warden: { stride: 1.1, bob: 1.4, lean: 4, lift: 0.9, width: 1.18, swing: 0.8 },
  sandblade: { stride: 0.92, bob: 0.7, lean: 6, lift: 1.1, width: 0.95 },
  ranger: { stride: 1.0, bob: 0.9, lean: 3, lift: 1.05, width: 0.95 },
  chemist: { stride: 0.95, bob: 0.9, lean: 2, lift: 0.7, width: 0.95 },
  herbalist: { stride: 0.95, bob: 0.9, lean: 1, lift: 0.7, width: 0.95 },
  // the Deadeye runs the Ranger's run (v109, the owner: the custom upright gait read as stiff and hunched, only the hands
  // moving): the same stride, bob, lean, knee lift and swing, holstered or with the pistols drawn (only the arms differ)
  deadeye: { stride: 1.0, bob: 0.9, lean: 3, lift: 1.05, width: 0.95 },
};
// the Deadeye with both pistols in the hip holsters (EntityView sets Animator.holster out of combat, v108): empty fists,
// the arms hanging easy beside the holsters; on the run (v109) the townsfolk's loose arms with every class's own arm swing
// and elbow pump on top (stance swing 1), nothing Deadeye-specific (blended in by holsterK)
const HOLSTERED = {
  idle: { armR: [5, 0, -13], foreR: [-14, 0, 0], handR: [0, 0, 0], armL: [5, 0, 13], foreL: [-14, 0, 0], handL: [0, 0, 0] },
  run: { armR: [-4, 0, -8], foreR: [-20, 0, 0], handR: [0, 0, 0], armL: [-4, 0, 8], foreL: [-20, 0, 0], handL: [0, 0, 0] },
};
const ROBED = new Set(['chemist', 'herbalist']);

// class stances: arm/weapon poses layered over locomotion. weaponArm swing scale per side.
export const STANCES = {
  knight: {
    // relaxed: sword resting point-down ahead of the feet, shield lowered on the forearm
    idle: { armR: [4, 0, -10], foreR: [-14, 0, 0], handR: [36, 0, 0], armL: [-14, 40, 14], foreL: [-62, 0, 0], handL: [0, 0, 0] },
    // combat: guard at chest height, blade canted out to the right and forward so the helm slit stays clear
    combat: { armR: [-26, 12, -26], foreR: [-58, 0, 0], handR: [-6, -32, -18], armL: [-48, 72, 26], foreL: [-100, 0, 0], handL: [0, 0, 0] },
    // running: sword carried low, point forward-down; shield kept up; the sword arm barely swings so the blade never trails
    run: { armR: [-4, 0, -14], foreR: [-28, 0, 0], handR: [46, 0, 0], armL: [-34, 60, 22], foreL: [-95, 0, 0] },
    swing: [0.25, 0.35],
  },
  ranger: {
    idle: { armL: [-12, 0, 10], foreL: [-30, 0, 0], handL: [-60, 0, 0], armR: [-6, 0, -10], foreR: [-20, 0, 0], handR: [0, 0, 0] },
    combat: { armL: [-34, 0, 30], foreL: [-30, 0, 0], handL: [-45, 0, 0], armR: [-20, 0, -14], foreR: [-50, 0, 0], handR: [0, 0, 0] },
    run: { armL: [-10, 0, 12], foreL: [-55, 0, 0], handL: [-20, 0, 0], armR: [-6, 0, -10], foreR: [-50, 0, 0] },
    swing: [0.6, 1],
  },
  chemist: {
    // the rod stands out beside the right shoulder (arm abducted, rod leaned out) so the lamp never sits in front of the goggles
    idle: { armR: [-16, 0, -26], foreR: [-66, 0, 0], handR: [-6, 0, -14], armL: [-6, 0, 10], foreL: [-34, 0, 0], handL: [0, 0, 0] },
    combat: { armR: [-28, 0, -28], foreR: [-72, 0, 0], handR: [8, 0, -16], armL: [-40, 0, 18], foreL: [-60, 0, 0], handL: [-20, 0, 0] },
    // running: the rod is carried upright like a pole, head just behind vertical and out to the side
    run: { armR: [-14, 0, -22], foreR: [-72, 0, 0], handR: [-14, 0, -12], armL: [-6, 0, 12], foreL: [-50, 0, 0] },
    swing: [1, 0.3],
  },
  sandblade: {
    idle: { armR: [2, 0, -12], foreR: [-16, 0, 0], handR: [34, 0, 0], armL: [-12, 36, 14], foreL: [-58, 0, 0], handL: [0, 0, 0] },
    combat: { armR: [-30, 0, -24], foreR: [-56, 0, 0], handR: [-40, 0, 0], armL: [-44, 70, 24], foreL: [-98, 0, 0], handL: [0, 0, 0] },
    run: { armR: [-4, 0, -16], foreR: [-28, 0, 0], handR: [46, 0, 0], armL: [-26, 50, 18], foreL: [-88, 0, 0] },
    swing: [0.3, 0.35],
  },
  warden: {
    // hammer rests on the shoulder when relaxed
    idle: { armR: [-28, 20, -22], foreR: [-112, 0, 0], handR: [40, 0, 10], armL: [-30, 60, 24], foreL: [-95, 0, 0], handL: [0, 0, 0] },
    // combat: hammer angled forward-up off the right shoulder, tower shield square in front
    combat: { armR: [-30, 10, -22], foreR: [-44, 0, 0], handR: [16, 0, 0], armL: [-50, 74, 28], foreL: [-100, 0, 0], handL: [0, 0, 0] },
    // running: hammer stays on the shoulder
    run: { armR: [-28, 20, -22], foreR: [-112, 0, 0], handR: [40, 0, 10], armL: [-36, 62, 24], foreL: [-95, 0, 0] },
    swing: [0.2, 0.12],
  },
  herbalist: {
    // staff planted out to the right, lantern beside the hood rather than in front of it
    idle: { armR: [-16, 0, -26], foreR: [-66, 0, 0], handR: [-6, 0, -14], armL: [-6, 0, 10], foreL: [-30, 0, 0], handL: [0, 0, 0] },
    combat: { armR: [-26, 0, -28], foreR: [-72, 0, 0], handR: [8, 0, -16], armL: [-34, 0, 16], foreL: [-56, 0, 0], handL: [0, 0, 0] },
    run: { armR: [-14, 0, -22], foreR: [-72, 0, 0], handR: [-14, 0, -12], armL: [-6, 0, 12], foreL: [-50, 0, 0] },
    swing: [1, 0.3],
  },
  // two pistols, one in each fist, always parallel (never crossed). These are rough starting angles: the clips file
  // (choreo.js) solves the real ones from where the barrels should point before any clip reads them.
  deadeye: {
    // relaxed: both pistols lowered beside the thighs, barrels pointing down and a little forward
    idle: { armR: [-6, 0, -10], foreR: [-30, 0, 0], handR: [40, 0, 0], armL: [-6, 0, 10], foreL: [-30, 0, 0], handL: [40, 0, 0] },
    // combat: low ready, both barrels forward and down, elbows in
    combat: { armR: [-24, 0, -10], foreR: [-62, 0, 0], handR: [70, 0, 0], armL: [-24, 0, 10], foreL: [-62, 0, 0], handL: [70, 0, 0] },
    // running: pistols carried low, barrels down
    run: { armR: [-6, 0, -12], foreR: [-56, 0, 0], handR: [60, 0, 0], armL: [-6, 0, 12], foreL: [-56, 0, 0], handL: [60, 0, 0] },
    swing: [0.4, 0.4],
  },
  raider: {
    idle: { armR: [-10, 0, -12], foreR: [-40, 0, 0], handR: [-20, 0, 0], armL: [-10, 0, 12], foreL: [-40, 0, 0], handL: [-20, 0, 0] },
    combat: { armR: [-36, 0, -22], foreR: [-70, 0, 0], handR: [-40, 0, 0], armL: [-36, 0, 22], foreL: [-70, 0, 0], handL: [-40, 0, 0] },
    run: { armR: [-6, 0, -14], foreR: [-70, 0, 0], handR: [30, 0, 0], armL: [-6, 0, 14], foreL: [-70, 0, 0], handL: [30, 0, 0] },
    swing: [0.8, 0.8],
  },
  villager: {
    idle: { armR: [-4, 0, -8], foreR: [-20, 0, 0], armL: [-4, 0, 8], foreL: [-20, 0, 0] },
    combat: { armR: [-4, 0, -8], foreR: [-20, 0, 0], armL: [-4, 0, 8], foreL: [-20, 0, 0] },
    swing: [1, 1],
  },
};

// ---------------------------------------------------------------------------
// Locomotion foot path for one foot. u: the foot's own phase (0 = heel strike). Returns the ankle's
// forward offset f (along the travel direction), height y above its rest height, pitch (deg, + = toe down)
// and contact (how much the foot carries weight, used for the hip height).
function footPath(u, S, duty, lift, run, out) {
  const heelLift = lerp(0.05, 0.1, run);
  if (u < duty) {
    const w = u / duty;
    out.f = S * (0.5 - w);
    const heel = sstep(0.55, 1, w);
    out.y = heel * heelLift;
    out.pitch = -12 * (1 - sstep(0, 0.18, w)) + heel * 30;
    out.contact = 1;
    out.stance = Math.sin(Math.PI * w);
  } else {
    const s = (u - duty) / (1 - duty);
    // run: the heel kicks up behind before the knee drives through; walk: a low, even arc
    const fs = lerp(sstep(0, 1, s), sstep(0, 1, Math.pow(s, 1.25)), run);
    out.f = -S / 2 + S * fs;
    const peak = lerp(0.5, 0.38, run);
    const arc = s < peak ? Math.sin((s / peak) * Math.PI / 2) : Math.cos(((s - peak) / (1 - peak)) * Math.PI / 2);
    out.y = lift * arc + heelLift * (1 - sstep(0, 0.35, s));
    out.pitch = lerp(30, 6, sstep(0, 0.45, s)) + (-18 - 6) * sstep(0.55, 1, s);
    out.contact = s < 0.15 ? 1 - s / 0.15 : s > 0.78 ? (s - 0.78) / 0.22 : 0;
    out.stance = 0;
  }
  return out;
}

// ---------------------------------------------------------------------------
const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
// world transforms read straight from matrixWorld: the animator refreshes the rig's matrices before it reads them, so
// the getWorld*() calls (each walks the whole parent chain again) are not needed in the hot paths below
const _ds = new THREE.Vector3(), _dp = new THREE.Vector3();
const wPos = (o, v) => v.setFromMatrixPosition(o.matrixWorld);
const wQuat = (o, q) => { o.matrixWorld.decompose(_dp, q, _ds); return q; };
const _qF = new THREE.Quaternion();
// solveLegs / updateChains / clampWeapon scratch (no per-frame allocations)
const _LA = { L: new THREE.Vector3(), R: new THREE.Vector3() }, _LK = { L: new THREE.Vector3(), R: new THREE.Vector3() }, _LH = { L: new THREE.Vector3(), R: new THREE.Vector3() };
const _sT = new THREE.Vector3(), _sMid = new THREE.Vector3(), _sPole = new THREE.Vector3(), _sLT = new THREE.Vector3(), _sP2 = new THREE.Vector3(), _sF = new THREE.Vector3();
const _sRootQ = new THREE.Quaternion(), _sFootQ = new THREE.Quaternion(), _sCur = new THREE.Quaternion(), _sQL = new THREE.Quaternion(), _sInv = new THREE.Matrix4();
const _sEul = new THREE.Euler(0, 0, 0, 'YXZ');
const _cQ = new THREE.Quaternion(), _cD = new THREE.Vector3();

// Two-bone leg IK in world space. Rotates thigh and shin so the ankle (foot bone origin) reaches `target`,
// with the knee toward `pole` (a world direction). footQW: desired world rotation of the foot (or null to keep it).
// w blends from the current (FK) pose to the solution.
function solveLeg(thigh, shin, foot, target, pole, footQW, w) {
  if (w <= 0.001) return;
  const Hp = wPos(thigh, _a);
  const a = shin.position.length(), c = foot.position.length();
  const T = _b.copy(target);
  let d = T.distanceTo(Hp);
  const maxR = (a + c) * 0.9995, minR = Math.abs(a - c) + 0.05;
  if (d > maxR) { T.sub(Hp).setLength(maxR).add(Hp); d = maxR; }
  if (d < minR) { T.sub(Hp).setLength(minR).add(Hp); d = minR; }
  const u = _c.subVectors(T, Hp).normalize();
  const x0 = (a * a - c * c + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x0 * x0));
  const pv = _d.copy(pole).addScaledVector(u, -pole.dot(u));
  if (pv.lengthSq() < 1e-6) pv.set(0, 0, 1).addScaledVector(u, -u.z);
  pv.normalize();
  const K = _e.copy(Hp).addScaledVector(u, x0).addScaledVector(pv, h);
  // thigh basis: +Y from knee up to hip, +Z toward the knee's front
  const yA = tmpV.subVectors(Hp, K).normalize();
  const zA = tmpV2.copy(pv).addScaledVector(yA, -pv.dot(yA)).normalize();
  const xA = _a.crossVectors(yA, zA); // Hp no longer needed
  _m.makeBasis(xA, yA, zA);
  const qThighW = _q1.setFromRotationMatrix(_m);
  const parentQ = wQuat(thigh.parent, _q2);
  const qThighL = _q3.copy(parentQ).invert().multiply(qThighW);
  const qFootW = footQW ? _qF.copy(footQW) : wQuat(foot, _qF);
  thigh.quaternion.slerp(qThighL, w);
  // knee bend: angle between thigh and shin directions (positive x bends the knee)
  const th = _c.subVectors(K, wPos(thigh, _a)).normalize();
  const sh = tmpV.subVectors(T, K).normalize();
  const bend = Math.acos(clamp(th.dot(sh), -1, 1));
  _q2.setFromAxisAngle(AX, bend);
  shin.quaternion.slerp(_q2, w);
  thigh.updateMatrixWorld(true);
  const shinQW = wQuat(shin, _q2);
  foot.quaternion.slerp(_q3.copy(shinQW).invert().multiply(qFootW), w);
  foot.updateMatrixWorld(true);
}

export class Animator {
  constructor(char, cls) {
    this.char = char;
    this.cls = cls;
    this.bones = char.userData.bones;
    this.stance = STANCES[cls] || STANCES.villager;
    this.gait = { ...GAIT.base, ...(GAIT[cls] || {}) };
    this.robed = ROBED.has(cls);
    this.phase = 0;
    this.speed = 0; // smoothed m/s
    this.combat = 0; // 0..1
    this.combatTarget = 0;
    this.t = Math.random() * 10;
    this.action = null; // { clip, time, dur, speed, fadeIn, fadeOut, w }
    this.prevAction = null;
    this.pose = {};
    this.lookYaw = 0; this.lookYawTarget = 0;
    this.lean = 0; this.leanTarget = 0;
    this.aimTwist = 0; this.aimTw = 0; // upper-body twist onto a target while a shot plays on the run (set by game.js)
    // pistols holstered (the Deadeye out of combat, set by EntityView): holsterK eases 0..1 (a 0.2 s draw, a 0.35 s
    // holster); pistolsIn says when the pistols should be in the holsters (in as the hands come down to the hips, out at
    // the start of the draw)
    this.holster = 0; this.holsterK = 0; this.pistolsIn = false;
    this.flinch = 0; this.flinchDir = 1; this.flinchT = 9; this.flinchKind = 0; this.flinchPow = 1;
    this.air = 0; // jump/fall airborne blend
    this.dead = false; this.deadT = 0; this.deathKind = 0;
    this.rootOffset = new THREE.Vector3();
    this.turnOffset = 0;
    this.travel = 0;
    this.listeners = [];
    this.stopT = 0; // self hit-stop on light contacts
    this.moveDir = 0; // travel direction relative to facing (rad)
    this.vel = new THREE.Vector3();
    this.prevPos = null;
    this.hipsSmooth = null;
    const b = this.bones;
    // rest offsets are captured once per skeleton (a later Animator on the same character must not read a posed hip)
    const restOf = (bone) => (bone ? (bone.userData.restPos || (bone.userData.restPos = bone.position.clone())) : null);
    this.rest = {
      hipsY: restOf(b.hips).y,
      thighY: restOf(b.thighL).y,
      legA: restOf(b.shinL).length(),
      legC: restOf(b.footL).length(),
      wR: restOf(b.weaponR),
      wL: restOf(b.weaponL),
    };
    this.rest.ankle = this.rest.hipsY + this.rest.thighY - this.rest.legA - this.rest.legC;
    this.wlen = null;
    this.drop = null;
    this.initChains();
  }

  // play an action clip once. o: { speed, fadeIn, fadeOut, onEvent, travelK (root travel scale) }
  play(clip, o = {}) {
    if (this.dead) return;
    this.prevAction = this.action ? { ...this.action, outT: 0 } : null;
    this.action = { clip, time: 0, speed: o.speed ?? 1, fadeIn: o.fadeIn ?? 0.08, fadeOut: o.fadeOut ?? 0.18, fired: new Set(), onEvent: o.onEvent, onEnd: o.onEnd, travelK: o.travelK ?? 1 };
    this.stopT = 0;
    this.combatTarget = 1;
    this.combatTimer = 6;
  }
  stop(fade = 0.15) { if (this.action) { this.action.time = Math.max(this.action.time, this.action.clip.dur - fade); } }
  // flinch. dir: the way the blow travels (attacker -> target) in this character's own space as { x, z }
  // (+z = the way it faces), or a legacy ±1 side. pow: hit weight, under 0.4 a graze, under 0.8 a solid hit,
  // 0.8 and up a stagger with a step back (crits, heavy skills, big chunks of health); random when omitted.
  hit(dir = 1, pow) {
    const p = pow ?? Math.random();
    this.flinchKind = p >= 0.8 ? 2 : p >= 0.4 ? 1 : 0;
    let ax, az;
    const l = dir && typeof dir === 'object' ? Math.hypot(dir.x || 0, dir.z || 0) : 0;
    if (l > 1e-4) { ax = dir.x / l; az = dir.z / l; }
    else { const s = typeof dir === 'number' && dir ? Math.sign(dir) : 1; ax = -0.35 * s; az = -0.94; } // legacy: from the front, a little to one side
    this.flinchAway = [ax, az];
    this.flinchDir = Math.abs(ax) > 0.2 ? -Math.sign(ax) : Math.random() < 0.5 ? 1 : -1; // twist side
    // strength grows inside each band so two grazes of different size still read differently
    const kd = this.flinchKind;
    this.flinchPow = kd === 0 ? 0.5 + 0.35 * clamp(p / 0.4, 0, 1) : kd === 1 ? 0.85 + 0.2 * clamp((p - 0.4) / 0.4, 0, 1) : 1.05 + 0.25 * clamp((p - 0.8) / 0.6, 0, 1);
    // start part-way up the snap so the hit pose is already showing while the hit-stop holds the frame
    this.flinchT = kd === 2 ? 0.045 : 0.03; this.flinch = 1;
    this.combatTarget = 1; this.combatTimer = 6;
  }
  // kind: 0 back, 1 forward, 2 spun to the side; dir (as in hit) picks it: the body falls the way the killing blow pushed it
  die(kind, dir) {
    this.dead = true; this.deadT = 0; this.action = null;
    const l = dir && typeof dir === 'object' ? Math.hypot(dir.x || 0, dir.z || 0) : 0;
    if (kind == null && l > 1e-4) {
      const ax = dir.x / l, az = dir.z / l;
      kind = az < -0.6 ? 0 : az > 0.6 ? 1 : 2;
      // side fall: sd 1 lands toward local -x; on the back/front falls sd only sets which way the head rolls
      this.deathSide = Math.abs(ax) > 0.05 ? (ax < 0 ? 1 : -1) : Math.random() < 0.5 ? 1 : -1;
    } else this.deathSide = Math.random() < 0.5 ? 1 : -1;
    this.deathKind = kind ?? Math.floor(Math.random() * 3);
    this.drop = null;
  }
  revive() {
    this.dead = false; this.deadT = 0; this.drop = null;
    const b = this.bones;
    if (this.rest.wR) b.weaponR.position.copy(this.rest.wR);
    if (this.rest.wL) b.weaponL.position.copy(this.rest.wL);
  }

  // ctx: { speed (m/s), turnRate (rad/s), air (bool), lookYaw (rad relative) }
  update(dt, ctx = {}) {
    const hero = this.char.userData.hero; // the new body (assets/hero/heroBody.js, ?herobody=1): old bones back at rest first
    if (hero) hero.pre(this);
    this.t += dt;
    const b = this.bones;
    const pose = this.pose;
    for (const k in pose) delete pose[k];
    // smooth inputs
    const sp = ctx.speed ?? 0;
    this.speed += (sp - this.speed) * (1 - Math.exp(-dt * 10));
    if (this.combatTimer > 0) { this.combatTimer -= dt; if (this.combatTimer <= 0) this.combatTarget = 0; }
    if (ctx.combat !== undefined) this.combatTarget = ctx.combat ? 1 : this.combatTarget;
    this.combat += (this.combatTarget - this.combat) * (1 - Math.exp(-dt * 5));
    this.air += ((ctx.air ? 1 : 0) - this.air) * (1 - Math.exp(-dt * 12));
    this.leanTarget = clamp((ctx.turnRate ?? 0) * 0.12 * Math.min(1, this.speed / 5), -0.25, 0.25);
    this.lean += (this.leanTarget - this.lean) * (1 - Math.exp(-dt * 6));
    this.lookYawTarget = ctx.lookYaw ?? 0;
    this.lookYaw += (this.lookYawTarget - this.lookYaw) * (1 - Math.exp(-dt * 8));
    this.trackMotion(dt);
    // the new body on a townsperson with nothing keyed playing: its clips pose everything, so skip the hand-made pose
    if (hero && hero.clipOnly(this)) {
      this.rootOffset.set(0, 0, 0); this.locoHipsY = 0; this.turnOffset = 0; this.actW = 0; this.actLegW = 0; this.flinch = 0;
      hero.post(this, dt);
      if ((this.lod || 0) < 1) { if (this.chainsCold) { for (const ch of this.chains) ch.pts = null; this.chainsCold = false; } this.updateChains(dt); } else this.chainsCold = true;
      return;
    }

    // ---- base: idle / walk / run
    const runK = clamp((this.speed - 2.5) / 3.5, 0, 1);
    const moveK = clamp(this.speed / 1.2, 0, 1);
    const gait = this.gait;
    const walkLen = lerp(0.9, 1.3, clamp(this.speed / 1.8, 0, 1));
    const cycleLen = lerp(walkLen, 3.1, runK) * gait.stride;
    const duty = lerp(0.6, 0.24, runK);
    if (this.speed > 0.05) this.phase = (this.phase + (this.speed / cycleLen) * dt) % 1;
    this.moveK = moveK; this.runK = runK;
    const st = this.stance;
    // stance (idle/combat blend)
    const runStanceK = clamp((this.speed - 1) / 3, 0, 1);
    {
      const hT = this.holster ? 1 : 0;
      this.holsterK = hT > this.holsterK ? Math.min(1, this.holsterK + dt / 0.35) : Math.max(hT, this.holsterK - dt / 0.2);
      if (hT && this.holsterK > 0.85) this.pistolsIn = true; else if (!hT && this.holsterK < 0.8) this.pistolsIn = false;
    }
    const hk = sstep(0, 1, this.holsterK);
    for (const bn of Object.keys(st.idle)) {
      const a = st.idle[bn], c = st.combat[bn] || a;
      let v = [lerp(a[0], c[0], this.combat), lerp(a[1], c[1], this.combat), lerp(a[2], c[2], this.combat)];
      const r = st.run && st.run[bn];
      if (r && runStanceK > 0) v = [lerp(v[0], r[0], runStanceK), lerp(v[1], r[1], runStanceK), lerp(v[2], r[2], runStanceK)];
      const h = hk > 0 && HOLSTERED.idle[bn];
      if (h) { const hr = HOLSTERED.run[bn]; for (let i = 0; i < 3; i++) v[i] = lerp(v[i], lerp(h[i], hr[i], runStanceK), hk); }
      pose[bn] = [v[0] * D, v[1] * D, v[2] * D];
    }
    const add = (bn, x, y = 0, z = 0) => { const p = pose[bn] || (pose[bn] = [0, 0, 0]); p[0] += x; p[1] += y; p[2] += z; };
    // breathing + idle weight shift
    const br = Math.sin(this.t * 2.0);
    const idleK = 1 - moveK;
    add('chest', br * 1.6 * D * idleK, 0, 0);
    add('spine', (2 + this.combat * 6) * D * idleK, Math.sin(this.t * 0.6) * 2 * D * idleK, 0);
    add('neck', -br * 1 * D * idleK);
    add('clavL', 0, 0, br * 1.2 * D); add('clavR', 0, 0, -br * 1.2 * D);
    const shift = Math.sin(this.t * 0.45) * idleK;
    add('hips', 0, 0, shift * 2.5 * D);
    // breathing bob is applied after the feet are planted, so it flexes the knees instead of floating the feet
    this.breathY = -0.012 * idleK * (0.5 + 0.5 * br);
    let hipsY = -this.combat * 0.06 * idleK;
    // combat crouch on the legs
    const crouch = this.combat * idleK;
    add('thighL', -14 * D * crouch, 0, 4 * D * crouch); add('shinL', 26 * D * crouch); add('footL', -12 * D * crouch);
    add('thighR', -6 * D * crouch, 0, -4 * D * crouch); add('shinR', 18 * D * crouch); add('footR', -12 * D * crouch);
    add('thighL', 0, 0, -shift * 2 * D); add('thighR', 0, 0, -shift * 2 * D);
    // idle fidgets: after standing still out of combat for a while, now and then look around, shift the weight,
    // glance at the weapon hand or roll the shoulders (each a smooth swell in and out, layered over the stance)
    {
      const still = idleK > 0.98 && this.combat < 0.05 && !this.action && !this.dead && !this.noFidget;
      this.stillT = still ? (this.stillT || 0) + dt : 0;
      let f = this.fid;
      if (!still) f = this.fid = null;
      else if (!f && this.stillT > 5) {
        if ((this.fidWait = (this.fidWait ?? 2 + Math.random() * 3) - dt) <= 0) {
          const kinds = ['look', 'shift', 'glance', 'roll'];
          f = this.fid = { k: kinds[Math.floor(Math.random() * kinds.length)], t: 0, dur: 2 + Math.random() * 0.8, s: Math.random() < 0.5 ? 1 : -1 };
          this.fidWait = 6 + Math.random() * 6;
        }
      }
      if (f) {
        f.t += dt;
        const u = f.t / f.dur;
        if (u >= 1) this.fid = null;
        else {
          const w = Math.sin(Math.PI * u) ** 2, sd = f.s;
          if (f.k === 'look') { const y = Math.sin(u * Math.PI * 2) * 38 * sd; add('neck', 0, y * 0.35 * D, 0); add('head', -4 * w * D, y * 0.65 * D, 0); add('spine', 0, y * 0.12 * D, 0); }
          else if (f.k === 'shift') { add('hips', 0, 0, sd * 5 * w * D); add('thighL', 0, 0, -sd * 4 * w * D); add('thighR', 0, 0, -sd * 4 * w * D); add(sd > 0 ? 'shinR' : 'shinL', 10 * w * D); add('spine', 0, 0, -sd * 3 * w * D); }
          else if (f.k === 'glance') { add('armR', -16 * w * D, 0, 4 * w * D); add('foreR', -22 * w * D); add('handR', 0, 18 * w * D, 0); add('head', 14 * w * D, -16 * w * D, 0); add('neck', 6 * w * D); }
          else { add('clavL', 0, 0, 7 * w * D); add('clavR', 0, 0, -7 * w * D); add('chest', -6 * w * D); add('head', -8 * w * D, 0, sd * 6 * w * D); }
        }
      }
    }

    // locomotion: feet follow ground-locked paths (stance sweep = duty * cycle length, so they never slide)
    const loco = this.loco || (this.loco = { L: {}, R: {}, on: false });
    loco.on = moveK > 0.001;
    this.locoHipsYaw = 0;
    if (loco.on) {
      const S = duty * cycleLen;
      const lift = lerp(0.1, 0.3, runK) * gait.lift;
      footPath(this.phase, S, duty, lift, runK, loco.L);
      footPath((this.phase + 0.5) % 1, S, duty, lift, runK, loco.R);
      // hip height: as high as the planted feet allow (a walk vaults over the stance leg), with run compression
      const R0 = (this.rest.legA + this.rest.legC) * lerp(0.985, 0.95, runK);
      const half = 0.11 * gait.width;
      let cap = Infinity, comp = 0;
      for (const [F, sx] of [[loco.L, 1], [loco.R, -1]]) {
        const lat = (half - lerp(0.0, 0.03, runK)) * sx - 0.11 * sx;
        const dxz2 = F.f * F.f + lat * lat;
        const hc = this.rest.ankle + F.y + Math.sqrt(Math.max(0, R0 * R0 - dxz2)) - this.rest.thighY + (1 - F.contact) * 0.5;
        cap = Math.min(cap, hc);
        comp = Math.max(comp, F.stance * F.contact);
      }
      const stand = this.rest.hipsY - lerp(0.04, 0.05, runK) * (0.6 + 0.4 * gait.bob);
      let hy = Math.min(stand, cap) - comp * 0.035 * runK * gait.bob;
      if (this.hipsSmooth === null || !this.wasMoving) this.hipsSmooth = hy;
      this.hipsSmooth += (hy - this.hipsSmooth) * (1 - Math.exp(-dt * 30));
      loco.hipsY = this.hipsSmooth - this.rest.hipsY;
      loco.S = S;
      hipsY = lerp(hipsY, loco.hipsY, moveK);
      // upper body: forward lean, pelvis twist with the legs, chest counter-twist, opposite arm swing
      const c = Math.cos(this.phase * Math.PI * 2);
      const s = Math.sin(this.phase * Math.PI * 2);
      const md = this.moveDir;
      // strafing / backpedalling (only happens while an attack keeps the body facing its target): hips turn toward the travel
      // the hips turn toward the travel (forward) or away from it (backpedal), crossfaded through the sideways strafe:
      // a hard switch at ~100 deg flipped the pelvis ~90 deg in one frame (a ranger kiting while it shoots crosses it on
      // every shot), which read as the body lurching one way and then the other
      const backK = sstep(1.45, 2.05, Math.abs(md));
      const hipTurn = lerp(clamp(md, -0.8, 0.8), clamp(Math.atan2(Math.sin(md - Math.PI), Math.cos(md - Math.PI)), -0.8, 0.8), backK) * moveK;
      this.locoHipsYaw = -c * (5 + 4 * runK) * D * moveK + hipTurn;
      add('hips', 3 * D * runK * moveK, this.locoHipsYaw, s * 2 * D * moveK * (1 - runK));
      add('spine', (5 + 15 * runK + gait.lean * runK) * D * moveK, c * 6 * D * moveK - hipTurn * 0.6, 0);
      add('chest', 2 * D * runK * moveK, c * 8 * D * moveK - hipTurn * 0.4, 0);
      add('head', -(8 * runK + gait.lean * 0.6 * runK + (gait.headUp || 0) * runK) * D * moveK, -c * 5 * D * moveK);
      const swL = lerp(st.swing[0], 1, hk), swR = lerp(st.swing[1], 1, hk);
      const armA = (22 + 26 * runK) * D * moveK * lerp(gait.swing ?? 1, 1, hk);
      add('armL', c * armA * swL, 0, 4 * D * runK * moveK);
      add('armR', -c * armA * swR, 0, -4 * D * runK * moveK);
      add('foreL', (-24 * runK - Math.max(0, -c) * 22 * runK) * D * moveK * swL);
      add('foreR', (-24 * runK - Math.max(0, c) * 22 * runK) * D * moveK * swR);
      // legs FK approximation (the IK pass below makes it exact); used while airborne blends in
      for (const [F, side] of [[loco.L, 'L'], [loco.R, 'R']]) {
        const H = this.hipsSmooth + this.rest.thighY - this.rest.ankle - F.y;
        const dd = Math.min(Math.hypot(F.f, H), (this.rest.legA + this.rest.legC) * 0.999);
        const A = this.rest.legA, C = this.rest.legC;
        const kneeIn = Math.acos(clamp((A * A + C * C - dd * dd) / (2 * A * C), -1, 1));
        const toT = Math.atan2(F.f, H);
        const thA = toT + Math.acos(clamp((A * A + dd * dd - C * C) / (2 * A * dd), -1, 1));
        add('thigh' + side, -thA * moveK);
        add('shin' + side, (Math.PI - kneeIn) * moveK);
        add('foot' + side, (F.pitch * D - (-thA + Math.PI - kneeIn)) * moveK);
      }
    }
    this.wasMoving = loco.on;
    // airborne tuck
    if (this.air > 0.01) {
      const a = this.air;
      add('thighL', -40 * D * a); add('shinL', 70 * D * a); add('thighR', -15 * D * a); add('shinR', 45 * D * a);
      add('armL', -20 * D * a, 0, 25 * D * a); add('armR', -20 * D * a, 0, -25 * D * a);
      add('spine', 8 * D * a);
    }
    // lean into turns
    add('hips', 0, 0, -this.lean); add('spine', 0, 0, -this.lean * 0.5);
    // look toward the target (head + chest share the twist)
    const ly = clamp(this.lookYaw, -1.1, 1.1);
    add('head', 0, ly * 0.45, 0); add('neck', 0, ly * 0.25, 0); add('chest', 0, ly * 0.3, 0);

    // ---- action layer
    this.locoHipsY = hipsY; // (the new body's clips bob on their own: heroBody.js takes only the action's root offset)
    this.rootOffset.set(0, hipsY, 0);
    this.turnOffset = 0;
    this.actLegW = 0; this.actW = 0; this.actPlant = false; this.actRootZ = 0; this.actAirborne = 0;
    const applyAction = (act, wScale) => {
      if (!act) return;
      const c = act.clip;
      const u = Math.min(1, act.time / c.dur);
      const ap = {};
      evalClip(c, u, ap);
      const wIn = Math.min(1, act.time / Math.max(0.001, act.fadeIn));
      const wOut = Math.min(1, (c.dur - act.time) / Math.max(0.001, act.fadeOut));
      const w = Math.max(0, Math.min(wIn, wOut)) * wScale;
      this.actW = Math.max(this.actW, w); // (the retarget weight of the new body's upper half, heroBody.js)
      const mask = c.mask || 'upper';
      const blend = mask === 'blend';
      // blend: the clip owns the upper body; legs and hip travel come from locomotion while moving
      const legW = mask === 'full' ? w : blend ? w * (1 - moveK) : 0;
      const hipsBefore = pose.hips ? pose.hips[1] : 0;
      for (const bn of c.bones) {
        const v = ap[bn];
        const p = pose[bn] || (pose[bn] = [0, 0, 0]);
        let ww = w;
        if (LEGS.has(bn)) ww = legW;
        else if (bn === 'hips') ww = mask === 'full' ? w : blend ? w * (1 - 0.5 * moveK) : 0;
        else if (!UPPER.has(bn) && mask !== 'full') ww = 0;
        if (c.additive) { p[0] += v[0] * ww; p[1] += v[1] * ww; p[2] += v[2] * ww; }
        else { p[0] += (v[0] - p[0]) * ww; p[1] += (v[1] - p[1]) * ww; p[2] += (v[2] - p[2]) * ww; }
      }
      if (blend && moveK > 0) {
        // keep the torso facing where the clip wants it: give the spine whatever hip twist locomotion took away
        const clipHips = ap.hips ? ap.hips[1] : hipsBefore;
        const finalHips = pose.hips ? pose.hips[1] : 0;
        add('spine', 0, (clipHips - finalHips) * w * moveK, 0);
      }
      // looping channel layer during long casts: an additive sway that grows toward the release
      if (c.channel) {
        const ch = c.channel;
        const k = sstep(ch.from, ch.to, u) * (u > ch.to ? Math.max(0, 1 - (u - ch.to) / 0.06) : 1);
        if (k > 0) {
          const amp = (ch.base ?? 0.35) + (1 - (ch.base ?? 0.35)) * k;
          const sn = Math.sin(act.time * Math.PI * 2 * (ch.hz || 2.2));
          for (const [bn, v] of Object.entries(ch.bones)) add(bn, v[0] * D * sn * amp * w * Math.min(1, k * 4), (v[1] || 0) * D * sn * amp * w * Math.min(1, k * 4), (v[2] || 0) * D * sn * amp * w * Math.min(1, k * 4));
        }
      }
      const r = ap.__root;
      const rw = blend ? w * (1 - moveK) : w;
      if (c.travel) {
        // forward root motion becomes real movement of the character (dash, leap, charge)
        const dz = r[2] - (act.lastZ ?? 0);
        act.lastZ = r[2];
        this.travel += dz * act.travelK; // (S4: a leap scaled to land at its target, entities.js playSkill)
        this.rootOffset.x += r[0] * rw; this.rootOffset.y += r[1] * rw;
      } else {
        this.rootOffset.x += r[0] * rw; this.rootOffset.y += r[1] * rw; this.rootOffset.z += r[2] * rw;
        this.actRootZ += r[2] * rw;
      }
      this.actAirborne = Math.max(this.actAirborne, r[1] * rw);
      // spins are authored as whole turns (-720 deg); take the turn modulo a full circle before weighting it, or the
      // fade at the clip's end scales the full -720 and whips the body round once more in a few frames
      const trn = ap.__turn;
      this.turnOffset += Math.atan2(Math.sin(trn), Math.cos(trn)) * rw;
      this.actLegW = Math.max(this.actLegW, legW);
      if (c.plant) this.actPlant = true;
      // timeline events (fx hooks)
      if (c.events && act.onEvent) for (const ev of c.events) {
        if (!act.fired.has(ev) && u >= ev.t) { act.fired.add(ev); this.fire(act, ev); }
      }
    };
    if (this.action) {
      const act = this.action;
      // self hit-stop: the attacker's swing sticks at the contact for a moment
      let adt = dt * act.speed;
      if (this.stopT > 0) { this.stopT -= dt; adt *= 0.08; }
      act.time += adt;
      const done = act.time >= act.clip.dur;
      if (done) act.time = act.clip.dur;
      applyAction(act, 1);
      if (done) {
        if (act.clip.events && act.onEvent) for (const ev of act.clip.events) if (!act.fired.has(ev)) { act.fired.add(ev); this.fire(act, ev); }
        if (this.action === act) this.action = null;
        act.onEnd?.();
      }
    }

    // ---- aim twist (game.js sets aimTwist, rad: a shot fired on the run): the legs keep running along the travel
    // and the upper body turns onto the target above the hips, eased in and out so the torso never snaps
    this.aimTw = (this.aimTw || 0) + ((this.aimTwist || 0) - (this.aimTw || 0)) * (1 - Math.exp(-dt * 14));
    if (Math.abs(this.aimTw) > 1e-4) { add('spine', 0, this.aimTw * 0.55, 0); add('chest', 0, this.aimTw * 0.45, 0); }

    // ---- flinch (additive): a sharp jolt with a small overshoot, three weights of reaction
    if (this.flinchT < (this.flinchKind === 2 ? 0.95 : 0.6)) {
      this.flinchT += dt;
      const t = this.flinchT, fd = this.flinchDir, P = this.flinchPow, kd = this.flinchKind;
      // the lean goes the way the blow pushed: pz pitches (+ forward), px tilts sideways (+ toward local -x)
      const [ax, az] = this.flinchAway || [-0.35 * fd, -0.94];
      const pz = az, px = -ax;
      // snaps to full in 70ms (a stagger in 100ms), swings back past rest (overshoot) and settles by ~0.4s (~0.6s)
      const T0 = kd === 2 ? 0.1 : 0.07, decay = kd === 2 ? 4.5 : 7, per = kd === 2 ? 0.3 : 0.2;
      const f = (t < T0 ? Math.sin((t / T0) * Math.PI / 2) : Math.exp(-decay * (t - T0)) * Math.cos(((t - T0) / per) * Math.PI)) * P;
      const F = D * f;
      if (kd === 0) { // graze: the chest snaps away from the blow, head follows
        add('spine', 9 * F * pz, 0, 9 * F * px); add('chest', 7 * F * pz); add('head', 12 * F * pz, 0, -4 * F * px);
        add('armL', -8 * F * pz, 0, 8 * F); add('armR', -8 * F * pz, 0, -8 * F);
      } else if (kd === 1) { // solid hit: bent and twisted away, the arm on the struck side flies up
        add('hips', 0, 0, 6 * F * px); add('spine', 8 * F * pz, 14 * F * fd, 12 * F * px); add('chest', 6 * F * pz, 8 * F * fd, 0);
        add('head', 10 * F * pz, 10 * F * fd, -8 * F * px); add(fd > 0 ? 'armL' : 'armR', 14 * F, 0, 18 * F * fd);
        add(fd > 0 ? 'armR' : 'armL', -10 * F * pz, 0, -8 * F * fd);
      } else { // stagger: knees give, the body is shoved and takes a step to catch itself
        add('spine', 16 * F * pz, 6 * F * fd, 12 * F * px); add('chest', 10 * F * pz); add('head', 18 * F * pz, 0, -6 * F * px);
        add('armL', -16 * F * pz + 6 * F, 0, 16 * F); add('armR', -16 * F * pz + 6 * F, 0, -16 * F);
        add('thighL', -6 * F); add('shinL', 12 * F); add('thighR', -6 * F); add('shinR', 12 * F);
        this.rootOffset.y -= 0.05 * Math.max(0, f);
        // the step: hips slide ~0.2 m with the push (in by 0.16 s, held, eased back by ~0.9 s) while the trailing
        // leg lifts and swings the same way to land under the body
        const s = t < 0.16 ? ease.out(t / 0.16) : t < 0.38 ? 1 : 1 - ease.inOut(clamp((t - 0.38) / 0.52, 0, 1));
        const lift = Math.sin(clamp(t / 0.3, 0, 1) * Math.PI) * P;
        const leg = px < -0.3 ? 'L' : 'R'; // the leg on the side the body is pushed toward
        add('thigh' + leg, (-26 * pz - 14) * D * lift, 0, (leg === 'L' ? 1 : -1) * 24 * Math.abs(px) * D * lift);
        add('shin' + leg, 46 * D * lift);
        this.rootOffset.x += ax * 0.28 * s * P; this.rootOffset.z += az * 0.28 * s * P;
      }
      const push = (0.03 + 0.03 * Math.min(kd, 1)) * Math.max(0, f);
      this.rootOffset.x += ax * push; this.rootOffset.z += az * push;
      this.flinch = Math.max(0, f);
    }

    // ---- death: two beats (knees give, then the body hits the ground with a small bounce), three ways to fall
    if (this.dead) this.applyDeath(dt, pose, add);

    // ---- write bones
    for (const name in b) {
      const bone = b[name];
      const v = pose[name];
      if (CHAIN_BONES.has(name)) continue;
      if (v) bone.rotation.set(v[0], v[1], v[2]); else bone.rotation.set(0, 0, 0);
    }
    if (!this.drop) {
      if (this.rest.wR) b.weaponR.position.copy(this.rest.wR);
      if (this.rest.wL) b.weaponL.position.copy(this.rest.wL);
    }
    b.hips.position.set(this.rootOffset.x, this.rest.hipsY + this.rootOffset.y, this.rootOffset.z);
    b.root.rotation.y = this.turnOffset;
    // one full refresh of the rig's matrices (the prototype call: an EntityView's character skips the scene walk's
    // second pass over the rig when this animator has just refreshed it, see entities.js)
    THREE.Object3D.prototype.updateMatrixWorld.call(this.char, true);
    // detail LOD (set by the owner from distance): 0 full, 1 no foot IK and no cloth chains, 2 also no weapon clamp
    const lod = this.lod || 0;
    if (!this.dead) { if (lod < 1) this.solveLegs(dt); else this.plantLift = 0; }
    if (!this.dead) { if (lod < 2) this.clampWeapon(); }
    else this.updateDrop();
    if (lod < 1) {
      // back from a cheaper tier: the cloth restarts from the current pose instead of snapping across from a stale one
      if (this.chainsCold) { for (const ch of this.chains) ch.pts = null; this.chainsCold = false; }
      this.updateChains(dt);
    } else this.chainsCold = true;
    if (hero) hero.post(this, dt); // mixer locomotion + this pose retargeted onto the new body, outfit moved onto it
  }

  fire(act, ev) {
    if (ev.selfStop) this.stopT = Math.max(this.stopT, ev.selfStop);
    act.onEvent(ev);
  }

  // travel direction relative to facing, measured from how the character actually moved
  trackMotion(dt) {
    const host = this.char;
    host.updateWorldMatrix(true, false);
    const p = wPos(host, tmpV);
    if (this.prevPos && dt > 1e-3) {
      const vx = (p.x - this.prevPos.x) / dt, vz = (p.z - this.prevPos.z) / dt;
      const k = 1 - Math.exp(-dt * 12);
      this.vel.x += (vx - this.vel.x) * k; this.vel.z += (vz - this.vel.z) * k;
    }
    if (!this.prevPos) this.prevPos = new THREE.Vector3();
    if (dt > 1e-3) this.prevPos.copy(p);
    const vs = Math.hypot(this.vel.x, this.vel.z);
    let want = 0;
    if (vs > 0.3 && vs > this.speed * 0.35) {
      const q = wQuat(host, tmpQ);
      const fwd = tmpV2.set(0, 0, 1).applyQuaternion(q);
      const yaw = Math.atan2(fwd.x, fwd.z);
      want = Math.atan2(this.vel.x, this.vel.z) - yaw;
      want = Math.atan2(Math.sin(want), Math.cos(want));
      // the full strafe / backpedal only while a clip plays (an attack holds the body on its target); otherwise the gap
      // between facing and travel is a slide along a wall or a crowd, or a turn catching up, and twisting the hips and
      // crossing the legs for all of it (60 deg sliding round the village fountain) read as the runner stumbling
      if (!this.action) want = clamp(want, -0.3, 0.3);
    }
    let d = want - this.moveDir; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.moveDir += d * Math.min(1, dt * 10);
  }

  // ---------------------------------------------------------------- feet
  // Plants the feet: locomotion feet follow their ground paths; standing and skill poses keep the lowest foot on the
  // ground (lunges sink into the stance instead of floating, crouches stop sinking through the floor), near-ground feet
  // are pinned and the trailing foot holds its ground while the hips drive forward.
  solveLegs(dt) {
    const b = this.bones;
    const act = this.action;
    // clips from outside the skill set (sit, ride, eat...) own their legs
    const foreign = act && act.clip.mask === 'full' && !act.clip.plant;
    let ikW = (1 - this.air) * (foreign ? 1 - this.actLegW : 1);
    if (ikW <= 0.001) return;
    const root = b.root;
    const locoW = this.loco.on ? this.moveK * (1 - this.actLegW) : 0;
    const ankle = this.rest.ankle;
    // airborne skill poses (leaps) are left as authored
    const groundK = 1 - sstep(0.15, 0.45, this.actAirborne);
    // root space positions of the ankles, knees and hips (the rig's matrices are fresh: see update)
    _sInv.copy(root.matrixWorld).invert();
    const A = _LA, K = _LK, Hj = _LH;
    wPos(b.footL, A.L).applyMatrix4(_sInv); wPos(b.footR, A.R).applyMatrix4(_sInv);
    wPos(b.shinL, K.L).applyMatrix4(_sInv); wPos(b.shinR, K.R).applyMatrix4(_sInv);
    wPos(b.thighL, Hj.L).applyMatrix4(_sInv); wPos(b.thighR, Hj.R).applyMatrix4(_sInv);
    // vertical: the lowest authored foot lands on the ground
    const plantW = (1 - locoW) * groundK;
    let lift = 0;
    if (plantW > 0.001) {
      lift = (ankle - Math.min(A.L.y, A.R.y)) * plantW;
      lift += this.breathY * (1 - this.moveK);
      if (Math.abs(lift) > 1e-5) {
        b.hips.position.y += lift;
        b.hips.updateMatrixWorld(true);
        for (const s of ['L', 'R']) { A[s].y += lift; K[s].y += lift; Hj[s].y += lift; }
      }
    }
    this.plantLift = lift;
    const back = A.L.z < A.R.z ? 'L' : 'R';
    const rootQ = wQuat(root, _sRootQ);
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1;
      const thigh = b['thigh' + s], shin = b['shin' + s], foot = b['foot' + s];
      // standing / skill target
      const a = A[s];
      const T = _sT.copy(a);
      const above = a.y - ankle;
      const pin = plantW > 0 ? 1 - sstep(0.12, 0.26, above) : 0;
      if (pin > 0) {
        T.y = lerp(a.y, ankle, pin);
        if (s === back && Math.abs(this.actRootZ) > 1e-4) T.z -= this.actRootZ * pin * groundK;
      }
      // knee direction: as authored when the leg is bent, otherwise forward and a touch out
      const mid = _sMid.copy(Hj[s]).lerp(a, 0.5);
      const kneeOff = _sPole.copy(K[s]).sub(mid);
      const poleL = kneeOff.length() > 0.03 ? kneeOff.normalize() : kneeOff.set(0.12 * sx, 0, 1).normalize();
      // locomotion target
      let footQ = null;
      if (locoW > 0.001) {
        const F = this.loco[s];
        const md = this.moveDir;
        const lat = (0.11 * this.gait.width - lerp(0.0, 0.03, this.runK)) * sx;
        const LT = _sLT.set(lat + Math.sin(md) * F.f, ankle + F.y, Math.cos(md) * F.f);
        T.lerp(LT, locoW);
        poleL.lerp(_sP2.set(0.15 * sx, 0, 1).normalize(), locoW).normalize();
        // foot: pitched through the step, pointing roughly along the travel
        const yaw = clamp(md, -0.6, 0.6) * (1 - sstep(1.45, 2.05, Math.abs(md))) * 0.5 + 0.08 * sx; // (eased to 0 for a backpedal, see hipTurn)
        const qL = _sQL.setFromEuler(_sEul.set(F.pitch * D, yaw, 0, 'YXZ'));
        footQ = _sFootQ.copy(rootQ).multiply(qL);
        const cur = wQuat(foot, _sCur);
        footQ = cur.slerp(footQ, locoW);
      } else if (pin > 0) {
        // planted: flatten the sole, keep the authored heading (the trailing foot keeps some heel lift)
        const cur = wQuat(foot, _sCur);
        const f = _sF.set(0, 0, 1).applyQuaternion(cur);
        const yaw = Math.atan2(f.x, f.z);
        const flat = _sQL.setFromAxisAngle(AY, yaw);
        footQ = cur.slerp(flat, pin * (s === back && this.actRootZ > 0.05 ? 0.45 : 0.85));
      }
      const TW = T.applyMatrix4(root.matrixWorld);
      const poleW = poleL.applyQuaternion(rootQ);
      solveLeg(thigh, shin, foot, TW, poleW, footQ, ikW);
    }
  }

  // keep the weapon out of the ground: pitch the hand up when the tip would dip under
  clampWeapon() {
    const b = this.bones;
    const wb = b.weaponR;
    if (!wb || !wb.children.length) return;
    // the measured blade length, kept until the hand holds something else (compared child by child: no string key)
    const kids = wb.children, W = this.wlen;
    if (!W || W.kids.length !== kids.length || kids.some((c, i) => c !== W.kids[i])) {
      let zmax = 0;
      const inv = new THREE.Matrix4().copy(wb.matrixWorld).invert();
      const box = new THREE.Box3();
      for (const c of wb.children) c.traverse((m) => {
        if (!m.isMesh || !m.geometry) return;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        box.copy(m.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld));
        zmax = Math.max(zmax, box.max.z);
      });
      this.wlen = { kids: kids.slice(), len: zmax };
    }
    const L = this.wlen.len;
    if (L < 0.25) return;
    const ground = wPos(b.root, tmpV).y + 0.05;
    const H = wPos(wb, _a);
    const tip = _b.set(0, 0, L).applyMatrix4(wb.matrixWorld);
    if (tip.y >= ground) return;
    const dir = _c.subVectors(tip, H).normalize();
    const want = clamp((ground - H.y) / L, -1, 0.95);
    const el = Math.asin(want);
    const da = el - Math.asin(clamp(dir.y, -1, 1));
    if (da <= 0) return;
    // raised to the lowest elevation that clears the ground, keeping its heading. A blade pointing nearly straight
    // down has no stable heading (it would spin round in a frame as the swing passes under the hand), so there the
    // heading leans toward "out from the body", more the steeper the blade and the bigger the correction.
    const hx = dir.x, hz = dir.z, hl = Math.hypot(hx, hz);
    const rp = wPos(b.root, _d);
    let ox = H.x - rp.x, oz = H.z - rp.z; const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
    const w = clamp((0.6 - hl) / 0.6, 0, 1) * clamp(da / 0.35, 0, 1);
    let ax = (hl > 1e-6 ? hx / hl : ox) * (1 - w) + ox * w, az = (hl > 1e-6 ? hz / hl : oz) * (1 - w) + oz * w;
    const al = Math.hypot(ax, az); if (al < 1e-4) return; ax /= al; az /= al;
    const ce = Math.cos(el);
    const nd = _e.set(ax * ce, want, az * ce).normalize();
    const rot = _q1.setFromUnitVectors(dir, nd);
    const hand = b.handR;
    const hw = wQuat(hand, _q2);
    const nw = _q3.copy(rot).multiply(hw);
    const pq = wQuat(hand.parent, tmpQ);
    hand.quaternion.copy(pq.invert().multiply(nw));
    hand.updateMatrixWorld(true);
  }

  // ---------------------------------------------------------------- death
  applyDeath(dt, pose, add) {
    this.deadT += dt;
    const t = this.deadT;
    const k1 = ease.inOut(clamp(t / 0.25, 0, 1)); // knees buckle
    const k2 = clamp((t - 0.2) / 0.4, 0, 1); // the body falls (gravity: accelerating)
    const fall = k2 * k2;
    const bounce = t > 0.6 ? Math.exp(-(t - 0.6) * 9) * Math.sin((t - 0.6) * 22) * 4 * D : 0;
    const set = (bn, x, y, z, e) => { const p = pose[bn] || (pose[bn] = [0, 0, 0]); p[0] += (x * D - p[0]) * e; p[1] += (y * D - p[1]) * e; p[2] += (z * D - p[2]) * e; };
    const sd = this.deathSide || 1;
    let ry = 0, rz = 0, turn = 0;
    if (this.deathKind === 0) {
      // backward: sags at the knees, then topples onto the back
      set('thighL', -50, 0, 10, k1); set('shinL', 70, 0, 0, k1); set('thighR', -30, 0, -8, k1); set('shinR', 50, 0, 0, k1);
      set('spine', 14, 0, 4, k1);
      set('hips', -84, 8 * sd, 6 * sd, fall); set('spine', 6, 0, 6, fall); set('chest', 4, 8 * sd, 0, fall); set('head', 18, 30 * sd, 10, fall);
      // limp on the back: legs nearly flat with soft knees, arms flung loosely out to the sides on the ground
      set('thighL', -14, 0, 16, fall); set('shinL', 24, 0, 0, fall); set('thighR', -4, 0, -12, fall); set('shinR', 12, 0, 0, fall);
      set('armL', -24, 0, 66, fall); set('foreL', -26, 0, 0, fall); set('armR', -30, 0, -78, fall); set('foreR', -34, 0, 0, fall);
      add('hips', bounce);
      ry = lerp(-0.2, -0.86, fall); rz = -0.36 * fall;
    } else if (this.deathKind === 1) {
      // forward: drops to the knees, then pitches face-down
      set('thighL', -8, 0, 8, k1); set('shinL', 88, 0, 0, k1); set('thighR', -4, 0, -8, k1); set('shinR', 90, 0, 0, k1);
      set('footL', 10, 0, 0, k1); set('footR', 10, 0, 0, k1); set('spine', 18, 0, 0, k1); set('head', 14, 0, 0, k1);
      set('armL', -10, 0, 20, k1); set('armR', -10, 0, -20, k1);
      set('hips', 80, -6 * sd, 0, fall); set('spine', 6, 0, 0, fall); set('chest', 4, 0, 0, fall); set('head', -10, 50 * sd, 0, fall);
      set('thighL', -18, 0, 8, fall); set('shinL', 20, 0, 0, fall); set('thighR', -10, 0, -8, fall); set('shinR', 30, 0, 0, fall);
      set('footL', 50, 0, 0, fall); set('footR', 50, 0, 0, fall);
      set('armL', -150, 0, 40, fall); set('foreL', -40, 0, 0, fall); set('armR', -40, 0, -50, fall); set('foreR', -20, 0, 0, fall);
      add('hips', -bounce);
      ry = lerp(-0.46, -0.84, fall); rz = lerp(0, 0.28, fall);
    } else {
      // spun round to the side by the blow, collapses onto the hip and shoulder
      set('thighL', -40, 0, 6, k1); set('shinL', 60, 0, 0, k1); set('thighR', -20, 0, -6, k1); set('shinR', 40, 0, 0, k1);
      set('spine', 10, 20 * sd, 10 * sd, k1);
      set('hips', -6, 0, 84 * sd, fall); set('spine', 10, 10 * sd, 4 * sd, fall); set('head', 10, 10 * sd, -20 * sd, fall);
      set('thighL', -50, 0, 6, fall); set('shinL', 70, 0, 0, fall); set('thighR', -36, 0, -6, fall); set('shinR', 80, 0, 0, fall);
      set('armL', -60, 0, 30 * sd, fall); set('foreL', -60, 0, 0, fall); set('armR', -70, 0, -30, fall); set('foreR', -40, 0, 0, fall);
      add('hips', 0, 0, bounce * sd);
      ry = lerp(-0.15, -0.84, fall); turn = (60 * sd) * D * ease.out(clamp(t / 0.6, 0, 1));
    }
    this.rootOffset.set(lerp(this.rootOffset.x, 0, k1), lerp(this.rootOffset.y, ry, Math.max(k1, fall)), lerp(this.rootOffset.z, rz, fall));
    this.turnOffset = turn;
  }

  // the weapon slips from the hand as the body falls and settles on the ground beside it
  updateDrop() {
    const b = this.bones;
    for (const side of ['R']) {
      const wb = b['weapon' + side];
      if (!wb || !wb.children.length) continue;
      if (!this.drop) this.drop = {};
      let d = this.drop[side];
      if (this.deadT < 0.3) { if (this.rest['w' + side]) wb.position.copy(this.rest['w' + side]); continue; }
      if (!d) {
        const p = wb.getWorldPosition(new THREE.Vector3()), q = wb.getWorldQuaternion(new THREE.Quaternion());
        const g = b.root.getWorldPosition(new THREE.Vector3()).y;
        const rootQ = b.root.getWorldQuaternion(new THREE.Quaternion());
        const outV = new THREE.Vector3(side === 'R' ? -0.6 : 0.6, 0, 0.3).applyQuaternion(rootQ);
        const endP = p.clone().add(outV); endP.y = g + 0.05;
        // lies flat: the blade (local +Z) level on the ground, angled away from the body
        const yaw = Math.atan2(outV.x, outV.z) + (side === 'R' ? 0.9 : -0.9);
        const endQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.03, yaw, 0.12, 'YXZ'));
        d = this.drop[side] = { p, q, endP, endQ, t: 0 };
      }
      // settled: the body lies still (the fall and its bounce are over by ~1.4 s), so the weapon stays where it was put
      if (d.settled && this.char.position.y === d.sy) continue; // (a sinking corpse leaves its weapon on the ground: recomputed)
      d.t = Math.min(1, (this.deadT - 0.3) / 0.45);
      const k = d.t * d.t;
      const hop = d.t > 0.8 ? Math.sin((d.t - 0.8) / 0.2 * Math.PI) * 0.04 : 0;
      const wp = _sT.copy(d.p).lerp(d.endP, k); wp.y += hop;
      const wq = _sCur.copy(d.q).slerp(d.endQ, ease.out(d.t));
      // world -> local under the (animated) hand
      const parent = wb.parent;
      parent.updateMatrixWorld(true);
      const inv = _sInv.copy(parent.matrixWorld).invert();
      wb.position.copy(wp.applyMatrix4(inv));
      const pq = wQuat(parent, _sQL).invert();
      wb.quaternion.copy(pq.multiply(wq));
      wb.updateMatrixWorld(true);
      if (d.t >= 1 && this.deadT > 1.6) { d.settled = true; d.sy = this.char.position.y; }
    }
  }

  // ---------------------------------------------------------------- cloth chains
  initChains() {
    this.chains = [];
    const b = this.bones;
    const meshes = this.char.userData.meshes;
    // only simulate chains that have skinned geometry on them
    const used = new Set();
    for (const m of Object.values(meshes)) {
      const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
      const bonesArr = m.skeleton.bones;
      for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > 0.01) used.add(bonesArr[si.getComponent(i, k)].name);
    }
    for (const [name, list] of Object.entries(CHAINS)) {
      if (!list.some((n) => used.has(n))) continue;
      const bones = list.map((n) => b[n]);
      const dirs = [], lens = [];
      for (let i = 0; i < bones.length; i++) {
        const next = bones[i + 1];
        const off = next ? next.position.clone() : bones[i].position.clone().normalize().multiplyScalar(i > 0 ? lens[i - 1] : 0.25);
        if (!next && i > 0) off.copy(dirs[i - 1]).multiplyScalar(lens[i - 1]);
        lens.push(off.length());
        dirs.push(off.clone().normalize());
      }
      const scarf = name === 'scarf';
      // the scarf hangs and swings (shorter simulated links, real gravity, damped); skirts and tabards follow the legs
      this.chains.push({
        name, bones, dirs, lens, simLens: lens.map((l) => l * (scarf ? 0.8 : 1)), pts: null, prev: null,
        stiff: scarf ? 0.045 : name.startsWith('skirt') ? 0.35 : name.startsWith('tab') ? 0.22 : 0.1,
        damp: scarf ? 0.86 : 0.9, grav: scarf ? 2.2 : 0.6,
        // the scarf's goal droops toward world-down link by link, so it hangs off the neck instead of sticking out
        hang: scarf ? [0.42, 0.62, 0.74, 0.82] : null,
      });
    }
    this.colliders = [
      { bone: 'chest', off: new THREE.Vector3(0, 0.05, -0.02), r: 0.21 },
      { bone: 'spine', off: new THREE.Vector3(0, 0, 0), r: 0.2 },
      { bone: 'hips', off: new THREE.Vector3(0, -0.05, 0), r: 0.2 },
      { bone: 'thighL', off: new THREE.Vector3(0, -0.2, 0), r: 0.11 },
      { bone: 'thighR', off: new THREE.Vector3(0, -0.2, 0), r: 0.11 },
      // knees: keep robes and tabards in front of a raised knee
      { bone: 'shinL', off: new THREE.Vector3(0, 0, 0.02), r: 0.13 },
      { bone: 'shinR', off: new THREE.Vector3(0, 0, 0.02), r: 0.13 },
      { bone: 'shinL', off: new THREE.Vector3(0, -0.15, 0), r: 0.095 },
      { bone: 'shinR', off: new THREE.Vector3(0, -0.15, 0), r: 0.095 },
    ];
  }

  updateChains(dt) {
    if (!this.chains.length) return;
    dt = Math.min(dt, 1 / 30);
    const b = this.bones;
    // collider centres in world space (preallocated; the rig's matrices are fresh here)
    const cols = this.cols || (this.cols = this.colliders.map((c) => ({ p: new THREE.Vector3(), r: c.r })));
    for (let i = 0; i < cols.length; i++) { const c = this.colliders[i]; cols[i].p.copy(c.off).applyMatrix4(b[c.bone].matrixWorld); }
    const wind = tmpV2.set(G.windDir.value.x, 0, G.windDir.value.y).multiplyScalar(0.8 * G.windStrength.value * (0.6 + 0.4 * Math.sin(this.t * 1.7)));
    // the leading knee lifts the front of a robe or tabard (thigh pitch in the hips frame; negative = forward)
    const thL = b.thighL.rotation.x, thR = b.thighR.rotation.x;
    const busy = !!this.action;
    for (const ch of this.chains) {
      const n = ch.bones.length;
      let bias = 0;
      if (ch.name === 'tabF') bias = Math.min(0, Math.min(thL, thR)) * 0.85;
      else if (ch.name === 'tabB') bias = Math.max(0, Math.max(thL, thR)) * 0.5;
      else if (ch.name === 'skirtL') bias = Math.min(0, thL) * 0.6;
      else if (ch.name === 'skirtR') bias = Math.min(0, thR) * 0.6;
      // joint positions from the animated pose (rest direction) as the "goal"
      const goal = ch.goal || (ch.goal = Array.from({ length: n + 1 }, () => new THREE.Vector3()));
      const root = wPos(ch.bones[0], goal[0]);
      const q = wQuat(ch.bones[0].parent, _cQ);
      if (bias) q.multiply(tmpQ.setFromAxisAngle(AX, bias));
      for (let i = 0; i < n; i++) {
        const d = _cD.copy(ch.dirs[i]).applyQuaternion(q);
        if (ch.hang) d.lerp(DOWN, ch.hang[i]).normalize();
        goal[i + 1].copy(goal[i]).addScaledVector(d, ch.lens[i]);
      }
      if (!ch.pts) { ch.pts = goal.map((p) => p.clone()); ch.prev = goal.map((p) => p.clone()); }
      ch.pts[0].copy(root); ch.prev[0].copy(root);
      const stiff = ch.name.startsWith('skirt') || ch.name.startsWith('tab') ? (busy ? Math.max(0.2, ch.stiff - 0.1) : ch.stiff) + (bias ? 0.15 : 0) : ch.stiff;
      // integrate
      for (let i = 1; i <= n; i++) {
        const p = ch.pts[i], pv = ch.prev[i];
        const vel = tmpV.subVectors(p, pv).multiplyScalar(ch.damp);
        pv.copy(p);
        p.add(vel);
        p.y -= 9.8 * dt * dt * ch.grav;
        p.addScaledVector(wind, dt * dt * 6 * (i / n));
        // pull toward the animated goal (keeps it from flopping like rope)
        p.lerp(goal[i], stiff);
      }
      // constraints + collisions
      for (let it = 0; it < 3; it++) {
        for (let i = 1; i <= n; i++) {
          const a = ch.pts[i - 1], p = ch.pts[i];
          const d = tmpV.subVectors(p, a);
          const L = d.length() || 1e-5;
          p.copy(a).addScaledVector(d, ch.simLens[i - 1] / L);
          for (const c of cols) {
            const dd = tmpV.subVectors(p, c.p);
            const l = dd.length();
            const rr = c.r + 0.03;
            if (l < rr && l > 1e-5) p.copy(c.p).addScaledVector(dd, rr / l);
          }
        }
      }
      // aim bones at the simulated points
      for (let i = 0; i < n; i++) {
        const bone = ch.bones[i];
        const pq = wQuat(bone.parent, tmpQ);
        const target = tmpV.subVectors(ch.pts[i + 1], ch.pts[i]).normalize().applyQuaternion(tmpQ2.copy(pq).invert());
        bone.quaternion.setFromUnitVectors(ch.dirs[i], target);
        bone.updateMatrixWorld(true);
      }
    }
  }

  consumeTravel() { const t = this.travel; this.travel = 0; return t; }
  get busy() { return !!this.action; }

  // world positions useful for fx (weapon tip etc.)
  weaponPoint(side = 'R', along = 0.9) {
    const bone = this.bones['weapon' + side];
    return bone.localToWorld(new THREE.Vector3(0, 0, along));
  }
}

const CHAIN_BONES = new Set(Object.values(CHAINS).flat());
