// Glow field: every glowSprite halo in a scene drawn as one instanced draw of camera-facing quads, instead of one
// THREE.Sprite (own material, own cull test, own draw call) per lamp. A village scene held 2,800-4,000 of them.
//
// How it fits in without touching the owners: glowSprite() (dynamic.js) returns a GlowPoint, a plain Object3D that keeps
// the sprite's API (position, scale, material.color / opacity, userData.glow, userData.update, visible) and still answers
// isSprite (the world's lamp-spot scan looks for sprites with userData.glow). three never draws it: its `visible` reads
// false to the renderer, and its own show / hide is kept in `shown`. Each frame the scene walk (updateMatrixWorld) that
// reaches a GlowPoint reports it to its scene's field, which writes it into the instance buffers: world position, world
// size, colour and base opacity. The field is the scene's first child, so its own walk step starts the frame before any
// point reports. The flicker and the night boost (the same formula glowSprite's update used) run in the vertex shader on
// G.time and G.night. A point only shows while it and every ancestor are visible and it hangs in a scene.
// Subtrees whose walk is skipped (freeze.js) report their points themselves (reportGlows).
import * as THREE from 'three';
import { glowTex } from '../engine/textures.js';
import { G } from '../engine/globals.js';

const OBJ_UMW = THREE.Object3D.prototype.updateMatrixWorld;
let WALK = 1; // bumped at the start of every scene walk that has a field: the visibility memo is per walk
const fields = new WeakMap(); // scene -> GlowField

// visible all the way up and hanging in a scene? memoised per walk on the ancestors (lamps share parents)
function chain(o) {
  if (o._gwW === WALK) return o._gwS;
  let s;
  if (!o.parent) s = o.isScene ? o : null;
  else if (o.visible === false) s = null;
  else s = chain(o.parent);
  o._gwW = WALK; o._gwS = s;
  return s;
}

const VERT = /* glsl */`
attribute vec3 iPos;
attribute vec2 iSize;
attribute vec4 iCol;
attribute float iPh;
uniform float uTime;
uniform float uNight;
varying vec2 vUv;
varying vec4 vCol;
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
void main() {
  vUv = uv;
  // iPh < 0: the owner drives the opacity itself (it wrote material.opacity), so no flicker or night boost on top
  // (LF.1) only fires flicker: an orange glow (green well under red) breathes, a lamp's yellow-white one burns steady
  float fk = 1.0 - smoothstep(0.55, 0.7, iCol.g / max(iCol.r, 0.001));
  float fl = iPh < 0.0 ? 1.0 : (0.88 + fk * (0.08 * sin(uTime * 3.1 + iPh) + 0.04 * sin(uTime * 7.7 + iPh)) + 0.06 * (1.0 - fk)) * (1.0 + 0.9 * uNight);
  vCol = vec4(iCol.rgb, iCol.a * fl);
  vec4 mvPosition = viewMatrix * vec4(iPos, 1.0);
  mvPosition.xy += position.xy * iSize;
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}`;
const FRAG = /* glsl */`
uniform sampler2D uMap;
varying vec2 vUv;
varying vec4 vCol;
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  vec4 diffuseColor = vCol * texture2D(uMap, vUv);
  vec3 outgoingLight = diffuseColor.rgb;
  #include <opaque_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

class GlowField extends THREE.Mesh {
  constructor(scene) {
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uTime: { value: 0 }, uNight: { value: 0 } }]),
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    });
    // the same uniform objects as the rest of the world (updated in place every frame)
    mat.uniforms.uMap.value = glowTex(); mat.uniforms.uTime = G.time; mat.uniforms.uNight = G.night;
    super(new THREE.InstancedBufferGeometry(), mat);
    this.isGlowField = true;
    this.frustumCulled = false; this.renderOrder = 10; this.castShadow = false; this.receiveShadow = false;
    this.matrixAutoUpdate = false;
    this.cap = 0; this.n = 0; this.dirty = false;
    this.grow(2048);
    // first child, so its walk step (begin) runs before any GlowPoint below it reports
    scene.add(this);
    const k = scene.children.indexOf(this);
    if (k > 0) { scene.children.splice(k, 1); scene.children.unshift(this); }
  }
  grow(cap) {
    const old = this.geometry, n = this.n;
    const g = new THREE.InstancedBufferGeometry();
    const q = new THREE.PlaneGeometry(1, 1);
    g.index = q.index; g.setAttribute('position', q.attributes.position); g.setAttribute('uv', q.attributes.uv);
    const mk = (k, w) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * w), w); a.setUsage(THREE.DynamicDrawUsage); if (old.attributes[k]) a.array.set(old.attributes[k].array.subarray(0, n * w)); g.setAttribute(k, a); return a; };
    this.aPos = mk('iPos', 3); this.aSize = mk('iSize', 2); this.aCol = mk('iCol', 4); this.aPh = mk('iPh', 1);
    g.instanceCount = n;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    this.geometry = g; this.cap = cap;
    if (old.attributes.iPos) old.dispose();
    this.dirty = true; // (a new buffer is uploaded whole on first use)
    this.lo = 0;
  }
  // the walk reaches the field first: a new frame of reports
  updateMatrixWorld(force) {
    WALK++;
    this.n = 0; this.lo = Infinity;
    this.geometry.instanceCount = 0;
    OBJ_UMW.call(this, force);
  }
  put(p) {
    const e = p.matrixWorld.elements, i = this.n;
    if (i >= this.cap) this.grow(this.cap * 2);
    this.n = i + 1;
    const P = this.aPos.array, S = this.aSize.array, C = this.aCol.array, H = this.aPh.array;
    const sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]);
    const m = p.material, c = m.color, a = m.opacity, ph = m.raw ? -1 : p.ph;
    const i3 = i * 3, i2 = i * 2, i4 = i * 4;
    if (P[i3] !== e[12] || P[i3 + 1] !== e[13] || P[i3 + 2] !== e[14] || S[i2] !== sx || S[i2 + 1] !== sy || C[i4] !== c.r || C[i4 + 1] !== c.g || C[i4 + 2] !== c.b || C[i4 + 3] !== a || H[i] !== ph) {
      P[i3] = e[12]; P[i3 + 1] = e[13]; P[i3 + 2] = e[14]; S[i2] = sx; S[i2 + 1] = sy;
      C[i4] = c.r; C[i4 + 1] = c.g; C[i4 + 2] = c.b; C[i4 + 3] = a; H[i] = ph;
      if (i < this.lo) this.lo = i;
      this.dirty = true;
    }
    // (instanceCount and the uploads are settled after the walk, before the field is culled and drawn: onBeforeRender
    // is too late for an upload, so each report keeps them current)
    this.geometry.instanceCount = this.n;
    if (this.dirty || this.lo < this.n) {
      // upload only the changed tail of the buffers (slots from the first changed one to the last used one)
      const lo = this.lo, cnt = this.n - lo;
      for (const [a, w] of [[this.aPos, 3], [this.aSize, 2], [this.aCol, 4], [this.aPh, 1]]) { a.clearUpdateRanges(); a.addUpdateRange(lo * w, cnt * w); a.needsUpdate = true; }
      this.dirty = false;
    }
  }
}

// the field of a scene (made on first use)
export function glowFieldOf(scene) {
  let f = fields.get(scene);
  if (!f) { f = new GlowField(scene); fields.set(scene, f); }
  return f;
}

// a stand-in for the old glow sprite (see the top of the file)
export class GlowPoint extends THREE.Object3D {
  constructor(color = 0xffc860, size = 1.5, intensity = 0.8) {
    super();
    this.isSprite = true; // the lamp-spot scan in world.js (o.isSprite && o.userData.glow); three never draws it (visible)
    this.isGlowPoint = true;
    this.material = new GlowMat(color, intensity);
    this.scale.setScalar(size);
    this.renderOrder = 10;
    this.ph = Math.random() * 10;
    this.userData.glow = { color, size };
    this.userData.update = () => false; // (moves nothing: v116 freeze.js walkOnDemand) the flicker and the night boost now run on the GPU
    this.walkF = -1; this.slotField = null;
  }
  get visible() { return false; }
  set visible(v) { this.shown = v; }
  updateMatrixWorld(force) { OBJ_UMW.call(this, force); this.report(); }
  report() {
    if (this.shown === false) return;
    const scene = chain(this.parent || this);
    if (!scene || !this.parent) return;
    const f = fields.get(scene) || glowFieldOf(scene);
    if (this.walkF === WALK) return; // already in this walk (a partial updateMatrixWorld before the scene's)
    this.walkF = WALK;
    f.put(this);
  }
  // a copy keeps being a glow (three's clone() runs the constructor, then copy())
  copy(src, recursive) {
    super.copy(src, recursive);
    this.material.color.copy(src.material.color); this.material.op = src.material.op; this.material.raw = src.material.raw;
    this.ph = src.ph; this.shown = src.shown; this.userData.glow = { ...src.userData.glow }; this.userData.update = () => false;
    return this;
  }
}
// the sprite material stand-in: colour and opacity as before; an owner that sets opacity takes it over (raw)
class GlowMat {
  constructor(color, opacity) { this.color = new THREE.Color(color); this.op = opacity; this.raw = false; this.transparent = true; this.depthWrite = false; this.visible = true; this.blending = THREE.AdditiveBlending; }
  get opacity() { return this.op; }
  set opacity(v) { this.op = v; this.raw = true; }
  dispose() {}
}

// every GlowPoint under root (for subtrees whose scene walk is skipped: they report their glows themselves)
export function collectGlows(root) {
  const out = [];
  root.traverse((o) => { if (o.isGlowPoint) out.push(o); });
  return out;
}
export function reportGlows(list) { for (let i = 0; i < list.length; i++) list[i].report(); }
