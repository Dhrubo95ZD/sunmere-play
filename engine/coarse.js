// Coarse culling (perf): three walks the whole scene graph twice a frame, once for the camera (projectObject) and once
// for the sun's shadow map (WebGLShadowMap renderObject), and tests every mesh on the way. In the village that is about
// 11k nodes a pass: ~150 characters of ~62 nodes each and ~5k nodes of placed buildings and props. Most of them are
// nowhere near the view or the shadow box. This hides whole subtrees for the length of one pass, so three never walks
// into them, and puts every flag back straight after:
//   - characters (scene children flagged userData.coarse = radius, metres around root + 1 m),
//   - the static world's frozen and walk-on-demand subtrees (freeze.js), each with a bounding sphere held in its root's
//     own frame (so a moved root carries its sphere along).
// A subtree is skipped by the camera pass only when it is outside the camera's frustum and either casts nothing or is
// outside the sun's shadow box (or the shadow map is not redrawn this frame); by the shadow pass when it casts nothing
// or is outside the shadow box. Nothing is skipped that three would have drawn: every hidden mesh is one three would
// itself have culled, or one that does not cast. Subtrees that hold a light, or anything three does not cull
// (frustumCulled = false), are never hidden (a light must stay in the light setup).
import * as THREE from 'three';
import { QUALITY } from './globals.js';

const _f = new THREE.Frustum(), _sf = new THREE.Frustum(), _m = new THREE.Matrix4(), _c = new THREE.Vector3(), _s = new THREE.Sphere();
const _box = new THREE.Box3(), _v = new THREE.Vector3();

const SMALL_CAST = 0.6; // metres (bounding radius) of a 'small' static caster (beginShadow)
const outside = (F, c, r) => {
  const P = F.planes;
  for (let i = 0; i < 6; i++) if (P[i].normal.x * c.x + P[i].normal.y * c.y + P[i].normal.z * c.z + P[i].constant < -r) return true;
  return false;
};

export class CoarseCull {
  constructor(scene) {
    this.scene = scene;
    this.roots = []; // static world roots to scan for chunks
    this.chunks = [];
    this.version = -1;
    this.nextScan = 0;
    this.hidden = [];
    this.shadowHidden = [];
    this.on = !/[?&]coarse=0\b/.test(globalThis.location?.search || '');
    this.stats = { chunks: 0, hidMain: 0, hidShadow: 0 };
  }
  addStatic(root) { if (root && !this.roots.includes(root)) { this.roots.push(root); this.version = -1; } }
  invalidate() { this.version = -1; }

  // the chunk list: frozen / walk-on-demand roots under the static roots, with their spheres (root frame) and flags
  scan(version) {
    const chunks = [];
    for (const R of this.roots) R.traverse((o) => {
      if (!(o._frozen || o._demand) || o === R) return;
      // a chunk inside a chunk is covered by the outer one (only the outermost are kept: see below)
      for (let p = o.parent; p && p !== R; p = p.parent) if (p._frozen || p._demand) return;
      let n = 0, cast = false, bad = false;
      _box.makeEmpty();
      o.updateWorldMatrix(true, false);
      o.traverse((x) => {
        n++;
        if (x.isLight || x.isGlowField) { bad = true; return; }
        if (!(x.isMesh || x.isPoints || x.isLine || x.isSprite)) return;
        if (x.frustumCulled === false && !(x.material && x.material.visible === false)) { bad = true; return; }
        if (x.castShadow && (x.isMesh || x.isPoints || x.isLine)) cast = true;
        if (x.isSprite) { _v.setFromMatrixPosition(x.matrixWorld); const r = x.matrixWorld.getMaxScaleOnAxis(); _box.expandByPoint(_v.addScalar(r)); _v.subScalar(2 * r); _box.expandByPoint(_v); return; }
        const g = x.geometry;
        if (!g) return;
        if (!g.boundingSphere) { if (!g.attributes?.position?.array) { bad = true; return; } g.computeBoundingSphere(); }
        _s.copy(g.boundingSphere).applyMatrix4(x.matrixWorld);
        _box.expandByPoint(_v.copy(_s.center).addScalar(_s.radius)); _box.expandByPoint(_v.copy(_s.center).subScalar(_s.radius));
      });
      if (bad || n < 3 || _box.isEmpty()) return;
      _box.getBoundingSphere(_s);
      // into the root's frame (moving roots carry their sphere along); demand roots sway and smoke: a little slack
      const inv = _m.copy(o.matrixWorld).invert();
      const sc = o.matrixWorld.getMaxScaleOnAxis() || 1;
      const local = _s.center.clone().applyMatrix4(inv);
      chunks.push({ o, local, r: _s.radius / sc + (o._demand ? 2 : 0.25), r0: _s.radius / sc, cast, n, c: new THREE.Vector3() });
    });
    this.chunks = chunks;
    this.version = version;
    this.stats.chunks = chunks.length;
  }

  // before the frame's render: decide and hide for the camera pass. shadowOn: the sun's map is redrawn this frame
  begin(camera, sun, shadowOn, version, now) {
    this.hidden.length = 0;
    if (!this.on) return;
    if (version !== this.version || now > this.nextScan) { this.scan(version); this.nextScan = now + 10000; }
    camera.updateMatrixWorld();
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _f.setFromProjectionMatrix(_m, camera.coordinateSystem, camera.reversedDepth);
    this.shadowOn = !!(shadowOn && sun && sun.castShadow);
    this.sun = sun;
    if (this.shadowOn) {
      sun.updateMatrixWorld(); sun.target.updateMatrixWorld();
      sun.shadow.updateMatrices(sun);
      _sf.copy(sun.shadow.getFrustum());
    }
    const H = this.hidden;
    for (const ch of this.chunks) {
      const o = ch.o;
      if (!o.visible || !o.parent) continue;
      _c.copy(ch.local).applyMatrix4(o.matrixWorld);
      const r = ch.r * (o.matrixWorld.getMaxScaleOnAxis() || 1);
      ch.c.copy(_c); ch.rw = ch.r0 * (o.matrixWorld.getMaxScaleOnAxis() || 1);
      ch.inCam = !outside(_f, _c, r);
      // (v115: a static-only chunk casts only on the frames the static shadow cache is redrawn, engine/shadowCache.js)
      ch.inShadow = this.shadowOn && ch.cast && (this.staticOn !== false || !this.isStatic?.(o)) && !outside(_sf, _c, r);
      if (!ch.inCam && !ch.inShadow) { o.visible = false; H.push(o); }
    }
    const kids = this.scene.children;
    for (let i = 0; i < kids.length; i++) {
      const o = kids[i], cr = o.userData.coarse;
      if (!cr || !o.visible) continue;
      const r = cr * (o.scale.x || 1);
      _c.copy(o.position); _c.y += 1;
      const inCam = !outside(_f, _c, r);
      const inShadow = this.shadowOn && !outside(_sf, _c, r);
      o.userData._coarseShadowOut = !inShadow;
      if (!inCam && !inShadow) { o.visible = false; H.push(o); }
    }
    this.stats.hidMain = H.length;
  }

  // inside the shadow pass (the camera pass already ran): hide what casts nothing into this frame's shadow box
  beginShadow() {
    const S = this.shadowHidden;
    S.length = 0;
    if (!this.on || !this.shadowOn) return;
    // v114, phones (QUALITY.smallCastDist): small static things (a bucket, a stool, a crate: under SMALL_CAST m across) cast
    // only within that distance of the shadow's centre (the player), as characters do within charShadowDist; past it their
    // shadow is a few pixels on a phone screen and costs a draw each
    const sd = QUALITY.smallCastDist, foc = sd && this.sun ? _v.setFromMatrixPosition(this.sun.target.matrixWorld) : null, sd2 = sd * sd;
    for (const ch of this.chunks) {
      const o = ch.o;
      if (!o.visible || !o.parent) continue;
      if (!ch.inShadow || (foc && ch.rw < SMALL_CAST && (ch.c.x - foc.x) ** 2 + (ch.c.z - foc.z) ** 2 > sd2)) { o.visible = false; S.push(o); }
    }
    const kids = this.scene.children;
    for (let i = 0; i < kids.length; i++) { const o = kids[i]; if (o.userData.coarse && o.visible && o.userData._coarseShadowOut) { o.visible = false; S.push(o); } }
    this.stats.hidShadow = S.length;
  }
  endShadow() { const S = this.shadowHidden; for (let i = 0; i < S.length; i++) S[i].visible = true; S.length = 0; }
  end() { const H = this.hidden; for (let i = 0; i < H.length; i++) H[i].visible = true; H.length = 0; }
}
