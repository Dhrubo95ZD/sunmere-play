// The new class kits (combat_design.md sections 3.1 and 5, stage S2): per class seven core skills and a dodge, in the same
// S() grammar as classes.js plus tags, win, tier and steps. A class plays this kit when its KIT_V2 switch is on (section
// 11); every other class keeps its 30 skills from classes.js (LEGACY_SKILLS) until its own slice (S8-S13).
// Ids that survive from today's kit keep their id, so choreo.js, cooldown slots and talents keyed by id carry over; the
// sim reads a player's compiled records (p.eff, shared/fusions.js compileKit), never SKILL_BY_ID, for a class on KIT_V2.
// Hit times match the existing choreography for now (S4 gives the authored clips, S5 the beats).
// Imports only from shared/.
import { SKILLS } from './classes.js';

// classes on the new kit. Knight first (the pilot slice); the old path goes at S16
export const KIT_V2 = { knight: true };
export const onKit2 = (cls) => !!KIT_V2[cls];

const K = (id, name, o) => ({ id, name, gcd: true, cast: 0, cost: 15, cd: 0, range: 4, target: 'enemy', kit: 2, ...o });

// the basic chain (section 2.3): steps of one skill, each its own record (contact, lock, tier); chain steps 1-2 never
// open a link, the last does. The chain resets after CHAIN_RESET s without a step
export const CHAIN_RESET = 1.2;
const chain = (base, steps) => {
  const list = steps.map((s, i) => ({ ...base, ...s, step: i + 1, steps: steps.length, fx: s.fx, win: { ...(base.win || {}), ...(s.win || {}) }, tags: [...base.tags, ...(i === steps.length - 1 ? ['finisher'] : [])] }));
  for (const s of list) s.chain = list;
  return list[0];
};

export const CORE = {
  knight: [
    chain(K('k_valiant', 'Valiant Strike', { icon: 'slash', slot: 1, lvl: 1, cost: 0, cd: 0, hit: { t: 0.34, kind: 'melee' }, tags: ['strike', 'blade', 'chain'], desc: 'A three-step chain: a diagonal cut, a return cut and a stepping overhead. Costs nothing and builds Valor.' }), [
      { fx: [['dmg', 0.8], ['brk', 4], ['res', 6]], win: { lock: 0.42 }, tier: 1 },
      { fx: [['dmg', 0.8], ['brk', 4], ['res', 6]], win: { lock: 0.42 }, tier: 1 },
      { fx: [['dmg', 1.4], ['brk', 10], ['res', 10]], win: { lock: 0.6 }, tier: 2 },
    ]),
    K('k_rising', 'Rising Cut', { icon: 'rise', slot: 2, lvl: 1, cost: 15, cd: 6, hit: { t: 0.3, kind: 'melee' }, fx: [['dmg', 1.2], ['launch', 1.0], ['brk', 20]], tags: ['strike', 'blade', 'lift'], tier: 2, desc: 'A low-to-high cut that lifts the machine off the ground.' }),
    K('k_skybreaker', 'Skybreaker', { icon: 'leap', slot: 3, lvl: 3, cost: 30, cd: 12, range: 12, hit: { t: 0.72, kind: 'aoe', r: 4 }, fx: [['leap', 9], ['dmg', 1.6], ['slow', 30, 3], ['brk', 25]], tags: ['strike', 'blade', 'leap', 'slam'], tier: 2, desc: 'Leap to the target and bring the blade down, slowing everything nearby.' }),
    K('k_bash', 'Shield Bash', { icon: 'shield', slot: 4, lvl: 5, cost: 15, cd: 8, hit: { t: 0.28, kind: 'melee' }, fx: [['dmg', 0.6], ['stun', 1.5], ['brk', 35]], tags: ['shield', 'blunt', 'cc'], tier: 2, desc: 'Drive the shield in, stunning the machine.' }),
    K('k_cleave', 'Cleaving Arc', { icon: 'arc', slot: 5, lvl: 8, cost: 20, cd: 6, hit: { t: 0.4, kind: 'cone', r: 4.5, cone: 160 }, fx: [['dmg', 0.9], ['brk', 12]], tags: ['strike', 'blade', 'sweep'], tier: 2, desc: 'A broad sweep that strikes every machine in front.' }),
    K('k_lunge', 'Lunge', { icon: 'thrust', slot: 6, lvl: 11, cost: 15, cd: 9, range: 10, hit: { t: 0.32, kind: 'melee' }, fx: [['dash', 7], ['dmg', 1.2], ['brk', 15]], tags: ['strike', 'blade', 'dash'], tier: 2, desc: 'Close 7 m with a piercing thrust.' }),
    K('k_guard', 'Guard', { icon: 'stance', slot: 7, lvl: 14, cost: 10, cd: 10, target: 'self', range: 0, hit: { t: 0.3, kind: 'self' }, fx: [['buff', 'armor', 60, 1.0], ['parry', 0.25]], tags: ['shield', 'guard'], tier: 2, desc: 'Shield up for 1 s, taking 60% less. A blow in the first 0.25 s is parried: the attacker staggers and you gain 20 Valor.' }),
  ],
};
// the dodge (feel.js DODGE does the move): it counts as an input, and always as landed (gate 'dodge')
export const DODGES = { knight: { id: 'dodge', name: 'Shoulder Roll', icon: 'evade', tags: ['dash'] } };
export const PARRY = { res: 20, stagger: 1.2 }; // a parry: Valor back and the attacker Staggered

export const CORE_BY_ID = {};
for (const [cls, list] of Object.entries(CORE)) for (const s of list) { for (const r of s.chain || [s]) r.cls = cls; CORE_BY_ID[s.id] = s; }

// the bar of a class: the new kit when its switch is on, else the 30 legacy skills
export const kitOf = (cls) => (KIT_V2[cls] ? CORE[cls] : SKILLS[cls]) || [];
export const kitForLevel = (cls, level) => kitOf(cls).filter((s) => s.lvl <= level);
// a chain skill's record for a step (1-based); any other skill is itself
export const stepOf = (sk, step) => (sk?.chain ? sk.chain[Math.max(0, Math.min(sk.chain.length, step) - 1)] : sk);
