// Humanoid skeleton + skinned-mesh builder. Characters face +Z; their left side is +X.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxUV, makeMatrix, rgb, lerp, sstep, clamp } from './kit.js';
import { patchWorld } from '../engine/materials.js';
import { clothTex, metalTex, leatherTex } from '../engine/textures.js';
import { IS_MOBILE } from '../engine/platform.js';
import { quantizeGeometry } from '../engine/slim.js';

// name, parent, offset from parent (rest pose, metres)
export const HUMANOID = [
  ['root', null, [0, 0, 0]],
  ['hips', 'root', [0, 1.0, 0]],
  ['spine', 'hips', [0, 0.12, 0]],
  ['chest', 'spine', [0, 0.2, 0]],
  ['neck', 'chest', [0, 0.25, 0]],
  ['head', 'neck', [0, 0.1, 0]],
  ['clavL', 'chest', [0.075, 0.2, 0]],
  ['armL', 'clavL', [0.175, -0.01, 0]],
  ['foreL', 'armL', [0, -0.29, 0]],
  ['handL', 'foreL', [0, -0.27, 0]],
  ['clavR', 'chest', [-0.075, 0.2, 0]],
  ['armR', 'clavR', [-0.175, -0.01, 0]],
  ['foreR', 'armR', [0, -0.29, 0]],
  ['handR', 'foreR', [0, -0.27, 0]],
  ['thighL', 'hips', [0.11, -0.05, 0]],
  ['shinL', 'thighL', [0, -0.43, 0]],
  ['footL', 'shinL', [0, -0.44, 0]],
  ['thighR', 'hips', [-0.11, -0.05, 0]],
  ['shinR', 'thighR', [0, -0.43, 0]],
  ['footR', 'shinR', [0, -0.44, 0]],
  // cloth chains (driven by spring physics)
  ['cape0', 'chest', [0, 0.17, -0.16]],
  ['cape1', 'cape0', [0, -0.3, -0.02]],
  ['cape2', 'cape1', [0, -0.3, 0]],
  ['cape3', 'cape2', [0, -0.3, 0]],
  ['tabF0', 'hips', [0, -0.02, 0.15]],
  ['tabF1', 'tabF0', [0, -0.26, 0]],
  ['tabF2', 'tabF1', [0, -0.26, 0]],
  ['tabB0', 'hips', [0, -0.02, -0.15]],
  ['tabB1', 'tabB0', [0, -0.26, 0]],
  ['tabB2', 'tabB1', [0, -0.26, 0]],
  ['skirtL0', 'hips', [0.17, -0.02, 0]],
  ['skirtL1', 'skirtL0', [0, -0.3, 0]],
  ['skirtR0', 'hips', [-0.17, -0.02, 0]],
  ['skirtR1', 'skirtR0', [0, -0.3, 0]],
  ['scarf0', 'neck', [0, 0.02, -0.12]],
  ['scarf1', 'scarf0', [0, -0.05, -0.22]],
  ['scarf2', 'scarf1', [0, -0.04, -0.24]],
  ['scarf3', 'scarf2', [0, -0.03, -0.24]],
  ['weaponR', 'handR', [0, -0.06, 0.02]],
  ['weaponL', 'handL', [0, -0.06, 0.02]],
];

export const CHAINS = {
  cape: ['cape0', 'cape1', 'cape2', 'cape3'],
  tabF: ['tabF0', 'tabF1', 'tabF2'],
  tabB: ['tabB0', 'tabB1', 'tabB2'],
  skirtL: ['skirtL0', 'skirtL1'],
  skirtR: ['skirtR0', 'skirtR1'],
  scarf: ['scarf0', 'scarf1', 'scarf2', 'scarf3'],
};

// world-space rest positions of every bone
export function restPositions(def = HUMANOID) {
  const pos = {};
  for (const [name, parent, off] of def) {
    const p = parent ? pos[parent] : [0, 0, 0];
    pos[name] = [p[0] + off[0], p[1] + off[1], p[2] + off[2]];
  }
  return pos;
}

const MATS = {
  cloth: () => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: clothTex().map, normalMap: clothTex().normalMap, roughness: 0.82, side: THREE.DoubleSide });
    m.normalScale.set(0.3, 0.3);
    return m;
  },
  leather: () => new THREE.MeshStandardMaterial({ vertexColors: true, map: leatherTex().map, normalMap: leatherTex().normalMap, roughness: 0.6, metalness: 0.05 }),
  metal: () => new THREE.MeshStandardMaterial({ vertexColors: true, map: metalTex().map, roughness: 0.36, metalness: 0.78, envMapIntensity: 1.1 }),
  glow: () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.55 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 1, metalness: 0 }),
  // quality trim: the vertex colour shows as-is and glows in its own hue by userData.trimGlow.value (see trimGlow())
  trim: () => new THREE.MeshStandardMaterial({ vertexColors: true, map: metalTex().map, roughness: 0.3, metalness: 0.6, envMapIntensity: 1.2 }),
};
// separately toggled meshes that share a base material: the class's own pauldrons (hidden under worn shoulder armour)
// and the class's own cape (hidden under a worn cloak)
export const KIND_BASE = { pmetal: 'metal', pleather: 'leather', pglow: 'glow', pcloth: 'cloth', ccape: 'cloth' };
// emissive from the vertex colour (glow parts, quality trims)
export function vertexEmissive(mat, k = 1, key = 'vcglow') {
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base?.(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb * ${k.toFixed(2)};`);
  };
  const ck = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => (ck ? ck() : '') + key;
  return mat;
}

// adds vColor * userData.trimGlow.value to the emission (independent of the hit-flash emissive colour)
export function trimGlow(mat, v = 0) {
  const u = (mat.userData.trimGlow = { value: v });
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base?.(sh, r);
    sh.uniforms.uTrimGlow = u;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTrimGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * uTrimGlow;');
  };
  const ck = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => (ck ? ck() : '') + 'trimglow';
  return mat;
}

// per-vertex satin finish on metal: attribute 'dull' (0 polished .. 1 matte) raises the roughness and lowers the
// metalness, so a rounded helm never carries a pair of crisp side-by-side highlights that read as eyes
export const HEAD_DULL = 0.55; // every helm is at least this satin (worn mail or cloth on the head: fully matte)
export function metalDull(mat) {
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base?.(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float dull;\nvarying float vDull;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDull = dull;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDull;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.86, vDull);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.12, vDull);');
  };
  const ck = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => (ck ? ck() : '') + 'dull';
  return mat;
}
// a 'dull' attribute for a metal geometry: HEAD_DULL on vertices the head or neck moves most, 0 elsewhere
export function headDullAttr(geo, boneNames) {
  const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, n = geo.attributes.position.count;
  const a = new Float32Array(n);
  if (SI && SW) for (let i = 0; i < n; i++) {
    let bi = SI.getX(i), bw = SW.getX(i);
    if (SW.getY(i) > bw) { bi = SI.getY(i); bw = SW.getY(i); }
    if (SW.getZ(i) > bw) { bi = SI.getZ(i); bw = SW.getZ(i); }
    if (SW.getW(i) > bw) bi = SI.getW(i);
    const nm = boneNames[Math.round(bi)];
    if (nm === 'head' || nm === 'neck') a[i] = HEAD_DULL;
  }
  const at = new THREE.BufferAttribute(a, 1);
  geo.setAttribute('dull', at);
  return at;
}

// one of the character materials (cloth, leather, metal, glow, dark, trim), patched for the world
export function charMat(kind, tweak = null) {
  const mat = MATS[kind]();
  patchWorld(mat, { cloud: true });
  if (kind === 'metal') metalDull(mat);
  // glowing parts and quality trims take their emissive colour from the vertex colour
  if (kind === 'glow') vertexEmissive(mat, 2.2, 'charglow');
  if (kind === 'trim') trimGlow(mat);
  if (tweak) Object.assign(mat, tweak);
  return mat;
}

// Heroic stylised proportions, applied to every part at build time:
//  head parts x1.1 about the head bone; upper arm and forearm parts thicker around the bone axis;
//  a V-taper that widens the chest and shoulders (the waist stays) on everything that rides the torso.
const GIRTH = { armL: 1.1, armR: 1.1, foreL: 1.15, foreR: 1.15 };
const TORSO = new Set(['hips', 'spine', 'chest', 'cape0', 'cape1', 'cape2', 'cape3', 'tabF0', 'tabF1', 'tabF2', 'tabB0', 'tabB1', 'tabB2', 'skirtL0', 'skirtL1', 'skirtR0', 'skirtR1']);
export const VTAPER = { x: 0.13, z: 0.08 };
export function taperK(y) { return sstep(1.17, 1.4, y) * (1 - sstep(1.56, 1.7, y)); }

// shared character geometry (see RigBuilder.build): key -> { [kind]: entry, pieces: [geometry] }
const SHARED = new Map();
const OWN = new Set(['color', 'dull']); // recoloured per character (characters.js setCharGear): never shared
function sharedEntry(geo, count) {
  const attrs = {}, own = {};
  for (const [n, a] of Object.entries(geo.attributes)) { if (OWN.has(n)) own[n] = a.clone(); else attrs[n] = a; } // own: pristine copies
  geo.userData.sharedAttrs = Object.keys(attrs);
  return { count, attrs, own, sphere: geo.boundingSphere?.clone() };
}
function shareGeometry(e) {
  const g = new THREE.BufferGeometry();
  for (const [n, a] of Object.entries(e.attrs)) g.setAttribute(n, a);
  for (const [n, a] of Object.entries(e.own)) g.setAttribute(n, a.clone());
  if (e.sphere) g.boundingSphere = e.sphere.clone();
  g.userData.sharedAttrs = Object.keys(e.attrs);
  return g;
}
// dispose a character geometry without freeing the vertex buffers other characters still draw with
export function disposeCharGeometry(g) {
  if (!g || g.userData?.shared) return;
  const sh = g.userData?.sharedAttrs;
  if (sh) for (const n of sh) g.deleteAttribute(n);
  g.dispose();
}

export class RigBuilder {
  constructor(def = HUMANOID) {
    this.def = def;
    this.rest = restPositions(def);
    this.index = Object.fromEntries(def.map(([n], i) => [n, i]));
    this.parts = { cloth: [], leather: [], metal: [], glow: [], dark: [], trim: [], pmetal: [], pleather: [], pglow: [], pcloth: [], ccape: [] };
    this.headScale = 1.1;
    this.matTweak = {}; // per material kind: property overrides (e.g. a brighter env on dark steel)
    this.attach = []; // separate meshes parented to bones (weapons, shields)
  }

  // Rigid part on one bone. o.p is relative to the bone's rest position.
  add(geoIn, kind, bone, o = {}) {
    const b = this.rest[bone];
    if (!b) throw new Error('bone ' + bone);
    let p = o.p || [0, 0, 0];
    let s = o.s === undefined ? [1, 1, 1] : typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s;
    const hs = bone === 'head' ? this.headScale : 1;
    if (hs !== 1) { p = p.map((v) => v * hs); s = s.map((v) => v * hs); }
    const g = GIRTH[bone] ?? 1;
    const oo = { ...o, s, p: [b[0] + p[0], b[1] + p[1], b[2] + p[2]] };
    if (g !== 1 && o.girth !== false) oo.girth = { g, cx: b[0], cz: b[2] };
    else delete oo.girth;
    return this.addW(geoIn, kind, () => [[bone, 1]], oo);
  }

  // Smooth-skinned part: weights(x,y,z) -> [[bone, w], ...] (model space)
  addW(geoIn, kind, weights, o = {}) {
    let geo = geoIn.index ? geoIn.toNonIndexed() : geoIn.clone();
    geo.clearGroups();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const s = o.s === undefined ? [1, 1, 1] : typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s;
    geo.applyMatrix4(new THREE.Matrix4().makeScale(s[0], s[1], s[2]));
    if (o.uv !== 'keep' || !geo.attributes.uv) boxUV(geo, o.us ?? (kind === 'metal' ? 1.2 : 2.5));
    geo.applyMatrix4(makeMatrix({ ...o, s: 1 }));
    if (o.flat) { geo.deleteAttribute('normal'); geo.computeVertexNormals(); }
    const n = geo.attributes.position.count, P = geo.attributes.position, N = geo.attributes.normal;
    // limb girth: thicken around the bone's vertical axis
    if (o.girth) {
      const { g, cx, cz } = o.girth;
      for (let i = 0; i < n; i++) { P.setX(i, cx + (P.getX(i) - cx) * g); P.setZ(i, cz + (P.getZ(i) - cz) * g); }
      for (let i = 0; i < n; i++) { const nx = N.getX(i) / g, ny = N.getY(i), nz = N.getZ(i) / g, l = Math.hypot(nx, ny, nz) || 1; N.setXYZ(i, nx / l, ny / l, nz / l); }
    }
    const col = new Float32Array(n * 3), si = new Float32Array(n * 4), sw = new Float32Array(n * 4);
    const base = typeof o.c === 'function' ? null : rgb(o.c ?? 0xffffff);
    for (let i = 0; i < n; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ny = N.getY(i);
      const c = base || rgb(o.c(x, y, z, N.getX(i), ny, N.getZ(i)));
      // painted light: top faces brighter, undersides darker; optional vertical AO band
      let k = 1 + ny * (o.paint ?? 0.16);
      if (o.ao) k *= lerp(o.ao[2] ?? 0.6, 1, sstep(o.ao[0], o.ao[1], y));
      col[i * 3] = c[0] * k; col[i * 3 + 1] = c[1] * k; col[i * 3 + 2] = c[2] * k;
      const w = weights(x, y, z).filter(([, ww]) => ww > 0.001).sort((a, b2) => b2[1] - a[1]).slice(0, 4);
      const tot = w.reduce((a, [, ww]) => a + ww, 0) || 1;
      // V-taper on everything that rides the torso
      if (o.taper !== false) {
        let tk = 0;
        for (const [bn, ww] of w) if (TORSO.has(bn)) tk += ww / tot;
        const f = taperK(y) * tk;
        if (f > 0) { P.setX(i, x * (1 + VTAPER.x * f)); P.setZ(i, z * (1 + VTAPER.z * f)); }
      }
      for (let k2 = 0; k2 < 4; k2++) {
        si[i * 4 + k2] = w[k2] ? this.index[w[k2][0]] : 0;
        sw[i * 4 + k2] = w[k2] ? w[k2][1] / tot : 0;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    this.parts[kind].push(geo);
    return geo;
  }

  // weights blending down a bone chain by height (for capes, tabards, skirts)
  chainWeights(chain, parentBone) {
    const ys = chain.map((b) => this.rest[b][1]);
    return (x, y) => {
      const out = [];
      if (y >= ys[0]) return [[parentBone ?? chain[0], 1]];
      for (let i = 0; i < chain.length; i++) {
        const y0 = ys[i], y1 = i + 1 < chain.length ? ys[i + 1] : ys[i] - 0.3;
        if (y <= y0 && y >= y1) {
          const t = (y0 - y) / (y0 - y1);
          out.push([chain[i], 1 - t]);
          if (i + 1 < chain.length) out.push([chain[i + 1], t]); else out[out.length - 1][1] = 1;
          return out;
        }
      }
      return [[chain[chain.length - 1], 1]];
    };
  }

  // separate mesh parented to a bone (weapon, shield). geoBuilder: a kit Builder or Object3D
  attachTo(bone, obj, o = {}) { this.attach.push({ bone, obj, o }); }

  // shareKey (buildCharacter: kind + variant): share vertex arrays with earlier characters built the same way
  build(shareKey = null) {
    const bones = {};
    const list = [];
    for (const [name, parent, off] of this.def) {
      const b = new THREE.Bone();
      b.name = name;
      b.position.set(off[0], off[1], off[2]);
      bones[name] = b;
      list.push(b);
      if (parent) bones[parent].add(b);
    }
    const root = new THREE.Group();
    root.add(bones.root);
    root.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(list);
    const meshes = {};
    const mats = {};
    const makeMat = (kind) => charMat(kind, this.matTweak[kind]);
    // shared geometry (perf F4): characters of one look (kind + variant) are built the same, so after the first one each
    // body mesh takes the first one's vertex arrays (on the GPU too) and only gets its own copy of what is recoloured per
    // character (colour, dull). ~1.3 MB of arrays a townsperson otherwise; a crowded town held ~270 MB of them.
    const share = shareKey ? SHARED.get(shareKey) : null, made = shareKey && !share ? {} : null;
    for (const kind of Object.keys(this.parts)) {
      if (!this.parts[kind].length) continue;
      const bk = KIND_BASE[kind] || kind;
      const nv = this.parts[kind].reduce((s, p) => s + p.attributes.position.count, 0);
      let geo = share?.[kind]?.count === nv ? shareGeometry(share[kind]) : null;
      if (!geo) {
        geo = mergeGeometries(this.parts[kind], false);
        geo.computeBoundingSphere();
        if (IS_MOBILE) quantizeGeometry(geo); // phones: 8-bit normals, colours and skin weights (engine/slim.js)
        if (bk === 'metal') headDullAttr(geo, this.def.map(([n]) => n));
        if (made) made[kind] = sharedEntry(geo, nv);
      }
      const mat = mats[bk] || (mats[bk] = makeMat(bk));
      const mesh = new THREE.SkinnedMesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // cull off-screen characters with a fixed sphere big enough for any pose (lunges, leaps, raised weapons)
      mesh.frustumCulled = true;
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.0, 0), 2.6);
      mesh.bind(skeleton);
      root.add(mesh);
      meshes[kind] = mesh;
    }
    // the bone-attached pieces (weapons, shields, tools): plain meshes nothing edits afterwards, shared whole (a bow's string
    // line is its own and is left alone)
    const pieces = [];
    for (const { bone, obj, o } of this.attach) {
      const b = bones[bone];
      if (o.p) obj.position.fromArray(o.p);
      if (o.r) obj.rotation.set(o.r[0], o.r[1], o.r[2]);
      obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (!m.isSkinnedMesh && m.geometry && !m.userData.string) pieces.push(m); } });
      b.add(obj);
    }
    if (shareKey) {
      const sp = share?.pieces;
      if (sp && sp.length === pieces.length && pieces.every((m, i) => m.geometry.attributes.position?.count === sp[i].attributes.position?.count)) pieces.forEach((m, i) => { m.geometry = sp[i]; });
      else if (made) { for (const m of pieces) m.geometry.userData.shared = true; made.pieces = pieces.map((m) => m.geometry); }
      if (made) SHARED.set(shareKey, made);
    }
    root.userData = { bones, skeleton, meshes, mats, rest: this.rest };
    return root;
  }
}
