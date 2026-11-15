// House parts: the low-level kit every archetype is built from. Everything here works in HOUSE-LOCAL space (the house
// centre at x = z = 0, the front facing +z, y = 0 at the floor, spec.floorY) and takes the shared Spec from
// /shared/houses.js as the single source of truth: the walls are cut exactly where the spec's door and windows are,
// so the openings you see are the gaps the server lets you walk through.
//
// Rules kept here (design spec §6 and §7):
//  * No visible faces share a plane. Every layer on a wall face has its own depth (u, out from the wall's middle line):
//      plaster / plank face +0.150 · stone lower course +0.190 · plinth skirt +0.250 · frame rails +0.180, braces +0.187,
//      posts +0.195 · opening frames +0.180 (room side -0.175) · lintels +0.210 · interior lining -0.170.
//    Panes sit centred in the wall (u ±0.012) inside their frame boards; glazing bars stand in front (+0.03..+0.055) and
//    behind (-0.055..-0.03), never in the pane's plane.
//  * Openings are square-headed; there is no arcShape anywhere in the houses. Glazing bars run one way only (all upright or
//    all level per house), so no window shows a cross. Timber braces: at most one diagonal per panel, every brace kept off
//    its posts and rails, all on a wall leaning the same way or as side-by-side chevrons; each brace is recorded with its
//    end points so tools/house_audit.js can prove no two cross. Shutters and doors carry Z-ledges, never an X.
//  * Wall boxes are axis-aligned in house space and built from translated geometry, so the box-projected textures run on
//    without seams from one piece of wall to the next.
import * as THREE from 'three';
import { box, cyl, extrude, rgb } from '../kit.js';
import { WALL_T, DOOR_W, DOOR_H, WALL_H } from '/sunmere-play/shared/houses.js';

export const PI = Math.PI;
export const HT = WALL_T / 2;
export const LOWER_TOP = 0.95; // top of the stone lower course
export const JETTY = 0.5;

// u depths (see the header)
export const U = { face: HT, lower: HT + 0.04, skirt: HT + 0.1, rail: HT + 0.03, brace: HT + 0.037, post: HT + 0.045, frame: HT + 0.03, frameIn: -HT - 0.025, lintel: HT + 0.06, lining: -HT - 0.02 };

// ------------------------------------------------------------------ small helpers
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function mixHex(a, b, t) { const A = rgb(a), B = rgb(b); return [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]; }
export function shade(c, k) { const A = rgb(c); return [A[0] * k, A[1] * k, A[2] * k]; }
export const pick = (r, list) => list[Math.min(list.length - 1, Math.floor(r() * list.length))];
export const between = (r, a, b) => a + (b - a) * r();

// an axis-aligned box from its extents (house space); the geometry is translated before the box UVs are projected
export function bx(b, mat, x0, y0, z0, x1, y1, z1, c = 0xffffff, o = {}) {
  const X0 = Math.min(x0, x1), X1 = Math.max(x0, x1), Y0 = Math.min(y0, y1), Y1 = Math.max(y0, y1), Z0 = Math.min(z0, z1), Z1 = Math.max(z0, z1);
  if (X1 - X0 < 1e-4 || Y1 - Y0 < 1e-4 || Z1 - Z0 < 1e-4) return null;
  const g = box(X1 - X0, Y1 - Y0, Z1 - Z0);
  g.translate((X0 + X1) / 2, (Y0 + Y1) / 2, (Z0 + Z1) / 2);
  return b.add(g, mat, { uv: 'box', c, ...o });
}
// a rotated box (centre p, size [w, h, d], yaw ry)
export function rbx(b, mat, p, size, ry = 0, c = 0xffffff, o = {}) {
  return b.add(box(size[0], size[1], size[2]), mat, { p, r: [o.rx || 0, ry, o.rz || 0], uv: 'box', c, ...o });
}
// a box between two points (its long axis from a to b), width w, height h; roll kept level
const _xa = new THREE.Vector3(1, 0, 0), _dv = new THREE.Vector3(), _qq = new THREE.Quaternion();
export function beamAB(b, mat, a, c, w, h, col = 0xffffff, o = {}) {
  _dv.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const L = _dv.length(); if (L < 1e-3) return;
  _dv.normalize();
  // yaw then pitch, so the box's width stays level
  const yaw = Math.atan2(-_dv.z, _dv.x), pitch = Math.asin(clamp(_dv.y, -1, 1));
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, pitch, 'YZX'));
  b.add(box(L, h, w), mat, { p: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], q, uv: 'box', c: col, ...o });
}

// ------------------------------------------------------------------ wall faces
// t runs along the face (local x on front/back, local z on left/right); u is out from the wall's middle line.
export function faceOf(S, face, jet = 0) {
  const w = S.w, d = S.d;
  if (face === 'front') return { face, n: [0, 1], tan: [1, 0], off: d / 2 - HT + jet, t0: -w / 2, t1: w / 2 };
  if (face === 'back') return { face, n: [0, -1], tan: [1, 0], off: d / 2 - HT, t0: -w / 2, t1: w / 2 };
  if (face === 'left') return { face, n: [-1, 0], tan: [0, 1], off: w / 2 - HT, t0: -d / 2 + WALL_T, t1: d / 2 - WALL_T + jet };
  return { face: 'right', n: [1, 0], tan: [0, 1], off: w / 2 - HT, t0: -d / 2 + WALL_T, t1: d / 2 - WALL_T + jet };
}
export const FACES = ['front', 'back', 'left', 'right'];
export function fp(F, t, y, u) { return [F.n[0] * (F.off + u) + F.tan[0] * t, y, F.n[1] * (F.off + u) + F.tan[1] * t]; }
export function fbox(b, mat, F, t0, t1, y0, y1, u0, u1, c = 0xffffff, o) {
  const A = fp(F, t0, y0, u0), B = fp(F, t1, y1, u1);
  return bx(b, mat, A[0], A[1], A[2], B[0], B[1], B[2], c, o);
}
// yaw of a face's outward normal (three.js rotation.y: facing (sin, cos))
export const faceYaw = (F) => Math.atan2(F.n[0], F.n[1]);
// a diagonal in a face's plane from (ta, ya) to (tb, yb), between depths u0..u1
export function fdiag(b, mat, F, ta, ya, tb, yb, u0, u1, width, c = 0xffffff) {
  const L = Math.hypot(tb - ta, yb - ya), a = Math.atan2(yb - ya, tb - ta);
  const p = fp(F, (ta + tb) / 2, (ya + yb) / 2, (u0 + u1) / 2);
  if (F.tan[0]) b.add(box(L, width, u1 - u0), mat, { p, r: [0, 0, a], uv: 'box', c });
  else b.add(box(u1 - u0, width, L), mat, { p, r: [-a, 0, 0], uv: 'box', c });
}
export function doorFace(S) { return S.door.face === 'front' ? 'front' : 'right'; }
export function doorT(S) { return S.door.face === 'front' ? S.door.lx : S.door.lz; }
export function winT(W) { return W.face === 'front' || W.face === 'back' ? W.lx : W.lz; }
export const hasJetty = (S) => S.ext.some((E) => E.kind === 'jetty');
export const isShopfront = (S, W) => W.face === 'front' && W.w > 1.25 && S.ext.some((E) => E.kind === 'shopfront');
// the openings cut through one face: [{t0, t1, y0, y1, kind, W}]
export function openingsOn(S, face) {
  const out = [];
  if (doorFace(S) === face) { const t = doorT(S); out.push({ t0: t - DOOR_W / 2, t1: t + DOOR_W / 2, y0: -0.05, y1: DOOR_H, kind: 'door' }); }
  for (const W of S.windows) if (W.face === face) {
    const t = winT(W);
    out.push({ t0: t - W.w / 2, t1: t + W.w / 2, y0: W.y - W.h / 2, y1: W.y + W.h / 2, kind: isShopfront(S, W) ? 'shop' : 'win', W });
  }
  return out;
}

// ------------------------------------------------------------------ materials and tints
// the textures carry their own colour; a tint is divided by the texture's average so the house shows the palette colour
const TEX_BASE = { slate: '#3e5c9a', shingleWood: '#7a5230', slateRed: '#9a3a2a', straw: '#e8cc80', thatch: '#c9a65a', iron: '#6a6a70', mossRoof: null };
export function texTint(mat, tint, k = 1) {
  const base = TEX_BASE[mat];
  if (!base) return shade(tint, k);
  if (mat === 'iron') k *= 2.6;
  const T = rgb(tint), B = rgb(base);
  return [clamp(T[0] / B[0], 0.25, 3.2) * k, clamp(T[1] / B[1], 0.25, 3.2) * k, clamp(T[2] / B[2], 0.25, 3.2) * k];
}
export const ROOF_MAT = { slate: 'slate', thatch: 'thatch', shingle: 'shingleWood', mossTile: 'mossRoof', terracotta: 'slateRed', iron: 'slate' }; // iron sheet: the slate texture in a pale steel grey (the metal material read black from the game camera)
export const ROOF_TH = { slate: 0.13, thatch: 0.42, shingle: 0.15, mossTile: 0.2, terracotta: 0.15, iron: 0.07 };
export const UPPER_MAT = { plaster: 'plaster', plank: 'wood', ashlar: 'stoneLarge', rubble: 'stoneDark' };

// ------------------------------------------------------------------ the wall shell: columns between the openings
// One storey band of one face, from ya to yb, cut by `opens`. Pieces below LOWER_TOP use the lower material (and stand
// 4 cm proud as the stone course); the rest the upper one. Columns with the same solid runs are merged.
export function wallBand(ctx, F, ta, tb, ya, yb, opens, { lowerMat = null, lowerTint, upperMat, upperTint, inner = -HT, uOut = HT } = {}) {
  const b = ctx.shell;
  const ts = [ta, tb];
  for (const o of opens) { if (o.t1 <= ta || o.t0 >= tb) continue; ts.push(clamp(o.t0, ta, tb), clamp(o.t1, ta, tb)); }
  ts.sort((p, q) => p - q);
  const cols = [];
  for (let i = 0; i < ts.length - 1; i++) {
    const c0 = ts[i], c1 = ts[i + 1]; if (c1 - c0 < 1e-3) continue;
    const mid = (c0 + c1) / 2;
    const holes = opens.filter((o) => o.t0 < mid && o.t1 > mid).map((o) => [Math.max(ya, o.y0), Math.min(yb, o.y1)]).filter(([p, q]) => q > p).sort((p, q) => p[0] - q[0]);
    const solid = []; let y = ya;
    for (const [h0, h1] of holes) { if (h0 > y + 1e-4) solid.push([y, h0]); y = Math.max(y, h1); }
    if (yb > y + 1e-4) solid.push([y, yb]);
    const key = solid.map(([p, q]) => p.toFixed(3) + ':' + q.toFixed(3)).join('|');
    const last = cols[cols.length - 1];
    if (last && last.key === key && Math.abs(last.c1 - c0) < 1e-6) last.c1 = c1; else cols.push({ c0, c1, solid, key });
  }
  for (const C of cols) for (const [s0, s1] of C.solid) {
    if (lowerMat && s0 < LOWER_TOP) {
      fbox(b, lowerMat, F, C.c0, C.c1, s0, Math.min(s1, LOWER_TOP), inner, U.lower, lowerTint);
      if (s1 > LOWER_TOP) fbox(b, upperMat, F, C.c0, C.c1, LOWER_TOP, s1, inner, uOut, upperTint);
    } else fbox(b, upperMat, F, C.c0, C.c1, s0, s1, inner, uOut, upperTint);
  }
  return cols;
}

// ------------------------------------------------------------------ openings: window frames, panes, bars, sills, lintels
// o: {t0, t1, y0, y1}; style: { bars: 'v' | 'h', frameC, sill: mat | null, lintel: mat | null, lintelC, sillC }
export function windowShell(ctx, F, o, st) {
  const b = ctx.shell, { t0, t1, y0, y1 } = o, w = t1 - t0, h = y1 - y0;
  const fc = st.frameC, fm = st.frameMat || 'woodDark';
  // frame boards lining the reveal (head and sill full width, jambs between them, so no two boards share a face)
  fbox(b, fm, F, t0, t1, y1 - 0.06, y1, U.frameIn, U.frame, fc);
  fbox(b, fm, F, t0, t1, y0, y0 + 0.05, U.frameIn, U.frame, fc);
  for (const [a, c] of [[t0, t0 + 0.06], [t1 - 0.06, t1]]) fbox(b, fm, F, a, c, y0 + 0.05, y1 - 0.06, U.frameIn, U.frame, fc);
  // (v112 leftovers) pale stone jambs either side, between the sill and the lintel, where the style asks for a surround
  if (st.jambs) for (const [a, c] of [[t0 - 0.13, t0], [t1, t1 + 0.13]]) fbox(b, 'stoneLarge', F, a, c, y0 - 0.085, y1, 0.04, U.lintel - 0.01, st.jambs);
  // the pane, centred in the wall, its edges tucked 1 cm into the boards
  fbox(b, 'glassWarm', F, t0 + 0.05, t1 - 0.05, y0 + 0.04, y1 - 0.05, -0.012, 0.012);
  // glazing bars, one direction only, in front of and behind the pane
  if (w > 0.5) {
    if (st.bars === 'h' && h > 0.7) {
      const n = h > 1.05 ? 2 : 1;
      for (let i = 1; i <= n; i++) { const y = y0 + 0.05 + ((h - 0.11) * i) / (n + 1); for (const [u0, u1] of [[0.03, 0.055], [-0.055, -0.03]]) fbox(b, 'woodDark', F, t0 + 0.06, t1 - 0.06, y - 0.016, y + 0.016, u0, u1, fc); }
    } else {
      const n = w >= 1.6 ? 3 : w >= 0.7 ? 1 : 0;
      for (let i = 1; i <= n; i++) { const t = t0 + (w * i) / (n + 1); for (const [u0, u1] of [[0.03, 0.055], [-0.055, -0.03]]) fbox(b, 'woodDark', F, t - 0.016, t + 0.016, y0 + 0.05, y1 - 0.06, u0, u1, fc); }
    }
  }
  if (st.sill) fbox(b, st.sill, F, t0 - 0.09, t1 + 0.09, y0 - 0.085, y0, 0.08, 0.29, st.sillC);
  if (st.lintel) fbox(b, st.lintel, F, t0 - 0.13, t1 + 0.13, y1, y1 + 0.16, 0.06, U.lintel, st.lintelC);
}

// shutters (detail): two leaves standing open flat on the wall, each with a Z-ledge (two battens and one diagonal)
export function shutters(ctx, F, o, color) {
  const b = ctx.detail, { t0, t1, y0, y1 } = o, sw = (t1 - t0) / 2 + 0.03;
  for (const side of [-1, 1]) {
    const a = side < 0 ? t0 - 0.07 - sw : t1 + 0.07, c = a + sw;
    fbox(b, 'wood', F, a, c, y0 - 0.02, y1 + 0.02, U.frame, U.frame + 0.035, color);
    for (const y of [y0 + 0.14, y1 - 0.14]) fbox(b, 'wood', F, a + 0.03, c - 0.03, y - 0.04, y + 0.04, U.frame + 0.035, U.frame + 0.058, shade(color, 0.82));
    // the diagonal runs between the battens; the two leaves mirror each other (\ window /), so they never meet
    const lo = side < 0 ? a + 0.07 : c - 0.07, hi = side < 0 ? c - 0.07 : a + 0.07;
    fdiag(b, 'wood', F, lo, y0 + 0.2, hi, y1 - 0.2, U.frame + 0.035, U.frame + 0.052, 0.07, shade(color, 0.82));
    ctx.shutterBraces.push({ face: F.face, a: [lo, y0 + 0.2], b: [hi, y1 - 0.2] });
  }
}

// a flower box under a window (detail)
export function flowerBox(ctx, F, o, color) {
  const b = ctx.detail, { t0, t1, y0 } = o;
  fbox(b, 'wood', F, t0 - 0.04, t1 + 0.04, y0 - 0.34, y0 - 0.12, 0.2, 0.42, color);
  fbox(b, 'dirtPlain', F, t0, t1, y0 - 0.15, y0 - 0.115, 0.23, 0.39, '#6a5038');
  const n = Math.max(2, Math.round((t1 - t0) / 0.3));
  for (let i = 0; i < n; i++) tuft(b, 'flowers', fp(F, t0 + ((i + 0.5) / n) * (t1 - t0), y0 - 0.13, 0.31), 0.34, 0.3, i * 1.7);
}
// two crossed plant cards (the game's usual tuft; flat from above, never a star: only two cards at right angles)
export function tuft(b, mat, p, w, h, rot = 0, tint = 0xffffff) {
  for (let i = 0; i < 2; i++) {
    const g = new THREE.PlaneGeometry(w, h, 1, 1);
    b.add(g, mat, {
      p: [p[0], p[1] + h / 2 - 0.02, p[2]], r: [0, rot + (i * PI) / 2, 0], uv: 'keep', c: tint,
      normals: (geo) => { const nr = geo.attributes.normal; for (let k = 0; k < nr.count; k++) nr.setXYZ(k, 0, 1, 0); },
      w: (x, y) => { const k = clamp((y - p[1]) / h, 0, 1); return [0, k * 0.04, k * 0.04, 0]; },
    });
  }
}

// ------------------------------------------------------------------ roofs: the lower envelope of planes, clipped to the eaves
// A plane is { c, ax, az }: the underside height y = c + ax*x + az*z. A roof is the lowest of its planes over the eave
// rectangle; each face is the convex part of the rectangle where its plane is the lowest (half-plane clipping), so gable,
// hip, half-hip and lean-to roofs all come from one routine with exact ridge and hip lines.
export const planeY = (P, x, z) => P.c + P.ax * x + P.az * z;
export function envAt(planes, x, z) { let m = Infinity; for (const P of planes) m = Math.min(m, planeY(P, x, z)); return m; }
function clip(poly, k0, kx, kz) {
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const P = poly[i], Q = poly[(i + 1) % n], fpv = k0 + kx * P[0] + kz * P[1], fq = k0 + kx * Q[0] + kz * Q[1];
    if (fpv <= 1e-9) out.push(P);
    if ((fpv < -1e-9 && fq > 1e-9) || (fpv > 1e-9 && fq < -1e-9)) { const t = fpv / (fpv - fq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
  }
  return out;
}
const polyArea = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const A = p[i], B = p[(i + 1) % p.length]; a += A[0] * B[1] - B[0] * A[1]; } return a / 2; };
export function roofFaces(planes, R) {
  const faces = [];
  planes.forEach((P, i) => {
    let poly = [[R.x0, R.z0], [R.x1, R.z0], [R.x1, R.z1], [R.x0, R.z1]];
    planes.forEach((Q, j) => { if (i === j || !poly.length) return; poly = clip(poly, P.c - Q.c, P.ax - Q.ax, P.az - Q.az); });
    if (poly.length >= 3 && Math.abs(polyArea(poly)) > 1e-4) faces.push({ P, poly });
  });
  return faces;
}
const onEdge = (R, p, e = 1e-4) => (Math.abs(p[0] - R.x0) < e ? 1 : 0) | (Math.abs(p[0] - R.x1) < e ? 2 : 0) | (Math.abs(p[1] - R.z0) < e ? 4 : 0) | (Math.abs(p[1] - R.z1) < e ? 8 : 0);
// build the slab: the top in the roof material (u along the eaves, v up the slope), the soffit in planks, the edge band
// round the eaves; returns the ridge/hip lines (internal edges) and the boundary edges (eaves level, verges sloped)
export function roofSlab(b, mat, planes, R, th, tint, { soffit = 'woodDark', soffitC = '#8a7058', uvs = 0.42, edgeMat = null, edgeC = null, topLift = 0 } = {}) {
  const faces = roofFaces(planes, R);
  const top = { pos: [], nor: [], uv: [] }, und = { pos: [], nor: [], uv: [] }, edg = { pos: [], nor: [], uv: [] };
  const tri = (G, a, c, d, n, ua, uc, ud) => {
    // wind so the face looks along n
    const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { [c, d] = [d, c]; [uc, ud] = [ud, uc]; }
    G.pos.push(...a, ...c, ...d); G.nor.push(...n, ...n, ...n); G.uv.push(...ua, ...uc, ...ud);
  };
  const ridges = [], bounds = [];
  for (const { P, poly } of faces) {
    const g = Math.hypot(P.ax, P.az), k = Math.sqrt(1 + g * g);
    const [ux, uz] = g > 1e-6 ? [-P.az / g, P.ax / g] : [1, 0], [gx, gz] = g > 1e-6 ? [P.ax / g, P.az / g] : [0, 1];
    const nl = Math.hypot(P.ax, 1, P.az), n = [-P.ax / nl, 1 / nl, -P.az / nl];
    const T = poly.map(([x, z]) => [x, planeY(P, x, z) + th + topLift, z]), B = poly.map(([x, z]) => [x, planeY(P, x, z), z]);
    const UV = poly.map(([x, z]) => [(x * ux + z * uz) * uvs, (x * gx + z * gz) * k * uvs]);
    const UB = poly.map(([x, z]) => [x * 0.7, z * 0.7]);
    for (let i = 1; i < poly.length - 1; i++) {
      tri(top, T[0], T[i], T[i + 1], n, UV[0], UV[i], UV[i + 1]);
      tri(und, B[0], B[i], B[i + 1], [-n[0], -n[1], -n[2]], UB[0], UB[i], UB[i + 1]);
    }
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length, ea = onEdge(R, poly[i]), eb = onEdge(R, poly[j]), common = ea & eb;
      if (common) {
        const on = common & 1 ? [-1, 0, 0] : common & 2 ? [1, 0, 0] : common & 4 ? [0, 0, -1] : [0, 0, 1];
        const L = Math.hypot(poly[j][0] - poly[i][0], poly[j][1] - poly[i][1]);
        tri(edg, T[i], T[j], B[j], on, [0, th * 2], [L * 2, th * 2], [L * 2, 0]);
        tri(edg, T[i], B[j], B[i], on, [0, th * 2], [L * 2, 0], [0, 0]);
        bounds.push({ a: T[i], b: T[j], side: common & 1 ? 'x0' : common & 2 ? 'x1' : common & 4 ? 'z0' : 'z1', level: Math.abs(T[i][1] - T[j][1]) < 1e-3 });
      } else ridges.push([T[i], T[j]]);
    }
  }
  const geo = (G) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(G.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2)); return g; };
  if (top.pos.length) b.add(geo(top), mat, { uv: 'keep', c: tint });
  if (und.pos.length && soffit) b.add(geo(und), soffit, { uv: 'keep', c: soffitC });
  if (edg.pos.length) b.add(geo(edg), edgeMat || mat, { uv: 'keep', c: edgeC || shade(tint, 0.85) });
  // ridge and hip lines appear once per neighbouring face: keep one of each
  const seen = new Set(), lines = [];
  for (const [a, c] of ridges) {
    const k1 = a.map((v) => v.toFixed(2)).join(',') + '|' + c.map((v) => v.toFixed(2)).join(','), k2 = c.map((v) => v.toFixed(2)).join(',') + '|' + a.map((v) => v.toFixed(2)).join(',');
    if (seen.has(k1) || seen.has(k2)) continue; seen.add(k1); lines.push([a, c]);
  }
  return { faces, lines, bounds };
}
// the envelope along a straight line (exact: every point where two planes swap is a vertex)
export function envLine(planes, ax, az, bx2, bz, lift = 0) {
  const ts = [0, 1];
  const L = (P, t) => planeY(P, ax + (bx2 - ax) * t, az + (bz - az) * t);
  for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) {
    const a0 = L(planes[i], 0) - L(planes[j], 0), a1 = L(planes[i], 1) - L(planes[j], 1);
    if (Math.abs(a1 - a0) > 1e-9) { const t = a0 / (a0 - a1); if (t > 1e-6 && t < 1 - 1e-6) ts.push(t); }
  }
  ts.sort((p, q) => p - q);
  return ts.map((t) => [t, envAt(planes, ax + (bx2 - ax) * t, az + (bz - az) * t) + lift]);
}
// the gable wall under a roof along one face: the region between y0 and the roof's underside, at the wall's middle line
// (returns false when the roof does not rise above y0 there, i.e. that side is an eave)
export function gableWall(b, mat, F, planes, ta, tb, y0, tint, uOut = HT) {
  const A = fp(F, ta, 0, uOut), B = fp(F, tb, 0, uOut);
  const line = envLine(planes, A[0], A[2], B[0], B[2]);
  const pts = line.map(([t, y]) => [ta + (tb - ta) * t, y]);
  if (Math.max(...pts.map((p) => p[1])) < y0 + 0.06) return false;
  // walk the profile, keeping only the part above y0, then close along y0
  const poly = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    if (p[1] >= y0) poly.push(p);
    if (q && (p[1] - y0) * (q[1] - y0) < 0) { const t = (y0 - p[1]) / (q[1] - p[1]); poly.push([p[0] + (q[0] - p[0]) * t, y0]); }
  }
  const lo = Math.min(...poly.map((p) => p[0])), hi = Math.max(...poly.map((p) => p[0]));
  const prof = [[lo, y0], ...poly.filter((p) => p[1] > y0 + 1e-4), [hi, y0]];
  addPrism(b, mat, F, prof, -HT, uOut, tint);
  return true;
}
// extrude a closed (t, y) profile through the wall from depth u0 to u1 (front, back and the top edge)
export function addPrism(b, mat, F, prof, u0, u1, tint) {
  const shape = new THREE.Shape(prof.map(([t, y]) => new THREE.Vector2(t, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: u1 - u0, bevelEnabled: false });
  // shape xy = (t, y), extrude along +z = u; map into house space
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getX(i), y = p.getY(i), u = p.getZ(i) + u0;
    const q = fp(F, t, y, u); p.setXYZ(i, q[0], q[1], q[2]);
  }
  // every triangle faces away from the prism's middle (the profiles are convex), whatever the face's handedness
  { const P = g.attributes.position, U2 = g.attributes.uv; let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < P.count; i++) { cx += P.getX(i); cy += P.getY(i); cz += P.getZ(i); }
    cx /= P.count; cy /= P.count; cz /= P.count;
    const sw = (A, i, k) => { for (let c = 0; c < k; c++) { const v = A.array[(i + 1) * k + c]; A.array[(i + 1) * k + c] = A.array[(i + 2) * k + c]; A.array[(i + 2) * k + c] = v; } };
    for (let i = 0; i < P.count; i += 3) {
      const ax = P.getX(i), ay = P.getY(i), az = P.getZ(i);
      const e1 = [P.getX(i + 1) - ax, P.getY(i + 1) - ay, P.getZ(i + 1) - az], e2 = [P.getX(i + 2) - ax, P.getY(i + 2) - ay, P.getZ(i + 2) - az];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const mx = (ax + P.getX(i + 1) + P.getX(i + 2)) / 3 - cx, my = (ay + P.getY(i + 1) + P.getY(i + 2)) / 3 - cy, mz = (az + P.getZ(i + 1) + P.getZ(i + 2)) / 3 - cz;
      if (n[0] * mx + n[1] * my + n[2] * mz < 0) { sw(P, i, 3); if (U2) sw(U2, i, 2); }
    } }
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  b.add(g, mat, { uv: 'box', c: tint });
}

// ------------------------------------------------------------------ deterministic jitter for small parts
export function jitterRng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// a solid square-faced pipe run with square flange blocks (never round collars: no rings seen end-on)
export function squarePipe(b, mat, a, c, r = 0.07, col = 0xffffff) {
  beamAB(b, mat, a, c, r * 2, r * 2, col);
  for (const e of [a, c]) bx(b, mat, e[0] - r * 1.5, e[1] - r * 1.5, e[2] - r * 1.5, e[0] + r * 1.5, e[1] + r * 1.5, e[2] + r * 1.5, col);
}
export { box, cyl, extrude, rgb, WALL_T, DOOR_W, DOOR_H, WALL_H };
