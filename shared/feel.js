// The combat feel layer (combat_design.md section 2, stage S1): hit-stop tiers, per-skill windows (cancel and lock, which
// replace the flat 1.0 s global cooldown), the input buffer, the dodge, and machine poise. Shared by the sim (shared/sim.js)
// and the client (fx, camera, sound), so both read the same numbers. Skill data picks the tier: choreo events carry no hand
// numbers for the stop. Imports nothing (shared/ may only import from shared/).

// tier: stop (s), shake, camera punch (FOV deg) and kick (m), the sound layers on the contact frame, and the duck (s)
export const TIERS = [
  { tier: 0, name: 'graze', stop: 0, shake: 0, punch: 0, kick: 0, snd: ['tick'] },
  { tier: 1, name: 'light', stop: 0.035, shake: 0.08, punch: 0, kick: 0.12, snd: ['hit'] },
  { tier: 2, name: 'skill', stop: 0.06, shake: 0.2, punch: 0, kick: 0.18, snd: ['hit', 'thud'] },
  { tier: 3, name: 'heavy', stop: 0.085, shake: 0.4, punch: 2, kick: 0.25, snd: ['thud'], crack: true },
  { tier: 4, name: 'fusion', stop: 0.12, shake: 0.6, punch: 4, kick: 0.35, snd: ['boom'], crack: true, duck: 0.06 },
  { tier: 5, name: 'finisher', stop: 0.16, shake: 0.7, punch: 5, kick: 0.35, snd: ['rumble'], crack: true, duck: 0.06 },
];
export const tierInfo = (t) => TIERS[Math.max(0, Math.min(5, t | 0))];

export const BUFFER = 0.3; // a press this early is held and fired on the first legal frame (the latest press wins)
export const CANCEL_AFTER = 0.12; // after contact + this, a dodge or the next skill may cut the follow-through
export const CANCEL_FADE = 0.06; // the cross-fade of a cut
export const LOCK_MIN = 0.45, LOCK_MAX = 0.9;
// classes whose plain skills use their own lock (0.45-0.9 s) instead of the old flat 1.0 s GCD. S1 starts with the Knight
// (the pilot class, combat_design.md section 11): a shorter lock changes each class's damage by how much resource it
// has spare (deadeyetest: the Deadeye fell to x0.82 of the Ranger with every class on it), so the others move over with
// their own slices (S8-S13) where their numbers are tuned with it
export const LOCK_CLASSES = new Set(['knight']);
export const OLD_GCD = 1.0;

export const DODGE = { charges: 2, regen: 3.5, dist: 4, dur: 0.35, evade: 0.3, opening: 2, worldStop: 0.06 };
// class flavours (same timing): Sandblade's extra charge and shorter step, the Ranger's longer one (the Warden's Brace
// with no movement and the other clips come with each class's slice; S1 gives every class the roll and the hop back)
export const DODGE_CLS = { sandblade: { charges: 3, dist: 2.5 }, ranger: { dist: 5 } };
export const dodgeFor = (cls) => ({ ...DODGE, ...(DODGE_CLS[cls] || {}) });
// the dodge with a Skill Web modifier table on it (p.tal; the server and the client both read it): Quick Feet's 3 charges and
// 0.45 s evade, Momentum's 30% slower recovery, Iron Comet's roll that no longer evades
export const dodgeWith = (cls, tal) => {
  const D = dodgeFor(cls);
  if (!tal?.keys?.length) return D;
  if (tal.dodgeCharges) D.charges = tal.dodgeCharges;
  if (tal.evade) D.evade = tal.evade;
  if (tal.dodgeRecover) D.regen *= 1 + tal.dodgeRecover;
  if (tal.keys.includes('iron_comet')) D.evade = 0;
  return D;
};

// bossTake: a dungeon, raid or world boss takes this share of every poise hit. At the full rate a muster party broke a
// boss 1.5-7 times a minute (median 2.7, balance_v120 realfight, S1 review) and cancelled 8% of all boss telegraphs;
// the design's target is "a group breaks a boss about once a minute" (combat_design.md 2.5)
export const POISE = { refill: 3, stagger: 1.2, staggerElite: 0.8, staggerVuln: 15, broken: 4, brokenVuln: 25, brokenKneel: 1.0, brokenRefill: 1.2, critMul: 1.5, bigLaunchMul: 1.5, eliteAir: 0.9, bossTake: 0.4 };
// a machine is held by Staggered and Lifted (chained) for at most ctlChain s in a row, then neither applies for ctlGuard s
// (its poise does not wear meanwhile). Without it two Knights kept a normal machine stunned 90% of the time (longest
// 5.9 s) and an elite 36% (alternate Rising Cuts); before S1 it was 7%
Object.assign(POISE, { ctlChain: 2.5, ctlGap: 0.3, ctlGuard: 2.0 });
// a Broken boss cancels only its own wind-up telegraphs; dungeon hazards it calls (the mud slip, gantry loads, flooding
// pits and sumps, the damp) are on the dungeon's clock and land anyway
export const CUT_KINDS = new Set(['circles', 'nova', 'beam']);

// a machine's poise: def.poise, or 20 + 10 x its size class; elites x2, dungeon bosses 300, raid bosses 500
export function poiseMax(def, sp) {
  if (!def || def.dummy) return 0;
  if (def.poise) return def.poise;
  if (def.boss) return def.raid ? 500 : sp?.dungeon || def.world ? 300 : 240;
  const r = def.radius || 1, size = r < 0.8 ? 0 : r < 1.3 ? 1 : r < 2 ? 2 : 3;
  return (20 + 10 * size) * (def.elite || def.rare ? 2 : 1);
}
// heavy machines (bosses and anything over 1.5 m across) are never thrown into the air: a launch is extra poise instead
export const liftable = (def) => !def.boss && !def.world && (def.radius || 1) <= 1.5;
export const isElite = (def) => !!(def.elite || def.rare || def.boss || def.world);

// per-skill feel overrides on today's kit (S1); everything else is derived from the skill's data
const OVR = {
  k_rising: { launch: 1.0, brk: 18 }, // Rising Cut lifts the machine (the start of Stormfall in S2)
  k_skybreaker: { brk: 35 },
  k_bash: { brk: 24, bash: true },
  k_valiant: { brk: 4 },
  k_pommel: { brk: 12, bash: true },
  k_charge: { brk: 26, bash: true },
};

const has = (sk, k) => sk.fx?.some((f) => f[0] === k);
const fxv = (sk, k) => sk.fx?.find((f) => f[0] === k);
const lastHitT = (sk) => (sk.hit?.t || 0) + Math.max(0, (sk.hit?.n || 1) - 1) * (sk.hit?.gap || 0);
const harmful = (sk) => has(sk, 'dmg') || has(sk, 'execute') || has(sk, 'stun') || has(sk, 'knock');
// a basic (filler) strike: costs little, no cooldown, on the global lock
const basic = (sk) => !sk.cd && !sk.cast && !sk.channel;

const cache = new WeakMap(); // (by record: a KIT_V2 skill keeps its legacy id, and each chain step is its own record)
// the feel block of a skill: { brk, launch, bash, win: { cancel, lock } } (times in seconds, before haste)
export function skillFeel(sk) {
  if (!sk) return null;
  let f = cache.get(sk);
  if (f) return f;
  const o = (sk.kit ? null : OVR[sk.id]) || {}; // (a new-kit record carries its own numbers)
  const d = fxv(sk, 'dmg')?.[1] || fxv(sk, 'execute')?.[1] || 0;
  const n = sk.hit?.n || 1;
  let brk = 0;
  if (harmful(sk)) {
    if (basic(sk)) brk = 4;
    else brk = Math.round(Math.min(35, Math.max(10, 6 + d * 9 + (has(sk, 'stun') ? 8 : 0) + (has(sk, 'knock') ? 6 : 0) + (has(sk, 'leap') ? 6 : 0))) / n);
  }
  const hitEnd = lastHitT(sk);
  f = {
    brk: o.brk ?? fxv(sk, 'brk')?.[1] ?? brk,
    launch: o.launch ?? (fxv(sk, 'launch')?.[1] || 0),
    bash: !!(o.bash ?? (has(sk, 'stun') && (sk.hit?.kind === 'melee'))),
    knock: fxv(sk, 'knock')?.[1] || 0,
    win: { cancel: hitEnd + CANCEL_AFTER, lock: LOCK_CLASSES.has(sk.cls) ? Math.min(LOCK_MAX, Math.max(LOCK_MIN, (sk.win?.lock ?? hitEnd + 0.3))) : OLD_GCD, ...(sk.win || {}) },
  };
  cache.set(sk, f);
  return f;
}

// the hit-stop tier of contact `i` (0-based) of a skill. ctx: { crit, broke, launched, dot, mob } from the sim when known
// (the client predicts with an empty ctx and upgrades when the server reports a break or a lift)
export function tierOf(sk, i = 0, ctx = {}) {
  if (!sk || ctx.dot) return tierInfo(0);
  const n = sk.hit?.n || 1;
  if (n > 2 && i > 0 && i < n - 1) return tierInfo(0); // a flurry stops only on its first and last contact
  const f = skillFeel(sk);
  let t = basic(sk) ? 1 : 2;
  if (sk.hit?.kind === 'proj' && basic(sk)) t = 1;
  if (ctx.broke || ctx.launched || f.launch || f.bash || f.knock >= 3) t = 3;
  if (ctx.crit && t >= 2 && f.brk >= 20) t = 3; // a heavy crit
  if (ctx.reaction) t = 3;
  if (sk.kit && sk.tier) t = Math.max(t, Math.min(3, sk.tier)); // (a new-kit core skill or chain step names its tier)
  // a fusion (shared/fusions.js): its finishing contact is T4, T4+ when it kills or for a triad; earlier contacts are T2
  if (sk.from) t = i >= n - 1 ? (sk.triad || ctx.kill ? 5 : 4) : Math.max(t, 2);
  if (ctx.fusion) t = ctx.finisher ? 5 : 4;
  return tierInfo(t);
}
