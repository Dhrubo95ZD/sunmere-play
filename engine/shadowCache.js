// v115 static shadow cache (phone performance): the sun's shadow pass redrew the whole static world (shadow proxies,
// frozen kit, house shells: ~60% of the shadow draws in a town) every time the map was drawn. Now the static casters are
// drawn into the map only when something they depend on changes, the depth is kept in a cache buffer, and every other
// shadow frame starts from a copy of it (a depth blit) and draws only the dynamic casters (characters, mobs, doors,
// wind-swayed foliage, fx, anything that moves) on top, depth-tested against it: the same map as drawing everything.
//
// What the cached map depends on, and what redraws it (prepare / place):
//   - the shadow box: it no longer follows the player texel by texel. The box is a margin larger (CACHE_MARGIN of the
//     half-size) and the map that many texels larger (same texel size, so the same softness and detail), snapped to the
//     same texel grid; it re-centres on the player only when the box the player needs leaves it (or the extent changes,
//     a whole-metre zoom step on the desktop)
//   - the sun: the cached direction is kept (for the light too, so lit sides and shadows agree) until a tall caster's
//     shadow would move by more than ~1.5 texels; at dusk the low sun redraws it more often, at noon hardly ever
//   - what static casters are shown: a hash over the visibility (and child counts) of the static parts' parents and
//     tops, so an area or dungeon switch, a house's detail shown by distance or new children trigger a redraw
//   - the house cut-away (v108/v109): the house shells cast through cutDepthMaterial, whose discard reads the cut
//     uniforms: any change of them (a house opening or closing, the cut line easing down) redraws the static map
//   - freeze.js staticVersion / the shadow proxies switching (the classification below is rebuilt), and every REFRESH_MS anyway
// What is static: everything inside a frozen subtree (freeze.js), the shadow proxies (game/layers.js, scatter.js), and
// the house shells, their detail and the other assembled buildings (flagged userData.shadowStatic by world.js and
// assets/dynamic.js assemble), except anything dynamic in them (freeze.js isDynamic: doors, lanterns, smoke...)
// and casters whose depth moves with time (a custom depth material other than the plain per-kind and the cut one: the
// wind sway). Everything else, and anything added later under a part not yet classified, is drawn every shadow frame.
// v116: switches ('W', see build): hanging lanterns that stand still (they swing only near the player, assets/dynamic.js)
// and parked caravan carts are drawn into the cached map while still, as dynamic casters while they move; the parked
// runabout and the loaded market-stall models are static. Phones: the wind-swayed casters ('T') are drawn into a second
// cached layer (static + swayed) QUALITY.treeShadowHz (10) times a second instead of on every shadow frame (?treehz=<n>).
// ?shadowcache=0 (or QUALITY.shadowCache = false) turns it off: the map is drawn as before.
import * as THREE from 'three';
import { G, QUALITY } from './globals.js';
import { staticVersion, isDynamic } from '../game/freeze.js';
import { cutDepthMaterial } from './materials.js';

export const CACHE_MARGIN = 0.15; // the box's margin, as a part of its half-size (and the map grows by as much)
const REFRESH_MS = 5000; // a full redraw at least this often (a safety net)
const SUN_H = 8; // metres: the tall caster whose shadow tip may move ~1.5 texels before the sun direction is renewed

export function shadowCacheOn() {
  if (/[?&]shadowcache=0/.test(globalThis.location?.search || '')) return false;
  return QUALITY.shadowCache !== false;
}

const _right = new THREE.Vector3(), _sup = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _p = new THREE.Vector3();
const mix = (h, v) => (Math.imul(h ^ (v | 0), 0x01000193) + 0x9e3779b9) | 0;
const fbits = new Float32Array(1), ibits = new Int32Array(fbits.buffer);
const mixF = (h, f) => { fbits[0] = f; return mix(h, ibits[0]); };

export class ShadowCache {
  constructor(engine, renderFn) {
    this.engine = engine;
    this.R = engine.renderer;
    this.renderFn = renderFn; // three's own WebGLShadowMap.render
    this.on = shadowCacheOn() && this.R.shadowMap.type === THREE.PCFShadowMap;
    this.baseSize = QUALITY.shadowSize;
    this.size = this.on ? Math.round(this.baseSize * (1 + CACHE_MARGIN)) : this.baseSize;
    this.k = this.size / this.baseSize;
    this.dir = null; this.c = new THREE.Vector3(); this.E = 0; this.Ec = 0;
    this.dirty = true; this.valid = false; this.sig = 0; this.ver = -1; this.nextRefresh = 0;
    this.staticPass = true; this.prepared = false;
    this.sets = null; this._struct = 0; this.bufs = {}; this.validT = false; this.nextTree = 0; this._src = null;
    this.stats = { staticDraws: 0, statics: 0, treeDraws: 0, trees: 0, dynDraws: 0, frames: 0, reasons: {} };
    this._why = 'start';
    this.restore = this.restore.bind(this);
  }
  invalidate(why = 'manual') { this.dirty = true; this._why = this._why || why; }

  // ---- the shadow box (from Engine.updateShadow on the frames the map is drawn): E the half-size the view needs
  place(focus, E) {
    const eng = this.engine, sun = eng.sun, sc = sun.shadow.camera;
    if (E !== this.E) {
      this.E = E; this.Ec = E * this.k;
      sc.left = -this.Ec; sc.right = this.Ec; sc.top = this.Ec; sc.bottom = -this.Ec;
      sc.updateProjectionMatrix();
      this.invalidate('extent');
    }
    const texel = (this.Ec * 2) / sun.shadow.mapSize.x, cur = eng.sunDir;
    let moved = !this.dir;
    if (this.dir) {
      const dt = Math.min(1, Math.max(-1, cur.dot(this.dir))), ang = Math.acos(dt);
      if (ang > 1e-6) {
        const s = Math.max(0.08, this.dir.y); // (sin of the elevation; floored near the horizon)
        if (ang > 0.02 || (SUN_H * ang) / (s * s) > 1.5 * texel) moved = true;
      }
    }
    if (moved) { (this.dir ||= new THREE.Vector3()).copy(cur); this.invalidate('sun'); }
    const dir = this.dir;
    const right = _right.crossVectors(_up, dir).normalize(), up = _sup.crossVectors(dir, right).normalize();
    const fr = focus.dot(right), fu = focus.dot(up), fd = focus.dot(dir), M = this.Ec - this.E;
    const C = this.c;
    if (moved || this.dirty || Math.abs(fr - C.x) > M || Math.abs(fu - C.y) > M || Math.abs(fd - C.z) > 30) {
      const nx = Math.round(fr / texel) * texel, ny = Math.round(fu / texel) * texel;
      if (nx !== C.x || ny !== C.y || fd !== C.z) { C.set(nx, ny, Math.abs(fd - C.z) > 30 || moved || this.dirty ? fd : C.z); this.invalidate('move'); }
    }
    _p.copy(right).multiplyScalar(C.x).addScaledVector(up, C.y).addScaledVector(dir, C.z);
    sun.target.position.copy(_p);
    sun.position.copy(_p).addScaledVector(dir, 150);
    return _p;
  }

  // ---- what is static (rebuilt when the frozen set, the proxies or a static parent's children change)
  // Each subtree gets one letter for what its casters are, or 'M' (mixed: an entry, walked per pass):
  //   'S' static: drawn into the cached map only when it is redrawn
  //   'T' (v116) static in place but its depth moves with time (the wind sway's depth material): on phones drawn into a
  //       second cached layer (the static map + the swayed casters) QUALITY.treeShadowHz (10) times a second, not on every
  //       shadow frame; on the desktop drawn every shadow frame as before
  //   'D' dynamic: drawn every shadow frame
  //   'W' (v116) a switch (userData.shadowSwitch: a hanging lantern, a caravan cart): 'S' while its userData.shadowStill is
  //       true, 'D' otherwise; a change of that, of its visibility or of its place redraws the cached map
  build() {
    const roots = this.engine.coarse.roots, cut = cutDepthMaterial();
    const timeDepth = (o) => { const d = o.customDepthMaterial; return !!d && d !== cut && !d.userData?.kindDepth; };
    const caster = (o) => (o.isMesh || o.isPoints || o.isLine) && !o.isSprite;
    const entries = [], sTops = new Set(), owners = this._owners = [];
    const N = { T: 0, W: 0 };
    const put = (E, c, k) => {
      E.known.set(c, k.c);
      if (k.c === 'M') E.mKids.push(k.e);
      else if (k.c !== 'D') { E.vKids.push(c); if (k.c === 'S') sTops.add(c); }
    };
    // (inside something that moves or animates, under = true, only a shadow-proxy group can still be static: the proxies
    // are built in their root's frame, and the scatter's sit under its group that updates the dynamic props)
    const cls = (o, ctx, under = false) => {
      const proxy = !!o.userData.shadowProxy && o.isGroup;
      const own = (!under && !!o.userData.shadowStatic) || proxy;
      if (o.isLight || o.isCamera || o.isGlowField) return { c: 'D' };
      if (!under && !own && o.userData.shadowSwitch) { N.W++; return { c: 'W' }; }
      if (!own && (isDynamic(o) || o.userData.door)) { under = true; ctx = false; }
      if (under && !own && !o.children.length) return { c: 'D' };
      const inCtx = own || (!under && (ctx || !!o._frozen));
      if (own && !proxy) owners.push({ o, m: o.matrixWorld.clone() }); // (not frozen: a moved group redraws the cache)
      const self = !caster(o) ? null : inCtx && !o.isSkinnedMesh ? (timeDepth(o) ? 'T' : 'S') : 'D';
      if (self === 'T') N.T++;
      if (!o.children.length) return { c: self ?? (inCtx ? 'S' : 'D') };
      const ku = under && !own, kids = o.children.map((c) => [c, cls(c, inCtx, ku)]);
      const k0 = kids[0][1].c;
      // one letter for the whole subtree (a group that is not static itself, e.g. an area group that keeps walking, stays
      // an entry, so children added to it later are classified)
      if (k0 !== 'M' && k0 !== 'W' && kids.every(([, k]) => k.c === k0) && (self === null ? k0 === 'D' || inCtx : self === k0)) return { c: k0 };
      const E = { o, self, mKids: [], vKids: [], known: new Map(), kctx: inCtx, kunder: ku, len: o.children.length };
      for (const [c, k] of kids) put(E, c, k);
      return { c: 'M', e: E };
    };
    const top = [];
    for (const R of roots) {
      const k = cls(R, false);
      if (k.c === 'M') top.push(k.e);
      else { const E = { o: R.parent, self: null, keys: [R], mKids: [], vKids: [], known: new Map(), shallow: true }; put(E, R, k); top.push(E); }
    }
    const count = (E) => { entries.push(E); E.mKids.forEach(count); };
    top.forEach(count);
    this.sets = { top, entries, sTops, roots: new Set(roots), n: entries.length, s: sTops.size, nT: N.T, nW: N.W };
    this._cls = cls; this._put = put;
  }
  // a static parent's children changed (a house interior built or freed, the CGTrader shells landing...): classify the
  // new children only and forget the gone ones
  refresh(E) {
    const o = E.o, here = new Set(o.children), S = this.sets.sTops;
    for (const c of [...E.known.keys()]) if (!here.has(c)) { E.known.delete(c); S.delete(c); }
    E.vKids = E.vKids.filter((c) => here.has(c)); E.mKids = E.mKids.filter((m) => here.has(m.o));
    for (const c of o.children) {
      if (E.known.has(c)) continue;
      const k = this._cls(c, E.kctx, E.kunder);
      if (k.c === 'T') this.sets.nT++;
      this._put(E, c, k);
    }
    E.len = o.children.length;
  }
  isStaticTop(o) { return !!this.sets?.sTops.has(o); }

  // a hash of what the cached map shows: the static parts' visibility and child counts, the switches' state and place,
  // and the cut uniforms
  signature() {
    let h = 0x811c9dc5;
    const sw = (c) => {
      const st = !!c.userData.shadowStill;
      h = mix(h, c.visible ? (st ? 19 : 23) : 29);
      if (st && c.visible) { const p = c.position, q = c.quaternion; h = mixF(h, p.x); h = mixF(h, p.y); h = mixF(h, p.z); h = mixF(h, q.x); h = mixF(h, q.y); h = mixF(h, q.z); h = mixF(h, q.w); }
    };
    const walk = (E) => {
      const o = E.o;
      if (!E.shallow) { h = mix(h, o.visible ? 1 : 2); if (!o.visible) return; if (o.children.length !== E.len) { this.refresh(E); h = mix(h, ++this._struct); } }
      for (const c of E.vKids) { if (E.known.get(c) === 'W') sw(c); else h = mix(h, c.visible ? 3 : 5); }
      for (const m of E.mKids) walk(m);
    };
    for (const E of this.sets.top) walk(E);
    // (switches straight under the scene: the caravan's carts)
    const R = this.sets.roots, kids = this.engine.scene.children;
    for (let i = 0; i < kids.length; i++) { const c = kids[i]; if (c.userData.shadowSwitch && !R.has(c)) sw(c); }
    for (const w of this._owners) if (!w.o.matrixWorld.equals(w.m)) { w.m.copy(w.o.matrixWorld); h = mix(h, ++this._struct); }
    if (G.cutOn.value > 0.5) {
      h = mix(h, 7);
      for (const k of ['cutA', 'cutR', 'cutF', 'cutH', 'cutK', 'cutP']) for (const v of G[k].value) { h = mixF(h, v.x); h = mixF(h, v.y); h = mixF(h, v.z); h = mixF(h, v.w); }
    }
    return h;
  }

  // ---- once per frame the map is drawn, before coarse.js decides what to hide: will the static casters be drawn?
  prepare(now = performance.now()) {
    this.prepared = true;
    if (!this.on) return (this.staticPass = true);
    // (v115 review) the map re-created (a resize, a context restore): its depth is gone, so is the cache's footing
    const map = this.engine.sun.shadow.map;
    if (map !== this._map) { this._map = map; this.valid = false; this.validT = false; }
    const ver = staticVersion() + (this.engine._coarseV || 0);
    if (ver !== this.ver || !this.sets) { this.ver = ver; this.build(); this.invalidate('version'); }
    const sig = this.signature();
    if (sig !== this.sig) { this.sig = sig; this.invalidate('shown'); }
    if (now > this.nextRefresh) this.invalidate('refresh');
    this.staticPass = this.dirty || !this.valid;
    return this.staticPass;
  }

  // ---- the cache buffers: depth renderbuffers of the map's size and format ('S' the static map; v116 'T' the static map
  // with the swayed casters on it), and the depth blits to and from them
  buf(name, w, h) {
    const gl = this.R.getContext(), B = this.bufs, b = B[name];
    if (b && b.w === w && b.h === h) return b.fb;
    if (b) { gl.deleteFramebuffer(b.fb); gl.deleteRenderbuffer(b.rb); delete B[name]; }
    const rb = gl.createRenderbuffer(), fb = gl.createFramebuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    const st = this.R.state;
    st.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    st.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) { gl.deleteFramebuffer(fb); gl.deleteRenderbuffer(rb); console.warn('[shadowCache] no depth cache buffer: off'); this.on = false; return null; }
    B[name] = { fb, rb, w, h };
    return fb;
  }
  get fb() { return this.bufs.S?.fb || null; } // the static map's buffer
  blit(src, dst, w, h) {
    const gl = this.R.getContext(), st = this.R.state;
    st.setScissorTest(false);
    st.buffers.depth.setMask(true);
    st.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
    st.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
    const chk = (this._blits = (this._blits || 0) + 1) <= 2; // (v115 review: the first copy each way is checked once)
    if (chk) gl.getError();
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    if (chk && gl.getError() !== gl.NO_ERROR) { console.warn('[shadowCache] depth copy failed: off'); this.on = false; this.valid = false; }
    st.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  }
  mapFb() { const m = this.engine.sun.shadow.map; return m ? this.R.properties.get(m).__webglFramebuffer : null; }
  // three's clear of the map in a cached pass: a copy of the cached depth this._src instead (the map is bound), or
  // nothing when the map already holds what the pass draws on (this._src null)
  restore() {
    const m = this.engine.sun.shadow.map, fb = this.mapFb(), src = this._src;
    if (!src || !fb) return;
    this.blit(src, fb, m.width, m.height);
    this.R.setRenderTarget(m);
  }
  // the map's depth into the cache buffer `name`
  keep(name) {
    const m = this.engine.sun.shadow.map, fb = this.mapFb(), dst = m && fb ? this.buf(name, m.width, m.height) : null;
    if (!dst) return false;
    const prev = this.R.getRenderTarget(), face = this.R.getActiveCubeFace(), mip = this.R.getActiveMipmapLevel();
    this.blit(fb, dst, m.width, m.height);
    this.R.setRenderTarget(prev, face, mip);
    return this.on;
  }
  // (v116) how often the swayed casters are drawn: QUALITY.treeShadowHz (phones 10), 0 = every shadow frame; ?treehz=<n>
  treeHz() {
    if (this._treeHz !== undefined) return this._treeHz;
    const q = /[?&]treehz=(\d+)/.exec(globalThis.location?.search || '');
    let hz = q ? +q[1] : QUALITY.treeShadowHz ?? (QUALITY.mobile ? 10 : 0);
    if (QUALITY.shadowHz > 0 && QUALITY.shadowHz <= hz * 1.5) hz = 0; // (the map itself is drawn hardly more often)
    return (this._treeHz = hz);
  }

  // ---- the shadow pass (in place of three's WebGLShadowMap.render, inside coarse.js's wrapper)
  render(lights, scene, camera) {
    const sm = this.R.shadowMap, sun = this.engine.sun;
    if (!this.on || !sm.enabled || (!sm.autoUpdate && !sm.needsUpdate) || lights.length !== 1 || lights[0] !== sun || sm.type !== THREE.PCFShadowMap) {
      if (this.on && sm.enabled && (sm.autoUpdate || sm.needsUpdate) && lights.length) { this.valid = false; this.validT = false; } // (drawn some other way: start afresh)
      return this.renderFn(lights, scene, camera);
    }
    if (!this.prepared) this.prepare();
    this.prepared = false;
    const S = this.sets, hidden = [], casts = [], R = this.R;
    const hide = (o) => { if (o.visible) { o.visible = false; hidden.push(o); } };
    const noCast = (o) => { if (o.castShadow) { o.castShadow = false; casts.push(o); } };
    const putBack = () => { for (const o of hidden) o.visible = true; for (const o of casts) o.castShadow = true; hidden.length = 0; casts.length = 0; };
    const walk = (E, A) => {
      const o = E.o;
      if (!E.shallow) { if (!o.visible) return; if (E.self && !A[E.self]) noCast(o); }
      const kids = E.shallow ? E.keys : o.children;
      for (let i = 0; i < kids.length; i++) {
        const c = kids[i];
        let k = E.known.get(c);
        if (k === 'M') continue;
        if (k === 'W') k = c.userData.shadowStill ? 'S' : 'D'; else if (k === undefined) k = 'D';
        if (!A[k]) hide(c);
      }
      for (const m of E.mKids) walk(m, A);
    };
    // one pass: only the casters of the letters in A. src: undefined = three clears the map first, a cache buffer = the
    // map starts from a copy of it, null = drawn on what the map already holds
    const pass = (A, src) => {
      const kids = scene.children;
      for (let i = 0; i < kids.length; i++) {
        const c = kids[i];
        if (S.roots.has(c)) continue;
        if (!A[c.userData.shadowSwitch && c.userData.shadowStill ? 'S' : 'D']) hide(c);
      }
      for (const E of S.top) walk(E, A);
      const c0 = R.info.render.calls, rc = R.clear;
      if (src !== undefined) { this._src = src; R.clear = this.restore; }
      try { sm.needsUpdate = true; this.renderFn(lights, scene, camera); } finally { R.clear = rc; this._src = null; putBack(); }
      return R.info.render.calls - c0;
    };
    const st = this.stats, now = performance.now(), hz = this.treeHz(), split = hz > 0 && S.nT > 0;
    st.frames++;
    let have = ''; // what the map holds now: '' not known, 'S' the static casters, 'ST' and the swayed ones on them
    if (this.staticPass || !this.valid || !this.fb) {
      // 1. the static casters alone, into the map (three clears it), then kept in the cache buffer
      st.staticDraws = pass(A_S); st.statics++;
      st.reasons[this._why || '?'] = (st.reasons[this._why || '?'] || 0) + 1;
      if (!this.keep('S')) { this.valid = false; return; }
      this.valid = true; this.dirty = false; this._why = ''; this.nextRefresh = performance.now() + REFRESH_MS;
      this.validT = false; have = 'S';
    }
    if (split && (!this.validT || now >= this.nextTree)) {
      // 2. (v116, phones) the swayed casters on the static depth, kept as the second layer, treeHz times a second
      st.treeDraws = pass(A_T, have === 'S' ? null : this.bufs.S.fb); st.trees++;
      if (!this.keep('T')) { this.validT = false; return; }
      this.validT = true; have = 'ST';
      this.nextTree = now + 1000 / hz - 6; // (a little early: the shadow frame nearest the period takes it)
    }
    // 3. the dynamic casters on top (the cached depth copied in first, unless the map already holds it)
    const src = split ? (have === 'ST' ? null : this.bufs.T.fb) : (have ? null : this.bufs.S.fb);
    st.dynDraws = pass(split ? A_D : A_DT, src);
  }
}
const A_S = { S: true }, A_T = { T: true }, A_D = { D: true }, A_DT = { D: true, T: true };
