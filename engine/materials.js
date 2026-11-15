// Material factory. Every world material is a MeshStandardMaterial patched with:
//  - wind: per-vertex amplitudes in the `wind` attribute (x trunk bend, y branch sway, z leaf flutter, w cloth wave), metres
//  - fade: dithered see-through circle around the player (things between camera and hero)
//  - cloud: drifting cloud shadows
import * as THREE from 'three';
import { G } from './globals.js';
import * as T from './textures.js';

const VERT_PARS = /* glsl */ `
attribute vec4 wind;
#ifdef SM_BILLBOARD
attribute vec3 corner; // xy: view-space corner offset, z: depth pull toward the camera (outer, brighter cards win)
#endif
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec3 uPlayerPos;
varying vec3 vWPos;
varying float vVDepth;
`;

const VERT_WIND = /* glsl */ `
{
  mat4 wm = modelMatrix;
  #ifdef USE_INSTANCING
    wm = modelMatrix * instanceMatrix;
  #endif
  #ifdef USE_BATCHING
    wm = modelMatrix * batchingMatrix;
  #endif
  vec3 origin = (wm * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  mat3 m3 = mat3(wm);
  float s2 = max(1e-5, dot(m3[0], m3[0]));
  vec3 windW = vec3(uWindDir.x, 0.0, uWindDir.y);
  vec3 sideW = vec3(-uWindDir.y, 0.0, uWindDir.x);
  float t = uTime;
  float ph = dot(origin.xz, vec2(0.071, 0.053));
  // gust fronts travel across the world along the wind direction
  float front = dot(origin.xz, uWindDir) * 0.035;
  float gust = 0.55 + 0.45 * sin(t * 0.42 - front) * (0.65 + 0.35 * sin(t * 0.13 + origin.x * 0.017 + origin.z * 0.011));
  float str = uWindStrength;
  vec3 dW = vec3(0.0);
  // trunk bend: slow lean with the wind plus a gentle return oscillation
  float bend = (0.62 + 0.38 * sin(t * 1.05 + ph)) * gust;
  dW += windW * wind.x * bend * str;
  dW.y -= wind.x * wind.x * 0.18 * bend * str;
  // branch sway: elliptical orbit, phase varies along the branch
  float bp = ph * 3.0 + dot(position, vec3(0.31, 0.17, 0.23));
  dW += (sideW * sin(t * 1.85 + bp) * 0.7 + windW * sin(t * 2.3 + bp * 1.4) * 0.5 + vec3(0.0, 0.45, 0.0) * sin(t * 2.9 + bp * 1.1)) * wind.y * (0.45 + gust) * str;
  // walking through: swaying foliage near the hero bends away from them (below chest height only, so tree crowns
  // and anything without sway weights stay put)
  {
    vec3 wp = (wm * vec4(position, 1.0)).xyz;
    vec2 off = wp.xz - uPlayerPos.xz;
    float dd = length(off);
    float near = (1.0 - smoothstep(0.35, 1.35, dd)) * (1.0 - smoothstep(uPlayerPos.y + 0.9, uPlayerPos.y + 1.7, wp.y));
    float sway = clamp(wind.y * 6.0 + wind.z * 3.0, 0.0, 1.0);
    dW += vec3(off.x, 0.0, off.y) / max(dd, 0.05) * near * sway * 0.38;
    dW.y -= near * sway * 0.1;
  }
  vec3 dL = (transpose(m3) * dW) / s2;
  // leaf flutter and cloth ripple along the surface normal
  float fp = dot(position, vec3(3.1, 2.3, 2.7)) + ph * 5.0;
  float flutter = sin(t * 7.3 + fp) * 0.6 + sin(t * 12.9 + fp * 1.7) * 0.4;
  float wave = sin(t * 4.1 - position.x * 1.7 - position.z * 1.3 - position.y * 0.6 + ph) * 0.7 + sin(t * 7.2 - position.x * 3.3 + position.z * 2.1) * 0.3;
  dL += objectNormal * (wind.z * flutter * (0.35 + gust) + wind.w * wave * (0.45 + gust)) * str;
  transformed += dL;
}
`;

const VERT_OUT = /* glsl */ `
{
  mat4 wm2 = modelMatrix;
  #ifdef USE_INSTANCING
    wm2 = modelMatrix * instanceMatrix;
  #endif
  #ifdef USE_BATCHING
    wm2 = modelMatrix * batchingMatrix;
  #endif
  vWPos = (wm2 * vec4(transformed, 1.0)).xyz;
  vVDepth = -mvPosition.z;
}
`;

// Camera-facing foliage cards: the card centre is the vertex position, corners expand in view space.
const VERT_BB = /* glsl */ `
#ifdef SM_BILLBOARD
{
  float bbS = length(modelMatrix[0].xyz);
  #ifdef USE_INSTANCING
    bbS *= length(instanceMatrix[0].xyz);
  #endif
  #ifdef USE_BATCHING
    bbS *= length(batchingMatrix[0].xyz);
  #endif
  float fa = (sin(uTime * 2.6 + dot(position, vec3(1.7, 2.3, 1.1))) * 0.6 + sin(uTime * 4.1 + dot(position, vec3(2.9, 1.3, 2.1))) * 0.4) * wind.z * 1.2 * uWindStrength;
  vec2 cr = vec2(corner.x * cos(fa) - corner.y * sin(fa), corner.x * sin(fa) + corner.y * cos(fa));
  mvPosition.xy += cr * bbS;
  #ifndef SM_DEPTH
    // depth comes from the card's REST position (before wind) plus its brightness pull, so swaying and
    // fluttering can never change which overlapping leaf card is in front: no popping
    vec4 rp = vec4(position, 1.0);
    #ifdef USE_BATCHING
      rp = batchingMatrix * rp;
    #endif
    #ifdef USE_INSTANCING
      rp = instanceMatrix * rp;
    #endif
    rp = modelViewMatrix * rp;
    mvPosition.z = rp.z + corner.z * bbS;
  #endif
  gl_Position = projectionMatrix * mvPosition;
  #ifndef SM_DEPTH
    vNormal = normalize(vNormal + vec3(normalize(corner.xy + 1e-4) * 0.3, 0.0));
  #endif
}
#endif
`;

// House cut-away (v108, RuneScape style; globals.js cut*): up to two houses at once (the one you stand in and any house
// between the camera and you). Inside a slot's cut box (+0.2 m), above its wainscot line cutH.x:
//   * everything outside the footprint goes (eaves, porches, extensions, wall-face trims, signs, chimney stacks),
//   * the wall band (0.5 m in from the footprint's edge: the wall, its lining, sills, wall lanterns) goes,
//   * the partitions (cutP rects, 0.14 m round them: their lining and door frames) go,
//   * and inside the room, everything above the ceiling line cutH.y (roof, upper floors, joists) goes;
//   * cutK keeps one rect from the wall and partition rules (the wall hearth's breast, which stands against the wall).
// Furniture, floors and the hearth stay. The same test on every side, whatever the camera does (no camera-side walls
// that flip as the view turns). world.js caps the cut walls with a timber or stone sill strip just under cutH.x and
// eases cutH down from over the roof. smBoxHit: the last smCut point was inside an active cut box (the see-through
// disc leaves those alone: the house is already open, and its dither shimmered on the walls). Only SM_CUT materials and
// the AO normal pass use it, and (v109) the house shells' shadow pass (cutDepthMaterial).
export const CUT_PARS = /* glsl */ `
uniform float uCutOn;
uniform vec4 uCutA[2];
uniform vec4 uCutR[2];
uniform vec4 uCutF[2];
uniform vec4 uCutH[2];
uniform vec4 uCutP[12];
uniform vec4 uCutK[2];
bool smBoxHit = false;
bool smCut(vec3 p) {
  smBoxHit = false;
  if (uCutOn < 0.5) return false;
  for (int i = 0; i < 2; i++) {
    vec4 A = uCutA[i];
    if (A.w < 0.5) continue;
    vec2 d = p.xz - A.xy;
    float c = cos(A.z), s = sin(A.z);
    vec2 l = vec2(d.x * c - d.y * s, d.x * s + d.y * c);
    vec4 R = uCutR[i];
    if (l.x < R.x - 0.2 || l.x > R.z + 0.2 || l.y < R.y - 0.2 || l.y > R.w + 0.2) continue;
    smBoxHit = true;
    vec4 H = uCutH[i];
    if (p.y <= H.x) continue;
    vec4 F = uCutF[i];
    if (l.x < F.x || l.x > F.z || l.y < F.y || l.y > F.w) return true;
    if (p.y > H.y) return true;
    vec4 K = uCutK[i];
    if (l.x > K.x && l.x < K.z && l.y > K.y && l.y < K.w) continue;
    if (min(min(l.x - F.x, F.z - l.x), min(l.y - F.y, F.w - l.y)) < 0.5) return true;
    for (int j = 0; j < 6; j++) {
      vec4 P = uCutP[i * 6 + j];
      if (l.x > P.x - 0.14 && l.x < P.z + 0.14 && l.y > P.y - 0.14 && l.y < P.w + 0.14) return true;
    }
  }
  return false;
}
`;
const FRAG_CUT = /* glsl */ `
#ifdef SM_CUT
if (smCut(vWPos)) discard;
#endif
`;
export function cutUniforms(u) {
  return Object.assign(u, { uCutOn: G.cutOn, uCutA: G.cutA, uCutR: G.cutR, uCutF: G.cutF, uCutH: G.cutH, uCutP: G.cutP, uCutK: G.cutK });
}
// v109: the house shells' shadow caster (world.js buildHouses): the sun's depth pass with the same cut, so an open house's
// hidden roof and upper walls no longer shade the room (three copies each mesh's map / alphaTest onto it per draw)
let _cutDepth = null;
export function cutDepthMaterial() { return _cutDepth || (_cutDepth = patchCut(new THREE.MeshDepthMaterial())); }
// the same cut on another material (the AO pass's normal material): world position from the vertex, discard in the fragment
export function patchCut(material) {
  const base = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    base?.call(material, sh, r);
    cutUniforms(sh.uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCutW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { mat4 wmc = modelMatrix;
          #ifdef USE_INSTANCING
            wmc = modelMatrix * instanceMatrix;
          #endif
          #ifdef USE_BATCHING
            wmc = modelMatrix * batchingMatrix;
          #endif
          vCutW = (wmc * vec4(transformed, 1.0)).xyz; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCutW;\n' + CUT_PARS)
      .replace('void main() {', 'void main() {\nif (smCut(vCutW)) discard;');
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (key ? key() : '') + 'smcut';
  material.needsUpdate = true;
  return material;
}

const FRAG_PARS = /* glsl */ `
uniform vec2 uFadeCenter;
uniform float uFadeDepth;
uniform float uFadeRadius;
uniform float uFadeOn;
uniform vec2 uRes;
uniform sampler2D uCloudTex;
uniform vec2 uCloudOffset;
uniform float uCloudAmount;
varying vec3 vWPos;
varying float vVDepth;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
` + CUT_PARS;

const FRAG_FADE = /* glsl */ `
#ifdef SM_FADE
if (uFadeOn > 0.5 && !smBoxHit) {
  vec2 sp = gl_FragCoord.xy / uRes;
  vec2 dd = (sp - uFadeCenter) * vec2(uRes.x / uRes.y, 1.0);
  float r = length(dd);
  // a clean open disc with a thin dithered rim, so the hero shows through without speckle
  float k = (1.0 - smoothstep(uFadeRadius * 0.78, uFadeRadius, r)) * smoothstep(uFadeDepth - 0.8, uFadeDepth - 3.5, vVDepth);
  if (k > ign(gl_FragCoord.xy) * 0.98 + 0.01) discard;
}
#endif
`;

const FRAG_CLOUD = /* glsl */ `
#ifdef SM_CLOUD
{
  float cl = texture2D(uCloudTex, vWPos.xz * 0.0026 + uCloudOffset).r;
  gl_FragColor.rgb *= 1.0 - cl * uCloudAmount;
}
#endif
`;

function bindUniforms(shader) {
  Object.assign(shader.uniforms, {
    uTime: G.time,
    uWindDir: G.windDir,
    uWindStrength: G.windStrength,
    uPlayerPos: G.playerPos,
    uFadeCenter: G.fadeCenter,
    uFadeDepth: G.fadeDepth,
    uFadeRadius: G.fadeRadius,
    uFadeOn: G.fadeOn,
    uRes: G.resolution,
    uCloudTex: G.cloudTex,
    uCloudOffset: G.cloudOffset,
    uCloudAmount: G.cloudAmount,
  });
  cutUniforms(shader.uniforms);
}

// wind-animated solids (leaf-mass cores, branches): depth from the rest position too, so cores and cards
// keep a fixed order while everything sways
const VERT_RESTZ = /* glsl */ `
#if !defined(SM_BILLBOARD) && !defined(SM_DEPTH)
{
  vec4 rp = vec4(position, 1.0);
  #ifdef USE_BATCHING
    rp = batchingMatrix * rp;
  #endif
  #ifdef USE_INSTANCING
    rp = instanceMatrix * rp;
  #endif
  rp = modelViewMatrix * rp;
  mvPosition.z = rp.z;
  gl_Position = projectionMatrix * mvPosition;
}
#endif
`;

export function patchVertex(shader, wind) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + VERT_PARS)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (wind ? VERT_WIND : ''))
    .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_OUT + VERT_BB + (wind ? VERT_RESTZ : ''));
}

// Patch any built-in material. opts: { wind, fade, cloud }
export function patchWorld(material, { wind = false, fade = false, cloud = true, noFlip = false, cut = fade } = {}) {
  material.defines = material.defines || {};
  if (fade) material.defines.SM_FADE = '';
  if (cut) material.defines.SM_CUT = '';
  if (cloud) material.defines.SM_CLOUD = '';
  material.onBeforeCompile = (shader) => {
    bindUniforms(shader);
    patchVertex(shader, wind);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('void main() {', 'void main() {\n' + FRAG_CUT + FRAG_FADE)
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n' + FRAG_CLOUD);
    if (material.userData.foliage) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `
        {
          vec2 tsz = vec2(512.0);
          vec2 ddx = dFdx(vMapUv * tsz), ddy = dFdy(vMapUv * tsz);
          float mip = max(0.0, 0.5 * log2(max(dot(ddx, ddx), dot(ddy, ddy))));
          diffuseColor.a *= 1.0 + mip * 0.28;
          diffuseColor.a = (diffuseColor.a - alphaTest) / max(fwidth(diffuseColor.a), 0.0001) + 0.5;
          if (diffuseColor.a < 0.02) discard;
          diffuseColor.a = clamp(diffuseColor.a, 0.0, 1.0);
        }`);
    }
    // foliage cards carry hand-made spherical normals: keep them identical on both faces
    if (noFlip) {
      const chunk = THREE.ShaderChunk.normal_fragment_begin.replace(/normal \*= faceDirection;/g, '');
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', chunk);
    }
  };
  material.customProgramCacheKey = () => `sm${wind ? 'w' : ''}${fade ? 'f' : ''}${cut ? 'x' : ''}${cloud ? 'c' : ''}${noFlip ? 'n' : ''}${material.userData.billboard ? 'b' : ''}${material.userData.foliage ? 'L' : ''}`;
  return material;
}

// ---- upgrade heat and the Prismatic sheen (plan C). Physical only: the steel glows on the blackbody ramp (+7 dull red
// seams, +8 cherry with a straw temper tint, +9 bright orange with temper bands, +10 a yellow-white core with a cherry
// rim) and a Prismatic piece carries a thin-film oxide sheen in its specular reflection only (straw, bronze, peacock,
// blue: the colours tempered steel takes), never emissive and never an aura. One shared uniform set (HEAT_U) drives every
// patched material. Two modes: 'attr' reads the per-vertex attribute `upg` (x heat stage 0 or 7..10, negative -7..-10
// for the temper tint without the glow (helms: nothing lit near a face), y film 0/1: worn
// gear on a character's own meshes, no extra draw calls), 'uniform' reads the material's own uUpg (the shared heat
// materials of weapons, shields and shoulder pieces, client/assets/heat.js).
export const HEAT_U = {
  uHeatFx: { value: 2 }, // 0 off (no heat; the sheen stays: it is the rarity's look), 1 simple (steady), 2 full (shimmer)
  uHeatT: G.time,
};
const HEAT_VERT = /* glsl */ `
#ifdef SM_UPG_ATTR
attribute vec2 upg;
#else
uniform vec2 uUpg;
#endif
varying vec2 vUpg;
varying vec3 vHeatP;
`;
const HEAT_FRAG_PARS = /* glsl */ `
uniform float uHeatFx;
uniform float uHeatT;
varying vec2 vUpg;
varying vec3 vHeatP;
// the blackbody ramp, linear light: dull red (~700 C), cherry (~850 C), orange (~1000 C), yellow-white (~1250 C)
vec3 heatRamp(float s) {
  vec3 c = mix(vec3(0.0), vec3(0.42, 0.035, 0.008), clamp(s, 0.0, 1.0));
  c = mix(c, vec3(0.80, 0.10, 0.02), clamp(s - 1.0, 0.0, 1.0));
  c = mix(c, vec3(1.00, 0.36, 0.05), clamp(s - 2.0, 0.0, 1.0));
  return mix(c, vec3(1.00, 0.80, 0.46), clamp(s - 3.0, 0.0, 1.0));
}
// the temper colours of steel, in order (straw, bronze, peacock, blue), cycled
vec3 temperCol(float f) {
  f = fract(f) * 4.0;
  vec3 a = vec3(0.89, 0.66, 0.20), b = vec3(0.56, 0.25, 0.06), c = vec3(0.19, 0.08, 0.58), d = vec3(0.05, 0.21, 0.77);
  return f < 1.0 ? mix(a, b, f) : f < 2.0 ? mix(b, c, f - 1.0) : f < 3.0 ? mix(c, d, f - 2.0) : mix(d, a, f - 3.0);
}
// one family of wavy, roughly level seams (plate joints): never two crossing families, so no cross or X shapes
float heatSeam(vec3 p, float w) {
  float s = abs(sin(p.y * 15.0 + 1.7 * sin(p.x * 9.0 + 0.6) + 1.3 * sin(p.z * 11.0)));
  return 1.0 - smoothstep(0.0, w, s);
}
`;
export function patchHeat(material, mode = 'uniform') {
  const attr = mode === 'attr';
  material.defines = material.defines || {};
  if (attr) material.defines.SM_UPG_ATTR = ''; else delete material.defines.SM_UPG_ATTR;
  if (!attr && !material.userData.upg) material.userData.upg = { value: new THREE.Vector2(0, 0) };
  if (material.userData.heatPatched) { material.needsUpdate = true; return material; }
  material.userData.heatPatched = true;
  const base = material.onBeforeCompile, ck = material.customProgramCacheKey;
  material.onBeforeCompile = (sh, r) => {
    base?.call(material, sh, r);
    sh.uniforms.uHeatFx = HEAT_U.uHeatFx; sh.uniforms.uHeatT = HEAT_U.uHeatT;
    if (material.userData.upg) sh.uniforms.uUpg = material.userData.upg;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + HEAT_VERT)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef SM_UPG_ATTR\nvUpg = upg;\n#else\nvUpg = uUpg;\n#endif\nvHeatP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + HEAT_FRAG_PARS)
      // the temper tint (+8 straw, +9 bands) sits in the steel's own colour
      .replace('#include <color_fragment>', `#include <color_fragment>
  float hS = uHeatFx > 0.5 ? clamp(abs(vUpg.x) - 6.0, 0.0, 4.0) : 0.0;
  float hGlow = vUpg.x > 0.0 ? 1.0 : 0.0; // negative stages: the temper tint only
  if (hS > 0.01) {
    vec3 straw = vec3(0.86, 0.68, 0.36);
    vec3 tint = mix(straw, temperCol(vHeatP.y * 2.2 + 0.15) * 1.25, clamp(hS - 2.0, 0.0, 1.0));
    diffuseColor.rgb *= mix(vec3(1.0), tint, clamp(hS - 1.0, 0.0, 1.0) * 0.55);
    diffuseColor.rgb *= 1.0 - 0.25 * hGlow * clamp(hS - 3.0, 0.0, 1.0); // white-hot steel reads by its own light
  }`)
      // the glow: seams on the blackbody ramp, a body glow from +9, a core with a cooler rim at +10
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  if (hS * hGlow > 0.01) {
    float flick = uHeatFx > 1.5 ? 0.9 + 0.1 * sin(uHeatT * 2.3 + vHeatP.y * 5.0 + vHeatP.x * 3.0) : 1.0;
    float seam = heatSeam(vHeatP, 0.1 + 0.05 * hS);
    float face = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
    vec3 glow = heatRamp(hS) * (seam * (0.45 + 0.12 * hS) + 0.05 * clamp(hS - 2.0, 0.0, 1.0));
    // +10: a yellow-white core where the steel faces you, the rim stays cherry
    float core = clamp(hS - 3.0, 0.0, 1.0);
    glow += (heatRamp(4.0) * face * face * 0.14 + heatRamp(2.0) * (1.0 - face) * (1.0 - face) * 0.3) * core;
    totalEmissiveRadiance += glow * flick;
  }`)
      // the Prismatic sheen: the specular light alone takes the oxide colour, by view angle and a slow drift of thickness
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
  if (vUpg.y > 0.5) {
    float nv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
    vec3 film = temperCol(0.15 + 1.9 * (1.0 - nv) + 0.3 * sin(vHeatP.y * 6.0 + vHeatP.x * 4.0 + vHeatP.z * 3.0));
    vec3 k = mix(vec3(1.0), film * 2.1, 0.92);
    reflectedLight.directSpecular *= k;
    reflectedLight.indirectSpecular *= k;
  }`);
  };
  material.customProgramCacheKey = () => (ck ? ck.call(material) : '') + (material.defines.SM_UPG_ATTR !== undefined ? 'heatA' : 'heatU');
  material.needsUpdate = true;
  return material;
}

// ---- hide parts of a character under worn armour models (client/assets/dsArmour.js): the per-vertex `hpart` (a body part
// number, 0 = never hidden) against the material's own bit mask uHide (material.userData.uHide.value: bit n hides part n).
// A hidden triangle's corners all go to one point outside the view, so nothing of it is drawn (no extra draw calls, the
// meshes stay shared). Every mesh drawn with a patched material needs the attribute (dsArmour gives zeros where none).
export function patchHide(material) {
  if (material.userData.hidePatched) return material;
  material.userData.hidePatched = true;
  const u = (material.userData.uHide = { value: 0 });
  const base = material.onBeforeCompile, ck = material.customProgramCacheKey;
  material.onBeforeCompile = (sh, r) => {
    base?.call(material, sh, r);
    sh.uniforms.uHide = u;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float hpart;\nuniform float uHide;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  if (hpart > 0.5 && mod(floor(uHide / exp2(floor(hpart + 0.5))), 2.0) > 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);');
  };
  material.customProgramCacheKey = () => (ck ? ck.call(material) : '') + 'hide';
  material.needsUpdate = true;
  return material;
}

// Depth material for shadows that applies the same wind (and alpha cut-out).
export function windDepthMaterial(src) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: src.map || null, alphaTest: src.alphaTest || 0 });
  const bb = !!src.userData.billboard;
  m.defines = { SM_DEPTH: '' };
  if (bb) m.defines.SM_BILLBOARD = '';
  m.onBeforeCompile = (shader) => {
    bindUniforms(shader);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec3 objectNormal = normal;\n' + VERT_WIND)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_OUT + VERT_BB);
  };
  m.customProgramCacheKey = () => 'smdepthw' + (bb ? 'b' : '');
  return m;
}

// ---------------------------------------------------------------------------
const reg = new Map();

// emissive taken from the vertex colour (quality trims glow in their own hue)
function vcGlow(m) {
  const base = m.onBeforeCompile, key = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    base(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;');
  };
  m.customProgramCacheKey = () => key() + 'vcg';
  return m;
}

// lit window glass: lit by the sun and sky only, never by the moving pool of point lights (so a pane never brightens or
// dims as the pool's lights are handed from lamp to lamp while you walk), and its glow held just under the bloom
// threshold, so small and distant panes never sparkle in the bloom as the camera moves
function paneGlow(m, cap = 0.98) {
  const base = m.onBeforeCompile, key = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    base(sh, r);
    // three fills the light counts in by text after this hook, so the point-light block is inlined with its count set to 0
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(/NUM_POINT_LIGHT_SHADOWS|NUM_POINT_LIGHTS/g, '0'))
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float el = dot(totalEmissiveRadiance, vec3(0.2126, 0.7152, 0.0722)); if (el > ${cap.toFixed(3)}) totalEmissiveRadiance *= ${cap.toFixed(3)} / el; }`);
  };
  m.customProgramCacheKey = () => key() + 'pane';
  // and a nudge toward the lens in the depth test, so a pane that touches its wall or frame face never z-fights with it
  // (every builder also keeps its panes clear of coplanar faces; this is the safety net, far smaller than the 1 cm gaps
  // between panes and the mullions in front of them)
  m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
  return m;
}

// a photo texture from client/assets/tex (CC0 materials, see CREDITS.txt there), tiling
function photoTex(f, srgb) {
  const t = new THREE.TextureLoader().load('/sunmere-play/assets/tex/' + f);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function std(key, o) {
  const m = new THREE.MeshStandardMaterial({
    color: o.color ?? 0xffffff,
    map: o.tex?.map ?? null,
    normalMap: o.tex?.normalMap ?? null,
    roughness: o.rough ?? 0.88,
    metalness: o.metal ?? 0,
    vertexColors: true,
    side: o.side ?? THREE.FrontSide,
    alphaTest: o.alphaTest ?? 0,
    transparent: o.transparent ?? false,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    emissiveMap: o.emissiveMap ?? null,
    envMapIntensity: o.env ?? 1,
    depthWrite: o.depthWrite ?? true,
    opacity: o.opacity ?? 1,
  });
  if (m.normalMap) m.normalScale.set(o.normalScale ?? 0.8, o.normalScale ?? 0.8);
  if (o.alphaToCoverage) m.alphaToCoverage = true;
  if (o.billboard) { m.defines = { ...(m.defines || {}), SM_BILLBOARD: '' }; m.userData.billboard = true; }
  if (o.foliage) m.userData.foliage = true;
  patchWorld(m, { wind: !!o.wind, fade: o.fade ?? true, cloud: o.cloud ?? true, noFlip: !!o.noFlip, cut: o.cut ?? o.fade ?? true });
  m.userData.wind = !!o.wind;
  m.name = key;
  return m;
}

const DEFS = {
  // building
  wood: () => std('wood', { tex: T.planksTex('wood', { base: '#8a5a32' }) }),
  woodDark: () => std('woodDark', { tex: T.planksTex('woodDark', { base: '#5e3c22' }) }),
  woodLight: () => std('woodLight', { tex: T.planksTex('woodLight', { base: '#a8794a' }) }),
  beam: () => std('beam', { tex: T.barkTex('beam', { base: '#5a3a20', light: '#8a6038' }), normalScale: 0.5 }),
  stone: () => std('stone', { tex: T.stoneBrickTex('stone', { base: '#b8ae9c', rows: 8 }) }),
  stoneDark: () => std('stoneDark', { tex: T.stoneBrickTex('stoneDark', { base: '#8f887c', rows: 6, moss: 0.45 }) }),
  stoneLarge: () => std('stoneLarge', { tex: T.stoneBrickTex('stoneLarge', { base: '#a69c8a', rows: 4, moss: 0.3, block: 0.6 }) }),
  cobble: () => std('cobble', { tex: T.cobbleTex() }),
  slate: () => std('slate', { tex: T.shinglesTex('slate', { base: '#3e5c9a' }), rough: 0.7 }),
  slateRed: () => std('slateRed', { tex: T.shinglesTex('slateRed', { base: '#9a3a2a' }), rough: 0.75 }),
  shingleWood: () => std('shingleWood', { tex: T.shinglesTex('shingleWood', { base: '#7a5230', round: false, rows: 9 }) }),
  mossRoof: () => std('mossRoof', { tex: T.mossRoofTex() }),
  thatch: () => std('thatch', { tex: T.thatchTex(), rough: 1 }), // (houses: courses of straw, see textures.js thatchTex)
  plaster: () => std('plaster', { tex: T.plasterTex() }),
  sandstone: () => std('sandstone', { tex: T.sandstoneTex() }),
  rock: () => std('rock', { tex: T.rockTex() }),
  // dark layered rock from a CC0 photo material (ambientCG Rock 031): the Cinder Reach's basalt boulders and columns.
  // The colour map is lifted to the painted rock's mid grey, so the builders' dark vertex tints work the same
  basalt: () => std('basalt', { tex: { map: photoTex('basalt_color.jpg', true), normalMap: photoTex('basalt_normal.jpg') }, rough: 0.82, normalScale: 1.1 }),
  rockSand: () => std('rockSand', { tex: T.rockTex(), color: 0xf0c48c }),
  dirtPlain: () => std('dirtPlain', { tex: T.dirtTex(), fade: false }),
  rockNoFade: () => std('rockNoFade', { tex: T.rockTex(), fade: false }),
  // dungeon interiors: floors never dither (they lie under the hero), nothing takes cloud shadows underground
  dFloorMine: () => std('dFloorMine', { tex: T.rockTex(), fade: false, cloud: false, color: 0x9a8a76, normalScale: 0.6 }),
  dFloorVault: () => std('dFloorVault', { tex: T.sandstoneTex(), fade: false, cloud: false, color: 0xe8d8bc }),
  dFloorFoundry: () => std('dFloorFoundry', { tex: T.cobbleTex(), fade: false, cloud: false, color: 0x8a8078 }),
  dWallMine: () => std('dWallMine', { tex: T.rockTex(), cloud: false, color: 0xa89480 }),
  dWallVault: () => std('dWallVault', { tex: T.sandstoneTex(), cloud: false }),
  dWallFoundry: () => std('dWallFoundry', { tex: T.stoneBrickTex('dWallFoundry', { base: '#7a6458', rows: 8 }), cloud: false }),
  dCap: () => std('dCap', { tex: T.rockTex(), cloud: false, color: 0x2e2824, rough: 1 }),
  // the Deepway: grey dressed stone, flagged floors, channel water lit by lamps sunk under it
  dWallDeep: () => std('dWallDeep', { tex: T.stoneBrickTex('dWallDeep', { base: '#9a917e', rows: 7, mortar: '#524c42', moss: 0.06 }), cloud: false }),
  dFloorDeep: () => std('dFloorDeep', { tex: T.flagstoneTex(), fade: false, cloud: false, normalScale: 0.7 }),
  // the Makers' Rest: the workshop's boarded floor (never dithered: it lies under the hero)
  dFloorBoard: () => std('dFloorBoard', { tex: T.planksTex('dFloorBoard', { base: '#9a7650', boards: 8 }), fade: false, cloud: false, normalScale: 0.6 }),
  // its own copy of the water normals, scrolled by the Deepway so the channels flow
  dWaterDeep: () => { const n = T.waterNormalTex().clone(); n.wrapS = n.wrapT = THREE.RepeatWrapping; n.needsUpdate = true; return std('dWaterDeep', { tex: { normalMap: n }, normalScale: 0.6, color: 0x123438, emissive: 0x0e4a50, emissiveIntensity: 0.3, rough: 0.32, metal: 0, fade: false }); }, // calm, deep water: soft broad highlights, no pixel sparkle
  dTimber: () => std('dTimber', { tex: T.barkTex('dTimber', { base: '#5a3a20', light: '#8a6038' }), cloud: false, normalScale: 0.5 }),
  dIron: () => std('dIron', { tex: { map: T.metalTex().map }, rough: 0.55, metal: 0.7, color: 0x6a6a70, cloud: false }),
  dBrass: () => std('dBrass', { tex: { map: T.metalTex().map }, rough: 0.35, metal: 1, color: 0xd9a650, cloud: false }),
  // cooling lava crust from a CC0 photo material (ambientCG Lava 002, see client/assets/tex/CREDITS.txt): dark glassy
  // crust, its cracks lit by the emission map
  lavaCrust: () => {
    const L = new THREE.TextureLoader(), ld = (f, srgb) => { const t = L.load('/sunmere-play/assets/tex/' + f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
    return std('lavaCrust', { tex: { map: ld('lava2_color.jpg', true), normalMap: ld('lava2_normal.jpg') }, color: 0xb8b0a8, emissive: 0xff6a20, emissiveIntensity: 0.9, emissiveMap: ld('lava2_emit.jpg', true), rough: 0.55, normalScale: 1.0 });
  },
  // the Rime Steps: glassy ice (frozen falls, floes, ice-locked works) and packed snow on roofs and ledges
  stoneCold: () => std('stoneCold', { tex: T.stoneBrickTex('stoneCold', { base: '#b4b6b8', rows: 8, moss: 0, mortar: '#62666c' }) }),
  stoneColdDark: () => std('stoneColdDark', { tex: T.stoneBrickTex('stoneColdDark', { base: '#8c9096', rows: 6, moss: 0, mortar: '#4e5258' }) }),
  stoneColdLarge: () => std('stoneColdLarge', { tex: T.stoneBrickTex('stoneColdLarge', { base: '#a4a8ae', rows: 4, moss: 0, block: 0.6, mortar: '#5a5e64' }) }),
  ice: () => std('ice', { color: 0xd8ecf8, rough: 0.12, metal: 0.05, env: 1.7, emissive: 0x1c3c52, emissiveIntensity: 0.35 }),
  iceBlue: () => std('iceBlue', { color: 0x8cbcdc, rough: 0.1, metal: 0.05, env: 2.0, emissive: 0x0e2c46, emissiveIntensity: 0.5 }),
  snowPack: () => std('snowPack', { tex: { normalMap: T.plasterTex().normalMap }, color: 0xd8e0ea, rough: 0.92, normalScale: 0.5 }),
  molten: () => std('molten', { color: 0xffa050, emissive: 0xff5a10, emissiveIntensity: 1.25, rough: 1, cloud: false, fade: false }),
  cloth: () => std('cloth', { tex: T.clothTex(), side: THREE.DoubleSide, normalScale: 0.6 }),
  clothWind: () => std('clothWind', { tex: T.clothTex(), side: THREE.DoubleSide, wind: true, normalScale: 0.6 }),
  leather: () => std('leather', { tex: T.leatherTex(), rough: 0.7 }),
  metal: () => std('metal', { tex: { map: T.metalTex().map }, rough: 0.38, metal: 0.85, color: 0xb8bcc4 }),
  iron: () => std('iron', { tex: { map: T.metalTex().map }, rough: 0.55, metal: 0.7, color: 0x6a6a70 }),
  gold: () => std('gold', { tex: { map: T.metalTex().map }, rough: 0.3, metal: 1, color: 0xf0c060 }),
  brass: () => std('brass', { tex: { map: T.metalTex().map }, rough: 0.35, metal: 1, color: 0xd9a650 }),
  copper: () => std('copper', { tex: { map: T.metalTex().map }, rough: 0.4, metal: 1, color: 0xd07a4a }),
  // weapons / held items (never faded)
  wMetal: () => std('wMetal', { tex: { map: T.metalTex().map }, rough: 0.28, metal: 0.92, color: 0xc8ccd4, fade: false, env: 1.4 }),
  // weapon steels: warm-tinted so the sky reflection reads as steel, not blue; a bright honed edge; a dark fuller
  wSteel: () => std('wSteel', { tex: { map: T.metalTex().map }, rough: 0.36, metal: 0.6, color: 0xdedcd6, fade: false, env: 1.0 }),
  wEdge: () => std('wEdge', { tex: { map: T.metalTex().map }, rough: 0.18, metal: 0.7, color: 0xffffff, fade: false, env: 1.2 }),
  wSteelDark: () => std('wSteelDark', { tex: { map: T.metalTex().map }, rough: 0.5, metal: 0.7, color: 0x5c5e64, fade: false }),
  wIronW: () => std('wIronW', { tex: { map: T.metalTex().map }, rough: 0.5, metal: 0.5, color: 0xaaa8a2, fade: false, env: 0.9 }),
  // accents in the item quality colour (Rare, Epic, Legendary): polished metal, never self-lit (no magic glows, content
  // rules): Rare a blued steel, Epic a violet-tempered steel, Legendary polished gold
  wQ3: () => std('wQ3', { tex: { map: T.metalTex().map }, color: 0x9cbcec, rough: 0.16, metal: 0.85, fade: false, env: 1.4 }),
  wQ4: () => std('wQ4', { tex: { map: T.metalTex().map }, color: 0xc0a4e8, rough: 0.16, metal: 0.85, fade: false, env: 1.4 }),
  wQ5: () => std('wQ5', { tex: { map: T.metalTex().map }, color: 0xffcc66, rough: 0.14, metal: 1, fade: false, env: 1.5 }),
  // Prismatic: a polished tempered steel; its colour play is the thin-film sheen in the reflection (patchHeat), never a glow
  wQ6: () => std('wQ6', { tex: { map: T.metalTex().map }, color: 0xc8c4d8, rough: 0.14, metal: 1, fade: false, env: 1.5 }),
  wDark: () => std('wDark', { tex: { map: T.metalTex().map }, rough: 0.45, metal: 0.8, color: 0x6a6e78, fade: false }),
  wGold: () => std('wGold', { tex: { map: T.metalTex().map }, rough: 0.25, metal: 1, color: 0xf2c25e, fade: false, env: 1.4 }),
  wBronze: () => std('wBronze', { tex: { map: T.metalTex().map }, rough: 0.4, metal: 0.85, color: 0xd09a58, fade: false }),
  wVerdigris: () => std('wVerdigris', { tex: { map: T.metalTex().map }, rough: 0.75, metal: 0.35, color: 0x8ab8a0, fade: false }),
  wBrass: () => std('wBrass', { tex: { map: T.metalTex().map }, rough: 0.32, metal: 1, color: 0xd9a650, fade: false }),
  wCopper: () => std('wCopper', { tex: { map: T.metalTex().map }, rough: 0.4, metal: 1, color: 0xd07a4a, fade: false }),
  wIron: () => std('wIron', { tex: { map: T.metalTex().map }, rough: 0.6, metal: 0.75, color: 0x7a7a80, fade: false }),
  wPaint: () => std('wPaint', { tex: { map: T.metalTex().map }, rough: 0.55, metal: 0.25, color: 0xffffff, fade: false }), // painted steel: reads its colour in any light
  // worn armour: same metal as the characters' own plate, so overlays match the class pauldrons
  wArmour: () => std('wArmour', { tex: { map: T.metalTex().map }, rough: 0.36, metal: 0.78, color: 0xffffff, fade: false, env: 1.1 }),
  wMail: () => std('wMail', { tex: T.mailTex(), rough: 0.45, metal: 0.8, color: 0xb0b4ba, fade: false, normalScale: 1.0, env: 1.2 }),
  // quality trim: white base so the vertex colour shows the exact quality hue
  wTrim: () => std('wTrim', { tex: { map: T.metalTex().map }, rough: 0.3, metal: 0.6, color: 0xffffff, fade: false, env: 1.2 }),
  // Rare and up: the same trim polished brighter (not self-lit)
  wTrimPolish: () => std('wTrimPolish', { tex: { map: T.metalTex().map }, rough: 0.18, metal: 0.75, color: 0xffffff, fade: false, env: 1.4 }),
  // a chemist's reagent tube: tinted glass, lit by the scene only (no glow on weapons)
  wReagent: () => std('wReagent', { color: 0xb898e0, rough: 0.12, metal: 0.1, fade: false, env: 1.4 }),
  // rusted plate from a CC0 photo material (ambientCG Rust 009): mottled orange-brown scale with fine pitting
  wRust: () => std('wRust', { tex: { map: photoTex('rust_color.jpg', true), normalMap: photoTex('rust_normal.jpg') }, rough: 0.85, metal: 0.3, color: 0xc8c0b8, fade: false, normalScale: 0.9 }),
  wGlowOrange: () => std('wGlowOrange', { color: 0xffc080, emissive: 0xff7a20, emissiveIntensity: 3.2, rough: 0.3, fade: false }),
  wWood: () => std('wWood', { tex: T.barkTex('wwood', { base: '#7a5230', light: '#b4864e' }), fade: false, normalScale: 0.4 }),
  wLeather: () => std('wLeather', { tex: T.leatherTex(), rough: 0.6, fade: false }),
  wCloth: () => std('wCloth', { tex: T.clothTex(), fade: false, side: THREE.DoubleSide }),
  wGlowBlue: () => std('wGlowBlue', { color: 0x9ad8ff, emissive: 0x3a9aff, emissiveIntensity: 2.2, rough: 0.2, fade: false }),
  // running water on the boss engines: wet and bright, but not self-lit (no glowing columns, content rules)
  wWet: () => std('wWet', { color: 0x8cc4e0, emissive: 0x2a6a9a, emissiveIntensity: 0.35, rough: 0.12, fade: false }),
  wGlowGreen: () => std('wGlowGreen', { color: 0xc8ff8a, emissive: 0x7ae04a, emissiveIntensity: 2.4, rough: 0.2, fade: false }),
  wGlowPurple: () => std('wGlowPurple', { color: 0xe0b8ff, emissive: 0xa060ff, emissiveIntensity: 2.4, rough: 0.2, fade: false }),
  wGlowRed: () => std('wGlowRed', { color: 0xffb0a0, emissive: 0xff5030, emissiveIntensity: 2.2, rough: 0.2, fade: false }),
  wGlowAmber: () => std('wGlowAmber', { color: 0xffe0a0, emissive: 0xffa030, emissiveIntensity: 2.4, rough: 0.2, fade: false }),
  carpetBlue: () => std('carpetBlue', { tex: T.carpetTex('#2e4a92'), fade: false }),
  carpetRed: () => std('carpetRed', { tex: T.carpetTex('#8e2a2a'), fade: false }),
  bannerSun: () => std('bannerSun', { tex: T.bannerTex('sun', '#2e4a92'), side: THREE.DoubleSide, wind: true, alphaTest: 0.5 }),
  bannerLeaf: () => std('bannerLeaf', { tex: T.bannerTex('leaf', '#4a6a2a'), side: THREE.DoubleSide, wind: true, alphaTest: 0.5 }),
  bannerRed: () => std('bannerRed', { tex: T.bannerTex('diamond', '#8e2a2a'), side: THREE.DoubleSide, wind: true, alphaTest: 0.5 }),
  bannerTower: () => std('bannerTower', { tex: T.bannerTex('tower', '#2e4a92'), side: THREE.DoubleSide, wind: true, alphaTest: 0.5 }),
  // still, dark well water (glossy, picks up the sky in reflections)
  wellWater: () => std('wellWater', { color: 0x10303a, rough: 0.08, metal: 0.1 }),
  // glow
  glassWarm: () => paneGlow(std('glassWarm', { color: 0xffc860, emissive: 0xffa53a, emissiveIntensity: 1.35, rough: 1, fade: true, cloud: false })),
  // the guild hall's open doorway: a dim lamp-lit interior, never bright enough to bloom even in the noon sun
  doorWarm: () => paneGlow(std('doorWarm', { color: 0x1a100a, emissive: 0xc8742a, emissiveIntensity: 0.3, rough: 1, env: 0.1, fade: true, cloud: false }), 0.32),
  glowYellow: () => std('glowYellow', { color: 0xffe08a, emissive: 0xffc04a, emissiveIntensity: 1.6, rough: 1 }),
  glowGreen: () => std('glowGreen', { color: 0xc8ff7a, emissive: 0x8ee84a, emissiveIntensity: 1.6, rough: 1 }),
  glowPurple: () => std('glowPurple', { color: 0xe0b0ff, emissive: 0xb070ff, emissiveIntensity: 1.8, rough: 1 }),
  glowTeal: () => std('glowTeal', { color: 0xa0fff0, emissive: 0x40e0d0, emissiveIntensity: 1.7, rough: 1 }),
  fire: () => std('fire', { color: 0xffb060, emissive: 0xff7a20, emissiveIntensity: 4, rough: 1, cloud: false }),
  canopyRed: () => std('canopyRed', { tex: T.stripeTex('#a3362a', '#efe0bf', 8), side: THREE.DoubleSide, wind: true, normalScale: 0.5 }),
  canopyBlue: () => std('canopyBlue', { tex: T.stripeTex('#2e4a92', '#efe0bf', 8), side: THREE.DoubleSide, wind: true, normalScale: 0.5 }),
  targetFace: () => std('targetFace', { tex: T.targetTex(), rough: 1 }),
  straw: () => std('straw', { tex: T.clothTex(), color: 0xd8b860, rough: 1, normalScale: 1.2 }),
  // (crystals are plain cut glass and quartz: a faint inner light, never a magical glow)
  crystalBlue: () => std('crystalBlue', { color: 0xa8d8ff, emissive: 0x3a7ae8, emissiveIntensity: 0.35, rough: 0.12, metal: 0.1, env: 2 }),
  crystalPurple: () => std('crystalPurple', { color: 0xb88cff, emissive: 0x7a3ae0, emissiveIntensity: 0.3, rough: 0.15, metal: 0.1, env: 2 }),
  crystalTeal: () => std('crystalTeal', { color: 0x8ff0e8, emissive: 0x2ab8b0, emissiveIntensity: 1.0, rough: 0.15, metal: 0.1, env: 2 }),
  crystalGreen: () => std('crystalGreen', { color: 0xa8f070, emissive: 0x4aa82a, emissiveIntensity: 1.0, rough: 0.15, metal: 0.1, env: 2 }),
  // nature
  bark: () => std('bark', { tex: T.barkTex('bark'), wind: true }),
  barkDark: () => std('barkDark', { tex: T.barkTex('barkDark', { base: '#4f3a28', light: '#7a5a3a' }), wind: true }),
  barkGold: () => std('barkGold', { tex: T.barkTex('barkGold', { base: '#8a6a32', light: '#d8b45a' }), wind: true }),
  barkPurple: () => std('barkPurple', { tex: T.barkTex('barkPurple', { base: '#6a4a6a', light: '#a07aa8' }), wind: true }),
  barkPalm: () => std('barkPalm', { tex: T.barkTex('barkPalm', { base: '#7a5a34', light: '#b8925a' }), wind: true }),
  leafOak: () => foliage('leafOak', T.clumpCardTex('oak', ['#29391a', '#45602a', '#6d8a34', '#a2b44a', '#dcd88a']), { billboard: true }),
  leafOakYoung: () => foliage('leafOakYoung', T.clumpCardTex('oakY', ['#33461c', '#58722a', '#879e38', '#bcc254', '#efe69c'], { seed: 3 }), { billboard: true }),
  leafTree: () => foliage('leafTree', T.clumpCardTex('treehouse', ['#1e3a1c', '#36602a', '#5c8a32', '#8fb648', '#cde07a'], { seed: 5 }), { billboard: true }),
  coreOak: () => core('coreOak', T.leafMassTex('oak', ['#1e3216', '#34521e', '#557a28', '#8aa83a'])),
  coreTree: () => core('coreTree', T.leafMassTex('tree', ['#1a3218', '#2e5424', '#4f7f2e', '#80aa40'])),
  coreLilac: () => core('coreLilac', T.leafMassTex('lilac', ['#2e1c50', '#4a2e80', '#7452b4', '#a888e0'])),
  coreGlow: () => core('coreGlow', T.leafMassTex('glow', ['#5a5620', '#8e8636', '#c4b85a', '#e8dc8c']), { emissive: 0x2a2406 }),
  coreBush: () => core('coreBush', T.leafMassTex('bush', ['#18301a', '#2a4c20', '#466e2a', '#78a03a'])),
  leafPine: () => foliage('leafPine', T.pineCardTex()),
  pineSkirt: () => std('pineSkirt', { tex: T.needleTex(), side: THREE.DoubleSide, wind: true, rough: 0.95, env: 0.6, normalScale: 0.7 }),
  pineClump: () => foliage('pineClump', T.clumpCardTex('pine', ['#132a1c', '#1f4028', '#2f5a34', '#55823e', '#a4bc5c'], { needles: true, strokes: 700, leafLen: [26, 44], seed: 4 }), { billboard: true }),
  leafLilac: () => foliage('leafLilac', T.clumpCardTex('lilac', ['#2e1a56', '#4e2e8c', '#7a52c4', '#a888ec', '#e2d2ff'], { floret: true, strokes: 900 }), { billboard: true }),
  leafGlow: () => foliage('leafGlow', T.clumpCardTex('glow', ['#5e5a24', '#9a9238', '#cfc25a', '#f0e48c', '#fffbd8'], { floret: true, strokes: 900 }), { emissive: 0x3a3208, emissiveIntensity: 0.9, billboard: true }),
  leafPalm: () => foliage('leafPalm', T.palmCardTex()),
  fern: () => foliage('fern', T.fernCardTex(), { fade: false }),
  moss: () => foliage('moss', T.mossStrandTex()),
  ivy: () => foliage('ivy', T.ivyCardTex()),
  wisteria: () => foliage('wisteria', T.blossomCardTex('wisteria', ['#4e2f8a', '#8a64d6', '#cdb6ff'], { clusters: 90 })),
  bushRed: () => foliage('bushRed', T.clumpCardTex('redbush', ['#5a1418', '#8e2226', '#c4383a', '#ee6a5e', '#ffb4a0'], { floret: true, strokes: 700, seed: 2 }), { fade: false, billboard: true }),
  bushGreen: () => foliage('bushGreen', T.clumpCardTex('bush', ['#1c3416', '#335a22', '#558030', '#86a840', '#c2d070'], { seed: 9, leafLen: [18, 32] }), { fade: false, billboard: true }),
  lavender: () => foliage('lavender', T.lavenderCardTex(), { fade: false }),
  grassCard: () => foliage('grassCard', T.grassCardTex(), { fade: false }),
  wheat: () => foliage('wheat', T.wheatCardTex(), { fade: false }),
  reed: () => foliage('reed', T.grassCardTex('reed', ['#3a5a2a', '#5a7a34', '#8aa44a', '#c8d080'], { blades: 40, h: 1.0 }), { fade: false }),
  flowers: () => foliage('flowers', T.flowerCardTex(), { fade: false }),
};

function core(key, tex, o = {}) {
  return std(key, { tex, wind: true, rough: 0.95, env: 0.5, normalScale: 0.6, emissive: o.emissive });
}

function foliage(key, tex, o = {}) {
  const m = std(key, {
    tex,
    side: THREE.DoubleSide,
    alphaTest: 0.42,
    wind: true,
    rough: 0.92,
    env: 0.6,
    fade: o.fade ?? true,
    cut: true, // plants and flower boxes by a house wall go with the wall (no flowers left floating where it is cut)
    emissive: o.emissive,
    emissiveIntensity: o.emissiveIntensity,
    alphaToCoverage: true,
    noFlip: true,
    billboard: !!o.billboard,
    foliage: true,
  });
  m.userData.foliage = true;
  return m;
}

export function getMat(name) {
  if (name && typeof name === 'object') return name;
  if (!reg.has(name)) {
    const def = DEFS[name];
    if (!def) throw new Error('Unknown material ' + name);
    reg.set(name, def());
  }
  return reg.get(name);
}

export function hasMat(name) { return !!DEFS[name]; }

// a new, unshared copy of a named material (heat.js builds its heat variants from these)
export function freshMat(name) { const def = DEFS[name]; return def ? def() : null; }
