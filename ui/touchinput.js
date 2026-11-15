// Touch input core (phones and tablets; the desktop never builds it): what each finger on the 3D view is doing.
//   stick   a finger that lands in the stick zone (left 45% of the screen, under the frame band) drives a floating stick:
//           the base appears under the thumb (or stays at home in 'fixed' mode), a push past 55% runs, and the base
//           follows a thumb that slides past 1.35 radii
//   cam     any other finger: drag to turn (sideways) and tilt (up/down), never zoom
//   pinch   two fingers anywhere that is not an active stick zoom the camera. A second finger that lands within 180 ms
//           of a stick finger that has barely moved (< 10 px) turns the pair into a pinch (the stick is dropped);
//           otherwise stick + drag run together (move and turn)
//   tap     a short touch that did not travel targets what is under it; two taps in one spot interact
// The gesture logic is plain (createGestures, no DOM) so node can test it; initTouchInput wires it to the canvas.
import { SETTINGS, TOUCH_EVENT } from '../engine/settings.js';
import * as touchcam from '../game/touchcam.js';

export const GESTURE = Object.freeze({
  PINCH_WINDOW: 180, PINCH_SLOP: 10, // ms / px: a stick finger this fresh and this still joins a pinch
  MOVE_SLOP: 10, // px before a finger counts as moved (no tap, the stick starts)
  TAP_MS: 350, DOUBLE_MS: 330, DOUBLE_PX: 40,
  DEAD: 0.12, RUN: 0.55, FOLLOW: 1.35, // stick dead zone, run threshold, base-follow distance (radii)
  ZONE_X: 0.45, ZONE_TOP: 120, // stick zone: x < 45% W, y > safe top + 120u
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const T = () => SETTINGS.touch;

// the spec unit: 1 on a 412-tall screen, times the button-size option
export const unit = (H = innerHeight) => clamp(H / 412, 0.85, 1.25) * (T()?.btnScale || 1);
// where the stick rests and how big it is (base 112u, so the radius is 56u); mirrored for left-handed players
export function stickGeom(W = innerWidth, H = innerHeight, sb = { l: 0, r: 0, t: 0, b: 0 }) {
  const u = unit(H), R = 56 * u, off = 28 * u + R;
  const x = T()?.leftHanded ? W - sb.r - off : sb.l + off;
  return { R, u, home: { x, y: H - sb.b - off } };
}
// the default zone test: 'stick' in the bottom-left (bottom-right when left-handed), 'cam' anywhere else
export function defaultZoneTest(x, y, W = innerWidth, H = innerHeight, sb = { l: 0, r: 0, t: 0, b: 0 }) {
  const inX = T()?.leftHanded ? x > W * (1 - GESTURE.ZONE_X) : x < W * GESTURE.ZONE_X;
  return inX && y > sb.t + GESTURE.ZONE_TOP * unit(H) ? 'stick' : 'cam';
}

// cfg: { zoneTest(x,y), now(), geom() -> { R, home }, fixed() -> bool,
//        onDrag(dx,dy), onPinch(scale), onTap(x,y,isDouble), onCamFingers(n), onStickVisual(v), onStickCancel() }
export function createGestures(cfg) {
  const now = cfg.now || (() => performance.now());
  const stick = { x: 0, y: 0, mag: 0, active: false };
  const fingers = new Map(); // id -> { role: 'stick'|'cam'|'pinch', x0, y0, x, y, px, py, t0, moved }
  let stickId = null, pinch = null, lastTap = null;
  const camCount = () => { let n = 0; for (const f of fingers.values()) if (f.role !== 'stick') n++; return n; };
  const camChanged = () => cfg.onCamFingers?.(camCount());
  const vis = (on, f, m = 0, kx = 0, ky = 0) => cfg.onStickVisual?.({ on, run: on && m >= GESTURE.RUN, base: on && f ? { x: f.bx, y: f.by } : cfg.geom().home, knob: { x: kx, y: ky } });
  const resetStick = () => {
    stickId = null; stick.x = stick.y = stick.mag = 0; stick.active = false;
    vis(false);
  };
  const setStick = (f) => {
    const { R } = cfg.geom();
    let dx = f.x - f.bx, dy = f.y - f.by, d = Math.hypot(dx, dy);
    // the base follows a thumb that slides far past the rim, so the stick never "runs out" (not in fixed mode)
    if (!f.fixed && d > R * GESTURE.FOLLOW) { const k = (d - R * GESTURE.FOLLOW) / d; f.bx += dx * k; f.by += dy * k; dx = f.x - f.bx; dy = f.y - f.by; d = Math.hypot(dx, dy); }
    const m = Math.min(1, d / R), a = Math.atan2(dy, dx);
    stick.mag = m < GESTURE.DEAD ? 0 : m; stick.x = Math.cos(a) * stick.mag; stick.y = Math.sin(a) * stick.mag;
    vis(true, f, m, Math.cos(a) * m * R, Math.sin(a) * m * R);
  };
  const startPinch = (a, b) => {
    const A = fingers.get(a), B = fingers.get(b);
    A.role = B.role = 'pinch'; A.moved = B.moved = true;
    pinch = { a, b, d0: Math.hypot(A.x - B.x, A.y - B.y) || 1 };
  };

  function down(id, x, y) {
    const t = now();
    const f = { x0: x, y0: y, x, y, px: x, py: y, t0: t, moved: false, role: 'cam' };
    // a pinch partner: a free camera finger, or a stick finger that only just landed and has not moved
    let partner = null;
    if (!pinch) {
      const fresh = (g) => t - g.t0 <= GESTURE.PINCH_WINDOW && Math.hypot(g.x - g.x0, g.y - g.y0) < GESTURE.PINCH_SLOP;
      const inStick = stickId === null && cfg.zoneTest(x, y) === 'stick';
      for (const [gid, g] of fingers) {
        // the newest free camera finger; a finger landing in the free stick zone only pairs with one that just landed
        // (a thumb already turning the camera plus a thumb on the stick is move-and-turn, not a pinch)
        if (g.role === 'cam' && (!inStick || fresh(g))) partner = gid;
      }
      if (partner === null && stickId !== null && fresh(fingers.get(stickId))) {
        partner = stickId; resetStick(); cfg.onStickCancel?.();
      }
    }
    fingers.set(id, f);
    if (partner !== null) startPinch(partner, id);
    else if (stickId === null && !pinch && cfg.zoneTest(x, y) === 'stick') {
      f.role = 'stick'; stickId = id; stick.active = true;
      f.fixed = cfg.fixed?.() || false;
      const h = cfg.geom().home;
      f.bx = f.fixed ? h.x : x; f.by = f.fixed ? h.y : y;
      if (f.fixed) { f.moved = Math.hypot(x - h.x, y - h.y) > GESTURE.MOVE_SLOP; setStick(f); } else vis(true, f);
    }
    camChanged();
    return f.role;
  }
  function move(id, x, y) {
    const f = fingers.get(id);
    if (!f) return null;
    f.px = f.x; f.py = f.y; f.x = x; f.y = y;
    if (!f.moved && Math.hypot(x - f.x0, y - f.y0) > GESTURE.MOVE_SLOP) f.moved = true;
    if (f.role === 'stick') { if (f.moved || f.fixed) setStick(f); return 'stick'; }
    if (f.role === 'pinch' && pinch) {
      const A = fingers.get(pinch.a), B = fingers.get(pinch.b);
      if (A && B) { const d = Math.hypot(A.x - B.x, A.y - B.y) || 1; cfg.onPinch?.(d / pinch.d0); pinch.d0 = d; }
      return 'pinch';
    }
    if (f.moved) cfg.onDrag?.(x - f.px, y - f.py);
    return 'cam';
  }
  // cancelled: the system took the finger (pointercancel, lost capture): never a tap
  function up(id, x, y, cancelled = false) {
    const f = fingers.get(id);
    if (!f) return null;
    if (x !== undefined) { f.x = x; f.y = y; }
    fingers.delete(id);
    if (pinch && (id === pinch.a || id === pinch.b)) {
      const other = fingers.get(id === pinch.a ? pinch.b : pinch.a);
      if (other) { other.role = 'cam'; other.moved = true; other.px = other.x; other.py = other.y; } // the one left turns, no jump
      pinch = null;
    }
    if (id === stickId) resetStick();
    camChanged();
    let tap = null;
    if (!cancelled && !f.moved && f.role !== 'pinch' && now() - f.t0 < GESTURE.TAP_MS) {
      const t = now();
      // timed from the first tap's lift to the second tap's touch-down (how long the second press lasts does not count)
      const dbl = !!(lastTap && f.t0 - lastTap.t < GESTURE.DOUBLE_MS &&Math.hypot(lastTap.x - f.x, lastTap.y - f.y) < GESTURE.DOUBLE_PX);
      lastTap = dbl ? null : { t, x: f.x, y: f.y };
      tap = dbl ? 'double' : 'tap';
      cfg.onTap?.(f.x, f.y, dbl);
    }
    return tap;
  }
  function cancel() {
    fingers.clear(); pinch = null; lastTap = null;
    if (stickId !== null || stick.mag) resetStick();
    camChanged();
  }
  return { stick, down, move, up, cancel, fingers, get pinch() { return pinch; }, get stickId() { return stickId; } };
}

// opts: { canvas, rig, act, game, zoneTest?, stickEl?, knobEl?, geom?, safe?, heroYaw?, onDown?, onTap? }
//   act      game.js touch actions: tapAt(x,y), interact(), busy(), skip()
//   zoneTest (x, y) -> 'stick' | 'cam' (default: the spec zone, mirrored when left-handed)
//   stickEl / knobEl  the stick visuals (default: .tc-stick / .tc-knob in the page); .tc-stick is translated to the base
//            centre and gets 'on' / 'run'; the knob is translated by the push
//   geom()   -> { R, home } (default: stickGeom with the safe-area insets)
//   safe()   -> { l, r, t, b } safe-area insets in px (default: read from .tc-safe, else 0)
//   onDown(e) every touch on the canvas (touch.js closes its menus); onTap(x, y, isDouble) after a tap is handled
// Returns { stick, cancel(), placeHome(), destroy(), gestures, cam }. stick = { x, y, mag, active } (y < 0 is up).
export function initTouchInput({ canvas, rig, act, game, zoneTest, stickEl, knobEl, geom, safe, heroYaw, onDown, onTap } = {}) {
  const $ = (s) => document.querySelector(s);
  const safeIn = safe || (() => {
    const s = $('.tc-safe');
    if (!s) return { l: 0, r: 0, t: 0, b: 0 };
    const cs = getComputedStyle(s);
    return { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 };
  });
  const getGeom = geom || (() => stickGeom(innerWidth, innerHeight, safeIn()));
  const zone = zoneTest || ((x, y) => defaultZoneTest(x, y, innerWidth, innerHeight, safeIn()));
  const sEl = () => stickEl || $('.tc-stick'), kEl = () => knobEl || $('.tc-knob');
  const showStick = (v) => {
    const s = sEl(), k = kEl();
    if (!s) return;
    s.style.transform = `translate(${Math.round(v.base.x)}px, ${Math.round(v.base.y)}px)`;
    if (k) k.style.transform = `translate(${v.knob.x.toFixed(1)}px, ${v.knob.y.toFixed(1)}px)`;
    s.classList.toggle('on', v.on); s.classList.toggle('run', v.run);
    s.classList.toggle('fixed', T()?.stick === 'fixed');
  };
  const g = createGestures({
    zoneTest: zone,
    geom: getGeom,
    fixed: () => T()?.stick === 'fixed',
    onDrag: (dx, dy) => touchcam.drag(dx, dy),
    onPinch: (s) => touchcam.pinch(s),
    onCamFingers: (n) => touchcam.setCamFingers(n),
    onStickVisual: showStick,
    onTap: (x, y, dbl) => {
      if (dbl) { if (!act?.interact?.()) act?.tapAt?.(x, y); } else act?.tapAt?.(x, y);
      onTap?.(x, y, dbl);
    },
  });
  const placeHome = () => { if (g.stickId === null) showStick({ on: false, run: false, base: getGeom().home, knob: { x: 0, y: 0 } }); };
  touchcam.attach(rig, { stick: g.stick, heroYaw: heroYaw || (game?.playerYaw ? () => game.playerYaw() + Math.PI : undefined) });

  const isTouch = (e) => e.pointerType === 'touch';
  const pd = (e) => {
    if (!isTouch(e)) return;
    e.preventDefault();
    onDown?.(e);
    if (act?.busy?.()) { act.skip?.(); return; }
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
    g.down(e.pointerId, e.clientX, e.clientY);
  };
  const pm = (e) => { if (isTouch(e)) g.move(e.pointerId, e.clientX, e.clientY); };
  const pu = (e) => { if (isTouch(e) || g.fingers.has(e.pointerId)) g.up(e.pointerId, e.clientX, e.clientY, e.type !== 'pointerup'); };
  const lost = (e) => { if (g.fingers.has(e.pointerId)) g.up(e.pointerId, undefined, undefined, true); };
  const onSettings = () => placeHome();
  const onResize = () => { placeHome(); setTimeout(placeHome, 300); };
  canvas.addEventListener('pointerdown', pd);
  canvas.addEventListener('pointermove', pm);
  canvas.addEventListener('pointerup', pu);
  canvas.addEventListener('pointercancel', pu);
  canvas.addEventListener('lostpointercapture', lost);
  addEventListener(TOUCH_EVENT, onSettings);
  addEventListener('resize', onResize);
  // the app went to the background mid-gesture: no finger is down when it comes back
  const onHide = () => { if (document.hidden) g.cancel(); };
  document.addEventListener('visibilitychange', onHide);
  placeHome();
  const destroy = () => {
    g.cancel();
    canvas.removeEventListener('pointerdown', pd); canvas.removeEventListener('pointermove', pm);
    canvas.removeEventListener('pointerup', pu); canvas.removeEventListener('pointercancel', pu);
    canvas.removeEventListener('lostpointercapture', lost);
    removeEventListener(TOUCH_EVENT, onSettings); removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onHide);
  };
  return { stick: g.stick, cancel: () => g.cancel(), placeHome, destroy, gestures: g, cam: touchcam };
}
