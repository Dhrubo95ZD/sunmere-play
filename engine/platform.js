// Where the game is running: the Android app (Capacitor), a touch phone or tablet browser, or the desktop.
// Desktop (Electron or a mouse browser) gets none of the mobile behaviour. Shared by the engine and the UI.
//   IS_APP    inside the Android app (window.Capacitor native, or the flag the mobile build writes into index.html)
//   IS_TOUCH  touch is the main input: the app, or a coarse primary pointer (phones, tablets); ?touch=1 forces it
//   IS_MOBILE a phone or tablet: the app, or a touch device with a mobile user agent or a small screen; ?mobile=1 forces it
// <html> gets the classes 'is-app', 'touch' and 'mobile' to match, for CSS.
const W = typeof window !== 'undefined' ? window : {};
const q = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
const mm = (m) => { try { return !!W.matchMedia?.(m).matches; } catch { return false; } };

export const IS_APP = !!(W.SUNMERE_APP || W.Capacitor?.isNativePlatform?.());
// IS_WEB: the static browser build on GitHub Pages (tools/host/publish_web.mjs writes the flag): no world server next to
// the page, so "Local" plays offline in the page and Online (the default) joins the world from server.json
export const IS_WEB = !IS_APP && !!W.SUNMERE_WEB;
export const IS_TOUCH = IS_APP || q.has('touch') || q.has('mobile') || (mm('(pointer: coarse)') && (navigator.maxTouchPoints || 0) > 0);
const smallScreen = Math.min(W.screen?.width || 9999, W.screen?.height || 9999) < 900;
const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
export const IS_MOBILE = IS_APP || q.has('mobile') || (IS_TOUCH && (mobileUA || smallScreen));
export const PLATFORM = IS_APP ? 'app' : IS_MOBILE ? 'mobile' : 'desktop';

// Phone GPU tier, for the first-run quality pick (settings.js): 'high' | 'mid' | 'low' from the GPU's renderer string
// (WEBGL_debug_renderer_info; Chrome / the Android WebView give "ANGLE (Qualcomm, Adreno (TM) 830, OpenGL ES 3.2)" or
// "Adreno (TM) 830"), with navigator.deviceMemory / hardwareConcurrency as the tie-break when the string says nothing.
// Pure: the string and the numbers come in (tests call it directly).
export function gpuTier(renderer, { mem = 0, cores = 0 } = {}) {
  const s = String(renderer || '');
  let m;
  if ((m = /Adreno[^0-9]*(\d{3})/i.exec(s))) { const n = +m[1]; return n >= 730 ? 'high' : n >= 640 ? 'mid' : 'low'; } // 730+: 8 Gen 1 and newer; 6xx high end: 865/888
  if (/Immortalis|Mali[^0-9]*G1\b/i.test(s)) return 'high'; // Immortalis-G715..G925, Mali-G1-Ultra (2025 naming)
  if ((m = /Mali[^0-9]*G(\d{2,3})/i.exec(s))) { const n = +m[1]; return n >= 710 ? 'high' : n >= 76 && n < 100 || n >= 610 ? 'mid' : 'low'; } // G710/G715/G720/G925 | G76-G78, G610-G615 | G31-G72
  if (/Mali[^0-9]*T\d|Mali-4\d\d/i.test(s)) return 'low';
  if ((m = /Xclipse[^0-9]*(\d{3})/i.exec(s))) return +m[1] >= 900 ? 'high' : 'mid';
  if (/Apple/i.test(s)) return 'high'; // Safari masks it as "Apple GPU": every iPhone / iPad that runs this is recent enough
  if (/PowerVR|SGX|Vivante|VideoCore/i.test(s)) return 'low';
  // unknown or masked: the memory and core counts
  if (mem >= 8 && cores >= 8) return 'high';
  if ((mem && mem <= 3) || (cores && cores <= 4)) return 'low';
  return 'mid';
}
// the renderer string of this device's GPU (one throwaway WebGL context, released at once); '' when there is none.
// ?gpu=<string> stands in for it (tests)
export function gpuRenderer() {
  if (q.has('gpu')) return q.get('gpu');
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const s = (ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return String(s);
  } catch { return ''; }
}
export const deviceTier = () => gpuTier(gpuRenderer(), { mem: +(W.navigator?.deviceMemory || 0), cores: +(W.navigator?.hardwareConcurrency || 0) });

// the Capacitor plugins the app shell exposes (undefined outside the app)
export const capPlugin = (name) => W.Capacitor?.Plugins?.[name];

// background state (perf A2), kept by the renderer's frame pacer: hidden = the app / tab is in the background or the desktop
// window is minimised (drawing stopped); focused = false while another window has focus (the desktop draws at 30 fps).
// Systems that tick on their own timers (the offline sim, the minimap) read bgState() or listen for BG_EVENT
// ({ detail: { hidden, focused } }) to slow down while hidden.
export const BG_EVENT = 'sunmere:bgstate';
const _bg = { hidden: false, focused: true };
export const bgState = () => _bg;
export function setBgState(hidden, focused) {
  if (_bg.hidden === !!hidden && _bg.focused === !!focused) return;
  _bg.hidden = !!hidden; _bg.focused = !!focused;
  try { W.dispatchEvent?.(new CustomEvent(BG_EVENT, { detail: { ..._bg } })); } catch { /* no window (tests) */ }
}

try {
  const c = document.documentElement.classList;
  if (IS_APP) c.add('is-app');
  if (IS_TOUCH) c.add('touch');
  if (IS_MOBILE) c.add('mobile');
} catch { /* no document (tests) */ }

// Android back button (the app only): blur a text box, else close the top window / clear the target / end a scene (the
// same as Escape), else ask before leaving. The game saves on the way out (net.js saves when the page is hidden).
// The UI may replace this with setBackHandler(fn): fn() returns true when it handled the press.
let backHandler = null;
export function setBackHandler(fn) { backHandler = fn; }
function defaultBack() {
  const a = document.activeElement;
  if (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)) { a.blur(); return true; }
  const g = W.game, ui = g?.ui;
  const open = ui && (ui.scene || g.target || Object.values(ui.windows || {}).some((w) => w?.isConnected));
  if (!open) return false;
  for (const type of ['keydown', 'keyup']) W.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', code: 'Escape', bubbles: true }));
  return true;
}
// Exit the game from the Esc menu: save first, then close the desktop window or the Android app.
export function exitGame() {
  let saved = null;
  try { saved = W.game?.net?.saveNow?.(); W.game?.net?.bye?.(); } catch (e) { console.error(e); }
  // (the offline world in its worker saves asynchronously: saveNow returns a promise then; wait for it, at most 1.5 s)
  const go = () => {
    if (IS_APP) { try { capPlugin('App')?.exitApp?.(); } catch (e) { console.error(e); } return; }
    // Electron: closing the last window quits (desktop/main.js window-all-closed). In a plain browser tab this may be refused.
    setTimeout(() => W.close(), 150);
  };
  if (saved && typeof saved.then === 'function') saved.then(go, go); else go();
}
if (IS_APP) {
  const App = capPlugin('App');
  try {
    App?.addListener?.('backButton', () => {
      try { if (backHandler?.() || defaultBack()) return; } catch (e) { console.error(e); }
      if (W.confirm('Leave Sunmere Online? Your progress is saved.')) {
        let saved = null;
        try { saved = W.game?.net?.saveNow?.(); } catch { /* saved on hide anyway */ }
        if (saved && typeof saved.then === 'function') saved.then(() => App.exitApp(), () => App.exitApp()); else App.exitApp();
      }
    });
  } catch (e) { console.error('[app] back button', e); }
}
