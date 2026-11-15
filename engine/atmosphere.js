// Atmosphere pass: what the air does to the light, from the scene depth.
//  - volumetric sun light: a short raymarch through the low air, testing the sun's shadow map at each step, so light shafts
//    show where the sun gets through gaps in trees and between buildings (and the shade under them stays clear)
//  - lamp glow in the air: the analytic in-scatter of the nearest lamps and fires (closed-form 1/r^2 integral along the
//    view ray, cut at the surface behind, so a glow never shows through a wall), faded in and out by the light pool
//  - height fog: an exponential layer above the ground near the hero (thicker in hollows and over water, thin on the
//    hills), with a drifting morning mist and an aerial tint toward the sky and the sun
//  - cheap ambient occlusion (High and Ultra), soft sun glare and round lens ghosts (no star shapes)
// The raymarch, the lamps and the AO run at half resolution; the full-size composite upsamples them depth-aware.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { G } from './globals.js';

const MAX_LAMPS = 16;

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMMON = /* glsl */ `
uniform sampler2D tDepth;
uniform mat4 uInvProj, uCamWorld;
uniform vec3 uCamPos;
varying vec2 vUv;
vec3 viewPosAt(vec2 uv, float d) { vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

const VOL_FRAG = /* glsl */ `
${COMMON}
uniform sampler2DShadow tShadow;
uniform mat4 uShadowM;
uniform mat4 uProj;
uniform vec2 uRes;
uniform float uMaxDist, uFogBase, uFogH, uVolOn, uAORad, uStart;
uniform vec4 uLamp[${MAX_LAMPS}];
uniform int uLampN;
void main() {
  float d = texture2D(tDepth, vUv).x;
  bool sky = d >= 0.99999;
  vec3 vp = viewPosAt(vUv, d);
  if (sky) vp = normalize(vp) * uMaxDist;
  float viewZ = -vp.z;
  vec3 wp = (uCamWorld * vec4(vp, 1.0)).xyz;
  vec3 rd = wp - uCamPos; float L = length(rd); rd /= max(L, 1e-4);
  float tEnd = min(L, uMaxDist);
  // sun: march only the low air (up to three scale heights above the ground), where the light shows
  float sun = 0.0;
#if STEPS > 0
  if (uVolOn > 0.0) {
    float top = uFogBase + uFogH * 3.0;
    // the air between the camera and the hero is left out (uStart): it only greyed the playfield
    float t0 = 0.0;
    if (uCamPos.y > top) t0 = rd.y < -1e-3 ? (uCamPos.y - top) / -rd.y : tEnd;
    t0 = max(t0, uStart);
    float len = max(tEnd - t0, 0.0);
    if (len > 0.0) {
      float dt = len / float(STEPS), j = ign(gl_FragCoord.xy);
      for (int i = 0; i < STEPS; i++) {
        vec3 p = uCamPos + rd * (t0 + (float(i) + j) * dt);
        float dens = exp(-max(p.y - uFogBase, -2.0) / uFogH);
        vec4 sc = uShadowM * vec4(p, 1.0);
        float vis = 1.0;
        if (sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0) vis = texture(tShadow, vec3(sc.xy, sc.z - 0.0015));
        sun += dens * vis * dt;
      }
    }
  }
#endif
  // lamps: integral of 1/(r^2) along the ray up to the surface, per light (w = strength)
  float lamp = 0.0;
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    if (i >= uLampN) break;
    vec4 Lp = uLamp[i];
    vec3 lo = Lp.xyz - uCamPos;
    float s0 = dot(lo, rd);
    float h = sqrt(max(dot(lo, lo) - s0 * s0, 0.0) + 0.45);
    // only the air within ~5 m of the light glows (a windowed 1/r^2): no long tails washing the whole view
    float ta = max(0.0, s0 - 5.0), tb = min(tEnd, s0 + 5.0);
    float fw = 1.0 - h / 5.0;
    if (tb > ta && fw > 0.0) lamp += Lp.w * fw * fw * (atan((tb - s0) / h) - atan((ta - s0) / h)) / h;
  }
  // ambient occlusion from the depth alone (scalable ambient obscurance, 8 taps on a spiral)
  float ao = 1.0;
#ifdef SSAO
  if (!sky) {
    vec3 n = normalize(cross(dFdx(vp), dFdy(vp)));
    float rpx = uAORad * uProj[1][1] * 0.5 / max(viewZ, 0.1);
    float a0 = ign(gl_FragCoord.xy * 1.37) * 6.2832, occ = 0.0;
    for (int i = 0; i < 8; i++) {
      float r = (float(i) + 0.6) / 8.0, a = a0 + float(i) * 2.39996;
      vec2 suv = vUv + vec2(cos(a), sin(a)) * r * rpx * vec2(uRes.y / uRes.x, 1.0);
      vec3 s = viewPosAt(suv, texture2D(tDepth, suv).x);
      vec3 v = s - vp; float vv = dot(v, v);
      occ += max(0.0, dot(v, n) - 0.012 * viewZ) / (vv + 0.02) * (1.0 - smoothstep(uAORad * uAORad, uAORad * uAORad * 4.0, vv));
    }
    ao = clamp(1.0 - occ * uAORad * 0.32, 0.0, 1.0);
  }
#endif
  gl_FragColor = vec4(sun, ao, lamp, sky ? 1e4 : viewZ);
}
`;

const COMP_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tDiffuse, tVol;
uniform vec2 uVolTexel;
uniform vec3 uSunDir, uSunCol, uFogCol, uLampCol;
uniform float uFogDen, uFogBase, uFogH, uFogMax, uMist, uMistBase, uVolK, uLampK, uAOK, uTime, uPhaseG, uFogStart;
uniform vec3 uSunUV; // xy: the sun on screen (may be off it), z: how much of the flare and glare to show
uniform float uAspect, uLens, uGlare;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float d = texture2D(tDepth, vUv).x;
  bool sky = d >= 0.99999;
  vec3 vp = viewPosAt(vUv, d);
  float vz = sky ? 1e4 : -vp.z;
  // depth-aware upsample of the half-size air buffer (3x3, weights fall off with depth difference)
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec4 s = texture2D(tVol, vUv + vec2(float(x), float(y)) * uVolTexel);
    float w = exp(-abs(s.a - vz) / (0.04 * vz + 0.08)) * (x == 0 && y == 0 ? 2.0 : 1.0);
    acc += s * w; ws += w;
  }
  vec4 v = ws > 1e-4 ? acc / ws : texture2D(tVol, vUv);
  c.rgb *= mix(1.0, v.g, uAOK);
  vec3 wp = (uCamWorld * vec4(sky ? normalize(vp) * 400.0 : vp, 1.0)).xyz;
  vec3 rd = wp - uCamPos; float L = length(rd); rd /= max(L, 1e-4);
  float mu = dot(rd, uSunDir);
  if (!sky) {
    // exponential height fog, integrated in closed form along the ray (camera to surface)
    // the ray's end is held no lower than just under the fog base: deep hollows and the beds under clear water (which
    // write no depth) must not count as metres of ever-thicker fog
    // the haze starts a little short of the hero (uFogStart): the playfield round you stays clear, the distance hazes
    float Lf = max(L - uFogStart, 0.0);
    float H = uFogH, h0 = uCamPos.y - uFogBase, k = (max(wp.y, uFogBase - 1.5) - uCamPos.y) / H;
    float od = exp(-clamp(h0, -2.0 * H, 60.0) / H) * Lf * (abs(k) > 1e-3 ? (1.0 - exp(-k)) / k : 1.0);
    // the low mist (mornings, over water and fields): a thin layer under ~1.5 m, broken into drifting banks
    float mh = 1.4, mh0 = uCamPos.y - uMistBase, mk = (max(wp.y, uMistBase - 0.8) - uCamPos.y) / mh;
    float mo = exp(-clamp(mh0, -2.0, 80.0) / mh) * max(L - uFogStart * 0.6, 0.0) * (abs(mk) > 1e-3 ? (1.0 - exp(-mk)) / mk : 1.0);
    float bank = vn(wp.xz * 0.045 + vec2(uTime * 0.018, uTime * 0.011)) * 0.65 + vn(wp.xz * 0.13 - uTime * 0.03) * 0.35;
    od = uFogDen * od * (0.75 + 0.5 * bank) + uMist * min(mo, 40.0) * smoothstep(0.25, 0.75, bank);
    float f = min(1.0 - exp(-od), uFogMax);
    // aerial tint: toward the sky colour, warmer and brighter toward the sun
    vec3 fc = uFogCol + uSunCol * 0.18 * pow(max(mu, 0.0), 6.0);
    c.rgb = mix(c.rgb, fc, f);
  }
  // sun in-scatter (Henyey-Greenstein, mixed with an even share so it shows when you look away from the sun too)
  float g = uPhaseG, ph = 0.15 * (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) + 0.4;
  // lit air both hides a little of what is behind it and glows with the sun: blended, not just added, so the haze keeps
  // dark water and shade from washing out while the shafts stand out where the sun gets through
  float va = 1.0 - exp(-v.r * uVolK);
  c.rgb = c.rgb * (1.0 - va) + uSunCol * ph * va * 0.42;
  c.rgb += uLampCol * v.b * uLampK;
  // the sun on (or just off) screen: a soft glare and a few soft round ghosts mirrored through the centre
  if (uSunUV.z > 0.001) {
    vec2 a = vec2(uAspect, 1.0);
    float vis = 0.0;
    for (int i = 0; i < 5; i++) {
      vec2 o = vec2(float(i - 2) * 0.012, float((i * 3) % 5 - 2) * 0.012);
      vis += step(0.99999, texture2D(tDepth, clamp(uSunUV.xy + o, vec2(0.001), vec2(0.999))).x);
    }
    vis *= 0.2 * uSunUV.z;
    vec3 lens = uSunCol * 0.25 * exp(-length((vUv - uSunUV.xy) * a) * 4.0);
    vec2 axis = vec2(0.5) - uSunUV.xy;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 gp = uSunUV.xy + axis * (0.55 + fi * 0.5);
      float r = 0.035 + 0.03 * fract(fi * 0.618 + 0.3) * 2.0;
      float dd = length((vUv - gp) * a);
      float disc = 1.0 - smoothstep(r * 0.25, r, dd);
      vec3 tint = mix(vec3(1.0, 0.78, 0.5), vec3(0.6, 0.8, 1.0), fract(fi * 0.37));
      lens += uSunCol * tint * disc * disc * 0.035;
    }
    c.rgb += lens * vis * uLens;
  }
  // veiling glare: facing the sun, a warm wash grows from the side of the screen it is on
  if (uGlare > 0.0) c.rgb += uSunCol * uGlare * (1.0 - smoothstep(0.0, 1.6, length((vUv - clamp(uSunUV.xy, vec2(-0.6), vec2(1.6))) * vec2(uAspect, 1.0))));
  gl_FragColor = c;
}
`;

export class AtmospherePass extends Pass {
  // opts: { steps, scale, ssao }
  constructor(engine, opts = {}) {
    super();
    this.engine = engine;
    this.scale = opts.scale ?? 0.5;
    const defs = { STEPS: opts.steps ?? 16 };
    if (opts.ssao) defs.SSAO = '';
    this.volRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const shared = { tDepth: { value: null }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() } };
    this.lamps = Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4());
    this.volMat = new THREE.ShaderMaterial({
      defines: defs, depthTest: false, depthWrite: false,
      uniforms: {
        ...shared, tShadow: { value: null }, uShadowM: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2(1, 1) },
        uMaxDist: { value: 90 }, uStart: { value: 0 }, uFogBase: { value: 0 }, uFogH: { value: 6 }, uVolOn: { value: 1 }, uAORad: { value: 0.7 },
        uLamp: { value: this.lamps }, uLampN: { value: 0 },
      },
      vertexShader: VERT, fragmentShader: VOL_FRAG,
    });
    this.compMat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        ...shared, tDiffuse: { value: null }, tVol: { value: this.volRT.texture }, uVolTexel: { value: new THREE.Vector2() },
        uSunDir: { value: engine.sunDir }, uSunCol: { value: new THREE.Color() }, uFogCol: { value: new THREE.Color() }, uLampCol: { value: new THREE.Color(1, 0.62, 0.3) },
        uFogDen: { value: 0.01 }, uFogBase: { value: 0 }, uFogH: { value: 6 }, uFogMax: { value: 0.6 }, uFogStart: { value: 0 }, uMist: { value: 0 }, uMistBase: { value: 0 },
        uVolK: { value: 0 }, uLampK: { value: 0 }, uAOK: { value: opts.ssao ? 0.7 : 0 }, uTime: G.time, uPhaseG: { value: 0.55 },
        uSunUV: { value: new THREE.Vector3() }, uAspect: { value: 1 }, uLens: { value: 1 }, uGlare: { value: 0 },
      },
      vertexShader: VERT, fragmentShader: COMP_FRAG,
    });
    // the two materials share the camera uniforms (same objects), so they are set once per frame
    this.compMat.uniforms.tDepth = this.volMat.uniforms.tDepth;
    this.volQuad = new FullScreenQuad(this.volMat);
    this.compQuad = new FullScreenQuad(this.compMat);
    this.ssao = !!opts.ssao;
  }

  setSize(w, h) {
    const vw = Math.max(1, Math.round(w * this.scale)), vh = Math.max(1, Math.round(h * this.scale));
    this.volRT.setSize(vw, vh);
    this.compMat.uniforms.uVolTexel.value.set(1 / vw, 1 / vh);
    this.volMat.uniforms.uRes.value.set(vw, vh);
    this.compMat.uniforms.uAspect.value = w / h;
  }

  render(renderer, writeBuffer, readBuffer) {
    const cam = this.engine.camera, sun = this.engine.sun, vu = this.volMat.uniforms, cu = this.compMat.uniforms;
    vu.tDepth.value = readBuffer.depthTexture;
    vu.uInvProj.value.copy(cam.projectionMatrixInverse);
    vu.uCamWorld.value.copy(cam.matrixWorld);
    vu.uProj.value.copy(cam.projectionMatrix);
    vu.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
    const sm = sun.castShadow && sun.shadow.map ? sun.shadow.map.depthTexture : null;
    vu.tShadow.value = sm;
    vu.uShadowM.value.copy(sun.shadow.matrix);
    vu.uVolOn.value = sm && cu.uVolK.value > 0.001 ? 1 : 0;
    renderer.setRenderTarget(this.volRT);
    this.volQuad.render(renderer);
    cu.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.compQuad.render(renderer);
  }

  dispose() { this.volRT.dispose(); this.volMat.dispose(); this.compMat.dispose(); this.volQuad.dispose(); this.compQuad.dispose(); }
}
