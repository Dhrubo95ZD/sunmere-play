// What is left of the old talents (the three-path talent trees and their screen went at S16; the Skill Web, shared/tree.js
// and treeMods.js, replaced them). A modifier table has these kinds (values as fractions):
//   dmg hp armor haste crit critDmg heal regen speed leech thorns cost dot aoe execute opener killRes dodge cdr threat ccDur absorb
//   sk: { [skillId]: { pow, cd, cost } }  one skill: potency (damage and healing), cooldown seconds off, resource off
//   lastStand (no value): once every 2 minutes a killing blow leaves you at 30% health instead
// Old saves keep a `talents` map ({ id: ranks }) until they load once: sim.js join refunds it (totalSpent counts it for the
// trainer's letter and the achievements) and the points come back as Web points.
import { CORE } from './kit.js';
import { FUSIONS } from './fusions.js';

// an empty modifier table: a bot off the Web (and anything that has no p.tal yet) fights on its plain kit
export function baseMods() {
  return { dmg: 0, hp: 0, armor: 0, haste: 0, crit: 0, critDmg: 0, heal: 0, regen: 0, speed: 0, leech: 0, thorns: 0, cost: 0, dot: 0, aoe: 0, execute: 0, opener: 0, killRes: 0, dodge: 0, cdr: 0, threat: 0, ccDur: 0, absorb: 0, lastStand: 0, sk: {} };
}
// the ranks in an old save's talent map
export function totalSpent(talents) { let n = 0; for (const r of Object.values(talents || {})) n += Number(r) || 0; return n; }

// human-readable effect text for tooltips
const SK_NAME = {};
for (const list of [...Object.values(CORE), ...Object.values(FUSIONS)]) for (const s of list) SK_NAME[s.id] = s.name;
const PCT = (v) => `${Math.round(v * 100)}%`;
export function describeEffect(e, r = 1) {
  if (e[0] === 'sk') {
    const n = SK_NAME[e[1]] || e[1];
    if (e[2] === 'pow') return `${n} is ${PCT(e[3] * r)} stronger`;
    if (e[2] === 'cd') return `${n} cooldown ${+(e[3] * r).toFixed(1)}s shorter`;
    return `${n} costs ${e[3] * r} less`;
  }
  const v = e[1] * r;
  switch (e[0]) {
    case 'dmg': return `${PCT(v)} more damage`;
    case 'hp': return `${PCT(v)} more maximum health`;
    case 'armor': return `${PCT(v)} less damage taken`;
    case 'haste': return `${PCT(v)} haste`;
    case 'crit': return `${PCT(v)} critical strike chance`;
    case 'critDmg': return `critical strikes deal ${PCT(v)} more`;
    case 'heal': return `${PCT(v)} more healing`;
    case 'regen': return `${PCT(v)} faster resource regeneration`;
    case 'speed': return `${PCT(v)} faster movement`;
    case 'leech': return `${PCT(v)} of damage dealt heals you`;
    case 'thorns': return `attackers take ${PCT(v)} of the damage they deal`;
    case 'cost': return `skills cost ${PCT(v)} less`;
    case 'dot': return `${PCT(v)} stronger effects over time`;
    case 'aoe': return `${PCT(v)} more damage with area skills`;
    case 'execute': return `${PCT(v)} more damage to targets below 35% health`;
    case 'opener': return `${PCT(v)} more damage to targets above 90% health`;
    case 'killRes': return `restore ${v} resource on each kill`;
    case 'dodge': return `${PCT(v)} chance to dodge attacks`;
    case 'cdr': return `${PCT(v)} shorter cooldowns`;
    case 'threat': return `${PCT(v)} more threat`;
    case 'ccDur': return `stuns and roots last ${PCT(v)} longer`;
    case 'absorb': return `${PCT(v)} stronger shields`;
    case 'lastStand': return 'once every 2 minutes, a killing blow leaves you at 30% health instead';
  }
  return e[0];
}

// resource cost and cooldown of a skill after the modifier table (used by the server and by the client's prediction)
export function skillCost(sk, mods) { const t = mods?.sk[sk.id]; return Math.max(0, Math.round(sk.cost * (1 - (mods?.cost || 0)) - (t?.cost || 0))); }
export function skillCd(sk, mods) { const t = mods?.sk[sk.id]; return sk.cd ? Math.max(1, sk.cd * (1 - (mods?.cdr || 0)) - (t?.cd || 0)) : 0; }
