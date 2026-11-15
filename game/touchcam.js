// The touch camera (phones and tablets; the desktop never attaches it). It sits on top of the CameraRig without
// editing it: it sets the touch zoom range and presets, turns finger gestures into yaw, tilt and zoom, swings the view
// in behind the hero while the stick runs, and (on phones) applies the touch collision rules around rig.update.
//   attach(rig, { heroYaw, stick })  once, from ui/touchinput.js
//   pinch(scale)                      two-finger scale since the last call (> 1 = fingers spread = zoom in)
//   drag(dx, dy)                      one-finger look: sideways turns, up/down tilts (never zooms)
//   setPreset(name) / cyclePreset()   close / normal / far (SETTINGS.touch.camPreset, saved)
//   setCamFingers(n)                  how many camera fingers are down (auto-follow waits for none, 0.6 s)
//   resetView()                       Reset camera: behind the hero at the preset distance (the HUD button in Free camera)
// Free camera (SETTINGS.freeCam): no auto-follow, pinch zooms FREE_MIN..FREE_MAX, the up/down drag sets the pitch from
// low to near top-down (camera.js tiltFree), and the HUD camera button recenters instead of cycling the presets.
import { SETTINGS, saveSettings, touchSettingsChanged, TOUCH_EVENT } from '../engine/settings.js';
import { IS_MOBILE } from '../engine/platform.js';
import { CAM, freeCam } from './camera.js';

export const PRESETS = Object.freeze({ close: 9, normal: 16, far: 26 });
const ORDER = ['close', 'normal', 'far'];
export const TOUCH_CAM = Object.freeze({
  MIN: 5, MAX: 30, // zoom range on touch (no over-the-shoulder view: the hero stays whole on a small screen)
  YAW: 0.0085, // radians per drag pixel (times camSens)
  TILT: 0.004, // tilt radians per vertical drag pixel (times camSens)
  TILT_MAX: 0.3, // +- radians of hand tilt
  HARD_MIN: 2.5, // phones: the lens never comes nearer than this; nearer walls fade round the hero instead
  PULL_OUT: 5, // phones: ease back out after a wall (1/s; the desktop rig uses CAM.PULL_OUT = 3)
  FOLLOW_MAG: 0.3, FOLLOW_K: 0.55, FOLLOW_IDLE: 600, // auto-follow: stick push, strength per push, ms with no camera finger
  FOLLOW_BACK: (120 * Math.PI) / 180, // a stick pulled more than this off forward (backing toward the lens): no follow
  STUCK_K: 0.4, STUCK_T: 1.5, STUCK_FREE: 0.7, BOOST_MAX: 0.5, // effDist < 40% of the zoom for 1.5 s: rise over the obstacle
  FREE_MIN: 3, FREE_MAX: 60, FREE_TILT: 0.006, // free camera: zoom range (m) and pitch radians per vertical drag pixel (times camSens)
});
const KICK_DT = 1 / 60, KICK_MAX = 0.35; // hit-kick slice (s) and the most a real kick ever turns the lens (rad)
const T = () => SETTINGS.touch;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// one rig per page; the state is kept here so the HUD (the camera-preset button) can import and call the functions
const S = { rig: null, stick: null, heroYaw: null, now: () => performance.now(), mobile: IS_MOBILE, current: null, fingers: 0, lastCam: -1e9, stuckT: 0, boost: 0, off: [] };
export const state = S; // read by the tests and the off-screen checks

export function attach(rig, { heroYaw, stick, mobile = IS_MOBILE, now } = {}) {
  if (!rig) return null;
  if (now) S.now = now;
  S.stick = stick || S.stick;
  S.heroYaw = heroYaw || S.heroYaw || (() => rig.followYaw); // game.js sets rig.followYaw = local.ry + PI before each update
  if (S.rig === rig) return api;
  detach();
  S.rig = rig; S.mobile = mobile; S.current = T().camPreset; S.fingers = 0; S.lastCam = -1e9; S.stuckT = 0; S.boost = 0;
  rig.minDist = TOUCH_CAM.MIN; rig.maxDist = TOUCH_CAM.MAX; rig.freeMin = TOUCH_CAM.FREE_MIN; rig.freeMax = TOUCH_CAM.FREE_MAX;
  if (mobile) { rig.hardMin = TOUCH_CAM.HARD_MIN; rig.pullOut = TOUCH_CAM.PULL_OUT; } // read by camera.js (the CAM swap below is kept as a belt and braces)
  const inShowcase = rig.closePitch === 0.3 && rig.pitch === 0.3; // setShowcase(true) sets exactly these
  if (!inShowcase) { rig.distTarget = rig.dist = PRESETS[S.current]; rig.tiltTarget = clamp(rig.tiltTarget || 0, -TOUCH_CAM.TILT_MAX, TOUCH_CAM.TILT_MAX); }

  // leaving the login showcase returns to the touch preset, not the desktop default (22 m)
  const origShow = rig.setShowcase;
  rig.setShowcase = function (on) { const r = origShow.call(this, on); if (!on) applyPreset(); return r; };
  // the frame step: auto-follow before the rig's own update, the phone collision rules around it
  const origUpdate = rig.update;
  rig.update = function (dt, followPos) {
    preStep();
    let hm, po;
    if (S.mobile) { hm = CAM.HARD_MIN; po = CAM.PULL_OUT; CAM.HARD_MIN = Math.max(hm, this.hardMin ?? hm); CAM.PULL_OUT = TOUCH_CAM.PULL_OUT; }
    try {
      // the hit kick (camera.js) is a stiff spring stepped with explicit Euler: at 30 fps or less (a phone in a fight,
      // the 30 fps option) it diverges and the view rolls over and spins for good. While a kick is live a long frame is
      // stepped in slices of <= 1/60 s; a kick that still runs away is dropped (lookAt squares the view next frame).
      const k = this.kick, kv = this.kickV;
      const live = k && kv && Math.abs(k.x) + Math.abs(k.y) + Math.abs(kv.x) + Math.abs(kv.y) > 1e-5;
      const n = live && dt > KICK_DT ? Math.min(8, Math.ceil(dt / KICK_DT)) : 1;
      for (let i = 1; i < n; i++) origUpdate.call(this, dt / n, followPos);
      const r = origUpdate.call(this, dt / n, followPos);
      if (k && kv && Math.abs(k.x) + Math.abs(k.y) > KICK_MAX) { k.set(0, 0); kv.set(0, 0); }
      return r;
    }
    finally { if (S.mobile) { CAM.HARD_MIN = hm; CAM.PULL_OUT = po; postStep(dt); } }
  };
  const onSettings = () => { if (T().camPreset !== S.current) setPreset(T().camPreset, { save: false }); };
  try { addEventListener(TOUCH_EVENT, onSettings); } catch { /* no window (tests) */ }
  S.off = [() => { rig.setShowcase = origShow; rig.update = origUpdate; }, () => { try { removeEventListener(TOUCH_EVENT, onSettings); } catch { /* tests */ } }];
  return api;
}
// undo attach (tests; a rebuilt HUD attaches again)
export function detach() { for (const f of S.off) f(); S.off = []; S.rig = null; }

// the stick runs, nobody has a finger on the camera, and the hero is not backing toward the lens: ease in behind them
function preStep() {
  const r = S.rig, s = S.stick;
  if (!r || !s || !T().autoFollow || freeCam() || !(s.mag > TOUCH_CAM.FOLLOW_MAG)) return;
  if (S.fingers > 0 || S.now() - S.lastCam < TOUCH_CAM.FOLLOW_IDLE) return;
  const off = Math.atan2(s.x, -s.y); // 0 = stick straight up (away from the camera)
  if (Math.abs(off) > TOUCH_CAM.FOLLOW_BACK) return;
  r.followK = Math.max(r.followK || 0, TOUCH_CAM.FOLLOW_K * s.mag);
  r.followYaw = S.heroYaw();
}
// blocked for a while (the zoom wants far more room than it gets): tilt the lens up over the obstacle, and ease back
// down once the view has been clear for a while
function postStep(dt) {
  const r = S.rig;
  if (!r || r.sceneFocus) { S.stuckT = 0; S.boost = 0; return; }
  const want = Math.max(r.distTarget, r.minDist);
  if (r.effDist < TOUCH_CAM.STUCK_K * want) S.stuckT += dt; else S.stuckT = 0;
  if (S.stuckT > TOUCH_CAM.STUCK_T) S.boost = Math.min(TOUCH_CAM.BOOST_MAX, S.boost + dt * 0.8);
  else if (r.effDist > TOUCH_CAM.STUCK_FREE * want) S.boost = Math.max(0, S.boost - dt * 0.25);
  if (S.boost > 0) r.colTilt = Math.max(r.colTilt || 0, S.boost); // the rig clamps pitch + colTilt to CAM.TILT_MAX
}

function camTouched() { S.lastCam = S.now(); }
export function setCamFingers(n) { if (S.fingers > 0 || n > 0) camTouched(); S.fingers = Math.max(0, n | 0); }

export function pinch(scale) {
  if (!S.rig || !(scale > 0) || !isFinite(scale)) return;
  camTouched();
  S.rig.zoomBy(1 / scale);
}
export function drag(dx, dy = 0) {
  const r = S.rig;
  if (!r) return;
  camTouched();
  const sens = T().camSens || 1;
  r.yawTarget -= dx * TOUCH_CAM.YAW * sens;
  if (dy && freeCam() && r.tiltFree) { r.tiltFree(dy * TOUCH_CAM.FREE_TILT * sens * (T().invertY ? -1 : 1)); return; }
  if (dy) r.tiltTarget = clamp((r.tiltTarget || 0) + dy * TOUCH_CAM.TILT * sens * (T().invertY ? -1 : 1), -TOUCH_CAM.TILT_MAX, TOUCH_CAM.TILT_MAX);
}
// back to the chosen preset (entering the world, or game.js after a scripted cut)
export function applyPreset() {
  const r = S.rig;
  if (!r) return;
  S.current = PRESETS[T().camPreset] ? T().camPreset : 'normal';
  r.minDist = TOUCH_CAM.MIN; r.maxDist = TOUCH_CAM.MAX;
  r.distTarget = PRESETS[S.current]; r.tiltTarget = 0;
}
export function setPreset(name, { save = true } = {}) {
  if (!PRESETS[name]) return S.current;
  S.current = name;
  if (S.rig) S.rig.distTarget = PRESETS[name]; // eased by the rig, like a pinch
  if (T().camPreset !== name || save) {
    T().camPreset = name;
    if (save) { saveSettings(); touchSettingsChanged(); }
  }
  return name;
}
// Reset camera (free camera): in behind the hero at the chosen preset's distance, the normal pitch for it
export function resetView() {
  const r = S.rig;
  if (!r?.resetView) return;
  r.resetView(PRESETS[S.current] ?? PRESETS.normal);
}
export function cyclePreset() {
  const i = ORDER.indexOf(S.current ?? T().camPreset);
  return setPreset(ORDER[(i + 1) % ORDER.length]);
}
const api = { attach, detach, pinch, drag, setPreset, cyclePreset, applyPreset, setCamFingers, resetView, PRESETS, state };
export default api;
