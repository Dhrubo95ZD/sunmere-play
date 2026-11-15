// MMO third-person camera. The wheel (or a pinch) zooms from a close over-the-shoulder view (2.5 m) out to a wide
// tactical view (32 m), eased in log space so every notch feels the same. Zoom drives the framing: up close the pitch
// eases down to a low, cinematic angle, the lens widens and the look point sits at the upper chest; zoomed out the
// pitch rises toward the classic high three-quarter view. Right-drag turns (and tilts a little); the camera pulls in
// smoothly instead of passing through the ground, walls or roofs, and eases back out once the way is clear.
import { SETTINGS } from '../engine/settings.js';
import * as THREE from 'three';
import { G } from '../engine/globals.js';
import { IS_MOBILE } from '../engine/platform.js';
import { dungeonPush } from '/sunmere-play/shared/dungeons.js';

const _r = new THREE.Vector3(), _off = new THREE.Vector3(), _look = new THREE.Vector3(), _dir = new THREE.Vector3();
const _p = new THREE.Vector3(), _bp = new THREE.Vector3(), _box = new THREE.Box3(), _ray = new THREE.Raycaster();
const D2R = THREE.MathUtils.degToRad, clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const smooth = (t) => t * t * (3 - 2 * t);

// the zoom curve (metres / degrees); everything else is derived from where the zoom sits between MIN and MAX
export const CAM = {
  MIN: 3.0, MAX: 32, DEFAULT: 22,
  PITCH_CLOSE: 13, // degrees at the closest zoom (looking just over the head toward the skyline)
  FOV_CLOSE: 50, FOV_FAR: 34,
  LOOK_CLOSE: 1.95, LOOK_FAR: 1.15, // look-point height over the feet (just over the head up close, so hats sit low in frame)
  SHOULDER: 0.62, // sideways shoulder offset at the closest zoom (the hero sits left of centre), gone by ~8.5 m
  ZOOM_RATE: 10, // log-space easing rate of the zoom (1/s)
  STEP: 0.0016, // log zoom per wheel pixel (a 100 px notch is ~17%)
  PULL_IN: 28, PULL_OUT: 3, // collision: how fast the camera comes in / goes back out (1/s)
  CLEAR: 0.45, // metres kept between the lens and any surface
  PULL_MIN: 1.6, // below this a wall still pulls the lens in (never behind it), but the framing stops getting closer
  HARD_MIN: 0.75, // the very nearest the lens ever comes to the look point
  TILT_MAX: 0.95, // the steepest pitch (rad) the camera rises to when backed against a wall (no straight-down views)
  // in a house (world.house; houses spec §6): the zoom is capped and the view tilts down into the cut-away room, eased over 0.5 s
  HOUSE_MAX: 9.5, HOUSE_MIN: 5, HOUSE_PITCH: 58, HOUSE_CLOSE: 52, HOUSE_EASE: 0.5, // (HOUSE_MIN: nearer, the 2.6 m joists fill the lens)
  // Free camera (SETTINGS.freeCam, off by default): no auto-turn, a wider zoom and a pitch the player sets by hand.
  // The framing (lens, look height, shoulder) still follows the normal MIN..MAX curve and holds its far end beyond it.
  FREE_MIN: 2.0, FREE_MAX: 60, // desktop free zoom range (touchcam.js sets rig.freeMin / freeMax for phones)
  FREE_PITCH_MIN: 0.06, FREE_PITCH_MAX: 1.45, // radians: just over the ground .. ~83 degrees, near top-down
  FREE_PITCH_RATE: 0.0045, // radians per right-drag pixel (desktop)
};
// is the Free camera option on (read every frame, so the Options toggle applies at once)
export const freeCam = () => !!SETTINGS.freeCam;

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.focus = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.yaw = 0; // 0 = looking north (-z)
    this.yawTarget = 0;
    this.yawVel = 0;
    this.pitch = D2R(52); // pitch at the widest zoom (the showcase sets its own, lower)
    this.closePitch = D2R(CAM.PITCH_CLOSE); // pitch at the closest zoom
    this.minDist = CAM.MIN; this.maxDist = CAM.MAX;
    this.dist = CAM.DEFAULT;
    this.distTarget = CAM.DEFAULT;
    this.effDist = this.dist; // after collision
    this.frameDist = this.dist; // what the framing (pitch, lens, look height) follows: the zoom, pulled toward the collided distance
    this.coll = this.maxDist + 5; // collision limit (eased)
    this.tilt = 0; this.tiltTarget = 0; this.colTilt = 0; this.colTiltTarget = 0; // user pitch offset from a vertical right-drag (radians)
    this.shake = 0;
    this.shakeT = 0;
    // rotational kick on hits (radians), a stiff spring back to zero
    this.kick = new THREE.Vector2(); this.kickV = new THREE.Vector2();
    // story scenes: frame another point, tilt lower, move slowly
    this.sceneFocus = null; this.pitchBias = 0; this.pitchBiasTarget = 0;
    this.env = null; // { heightAt(x,z), world } from game.js, for collision
    this.followK = 0; // >0: ease the yaw toward followYaw (click-to-move), set each frame by game.js
    this.followYaw = 0;
    this._fy = null; this._frame = 0; this._hit = Infinity; this._occ = null; this._occT = 0;
    this.houseK = 0; this._inHouse = false; this._houseDist = null; // house mode: 0 outside .. 1 inside (eased)
    // free camera: its own zoom range and a hand-set pitch (freePitch eases to freePitchTarget; null = take the current view)
    this.freeMin = CAM.FREE_MIN; this.freeMax = CAM.FREE_MAX; this.freePitch = null; this.freePitchTarget = null; this._pitchNow = D2R(52); this._free = false;
    dom.addEventListener('wheel', (e) => {
      const px = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
      this.zoomBy(Math.exp(clamp(px, -240, 240) * CAM.STEP));
    }, { passive: true });
    // hold the right mouse button and drag to turn the camera; a right click without dragging stays a click.
    // Turning reads the cursor position (no pointer lock: lock changes how browsers report buttons and
    // movement mid-drag, which stalled the turn). Pointer capture keeps the drag alive over the HUD and
    // even outside the window; the cursor is hidden while turning.
    this.rightDown = false; this.rightDragged = false;
    let travel = 0, lx = 0, ly = 0, pid = null;
    const endDrag = () => {
      if (!this.rightDown) return;
      this.rightDown = false;
      try { if (pid !== null && dom.hasPointerCapture?.(pid)) dom.releasePointerCapture(pid); } catch {}
      pid = null;
      dom.style.cursor = '';
    };
    dom.addEventListener('pointerdown', (e) => {
      if (e.button !== 2 || e.pointerType === 'touch') return;
      this.rightDown = true; this.rightDragged = false; travel = 0; lx = e.clientX; ly = e.clientY;
      pid = e.pointerId;
      try { dom.setPointerCapture(pid); } catch {}
    });
    const move = (e) => {
      if (!this.rightDown) return;
      if (e.buttons === 0) { endDrag(); return; } // released somewhere we did not hear about
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      if (!this.rightDragged) {
        travel += Math.abs(dx) + Math.abs(dy);
        if (travel > 4) { this.rightDragged = true; dom.style.cursor = 'none'; }
      }
      if (this.rightDragged) {
        this.yawTarget -= dx * 0.0065;
        if (freeCam()) this.tiltFree(dy * CAM.FREE_PITCH_RATE); // free camera: up/down sets the pitch, low to near top-down
        else this.tiltTarget = clamp(this.tiltTarget + dy * 0.0035, -0.3, 0.38);
      }
    };
    dom.addEventListener('pointermove', move);
    addEventListener('pointermove', (e) => { if (e.target !== dom) move(e); });
    addEventListener('pointerup', (e) => { if (e.button === 2) endDrag(); });
    dom.addEventListener('lostpointercapture', endDrag);
    addEventListener('blur', endDrag);
  }
  // multiply the wanted distance (k > 1 zooms out); every zoom input goes through here and is eased in update()
  zoomBy(k) {
    if (!(k > 0)) return;
    // zooming out from a collided camera starts from where the lens really is, so the first notch does something
    // (once per frame: a pinch sends many small steps between two frames)
    if (k > 1 && this._zoomF !== this._frame && this._hit < Infinity && this.effDist < this.distTarget - 0.5) this.distTarget = Math.max(this.effDist, this.minDist);
    this._zoomF = this._frame;
    this.distTarget = clamp(this.distTarget * k, this.houseMin(), this.houseMax());
  }
  // the zoom range in use: the free camera's wider one when that option is on, else minDist..maxDist
  zMin() { return freeCam() ? Math.min(this.minDist, this.freeMin) : this.minDist; }
  zMax() { return freeCam() ? Math.max(this.maxDist, this.freeMax) : this.maxDist; }
  // the zoom cap: CAM.HOUSE_MAX while you stand in a house (the zoom input is clamped to it), else the zoom range
  houseMax() { return this._inHouse ? Math.min(this.zMax(), CAM.HOUSE_MAX) : this.zMax(); }
  houseMin() { return this._inHouse ? Math.max(this.zMin(), CAM.HOUSE_MIN) : this.zMin(); }
  // free camera: raise (+) or lower (-) the hand-set pitch
  tiltFree(d) {
    if (this.freePitchTarget == null) this.freePitchTarget = this.freePitch ?? this._pitchNow;
    this.freePitchTarget = clamp(this.freePitchTarget + d, CAM.FREE_PITCH_MIN, CAM.FREE_PITCH_MAX);
  }
  // the pitch the normal zoom curve gives at a distance (outside a house, no hand tilt)
  curvePitch(dist = this.distTarget) {
    const t = this.zoomT(dist);
    return lerp(Math.min(this.closePitch, this.pitch), this.pitch, Math.pow(t, 0.85));
  }
  // Reset camera: in behind the hero (followYaw, set by game.js each frame), at a distance, with the curve's pitch
  resetView(dist = CAM.DEFAULT) {
    if (this.sceneFocus) return;
    let d = this.followYaw - this.yawTarget; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yawTarget += d;
    this.distTarget = clamp(dist, this.houseMin(), this.houseMax());
    this.tiltTarget = 0;
    this.freePitchTarget = this.curvePitch(this.distTarget);
  }
  // touch (ui/touch.js): one finger dragged over the right of the screen turns the camera, sideways for yaw and up/down
  // to ease the zoom (and so the pitch); two fingers pinch to zoom. Both use the same eased zoom as the wheel.
  touchTurn(dx, dy = 0) {
    this.yawTarget -= dx * 0.0085;
    if (dy) this.zoomBy(Math.exp(dy * 0.0035));
  }
  touchZoom(k) { if (k > 0) this.zoomBy(1 / k); }
  // the login showcase holds a fixed low angle; entering the world returns to the zoom curve at the default distance
  setShowcase(on) {
    if (on) { this.pitch = this.closePitch = 0.3; return; }
    this.pitch = D2R(52); this.closePitch = D2R(CAM.PITCH_CLOSE); this.distTarget = CAM.DEFAULT; this.tiltTarget = 0;
  }
  addShake(amount) { if (SETTINGS.shake) this.shake = Math.min(1.2, this.shake + amount); }
  // a short rotational kick (radians, ~0.07 = 4 deg); dir is the world direction the blow travels, if known
  addKick(amount, dir) {
    if (!SETTINGS.shake) return;
    const a = Math.min(0.1, amount);
    let sx = (Math.random() - 0.5) * 0.8, sy = 0.7;
    if (dir) {
      _r.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); // camera right on the ground
      sx = clamp(dir.x * _r.x + dir.z * _r.z, -1, 1);
      sy = 0.5;
    }
    this.kickV.x += sx * a * 30; this.kickV.y += sy * a * 30;
  }
  // 0 at the closest zoom, 1 at the widest (log scale, so the curve spends as long close in as far out)
  zoomT(dist = this.dist) { return clamp(Math.log(dist / this.minDist) / Math.log(this.maxDist / this.minDist), 0, 1); }
  // kept for older callers: 0 close, 1 far (smoothstep)
  closeK(dist = this.dist) { return smooth(this.zoomT(dist)); }

  // ---------------------------------------------------------------- collision
  // static occluders: the world's placed buildings and props (world.dyn), each mesh with its world box, so a ray
  // only tests the triangles of meshes it actually crosses. Small things (lamps, barrels, signs), glass, water,
  // instanced foliage and characters are left out: the camera never bumps on those.
  occluders() {
    const W = this.env?.world;
    if (!W?.dyn) return [];
    if (this._occ && this._occN === W.dyn.length) return this._occ;
    const list = [];
    for (const obj of W.dyn) {
      obj.updateWorldMatrix(true, true);
      obj.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry?.attributes?.position) return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m || m.transparent || m.depthWrite === false || o.userData.noCamCollide) return;
        const g = o.geometry;
        if (!g.boundingBox) {
          if (g.attributes.position.array) g.computeBoundingBox();
          else if (g.boundingSphere) g.boundingBox = g.boundingSphere.getBoundingBox(new THREE.Box3()); // freed on phones (slim.js)
          else return;
        }
        const box = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
        const sx = box.max.x - box.min.x, sy = box.max.y - box.min.y, sz = box.max.z - box.min.z;
        if (Math.max(sx, sz) < 1.6 && sy < 2.6) return; // small props
        if (sy < 0.5) return; // flat paving and decks: the terrain test covers the ground
        list.push({ o, box, root: obj });
      });
    }
    this._occ = list; this._occN = W.dyn.length;
    return list;
  }
  // first surface between the look point and the wanted lens position (metres along dir), or Infinity
  castHit(look, dir, len) {
    let hit = Infinity;
    const H = this.env?.heightAt;
    if (H) {
      // the ground: march out along the ray, then refine the first step that went under
      const N = 12, cl = CAM.CLEAR + 0.1;
      let prev = 0;
      for (let i = 1; i <= N; i++) {
        const d = (len * i) / N;
        _p.copy(look).addScaledVector(dir, d);
        if (_p.y < H(_p.x, _p.z) + cl) {
          let a = prev, b = d;
          for (let k = 0; k < 5; k++) { const m = (a + b) / 2; _p.copy(look).addScaledVector(dir, m); if (_p.y < H(_p.x, _p.z) + cl) b = m; else a = m; }
          hit = a; break;
        }
        prev = d;
      }
    }
    const W = this.env?.world;
    if (W && W.indoor) {
      // underground: the dungeon's rock (any spot off the floor grid) and its pillars, crates and drums (round colliders)
      const N = 16;
      for (let i = 1; i <= N; i++) {
        const d = (len * i) / N;
        _p.copy(look).addScaledVector(dir, d);
        const [px, pz] = dungeonPush(_p.x, _p.z, 0.25);
        if (Math.abs(px - _p.x) + Math.abs(pz - _p.z) > 0.02) { hit = Math.min(hit, Math.max(0.5, d - len / N)); break; }
      }
      const hx = dir.x, hz = dir.z, a = hx * hx + hz * hz;
      if (a > 1e-4 && W.colliders) for (const c of W.colliders) {
        if (!c.r || c.r < 0.6) continue;
        const rx = c.x - look.x, rz = c.z - look.z;
        if (Math.abs(rx) > len + c.r || Math.abs(rz) > len + c.r) continue;
        const rr = c.r + 0.3, b = -2 * (hx * rx + hz * rz), cc = rx * rx + rz * rz - rr * rr;
        if (cc < 0) continue; // the look point is inside it (hugging a pillar): never pull in to nothing
        const disc = b * b - 4 * a * cc;
        if (disc < 0) continue;
        const t0 = (-b - Math.sqrt(disc)) / (2 * a);
        if (t0 > 0.4 && t0 < hit) hit = t0;
      }
    }
    // in a house the walls are cut away round you: only the ground (and the house floors in it) stops the lens
    if (W && !W.indoor && !this._inHouse) {
      _ray.set(look, dir); _ray.near = 0.4; _ray.far = Math.min(hit, len) + CAM.CLEAR;
      _box.makeEmpty().expandByPoint(look).expandByPoint(_p.copy(look).addScaledVector(dir, _ray.far));
      const cand = [];
      for (const c of this.occluders()) {
        if (!c.box.intersectsBox(_box) || !_ray.ray.intersectsBox(c.box)) continue;
        if (!c.root.visible || c.root.parent?.visible === false || !c.o.visible) continue;
        // phones free a static mesh's vertex copy once it is on the GPU (engine/slim.js): it cannot be ray-tested, so
        // its box stands in for it (unless the look point is inside that box)
        if (!c.o.geometry?.attributes?.position?.array) {
          if (!c.box.containsPoint(look) && _ray.ray.intersectBox(c.box, _bp) && !W.cutHides?.(_bp)) hit = Math.min(hit, _bp.distanceTo(look));
          continue;
        }
        cand.push(c.o);
        if (cand.length > 24) break;
      }
      if (cand.length) {
        // (v108) what an open house's cut-away hides (its roof and upper walls) never stops the lens
        const hits = _ray.intersectObjects(cand, false), h = hits.find((q) => !W.cutHides?.(q.point));
        if (h) hit = Math.min(hit, h.distance);
      }
    }
    return hit;
  }

  update(dt, followPos) {
    this.target.copy(this.sceneFocus || followPos);
    const slow = this.sceneFocus || Math.abs(this.pitchBias) > 0.01;
    // the focus: tight sideways (no swimming), softer vertically (steps, slopes and jumps do not bob the view);
    // a teleport or a long fade-in snaps
    if (this.focus.distanceToSquared(this.target) > 400) this.focus.copy(this.target);
    const kh = 1 - Math.exp(-dt * (slow ? 2.2 : 11)), kv = 1 - Math.exp(-dt * (slow ? 2.2 : 6));
    this.focus.x += (this.target.x - this.focus.x) * kh;
    this.focus.z += (this.target.z - this.focus.z) * kh;
    this.focus.y += (this.target.y - this.focus.y) * kv;
    // house mode: entering saves the zoom and caps it; leaving gives the saved zoom back; pitch and cap ease over 0.5 s
    const inHouse = !!this.env?.world?.house && !this.sceneFocus;
    if (inHouse !== this._inHouse) {
      this._inHouse = inHouse;
      if (inHouse) { this._houseDist = this.distTarget; this.distTarget = clamp(this.distTarget, CAM.HOUSE_MIN, CAM.HOUSE_MAX); }
      else if (this._houseDist != null) { this.distTarget = this._houseDist; this._houseDist = null; }
    }
    this.houseK = clamp(this.houseK + (inHouse ? 1 : -1) * dt / CAM.HOUSE_EASE, 0, 1);
    const hk = smooth(this.houseK);
    const free = freeCam(), zMin = this.zMin(), zMax = this.zMax();
    if (free !== this._free) { this._free = free; this.freePitch = this.freePitchTarget = free ? this._pitchNow : null; if (!free) this.distTarget = clamp(this.distTarget, this.minDist, this.maxDist); }
    const maxEff = lerp(zMax, Math.min(zMax, CAM.HOUSE_MAX), hk);
    // zoom eased in log space (each notch takes the same time, near or far)
    const ld = Math.log(this.dist), lt = Math.log(clamp(this.distTarget, lerp(zMin, Math.max(zMin, CAM.HOUSE_MIN), hk), maxEff));
    this.dist = Math.exp(ld + (lt - ld) * (1 - Math.exp(-dt * (slow ? 1.6 : CAM.ZOOM_RATE))));
    const h = Math.min(dt, 0.05);
    // click-to-move: drift the view in behind the hero, gently, while nobody is turning it by hand
    // (never with the free camera: it only turns when the player turns it)
    if (this.followK > 0 && !this.rightDown && !slow && !free) {
      let d = this.followYaw - this.yawTarget; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yawTarget += d * (1 - Math.exp(-dt * this.followK));
    }
    if (slow) { this.yaw += (this.yawTarget - this.yaw) * (1 - Math.exp(-dt * 1.2)); this.yawVel = 0; }
    else if (Math.abs(this.yawTarget - this.yaw) > 3) { this.yaw = this.yawTarget; this.yawVel = 0; } // teleports, scripted cuts
    else {
      // critically damped spring: turns start soft and settle without overshoot
      const w = 12, x = this.yaw - this.yawTarget;
      this.yawVel += (-w * w * x - 2 * w * this.yawVel) * h; this.yaw += this.yawVel * h;
    }
    this.pitchBias += (this.pitchBiasTarget - this.pitchBias) * (1 - Math.exp(-dt * 1.8));
    this.tilt += (this.tiltTarget - this.tilt) * (1 - Math.exp(-dt * 12));
    // a camera pulled in by a wall frames like a closer zoom (lower, wider), or it would stare down at the ground
    const fw = Math.min(this.dist, lerp(this.dist, this.effDist, 0.75));
    if (Math.abs(this.frameDist - this.dist) > 40) this.frameDist = this.dist;
    this.frameDist += (fw - this.frameDist) * (1 - Math.exp(-dt * (fw < this.frameDist ? 6 : 2.5)));
    const t = this.zoomT(this.frameDist), s = smooth(t);
    // pitch: low and cinematic close in, rising toward the high tactical view; a hand tilt on top (less of it close in)
    const farP = lerp(this.pitch, D2R(CAM.HOUSE_PITCH), hk), closeP = lerp(this.closePitch, D2R(CAM.HOUSE_CLOSE), hk);
    let pitch = lerp(Math.min(closeP, farP), farP, Math.pow(t, 0.85));
    if (free) {
      // the free camera: the hand-set pitch (eased), still pulled toward the house view indoors
      if (this.freePitchTarget == null) this.freePitchTarget = this._pitchNow;
      if (this.freePitch == null) this.freePitch = this.freePitchTarget;
      this.freePitch += (this.freePitchTarget - this.freePitch) * (1 - Math.exp(-dt * 12));
      pitch = lerp(this.freePitch, pitch, hk);
      pitch = clamp(pitch + this.pitchBias * (0.35 + 0.65 * s), CAM.FREE_PITCH_MIN, CAM.FREE_PITCH_MAX);
    } else {
      pitch += this.tilt * (0.55 + 0.45 * t);
      pitch = clamp(pitch + this.pitchBias * (0.35 + 0.65 * s), 0.06, 1.25);
    }
    this._pitchNow = pitch;
    // the look point: upper chest up close, a little lower and leading ahead when far (the hero sits low in frame)
    const lead = this.sceneFocus ? 0 : smooth(clamp((t - 0.45) / 0.55, 0, 1)) * 1.4 * clamp((this.pitch - 0.3) / 0.3, 0, 1); // not on the login showcase
    const sh = this.sceneFocus ? 0 : CAM.SHOULDER * (1 - smooth(clamp((this.frameDist - this.minDist) / 5.5, 0, 1)));
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); // camera forward on the ground
    _look.set(this.focus.x + fx * lead - fz * sh, this.focus.y + lerp(CAM.LOOK_CLOSE, CAM.LOOK_FAR, s), this.focus.z + fz * lead + fx * sh);
    // collision, every other frame on desktop, every third on phones (the last hit is held in between).
    // Blocked right behind the hero (back to a wall, under eaves), the camera first tries to rise over the obstacle:
    // a few steeper angles are tested and the lowest clear one is eased in (colTilt), then it pulls in along that line.
    this._frame++;
    const setDir = (pt) => _dir.set(Math.sin(this.yaw) * Math.cos(pt), Math.sin(pt), Math.cos(this.yaw) * Math.cos(pt));
    if (this.env && this._frame % (IS_MOBILE ? 3 : 2) === 0) {
      const tight = CAM.PULL_MIN + CAM.CLEAR + 0.8, need = Math.min(this.dist, 7);
      const base = this.castHit(_look, setDir(pitch), this.dist);
      let tt = 0;
      if (base < tight && base < this.dist) {
        let best = base;
        for (const k of [0.2, 0.4]) {
          const pt = Math.min(CAM.TILT_MAX, pitch + k);
          if (pt <= pitch + 0.02) break;
          const hk = this.castHit(_look, setDir(pt), this.dist);
          if (hk > best + 0.3) { best = hk; tt = pt - pitch; }
          if (hk >= need) break;
        }
      }
      this.colTiltTarget = tt;
      this._hit = Math.abs(this.colTilt) < 0.01 && tt === 0 ? base : this.castHit(_look, setDir(pitch + this.colTilt), this.dist);
    } else if (!this.env) this._hit = Infinity;
    this.colTilt += ((this.colTiltTarget || 0) - this.colTilt) * (1 - Math.exp(-dt * (this.colTiltTarget > this.colTilt ? 7 : 2)));
    setDir(Math.max(pitch, Math.min(CAM.TILT_MAX, pitch + this.colTilt)));
    // (no nearer than PULL_MIN: with the hero's back to a wall the lens stays behind the head and the wall fades round the
    // hero instead, see updateFade; closer than that the view would be all shoulder plate)
    // (a wall nearer than that still pulls the lens in front of it: sitting behind a wall shows only its back faces)
    const want = this._hit < Infinity ? Math.max(this.hardMin ?? CAM.HARD_MIN, this._hit - CAM.CLEAR) : zMax + 5;
    if (want < this.coll) this.coll = this.coll - (this.coll - want) * (1 - Math.exp(-dt * CAM.PULL_IN));
    else this.coll += (want - this.coll) * (1 - Math.exp(-dt * (this.pullOut ?? CAM.PULL_OUT)));
    if (this.coll > this._hit - CAM.CLEAR * 0.5 && want < this.dist) this.coll = want; // never behind a surface, not even for a frame
    this.effDist = Math.min(this.dist, this.coll);
    // lens: wider up close (only touch the projection when it really changes); a nearer near plane close in
    const fov = lerp(CAM.FOV_CLOSE, CAM.FOV_FAR, s);
    const near = this.effDist < 2 ? 0.1 : this.effDist < 6 ? 0.2 : 0.5;
    if (Math.abs(fov - this.camera.fov) > 0.05 || near !== this.camera.near) { this.camera.fov = fov; this.camera.near = near; this.camera.updateProjectionMatrix(); }
    _off.copy(_dir).multiplyScalar(this.effDist);
    this.camera.position.copy(_look).add(_off);
    // never below the ground at the lens itself (the ray test above samples, this catches the last few centimetres)
    if (this.env?.heightAt) { const gy = this.env.heightAt(this.camera.position.x, this.camera.position.z) + 0.3; if (this.camera.position.y < gy) this.camera.position.y = gy; }
    if (this.shake > 0.001) {
      this.shakeT += dt * 38;
      const a = this.shake * this.shake * 0.24 * clamp(this.effDist / 12, 0.35, 1);
      this.camera.position.x += Math.sin(this.shakeT * 1.3) * a;
      this.camera.position.y += Math.sin(this.shakeT * 1.7 + 1) * a;
      this.camera.position.z += Math.sin(this.shakeT * 1.1 + 2) * a;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
    this.camera.lookAt(_look);
    // rotational kick: spring back to zero in about 120 ms
    // (sub-stepped: explicit Euler on this stiff spring diverges past ~0.03 s, so below 50 fps a frame is split into
    // steps of at most 0.02 s; at 50 fps and above it is one step, exactly as before)
    const kw = 30, kn = Math.ceil(h / 0.02), ks = h / kn;
    for (let i = 0; i < kn; i++) {
      this.kickV.x += (-kw * kw * this.kick.x - 2 * kw * this.kickV.x) * ks; this.kick.x += this.kickV.x * ks;
      this.kickV.y += (-kw * kw * this.kick.y - 2 * kw * this.kickV.y) * ks; this.kick.y += this.kickV.y * ks;
    }
    if (Math.abs(this.kick.x) + Math.abs(this.kick.y) > 1e-5) {
      this.camera.rotateZ(this.kick.x * 0.7); this.camera.rotateY(this.kick.x * 0.35); this.camera.rotateX(this.kick.y * 0.6);
    }
  }
  // screen-relative movement axes on the ground plane
  axes() {
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    return { fwd, right };
  }
  // update the see-through circle for the hero
  updateFade(heroPos) {
    const p = heroPos.clone().add(new THREE.Vector3(0, 1.1, 0));
    const v = p.clone().project(this.camera);
    G.fadeCenter.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    G.fadeDepth.value = p.clone().applyMatrix4(this.camera.matrixWorldInverse).z * -1;
    // about three quarters of the hero's on-screen height, whatever the zoom and lens
    const heroH = 1.9 / (2 * Math.max(1, this.effDist) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    G.fadeRadius.value = clamp(heroH * 0.75, 0.05, 0.3);
    // up close the hero fills the frame: no see-through circle (it would hollow out the scene around them)
    // (v108: with hysteresis, 4.6 / 5.4 m, so a zoom resting near 5 m never switches it frame to frame; and the world gets
    // the lens position for the house cut-away, world.updateCuts)
    const open = this._hit !== Infinity || this.effDist > (G.fadeOn.value > 0.5 ? 4.6 : 5.4);
    G.fadeOn.value = open ? 1 : 0;
    if (this.env?.world) (this.env.world.camPos ||= new THREE.Vector3()).copy(this.camera.position);
  }
}
