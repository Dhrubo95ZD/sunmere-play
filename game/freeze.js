// Frozen static matrices (perf plan D1). three recomputes every object's world matrix every frame: the scene itself
// recomposes its matrix each frame and forces the whole tree below it, so even matrixAutoUpdate = false only saves the
// compose, not the multiply or the walk. freezeStatic() computes a static subtree's matrices once and then replaces the
// walk into it with a 16-number check on its parent (the subtree is redone only if the parent really moved).
//
//   freezeStatic(root, { exclude, dynamic }) -> { roots, nodes }
//     root: a built static group (world.group, an area group, a dungeon). Subtrees that hold anything dynamic are left
//     walking as before; only their static siblings freeze. Dynamic: userData.update / userData.dyn / userData.machine
//     / userData.door, skinned meshes and bones, lights, cameras, anything in `dynamic` (an array or Set, e.g. the
//     scatter's dynamics list) or for which exclude(o) is true. Glow points (assets/glowfield.js) count as static: a
//     frozen subtree reports its glows to the glow field itself each frame.
//   refreeze(obj)  after deliberately moving something inside a frozen subtree (or adding to it): recompute it
//   thaw(obj)      give a subtree back to the normal walk (for example before animating it)
//   markDynamic(o) flag an object so freezeStatic leaves it (and everything above it) walking
// Rules for callers: nothing may be added to, removed from or moved inside a frozen subtree without refreeze(); hiding
// and showing (visible) is fine.
import * as THREE from 'three';
import { collectGlows, reportGlows } from '../assets/glowfield.js';

const OBJ_UMW = THREE.Object3D.prototype.updateMatrixWorld;

// bumped whenever a subtree is frozen, refrozen, thawed or put on the walk-on-demand step (engine/coarse.js rescans)
let VERSION = 0;
export const freezeVersion = () => VERSION;
// (v115) bumped only when a static subtree is frozen, refrozen or thawed (not for a new walk-on-demand prop): the static
// shadow cache (engine/shadowCache.js) classifies the world again then
let SVERSION = 0;
export const staticVersion = () => SVERSION;
// (v116) something static was added or turned static outside freezeStatic (a model slot whose GLB came in): classify again
export function bumpStatic() { VERSION++; SVERSION++; }

export function markDynamic(o) { o.userData.dyn = true; return o; }

export function isDynamic(o) {
  if (o.isGlowPoint) return false;
  const u = o.userData;
  return !!(u.update || u.dyn || u.machine || u.door || u.wheels || o.isSkinnedMesh || o.isBone || o.isLight || o.isCamera || o.isGlowField);
}

// the walk step of a frozen subtree root: redo the subtree only if the parent's world matrix changed
function frozenUpdateMatrixWorld() {
  const F = this._frozen, p = this.parent;
  if (p && !p.matrixWorld.equals(F.pmw)) { F.pmw.copy(p.matrixWorld); OBJ_UMW.call(this, true); }
  if (F.glows.length) reportGlows(F.glows);
}

function freezeRoot(o) {
  o.traverse((n) => { if (n.matrixAutoUpdate) { n.updateMatrix(); n.matrixAutoUpdate = false; } });
  OBJ_UMW.call(o, true);
  o._frozen = { pmw: (o.parent ? o.parent.matrixWorld : new THREE.Matrix4()).clone(), glows: collectGlows(o) };
  o.updateMatrixWorld = frozenUpdateMatrixWorld;
}

export function freezeStatic(root, { exclude = null, dynamic = null } = {}) {
  VERSION++; SVERSION++;
  const dyn = dynamic ? new Set(dynamic) : null;
  // bring everything up to date first (bypassing any per-object overrides)
  root.parent?.updateWorldMatrix(true, false);
  OBJ_UMW.call(root, true);
  const isDyn = (o) => isDynamic(o) || (dyn && dyn.has(o)) || (exclude && exclude(o));
  const has = new Map();
  const scan = (o) => {
    if (isDyn(o)) { has.set(o, true); return true; }
    let any = false;
    for (const c of o.children) if (scan(c)) any = true;
    has.set(o, any);
    return any;
  };
  scan(root);
  let roots = 0, nodes = 0;
  const freeze = (o) => {
    if (o._frozen) return; // already frozen
    if (isDyn(o)) return; // walks as before, with all it holds
    if (!has.get(o)) { freezeRoot(o); roots++; o.traverse(() => nodes++); return; }
    // holds something dynamic: its own matrix stays put, its static children freeze
    if (o.matrixAutoUpdate) { o.updateMatrix(); o.matrixAutoUpdate = false; }
    for (const c of o.children) freeze(c);
  };
  for (const c of root.children) freeze(c);
  if (!isDyn(root) && root.matrixAutoUpdate) { root.updateMatrix(); root.matrixAutoUpdate = false; }
  return { roots, nodes };
}

// recompute a frozen subtree after a deliberate change inside it (positions, added or removed children)
export function refreeze(obj) {
  VERSION++; SVERSION++;
  let top = obj;
  for (let p = obj; p; p = p.parent) if (p._frozen) top = p;
  top.traverse((n) => { n.updateMatrix(); n.matrixAutoUpdate = false; });
  OBJ_UMW.call(top, true);
  if (top._frozen) { top._frozen.glows = collectGlows(top); if (top.parent) top._frozen.pmw.copy(top.parent.matrixWorld); }
  return top;
}

// back to three's normal walk
export function thaw(obj) {
  VERSION++; SVERSION++;
  obj.traverse((n) => {
    if (n._frozen) { delete n._frozen; delete n.updateMatrixWorld; }
    n.matrixAutoUpdate = true;
  });
  for (let p = obj.parent; p; p = p.parent) if (p._frozen) { thaw(p); break; }
}

// Walk on demand, for animated props that only move when their own update runs (fires, smoke, swinging lanterns; the
// owners update them only near the player): the scene walk redoes the subtree on frames after update() ran, when the
// parent moved, or the first time; otherwise it is skipped (its glows still report). wrapUpdate wraps
// obj.userData.update so a call marks the subtree for the next walk.
function demandUpdateMatrixWorld(force) {
  const D = this._demand, p = this.parent;
  const moved = p && !p.matrixWorld.equals(D.pmw);
  if (D.dirty || moved || this.matrixWorldNeedsUpdate) {
    D.dirty = false;
    if (p) D.pmw.copy(p.matrixWorld);
    OBJ_UMW.call(this, true);
    if (!D.glows) D.glows = collectGlows(this);
    return;
  }
  if (D.glows?.length) reportGlows(D.glows);
}
export function walkOnDemand(obj) {
  if (obj._demand) return obj;
  VERSION++;
  obj._demand = { dirty: true, pmw: new THREE.Matrix4(), glows: null };
  obj.updateMatrixWorld = demandUpdateMatrixWorld;
  const up = obj.userData.update;
  // (marks every demand-walked ancestor too: an owner may update a nested prop directly; v116: an update that returns
  // false moved nothing this step, e.g. a lantern standing still, and marks nothing)
  if (up) obj.userData.update = function (...a) { const r = up.apply(this, a); if (r !== false) for (let o = obj; o; o = o.parent) if (o._demand) o._demand.dirty = true; return r; };
  return obj;
}
// a sprite (or any leaf) that is hidden is not drawn: skip its walk step (the walk on the frame it shows recomputes it)
function hiddenSkipUpdateMatrixWorld(force) { if (this.visible) OBJ_UMW.call(this, force || this.matrixWorldNeedsUpdate); }
export function skipWhenHidden(obj) { obj.updateMatrixWorld = hiddenSkipUpdateMatrixWorld; return obj; }
