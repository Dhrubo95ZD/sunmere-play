// v114 merged characters (phone performance): a character whose look never changes after it is built (townsfolk, NPCs,
// humanoid raiders) is drawn as ONE skinned mesh instead of one per material kind (cloth, leather, metal, glow, dark,
// trim and the class parts: 4-7 draws a character) plus one per held or worn piece (weapons, shields, tools), and as many
// again in the shadow pass.
// How it keeps the look: the merged geometry carries a per-vertex `ck` (which source material the vertex came from) and
// one "uber" MeshStandardMaterial reads every source material's own values per vertex from small uniform tables: colour,
// diffuse map and normal map (each with its own texture transform; the one picked is read with textureGrad and the
// derivatives taken outside the branch, so mip selection is as before), normal scale, roughness, metalness, emissive (the
// glow parts' vertex-colour glow, the trims' trimGlow, and the hit flash on exactly the kinds the per-kind materials
// flashed). The satin `dull` attribute and the world patch (cloud shadows) apply as on the character materials.
// Double-sided cloth is emulated exactly: its triangles are appended again, winding reversed, with `ck` + BACK, which the
// fragment shader turns into faceDirection = -1 (the same normal, tangent frame and shadow normal offset three uses for a
// back face); the shadow pass draws both windings as it drew the double-sided original. The back copies sit at the end
// of the geometry, so the target outline (targetfx.js) draws the front part only (geometry.userData.hullGeo).
// Held pieces (a mesh under a bone) are baked onto their bone at the rest pose and skinned to it with weight 1, which is
// where three's own bone-parented mesh would draw them. A piece that does not fit (another material, a line, the bow's
// string, its own shadow setting, too many textures) stays a separate mesh. Anything unexpected about the body leaves the
// character exactly as built. tools/shots/v114 holds the pixel A/B of merged vs per-kind characters.
import * as THREE from 'three';
import { patchWorld } from '../engine/materials.js';
import { metalDull } from './rig.js';
import { IS_MOBILE } from '../engine/platform.js';
import { quantizeGeometry } from '../engine/slim.js';
import { QUALITY as GFX } from '../engine/globals.js';

// on for every preset (the merged look is pixel-identical); QUALITY.mergeChars === false or ?merge=0 turn it off
export function mergeOn() {
  if (/[?&]merge=0/.test(globalThis.location?.search || '')) return false;
  return GFX.mergeChars !== false;
}

const MAXK = 16, BACK = 32, MAXMAP = 6, MAXNRM = 4;
const ATTRS = ['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'];
const OK_KEYS = new Set(['smc', 'smcdull', 'smccharglow', 'smctrimglow']);
const GEO = new Map(); // look key -> merged geometry (characters of one look are built the same: rig.js SHARED)
const MATS = new Map(); // signature -> shared uber material (share: true)
export const MERGE_STATS = { merged: 0, skipped: 0, draws: 0, pieces: 0, players: 0 };

// the per-kind table of one source material (null: not mergeable). T: the texture lists ({ maps, nmaps }), grown here
function kindOf(key, m, T) {
  if (!m || Array.isArray(m) || !m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.transparent || m.opacity !== 1 || m.alphaTest || m.wireframe || m.flatShading || m.visible === false) return null;
  if (m.aoMap || m.emissiveMap || m.roughnessMap || m.metalnessMap || m.alphaMap || m.lightMap || m.bumpMap || m.displacementMap || m.envMap) return null;
  if (m.side === THREE.BackSide || m.normalMapType !== THREE.TangentSpaceNormalMap || m.blending !== THREE.NormalBlending || !m.depthTest || !m.depthWrite || !m.colorWrite || m.polygonOffset || m.clippingPlanes) return null;
  if (m.map && m.map.channel !== 0) return null;
  if (m.normalMap && m.normalMap.channel !== 0) return null;
  const ck = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  if (!OK_KEYS.has(ck) || m.defines?.SM_FADE !== undefined || m.defines?.SM_CUT !== undefined) return null;
  const mi = m.map ? T.maps.indexOf(m.map) : -1, ni = m.normalMap ? T.nmaps.indexOf(m.normalMap) : -1;
  if (m.map && mi < 0 && T.maps.length >= MAXMAP) return null;
  if (m.normalMap && ni < 0 && T.nmaps.length >= MAXNRM) return null;
  return {
    key, col: m.color.clone(), vc: !!m.vertexColors,
    map: m.map ? (mi >= 0 ? mi : T.maps.push(m.map) - 1) : -1,
    nrm: m.normalMap ? (ni >= 0 ? ni : T.nmaps.push(m.normalMap) - 1) : -1, ns: m.normalScale.clone(),
    rough: m.roughness, metal: m.metalness,
    emis: m.emissive.clone().multiplyScalar(m.emissiveIntensity), flash: key !== 'glow' && key !== 'dark' && key !== 'piece' ? 1 : 0,
    ve: ck === 'smccharglow' ? 2.2 : 0, trim: ck === 'smctrimglow' ? 1 : 0, trimV: m.userData.trimGlow?.value ?? 0,
    dbl: m.side === THREE.DoubleSide,
  };
}

const texMat = (t) => { if (t.matrixAutoUpdate) t.updateMatrix(); return t.matrix.clone(); };

function uberMaterial(K, maps, nmaps) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  patchWorld(m, { cloud: true });
  metalDull(m); // (dull is 0 on every vertex but the metal's: mix(x, ., 0) leaves the others as they were)
  const pad = (f, d) => Array.from({ length: MAXK }, (_, i) => (K[i] ? f(K[i]) : d));
  const U = {
    uKCol: { value: pad((k) => new THREE.Vector3(k.col.r, k.col.g, k.col.b), new THREE.Vector3(1, 1, 1)) },
    uKMap: { value: pad((k) => k.map, -1) }, uKNrm: { value: pad((k) => k.nrm, -1) },
    uKNs: { value: pad((k) => k.ns.clone(), new THREE.Vector2(1, 1)) },
    uKRough: { value: pad((k) => k.rough, 1) }, uKMetal: { value: pad((k) => k.metal, 0) },
    uKEmis: { value: pad((k) => new THREE.Vector3(k.emis.r, k.emis.g, k.emis.b), new THREE.Vector3()) },
    uKFlash: { value: pad((k) => k.flash, 0) }, uKVE: { value: pad((k) => k.ve, 0) }, uKTrim: { value: pad((k) => k.trim, 0) },
    uMT: { value: Array.from({ length: MAXMAP }, (_, i) => (maps[i] ? texMat(maps[i]) : new THREE.Matrix3())) },
    uNT: { value: Array.from({ length: MAXNRM }, (_, i) => (nmaps[i] ? texMat(nmaps[i]) : new THREE.Matrix3())) },
  };
  for (let i = 0; i < MAXMAP; i++) U['uMap' + i] = { value: maps[i] || maps[0] || null };
  for (let i = 0; i < MAXNRM; i++) U['uNrm' + i] = { value: nmaps[i] || nmaps[0] || null };
  const trimK = K.find((k) => k.trim);
  m.userData.trimGlow = U.uTrimGlow = { value: trimK ? trimK.trimV : 0 };
  m.userData.uber = U;
  const nm = maps.length, nn = nmaps.length, N = MAXK;
  const pick = (n, name, sel, call) => { let s = ''; for (let i = 0; i < n; i++) s += `${i ? 'else ' : ''}if (${sel} < ${i}.5) ${call(name + i, i)}\n`; return s; };
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base?.(sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float ck;\nvarying float vCk;\nvarying vec2 vUberUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCk = ck; vUberUv = uv;');
    let samplers = '';
    for (let i = 0; i < nm; i++) samplers += `uniform sampler2D uMap${i}; `;
    for (let i = 0; i < nn; i++) samplers += `uniform sampler2D uNrm${i}; `;
    sh.fragmentShader = '#define DOUBLE_SIDED\n' + sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vCk; varying vec2 vUberUv;
${samplers}
uniform mat3 uMT[${MAXMAP}]; uniform mat3 uNT[${MAXNRM}];
uniform vec3 uKCol[${N}]; uniform float uKMap[${N}]; uniform float uKNrm[${N}]; uniform vec2 uKNs[${N}];
uniform float uKRough[${N}]; uniform float uKMetal[${N}]; uniform vec3 uKEmis[${N}];
uniform float uKFlash[${N}]; uniform float uKVE[${N}]; uniform float uKTrim[${N}]; uniform float uTrimGlow;
float uberFace; int uberK; vec2 uberGx; vec2 uberGy; vec3 uberQ0; vec3 uberQ1;
vec4 uberTex(sampler2D s, mat3 M) { return textureGrad(s, (M * vec3(vUberUv, 1.0)).xy, (M * vec3(uberGx, 0.0)).xy, (M * vec3(uberGy, 0.0)).xy); }`)
      .replace('void main() {', `void main() {
  { float kf = floor(vCk + 0.5); uberFace = kf > ${BACK - 0.5} ? -1.0 : 1.0; uberK = int(kf > ${BACK - 0.5} ? kf - ${BACK}.0 : kf); }
  uberGx = dFdx(vUberUv); uberGy = dFdy(vUberUv); uberQ0 = dFdx(-vViewPosition); uberQ1 = dFdy(-vViewPosition);`)
      .replace('#include <map_fragment>', `{
  float ms = uKMap[uberK];
  diffuseColor.rgb *= uKCol[uberK];
  if (ms > -0.5) {
    vec4 sd = vec4(1.0);
${pick(nm, 'uMap', 'ms', (s, i) => `sd = uberTex(${s}, uMT[${i}]);`)}
    diffuseColor *= sd;
  }
}`)
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = uberFace;'))
      .replace('#include <normal_fragment_maps>', !nn ? '' : `{
  float ns = uKNrm[uberK];
  if (ns > -0.5) {
    // three's getTangentFrame (normalmap_pars_fragment) on the picked map's own uv, flipped for a back face as it does
    mat3 Mn = uNT[0]; vec4 tn = vec4(0.5, 0.5, 1.0, 1.0);
${pick(nn, 'uNrm', 'ns', (s, i) => `{ Mn = uNT[${i}]; tn = uberTex(${s}, Mn); }`)}
    vec2 st0 = (Mn * vec3(uberGx, 0.0)).xy, st1 = (Mn * vec3(uberGy, 0.0)).xy;
    vec3 N = normal, q1perp = cross(uberQ1, N), q0perp = cross(N, uberQ0);
    vec3 T = q1perp * st0.x + q0perp * st1.x, B = q1perp * st0.y + q0perp * st1.y;
    float det = max(dot(T, T), dot(B, B)), sc = (det == 0.0) ? 0.0 : inversesqrt(det);
    mat3 tb = mat3(T * sc * faceDirection, B * sc * faceDirection, N);
    vec3 mapN = tn.xyz * 2.0 - 1.0; mapN.xy *= uKNs[uberK];
    normal = normalize(tb * mapN);
  }
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = uKRough[uberK];')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = uKMetal[uberK];')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance = emissive * uKFlash[uberK] + uKEmis[uberK];
if (uKVE[uberK] > 0.0) totalEmissiveRadiance *= vColor.rgb * uKVE[uberK];
totalEmissiveRadiance += vColor.rgb * uTrimGlow * uKTrim[uberK];`);
  };
  const ck = m.customProgramCacheKey;
  m.customProgramCacheKey = () => ck() + 'uber' + nm + '.' + nn;
  return m;
}

// parts: { geo, id, k, xf? (Matrix4: a held piece's rest transform into the body's bind space), bone? (its bone index) }
function mergeGeometry(parts, quant = true) {
  const size = { position: 3, normal: 3, uv: 2, color: 3, skinIndex: 4, skinWeight: 4 };
  let nF = 0, nB = 0;
  for (const p of parts) { const c = p.geo.attributes.position.count; nF += c; if (p.k.dbl) nB += c; }
  const n = nF + nB;
  const out = { position: new Float32Array(n * 3), normal: new Float32Array(n * 3), uv: new Float32Array(n * 2), color: new Float32Array(n * 3), skinIndex: new Float32Array(n * 4), skinWeight: new Float32Array(n * 4), dull: new Float32Array(n), ck: new Float32Array(n) };
  const v3 = new THREE.Vector3(), nmx = new THREE.Matrix3();
  const write = (p, back, o) => {
    const { geo, id, k, xf } = p, A = geo.attributes, c = A.position.count, D = A.dull;
    if (xf) nmx.getNormalMatrix(xf);
    // a mirrored piece (negative scale) turns its triangles over: wind it back so front faces stay front
    const flip = (xf ? xf.determinant() < 0 : false) !== back;
    for (let v = 0; v < c; v++) {
      const s = flip && v % 3 ? (v % 3 === 1 ? v + 1 : v - 1) : v, d = o + v;
      v3.fromBufferAttribute(A.position, s); if (xf) v3.applyMatrix4(xf); out.position.set([v3.x, v3.y, v3.z], d * 3);
      v3.fromBufferAttribute(A.normal, s); if (xf) v3.applyMatrix3(nmx).normalize(); out.normal.set([v3.x, v3.y, v3.z], d * 3);
      if (A.uv) out.uv.set([A.uv.getX(s), A.uv.getY(s)], d * 2);
      if (k.vc && A.color) out.color.set([A.color.getX(s), A.color.getY(s), A.color.getZ(s)], d * 3); else out.color.set([1, 1, 1], d * 3);
      if (xf) { out.skinIndex[d * 4] = p.bone; out.skinWeight[d * 4] = 1; }
      else for (let j = 0; j < 4; j++) { out.skinIndex[d * 4 + j] = A.skinIndex.getComponent(s, j); out.skinWeight[d * 4 + j] = A.skinWeight.getComponent(s, j); }
      out.dull[d] = D ? D.getX(s) : 0;
      out.ck[d] = id + (back ? BACK : 0);
    }
    return o + c;
  };
  let o = 0;
  for (const p of parts) o = write(p, false, o);
  for (const p of parts) if (p.k.dbl) o = write(p, true, o);
  const g = new THREE.BufferGeometry();
  for (const [nm, arr] of Object.entries(out)) g.setAttribute(nm, new THREE.BufferAttribute(arr, nm === 'ck' || nm === 'dull' ? 1 : size[nm]));
  g.computeBoundingSphere();
  if (IS_MOBILE && quant) quantizeGeometry(g); // as rig.js does for the per-kind meshes (8-bit normals, colours, skin weights)
  // (not for a player's: its worn gear and cloak meshes are full precision, and a player's own mesh is not shared)
  g.userData.shared = true; // kept for the next character of this look (rig.js disposeCharGeometry leaves it)
  // the front part alone (the target outline and rim, targetfx.js)
  const h = new THREE.BufferGeometry();
  for (const [nm, a] of Object.entries(g.attributes)) h.setAttribute(nm, a);
  h.setDrawRange(0, nF); h.boundingSphere = g.boundingSphere.clone(); h.userData.shared = true;
  g.userData.hullGeo = h;
  return g;
}

// the held pieces under the bones that can join the merged mesh: [{ mesh, bone index }]
function heldPieces(root, skel, cast) {
  const out = [], bowRoot = root.userData.bow;
  const boneIdx = new Map(skel.bones.map((b, i) => [b, i]));
  const visit = (o, bone, ok) => {
    if (o.userData?.string || o === bowRoot || o.isLine || o.isPoints || o.isSprite) ok = false;
    if (o.visible === false) ok = false;
    const b = o.isBone ? o : bone;
    if (ok && b && o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && !o.isBatchedMesh && !o.children.length && o.castShadow === cast.on && !!o.userData.csOff === cast.off && o.receiveShadow
      && o.renderOrder === 0 && !o.morphTargetInfluences && !o.customDepthMaterial && !o.customDistanceMaterial && o.onBeforeRender === THREE.Object3D.prototype.onBeforeRender
      && o.geometry?.attributes?.position && o.geometry.attributes.normal && !o.geometry.groups.length && !o.geometry.morphAttributes?.position) {
      const A = o.geometry.attributes;
      if (Object.keys(A).every((nm) => ['position', 'normal', 'uv', 'color', 'wind'].includes(nm))) out.push({ mesh: o, bone: boneIdx.get(b) });
    }
    for (const c of o.children) if (!c.isSkinnedMesh) visit(c, b, ok);
  };
  visit(root, null, true);
  return out.filter((p) => p.bone !== undefined);
}

// root: a buildCharacter() result, at its rest pose or animated (the held pieces are baked from the bones' rest pose).
// o.share: one material for every character with the same tables (no per-character hit flash); otherwise the character
// gets its own (entities.js flashes userData.mats). o.shareKey: the look (kind:variant) for sharing the geometry.
// Returns true when merged.
// ---- the light walk (v114): a merged character whose root moved but whose pose did not (the frames a far character is
// not re-posed: 15-30 Hz tiers in entities.js / townsfolk.js) skips three's walk over its ~45 bones. Only the character
// group and the merged mesh follow the root; the merged mesh keeps the bindMatrixInverse of the frame it was posed
// (three's attached bind mode recomputes it only in SkinnedMesh.updateMatrixWorld, which is not called), so
// modelMatrix * bindMatrixInverse = how far the root has moved since, and the stale bone matrices draw the pose there:
// the same picture as the full walk. The skeleton's bone matrices (and their texture upload) are not recomputed either.
// Not used when anything else hangs on the bones (an unmerged piece would be left behind) or the mesh has children (the
// target outline). The owner's charUpdateMatrixWorld calls lightWalk when it set mwLight, and unfreeze otherwise.
const OBJ_UMW = THREE.Object3D.prototype.updateMatrixWorld;
export function lightWalk(ch) {
  const U = ch.userData, m = U.meshes?.merged;
  if (!U.lightOk || !m || m.children.length || !ch.parent) return false;
  ch.updateMatrix();
  ch.matrixWorld.multiplyMatrices(ch.parent.matrixWorld, ch.matrix);
  for (const c of ch.children) {
    if (c.isBone) continue;
    if (c === m) { if (m.matrixAutoUpdate) m.updateMatrix(); m.matrixWorld.multiplyMatrices(ch.matrixWorld, m.matrix); }
    else OBJ_UMW.call(c, true);
  }
  U.skeleton.frozen = true;
  return true;
}
export function unfreeze(ch) { const s = ch.userData.skeleton; if (s && s.frozen) s.frozen = false; }
// nothing but bones and plain groups under the bones (a held piece that stayed a mesh would be left behind)
function lightOk(root) {
  let ok = true;
  const b = root.userData.bones?.root;
  b?.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints || o.isSprite) ok = false; });
  return !!b && ok;
}

export function mergeCharacter(root, o = {}) {
  const U = root.userData, meshes = U.meshes, skel = U.skeleton;
  const skip = () => { MERGE_STATS.skipped++; return false; };
  if (!meshes || !skel || U.merged || U.kind === 'deadeye' || U.dsList) return skip();
  // (v115 players, o.keep: not with the Dragonslayer armour model or a Tripo body on, which come and go on their own)
  if (o.keep && (U.dsa?.mesh || U.heatBody || U.holstered?.on)) return skip();
  // (a player's target outline, targetfx.js, hangs on its meshes: dropped here, built again on the new ones: mergeGen)
  if (o.keep) { const hulls = []; root.traverse((x) => { if (x.userData.isHull) hulls.push(x); }); if (hulls.length) { for (const h of hulls) h.parent.remove(h); U.mergeGen = (U.mergeGen || 0) + 1; } }
  const list = Object.entries(meshes).filter(([, m]) => m.visible !== false);
  if (!list.length) return skip();
  const first = list[0][1];
  const T = { maps: [], nmaps: [] }, K = [], parts = [];
  const matId = new Map(), keyOf = new Map(Object.entries(U.mats || {}).map(([k, m]) => [m, k]));
  for (const [, m] of list) {
    if (!m.isSkinnedMesh || m.skeleton !== skel || m.parent !== root || !m.bindMatrix.equals(first.bindMatrix) || m.bindMode !== first.bindMode || m.geometry.index || m.geometry.groups.length) return skip();
    if (m.castShadow !== first.castShadow || m.receiveShadow !== first.receiveShadow || !!m.userData.csOff !== !!first.userData.csOff) return skip();
    const A = m.geometry.attributes;
    for (const nm of Object.keys(A)) if (!ATTRS.includes(nm) && nm !== 'dull') return skip();
    if (!ATTRS.every((nm) => A[nm])) return skip();
    let id = matId.get(m.material);
    if (id === undefined) {
      if (K.length >= MAXK) return skip();
      const k = kindOf(keyOf.get(m.material) || '', m.material, T);
      if (!k) return skip();
      id = K.push(k) - 1; matId.set(m.material, id);
    }
    parts.push({ geo: m.geometry, id, k: K[id] });
  }
  // v115 players (o.keep): the worn gear's and cloak's own skinned meshes join too when they fit (else they stay apart)
  const extra = [];
  if (o.keep) for (const m of [...(U.gearMeshes || []), ...(U.capeMeshes || [])]) {
    if (m.visible === false || m.parent !== root) continue;
    let fits = m.isSkinnedMesh && m.skeleton === skel && m.bindMatrix.equals(first.bindMatrix) && m.bindMode === first.bindMode && !m.geometry.index && !m.geometry.groups.length
      && m.castShadow === first.castShadow && m.receiveShadow === first.receiveShadow && !!m.userData.csOff === !!first.userData.csOff && !m.children.length;
    const A = m.geometry.attributes;
    if (fits) for (const nm of Object.keys(A)) if (!ATTRS.includes(nm) && nm !== 'dull') fits = false;
    if (fits && !ATTRS.every((nm) => A[nm])) fits = false;
    if (!fits) { extra.push(null); continue; }
    let id = matId.get(m.material);
    if (id === undefined) {
      if (K.length >= MAXK) { extra.push(null); continue; }
      const k = kindOf(keyOf.get(m.material) || 'piece', m.material, T); // (materials outside U.mats never flashed: 'piece')
      if (!k) { extra.push(null); continue; }
      id = K.push(k) - 1; matId.set(m.material, id);
    }
    parts.push({ geo: m.geometry, id, k: K[id] });
    list.push(['x' + extra.length, m]); extra.push(m);
  }
  // held pieces: baked to the bone's rest pose. bindInv * restBoneWorld * (boneWorld^-1 * pieceWorld) takes the piece's
  // vertices into the body's bind space; skinned to that bone alone, three then draws them where the bone carries them.
  root.updateWorldMatrix(true, true);
  const held = [], bindInv = first.bindMatrix.clone().invert(), m4 = new THREE.Matrix4(), rest = new THREE.Matrix4();
  for (const { mesh, bone } of heldPieces(root, skel, { on: first.castShadow, off: !!first.userData.csOff })) {
    let id = matId.get(mesh.material);
    if (id === undefined) {
      if (K.length >= MAXK) continue;
      const k = kindOf('piece', mesh.material, T);
      if (!k) continue;
      id = K.push(k) - 1; matId.set(mesh.material, id);
    }
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    if (K[id].map >= 0 && !g.attributes.uv) continue;
    rest.copy(skel.boneInverses[bone]).invert();
    m4.copy(skel.bones[bone].matrixWorld).invert().multiply(mesh.matrixWorld);
    const xf = bindInv.clone().multiply(rest).multiply(m4);
    held.push({ mesh, part: { geo: g, id, k: K[id], xf, bone } });
  }
  if (list.length + held.length < 2) return skip();
  const pieceSig = held.map((h) => h.mesh.geometry.uuid + '@' + h.part.bone + ':' + h.part.xf.elements.map((x) => x.toFixed(5)).join(',')).join(';');
  const gk = o.shareKey && !o.keep ? o.shareKey + '|' + parts.map((p) => p.id + ':' + p.geo.attributes.position.count).join(',') + '|' + pieceSig : null;
  let geo = gk && GEO.get(gk);
  if (!geo) {
    geo = mergeGeometry(parts.concat(held.map((h) => h.part)), !o.keep); if (gk) GEO.set(gk, geo);
    if (o.keep) { geo.userData.shared = false; geo.userData.hullGeo.userData.shared = false; } // (its own: freed on unmerge)
  }
  let mat;
  if (o.share) {
    const sig = JSON.stringify(K.map((k) => ({ ...k, key: k.key === 'glow' || k.key === 'dark' || k.key === 'piece' ? k.key : '' })))
      + T.maps.map((t) => t.uuid + texMat(t).elements.join()).join() + '|' + T.nmaps.map((t) => t.uuid + texMat(t).elements.join()).join();
    mat = MATS.get(sig);
    if (!mat) MATS.set(sig, (mat = uberMaterial(K, T.maps, T.nmaps)));
  } else mat = uberMaterial(K, T.maps, T.nmaps);
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
  if (first.userData.csOff) mesh.userData.csOff = true; // (shadows switched off by distance: entities / townsfolk turn them back on)
  mesh.frustumCulled = first.frustumCulled;
  mesh.boundingSphere = first.boundingSphere.clone();
  mesh.bindMode = first.bindMode;
  mesh.bind(skel, first.bindMatrix);
  mesh.name = 'charMerged';
  // o.keep (players): everything taken out is remembered where it was, so unmergeCharacter puts it back exactly
  const K0 = o.keep ? { meshes, mats: U.mats, kids: root.children.slice(), out: [], mesh, extraLeft: extra.some((x) => !x) } : null;
  const take = (x) => { const p = x.parent; if (K0) K0.out.push([x, p, p.children.indexOf(x)]); p.remove(x); };
  for (const [, m] of list) { take(m); if (!K0 && m.geometry.userData?.sharedAttrs && !m.geometry.userData.shared) for (const nm of m.geometry.userData.sharedAttrs) m.geometry.deleteAttribute(nm); }
  // the pieces leave their bones (an emptied builder group goes too)
  for (const { mesh: pm } of held) {
    let p = pm.parent; take(pm);
    while (p && !p.isBone && p !== root && !p.children.length && p.parent) { const q = p.parent; take(p); p = q; }
  }
  root.add(mesh);
  // what the rest of the game reads: the meshes (Animator.initChains: which cloth chains carry weight), the materials
  // (the hit flash, fx fadeSelf); the per-kind materials are dropped (kept for a player: unmerge brings them back)
  if (!K0) for (const m of new Set(list.map(([, x]) => x.material))) m.dispose();
  U.meshes = { merged: mesh };
  U.mats = { merged: mat };
  U.merged = true;
  U.unmerge = K0;
  U.mergeGen = (U.mergeGen || 0) + 1; // (targetfx.js rebuilds a target's outline on the new meshes)
  U.lightOk = lightOk(root) && !(K0 && K0.extraLeft);
  if (!skel.__light) { skel.__light = true; const up = skel.update; skel.update = function () { if (this.frozen) return; up.call(this); }; }
  MERGE_STATS.merged++; MERGE_STATS.draws += list.length + held.length - 1; MERGE_STATS.pieces += held.length;
  if (K0) MERGE_STATS.players++;
  return true;
}

// ---- v115 players: merged as the townsfolk are, and taken apart again whenever their look changes (characters.js
// setCharWeapon / setCharOffhand / setCharArmor / setCharCape / setCharGear, dsArmour.js dsaSync, entities.js mounting
// and stowing: lookChange() first, then their change on the per-kind meshes exactly as before), merged again once the
// look has settled (playerMergeTick, from EntityView.update). Not merged: the Deadeye (holstered pistol copies, the
// Tripo body), the Dragonslayer armour model, heated or Prismatic gear (their materials animate), a character mid-fade
// or mid-flash (tried again later).
export function unmergeCharacter(root) {
  const U = root.userData, K0 = U.unmerge;
  if (!U.merged || !K0) return false;
  const m = K0.mesh, mat = U.mats.merged;
  m.parent?.remove(m);
  // the pieces and per-kind meshes back where they were, in their order (the last taken first)
  for (let i = K0.out.length - 1; i >= 0; i--) {
    const [x, p, at] = K0.out[i];
    p.add(x);
    const k = p.children.indexOf(x);
    if (at >= 0 && at < p.children.length && k !== at) { p.children.splice(k, 1); p.children.splice(at, 0, x); }
  }
  { const order = new Map(K0.kids.map((x, i) => [x, i])); root.children.sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9)); }
  U.meshes = K0.meshes; U.mats = K0.mats;
  // what changed on the merged mesh while it stood in: shadow switched by distance, the hit flash
  for (const [x] of K0.out) x.traverse((y) => { if (!y.isMesh) return; if (m.castShadow) { if (y.userData.csOff) { y.castShadow = true; y.userData.csOff = false; } } else if (y.castShadow) { y.castShadow = false; y.userData.csOff = true; } });
  for (const [k, pm] of Object.entries(U.mats || {})) if (k !== 'glow' && k !== 'dark' && pm.emissive && mat?.emissive) pm.emissive.copy(mat.emissive);
  U.merged = false; U.unmerge = null; U.lightOk = false;
  U.mergeGen = (U.mergeGen || 0) + 1;
  if (U.skeleton) U.skeleton.frozen = false;
  for (const c of m.children.slice()) m.remove(c); // (a target outline: targetfx.js builds it again)
  m.geometry.userData.hullGeo?.dispose(); m.geometry.dispose(); mat?.dispose();
  return true;
}
// a player's look is about to change (call before touching its meshes): back to per-kind meshes, merge again later
export function lookChange(root) {
  const U = root?.userData;
  if (!U) return;
  if (U.merged && U.unmerge) unmergeCharacter(root);
  U.lookV = (U.lookV || 0) + 1;
  U.remergeAt = performance.now() + 350;
}
// EntityView.update for players: merge once the look has settled (busy: a hit flash running)
export function playerMergeTick(root, now, busy) {
  const U = root.userData;
  if (!U.mergePlayer || U.merged || busy || now < (U.remergeAt || 0) || !mergeOn()) return false;
  if (mergeCharacter(root, { keep: true })) return true;
  U.remergeAt = now + 4000; // (could not: a fade or a look that does not fit; tried again now and then)
  return false;
}
