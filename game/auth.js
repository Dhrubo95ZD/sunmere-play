// Google sign-in (Supabase Auth) and the online server address, for the login screen and the connection.
//   Browser: the usual OAuth redirect (PKCE): off to Google, back to this page with ?code=, exchanged for a session.
//   Desktop app (Electron): Google opens in the system browser; the app listens on http://127.0.0.1:<random>/auth-callback
//     for the code (desktop/main.js), then exchanges it here (PKCE: the verifier never leaves this page).
//   Android app: Google opens in a Custom Tab (@capacitor/browser) and returns through the deep link
//     sunmere://auth-callback?code=..., caught with the App plugin's appUrlOpen.
// Nothing here runs or loads unless client/config.js has the Supabase URL and anon key.
import * as CFG from '/sunmere-play/config.js';
import { IS_APP, capPlugin } from '../engine/platform.js';

const q = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
// test only (?test=1&authcfg=demo): stand-in settings so the off-screen shots can show the signed-out login screen
const demo = q.has('test') && q.get('authcfg') === 'demo';
export const CONFIG = {
  url: demo ? 'https://demo-project.supabase.co' : String(CFG.SUPABASE_URL || '').trim().replace(/\/+$/, ''),
  key: demo ? 'demo-anon-key' : String(CFG.SUPABASE_ANON_KEY || '').trim(),
  online: demo ? 'https://play.example.com' : String(CFG.ONLINE_SERVER || '').trim(),
};
// the current online world address from the public list (the free tunnel's address changes on every start)
if (!demo && !CONFIG.online && CFG.ONLINE_SERVER_LIST) {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(CFG.ONLINE_SERVER_LIST + '?t=' + Math.floor(Date.now() / 60000), { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    const j = r.ok ? await r.json() : null;
    // https only (plain http just for a world on this same machine: the local test of the web build)
    if (j && typeof j.server === 'string' && /^(https:\/\/[a-z0-9.-]+|http:\/\/(localhost|127\.0\.0\.1))(:\d+)?\/?$/i.test(j.server.trim())) CONFIG.online = j.server.trim();
  } catch { /* offline or the list is down: no Online choice */ }
}
export const AUTH_ON = !!(CONFIG.url && CONFIG.key);
const DESK = typeof window !== 'undefined' ? window.sunmereDesktop : null;
const IS_DESK = !!DESK?.authStart;
const APP_CALLBACK = 'sunmere://auth-callback';

// ws(s)://host/ws and http(s)://host for a server address typed as https://host, wss://host/ws, host:port...
export function serverUrls(addr) {
  let s = String(addr || '').trim().replace(/\/+$/, '');
  if (!s) return null;
  if (!/^[a-z]+:\/\//i.test(s)) s = (/^(localhost|127\.|192\.168\.|10\.|\[?::1)/.test(s) ? 'http://' : 'https://') + s;
  s = s.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:').replace(/\/ws$/, '');
  return { http: s, ws: s.replace(/^http/i, 'ws') + '/ws' };
}

// where Google sends a browser back after sign-in: this page's address without its query or #hash (the code comes back
// as ?code=). On GitHub Pages that is https://dhrubo95zd.github.io/sunmere-play/, so the Supabase redirect list needs
// https://dhrubo95zd.github.io/** (docs/ai/release_reddit.md)
export function webRedirect(href) {
  const u = new URL(href);
  return u.origin + u.pathname;
}

let sb = null, loading = null;
function loadLib() {
  if (window.supabase?.createClient) return Promise.resolve();
  return (loading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '/sunmere-play/vendor/supabase/supabase.js';
    s.onload = () => res(); s.onerror = () => rej(new Error('sign-in library missing'));
    document.head.appendChild(s);
  }));
}
async function client() {
  if (!AUTH_ON) return null;
  if (sb) return sb;
  await loadLib();
  sb = window.supabase.createClient(CONFIG.url, CONFIG.key, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: !IS_APP && !IS_DESK, storageKey: 'sb-sunmere-auth' },
  });
  return sb;
}

// after a browser redirect: wait for the code exchange, then tidy ?code= out of the address bar
export async function init() {
  const c = await client().catch(() => null);
  if (!c) return null;
  const { data } = await c.auth.getSession();
  if (q.has('code') || q.has('error_description')) {
    const u = new URL(location.href);
    for (const k of ['code', 'error', 'error_code', 'error_description', 'state']) u.searchParams.delete(k);
    history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : '') + u.hash);
  }
  return data.session ? who(data.session) : null;
}
// the Google display name only (the email is never shown or sent anywhere)
const who = (s) => ({ name: String(s.user?.user_metadata?.full_name || s.user?.user_metadata?.name || 'Player').slice(0, 40) });

export async function account() {
  const c = await client().catch(() => null);
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session ? who(data.session) : null;
}
export async function token() {
  const c = await client().catch(() => null);
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.access_token || null;
}
export async function signOut() {
  const c = await client().catch(() => null);
  if (c) await c.auth.signOut({ scope: 'local' }).catch(() => {});
}

// resolves with the account once signed in (the browser leaves the page instead and comes back signed in)
export async function signIn() {
  const c = await client();
  if (!c) throw new Error('Sign-in is not set up.');
  if (IS_DESK) {
    const { url: cb } = await DESK.authStart();
    const { data, error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: cb, skipBrowserRedirect: true } });
    if (error) throw error;
    await DESK.openExternal(data.url);
    const r = await DESK.authWait();
    if (!r?.code) throw new Error(r?.error || 'Sign-in was cancelled.');
    const ex = await c.auth.exchangeCodeForSession(r.code);
    if (ex.error) throw ex.error;
    return who(ex.data.session);
  }
  if (IS_APP) {
    const Browser = capPlugin('Browser'), App = capPlugin('App');
    if (!Browser || !App) throw new Error('This app version cannot sign in yet. Update the app.');
    const { data, error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: APP_CALLBACK, skipBrowserRedirect: true } });
    if (error) throw error;
    const code = await new Promise((res, rej) => {
      let h = null, done = false;
      const finish = (fn, v) => { if (done) return; done = true; h?.remove?.(); bh?.remove?.(); fn(v); };
      let bh = null;
      Promise.resolve(App.addListener('appUrlOpen', (ev) => {
        const u = String(ev?.url || '');
        if (!u.startsWith(APP_CALLBACK)) return;
        const p = new URL(u.replace(/^sunmere:\/\//, 'https://x/'));
        Browser.close?.().catch?.(() => {});
        if (p.searchParams.get('code')) finish(res, p.searchParams.get('code'));
        else finish(rej, new Error(p.searchParams.get('error_description') || 'Sign-in was cancelled.'));
      })).then((x) => { h = x; });
      // closing the Google tab without signing in
      Promise.resolve(Browser.addListener?.('browserFinished', () => setTimeout(() => finish(rej, new Error('Sign-in was cancelled.')), 1500))).then((x) => { bh = x; }).catch(() => {});
      Browser.open({ url: data.url }).catch((e) => finish(rej, e));
    });
    const ex = await c.auth.exchangeCodeForSession(code);
    if (ex.error) throw ex.error;
    return who(ex.data.session);
  }
  const back = webRedirect(location.href);
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: back } });
  if (error) throw error;
  return new Promise(() => {}); // the page is leaving for Google
}
