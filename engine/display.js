// Drop in as client/engine/display.js. The bridge to the Android app's SunmereDisplay plugin (panel refresh rate and
// thermal state). Every call is a safe no-op outside the app or on an APK built before the plugin existed.
//
//   setPanelRate(fps)          ask the panel for a rate that fits the cap (60 Hz for a 60 or 30 cap); 0 = system choice.
//                              Resolves the rate asked for (Hz) or 0.
//   displayInfo()              { refreshRate, modeId, modes, sdk, thermal } or null
//   watchThermal(gov, o)       feed a ThermalGovernor (dynres.js): thermal events plus a headroom poll every o.pollMs
//                              (10 s); returns stop()
//   watchRefresh(cb)           cb(hz) whenever the panel's rate changes; returns stop()
import { capPlugin } from './platform.js';

const plugin = () => capPlugin('SunmereDisplay');
const nowMs = () => (globalThis.performance?.now ? performance.now() : Date.now());
export const hasDisplayPlugin = () => !!plugin();

export async function setPanelRate(fps, minHz = 60) {
  const p = plugin(); if (!p) return 0;
  try { const r = await p.setFrameRate({ fps: +fps || 0, minHz }); return +r?.refreshRate || 0; } catch (e) { console.warn('[display] setFrameRate', e); return 0; }
}

export async function displayInfo() {
  const p = plugin(); if (!p) return null;
  try { return await p.getInfo(); } catch (e) { console.warn('[display] getInfo', e); return null; }
}

export function watchThermal(gov, { pollMs = 10000, now = nowMs } = {}) {
  const p = plugin(); if (!p || !gov) return () => {};
  let handle = null, timer = 0, stopped = false;
  const feed = (r) => { if (stopped || !r) return; gov.report({ status: r.status, headroom: r.headroom == null ? NaN : +r.headroom }, now()); };
  try { Promise.resolve(p.addListener('thermal', feed)).then((h) => { handle = h; if (stopped) h?.remove?.(); }); } catch { /* old APK */ }
  // (no poll while the app is in the background: nothing is drawn then, and each poll wakes the bridge)
  const poll = async () => { if (globalThis.document?.hidden) return; try { feed(await p.getThermal()); } catch { /* no data */ } gov.tick(now()); };
  poll(); timer = setInterval(poll, pollMs);
  return () => { stopped = true; clearInterval(timer); try { handle?.remove?.(); } catch { /* */ } };
}

export function watchRefresh(cb) {
  const p = plugin(); if (!p) return () => {};
  let handle = null, stopped = false;
  try { Promise.resolve(p.addListener('display', (r) => { if (!stopped && r?.refreshRate > 0) cb(+r.refreshRate); })).then((h) => { handle = h; if (stopped) h?.remove?.(); }); } catch { /* old APK */ }
  return () => { stopped = true; try { handle?.remove?.(); } catch { /* */ } };
}
