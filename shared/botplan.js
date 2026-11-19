// The bots' fusion planner (combat_design.md 8, S15): one planner for every class on the new kit, in place of the per-class
// fusing each slice added. sim.js botChooseSkill calls it after its heal and taunt logic:
//   1. a link is open (b.link) and a fusion from it is castable and helps: press B (the server fuses it as it does a
//      player's), at the bot's skill rate (one roll a link) and after its reaction time;
//   2. else one look at the class's opener table (at most 3 fusions checked): the first fusion whose A is ready, whose B
//      and own cooldown come back by the time A lands, which the bot can pay for (A + B + the extra) and whose ai.want
//      fits (state, minFoes, allyHpBelow): cast A and keep b.plan = { f, next: B, until };
//   3. while a plan waits for A's contact the bot holds its next press (the link opens on the contact).
// A coat on the machine (anyone's) is a reason to press the skill that sets it off (coat-then-trigger, every class; the
// Chemist and the Deadeye most of all, combat_design.md 8). Moving fusions (leaps, dashes, vaults) only when the landing is
// safe (moveSafe). The Skill Web builds of bots (botTree) come from shared/treeBuilds.js by persona role.
// Imports only from shared/.
import { FUSION_BY_ID, fusionUnlocked, LINK } from './fusions.js';
import { CHAIN_RESET } from './kit.js';
import { CLASSES } from './classes.js';
import { skillCost } from './talents.js';
import { TREE_BUILDS } from './treeBuilds.js';
import { pathTo, treePoints } from './treeMods.js';
import { TREE_BY_ID, TREE_START } from './tree.js';
import { houseCrosses } from './houses.js';
import { worldGap } from './terrain.js';
import { DUNGEON_MIN_X, dungeonPush } from './dungeons.js';
import { elemsOf, coatOf, reactionFor, bossy, inWindow, windowSoon } from './reactions.js';

// ------------------------------------------------------------------ the opener tables
// Per class, the fusions a bot plans for, most wanted first (single target first, then the area ones that need foes).
// A fusion's own ai.want (fusions.js) is read too; WANT adds the bots' extra conditions. Triads and parry/block fusions are
// not planned: they follow from a link the bot already has (step 1).
export const OPENERS = {
  knight: ['kf_stormfall', 'kf_pierce', 'kf_upheaval', 'kf_kingsfall', 'kf_highledger', 'kf_battering', 'kf_sidewind'],
  sandblade: ['sf_sirocco', 'sf_glasscutter', 'sf_thousand', 'sf_sandspout', 'sf_dustwhirl', 'sf_sandline', 'sf_whiteout'],
  warden: ['wf_triphammer', 'wf_faultline', 'wf_colossus', 'wf_bastion', 'wf_piledriver', 'wf_earthbreaker'],
  deadeye: ['df_broadside', 'df_platesplitter', 'df_chainshot', 'df_lastround', 'df_pointblank', 'df_recoilvault', 'df_slideshot'],
  ranger: ['rf_ridgeline', 'rf_longdraw', 'rf_ricochet', 'rf_tripwire', 'rf_cloudburst', 'rf_rolling', 'rf_highwire'],
  chemist: ['cf_thermalshock', 'cf_corrosive', 'cf_galvanic', 'cf_tarfire', 'cf_chainreaction', 'cf_flashsteam', 'cf_blastvault'],
  herbalist: ['hf_bitterroot', 'hf_barkpoultice', 'hf_thistlenet', 'hf_willowsteam', 'hf_swiftroot'],
};
// extra conditions by fusion: minFoes (machines within 6 m of the target), allyHpBelow (someone in the group under it),
// noBoss (the A's state does not take on a boss: a lift or a stun), tank (only a bot in the tank seat)
const WANT = {
  kf_highledger: { noBoss: true }, kf_upheaval: { noBoss: true }, wf_colossus: { noBoss: true }, df_platesplitter: { noBoss: true },
  kf_kingsfall: { minFoes: 1 }, sf_sandspout: { minFoes: 1 }, cf_chainreaction: { minFoes: 1 },
  hf_bitterroot: { allyHpBelow: 0.85 }, hf_barkpoultice: { allyHpBelow: 0.8 }, hf_willowsteam: { allyHpBelow: 0.75, hurtN: 2 }, hf_swiftroot: { allyHpBelow: 0.7, hurtN: 2 },
};
// the skill rate (planned fusions completed) and the added reaction time, by bot: companions 85%, volunteers 80%, living
// bots by persona.skill (35% casual to 85% skilled, reaction 0.35 to 0.05 s), anyone else 60% (b.botSkill overrides)
export function botSkill(b) {
  if (b.botSkill != null) return b.botSkill;
  if (b.mind?.persona?.skill != null) return b.mind.persona.skill;
  return b.botRole === 'Volunteer' ? 0.8 : b.owner ? 0.85 : 0.6;
}
export const botReact = (b) => (b.mind?.persona?.skill != null ? 0.05 + Math.max(0, 0.85 - b.mind.persona.skill) * 0.6 : 0);

const MOVE = new Set(['dash', 'leap', 'back']);
const moveOf = (sk) => sk?.fx?.find((e) => MOVE.has(e[0])) || null;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// a moving skill's landing is safe (combat_design.md 8): no house wall in the way, on walkable ground outdoors (worldGap, as
// botMove), not pushed by a dungeon wall, and a ranged bot's back-move keeps within 24 m of its leader
export function moveSafe(w, b, sk, tgt, lead, dodge) {
  const mv = dodge ? ['dash', dodge] : moveOf(sk);
  if (!mv) return true;
  let ux = tgt ? tgt.x - b.x : Math.sin(b.ry || 0), uz = tgt ? tgt.z - b.z : Math.cos(b.ry || 0);
  const d = Math.hypot(ux, uz) || 1; ux /= d; uz /= d;
  let L;
  if (mv[0] === 'leap') L = tgt ? { x: tgt.x - ux * 1.2, z: tgt.z - uz * 1.2 } : { x: b.x + ux * mv[1], z: b.z + uz * mv[1] };
  else if (mv[0] === 'dash') { const k = dodge ? mv[1] : Math.min(mv[1], d + 1.5); L = dodge ? { x: b.x - ux * k, z: b.z - uz * k } : { x: b.x + ux * k, z: b.z + uz * k }; }
  else L = { x: b.x - ux * mv[1], z: b.z - uz * mv[1] };
  if (tgt && mv[0] !== 'back' && !dodge && d > (mv[0] === 'leap' ? mv[1] + 3 : mv[1] + 4)) return false; // (the target is out of the move's reach)
  if (houseCrosses(b.x, b.z, L.x, L.z)) return false;
  if (b.x >= DUNGEON_MIN_X || L.x >= DUNGEON_MIN_X) { const [px, pz] = dungeonPush(L.x, L.z, 0.4); if (Math.hypot(px - L.x, pz - L.z) > 0.5) return false; }
  else if (worldGap(L.x, L.z) > -0.6 || worldGap((L.x + b.x) / 2, (L.z + b.z) / 2) > -0.6) return false;
  if (lead && lead !== b && mv[0] === 'back' && dist(L, lead) > 24) return false;
  return true;
}

const chainNext = (w, b, A) => (A.chain ? (b.chain && b.chain.id === A.id && w.time - b.chain.at <= CHAIN_RESET ? (b.chain.step % A.chain.length) + 1 : 1) : 0);
const ready = (w, b, id, t = 0) => !((b.cds[id] || 0) > w.time + t);
function inReach(w, b, sk, tgt) {
  if (!tgt) return sk.target !== 'enemy' && sk.target !== 'ground';
  const d = dist(b, tgt), r = w.rad(tgt);
  if (sk.target === 'enemy') return d <= ((sk.hit?.kind === 'cone' || sk.hit?.kind === 'line') && sk.hit.r ? Math.min(sk.range || 4, sk.hit.r - 0.4) : sk.range || 4) + r + 0.4; // (a cone or a line reaches its own length)
  if (sk.target === 'ground') return d <= (sk.range || 10);
  if (sk.target === 'ally') return true;
  if (sk.hit?.kind === 'aoe' || sk.hit?.kind === 'cone' || sk.hit?.kind === 'line') return d <= (sk.hit.r || 4) + r - 0.4;
  return true;
}
// the cast message for a skill on the bot's target, an ally (the most hurt, or the one the machine hits) or itself
function msgFor(w, b, sk, tgt, team) {
  if (sk.target === 'ally') { const q = allyFor(w, b, team, tgt); return { skill: sk.id, target: (q || b).id }; }
  if (sk.target === 'self') return { skill: sk.id };
  return { skill: sk.id, target: tgt?.id, gx: tgt?.x, gz: tgt?.z };
}
function allyFor(w, b, team, tgt) {
  const hit = tgt?.target ? team.find((q) => q.id === tgt.target && q !== b) : null;
  const hurt = team.filter((q) => !q.dead).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
  return hurt && hurt.hp / hurt.maxHp < 0.8 ? hurt : hit || hurt || null;
}
function wantOk(w, b, f, tgt, team) {
  const W = { ...(f.ai?.want || {}), ...(WANT[f.id] || {}) };
  if (W.noBoss && tgt?.def?.boss) return false;
  if (W.state === 'lifted' && tgt?.def?.boss && f.need === 'state:lifted') return false;
  if (W.minFoes) { let n = 0; for (const m of w.mobs.values()) if (!m.dead && m !== tgt && tgt && dist(m, tgt) < 6) n++; if (n < W.minFoes && !(tgt?.def?.boss)) return false; }
  if (W.allyHpBelow) { const n = team.filter((q) => !q.dead && q.hp / q.maxHp < W.allyHpBelow).length; if (n < (W.hurtN || 1)) return false; }
  return true;
}

// step 1: a fusion from the open link. Returns a cast message or null. The rate is rolled once a link (b.fuseLink)
export function linkFusion(w, b, tgt, team, lead) {
  const L = b.link;
  if (!L || !b.effFuse || L.open || w.botNoFuse) return null;
  if (w.time - (L.at || 0) < botReact(b)) return null;
  const tal = b.tal;
  for (const f of Object.values(b.effFuse)) {
    if (f.from !== L.from) continue;
    const B = b.eff?.[f.to];
    if (!B || B.lvl > b.level || !ready(w, b, B.id) || b.res < skillCost(B, tal) + (f.extra || 0)) continue;
    const t = f.target === 'enemy' ? tgt : null;
    if (f.target === 'enemy' && (!tgt || dist(b, tgt) > (f.range || 4) + w.rad(tgt) + 0.4)) continue;
    if (w.fusionOf(b, B, { target: t?.id }) !== f) continue;
    if (!moveSafe(w, b, f, t || tgt, lead)) continue;
    if (f.target === 'ally' && !allyFor(w, b, team, tgt)) continue;
    if (b.fuseLink !== L.at) { b.fuseLink = L.at; b.fuseOk = Math.random() < botSkill(b); } // (one roll a link)
    if (!b.fuseOk) return null;
    b.plan = null;
    const c = msgFor(w, b, f, t || tgt, team);
    c.skill = B.id;
    if (!c.target && tgt) { c.target = B.target === 'ally' ? c.target : tgt.id; c.gx = tgt.x; c.gz = tgt.z; } // (B plain needs its own target if the fusion does not take)
    return c;
  }
  return null;
}

// step 2: the opener. usable(sk) says the bot may press the skill now (learned, off cooldown, affordable). Returns a cast
// message for A (and sets b.plan), { dodge } for a dodge-opened fusion, or null
export function opener(w, b, tgt, team, lead) {
  if (w.botNoFuse || !b.effFuse || !tgt) return null;
  const list = OPENERS[b.cls];
  if (!list) return null;
  const tal = b.tal;
  let looked = 0;
  // (CR.6) a boss about to open (its own big telegraph lands within WINDOW.soon s): the damage fusions wait for the window
  const save = bossy(tgt) && !inWindow(tgt, w.time) && windowSoon(w, tgt);
  for (const id of list) {
    const f = b.effFuse && Object.values(b.effFuse).find((x) => x.id === id) || FUSION_BY_ID[id];
    if (!f || !fusionUnlocked(b, f) || !ready(w, b, f.id, 0.4)) continue;
    if (save && !(f.ai?.want?.allyHpBelow || WANT[f.id]?.allyHpBelow)) continue;
    const B = b.eff?.[f.to];
    if (!B || B.lvl > b.level) continue;
    const dodge = f.from === 'dodge';
    const A = dodge ? null : b.eff?.[f.from];
    if (!dodge && (!A || A.lvl > b.level || !ready(w, b, A.id))) continue;
    if (looked++ >= 3) break; // (at most 3 fusion lookups a decision)
    const lead0 = dodge ? 0.3 : (A.hit?.t || 0.3) + 0.3;
    if (!ready(w, b, B.id, lead0)) continue;
    const costA = dodge ? 0 : skillCost(A, tal), cost = costA + skillCost(B, tal) + (f.extra || 0);
    if (b.res < cost) continue;
    if (!wantOk(w, b, f, tgt, team)) continue;
    if (dodge) {
      if ((b.dodgeN ?? 1) < 1 || dist(b, tgt) > (f.range || 6) + w.rad(tgt)) continue;
      const D = 3;
      if (!moveSafe(w, b, null, tgt, lead, D)) continue;
      const d = dist(b, tgt) || 1;
      b.plan = { f: f.id, next: f.to, from: 'dodge', at: w.time, until: w.time + 0.9 };
      const side = (b.ai?.side || 1), ux = (tgt.x - b.x) / d, uz = (tgt.z - b.z) / d;
      return { dodge: CLASSES[b.cls]?.ranged ? { dx: -ux, dz: -uz } : { dx: uz * side, dz: -ux * side } }; // (a melee bot rolls to the side and stays in reach; a ranged one back)
    }
    if (f.step && chainNext(w, b, A) !== f.step) { if (inReach(w, b, A, tgt)) return msgFor(w, b, A, tgt, team); continue; } // (press the chain on towards the step)
    if (!inReach(w, b, A, tgt)) continue;
    if (!moveSafe(w, b, A, tgt, lead) || !moveSafe(w, b, f, tgt, lead)) continue;
    if (!moveOf(A) && f.target === 'enemy' && dist(b, tgt) > (f.range || 4) + w.rad(tgt) + 0.4) continue;
    const fly = A.hit?.kind === 'proj' && A.hit.speed ? dist(b, tgt) / A.hit.speed : 0;
    b.plan = { f: f.id, next: f.to, from: f.from, at: w.time, until: w.time + (A.hit?.t || 0.3) + fly + LINK.win * 0.6 };
    return msgFor(w, b, A, tgt, team);
  }
  return null;
}

// step 3: a plan waits for A's contact (the link opens then): hold the next press
export function planWait(w, b) {
  const P = b.plan;
  if (!P) return false;
  if ((b.cds[P.f] || 0) > w.time) { b.plan = null; return false; } // (the fusion went off)
  if (P.from !== 'dodge' && !(b.cast?.sk?.id === P.from || (b.cds[P.from] || 0) > w.time || (b.chain?.id === P.from && b.chain.at >= P.at - 1e-6) || (b.link?.from === P.from))) { b.plan = null; return false; } // (A never went: refused)
  if (P.from === 'dodge' && w.time > P.at + 0.1 && (!((b.dodgeAt ?? -1) >= P.at - 1e-6) || b.link?.from !== 'dodge')) { b.plan = null; return false; } // (the dodge did not go off, or its link is spent)
  if (w.time > P.until || (b.link && b.link.from === P.from)) { if (w.time > P.until) b.plan = null; return false; }
  return true;
}

// the skills a plan keeps back: the B of every opener whose A and own cooldown come back within KEEP s (pressing B plain
// wastes the fusion)
const KEEP = 3;
export function reservedB(w, b) {
  const out = new Set();
  if (w.botNoFuse || !b.effFuse) return out;
  for (const id of OPENERS[b.cls] || []) {
    const f = FUSION_BY_ID[id];
    if (!f || f.from === 'dodge' || !fusionUnlocked(b, f) || !ready(w, b, f.id, KEEP)) continue;
    const A = b.eff?.[f.from];
    const B = b.eff?.[f.to];
    if (A && B && !A.chain && !B.chain && B.cd && ready(w, b, A.id, KEEP)) out.add(f.to); // (never the free chain: it is the filler)
  }
  return out;
}

// coat-then-trigger: a coat on the machine is set off by a skill of the right kind (heat on Tarred, blunt or blast on
// Chilled, spark on Corroded): the attack that triggers it scores higher; a coat skill is pressed first when the bot holds a
// trigger that is ready (Chemist, Deadeye and every class with both)
export function coatScore(tgt, sk) {
  if (!tgt?.buffs?.length) return 0;
  const el = elemsOf(sk);
  if (!el?.length) return 0;
  for (const c of tgt.buffs) if (c.coat && c.t > 0 && reactionFor(c.coat, el)) return 1;
  return 0;
}
export function coatFirst(tgt, attacks) {
  if (!tgt || tgt.buffs?.some((c) => c.coat && c.t > 0)) return null;
  for (const s of attacks) {
    const k = coatOf(s);
    if (!k) continue;
    if (attacks.some((t) => t !== s && reactionFor(k, elemsOf(t) || []))) return s;
  }
  return null;
}

// ------------------------------------------------------------------ Skill Web builds for bots
// Three suggested paths per class (treeBuilds.js) read as the bots' role lists: damage, defence or support, mixed. The bot's
// tree is the first treePoints(level) nodes of its list (pathTo fills the roads), then small nodes next to what it holds.
// Keystones a bot cannot play (they re-key its skills or swap its resource) are left out.
export const BOT_BUILDS = {
  knight: { damage: 'skyfall', defence: 'line', mixed: 'blade' },
  warden: { damage: 'quake', defence: 'wall', mixed: 'forge' },
  sandblade: { damage: 'blade', defence: 'duel', mixed: 'storm' },
  ranger: { damage: 'run', defence: 'traps', mixed: 'traps' },
  deadeye: { damage: 'run', defence: 'storm', mixed: 'storm' },
  chemist: { damage: 'board', defence: 'reactions', mixed: 'reactions' },
  herbalist: { damage: 'brawler', defence: 'mender', mixed: 'smoke' },
};
const BOT_SKIP = new Set(['one_arrow', 'six_chambers', 'bench_chemist', 'cold_chemistry', 'restless', 'never_still']);
const cache = new Map();
export function botTree(cls, build, level) {
  const key = cls + ':' + build + ':' + level;
  if (cache.has(key)) return cache.get(key);
  const pts = treePoints(level, {}), alloc = {};
  const B = (TREE_BUILDS[cls] || []).find((x) => x.id === build) || (TREE_BUILDS[cls] || [])[0];
  if (B && TREE_START[cls]) {
    // (buildSteps' walk, with the keystones a bot cannot play left out of the list and off the roads)
    let n = 0;
    for (const id of B.want) {
      if (BOT_SKIP.has(id) || !TREE_BY_ID[id] || alloc[id]) continue;
      const road = pathTo(cls, alloc, id);
      if (!road || n + road.length > pts || road.some((k) => BOT_SKIP.has(k))) continue;
      for (const k of road) { alloc[k] = 1; n++; }
    }
    for (let grow = true; grow && Object.keys(alloc).length < pts;) {
      grow = false;
      for (const id of [TREE_START[cls], ...Object.keys(alloc)]) for (const a of TREE_BY_ID[id]?.adj || []) if (Object.keys(alloc).length < pts && !alloc[a] && TREE_BY_ID[a].kind === 'small') { alloc[a] = 1; grow = true; }
    }
  }
  cache.set(key, alloc);
  return alloc;
}
// the build a bot plays: its own (b.botBuild: a living bot's persona), else by its seat (a tank companion or volunteer:
// defence; a healer: defence, which is the support list; the rest: damage)
export function botBuildOf(b) {
  const T = BOT_BUILDS[b.cls];
  if (!T) return null;
  if (b.botBuild && T[b.botBuild]) return T[b.botBuild]; // (a persona's build: damage, defence or mixed)
  if (b.botBuild && Object.values(T).includes(b.botBuild)) return b.botBuild;
  const role = b.cls === 'knight' || b.cls === 'warden' || b.cls === 'herbalist' ? 'defence' : 'damage';
  return T[role];
}
