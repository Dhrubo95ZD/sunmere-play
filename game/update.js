// The update check (owner, 20 Nov 2026: "prompt update to play when we play from android ... not allow old version").
// At start the Android app and the packaged Windows app read the public version.json (shared/version.js VERSION_URL):
//   older than "min"      a full-screen Update required panel that blocks play, with Download update (the APK / zip)
//   older than "version"  a small New version available note that can be dismissed
//   unreachable           play on (offline works; online play is still guarded by the server, server/minclient.js)
// The browser play link, the page `npm start` serves and `npm run desktop` are always current: no check, they send their
// version and pass. Every build sends CLIENT_VERSION with its join (client/game/game.js); a server that turns it away
// (joinErr code 'update') shows the same panel.
// CLIENT_VERSION is the changelog number (the first entry's `v` in client/ui/changelog.js), bumped at every release.
// Test only (?test=1): updplat=android|windows|web forces the check as that platform, updtest=block|note fakes the file
// (latest = this version + 1), vfile=<url> reads another file, vme=<n> pretends to be version n.
import { CHANGELOG } from '../ui/changelog.js';
import { IS_APP, capPlugin } from '../engine/platform.js';
import { VERSION_URL, DOWNLOADS, verdict, validVer, cmpVer } from '/sunmere-play/shared/version.js';

const W = typeof window !== 'undefined' ? window : {};
const q = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
const TEST = q.get('test') === '1';
export const CLIENT_VERSION = String(TEST && validVer(q.get('vme')) ? q.get('vme') : CHANGELOG[0].v);

// state: 'off' (no check on this platform), 'checking', 'ok', 'note', 'block' or 'unknown' (the file could not be read)
export const UPDATE = { state: 'checking', info: null, platform: null };
export const updateBlocked = () => UPDATE.state === 'block';

// which download this build needs: 'android', 'windows', or null (always current: no check)
async function platformOf() {
  if (TEST && q.get('updplat')) return q.get('updplat');
  if (IS_APP) return 'android';
  const D = W.sunmereDesktop;
  if (D?.appInfo) { const i = await D.appInfo().catch(() => null); if (i?.packaged) return 'windows'; }
  return null;
}

async function readInfo() {
  const t = TEST ? q.get('updtest') : null;
  if (t === 'block' || t === 'note') {
    const next = String(Number(CHANGELOG[0].v) + 1);
    return { version: next, min: t === 'block' ? next : CLIENT_VERSION, ...DOWNLOADS, notes: 'Test notes: a new class and smoother phone towns.' };
  }
  const url = (TEST && q.get('vfile')) || VERSION_URL;
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now() / 60000), { signal: ctl.signal, cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } finally { clearTimeout(to); }
}

let started = null;
export function startUpdateCheck() {
  if (started) return started;
  started = (async () => {
    const plat = await platformOf();
    UPDATE.platform = plat;
    if (!plat) { UPDATE.state = 'off'; return UPDATE; }
    let info = null;
    try { info = await readInfo(); } catch { info = null; }
    UPDATE.info = info;
    UPDATE.state = info ? verdict(info, CLIENT_VERSION) : 'unknown';
    if (UPDATE.state === 'block') showUpdatePanel();
    else if (UPDATE.state === 'note') showUpdateNote();
    return UPDATE;
  })().catch((e) => { console.warn('[update] check failed', e); UPDATE.state = 'unknown'; return UPDATE; });
  return started;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const platNow = () => UPDATE.platform || (IS_APP ? 'android' : W.sunmereDesktop ? 'windows' : 'web');
const urlFor = (plat) => {
  const i = UPDATE.info || {}, u = i[plat] || DOWNLOADS[plat];
  return typeof u === 'string' && /^https:\/\//.test(u) ? u : DOWNLOADS[plat];
};
const HOW = {
  android: 'When the download finishes, tap it and choose Update (or Install). If the phone asks, allow your browser to install apps. Your characters are kept.',
  windows: 'Close Sunmere, unzip Sunmere-Windows.zip and run Sunmere.exe from the new Sunmere folder. Your characters are kept.',
  web: 'Reload the page to get the new version.',
};

// open the download in the system browser: Android downloads the APK and offers to install it over this one (same signing
// key, so nothing is lost); no install permission or plugin is needed in the app itself
export async function openDownload(plat = platNow()) {
  if (plat === 'web') { location.reload(); return 'reload'; }
  const url = urlFor(plat);
  if (plat === 'android') {
    const B = capPlugin('Browser');
    if (B?.open) { try { await B.open({ url }); return 'browser'; } catch (e) { console.warn('[update] Browser.open', e); } }
    location.href = url; // (the app shell sends an outside address to the system browser)
    return 'href';
  }
  const D = W.sunmereDesktop;
  if (D?.openExternal && (await D.openExternal(url).catch(() => false))) return 'external';
  W.open?.(url, '_blank');
  return 'open';
}

let keyStop = null;
// the full-screen Update required panel (blocks play); opts.min: the server's minimum when it turned the join away
export function showUpdatePanel(opts = {}) {
  UPDATE.state = 'block';
  document.querySelector('.upd-note')?.remove();
  if (document.querySelector('.upd-shade')) return;
  const plat = platNow(), i = UPDATE.info || {};
  const latest = validVer(i.version) ? i.version : validVer(opts.min) ? opts.min : null;
  const notes = typeof i.notes === 'string' ? i.notes.slice(0, 400) : '';
  const d = document.createElement('div');
  d.className = 'upd-shade';
  d.innerHTML = `<div class="upd-panel" role="dialog" aria-modal="true" aria-label="Update required">
    <div class="upd-kicker">Sunmere Online</div>
    <div class="upd-title">Update required</div>
    <div class="upd-rule"></div>
    <p class="upd-sub">${latest ? `Version ${esc(latest)} is out.` : 'A new version is out.'} This ${plat === 'web' ? 'page' : 'app'} is version ${esc(CLIENT_VERSION)}, which is too old to play. Get the new version to carry on.</p>
    ${notes ? `<p class="upd-notes">${esc(notes)}</p>` : ''}
    <button class="upd-go">${plat === 'web' ? 'Reload' : 'Download update'}</button>
    <p class="upd-how">${esc(HOW[plat] || HOW.windows)}</p>
    <p class="upd-status"></p>
  </div>`;
  d.querySelector('.upd-go').onclick = async () => {
    const s = d.querySelector('.upd-status');
    s.textContent = plat === 'web' ? '' : 'Opening the download...';
    try { await openDownload(plat); if (plat !== 'web') s.textContent = 'The download should start in your browser. Install it, then open Sunmere again.'; }
    catch (e) { s.textContent = 'Could not open the download: ' + (e?.message || e); }
  };
  document.body.appendChild(d);
  // nothing behind the panel takes a key press (the login box, the game's keys)
  if (!keyStop) {
    keyStop = (e) => { if (document.querySelector('.upd-shade')) { e.stopPropagation(); if (e.key !== 'F12') e.preventDefault(); } };
    for (const t of ['keydown', 'keyup']) W.addEventListener(t, keyStop, true);
  }
  try { document.activeElement?.blur?.(); } catch { /* nothing focused */ }
}

// the dismissible New version available note (once per version: Later hides it until the next one)
export function showUpdateNote() {
  const i = UPDATE.info || {}, latest = String(i.version || '');
  if (!latest || document.querySelector('.upd-note') || document.querySelector('.upd-shade')) return;
  try { if (localStorage.getItem('sunmere:updLater') === latest && !TEST) return; } catch { /* no storage */ }
  const plat = platNow();
  const n = document.createElement('div');
  n.className = 'upd-note';
  n.innerHTML = `<b>New version available</b><span>Version ${esc(latest)} is out (you have ${esc(CLIENT_VERSION)}).</span><button class="upd-dl">${plat === 'web' ? 'Reload' : 'Download'}</button><button class="upd-later">Later</button>`;
  n.querySelector('.upd-dl').onclick = () => { openDownload(plat).catch(() => {}); };
  n.querySelector('.upd-later').onclick = () => { try { localStorage.setItem('sunmere:updLater', latest); } catch { /* no storage */ } n.remove(); };
  document.body.appendChild(n);
}

// (for tools/tests/updatetest.mjs: is version a older than b)
export const olderThan = (a, b) => cmpVer(a, b) < 0;
