// The Armory: every named piece of gear in the valley, grouped the way a collector would shelve it, and where each one
// comes from. A character's finds live in the achievement counters ('found:<item id>', and 'found' for the total), so they
// are saved, sent and credited to older characters exactly like every other counter.
//
// Built once from the game data, so new items join the Armory on their own: legendaries, dungeon sets, the gear named
// bosses and rare elites carry, quest rewards (by the region of the person who gives the quest), quartermaster stores,
// and whatever is crafted or salvaged. Every source line names each way to get the piece, each foe with its own place.
import { ITEMS, QUESTS, NPCS, MOBS, SPAWNS, LOOT_TABLES, SETS, REP_SHOP, REP_RANKS, FACTIONS, RECIPES, STATION_NAME, LEGENDARIES, SALVAGE, DRAGONSLAYER, DS_NORMAL_CHANCE, DRAGONSLAYER_ARMOUR, DSA_SOURCE, DSA_HEROIC_CHANCE, DSA_NORMAL_CHANCE, DS_BOSS } from './data.js';
import { zoneAt, ZONES } from './terrain.js';
import { DUNGEON_BY_ID } from './dungeons.js';
import { CLASSES } from './classes.js';

const GEAR_SLOTS = ['weapon', 'offhand', 'head', 'shoulders', 'chest', 'back', 'hands', 'legs', 'feet', 'trinket'];
const isGear = (id) => !!(ITEMS[id]?.stats && GEAR_SLOTS.includes(ITEMS[id].slot));
const npcName = (id) => NPCS.find((n) => n.id === id)?.name || id;
const npcZone = (id) => { const n = NPCS.find((x) => x.id === id); return n ? zoneAt(n.x, n.z) : null; };
// "A", "A and B", "A, B and C"
export const joinAnd = (list) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
const lvlOf = (k) => MOBS[k]?.lvl?.[0] || 0;
const zoneLevel = (zid) => parseInt(String(ZONES.find((z) => z.id === zid)?.level || '0'), 10) || 0;
const placesOf = (k) => SPAWNS.filter((s) => s.mob === k);
// where a foe is met: its dungeon, its region, or for a roamer the road it travels ("in X" / "on the road from X to Y")
const mobPlace = (k) => {
  const sp = placesOf(k)[0];
  if (!sp) return null;
  if (sp.dungeon) return { name: DUNGEON_BY_ID[sp.dungeon]?.name || '', on: false };
  if (sp.path && sp.path.length > 2) {
    const names = [...new Set(sp.path.map(([x, z]) => zoneAt(x, z).name))];
    if (names.length > 1) return { name: `the road from ${names[0]} to ${names[names.length - 1]}`, on: true };
    return { name: names[0], on: false };
  }
  const [x, z] = sp.path ? sp.path[0] : [sp.x, sp.z];
  return { name: zoneAt(x, z).name, on: false };
};
const mobWhere = (k) => mobPlace(k)?.name || '';
const atPlace = (k) => { const P = mobPlace(k); return P?.name ? `${P.on ? 'on' : 'in'} ${P.name}` : ''; };
const mobTag = (k) => { const m = MOBS[k]; return m.world ? 'world boss' : m.boss ? 'final boss' : m.rare ? 'rare elite' : m.elite ? 'elite' : ''; };
// "The Weighbridge and The Appraiser in The Concord Strongrooms", or each with its own place when they differ
const foesLine = (mobs) => {
  const byPlace = new Map();
  for (const k of [...mobs].sort((a, b) => lvlOf(a) - lvlOf(b))) { const w = atPlace(k); if (!byPlace.has(w)) byPlace.set(w, []); byPlace.get(w).push(MOBS[k].name); }
  return [...byPlace].map(([w, names]) => `${joinAnd(names)}${w ? ' ' + w : ''}`).join('; ');
};

// item -> the foes whose loot tables carry it (the gear itself, never random rolls)
const dropsBy = {};
for (const [k, m] of Object.entries(MOBS)) {
  const T = LOOT_TABLES[m.loot];
  if (!T) continue;
  for (const [id] of T.items) if (isGear(id)) (dropsBy[id] ||= []).includes(k) || dropsBy[id].push(k);
}
// item -> every quest that gives it
const rewardOf = {};
for (const [qid, Q] of Object.entries(QUESTS)) for (const r of Q.rewards || []) if (isGear(r)) (rewardOf[r] ||= []).push(qid);
const repOf = {};
for (const [f, list] of Object.entries(REP_SHOP)) for (const s of list) if (isGear(s.item)) repOf[s.item] = { f, rank: s.rank };
const craftOf = {};
for (const r of RECIPES) if (isGear(r.makes)) craftOf[r.makes] = r;
const salvageOf = {};
for (const [water, list] of Object.entries(SALVAGE)) for (const [id] of list) if (isGear(id)) salvageOf[id] = water;

export const ARMORY = []; // [{ id, name, groups: [{ name, items: [item ids] }] }]
export const ARMORY_SRC = {}; // item id -> where it comes from (one line)
export const ARMORY_SET = new Set(); // every collectible id
const taken = new Set();
const add = (cat, name, ids) => {
  const items = ids.filter((id) => isGear(id) && !taken.has(id));
  if (!items.length) return;
  items.forEach((id) => { taken.add(id); ARMORY_SET.add(id); });
  let g = cat.groups.find((x) => x.name === name);
  if (!g) cat.groups.push((g = { name, items: [] }));
  g.items.push(...items);
};
const cat = (id, name) => { const c = { id, name, groups: [] }; ARMORY.push(c); return c; };

// legendaries: the odds are for a legendary of the looter's class, so each line names its classes
{
  const C = cat('legend', 'Legendary Weapons');
  add(C, 'One for every weapon type', LEGENDARIES);
  for (const id of LEGENDARIES) {
    const cls = (ITEMS[id].classes || []).map((c) => CLASSES[c]?.name + 's');
    ARMORY_SRC[id] = `Legendary for ${joinAnd(cls) || 'everyone'}: a legendary for your class comes from Tempest bosses (8%), Heroic bosses (2%) and world bosses (6%)`;
  }
}
// the Dragonslayer set: one class's pieces per line, from the Great Dam's Heart (sim.js dragonslayerDrop)
{
  const C = cat('dragonslayer', 'The Dragonslayer Set');
  for (const [cls, ids] of Object.entries(DRAGONSLAYER)) {
    add(C, `${CLASSES[cls]?.name || cls}`, ids);
    for (const id of ids) ARMORY_SRC[id] = `Dragonslayer, for ${CLASSES[cls]?.name}s: the Great Dam’s Heart on Heroic always gives a piece of your class’s set the first time you defeat it each week; on Normal, a ${Math.round(DS_NORMAL_CHANCE * 100)}% chance`;
  }
  // the armour: seven pieces per class, each slot owned by one Great Dam boss (sim.js dsArmourDrop)
  const pct = (v) => Math.round(v * 100) + '%';
  for (const [cls, ids] of Object.entries(DRAGONSLAYER_ARMOUR)) {
    add(C, `${CLASSES[cls]?.name || cls} armour`, ids);
    for (const id of ids) {
      const slot = ITEMS[id].slot, boss = Object.keys(DSA_SOURCE).find((k) => k !== DS_BOSS && DSA_SOURCE[k].includes(slot));
      const heart = `the Great Dam’s Heart on Heroic always gives a piece of your class’s armour you have not yet found (a spare piece once you have all seven) the first time you defeat it each week`;
      ARMORY_SRC[id] = boss
        ? `Dragonslayer armour, for ${CLASSES[cls]?.name}s: ${MOBS[boss]?.name || boss} in the Great Dam (${pct(DSA_HEROIC_CHANCE)} on Heroic, ${pct(DSA_NORMAL_CHANCE)} on Normal, once a week); also ${heart}`
        : `Dragonslayer armour, for ${CLASSES[cls]?.name}s: only from the Great Dam’s Heart (${pct(DSA_NORMAL_CHANCE)} on Normal, once a week); ${heart}`;
    }
  }
}
// dungeon sets, in the order of the dungeons' levels; each piece names only the foes that carry it
{
  const C = cat('sets', 'Dungeon Sets');
  const sets = Object.entries(SETS).filter(([, S]) => !S.ds).map(([k, S]) => {
    const dung = DUNGEON_BY_ID[k];
    return { k, S, lvl: dung ? parseInt(dung.level, 10) : 99, where: dung ? dung.name : k === 'tempest' ? 'Tempest mode' : '' };
  }).sort((a, b) => a.lvl - b.lvl);
  for (const { S, where } of sets) {
    add(C, `${S.name}${where ? ' · ' + where : ''}`, S.pieces);
    for (const id of S.pieces) {
      const foes = dropsBy[id] || [];
      ARMORY_SRC[id] = where === 'Tempest mode' ? `${S.name}: dropped by bosses in Tempest mode` : `${S.name}: drops from ${foes.length ? foesLine(foes) : 'the bosses of ' + where}`;
    }
  }
}
// what named bosses, elites, rares and world bosses carry (quest rewards they also carry stay on the quest shelf,
// and their source line names the foe too)
{
  const C = cat('treasure', 'Boss Treasures');
  const own = (k) => Object.entries(dropsBy).filter(([id, ms]) => ms.includes(k) && !ITEMS[id].set && !LEGENDARIES.includes(id) && !rewardOf[id]).map(([id]) => id);
  const holders = Object.keys(MOBS).filter((k) => own(k).length).sort((a, b) => lvlOf(a) - lvlOf(b));
  for (const k of holders) {
    const ids = own(k), m = MOBS[k], where = mobWhere(k), tag = mobTag(k);
    add(C, `${m.name}${where ? ' · ' + where : ''}`, ids);
    for (const id of ids) if (!ARMORY_SRC[id]) { const all = dropsBy[id]; ARMORY_SRC[id] = all.length > 1 ? `Drops from ${foesLine(all)}` : `Drops from ${m.name}${tag ? ' (' + tag + ')' : ''}${where ? ' ' + atPlace(k) : ''}`; }
  }
}
// quest rewards, shelved by the region of whoever gives the quest, in level order
{
  const C = cat('quests', 'Quest Rewards');
  const byZone = {};
  for (const [id, qids] of Object.entries(rewardOf)) {
    const Q = QUESTS[qids[0]], z = npcZone(Q.giver);
    const key = z ? z.id : 'elsewhere';
    (byZone[key] ||= { name: z ? z.name : 'Elsewhere', lvl: zoneLevel(key) || Q.lvl || 99, items: [] }).items.push([id, Q.lvl || 0]);
    const parts = qids.map((qid) => {
      const R = QUESTS[qid], g = npcZone(R.giver), n = (R.rewards || []).length;
      return `“${R.name}” from ${npcName(R.giver)}${g ? ' at ' + g.name : ''}${n > 1 ? ` (pick one of ${n}; ${npcName(R.turnin)} sells the ${n > 2 ? 'others' : 'other'} afterwards)` : ''}`;
    });
    const foes = dropsBy[id] || [];
    ARMORY_SRC[id] = `Reward for ${parts.join(' or ')}${foes.length ? `; also drops from ${foesLine(foes)}` : ''}`;
  }
  for (const Z of Object.values(byZone).sort((a, b) => a.lvl - b.lvl)) add(C, Z.name, Z.items.sort((a, b) => a[1] - b[1]).map(([id]) => id));
}
// quartermaster stores
{
  const C = cat('rep', 'Quartermasters');
  for (const [f, F] of Object.entries(FACTIONS)) {
    const ids = Object.entries(repOf).filter(([, r]) => r.f === f).sort((a, b) => a[1].rank - b[1].rank).map(([id]) => id);
    add(C, F.name, ids);
    for (const id of ids) ARMORY_SRC[id] = `Sold by ${npcName(F.qm)} to those ${REP_RANKS[repOf[id].rank]?.name || 'Friendly'} with the ${F.name}`;
  }
}
// made and found
{
  const C = cat('made', 'Crafted and Salvaged');
  const crafted = Object.keys(craftOf), salvaged = Object.keys(salvageOf);
  add(C, 'Crafted', crafted);
  for (const id of crafted) { const r = craftOf[id], n = NPCS.find((x) => x.craft === r.station); ARMORY_SRC[id] = `Made with ${STATION_NAME[r.station] || r.station}${n ? ' at ' + n.name + '’s' : ''}${r.skill ? ` (skill ${r.skill})` : ''}`; }
  add(C, 'Salvaged', salvaged);
  for (const id of salvaged) ARMORY_SRC[id] = `Salvaged from the ${salvageOf[id] === 'lake' ? 'glade lake' : 'village stream'} (rare)`;
  // anything else that is gear and has a source of its own (other drops) but fitted nowhere above
  const rest = Object.keys(dropsBy).filter((id) => !taken.has(id));
  add(C, 'Other finds', rest);
  for (const id of rest) ARMORY_SRC[id] ||= `Drops from ${foesLine(dropsBy[id])}`;
}
export const ARMORY_TOTAL = ARMORY_SET.size;
// rarity (plan A8): a piece that drops from foes (and every legendary and Dragonslayer piece) rolls its rarity each time
// it drops, so its shelf shows the best rarity this character has held ('fq:<item id>' counters, set by the server);
// paid or chosen pieces (quest rewards, quartermasters, crafting) always come at their designed rarity.
export const ARMORY_ROLLED = new Set([...ARMORY_SET].filter((id) => dropsBy[id] || LEGENDARIES.includes(id) || ITEMS[id]?.dragonslayer || ITEMS[id]?.set));
export const armoryBest = (c, id) => c?.['fq:' + id] ?? (c?.['found:' + id] ? ITEMS[id]?.q ?? 1 : null);
