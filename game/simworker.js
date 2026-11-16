// v114: the offline world (shared/sim.js World) in a Web Worker, so its ticks never land inside the render frame.
// net.js starts it for offline / Android play and speaks the same game messages through it; ?simworker=0 keeps the
// World on the page (the off-screen shot scripts that reach into game.net.world use that).
// Page -> worker: { t: 'init', saves: { 'sunmere:<name>': json }, farHz, bots }  the saves the World may load (a worker has no
//                   localStorage: they are handed over once, and every save the World makes comes back to the page)
//                 { t: 'msg', m }        a game message from the player (World.receive)
//                 { t: 'run', on }       tick or pause (a phone pauses the world in the background)
//                 { t: 'farHz', v }      far mobs' think rate (World.tiers.farHz)
//                 { t: 'save', id }      save every player now (the page's saveNow), answered with { t: 'saved', id }
//                 { t: 'bye' }           the page is going: disconnect (saves the player)
//                 { t: 'bench', immortal } bench only: the Deskcheck test character takes no damage
// Worker -> page: { t: 'ready' }, { t: 'out', list: [game messages, in order] } once per turn of the worker's loop,
//                 { t: 'store', k, str, sync } a save to write, { t: 'saved', id }, { t: 'stats', ms, n } (tick time, 1 Hz)
let world = null, session = null, timer = 0, last = 0, out = [], outQ = false, tickMs = 0, tickN = 0;
const saves = new Map();
const KEY = (name) => 'sunmere:' + String(name).toLowerCase();
const lastSig = new Map(), lastAt = new Map();
let sync = false;
const store = {
  load: (name) => { const s = saves.get(KEY(name)); try { return s == null ? null : JSON.parse(s); } catch { return null; } },
  // the same rule as the page's store had (perf E3): an unchanged save (bar its timestamp) is skipped for up to 2 minutes
  save: (name, data) => {
    const k = KEY(name);
    let str; try { str = JSON.stringify(data); } catch { return; }
    const sig = str.replace(/"savedAt":\d+,?/, ''), now = performance.now();
    if (!sync && lastSig.get(k) === sig && now - (lastAt.get(k) || 0) < 120000) return;
    lastSig.set(k, sig); lastAt.set(k, now); saves.set(k, str);
    postMessage({ t: 'store', k, str, sync });
  },
};
// (JSON round trip here, off the page's thread: the page used to get JSON.parse(JSON.stringify(m)), so NaN still arrives
// as null, undefined fields and functions are dropped as before, and a message structured clone cannot copy never
// throws DataCloneError and loses the whole batch)
const flushOut = () => { outQ = false; if (out.length) { const list = out; out = []; let c; try { c = JSON.parse(JSON.stringify(list)); } catch (e) { console.error(e); c = []; for (const m of list) { try { c.push(JSON.parse(JSON.stringify(m))); } catch { /* not serialisable: dropped, as on the page */ } } } postMessage({ t: 'out', list: c }); } };
const step = () => {
  const now = performance.now();
  try { world.tick(Math.min(0.2, (now - last) / 1000)); } catch (e) { console.error(e); }
  last = now;
  tickMs += performance.now() - now; tickN++;
};
const run = (on) => {
  if (on && !timer) { last = performance.now(); timer = setInterval(step, 50); }
  else if (!on && timer) { clearInterval(timer); timer = 0; }
};
const saveAll = () => { sync = true; try { for (const p of world.players.values()) if (!p.bot) world.savePlayer(p); } catch (e) { console.error(e); } finally { sync = false; } };

onmessage = async (e) => {
  const d = e.data;
  if (d.t === 'init') {
    for (const [k, v] of Object.entries(d.saves || {})) saves.set(k, v);
    try {
      const { World } = await import('/sunmere-play/shared/sim.js');
      world = new World({ ...store, bots: d.bots || undefined });
      world.tiers = { farHz: d.farHz || 2 };
      // structured clone copies each message as JSON.parse(JSON.stringify(m)) did on the page; one post per loop turn
      session = world.connect((m) => { out.push(m); if (!outQ) { outQ = true; queueMicrotask(flushOut); } });
      run(true);
      setInterval(() => { postMessage({ t: 'stats', ms: tickMs, n: tickN }); }, 1000);
      postMessage({ t: 'ready' });
    } catch (err) { postMessage({ t: 'err', e: String(err?.stack || err) }); }
    return;
  }
  if (!world) return;
  if (d.t === 'msg') { try { world.receive(session, d.m); } catch (err) { console.error(err); } }
  else if (d.t === 'run') run(!!d.on);
  else if (d.t === 'farHz') world.tiers.farHz = d.v;
  else if (d.t === 'save') { saveAll(); postMessage({ t: 'saved', id: d.id }); }
  else if (d.t === 'bye') { try { world.disconnect(session); } catch (err) { console.error(err); } run(false); }
  else if (d.t === 'stats') postMessage({ t: 'stats', ms: tickMs, n: tickN, id: d.id });
  else if (d.t === 'bench' && d.immortal && !world.playerDamaged.__bench) {
    const pd = world.playerDamaged;
    world.playerDamaged = function (p, src, amt) { return pd.call(this, p, src, p && !p.bot && /^deskcheck$/i.test(p.name || '') ? 0 : amt); };
    world.playerDamaged.__bench = true;
  }
  flushOut();
};
