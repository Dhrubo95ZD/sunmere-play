// Client versions and the update check (client/game/update.js, server/minclient.js, tools/tests/updatetest.mjs).
// The client version is the changelog number: the `v` of the first entry in client/ui/changelog.js (CLIENT_VERSION in
// client/game/update.js). Every build carries it (the Android app, the Windows app, the play link, the dev page).
// The public file https://dhrubo95zd.github.io/sunmere-site/version.json (tools/host/publish_version.mjs writes it) says
//   { "version": "<latest>", "min": "<oldest allowed>", "android": "<apk url>", "windows": "<zip url>", "notes": "..." }
// Versions are plain numbers ("143") or dotted numbers ("0.1.46"); compared part by part as numbers.

export const VERSION_URL = 'https://dhrubo95zd.github.io/sunmere-site/version.json';
export const DOWNLOADS = {
  android: 'https://github.com/Dhrubo95ZD/sunmere-play/releases/latest/download/Sunmere-Android.apk',
  windows: 'https://github.com/Dhrubo95ZD/sunmere-play/releases/latest/download/Sunmere-Windows.zip',
};

const parts = (v) => String(v ?? '').trim().replace(/^v/i, '').split('.').map((s) => (/^\d+$/.test(s) ? Number(s) : NaN));
// a usable version: one or more dot-separated whole numbers
export const validVer = (v) => (typeof v === 'number' ? Number.isFinite(v) && v >= 0 : parts(v).every((n) => Number.isFinite(n)) && String(v).trim() !== '');

// -1 when a < b, 0 when equal, 1 when a > b (missing parts count as 0; an unusable version is the oldest of all)
export function cmpVer(a, b) {
  const va = validVer(a), vb = validVer(b);
  if (!va || !vb) return va === vb ? 0 : va ? 1 : -1;
  const pa = parts(a), pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

// what the client does with version.json: 'block' (older than min: Update required), 'note' (older than the latest:
// a dismissible note) or 'ok'. No file, or a file without usable numbers: 'ok' (the server still guards online play).
export function verdict(info, mine) {
  if (!info || typeof info !== 'object') return 'ok';
  if (validVer(info.min) && cmpVer(mine, info.min) < 0) return 'block';
  if (validVer(info.version) && cmpVer(mine, info.version) < 0) return 'note';
  return 'ok';
}

// the server's test: no minimum set = everyone may join; else the client's version must be at least min
// (a client that sends no version is older than any minimum)
export const versionAllowed = (ver, min) => !validVer(min) || cmpVer(ver, min) >= 0;
