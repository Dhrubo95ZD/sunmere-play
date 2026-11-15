// Player options, kept in this browser / app profile. Sound changes apply at once; graphics quality applies on the
// next load of the world view (it decides render targets, shadow maps and grass counts at startup).
import { IS_MOBILE, deviceTier } from './platform.js';
import { normalizeCap } from './pacer.js';
const KEY = 'sunmere:opts';

// fpsCap: THE frame cap, every platform: 30 | 60 | 90 | 120 | 0 (0 = every vsync: the monitor's rate, or uncapped when
//   vsync is off). Phones 60, desktop 0. SETTINGS.touch.fps (the touch options row) is an alias of it, not a second setting.
// vsync (desktop only, applies on restart): false = "Unlimited" (Electron launches with the vsync switches, see desktop/main.js)
// battery: Battery saver (BATTERY_PRESET over the chosen preset on the next load; its 30 fps cap and resolution floor apply at once)
// dynRes: dynamic resolution (phones; ignored on the desktop)
// upgradeFx: Upgrade effects (plan C), 'full' | 'simple' | 'off': the heat on +7..+10 gear. Full: the steel shimmers, steam
//   wisps and sparks on hits (desktop: the 8 nearest +10 characters within 20 m; phones: your own character as you attack);
//   Simple: a steady glow and only your own sparks as you attack; Off: plain steel (the Prismatic sheen stays). Phones Simple.
// perfHud: (v116) the Performance readout panel (ui/perfhud.js), off by default
// freeCam: Free camera (every platform, off by default): never turns on its own, wider zoom, hand-set pitch (game/camera.js)
export const SETTINGS = { volume: 0.5, muted: false, bgMute: true, quality: IS_MOBILE ? 'mobile' : 'high', server: '', uiScale: 1, shake: true, miniZoom: 70, mapFog: true, fpsCap: IS_MOBILE ? 60 : 0, vsync: true, battery: false, dynRes: IS_MOBILE, freeCam: false, upgradeFx: IS_MOBILE ? 'simple' : 'full' };
export const MINI_ZOOMS = [40, 70, 110, 160];
// rebindable keys (KeyboardEvent.code); arrow keys always move as well
export const KEY_ACTIONS = [
  ['fwd', 'Move forward', 'KeyW'], ['back', 'Move back', 'KeyS'], ['left', 'Move left', 'KeyA'], ['right', 'Move right', 'KeyD'], ['jump', 'Jump', 'Space'],
  ['target', 'Next target', 'Tab'], ['interact', 'Interact', 'KeyF'], ['ride', 'Ride the runabout', 'KeyR'], ['recall', 'Homeward Compass', 'KeyG'],
  ['char', 'Character', 'KeyC'], ['talents', 'Talents', 'KeyN'], ['skills', 'Skills', 'KeyK'], ['bags', 'Bags', 'KeyB'], ['quests', 'Quest log', 'KeyL'],
  ['ach', 'Achievements', 'KeyY'], ['journal', 'Valley Journal', 'KeyJ'], ['map', 'World map', 'KeyM'], ['options', 'Options', 'KeyO'], ['help', 'Help', 'KeyH'],
  ['zoomIn', 'Minimap zoom in', 'Equal'], ['zoomOut', 'Minimap zoom out', 'Minus'], ['meter', 'Damage meter', 'KeyU'], ['autorun', 'Auto-run', 'Backquote'], ['hideui', 'Hide interface', 'KeyZ'], ['loot', 'Loot history', 'KeyI'],
  ['skill21', 'Skill 21 (level 42)', 'KeyQ'], ['skill22', 'Skill 22 (level 45)', 'KeyE'],
  ['skill23', 'Skill 23 (level 47)', 'KeyT'], ['skill24', 'Skill 24 (level 50)', 'KeyV'], // R rides, F interacts, G recalls: T and V are the next free keys
  ['skill25', 'Skill 25 (level 52)', 'KeyX'], ['skill26', 'Skill 26 (level 55)', 'KeyP'], // Z hides the interface, H is help: X and P are the last free letters
  ['skill27', 'Skill 27 (level 57)', 'BracketLeft'], ['skill28', 'Skill 28 (level 60)', 'BracketRight'], // no letters left: [ and ] sit beside P
];
SETTINGS.keys = { ...Object.fromEntries(KEY_ACTIONS.map(([a, , k]) => [a, k])), ...(SETTINGS.keys || {}) };
export const keyFor = (action) => SETTINGS.keys[action];
export const actionFor = (code) => { for (const [a] of KEY_ACTIONS) if (SETTINGS.keys[a] === code) return a; return null; };
export const keyLabel = (code) => (code || '').replace(/^Key/, '').replace(/^Digit/, '').replace('Equal', '=').replace('Minus', '-').replace('Space', 'Space').replace('Numpad', 'Num ').replace('Backquote', '`').replace('BracketLeft', '[').replace('BracketRight', ']'); // metres of world shown from the minimap's centre to its rim
let _saved = {};
try { _saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; Object.assign(SETTINGS, _saved); } catch { /* private window: defaults */ }
// keys added since the options were saved (skills 21 to 28) get their defaults, unless the key is already taken
{ const taken = new Set(Object.values(SETTINGS.keys || {})); for (const [a, , k] of KEY_ACTIONS) if (!(SETTINGS.keys ||= {})[a]) SETTINGS.keys[a] = taken.has(k) ? '' : k; }

// touch controls (phones and tablets; the desktop ignores them). Saved options are merged over these defaults, so
// fields added later get their default. After any change: saveSettings(), then touchSettingsChanged().
export const TOUCH_DEFAULTS = Object.freeze({
  uiScale: 1, // 0.8..1.3, HUD zoom (--ui)
  btnScale: 1, // 0.9 | 1 | 1.15, control size
  stick: 'float', // 'float' | 'fixed'
  camSens: 1, // 0.5..2, drag-to-look speed
  invertY: false, // vertical drag tilts the other way
  camPreset: 'normal', // 'close' | 'normal' | 'far' (touchcam.js PRESETS)
  autoFollow: true, // the camera swings behind the hero while the stick runs
  plates: 'few', // 'off' | 'few' | 'all'
  playerNames: false, // other players' nameplates
  leftHanded: false, // mirror the controls
  wheel: {}, // { [classId]: [skillId | null, ...7] } skill wheel slots; missing = learn order
  // (fps: no longer stored here: SETTINGS.touch.fps is an alias of SETTINGS.fpsCap, see below)
});
const TOUCH_RANGES = {
  uiScale: (v) => Math.min(1.3, Math.max(0.8, +v || 1)),
  btnScale: (v) => ([0.9, 1, 1.15].includes(+v) ? +v : 1),
  stick: (v) => (v === 'fixed' ? 'fixed' : 'float'),
  camSens: (v) => Math.min(2, Math.max(0.5, +v || 1)),
  camPreset: (v) => (['close', 'normal', 'far'].includes(v) ? v : 'normal'),
  plates: (v) => (['off', 'few', 'all'].includes(v) ? v : 'few'),
  wheel: (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}),
};
export function normalizeTouch(t) {
  const out = { ...TOUCH_DEFAULTS, wheel: {}, ...(t && typeof t === 'object' ? t : {}) };
  for (const [k, f] of Object.entries(TOUCH_RANGES)) out[k] = f(out[k]);
  for (const k of ['invertY', 'autoFollow', 'playerNames', 'leftHanded']) out[k] = !!out[k];
  delete out.fps; // the old stored copy of the frame cap (migrated to SETTINGS.fpsCap)
  return out;
}
// the frame cap moved from touch.fps (30/60, phones only) to SETTINGS.fpsCap (every platform): an older save keeps its choice
if (_saved.fpsCap == null && IS_MOBILE && _saved.touch?.fps) SETTINGS.fpsCap = +_saved.touch.fps === 30 ? 30 : 60;
SETTINGS.fpsCap = normalizeCap(SETTINGS.fpsCap, IS_MOBILE ? 60 : 0);
SETTINGS.touch = normalizeTouch(SETTINGS.touch);
export const UPGRADE_FX = [['full', 'Full'], ['simple', 'Simple'], ['off', 'Off']];
if (!UPGRADE_FX.some(([k]) => k === SETTINGS.upgradeFx)) SETTINGS.upgradeFx = IS_MOBILE ? 'simple' : 'full';
// ONE frame-cap setting: touch.fps reads and writes SETTINGS.fpsCap (non-enumerable, so it is never saved twice and
// normalizeTouch / Object.assign never copy it). The touch options row writes it, then touchSettingsChanged(); the
// renderer re-applies the cap on that event as on FPS_EVENT.
function aliasFps(t) {
  Object.defineProperty(t, 'fps', { configurable: true, enumerable: false, get: () => SETTINGS.fpsCap, set: (v) => { SETTINGS.fpsCap = normalizeCap(v, SETTINGS.fpsCap); } });
  return t;
}
aliasFps(SETTINGS.touch);
// tell the renderer the frame cap or Battery saver changed (it re-applies the cap live). After a change: saveSettings(), then fpsCapChanged().
export const FPS_EVENT = 'sunmere:fpscap';
export function fpsCapChanged() { try { window.dispatchEvent(new Event(FPS_EVENT)); } catch { /* no window (tests) */ } }
// tell the touch modules (touchcam, touch layout) to re-read SETTINGS.touch
export const TOUCH_EVENT = 'sunmere:touchsettings';
export function touchSettingsChanged() {
  if (!Object.getOwnPropertyDescriptor(SETTINGS.touch, 'fps')?.get) aliasFps(SETTINGS.touch); // a replaced object gets the alias back
  Object.assign(SETTINGS.touch, normalizeTouch(SETTINGS.touch)); // in place: holders of SETTINGS.touch stay current
  try { window.dispatchEvent(new Event(TOUCH_EVENT)); } catch { /* no window (tests) */ }
}

export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(SETTINGS)); } catch { /* not stored */ } }

const dpr = Math.min(window.devicePixelRatio || 1, 2);
// optional fields (defaults in brackets): bloomScale [0.5] bloom buffer size, grassTile [74] metres of grass around the
// hero, texSize [1024] ground texture size, anisotropy [8], particles [1] effect particle share, far [1200] camera far plane,
// charShadowDist [45] metres within which characters cast (the player always does), lights [8] point-light budget (C2),
// viewDist [110] metres out to which characters and villagers are drawn (the phones: shorter), shadowHz [0] shadow-map
// redraws per second (0 = every frame, B4), shadowMaxExtent [none] largest shadow box half-size (m),
// dynResMin [0.75] dynamic resolution floor (A3), bloomMips [5] bloom blur levels, grassLod [true] cheaper far grass tufts,
// fxaa [false] an FXAA pass after the grade (the phones without MSAA; renderer.js skips it when the scene has MSAA)
const mdpr = window.devicePixelRatio || 1;
export const QUALITY_PRESETS = {
  // phones and tablets only (the GPU tier picks one on first run, see the end of this file). Mobile High (Adreno 730+,
  // Mali-G710+, Immortalis, Xclipse 9xx, Apple): pixel ratio up to 2.0 (a 3x phone at 1.25 drew ~1290x580 stretched 2.4x:
  // blocky grass, jagged edges), MSAA 2x on the scene target (the grass cards' alpha-to-coverage needs it), full-size
  // ground textures, 8x anisotropy, a 2048 shadow map, 60% grass; dynamic resolution only between 1.4 and 2.0. Mobile:
  // ratio up to 1.5 (floor 1.0), FXAA, small shadow map, no AO or MSAA, a quarter-size bloom, a sparser and shorter grass
  // field, half-size ground textures and fewer particles. Mobile Low: native-ish 1.0 ratio, FXAA, tiny shadows, no bloom,
  // a quarter of the grass, a shorter view and a third of the particles (older phones, battery, heat)
  ...(IS_MOBILE ? {
    mobileHigh: { label: 'Mobile High', smallCastDist: 20, pixelRatio: Math.min(mdpr, 2), dynResMin: 1.4, shadowSize: 2048, msaa: 2, bloom: true, bloomScale: 0.25, grassDensity: 0.6, grassTile: 58, texSize: 1024, anisotropy: 8, particles: 0.5, far: 520, mobile: true, charShadowDist: 20, lights: 4, shadowMaxExtent: 40, shadowHz: 30, bloomMips: 3, viewDist: 75 },
    mobile: { label: 'Mobile', smallCastDist: 20, pixelRatio: Math.min(mdpr, 1.5), dynResMin: 1.0, fxaa: true, shadowSize: 1024, msaa: 0, bloom: true, bloomScale: 0.25, grassDensity: 0.4, grassTile: 58, texSize: 512, anisotropy: 4, particles: 0.5, far: 520, mobile: true, charShadowDist: 20, lights: 4, shadowMaxExtent: 40, shadowHz: 30, bloomMips: 3, viewDist: 75 },
    mobileLow: { label: 'Mobile Low', smallCastDist: 12, pixelRatio: Math.min(mdpr, 1), fxaa: true, shadowSize: 512, msaa: 0, bloom: false, grassDensity: 0.25, grassTile: 44, texSize: 512, anisotropy: 2, particles: 0.35, far: 380, mobile: true, charShadowDist: 12, lights: 2, shadowMaxExtent: 34, shadowHz: 30, viewDist: 60 },
  } : {}),
  // atmos: the air pass (atmosphere.js): steps of the volumetric sun march, its buffer scale, cheap depth AO; shadowTaps:
  // soft-shadow filter taps (three's default is 5); sharpen: the grade's edge sharpening. (ao: GTAO, three's pass, is still
  // supported but no preset uses it: it draws the whole scene a second time for ~19 ms at 2000x1130 and looked little
  // different from the depth AO.)
  ultra: { label: 'Ultra', pixelRatio: dpr, shadowSize: 4096, msaa: 4, bloom: true, grassDensity: 1, atmos: { steps: 22, scale: 0.75, ssao: true }, shadowTaps: 16, sharpen: 0.3, charShadowDist: 60, lights: 12 }, // High with a finer, sharper air pass (shafts and AO at 3/4 size, not 1/2) and softer shadow edges
  high: { label: 'High', pixelRatio: dpr, shadowSize: 4096, msaa: 4, bloom: true, grassDensity: 1, atmos: { steps: 14, scale: 0.5, ssao: true }, shadowTaps: 10, sharpen: 0.25, charShadowDist: 45, lights: 8 },
  medium: { label: 'Medium', pixelRatio: Math.min(dpr, 1), shadowSize: 2048, msaa: 2, bloom: true, grassDensity: 0.6, atmos: { steps: 8, scale: 0.5 }, shadowTaps: 6, sharpen: 0.15, charShadowDist: 35, lights: 6 },
  low: { label: 'Low', pixelRatio: Math.min(dpr, 0.85), shadowSize: 1024, msaa: 0, bloom: false, grassDensity: 0.3, charShadowDist: 25, lights: 4 },
};
// Battery saver (phones and the desktop): laid over whichever preset is chosen (globals.js), on the next load. Never raises
// the preset's own pixel ratio, so on the phones it always sits at or below the Mobile look (no MSAA; FXAA kept, cheap). simFarHz / miniHz / plateHz are read by the sim (E2), minimap and nameplates (F1, F2).
export const BATTERY_PRESET = Object.freeze({ pixelRatio: Math.min(window.devicePixelRatio || 1, 1), shadowSize: 512, shadowHz: 15, shadowMaxExtent: 34, charShadowDist: 12, msaa: 0, fxaa: IS_MOBILE, bloom: false, atmos: null, shadowTaps: 5, sharpen: 0, grassDensity: 0.25, grassTile: 44, texSize: 512, anisotropy: 2, lights: 2, particles: 0.35, far: 380, dynResMin: 0.65, simFarHz: 1, miniHz: 5, plateHz: 15, viewDist: 60, battery: true });

// the quality on load. ?quality=<preset> forces one (bench / tests; not saved unless an option is changed). On a phone the
// GPU tier picks it (platform.js deviceTier: high -> Mobile High, mid -> Mobile, low -> Mobile Low) unless the player
// picked one in Options (qualityPicked; an older save's Mobile Low counts as picked, its plain 'mobile' was the default).
export const AUTO_QUALITY = { high: 'mobileHigh', mid: 'mobile', low: 'mobileLow' };
{
  let forced = null; try { forced = new URLSearchParams(location.search).get('quality'); } catch { /* no location */ }
  if (forced && QUALITY_PRESETS[forced]) SETTINGS.quality = forced;
  else if (IS_MOBILE) {
    const picked = (_saved.qualityPicked || _saved.quality === 'mobileLow') && QUALITY_PRESETS[_saved.quality]?.mobile;
    if (!picked) {
      let tier = 'mid'; try { tier = deviceTier(); } catch { /* no WebGL here: the middle */ }
      SETTINGS.quality = AUTO_QUALITY[tier] || 'mobile';
      SETTINGS.qualityAuto = tier;
      SETTINGS.qualityPicked = false;
    }
  }
}
