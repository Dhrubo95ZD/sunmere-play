// S14 effect budgets (docs/ai/combat_design.md 10.3, the Effects pass): the central caps every effect goes through, so a
// fusion stays inside its budget by construction instead of by each beat's own care. Pure: no three.js, no DOM, no
// settings import (client/game/fx.js passes the preset and the option in), so tools/tests/effects14test.mjs reads it in node.
//
// Every cast (EntityView.playSkill) gets a budget object for its caster's LEVEL:
//   own     your hero: the whole fusion (phones: the preset's particle share)
//   party   a party member: 60% of own on the desktop, 30% on phones, a light only when one is free (phones none)
//   other   any other hero or bot: by the "Others' effects" option (full = as a party member, reduced = 30% and no light,
//           minimal = the contact core and one ring); phones treat reduced as minimal
//   minimal the contact core flash and one ring a cast, nothing else (others in a crowd: more than 6 casters on screen,
//           phones more than 3)
//   far     beyond 40 m: dust and one ring only (phones: nothing; the machine's own reaction still plays)
// and every particle, light, ring, rock, trail and ground patch the cast makes (also later, through FX.after) counts on it.
// Caps on the whole scene sit on top (live particles, debris meshes, rings, trails, patches), with your own effects kept
// first: others are refused before yours when the scene is full.

export const FAR_M = 40;
// the two presets (10.3): desk = every desktop quality, phone = the Mobile presets (QUALITY.mobile)
export const CAPS = Object.freeze({
  desk: Object.freeze({ scene: 2400, ownReserve: 400, own: 320, ownRocks: 18, sceneRocks: 48, ringsBeat: 2, ringsLive: 8, beat: 0.3, lightsCast: 1, trailsHero: 2, trailsAll: 16, patches: 24, patchesHero: 6, crowd: 6, party: 0.6, other: 0.3 }),
  phone: Object.freeze({ scene: 700, ownReserve: 150, own: 110, ownRocks: 8, sceneRocks: 16, ringsBeat: 1, ringsLive: 3, beat: 0.3, lightsCast: 1, trailsHero: 1, trailsAll: 4, patches: 10, patchesHero: 6, crowd: 3, party: 0.3, other: 0 }),
});
export const capsFor = (mobile) => (mobile ? CAPS.phone : CAPS.desk);

// the "Others' effects" option: full / reduced / minimal; phones default to minimal, desktops to reduced
export const OTHERS_FX = [['full', 'Full'], ['reduced', 'Reduced'], ['minimal', 'Minimal']];
export const othersDefault = (mobile) => (mobile ? 'minimal' : 'reduced');
export const othersNorm = (v, mobile) => (OTHERS_FX.some(([k]) => k === v) ? v : othersDefault(mobile));

// a caster's level. o: { own, party, dist (m), crowd (other casters on screen), others (the option), mobile }
export function levelFor(o) {
  const C = capsFor(o.mobile);
  if (o.own) return 'own';
  if (o.dist > FAR_M) return o.mobile ? 'none' : 'far';
  if (o.party) return 'party';
  if ((o.crowd || 0) > C.crowd) return 'minimal';
  const opt = othersNorm(o.others, o.mobile);
  if (opt === 'full') return 'party';
  if (opt === 'minimal' || o.mobile) return 'minimal';
  return 'other';
}

// the emitter kinds a thin level may still use (null: all)
const MINIMAL_KINDS = new Set(['flash', 'glow']);
const FAR_KINDS = new Set(['dust', 'ringdust']);

// a fresh budget for one cast at `level`. share: the preset's particle share on phones (QUALITY.particles, 0.5 Mobile)
export function makeBudget(level, mobile, { share = 1, fusion = false } = {}) {
  const C = capsFor(mobile);
  const sh = mobile ? Math.max(0.25, Math.min(1, share)) : 1;
  let lk = 1, k = 1, light = 'yes', rings = Infinity, rocks = C.ownRocks, trails = C.trailsHero, kinds = null, marks = true;
  if (level === 'own') { k = sh; light = mobile ? 'soft' : 'yes'; }
  else if (level === 'party') { lk = C.party; k = C.party * sh; light = mobile ? 'no' : 'soft'; rocks = Math.round(C.ownRocks * C.party); trails = 1; }
  else if (level === 'other') { lk = C.other; k = C.other * sh; light = 'no'; rocks = Math.round(C.ownRocks * C.other); trails = 1; rings = 1; }
  else if (level === 'minimal') { k = 1; light = 'no'; rocks = 0; trails = 0; kinds = MINIMAL_KINDS; rings = 1; marks = false; }
  else if (level === 'far') { k = 0.5; light = 'no'; rocks = 0; trails = 0; kinds = FAR_KINDS; rings = 1; marks = false; }
  else { k = 0; light = 'no'; rocks = 0; trails = 0; kinds = new Set(); rings = 0; marks = false; } // 'none'
  return {
    lvl: level, player: true, fusion, k, light, kinds, marks,
    pcap: level === 'minimal' ? 12 : level === 'far' ? 40 : level === 'none' ? 0 : Math.round(C.own * lk),
    rockCap: rocks, ringsLeft: rings, ringsBeat: level === 'own' ? C.ringsBeat : 1, trails,
    p: 0, rocks: 0, ringT: [], patches: 0, until: 0, owner: null,
  };
}
// the world's budget (machines, ambient dust, the server's own effects): only the scene caps apply
export function worldBudget() { return { lvl: 'world', player: false, k: 1, light: 'yes', kinds: null, marks: true, pcap: Infinity, rockCap: Infinity, ringsLeft: Infinity, ringsBeat: Infinity, trails: Infinity, p: 0, rocks: 0, ringT: [], patches: 0, until: Infinity, owner: null }; }

// emitter count under a budget: n x k, rounded at random so small bursts keep their average
export function scaledCount(n, k, u = Math.random()) { const x = n * k; const f = Math.floor(x); return f + (u < x - f ? 1 : 0); }

// a ring now under the budget's beat rule: at most ringsBeat inside one beat (0.3 s), and the cast's own total.
// Returns true and books it, or false (the caller throws a low dust wave instead)
export function ringOk(b, now, C) {
  if (!(b.ringsLeft > 0)) return false;
  const T = b.ringT; while (T.length && now - T[0] > C.beat) T.shift();
  if (T.length >= b.ringsBeat) return false;
  T.push(now); b.ringsLeft--;
  return true;
}

// ---------------------------------------------------------------- the red-orange reservation (10.3)
// Red-orange (the #ff3a20 family) belongs to enemy telegraphs only. A bright, saturated colour with a hue under 22 deg (or
// over 345 deg) is in the family; player effects get it moved to the warm yellow-orange of fire (hue 32 deg, same value).
const hsv = (n) => {
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return { h, s: mx ? d / mx : 0, v: mx };
};
const toInt = (c) => (typeof c === 'number' ? c : parseInt(String(c).replace('#', '').slice(0, 6), 16));
export function isReserved(c) { const n = toInt(c); if (!Number.isFinite(n)) return false; const { h, s, v } = hsv(n); return (h < 22 || h > 345) && s > 0.6 && v > 0.55; }
// the colour moved out of the family: hue 32 (amber fire), the saturation held under 0.85, the same brightness
export function safeInt(c) {
  const n = toInt(c);
  if (!isReserved(n)) return n;
  const { s, v } = hsv(n), S = Math.min(s, 0.85), H = 32 / 60, C = v * S, X = C * (1 - Math.abs((H % 2) - 1)), m = v - C;
  const r = C + m, g = X + m, b = m; // (hue 32 is in the red-to-yellow sextant: r = max, g rising, b = min)
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}
export const safeHex = (c) => '#' + safeInt(c).toString(16).padStart(6, '0');
// telegraphs draw over every player effect: above the particles (19/20), rings (17) and decals (5-6)
export const TELEGRAPH_ORDER = 30;
