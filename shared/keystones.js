// Keystone and notable hooks of the Skill Web (docs/ai/combat_design.md 3.5, 4.4, 5.1).
// Each keystone: { name, cls (or 'common'), desc, price, mods, renames?, onCompile?, onCast?, onHit?, onLand?, onLink?, onKill?, onTaken? }
//   mods      flat numbers merged into the hero's modifier table (p.tal) by treeMods; the fusion engine reads them
//             (link windows, fusion power and cost, dodge charges...).
//   onCompile (rec, ctx) -> rec  patch an effective skill or fusion record (a copy). ctx: { cls, forms, tal }. A rename sets
//             rec.name and rec.was (the old name), so the Book and tooltips show "Cinderfall (Stormfall)".
//   onCast    (w, p, ctx)  before costs: ctx { sk, cost, fused } (may change ctx.cost)
//   onHit     (w, p, ctx)  a contact: ctx { sk, tgt, amt, fused } (may change ctx.amt)
//   onLand    (w, p, ctx)  the end of a leap or dash: ctx { sk, x, z } (may set ctx.link = { to, t })
//   onLink    (w, p, ctx)  a fusion fires: ctx { fusion }
//   onKill    (w, p, ctx)  ctx { tgt }
//   onTaken   (w, p, ctx)  a blow taken: ctx { src, amt } (may change ctx.amt)
// Notables with a ['hook', id] effect use NOTABLE_HOOKS the same way. Everything is physical: dust, grit, heat, steam.
// shared/ only imports from shared/.

const has = (rec, tag) => (rec.tags || []).includes(tag);
const fxMul = (rec, kind, m) => { rec.fx = (rec.fx || []).map((e) => (e[0] === kind ? [e[0], e[1] * m, ...e.slice(2)] : e)); };
const addTag = (rec, tag) => { if (!has(rec, tag)) rec.tags = [...(rec.tags || []), tag]; };
export const hpFrac = (p) => (p.maxHp ? p.hp / p.maxHp : 1);

export const KEYSTONES = {
  // ------------------------------------------------------------------ Knight (5.1)
  cinder_landing: {
    name: 'Cinder Landing', cls: 'knight',
    desc: 'Every leap leaves hot cinders 4 m wide for 4 s (burn 0.2 a second, slow 20%; a heat source for Ignite). Stormfall becomes Cinderfall and its crater stays hot.',
    price: 'Leap damage is 15% lower.',
    renames: { kf_stormfall: { name: 'Cinderfall', fx: 'cinders' } },
    onCompile(rec) {
      if (!has(rec, 'leap')) return rec;
      fxMul(rec, 'dmg', 0.85);
      rec.fx = [...(rec.fx || []), ['zone', 'fire', 0.2, 4, 4]]; // ['zone', kind, coef, dur, r] (3.7); the cinders slow 20% while stood in
      rec.zoneSlow = 20;
      addTag(rec, 'heat');
      rec.groundFx = 'cinders'; // ember-orange grit and low heat shimmer, never flame columns
      return rec;
    },
  },
  oathbound: {
    name: 'Oathbound', cls: 'knight',
    desc: 'Guard\'s parry window is 0.5 s and a parry opens links to every core skill. Shield skills taunt for 3 s. The dodge becomes Shield Step (2 m forward with a frontal block). Fusions from Guard are 30% stronger.',
    price: 'Hits with the blade alone deal 10% less.',
    mods: { parryWin: 0.5, parryLinksAll: 1 },
    onCompile(rec) {
      if (rec.slot === 7 || rec.id === 'k_guard') rec.fx = (rec.fx || []).map((e) => (e[0] === 'parry' ? ['parry', 0.5] : e));
      if (has(rec, 'shield') && !(rec.fx || []).some((e) => e[0] === 'taunt')) rec.fx = [...(rec.fx || []), ['taunt', 3]];
      if (rec.dodge) { rec.was = rec.was || rec.name; rec.name = 'Shield Step'; rec.step = 2; rec.frontBlock = true; }
      if (rec.from === 'k_guard') fxMul(rec, 'dmg', 1.3);
      if (has(rec, 'blade') && !has(rec, 'shield') && !rec.from) fxMul(rec, 'dmg', 0.9);
      return rec;
    },
  },
  iron_comet: {
    name: 'Iron Comet', cls: 'knight',
    desc: 'Leaps can be cast in the air from a jump and reach 50% further. A landing opens a 0.6 s link to Shield Bash.',
    price: 'The roll still moves you but no longer evades.',
    mods: { airCast: 1 },
    onCompile(rec) {
      if (has(rec, 'leap')) { rec.range = (rec.range || 0) * 1.5; rec.fx = (rec.fx || []).map((e) => (e[0] === 'leap' ? ['leap', e[1] * 1.5] : e)); rec.airCast = true; }
      if (rec.dodge) rec.noEvade = true;
      return rec;
    },
    onLand(w, p, ctx) { if (has(ctx.sk || {}, 'leap')) ctx.link = { to: 'k_bash', t: 0.6 }; },
  },

  // ------------------------------------------------------------------ Common Ground (4.4)
  chainwork: {
    name: 'Chainwork', cls: 'common', desc: 'A landed fusion opens a 0.8 s link: the next core skill is an Encore, 25% stronger with a heavy stop.',
    price: 'Fusions cost 10% more.', mods: { chainwork: 0.8, encore: 0.25, fuseCost: 0.1 },
  },
  long_breath: {
    name: 'Long Breath', cls: 'common', desc: 'Link windows stay open 2.0 s.', price: 'Fusions are 10% weaker.',
    mods: { linkSet: 2.0, fuse: -0.1 },
  },
  clean_link: {
    name: 'Clean Link', cls: 'common', desc: 'A fusion pressed in the first 0.35 s of the window costs nothing and deals 15% more, with a small clean tick and a white edge on the button.',
    price: 'Pressed after 0.8 s, it deals 15% less.', mods: { cleanEarly: 0.35, cleanBonus: 0.15, cleanLate: 0.8, cleanPen: 0.15 },
  },
  hair_trigger: {
    name: 'Hair Trigger', cls: 'common', desc: 'Fusions fire on the first skill\'s contact frame, cutting its recovery, and are 20% stronger.',
    price: 'Link windows are half as long.', mods: { contactFire: 1, fuse: 0.2, linkMul: 0.5 },
  },
  heavy_hand: {
    name: 'Heavy Hand', cls: 'common', desc: 'Double poise damage, and Broken machines take 20% more.',
    price: 'No critical strikes; your animations play at 0.9 speed.', mods: { brkMul: 2, noCrit: 1, animMul: 0.9 },
    onHit(w, p, ctx) { if (ctx.tgt?.broken || (ctx.tgt?.brokenT || 0) > (w?.time || 0)) ctx.amt *= 1.2; },
  },
  quick_feet: {
    name: 'Quick Feet', cls: 'common', desc: 'Three dodge charges, and each dodge evades for 0.45 s.',
    price: 'Skills cost 10% more while all your dodge charges are full.', mods: { dodgeCharges: 3, evade: 0.45 },
    onCast(w, p, ctx) { if (ctx.chargesFull) ctx.cost *= 1.1; },
  },
  momentum: {
    name: 'Momentum', cls: 'common', desc: 'Each landed fusion gives 6% haste for 6 s, stacking three times.',
    price: 'The dodge recovers 30% slower.', mods: { dodgeRecover: 0.3 },
    onLink(w, p) {
      const b = p.buffs?.find((x) => x.name === 'Momentum');
      const n = Math.min(3, (b?.stacks || 0) + 1);
      w?.addBuff?.(p, { name: 'Momentum', stat: 'haste', pct: 6 * n, stacks: n, t: 6, dur: 6, icon: 'haste' });
    },
  },
  last_reserves: {
    name: 'Last Reserves', cls: 'common', desc: 'Below 35% health your fusions cost nothing and deal 20% more.',
    price: 'Above 80% health you deal 10% less.',
    onCast(w, p, ctx) { if (ctx.fused && hpFrac(p) < 0.35) ctx.cost = 0; },
    onHit(w, p, ctx) { const f = hpFrac(p); if (ctx.fused && f < 0.35) ctx.amt *= 1.2; else if (f > 0.8) ctx.amt *= 0.9; },
  },
};

// notables that need an event rather than a number
export const NOTABLE_HOOKS = {
  shared_courage: { onLink(w, p) { for (const q of w?.partyMembers ? w.partyMembers(p) : [p]) w?.addBuff?.(q, { name: 'Shared Courage', stat: 'dmg', pct: 8, t: 6, dur: 6, icon: 'shout' }); } },
  rolling_start: { onLink(w, p) { w?.addBuff?.(p, { name: 'Rolling Start', stat: 'speed', pct: 10, t: 3, dur: 3, icon: 'haste' }); } },
  second_breath: {
    onTaken(w, p, ctx) {
      const now = w?.time || 0;
      if (p.dead || (p.sbT || 0) > now || (p.hp - ctx.amt) / p.maxHp >= 0.3) return;
      p.sbT = now + 60;
      w?.addBuff?.(p, { name: 'Second Breath', cc: 'root', t: 1.2, dur: 1.2, icon: 'heart' });
      if (w?.heal) w.heal(p, p, (p.power || 10) * 2.5); else p.hp = Math.min(p.maxHp, p.hp + (p.power || 10) * 2.5);
    },
  },
};

export const KEY_HOOKS = ['onCast', 'onHit', 'onLand', 'onLink', 'onKill', 'onTaken'];

// patch a compiled record with every keystone the hero holds (step 4 of compileKit), then apply the renames
export function keyCompile(rec, keys = [], ctx = {}) {
  let r = rec;
  for (const k of keys) {
    const K = KEYSTONES[k];
    if (!K) continue;
    if (K.onCompile) r = K.onCompile(r, ctx) || r;
    const rn = K.renames?.[r.id];
    if (rn) { r.was = r.was || r.name; r.name = rn.name; if (rn.choreo) r.choreo = rn.choreo; if (rn.fx) r.renameFx = rn.fx; r.renamedBy = k; }
  }
  return r;
}

// run one event hook for every keystone and notable hook the hero holds (p.tal.keys, p.tal.hooks). Returns ctx.
export function runKeys(w, p, hook, ctx = {}) {
  const tal = p?.tal;
  if (!tal) return ctx;
  for (const k of tal.keys || []) KEYSTONES[k]?.[hook]?.(w, p, ctx);
  for (const h of tal.hooks || []) NOTABLE_HOOKS[h]?.[hook]?.(w, p, ctx);
  return ctx;
}

// the name a tooltip shows: "Cinderfall (Stormfall)"
export const effName = (rec) => (rec?.was && rec.was !== rec.name ? `${rec.name} (${rec.was})` : rec?.name || '');
