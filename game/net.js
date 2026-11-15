// Connection to the world: WebSocket to the server, or an in-browser World when no server is reachable.
// In the Android app there is no server next to the page, so it goes straight to the in-page World, unless the player has
// set a server address in the options (SETTINGS.server, e.g. "192.168.1.20:5177") for online play.
import { IS_APP, IS_WEB, IS_MOBILE, bgState, BG_EVENT } from '../engine/platform.js';
import { SETTINGS, FPS_EVENT } from '../engine/settings.js';
import { QUALITY } from '../engine/globals.js';

export function wsUrl() {
  const s = String(SETTINGS.server || '').trim();
  if (s) return /^wss?:\/\//.test(s) ? s.replace(/\/?$/, '').replace(/(\/ws)?$/, '/ws') : 'ws://' + s.replace(/\/+$/, '') + '/ws';
  if (IS_APP || IS_WEB) return null; // no server next to the page: offline in the page
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
}

// opts.url: an online server (Online on the login screen): no offline fallback, null when it cannot be reached
export async function connect(onMsg, opts = {}) {
  const url = opts.url || wsUrl();
  const ws = !url ? null : await new Promise((resolve) => {
    let done = false;
    try {
      const s = new WebSocket(url);
      const to = setTimeout(() => { if (!done) { done = true; try { s.close(); } catch {} resolve(null); } }, opts.url ? 8000 : 2500);
      s.onopen = () => { if (!done) { done = true; clearTimeout(to); resolve(s); } };
      s.onerror = () => { if (!done) { done = true; clearTimeout(to); resolve(null); } };
    } catch { resolve(null); }
  });
  if (ws) {
    ws.onmessage = (e) => { try { onMsg(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    // leaving on purpose (closing the page, Exit) says goodbye first, so the server does not hold the character for a reconnect
    const bye = () => { try { if (ws.readyState === 1) ws.send('{"t":"bye"}'); } catch { /* closing */ } };
    ws.onclose = (e) => { removeEventListener('pagehide', bye); onMsg({ t: 'disconnected', code: e?.code, net }); };
    addEventListener('pagehide', bye);
    const net = { send: (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); }, offline: false, bye, url, ws, close: () => { ws.onclose = null; ws.onmessage = null; removeEventListener('pagehide', bye); try { ws.close(); } catch { /* closed */ } } };
    return net;
  }
  if (opts.url) return null;
  // offline: run the shared simulation locally, in a Web Worker (v114, simworker.js) unless ?simworker=0 or it cannot start
  if (typeof Worker === 'function' && !/[?&]simworker=0/.test(location.search)) {
    const w = await workerWorld(onMsg).catch((e) => { console.warn('[net] sim worker unavailable, running the world on the page', e); return null; });
    if (w) return w;
  }
  const { World } = await import('/sunmere-play/shared/sim.js');
  // saves (perf E3): a save whose content is unchanged (bar its timestamp) is skipped, for up to 2 minutes; the rest are
  // written to localStorage when the page is idle. The hide / pagehide / freeze saves (saveNow) write at once, always.
  const KEY = (name) => 'sunmere:' + name.toLowerCase();
  const lastSig = new Map(), lastAt = new Map(), pend = new Map();
  let idleH = 0, sync = false;
  const flush = () => { idleH = 0; for (const [k, str] of pend) { try { localStorage.setItem(k, str); } catch { /* full or blocked */ } } pend.clear(); };
  const later = () => { if (idleH) return; idleH = 1; if (typeof requestIdleCallback === 'function') requestIdleCallback(flush, { timeout: 2000 }); else setTimeout(flush, 250); };
  const store = {
    load: (name) => { const k = KEY(name); try { return JSON.parse(pend.has(k) ? pend.get(k) : localStorage.getItem(k)); } catch { return null; } },
    save: (name, data) => {
      const k = KEY(name);
      let str; try { str = JSON.stringify(data); } catch { return; }
      const sig = str.replace(/"savedAt":\d+,?/, ''), now = performance.now();
      if (!sync && lastSig.get(k) === sig && now - (lastAt.get(k) || 0) < 120000) return;
      lastSig.set(k, sig); lastAt.set(k, now); pend.set(k, str);
      if (sync) flush(); else later();
    },
  };
  const world = new World(store);
  // E2: far mobs think at coarser rates on this thread (2 Hz, 1 Hz under Battery saver or while minimised / hidden)
  const farHz = () => (QUALITY.simFarHz || (SETTINGS.battery ? 1 : 2));
  world.tiers = { farHz: farHz() };
  const session = world.connect((m) => queueMicrotask(() => onMsg(JSON.parse(JSON.stringify(m)))));
  let last = performance.now(), timer = 0;
  const step = () => { const now = performance.now(); world.tick(Math.min(0.2, (now - last) / 1000)); last = now; };
  const run = (on) => {
    if (on && !timer) { last = performance.now(); timer = setInterval(step, 50); }
    else if (!on && timer) { clearInterval(timer); timer = 0; }
  };
  run(true);
  // a phone may kill a backgrounded app without any unload event: save whenever the page is hidden or put away
  const saveNow = () => { sync = true; try { for (const p of world.players.values()) if (!p.bot) world.savePlayer(p); } catch (e) { console.error(e); } finally { sync = false; flush(); } };
  // in the background (A2): phones pause the world altogether (it picks up where it was when the app comes back: nothing
  // happens to you while the phone is in your pocket); elsewhere it keeps running, its far mobs at 1 Hz
  const bgChanged = () => {
    const hidden = document.hidden || !!bgState().hidden;
    world.tiers.farHz = hidden ? 1 : farHz();
    if (IS_MOBILE) run(!document.hidden);
  };
  addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); bgChanged(); });
  addEventListener(BG_EVENT, bgChanged);
  addEventListener(FPS_EVENT, bgChanged); // Battery saver switched
  addEventListener('pagehide', saveNow);
  addEventListener('freeze', saveNow);
  addEventListener('beforeunload', () => { world.disconnect(session); flush(); });
  return { send: (m) => world.receive(session, m), offline: true, world, saveNow };
}

// far mobs' think rate (perf E2): 2 Hz, 1 Hz under Battery saver or while minimised / hidden
const farHzNow = () => (document.hidden || bgState().hidden ? 1 : QUALITY.simFarHz || (SETTINGS.battery ? 1 : 2));

// v114: the offline World in a Web Worker (simworker.js). The page keeps what needs the DOM: localStorage (every save the
// World makes comes back here and is written as before: idle-time, at once for saveNow) and the visibility handling.
// saveNow() asks the worker to save everyone and returns a promise that settles once those saves are in localStorage.
async function workerWorld(onMsg) {
  const worker = new Worker(new URL('./simworker.js', import.meta.url), { type: 'module' });
  const saves = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('sunmere:')) saves[k] = localStorage.getItem(k); } } catch { /* blocked storage: a fresh world */ }
  const pend = new Map();
  let idleH = 0, saveId = 0, stats = { ms: 0, n: 0 };
  const waiting = new Map(), statW = new Map();
  const flush = () => { idleH = 0; for (const [k, str] of pend) { try { localStorage.setItem(k, str); } catch { /* full or blocked */ } } pend.clear(); };
  const later = () => { if (idleH) return; idleH = 1; if (typeof requestIdleCallback === 'function') requestIdleCallback(flush, { timeout: 2000 }); else setTimeout(flush, 250); };
  const ok = await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('no answer')), 15000);
    worker.onerror = (e) => { clearTimeout(to); reject(e.error || new Error(e.message || 'worker error')); };
    worker.onmessage = (e) => {
      const d = e.data;
      if (d.t === 'out') { for (const m of d.list) { try { onMsg(m); } catch (err) { console.error(err); } } }
      else if (d.t === 'store') { pend.set(d.k, d.str); if (d.sync) flush(); else later(); }
      else if (d.t === 'saved') { flush(); waiting.get(d.id)?.(); waiting.delete(d.id); }
      else if (d.t === 'stats') { stats = { ms: d.ms, n: d.n }; if (d.id) { statW.get(d.id)?.(stats); statW.delete(d.id); } }
      else if (d.t === 'ready') { clearTimeout(to); resolve(true); }
      else if (d.t === 'err') { clearTimeout(to); reject(new Error(d.e)); }
    };
    worker.postMessage({ t: 'init', saves, farHz: farHzNow() });
  }).catch((e) => { worker.terminate(); throw e; });
  if (!ok) return null;
  worker.onerror = (e) => console.error('[sim worker]', e.message || e);
  const post = (m) => worker.postMessage(m);
  const saveNow = () => new Promise((resolve) => { const id = ++saveId; waiting.set(id, resolve); post({ t: 'save', id }); setTimeout(() => { if (waiting.delete(id)) { flush(); resolve(); } }, 1500); });
  const bgChanged = () => {
    post({ t: 'farHz', v: farHzNow() });
    if (IS_MOBILE) post({ t: 'run', on: !document.hidden });
  };
  // a phone may kill a backgrounded app without any unload event: save whenever the page is hidden or put away
  addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); bgChanged(); });
  addEventListener(BG_EVENT, bgChanged);
  addEventListener(FPS_EVENT, bgChanged); // Battery saver switched
  addEventListener('pagehide', () => { saveNow(); flush(); });
  addEventListener('freeze', () => { saveNow(); flush(); });
  addEventListener('beforeunload', () => { post({ t: 'bye' }); flush(); });
  return {
    send: (m) => post({ t: 'msg', m }), offline: true, world: null, saveNow,
    // tools/bench: the worker's tick time (cumulative ms and ticks; ask() for a fresh reading) and the bench-only switches
    simWorker: { stats: () => stats, ask: () => new Promise((r) => { const id = ++saveId; statW.set(id, r); post({ t: 'stats', id }); }), bench: (o) => post({ t: 'bench', ...o }) },
  };
}
