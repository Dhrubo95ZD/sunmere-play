// Shadow-only proxy meshes (perf plan B1). The sun's shadow pass drew every static kit mesh, prop and scatter piece one
// by one (village: 840 shadow draws, 1.8M triangles). buildShadowProxies() merges the static opaque casters of a built
// group into a few depth-only meshes per 48 m cell. The proxies live on SHADOW_LAYER only, so the main camera (layer 0)
// never draws them; the shadow camera sees them once its layers include SHADOW_LAYER.
//
// Staging (nothing changes on screen until both halves are in):
//   1. build:  const P = buildShadowProxies(areaGroup)  (adds P.group inside areaGroup, so it shows and hides with it;
//      the sources still cast as before and the proxies are not drawn by anyone yet: three's shadow pass uses the main
//      camera's layers (0) while the shadow camera has only layer 0)
//   2. switch: renderer: sun.shadow.camera.layers.enable(SHADOW_LAYER)   (layers 0 + 1: dynamic casters on layer 0
//      keep casting, the proxies start to) and useShadowProxies(P, true) (the replaced sources stop casting).
//      useShadowProxies(P, false) puts the sources back.
// What is merged: meshes with castShadow, an opaque single material without alphaTest or its own depth material (wind
// sway keeps its own caster), not skinned, instanced or batched, visible, and not inside anything dynamic (see
// freeze.js isDynamic: userData.update / dyn / door / machine...). Pass exclude(o) to keep more out (house doors).
// Build before engine/slim.js frees the vertex copies on phones (game.js runs slimStatic right after the world).
import * as THREE from 'three';
import { isDynamic } from './freeze.js';

export const SHADOW_LAYER = 1;

// put an object (and its meshes) on the shadow layer as well as the main one (for casters a proxy does not cover when a
// renderer shows only the shadow layer to the shadow camera)
export function castOnShadowLayer(obj) { obj.traverse((o) => { if (o.isMesh || o.isPoints) o.layers.enable(SHADOW_LAYER); }); return obj; }

// a proxy cell's positions as 16-bit integers over the cell's own box (perf, F4): the mesh's matrix maps them back, so
// a vertex lands within 0.4 mm of where it was (the sun shadow's normal bias is 35 mm), at half the memory in JS and on
// the GPU. pos: world-placed Float32Array (x, y, z per vertex). Returns the position attribute; sets mesh's matrix.
export function packProxyPositions(pos, mesh) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { const v = pos[i + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  const c = [0, 1, 2].map((a) => (lo[a] + hi[a]) / 2), h = [0, 1, 2].map((a) => Math.max(1e-3, (hi[a] - lo[a]) / 2));
  const q = new Int16Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) q[i + a] = Math.round(Math.max(-1, Math.min(1, (pos[i + a] - c[a]) / h[a])) * 32767);
  mesh.position.set(c[0], c[1], c[2]); mesh.scale.set(h[0], h[1], h[2]);
  mesh.updateMatrix();
  return new THREE.BufferAttribute(q, 3, true);
}

const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _v = new THREE.Vector3(), _box = new THREE.Box3();

function eligible(o) {
  if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o.isBatchedMesh || !o.castShadow) return false;
  const m = o.material;
  if (!m || Array.isArray(m) || m.transparent || m.alphaTest > 0 || m.alphaHash || o.customDepthMaterial || o.customDistanceMaterial) return false;
  if (m.userData?.wind || m.userData?.foliage || m.userData?.billboard) return false;
  const g = o.geometry;
  return !!(g && g.attributes.position && g.attributes.position.count && (!g.morphAttributes || !g.morphAttributes.position));
}

// root: a built static group (already positioned). Returns { group, sources, cells, tris } and adds group to root.
export function buildShadowProxies(root, { cell = 48, exclude = null, dynamic = null, minSize = 0.25, freeArrays = false } = {}) {
  const dyn = dynamic ? new Set(dynamic) : null;
  root.updateWorldMatrix(true, true);
  _inv.copy(root.matrixWorld).invert();
  const buckets = new Map(); // `${cx},${cz},${side}` -> { side, parts: [{ geo, m }], verts, idx }
  const sources = [];
  const walk = (o) => {
    if (o.visible === false || o.isGlowField) return;
    if (o !== root && (isDynamic(o) || (dyn && dyn.has(o)) || (exclude && exclude(o)) || o.userData.shadowProxy)) return;
    if (eligible(o)) {
      const g = o.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      _box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
      const size = _box.getSize(_v);
      if (Math.max(size.x, size.y, size.z) >= minSize) {
        _box.getCenter(_v);
        const side = o.material.side, k = `${Math.floor(_v.x / cell)},${Math.floor(_v.z / cell)},${side}`;
        let b = buckets.get(k);
        if (!b) buckets.set(k, (b = { side, parts: [], verts: 0, idx: 0 }));
        const n = g.attributes.position.count;
        b.parts.push({ geo: g, m: new THREE.Matrix4().multiplyMatrices(_inv, o.matrixWorld) });
        b.verts += n; b.idx += g.index ? g.index.count : n;
        sources.push(o);
      }
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  const group = new THREE.Group();
  group.name = 'shadowProxies';
  group.userData.shadowProxy = true;
  const mats = new Map();
  let tris = 0;
  for (const b of buckets.values()) {
    const pos = new Float32Array(b.verts * 3);
    const big = b.verts > 65535;
    const index = big ? new Uint32Array(b.idx) : new Uint16Array(b.idx);
    let v0 = 0, i0 = 0;
    for (const { geo, m } of b.parts) {
      const P = geo.attributes.position, n = P.count;
      for (let i = 0; i < n; i++) { _v.fromBufferAttribute(P, i).applyMatrix4(m); pos[(v0 + i) * 3] = _v.x; pos[(v0 + i) * 3 + 1] = _v.y; pos[(v0 + i) * 3 + 2] = _v.z; }
      // a mirrored placement flips the winding: keep front faces front
      const flip = m.determinant() < 0;
      if (geo.index) {
        const I = geo.index;
        for (let i = 0; i < I.count; i += 3) { const a = I.getX(i), c1 = I.getX(i + 1), c2 = I.getX(i + 2); index[i0++] = v0 + a; index[i0++] = v0 + (flip ? c2 : c1); index[i0++] = v0 + (flip ? c1 : c2); }
      } else for (let i = 0; i < n; i += 3) { index[i0++] = v0 + i; index[i0++] = v0 + (flip ? i + 2 : i + 1); index[i0++] = v0 + (flip ? i + 1 : i + 2); }
      v0 += n;
    }
    const geo = new THREE.BufferGeometry();
    let mat = mats.get(b.side);
    if (!mat) mats.set(b.side, (mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: b.side })));
    const mesh = new THREE.Mesh(geo, mat);
    geo.setAttribute('position', packProxyPositions(pos, mesh));
    geo.setIndex(new THREE.BufferAttribute(i0 === index.length ? index : index.slice(0, i0), 1));
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    if (freeArrays) for (const a of [geo.attributes.position, geo.index]) a.onUpload(function () { this.array = null; });
    tris += i0 / 3;
    mesh.castShadow = true; mesh.receiveShadow = false;
    mesh.layers.set(SHADOW_LAYER);
    mesh.matrixAutoUpdate = false;
    mesh.userData.shadowProxy = true;
    group.add(mesh);
  }
  group.matrixAutoUpdate = false;
  root.add(group);
  group.updateMatrixWorld(true);
  return { group, sources, cells: group.children.length, tris, active: false };
}

// on: the proxies cast and their sources do not (their own castShadow comes back when off). Needs the shadow camera
// to see SHADOW_LAYER (renderer), or the static world casts no shadow at all.
export function useShadowProxies(P, on) {
  if (!P || P.active === on) return;
  P.active = on;
  for (const o of P.sources) {
    if (on) { if (o.castShadow) { o.castShadow = false; o.userData.proxyCast = true; } }
    else if (o.userData.proxyCast) { o.castShadow = true; o.userData.proxyCast = false; }
  }
}
