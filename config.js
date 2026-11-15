// Sunmere Online: the public settings for Google sign-in and online play. Everything here is PUBLIC (it ships inside the
// game for anyone to see), so only these three go here. Never put the service_role / secret key in this file: that one
// belongs in server/config.json on the machine that runs the server.
//   SUPABASE_URL       Supabase > Project Settings > API (or Data API): the Project URL, e.g. https://abcd1234.supabase.co
//   SUPABASE_ANON_KEY  the same page: the "anon public" key (or the newer "publishable" key, sb_publishable_...)
//   ONLINE_SERVER      the online world server, e.g. https://sunmere.example.com or a Cloudflare tunnel address
//                      (https://something.trycloudflare.com). Empty: no Online choice on the login screen.
// Leave them empty and the game works exactly as before (local and offline play only).
export const SUPABASE_URL = 'https://cbbefbolfpzrdvkqbvmt.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_V3ythRtnZl4Xqp5R1uxTdg_IEixN_it';
export const ONLINE_SERVER = '';
// ONLINE_SERVER_LIST: a small public JSON file ({ "server": "https://..." }) that tells the apps where the online world is right now.
// tools/host/tunnel.ps1 updates it every time the free tunnel starts (its address changes on each start). Used when ONLINE_SERVER is empty.
export const ONLINE_SERVER_LIST = 'https://dhrubo95zd.github.io/sunmere-site/server.json';
