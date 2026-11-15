// Dragonslayer armour on characters (rarity_upgrade_plan D, WP8). The 26 GLB pieces (the Deadeye's helm and pauldron since v107) (client/assets/models/dsa_*.glb and
// their _lo copies; ids from shared/items.js dsaModel) are worn as ONE extra skinned mesh per character:
//   - every worn piece is placed on the character's rest pose (FIT below: turned to face +z, scaled and moved onto its
//     bone, a little bigger for the broad classes), skinned to one bone (helm head, pauldron arm, chest the torso bones
//     like the outfit, gauntlet forearm and hand, greave shin, boot foot and shin) and the right side is the left piece
//     mirrored; the pieces are merged into one geometry and drawn with one material per character on one texture atlas
//     (the pieces' own painted textures side by side; atlases are shared by every character wearing the same models)
//   - the class's own parts under the armour are hidden in the vertex shader (engine/materials.js patchHide: the
//     per-vertex `hpart` marks each triangle's body part, the material's uHide which parts are covered); the class's
//     own pauldrons and the procedural worn shoulder pieces are simply hidden
//   - cloth classes (a cloth chest code): no chest model, the robe stays and is recoloured in the Dragonslayer palette
//     (characters.js setCharGear); the cloak is procedural in the same palette (characters.js setCharCape)
//   - heat +7..+10 and the Prismatic sheen through the per-vertex `upg` attribute (heat.js), the helm the temper tint only
//   - desktop loads the full models and swaps to the _lo models for far characters (dsaLod, entities.js), phones load
//     only the _lo models; while a model loads, with ?notripo=1, or when it fails, the procedural recolour shows
// Content rules: the helms are closed and faceless (the class's head is hidden under them), nothing glows but the heat.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { tripoLoader, tripoEnabled } from './tripoModels.js';
import { patchWorld, patchHide } from '../engine/materials.js';
import { IS_MOBILE } from '../engine/platform.js';
import { heatCharMat } from './heat.js';
import { lookChange } from './charMerge.js';
import { parseLook, dsaModel } from '/sunmere-play/shared/items.js';

const HAS_DOM = typeof window !== 'undefined' && typeof document !== 'undefined';
// the body parts the vertex mask knows (hpart values; uHide is a bit mask of them)
export const HPART = { head: 1, torso: 2, fore: 3, shin: 4, foot: 5, ankle: 6, hand: 7, collar: 8 };
// (the sandblade's turban scarf tails, on the scarf chain, go with the head: a helm hides them, else from above they
// trail back across the cloak's collar rod as a cross)
const PART_BONE = { head: 'head', neck: 'head', scarf0: 'head', scarf1: 'head', scarf2: 'head', scarf3: 'head', spine: 'torso', chest: 'torso', clavL: 'torso', clavR: 'torso', foreL: 'fore', foreR: 'fore', handL: 'hand', handR: 'hand', shinL: 'shin', shinR: 'shin', footL: 'foot', footR: 'foot' };
const ANKLE_Y = 0.27; // shin triangles below this (the boot shaft) count as ankle: hidden by boots and greaves
const COLLAR_Y = 1.58; // torso triangles above this (high collars, hood mantles) count as collar: hidden by helms and chests
// what each worn slot covers
const SLOT_HIDE = { head: ['head', 'collar'], chest: ['torso', 'collar'], hands: ['fore', 'hand'], legs: ['shin', 'ankle'], feet: ['foot', 'ankle'] };
export const DSA_SLOTS = ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet'];

// How each model sits (GLB units: about 2 tall, standing on y = 0). turn: radians about y first (the piece's front to
// +z); axis: 'pca' lines the piece's long axis up with its bone (top end up); w: width (x) in metres, h / d: height and
// depth when not uniform; at: [x, y, z] where the middle of its bounds goes (model space, left side); bone + weights.
const FIT = {
  dsa_knight_helm: { slot: 'head', w: 0.3, at: [0, 1.79, 0.012] },
  dsa_warden_helm: { slot: 'head', turn: -Math.PI / 2, w: 0.32, h: 0.33, d: 0.32, at: [0, 1.76, 0.012] },
  dsa_ranger_helm: { slot: 'head', w: 0.31, at: [0, 1.78, 0.0] },
  dsa_sandblade_helm: { slot: 'head', w: 0.32, at: [0, 1.76, 0.0] },
  dsa_chemist_helm: { slot: 'head', w: 0.46, at: [0, 1.72, -0.005] },
  dsa_herbalist_helm: { slot: 'head', w: 0.44, at: [0, 1.73, 0.0] },
  // the Deadeye's hat-helm (v107): w is the brim's width; the closed faceplate hangs under it
  dsa_deadeye_helm: { slot: 'head', w: 0.54, at: [0, 1.75, 0.01] },
  dsa_knight_pauldron: { slot: 'shoulders', w: 0.27, at: [0.27, 1.52, 0] },
  dsa_warden_pauldron: { slot: 'shoulders', w: 0.27, at: [0.27, 1.5, 0] },
  dsa_ranger_pauldron: { slot: 'shoulders', w: 0.26, at: [0.27, 1.53, 0] },
  dsa_sandblade_pauldron: { slot: 'shoulders', w: 0.22, at: [0.28, 1.48, 0] },
  dsa_chemist_pauldron: { slot: 'shoulders', w: 0.26, at: [0.27, 1.52, 0] },
  dsa_herbalist_pauldron: { slot: 'shoulders', w: 0.26, at: [0.27, 1.5, 0] },
  // (its upright collar plate came out on the outer end: a half turn puts it beside the neck)
  dsa_deadeye_pauldron: { slot: 'shoulders', turn: Math.PI, w: 0.25, at: [0.27, 1.53, 0] },
  dsa_plate_chest: { slot: 'chest', w: 0.5, h: 0.66, d: 0.36, at: [0, 1.31, 0.0] },
  dsa_mail_chest: { slot: 'chest', w: 0.5, h: 0.66, d: 0.34, at: [0, 1.31, 0.0] },
  dsa_cloth_chest: { slot: 'chest', w: 0.5, h: 0.66, d: 0.34, at: [0, 1.31, 0.0] },
  dsa_plate_gauntlet: { slot: 'hands', axis: 'pca', w: 0.15, h: 0.46, at: [0.25, 1.0, 0.0] },
  dsa_mail_gauntlet: { slot: 'hands', axis: 'pca', w: 0.14, h: 0.46, at: [0.25, 1.0, 0.0] },
  dsa_cloth_gauntlet: { slot: 'hands', axis: 'pca', w: 0.14, h: 0.46, at: [0.25, 1.0, 0.0] },
  dsa_plate_greave: { slot: 'legs', w: 0.18, h: 0.46, d: 0.19, at: [0.11, 0.34, 0.01] },
  dsa_mail_greave: { slot: 'legs', turn: -Math.PI / 2, w: 0.18, h: 0.46, d: 0.19, at: [0.11, 0.34, 0.01] },
  dsa_cloth_greave: { slot: 'legs', w: 0.17, h: 0.46, d: 0.18, at: [0.11, 0.34, 0.01] },
  dsa_plate_boot: { slot: 'feet', turn: -Math.PI / 2, w: 0.16, h: 0.24, d: 0.34, at: [0.11, 0.1, 0.06] },
  dsa_mail_boot: { slot: 'feet', turn: -Math.PI / 2, w: 0.16, h: 0.24, d: 0.34, at: [0.11, 0.1, 0.06] },
  dsa_cloth_boot: { slot: 'feet', w: 0.16, h: 0.26, d: 0.34, at: [0.11, 0.11, 0.06] },
};
export const DSA_MODELS = Object.keys(FIT);
// the broad classes: every piece a little bigger (x, z) about its bone (the outfits' bulk in characters.js baseBody)
const BULK = { knight: 1.05, warden: 1.12 };
// per class nudges: { slot: { at: [dx, dy, dz], s: k } }
const CLASS_FIT = {
  warden: { shoulders: { at: [0.015, 0.0, 0] , s: 1.06 } },
  knight: { shoulders: { at: [0.005, 0.0, 0] } },
};

// skin weights by place (left side, model space); the right side swaps L and R
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function torsoW(y) {
  if (y < 1.07) return [['hips', 1]];
  if (y < 1.2) { const t = (y - 1.07) / 0.13; return [['hips', 1 - t], ['spine', t]]; }
  if (y < 1.38) { const t = (y - 1.2) / 0.18; return [['spine', 1 - t], ['chest', t]]; }
  return [['chest', 1]];
}
const WEIGHTS = {
  head: (x, y) => { const t = sstep(1.53, 1.62, y); return t >= 1 ? [['head', 1]] : t <= 0 ? [['chest', 1]] : [['head', t], ['chest', 1 - t]]; },
  shoulders: () => [['armL', 1]],
  chest: (x, y) => torsoW(y),
  hands: (x, y) => { const t = sstep(0.93, 1.0, y); return [['handL', 1 - t], ['foreL', t]]; },
  legs: () => [['shinL', 1]],
  feet: (x, y) => { const t = sstep(0.12, 0.2, y); return [['footL', 1 - t], ['shinL', t]]; },
};

// ---- loading
const store = new Map(); // file (name or name_lo) -> { geo, img }
const waits = new Map();
function load(file) {
  if (!HAS_DOM) return Promise.resolve(false);
  const url = new URL(`./models/${file}.glb`, import.meta.url).href;
  return tripoLoader().loadAsync(url).then((gltf) => {
    gltf.scene.updateMatrixWorld(true);
    let geo = null, img = null;
    gltf.scene.traverse((o) => {
      if (!o.isMesh || geo) return;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      // the exports carry a normal per face corner (every vertex three times over): weld by place and UV and shade them
      // smooth again, a third of the vertices to skin (and no faceting)
      for (const k of Object.keys(g.attributes)) if (!['position', 'uv'].includes(k)) g.deleteAttribute(k);
      geo = mergeVertices(g, 1e-4);
      geo.computeVertexNormals();
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      img = src.map?.image || null;
    });
    if (!geo) return false;
    store.set(file, { geo, img });
    return true;
  }).catch((e) => { console.warn(`[dsArmour] ${file}.glb did not load: ${e?.message || e}`); return false; });
}
function need(file) {
  if (!waits.has(file)) waits.set(file, load(file));
  return waits.get(file);
}
const fileOf = (name, lo) => name + (lo ? '_lo' : '');
// the texture always comes from the full model on desktop (the _lo copy shares its UVs at half the size); phones only
// have the _lo files
const texFile = (name) => fileOf(name, IS_MOBILE);

// ---- one placed piece (cached per model, wearer class, detail and side)
const placed = new Map();
const _m = new THREE.Matrix4();
function principal(P) {
  // the long axis of a point cloud (power iteration on the covariance)
  const n = P.count, c = new THREE.Vector3();
  for (let i = 0; i < n; i++) c.x += P.getX(i), c.y += P.getY(i), c.z += P.getZ(i);
  c.multiplyScalar(1 / n);
  const C = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const x = P.getX(i) - c.x, y = P.getY(i) - c.y, z = P.getZ(i) - c.z;
    C[0] += x * x; C[1] += x * y; C[2] += x * z; C[3] += y * y; C[4] += y * z; C[5] += z * z;
  }
  let v = new THREE.Vector3(0.3, 1, 0.2).normalize();
  for (let k = 0; k < 40; k++) v = new THREE.Vector3(C[0] * v.x + C[1] * v.y + C[2] * v.z, C[1] * v.x + C[3] * v.y + C[4] * v.z, C[2] * v.x + C[4] * v.y + C[5] * v.z).normalize();
  return v;
}
function place(name, kind, lo, side, boneIndex) {
  const key = `${name}|${kind}|${lo ? 1 : 0}|${side}`;
  if (placed.has(key)) return placed.get(key);
  const S = store.get(fileOf(name, lo)), F = FIT[name];
  if (!S || !F) return null;
  const geo = S.geo.clone();
  if (F.turn) geo.rotateY(F.turn);
  if (F.axis === 'pca') {
    const d = principal(geo.attributes.position);
    if (d.y > 0) d.negate(); // top end (the cuff) up
    geo.applyMatrix4(_m.makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(0, -1, 0))));
  }
  geo.computeBoundingBox();
  const b = geo.boundingBox, sz = b.getSize(new THREE.Vector3()), mid = b.getCenter(new THREE.Vector3());
  const cf = CLASS_FIT[kind]?.[F.slot] || {}, bulk = BULK[kind] || 1, k = cf.s || 1;
  const sx = (F.w / sz.x) * k, sy = (F.h ? F.h / sz.y : sx) * k, sz2 = (F.d ? F.d / sz.z : sx) * k;
  const at = [F.at[0] + (cf.at?.[0] || 0), F.at[1] + (cf.at?.[1] || 0), F.at[2] + (cf.at?.[2] || 0)];
  geo.translate(-mid.x, -mid.y, -mid.z);
  geo.applyMatrix4(_m.makeScale(sx * bulk, sy, sz2 * bulk));
  // broad classes: the limb pieces stay on their bones (bulk widens them about their own middle, not the body's)
  geo.translate(at[0] * (F.slot === 'shoulders' ? bulk : 1), at[1], at[2]);
  const P = geo.attributes.position, n = P.count;
  if (side === 'R') {
    geo.applyMatrix4(_m.makeScale(-1, 1, 1));
    const I = geo.index.array;
    for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; }
  }
  const si = new Float32Array(n * 4), sw = new Float32Array(n * 4), wf = WEIGHTS[F.slot];
  for (let i = 0; i < n; i++) {
    const w = wf(Math.abs(P.getX(i)), P.getY(i), P.getZ(i));
    for (let j = 0; j < w.length && j < 4; j++) {
      const bn = side === 'R' ? w[j][0].replace(/L$/, 'R') : w[j][0];
      si[i * 4 + j] = boneIndex[bn] ?? 0; sw[i * 4 + j] = w[j][1];
    }
  }
  const out = { pos: P.array, nrm: geo.attributes.normal.array, uv: geo.attributes.uv.array, idx: geo.index.array, si, sw, n };
  placed.set(key, out);
  return out;
}

// ---- texture atlases: the pieces' painted textures side by side (shared by every character wearing those models)
// the generated helm textures have a few painted highlight dots on their dark faceplates and visors (a glint reads as an
// eye): in dark, grey parts of a helm's texture, a pixel much brighter than the 15 x 15 area round it takes that area's
// colour (one pass per atlas cell, summed-area tables)
function unglint(ctx, x0, y0, C) {
  const im = ctx.getImageData(x0, y0, C, C), D = im.data, W = C + 1, R = 7 * C / 1024 | 0 || 3;
  const S = [new Float64Array(W * W), new Float64Array(W * W), new Float64Array(W * W)];
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
    const i = (y * C + x) * 4, k = (y + 1) * W + x + 1;
    for (let ch = 0; ch < 3; ch++) S[ch][k] = D[i + ch] + S[ch][k - 1] + S[ch][k - W] - S[ch][k - W - 1];
  }
  const box = (ch, xa, ya, xb, yb) => S[ch][yb * W + xb] - S[ch][ya * W + xb] - S[ch][yb * W + xa] + S[ch][ya * W + xa];
  let n = 0;
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
    const xa = Math.max(0, x - R), ya = Math.max(0, y - R), xb = Math.min(C, x + R + 1), yb = Math.min(C, y + R + 1), a = (xb - xa) * (yb - ya);
    const mr = box(0, xa, ya, xb, yb) / a, mg = box(1, xa, ya, xb, yb) / a, mb = box(2, xa, ya, xb, yb) / a;
    const ml = 0.299 * mr + 0.587 * mg + 0.114 * mb;
    if (ml > 95 || Math.max(mr, mg, mb) - Math.min(mr, mg, mb) > 60) continue;
    const i = (y * C + x) * 4, l = 0.299 * D[i] + 0.587 * D[i + 1] + 0.114 * D[i + 2];
    if (l - ml > 16) { D[i] = mr; D[i + 1] = mg; D[i + 2] = mb; n++; }
  }
  if (n) ctx.putImageData(im, x0, y0);
}
// a helm's cleaned texture is made once per model (the pass costs ~20 ms on desktop) and reused by every atlas it is in
const cleaned = new Map();
function cleanHelm(nm, img, C) {
  let cv = cleaned.get(nm);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = cv.height = C;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, C, C);
  unglint(ctx, 0, 0, C);
  cleaned.set(nm, cv);
  return cv;
}
const atlases = new Map(); // key -> { tex, cell: Map(name -> [u0, v0, su, sv]), refs }
function atlasFor(names) {
  const key = names.join('|');
  let A = atlases.get(key);
  if (A) return A;
  const C = IS_MOBILE ? 512 : 1024, n = names.length;
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
  const cv = document.createElement('canvas');
  cv.width = cols * C; cv.height = rows * C;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#6a1414'; ctx.fillRect(0, 0, cv.width, cv.height);
  const cell = new Map();
  names.forEach((nm, i) => {
    const c = i % cols, r = Math.floor(i / cols), img = store.get(texFile(nm))?.img;
    if (img && FIT[nm]?.slot === 'head') ctx.drawImage(cleanHelm(nm, img, C), c * C, r * C);
    else if (img) ctx.drawImage(img, c * C, r * C, C, C);
    cell.set(nm, [c / cols, r / rows, 1 / cols, 1 / rows]);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false; // glTF UVs: (0, 0) is the top left of the image
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = IS_MOBILE ? 4 : 8;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  A = { key, tex, cell, refs: 0 };
  atlases.set(key, A);
  return A;
}
function release(A) {
  if (!A) return;
  A.refs--;
  if (A.refs <= 0) { A.tex.dispose(); atlases.delete(A.key); }
}
export const dsaAtlasCount = () => atlases.size;

function makeMat(A) {
  const m = new THREE.MeshStandardMaterial({ map: A.tex, roughness: 0.58, metalness: 0.2, side: THREE.DoubleSide });
  patchWorld(m, { cloud: true });
  // the insides (back faces) are dark: the inside of a helm, a boot or a cuff, and a hairline gap in a model (the cut-down
  // meshes have a few) shows shadow, never a light speck
  const pre = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    pre.call(m, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  if (!gl_FrontFacing) diffuseColor.rgb *= 0.12;')
      .replace('#include <opaque_fragment>', '  if (!gl_FrontFacing) outgoingLight *= 0.15;\n#include <opaque_fragment>')
      // dark texels (the closed faceplates and visors) are matte: no glint on a faceplate ever reads as an eye
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(0.95, roughnessFactor, smoothstep(0.06, 0.2, dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))));')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor *= smoothstep(0.06, 0.2, dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));');
  };
  const ck = m.customProgramCacheKey;
  m.customProgramCacheKey = () => ck.call(m) + 'dsaIn';
  heatCharMat(m);
  m.name = 'dsa_plate';
  m.userData.heatable = true;
  return m;
}

// ---- what a character wears: [{ slot, name, heat, film }] from its look codes
function wanted(U) {
  const kind = U.kind;
  const out = [];
  const add = (slot, L) => {
    if (!L?.ds) return;
    const cls = L.dsc || kind, w = L.w ? L.w[0] : null;
    if (slot === 'chest' && w === 'c') return; // cloth: the recoloured robe
    const name = dsaModel(slot, cls, w);
    if (!name || !FIT[name]) return;
    out.push({ slot, name, heat: L.heat >= 7 ? L.heat : 0, film: L.q >= 6 ? 1 : 0 });
  };
  const codes = String(U.gearKey || '').split('.');
  ['head', 'chest', 'hands', 'legs', 'feet'].forEach((s, i) => add(s, parseLook(codes[i])));
  add('shoulders', parseLook(U.armKey));
  return out.sort((a, b) => DSA_SLOTS.indexOf(a.slot) - DSA_SLOTS.indexOf(b.slot));
}
// the Dragonslayer slots the look codes ask for (the recolour fallback in characters.js reads it too)
export function dsaWanted(root) { return wanted(root.userData); }

// ---- the per-vertex body part of a character's own meshes (cached per shared vertex array)
const hparts = new WeakMap();
function hpartAttr(geo, names) {
  const P = geo.attributes.position, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  if (!P || !SI || !SW) return null;
  let a = hparts.get(P);
  if (a) return a;
  const n = P.count, A = new Float32Array(n), idx = geo.index?.array;
  const dom = (i) => {
    let bi = SI.getX(i), bw = SW.getX(i);
    if (SW.getY(i) > bw) { bi = SI.getY(i); bw = SW.getY(i); }
    if (SW.getZ(i) > bw) { bi = SI.getZ(i); bw = SW.getZ(i); }
    if (SW.getW(i) > bw) bi = SI.getW(i);
    return PART_BONE[names[Math.round(bi)]] || null;
  };
  const code = (part, y) => (!part ? 0 : part === 'shin' && y < ANKLE_Y ? HPART.ankle : part === 'torso' && y > COLLAR_Y ? HPART.collar : HPART[part]);
  if (!idx) {
    // non-indexed (the rig's meshes): one part per triangle, the part most of its corners belong to
    for (let t = 0; t + 2 < n; t += 3) {
      const p0 = dom(t), p1 = dom(t + 1), p2 = dom(t + 2);
      const p = p1 === p2 ? p1 : p0;
      const y = (P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3;
      A[t] = A[t + 1] = A[t + 2] = code(p, y);
    }
  } else for (let i = 0; i < n; i++) A[i] = code(dom(i), P.getY(i));
  a = new THREE.BufferAttribute(A, 1);
  hparts.set(P, a);
  return a;
}
const ZERO = new Map(); // vertex count -> a zero hpart attribute
function zeroHpart(n) { let a = ZERO.get(n); if (!a) { a = new THREE.BufferAttribute(new Float32Array(n), 1); ZERO.set(n, a); } return a; }
// patch a character's own materials with the mask and give every mesh drawn with them its hpart (the class's own capes
// and cloaks never hide: zeros)
function maskBody(root, bits) {
  const U = root.userData, names = U.skeleton.bones.map((b) => b.name);
  const never = new Set([U.meshes?.ccape, ...(U.capeMeshes || [])].filter(Boolean));
  root.traverse((m) => {
    if (!m.isSkinnedMesh || m.userData.dsa) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (bits) for (const mt of mats) if (mt && !mt.userData.hidePatched && mt.isMeshStandardMaterial) patchHide(mt);
    if (!mats.some((mt) => mt?.userData?.hidePatched)) return;
    const g = m.geometry, cur = g.getAttribute('hpart');
    const want = never.has(m) ? zeroHpart(g.attributes.position.count) : (hpartAttr(g, names) || zeroHpart(g.attributes.position.count));
    if (cur !== want) g.setAttribute('hpart', want);
    for (const mt of mats) if (mt?.userData?.uHide) mt.userData.uHide.value = bits;
  });
}

// ---- per character
function build(root, list, lo) {
  const U = root.userData, names = U.skeleton.bones.map((b) => b.name), bi = Object.fromEntries(names.map((n, i) => [n, i]));
  const pieces = [];
  for (const it of list) {
    const sides = it.slot === 'head' || it.slot === 'chest' ? ['L'] : ['L', 'R'];
    for (const s of sides) { const p = place(it.name, U.kind, lo, s, bi); if (p) pieces.push([it, p]); }
  }
  let nv = 0, ni = 0;
  for (const [, p] of pieces) { nv += p.n; ni += p.idx.length; }
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), si = new Float32Array(nv * 4), sw = new Float32Array(nv * 4), upg = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const A = U.dsa.atlas;
  let v0 = 0, i0 = 0;
  for (const [it, p] of pieces) {
    pos.set(p.pos, v0 * 3); nrm.set(p.nrm, v0 * 3); si.set(p.si, v0 * 4); sw.set(p.sw, v0 * 4);
    const [u0, w0, su, sv] = A.cell.get(it.name);
    for (let i = 0; i < p.n; i++) {
      // inset a hair so the mip levels never reach into the neighbouring cell
      uv[(v0 + i) * 2] = u0 + (0.002 + Math.min(1, Math.max(0, p.uv[i * 2])) * 0.996) * su;
      uv[(v0 + i) * 2 + 1] = w0 + (0.002 + Math.min(1, Math.max(0, p.uv[i * 2 + 1])) * 0.996) * sv;
      // the head: a plain straw temper tint, no glow, no height bands and no sheen (nothing lights up near a helm's front,
      // and on a round crown seen from above the +9/+10 bands and the view-angle sheen make rings round a disc)
      const hd = it.slot === 'head';
      upg[(v0 + i) * 2] = hd ? -Math.min(it.heat, 8) : it.heat; upg[(v0 + i) * 2 + 1] = hd ? 0 : it.film;
    }
    for (let j = 0; j < p.idx.length; j++) idx[i0 + j] = p.idx[j] + v0;
    v0 += p.n; i0 += p.idx.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('upg', new THREE.BufferAttribute(upg, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.0, 0), 2.6);
  return g;
}

function clear(root) {
  const U = root.userData, D = U.dsa;
  if (!D) return;
  if (D.mesh) { D.mesh.parent?.remove(D.mesh); D.hi?.dispose(); D.lo?.dispose(); D.mat?.dispose(); }
  release(D.atlas);
  if (U.mats?.dsa) delete U.mats.dsa;
  U.dsa = null;
}

// Called by characters.js after setCharGear / setCharArmor (the look codes are in userData.gearKey / armKey): puts on,
// changes or takes off the Dragonslayer pieces. Safe to call every time (keyed).
export function dsaSync(root) {
  const U = root.userData;
  if (!U.skeleton) return;
  const list = wanted(U);
  const on = tripoEnabled() && list.length > 0;
  const key = on ? list.map((it) => `${it.slot}:${it.name}:${it.heat}:${it.film}`).join(',') : '';
  if ((U.dsaKey ?? '') === key && (key === '' || U.dsa?.mesh)) { applyHide(root); return; }
  lookChange(root); // (v115: a merged player goes back to its per-kind meshes first, charMerge.js)
  U.dsaKey = key;
  if (!on) { clear(root); applyHide(root); return; }
  const lo = IS_MOBILE;
  const files = [...new Set(list.flatMap((it) => [fileOf(it.name, lo), texFile(it.name)]))];
  if (!files.every((f) => store.has(f))) {
    // the procedural recolour shows meanwhile; come back when the models are in (if the look has not changed since)
    clear(root); applyHide(root);
    Promise.all(files.map(need)).then((ok) => { if (ok.every(Boolean) && U.dsaKey === key && root.userData === U) { U.dsaKey = null; dsaSync(root); } });
    return;
  }
  clear(root);
  const names = [...new Set(list.map((it) => it.name))];
  const atlas = atlasFor(names); atlas.refs++;
  U.dsa = { atlas, list, lo };
  const geo = build(root, list, lo);
  const mat = makeMat(atlas);
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = 'dsa';
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.boundingSphere = geo.boundingSphere.clone();
  mesh.bind(U.skeleton, new THREE.Matrix4());
  mesh.userData.dsa = true;
  root.add(mesh);
  Object.assign(U.dsa, { mesh, mat, hi: geo, lo: lo ? geo : null, far: lo });
  (U.mats ||= {}).dsa = mat; // the hit flash and fades reach it like the body
  applyHide(root);
  if (U.dsaFar) dsaLod(root, true);
}
// hide what the worn models cover (or show it again)
function applyHide(root) {
  const U = root.userData, D = U.dsa;
  let bits = 0;
  const shoulders = !!D?.list.some((it) => it.slot === 'shoulders');
  if (D) for (const it of D.list) for (const p of SLOT_HIDE[it.slot] || []) bits |= 1 << HPART[p];
  if (bits || U.dsaMasked) { maskBody(root, bits); U.dsaMasked = true; }
  // shoulders: the class's own pauldrons are already hidden by setCharArmor (a worn code); the procedural worn piece too
  for (const bn of ['armL', 'armR']) for (const c of U.bones?.[bn]?.children || []) if (c.userData.armSwap) c.visible = !shoulders;
}

// a character leaves (entities.js dispose): its merged mesh, material and its share of the atlas go
export function dsaDispose(root) { if (root?.userData?.dsa) { clear(root); root.userData.dsaKey = null; } }
// far characters (desktop): the _lo models (entities.js, at the view's distance tier)
export function dsaLod(root, far) {
  root.userData.dsaFar = !!far;
  const D = root.userData.dsa;
  if (!D?.mesh || IS_MOBILE || D.far === !!far) return;
  D.far = !!far;
  if (far && !D.lo) {
    const files = [...new Set(D.list.map((it) => fileOf(it.name, true)))];
    if (!files.every((f) => store.has(f))) {
      D.far = false;
      Promise.all(files.map(need)).then((ok) => { if (ok.every(Boolean) && root.userData.dsa === D && root.userData.dsaFar) dsaLod(root, true); });
      return;
    }
    D.lo = build(root, D.list, true);
  }
  D.mesh.geometry = far ? D.lo : D.hi;
}
// start loading a class's models ahead of need
export function dsaPreload(names) { if (tripoEnabled()) for (const n of names) { need(fileOf(n, IS_MOBILE)); need(texFile(n)); } }
export function dsaReady(name) { return store.has(fileOf(name, IS_MOBILE)); }
