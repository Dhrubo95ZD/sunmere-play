// Geometry kit: primitives, modifiers and a Builder that merges parts per material with
// baked vertex colour (tint + painted light/AO) and per-vertex wind amplitudes.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getMat, windDepthMaterial } from '../engine/materials.js';
import { hash2, mulberry32 } from '/sunmere-play/shared/noise.js';
import { IS_MOBILE } from '../engine/platform.js';

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _col = new THREE.Color();

// linear rgb triple from hex / number / array
export function rgb(c) {
  if (Array.isArray(c)) return c;
  _col.set(c);
  return [_col.r, _col.g, _col.b];
}
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// texture repeats per metre for box-projected materials
const TEXEL = {
  wood: 0.7, woodDark: 0.7, woodLight: 0.7, beam: 0.8, stone: 0.42, stoneDark: 0.5, stoneLarge: 0.28, cobble: 0.4,
  slate: 0.42, slateRed: 0.42, shingleWood: 0.45, mossRoof: 0.4, plaster: 0.3, sandstone: 0.3, rock: 0.22, rockNoFade: 0.22, rockSand: 0.22,
  cloth: 0.8, clothWind: 0.8, dirtPlain: 0.25, leather: 1.2, metal: 0.8, iron: 0.8, gold: 1, brass: 1, copper: 1,
  bark: 0.6, barkDark: 0.6, barkGold: 0.6, barkPurple: 0.6, barkPalm: 0.6,
};

// ---------------------------------------------------------------------------
// primitives
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const rbox = (w, h, d, r = 0.05, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
export const cyl = (rt, rb, h, seg = 12, hseg = 1, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, hseg, open);
export const cone = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);
export const sphere = (r, ws = 16, hs = 12, phiStart, phiLen, thetaStart, thetaLen) => new THREE.SphereGeometry(r, ws, hs, phiStart, phiLen, thetaStart, thetaLen);
export const ico = (r, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
export const torus = (R, r, rs = 8, ts = 24, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, rs, ts, arc);
export const card = (w, h, sx = 1, sy = 1) => new THREE.PlaneGeometry(w, h, sx, sy);
export function lathe(pts, seg = 16) {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg);
}
export function extrude(shape, depth = 0.1, bevel = 0.02, curveSeg = 12) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curveSeg,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

// triangular prism (gable) along z: width w, height h, depth d, base at y=0
export function prism(w, h, d) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

// Tapered tube along points (Vector3[]), radius(t) function or number. Caps the far end.
export function tube(points, radius, radial = 8, segs = null, { capEnd = true, capStart = false, uvScale = 1 } = {}) {
  const curve = points.length > 2 ? new THREE.CatmullRomCurve3(points, false, 'centripetal') : new THREE.LineCurve3(points[0], points[1]);
  const n = segs ?? Math.max(4, Math.round(curve.getLength() * 2.5));
  const frames = curve.computeFrenetFrames(n, false);
  const rf = typeof radius === 'function' ? radius : () => radius;
  const pos = [], nor = [], uv = [], idx = [];
  const len = curve.getLength();
  for (let i = 0; i <= n; i++) {
    const t = i / n, P = curve.getPointAt(t), N = frames.normals[i], B = frames.binormals[i];
    const r = rf(t);
    const circ = Math.max(0.3, 2 * Math.PI * r);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cx = Math.cos(a), sx = Math.sin(a);
      const nx = N.x * cx + B.x * sx, ny = N.y * cx + B.y * sx, nz = N.z * cx + B.z * sx;
      pos.push(P.x + nx * r, P.y + ny * r, P.z + nz * r);
      nor.push(nx, ny, nz);
      uv.push((j / radial) * Math.round(circ * uvScale * 1.5 + 1), t * len * uvScale);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const addCap = (i, dir) => {
    const P = curve.getPointAt(i / n);
    const T = frames.tangents[i];
    const c = pos.length / 3;
    pos.push(P.x, P.y, P.z); nor.push(T.x * dir, T.y * dir, T.z * dir); uv.push(0.5, 0.5);
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      if (dir > 0) idx.push(c, a, a + 1); else idx.push(c, a + 1, a);
    }
  };
  if (capEnd) addCap(n, 1);
  if (capStart) addCap(0, -1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData.curve = curve;
  return g;
}

// Gear outline: teeth around a rim, optional spoked windows and an axle hole.
export function gearShape(teeth, rRoot, rTip, { hole = 0, spokes = 0, rim = 0.25, hub = 0.28, spokeW = 0.16 } = {}) {
  spokes = 0; // content rule: spokes read as crosses and stars from the game camera, so every gear is a solid toothed disc
  const s = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [
      [rRoot, a], [rRoot, a + step * 0.12], [rTip, a + step * 0.3], [rTip, a + step * 0.62], [rRoot, a + step * 0.8],
    ];
    for (let k = 0; k < pts.length; k++) {
      const [r, aa] = pts[k];
      const x = Math.cos(aa) * r, y = Math.sin(aa) * r;
      if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
  }
  s.closePath();
  if (spokes > 0) {
    const rIn = rRoot * (1 - rim), rHub = rRoot * hub;
    const sw = spokeW;
    const segA = (Math.PI * 2) / spokes;
    for (let i = 0; i < spokes; i++) {
      const a0 = i * segA + sw * 0.5 / 1, a1 = (i + 1) * segA - sw * 0.5 / 1;
      const h = new THREE.Path();
      const pad0 = sw / rIn, pad1 = sw / rHub;
      h.moveTo(Math.cos(a0 + pad0) * rIn, Math.sin(a0 + pad0) * rIn);
      h.absarc(0, 0, rIn, a0 + pad0, a1 - pad0, false);
      h.lineTo(Math.cos(a1 - pad1) * rHub, Math.sin(a1 - pad1) * rHub);
      h.absarc(0, 0, rHub, a1 - pad1, a0 + pad1, true);
      h.closePath();
      s.holes.push(h);
    }
  }
  if (hole > 0) {
    const h = new THREE.Path();
    h.absarc(0, 0, hole, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return s;
}
export function gear(teeth, rRoot, rTip, thick, opts = {}) {
  return extrude(gearShape(teeth, rRoot, rTip, opts), thick, opts.bevel ?? Math.min(thick * 0.18, rRoot * 0.04), 10);
}

export function arcShape(w, h, archH, inset = 0) {
  // window/door opening: a plain rectangle w wide and h tall (formerly round-topped)
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  // square-headed (content rule: no arches): the archH argument is kept for callers but the top is flat
  s.lineTo(r, h);
  s.lineTo(-r, h);
  s.lineTo(-r, 0);
  return s;
}

// ---------------------------------------------------------------------------
// modifiers (operate in place, return geo)
function bbox(geo) { geo.computeBoundingBox(); return geo.boundingBox; }

export function taper(geo, sx = 0.5, sz = sx, axis = 'y') {
  const bb = bbox(geo), p = geo.attributes.position;
  const lo = bb.min[axis], hi = bb.max[axis];
  for (let i = 0; i < p.count; i++) {
    const t = (p.getComponent(i, axis === 'y' ? 1 : axis === 'x' ? 0 : 2) - lo) / (hi - lo || 1);
    const kx = lerp(1, sx, t), kz = lerp(1, sz, t);
    if (axis === 'y') { p.setX(i, p.getX(i) * kx); p.setZ(i, p.getZ(i) * kz); }
    else if (axis === 'z') { p.setX(i, p.getX(i) * kx); p.setY(i, p.getY(i) * kz); }
    else { p.setY(i, p.getY(i) * kx); p.setZ(i, p.getZ(i) * kz); }
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// x += k * y^2 (bend along y)
export function bendY(geo, kx = 0.1, kz = 0) {
  const p = geo.attributes.position, bb = bbox(geo);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) - bb.min.y;
    p.setX(i, p.getX(i) + kx * y * y);
    p.setZ(i, p.getZ(i) + kz * y * y);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function twist(geo, ang) {
  const p = geo.attributes.position, bb = bbox(geo);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1);
    const a = ang * t, c = Math.cos(a), s = Math.sin(a);
    const x = p.getX(i), z = p.getZ(i);
    p.setX(i, x * c - z * s); p.setZ(i, x * s + z * c);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Organic displacement with smooth normals (welds vertices first so seams never split).
export function lumpy(geo, amp = 0.1, freq = 1.5, seed = 1, { flatBottom = null } = {}) {
  let g = geo.index ? geo : geo;
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = noise3(v.x * freq, v.y * freq, v.z * freq, seed) * 0.65 + noise3(v.x * freq * 2.7, v.y * freq * 2.7, v.z * freq * 2.7, seed + 7) * 0.35;
    const d = (n - 0.5) * 2 * amp;
    const l = v.length() || 1;
    v.addScaledVector(v.clone().divideScalar(l), d);
    if (flatBottom !== null && v.y < flatBottom) v.y = flatBottom;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function noise3(x, y, z, seed = 0) {
  // cheap 3D value noise
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const h = (a, b, c) => hash2(a * 7 + c * 131, b * 13 - c * 71, seed);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h(ix, iy, iz), h(ix + 1, iy, iz), u), l(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), u), v),
    l(l(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), u), l(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), u), v),
    w,
  );
}

// planar box projection of UVs (local space), scale = repeats per metre
export function boxUV(geo, scale = 1) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c;
      let u, w;
      if (ay >= ax && ay >= az) { u = v.x; w = v.z; }
      else if (ax >= az) { u = v.z * Math.sign(n.x || 1); w = v.y; }
      else { u = -v.x * Math.sign(n.z || 1); w = v.y; }
      uv[(i + k) * 2] = u * scale;
      uv[(i + k) * 2 + 1] = w * scale;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// ---------------------------------------------------------------------------
// Builder
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const depthCache = new Map();

export function makeMatrix(o) {
  if (o.m) return o.m.clone();
  const p = o.p || [0, 0, 0], r = o.r || [0, 0, 0];
  const s = o.s === undefined ? [1, 1, 1] : typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s;
  _e.set(r[0], r[1], r[2], o.order || 'XYZ');
  if (o.q) _q.copy(o.q); else _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2]));
}

export class Builder {
  constructor(seed = 1) {
    this.parts = new Map();
    this.rng = mulberry32(seed);
  }
  r(a = 0, b = 1) { return a + (b - a) * this.rng(); }

  // opts: p r s q m order | c (color / fn) | ao {y0,y1,min} | top (highlight on up faces) | vary
  //       w (wind vec4 or fn(x,y,z)) | uv 'box'|'keep' | us (uv scale) | flat (flat shading)
  add(geoIn, mat, o = {}) {
    // content rules: no flags or banners. Every banner cloth (the banner* materials) is left out wherever a builder
    // still hangs one; the posts, rings and finials stay as plain posts
    if (typeof mat === 'string' && mat.startsWith('banner')) return geoIn;
    let geo = geoIn.index ? geoIn.toNonIndexed() : geoIn.clone();
    geo.clearGroups();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'corner'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const matName = typeof mat === 'string' ? mat : mat.name;
    const uvMode = o.uv || (geo.attributes.uv && !o.boxuv ? 'keep' : 'box');
    const us = o.us ?? TEXEL[matName] ?? 1;

    // scale first (so box UVs follow real size), then rotate/translate
    const s = o.s === undefined ? [1, 1, 1] : typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s;
    if (!o.m) geo.applyMatrix4(new THREE.Matrix4().makeScale(s[0], s[1], s[2]));
    if (uvMode === 'box') boxUV(geo, us);
    else if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    else if (o.us !== undefined) {
      const uv = geo.attributes.uv, su = Array.isArray(o.us) ? o.us[0] : o.us, sv = Array.isArray(o.us) ? o.us[1] : o.us;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
    const m = o.m ? o.m : makeMatrix({ ...o, s: 1 });
    geo.applyMatrix4(m);
    if (o.flat) { geo.deleteAttribute('normal'); geo.computeVertexNormals(); }
    if (o.normals) o.normals(geo); // custom normal override (foliage)

    const p = geo.attributes.position, nrm = geo.attributes.normal, n = p.count;
    const col = new Float32Array(n * 3), wnd = new Float32Array(n * 4);
    const base = typeof o.c === 'function' ? null : rgb(o.c ?? 0xffffff);
    const vary = o.vary ? 1 + (this.rng() - 0.5) * 2 * o.vary : 1;
    const ao = o.ao === undefined ? null : typeof o.ao === 'number' ? { y0: 0, y1: o.ao, min: 0.55 } : o.ao;
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const c = base || rgb(o.c(x, y, z, nrm.getX(i), nrm.getY(i), nrm.getZ(i), i));
      let k = vary;
      if (ao) k *= lerp(ao.min, 1, sstep(ao.y0, ao.y1, y));
      if (o.top) k *= 1 + Math.max(0, nrm.getY(i)) * o.top;
      col[i * 3] = c[0] * k; col[i * 3 + 1] = c[1] * k; col[i * 3 + 2] = c[2] * k;
      if (o.w) {
        const w = typeof o.w === 'function' ? o.w(x, y, z, i) : o.w;
        wnd[i * 4] = w[0] || 0; wnd[i * 4 + 1] = w[1] || 0; wnd[i * 4 + 2] = w[2] || 0; wnd[i * 4 + 3] = w[3] || 0;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('wind', new THREE.BufferAttribute(wnd, 4));
    if (!this.parts.has(matName)) this.parts.set(matName, []);
    this.parts.get(matName).push(geo);
    if (matName === 'glassWarm') { const pn = paneOf(geo); if (pn) (this.panes ||= []).push(pn); }
    return geo;
  }

  // merge another builder's parts (with a transform)
  addBuilder(other, o = {}) {
    const m = makeMatrix(o);
    for (const [mat, list] of other.parts) for (const g of list) {
      const c = g.clone().applyMatrix4(m);
      if (!this.parts.has(mat)) this.parts.set(mat, []);
      this.parts.get(mat).push(c);
    }
    for (const pn of other.panes || []) (this.panes ||= []).push(movePane(pn, m));
  }

  geometries() {
    const out = [];
    for (const [mat, list] of this.parts) {
      const geo = mergeGeometries(list, false);
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      const material = getMat(mat);
      if (material.userData.billboard && geo.attributes.corner) {
        // corners expand on the GPU: grow bounds by the largest card
        let maxC = 0; const c = geo.attributes.corner;
        for (let i = 0; i < c.count; i++) maxC = Math.max(maxC, Math.abs(c.getX(i)), Math.abs(c.getY(i)));
        geo.boundingSphere.radius += maxC * 1.5;
        geo.boundingBox.expandByScalar(maxC * 1.5);
      }
      out.push({ geo, mat: material, name: mat });
    }
    return out;
  }

  build({ shadow = true, receive = true } = {}) {
    const g = new THREE.Group();
    for (const { geo, mat } of this.geometries()) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadow && !mat.transparent;
      mesh.receiveShadow = receive && !mat.userData.billboard;
      if (mat.userData.wind) mesh.customDepthMaterial = depthFor(mat);
      g.add(mesh);
    }
    // phones: the source parts are merged now; drop them so a builder kept alive by a closure does not hold a second
    // copy of everything it built (hundreds of MB across the dungeons). The desktop keeps them as before.
    if (IS_MOBILE) this.parts = new Map();
    if (this.panes) g.userData.panes = this.panes; // (LF.1) the window glow on the wall round each lit pane (world.js)
    return g;
  }
}

// (LF.1) a warm window pane as the world's window glow needs it: centre c, outward-or-inward normal n (level), tangent t,
// half-width w along t and its bottom and top y (all in the builder's space). Panes that lie flat (a counter's glass top)
// or are tiny (a lamp's glass) are not windows: null
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _pc = new THREE.Vector3(), _pn = new THREE.Vector3();
export function paneOf(geo) {
  const p = geo.attributes.position, n = p.count;
  let best = 0; const N = new THREE.Vector3();
  for (let i = 0; i + 2 < n; i += 3) {
    _pa.fromBufferAttribute(p, i); _pb.fromBufferAttribute(p, i + 1); _pc.fromBufferAttribute(p, i + 2);
    _pn.subVectors(_pb, _pa).cross(_pc.sub(_pa));
    const a = _pn.length();
    if (a > best * 1.001) { best = a; N.copy(_pn).divideScalar(a); }
  }
  if (!best || Math.abs(N.y) > 0.3) return null;
  N.y = 0; N.normalize();
  const tx = -N.z, tz = N.x;
  let t0 = Infinity, t1 = -Infinity, y0 = Infinity, y1 = -Infinity, cx = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = x * tx + z * tz;
    if (t < t0) t0 = t; if (t > t1) t1 = t; if (y < y0) y0 = y; if (y > y1) y1 = y; cx += x; cz += z;
  }
  const w = (t1 - t0) / 2;
  if (w * 2 * (y1 - y0) < 0.12) return null;
  return { c: [cx / n, (y0 + y1) / 2, cz / n], n: [N.x, N.z], w, h: (y1 - y0) / 2 };
}
// the same pane under a transform (a builder merged into another, a placed group: world.js)
const _mv = new THREE.Vector3(), _md = new THREE.Vector3();
export function movePane(pn, m) {
  _mv.set(pn.c[0], pn.c[1], pn.c[2]).applyMatrix4(m);
  _md.set(-pn.n[1], 0, pn.n[0]).transformDirection(m);
  const e = m.elements, sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]);
  return { c: [_mv.x, _mv.y, _mv.z], n: [_md.z, -_md.x], w: pn.w * sx, h: pn.h * sy, shut: pn.shut };
}

export function depthFor(mat) {
  if (!depthCache.has(mat)) depthCache.set(mat, windDepthMaterial(mat));
  return depthCache.get(mat);
}

// Camera-facing card: every vertex sits at `center`; `corner` holds the view-space offset.
export function bbCard(center, size, rot = 0, normal = null, bias = 0) {
  const h = size / 2, c = Math.cos(rot), s = Math.sin(rot);
  const quad = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  const pos = new Float32Array(18), uv = new Float32Array(12), cor = new Float32Array(18), nor = new Float32Array(18);
  const n = normal || new THREE.Vector3(0, 1, 0);
  quad.forEach(([x, y], i) => {
    pos[i * 3] = center.x; pos[i * 3 + 1] = center.y; pos[i * 3 + 2] = center.z;
    uv[i * 2] = (x + 1) / 2; uv[i * 2 + 1] = (y + 1) / 2;
    cor[i * 3] = (x * c - y * s) * h; cor[i * 3 + 1] = (x * s + y * c) * h; cor[i * 3 + 2] = bias;
    nor[i * 3] = n.x; nor[i * 3 + 1] = n.y; nor[i * 3 + 2] = n.z;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('corner', new THREE.BufferAttribute(cor, 3));
  return g;
}

// Sphere-ish normals for foliage cards: blend the card normal toward (vertex - centre).
export function sphereNormals(center, k = 0.85) {
  return (geo) => {
    const p = geo.attributes.position, nr = geo.attributes.normal;
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).sub(center).normalize();
      n.fromBufferAttribute(nr, i);
      if (n.dot(v) < 0) n.negate();
      n.lerp(v, k).normalize();
      nr.setXYZ(i, n.x, n.y, n.z);
    }
    nr.needsUpdate = true;
  };
}
