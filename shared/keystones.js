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
// metres the hero moved in the last `win` s (p.mvLog: [time, metres] pairs the sim keeps for Never Still, S10)
export const moved = (p, now, win = 2) => (p.mvLog || []).reduce((t, e) => (e[0] >= now - win ? t + e[1] : t), 0);

export const KEYSTONES = {
  // ------------------------------------------------------------------ Knight (5.1)
  cinder_landing: {
    name: 'Cinder Landing', cls: 'knight',
    desc: 'Every leap leaves hot cinders 4 m wide for 4 s (burn 0.2 a second, slow 20%; a heat source for Ignite). Stormfall becomes Cinderfall and its crater stays hot.',
    price: 'Leap damage is 15% lower.',
    renames: { kf_stormfall: { name: 'Cinderfall', fx: 'cinders' } },
    onCompile(rec) {
      // Anvil Fall is a throw, not a leap (S5), but it comes out of the hot crater: the shield's bounce leaves cinders too
      if (rec.id === 'kt_anvilfall') { rec.fx = [...(rec.fx || []), ['zone', 'fire', 0.2, 4, 3]]; rec.zoneSlow = 20; addTag(rec, 'heat'); rec.groundFx = 'cinders'; return rec; }
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
    desc: 'Leaps can be cast in the air from a jump and reach 50% further. A landing opens a 0.6 s link to Shield Bash: the bash skips its recovery and lands 30% harder with a heavy stop.',
    price: 'The roll still moves you but no longer evades.',
    mods: { airCast: 1 },
    onCompile(rec) {
      if (has(rec, 'leap')) { rec.range = (rec.range || 0) * 1.5; rec.fx = (rec.fx || []).map((e) => (e[0] === 'leap' ? ['leap', e[1] * 1.5] : e)); rec.airCast = true; }
      if (rec.dodge) rec.noEvade = true;
      return rec;
    },
    onLand(w, p, ctx) { if (has(ctx.sk || {}, 'leap')) ctx.link = { to: 'k_bash', t: 0.6 }; },
  },

  // ------------------------------------------------------------------ Sandblade (5.3, S8)
  afterwake: {
    name: 'Afterwake', cls: 'sandblade',
    desc: 'Every dash leaves a wake of churned sand along its path for 3 s that cuts machines crossing it (0.4 a second), and the dash speeds you 15% for 3 s.',
    price: 'Single strikes deal 10% less.',
    onCompile(rec) {
      if (has(rec, 'dash')) rec.wake = { coef: 0.4, dur: 3, r: 1.3, speed: 15 };
      else if (rec.hit?.kind === 'melee' && !rec.from && (rec.hit.n || 1) === 1) fxMul(rec, 'dmg', 0.9);
      return rec;
    },
  },
  counter_guard: {
    name: 'Counter Guard', cls: 'sandblade',
    desc: 'The sidestep becomes a 0.3 s parry: a blow turned in it staggers the machine and opens Riptide without Counter Stance.',
    price: 'The sidestep recovers 25% slower.',
    mods: { dodgeRecover: 0.25 },
  },
  hot_sand: {
    name: 'Hot Sand', cls: 'sandblade',
    desc: 'Sand skills carry heat (they Ignite Tarred machines), and the sand fuses into glass grit that cuts: a bleed for 4 s. Dust Whirl becomes Glass Whirl and Sandspout becomes Glass Spout.',
    price: 'Blinds last half as long.',
    renames: { sf_dustwhirl: { name: 'Glass Whirl', fx: 'glass' }, sf_sandspout: { name: 'Glass Spout', fx: 'glass' } },
    onCompile(rec) {
      if (!has(rec, 'sand')) return rec;
      addTag(rec, 'heat');
      rec.fx = (rec.fx || []).map((e) => (e[0] === 'debuff' && e[1] === 'miss' ? [e[0], e[1], e[2], e[3] * 0.5] : e));
      if ((rec.fx || []).some((e) => e[0] === 'dmg')) rec.fx = [...rec.fx, ['dot', 0.3, 4]];
      rec.hotSand = true; // (the column and the wake are heat too: a Tarred machine in them Ignites)
      return rec;
    },
  },

  // ------------------------------------------------------------------ Warden (5.2, S9)
  aftershock: {
    name: 'Aftershock', cls: 'warden',
    desc: 'Every slam strikes again 0.6 s later at half strength, with a second, smaller ring of dust and a smaller shake.',
    price: 'Slams cost 10 more Resolve.',
    onCompile(rec) {
      if (!has(rec, 'slam')) return rec;
      rec.aftershock = { t: 0.6, mul: 0.5 };
      if (!rec.from) rec.cost = (rec.cost || 0) + 10; // (a fusion pays through its B: Colossus Drop's Ground Pound)
      return rec;
    },
  },
  unmoving: {
    name: 'Unmoving', cls: 'warden',
    desc: 'You cannot be knocked back, lifted, rooted or slowed, and your armour is 15% thicker. Bulwark Charge becomes Shoulder Check.',
    price: 'Every charge and dash is a 3 m step.',
    mods: { unmoving: 1, armor: 0.15 },
    renames: { w_bulwark: { name: 'Shoulder Check' } },
    onCompile(rec) {
      if ((rec.fx || []).some((e) => e[0] === 'dash')) { rec.fx = rec.fx.map((e) => (e[0] === 'dash' ? ['dash', 3] : e)); rec.range = Math.min(rec.range || 4, 5); rec.stepOnly = true; }
      return rec;
    },
  },
  forge_head: {
    name: 'Forge-Heated Head', cls: 'warden',
    desc: 'The hammer head is kept hot: a dull orange tint and a faint smoke trail. Hammer strikes are heat (they Ignite Tarred machines) and leave hot slag on the ground for 3 s. Colossus Drop becomes Slag Drop and Fault Line becomes Slag Seam.',
    price: 'The heat costs you 2% of your health every 10 s in a fight.',
    mods: { forgeBurn: 0.02 },
    renames: { wf_colossus: { name: 'Slag Drop', fx: 'slag' }, wf_faultline: { name: 'Slag Seam', fx: 'slag' } },
    onCompile(rec) {
      if (!has(rec, 'hammer')) return rec;
      addTag(rec, 'heat');
      rec.forge = true;
      if ((rec.fx || []).some((e) => e[0] === 'dmg') && !rec.fx.some((e) => e[0] === 'zone')) rec.fx = [...rec.fx, ['zone', 'fire', 0.15, 3, rec.hit?.kind === 'aoe' ? Math.min(4, rec.hit.r || 3) : 2]];
      rec.groundFx = 'slag';
      return rec;
    },
  },

  // ------------------------------------------------------------------ Deadeye (5.5, S10)
  // Never Still: the sim keeps the metres moved in the last 2 s (p.mvLog, tickPlayer; a dodge or a jump counts double)
  never_still: {
    name: 'Never Still', cls: 'deadeye',
    desc: 'You deal 2% more for every metre moved in the last 2 s, up to 20%; slides and jumps count double.',
    price: 'After 1 s standing still you deal 20% less.',
    mods: { neverStill: 1 },
    onHit(w, p, ctx) {
      const now = w?.time || 0, m = moved(p, now, 2);
      if (now - (p.mvAt ?? -9) >= 1 && m < 0.2) ctx.amt *= 0.8;
      else ctx.amt *= 1 + Math.min(0.2, 0.02 * m);
    },
  },
  // Six Chambers: Powder becomes two cylinders of six rounds (p.rounds [right, left]); every shot contact spends one, a
  // dodge reloads one pistol, Recoil Jump both, and Snap Shot pressed in the last 0.2 s of the dodge is a perfect reload:
  // the next six shots are hot loads (25% more, heat). The bar shows the twelve round pips
  six_chambers: {
    name: 'Six Chambers', cls: 'deadeye',
    desc: 'Powder becomes two cylinders of six rounds and every shot uses one: skills cost no Powder. A slide reloads one pistol and Recoil Jump both. Snap Shot pressed in the last 0.2 s of a slide is a perfect reload: the next six shots are hot loads, 25% stronger and heat. Broadside becomes Twelve Rounds.',
    price: 'With both cylinders empty you cannot fire until you slide, jump or wait for a slow reload.',
    mods: { sixChambers: 1 },
    renames: { df_broadside: { name: 'Twelve Rounds' } },
    onCompile(rec) {
      if (!has(rec, 'shot')) return rec;
      rec.cost = 0; rec.extra = 0; rec.rounds = rec.id !== 'd_recoil' && rec.to !== 'd_recoil'; // (the jump fires into the ground and reloads: it never needs a round)
      // Twelve Rounds: both cylinders emptied, twelve shots right and left at uneven gaps, the same weight as the four
      if (rec.id === 'df_broadside') {
        rec.hit = { ...rec.hit, n: 12, ts: [0.34, 0.42, 0.52, 0.59, 0.7, 0.78, 0.9, 0.97, 1.08, 1.16, 1.27, 1.36] };
        rec.fx = (rec.fx || []).map((e) => (e[0] === 'dmg' ? ['dmg', +(e[1] * 0.36).toFixed(3)] : e[0] === 'brk' ? ['brk', 4] : e));
        rec.tiers = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4]; rec.emptyAll = true; rec.formChoreo = 'df_twelve'; // (its own clip: twelve shots from the kneel, choreo.js)
      }
      return rec;
    },
  },
  // Bank Shot: every shot skips once off the plate to a second machine within 8 m at half strength; the skip is spark
  // (Galvanic on a Corroded machine). sim.js applySkill does the skip
  bank_shot: {
    name: 'Bank Shot', cls: 'deadeye',
    desc: 'Every shot skips once off the plate or the ground into a second machine within 8 m for half its damage. The skips are spark: they set off Galvanic on Corroded machines.',
    price: 'Snap Shot deals 10% less.',
    onCompile(rec) {
      if (!has(rec, 'shot')) return rec;
      rec.bank = { r: 8, mul: 0.5 };
      if (rec.id === 'd_snap') fxMul(rec, 'dmg', 0.9);
      return rec;
    },
  },

  // ------------------------------------------------------------------ Ranger (combat_design_fusion.md 4.2, S11)
  // Never Still (the Ranger's: a bow on the run): the sim keeps the metres moved (p.mvLog, as the Deadeye's) for a Ranger
  // holding it; moving is more than 0.4 m in the last 0.5 s, standing still is 2 s without a step
  restless: {
    name: 'Never Still', cls: 'ranger',
    desc: 'Every arrow you loose can be loosed on the run, and arrows loosed while you are moving deal 25% more.',
    price: 'After 2 s standing still your arrows deal 30% less.',
    mods: { rangerStill: 1 },
    onCompile(rec) { if (has(rec, 'arrow') || has(rec, 'rain')) rec.move = true; return rec; },
    onHit(w, p, ctx) {
      const now = w?.time || 0;
      if (moved(p, now, 0.5) > 0.4) ctx.amt *= 1.25;
      else if (now - (p.mvAt ?? -9) >= 2) ctx.amt *= 0.7;
    },
  },
  // One Arrow: Quick Shot's key looses Piercing Arrow (rec.swapTo), which has no cooldown, costs 25 Focus and draws 30%
  // faster; the fusions with Quick Shot take Piercing Arrow instead (treeCompile keys them by their new pair)
  one_arrow: {
    name: 'One Arrow', cls: 'ranger',
    desc: 'Quick Shot is gone: its key looses Piercing Arrow, which has no cooldown, costs 25 Focus and draws 30% faster. Fusions with Quick Shot take Piercing Arrow instead.',
    price: 'There is no free arrow left: every shot costs Focus.',
    onCompile(rec) {
      if (rec.id === 'r_quick') { rec.swapTo = 'r_pierce'; return rec; }
      if (rec.id === 'r_pierce' && !rec.from) {
        rec.cd = 0; rec.cost = 25;
        if (rec.draw) rec.draw = { ...rec.draw, min: +(rec.draw.min * 0.7).toFixed(3), full: +(rec.draw.full * 0.7).toFixed(3) };
        if (rec.hit) rec.hit = { ...rec.hit, t: +(rec.hit.t * 0.7).toFixed(3) };
      }
      if (rec.from === 'r_quick') rec.from = 'r_pierce';
      if (rec.to === 'r_quick') rec.to = 'r_pierce';
      return rec;
    },
  },
  // Trapper's Ground: up to three traps lie at once (sim.js p.traps), and a trap fusion strikes round every one of them
  trappers_ground: {
    name: "Trapper's Ground", cls: 'ranger',
    desc: 'Up to three of your snares lie armed at once, and Tripwire Burst, Spring Snare and Closed Ground go off round every one of them.',
    price: 'Snare Trap costs 10 more Focus.',
    mods: { trapMax: 3, trapAll: 1 },
    onCompile(rec) { if (rec.id === 'r_trap') rec.cost = (rec.cost || 0) + 10; return rec; },
  },

  // ------------------------------------------------------------------ Chemist (combat_design_fusion.md 4.3, combat_design.md 5.6, S12)
  // Unstable Stock: fuses (rec.fuse, sim.js p.bombs) burn half as long and every blast reaches 30% further; the sim scorches
  // the Chemist for 5% of his health on one blast in ten (tal.unstable)
  unstable_stock: {
    name: 'Unstable Stock', cls: 'chemist',
    desc: 'Every fuse burns half as long, and every blast reaches 30% further.',
    price: 'One blast in ten also scorches you for 5% of your health.',
    mods: { unstable: 0.1 },
    onCompile(rec) {
      if (rec.fuse) rec.fuse = +(rec.fuse * 0.5).toFixed(3);
      if (has(rec, 'blast') && rec.hit?.r) { rec.hit = { ...rec.hit, r: +(rec.hit.r * 1.3).toFixed(2) }; for (const q of rec.seq || []) if (q.hit?.r) q.hit = { ...q.hit, r: +(q.hit.r * 1.3).toFixed(2) }; }
      return rec;
    },
  },
  // Closed Lab: no puddles on the ground; Tar Pot's puddle and every puddle a fusion leaves become a 4 m cloud carried round
  // him (sim.js zones with follow), and the puddle fusions go off round him
  closed_lab: {
    name: 'Closed Lab', cls: 'chemist',
    desc: 'No puddles: Tar Pot and every fusion that leaves a puddle or a cloud lay it as a 4 m cloud carried round you, which slows, coats and burns whatever comes close.',
    price: 'Tar Pot\'s puddle no longer lies where you throw it: it is always round you.',
    onCompile(rec) {
      if ((rec.fx || []).some((e) => e[0] === 'zone')) { rec.zoneFollow = true; rec.fx = rec.fx.map((e) => (e[0] === 'zone' ? [e[0], e[1], e[2], e[3], 4] : e)); }
      if ((rec.fx || []).some((e) => e[0] === 'ignitePuddle' || e[0] === 'tarPath')) rec.zoneFollow = true;
      return rec;
    },
  },
  // Reactive Chemistry: a Reaction anyone sets off on a machine the Chemist coated is 50% stronger and gives him 10 Reagents
  // (sim.js reactCheck / reactFire read the coat's src); his own direct hits are 15% lighter
  reactive_chemistry: {
    name: 'Reactive Chemistry', cls: 'chemist',
    desc: 'A Reaction anyone sets off on a machine you coated is 50% stronger and gives you 10 Reagents.',
    price: 'Your own direct hits deal 15% less.',
    mods: { reactive: 0.5 },
    onHit(w, p, ctx) { if (ctx.sk) ctx.amt *= 0.85; },
  },
  // Cold Chemistry (combat_design.md 5.6): cold in place of heat in every heat-tagged Chemist skill and fusion: they Chill
  // instead of burn, burning ground becomes frost (sim.js zone kind 'frost': slows 60%, Chills), holds last 50% longer, and
  // Tarfire becomes Tar Freeze (the tar sets hard: held 2 s, then Chilled); the Furnace Cask becomes the Frost Cask
  cold_chemistry: {
    name: 'Cold Chemistry', cls: 'chemist',
    desc: 'Cold takes the place of heat in every Chemist skill and fusion: they Chill instead of burn, burning ground becomes frost that slows 60%, and slows and holds last 50% longer. Tarfire becomes Tar Freeze (the tar sets hard and holds the machines 2 s) and Furnace Cask becomes Frost Cask.',
    price: 'Those skills deal 15% less.',
    renames: { cf_tarfire: { name: 'Tar Freeze', fx: 'frost' }, ct_furnacedrum: { name: 'Frost Cask', fx: 'frost' } },
    onCompile(rec) {
      if (!has(rec, 'heat')) return rec;
      rec.tags = rec.tags.filter((t) => t !== 'heat'); addTag(rec, 'cold'); rec.cold = true;
      fxMul(rec, 'dmg', 0.85);
      rec.fx = rec.fx.map((e) => (e[0] === 'zone' && e[1] === 'fire' ? ['zone', 'frost', +(e[2] * 0.5).toFixed(3), e[3], e[4]] : e[0] === 'slow' ? [e[0], e[1], +(e[2] * 1.5).toFixed(2), ...e.slice(3)] : e[0] === 'root' || e[0] === 'stun' ? [e[0], +(e[1] * 1.5).toFixed(2), ...e.slice(2)] : e));
      if (!rec.fx.some((e) => e[0] === 'coat')) rec.fx.push(['coat', 'chill', 5]);
      if (rec.id === 'cf_tarfire') rec.fx.push(['root', 2]);
      if (rec.zoneSlow) rec.zoneSlow = 60;
      return rec;
    },
  },
  // Bench Chemist (combat_design.md 5.6): the third Acid Flask becomes Mix (sim.js on_cast: the fusion of his last two skills,
  // p.mixLog, at the machine, from range and without the window, once every tal.benchChemist s); fusions 10% weaker
  bench_chemist: {
    name: 'Bench Chemist', cls: 'chemist',
    desc: 'The third Acid Flask becomes Mix: it mixes your last two skills into their fusion at the machine, from range and without the link window, once every 8 s.',
    price: 'Fusions are 10% weaker.',
    mods: { benchChemist: 8, fuse: -0.1 },
    onCompile(rec) { if (rec.id === 'c_acid' && rec.step === 3) { rec.was = rec.was || rec.name; rec.name = 'Mix'; rec.mix = true; } return rec; },
  },

  // ------------------------------------------------------------------ Herbalist (combat_design_fusion.md 4.6, combat_design.md 5.7, S13)
  // Bitter Medicine: every heal of his also stings the machines within 4 m of the one healed for 30% of it (sim.js heal reads
  // tal.bitterMed); his healing is 15% weaker. Grand Remedy becomes Bitter Remedy (its steam scalds the machines in it)
  bitter_medicine: {
    name: 'Bitter Medicine', cls: 'herbalist',
    desc: 'Every heal of yours also stings the machines within 4 m of the one you heal, for 30% of the heal. Grand Remedy becomes Bitter Remedy.',
    price: 'Your healing is 15% weaker.',
    mods: { bitterMed: 0.3, heal: -0.15 },
    renames: { h_remedy: { name: 'Bitter Remedy', fx: 'bitter' } },
  },
  // Overflowing: what a heal of his would waste on a full ally becomes a shell (sim.js heal, tal.overflow: up to 30% of the
  // ally's health); his heals over time are 20% weaker
  overflowing: {
    name: 'Overflowing', cls: 'herbalist',
    desc: 'What a heal of yours would waste on an ally already whole hardens into a shell of sap on them, up to 30% of their health.',
    price: 'Your heals over time are 20% weaker.',
    mods: { overflow: 0.3 },
    onCompile(rec) { fxMul(rec, 'hot', 0.8); return rec; },
  },
  // Brawling Healer (combat_design_fusion.md 4.6): Nettle Dart becomes Staff Flurry, a three-step string with the staff in
  // melee reach, each blow mending every ally within 15 m by 0.2; every heal costs 20% more
  brawling_healer: {
    name: 'Brawling Healer', cls: 'herbalist',
    desc: 'Nettle Dart becomes Staff Flurry: three quick blows of the staff at arm\'s length, harder than the darts, and each blow that lands mends every ally within 15 m a little.',
    price: 'Every heal costs 20% more Herbs.',
    onCompile(rec) {
      if (rec.id === 'h_dart') {
        rec.was = rec.was || rec.name; rec.name = 'Staff Flurry'; rec.range = 3.5; rec.move = false;
        rec.hit = { t: [0.24, 0.22, 0.3][(rec.step || 1) - 1], kind: 'melee' };
        fxMul(rec, 'dmg', 1.6);
        rec.fx = [...rec.fx.filter((e) => e[0] !== 'sap'), ['healParty', 0.2, 15]];
        rec.tags = rec.tags.filter((t) => t !== 'dart' && t !== 'shot'); addTag(rec, 'strike'); addTag(rec, 'blunt');
        rec.formChoreo = ['h_sweep', 'h_flurry', 'h_uproot'][(rec.step || 1) - 1];
        return rec;
      }
      if (has(rec, 'heal') || has(rec, 'shell')) rec.cost = Math.round((rec.cost || 0) * 1.2);
      return rec;
    },
  },
  // Battle Medic (combat_design.md 5.7): every Nettle Dart that lands mends the most hurt ally within 12 m by 15% of its
  // blow; every heal costs 20% more
  battle_medic: {
    name: 'Battle Medic', cls: 'herbalist',
    desc: 'Every Nettle Dart that strikes mends the most hurt ally within 12 m for 15% of the blow.',
    price: 'Every heal costs 20% more Herbs.',
    onCompile(rec) { if ((has(rec, 'heal') || has(rec, 'shell')) && rec.id !== 'h_dart') rec.cost = Math.round((rec.cost || 0) * 1.2); return rec; },
    onHit(w, p, ctx) {
      if (ctx.sk?.id !== 'h_dart' || !w?.healAllies || !(ctx.amt > 0)) return;
      const q = w.healAllies(p, p, 12).filter((x) => x.hp < x.maxHp).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
      if (q) w.heal(p, q, ctx.amt * 0.15);
    },
  },
  // Grove Keeper (combat_design.md 5.7): every direct heal leaves a small herb patch at the ally's feet (0.1 a second for 4 s,
  // sim.js herbZone 'patch'; two at most); his healing is 15% weaker
  grove_keeper: {
    name: 'Grove Keeper', cls: 'herbalist',
    desc: 'Every direct heal of yours leaves a small patch of crushed herbs at the ally\'s feet that mends whoever stands on it 0.1 a second for 4 s (two patches at most).',
    price: 'Your healing is 15% weaker.',
    mods: { grove: 0.1, heal: -0.15 },
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
  // the Warden's Iron Skin (S9): a Brace lays an absorb over him (1.2 heals' worth, 3 s); Steam Plate: a blow blocked in
  // the Brace scalds the machine with steam from the plates (heat, 0.8x)
  iron_skin: { onDodge(w, p) { if (!w?.addBuff) return; p.absorb = (p.absorb || 0) + (p.power || 10) * 1.2; w.addBuff(p, { name: 'Iron Skin', stat: 'absorb', t: 3, dur: 3, icon: 'iron' }); } },
  steam_plate: { onBlock(w, p, ctx) { if (ctx.src && !ctx.src.dead && w?.damage) { w._zk = 'fire'; w.damage(p, ctx.src, (p.power || 10) * 0.8, 'zone'); w._zk = null; } } },
  // the Deadeye (S10): Paper Cartridges (a slide gives 10 Powder back), Smoke Charge (the slide leaves a low bank of powder
  // smoke where it began: machines in it miss 30% for 3 s); Chalk Mark is a flag the sim reads (tal.flags.chalk)
  paper_cartridges: { onDodge(w, p) { if (p.maxRes) p.res = Math.min(p.maxRes, (p.res || 0) + 10); } },
  smoke_charge: {
    onDodge(w, p) {
      if (!w?.foesOf || !p.dodgeFrom) return;
      const o = p.dodgeFrom;
      w.broadcast?.({ k: 'smokebank', x: +o.x.toFixed(2), z: +o.z.toFixed(2), r: 3 });
      for (const m of w.foesOf(p)) if (m.type === 'mob' && !m.dead && Math.hypot(m.x - o.x, m.z - o.z) <= 3 + (m.def?.radius || 1)) w.addBuff(m, { name: 'Smoke Charge', stat: 'miss', pct: 30, t: 3, dur: 3, debuff: true, icon: 'smoke' });
    },
  },
  // the Chemist's Bitter Draught (S12, the old Healing Draught): once a minute, below 30% health, he drinks a bitter remedy
  // from the belt without stopping: 2 heals' worth back (the client plays the drink, {k:'draught'})
  bitter_draught: {
    onTaken(w, p, ctx) {
      const now = w?.time || 0;
      if (p.dead || (p.bdT || 0) > now || (p.hp - ctx.amt) / p.maxHp >= 0.3) return;
      p.bdT = now + 60;
      w?.broadcast?.({ k: 'draught', id: p.id });
      w?.addBuff?.(p, { name: 'Bitter Draught', stat: 'draught', pct: 0, t: 1, dur: 1, icon: 'potion' });
      if (w?.heal) w.heal(p, p, (p.power || 10) * 2); else p.hp = Math.min(p.maxHp, p.hp + (p.power || 10) * 2);
    },
  },
  // the Sandblade's Dust Cloak (S8): after a dodge the next skill strikes critically (sim.js on_dodge gives the buff)
  dust_cloak: { onDodge(w, p) { w?.addBuff?.(p, { name: 'Dust Cloak', stat: 'cloak', pct: 0, t: 3, dur: 3, icon: 'cloak' }); } },
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

export const KEY_HOOKS = ['onCast', 'onHit', 'onLand', 'onLink', 'onKill', 'onTaken', 'onDodge', 'onBlock'];

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
