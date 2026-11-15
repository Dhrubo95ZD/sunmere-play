// A Tripo-made body worn on the game's own skeleton (deadeye_plan.md 5a, v108 pilot): the Deadeye's Ironclad Gunhand.
// tools/tripo/deadeye/rig_body.py turned the Tripo statue into a skinned GLB on the HUMANOID bone names, already in the
// rig's rest pose (client/assets/models/deadeye_body.glb, 26k tris, 2048 textures; deadeye_body_lo.glb, 10k, 1024).
//   - it replaces the class's procedural outfit when the look is the class's own (any of the three coat variants: the
//     model is variant 0's black and rust, variants 1 and 2 are tinted in the shader, see TINTS; and no worn armour other
//     than Dragonslayer pieces); otherwise the procedural outfit shows. Common worn armour stays procedural on purpose
//     (v108 check): its shoulder pieces, cuffs and knee bands are sized round the procedural outfit (gearReach), so on
//     the bulkier Tripo coat they float off it as rings, the body's own pauldron shows through a worn one, and the slot
//     recolouring (vertex colours) cannot reach the body's texture
//   - the GLB's skin is re-pointed at the character's own skeleton (bone by name), so every choreo.js / anim.js clip and
//     the weapon bones (the pistols) drive it unchanged; its hands were cut off in Blender and the game's closed fists
//     (built by characters.js, setTripoHands) sit on the hand bones round the pistols' grips
//   - the procedural outfit is hidden while the body shows; it stays the fallback while the GLB loads, with ?notripo=1,
//     with ?tripobody=0 (this pilot alone off), or if the file fails
//   - Dragonslayer armour (dsArmour.js) hides what it covers on this body too: the body is a skinned mesh of the character
//     like the outfit, so the vertex mask (hpart, from the skin weights) works on it; the body's own right pauldron hides
//     under a worn Dragonslayer pauldron (its own small mask)
//   - one geometry for every Deadeye (the GLB's arrays shared); one material each (the hit flash); desktop swaps to the
//     _lo geometry for far characters (the view's distance tier: dsArmour's dsaFar), phones load only the _lo file
// Content rules: the head is a smooth wrapped cloth hood (characters.js, setTripoHands), featureless, no pairs; the hat's
// band is darkened into the hat so no coloured ring shows from straight above.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tripoLoader, tripoEnabled } from './tripoModels.js';
import { patchWorld } from '../engine/materials.js';
import { IS_MOBILE } from '../engine/platform.js';
import { RigBuilder, HUMANOID } from './rig.js';
import { parseLook } from '/sunmere-play/shared/items.js';
import { HPART } from './dsArmour.js';

const HAS_DOM = typeof window !== 'undefined' && typeof document !== 'undefined';
// the pilot's own switch (on by default; ?tripobody=0 turns it off, setTripoBodyEnabled for tests)
let on = !(HAS_DOM && /[?&]tripobody=0/.test(window.location?.search || ''));
export function setTripoBodyEnabled(v) { on = !!v; }
export function tripoBodyEnabled() { return on && tripoEnabled(); }
// which looks have a Tripo body: class -> { file, variants }
// (v108: all three coat variants: the model was made in variant 0's black and rust, the others are tinted in the shader)
const BODIES = { deadeye: { file: 'deadeye_body', variants: [0, 1, 2] } };
// the Deadeye's coat variants [coat, accent, hat] (characters.js builds the procedural outfit from these too)
export const DEADEYE_LOOKS = [['#2c2622', '#8a3a24', '#2a2420'], ['#3c434c', '#a8865a', '#33302c'], ['#575b60', '#2a7a78', '#3a3c40']];
// per variant, the colour multipliers (linear) that take the model's own coat and rust accent to the variant's: a
// multiplier keeps the texture's light, folds and wear. Clamped so near-black texels never blow up into flat colour.
const _c = new THREE.Color();
const lin = (h) => _c.set(h).toArray();
const TINTS = DEADEYE_LOOKS.map(([coat, acc]) => {
  const [c0, a0] = [lin(DEADEYE_LOOKS[0][0]), lin(DEADEYE_LOOKS[0][1])], c = lin(coat), a = lin(acc);
  return { coat: new THREE.Vector3(...c.map((v, i) => Math.min(8, Math.max(0.2, v / c0[i])))), acc: new THREE.Vector3(...a.map((v, i) => Math.min(12, Math.max(0.08, v / a0[i])))) };
});

// the closed fists on the hand bones (characters.js registers its builder: the same fists as the procedural outfit)
// (fn(rb, hb, variant): the fists into rb, the cloth hood into hb)
let handsFn = null;
export function setTripoHands(fn) { handsFn = fn; fistGeos.clear(); }

// ---- the body's per-vertex part for the Dragonslayer mask (same rules as dsArmour.js hpartAttr)
const PART_BONE = { head: 'head', neck: 'head', spine: 'torso', chest: 'torso', clavL: 'torso', clavR: 'torso', foreL: 'fore', foreR: 'fore', handL: 'hand', handR: 'hand', shinL: 'shin', shinR: 'shin', footL: 'foot', footR: 'foot' };
const ANKLE_Y = 0.27, COLLAR_Y = 1.58;
const NAMES = HUMANOID.map(([n]) => n);
const INDEX = Object.fromEntries(NAMES.map((n, i) => [n, i]));
function topBone(SI, SW, i) {
  let bi = SI.getX(i), bw = SW.getX(i);
  if (SW.getY(i) > bw) { bi = SI.getY(i); bw = SW.getY(i); }
  if (SW.getZ(i) > bw) { bi = SI.getZ(i); bw = SW.getZ(i); }
  if (SW.getW(i) > bw) bi = SI.getW(i);
  return NAMES[Math.round(bi)];
}
function partAttrs(geo) {
  const P = geo.attributes.position, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, n = P.count;
  const hp = new Float32Array(n), pa = new Float32Array(n), tc = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const b = topBone(SI, SW, i), part = PART_BONE[b], x = P.getX(i), y = P.getY(i);
    hp[i] = !part ? 0 : part === 'shin' && y < ANKLE_Y ? HPART.ankle : part === 'torso' && y > COLLAR_Y ? HPART.collar : HPART[part];
    // the body's own pauldron (right shoulder): hidden under a worn Dragonslayer pauldron
    // the coat's own cloth (body, arms, skirts): tinted per variant (1); the head (0.5): the hat's red band goes the hat's
    // dark brown (seen from straight above it was a coloured ring round the crown); not the boots or the hands (0)
    tc[i] = !part || part === 'torso' || part === 'fore' ? 1 : part === 'head' ? 0.5 : 0;
    pa[i] = x < -0.15 && y > 1.36 && (b === 'armR' || b === 'clavR' || (b === 'chest' && x < -0.19)) ? 1 : 0;
  }
  geo.setAttribute('hpart', new THREE.BufferAttribute(hp, 1));
  geo.setAttribute('tpaul', new THREE.BufferAttribute(pa, 1));
  geo.setAttribute('tcoat', new THREE.BufferAttribute(tc, 1));
}

// ---- loading: file -> { geo, src } (the geometry in the rig's rest, skin on HUMANOID indices)
const store = new Map();
const waits = new Map();
const _v = new THREE.Vector3();
function load(file) {
  if (!HAS_DOM) return Promise.resolve(false);
  const url = new URL(`./models/${file}.glb`, import.meta.url).href;
  return tripoLoader().loadAsync(url).then((gltf) => {
    gltf.scene.updateMatrixWorld(true);
    let sk = null;
    gltf.scene.traverse((o) => { if (o.isSkinnedMesh && !sk) sk = o; });
    if (!sk) throw new Error('no skinned mesh');
    const src = sk.geometry, bones = sk.skeleton.bones, n = src.attributes.position.count;
    // the rest shape in model space (whatever transforms the export or the phone build's re-export put round it)
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { sk.applyBoneTransform(i, _v.fromBufferAttribute(src.attributes.position, i)); _v.applyMatrix4(sk.matrixWorld); _v.toArray(pos, i * 3); }
    // stand it where the rig's hips are (the phone build re-centres every GLB)
    const hips = bones.find((b) => b.name === 'hips');
    const off = hips ? new THREE.Vector3(0, 1, 0).sub(hips.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3();
    for (let i = 0; i < n; i++) { pos[i * 3] += off.x; pos[i * 3 + 1] += off.y; pos[i * 3 + 2] += off.z; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', src.attributes.normal.clone());
    geo.setAttribute('uv', src.attributes.uv.clone());
    geo.setIndex(src.index.clone());
    // the skin: the GLB's joint order -> the character skeleton's (HUMANOID order)
    const map = bones.map((b) => INDEX[b.name] ?? 0), SI = src.attributes.skinIndex, SW = src.attributes.skinWeight;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { si[i * 4 + k] = map[SI.getComponent(i, k)]; sw[i * 4 + k] = SW.getComponent(i, k); }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    partAttrs(geo);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.0, 0), 2.6);
    geo.userData.shared = true; // every Deadeye draws it: the disposer (rig.js disposeCharGeometry) leaves it alone
    const m = Array.isArray(sk.material) ? sk.material[0] : sk.material;
    for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = IS_MOBILE ? 4 : 8;
    store.set(file, { geo, src: m });
    return true;
  }).catch((e) => { console.warn(`[tripoBody] ${file}.glb did not load: ${e?.message || e}`); return false; });
}
function need(file) {
  if (!waits.has(file)) waits.set(file, load(file));
  return waits.get(file);
}
const fileOf = (B, lo) => B.file + (lo ? '_lo' : '');

// ---- the material: the model's colour, normal and roughness / metal maps, the world patches; dark texels (the mask,
// the blackened steel) matte so no glint on the mask reads as an eye; the insides (back faces, the open cuffs) dark
function makeMat(src) {
  const m = new THREE.MeshStandardMaterial({
    map: src.map || null, normalMap: src.normalMap || null, roughnessMap: src.roughnessMap || null, metalnessMap: src.metalnessMap || null,
    roughness: 1, metalness: src.metalnessMap ? 0.75 : 0.2, side: THREE.DoubleSide,
  });
  if (m.normalMap) m.normalScale.copy(src.normalScale || new THREE.Vector2(1, -1)).multiplyScalar(0.9);
  patchWorld(m, { cloud: true });
  const u = (m.userData.tpaul = { value: 0 });
  // the coat variant's tint (set in attach): the coat cloth (dark, not metal, on the coat's parts: tcoat) by uCoatMul, the
  // rust accent (strongly red, not metal) by uAccMul; variant 0 is the model as made. The matte rule below reads the
  // texel's own brightness (tLum0), so a lighter tinted coat never turns shiny.
  const tint = (m.userData.tint = { on: { value: 0 }, coat: { value: new THREE.Vector3(1, 1, 1) }, acc: { value: new THREE.Vector3(1, 1, 1) } });
  const pre = m.onBeforeCompile, ck = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    pre?.call(m, sh, r);
    sh.uniforms.uTPaul = u;
    sh.uniforms.uTintOn = tint.on; sh.uniforms.uCoatMul = tint.coat; sh.uniforms.uAccMul = tint.acc;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float tpaul;\nattribute float tcoat;\nvarying float vTCoat;\nuniform float uTPaul;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vTCoat = tcoat;\n  if (tpaul * uTPaul > 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTCoat;\nuniform float uTintOn;\nuniform vec3 uCoatMul;\nuniform vec3 uAccMul;')
      .replace('#include <map_fragment>', `#include <map_fragment>
  float tLum0 = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  float tHead = step(0.25, vTCoat) * (1.0 - step(0.75, vTCoat));
  if (tHead > 0.5) diffuseColor.rgb *= mix(vec3(1.0), vec3(0.12, 0.45, 0.8), smoothstep(2.6, 4.0, diffuseColor.r / max(diffuseColor.g, 1e-4)));
  if (uTintOn > 0.5) {
    vec3 tc = diffuseColor.rgb;
#ifdef USE_METALNESSMAP
    float tMet = texture2D(metalnessMap, vMetalnessMapUv).b;
#else
    float tMet = 0.0;
#endif
    float tCloth = 1.0 - smoothstep(0.3, 0.6, tMet);
    float tRust = smoothstep(2.6, 4.0, tc.r / max(tc.g, 1e-4)) * smoothstep(0.02, 0.05, tc.r);
    tRust *= 1.0 - tHead;
    float tCoat = step(0.75, vTCoat) * (1.0 - tRust) * (1.0 - smoothstep(0.05, 0.12, tLum0));
    vec3 tMul = mix(vec3(1.0), uCoatMul, tCoat * tCloth);
    diffuseColor.rgb *= mix(tMul, uAccMul, tRust * tCloth);
  }
  if (!gl_FrontFacing) diffuseColor.rgb *= 0.15;`)
      .replace('#include <opaque_fragment>', '  if (!gl_FrontFacing) outgoingLight *= 0.2;\n#include <opaque_fragment>')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = max(roughnessFactor, mix(0.92, 0.45, smoothstep(0.05, 0.16, tLum0)));')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor *= smoothstep(0.05, 0.16, tLum0);');
  };
  m.customProgramCacheKey = () => (ck ? ck.call(m) : '') + 'tbody';
  m.name = 'tripo_body';
  return m;
}

// ---- the fists and the cloth hood (shared geometry per coat variant, the character's own metal material; the hood's
// vertices are 'dull': fully matte, so the cloth never shines like steel)
const fistGeos = new Map();
function fists(v = 0) {
  if (fistGeos.has(v) || !handsFn) return fistGeos.get(v) || null;
  const rb = new RigBuilder(), hb = new RigBuilder();
  handsFn(rb, hb, v);
  const hands = rb.parts.metal.concat(rb.parts.leather), hood = hb.parts.metal.concat(hb.parts.leather);
  if (!hands.length && !hood.length) return null;
  const geo = mergeGeometries(hands.concat(hood), false);
  const nh = hands.reduce((a, g) => a + g.attributes.position.count, 0), dull = new Float32Array(geo.attributes.position.count);
  dull.fill(1, nh);
  geo.setAttribute('dull', new THREE.BufferAttribute(dull, 1));
  geo.userData.shared = true;
  fistGeos.set(v, geo);
  return geo;
}

// is the character's look the class's own outfit (Dragonslayer pieces allowed: they go on over the body)?
function ownLook(U) {
  const B = BODIES[U.kind];
  if (!B || !B.variants.includes(U.variant || 0)) return false;
  for (const c of String(U.gearKey || '').split('.')) { const L = parseLook(c); if (L && !L.ds) return false; }
  const S = parseLook(U.armKey);
  return !(S && !S.ds && ['plate', 'mail', 'cloth'].includes(S.w));
}

// the procedural outfit's meshes back as they should be (the class pauldrons under a worn shoulder piece, the class
// cape under a worn cloak stay hidden)
function showOutfit(U, show) {
  const S = parseLook(U.armKey), worn = !!(S && ['plate', 'mail', 'cloth'].includes(S.w));
  const C = parseLook(U.capeKey), cloak = !!(C && !C.w && C.q);
  for (const [k, m] of Object.entries(U.meshes || {})) {
    m.visible = show && !(worn && /^p(metal|leather|glow|cloth)$/.test(k)) && !(cloak && k === 'ccape');
  }
}

function attach(root, B) {
  const U = root.userData, lo = IS_MOBILE || !!U.dsaFar;
  const S = store.get(fileOf(B, lo)) || store.get(fileOf(B, !lo));
  const mat = makeMat(S.src), v = (U.variant || 0) % 3;
  mat.userData.tint.on.value = v ? 1 : 0;
  mat.userData.tint.coat.value.copy(TINTS[v].coat); mat.userData.tint.acc.value.copy(TINTS[v].acc);
  const mesh = new THREE.SkinnedMesh(S.geo, mat);
  mesh.name = 'tripoBody';
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.boundingSphere = S.geo.boundingSphere.clone();
  mesh.bind(U.skeleton, new THREE.Matrix4());
  mesh.userData.far = S === store.get(fileOf(B, true));
  // per frame (cheap): the far / near geometry by the view's distance tier, the pauldron under a worn Dragonslayer one
  mesh.onBeforeRender = () => {
    const far = IS_MOBILE || !!U.dsaFar;
    if (far !== mesh.userData.far) {
      const T = store.get(fileOf(B, far));
      if (T) { mesh.geometry = T.geo; mesh.userData.far = far; } else need(fileOf(B, far));
    }
    mat.userData.tpaul.value = U.dsa?.mesh && U.dsa.list.some((it) => it.slot === 'shoulders') ? 1 : 0;
  };
  root.add(mesh);
  let hands = null;
  const fg = fists(v);
  if (fg && U.mats?.metal) {
    hands = new THREE.SkinnedMesh(fg, U.mats.metal);
    hands.name = 'tripoHands';
    hands.castShadow = true; hands.receiveShadow = true;
    hands.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.0, 0), 2.6);
    hands.bind(U.skeleton, new THREE.Matrix4());
    root.add(hands);
  }
  U.tbody = { mesh, hands, mat };
  (U.mats ||= {}).tbody = mat; // the hit flash and fades reach it like the outfit
}
function detach(root) {
  const U = root.userData, T = U.tbody;
  if (!T) return;
  T.mesh.parent?.remove(T.mesh); T.hands?.parent?.remove(T.hands);
  T.mat.dispose();
  if (U.mats?.tbody) delete U.mats.tbody;
  U.tbody = null;
}

// Called by characters.js after a change of look (with dsaSync, once all of a look's setChar* calls are in): puts the
// Tripo body on or takes it off. Safe to call every time.
export function tripoBodySync(root) {
  const U = root.userData, B = BODIES[U.kind];
  if (!B || !U.skeleton) return;
  const want = tripoBodyEnabled() && ownLook(U);
  if (!want) { if (U.tbody) { detach(root); showOutfit(U, true); } return; }
  const file = fileOf(B, IS_MOBILE || !!U.dsaFar);
  if (!store.has(file)) {
    // the procedural outfit shows meanwhile; come back when the body is in (if the look still wants it)
    need(file).then((ok) => { if (ok && root.userData === U && !U.tbody) tripoBodySync(root); });
    if (!U.tbody) return;
  }
  if (!U.tbody) attach(root, B);
  showOutfit(U, false);
}
// is a character wearing its Tripo body (tests, the bench)
export function tripoBodyOn(root) { return !!root?.userData?.tbody; }
// tests: the processed geometry of a body file (models/<file>.glb), or null
export function tripoBodyGeometry(file) { return need(file).then((ok) => (ok ? store.get(file).geo : null)); }
