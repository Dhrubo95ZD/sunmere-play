// Fusions (combat_design.md sections 3 and 5, stage S2): when skill A lands, a link window opens; skill B pressed in it
// casts the fusion A>B, a new named move with its own rules. Fusions and triads are ordinary skill records with from, to,
// need, lvl or tree, carry, ai and tier. FUSE[cls]['a>b'] finds one. compileKit(p) builds p.eff (every skill a player can
// cast, by id) and p.effFuse (its fusions by pair); the sim, the bar, tooltips and bots read those, not SKILL_BY_ID.
// Choreography: each fusion names its clip (choreo); S4 gave Stormfall, Battering Line, Turning Riposte, Sidewind Cut and
// Anvil Fall their own DEFs on the authored hero clips (client/game/choreo.js, 'ual'); the rest still name an existing one.
// Imports only from shared/.
import { SKILLS, SKILL_BY_ID } from './classes.js';
import { KIT_V2, CORE, CORE_BY_ID, DODGES } from './kit.js';

export const LINK = { win: 1.0, afterLock: 0.25, tick: 0.05, grace: 0.15 }; // window from contact; never shorter than the lock + 0.25 s; one tick of grace; 0.15 s for a claimed chain
export const MASTERY = [25, 100, 300]; // landed uses for ranks I, II, III (a Book badge; III adds the extra beat)
export const DISCOVER_XP = 0.05; // of a level, for the first cast of a fusion
export const DUEL_FUSE = 0.8; // fusion damage on a player in a duel, on top of DUEL.scale (combat_design.md section 8)

// power (section 9, adversarial review 18 Nov): a fusion and its A together deal about 1.35x A + B cast plain, the aerial
// bonus counted on a lifted machine (Stormfall 2.3 x air 1.4, High Ledger 3 x 0.5 x 1.5). The first numbers (Stormfall
// 3.0, High Ledger 3 x 0.9, Kingsfall 3 x 1.4) left --nofusion at 57-65% of full damage against the 75-85% target
const F = (id, name, o) => ({ id, name, gcd: true, cast: 0, cost: 0, cd: 0, range: 4, target: 'enemy', kit: 2, extra: 0, tier: 4, ...o });

// gate words for the Book ('Rising Cut must lift the foe'); a fusion may say its own
export const GATES = {
  hit: (a) => `${a} must strike a machine`,
  done: (a) => `${a} must take effect`,
  parry: (a) => `${a} must parry a blow`,
  dodge: () => 'Come out of a dodge',
  'state:lifted': (a) => `${a} must leave the machine in the air`,
  'state:staggered': (a) => `${a} must stagger or stun the machine`,
};

export const FUSIONS = {
  knight: [
    F('kf_stormfall', 'Stormfall', { cls: 'knight', icon: 'leap', from: 'k_rising', to: 'k_skybreaker', lvl: 5, need: 'hit', cd: 14, extra: 10, range: 9,
      hit: { t: 0.72, kind: 'aoe', r: 4.5 }, fx: [['leap', 6], ['dmg', 2.3], ['air', 1.4], ['slamDown', 0.6], ['brk', 60], ['slow', 40, 3]], // (S5: the plunge slams the machine down, a 0.3 m bounce, and it lies stunned 0.6 s; it no longer hangs 1.4 s over the crater)
      tags: ['air', 'slam', 'fusion'], cam: 'lift', choreo: 'kf_stormfall', gateText: 'Rising Cut must lift the foe', hint: 'Something rises, then something falls.',
      carry: { a: { aloft: { hang: 0.3, airMul: 0.25 }, gale: { allLifted: true } }, b: { higharc: { leap: 10, r: 1.3 } } }, ai: { role: 'burst', want: { state: 'lifted' } },
      desc: 'Vault straight up past the lifted machine, hang at the top and drive down through it into the ground.' }),
    F('kf_highledger', 'High Ledger', { cls: 'knight', icon: 'twin', from: 'k_rising', to: 'k_valiant', lvl: 7, need: 'state:lifted', cd: 10, extra: 10,
      hit: { t: 0.24, kind: 'melee', n: 3, gap: 0.26 }, fx: [['dmg', 0.5], ['air', 1.5], ['brk', 8], ['holdLift', 0.35]], fxLast: [['holdLift', 0.6]], tiers: [1, 1, 3], // (each cut keeps the machine up, review 18 Nov: Rising Cut's 1.0 s lift ran out before the third; S5: three T1 sparks, then a T3 with the camera kicked up, no slam)
      tags: ['air', 'fusion'], choreo: 'kf_highledger', hint: 'What is in the air can be cut again.', ai: { role: 'burst', want: { state: 'lifted' } },
      desc: 'Follow the machine up with three cuts in the air; the last keeps it aloft.' }),
    F('kf_kingsfall', 'Kingsfall', { cls: 'knight', icon: 'crown', from: 'k_cleave', to: 'k_skybreaker', lvl: 9, need: 'hit', cd: 16, extra: 10, range: 10,
      hit: { t: 0.32, kind: 'aoe', r: 5, n: 3, gap: 0.42 }, fx: [['dmg', 0.85], ['brk', 12]], fxLast: [['brk', 50], ['knock', 2]], tiers: [2, 2, 4], // (S5: cut 1 T2, cut 2 T2, the slam T4)
      tags: ['leap', 'slam', 'fusion'], choreo: 'kf_kingsfall', hint: 'A wide cut, then come down on what is left.', ai: { role: 'aoe' },
      desc: 'Two wide cuts, then a leaping slam on the shield rim that knocks machines back.' }),
    F('kf_pierce', 'Pierce the Line', { cls: 'knight', icon: 'thrust', from: 'k_valiant', to: 'k_lunge', lvl: 11, need: 'hit', step: 3, cd: 12, extra: 5, range: 10,
      hit: { t: 0.32, kind: 'line', r: 9 }, fx: [['dash', 7], ['dmg', 1.8], ['debuff', 'armor', 20, 8], ['brk', 15]],
      tags: ['line', 'fusion'], choreo: 'kf_pierce', gateText: 'The third step of Valiant Strike must land', hint: 'Finish the chain, then go through them.', ai: { role: 'line' },
      desc: 'A thrust through every machine on a 9 m line, opening their plating; you end behind them.' }),
    F('kf_battering', 'Battering Line', { cls: 'knight', icon: 'charge', from: 'k_lunge', to: 'k_bash', lvl: 13, need: 'hit', cd: 14, extra: 5,
      hit: { t: 0.28, kind: 'melee' }, fx: [['dash', 3], ['dmg', 1.3], ['knock', 4], ['wallSlam', 2], ['brk', 45]], // (dash 3, S5: the Knight runs on behind the machine he carries, so his own move never interrupts it)
      tags: ['dash', 'fusion'], choreo: 'kf_battering', hint: 'Keep running, shield first.', ai: { role: 'control' },
      desc: 'The lunge runs on shield-first and carries the machine; into a wall or another machine, it is pinned.' }),
    F('kf_upheaval', 'Upheaval', { cls: 'knight', icon: 'rise', from: 'k_bash', to: 'k_rising', lvl: 16, need: 'state:staggered', cd: 12, extra: 5,
      hit: { t: 0.3, kind: 'melee' }, fx: [['dmg', 2.0], ['launch', 1.4], ['brk', 40]], liftH: 2.6, // (2.6 m up, S5: it read weakly at 2.3)
      tags: ['lift', 'fusion'], choreo: 'kf_upheaval', hint: 'A machine that cannot stand can be lifted.', ai: { role: 'control', want: { state: 'staggered' } },
      desc: 'Scoop the shield rim under the stunned machine and drive it up into the air.' }),
    F('kf_riposte', 'Turning Riposte', { cls: 'knight', icon: 'parry', from: 'k_guard', to: 'k_cleave', tree: 'riposte_drill', need: 'parry', cd: 12, target: 'self', range: 0,
      hit: { t: 0.35, kind: 'aoe', r: 4.5 }, fx: [['dmg', 1.8], ['parryBack', 0.5], ['taunt', 3], ['res', 20], ['brk', 30]],
      tags: ['sweep', 'spin', 'taunt', 'fusion'], choreo: 'kf_riposte', hint: 'Turn their blow into your swing.', ai: { role: 'tank' },
      desc: 'Answer a parry with a turning cut around you that adds half the blow you blocked and turns every machine on you.' }),
    F('kf_sidewind', 'Sidewind Cut', { cls: 'knight', icon: 'spin', from: 'dodge', to: 'k_valiant', tree: 'rolling_edge', need: 'dodge', cd: 8, extra: 5, target: 'self', range: 0,
      hit: { t: 0.35, kind: 'aoe', r: 4.5 }, fx: [['dmg', 1.1], ['brk', 20], ['knock', 1.5]], // (knock 1.5, S5: the cut throws machines back a step, so it reads; before it only flinched them)
      tags: ['spin', 'fusion'], choreo: 'kf_sidewind', hint: 'Come up out of the roll swinging.', ai: { role: 'aoe' },
      desc: 'The roll comes up into a wide turning cut.' }),
    // the triad (a deep tree notable): Stormfall > Shield Bash
    F('kt_anvilfall', 'Anvil Fall', { cls: 'knight', icon: 'disc', from: 'kf_stormfall', to: 'k_bash', tree: 'three_heights', need: 'hit', triad: true, cd: 50, extra: 10, range: 20,
      hit: { t: 0.53, kind: 'proj', speed: 26 }, fx: [['dmg', 2.4], ['ricochet', 2, 8], ['brk', 120], ['slow', 40, 4]],
      tags: ['shield', 'throw', 'triad'], tier: 5, choreo: 'kt_anvilfall', // (hit 0.53, S5: the shield leaves the hand at 0.4 s and lands about 0.13 s later; the damage at 0.38 came first and the machine waited) hint: 'From the crater, the shield has one more fall in it.', ai: { role: 'burst' },
      desc: 'From the crater, bounce the shield off the ground into the slammed machine; it strikes two more and returns.' }),
  ],
};

export const FUSE = {}; // cls -> 'a>b' -> fusion
export const FUSION_BY_ID = {};
const tagsOf = (id) => (CORE_BY_ID[id]?.tags || FUSION_BY_ID[id]?.tags || []);
for (const [cls, list] of Object.entries(FUSIONS)) {
  FUSE[cls] = {};
  for (const f of list) {
    f.key = f.from + '>' + f.to;
    const B = CORE_BY_ID[f.to];
    f.cost = (B?.cost || 0) + (f.extra || 0); // (B's cost + its own extra; the sim adds B's cost with its modifiers)
    FUSION_BY_ID[f.id] = f; FUSE[cls][f.key] = f;
  }
  // (a triad takes B's tags and its own, not its A fusion's: Anvil Fall is a shield throw, and Stormfall's leap tag gave it
  // Iron Comet's range and Hard Landing's poise and radius; S5)
  for (const f of list) f.tags = [...new Set([...(f.triad ? [] : tagsOf(f.from)), ...tagsOf(f.to), ...f.tags])];
}

// a skill record by id: the new kit (core skills, chain steps' first record, fusions) for a class on KIT_V2, else the legacy one
export const skillOf = (id) => {
  const k = CORE_BY_ID[id] || FUSION_BY_ID[id];
  if (k && KIT_V2[k.cls]) return k;
  return SKILL_BY_ID[id] || k || null;
};
export const nameOf = (id, cls) => (id === 'dodge' ? DODGES[cls]?.name || 'Dodge' : skillOf(id)?.name || id);

// both inputs learned, and the fusion's level reached or its tree notable taken (p.tree, S3)
export function fusionUnlocked(p, f) {
  if (!f || !p) return false;
  const learned = (id) => id === 'dodge' || (FUSION_BY_ID[id] ? fusionUnlocked(p, FUSION_BY_ID[id]) : (CORE_BY_ID[id]?.lvl ?? 99) <= p.level);
  return learned(f.from) && learned(f.to) && (f.tree ? !!p.tree?.[f.tree] : p.level >= (f.lvl || 1));
}

// p.eff and p.effFuse (section 3.3), rebuilt where p.tal is rebuilt (recalc). Order: base skill, Form patch, fusion record
// with its carry bits, keystone patches over tags, number modifiers. S2 has the base and fusion records; Forms, carry and
// keystones come with the tree (S3) and patch here; number modifiers stay in p.tal (skillCost, skillCd, damage)
export function compileKit(p) {
  const eff = {}, effFuse = {};
  if (KIT_V2[p.cls]) {
    for (const s of CORE[p.cls] || []) eff[s.id] = s;
    for (const f of FUSIONS[p.cls] || []) { eff[f.id] = f; effFuse[f.key] = f; }
  } else for (const s of SKILLS[p.cls] || []) eff[s.id] = s;
  p.eff = eff; p.effFuse = effFuse;
  return p;
}

export const masteryRank = (n) => MASTERY.reduce((r, need) => (n >= need ? r + 1 : r), 0);

// does a link's gate hold? L: p.link; tgt: the fusion's target (for state gates); opening: the hero holds Opening
// (it satisfies hit and done, not parry). isState(tgt, name) is the sim's or the client's own check
export function gateOk(f, L, tgt, opening, isState) {
  const need = f.need || 'hit';
  if (f.step && L.step !== f.step) return false;
  if (need === 'hit') return !!(L.landed || opening);
  if (need === 'done') return !!(L.done || L.landed || opening);
  if (need === 'parry') return !!L.parried;
  if (need === 'dodge') return L.from === 'dodge';
  if (need.startsWith('state:')) return !!(L.landed || opening) && !!tgt && isState(tgt, need.slice(6));
  return false;
}

// the Fusion Book (section 4.5; the screen is S6): every fusion and the triad of a class with its inputs, gate in plain
// words, hint, numbers, whether it is known (discovered), unlocked, its uses and mastery rank. The triad shows once its
// notable is taken; unknown entries show their hint only
export function fusionBook(cls, p = {}) {
  const known = new Set(p.fusions || []), uses = p.fmastery || {};
  return (FUSIONS[cls] || []).map((f) => {
    const unlocked = fusionUnlocked(p, f), a = nameOf(f.from, cls), n = uses[f.id] || 0;
    return { id: f.id, name: f.name, icon: f.icon, from: f.from, to: f.to, fromName: a, toName: nameOf(f.to, cls), need: f.need, gate: f.gateText || (GATES[f.need] || GATES.hit)(a), hint: f.hint || '',
      lvl: f.lvl || null, tree: f.tree || null, triad: !!f.triad, cost: f.cost, cd: f.cd, desc: f.desc, known: known.has(f.id), unlocked, uses: n, rank: masteryRank(n), show: !f.triad || unlocked };
  });
}
