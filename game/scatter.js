// Scatter: many static prefab instances drawn through one BatchedMesh per material and caster class
// (multi-draw, per-object frustum culling for the camera and the shadow pass).
// Small pieces (under SMALL_CASTER m tall as placed: flowers, pebbles, tufts) never cast sun shadows, so each material's
// batch is split into a casting and a non-casting part and the shadow pass only culls and draws the casting one.
// Opaque batches are not depth-sorted per instance (sortObjects off: it cost a sort per pass for little overdraw saved).
import * as THREE from 'three';
import { depthFor } from '../assets/kit.js';
import { hangingLantern, glowSprite } from '../assets/dynamic.js';
import { SHADOW_LAYER, packProxyPositions } from './layers.js';
import { IS_MOBILE } from '../engine/platform.js';
import { PASS } from '../engine/globals.js';

export const SMALL_CASTER = 0.6;
const _pv = new THREE.Vector3();

export class Scatter {
  constructor() {
    this.prefabs = new Map(); // key -> { parts: [{geo, mat}], res }
    this.placements = []; // { key, matrix }
    this.group = new THREE.Group();
    this.dynamics = [];
    this.colliders = [];
  }

  addPrefab(key, res) {
    const parts = res.builder.geometries();
    let y0 = Infinity, y1 = -Infinity;
    for (const p of parts) {
      if (p.mat.userData.billboard && p.geo.attributes.corner) padBillboardBounds(p.geo);
      if (!p.geo.boundingBox) p.geo.computeBoundingBox();
      y0 = Math.min(y0, p.geo.boundingBox.min.y); y1 = Math.max(y1, p.geo.boundingBox.max.y);
    }
    this.prefabs.set(key, { parts, res, height: y1 > y0 ? y1 - y0 : 0 });
  }

  place(key, x, y, z, rotY = 0, scale = 1) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(scale, scale, scale));
    const pf = this.prefabs.get(key);
    this.placements.push({ key, m, cast: pf.height * scale >= SMALL_CASTER });
    if (pf.res.collider) this.colliders.push({ x, z, r: pf.res.collider.r * scale });
    // live objects: hanging lanterns, glows
    for (const l of pf.res.lanterns || []) {
      const h = hangingLantern(l.color, l.len * scale, scale);
      h.position.fromArray(l.p).applyMatrix4(m);
      this.group.add(h); this.dynamics.push(h);
    }
    for (const g of pf.res.glows || []) {
      const s = glowSprite(g.color, g.size * scale, g.intensity ?? 0.6);
      s.position.fromArray(g.p).applyMatrix4(m);
      this.group.add(s); this.dynamics.push(s);
    }
    return m;
  }

  // Allocate batches once all placements are known.
  build() {
    // one batch per material and caster class (transparent materials never cast). v116: one batch per material: a
    // material with casting and non-casting placements was two batches (two draws in the camera pass, the geometry held
    // twice); now one, whose non-casting instances are left out of the shadow pass (cellCull, PASS.shadow). ?scatmerge=0
    // keeps the split
    const merge = !/[?&]scatmerge=0/.test(globalThis.location?.search || '');
    const byMat = new Map(); // mat|cast -> { mat, cast, geos: Map(key -> geo), instances, verts }
    const usage = new Map(); // key|cast -> placements
    for (const pl of this.placements) { const u = pl.key + '|' + pl.cast; usage.set(u, (usage.get(u) || 0) + 1); }
    for (const [key, pf] of this.prefabs) {
      for (const cast of [true, false]) {
        const n = usage.get(key + '|' + cast);
        if (!n) continue;
        for (const { geo, mat } of pf.parts) {
          const c = cast && !mat.transparent, slot = merge ? 'all' : c;
          let byC = byMat.get(mat);
          if (!byC) byMat.set(mat, (byC = new Map()));
          let e = byC.get(slot);
          if (!e) byC.set(slot, (e = { mat, cast: c, all: merge, geos: new Map(), instances: 0, verts: 0 }));
          if (c) e.cast = true; // (merged: casts if any of its instances does)
          if (!e.geos.has(key)) { e.geos.set(key, geo); e.verts += geo.attributes.position.count; }
          e.instances += n;
        }
      }
    }
    this.batches = [];
    for (const byC of byMat.values()) for (const e of byC.values()) {
      const bm = new THREE.BatchedMesh(e.instances, e.verts, 0, e.mat);
      bm.perObjectFrustumCulled = true;
      bm.sortObjects = false;
      bm.castShadow = e.cast;
      bm.receiveShadow = !e.mat.userData.billboard;
      if (e.mat.userData.wind) bm.customDepthMaterial = depthFor(e.mat);
      const ids = new Map(), castOf = [];
      for (const [key, geo] of e.geos) ids.set(key, bm.addGeometry(geo));
      for (const pl of this.placements) {
        const c = pl.cast && !e.mat.transparent;
        if (!e.all && c !== e.cast) continue;
        const gid = ids.get(pl.key);
        if (gid === undefined) continue;
        const iid = bm.addInstance(gid);
        bm.setMatrixAt(iid, pl.m);
        castOf[iid] = c ? 1 : 0;
      }
      // (merged with non-casting instances: the shadow pass skips those, cellCull)
      if (e.all && e.cast && castOf.includes(0)) bm.userData.castOf = Uint8Array.from(castOf);
      bm.computeBoundingBox();
      bm.computeBoundingSphere();
      bm.userData.scatterCast = e.cast;
      bm.userData.srcMat = e.mat;
      // the batch draws with its own material object (same look, textures, uniforms and hooks, see batchMaterial):
      // three keeps one program state per material, and a material shared by plain meshes and a batch made it
      // re-derive the program at every switch between the two (getParameters per draw, both passes)
      bm.material = batchMaterial(e.mat);
      if (!e.mat.transparent) cellCull(bm);
      this.group.add(bm);
      this.batches.push(bm);
    }
    return this.group;
  }

  // shadow proxies for the casting placements (perf plan B1): the opaque parts that sway in no wind, merged per cell into
  // depth-only meshes on SHADOW_LAYER, added to the scatter group. Returns the same shape as layers.js
  // buildShadowProxies (use useShadowProxies(P, on) once the shadow camera sees SHADOW_LAYER); its sources are the
  // batches whose every part is covered (the wind-swayed batches keep casting themselves).
  buildShadowProxies({ cell = 48 } = {}) {
    const buckets = new Map();
    const covered = new Set();
    for (const pl of this.placements) {
      if (!pl.cast) continue;
      const pf = this.prefabs.get(pl.key);
      _pv.setFromMatrixPosition(pl.m);
      for (const { geo, mat } of pf.parts) {
        if (mat.transparent || mat.alphaTest > 0 || mat.userData.wind || mat.userData.billboard || mat.userData.foliage) continue;
        covered.add(mat);
        const k = `${Math.floor(_pv.x / cell)},${Math.floor(_pv.z / cell)},${mat.side}`;
        let b = buckets.get(k);
        if (!b) buckets.set(k, (b = { side: mat.side, parts: [], verts: 0, idx: 0 }));
        const n = geo.attributes.position.count;
        b.parts.push({ geo, m: pl.m }); b.verts += n; b.idx += geo.index ? geo.index.count : n;
      }
    }
    const group = new THREE.Group(); group.userData.shadowProxy = true;
    const mats = new Map(); let tris = 0;
    for (const b of buckets.values()) {
      const pos = new Float32Array(b.verts * 3), index = b.verts > 65535 ? new Uint32Array(b.idx) : new Uint16Array(b.idx);
      let v0 = 0, i0 = 0;
      for (const { geo, m } of b.parts) {
        const P = geo.attributes.position, n = P.count, flip = m.determinant() < 0;
        for (let i = 0; i < n; i++) { _pv.fromBufferAttribute(P, i).applyMatrix4(m); pos[(v0 + i) * 3] = _pv.x; pos[(v0 + i) * 3 + 1] = _pv.y; pos[(v0 + i) * 3 + 2] = _pv.z; }
        if (geo.index) { const I = geo.index; for (let i = 0; i < I.count; i += 3) { index[i0++] = v0 + I.getX(i); index[i0++] = v0 + I.getX(flip ? i + 2 : i + 1); index[i0++] = v0 + I.getX(flip ? i + 1 : i + 2); } }
        else for (let i = 0; i < n; i += 3) { index[i0++] = v0 + i; index[i0++] = v0 + (flip ? i + 2 : i + 1); index[i0++] = v0 + (flip ? i + 1 : i + 2); }
        v0 += n;
      }
      const geo = new THREE.BufferGeometry();
      let mat = mats.get(b.side);
      if (!mat) mats.set(b.side, (mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: b.side })));
      const mesh = new THREE.Mesh(geo, mat);
      geo.setAttribute('position', packProxyPositions(pos, mesh));
      geo.setIndex(new THREE.BufferAttribute(i0 === index.length ? index : index.slice(0, i0), 1));
      geo.computeBoundingSphere();
      // phones: the JS copy goes once it is on the GPU (nothing reads a proxy back)
      if (IS_MOBILE) for (const a of [geo.attributes.position, geo.index]) a.onUpload(function () { this.array = null; });
      tris += i0 / 3;
      mesh.castShadow = true; mesh.layers.set(SHADOW_LAYER); mesh.matrixAutoUpdate = false; mesh.userData.shadowProxy = true;
      group.add(mesh);
    }
    group.matrixAutoUpdate = false;
    this.group.add(group); group.updateMatrixWorld(true);
    const sources = (this.batches || []).filter((bm) => bm.userData.scatterCast && covered.has(bm.userData.srcMat || bm.material));
    return { group, sources, cells: group.children.length, tris, active: false };
  }

  update(dt, t, focus, radius = 60) {
    for (const d of this.dynamics) {
      if (focus && d.position.distanceToSquared(focus) > radius * radius) continue;
      d.userData.update?.(dt, t);
    }
  }
}

// A live view of a material for the batches: every property (uniforms, maps, onBeforeCompile, version, so needsUpdate on
// the original recompiles both) reads through to the original; only the identity three keys its state by is new.
const _batchMats = new WeakMap();
let _batchMatId = 1 << 20;
function batchMaterial(m) {
  let b = _batchMats.get(m);
  if (b) return b;
  b = Object.create(m);
  Object.defineProperty(b, 'id', { value: _batchMatId++ });
  b.uuid = THREE.MathUtils.generateUUID();
  b._listeners = {}; // its own dispose listeners (three's), not the original's
  _batchMats.set(m, b);
  m.addEventListener('dispose', () => b.dispatchEvent({ type: 'dispose' }));
  return b;
}

// Cell culling for a static batch (perf): three's per-object culling tests every instance's sphere in both passes
// (village: about 30k sphere tests per pass over 70 batches). Instances are bucketed into 32 m cells once; a cell wholly
// outside the frustum is skipped, one wholly inside takes all its instances untested, and only the cells on the edge
// test their instances. Same instances drawn as before (sortObjects is off, so only the draw order within the batch
// changes, which opaque depth-tested pieces do not show). Rebuilt if a matrix changes after the build.
const CULL_CELL = 32;
const _cm = new THREE.Matrix4(), _cs = new THREE.Sphere(), _cfr = new THREE.Frustum();
function cellCull(bm) {
  const orig = bm._updateDrawParameters;
  if (typeof orig !== 'function' || !bm._instanceInfo || !bm._geometryInfo) return;
  let C = null;
  const build = () => {
    const info = bm._instanceInfo, n = info.length, castOf = bm.userData.castOf || null;
    const sp = new Float32Array(n * 4), cells = new Map();
    for (let i = 0; i < n; i++) {
      bm.getMatrixAt(i, _cm);
      bm.getBoundingSphereAt(info[i].geometryIndex, _cs).applyMatrix4(_cm);
      sp[i * 4] = _cs.center.x; sp[i * 4 + 1] = _cs.center.y; sp[i * 4 + 2] = _cs.center.z; sp[i * 4 + 3] = _cs.radius;
      const k = Math.floor(_cs.center.x / CULL_CELL) + ',' + Math.floor(_cs.center.z / CULL_CELL);
      let c = cells.get(k);
      if (!c) cells.set(k, (c = { ids: [], cast: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
      c.ids.push(i);
      if (!castOf || castOf[i]) c.cast.push(i);
      for (let a = 0; a < 3; a++) { c.min[a] = Math.min(c.min[a], sp[i * 4 + a] - _cs.radius); c.max[a] = Math.max(c.max[a], sp[i * 4 + a] + _cs.radius); }
    }
    const list = [];
    for (const c of cells.values()) {
      const cx = (c.min[0] + c.max[0]) / 2, cy = (c.min[1] + c.max[1]) / 2, cz = (c.min[2] + c.max[2]) / 2;
      let r = 0;
      for (const i of c.ids) r = Math.max(r, Math.hypot(sp[i * 4] - cx, sp[i * 4 + 1] - cy, sp[i * 4 + 2] - cz) + sp[i * 4 + 3]);
      list.push({ x: cx, y: cy, z: cz, r, ids: Int32Array.from(c.ids), cast: castOf ? Int32Array.from(c.cast) : null });
    }
    C = { sp, cells: list, n };
  };
  const setMatrixAt = bm.setMatrixAt;
  bm.setMatrixAt = function (...a) { C = null; return setMatrixAt.apply(this, a); };
  bm._updateDrawParameters = function (camera, geometry, material, drawFormat = 'multiDraw') {
    if (drawFormat !== 'multiDraw' || camera.isArrayCamera || !this.perObjectFrustumCulled || this.sortObjects) return orig.call(this, camera, geometry, material, drawFormat);
    const info = this._instanceInfo;
    if (!C || C.n !== info.length) build();
    const index = geometry.getIndex();
    let bpe = index === null ? 1 : index.array.BYTES_PER_ELEMENT, mul = 1;
    if (material.wireframe) { mul = 2; bpe = geometry.attributes.position.count > 65535 ? 4 : 2; }
    _cm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(this.matrixWorld);
    _cfr.setFromProjectionMatrix(_cm, camera.coordinateSystem, camera.reversedDepth);
    const P = _cfr.planes, sp = C.sp, gi = this._geometryInfo, starts = this._multiDrawStarts, counts = this._multiDrawCounts;
    const ind = this._indirectTexture.image.data;
    let n = 0;
    const sh = PASS.shadow; // (v116: a merged batch casts only from its casting instances)
    for (const c of C.cells) {
      if (sh && c.cast && !c.cast.length) continue;
      let inside = true, out = false;
      for (let p = 0; p < 6; p++) {
        const pl = P[p], d = pl.normal.x * c.x + pl.normal.y * c.y + pl.normal.z * c.z + pl.constant;
        if (d < -c.r) { out = true; break; }
        if (d < c.r) inside = false;
      }
      if (out) continue;
      const ids = sh && c.cast ? c.cast : c.ids;
      for (let k = 0; k < ids.length; k++) {
        const i = ids[k], ii = info[i];
        if (!ii.visible || !ii.active) continue;
        if (!inside) {
          const x = sp[i * 4], y = sp[i * 4 + 1], z = sp[i * 4 + 2], r = sp[i * 4 + 3];
          let culled = false;
          for (let p = 0; p < 6; p++) { const pl = P[p]; if (pl.normal.x * x + pl.normal.y * y + pl.normal.z * z + pl.constant < -r) { culled = true; break; } }
          if (culled) continue;
        }
        const g = gi[ii.geometryIndex];
        starts[n] = g.start * bpe * mul; counts[n] = g.count * mul; ind[n] = i; n++;
      }
    }
    this._indirectTexture.needsUpdate = true;
    this._multiDrawCount = n;
    this._multiDrawBytesPerElement = bpe;
    this._visibilityChanged = false;
  };
}

// Billboard cards expand on the GPU, so their geometry bounds are too small for culling.
// Append two zero-area triangles at the padded bounds corners so culling sees the real size.
function padBillboardBounds(geo) {
  geo.computeBoundingBox();
  const c = geo.attributes.corner;
  let maxC = 0;
  for (let i = 0; i < c.count; i++) maxC = Math.max(maxC, Math.abs(c.getX(i)), Math.abs(c.getY(i)));
  const bb = geo.boundingBox.clone().expandByScalar(maxC * 1.2);
  const n = geo.attributes.position.count;
  const add = 6;
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.attributes[name];
    const arr = new Float32Array((n + add) * a.itemSize);
    arr.set(a.array);
    if (name === 'position') {
      for (let k = 0; k < 3; k++) arr.set([bb.min.x, bb.min.y, bb.min.z], (n + k) * 3);
      for (let k = 3; k < 6; k++) arr.set([bb.max.x, bb.max.y, bb.max.z], (n + k) * 3);
    }
    geo.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}
