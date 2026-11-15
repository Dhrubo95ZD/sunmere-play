// Phone memory diet (IS_MOBILE only; the desktop never calls this).
// The valley is ~20 million vertices of static geometry. Kept as float arrays it costs ~1.2 GB of JavaScript memory and
// the same again on the GPU, which on a phone (one shared memory pool, a WebView process the system kills first) is
// enough to get the app killed. Two savings, both invisible on screen:
//   1. quantize: normals to 8-bit, vertex colours (when they stay within 0..1) to 8-bit, wind amplitudes to 16-bit,
//      texture coordinates (when they stay within -2..2) to half floats, skin indices to 8/16-bit integers and skin weights to 8-bit. The shaders read the
//      same values (normalized attributes arrive as floats), at a quarter or half the size, in JS and on the GPU.
//   2. free: once a static world mesh is on the GPU its JavaScript copy is dropped (three.js onUpload). Only meshes
//      nothing reads back are freed: never the ground (clicks ray-test it; left untouched), the dungeon floors (quantized
//      only), batched
//      or skinned meshes, points, lines, sprites, or anything with a dynamic or interleaved attribute.
import * as THREE from 'three';

const done = new WeakSet();

function scan(a) {
  let min = Infinity, max = -Infinity;
  const A = a.array;
  for (let i = 0; i < A.length; i++) { const v = A[i]; if (v < min) min = v; if (v > max) max = v; }
  return { min, max };
}

// a normalized integer copy of a float attribute (values already within the target range)
function toNorm(a, Type, scale) {
  const src = a.array, out = new Type(src.length);
  const lo = Type === Uint8Array || Type === Uint16Array ? 0 : -scale;
  for (let i = 0; i < src.length; i++) out[i] = Math.round(Math.min(scale, Math.max(lo, src[i] * scale)));
  const b = new THREE.BufferAttribute(out, a.itemSize, true);
  b.name = a.name;
  return b;
}

// a half-float copy (WebGL2 reads it as a float; ~3 significant digits)
function half(a) {
  const src = a.array, bits = new Uint16Array(src.length), toHalf = THREE.DataUtils.toHalfFloat;
  for (let i = 0; i < src.length; i++) bits[i] = toHalf(src[i]);
  const b = new THREE.Float16BufferAttribute(bits, a.itemSize); // takes the half-float bit patterns as they are
  b.name = a.name;
  return b;
}

function quantizeAttr(name, a) {
  if (!a || a.isInterleavedBufferAttribute || !(a.array instanceof Float32Array) || a.usage !== THREE.StaticDrawUsage) return null;
  if (name === 'normal' && a.itemSize === 3) return toNorm(a, Int8Array, 127);
  if (name === 'color') { const r = scan(a); return r.min >= 0 && r.max <= 1 ? toNorm(a, Uint8Array, 255) : null; }
  if (name === 'wind') { const r = scan(a); return r.min >= -1 && r.max <= 1 ? toNorm(a, Int16Array, 32767) : half(a); }
  if (name === 'uv') { const r = scan(a); return r.min >= -2 && r.max <= 2 ? half(a) : null; } // 1/1000 steps: under a texel
  if (name === 'skinWeight') { const r = scan(a); return r.min >= 0 && r.max <= 1 ? toNorm(a, Uint8Array, 255) : null; }
  if (name === 'skinIndex') {
    const r = scan(a);
    if (r.min < 0 || r.max > 65535) return null;
    const out = new (r.max < 256 ? Uint8Array : Uint16Array)(a.array.length);
    for (let i = 0; i < out.length; i++) out[i] = a.array[i];
    return new THREE.BufferAttribute(out, a.itemSize, false); // read as float bone numbers, as three.js expects
  }
  return null;
}

// shrink a geometry's attributes in place; call before it is first drawn (a replaced attribute is a new GPU buffer)
export function quantizeGeometry(g) {
  if (!g || done.has(g)) return g;
  done.add(g);
  for (const name of Object.keys(g.attributes)) {
    const q = quantizeAttr(name, g.attributes[name]);
    if (q) g.setAttribute(name, q);
  }
  return g;
}

export function freeAfterUpload(a) {
  if (!a || a.isInterleavedBufferAttribute || !a.array) return;
  a.onUpload(function () { this.array = null; });
}
// every attribute and the index of g (bounds computed first, so culling and box tests keep working)
export function freeGeometryAfterUpload(g) {
  if (!g || !g.attributes.position?.array) return g;
  if (!g.boundingBox) g.computeBoundingBox();
  if (!g.boundingSphere) g.computeBoundingSphere();
  for (const a of Object.values(g.attributes)) freeAfterUpload(a);
  if (g.index) freeAfterUpload(g.index);
  return g;
}

// the kit gives every vertex a vec4 'wind' amplitude, but only wind-swayed and billboard materials (and their wind depth
// materials) read it: on any other material the shader never binds it, so it is pure weight (16 bytes a vertex, 8 once
// quantized). Dropped for geometries none of whose meshes can read it.
const readsWind = (o) => {
  if (o.customDepthMaterial || o.customDistanceMaterial) return true;
  for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!m || m.userData?.wind || m.userData?.billboard || m.isShaderMaterial) return true;
  return false;
};

// slim every static mesh under root (call before root is first rendered).
// skip: roots left exactly as built (the ground). keep: roots quantized but kept readable in JS (ray-tested floors)
export function slimStatic(root, skip = [], keep = []) {
  const keepGeo = new Set(), skipGeo = new Set();
  for (const k of skip) k?.traverse?.((o) => { if (o.geometry) skipGeo.add(o.geometry); });
  for (const k of keep) k?.traverse?.((o) => { if (o.geometry) keepGeo.add(o.geometry); });
  let before = 0, after = 0, freed = 0;
  const t0 = performance.now();
  const size = (g) => Object.values(g.attributes).reduce((s, a) => s + (a.array?.byteLength || 0), 0) + (g.index?.array?.byteLength || 0);
  const seen = new Set(), freedGeo = new Set();
  const windUse = new Map(); // geometry -> some mesh reads its wind attribute
  root.traverse((o) => { const g = o.geometry; if (g?.attributes?.wind && o.isMesh) windUse.set(g, windUse.get(g) || readsWind(o) || o.isBatchedMesh || o.isSkinnedMesh || o.isInstancedMesh); });
  let windFreed = 0;
  for (const [g, used] of windUse) if (!used && !skipGeo.has(g)) { windFreed += g.attributes.wind.array?.byteLength || 0; g.deleteAttribute('wind'); }
  root.traverse((o) => {
    const g = o.geometry;
    if (!g || seen.has(g) || !o.isMesh || skipGeo.has(g)) return;
    seen.add(g);
    if (Object.values(g.attributes).some((a) => a.isInterleavedBufferAttribute || a.usage !== THREE.StaticDrawUsage)) return;
    const b = size(g);
    before += b;
    quantizeGeometry(g);
    after += size(g);
    if (keepGeo.has(g) || o.isBatchedMesh || o.isSkinnedMesh || o.isInstancedMesh || g.morphAttributes && Object.keys(g.morphAttributes).length) return;
    if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingSphere) g.computeBoundingSphere();
    for (const a of Object.values(g.attributes)) freeAfterUpload(a);
    if (g.index) freeAfterUpload(g.index);
    freed += size(g);
    freedGeo.add(g);
  });
  // a freed mesh can no longer be ray-tested, so the camera (camera.js castHit) and the nameplate occlusion ray (which
  // calls castHit) fall back to its world box. For a merged, world-placed group (a whole market street or row of
  // cottages, ~108 x 109 m) that box covers the village and every ray "hits" within a metre or two: the phone camera
  // jammed against the hero and plates hid at random. Such meshes are left out of camera collision (occluders()
  // already skips noCamCollide). Merged clusters a few metres across (plaza planters with their flower beds, stair
  // runs, fence lines) are mostly air too: off-screen against the desktop's per-triangle test, boxes over 6 m across or
  // under 4 m tall jammed the lens ~16x as often as they stopped it where a real wall stood (80 -> 5 false jams over a
  // 4232-ray village grid, +38 rays that pass a real wall). The tall, compact freed meshes left (towers, single
  // houses) keep their box. Every mesh is checked, not just the first user of a shared geometry.
  //
  // Better than a box: before the arrays go, each freed mesh the camera would test (camera.js occluders(): opaque,
  // depth-writing, not a small prop, not flat paving) gets a coarse collision copy (vertex clustering on a 0.4 m grid:
  // walls, roofs and stairs keep their shape, trim and carving collapse) as an invisible child mesh. The camera then
  // ray-tests real triangles on phones too (it sees the copy's position array) and the original is left out
  // (noCamCollide). The wide/low rule above stays only as the fallback for meshes past the copy budget.
  const _b = new THREE.Box3();
  let wide = 0, proxies = 0, proxyTris = 0, proxyBytes = 0;
  const copies = new Map(); // geometry -> collision copy (null: degenerate)
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh || !freedGeo.has(o.geometry) || !o.geometry.boundingBox) return;
    _b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    const sx = _b.max.x - _b.min.x, sy = _b.max.y - _b.min.y, sz = _b.max.z - _b.min.z;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.transparent || m.depthWrite === false) return; // the camera never tests these anyway
    if ((Math.max(sx, sz) < 1.6 && sy < 2.6) || sy < 0.5) return; // small props and flat paving: likewise
    const g = o.geometry;
    let c = copies.get(g);
    if (c === undefined && proxyTris < PROXY_BUDGET) {
      const s = o.matrixWorld.getMaxScaleOnAxis() || 1;
      c = collisionCopy(g, PROXY_CELL / s);
      copies.set(g, c);
      if (c) { proxyTris += c.index.count / 3; proxyBytes += c.attributes.position.array.byteLength + c.index.array.byteLength; }
    }
    if (c) { o.add(camProxy(c, m.side)); o.userData.noCamCollide = true; proxies++; return; }
    if (Math.max(sx, sz) > WIDE_BOX || sy < LOW_BOX) { o.userData.noCamCollide = true; wide++; }
  });
  const MB = (n) => (n / 1048576).toFixed(0) + ' MB';
  console.info(`[mobile] slimmed static geometry ${MB(before)} -> ${MB(after)} (${MB(windFreed)} of unread wind amplitudes dropped first), ${MB(freed)} of it released from JS after upload, ${proxies} camera collision copies (${proxyTris} triangles, ${MB(proxyBytes)}), ${wide} wide or low merged meshes out of camera collision (${(performance.now() - t0).toFixed(0)} ms)`);
  return { freedMeshes: freedGeo.size, wide, proxies, proxyTris, proxyBytes };
}
// widest a freed mesh's world box may be (x or z, metres), and the least it may stand tall, and still stand in as a
// camera collider (only for meshes left without a collision copy)
export const WIDE_BOX = 6, LOW_BOX = 4;
// collision copies: grid cell (metres, world scale) and the most triangles kept across the whole world
export const PROXY_CELL = 0.4, PROXY_BUDGET = 1500000;

// a coarse copy of g's triangles for ray tests: vertices snapped into cells of `cell` (local units) and averaged there;
// triangles that collapse are dropped, and duplicates (the two faces of a thin wall landing on the same cells) merged
function collisionCopy(g, cell) {
  const pos = g.attributes.position;
  const P = pos?.array;
  if (!P || pos.itemSize !== 3 || pos.isInterleavedBufferAttribute || pos.normalized) return null;
  const nv = pos.count, idx = g.index?.array, nt = Math.floor((idx ? idx.length : nv) / 3);
  if (!nt) return null;
  const inv = 1 / cell, O = 32768; // 16 bits a side (+-13 km at 0.4 m): the key stays under 2^48, exact in a double
  const map = new Map(), cellOf = new Int32Array(nv);
  let sum = new Float64Array(3 * 1024), cnt = new Uint32Array(1024), n = 0;
  for (let v = 0; v < nv; v++) {
    const x = P[3 * v], y = P[3 * v + 1], z = P[3 * v + 2];
    const key = ((Math.floor(x * inv) + O) * 65536 + (Math.floor(y * inv) + O)) * 65536 + (Math.floor(z * inv) + O);
    let id = map.get(key);
    if (id === undefined) {
      id = n++;
      map.set(key, id);
      if (n > cnt.length) { const s2 = new Float64Array(sum.length * 2); s2.set(sum); sum = s2; const c2 = new Uint32Array(cnt.length * 2); c2.set(cnt); cnt = c2; }
    }
    cellOf[v] = id; sum[3 * id] += x; sum[3 * id + 1] += y; sum[3 * id + 2] += z; cnt[id]++;
  }
  const tri = new Uint32Array(nt * 3), seen = n < 131072 ? new Set() : null;
  let k = 0;
  for (let t = 0; t < nt; t++) {
    const a = cellOf[idx ? idx[3 * t] : 3 * t], b = cellOf[idx ? idx[3 * t + 1] : 3 * t + 1], c = cellOf[idx ? idx[3 * t + 2] : 3 * t + 2];
    if (a === b || b === c || a === c) continue;
    if (seen) {
      const lo = Math.min(a, b, c), hi = Math.max(a, b, c), mid = a + b + c - lo - hi;
      const key = (lo * 131072 + mid) * 131072 + hi;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    tri[k++] = a; tri[k++] = b; tri[k++] = c;
  }
  if (!k) return null;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) { const q = cnt[i]; out[3 * i] = sum[3 * i] / q; out[3 * i + 1] = sum[3 * i + 1] / q; out[3 * i + 2] = sum[3 * i + 2] / q; }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(out, 3));
  cg.setIndex(new THREE.BufferAttribute(n < 65536 ? new Uint16Array(tri.subarray(0, k)) : tri.slice(0, k), 1));
  cg.computeBoundingBox();
  cg.computeBoundingSphere();
  return cg;
}

// phones: the dungeon floors are only ray-tested for click-to-move (game.js groundPoint), so instead of keeping their full
// vertex arrays in JS (~150 MB for every dungeon) they get coarse pick copies (0.25 m grid: flat floors keep their shape
// to a few centimetres), kept out of the scene, and the drawn floors are slimmed and freed like the rest of the world.
// Call before slimStatic. Returns one group per root, to ray-test in its place.
export function pickCopies(roots) {
  const mat = new THREE.MeshBasicMaterial({ visible: false });
  return roots.filter(Boolean).map((root) => {
    root.updateWorldMatrix(true, true);
    const out = new THREE.Group();
    out.matrixAutoUpdate = false; out.matrixWorldAutoUpdate = false;
    const done = new Map();
    root.traverse((o) => {
      if (!o.isMesh || o.userData?.camProxy || !o.geometry?.attributes?.position?.array) return;
      const s = o.matrixWorld.getMaxScaleOnAxis() || 1;
      let c = done.get(o.geometry);
      if (c === undefined) done.set(o.geometry, (c = collisionCopy(o.geometry, 0.25 / s)));
      if (!c) return;
      const m = new THREE.Mesh(c, mat);
      m.matrixAutoUpdate = false; m.matrixWorldAutoUpdate = false;
      m.matrix.copy(o.matrixWorld); m.matrixWorld.copy(o.matrixWorld);
      out.add(m);
    });
    return out;
  });
}

const PROXY_MAT = new Map(); // side -> an invisible material (never drawn: material.visible is false)
// the copy as a child of the mesh it stands for: same transform, shown and hidden with it, never drawn or shadowed
function camProxy(cg, side = THREE.FrontSide) {
  let mat = PROXY_MAT.get(side);
  if (!mat) PROXY_MAT.set(side, (mat = new THREE.MeshBasicMaterial({ visible: false, side })));
  const p = new THREE.Mesh(cg, mat);
  p.name = 'camProxy';
  p.userData.camProxy = true;
  p.castShadow = p.receiveShadow = false;
  p.frustumCulled = false; // nothing to cull: the renderer drops it on material.visible
  p.matrixAutoUpdate = false;
  Object.defineProperty(p, 'visible', { get() { return !!this.parent?.visible; }, set() {}, configurable: true });
  return p;
}
