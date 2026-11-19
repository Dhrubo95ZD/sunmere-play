// Authoritative world simulation. Runs on the Node server, or in the browser for offline play.
// Players move client-side (validated); combat, mobs, loot, quests and progression live here.
import { CLASSES, LEVEL_CAP, xpForLevel, powerAt, dailyXp } from './classes.js';
import { killXp, dungeonXpScale, eventXp } from './xp.js';
import { MOBS, SPAWNS, NPCS, QUESTS, ITEMS, LOOT_TABLES, VENDORS, NODES, GEAR_NAMES, GEAR_PREFIX, GRAVEYARDS, OBJECTS, OBJECT_KINDS, CARAVANS, WORLD_EVENTS, COMPANIONS, companionCost, MUSTER, HOME_DECO, HOME_TROPHIES, HOME_SPOTS, HOME_MOVABLE, WANDERERS, WANDERER_LINES, WANDERER_LINES_AREA, RUNABOUT, FACTIONS, REP_RANKS, REP_CAP, REP_SHOP, repRank, factionOfZone, EMOTES, SETS, RECIPES, RECIPE_BY_ID, SALVAGE, PAINTS, PETS, ARENA, ARENA_POOL, ESCORTS, DUR_LOSS, repairCost, DUEL, DUEL_YES, DUEL_NO, POST, TRADE, ORDER_FROM, tradeFair, BAG_BASE, BAG_V, RESTED, RECALL, mountSpeed, mountKind, LOADOUT_LEVEL, BOUNTY, PROF_NAME, PROF_MAX, profColor, TEMPEST, tempestMods, weekNumber, LEDGER, GUILD, GUILD_LINES, LEGENDARIES, DRAGONSLAYER, DS_BOSS, DS_NORMAL_CHANCE, DRAGONSLAYER_ARMOUR, DSA_SOURCE, DSA_HEROIC_CHANCE, DSA_NORMAL_CHANCE, DRAWINGS, MARK_SHOP, VALLEY, SAIL, sailRoutes , npcSeen, ENDGAME_LVL, UPGRADE_DROPS, QUALITY_NAME } from './data.js';
import { DUNGEONS, DUNGEON_BY_ID, DUNGEON_MIN_X, dungeonAt, dungeonPush, dungeonSpot, dungeonTide, dungeonSlip, dungeonCrane, craneDrops, loftAt, loftBays } from './dungeons.js';
import { heightAt, walkHeight, zoneAt, waterAt, waterNear, waterKind, LAKE, WORLD, AREA_BY_ID, islandAt, areaOf, inWorld, clampWorld, regionAt, worldGap } from './terrain.js';
import { mulberry32 } from './noise.js';
import { tpSpot } from './tpspot.js';
import { setTideClock, tideState } from './tidewater.js';
import { rainState } from './rainward.js';
import { galeState } from './weald.js';
import { RIDES_METHODS } from './rides.js';
import { RAM_METHODS } from './ramEngine.js';
import { houseSpec, houseAt, housePush, houseCrosses, houseTalkOk } from './houses.js';
import { rollGear, gearValue, CLASS_WEIGHT, offhandLook, wornLook, shoulderLook, cloakLook, GEMS, UPG, upOf, canUpgrade, upgradeCost, upgraded, gearName, salvageYield, rollNamed, migrateGear, migrateEntry, migratePlayer, GEAR_V, TEMPER, newTemper, temperInfo, BILLET, ENGINE_CORE, RARITY_SRC, WEAPON_TYPES, OFFHAND_TYPES, unsocketFee } from './items.js';
import { ACHIEVEMENTS, ACH_BY_ID, ACH_BY_COUNTER, DUNGEON_BOSSES, achTitle, achDone } from './achievements.js';
import { ARMORY_SET, ARMORY_TOTAL } from './armory.js';
import { SOCIAL_METHODS } from './social.js';
import { BOT_MIND_METHODS } from './botmind.js';
import { BOT_SOCIAL_METHODS, BOT_PARTY } from './botsocial.js';
import { BOT_CHAT_METHODS } from './botchat.js';
import { BOT_MEMORY_METHODS } from './botmemory.js';
import { skillFeel, tierOf, poiseMax, liftable, isElite, dodgeFor, dodgeWith, POISE, BUFFER, CUT_KINDS, CANCEL_AFTER, hitAt, lastHitT } from './feel.js';
import { CORE, kitOf, stepOf, CHAIN_RESET, PARRY, balMul, FILL } from './kit.js';
import { FUSIONS, FUSION_BY_ID, compileKit, fusionUnlocked, gateOk, nameOf, MASTERY, LINK, DISCOVER_XP, DUEL_FUSE } from './fusions.js';
import { baseMods, totalSpent, skillCost, skillCd } from './talents.js';
import { treeMods, treeCompile, treePoints, treeSpent, allocBlock, isLeaf, pruneAlloc, freeRespec, formAllowed, leafRefundCost, treeResetCost, TREE_V, TREE_FREE_DAYS } from './treeMods.js';
import { TREE_BY_ID } from './tree.js';
import { runKeys } from './keystones.js';
import { linkFusion, opener, planWait, reservedB, coatScore, coatFirst, botTree, botBuildOf } from './botplan.js';
import { COATS, REACTIONS, WALL, KNOCKDOWN, RECOVER, WINDOW, inWindow, PIN, PIN_SKILLS, elemsOf, coatOf, reactionFor, fromBehind } from './reactions.js';
const HEAT_ONLY = Object.freeze(['heat']); // (a fire patch's tick, S7)

const rand = mulberry32(Date.now() & 0xffff);
const R = (a = 0, b = 1) => a + (b - a) * rand();
const RI = (a, b) => Math.floor(R(a, b + 1));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const dist = (a, b) => Math.sqrt(dist2(a, b));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// v120 level curves (docs/ai/balance_v120.md). Hero damage outgrew the authored mob numbers unevenly (a normal mob died in
// about 1.5 s at levels 1-35 and 4.5 s at 45-65, and hit 2% of a hero's health at level 3 but 19% at 60), so every mob's
// health and damage is multiplied by a smooth factor of its level: [level, factor] points, straight lines between them.
const lerpT = (T, L) => { if (L <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (L <= T[i][0]) { const [a, x] = T[i - 1], [b, y] = T[i]; return x + (y - x) * (L - a) / (b - a); } return T[T.length - 1][1]; };
export const MOB_HP_T = [[1, 2.2], [6, 3.0], [20, 3.1], [30, 3.3], [35, 2.8], [40, 2.1], [45, 1.4], [50, 1.25], [60, 1.25], [65, 1.15]];
export const MOB_DMG_T = [[1, 2.0], [6, 2.3], [18, 2.3], [25, 2.1], [30, 1.8], [33, 1.3], [35, 1.15], [41, 0.85], [45, 0.8], [50, 0.72], [55, 0.62], [60, 0.6], [65, 0.55]];
export const WORLD_BOSS_HP = 5; // open-world bosses: a gathering fight for a group
// health factor for a mob def at a level: dungeon and raid bosses are authored at their final health (no factor);
// raid trash is fought by a bigger group, so it has half again the health of five-player dungeon trash
// open-world elites and rares (and the old story bosses Stonegrinder, Foreman and Stormengine) are solo quest targets: their
// health factor stops at ELITE_HP_CAP and their swings at 1, so a newcomer can still beat them alone (v120 review)
export const ELITE_HP_CAP = 1.6; // (the three story bosses stop at 0.8 of it)
const soloElite = (def, sp) => (def.elite || def.rare) && !def.world && !sp?.dungeon;
export const mobHpMul = (def, lvl, sp) => def.dummy ? 1 : sp?.dungeon && def.boss ? 1 : def.world ? WORLD_BOSS_HP : soloElite(def, sp) ? Math.min(def.boss ? ELITE_HP_CAP * 0.8 : ELITE_HP_CAP, lerpT(MOB_HP_T, lvl)) : lerpT(MOB_HP_T, lvl) * (sp?.dungeon && DUNGEON_BY_ID[sp.dungeon]?.raid ? 1.5 : 1);
// the swing factor of a mob: dungeon and raid bosses BOSS_SWING on the ability curve, open-world elites at most 1, the rest the curve
export const mobSwingMul = (def, lvl, sp, inDungeon) => def.boss && inDungeon ? BOSS_SWING * mobAbilityMul(lvl) : soloElite(def, sp) ? Math.min(1, mobDmgMul(lvl)) : mobDmgMul(lvl);
export const mobDmgMul = (lvl) => lerpT(MOB_DMG_T, lvl);
// boss and elite mechanics (telegraphed circles, beams, novas) keep at least 0.85 of their authored damage, so they stay worth
// stepping out of at high levels where the plain swing curve falls lower
// a bot tank (volunteer or companion Knight or Warden) draws this much more threat from its damage, so a geared hero
// dealing several times its damage does not pull the boss off it unless they really overdo it (v120 review follow-up)
export const BOT_TANK_THREAT = 6;
// (S15) a bot's power while it holds its Skill Web build (botGear): the Web's damage nodes made the volunteer party ~1.6x as
// strong as before and raid fights ~35% shorter than the v120 lengths (realfight); this keeps their fights where they were
export const BOT_WEB_POW = 0.56;
export const BOT_TANK_HP = 5; // and wears this much more health on its two armour pieces (botGear)
const TANK_CLS = new Set(['knight', 'warden']);
const BOT_BRACE = { slam: 0.8, boss: 0.55, other: 0.4 }; // (S9: how often a bot Warden braces for a swing it sees coming; its 2 charges limit it)
export const BOT_SIDESTEP = 0.7; // share of telegraphed hits a bot is taken to step out of
export const BOSS_SWING = 1.25; // a dungeon or raid boss swings this much harder at its target (the tank) than its level curve
// a boss shrunk for a smaller group (raidScale, raidK below 1) also hits softer: by the square root of its share
export const groupDmg = (m) => (m.raidK && m.raidK < 1 ? Math.sqrt(m.raidK) : 1);
export const mobAbilityMul = (lvl) => Math.max(0.85, Math.min(1, mobDmgMul(lvl)));
const SPAWN_POINT = { x: 2, z: 10 };
const GCD = 1.0; // (the old flat lock; FEEL_ON uses each skill's own lock from feel.js instead)
const FEEL_ON = true; // S1 feel layer: per-skill locks, poise, lifts, the dodge (combat_design.md section 2)
const VIEW = 110;
// server perf (docs/ai/server_perf.md): on the world server a mob with no human within MOB_SLEEP.r (the view range plus a
// margin) and no full-detail bot within 60 m sleeps (if mobSleepy says it may): every MOB_SLEEP.step s it
// only heals, wears off its buffs and goes home from a leash; it wakes the tick a human comes within range. Dead mobs keep
// their respawn timers every tick. SUNMERE_NO_SLEEP=1 turns it off (tests). MOB_CELL: the mob grid's square, in metres.
export const MOB_SLEEP = { r: VIEW + 90, step: 1, off: typeof process !== 'undefined' && !!process.env?.SUNMERE_NO_SLEEP };
const MOB_CELL = 16;
// who may sleep: not an event's or a boss's add (temp), a patrol on its beat (they follow the weather), a world boss or a
// rare (they keep moving), nor a mob in a fight or with a blow on its way (the spawn's part is kept on the mob: m._sl)
const mobSleepy = (m) => (m._slSp === m.sp ? m._sl : ((m._slSp = m.sp), (m._sl = !m.sp.temp && !m.sp.path && !m.def.world && !m.def.rare))) && !m.threat.size && !m.pending;

let nextId = 1;
const newId = (p) => p + (nextId++).toString(36);

// skills whose own effect moves the caster (dash, leap, back): the client plays that move at once, so it never interrupts them
// (S10) the Deadeye's hot loads (Six Chambers' perfect reload: heat, for Ignite) and Bank Shot's skip (spark, for Galvanic):
// one cached copy of a record per kind, same id, so the sim's contact (this._hc) and the client name the same skill
const HOT_REC = new WeakMap(), BANK_REC = new WeakMap();
const POP_REC = new WeakMap(); // (S12 Chain Reaction: one cached pop record per fusion record)
// (S13) the Herbalist: the kinds a heal of his is made of (the next one spends his Sap), and Grove Keeper's herb patch
const HEALS = new Set(['heal', 'hot', 'absorb', 'healLowest', 'healHurt', 'healParty', 'hzone', 'hazeSmoke']);
const GROVE_REC = { id: 'h_grove', name: 'Herb Patch', cls: 'herbalist' };
const ZONE_SLOW = { tar: 'Tar', fire: 'Burning Tar', frost: 'Frost', acid: 'Acid Cloud' }; // (S12: the slow a puddle of each kind lays on what stands in it)
const tagged = (M, sk, tag) => { let r = M.get(sk); if (!r) { r = { ...sk, tags: [...new Set([...(sk.tags || []), tag])] }; M.set(sk, r); } return r; };
const MOVERS = new Set([...Object.values(CORE), ...Object.values(FUSIONS)].flat().filter((s) => s.fx.some((f) => f[0] === 'dash' || f[0] === 'leap' || f[0] === 'back')).map((s) => s.id));
// the distance from (x, z) to a segment [x0, z0, x1, z1] (Afterwake's sand wake, S8)
function segDist(x, z, s) {
  const vx = s[2] - s[0], vz = s[3] - s[1], t = Math.max(0, Math.min(1, ((x - s[0]) * vx + (z - s[1]) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(x - s[0] - vx * t, z - s[1] - vz * t);
}
export class World {
  constructor(io = {}) {
    this.io = { load: () => null, save: () => {}, log: () => {}, ...io };
    this.players = new Map(); // id -> player
    this.mobs = new Map();
    this.npcs = new Map();
    this.corpses = new Map(); // loot bags on dead mobs
    this.nodes = new Map();
    this.events = []; // broadcast events this tick
    this.aoes = []; // telegraphed boss hits waiting to land
    this.parties = new Map();
    this.partyT = 0;
    this.dmode = {}; // dungeon id -> 'normal' | 'heroic' | 'tempest'
    this.wev = WORLD_EVENTS.map((e) => ({ def: e, next: 150 + R(0, 240), live: null }));
    this.time = 0;
    setTideClock(() => this.time); // Tidewater Sound's tide runs on the world clock (shared/tidewater.js)
    this.snapT = 0;
    this.saveT = 0;
    for (const n of NPCS) {
      // an NPC with a house and a spot stands at that spot of the house (shared/houses.js); without the house, its own x/z
      const o = { ...n, type: 'npc' }, sp = n.house && n.spot != null ? houseSpec(n.house)?.spots[n.spot] : null;
      if (sp) { o.x = sp.x; o.z = sp.z; o.ry = sp.ry; }
      o.y = walkHeight(o.x, o.z);
      this.npcs.set(n.id, o);
    }
    for (const n of NODES) { const y = heightAt(n.x, n.z); if (y > 0.4) this.nodes.set(n.id, { ...n, y, ready: true, t: 0 }); }
    for (const sp of SPAWNS) for (let i = 0; i < sp.n; i++) this.spawnMob(sp);
    // living bots (docs/ai/living_bots_design.md B.6): roster size, how many may be in the world, how many at least
    this.bots = { roster: 40, maxActive: 24, minOnline: 8, ...io.bots };
    this.botsLoad();
    if (io.wanderers !== false) this.spawnWanderers();
    // world bosses arrive a while after the world wakes, with an announcement
    for (const m of this.mobs.values()) if (m.def.world) { m.dead = true; m.respawnT = this.time + 600 + R(0, 600); }
  }

  // ------------------------------------------------------------------ mobs
  spawnMob(sp, existing) {
    const def = MOBS[sp.mob];
    let x, z;
    if (sp.path) { const k = RI(0, sp.path.length - 1); x = sp.path[k][0] + R(-2, 2); z = sp.path[k][1] + R(-2, 2); }
    else if (sp.dungeon) { const D = DUNGEON_BY_ID[sp.dungeon]; [x, z] = dungeonSpot(D, sp.x - D.ox, sp.z - D.oz, sp.r, rand); }
    else {
      // a random spot in the circle, retried away from open water (the glade lake) so nothing spawns under it
      for (let t = 0; t < 10; t++) { const a = R(0, Math.PI * 2), d = Math.sqrt(R()) * sp.r; x = sp.x + Math.cos(a) * d; z = sp.z + Math.sin(a) * d; if (waterAt(x, z) == null && !houseAt(x, z) && !houseCrosses(sp.x, sp.z, x, z)) break; }
      [x, z] = housePush(x, z, Math.min(1.2, def.radius)); // and never inside a house or its walls
    }
    const mode = sp.dungeon ? this.dmode?.[sp.dungeon] : null, tempest = mode === 'tempest', vet = mode === 'veteran', heroic = mode === 'heroic' || tempest || vet;
    const rh = mode === 'raidheroic'; // raid heroic: the same levels, much tougher, better loot
    // Veteran (level 38+): the old five-player dungeons raised to the level 40 cap
    const lr = vet ? (def.boss ? [41, 41] : def.elite ? [40, 40] : [39, 40]) : tempest ? (def.boss ? [27, 27] : def.elite ? [26, 26] : [25, 26]) : heroic ? (def.boss ? [26, 26] : def.elite ? [25, 25] : [24, 25]) : sp.lvl || def.lvl;
    const lvl = RI(lr[0], lr[1]);
    // Heroic bosses are never weaker than Normal (a boss above the Heroic level would shrink); Veteran bosses grow in proportion
    // to the level jump, as hero damage does, so every old dungeon at level 41 lasts about as long
    const lf = 1 + 0.22 * (lvl - def.lvl[0]), lvlF = def.boss && vet ? 1.3 * lvl / def.lvl[0] : def.boss && heroic ? Math.max(lf, 1.3) : lf;
    const hp = Math.round(def.hp * lvlF * mobHpMul(def, lvl, sp) * (tempest ? TEMPEST.hp * (tempestMods().includes('plated') ? 1.2 : 1) : 1) * (rh ? 1.6 : 1));
    const m = existing || { id: newId('m'), type: 'mob' };
    Object.assign(m, {
      kind: sp.mob, def, sp, name: def.name, level: lvl, hp, maxHp: hp, x, z, y: walkHeight(x, z), ry: R(0, 6.28),
      home: { x, z }, state: 'idle', stateT: R(1, 5), target: null, threat: new Map(), swingT: 0, dead: false, respawnT: 0,
      buffs: [], speed: 0, cast: null, lootedBy: null, abT: null, enraged: false, addsDone: null, pi: null, pdir: 1, heroic, tempest, vet, rh, baseHp: undefined, raidK: undefined, phaseDone: null,
    });
    this.mobs.set(m.id, m);
    if (this._mg) this.mobGridMove(m);
    return m;
  }

  // the mob grid (server perf, docs/ai/server_perf.md): every mob filed by its MOB_CELL square (keys fit squares within
  // about 32 km of the origin). Checked at the start of each mob pass (so moves from skills and knockbacks are caught),
  // kept up to date as mobs move, respawn and go, and filed afresh once a minute
  mobGridBuild() {
    let G = this._mg;
    if (!G || ++G.n >= 1200) {
      G = this._mg = { cells: new Map(), stamp: (G?.stamp || 0) + 1, maxR: 0, n: 0 };
    }
    for (const m of this.mobs.values()) this.mobGridMove(m);
  }
  mobGridDrop(m) {
    const G = this._mg;
    if (!G || m._gs !== G.stamp) return;
    const a = G.cells.get(m._gk), i = a ? a.indexOf(m) : -1;
    if (i >= 0) { a[i] = a[a.length - 1]; a.pop(); }
    m._gs = -1;
  }
  // every mob filed in the grid squares within r of e (and one square more, for mobs moved since they were filed): a
  // superset of the mobs within r, in a reused list
  mobsAround(e, r) {
    const G = this._mg, out = this._mAround || (this._mAround = []);
    out.length = 0;
    const k = Math.ceil(r / MOB_CELL) + 1, cx = Math.floor(e.x / MOB_CELL), cz = Math.floor(e.z / MOB_CELL);
    for (let i = cx - k; i <= cx + k; i++) for (let j = cz - k; j <= cz + k; j++) {
      const a = G.cells.get((i + 2048) * 4096 + (j + 2048));
      if (a) for (let n = 0; n < a.length; n++) out.push(a[n]);
    }
    return out;
  }
  mobGridMove(m) {
    const G = this._mg, k = (Math.floor(m.x / MOB_CELL) + 2048) * 4096 + (Math.floor(m.z / MOB_CELL) + 2048);
    if (m._gs === G.stamp) {
      if (m._gk === k) return;
      const a = G.cells.get(m._gk), i = a ? a.indexOf(m) : -1;
      if (i >= 0) { a[i] = a[a.length - 1]; a.pop(); }
    }
    let b = G.cells.get(k);
    if (!b) G.cells.set(k, (b = []));
    b.push(m); m._gk = k; m._gs = G.stamp;
    if (m.def.radius > G.maxR) G.maxR = m.def.radius;
  }

  // ------------------------------------------------------------------ sessions
  connect(send) { return { send, player: null }; }
  disconnect(session) {
    const p = session.player;
    if (!p) return;
    this.savePlayer(p);
    this.tradeCancelFor(p, `${p.name} has left: the trade is off.`);
    this.dismissCompanion(p, true);
    this.leaveParty(p, true);
    this.players.delete(p.id);
    this.friendNotice(p, false);
    this.broadcast({ k: 'msg', text: `${p.name} has left Sunmere.`, color: '#a8a8a8' });
    for (const m of this.mobs.values()) m.threat.delete(p.id);
  }

  receive(session, msg) {
    if (msg.t === 'join') return this.join(session, msg);
    const p = session.player;
    if (!p) return;
    const h = this['on_' + msg.t];
    if (h) h.call(this, p, msg);
  }

  join(session, msg) {
    const cls = CLASSES[msg.cls] ? msg.cls : 'knight';
    const name = String(msg.name || 'Hero').replace(/[^A-Za-z]/g, '').slice(0, 14) || 'Hero';
    const key = name.toLowerCase();
    const saved = this.postCache?.get(key) || this.io.load(name);
    this.postCache?.delete(key);
    const p = {
      id: newId('p'), type: 'player', session, name: name[0].toUpperCase() + name.slice(1).toLowerCase(), cls,
      level: 1, xp: 0, gold: 10, x: SPAWN_POINT.x + R(-2, 2), z: SPAWN_POINT.z + R(-2, 2), y: 0, ry: Math.PI, speed: 0, air: false,
      hp: 1, maxHp: 1, res: 0, maxRes: 100, dead: false, target: null, cds: {}, gcd: 0, cast: null, buffs: [],
      bag: [{ id: 'tonic', n: 3 }, { id: 'bread', n: 4 }], equip: {}, quests: {}, done: {}, visited: { village: true }, stats: {}, absorb: 0, combatT: 0, eating: 0, lsT: 0, ach: { c: {}, done: {} }, title: '', rep: {},
    };
    p.cv = clamp(msg.cv | 0, 0, 2);
    if (saved && saved.cls === cls) Object.assign(p, { cv: saved.cv ?? p.cv, level: saved.level, xp: saved.xp, gold: saved.gold, bag: saved.bag, equip: saved.equip, quests: saved.quests, done: saved.done, x: saved.x, z: saved.z, visited: saved.visited || { village: true }, ach: saved.ach || { c: {}, done: {} }, title: saved.title || '', companions: saved.companions || (saved.companion ? [saved.companion] : []), runabout: !!saved.runabout, rep: saved.rep || {}, daily: saved.daily || {}, bank: saved.bank || [], paint: saved.paint || 'brass', pets: saved.pets || {}, pet: saved.pet || null, arenaBest: saved.arenaBest || 0 });
    // a save from before the world changed shape may stand on what is now ridge: back to the village square (inWorld is
    // area-aware: a logout on the Cinder Reach or the Rime Steps is judged by that area's own shore)
    if (!(p.x >= DUNGEON_MIN_X) && !(isFinite(p.x) && isFinite(p.z) && inWorld(p.x, p.z, 0))) { p.x = SPAWN_POINT.x + R(-2, 2); p.z = SPAWN_POINT.z + R(-2, 2); }
    p.buyOrders = saved && saved.cls === cls && saved.buyOrders || [];
    // packs saved before the base grew from 20 to 30 slots keep their upgrades and gain the 10 new slots
    p.bagSize = saved && saved.cls === cls && saved.bagSize ? saved.bagSize + ((saved.bagV || 1) < BAG_V ? BAG_BASE - 20 : 0) : BAG_BASE;
    p.rested = saved && saved.cls === cls && saved.rested || 0;
    p.home = saved && saved.cls === cls && saved.home || 'village';
    p.lo = saved && saved.cls === cls && saved.lo || 0;
    p.bounty = saved && saved.cls === cls && saved.bounty || null;
    p.prof = saved && saved.cls === cls && saved.prof || {};
    p.raidLock = saved && saved.cls === cls && saved.raidLock || null;
    p.ledger = saved && saved.cls === cls && saved.ledger || []; p.picks = saved && saved.cls === cls && saved.picks || {}; p.spares = saved && saved.cls === cls && saved.spares || {}; p.lgear = saved && saved.cls === cls && saved.lgear || null;
    p.guild = saved && saved.cls === cls && saved.guild || null;
    p.friends = saved && saved.cls === cls ? this.loadFriends(saved) : [];
    p.ringWeek = saved && saved.cls === cls && saved.ringWeek || null;
    p.botPrefs = saved && saved.cls === cls && saved.botPrefs || null; p.lfgRole = saved && saved.cls === cls && saved.lfgRole || null; p.ridesOwed = saved && saved.cls === cls && saved.ridesOwed || null; p.ramOwed = saved && saved.cls === cls && saved.ramOwed || null; // (P15.3: a Clear the Rides share not yet taken from the chest)
    p.compGear = saved && saved.cls === cls && saved.compGear || {};
    p.looks = saved && saved.cls === cls && saved.looks || [];
    p.wlook = saved && saved.cls === cls && saved.wlook || null;
    p.ohlooks = saved && saved.cls === cls && saved.ohlooks || []; p.ohlook = saved && saved.cls === cls && saved.ohlook || null;
    p.shines = saved && saved.cls === cls && saved.shines || []; p.wshine = saved && saved.cls === cls && saved.wshine || null;
    p.shlooks = saved && saved.cls === cls && saved.shlooks || []; p.shlook = saved && saved.cls === cls && saved.shlook || null;
    p.cklooks = saved && saved.cls === cls && saved.cklooks || []; p.cklook = saved && saved.cls === cls && saved.cklook || null;
    p.homeDeco = saved && saved.cls === cls && saved.homeDeco || {};
    p.homePos = saved && saved.cls === cls && saved.homePos || {};
    // the wardrobe remembers everything already in your hands, bags and storehouse
    for (const g of [...Object.values(p.equip || {}), ...(p.bag || []).map((b) => b.gear), ...(p.bank || []).map((b) => b.gear)]) this.lookFind(p, g);
    if (saved && saved.cls === cls && !saved.prof) { const k = Math.min(60, (saved.level || 1) * 3); p.prof = { smith: k, herbal: k, cook: k }; } // characters from before craft skills keep their recipes
    // the combat rework (S2): fusions found, mastery, the Web (S3) and Forms. A save from before its class moved to the new
    // kit (kitV < 2; p.cv is the colour variant, so the kit version has its own field) has its talents handed back (both
    // sets; the points come back as Web points, the talents and loadouts fields are dropped), the talent achievements
    // counted, its bar and wheel remapped on the client (classes.js OLD_TO_NEW) and a letter from the class trainer (S16)
    const sv = saved && saved.cls === cls ? saved : null;
    p.fusions = sv?.fusions || []; p.fmastery = sv?.fmastery || {}; p.tree = sv?.tree || {}; p.forms = sv?.forms || {}; p.kitV = sv?.kitV || 0;
    if (p.kitV < 2) {
      if (sv) {
        const pts = Math.max(totalSpent(sv.talents), ...(Array.isArray(sv.loadouts) ? sv.loadouts.map(totalSpent) : [0]));
        if ((sv.level || 1) > 1 || pts > 0) p.kitMoved = { pts };
        if (pts && p.ach?.c) p.ach.c.talents = Math.max(p.ach.c.talents || 0, pts);
        p.fusions = []; p.fmastery = {}; p.tree = {}; p.forms = {};
      }
      p.kitV = 2;
    }
    // the Skill Web (S3): its version (a Web change prunes what no longer joins and gives a free respec), the free-respec
    // window (14 days after the move from talents) and the second tree kept with the second loadout
    p.treeV = sv?.treeV || 0; p.treeFree = sv?.treeFree || 0; p.webSets = sv?.webSets || null;
    {
      if (p.kitMoved) p.treeFree = Date.now() + TREE_FREE_DAYS * 864e5;
      if (p.treeV < TREE_V) { if (p.treeV) p.treeFree = Math.max(p.treeFree, Date.now() + TREE_FREE_DAYS * 864e5); p.tree = pruneAlloc(cls, p.tree); if (p.webSets) p.webSets = p.webSets.map((w) => ({ tree: pruneAlloc(cls, w?.tree), forms: w?.forms || {} })); p.treeV = TREE_V; }
    }
    p.runaboutMk = saved && saved.cls === cls && saved.runaboutMk || 1;
    p.crawler = !!(saved && saved.cls === cls && saved.crawler); p.mountKind = saved && saved.cls === cls && saved.mountKind === 'crawler' ? 'crawler' : 'runabout';
    p.recallReady = saved && saved.cls === cls && saved.recallReady || 0;
    const away = saved && saved.cls === cls && saved.savedAt ? Math.max(0, Date.now() - saved.savedAt) / 3.6e6 : 0;
    p.wo = saved && saved.cls === cls && saved.wo || null;
    p.mail = (saved && saved.cls === cls && saved.mail || []).filter((m) => Date.now() - m.t < POST.keepDays * 864e5 || m.item || m.gold);
    // Tempering (plan A5): the endgame counters toward a Legendary and a Prismatic piece, kept per character
    p.temper = saved && saved.cls === cls && saved.temper || newTemper();
    p.heats = [...new Set([...(saved && saved.cls === cls && saved.heats || []), ...(p.heats || [])])].sort((a, b) => a - b); p.wheat = saved && saved.cls === cls && saved.wheat != null ? saved.wheat : null;
    // gear from before rarity tiers and upgrades (plan A7, gearV 2): old reforges become upgrade steps, id-only pieces full objects
    p.gearV = saved && saved.cls === cls && saved.gearV || 0;
    if (p.gearV < GEAR_V) this.migrateSave(p);
    if (msg.level) p.level = clamp(msg.level | 0, 1, LEVEL_CAP); // test option
    if (p.x < DUNGEON_MIN_X) [p.x, p.z] = housePush(p.x, p.z, 0.45); // a save from inside what is now a house wall
    p.y = walkHeight(p.x, p.z);
    this.recalc(p);
    p.hp = p.maxHp; p.res = p.maxRes;
    if (away > 0.02 && p.level < LEVEL_CAP) this.addRested(p, away * (saved.savedHub ? RESTED.hubRate : RESTED.wildRate));
    session.player = p;
    this.players.set(p.id, p);
    session.send({ t: 'ev', list: [{ k: 'valley', stage: this.valleyState().stage }] });
    session.send({ t: 'welcome', id: p.id, you: this.privateState(p), npcs: [...this.npcs.values()].map(this.publicNpc), nodes: [...this.nodes.values()].map((n) => ({ id: n.id, item: n.item, x: n.x, z: n.z, ready: n.ready })) });
    this.broadcast({ k: 'msg', text: `${p.name} the ${CLASSES[cls].name} has entered Sunmere.`, color: '#e8c26a' });
    this.achSync(p, true);
    this.sendAch(p);
    if (p.guild) setTimeout(() => this.guildGreet(p), 4000);
    this.friendNotice(p, true);
    if (p.ringWeek && p.ringWeek.week !== this.bountyWeek()) this.ringSettle(p);
    if (p.rested >= Math.max(40, xpForLevel(p.level) * 0.1) && p.level < LEVEL_CAP) this.msg(p, `You feel rested: your kills grant double experience for the next ${p.rested.toLocaleString()} XP.`, '#7ab0ff');
    if (p.kitMoved) { this.kitLetter(p, p.kitMoved.pts); p.kitMoved = null; }
    if (p.mail.some((m) => !m.read)) this.msg(p, 'You have post waiting. Any Caravan Master can hand it over.', '#ffe08a');
    for (const c of p.companions || []) if (COMPANIONS[c]) this.hireCompanion(p, c, true);
    this.io.log('join', p.name, cls);
  }

  savePlayer(p) {
    this.io.save(p.name, { cls: p.cls, level: p.level, xp: p.xp, gold: p.gold, bag: p.bag, equip: p.equip, quests: p.quests, done: p.done, picks: p.picks || {}, spares: p.spares || {}, lgear: p.lgear || null, raidLock: p.raidLock || null, x: p.x, z: p.z, visited: p.visited, ach: p.ach, title: p.title, companions: this.myBots(p).filter((b) => !b.lfg).map((b) => b.cls), runabout: !!p.runabout, rep: p.rep || {}, daily: p.daily || {}, bank: p.bank || [], paint: p.paint || 'brass', pets: p.pets || {}, pet: p.pet || null, cv: p.cv || 0, kitV: p.kitV || 0, fusions: p.fusions || [], fmastery: p.fmastery || {}, tree: p.tree || {}, forms: p.forms || {}, treeV: p.treeV || 0, treeFree: p.treeFree || 0, webSets: p.webSets || null, arenaBest: p.arenaBest || 0, bagSize: p.bagSize || BAG_BASE, bagV: BAG_V, rested: Math.round(p.rested || 0), savedAt: Date.now(), savedHub: this.inHub(p), home: p.home || 'village', looks: p.looks || [], wlook: p.wlook || null, ohlooks: p.ohlooks || [], ohlook: p.ohlook || null, shines: p.shines || [], wshine: p.wshine || null, shlooks: p.shlooks || [], shlook: p.shlook || null, cklooks: p.cklooks || [], cklook: p.cklook || null, homeDeco: p.homeDeco || {}, homePos: p.homePos || {}, compGear: p.compGear || {}, ringWeek: p.ringWeek || null, guild: p.guild || null, ledger: p.ledger || [], prof: p.prof || {}, bounty: p.bounty || null, lo: p.lo || 0, runaboutMk: p.runaboutMk || 1, crawler: !!p.crawler, mountKind: p.mountKind || 'runabout', recallReady: p.recallReady || 0, mail: p.mail || [], buyOrders: p.buyOrders || [], wo: p.wo || null, gearV: p.gearV || GEAR_V, temper: p.temper || newTemper(), heats: p.heats || [], wheat: p.wheat ?? null, friends: p.friends || [], botPrefs: p.botPrefs || null, lfgRole: p.lfgRole || null, ridesOwed: p.ridesOwed || null, ramOwed: p.ramOwed || null });
  }

  // plan A7: every place a character keeps gear, moved to the gearV 2 shape (bs/tq/up; rf n -> up n). Idempotent. The
  // remembered loadout gear (lgear) names pieces by uid, which the migration keeps, so it needs nothing.
  migrateSave(p) {
    migratePlayer(p, ITEMS);
    for (const L of p.mail || []) if (L?.item) L.item = migrateEntry(L.item, ITEMS);
    for (const B of p.buyback || []) if (B?.it) B.it = migrateEntry(B.it, ITEMS);
    for (const kit of Object.values(p.compGear || {})) if (kit) for (const [s, g] of Object.entries(kit)) kit[s] = typeof g === 'string' && ITEMS[g]?.stats ? migrateGear({ ...ITEMS[g], id: g, stats: { ...ITEMS[g].stats } }, ITEMS) : migrateGear(g, ITEMS);
    p.gearV = GEAR_V;
  }

  // ------------------------------------------------------------------ stats
  recalc(p) {
    const c = CLASSES[p.cls];
    const web = (!p.bot || p.botWeb) && p.tree; // a hero on the Skill Web (S3; S15: and a bot on its build, botGear); other bots fight on the plain kit
    if (web && treeSpent(p.tree) > treePoints(p.level, p.done)) p.tree = {}; // level went down: hand the points back
    const tal = p.tal = web ? treeMods(p.cls, p.tree, { forms: p.forms, done: p.done }) : baseMods();
    compileKit(p); // p.eff / p.effFuse (shared/fusions.js): what this hero casts, rebuilt here with p.tal
    if (web) treeCompile(p); // Forms, carry, keystones and renames on p.eff (shared/treeMods.js)
    // set bonuses ride on the same modifier table as the Web
    const worn = {};
    for (const it of Object.values(p.equip)) if (it?.set && it.dur !== 0) worn[it.set] = (worn[it.set] || 0) + 1;
    for (const [k, n] of Object.entries(worn)) for (const [need, fx] of Object.entries(SETS[k]?.bonus || {})) if (n >= Number(need)) for (const [kind, v] of fx) tal[kind] = (tal[kind] || 0) + v;
    const st = { power: 0, armor: 0, hp: 0, haste: 0 };
    for (const it of Object.values(p.equip)) if (it?.stats && it.dur !== 0) for (const k in it.stats) st[k] = (st[k] || 0) + it.stats[k];
    for (const it of Object.values(p.equip)) if (it?.sockets && it.dur !== 0) for (const gm of it.sockets) if (GEMS[gm]) for (const [k, v] of Object.entries(GEMS[gm].stats)) st[k] = (st[k] || 0) + v;
    p.stats = st;
    for (const it of Object.values(p.equip)) if (it?.fx && it.dur !== 0) for (const [k, v] of it.fx) tal[k] = (tal[k] || 0) + v;
    tal.crit = (tal.crit || 0) + (st.crit || 0) / 100; tal.dodge = (tal.dodge || 0) + (st.dodge || 0) / 100; tal.leech = (tal.leech || 0) + (st.leech || 0) / 100;
    // hard caps so no gear stack can make a player never hit (dodge) or always crit: 50% dodge, 75% crit with the 10% base
    tal.dodge = Math.min(tal.dodge, 0.5); tal.crit = Math.min(tal.crit, 0.65);
    const ratio = p.maxHp > 1 ? p.hp / p.maxHp : 1;
    p.maxHp = Math.round((c.hp * (1 + 0.18 * (p.level - 1)) + st.hp * 4) * (1 + tal.hp));
    p.hp = Math.max(1, Math.round(p.maxHp * ratio));
    p.maxRes = c.res;
    p.power = (powerAt(p.level) + st.power) * (p.botWeb ? BOT_WEB_POW : 1); // (S15: a bot on its Skill Web build: see BOT_WEB_POW)
    // the armour that halves a hit grows with level (200 + 50 per level), so cloth, mail and plate stay apart at every level;
    // 75% at most, and armour talents also raise that cap by a quarter of what they give
    p.armorPct = clamp(c.armor + st.armor / (st.armor + 200 + 50 * p.level) + (tal.armor || 0), 0, 0.75 + (tal.armor || 0) / 4);
    p.hastePct = st.haste / 100 + tal.haste;
  }

  buffVal(e, stat) { let v = 0; for (const b of e.buffs) if (b.stat === stat) v += b.pct; return v / 100; }
  hasCC(e, kind) { return e.buffs.some((b) => b.cc === kind); }

  privateState(p) {
    return {
      id: p.id, name: p.name, cls: p.cls, cv: p.cv || 0, level: p.level, xp: p.xp, xpNext: xpForLevel(p.level), gold: p.gold,
      hp: p.hp, maxHp: p.maxHp, res: p.res, maxRes: p.maxRes, bag: p.bag, equip: p.equip, quests: p.quests, done: p.done,
      stats: p.stats, power: Math.round(p.power), armorPct: p.armorPct, cds: p.cds, gcd: p.gcd, dead: p.dead, grave: p.dead ? this.graveName(p) : null, x: p.x, z: p.z,
      buffs: p.buffs.map((b) => ({ name: b.name, icon: b.icon, t: b.t, dur: b.dur, debuff: !!b.debuff })), absorb: Math.round(p.absorb),
      duel: p.duel ? { with: p.duel.with, start: p.duel.start, end: p.duel.end } : null, mailNew: (p.mail || []).filter((m) => !m.read).length, bagSize: this.bagMax(p), rested: Math.round(p.rested || 0), home: CARAVANS.find((c) => c.id === p.home)?.name || 'Sunmere Village', recallReady: p.recallReady || 0, recalling: !!p.recall, looks: p.looks || [], wlook: p.wlook || null, ohlooks: p.ohlooks || [], ohlook: p.ohlook || null, shines: p.shines || [], wshine: p.wshine || null, shlooks: p.shlooks || [], shlook: p.shlook || null, cklooks: p.cklooks || [], cklook: p.cklook || null, heats: p.heats || [], wheat: p.wheat ?? null, temper: this.temperState(p), homeDeco: p.homeDeco || {}, homePos: p.homePos || {}, buyback: (p.buyback || []).map((b) => ({ it: b.it, value: b.value })), compGear: p.compGear || {}, comps: this.myBots(p).filter((b) => !b.escort).map((b) => ({ id: b.id, name: b.name, cls: b.cls, power: Math.round(b.power), hp: b.maxHp, armor: Math.round(b.armorPct * 100) })), guild: p.guild ? { name: p.guild.name, rank: p.guild.rank, roster: this.guildRoster(p) } : null, ledger: p.ledger || [], ridesOwed: p.ridesOwed?.k || 0, ramOwed: p.ramOwed?.k || 0, prof: p.prof || {}, lo: p.lo || 0, lgear: (p.lgear || [null, null]).map((g) => (g ? Object.keys(g).length : 0)), runaboutMk: p.runaboutMk || 1, runabout: !!p.runabout, crawler: !!p.crawler, mountKind: mountKind(p), mounted: !!p.mounted, paint: p.paint || 'brass', pets: p.pets || {}, pet: p.pet || null, rep: p.rep || {}, daily: p.daily || {}, today: this.today(),
      link: p.link ? { from: p.link.from, until: p.link.until, landed: !!p.link.landed, parried: !!p.link.parried, step: p.link.step || 0, tgt: p.link.tgt || null } : null, chain: p.chain || null, fusions: p.fusions || [], fmastery: p.fmastery || {}, tree: p.tree || {}, kitV: p.kitV || 0, rounds: p.tal?.sixChambers ? [p.rounds?.[0] ?? 6, p.rounds?.[1] ?? 6, p.hotN || 0] : null, skc: p.skc ? Object.fromEntries(Object.entries(p.skc).map(([k, c]) => [k, c.n])) : null, forms: p.forms || {}, web: 1, treePts: treePoints(p.level, p.done) - treeSpent(p.tree), treeFree: freeRespec(p) ? 1 : 0, webSets: p.webSets ? p.webSets.map((w) => Object.keys(w?.tree || {}).length) : null,
      speedMul: 1 + (p.tal?.speed || 0), crit: 0.1 + (p.tal?.crit || 0), dodge: p.tal?.dodge || 0, hastePct: p.hastePct || 0, title: p.title || '',
      mods: Object.fromEntries(['dmg', 'critDmg', 'heal', 'leech', 'cdr', 'thorns', 'regen', 'hp', 'armor', 'haste', 'crit', 'dodge', 'speed', 'absorb'].filter((k) => typeof p.tal?.[k] === 'number' && p.tal[k]).map((k) => [k, p.tal[k]])),
    };
  }
  // the Armory's Temper meter (plan A5): the counters and how far each guarantee is
  temperState(p) { const t = p.temper || newTemper(); return { g: t.g | 0, p: t.p | 0, ...temperInfo(t), golden: TEMPER.golden, prisFrom: TEMPER.prisFrom, prisAt: TEMPER.prisAt }; }
  publicNpc(n) { return { id: n.id, name: n.name, title: n.title, look: n.look, v: n.v || 0, x: n.x, z: n.z, y: n.y, ry: n.ry, quests: n.quests || [], vendor: !!n.vendor, upg: n.upg ? 1 : undefined, seenFrom: n.seenFrom, seenUntil: n.seenUntil }; }
  pushSelf(p) { p.session.send({ t: 'you', you: this.privateState(p) }); }
  msg(p, text, color = '#ffd060') { p.session.send({ t: 'ev', list: [{ k: 'msg', text, color }] }); }
  err(p, text) { p.session.send({ t: 'ev', list: [{ k: 'err', text }] }); }
  broadcast(ev) { this.events.push(ev); }

  // ------------------------------------------------------------------ client messages
  on_pos(p, m) {
    if (p.dead) return;
    if (this.ram?.E?.dr === p.id) return; // at the Ram Engine's levers: the engine carries you (shared/ramEngine.js)
    const nx = Number(m.x), nz = Number(m.z);
    if (!isFinite(nx) || !isFinite(nz)) return;
    const d = Math.hypot(nx - p.x, nz - p.z);
    const dtSince = this.time - (p.lastPos || 0);
    p.lastPos = this.time;
    // generous movement check: running + dashes/leaps from skills
    const maxD = (CLASSES[p.cls].speed * 1.6 * (p.mounted ? mountSpeed(p) : 1) + 20) * Math.max(0.1, dtSince) + 18;
    if (d > maxD) { p.session.send({ t: 'correct', x: p.x, z: p.z }); return; }
    if (this.hasCC(p, 'stun') || this.hasCC(p, 'root')) { if (d > 0.5) { p.session.send({ t: 'correct', x: p.x, z: p.z }); return; } }
    if (nx >= DUNGEON_MIN_X) { [p.x, p.z] = dungeonPush(nx, nz, 0.4); }
    else if (p.x >= DUNGEON_MIN_X) { const B = AREA_BY_ID[areaOf(nx, nz)]?.box || WORLD; p.x = clamp(nx, B.minX, B.maxX); p.z = clamp(nz, B.minZ, B.maxZ); } // just out of a dungeon door, into its area
    else {
      // house walls: a move that passes into a wall is sent back (it catches a 1-2 m hop through a wall between two
      // position messages); otherwise the wall push, as on the client. No mounts indoors. Teleports set p.x directly.
      if (houseCrosses(p.x, p.z, nx, nz)) { p.session.send({ t: 'correct', x: p.x, z: p.z }); return; }
      const [cx, cz] = clampWorld(nx, nz, p.x, p.z, 0);
      const [hx, hz] = housePush(cx, cz, 0.4);
      if (p.mounted && houseAt(hx, hz, false) && !houseAt(p.x, p.z, false)) { // (riding in; already inside, e.g. a mounted save, may ride out)
        p.session.send({ t: 'correct', x: p.x, z: p.z });
        if (this.time - (p.mountErrT || -99) > 2) { p.mountErrT = this.time; this.err(p, 'Leave your mount outside.'); }
        return;
      }
      p.x = hx; p.z = hz;
    }
    p.y = Number(m.y) || walkHeight(p.x, p.z);
    p.ry = Number(m.ry) || 0; p.speed = Number(m.s) || 0; p.air = !!m.air;
    if (d > 0.05) { p.eating = 0; p.sit = false; if (p.salv) this.endSalvage(p, false); if (p.cast && !p.cast.channel && !p.cast.sk.move && !MOVERS.has(p.cast.sk.id) && p.cast.end > this.time + 0.05 && !(this.time - (p.dodgeAt ?? -9) < 0.6)) this.cancelCast(p, 'Interrupted'); } // (nor the last of a roll's root motion arriving: a skill out of a dodge, Sidewind Cut) // (a move: true skill fires on the run; a dash, leap or hop back is the move itself)
    this.checkReach(p);
  }

  on_target(p, m) { p.target = m.id || null; }
  // item links in chat: at most four, each a known item id or a rolled piece copied field by field (display only)
  cleanLinks(links, text) {
    if (!Array.isArray(links)) return undefined;
    const num = (v) => (Number.isFinite(+v) ? Math.round(+v) : 0), str = (v, n = 60) => String(v ?? '').slice(0, n);
    const out = [];
    for (const L of links.slice(0, 4)) {
      if (L?.id && ITEMS[L.id]) { if (text.includes(`[${ITEMS[L.id].name}]`)) out.push({ id: L.id }); continue; }
      const g = L?.g;
      if (!g || typeof g !== 'object' || !g.stats || typeof g.stats !== 'object') continue;
      // everything another player will see is checked: no markup in the name, known slots and types only, sane numbers
      const name = str(g.name).replace(/[<>&"]/g, '').trim();
      const SLOTS = ['weapon', 'offhand', 'head', 'shoulders', 'chest', 'back', 'hands', 'legs', 'feet', 'trinket'];
      if (!name || !SLOTS.includes(g.slot) || !text.includes(`[${name}]`)) continue;
      const cap = (v, hi) => Math.max(0, Math.min(hi, num(v)));
      const STATS = ['power', 'armor', 'hp', 'haste', 'crit', 'dodge', 'leech'];
      const statsOf = (o) => { const r = {}; for (const k of STATS) if (o[k]) r[k] = cap(o[k], 9999); return r; };
      const stats = statsOf(g.stats), bs = g.bs && typeof g.bs === 'object' ? statsOf(g.bs) : undefined;
      // rarity 0..6 (Prismatic), upgrade step 0..10 (an old client's reforge rf counts as the step), designed rarity tq
      out.push({ g: { name, slot: g.slot, q: cap(g.q, 6), ilvl: cap(g.ilvl, 99), icon: /^[a-z0-9_~]{1,40}$/i.test(g.icon) ? g.icon : 'ring', stats,
        wtype: WEAPON_TYPES[g.wtype] ? g.wtype : undefined, otype: OFFHAND_TYPES[g.otype] ? g.otype : undefined, weight: ['plate', 'mail', 'cloth'].includes(g.weight) ? g.weight : undefined,
        up: cap(g.up ?? g.rf, UPG.max) || undefined, bs: bs && Object.keys(bs).length ? bs : undefined, tq: g.tq != null ? cap(g.tq, 6) : undefined, bd: g.bd ? 1 : undefined, req: cap(g.req, 99) || undefined } });
    }
    return out.length ? out : undefined;
  }
  on_chat(p, m) {
    const text = String(m.text || '').slice(0, 200).trim();
    if (!text) return;
    if (text.startsWith('/')) return this.command(p, text, this.cleanLinks(m.links, text));
    if (!this.chatOk(p)) return;
    this.broadcast({ k: 'chat', from: p.name, cls: p.cls, text, links: this.cleanLinks(m.links, text) });
    this.botHearWorld?.(p, text);
  }
  command(p, text, links) {
    const [cmd, arg] = text.split(/\s+/);
    if (this.socialCommand(p, cmd.toLowerCase(), text, links)) return;
    if (cmd === '/level' && arg) { p.level = clamp(Number(arg) | 0, 1, LEVEL_CAP); p.xp = 0; this.recalc(p); p.hp = p.maxHp; this.broadcast({ k: 'lvl', id: p.id, level: p.level }); this.achSet(p, 'level', p.level); const L0 = p.level; for (let l = 5; l <= L0; l += 5) { p.level = l; this.levelPost(p); } p.level = L0; this.pushSelf(p); this.msg(p, `You are now level ${p.level}.`); }
    else if (cmd === '/who') this.msg(p, 'Online: ' + [...this.players.values()].filter((q) => !q.bot || q.wander).map((q) => `${q.name} (${q.level} ${CLASSES[q.cls].name})`).join(', '));
    else if (cmd === '/unstuck') { const g = this.graveyard(p); this.teleport(p, g.x, g.z); }
    else if (cmd === '/guild' && arg === 'create') this.guildCreate(p, text.split(/\s+/).slice(2).join(' '));
    else if (cmd === '/ginvite' && arg) this.on_guildInvite(p, { name: arg });
    else if (cmd === '/gleave') this.guildLeave(p);
    else if (cmd === '/gkick' && arg) this.guildKick(p, arg);
    else if (cmd === '/g') { const t = text.slice(2).trim(); if (t) this.guildSay(p, p.name, p.cls, t, false, links); }
    else if (cmd === '/groster') { if (!p.guild) return this.err(p, 'You are not in a guild.'); this.msg(p, `${p.guild.name}, online: ` + this.guildRoster(p).map((r) => `${r.name} (${r.level})`).join(', '), '#7aff9a'); }
    else if (cmd === '/duel' && arg) this.on_duel(p, { name: text.slice(cmd.length).trim() });
    else if (cmd === '/yield') { if (p.duel) { this.msg(p, 'You yield.', '#c8b48a'); this.endDuel(this.players.get(p.duel.with), p); } }
    else if (cmd === '/legend') { this.addItem(p, { gear: this.legendaryFor(p.cls) }); this.pushSelf(p); } // test option
    else if (cmd === '/roll') { const [, qs, ns] = text.split(/\s+/); for (let i = 0; i < clamp(Number(ns) || 1, 1, 12); i++) this.addItem(p, { gear: rollGear(rand, p.level, { q: clamp(Number(qs) | 0, 0, 6), cls: p.cls, weight: CLASS_WEIGHT[p.cls] }) }); this.pushSelf(p); } // test option
    else if (cmd === '/wear') { for (let i = 0; i < clamp(Number(arg) | 0, 1, 10); i++) this.wearGear(p); this.pushSelf(p); }
    else if (cmd === '/qdone' && QUESTS[arg]) { p.done[arg] = true; if (p.quests) { if (Array.isArray(p.quests)) p.quests = p.quests.filter((q) => (q?.id ?? q) !== arg); else delete p.quests[arg]; } this.pushSelf(p); } // a finished quest leaves the log (no second hand-in)
    else if (cmd === '/tp' && p.dead) return this.err(p, 'You cannot travel while dead.');
    else if (cmd === '/tp') { const [, a, b2] = text.split(/\s+/).map(Number); const T =isFinite(a) && isFinite(b2) ? tpSpot(a, b2) : null; if (!T) return this.err(p, 'Use /tp x z.'); this.teleport(p, T.x, T.z); this.checkReach(p); } // test option: the nearest walkable spot in the area the point belongs to (shared/tpspot.js)
    else if (cmd === '/give' && ITEMS[arg]) { this.addItem(p, ITEMS[arg].stats ? { gear: this.fixedGear(arg) } : { id: arg, n: 1 }); this.pushSelf(p); } // test option
    else if (cmd === '/gold' && arg) { p.gold += clamp(Number(arg) | 0, 0, 1000) * 10000; this.pushSelf(p); } // test option, like /level
    else if (cmd === '/invite' && arg) this.invite(p, arg);
    else if (cmd === '/leave') { if (p.party) { this.leaveParty(p); this.msg(p, 'You leave the party.', '#7ab0ff'); } }
    else if (cmd === '/kick' && arg) { const P = this.partyOf(p), q = this.findPlayer(arg) || (P ? this.partyMembers(p).find((r) => r.bot && r.wander && r.name.toLowerCase() === arg.toLowerCase()) : null); if (P && P.leader === p.id && q && q.party === P.id && q.bot && q.wander) this.botKicked(p, q); else if (P && P.leader === p.id && q && q.party === P.id && !q.bot) { this.leaveParty(q); this.msg(q, 'You were removed from the party.', '#7ab0ff'); } }
    else if (cmd === '/lfg') { const [, a1, a2] = text.split(/\s+/); if (!a1) this.lfgSend(p); else if (a1 === 'leave') this.on_lfg(p, { op: 'leave' }); else this.on_lfg(p, { op: 'join', id: a1, role: a2 }); } // the group finder queue (living bots A.7)
    else if (cmd === '/p' || cmd === '/party') { const t = text.slice(cmd.length).trim(); if (!t) return; if (!p.party) return this.err(p, 'You are not in a party.'); if (!this.chatOk(p)) return; for (const q of this.partyMembers(p)) if (!q.bot) q.session.send({ t: 'ev', list: [{ k: 'pchat', from: p.name, cls: p.cls, text: t, links }] }); this.botHearParty?.(p, t); }
    else if (cmd === '/dismiss') this.dismissCompanion(p, false, arg);
    else if (cmd === '/comp') { const [, order, who] = text.split(/\s+/); this.on_compOrder(p, { order, name: who }); }
    else if (EMOTES[cmd.slice(1)]) this.emote(p, cmd.slice(1));
    else if (cmd === '/ram') this.ramNow(arg); // test option (LF.6): the world clock on to the Ram Engine's next run ('/ram end': to just before this run's end)
    else if (cmd === '/gale') this.ridesGaleNow(arg, p); // test option (P15.3): the world clock on to the Russet Weald's next gale ('/gale' its start, '/gale down' or '/gale <n>' its first or n-th trunk down, '/gale cut' the trunk nearest you cut clear)
    else if (cmd === '/event') { const ev = this.wev.find((e) => e.def.id === arg) || this.wev[0]; if (!ev.live) ev.next = this.time; }
    else if (cmd === '/dungeon' && DUNGEON_BY_ID[arg]) { const D = DUNGEON_BY_ID[arg]; this.teleport(p, D.startW[0], D.startW[1]); this.checkReach(p); }
    else this.msg(p, 'Commands: /who, /invite <name>, /leave, /promote <name>, /p <text>, /s <text> (say), /w <name> <text> (whisper), /r <text> (reply), /friend <name>, /trade <name>, /inspect <name>, /dismiss, /unstuck, emotes /wave /cheer /point /salute /clap /laugh /shrug /nod /sit');
  }

  // ------------------------------------------------------------------ emotes
  emote(p, e) {
    if (p.dead) return;
    const t = p.target ? this.entity(p.target) || this.npcs.get(p.target) : null;
    const tn = t && t !== p ? t.name : null;
    const text = `${p.name} ${EMOTES[e]}${tn && e !== 'sit' ? ' at ' + tn : ''}.`;
    if (e === 'sit') { if (p.mounted) this.dismount(p); p.sit = true; }
    this.broadcast({ k: 'emote', id: p.id, e, text });
    // other adventurers are friendly folk: a wave gets a wave back
    if (t?.bot && t.wander && (e === 'wave' || e === 'salute' || e === 'cheer') && !t.dead && !t.target) {
      t.ry = Math.atan2(p.x - t.x, p.z - t.z);
      t.ai.replyT = this.time + 0.8; t.ai.reply = { e, to: p.name };
    }
  }

  // ------------------------------------------------------------------ the storehouse: 30 shelves, nothing more
  storeNear(p) { for (const n of this.npcs.values()) if (n.store && dist(p, n) < 8 && this.indoorOk(p, n)) return n; return null; }
  // an NPC who stands in a house hears you only from inside it, or from within 3 m of its door (no talking through walls)
  indoorOk(p, n) { return !n.house || houseTalkOk(n.house, p.x, p.z); }
  on_deposit(p, m) {
    if (!this.storeNear(p)) return;
    const it = p.bag[m.slot];
    if (!it) return;
    p.bank = p.bank || [];
    const same = it.id && p.bank.find((b) => b.id === it.id && b.n < (ITEMS[it.id].stack || 1));
    if (same) { const room = (ITEMS[it.id].stack || 1) - same.n, k = Math.min(room, it.n); same.n += k; it.n -= k; if (it.n <= 0) p.bag.splice(m.slot, 1); }
    else { if (p.bank.length >= 30) return this.err(p, 'Your storehouse shelves are full.'); p.bank.push(it); p.bag.splice(m.slot, 1); }
    p.session.send({ t: 'bank', items: p.bank });
    this.pushSelf(p);
  }
  on_withdraw(p, m) {
    if (!this.storeNear(p)) return;
    const it = p.bank?.[m.slot];
    if (!it) return;
    if (p.bag.length >= this.bagMax(p) && !(it.id && p.bag.find((b) => b.id === it.id && b.n + it.n <= (ITEMS[it.id].stack || 1)))) return this.err(p, 'Your bags are full.');
    p.bank.splice(m.slot, 1);
    const st = it.id && p.bag.find((b) => b.id === it.id && b.n + it.n <= (ITEMS[it.id].stack || 1));
    if (st) st.n += it.n; else p.bag.push(it);
    p.session.send({ t: 'bank', items: p.bank });
    this.pushSelf(p);
  }

  // ------------------------------------------------------------------ crafting
  takeItems(p, id, n) {
    for (let i = p.bag.length - 1; i >= 0 && n > 0; i--) if (p.bag[i].id === id) { const k = Math.min(n, p.bag[i].n); p.bag[i].n -= k; n -= k; if (p.bag[i].n <= 0) p.bag.splice(i, 1); }
  }
  // upgrade +1..+10 at a smith (plan B3; replaces reforging): Uncommon or better, worn or in the bags. It always works: a
  // known step for a known price in gold and materials. m: { npc, where: 'equip' | 'bag', slot, ref? } where ref is the
  // JSON the client saw (the bag entry, or the worn piece); a ref that no longer matches is refused (the bags moved).
  upgradeSmith(p, id) { const n = this.npcs.get(id); return n && n.upg && n.craft === 'smith' && dist(p, n) <= 7 && this.indoorOk(p, n) ? n : null; }
  on_upgrade(p, m) {
    const n = this.upgradeSmith(p, m.npc);
    if (!n) return;
    const worn = m.where === 'equip';
    const ref = worn ? null : p.bag[m.slot | 0];
    if (!worn && m.slot != null && (m.slot | 0) !== Number(m.slot)) return;
    let base = worn ? p.equip[m.slot] : ref?.gear || (ref?.id && ITEMS[ref.id]?.stats ? migrateGear({ ...ITEMS[ref.id], id: ref.id, stats: { ...ITEMS[ref.id].stats } }, ITEMS) : null);
    if (!base?.stats) return this.err(p, 'Choose a piece of gear to upgrade.');
    if (m.ref != null) { const seen = String(m.ref); if (seen !== JSON.stringify(worn ? base : ref) && seen !== JSON.stringify(base)) return this.err(p, 'Your gear has changed: choose the piece again.'); }
    base = migrateGear(base, ITEMS); // an old reforge still on the piece counts as its steps
    if ((base.q ?? 1) < UPG.minQ) return this.err(p, 'Only Uncommon gear and better can be upgraded.');
    if (!canUpgrade(base)) return this.err(p, `${base.name} is already at +${UPG.max}.`);
    const cost = upgradeCost(base);
    if (p.gold < cost.gold) return this.err(p, 'You cannot afford the smith’s fee.');
    for (const [id, k] of cost.mats) if (this.countItem(p, id) < k) return this.err(p, `You need ${k} ${ITEMS[id].name}.`);
    if (!worn && !p.bag.includes(ref)) return this.err(p, 'Your gear has changed: choose the piece again.');
    for (const [id, k] of cost.mats) this.takeItems(p, id, k);
    p.gold -= cost.gold;
    const up = upgraded(base);
    if (worn) { p.equip[m.slot] = up; this.recalc(p); }
    else { const i = p.bag.indexOf(ref); if (i < 0) p.bag.push({ gear: up }); else p.bag[i] = { gear: up }; } // the bag may have shifted while materials were taken
    this.achAdd(p, 'up');
    if (up.up >= UPG.max) this.achAdd(p, 'up10');
    this.achSet(p, 'up10worn', Object.values(p.equip).filter((g) => g && upOf(g) >= UPG.max).length);
    if (up.up >= 7 && (up.slot === 'weapon' || up.slot === 'offhand')) this.heatFind(p, up.up);
    this.msg(p, `${n.name} upgrades your ${base.name} to +${up.up}${up.up === UPG.max ? ', and opens a new socket' : ''}.`, '#ffd060');
    p.session.send({ t: 'ev', list: [{ k: 'upgrade', where: worn ? 'equip' : 'bag', slot: worn ? m.slot : p.bag.findIndex((b) => b.gear === up), up: up.up, name: gearName(up), q: up.q, gold: cost.gold }] });
    if (worn) this.broadcast({ k: 'upg', id: p.id, up: up.up });
    this.pushSelf(p);
  }
  on_reforge(p, m) { return this.on_upgrade(p, m); } // older clients
  // salvage: break an unwanted piece (in the bags) into materials, at a smith
  on_salvageGear(p, m) {
    const n = this.npcs.get(m.npc);
    if (!n || n.craft !== 'smith' || dist(p, n) > 7) return;
    const it = p.bag[m.slot], g = it?.gear || (it?.id && ITEMS[it.id]?.stats ? { ...ITEMS[it.id], id: it.id } : null);
    if (!g?.stats) return;
    if (m.ref != null && String(m.ref) !== JSON.stringify(it) && String(m.ref) !== JSON.stringify(g)) return this.err(p, 'Your bags have changed: choose the piece again.');
    // a Dragonslayer piece you hold another copy of (worn, in the bags or the storehouse) also gives War-Engine Cores
    const dupDs = !!g.id && String(g.id).startsWith('ds_') && [...Object.values(p.equip || {}), ...p.bag.filter((b) => b !== it).map((b) => b.gear || (b.id === g.id ? b : null)), ...(p.bank || []).map((b) => b.gear || (b.id === g.id ? b : null))].some((x) => x && x.id === g.id);
    const out = salvageYield(g, { dupDs });
    if (!out.length) return this.err(p, 'Only Uncommon gear and better is worth salvaging.');
    // room: the piece's own slot frees one; a material needs a new slot only if no stack of it can take the lot
    const free = this.bagMax(p) - (p.bag.length - 1);
    const need = out.filter(([id, k]) => !p.bag.some((b) => b !== it && b.id === id && b.n + k <= (ITEMS[id].stack || 1))).length;
    if (need > free) return this.err(p, 'Make room in your bags first.');
    p.bag.splice(m.slot, 1);
    for (const [id, k] of out) this.addItem(p, { id, n: k });
    this.achAdd(p, 'salvage');
    this.msg(p, `${n.name} breaks down your ${g.name}: ${out.map(([id, k]) => `${k} ${ITEMS[id].name}`).join(', ')}.`, '#ffd060');
    this.pushSelf(p);
  }
  // a smith takes a gem out of a socket (worn or in the bags) and hands it back
  on_unsocket(p, m) {
    const n = this.npcs.get(m.npc);
    if (!n || n.craft !== 'smith' || dist(p, n) > 7) return;
    const g = m.where === 'equip' ? p.equip[m.slot] : p.bag[m.slot]?.gear;
    const i = m.i | 0, gem = g?.sockets?.[i];
    if (!gem || !ITEMS[gem]) return;
    const fee = unsocketFee(g);
    if (p.gold < fee) return this.err(p, 'You cannot afford the smith\u2019s fee.');
    const stack = p.bag.some((b) => b.id === gem && b.n < (ITEMS[gem].stack || 1));
    if (!stack && p.bag.length >= this.bagMax(p)) return this.err(p, 'Make room in your bags first.');
    p.gold -= fee;
    g.sockets[i] = null;
    this.addItem(p, { id: gem, n: 1 });
    if (m.where === 'equip') this.recalc(p);
    this.msg(p, `${n.name} works the ${ITEMS[gem].name} free of your ${g.name}.`, '#9ac8ff');
    this.pushSelf(p);
  }
  // spare rewards: once a quest is done, whoever you handed it in to sells the rewards you did not pick, once each
  sparePrice(id) { return gearValue(ITEMS[id]) * 8; }
  sparesAt(p, n) {
    const out = [];
    for (const [qid, Q] of Object.entries(QUESTS)) {
      if (Q.daily || Q.turnin !== n.id || !p.done?.[qid] || (Q.rewards || []).length < 2) continue;
      for (const id of Q.rewards) if (id !== p.picks?.[qid] && ITEMS[id]?.twin !== p.picks?.[qid] && !p.spares?.[id] && ITEMS[id]) out.push({ q: qid, id, price: this.sparePrice(id) });
    }
    return out;
  }
  on_buySpare(p, m) {
    const n = this.npcs.get(m.npc), Q = QUESTS[m.q];
    if (!n || !Q || dist(p, n) > 7 || Q.turnin !== n.id || !p.done?.[m.q] || !Q.rewards?.includes(m.id)) return;
    if (m.id === p.picks?.[m.q] || p.spares?.[m.id]) return this.err(p, 'You already have that one.');
    const price = this.sparePrice(m.id);
    if (p.gold < price) return this.err(p, 'You cannot afford that.');
    if (p.bag.length >= this.bagMax(p)) return this.err(p, 'Your bags are full.');
    p.gold -= price;
    (p.spares ||= {})[m.id] = 1;
    this.addItem(p, { gear: this.fixedGear(m.id) });
    this.msg(p, `${n.name} hands over the ${ITEMS[m.id].name}.`, '#ffe08a');
    this.pushSelf(p);
    this.on_npc(p, { id: n.id });
  }
  on_craft(p, m) {
    const R = RECIPE_BY_ID[m.recipe], n = this.npcs.get(m.npc);
    if (!R || !n || n.craft !== R.station || dist(p, n) > 7) return;
    if (p.level < R.lvl) return this.err(p, `You need to be level ${R.lvl} for that.`);
    const skill = (p.prof ||= {})[R.station] || 0;
    if (skill < (R.skill || 0)) return this.err(p, `You need ${PROF_NAME[R.station]} ${R.skill} for that.`);
    for (const [id, k] of R.needs) if (this.countItem(p, id) < k) return this.err(p, `You need ${k} ${ITEMS[id].name}.`);
    if (p.gold < R.cost) return this.err(p, 'You cannot afford the work.');
    const def = ITEMS[R.makes];
    const room = p.bag.length < this.bagMax(p) || (!def.stats && p.bag.some((b) => b.id === R.makes && b.n + R.n <= (def.stack || 1)));
    if (!room) return this.err(p, 'Your bags are full.');
    for (const [id, k] of R.needs) this.takeItems(p, id, k);
    p.gold -= R.cost;
    this.addItem(p, def.stats ? { gear: this.fixedGear(R.makes) } : { id: R.makes, n: R.n });
    this.achAdd(p, 'crafts');
    // practice makes the craft: orange always teaches, yellow most of the time, green now and then
    const col = profColor(skill, R.skill || 0), ch = { orange: 1, yellow: 0.6, green: 0.25 }[col] || 0;
    if (skill < PROF_MAX && rand() < ch) { p.prof[R.station] = skill + 1; this.msg(p, `Your ${PROF_NAME[R.station]} rises to ${skill + 1}.`, '#7ad0ff'); this.achSet(p, 'prof', Math.max(...Object.values(p.prof))); }
    this.broadcast({ k: 'craft', id: p.id });
    this.pushSelf(p);
  }

  // ------------------------------------------------------------------ group loot: claim or pass, shared fairly (no dice)
  claimable(it) { return it.gear ? (it.gear.q ?? 1) >= 2 : !!(ITEMS[it.id]?.stats || ITEMS[it.id]?.set || ITEMS[it.id]?.pet || (ITEMS[it.id]?.q || 0) >= 3); }
  startClaim(party, humans, item, m) {
    this.claims ||= new Map();
    const c = { id: newId('c'), item, who: humans.map((q) => q.id), votes: {}, end: this.time + 30, party, mob: m.id, from: m.def.name };
    this.claims.set(c.id, c);
    const show = item.gear ? { gear: item.gear } : { id: item.id, n: item.n };
    for (const q of humans) q.session.send({ t: 'ev', list: [{ k: 'claim', cid: c.id, item: show, secs: 30, from: m.def.name }] });
  }
  on_claim(p, m) {
    const c = this.claims?.get(m.cid);
    if (!c || !c.who.includes(p.id) || c.votes[p.id]) return;
    c.votes[p.id] = m.want ? 'claim' : 'pass';
    if (c.who.every((id) => c.votes[id] || !this.players.get(id))) this.settleClaim(c);
  }
  gearValue(g) { return g?.stats ? (g.stats.power || 0) * 1.6 + (g.stats.armor || 0) * 0.3 + (g.stats.hp || 0) * 0.9 + (g.stats.haste || 0) * 1.2 : 0; }
  settleClaim(c) {
    this.claims.delete(c.id);
    const P = this.parties.get(c.party);
    const shares = (P && (P.shares ||= {})) || {};
    const g = c.item.gear || ITEMS[c.item.id], name = g.name;
    const people = c.who.map((id) => this.players.get(id)).filter(Boolean);
    const want = people.filter((q) => c.votes[q.id] === 'claim');
    const tell = (text) => { for (const q of people) this.msg(q, text, '#c8a0ff'); };
    if (!want.length) {
      // nobody wanted it: back on the wreck for whoever picks it up
      const mob = this.mobs.get(c.mob);
      if (mob && mob.dead) { mob.loot ||= { gold: 0, items: [], owners: c.who }; mob.loot.items.push(c.item); this.broadcast({ k: 'lootable', id: mob.id }); }
      return tell(`Everyone passed on ${name}.`);
    }
    // fewest shares first, then whoever it helps most
    const gain = (q) => this.gearValue(g) - this.gearValue(q.equip[g.slot]);
    want.sort((a, b) => (shares[a.id] || 0) - (shares[b.id] || 0) || gain(b) - gain(a) || a.id.localeCompare(b.id));
    const w = want[0];
    shares[w.id] = (shares[w.id] || 0) + 1;
    this.achAdd(w, 'claims');
    tell(want.length > 1 ? `${w.name} receives ${name} (${want.length} claimed it; shared fairly).` : `${w.name} receives ${name}.`);
    this.pendGot(w, c.item.gear);
    if (!this.addItem(w, c.item.gear ? { gear: c.item.gear } : { id: c.item.id, n: c.item.n || 1 })) {
      this.systemPost(w, 'The party\u2019s spoils', `${name}`, 'Your bags were full, so your share was sent by post.', { item: c.item });
      this.msg(w, `Your bags are full: ${name} was sent to you by post.`, '#ffe08a');
    }
    this.pushSelf(w);
  }

  // ------------------------------------------------------------------ the Proving Ring's weekly ladder
  ringBots(week) {
    let s = (week * 2654435761 + 97) >>> 0;
    const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return WANDERERS.map((W) => ({ name: W.name, cls: W.cls, best: Math.max(2, Math.min(18, Math.round(3 + W.lvl / 3 + rnd() * 7))), bot: true }));
  }
  ringLadder(p, week = this.bountyWeek()) {
    const rows = this.ringBots(week);
    for (const q of this.players.values()) if (!q.bot && q.ringWeek?.week === week && q.ringWeek.best > 0) rows.push({ name: q.name, cls: q.cls, best: q.ringWeek.best, you: q === p });
    rows.sort((a, b) => b.best - a.best || (a.bot ? 1 : 0) - (b.bot ? 1 : 0));
    return { week, rows: rows.slice(0, 10), rank: rows.findIndex((r) => r.you) + 1, next: ((week + 1) * 7 - 3) * 864e5 };
  }
  // when a new week starts, last week's top three are paid
  ringSettle(p) {
    const wk = this.bountyWeek(), last = p.ringWeek;
    if (last && last.week < wk && last.best > 0 && !last.paid) {
      const rows = [...this.ringBots(last.week), { name: p.name, best: last.best, you: true }].sort((a, b) => b.best - a.best || (a.you ? -1 : 1));
      const rank = rows.findIndex((r) => r.you) + 1;
      if (rank <= 3) {
        const gold = [5000, 3000, 2000][rank - 1];
        p.gold += gold; this.achAdd(p, 'gold', gold); this.achAdd(p, 'ringPodium');
        this.systemPost(p, 'Arena Master Torvin', 'The ring\u2019s ladder', `Last week you finished ${['first', 'second', 'third'][rank - 1]} on the Proving Ring\u2019s ladder with ${last.best} waves. The purse is yours, and the ring remembers.`, { gold: 0 });
        this.msg(p, `Proving Ring ladder: you placed ${['first', 'second', 'third'][rank - 1]} last week! +${gold} copper.`, '#ffc040');
      }
    }
    p.ringWeek = { week: wk, best: 0 };
    this.pushSelf(p);
  }

  // ------------------------------------------------------------------ guilds
  guildMembersOnline(name) { return [...this.players.values()].filter((q) => !q.bot && q.guild?.name === name); }
  guildBots(name) { const names = new Set(); for (const q of this.guildMembersOnline(name)) for (const b of q.guild.bots || []) names.add(b); return [...this.players.values()].filter((b) => b.wander && names.has(b.name)); }
  guildRoster(p) {
    if (!p.guild) return [];
    return [...this.guildMembersOnline(p.guild.name), ...this.guildBots(p.guild.name)].map((q) => ({ name: q.name, level: q.level, cls: q.cls, rank: q.bot ? 'Member' : q.guild.rank, bot: !!q.bot }));
  }
  guildCreate(p, raw) {
    const name = String(raw || '').replace(/[^A-Za-z ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24).replace(/\b\w/g, (c) => c.toUpperCase());
    if (p.guild) return this.err(p, 'You are already in a guild. /gleave first.');
    if (name.length < 3) return this.err(p, 'Name your guild: /guild create Name (letters and spaces, 3 to 24).');
    if (p.gold < GUILD.cost) return this.err(p, 'A guild charter costs 10 silver.');
    p.gold -= GUILD.cost;
    p.guild = { name, rank: 'Leader', bots: [] };
    this.msg(p, `You found the guild <${name}>. Invite people with /ginvite name or the target frame; talk with /g.`, '#7aff9a');
    this.achAdd(p, 'guild');
    this.pushSelf(p);
  }
  on_guildInvite(p, m) {
    if (!p.guild) return this.err(p, 'You are not in a guild.');
    const n = String(m.name || '').toLowerCase();
    const q = m.id ? this.players.get(m.id) : [...this.players.values()].find((x) => (!x.bot || x.wander) && x.name.toLowerCase() === n);
    if (!q || q === p || (q.bot && !q.wander)) return this.err(p, 'Invite whom?');
    if (q.bot) {
      const taken = [...this.players.values()].some((h) => !h.bot && (h.guild?.bots || []).includes(q.name));
      if (taken) return this.err(p, `${q.name} already belongs to a guild.`);
      if ((p.guild.bots || []).length >= GUILD.maxBots) return this.err(p, `You can recruit ${GUILD.maxBots} adventurers at most.`);
      const yes = rand() < 0.75;
      setTimeout(() => {
        if (!p.guild || !this.players.has(p.id)) return;
        if (yes) { (p.guild.bots ||= []).push(q.name); this.botSay(q, 'guild', 'guild_join_yes', { to: p, must: 1, slots: { guild: p.guild.name } }); this.pushSelf(p); }
        else this.botSay(q, 'whisper', 'guild_join_no', { to: p, must: 1 }); // (a no is said to the one who asked, not the whole valley)
      }, 1500);
      return this.msg(p, `You invite ${q.name} to <${p.guild.name}>.`, '#7aff9a');
    }
    if (q.guild) return this.err(p, `${q.name} is already in a guild.`);
    q.guildAsk = { name: p.guild.name, from: p.name, t: this.time + 60 };
    q.session.send({ t: 'ev', list: [{ k: 'guildAsk', from: p.name, cls: p.cls, guild: p.guild.name }] });
    this.msg(p, `You invite ${q.name} to <${p.guild.name}>.`, '#7aff9a');
  }
  on_guildReply(q, m) {
    const ask = q.guildAsk; q.guildAsk = null;
    if (!ask || this.time > ask.t || !m.accept || q.guild) return;
    q.guild = { name: ask.name, rank: 'Member', bots: [] };
    this.guildSay(q, q.name, q.cls, 'Hello, everyone!', true);
    this.achAdd(q, 'guild');
    this.pushSelf(q);
  }
  guildLeave(p) {
    if (!p.guild) return;
    const name = p.guild.name;
    this.guildSay(p, p.name, p.cls, 'I am leaving the guild. Fare well.', true);
    p.guild = null;
    this.msg(p, `You leave <${name}>.`, '#7aff9a');
    this.pushSelf(p);
  }
  guildKick(p, who) {
    if (!p.guild) return;
    const i = (p.guild.bots || []).findIndex((n) => n.toLowerCase() === String(who).toLowerCase());
    if (i < 0) return this.err(p, 'You can only send away adventurers you recruited.');
    const [n] = p.guild.bots.splice(i, 1);
    this.msg(p, `${n} leaves <${p.guild.name}>.`, '#7aff9a');
    this.pushSelf(p);
  }
  // guild chat reaches every member online
  guildSay(p, from, cls, text, sys, links, bot) {
    if (!p.guild) return this.err(p, 'You are not in a guild.');
    for (const q of this.guildMembersOnline(p.guild.name)) q.session.send({ t: 'ev', list: [{ k: 'gchat', from, bot: bot ? 1 : undefined, cls, text: String(text).slice(0, 200), guild: p.guild.name, links }] });
  }
  guildGreet(p) {
    if (!p.guild || !this.players.has(p.id)) return;
    const bots = this.guildBots(p.guild.name);
    if (bots.length) { const b = bots[RI(0, bots.length - 1)]; this.botSay(b, 'guild', 'guild_greet', { to: p, slots: { name: p.name } }); }
  }
  tickGuilds(dt) {
    this.gchatT = (this.gchatT ?? R(240, 480)) - dt;
    if (this.gchatT > 0) return;
    this.gchatT = R(360, 840);
    const names = new Set([...this.players.values()].filter((q) => !q.bot && q.guild).map((q) => q.guild.name));
    for (const name of names) {
      const bots = this.guildBots(name), lead = this.guildMembersOnline(name)[0];
      if (bots.length && lead) { const b = bots[RI(0, bots.length - 1)]; this.botSay(b, 'guild', 'guild_ambient', { to: lead, slots: { guild: name } }); }
    }
  }

  // ------------------------------------------------------------------ the bounty board
  // the dungeon board: rides to any dungeon near your level, and a featured dungeon each day
  featured() { const t = this.today(), L = DUNGEONS.filter((D) => !D.open); return L[((t * 2654435761) >>> 0) % L.length].id; }
  // the featured bonus is paid for each dungeon's final boss: the last boss spawn listed for it
  finalBoss(id) { return (this._finalBoss ||= Object.fromEntries(DUNGEONS.map((D) => [D.id, SPAWNS.filter((sp) => sp.dungeon === D.id && MOBS[sp.mob]?.boss).at(-1)?.mob])))[id]; }
  dungeonRides(p, n) {
    const feat = this.featured();
    return { featured: feat, done: p.daily?.feat === this.today(), list: DUNGEONS.filter((D) => !D.open).map((D) => { const lo = parseInt(D.level, 10); const L = D.raid && p.raidLock?.w === weekNumber() ? p.raidLock.k : {}; const lock = D.raid ? SPAWNS.filter((sp) => sp.dungeon === D.id && MOBS[sp.mob].boss).map((sp) => ({ name: MOBS[sp.mob].name, done: !!L[sp.mob] })) : null; return { id: D.id, name: D.name, level: D.level, raid: !!D.raid, lock, ok: p.level >= lo - 2, cost: Math.max(20, Math.round(Math.hypot(D.door.x - n.x, D.door.z - n.z) / 10) * 8) }; }) };
  }
  on_dungeonRide(p, m) {
    const n = this.npcs.get(m.npc), D = DUNGEON_BY_ID[m.id];
    if (!n?.bounty || !D || dist(p, n) > 8 || p.dead || !this.indoorOk(p, n)) return;
    const R = this.dungeonRides(p, n).list.find((x) => x.id === D.id);
    if (!R.ok) return this.err(p, `${D.name} is for level ${D.level}.`);
    if (D.need?.done && !p.done?.[D.need.done]) return this.err(p, D.need.text || `${D.name} is shut for now.`); // a story-gated door: no fare for a door that will not open
    if (this.time - p.combatT < 5) return this.err(p, 'You cannot travel while in combat.');
    if (p.gold < R.cost) return this.err(p, 'You cannot afford the ride.');
    p.gold -= R.cost;
    const a = D.door.ry;
    this.teleport(p, D.door.x + Math.sin(a) * 4, D.door.z + Math.cos(a) * 4);
    this.msg(p, `The watch cart drops you at the door of ${D.name}.`, '#e8c26a');
    this.checkReach(p); this.pushSelf(p);
  }
  featuredBonus(p, dungeonId) {
    if (p.bot || dungeonId !== this.featured() || p.daily?.feat === this.today()) return;
    (p.daily ||= {}).feat = this.today();
    const gold = p.level * 100;
    p.gold += gold; this.achAdd(p, 'gold', gold); this.achAdd(p, 'featured');
    if (p.level < LEVEL_CAP) this.giveXp(p, Math.round(xpForLevel(p.level) * 0.15));
    this.msg(p, `Featured dungeon cleared: +${gold} copper${p.level < LEVEL_CAP ? ' and a share of experience' : ''} from the watch.`, '#ffc040');
  }
  tmod(m, id) { return !!m?.tempest && tempestMods().includes(id); }
  bountyWeek() { return Math.floor((Date.now() / 864e5 + 3) / 7); } // weeks turn over on Monday
  bounties() {
    const week = this.bountyWeek();
    if (this._bty?.week === week) return this._bty;
    let s = (week * 2246822519) >>> 0;
    const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const seen = new Set(), out = [];
    for (const sp of SPAWNS) {
      const d = MOBS[sp.mob];
      if (seen.has(sp.mob) || (sp.dungeon && !DUNGEON_BY_ID[sp.dungeon]?.open) || d.world || !(d.rare || d.elite || d.boss) || d.lvl[0] < 4) continue;
      seen.add(sp.mob); out.push({ kind: sp.mob, where: zoneAt(sp.x, sp.z).name });
    }
    const low = out.filter((b) => MOBS[b.kind].lvl[0] <= 12), high = out.filter((b) => MOBS[b.kind].lvl[0] > 12);
    const pick = (arr) => arr.splice(Math.floor(rnd() * arr.length), 1)[0];
    const list = [pick(low.length ? low : out), pick(high.length ? high : out)].filter(Boolean);
    const bosses = DUNGEON_BOSSES.map((k) => ({ kind: k, where: DUNGEON_BY_ID[SPAWNS.find((sp) => sp.mob === k)?.dungeon]?.name || 'a dungeon' }));
    list.push(pick(bosses), pick(bosses));
    for (const b of list) {
      const d = MOBS[b.kind], sp = SPAWNS.find((x) => x.mob === b.kind);
      b.name = d.name; b.lvl = d.lvl[0]; b.boss = DUNGEON_BOSSES.includes(b.kind);
      b.gold = d.lvl[0] * (b.boss ? 120 : 70);
      const D = sp?.dungeon ? DUNGEON_BY_ID[sp.dungeon] : null;
      b.faction = D && !D.open ? factionOfZone(zoneAt(D.door.x, D.door.z).id) : factionOfZone(zoneAt(sp.x, sp.z).id);
    }
    this._bty = { week, list, next: ((week + 1) * 7 - 3) * 864e5 };
    return this._bty;
  }
  myBounty(p) { const w = this.bountyWeek(); if (!p.bounty || p.bounty.week !== w) p.bounty = { week: w, killed: {}, claimed: {} }; return p.bounty; }
  bountyState(p) { const B = this.bounties(), me = this.myBounty(p); return { list: B.list.map((b) => ({ ...b, killed: !!me.killed[b.kind], claimed: !!me.claimed[b.kind] })), next: B.next }; }
  bountyKill(p, kind) {
    if (p.bot) return;
    const b = this.bounties().list.find((x) => x.kind === kind), me = this.myBounty(p);
    if (!b || me.killed[kind]) return;
    me.killed[kind] = true;
    this.msg(p, `Bounty: ${b.name} is down. Report to Clerk Wendel by the Sunmere guild hall.`, '#ffc040');
  }
  on_bountyClaim(p, m) {
    const n = this.npcs.get(m.npc);
    if (!n?.bounty || dist(p, n) > 8 || !this.indoorOk(p, n)) return;
    const b = this.bounties().list.find((x) => x.kind === m.kind), me = this.myBounty(p);
    if (!b || !me.killed[b.kind] || me.claimed[b.kind]) return;
    me.claimed[b.kind] = true;
    p.gold += b.gold; this.achAdd(p, 'gold', b.gold); this.achAdd(p, 'bounties');
    if (p.level < LEVEL_CAP) this.giveXp(p, Math.round(xpForLevel(p.level) * 0.08));
    if (b.faction) this.addRep(p, b.faction, BOUNTY.rep);
    this.msg(p, `Bounty claimed: ${b.name}. +${b.gold} copper.`, '#ffc040');
    this.pushSelf(p);
    p.session.send({ t: 'bounty', ...this.bountyState(p) });
  }

  // ------------------------------------------------------------------ the trading post
  tradeNpc(p, id) { const n = this.npcs.get(id); return n?.trade && dist(p, n) <= 8 && this.indoorOk(p, n) ? n : null; }
  workOrders() {
    const seed = Math.floor(Date.now() / 1000 / TRADE.period);
    if (this._wo?.seed === seed) return this._wo;
    let s = seed * 2654435761 >>> 0;
    const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const goods = Object.keys(TRADE.goods), list = [];
    for (let k = 0; k < TRADE.orders && goods.length; k++) {
      const item = goods.splice(Math.floor(rnd() * goods.length), 1)[0], lvl = TRADE.goods[item];
      const from = ORDER_FROM.filter((f) => f[2] <= lvl + 2 && (lvl < 18 || f[1] === 'highreach'));
      const F = from[Math.floor(rnd() * from.length)] || ORDER_FROM[0];
      list.push({ id: `wo${seed}_${k}`, item, n: 5 + Math.floor(rnd() * 11), pay: Math.max(2, Math.round((ITEMS[item].price || 1) * 3 * (1.6 + rnd() * 0.8))), from: F[0], faction: F[1] });
    }
    this._wo = { seed, list, next: (seed + 1) * TRADE.period * 1000 };
    return this._wo;
  }
  myWo(p) { const W = this.workOrders(); if (!p.wo || p.wo.seed !== W.seed) p.wo = { seed: W.seed, got: {} }; return p.wo; }
  sendTrade(p) {
    const W = this.workOrders(), mine = this.myWo(p);
    const others = [];
    for (const q of this.players.values()) if (!q.bot && q !== p) for (const o of q.buyOrders || []) others.push({ owner: q.id, by: q.name, ...o });
    p.session.send({ t: 'trade', work: W.list.map((o) => ({ ...o, got: mine.got[o.id] || 0 })), next: W.next, mine: p.buyOrders, others });
  }
  on_tradeOpen(p, m) { if (this.tradeNpc(p, m.npc)) this.sendTrade(p); }
  on_tradeFill(p, m) {
    if (!this.tradeNpc(p, m.npc)) return;
    const o = this.workOrders().list.find((x) => x.id === m.id);
    if (!o) return this.err(p, 'That order has been taken down.');
    const mine = this.myWo(p), left = o.n - (mine.got[o.id] || 0), k = Math.min(left, this.countItem(p, o.item));
    if (k <= 0) return this.err(p, left <= 0 ? 'That order is already filled.' : `You have no ${ITEMS[o.item].name}.`);
    this.takeItems(p, o.item, k);
    mine.got[o.id] = (mine.got[o.id] || 0) + k;
    p.gold += k * o.pay; this.achAdd(p, 'gold', k * o.pay); this.achAdd(p, 'orders', k);
    this.msg(p, `Delivered ${k} ${ITEMS[o.item].name} to ${o.from.split(',')[0]}: +${k * o.pay} copper.`, '#ffe08a');
    this.addRep(p, o.faction, k * 3);
    this.pushSelf(p); this.sendTrade(p);
  }
  on_tradePost(p, m) {
    if (!this.tradeNpc(p, m.npc)) return;
    if (!TRADE.goods[m.item]) return;
    const n = clamp(m.n | 0, 1, TRADE.maxN), price = clamp(m.price | 0, 1, 100000), total = n * price, fee = Math.ceil(total * TRADE.fee);
    if ((p.buyOrders || []).length >= TRADE.maxOwn) return this.err(p, `You can keep ${TRADE.maxOwn} buy orders at a time.`);
    if (p.gold < total + fee) return this.err(p, 'You cannot cover that order.');
    p.gold -= total + fee;
    (p.buyOrders ||= []).push({ id: newId('o'), item: m.item, n, price, got: 0, t: Date.now() });
    this.msg(p, `Buy order posted: ${n} ${ITEMS[m.item].name} at ${price} copper each (fee ${fee}). The goods come by post.`, '#ffe08a');
    this.pushSelf(p); this.sendTrade(p);
  }
  on_tradeCancel(p, m) {
    if (!this.tradeNpc(p, m.npc)) return;
    const i = (p.buyOrders || []).findIndex((o) => o.id === m.id);
    if (i < 0) return;
    const o = p.buyOrders.splice(i, 1)[0], back = (o.n - o.got) * o.price;
    p.gold += back;
    this.msg(p, `Order withdrawn: ${back} copper returned.`, '#ffe08a');
    this.pushSelf(p); this.sendTrade(p);
  }
  // sell into another player's buy order: coin now, the goods go to them by post
  on_tradeSell(p, m) {
    if (!this.tradeNpc(p, m.npc)) return;
    const q = this.players.get(m.owner), o = q?.buyOrders?.find((x) => x.id === m.id);
    if (!o || q === p) return this.err(p, 'That order is gone.');
    const k = Math.min(o.n - o.got, this.countItem(p, o.item));
    if (k <= 0) return this.err(p, `You have no ${ITEMS[o.item].name}.`);
    this.takeItems(p, o.item, k);
    p.gold += k * o.price;
    this.fillOrder(q, o, k, p.name);
    this.msg(p, `Sold ${k} ${ITEMS[o.item].name} to ${q.name} for ${k * o.price} copper.`, '#ffe08a');
    this.pushSelf(p); this.sendTrade(p);
  }
  fillOrder(q, o, k, seller) {
    o.got += k;
    const letter = { id: newId('l'), from: seller, sub: `Your order: ${k} ${ITEMS[o.item].name}`, body: `${k} ${ITEMS[o.item].name} for your buy order at the Trading Post, as agreed.`, t: Date.now(), read: false, gold: 0, item: { id: o.item, n: k } };
    if (q.mail.length >= POST.max) q.mail.shift();
    q.mail.push(letter);
    const done = o.got >= o.n;
    if (done) q.buyOrders = q.buyOrders.filter((x) => x !== o);
    q.session.send({ t: 'ev', list: [{ k: 'msg', text: `${seller} filled ${k} of your order for ${ITEMS[o.item].name}${done ? ' (complete)' : ''}. The goods are in the post.`, color: '#ffe08a' }, { k: 'mailNew' }] });
    this.pushSelf(q);
  }
  // the valley's adventurers sell into buy orders that pay a fair price
  tickOrders(p) {
    for (const o of [...p.buyOrders]) {
      const ratio = o.price / tradeFair(o.item);
      if (rand() > clamp((ratio - 0.75) * 0.9, 0, 0.7)) continue;
      const k = Math.min(o.n - o.got, RI(1, 4));
      const seller = WANDERERS[RI(0, WANDERERS.length - 1)].name;
      this.fillOrder(p, o, k, seller);
    }
  }

  // ------------------------------------------------------------------ the post
  postNpc(p, id) { const n = this.npcs.get(id); return n?.caravan && dist(p, n) <= 8 ? n : null; }
  sendPost(p) { p.session.send({ t: 'mail', list: p.mail.map((m) => ({ ...m })) }); }
  on_mailOpen(p, m) { if (this.postNpc(p, m.npc)) this.sendPost(p); }
  // deliver a letter to a character by name; returns false when there is no such character
  deliver(name, letter) {
    const key = String(name).toLowerCase();
    const on = [...this.players.values()].find((q) => !q.bot && q.name.toLowerCase() === key);
    if (on) {
      if (on.mail.length >= POST.max) return 'full';
      on.mail.push(letter);
      on.session.send({ t: 'ev', list: [{ k: 'msg', text: `New post from ${letter.from}: "${letter.sub}"`, color: '#ffe08a' }, { k: 'mailNew' }] });
      this.pushSelf(on);
      return true;
    }
    this.postCache ||= new Map();
    const saved = this.postCache.get(key) || this.io.load(name);
    if (!saved) return false;
    saved.mail ||= [];
    if (saved.mail.length >= POST.max) return 'full';
    saved.mail.push(letter);
    this.postCache.set(key, saved);
    this.io.save(name, saved);
    return true;
  }
  systemPost(p, from, sub, body, extra = {}) {
    const letter = { id: newId('l'), from, sub, body, t: Date.now(), read: false, gold: extra.gold || 0, item: extra.item || null, npc: true };
    if (p.mail.length >= POST.max) p.mail.shift();
    p.mail.push(letter);
    p.session.send({ t: 'ev', list: [{ k: 'msg', text: `New post from ${from}: "${sub}"`, color: '#ffe08a' }, { k: 'mailNew' }] });
  }
  on_mailSend(p, m) {
    if (!this.postNpc(p, m.npc)) return;
    const to = String(m.to || '').replace(/[^A-Za-z]/g, '').slice(0, 14);
    const sub = String(m.sub || '').replace(/[<>]/g, '').slice(0, 40).trim() || '(no subject)';
    const body = String(m.body || '').replace(/[<>]/g, '').slice(0, 500);
    const gold = Math.max(0, Math.floor(Number(m.gold) || 0));
    if (!to) return this.err(p, 'Who is the letter for?');
    if (to.toLowerCase() === p.name.toLowerCase()) return this.err(p, 'You cannot send post to yourself.');
    const slot = m.slot == null ? -1 : Number(m.slot) | 0;
    const it = slot >= 0 ? p.bag[slot] : null;
    if (slot >= 0 && (!it || (m.ref && JSON.stringify(it) !== m.ref))) return this.err(p, 'Your bags have changed: attach the item again.');
    if (it?.id && ITEMS[it.id].slot === 'quest') return this.err(p, 'Quest items cannot be sent.');
    if (it?.gear && this.bound(it.gear)) return this.err(p, `${it.gear.name} is bound to you and cannot be sent.`);
    if (p.gold < POST.cost + gold) return this.err(p, 'You cannot afford that (postage is 30 copper).');
    const letter = { id: newId('l'), from: p.name, sub, body, t: Date.now(), read: false, gold, item: it ? JSON.parse(JSON.stringify(it)) : null };
    const ok = this.deliver(to, letter);
    if (ok === 'full') return this.err(p, `${to}'s post box is full.`);
    if (!ok) return this.err(p, `No one by the name of ${to} lives in the valley.`);
    p.gold -= POST.cost + gold;
    if (it) p.bag.splice(slot, 1);
    this.achAdd(p, 'letters');
    this.msg(p, `Your letter to ${to[0].toUpperCase() + to.slice(1).toLowerCase()} is on its way.`, '#ffe08a');
    this.pushSelf(p);
    p.session.send({ t: 'mailSent' });
  }
  levelPost(p) {
    if (p.bot) return;
    const L = { 5: ['Marshal Aldric', 'A word of thanks', 'Five seasons I have watched recruits come and go. You are still here, which is more than most. Buy yourself a good meal.', 60],
      10: ['Gearwright Ottmar', 'Runabouts!', 'You are ready to drive one of my runabouts. Come and see me by the Sunmere workshop, I will show you the levers.', 0],
      15: ['Captain Tariq', 'From the Sunscar', 'Word of your work reaches even Dunewatch. The desert road could use someone like you. Water and coin for the journey.', 150],
      20: ['Warden-Captain Edris', 'The Highreach', 'The road up to the Highreach Lookout is open again. Up here the storms come down the cliffs and the machines are bigger. We need you.', 300],
      25: ['Marshal Aldric', 'The whole valley', 'From the farms to the Stormworks, there is not a road in the valley you have not made safer. Sunmere is proud of you.', 1000] }[p.level];
    if (L && !p.done['post' + p.level]) { p.done['post' + p.level] = true; this.systemPost(p, L[0], L[1], L[2], { gold: L[3] }); }
  }
  on_mailRead(p, m) { const l = p.mail.find((x) => x.id === m.id); if (l && !l.read) { l.read = true; this.pushSelf(p); } }
  on_mailTake(p, m) {
    if (!this.postNpc(p, m.npc)) return;
    const l = p.mail.find((x) => x.id === m.id);
    if (!l) return;
    if (l.gold) { p.gold += l.gold; this.msg(p, `You take ${l.gold} copper from the letter.`, '#ffe08a'); l.gold = 0; }
    if (l.item && this.addItem(p, l.item.gear ? { gear: l.item.gear } : { id: l.item.id, n: l.item.n || 1 }, { traded: !l.npc })) l.item = null;
    l.read = true;
    this.pushSelf(p); this.sendPost(p);
  }
  on_mailDelete(p, m) {
    if (!this.postNpc(p, m.npc)) return;
    const i = p.mail.findIndex((x) => x.id === m.id);
    if (i < 0) return;
    if (p.mail[i].item || p.mail[i].gold) return this.err(p, 'Take what is in the letter first.');
    p.mail.splice(i, 1);
    this.pushSelf(p); this.sendPost(p);
  }

  // ------------------------------------------------------------------ duels
  rad(e) { return e.def?.radius ?? 0.5; }
  duelOn(p) { return !!p.duel && this.time >= p.duel.start; }
  foeOf(p, id) {
    const m = this.mobs.get(id);
    if (m) return m.dead ? null : m;
    if (p.duel && id === p.duel.with && this.duelOn(p)) { const q = this.players.get(id); return q && !q.dead ? q : null; }
    return null;
  }
  foesOf(p) {
    const list = [...this.mobs.values()].filter((m) => !m.dead);
    const q = this.duelOn(p) ? this.players.get(p.duel.with) : null;
    if (q && !q.dead) list.push(q);
    return list;
  }
  duelable(q) { return !!q && !q.dead && !q.held && !q.duel && !q.trial && (!q.bot || !!q.wander) && q.x < DUNGEON_MIN_X; }
  on_duel(p, m) {
    const n = String(m.name || '').toLowerCase();
    const q = m.id ? this.players.get(m.id) : [...this.players.values()].find((x) => (!x.bot || x.wander) && x.name.toLowerCase() === n);
    if (!q || q === p) return this.err(p, 'Challenge whom?');
    if (q.bot && !q.wander) return this.err(p, `${q.name} will not duel.`);
    if (!this.duelable(p)) return this.err(p, 'You cannot duel right now.');
    if (!this.duelable(q)) return this.err(p, `${q.name} cannot duel right now.`);
    if (dist(p, q) > 20) return this.err(p, `${q.name} is too far away.`);
    if (this.time - p.combatT < 5) return this.err(p, 'Catch your breath first.');
    this.msg(p, `You challenge ${q.name} to a duel.`, '#ffc040');
    if (q.bot) {
      // the valley's adventurers take up a challenge when they are rested and close in level
      const yes = q.hp > q.maxHp * 0.8 && Math.abs(q.level - p.level) <= 6 && this.time - q.combatT > 5;
      q.ai.duelReply = { from: p.id, yes, t: this.time + R(1.2, 2.5) };
      return;
    }
    q.duelAsk = { from: p.id, t: this.time + 30 };
    q.session.send({ t: 'ev', list: [{ k: 'duelAsk', from: p.name, cls: p.cls }] });
  }
  on_duelReply(q, m) {
    const ask = q.duelAsk; q.duelAsk = null;
    const p = ask && this.time < ask.t ? this.players.get(ask.from) : null;
    if (!p) return;
    if (!m.accept) return this.msg(p, `${q.name} declines your duel.`, '#c8b48a');
    this.startDuel(p, q);
  }
  startDuel(p, q) {
    if (!this.duelable(p) || !this.duelable(q) || dist(p, q) > 26) return this.err(p, 'The duel cannot start.');
    const x = (p.x + q.x) / 2, z = (p.z + q.z) / 2, start = this.time + DUEL.countdown, end = start + DUEL.time;
    p.duel = { with: q.id, start, end, x, z, go: false };
    q.duel = { with: p.id, start, end, x, z, go: false };
    this.dismount(p); this.dismount(q);
    for (const r of [p, q]) if (!r.bot) { r.session.send({ t: 'ev', list: [{ k: 'yell', text: `Duel with ${(r === p ? q : p).name} in 3 seconds...` }, { k: 'duel', with: (r === p ? q : p).id, start, x, z }] }); this.pushSelf(r); }
  }
  tickDuel(p) {
    const D = p.duel, q = this.players.get(D.with);
    if (!q || q.duel?.with !== p.id) { p.duel = null; this.pushSelf(p); return; }
    if (!D.go && this.time >= D.start) { D.go = true; if (!p.bot) { p.session.send({ t: 'ev', list: [{ k: 'yell', text: 'Fight!' }] }); this.pushSelf(p); } }
    if (p.dead) return this.endDuel(q, p);
    if (Math.hypot(p.x - D.x, p.z - D.z) > DUEL.range) { this.msg(p, 'You strayed too far and forfeit the duel.', '#ff8060'); return this.endDuel(q, p); }
    if (this.time > D.end) return this.endDuel(null, p);
  }
  endDuel(w, l) {
    // w beats l; with no winner the duel is a draw
    const o = this.players.get(l.duel?.with);
    const both = [l, o].filter(Boolean), ids = both.map((r) => r.id);
    for (const r of both) {
      r.duel = null;
      r.buffs = r.buffs.filter((x) => !(x.debuff && ids.includes(x.src)));
      if (r.bot) { r.target = null; r.cast = null; }
      if (r.cast && ids.includes(r.cast.target)) r.cast = null;
    }
    if (w) {
      this.broadcast({ k: 'msg', text: `${w.name} has defeated ${l.name} in a duel!`, color: '#ffc040' });
      this.achAdd(w, 'duels');
      if (w.bot) { w.ai.duelCool = this.time + 90; this.broadcast({ k: 'emote', id: w.id, e: 'salute', text: `${w.name} salutes ${l.name}.` }); }
      if (l.bot) { l.ai.duelCool = this.time + 90; this.broadcast({ k: 'emote', id: l.id, e: 'clap', text: `${l.name} claps for ${w.name}.` }); }
    } else for (const r of both) if (!r.bot) this.msg(r, 'Time is up: the duel ends in a draw.', '#ffc040');
    for (const r of both) if (!r.bot) this.pushSelf(r);
  }

  // ------------------------------------------------------------------ escorts
  escortOf(p, qid) { for (const b of this.players.values()) if (b.escort && b.owner === p.id && b.quest === qid) return b; return null; }
  startEscort(p, qid) {
    const E = ESCORTS[QUESTS[qid].goal.escort];
    if (!E || this.escortOf(p, qid)) return;
    const [x, z] = E.path[0];
    const b = {
      id: newId('p'), type: 'player', bot: true, escort: E, quest: qid, owner: p.id, name: E.name, cls: E.look, cv: E.v, botRole: 'Escort', level: QUESTS[qid].lvl,
      session: { send() {}, bot: true }, x, z, y: walkHeight(x, z), ry: 0, speed: 0, air: false, hp: E.hp, maxHp: E.hp, res: 0, maxRes: 1, dead: false, target: null,
      cds: {}, gcd: 0, cast: null, buffs: [], bag: [], equip: {}, quests: {}, done: {}, visited: {}, stats: {}, absorb: 0, combatT: -100, eating: 0,
      lsT: 0, ach: { c: {}, done: {} }, title: '', armorPct: 0.15, hastePct: 0, power: 1, tal: null, ai: { wp: 1, said: {}, t: 0 },
    };
    this.players.set(b.id, b);
    this.escortSay(b, 0);
  }
  escortSay(b, k) {
    const line = b.escort.lines[k];
    if (!line || b.ai.said[k]) return;
    b.ai.said[k] = true;
    const o = this.players.get(b.owner);
    if (o) o.session.send({ t: 'ev', list: [{ k: 'msg', text: `${b.name}: ${line}`, color: '#ffe8b0' }] });
    this.broadcast({ k: 'emote', id: b.id, e: k === 'end' ? 'cheer' : 'point', text: '' });
  }
  removeEscort(b, fail) {
    this.players.delete(b.id);
    for (const m of this.mobs.values()) { m.threat.delete(b.id); if (m.target === b.id) m.target = null; }
    // a failed or abandoned escort takes its ambush with it, so a retry starts clean
    if (fail) for (const id of b.ai.mobs || []) { const mb = this.mobs.get(id); if (mb && !mb.dead) { mb.dead = true; mb.respawnT = 0; mb.loot = null; this.broadcast({ k: 'die', id }); } }
  }
  tickEscort(b, dt) {
    const o = this.players.get(b.owner), E = b.escort, A = b.ai;
    const q = o?.quests[b.quest];
    if (!o || !q) return this.removeEscort(b, true);
    if (A.doneT) { if (this.time > A.doneT) this.removeEscort(b); b.speed = 0; return; }
    if (b.dead) {
      o.session.send({ t: 'ev', list: [{ k: 'yell', text: `${b.name} has fallen!` }, { k: 'msg', text: `${b.name} has fallen. Talk to ${this.npcs.get(QUESTS[b.quest].giver)?.name || 'the quest giver'} to try again.`, color: '#ff8060' }] });
      return this.removeEscort(b, true);
    }
    b.speed = 0;
    // hold still while being attacked, or while the escort's guard has fallen behind
    const attacked = this.time - b.combatT < 3 || [...this.mobs.values()].some((m) => !m.dead && m.target === b.id);
    if (attacked || dist(b, o) > 14) return;
    const wp = E.path[A.wp];
    if (!wp) {
      q.n = 1; A.doneT = this.time + 6;
      this.escortSay(b, 'end');
      this.msg(o, `${QUESTS[b.quest].name}: ${b.name} is safe.`, '#7aff7a');
      this.pushSelf(o);
      return;
    }
    const d = Math.hypot(wp[0] - b.x, wp[1] - b.z);
    if (d < 1) {
      // an ambush waits at some waypoints
      const amb = E.ambush[A.wp];
      if (amb && !A['amb' + A.wp]) {
        A['amb' + A.wp] = true;
        this.escortSay(b, A.wp);
        let k = 0;
        for (const [mob, n] of amb) for (let i = 0; i < n; i++, k++) {
          const a = R(0, Math.PI * 2), x = b.x + Math.cos(a) * R(9, 13), z = b.z + Math.sin(a) * R(9, 13);
          const mb = this.spawnMob({ mob, x, z, r: 0.5, n: 1, temp: true });
          mb.x = x; mb.z = z; mb.y = walkHeight(x, z); mb.home = { x: b.x, z: b.z };
          this.addThreat(mb, k % 2 ? o : b, 5); mb.state = 'chase'; mb.target = k % 2 ? o.id : b.id;
          (A.mobs ||= []).push(mb.id);
          this.broadcast({ k: 'spawn', id: mb.id });
        }
      } else this.escortSay(b, A.wp);
      A.wp++;
      return;
    }
    const sp = 3.4, step = Math.min(d, sp * dt);
    b.x += ((wp[0] - b.x) / d) * step; b.z += ((wp[1] - b.z) / d) * step; b.y = walkHeight(b.x, b.z);
    b.ry = Math.atan2(wp[0] - b.x, wp[1] - b.z); b.speed = sp;
  }

  // ------------------------------------------------------------------ the Proving Ring
  arenaUser() { for (const q of this.players.values()) if (q.trial) return q; return null; }
  on_trial(p, m) {
    const n = this.npcs.get(m.npc);
    if (!n?.arena || dist(p, n) > 8 || p.dead || p.trial) return;
    if (this.arenaUser()) return this.err(p, 'Someone is already fighting in the ring. Wait for them to finish.');
    if (this.time - p.combatT < 5) return this.err(p, 'Catch your breath first.');
    this.dismount(p);
    p.trial = { wave: 0, next: this.time + 4, mobs: [], gold: 0 };
    this.teleport(p, ARENA.x, ARENA.z + 3);
    p.session.send({ t: 'ev', list: [{ k: 'yell', text: 'The trial begins! Ready yourself...' }] });
    this.broadcast({ k: 'msg', text: `${p.name} steps into the Proving Ring.`, color: '#ffc040' });
  }
  tickTrial(p) {
    const T = p.trial;
    if (p.dead) return this.endTrial(p, 'fell');
    if (Math.hypot(p.x - ARENA.x, p.z - ARENA.z) > ARENA.r + 5) return this.endTrial(p, 'left');
    const alive = T.mobs.filter((id) => { const mb = this.mobs.get(id); return mb && !mb.dead; });
    if (T.wave > 0 && alive.length) return;
    if (T.wave > 0 && !T.cleared) {
      T.cleared = true; T.next = this.time + 4;
      const gold = 10 + T.wave * p.level * 2; T.gold += gold; p.gold += gold; this.achAdd(p, 'gold', gold);
      this.giveXp(p, Math.round(xpForLevel(p.level) * 0.012 * T.wave));
      p.session.send({ t: 'ev', list: [{ k: 'yell', text: `Wave ${T.wave} cleared!` }, { k: 'msg', text: `Wave ${T.wave} cleared: +${gold} copper. The next wave comes in 4 seconds.`, color: '#ffd060' }] });
      if (T.wave > (p.arenaBest || 0)) p.arenaBest = T.wave;
      { const wk = this.bountyWeek(); if (!p.ringWeek || p.ringWeek.week !== wk) this.ringSettle(p); if (T.wave > p.ringWeek.best) p.ringWeek.best = T.wave; }
      this.achSet(p, 'arena', T.wave);
      this.pushSelf(p);
    }
    if (this.time < T.next) return;
    // the next wave: more machines, a little stronger, a champion every fifth wave
    T.wave++; T.cleared = false; T.mobs = [];
    const pool = (ARENA_POOL.filter(([lv]) => lv <= p.level).pop() || ARENA_POOL[0])[1];
    const n = Math.min(2 + Math.floor(T.wave / 2), 7), lvl = Math.min(26, p.level + Math.floor(T.wave / 4));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R(0, 0.5), x = ARENA.x + Math.cos(a) * (ARENA.r - 1.5), z = ARENA.z + Math.sin(a) * (ARENA.r - 1.5);
      const mb = this.spawnMob({ mob: pool[i % pool.length], x, z, r: 0.5, n: 1, lvl: [lvl, lvl], temp: true });
      mb.x = x; mb.z = z; mb.y = walkHeight(x, z); mb.home = { x: ARENA.x, z: ARENA.z };
      this.addThreat(mb, p, 5); mb.state = 'chase'; mb.target = p.id;
      T.mobs.push(mb.id); this.broadcast({ k: 'spawn', id: mb.id });
    }
    if (T.wave % 5 === 0) {
      const mb = this.mobs.get(T.mobs[0]);
      mb.maxHp = Math.round(mb.maxHp * 3); mb.hp = mb.maxHp; mb.level = Math.min(26, lvl + 2);
      p.session.send({ t: 'ev', list: [{ k: 'yell', text: `Wave ${T.wave}: a champion enters the ring!` }] });
    } else p.session.send({ t: 'ev', list: [{ k: 'yell', text: `Wave ${T.wave}` }] });
  }
  endTrial(p, why) {
    const T = p.trial; p.trial = null;
    for (const id of T.mobs) { const mb = this.mobs.get(id); if (mb && !mb.dead) { mb.dead = true; mb.respawnT = 0; mb.loot = null; this.broadcast({ k: 'die', id }); } }
    const cleared = T.cleared ? T.wave : T.wave - 1;
    const text = `The trial is over: ${why === 'fell' ? 'you fell' : 'you left the ring'} after clearing ${Math.max(0, cleared)} wave${cleared === 1 ? '' : 's'} (${T.gold} copper). Your best: ${p.arenaBest || 0}.`;
    p.session.send({ t: 'ev', list: [{ k: 'msg', text, color: '#ffc040' }] });
    if (cleared >= 5) this.broadcast({ k: 'msg', text: `${p.name} cleared ${cleared} waves in the Proving Ring!`, color: '#ffc040' });
    this.pushSelf(p);
  }

  // ------------------------------------------------------------------ salvage
  on_salvage(p) {
    if (p.dead || p.salv || p.mounted) return;
    if (this.time - p.combatT < 5) return this.err(p, 'Not while you are fighting.');
    const w = waterNear(p.x, p.z, p.ry);
    if (!w) return this.err(p, 'There is no water within reach.');
    const sea = waterKind(w.x, w.z) === 'sea'; // the sea takes a fishing line; the lake, stream and pond take a salvage hook
    if (sea ? !p.bag.some((b) => b.id === 'fishline') : !p.bag.some((b) => b.id === 'hook')) return this.err(p, sea ? 'You need a fishing line. Fishmonger Dawud in Harrowmouth sells them.' : 'You need a Salvage Hook. Traders sell them.');
    p.salv = { end: this.time + R(4.5, 8), x: w.x, z: w.z, y: w.y, lake: Math.hypot(w.x - LAKE.x, w.z - LAKE.z) < LAKE.r + 8, sea };
    p.ry = Math.atan2(w.x - p.x, w.z - p.z);
    this.broadcast({ k: 'salv', id: p.id, x: +w.x.toFixed(2), z: +w.z.toFixed(2), y: w.y });
  }
  endSalvage(p, haul) {
    const S = p.salv; p.salv = null;
    if (!haul) { this.broadcast({ k: 'salvstop', id: p.id }); return; }
    const table = SALVAGE[S.sea ? 'sea' : S.lake ? 'lake' : 'stream'];
    let roll = R(0, table.reduce((a, t) => a + t[1], 0)), id = table[0][0];
    for (const [k, w] of table) { roll -= w; if (roll <= 0) { id = k; break; } }
    const def = ITEMS[id];
    if (this.addItem(p, def.stats ? { gear: this.fixedGear(id) } : { id, n: 1 })) {
      this.achAdd(p, S.sea ? 'fish' : 'salvages');
      if (S.sea && id === 'goldfin') this.achAdd(p, 'goldfin');
      if (def.q >= 3) this.msg(p, S.sea ? `A big pull on the line: ${def.name}!` : `Something glints on the end of your line: ${def.name}!`, '#ffd060');
    }
    this.broadcast({ k: 'salvdone', id: p.id, x: S.x, z: S.z, y: S.y });
    this.pushSelf(p);
  }

  today() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }

  // ------------------------------------------------------------------ reputation
  addRep(p, f, amt, quiet) {
    if (p.bot || !FACTIONS[f] || amt <= 0) return;
    const before = p.rep[f] || 0, after = Math.min(REP_CAP, before + amt);
    if (after === before) return;
    p.rep[f] = after;
    if (!quiet) this.msg(p, `+${amt} reputation with ${FACTIONS[f].name}.`, '#9ac8ff');
    const r0 = repRank(before), r1 = repRank(after);
    if (r1 > r0) { this.msg(p, `You are now ${REP_RANKS[r1].name} with ${FACTIONS[f].name}!`, '#7aff7a'); p.session.send({ t: 'ev', list: [{ k: 'yell', text: `${REP_RANKS[r1].name} with ${FACTIONS[f].name}` }] }); }
    this.achSet(p, 'rep:' + f, after);
    this.achSet(p, 'repbest', Math.max(...Object.values(p.rep)));
  }
  // the valley's engine: one shared project, saved under its own key, starting over every week
  valley() {
    const wk = weekNumber();
    if (!this._valley) this._valley = this.io.load(VALLEY.key) || { week: wk, pts: 0, donors: {} };
    if (this._valley.week !== wk) this._valley = { week: wk, pts: 0, donors: {} };
    return this._valley;
  }
  valleyState() { const V = this.valley(); let stage = 0; VALLEY.stages.forEach((t, i) => { if (V.pts >= t) stage = i; }); return { pts: V.pts, stage, next: VALLEY.stages[stage + 1] || null, name: VALLEY.names[stage] }; }
  on_donate(p, m) {
    const n = this.npcs.get(m.npc);
    if (!n?.build || dist(p, n) > 7 || p.dead) return;
    let pts = 0, count = 0;
    for (let i = p.bag.length - 1; i >= 0; i--) { const b = p.bag[i], v = b.id && VALLEY.gifts[b.id]; if (!v) continue; pts += v * (b.n || 1); count += b.n || 1; p.bag.splice(i, 1); }
    if (!pts) return this.err(p, 'You have nothing Darius can use. Scrap, cogs, springs, mended gears, bronze cogs and badly cast plates all help.');
    const before = this.valleyState().stage, V = this.valley();
    V.pts += pts; V.donors[p.name] = (V.donors[p.name] || 0) + pts;
    this.io.save(VALLEY.key, V);
    this.addRep(p, 'sunmere', Math.min(600, pts * 4));
    this.achAdd(p, 'donated', pts);
    const st = this.valleyState();
    this.msg(p, `You give Darius ${count} piece${count === 1 ? '' : 's'} of material (${pts} toward the engine). The valley\u2019s engine: ${st.pts}${st.next ? ' / ' + st.next : ''}.`, '#ffe08a');
    if (st.stage > before) { for (const q of this.players.values()) if (!q.bot) q.session.send({ t: 'ev', list: [{ k: 'msg', text: `In Sunmere the valley\u2019s engine rises: ${st.name.toLowerCase()} is done.`, color: '#ffd060' }] }); }
    this.broadcast({ k: 'valley', stage: st.stage });
    this.pushSelf(p);
  }
  qmShop(p, n) {
    if (n.marks) { const have = this.countItem ? this.countItem(p, 'makermark') : p.bag.filter((b) => b.id === 'makermark').reduce((a, b) => a + (b.n || 1), 0); return { mark: true, have, items: MARK_SHOP.map((s) => ({ ...s, ok: have >= s.price })) }; }
    const f = Object.keys(FACTIONS).find((k) => FACTIONS[k].qm === n.id);
    if (!f || !REP_SHOP[f]) return null; // a faction whose shop has not opened yet (the Cinderwrights)
    const rank = repRank(p.rep[f] || 0);
    return { faction: f, rep: p.rep[f] || 0, rank, items: REP_SHOP[f].map((s) => ({ ...s, ok: rank >= s.rank })) };
  }
  on_repBuy(p, m) {
    const n = this.npcs.get(m.npc);
    if (!n || dist(p, n) > 7) return;
    const shop = this.qmShop(p, n);
    const s = shop?.items.find((x) => x.item === m.item);
    if (!s) return;
    const it = ITEMS[s.item];
    if (shop.mark) {
      if (shop.have < s.price) return this.err(p, `That costs ${s.price} Makers\u2019 Marks; you have ${shop.have}.`);
      if (!this.addItem(p, it.stats ? { gear: this.fixedGear(s.item) } : { id: s.item, n: 1 })) return;
      let left = s.price;
      for (let i = p.bag.length - 1; i >= 0 && left > 0; i--) { const b = p.bag[i]; if (b.id !== 'makermark') continue; const take = Math.min(left, b.n || 1); b.n = (b.n || 1) - take; left -= take; if (b.n <= 0) p.bag.splice(i, 1); }
      this.msg(p, `You trade ${s.price} Makers\u2019 Marks for ${it.name}.`, '#ffe08a'); this.pushSelf(p); return;
    }
    if (!s.ok) return this.err(p, `You must be ${REP_RANKS[s.rank].name} with ${FACTIONS[shop.faction].name}.`);
    if (p.gold < s.price) return this.err(p, 'You cannot afford that.');
    if (this.addItem(p, it.stats ? { gear: this.fixedGear(s.item) } : { id: s.item, n: 1 })) { p.gold -= s.price; this.msg(p, `You buy ${it.name}.`, '#ffe08a'); this.pushSelf(p); }
  }
  // watch members pay less at the traders in their lands
  repDiscount(p, n) { const f = factionOfZone(zoneAt(n.x, n.z).id); return 1 - 0.05 * repRank(p.rep?.[f] || 0); }

  // ------------------------------------------------------------------ the Brass Runabout
  on_buyRunabout(p, m) {
    const n = this.npcs.get(m.npc);
    if (!n?.mounts || dist(p, n) > 7 || p.runabout) return;
    if (p.level < RUNABOUT.level) return this.err(p, `You must be level ${RUNABOUT.level} to drive a runabout.`);
    if (p.gold < RUNABOUT.cost) return this.err(p, 'You cannot afford a runabout yet.');
    p.gold -= RUNABOUT.cost; p.runabout = true;
    this.msg(p, 'You now own a Brass Runabout! Press R to ride it, and R again to step down.', '#ffe08a');
    this.pushSelf(p);
  }
  on_upgradeRunabout(p, m) {
    const n = this.npcs.get(m.npc), M = RUNABOUT.mk2;
    if (!n?.mounts || dist(p, n) > 7 || !p.runabout || p.runaboutMk >= 2) return;
    if (p.level < M.level) return this.err(p, `The Mk II needs a level ${M.level} driver.`);
    if (p.gold < M.cost) return this.err(p, 'You cannot afford the upgrade yet.');
    p.gold -= M.cost; p.runaboutMk = 2;
    if (p.mounted) this.broadcast({ k: 'mount', id: p.id, on: true });
    this.msg(p, 'Ottmar fits a twin-stack boiler and broad rear wheels: your runabout is now a Mk II (+100% speed).', '#ffe08a');
    this.achAdd(p, 'mk2');
    this.pushSelf(p);
  }
  paintOk(p, k) {
    const N = PAINTS[k]?.need;
    if (!PAINTS[k]) return false;
    if (!N) return true;
    if (N.rep) return repRank(p.rep?.[N.rep] || 0) >= N.rank;
    if (N.ach) return !!p.ach?.done?.[N.ach];
    return false;
  }
  on_paint(p, m) {
    const n = this.npcs.get(m.npc);
    if (!n?.mounts || dist(p, n) > 7 || (!p.runabout && !p.crawler)) return;
    if (!this.paintOk(p, m.paint)) return this.err(p, 'You have not earned that paint yet.');
    p.paint = m.paint;
    this.msg(p, `Your ${p.mountKind === 'crawler' ? 'crawler' : 'runabout'} is now painted ${PAINTS[m.paint].name}.`, '#ffe08a');
    this.pushSelf(p);
  }
  // Ottmar's window: choose which mount R brings (both must be owned)
  on_mountKind(p, m) {
    const n = this.npcs.get(m.npc), kind = m.kind === 'crawler' ? 'crawler' : 'runabout';
    if (!n?.mounts || dist(p, n) > 7 || !p.crawler || (kind === 'runabout' && !p.runabout)) return;
    p.mountKind = kind;
    if (p.mounted) this.broadcast({ k: 'mount', id: p.id, on: true });
    this.pushSelf(p);
  }
  on_pet(p, m) {
    const id = m.id || null;
    if (id && !p.pets?.[id]) return;
    p.pet = id;
    this.pushSelf(p);
  }
  on_mount(p) {
    if (p.dead) return;
    if (p.mounted) return this.dismount(p);
    if (!p.runabout && !p.crawler) return this.err(p, 'You do not own a runabout. Gearwright Ottmar at the Sunmere gate sells them.');
    if (p.x >= DUNGEON_MIN_X) return this.err(p, 'There is no room to drive in here.');
    if (houseAt(p.x, p.z, false)) return this.err(p, 'Leave your mount outside.'); // no mounting up indoors (every move would be sent back)
    if (this.time - p.combatT < 5) return this.err(p, 'You cannot mount up in combat.');
    if (p.cast) return this.err(p, 'You are busy.');
    p.mounted = true; p.eating = 0;
    this.broadcast({ k: 'mount', id: p.id, on: true });
    this.pushSelf(p);
  }
  dismount(p, why) {
    if (!p.mounted) return;
    p.mounted = false;
    this.broadcast({ k: 'mount', id: p.id, on: false });
    if (why && !p.bot) this.err(p, why);
    this.pushSelf(p);
  }

  // ------------------------------------------------------------------ party
  findPlayer(name) { const n = String(name).toLowerCase(); return [...this.players.values()].find((q) => !q.bot && q.name.toLowerCase() === n) || null; }
  partyOf(p) { return p?.party ? this.parties.get(p.party) || null : null; }
  partyMembers(p) { const P = this.partyOf(p); return P ? P.members.map((id) => this.players.get(id)).filter(Boolean) : [p]; }
  invite(p, name, id) {
    const q = this.findPlayer(name);
    if (!q) { const n = String(name || '').toLowerCase(), b = id ? this.players.get(id) : [...this.players.values()].find((x) => x.bot && x.wander && x.name.toLowerCase() === n); if (b?.bot && b.wander) return this.inviteBot(p, b); } // a bot (living bots A.3)
    if (!q || q === p) return this.err(p, 'No one by that name is in the valley.');
    if (q.held) return this.err(p, `${q.name} is away (their connection dropped).`);
    if (!this.allow(p, 'invite', 0.5, 4)) return this.err(p, 'Wait a moment before inviting again.');
    if (q.party && q.party === p.party) return this.err(p, `${q.name} is already in your party.`);
    const P = this.partyOf(p);
    if (P && P.leader !== p.id) return this.err(p, 'Only the party leader can invite.');
    if (P && P.members.length >= 5) return this.err(p, 'Your party is full.');
    q.invite = { from: p.id, t: this.time };
    q.session.send({ t: 'ev', list: [{ k: 'invite', from: p.name, cls: p.cls }] });
    this.msg(p, `You invite ${q.name} to your party.`, '#7ab0ff');
  }
  on_partyReply(q, m) {
    const inv = q.invite; q.invite = null;
    const p = inv && this.time - inv.t < 60 ? this.players.get(inv.from) : null;
    if (!p) return;
    if (inv.bot) return this.botInviteAnswer(q, p, !!m.accept); // an invite a bot sent (living bots A.2)
    if (!m.accept) { this.msg(p, `${q.name} declines your invitation.`, '#7ab0ff'); return; }
    if (this.joinParty(p, q)) for (const r of this.partyMembers(p)) if (!r.bot) this.msg(r, `${q.name} joins the party.`, '#7ab0ff');
  }
  joinParty(leader, q) {
    let P = this.partyOf(leader);
    if (!P) { P = { id: newId('g'), leader: leader.id, members: [leader.id] }; this.parties.set(P.id, P); leader.party = P.id; }
    if (P.members.length >= 5) { this.err(leader, 'Your party is full.'); return false; }
    if (q.party) this.leaveParty(q, true);
    // a companion comes along with its owner
    const train = [q, ...[...this.players.values()].filter((b) => b.bot && b.owner === q.id)];
    for (const r of train) { if (P.members.length >= 5) break; if (r.party) this.leaveParty(r, true); P.members.push(r.id); r.party = P.id; }
    this.partyChanged(P);
    return true;
  }
  leaveParty(p, silent) {
    const P = this.partyOf(p);
    if (!P) return;
    const going = new Set([p.id, ...[...this.players.values()].filter((b) => b.bot && b.owner === p.id && b.party === P.id).map((b) => b.id)]);
    P.members = P.members.filter((id) => !going.has(id));
    for (const id of going) { const r = this.players.get(id); if (r) r.party = null; }
    if (!p.bot) {
      // a solo player keeps a party with their own companion
      const mine = [...this.players.values()].filter((b) => b.bot && b.owner === p.id);
      if (mine.length) { const N = { id: newId('g'), leader: p.id, members: [p.id, ...mine.map((b) => b.id)] }; this.parties.set(N.id, N); p.party = N.id; for (const b of mine) b.party = N.id; this.partyChanged(N); }
    }
    const humans = P.members.filter((id) => { const r = this.players.get(id); return r && !r.bot; });
    if (P.leader && going.has(P.leader)) P.leader = humans[0] || null;
    if (!humans.length || P.members.length < 2) {
      for (const id of P.members) { const r = this.players.get(id); if (r) { r.party = null; this.sendParty(r); } }
      this.parties.delete(P.id);
      // whoever is left alone keeps their companion in a fresh party
      for (const id of humans) { const r = this.players.get(id); const mine = [...this.players.values()].filter((b) => b.bot && b.owner === id); if (r && mine.length) { const N = { id: newId('g'), leader: id, members: [id, ...mine.map((b) => b.id)] }; this.parties.set(N.id, N); r.party = N.id; for (const b of mine) b.party = N.id; this.partyChanged(N); } }
    } else this.partyChanged(P);
    if (!p.bot && !p.party) this.sendParty(p);
    if (!silent && !p.bot) for (const id of humans) { const r = this.players.get(id); if (r) this.msg(r, `${p.name} leaves the party.`, '#7ab0ff'); }
  }
  partyChanged(P) { for (const id of P.members) this.sendParty(this.players.get(id)); }
  sendParty(p) {
    if (!p || p.bot) return;
    const P = this.partyOf(p);
    p.session.send({ t: 'party', leader: P?.leader || null, members: P ? P.members.filter((id) => id !== p.id).map((id) => this.partyInfo(this.players.get(id))).filter(Boolean) : [] });
  }
  partyInfo(q) {
    return q && { id: q.id, name: q.name, cls: q.cls, level: q.level, hp: Math.round(q.hp), maxHp: q.maxHp, res: Math.round(q.res), maxRes: q.maxRes, dead: q.dead, bot: !!q.bot, role: q.botRole || null, stance: q.bot && !q.wander ? q.ai?.stance || 'assist' : undefined, x: +q.x.toFixed(1), z: +q.z.toFixed(1) };
  }

  // ------------------------------------------------------------------ companions
  on_hire(p, m) {
    const n = this.npcs.get(m.npc), C = COMPANIONS[m.cls];
    if (!n?.merc || !C || dist(p, n) > 7) return;
    const mine = this.myBots(p);
    if (mine.some((b) => b.cls === m.cls)) return this.err(p, `${C.name} is already with you.`);
    if (mine.length >= 2) return this.err(p, 'You can lead two companions at most. Dismiss one first (target him, or /dismiss name).');
    const cost = companionCost(p.level);
    if (p.gold < cost) return this.err(p, 'You cannot afford that wage.');
    p.gold -= cost;
    this.hireCompanion(p, m.cls);
    this.pushSelf(p);
  }
  on_compOrder(p, m) {
    const order = { assist: 'assist', follow: 'assist', hold: 'hold', stay: 'hold', passive: 'passive' }[String(m.order || '').toLowerCase()];
    if (!order) return this.err(p, 'Orders: /comp assist, /comp hold, /comp passive (add a name for one companion).');
    const mine = this.myBots(p).filter((b) => !b.escort && (!m.name && !m.id || b.id === m.id || b.name.toLowerCase() === String(m.name || '').toLowerCase()));
    if (!mine.length) return this.err(p, 'You have no companion by that name.');
    for (const b of mine) {
      b.ai.stance = order; b.ai.hold = order === 'hold' ? { x: b.x, z: b.z } : null;
      if (order !== 'assist') b.target = null;
      if (order === 'hold' && b.mounted) { b.mounted = false; this.broadcast({ k: 'mount', id: b.id, on: false }); }
    }
    const what = { assist: 'follow you and fight at your side', hold: 'hold this ground', passive: 'stay out of fights' }[order];
    this.msg(p, `${mine.map((b) => b.name).join(' and ')} will ${what}.`, '#7ab0ff');
    this.sendParty(p);
  }
  // outfitting companions: gear from your bags goes on the companion of your choice, by slot
  on_compGive(p, m) {
    const b = this.myBots(p).find((x) => x.id === m.id && !x.escort);
    const it = p.bag[m.slot];
    if (!b || !it?.gear) return this.err(p, 'Choose a piece of gear from your bags.');
    if (it.gear.classes && !it.gear.classes.includes(b.cls)) return this.err(p, `${b.name} cannot use that kind of weapon.`);
    const g = it.gear, kit = ((p.compGear ||= {})[b.cls] ||= {});
    p.bag.splice(m.slot, 1);
    if (kit[g.slot]) p.bag.push({ gear: kit[g.slot] });
    kit[g.slot] = g;
    this.botGear(b);
    this.msg(p, `${b.name} now wears ${g.name}.`, '#7ab0ff');
    this.pushSelf(p);
  }
  on_compTake(p, m) {
    const b = this.myBots(p).find((x) => x.id === m.id && !x.escort);
    const kit = b && p.compGear?.[b.cls];
    if (!kit?.[m.gslot]) return;
    if (p.bag.length >= this.bagMax(p)) return this.err(p, 'Your bags are full.');
    p.bag.push({ gear: kit[m.gslot] });
    delete kit[m.gslot];
    this.botGear(b);
    this.pushSelf(p);
  }
  myBots(p) { return [...this.players.values()].filter((b) => b.bot && b.owner === p.id); }
  hireCompanion(p, cls, back) {
    const C = COMPANIONS[cls];
    if (this.myBots(p).some((b) => b.cls === cls)) return null;
    const b = this.makeBot({ owner: p.id, botRole: C.role, name: C.name, cls, level: p.level, x: p.x + R(-2, 2), z: p.z + R(-2, 2), ry: p.ry });
    b.ai.side = this.myBots(p).length > 1 ? -this.myBots(p)[0].ai.side : b.ai.side;
    this.joinParty(p, b);
    this.msg(p, back ? `${C.name} the ${C.role} is at your side again.` : `${C.name} the ${C.role} joins you. Type /dismiss ${C.name} (or target him) to send him home.`, '#7ab0ff');
    return b;
  }
  makeBot(o) {
    const b = {
      id: newId('p'), type: 'player', bot: true, owner: null, botRole: null, session: { send() {}, bot: true }, xp: 0, gold: 0, y: 0, ry: 0, speed: 0, air: false,
      hp: 1, maxHp: 1, res: 100, maxRes: 100, dead: false, target: null, cds: {}, gcd: 0, cast: null, buffs: [],
      bag: [], equip: {}, quests: {}, done: {}, visited: {}, stats: {}, absorb: 0, combatT: 0, eating: 0, lsT: 0,
      ach: { c: {}, done: {} }, title: '', ai: { t: 0, side: rand() < 0.5 ? -1 : 1 }, ...o,
    };
    if (b.x >= DUNGEON_MIN_X) [b.x, b.z] = dungeonPush(b.x, b.z, 0.4);
    b.y = walkHeight(b.x, b.z);
    this.botGear(b);
    b.hp = b.maxHp; b.res = b.maxRes;
    this.players.set(b.id, b);
    return b;
  }

  // ------------------------------------------------------------------ other adventurers
  spawnWanderers() {
    // hunting grounds: the outdoor spawn groups of ordinary machines and raiders, with their typical level
    const groups = new Map();
    for (const m of this.mobs.values()) {
      const sp = m.sp;
      if (sp.path || sp.dungeon || sp.x >= DUNGEON_MIN_X || m.def.elite || m.def.boss || m.def.rare) continue;
      const g = groups.get(sp) || { x: sp.x, z: sp.z, r: Math.max(8, sp.r || 8), lv: [] };
      g.lv.push(m.level); groups.set(sp, g);
    }
    // each ground is tagged with its area: a wanderer only ever moves on to grounds in the area it stands in (no walks over the sea)
    this.grounds = [...groups.entries()].map(([sp, g]) => ({ x: g.x, z: g.z, r: g.r, area: areaOf(g.x, g.z), lvl: g.lv.reduce((a, b) => a + b, 0) / g.lv.length, sps: [sp] }));
    // living bots (B.1): the saved roster logs its bots in (shared/botmind.js); io.bots === false keeps the old 14 wanderers
    if (this.io.bots !== false) { this.rosterStart(); return; }
    for (const W of WANDERERS) {
      const gs = this.huntGrounds(W.lvl, 'valley');
      const g = gs[RI(0, gs.length - 1)];
      if (!g) continue;
      const b = this.makeBot({ wander: true, name: W.name, cls: W.cls, level: W.lvl, x: g.x + R(-4, 4), z: g.z + R(-4, 4), ry: R(0, 6.28) });
      b.ai.ground = g; b.ai.moveOn = this.time + R(120, 400); b.ai.chatT = R(40, 500);
    }
  }
  huntGrounds(lvl, area = 'valley') {
    const here = this.grounds.filter((g) => g.area === area);
    let gs = here.filter((g) => Math.abs(g.lvl - lvl) <= 1.6);
    if (!gs.length) gs = [...here].sort((a, b) => Math.abs(a.lvl - lvl) - Math.abs(b.lvl - lvl)).slice(0, 2);
    return gs;
  }
  tickWanderer(b, dt) {
    if (b.ai.party && this.botPartyTick(b, dt)) return; if (b.mind && this.mindTick(b, dt)) return; // living bots (A.4, B.3)
    return this.wanderLegacy(b, dt);
  }
  // the wanderer of v120 (io.bots === false, and any wanderer without a mind)
  wanderLegacy(b, dt) {
    const A = b.ai;
    const real = () => [...this.players.values()].some((q) => !q.bot);
    if (b.dead) {
      b.reviveT = b.reviveT || this.time + 25;
      if (this.time > b.reviveT) {
        const g = this.graveyard(b); // the nearest on its own side (never over the sea or the ridge)
        b.dead = false; b.reviveT = 0; b.hp = Math.round(b.maxHp * 0.6); b.res = b.maxRes * 0.5; b.buffs = []; b.target = null;
        b.x = g.x + R(-2, 2); b.z = g.z + R(-2, 2); b.y = walkHeight(b.x, b.z);
        this.broadcast({ k: 'revive', id: b.id });
      }
      return;
    }
    if (A.duelReply && this.time > A.duelReply.t) {
      const r = A.duelReply, p = this.players.get(r.from); A.duelReply = null;
      if (p && r.yes && this.time > (A.duelCool || 0)) { this.botSay(b, 'world', 'duel_yes', { to: p, must: 1 }); this.startDuel(p, b); }
      else if (p) this.botSay(b, 'world', 'duel_no', { to: p, must: 1 });
    }
    if (A.reply && this.time > A.replyT) { const r = A.reply; A.reply = null; b.speed = 0; this.broadcast({ k: 'emote', id: b.id, e: r.e, text: `${b.name} ${EMOTES[r.e]} at ${r.to}.` }); A.pause = 3; }
    A.chatT -= dt;
    if (A.chatT <= 0) { A.chatT = R(300, 720); if (real()) this.botAmbient(b); } // living bots C: a true line about where it is, within the chat budgets (shared/botchat.js)
    if (this.time > A.moveOn && !b.target) { const gs = this.huntGrounds(b.level, areaOf(b.x, b.z)); if (gs.length) { A.ground = gs[RI(0, gs.length - 1)]; A.wp = null; } A.moveOn = this.time + R(200, 480); }
    const G0 = A.ground;
    const inCombat = this.time - b.combatT < 5;
    A.t -= dt;
    if (A.t <= 0) {
      A.t = 0.4;
      const cur = b.target ? this.mobs.get(b.target) : null;
      const engaged = (m) => m && !m.dead && (m.target === b.id || m.threat.has(b.id));
      const chosen = cur && !cur.dead && this.time - (A.pickT || 0) < 14;
      if (!engaged(cur) && !chosen) {
        if (cur?.dead) A.nextFight = this.time + R(14, 40); // catch your breath, loot, look around
        b.target = null;
        // anything already hitting us comes first
        for (const m of this.mobs.values()) if (engaged(m) && dist(m, b) < 30) { b.target = m.id; break; }
        // otherwise pick a fight when rested: a mob nobody real is fighting
        if (!b.target && b.hp > b.maxHp * 0.75 && !b.eating && this.time > (A.nextFight || 0)) {
          let best = null, bd = 16;
          for (const m of this.mobs.values()) {
            if (m.dead || m.def.elite || m.def.boss || m.def.rare || m.def.dummy || Math.abs(m.level - b.level) > 2) continue;
            if ([...m.threat.keys()].some((id) => !this.players.get(id)?.bot)) continue;
            if (Math.hypot(m.x - G0.x, m.z - G0.z) > G0.r + 14) continue;
            const d = dist(m, b); if (d < bd) { bd = d; best = m; }
          }
          if (best && rand() < 0.35) { b.target = best.id; A.pickT = this.time; }
        }
      }
    }
    if (b.duel) b.target = this.duelOn(b) ? b.duel.with : null;
    const tgt = b.target ? this.foeOf(b, b.target) : null;
    // rest and eat between fights
    if (!tgt && !inCombat && b.hp < b.maxHp * 0.7) { if (!b.eating) { b.eating = this.time; b.eatAmt = 0.3; } b.speed = 0; return; }
    let goal, stopAt;
    if (tgt) { const ranged = !!CLASSES[b.cls]?.ranged; goal = tgt; stopAt = (ranged ? 12 : 2.2) + this.rad(tgt) * 0.7; }
    else {
      if (!A.wp || Math.hypot(A.wp.x - b.x, A.wp.z - b.z) < 1.2) {
        A.pause = (A.pause ?? 0) - dt;
        if (A.wp && A.pause > 0) { b.speed = 0; return; }
        // (never a point indoors, nor one a house stands in the way of: wanderers do not use doors)
        for (let t = 0; t < 8; t++) { const a = R(0, 6.28), d = Math.sqrt(R()) * G0.r; A.wp = { x: G0.x + Math.cos(a) * d, z: G0.z + Math.sin(a) * d }; if (!houseAt(A.wp.x, A.wp.z) && !houseCrosses(b.x, b.z, A.wp.x, A.wp.z)) break; }
        A.pause = R(1, 6);
      }
      goal = A.wp; stopAt = 0.3;
    }
    this.botMove(b, goal, stopAt, tgt ? 1 : 0.62, tgt);
    if (!b.cast && this.time >= b.gcd && !this.hasCC(b, 'stun') && tgt) {
      const c = this.botChooseSkill(b, b, tgt);
      this.botAct(b, c);
    }
  }
  // a companion goes in and out of a house by its door: the next point to walk to on the way to goal
  houseWay(b, goal) {
    if (b.x >= DUNGEON_MIN_X) return goal;
    const hb = houseAt(b.x, b.z), hg = houseAt(goal.x, goal.z);
    if (hb === hg && !houseCrosses(b.x, b.z, goal.x, goal.z)) return goal;
    if (hb && hb !== hg) return houseCrosses(b.x, b.z, goal.x, goal.z) ? (houseCrosses(b.x, b.z, hb.doorOut.x, hb.doorOut.z) ? hb.doorIn : hb.doorOut) : goal; // leaving
    if (hg) return houseCrosses(b.x, b.z, hg.doorIn.x, hg.doorIn.z) ? hg.doorOut : hg.doorIn; // going in
    return goal;
  }
  botMove(b, goal, stopAt, mul, tgt) {
    b.speed = 0;
    if (b.cast || this.hasCC(b, 'stun') || this.hasCC(b, 'root')) return;
    const d = Math.hypot(goal.x - b.x, goal.z - b.z);
    if (d > stopAt) {
      const sp = CLASSES[b.cls].speed * mul;
      const step = Math.min(d - stopAt, sp * this.lastDt), ox = b.x, oz = b.z;
      b.x += ((goal.x - b.x) / d) * step; b.z += ((goal.z - b.z) / d) * step;
      if (b.x >= DUNGEON_MIN_X) [b.x, b.z] = dungeonPush(b.x, b.z, 0.4); else [b.x, b.z] = housePush(b.x, b.z, 0.4);
      if (b.x < DUNGEON_MIN_X && worldGap(b.x, b.z) > -0.6) { b.x = ox; b.z = oz; } // never off the walkable edge (living bots B.5)
      b.y = walkHeight(b.x, b.z);
      b.ry = Math.atan2(goal.x - b.x, goal.z - b.z);
      b.speed = sp; b.eating = 0;
    } else if (tgt) b.ry = Math.atan2(tgt.x - b.x, tgt.z - b.z);
  }

  // companions wear sensible kit for their level so they keep up
  botGear(b) {
    const L = b.level, budget = (3 + L * 1.6) * (1 + (b.gearBonus || 0)); // a living bot's cleared runs add up to 15% (B.4)
    const given = this.players.get(b.owner)?.compGear?.[b.cls] || {};
    // v120: armour 7.5 per budget point (was 3), so a bot in its two armour pieces keeps about the damage reduction of a hero in a full set under the level-scaled armour formula
    // a bot tank (Knight or Warden) gets BOT_TANK_HP times the health on them, about a geared hero tank's health (v120 review
    // follow-up: a volunteer Warden had a third of a hero Knight's health and died under every raid boss)
    const hpk = TANK_CLS.has(b.cls) ? BOT_TANK_HP : 1;
    b.equip = { weapon: { stats: { power: Math.round(budget * 0.9) } }, chest: { stats: { armor: Math.round(budget * 7.5), hp: Math.round(budget * 0.8 * hpk) } }, legs: { stats: { armor: Math.round(budget * 7.5), hp: Math.round(budget * 0.8 * hpk) } } };
    for (const [slot, g] of Object.entries(given)) b.equip[slot] = g;
    // (S15) a bot on the Skill Web holds the first treePoints(level) nodes of its role's suggested path (shared/botplan.js botTree)
    if (!b.noWeb) { b.botWeb = true; b.tree = { ...botTree(b.cls, botBuildOf(b), b.level) }; b.forms = b.forms || {}; }
    this.recalc(b);
  }
  // ------------------------------------------------------------------ the Homestead: look at another player's trophies and furnishings
  on_inspectHome(p, m) {
    const q = this.players.get(m.id);
    if (!q || q.bot || q === p || dist(p, q) > 40) return;
    const trophies = HOME_TROPHIES.filter(([, , need]) => need.done ? q.done?.[need.done] : q.ach?.done?.[need.ach]).map(([k]) => k);
    p.session.send({ t: 'ev', list: [{ k: 'homeview', name: q.name, cls: q.cls, trophies, deco: Object.keys(q.homeDeco || {}) }] });
  }
  // ------------------------------------------------------------------ the Homestead: Carpenter Idwal builds furnishings
  // move a built furnishing to another spot in the yard (or back to where Idwal first put it: spot -1)
  on_homeMove(p, m) {
    const n = this.npcs.get(m.npc);
    if (!n?.homeshop || dist(p, n) > 8 || !HOME_MOVABLE.includes(m.id) || !p.homeDeco?.[m.id]) return;
    const spot = Number(m.spot);
    if (spot === -1) { delete (p.homePos ||= {})[m.id]; this.pushSelf(p); return; }
    if (!(spot >= 0 && spot < HOME_SPOTS.length)) return;
    p.homePos ||= {};
    for (const [k, v] of Object.entries(p.homePos)) if (v === spot && k !== m.id) delete p.homePos[k]; // one piece per spot
    p.homePos[m.id] = spot;
    this.pushSelf(p);
  }
  on_homeBuy(p, m) {
    const n = this.npcs.get(m.npc), D = HOME_DECO[m.id];
    if (!n?.homeshop || !D || dist(p, n) > 8) return;
    if ((p.homeDeco ||= {})[m.id]) return this.err(p, 'That already stands in your homestead.');
    if (D.need && repRank(p.rep?.[D.need.rep] || 0) < D.need.rank) return this.err(p, `You must be ${REP_RANKS[D.need.rank]?.name || 'Honored'} with ${FACTIONS[D.need.rep].name} first.`);
    if (p.gold < D.price) return this.err(p, 'You cannot afford that.');
    p.gold -= D.price; p.homeDeco[m.id] = 1;
    this.msg(p, `Idwal builds your ${D.name.toLowerCase()}. It is in your homestead now.`, '#7ab0ff');
    this.pushSelf(p);
  }
  // ------------------------------------------------------------------ the group finder (Muster-Sergeant Bram)
  musterParty(p) {
    const P = this.partyOf(p);
    return P ? P.members.map((id) => this.players.get(id)).filter(Boolean) : [p];
  }
  musterNeed(p) {
    const have = this.musterParty(p), roles = have.map((q) => MUSTER.roles[q.cls]);
    const need = [], room = 5 - have.length;
    const add = (cls) => { if (need.length < room) { need.push(cls); roles.push(MUSTER.roles[cls]); } };
    if (!roles.includes('tank')) add('warden');
    if (!roles.includes('healer')) add('herbalist');
    for (const cls of MUSTER.fill) if (MUSTER.roles[cls] === 'damage' && !need.includes(cls) && !have.some((q) => q.cls === cls)) add(cls);
    for (const cls of ['ranger', 'deadeye', 'sandblade', 'chemist', 'knight']) add(cls);
    return need;
  }
  musterState(p) {
    const humans = this.musterParty(p).filter((q) => !q.bot);
    return {
      have: this.musterParty(p).map((q) => ({ name: q.name, cls: q.cls, role: MUSTER.roles[q.cls], you: q === p })),
      need: this.musterNeed(p).map((cls) => ({ name: MUSTER.volunteers[cls], cls, role: MUSTER.roles[cls] })),
      cost: MUSTER.cost(p.level), alone: humans.length <= 1, queue: this.lfgView(p), lead: !p.party || this.partyOf(p)?.leader === p.id, // (the group finder queue, living bots A.7)
      list: DUNGEONS.filter((D) => !D.open).map((D) => { const lo = parseInt(D.level, 10); return { id: D.id, name: D.name, level: D.level, raid: !!D.raid, ok: p.level >= lo - 2 }; }),
    };
  }
  on_muster(p, m) {
    const n = this.npcs.get(m.npc), D = DUNGEON_BY_ID[m.id];
    if (!n?.muster || !D || dist(p, n) > 8 || p.dead) return;
    const st = this.musterState(p);
    if (!st.alone) return this.err(p, 'The board is for those travelling alone or with companions. Your party can ride with Clerk Wendel.');
    if (!st.list.find((x) => x.id === D.id)?.ok) return this.err(p, `${D.name} is for level ${D.level}.`);
    if (D.need?.done && !p.done?.[D.need.done]) return this.err(p, D.need.text || `${D.name} is shut for now.`); // a story-gated door: no volunteers or road money for a door that will not open
    if (this.time - p.combatT < 5) return this.err(p, 'You cannot travel while in combat.');
    if (p.gold < st.cost) return this.err(p, 'You cannot afford the volunteers\u2019 road money.');
    p.gold -= st.cost;
    for (const b of this.myBots(p)) if (b.lfg) this.sendHome(b);
    for (const cls of this.musterNeed(p)) {
      const b = this.makeBot({ owner: p.id, botRole: 'Volunteer', name: MUSTER.volunteers[cls], cls, level: p.level, x: p.x + R(-2, 2), z: p.z + R(-2, 2), ry: p.ry, lfg: D.id });
      this.joinParty(p, b);
    }
    const a = D.door.ry;
    this.teleport(p, D.door.x + Math.sin(a) * 3, D.door.z + Math.cos(a) * 3);
    this.on_door(p, { id: D.id });
    const names = this.myBots(p).filter((b) => b.lfg).map((b) => `${b.name} (${MUSTER.roles[b.cls]})`);
    this.msg(p, names.length ? `Bram\u2019s volunteers meet you inside ${D.name}: ${names.join(', ')}. They go home when you leave.` : `Your party is already full. Bram sends you to ${D.name}.`, '#7ab0ff');
    this.sendParty(p); this.pushSelf(p);
  }
  // one bot leaves the world (volunteers going home)
  sendHome(b) {
    this.players.delete(b.id);
    this.leaveParty(b, true);
    for (const m of this.mobs.values()) { m.threat.delete(b.id); if (m.target === b.id) m.target = null; }
  }
  dismissCompanion(p, quiet, name) {
    for (const b of [...this.players.values()]) {
      if (!b.bot || b.owner !== p.id) continue;
      if (name && b.name.toLowerCase() !== String(name).toLowerCase()) continue;
      this.players.delete(b.id);
      this.leaveParty(b, true);
      for (const m of this.mobs.values()) { m.threat.delete(b.id); if (m.target === b.id) m.target = null; }
      if (!quiet) this.msg(p, `${b.name} heads back to Sunmere.`, '#7ab0ff');
    }
    if (!quiet) this.sendParty(p);
  }
  tickBot(b, dt) {
    if (b.escort) return this.tickEscort(b, dt);
    if (b.wander) return this.tickWanderer(b, dt);
    const o = this.players.get(b.owner);
    if (!o) { this.players.delete(b.id); return; }
    if (b.lfg) {
      const here = o.x >= DUNGEON_MIN_X && dungeonAt(o.x, o.z)?.id === b.lfg;
      if (here) b.lfgT = 0;
      else if ((b.lfgT = (b.lfgT || 0) + dt) > 4) { this.sendHome(b); if (!this.myBots(o).some((q) => q.lfg)) { this.msg(o, 'Your volunteers head back to Sunmere.', '#7ab0ff'); this.sendParty(o); } return; }
    }
    if (b.level !== o.level) { b.level = o.level; this.botGear(b); }
    this.botFollow(b, o, dt);
  }
  // follow o and fight at its side: companions, volunteers, and (roster) bots of the valley in a party with a human (living
  // bots A.4). A roster bot does not jump to its leader in the open world under BOT_PARTY.run m: it runs; further, or across
  // areas, it is "on its way" (hidden, b.away) for a few seconds and then appears next to them. In a dungeon it catches up at once.
  botFollow(b, o, dt, roster) {
    const split = areaOf(o.x, o.z) !== areaOf(b.x, b.z) || (o.x >= DUNGEON_MIN_X && dungeonAt(o.x, o.z) !== dungeonAt(b.x, b.z));
    if (b.dead) {
      b.reviveT = b.reviveT || this.time + 14;
      if (this.time > b.reviveT && !o.dead) {
        b.dead = false; b.reviveT = 0; b.hp = Math.round(b.maxHp * 0.5); b.res = b.maxRes * 0.5; b.buffs = [];
        b.x = o.x + R(-2, 2); b.z = o.z + R(-2, 2); if (b.x >= DUNGEON_MIN_X) [b.x, b.z] = dungeonPush(b.x, b.z, 0.4); b.y = walkHeight(b.x, b.z);
        this.broadcast({ k: 'revive', id: b.id });
      }
      return;
    }
    const dO = dist(b, o);
    const H = b.ai.stance === 'hold' ? b.ai.hold : null;
    if (H && (split || dO > 90)) { b.ai.stance = 'assist'; b.ai.hold = null; }
    const inD = o.x >= DUNGEON_MIN_X || b.x >= DUNGEON_MIN_X;
    if (roster ? split || dO > (inD ? 45 : BOT_PARTY.run) : (dO > 45 && !H) || split) { // catch up after travel, death or a door
      if (roster && !inD) { if (!b.away) { b.away = true; b.awayT = this.time + R(BOT_PARTY.away[0], BOT_PARTY.away[1]); b.target = null; b.cast = null; b.speed = 0; return; } if (this.time < b.awayT) return; }
      b.away = false;
      b.x = o.x + R(-2, 2); b.z = o.z + R(-2, 2); if (b.x >= DUNGEON_MIN_X) [b.x, b.z] = dungeonPush(b.x, b.z, 0.4);
      b.y = walkHeight(b.x, b.z); b.target = null; b.cast = null; b.speed = 0;
      return;
    }
    if (b.away) b.away = false; // (the leader came back into reach)
    b.ai.t -= dt;
    if (b.ai.t <= 0) { b.ai.t = 0.25; b.target = b.ai.stance === 'passive' ? null : this.botPickTarget(b, o, H); }
    const ride = !H && !!o.mounted && !b.target && this.time - b.combatT > 5;
    b.paint = o.paint; b.runaboutMk = o.runaboutMk; b.crawler = o.crawler; b.mountKind = o.mountKind; b.runabout = o.runabout;
    if (ride !== !!b.mounted) { b.mounted = ride; this.broadcast({ k: 'mount', id: b.id, on: ride }); }
    const tgt = b.target ? this.mobs.get(b.target) : null;
    const ranged = !!CLASSES[b.cls]?.ranged; // classes.js ranged: ranger, chemist, herbalist, deadeye
    const healer = b.cls === 'herbalist';
    let goal = null, stopAt = 0;
    if (tgt) { goal = tgt; stopAt = (ranged ? (b.cls === 'deadeye' || b.cls === 'chemist' ? 9.5 : 12) : 2.2) + tgt.def.radius * 0.7; if (healer && dO > 16) { goal = o; stopAt = 8; } }
    else if (H) { goal = H; stopAt = 0.4; }
    else {
      // walk a little behind and to the side of the owner
      const bx = o.x - Math.sin(o.ry) * 2.6 + Math.cos(o.ry) * 1.8 * b.ai.side, bz = o.z - Math.cos(o.ry) * 2.6 - Math.sin(o.ry) * 1.8 * b.ai.side;
      goal = { x: bx, z: bz }; stopAt = dO < 4.5 ? 1.2 : 0.4;
    }
    // the Drying Lofts: a bot told to a louvre lever's handle (loftLevers) stands on it, fighting from there
    if (b.lever && this.time < b.lever.until && b.x >= DUNGEON_MIN_X) { goal = b.lever; stopAt = 0.3; } else if (b.lever) b.lever = null;
    b.speed = 0;
    { const w = this.houseWay(b, goal); if (w !== goal) { goal = w; stopAt = 0.25; } }
    if (!b.cast && !this.hasCC(b, 'stun') && !this.hasCC(b, 'root')) {
      let d = Math.hypot(goal.x - b.x, goal.z - b.z);
      // a ranged bot that ended up close to its foe (it followed a melee owner in) backs off to its range, out of the slams
      // and blasts round the foe's feet (v120 review: they stood in every boss slam)
      if (ranged && goal === tgt && d < stopAt - 3 && d > 0.05) { goal = { x: tgt.x + (b.x - tgt.x) / d * stopAt, z: tgt.z + (b.z - tgt.z) / d * stopAt }; stopAt = 0.4; d = Math.hypot(goal.x - b.x, goal.z - b.z); }
      if (d > stopAt) {
        const sp = CLASSES[b.cls].speed * (dO > 10 && !H ? 1.3 : 1) * (b.mounted ? mountSpeed(b) : 1);
        const step = Math.min(d - stopAt, sp * dt);
        b.x += ((goal.x - b.x) / d) * step; b.z += ((goal.z - b.z) / d) * step;
        if (b.x >= DUNGEON_MIN_X) [b.x, b.z] = dungeonPush(b.x, b.z, 0.4); else [b.x, b.z] = housePush(b.x, b.z, 0.4);
        b.y = walkHeight(b.x, b.z);
        b.ry = Math.atan2(goal.x - b.x, goal.z - b.z);
        b.speed = sp;
      } else if (tgt) b.ry = Math.atan2(tgt.x - b.x, tgt.z - b.z);
      else if (dO < 5 && !tgt) b.ry += (o.ry - b.ry) * Math.min(1, dt * 2);
    }
    if (!b.cast && this.time >= b.gcd && !this.hasCC(b, 'stun')) {
      const c = this.botChooseSkill(b, o, tgt);
      this.botAct(b, c);
    }
  }
  botPickTarget(b, o, hold) {
    const team = new Set(this.partyMembers(o).map((q) => q.id));
    const ok = (m) => m && !m.dead && (hold ? dist(m, hold) < 18 : dist(m, o) < 32) && (m.target && team.has(m.target) || [...m.threat.keys()].some((id) => team.has(id)));
    const cur = b.target ? this.mobs.get(b.target) : null;
    if (ok(cur)) return cur.id;
    const ot = o.target ? this.mobs.get(o.target) : null;
    if (ok(ot)) return ot.id;
    let best = null, bd = 1e9;
    for (const m of this.mobs.values()) { if (!ok(m)) continue; const d = dist(m, b); if (d < bd) { bd = d; best = m; } }
    return best?.id || null;
  }
  // (S15) a bot's press: a cast, or a dodge that opens a fusion (botplan.js opener); with botNoFuse (realfight --nofusion)
  // every press is plain
  botAct(b, c) { if (!c) return; if (c.dodge) this.on_dodge(b, c.dodge); else this.on_cast(b, this.botNoFuse ? { ...c, plain: true } : c); }
  botChooseSkill(b, o, tgt) {
    const tal = b.tal || baseMods();
    const usable = kitOf(b.cls).filter((s) => s.lvl <= b.level && !((b.cds[s.id] || 0) > this.time) && b.res >= skillCost(s, tal)
      && !s.fx.some((f) => f[0] === 'dash' || f[0] === 'leap' || f[0] === 'back'));
    const has = (s, k) => s.fx.some((f) => f[0] === k);
    const healer = b.cls === 'herbalist';
    // healing: anyone in the party who is hurt
    const team = this.partyMembers(o).filter((q) => !q.dead && dist(q, b) < 24);
    const hurt = team.sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
    // a bot healer (v120 review follow-up: it spent its resource on darts and let the tank die): a group heal when three are
    // hurt, a heal over time kept on whoever the foe is hitting, the cheapest good heal from 80%, the biggest below 50%,
    // and it keeps half its resource for healing
    if (healer) {
      // (S13) on the new kit: B in the link its last skill opened when the fusion helps (botHerbFuse); Lantern Flash first when
      // the group is hurt and Grand Remedy is ready (it fuses into Field Hospital); the smoke pot when two are hurt
      {
        if (b.link && b.effFuse && !b.link.open) { const fz = this.botHerbFuse(b, team, tgt, tal); if (fz) return fz; }
        const sore = team.filter((q) => q.hp / q.maxHp < 0.72);
        const lan = usable.find((s) => s.id === 'h_lantern'), rem = b.eff?.h_remedy;
        if (lan && rem && b.level >= 18 && sore.length >= 2 && !((b.cds.h_remedy || 0) > this.time + 0.6) && !((b.cds.hf_fieldhospital || 0) > this.time) && b.res >= skillCost(lan, tal) + skillCost(rem, tal) + 10) return { skill: lan.id };
        const pot = usable.find((s) => s.id === 'h_smoke');
        if (pot && sore.length >= 2) { const at = sore.sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]; return { skill: pot.id, target: at.id }; }
      }
      const hv = (s) => s.fx.reduce((t, f) => t + (f[0] === 'heal' ? f[1] : f[0] === 'hot' ? f[1] * 0.7 : f[0] === 'absorb' ? f[1] * 0.8 : 0), 0);
      const isHeal = (s) => has(s, 'heal') || has(s, 'hot') || has(s, 'absorb');
      for (const s of usable.filter((s) => s.target === 'self' && s.hit.kind === 'self' && s.hit.r && isHeal(s)).sort((a, c) => hv(c) - hv(a))) {
        if (team.filter((q) => dist(q, b) <= s.hit.r && q.hp / q.maxHp < 0.7).length >= 3) return { skill: s.id };
      }
      const ally = usable.filter((s) => s.target === 'ally' && isHeal(s));
      const tankQ = tgt?.target ? team.find((q) => q.id === tgt.target) : null;
      if (tankQ && tankQ.hp / tankQ.maxHp < 0.95) { const hot = ally.find((s) => has(s, 'hot') && !tankQ.buffs.some((x) => x.name === s.name)); if (hot) return { skill: hot.id, target: tankQ.id }; }
      const r = hurt ? hurt.hp / hurt.maxHp : 1;
      if (hurt && r < 0.8) {
        const shield = r < 0.6 && !(hurt.absorb > 0) && ally.find((s) => has(s, 'absorb'));
        if (shield) return { skill: shield.id, target: hurt.id };
        const direct = ally.filter((s) => has(s, 'heal')).sort((a, c) => (r < 0.5 ? hv(c) - hv(a) : hv(c) / skillCost(c, tal) - hv(a) / skillCost(a, tal)));
        if (direct[0]) return { skill: direct[0].id, target: hurt.id };
      }
      if (tgt?.type === 'mob' && !planWait(this, b)) { const op = opener(this, b, tgt, team, o !== b ? o : null); if (op) return op; } // (S15: Bitterroot, Bark Poultice, Thistle Net by the table)
      if (tgt && b.res < b.maxRes * 0.5 && team.some((q) => q.hp / q.maxHp < 0.9 || tgt.def?.boss)) { const dart = usable.find((s) => s.id === 'h_dart'); return dart && dist(b, tgt) <= dart.range + this.rad(tgt) ? { skill: dart.id, target: tgt.id } : null; } // (S13: Nettle Dart costs nothing and builds Herbs)
    }
    if (hurt && hurt.hp / hurt.maxHp < 0.72) {
      const heals = usable.filter((s) => (s.target === 'ally' || (s.target === 'self' && hurt === b)) && (has(s, 'heal') || has(s, 'hot') || has(s, 'absorb')));
      const r = hurt.hp / hurt.maxHp;
      const pick = heals.find((s) => has(s, 'hot') && r > 0.45 && !hurt.buffs.some((x) => x.name === s.name)) || heals.sort((a, c) => c.fx[0][1] - a.fx[0][1])[0];
      if (pick && (healer || r < 0.4)) return { skill: pick.id, target: hurt.id };
    }
    if (!tgt) return null;
    const dT = dist(b, tgt);
    // (S15) the fusion planner (shared/botplan.js): B in an open link, at the bot's skill rate and after its reaction time;
    // a plan waiting for A's contact holds the next press. Coarse bots never get here (they do not cast)
    const lead = o !== b ? o : null;
    { if (!healer) { const fz = linkFusion(this, b, tgt, team, lead); if (fz) return fz; } if (planWait(this, b)) return null; }
    // tanks pull enemies off the others
    // (and taunt before losing it: when someone else's threat on a boss comes within a tenth of the tank's own; and a taunt
    // round the tank also takes back the boss's adds that went for the others, the healer most of all)
    if (TANK_CLS.has(b.cls) && tgt.type === 'mob') {
      const lost = tgt.target && (tgt.target !== b.id || (tgt.def.boss && Math.max(0, ...[...tgt.threat].filter(([id]) => id !== b.id).map(([, v]) => v)) > 0.9 * (tgt.threat.get(b.id) || 0)));
      const taunt = usable.find((s) => has(s, 'taunt') && dT < (s.hit.r || 6) + 2);
      if (taunt && lost) return { skill: taunt.id, target: tgt.id };
      // (S9) a Warden on the new kit low on health under the machines: Challenge for its armour (and the taunt round him)
      const guard = b.hp / b.maxHp < 0.55 && usable.find((s) => s.fx.some((f) => f[0] === 'selfBuff' && f[1] === 'armor') && !b.buffs.some((x) => x.name === s.name));
      if (guard) return { skill: guard.id };
      const round = usable.find((s) => has(s, 'taunt') && s.hit.kind === 'aoe' && s.target === 'self');
      if (round && tgt.def.boss) {
        const ids = new Set(team.map((q) => q.id));
        const loose = [...this.mobs.values()].filter((x) => !x.dead && x !== tgt && x.target && x.target !== b.id && ids.has(x.target) && dist(x, b) < (round.hit.r || 6)).length;
        if (loose >= 2 || (loose && team.some((q) => q.cls === 'herbalist' && q !== b && [...this.mobs.values()].some((x) => !x.dead && x.target === q.id && dist(x, b) < (round.hit.r || 6))))) return { skill: round.id };
      }
    }
    // a reload when the resource runs low (the Deadeye's Quick Reload: a skill that gives resource back)
    if (b.res < 30) { const rl = usable.find((s) => has(s, 'res')); if (rl) return { skill: rl.id }; }
    // (S15) the opener table: cast A of the first fusion that fits, and plan B
    if (tgt.type === 'mob') { const op = opener(this, b, tgt, team, lead); if (op) return op; }
    const keepB = reservedB(this, b);
    const onFoe = (s) => tgt.buffs?.some((x) => x.name === s.name);
    // a marking debuff with no damage (Chalk Mark, Marked Target, Feint) when the target does not carry it yet
    const mark = usable.find((s) => s.target === 'enemy' && s.fx.every((f) => f[0] === 'debuff') && !onFoe(s) && dT <= s.range + this.rad(tgt) + 0.4);
    if (mark && tgt.type === 'mob') return { skill: mark.id, target: tgt.id };
    // a blinding smoke (Smoke Charge, Smoke Arrow) when a pack is on the group or the one they hit is hurt
    const smoke = usable.find((s) => s.target === 'ground' && !has(s, 'dmg') && s.fx.some((f) => f[0] === 'debuff' && f[1] === 'miss') && dT <= s.range);
    if (smoke && tgt.type === 'mob' && !onFoe(smoke)) {
      const hitting = [...this.mobs.values()].filter((m) => !m.dead && dist(m, tgt) <= (smoke.hit.r || 5) && m.target && this.players.get(m.target) && team.includes(this.players.get(m.target)));
      const victim = tgt.target ? this.players.get(tgt.target) : null;
      if (hitting.length >= 3 || (victim && victim.hp / victim.maxHp < 0.5)) return { skill: smoke.id, target: tgt.id, gx: tgt.x, gz: tgt.z };
    }
    // defensive buffs when low, offensive buffs in a fight
    const self = usable.filter((s) => s.target === 'self' && s.hit.kind === 'self' && has(s, 'buff') && !has(s, 'res')); // (a reload waits for low Powder)
    const low = b.hp / b.maxHp < 0.5;
    const buff = self.find((s) => s.fx.some((f) => f[0] === 'buff' && (low ? ['armor', 'block', 'evade'].includes(f[1]) : ['dmg', 'haste'].includes(f[1]))) && !b.buffs.some((x) => x.name === s.name));
    if (buff && rand() < 0.5) return { skill: buff.id };
    const attacks = usable.filter((s) => (s.fx.some((f) => f[0] === 'dmg' || f[0] === 'dot' || f[0] === 'execute') || (has(s, 'stun') && rand() < 0.3))
      && (s.target === 'enemy' ? dT <= s.range + this.rad(tgt) + 0.4 : s.target === 'ground' ? dT <= s.range : (s.hit.kind === 'aoe' && dT <= (s.hit.r || 4) + this.rad(tgt))));
    const pool = keepB?.size ? attacks.filter((s) => !keepB.has(s.id)) : attacks; // (a B kept for its A: pressed plain it wastes the fusion)
    if (!pool.length) return null;
    // coat-then-trigger (S15): a coat on the machine is set off by the skill of the right kind; a coat skill goes first when a
    // trigger is ready
    const first = coatFirst(tgt, pool);
    if (first) return { skill: first.id, target: tgt.id, gx: tgt.x, gz: tgt.z };
    pool.sort((a, c) => (c.cd || 0) - (a.cd || 0) + 8 * (coatScore(tgt, c) - coatScore(tgt, a)) + (rand() - 0.5) * 6);
    const s = pool[0];
    return { skill: s.id, target: tgt.id, gx: tgt.x, gz: tgt.z };
  }

  // ------------------------------------------------------------------ achievements
  achAdd(p, key, inc = 1) { if (p.bot) return; const c = p.ach.c; c[key] = (c[key] || 0) + inc; this.achWatch(p, key); this.achCheck(p, key); }
  // the Armory: the first time a character holds a named piece, it goes on their shelf for good
  armoryFind(p, id, quiet) {
    if (!id || p.bot || !p.ach || !ARMORY_SET.has(id) || p.ach.c['found:' + id]) return;
    p.ach.c['found:' + id] = 1;
    this.achAdd(p, 'found');
    if (ITEMS[id]?.dragonslayer) this.dragonslayerCheck(p);
    if (quiet) return;
    this.msg(p, `Added to your Armory: ${ITEMS[id].name} (${p.ach.c.found}/${ARMORY_TOTAL}).`, '#c8a0ff');
    p.session.send({ t: 'ev', list: [{ k: 'found', id }] });
  }
  // the Armory's best rarity found of each named piece (plan A8): 'fq:<item id>' = the highest q held so far
  armoryQ(p, g) { if (g?.id && !p.bot && p.ach && ARMORY_SET.has(g.id)) this.achSet(p, 'fq:' + g.id, g.q ?? 1); }
  achSet(p, key, v) { if (p.bot) return; const c = p.ach.c; if ((c[key] || 0) >= v) return; c[key] = v; this.achWatch(p, key); this.achCheck(p, key); }
  // tracked achievements: the client names up to three, and their counters are sent as they change
  on_achTrack(p, m) {
    p.achTrack = (Array.isArray(m.ids) ? m.ids : []).filter((id) => ACH_BY_ID[id]).slice(0, 3);
    p.achKeys = new Set(p.achTrack.flatMap((id) => { const a = ACH_BY_ID[id]; return a.c ? [a.c] : a.all || []; }));
  }
  achWatch(p, key) { if (p.achKeys?.has(key)) p.session.send({ t: 'achc', k: key, v: p.ach.c[key] }); }
  achCheck(p, key) {
    for (const a of ACH_BY_COUNTER[key] || []) if (!p.ach.done[a.id] && achDone(a, p.ach.c, p.ach.done)) this.achGrant(p, a);
  }
  achGrant(p, a, quiet) {
    p.ach.done[a.id] = Date.now();
    if (!quiet) {
      p.session.send({ t: 'ev', list: [{ k: 'ach', id: a.id }] });
      this.broadcast({ k: 'msg', text: `${p.name} has earned the achievement [${a.name}]!`, color: '#ffc040' });
      if (a.title) this.msg(p, `New title unlocked: ${a.title}. Choose it in the achievements window (Y).`, '#ffc040');
    }
    // meta achievements that needed this one
    for (const m of ACHIEVEMENTS) if (m.req?.includes(a.id) && !p.ach.done[m.id] && achDone(m, p.ach.c, p.ach.done)) this.achGrant(p, m, quiet);
    this.sendAch(p);
  }
  // counters that can be read straight off the character (also credits older saves)
  achSync(p, quiet) {
    if (p.bot) return;
    const c = p.ach.c, before = { ...p.ach.done };
    c.level = Math.max(c.level || 0, p.level);
    c.talents = Math.max(c.talents || 0, treeSpent(p.tree)); // ('talents' counts Web points since S16: an old save's talents are counted at the move)
    c.slots = Math.max(c.slots || 0, Object.values(p.equip).filter(Boolean).length);
    if (Object.values(p.equip).some((g) => g && g.q >= 4)) c.epic = 1;
    c.quests = Math.max(c.quests || 0, Object.keys(p.done || {}).length);
    for (const k of Object.keys(p.visited || {})) if (k.startsWith('z:')) c['zone:' + k.slice(2)] = 1;
    for (const [f, v] of Object.entries(p.rep || {})) c['rep:' + f] = Math.max(c['rep:' + f] || 0, v);
    c.repbest = Math.max(c.repbest || 0, ...Object.values(p.rep || {}), 0);
    // the Armory credits everything the character already holds: bags, worn gear, storehouse, companions' gear
    const held = [...(p.bag || []), ...(p.bank || []), ...Object.values(p.equip || {}).map((g) => g && { gear: g }), ...Object.values(p.compGear || {}).flatMap((s) => Object.values(s || {}).map((g) => g && { gear: g }))];
    for (const it of held) { const id = it?.gear?.id || it?.id; if (id && ARMORY_SET.has(id)) { c['found:' + id] = 1; const q = (it.gear || ITEMS[id]).q ?? 1; if (q > (c['fq:' + id] || 0)) c['fq:' + id] = q; } }
    // upgrades (plan A8): the old reforge counter carries over, and what is worn at +10 is counted
    c.up = Math.max(c.up || 0, c.reforge || 0);
    c.up10worn = Math.max(c.up10worn || 0, Object.values(p.equip).filter((g) => g && upOf(g) >= UPG.max).length);
    c.found = Object.keys(c).filter((k) => k.startsWith('found:')).length;
    for (const a of ACHIEVEMENTS) if (!p.ach.done[a.id] && achDone(a, c, p.ach.done)) this.achGrant(p, a, quiet);
    if (quiet) for (const id of Object.keys(p.ach.done)) if (!before[id]) p.ach.done[id] = 1; // credited, not earned just now
  }
  sendAch(p) { p.session.send({ t: 'ach', c: p.ach.c, done: p.ach.done, title: p.title }); }
  on_achq(p) { this.sendAch(p); }
  on_title(p, m) {
    const id = String(m.id || '');
    if (id && (!p.ach.done[id] || !ACH_BY_ID[id]?.title)) return;
    p.title = id;
    this.msg(p, id ? `Title set: ${p.name}${achTitle(id).startsWith('the ') ? ' ' : ', '}${achTitle(id)}` : 'Title cleared.', '#ffc040');
    this.sendAch(p);
  }

  // two loadouts (level 10): each keeps its own Skill Web tree, Forms and gear
  // a set's gear: slot -> the piece's own id (given the first time it is remembered; saved with the piece)
  gearSnapshot(p) {
    const out = {};
    for (const [slot, g] of Object.entries(p.equip || {})) if (g) { g.uid ||= newId('g'); out[slot] = g.uid; }
    return out;
  }
  // put on every remembered piece still in the bags; a swap never needs a free bag slot
  equipSet(p, set) {
    let moved = 0, missing = 0;
    for (const [slot, uid] of Object.entries(set)) {
      if (p.equip[slot]?.uid === uid) continue;
      const i = p.bag.findIndex((b) => b.gear?.uid === uid);
      if (i < 0) { missing++; continue; }
      const g = p.bag[i].gear;
      if ((g.req && p.level < g.req) || (g.classes && !g.classes.includes(p.cls)) || g.slot !== slot) { missing++; continue; }
      const old = p.equip[slot];
      p.bag.splice(i, 1);
      if (old) p.bag.push({ gear: old });
      p.equip[slot] = g;
      moved++;
    }
    return { moved, missing };
  }
  on_loadout(p, m) {
    const to = m.i === 1 ? 1 : 0;
    if (to === (p.lo || 0)) return;
    if (p.level < LOADOUT_LEVEL) return this.err(p, `A second loadout opens at level ${LOADOUT_LEVEL}.`);
    if (this.time - p.combatT < 5 || p.cast || p.duel || p.trial) return this.err(p, 'You cannot change loadouts in combat.');
    // each set remembers the gear it wore when you left it, and puts it back on when you return
    (p.lgear ||= [null, null])[p.lo || 0] = this.gearSnapshot(p);
    { // each loadout keeps its own Skill Web tree and Forms (S3)
      const W = p.webSets || [{ tree: {}, forms: {} }, { tree: {}, forms: {} }];
      W[p.lo || 0] = { tree: p.tree || {}, forms: p.forms || {} }; p.webSets = W;
      p.tree = { ...(W[to]?.tree || {}) }; p.forms = { ...(W[to]?.forms || {}) };
    }
    p.lo = to; p.lsT = 0;
    const swap = p.lgear[to] ? this.equipSet(p, p.lgear[to]) : null;
    this.recalc(p);
    p.hp = Math.min(p.hp, p.maxHp);
    this.msg(p, `You switch to your ${to ? 'second' : 'first'} loadout${swap?.moved ? ` and change ${swap.moved} piece${swap.moved > 1 ? 's' : ''} of gear` : ''}.${swap?.missing ? ` ${swap.missing} remembered piece${swap.missing > 1 ? 's are' : ' is'} no longer in your bags.` : ''}`, '#7ad0ff');
    this.pushSelf(p);
  }

  // ------------------------------------------------------------------ the Skill Web (S3, combat_design.md 4.3)
  // take one node (m.id) or a road of nodes in order (m.ids: the Web screen's Apply; all or nothing)
  on_tree(p, m) {
    const ids = Array.isArray(m.ids) ? m.ids.slice(0, 100) : [m.id];
    if (!ids.length || ids.some((id) => typeof id !== 'string' || !Object.hasOwn(TREE_BY_ID, id))) return this.err(p, 'There is no such place on the Web.');
    const next = { ...(p.tree || {}) };
    for (const id of ids) {
      const why = allocBlock(p.cls, next, id, treePoints(p.level, p.done) - treeSpent(next));
      if (why) return this.err(p, why);
      next[id] = 1;
    }
    p.tree = next;
    this.recalc(p);
    this.achSet(p, 'talents', treeSpent(p.tree));
    const n = TREE_BY_ID[ids[ids.length - 1]];
    this.msg(p, ids.length === 1 ? `Skill Web: ${n.name}.` : `Skill Web: ${ids.length} places taken, up to ${n.name}.`, '#7ad0ff');
    this.pushSelf(p);
  }
  webBusy(p) { return this.time - p.combatT < 5 || p.cast || p.duel || p.trial; }
  // hand back one leaf (the rest stays joined to the start): in a town, 2 x level copper (free at level 20 and below, for
  // 14 days after the move from talents and after a Web change)
  on_treeRefund(p, m) {
    if (typeof m.id !== 'string' || !Object.hasOwn(p.tree || {}, m.id) || !p.tree[m.id]) return;
    if (this.webBusy(p)) return this.err(p, 'You cannot change the Web in combat.');
    if (!isLeaf(p.cls, p.tree, m.id)) return this.err(p, 'Only the end of a road can be handed back: the rest must stay joined to your start.');
    const free = freeRespec(p), cost = free ? 0 : leafRefundCost(p.level);
    if (!free && !this.inHub(p)) return this.err(p, 'Hand back Web points in a town.');
    if (p.gold < cost) return this.err(p, 'Not enough money to hand that back.');
    p.gold -= cost;
    const { [m.id]: _, ...rest } = p.tree; p.tree = rest;
    const node = TREE_BY_ID[m.id];
    if (node?.kind === 'form') { const { [m.id]: __, ...f } = p.forms || {}; p.forms = f; }
    this.recalc(p);
    this.msg(p, `Skill Web: ${node?.name || m.id} handed back${cost ? ` for ${cost} copper` : ''}.`, '#7ad0ff');
    this.pushSelf(p);
  }
  // a full respec: today's talent reset price (free at level 20 and below, and in the free windows)
  on_treeReset(p) {
    if (!treeSpent(p.tree)) return;
    if (this.webBusy(p)) return this.err(p, 'You cannot change the Web in combat.');
    const cost = freeRespec(p) ? 0 : treeResetCost(p.level);
    if (p.gold < cost) return this.err(p, 'Not enough money to clear the Web.');
    p.gold -= cost; p.tree = {}; p.forms = {}; p.lsT = 0;
    this.recalc(p);
    this.msg(p, `Your Skill Web is clear${cost ? ` (${cost} copper)` : ''}. Spend the points again as you like.`, '#7ad0ff');
    this.pushSelf(p);
  }
  // pick a Form node's option (free, out of combat, no respec): m.id the node, m.opt the option
  on_treeForm(p, m) {
    if (typeof m.id !== 'string' || !Object.hasOwn(p.tree || {}, m.id) || !p.tree[m.id]) return;
    const node = TREE_BY_ID[m.id];
    if (node?.kind !== 'form') return;
    if (this.webBusy(p)) return this.err(p, 'You cannot change a Form in combat.');
    if (!formAllowed(node, m.opt, p.done)) return this.err(p, 'That Form opens with its chapter of the Main Story.');
    p.forms = { ...(p.forms || {}), [m.id]: m.opt };
    this.recalc(p);
    this.msg(p, `${node.form.opts.find((o) => o.id === m.opt).name} chosen.`, '#7ad0ff');
    this.pushSelf(p);
  }

  on_respawn(p) {
    if (!p.dead) return;
    p.dead = false; p.hp = Math.round(p.maxHp * 0.6); p.res = p.maxRes * 0.5; p.buffs = []; p.cast = null;
    const g = this.graveyard(p);
    this.teleport(p, g.x + R(-1.5, 1.5), g.z + R(-1.5, 1.5));
    p.graceT = this.time + 8; // nothing picks a fight on sight for the first few seconds
    if (!p.deathCounted) { p.deathCounted = true; this.achAdd(p, 'deaths'); }
    this.broadcast({ k: 'revive', id: p.id });
    this.pushSelf(p);
  }

  entity(id) { return this.players.get(id) || this.mobs.get(id) || null; }

  // where a fallen player wakes: the entrance hall of the dungeon they fell in, else the nearest graveyard
  graveyard(p) {
    const D = dungeonAt(p.x, p.z);
    if (D) return { x: (D.graveW || D.startW)[0], z: (D.graveW || D.startW)[1] }; // an open region wakes you at its camp
    // the nearest one on the same side of the mountains (never a walk over the ridge you cannot climb)
    const side = regionAt(p.x, p.z);
    let best = GRAVEYARDS[0], bd = 1e18;
    for (const g of GRAVEYARDS) {
      // a graveyard ringed by foes well above you is a death trap: it counts as much farther away
      const d = (g.x - p.x) ** 2 + (g.z - p.z) ** 2 + (regionAt(g.x, g.z) === side ? 0 : 1e12) + (this.graveDanger(g, p) ? 1e10 : 0);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }
  // true when a living foe that would attack on sight (level above yours + 2) roams within ~32 m of this graveyard
  graveDanger(g, p) {
    // judged from where each foe lives (its spawn ground or patrol path), not where it happens to stand right now, so the
    // answer never flickers between the death panel's label and the moment you get up
    for (const m of this.mobs.values()) {
      const sp = m.sp;
      if (!sp || sp.temp || sp.event || m.def.passive || m.def.dummy || m.x >= DUNGEON_MIN_X) continue;
      if (m.level <= p.level + 2) continue;
      const r = 32 + (sp.r || 0);
      const pts = sp.path || [[sp.x ?? m.home?.x ?? m.x, sp.z ?? m.home?.z ?? m.z]];
      for (const [x, z] of pts) if ((x - g.x) ** 2 + (z - g.z) ** 2 < r * r) return true;
    }
    return false;
  }
  // the name of the place a fallen player will wake (for the death panel's button)
  graveName(p) {
    if (dungeonAt(p.x, p.z)) return 'the entrance';
    const g = this.graveyard(p);
    return g === GRAVEYARDS[0] ? 'Sunmere' : (zoneAt(g.x, g.z)?.name || 'the graveyard');
  }
  // move a player instantly (doors, respawn, commands); the client fades if the jump is long
  teleport(p, x, z) {
    if (x >= DUNGEON_MIN_X) { [x, z] = dungeonPush(x, z, 0.4); this.dismount(p); }
    const far = Math.hypot(x - p.x, z - p.z) > 30;
    p.x = x; p.z = z; p.y = walkHeight(x, z); p.lastPos = this.time;
    p.cast = null;
    for (const m of this.mobs.values()) if (m.threat.has(p.id) && far) { m.threat.delete(p.id); if (m.target === p.id) m.target = null; }
    p.session.send({ t: 'correct', x, z, fade: far });
  }
  // dungeon doors: step through from the overworld entrance or the exit inside
  on_door(p, m) {
    if (p.dead) return;
    const D = DUNGEON_BY_ID[m.id];
    if (!D) return;
    if (m.exit) {
      if (Math.hypot(p.x - D.exitW[0], p.z - D.exitW[1]) > 7) return this.err(p, 'Too far away.');
      const a = D.door.ry;
      this.teleport(p, D.door.x + Math.sin(a) * 4, D.door.z + Math.cos(a) * 4);
    } else {
      if (Math.hypot(p.x - D.door.x, p.z - D.door.z) > 7) return this.err(p, 'Too far away.');
      if (D.open) {
        // an open region: always Normal, shared by everyone, never reset
        this.teleport(p, D.startW[0], D.startW[1]);
        this.msg(p, p.level < parseInt(D.level, 10) - 2 ? `You go down into ${D.name}. Everything down here is level ${D.level}: come back stronger.` : `You go down into ${D.name}. (Level ${D.level})`, '#e8c26a');
        this.checkReach(p);
        return;
      }
      // a door that opens only once a story step is done (the Makers' First Furnace: the end of Chapter 31)
      if (D.need?.done && !p.done?.[D.need.done]) return this.err(p, D.need.text || `${D.name} is shut for now.`);
      // dungeons made for the level 40 cap have no Tempest or Veteran; their Heroic is the raid kind (tougher, better loot, after a Normal clear)
      const cap = !D.raid && parseInt(D.level, 10) >= 36;
      let mode = D.raid || cap ? (m.heroic || m.tempest || m.veteran ? 'raidheroic' : 'normal') : m.tempest ? 'tempest' : m.veteran ? 'veteran' : m.heroic ? 'heroic' : 'normal';
      if (mode === 'veteran' && p.level < 38) return this.err(p, 'Veteran dungeons open at level 38.');
      if (mode === 'raidheroic') {
        const last = SPAWNS.filter((sp) => sp.dungeon === D.id && MOBS[sp.mob].boss).at(-1)?.mob;
        if (last && !(p.ach?.c?.['kill:' + last] > 0)) return this.err(p, `Defeat ${MOBS[last].name} on Normal before you try ${D.name} on Heroic.`);
      }
      if (mode === 'heroic' && p.level < 23) return this.err(p, 'Heroic dungeons open at level 23.');
      if (mode === 'tempest') {
        const boss = DUNGEON_BOSSES.find((k) => SPAWNS.some((sp) => sp.mob === k && sp.dungeon === D.id));
        if (p.level < TEMPEST.level) return this.err(p, 'Tempest dungeons open at level 25.');
        if (boss && !(p.ach?.c?.['hkill:' + boss] > 0)) return this.err(p, `Defeat ${MOBS[boss].name} on Heroic first.`);
      }
      const inside = [...this.players.values()].some((q) => q !== p && !q.bot && q.x >= DUNGEON_MIN_X && dungeonAt(q.x, q.z) === D);
      const cur = this.dmode[D.id] || 'normal';
      if (mode !== cur) {
        if (inside) { mode = cur; this.msg(p, `Others are already inside on ${{ heroic: 'Heroic', tempest: 'Tempest', veteran: 'Veteran', raidheroic: 'Heroic' }[cur] || 'Normal'}. You join them.`, '#e8c26a'); }
        else {
          this.dmode[D.id] = mode;
          // reset the dungeon for the new difficulty
          for (const mob of this.mobs.values()) if (mob.sp.dungeon === D.id) { this.spawnMob(mob.sp, mob); this.broadcast({ k: 'spawn', id: mob.id }); }
        }
      }
      this.teleport(p, D.startW[0], D.startW[1]);
      if (mode === 'veteran') this.msg(p, `You enter ${D.name} on Veteran. Everything here is level 39 to 41, and the loot is made for the level 40 cap.`, '#c890ff');
      else this.msg(p, mode === 'tempest' ? `You enter ${D.name} on Tempest. Everything here is level 25 to 27, the bosses call storm surges, and the Tempest-Forged set can drop. This week: ${tempestMods().map((k) => TEMPEST.mods[k].name).join(', ')}.` : mode === 'heroic' ? `You enter ${D.name} on Heroic. Everything here is level 24 to 26, and so is the loot.` : `You enter ${D.name}. (Level ${D.level})`, mode === 'tempest' ? '#9ab8ff' : mode === 'heroic' ? '#ff9a40' : '#e8c26a');
    }
    this.checkReach(p);
  }

  // queued: a press held in the input buffer (feel.js BUFFER, 0.3 s) is tried again every tick until it is legal; a press
  // that becomes legal within the buffer fires then (the latest press wins), anything earlier is dropped as before
  on_cast(p, m, queued = false) {
    if (p.dead) return;
    if (!p.eff) compileKit(p);
    const base = typeof m.skill === 'string' && Object.hasOwn(p.eff, m.skill) ? p.eff[m.skill] : null; // (the hero's compiled kit, shared/fusions.js; a class on the old kit: its legacy skills. Own ids only: '__proto__' or 'constructor' used to reach the cost with NaN and leave the resource NaN, free casts for ever)
    if (!base || base.from) return; // (a fusion is never cast by its own id: it is B pressed in A's link window)
    if (base.swapTo && p.eff[base.swapTo] && !p.eff[base.swapTo].swapTo) return this.on_cast(p, { ...m, skill: base.swapTo }, queued); // (S11 One Arrow: Quick Shot's key looses Piercing Arrow)
    if (queued) p.qcast = null;
    if (base.lvl > p.level) return this.err(p, 'You have not learned that yet.');
    if (this.hasCC(p, 'stun')) return this.err(p, 'You are stunned.');
    // B pressed in the link A opened casts the fusion A>B (fusionOf: unlock, the fusion's cooldown, the window with one
    // tick of grace and 0.15 s more for a chain the client claims, and the gate); else B plain. A chain casts its next step
    let fu = this.fusionOf(p, base, m), mix = null;
    // (S12) Bench Chemist: the third Acid Flask is Mix, the fusion of his last two skills (p.mixLog) at the machine, from range
    // and without the window, once every tal.benchChemist s. A fusion that moves him is left out
    if (!fu && p.tal?.benchChemist && base.id === 'c_acid' && base.chain && !m.plain && this.time >= (p.mixT || 0)) {
      const st = p.chain && p.chain.id === base.id && this.time - p.chain.at <= CHAIN_RESET ? (p.chain.step % base.chain.length) + 1 : 1;
      const L2 = p.mixLog || [], f = st === 3 && L2.length === 2 ? p.effFuse?.[L2[0] + '>' + L2[1]] : null;
      if (f && !f.triad && f.target === 'enemy' && !f.fx.some((e) => e[0] === 'dash' || e[0] === 'leap' || e[0] === 'back') && fusionUnlocked(p, f) && !((p.cds[f.id] || 0) > this.time) && p.eff[f.to]) fu = mix = f;
    }
    const sk = fu || (base.chain ? stepOf(base, p.chain && p.chain.id === base.id && this.time - p.chain.at <= CHAIN_RESET ? (p.chain.step % base.chain.length) + 1 : 1) : base);
    const hold = (until) => { if (until - this.time <= BUFFER + 1e-6) { p.qcast = queued && m.qUntil ? { m, until: m.qUntil } : { m: { ...m, qUntil: this.time + BUFFER }, until: this.time + BUFFER }; return true; } return false; };
    // the first moment it is legal: the current cast's contact, this skill's cooldown and (on the lock) the lock
    const castEnd = p.cast ? Math.max(p.cast.end, p.cast.t0 + lastHitT(p.cast.sk) / (p.cast.haste || 1)) : 0; // (S10: hit.ts, uneven contacts)
    // a fusion key pressed while A still winds up is held to A's contact + the buffer (press Rising Cut, press Skybreaker
    // at once: Stormfall if Rising Cut lands)
    if (!fu && p.cast && !p.cast.channel && !p.cast.hits && p.effFuse) {
      const f2 = p.effFuse[p.cast.sk.id + '>' + base.id];
      if (f2 && fusionUnlocked(p, f2) && !((p.cds[f2.id] || 0) > castEnd)) { const u = queued && m.qUntil ? m.qUntil : castEnd + BUFFER; if (this.time <= u + 0.051) { p.qcast = { m: { ...m, qUntil: u }, until: u }; return; } }
    }
    // a link to a core skill with no fusion keyed (L.open, S5): Iron Comet's landing to Shield Bash, Oathbound's parry to every
    // core skill. The press skips the lock and lands as an answer (stronger, with a heavy stop)
    const Lo = !fu && p.link?.open, answer = !!Lo && !base.from && base.id !== p.link.from && (Lo.to === '*' || Lo.to === base.id) && this.time <= Lo.until + LINK.tick + 1e-6;
    // (a fusion skips A's lock: the reward for landing. It waits for A's cancel point, the contact + 0.12 s, unless Hair
    // Trigger fires it on the contact frame, S5)
    const cutAt = fu && !(p.tal?.contactFire) ? Math.max(p.cutAt || 0, p.cast && !p.cast.channel ? castEnd + CANCEL_AFTER / (p.cast.haste || 1) : 0) : 0;
    if (base.charges > 1) this.chargeRegen(p, base); // (S8: Desert Step's charges; the cooldown stands only when none is left)
    const legalAt = Math.max(p.cast && !p.cast.channel ? castEnd + 0.001 : 0, cutAt, p.cds[base.id] || 0, sk.gcd && !fu && !answer ? p.gcd || 0 : 0);
    if (p.cast && p.cast.channel) return queued ? undefined : this.err(p, 'You are busy.');
    if (legalAt > this.time) {
      if (hold(legalAt)) return;
      if (queued) return;
      if (p.cast) return this.err(p, 'You are busy.');
      if ((p.cds[base.id] || 0) > this.time) return this.err(p, 'Not ready yet.');
      return;
    }
    if (p.cast) return queued ? undefined : this.err(p, 'You are busy.'); // (a multi-hit cast past its first contact)
    if (queued && m.qUntil && this.time > m.qUntil + 0.051) return; // (one tick of grace, then the held press is gone)
    const tal = p.tal || baseMods();
    let cost = fu ? skillCost(mix ? p.eff[mix.to] : base, tal) + (fu.extra || 0) : skillCost(sk, tal); // (a fusion: B's cost + its own extra; Mix: its B's)
    let kmul = 1, encore = false; // (Clean Link, Chainwork's Encore)
    if (tal.keys) { // the Skill Web: fusion cost (Chainwork), then the keystones' onCast (Quick Feet, Last Reserves)
      if (fu && tal.fuseCost) cost *= 1 + tal.fuseCost;
      cost = Math.round(runKeys(this, p, 'onCast', { sk, cost, fused: !!fu, chargesFull: p.dodgeN != null && p.dodgeN >= this.dodgeOf(p).charges }).cost);
      // Clean Link: a fusion in the window's first 0.35 s is free and 15% stronger, after 0.8 s 15% weaker. Chainwork: the
      // core skill pressed in a landed fusion's 0.8 s link is an Encore, 25% stronger with a heavy stop
      if (fu && tal.cleanEarly && p.link) { const el = this.time - (p.link.at ?? this.time); if (el <= tal.cleanEarly + 1e-6) { cost = 0; kmul = 1 + (tal.cleanBonus || 0); } else if (el > (tal.cleanLate || 9)) kmul = 1 - (tal.cleanPen || 0); }
      if (!fu && tal.encore && p.link?.encore && this.time <= p.link.until + LINK.tick + 1e-6) { encore = true; kmul *= 1 + tal.encore; }
    }
    if (answer) { encore = true; kmul *= 1 + (Lo.mul || 0); }
    // (S5 review) enough Valor for plain B but not for the fusion: B casts plain instead of the press being refused
    if (p.res < cost && fu && !m.plain && p.res >= skillCost(base, tal)) return this.on_cast(p, { ...m, plain: true }, queued);
    if (p.res < cost) return this.err(p, `Not enough ${CLASSES[p.cls].resource}.`);
    if (sk.rounds && tal.sixChambers && !this.roundsLeft(p)) return this.err(p, 'Both pistols are empty: slide or jump to reload.'); // (S10 Six Chambers)
    // a leap from the air (the client says it is airborne, m.air or its last pos): only with Iron Comet (S5)
    if (p.air && !p.bot && (sk.tags || []).includes('leap') && !sk.airCast) return this.err(p, 'You must be on the ground to leap.');
    let target = null, gx = null, gz = null;
    if (sk.target === 'enemy') {
      target = this.foeOf(p, m.target) || (fu && p.link?.tgt ? this.foeOf(p, p.link.tgt) : null);
      if (target && sk.noTarget && dist(p, target) > sk.range + this.rad(target) + 0.6) target = null; // (Short Hop: out of reach, it lands where you stand)
      if (!target && !sk.noTarget) return this.err(p, 'You need a target.');
      if (target) {
        const range = sk.range + this.rad(target) + 0.6;
        if (dist(p, target) > range) return this.err(p, 'Out of range.');
        if (houseCrosses(p.x, p.z, target.x, target.z)) return this.err(p, 'No clear line of sight.'); // never through a house wall
      }
    } else if (sk.nearest) { // (S11 Disengage: a self move that shoots the picked machine, else the nearest within reach; none is fine)
      target = this.foeOf(p, m.target);
      if (target && dist(p, target) > sk.nearest + this.rad(target)) target = null;
      if (!target) { let bd = sk.nearest; for (const q of this.foesOf(p)) { const d = dist(p, q) - this.rad(q); if (d < bd && !houseCrosses(p.x, p.z, q.x, q.z)) { bd = d; target = q; } } }
    } else if (sk.target === 'ally') {
      target = this.players.get(m.target) || (fu && p.link?.tgt ? this.players.get(p.link.tgt) : null) || p; // (S13: a fusion on an ally goes to the one A reached when none is picked)
      if (target.dead || target.id === p.duel?.with) target = p;
      if (sk.intercept && target === p) target = this.interceptAlly(p, sk.range) || p; // (S9 Intercept: the ally in most danger when none is picked)
      if (dist(p, target) > sk.range + 1) return this.err(p, 'Out of range.');
    } else if (sk.target === 'ground') {
      gx = Number(m.gx); gz = Number(m.gz);
      if (!isFinite(gx) || !isFinite(gz)) { const t = this.foeOf(p, m.target); if (t) { gx = t.x; gz = t.z; } else { gx = p.x + Math.sin(p.ry) * 8; gz = p.z + Math.cos(p.ry) * 8; } }
      const d = Math.hypot(gx - p.x, gz - p.z);
      if (d > sk.range + 1) { gx = p.x + ((gx - p.x) / d) * sk.range; gz = p.z + ((gz - p.z) / d) * sk.range; }
      if (houseCrosses(p.x, p.z, gx, gz)) return this.err(p, 'No clear line of sight.');
    }
    this.dismount(p); p.sit = false; if (p.salv) this.endSalvage(p, false);
    p.qcast = null; // (a cast that goes off replaces any press still held)
    p.res -= cost;
    const haste = (1 + p.hastePct + this.buffVal(p, 'haste')) * (tal.animMul || 1) / (sk.tempo || 1); // (Heavy Hand's price: animations at 0.9x; review 18 Nov: it was never applied. S9 Iron Weight: tempo 1.2, the swing 20% slower)
    // a fusion starts B's own cooldown and its own; A's was spent by A
    if (base.charges > 1) this.chargeSpend(p, base, skillCd(base, tal));
    else if (base.cd) p.cds[base.id] = this.time + skillCd(base, tal);
    if (fu) p.cds[fu.id] = this.time + skillCd(fu, tal);
    if (mix) { p.mixT = this.time + p.tal.benchChemist; p.mixLog = []; if (p.eff[mix.to].cd) p.cds[mix.to] = Math.max(p.cds[mix.to] || 0, this.time + skillCd(p.eff[mix.to], tal)); }
    else if (p.cls === 'chemist' && !fu && base.id !== 'c_acid') p.mixLog = [...(p.mixLog || []).slice(-1), base.id];
    // the recovery before another plain skill: the skill's own lock (feel.js, 0.45-0.9 s from its contact), not a flat GCD
    if (sk.gcd) p.gcd = this.time + (FEEL_ON ? skillFeel(sk).win.lock : GCD) / haste;
    const L = p.link; p.link = null; // (any cast spends the open window)
    if (m.keepLink && !fu && L) p.link = L; // (S10: the Snap Shot fired out of a slide keeps the slide's link for Slide Shot)
    p.chain = base.chain && !fu ? { id: base.id, step: sk.step, at: this.time } : null;
    p.combatT = this.time;
    p.eating = 0;
    const hitT = sk.hit.t / haste;
    // Opening (a perfect dodge): the next harmful skill crits on every contact
    const opening = sk.fx.some((f) => f[0] === 'dmg' || f[0] === 'execute' || f[0] === 'stun' || f[0] === 'knock') ? p.buffs.findIndex((b) => b.name === 'Opening') : -1; // (a heal or a buff never spends it)
    if (opening >= 0) p.buffs.splice(opening, 1);
    const cloak = sk.fx.some((f) => f[0] === 'dmg') ? p.buffs.findIndex((b) => b.name === 'Dust Cloak') : -1; // (S8 Dust Cloak: the next skill after a dodge crits)
    if (cloak >= 0) p.buffs.splice(cloak, 1);
    // (S8) out of reach while the move plays (Thousand Cuts, Whiteout); a Counter Stance's counter and Shield Step's block
    if (sk.untarget) p.untargT = Math.max(p.untargT || 0, this.time + sk.untarget);
    if (sk.guardNext) p.guardT = this.time + sk.guardNext;
    if (sk.ccImmune) p.ccImmT = this.time + hitT + 0.3; // (S9 Unstoppable: no stun or hold lands while the charge runs)
    const aFrom = fu ? p.castFrom : null; // (S11: where A began; Highwire Volley's rain comes down on it)
    p.castFrom = { x: p.x, z: p.z };
    const unseen = !!target && target.type === 'mob' && target.target !== p.id; // (S8 Desert Step: it had not turned on him yet)
    p.cast = { sk, t0: this.time, unseen, end: this.time + Math.max(hitT, (sk.channel || 0)), target: target?.id, gx, gz, hits: 0, channel: !!sk.channel, haste, opening: opening >= 0 || cloak >= 0, fused: !!fu, blocked: fu ? L?.blocked || 0 : 0, mul: kmul, encore, aFrom, holdDraw: !!(sk.draw && m.hold && !p.bot), spot: target && target.type === 'mob' ? { x: target.x, z: target.z } : null, mix: !!mix }; // (spot, S12: where the machine stood at the throw)
    if (target && target.type === 'mob') this.addThreat(target, p, 1);
    this.broadcast({ k: 'cast', id: p.id, skill: sk.id, base: fu ? base.id : undefined, step: sk.step || undefined, fc: sk.formChoreo || undefined, target: target?.id, gx, gz, haste, hot: sk.forge ? 1 : undefined, sf: m.slideFire ? 1 : undefined, hd: p.cast.holdDraw ? 1 : undefined }); // (hd, S11: a held draw: other clients hold the clip until 'loose') // (fc: a Form's clip, S8; hot: Forge-Heated Head, S9; sf: the Deadeye's shot out of a slide, S10)
    // (S10) Six Chambers' perfect reload: Snap Shot pressed in the last 0.2 s of the slide (not the slide's own shot) fills both
    // pistols with hot loads: the next six shots are 25% stronger and heat
    if (tal.sixChambers && base.id === 'd_snap' && !m.slideFire && p.dodgeAt != null && p.hotFrom !== p.dodgeAt) {
      const D = this.dodgeOf(p), e = this.time - p.dodgeAt;
      if (e >= D.dur - 0.2 - 1e-6 && e <= D.dur + 0.15) { p.hotFrom = p.dodgeAt; p.hotN = 6; p.rounds = [6, 6]; this.broadcast({ k: 'hotload', id: p.id }); }
    }
    if (fu) this.fusionFound(p, fu); // (the keystones' onLink runs when the fusion lands: linkAfter)
    this.pushSelf(p);
  }

  // skill charges (S8: Desert Step's two, Three Charges' three): p.skc[id] = { n, next }; a charge comes back every cooldown,
  // and the skill's cooldown (p.cds) stands only while no charge is left, so the bar and the buffer read it as before
  chargeRegen(p, sk) {
    const max = sk.charges, c = ((p.skc ||= {})[sk.id] ||= { n: max, next: 0, cd: sk.cd });
    if (c.n > max) c.n = max;
    while (c.n < max && c.next && this.time >= c.next - 1e-6) { c.n++; c.next = c.n < max ? c.next + (c.cd || sk.cd) : 0; }
    p.cds[sk.id] = c.n > 0 ? 0 : c.next;
    return c;
  }
  chargeSpend(p, sk, cd) {
    const c = this.chargeRegen(p, sk);
    c.n = Math.max(0, c.n - 1); c.cd = cd;
    if (!c.next) c.next = this.time + cd;
    p.cds[sk.id] = c.n > 0 ? 0 : c.next;
  }
  // the fusion B makes after the link p.link, or null (B plain): an authored pair, unlocked, not cooling (then B casts
  // plain and the bar shows a grey rim), inside the window (one 20 Hz tick of grace; up to 0.15 s more when the client
  // claims the chain, m.chain, and it is the link's own A: a client cannot claim a chain it did not cast), A's target
  // still standing when the fusion needs one, and the gate (shared/fusions.js gateOk; Opening counts for hit and done).
  // m.plain: B plain on purpose (Alt)
  fusionOf(p, B, m) {
    const L = p.link;
    if (!L || !p.effFuse || m.plain) return null;
    const f = p.effFuse[L.from + '>' + B.id];
    if (!f || !fusionUnlocked(p, f) || (p.cds[f.id] || 0) > this.time) return null;
    const late = this.time - L.until;
    if (late > LINK.tick + 1e-6 && !(m.chain === L.from && late <= LINK.tick + LINK.grace + 1e-6)) return null;
    if (f.target === 'enemy' && L.tgt && !this.foeOf(p, L.tgt)) return null; // (A's target fell: B fires plain at the next)
    const tgt = f.target === 'enemy' ? this.foeOf(p, m.target) || (L.tgt ? this.foeOf(p, L.tgt) : null) : null;
    const opening = p.buffs.some((b) => b.name === 'Opening');
    return gateOk(f, L, tgt, opening, (e, st) => this.hasState(e, st)) ? f : null;
  }
  // an enemy state a fusion gate asks for: lifted (in the air), staggered (Staggered, stunned or kneeling), or a buff name
  hasState(e, st) {
    if (st === 'lifted') return e.airT > this.time;
    if (st === 'staggered') return e.buffs.some((b) => b.name === 'Staggered' || b.name === 'Stunned' || b.name === 'Kneeling');
    return e.buffs.some((b) => b.name.toLowerCase() === st);
  }
  // the first cast of a fusion is a discovery (section 3.2): "New fusion", 5% of a level, the Book entry (p.fusions,
  // saved); the client plays the contact beat at 0.6x once for the own hero, except in dungeons, raids and duels
  fusionFound(p, f) {
    if (p.bot || !p.fusions || p.fusions.includes(f.id)) return;
    p.fusions.push(f.id);
    const slow = !(p.x >= DUNGEON_MIN_X) && !p.duel;
    p.session.send({ t: 'ev', list: [{ k: 'fusionNew', f: f.id, name: f.name, slow }] });
    this.msg(p, `New fusion: ${f.name}! (${nameOf(f.from, p.cls)}, then ${nameOf(f.to, p.cls)}.) It is in your Fusion Book.`, '#ffd870');
    this.giveXp(p, Math.max(1, Math.round(xpForLevel(p.level) * DISCOVER_XP)));
  }
  // after a contact of a hero on the new kit: a core skill that landed opens the link window; a fusion counts a landed use
  // (mastery) and opens a link only to its triad's last input when the triad's notable is taken
  linkAfter(p, sk, c, enemies, allies) {
    const hit = enemies.length > 0 || (!!sk.sureLand && !sk.from), done = hit || allies.length > 0 || !!sk.selfDone; // (S10: Quickdraw counts as landed; Recoil Jump as done)
    if (sk.from) {
      if ((c.hits || 0) < (sk.hit.n || 1) - 1 || !done) return;
      p.fmastery ||= {};
      const n = (p.fmastery[sk.id] = (p.fmastery[sk.id] || 0) + 1);
      if (MASTERY.includes(n) && !p.bot) this.msg(p, `${sk.name}: mastery rank ${['I', 'II', 'III'][MASTERY.indexOf(n)]}.`, '#ffd870');
      if (p.tal?.keys) runKeys(this, p, 'onLink', { fusion: sk }); // (Momentum, Shared Courage, Rolling Start: a landed fusion; review 18 Nov: they ran on the cast, so a whiffed fusion stacked Momentum)
      const tri = (hit || (sk.target !== 'enemy' && done)) && (FUSIONS[p.cls] || []).find((t) => t.triad && t.from === sk.id && fusionUnlocked(p, t)); // (S13: Bark Poultice reaches an ally, no machine: Full Dressing)
      if (tri) p.link = { from: sk.id, at: this.time, until: this.time + LINK.win + (p.tal?.linkWin || 0), landed: true, done: true, step: 0, tgt: c.target, encore: !!p.tal?.chainwork }; // (linkWin: Long Breath, Practised Links, Hair Trigger apply to every link)
      else if (hit && p.tal?.chainwork && !sk.triad) p.link = { from: sk.id, at: this.time, until: this.time + p.tal.chainwork, landed: true, done: true, step: 0, tgt: c.target, encore: true }; // (Chainwork: an Encore link; no fusion is keyed from it)
      return;
    }
    if (sk.chain && sk.step < sk.steps) return; // (chain steps 1-2 never link)
    if (sk.target === 'enemy' ? !hit : !done) return; // (a whiff opens nothing)
    const lock = (FEEL_ON ? skillFeel(sk).win.lock : GCD) / (c.haste || 1);
    const prev = p.link && p.link.from === sk.id && p.link.at >= c.t0 ? p.link : null; // (a multi-hit: later contacts keep it open)
    const until = Math.max(this.time + LINK.win + (p.tal?.linkWin || 0) + (p.tal?.linkSk?.[sk.id] || 0), c.t0 + lock + LINK.afterLock, prev?.until || 0); // (linkSk: Steady Arm's +0.3 s on Valiant Strike)
    p.link = { from: sk.id, at: prev?.at ?? this.time, until, landed: hit || !!prev?.landed, done, step: sk.step || 0, tgt: c.target || null, parried: false };
  }
  // the letter from the class trainer when a hero's class moves to the new kit (section 11)
  kitLetter(p, pts = 0) {
    const C = CLASSES[p.cls], f = (FUSIONS[p.cls] || [])[0];
    this.systemPost(p, `${C.name} Trainer`, 'A new way to fight', `Your ${C.name}'s way of fighting has changed. You now carry seven skills and a dodge, and two skills pressed one after the other can fuse into a new move${f ? `: land ${nameOf(f.from, p.cls)}, then press ${nameOf(f.to, p.cls)} at once, for ${f.name}` : ''}. Each fusion you find goes into your Fusion Book. ${pts ? `Your ${pts} talent point${pts > 1 ? 's have' : ' has'} been handed back` : 'The old talents are gone'}: spend your points on the Skill Web (N), and change your mind for free for the next 14 days.`);
  }

  // the dodge (feel.js DODGE, combat_design.md 2.4): two charges, one back every 3.5 s; 0.3 s of evade from the start (every
  // hit in it misses); a machine's swing or telegraph that would have landed in it is a perfect dodge and gives Opening. A
  // dodge pressed in a skill's wind-up is held (the buffer) and fires at its contact; a cast-time skill is cut at once.
  // Players move themselves (the client plays the roll as root motion and reports where it ends, clamped by on_pos); bots
  // are moved here with the same clamps that knockback uses.
  // the hero's dodge with the Web's keystones on it (Quick Feet: 3 charges and 0.45 s of evade; Momentum: 30% slower
  // recovery; Iron Comet: the roll no longer evades). Before this review only their prices applied
  dodgeOf(p) { return dodgeWith(p.cls, p.tal); }
  dodgeRegen(p, D) {
    if (p.dodgeN == null) { p.dodgeN = D.charges; p.dodgeNext = 0; }
    while (p.dodgeN < D.charges && p.dodgeNext && this.time >= p.dodgeNext) { p.dodgeN++; p.dodgeNext = p.dodgeN < D.charges ? p.dodgeNext + D.regen : 0; }
  }
  on_dodge(p, m, queued = false) {
    if (p.dead || !FEEL_ON) return;
    if (queued) p.qdodge = null;
    if (this.hasCC(p, 'stun') || this.hasCC(p, 'root')) return queued ? undefined : this.err(p, 'You cannot move.');
    const D = this.dodgeOf(p);
    this.dodgeRegen(p, D);
    const until = queued ? m.qUntil : this.time + BUFFER;
    const hold = (t) => { if (t - this.time <= BUFFER + 1e-6 && this.time <= until + 0.051) { p.qdodge = { m: { dx: m.dx, dz: m.dz, qUntil: until }, until }; return true; } return false; };
    if (p.dodgeN < 1) { if (!hold(p.dodgeNext)) return queued ? undefined : this.err(p, 'No dodge left.'); return; }
    // (S10) the Deadeye's gun on the run: a slide cuts a shot's wind-up by firing it now (its first contact comes forward, the
    // rest of a multi-shot is cut), so a shot never holds the slide back
    if (D.slide && p.cast && !p.cast.channel && p.cast.hits === 0 && (p.cast.sk.tags || []).includes('shot') && p.cast.sk.hit.kind === 'proj') { p.cast.t0 = this.time - hitAt(p.cast.sk.hit, 0) / (p.cast.haste || 1); this.updateCast(p); }
    if (p.cast && !p.cast.channel && !p.cast.sk.cast && p.cast.hits === 0) { hold(p.cast.end); return; } // held to the contact
    if (p.cast) this.cancelCast(p);
    p.dodgeN--;
    if (!p.dodgeNext) p.dodgeNext = this.time + D.regen;
    p.evadeT = this.time + D.evade; p.dodgeAt = this.time; p.dodgeFrom = { x: p.x, z: p.z };
    if (D.parry) { p.parryT = this.time + D.parry; p.parryFrom = 's_counter'; p.parryCounter = 0; } // (Counter Guard, S8: the sidestep is a parry that opens Riptide)
    if (p.tal?.hooks?.length) runKeys(this, p, 'onDodge', {}); // (Dust Cloak)
    p.blockT = D.block ? this.time + D.block : 0; // (Oathbound's Shield Step: a frontal block)
    if (!D.keepChain) p.chain = null; // (S11: the Ranger's Tumble keeps the arrow nocked)
    // (S10) the Deadeye's Slide: Six Chambers reloads the emptier pistol; with Snap Shot held (m.fire) a shot goes off out of the
    // slide; Never Still counts a slide double (the move itself is counted as it goes, tickDeadeye)
    if (D.slide && p.type === 'player') {
      if (p.tal?.sixChambers) { const R0 = (p.rounds ||= [6, 6]); R0[R0[0] <= R0[1] ? 0 : 1] = 6; }
      if (m.fire && p.eff?.d_snap) p.slideFire = { at: this.time + (D.slideShot || 0.14), target: m.target ?? p.target ?? null };
      if (p.tal?.neverStill) { (p.mvLog ||= []).push([this.time, D.dist]); p.mvAt = this.time; }
    }
    p.link = { from: 'dodge', at: this.time, until: this.time + D.dur + LINK.win + (p.tal?.linkWin || 0), landed: true, done: true, step: 0, tgt: null, parried: false }; // (the dodge is an input: gate 'dodge')
    let dx = Number(m.dx), dz = Number(m.dz), l = Math.hypot(dx, dz);
    if (D.shieldStep) { dx = Math.sin(p.ry); dz = Math.cos(p.ry); l = 1; } // (Shield Step: always forward, behind the shield)
    if (!isFinite(l) || l < 1e-3) { dx = -Math.sin(p.ry); dz = -Math.cos(p.ry); l = 1; } // no direction: backwards
    dx /= l; dz /= l;
    if (p.bot && D.dist > 0) {
      const ox = p.x, oz = p.z;
      let nx = p.x + dx * D.dist, nz = p.z + dz * D.dist;
      if (nx >= DUNGEON_MIN_X) [nx, nz] = dungeonPush(nx, nz, 0.4);
      else { [nx, nz] = clampWorld(nx, nz, ox, oz, 0); if (houseCrosses(ox, oz, nx, nz)) { nx = ox; nz = oz; } else [nx, nz] = housePush(nx, nz, 0.4); }
      p.x = nx; p.z = nz; p.y = walkHeight(nx, nz);
    }
    this.broadcast({ k: 'dodge', id: p.id, dx: +dx.toFixed(2), dz: +dz.toFixed(2), s: D.shieldStep ? 1 : undefined, f: p.slideFire ? 1 : undefined, tg: p.slideFire?.target || undefined }); // (f, tg: S10, the Deadeye's slide fires out of it at tg)
    p.session?.send?.({ t: 'dodgeN', n: p.dodgeN, next: p.dodgeNext });
  }

  // bots cannot read a telegraph: when one goes down, each bot standing in it is picked to step out at BOT_SIDESTEP (the
  // same odds as before S1) and the ones picked dodge out of it (on_dodge, away from the spot's middle) 0.3 s before it
  // lands. A.side: the bots picked (no damage, as before); side.hit: bots in it that were not picked (they take it)
  botSidePlan(a) {
    a.side = new Set(); a.side.hit = new Set();
    for (const p of this.players.values()) {
      if (!p.bot || p.dead) continue;
      const sp = a.spots.find((q) => Math.hypot(p.x - q.x, p.z - q.z) < q.r);
      if (!sp) continue;
      if (rand() >= BOT_SIDESTEP) { a.side.hit.add(p.id); continue; }
      a.side.add(p.id);
      let dx = p.x - sp.x, dz = p.z - sp.z, l = Math.hypot(dx, dz);
      if (l < 0.3) { const o = this.mobs.get(a.src) || a.caller; dx = p.x - (o?.x ?? p.x - 1); dz = p.z - (o?.z ?? p.z); l = Math.hypot(dx, dz) || 1; }
      if (sp.r - l > dodgeFor(p.cls).dist + 0.5) continue; // (too deep to roll out in one go: it walks, as before)
      p.botDodge = { at: Math.max(this.time, a.t - 0.3), dx: dx / l, dz: dz / l };
    }
  }

  // (S11) the Ranger lets go of a held draw (the client's key or touch coming up): a tap (under 0.25 s) leaves the press to
  // draw to full and loose by itself; a hold looses now (never before the shortest draw), its power from draw.lo at the
  // shortest to 1 at full, and the contact follows 0.04 s after
  on_release(p) { const c = p.cast; if (c?.holdDraw && !p.dead) { if ((this.time - c.t0) * c.haste < 0.25) c.holdDraw = false; else this.looseDraw(p); } }
  looseDraw(p) {
    const c = p.cast, D = c.sk.draw, el = Math.max(D.min, (this.time - c.t0) * c.haste);
    c.holdDraw = false;
    const k = el >= D.full ? 1 : D.lo + (1 - D.lo) * (el - D.min) / Math.max(1e-3, D.full - D.min);
    c.mul = (c.mul || 1) * k; c.drawK = +k.toFixed(2);
    const at = Math.max(this.time, c.t0 + D.min / c.haste) + 0.04 / c.haste;
    c.t0 = at - c.sk.hit.t / c.haste; c.end = at;
    this.broadcast({ k: 'loose', id: p.id, at: +(at - this.time).toFixed(2), dk: c.drawK });
  }

  cancelCast(p, why) {
    p.cast = null;
    this.broadcast({ k: 'castStop', id: p.id });
    if (why) this.err(p, why);
  }

  // resolve skill impacts while casting
  updateCast(p) {
    const c = p.cast;
    if (!c) return;
    const sk = c.sk;
    const n = sk.hit.n || 1, gap = (sk.hit.gap || 0) / c.haste;
    if (c.holdDraw) { if ((this.time - c.t0) * c.haste >= sk.draw.max - 1e-6) this.looseDraw(p); else return; } // (S11 Piercing Arrow held)
    const t = this.time - c.t0;
    while (c.hits < n && t >= (sk.hit.ts ? hitAt(sk.hit, c.hits) / c.haste : sk.hit.t / c.haste + c.hits * gap)) { // (S10: hit.ts, Fan the Hammer's and Broadside's uneven gaps)
      this.applySkill(p, sk, c);
      c.hits++;
      if (c.hits >= n) p.cutAt = this.time + CANCEL_AFTER / c.haste; // (A's cancel point: a fusion may cut its follow-through from here)
    }
    if (c.hits >= n && this.time >= c.end) p.cast = null;
  }

  applySkill(p, sk, c) {
    const target = c.target ? this.entity(c.target) : null;
    // (S10) the Deadeye's rounds (Six Chambers): a shot contact spends one; none left is a dry click; a hot load is 25% and heat
    let rmul = 1;
    if (sk.rounds && p.type === 'player' && p.tal?.sixChambers && !c.after) {
      if (!this.roundsLeft(p)) { if (!c.dry) { c.dry = true; this.broadcast({ k: 'dry', id: p.id }); } return; } // (one click a cast)
      this.spendRound(p);
      if (p.hotN > 0) { p.hotN--; rmul = 1.25; sk = tagged(HOT_REC, sk, 'heat'); }
    }
    // (S10) a record with seq names each contact's own hit and effects (Recoil Vault: the ground blast, then the apex shots)
    const S0 = sk.seq ? sk.seq[Math.min(c.hits || 0, sk.seq.length - 1)] : null;
    const h = S0?.hit ? { ...sk.hit, ...S0.hit } : sk.hit;
    // (S11) at 'trap': round the Ranger's trap; with Trapper's Ground each other trap gets its own pass first (no link)
    if (h.at === 'trap' && !c.trapAt) {
      const TL = this.trapsFor(p), all = p.tal?.trapAll && TL.length > 1;
      if (all) for (const T of TL.slice(0, -1)) this.applySkill(p, sk, { ...c, trapAt: T, extraTrap: true });
      c = { ...c, trapAt: TL[TL.length - 1] || (target ? { x: target.x, z: target.z } : { x: p.x, z: p.z }), trapList: TL };
    }
    const ahead = (dd) => ({ x: p.x + Math.sin(p.ry) * dd, z: p.z + Math.cos(p.ry) * dd });
    // (S12) the Chemist: c.ctr a bomb's resting place; at 'spot' where the machine stood at the throw; at 'here' where the
    // fusion began; at 'puddle' his nearest puddle (a burning one first), else the machine; a cluster's bombs land side by side
    const pud = h.at === 'puddle' && !c.ctr ? this.puddleFor(p, target) : null;
    let center = c.ctr ? c.ctr : h.at === 'smoke' ? (this.herbZoneFor(p, p) || p) : h.at === 'spot' ? (c.spot || target || p) : h.at === 'here' ? (p.castFrom || p) : h.at === 'puddle' ? (pud ? (pud.follow ? p : pud) : target || p) : h.at === 'trap' ? c.trapAt : h.at === 'cast' ? (c.aFrom || p.castFrom || p) : h.at === 'target' && !target && sk.noTarget && sk.fx.some((f) => f[0] === 'trap') ? ahead(Math.min(8, sk.range || 8)) : sk.target === 'ground' ? { x: c.gx, z: c.gz } : h.at === 'target' && target ? target : (h.kind === 'aoe' || h.kind === 'self') ? p : target || p; // (h.at 'target': round the machine, Thousand Cuts, S8)
    if (h.cluster && !c.ctr && (c.hits || 0) !== 1) { const k = (c.hits || 0) - 1; center = { x: center.x + Math.cos(p.ry || 0) * k * h.cluster, z: center.z - Math.sin(p.ry || 0) * k * h.cluster }; }
    // gather affected entities
    let enemies = [], allies = [];
    if (h.kind === 'melee' || h.kind === 'proj') { if (target && (sk.target === 'enemy' || sk.nearest) && (target.type === 'mob' ? !target.dead : this.foeOf(p, target.id))) enemies = [target]; if (sk.target === 'ally' || sk.target === 'self') allies = [target || p]; }
    if (h.kind === 'self') allies = h.r ? [...this.players.values()].filter((q) => !q.dead && dist(q, p) <= h.r && q.id !== p.duel?.with) : [p];
    if (h.kind === 'aoe' || h.kind === 'ground') enemies = this.foesOf(p).filter((m) => dist(m, center) <= (h.r || 4) + this.rad(m));
    if (h.kind === 'proj' && h.r && target) enemies = this.foesOf(p).filter((m) => dist(m, target) <= h.r + this.rad(m));
    if (h.kind === 'cone' || h.kind === 'line') {
      // (S9) h.from 'cast': the line runs from where the cast began (Earthbreaker's furrow behind the charge); h.lines: one
      // fissure a contact, each [side offset m, turn deg] (Fault Line's two, 1.5 m apart and 14 deg uneven)
      const o0 = h.from === 'cast' && p.castFrom ? p.castFrom : p;
      const fx = Math.sin(p.ry), fz = Math.cos(p.ry);
      const ax0 = target ? target.x - o0.x : fx, az0 = target ? target.z - o0.z : fz;
      const al0 = Math.hypot(ax0, az0) || 1;
      let dx0 = ax0 / al0, dz0 = az0 / al0, ox = o0.x, oz = o0.z;
      const LN = h.lines?.[Math.min((c.hits || 0), h.lines.length - 1)];
      if (LN) { ox += dz0 * LN[0]; oz -= dx0 * LN[0]; const a = LN[1] * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a); [dx0, dz0] = [dx0 * ca + dz0 * sa, -dx0 * sa + dz0 * ca]; }
      for (const m of this.foesOf(p)) {
        const vx = m.x - ox, vz = m.z - oz, d = Math.hypot(vx, vz);
        if (d > (h.r || 6) + this.rad(m)) continue;
        const along = vx * dx0 + vz * dz0;
        if (h.kind === 'cone') { if (along / (d || 1) >= Math.cos(((h.cone || 60) * Math.PI) / 360) || d < 1.5) enemies.push(m); }
        else { const side = Math.abs(vx * dz0 - vz * dx0), s0 = h.seg ? (c.hits || 0) * h.seg : 0; if (along > s0 && (!h.seg || along <= s0 + (h.segW || h.seg)) && side < 1.6 + this.rad(m)) enemies.push(m); } // (h.seg, S11 Ridgeline Salvo: one stretch of the line a contact, down its length)
      }
    }
    // (S10) Iron Slug's pierce: the shot goes on through every machine on its line; Split Pair and Chain Shot: the machine
    // nearest the target (within splitR, 6 m) is struck too
    if (target && h.kind === 'proj' && sk.pierce && enemies.length) { const ax = target.x - p.x, az = target.z - p.z, al = Math.hypot(ax, az) || 1; for (const m of this.foesOf(p)) { if (m === target || m.dead) continue; const vx = m.x - p.x, vz = m.z - p.z, along = (vx * ax + vz * az) / al; if (along > 0 && along < (sk.range || 22) + 2 && Math.abs(vx * az - vz * ax) / al < 1.4 + this.rad(m)) enemies.push(m); } }
    if (target && sk.split && enemies.length && (h.kind === 'proj' || h.kind === 'melee' || (h.kind === 'line' && !(c.hits || 0)))) { const near = this.foesOf(p).filter((m) => !m.dead && !enemies.includes(m) && dist(m, target) <= (sk.splitR || 6) + this.rad(m)).sort((x, y) => dist(x, target) - dist(y, target)).slice(0, sk.split); enemies.push(...near); }
    // house walls block every hit: an area hit from its centre, all others from the caster
    // (a splashing bolt: the struck target from the caster, the splash from the target)
    if (enemies.length) {
      const o = (h.kind === 'aoe' || h.kind === 'ground') ? center : h.kind === 'proj' && h.r && target ? target : p;
      enemies = enemies.filter((m) => (m === target ? !houseCrosses(p.x, p.z, m.x, m.z) : true) && (m === o || !houseCrosses(o.x, o.z, m.x, m.z)));
    }
    // (S12) a bomb (sk.fuse): this contact is its landing; it lies there and bursts sk.fuse s later (tickChemist); the link
    // opens now, landed when a machine is within its reach
    if (sk.fuse && !c.lit) { this.layBomb(p, sk, c, center, target, enemies, allies, pud); return; }
    const tal = p.tal || baseMods(), tsk = tal.sk[sk.id];
    const area = h.kind === 'aoe' || h.kind === 'ground' || h.kind === 'cone' || h.kind === 'line';
    const skPow = 1 + (tsk?.pow || 0);
    const power = p.power * (1 + this.buffVal(p, 'dmg')) * (1 + tal.dmg) * skPow * (area ? 1 + tal.aoe : 1) * (c.mul || 1) * rmul; // (rmul: a hot load, S10)
    // (S13) the Herbalist's Sap: his next heal spends every drop Nettle Dart stored, 8% stronger for each
    const sapMul = p.sap > 0 && p.type === 'player' && (S0?.fx || sk.fx).some((f) => HEALS.has(f[0])) ? 1 + 0.08 * p.sap : 1;
    if (sapMul > 1) { p.sap = 0; p.buffs = p.buffs.filter((bf) => bf.name !== 'Sap'); }
    const healPow = p.power * (1 + tal.heal) * skPow * sapMul;
    const cc1 = 1 + tal.ccDur;
    // the contact being resolved: poise, lifts, the hit-stop tier and Opening's crit are read by damage() (feel.js)
    const fe = FEEL_ON ? skillFeel(sk) : null;
    this._hc = fe ? { sk, i: c.hits || 0, opening: !!c.opening, brk: fe.brk, launch: fe.launch, bash: fe.bash, air: sk.fx.find((f) => f[0] === 'air')?.[1] || 0, src: p, broke: new Set(), encore: !!c.encore } : null;
    if (S0 && this._hc) { const b2 = S0.fx?.find((f) => f[0] === 'brk'); if (b2) this._hc.brk = b2[1]; this._hc.air = S0.fx?.find((f) => f[0] === 'air')?.[1] || 0; this._hc.launch = S0.fx?.find((f) => f[0] === 'launch')?.[1] || 0; } // (S10: a seq contact's own poise and air bonus)
    // a fusion's last contact may add its own effects (fxLast: Kingsfall's slam, High Ledger's re-lift)
    const lastHit = (c.hits || 0) >= (h.n || 1) - 1;
    // (S8: a finisher's added damage joins the contact's own, one blow and one number: Sandspout's dive)
    const fxl = lastHit && sk.fxLast ? (sk.fxLast.some((f) => f[0] === 'dmg') ? [...sk.fx.map((f) => (f[0] === 'dmg' ? ['dmg', f[1] + sk.fxLast.filter((g) => g[0] === 'dmg').reduce((t, g) => t + g[1], 0), ...f.slice(2)] : f)), ...sk.fxLast.filter((f) => f[0] !== 'dmg')] : [...sk.fx, ...sk.fxLast]) : (S0?.fx || sk.fx);
    if (lastHit && sk.fxLast && this._hc) { const b2 = sk.fxLast.find((f) => f[0] === 'brk'); if (b2) this._hc.brk = b2[1]; const l2 = sk.fxLast.find((f) => f[0] === 'launch'); if (l2) this._hc.launch = l2[1]; } // (S9 Trip Hammer: the upswing lifts, the smash before it does not)
    if (c.after && this._hc) { this._hc.brk = Math.round(this._hc.brk * 0.5); this._hc.after = true; } // (an Aftershock: half the poise too)
    for (const [type, a, b, cc] of fxl) {
      switch (type) {
        case 'dmg': for (const m of enemies) this.damage(p, m, power * a * R(0.9, 1.1), sk.id); break;
        case 'execute': for (const m of enemies) if (!m.dead && m.hp / m.maxHp < 0.35) this.damage(p, m, power * a * R(0.9, 1.1), sk.id); break;
        case 'dot': for (const m of enemies) this.addBuff(m, { name: sk.name, stat: 'dot', dot: (power * a * (1 + tal.dot)) / b, t: b, dur: b, src: p.id, tick: 0, debuff: true, icon: sk.icon }); break;
        case 'heal': for (const q of allies) this.heal(p, q, healPow * (1 + this.buffVal(p, 'dmg')) * a * R(0.95, 1.05));
          if (sk.splashHeal && allies[0]) this.splashHeal(p, sk, allies[0], healPow * (1 + this.buffVal(p, 'dmg')) * a); // (S13 Splash Jar)
          if (tal.grove && p.type === 'player' && !(c.hits || 0)) for (const q of allies) this.herbZone(p, GROVE_REC, q, 'patch', tal.grove, 4, 2); // (S13 Grove Keeper)
          break;
        case 'hot': for (const q of allies) this.addBuff(q, { name: sk.name, stat: 'hot', hot: (healPow * (1 + this.buffVal(p, 'dmg')) * a * (1 + tal.dot)) / b, t: b, dur: b, src: p.id, tick: 0, icon: sk.icon, spread: sk.spread ? 1 : undefined }); break; // (spread, S13: Spreading Poultice)
        case 'stun': for (const m of enemies) if (m.type === 'mob' && !m.def.boss) this.addBuff(m, { name: 'Stunned', cc: 'stun', t: a * cc1, dur: a * cc1, debuff: true, icon: 'stun' }); break;
        // (S7) a net, a trap or a chain shot is Pinned: rooted, and +30% from behind (shared/reactions.js); ['pin', s] too
        case 'root': case 'pin': for (const m of enemies) if (m.type === 'mob' && !m.def.boss) { const pin = type === 'pin' || PIN_SKILLS.has(sk.id) || !!sk.tags?.includes('pin'); this.addBuff(m, { name: pin ? 'Pinned' : 'Rooted', cc: 'root', t: a * cc1, dur: a * cc1, debuff: true, icon: 'root' }); if (pin) m.pinT = Math.max(m.pinT || 0, this.time + a * cc1); } break;
        case 'slow': for (const m of enemies) if (m.type === 'mob') this.addBuff(m, { name: 'Slowed', stat: 'slow', pct: a, t: b, dur: b, debuff: true, icon: 'slow' }); break;
        // (S7) a knockback stopped short by a wall, a rock face or another machine is a wall slam (knockMob)
        case 'knock': { const kd = sk.fx.find((f) => f[0] === 'dmg')?.[1] || 0.5; for (const m of enemies) { if (m.type !== 'mob' || m.def.boss || m.dead || m.def.dummy) continue; /* (S10: a training dummy stays where it is planted) */ this.knockMob(p, m, a, power * kd, sk.id); } break; }
        case 'buff': for (const q of allies) this.addBuff(q, { name: sk.name, stat: a, pct: b, t: cc, dur: cc, icon: sk.icon }); break;
        case 'debuff': for (const m of enemies) this.addBuff(m, { name: sk.name, stat: a, pct: b, t: cc, dur: cc, debuff: true, icon: sk.icon }); break;
        // a taunt lifts the taunter above the top of the threat list (v120: long boss fights let a damage dealer outrun a flat +5000)
        case 'taunt': for (const m of enemies) { if (m.type !== 'mob') continue; const top = Math.max(0, ...m.threat.values()); m.threat.set(p.id, Math.max(m.threat.get(p.id) || 0, top * 1.1) + 5000); m.target = p.id; m.state = 'chase'; } break;
        case 'absorb': for (const q of allies) { q.absorb = (q.absorb || 0) + healPow * a * (1 + tal.absorb); this.addBuff(q, { name: sk.name, stat: 'absorb', t: b, dur: b, icon: sk.icon }); } break;
        case 'cleanse': for (const q of allies) q.buffs = q.buffs.filter((bf) => !bf.debuff); break;
        case 'res': p.res = Math.min(p.maxRes, p.res + a); break; // the caster's own resource back (the Deadeye's Quick Reload)
        // the new kit's kinds (combat_design.md 3.7; launch, air and brk are read through feel.js above)
        case 'holdLift': for (const m of enemies) { if (m.type !== 'mob' || m.dead || !(m.airT > this.time)) continue; const add = Math.min(a, isElite(m.def) ? POISE.eliteAir : a); const until = Math.max(m.airT, this.time + add); const lb = m.buffs.find((bf) => bf.name === 'Lifted'); if (lb) { lb.t = until - this.time; lb.dur = Math.max(lb.dur, lb.t); } m.airT = until; m.swingT = Math.max(m.swingT || 0, until - this.time); this.broadcast({ k: 'air', id: m.id, dur: +(until - this.time).toFixed(2), h: 2.2, hold: 1, dir: [0, 0] }); } break; // (kept in the air: Stormfall, High Ledger)
        case 'zone': if (sk.cls === 'chemist') { if (!(c.hits || 0) && !c.after) this.chemZone(p, sk, center, a, b, cc || 4, fxl.find((f) => f[0] === 'zone')?.[4] || 4); break; } // (S12: the Chemist's puddles and clouds)
          if (p.type === 'player' && !(c.hits || 0) && !c.after) { const e = fxl.find((f) => f[0] === 'zone'); const Z = (p.zones ||= []); Z.push({ kind: a, coef: b, until: this.time + (cc || 4), r: e?.[4] || 4, x: center.x, z: center.z, slow: sk.zoneSlow || 0, next: this.time + 0.5, sk: sk.id }); if (Z.length > 6) Z.shift(); } if (sk.forge && p.type === 'player' && !(c.hits || 0) && !c.after && type === 'zone') this.broadcast({ k: 'slag', x: +center.x.toFixed(2), z: +center.z.toFixed(2), r: fxl.find((f) => f[0] === 'zone')?.[4] || 2, dur: cc || 3 }); break; // (a ground patch: Cinder Landing's cinders; at most 6 a hero, oldest goes, section 3.6)
        // (S5) Stormfall's plunge drives the lifted machine into the ground: a 0.3 m bounce (still Lifted for its 0.8 s, so the
        // air bonus holds), then it lies stunned for a s (Hold Aloft: longer). The client plays the slam on the 'air' hold
        case 'slamDown': for (const m of enemies) { if (m.type !== 'mob' || m.dead) continue; const was = m.airT > this.time; const b = isElite(m.def) ? 0.5 : 0.8; if (was) { m.airT = this.time + b; const lb = m.buffs.find((bf) => bf.name === 'Lifted'); if (lb) { lb.t = b; lb.dur = Math.max(lb.dur, b); } this.broadcast({ k: 'air', id: m.id, dur: b, h: 0.3, hold: 1, slam: 1, dir: [0, 0] }); } if (m.winT > this.time && inWindow(m, this.time)) this.winHold(p, m, WINDOW.slam, 'slam'); /* (CR.6: pressed down in its open window) */ if (!m.def.boss && (was || a > 0)) { const st = (was ? b : 0) + a * cc1; this.addBuff(m, { name: 'Slammed', cc: 'stun', t: st, dur: st, debuff: true, icon: 'stun' }); m.swingT = Math.max(m.swingT || 0, st); } } break;
        case 'parry': p.parryT = this.time + a; p.parryFrom = sk.id; break; // (Guard: a blow in this window is parried, see playerDamaged)
        case 'parryBack': if (c.blocked) for (const m of enemies) this.damage(p, m, c.blocked * a, sk.id); break; // (a share of the blocked blow back: Turning Riposte)
        // (carried into a wall or a machine: the knock's wall slam is held Pinned for a s; Battering Line)
        case 'wallSlam': for (const m of enemies) { if (m.type !== 'mob' || m.dead || m._wall !== this.time || m.def.boss) continue; m._kb = undefined; this.addBuff(m, { name: 'Pinned', cc: 'root', t: a, dur: a, debuff: true, icon: 'root' }); m.pinT = Math.max(m.pinT || 0, this.time + a); if (sk.wallStun) this.addBuff(m, { name: 'Stunned', cc: 'stun', t: a, dur: a, debuff: true, icon: 'stun' }); } break; // (S9 Wall Pin: stunned too)
        // ---- the Sandblade's kinds (S8)
        // a pull: every machine reached that is not a boss or a big machine is dragged up to a m toward the centre (Sandspout,
        // Drawing Spin); the client's snapshot slides it in
        case 'pull': for (const m of enemies) { if (m.type !== 'mob' || m.dead || !liftable(m.def) || m.def.dummy) continue; this.pullMob(m, center, a); } break;
        // Desert Step: arriving behind a machine that is not fighting you gives Opening for a s
        case 'unseen': if (!(c.hits || 0) && c.unseen && target?.type === 'mob') this.addBuff(p, { name: 'Opening', stat: 'opening', pct: 0, t: a, dur: a, icon: 'evade' }); break;
        // Counter Stance: the first blow turned in the stance is answered with a cut of a x power (playerDamaged)
        case 'counter': p.parryCounter = a; p.parryCut = sk.id; break;
        // Dust Whirl's column: a sand zone that travels with the hero for a s (radius b, coef cc a second), blinds and drags
        // small machines in, and throws them up when it falls. One at a time
        case 'column': if (p.type === 'player' && !(c.hits || 0)) { const Z = (p.zones ||= []).filter((z) => !z.follow); Z.push({ kind: sk.hotSand ? 'hotsand' : 'sand', coef: cc, until: this.time + a, r: b, x: p.x, z: p.z, follow: true, blind: 40, pull: 0.5 * (sk.colPull || 1), lift: 1.0 * (sk.colLift || 1), next: this.time + 0.5, sk: sk.id }); if (Z.length > 6) Z.shift(); p.zones = Z; this.broadcast({ k: 'column', id: p.id, dur: a, r: b }); } break;
        // Sandstorm Drop rides the column up: it ends here
        case 'endColumn': if (p.zones?.some((z) => z.follow)) { p.zones = p.zones.filter((z) => !z.follow); this.broadcast({ k: 'column', id: p.id, dur: 0 }); } break;
        // Whiteout: a second cloud where the sidestep began blinds what stands there too
        case 'cloudAt': if (!(c.hits || 0) && p.dodgeFrom) { this.broadcast({ k: 'sandcloud', x: +p.dodgeFrom.x.toFixed(2), z: +p.dodgeFrom.z.toFixed(2), r: a }); const de = sk.fx.find((f) => f[0] === 'debuff'); for (const m of this.foesOf(p)) if (!enemies.includes(m) && m.type === 'mob' && Math.hypot(m.x - p.dodgeFrom.x, m.z - p.dodgeFrom.z) <= a + this.rad(m)) { if (de) this.addBuff(m, { name: sk.name, stat: de[1], pct: de[2], t: de[3], dur: de[3], debuff: true, icon: sk.icon }); this.provoke(m, p, 1); } } break;
        // ---- the Warden's kinds (S9)
        // Challenge's armour on the Warden himself (an area skill has no allies list)
        case 'selfBuff': if (!(c.hits || 0) && !c.after) this.addBuff(p, { name: sk.name, stat: a, pct: b, t: cc, dur: cc, icon: sk.icon }); break;
        // Colossus Drop: the machines that were not the lifted target are thrown back a m from the crater
        case 'knockOthers': { const kd = sk.fx.find((f) => f[0] === 'dmg')?.[1] || 0.5; for (const m of enemies) { if (m.type !== 'mob' || m.def.boss || m.dead || m.id === c.target || m.airT > this.time) continue; this.knockMob(p, m, a, power * kd, sk.id); } break; }
        // Intercept: the ally's next a blows within cc s land on the Warden instead, at b of their strength
        case 'intercept': if (!(c.hits || 0)) { const q = target && target.type === 'player' && target !== p ? target : null; if (q) { q.icpt = { by: p.id, n: a, mul: b, until: this.time + cc }; this.addBuff(q, { name: 'Intercepted', stat: 'icpt', pct: 0, t: cc, dur: cc, icon: 'shield' }); this.broadcast({ k: 'intercept', id: p.id, to: q.id }); for (const m of this.mobs.values()) if (!m.dead && m.target === q.id && dist(m, q) < 12) this.addThreat(m, p, 1); } } break;
        // ---- the Deadeye's kinds (S10)
        // Rock Salt: every shot slows the machine a% more for b s, up to cc% (one Slowed that grows)
        case 'slowStack': for (const m of enemies) { if (m.type !== 'mob' || m.dead) continue; const ex = m.buffs.find((bf) => bf.name === 'Rock Salt'); this.addBuff(m, { name: 'Rock Salt', stat: 'slow', pct: Math.min(cc || 40, (ex?.pct || 0) + a), t: b, dur: b, debuff: true, icon: 'slow' }); } break;
        // ---- the Ranger's kinds (S11)
        // Snare Trap: the snare lies where it was thrown (a s Pinned on what it closes on, cc s on the ground); on a machine it
        // closes at once (Spring Trap: throws it up instead, through the contact's lift)
        case 'trap': if (!(c.hits || 0) && !c.extraTrap) { const T = this.layTrap(p, center, a, b, sk); const hold = enemies.filter((m) => m.type === 'mob' && !m.dead && !m.def.boss); if (hold.length) { T.caught = true; this.broadcast({ k: 'trapsnap', tid: T.id, id: p.id, mob: hold[0].id }); } if (sk.springTrap && this._hc) this._hc.launch = 1.0; else for (const m of hold) { this.addBuff(m, { name: 'Pinned', cc: 'root', t: a * cc1, dur: a * cc1, debuff: true, icon: 'root' }); m.pinT = Math.max(m.pinT || 0, this.time + a * cc1); } } break;
        // Ricochet Bodkin: the arrow glances on from machine to machine (a bounces within b m, cc of the blow each), Marking each
        case 'bounce': { let at = enemies[0]; if (!at) break; const coef = (fxl.find((f) => f[0] === 'dmg')?.[1] || 1) * (cc || 0.7), hitSet = new Set(enemies), path = [at.id]; for (let i = 0; i < a; i++) { let nx = null, bd = b; for (const o of this.foesOf(p)) { if (o.dead || hitSet.has(o)) continue; const d = dist(o, at); if (d < bd) { bd = d; nx = o; } } if (!nx) break; hitSet.add(nx); path.push(nx.id); this.damage(p, nx, power * coef * R(0.9, 1.1), sk.id); if (nx.type === 'mob') this.addBuff(nx, { name: 'Marked Target', stat: 'vuln', pct: 10, t: 4, dur: 4, debuff: true, icon: 'mark' }); at = nx; } if (path.length > 1) this.broadcast({ k: 'bounce', id: p.id, path }); break; }
        // Smoke Arrow: a smoke arrow where the cast began (Disengage's spot): machines within a m miss b% for cc s
        case 'smokeAt': if (!(c.hits || 0) && p.castFrom) { const o = p.castFrom; this.broadcast({ k: 'smokebank', x: +o.x.toFixed(2), z: +o.z.toFixed(2), r: a }); for (const m of this.foesOf(p)) if (m.type === 'mob' && Math.hypot(m.x - o.x, m.z - o.z) <= a + this.rad(m)) this.addBuff(m, { name: 'Smoke Arrow', stat: 'miss', pct: b, t: cc, dur: cc, debuff: true, icon: 'smoke' }); } break;
        // ---- the Chemist's kinds (S12)
        // Spark Gear's arc: on from the first machine to a more within b m, cc of the blow each (heat and spark: Ignite, Galvanic)
        case 'arc': { let at = enemies[0]; if (!at) break; const coef = (fxl.find((f) => f[0] === 'dmg')?.[1] || 1) * (cc || 0.6), hitSet = new Set(enemies), path = [at.id]; for (let i = 0; i < a; i++) { let nx = null, bd = b; for (const o of this.foesOf(p)) { if (o.dead || hitSet.has(o)) continue; const d = dist(o, at); if (d < bd) { bd = d; nx = o; } } if (!nx) break; hitSet.add(nx); path.push(nx.id); this.damage(p, nx, power * coef * R(0.9, 1.1), sk.id); at = nx; } if (path.length > 1) this.broadcast({ k: 'sparkarc', id: p.id, path }); break; }
        // Galvanic Arc: every Corroded machine within a m of the first is struck b x and staggered
        case 'arcCorroded': { const t0 = enemies[0]; if (!t0) break; const path = [t0.id]; for (const o of this.foesOf(p)) { if (o.dead || o === t0 || o.type !== 'mob' || dist(o, t0) > a + this.rad(o) || !o.buffs.some((x) => x.coat === 'corrode')) continue; path.push(o.id); this.damage(p, o, power * b * R(0.9, 1.1), sk.id); if (!o.dead && !o.def.boss) this.addBuff(o, { name: 'Staggered', cc: 'stun', t: 0.6 * cc1, dur: 0.6 * cc1, debuff: true, icon: 'stun' }); } if (path.length > 1) this.broadcast({ k: 'sparkarc', id: p.id, path, g: 1 }); break; }
        // Tarfire: the puddle catches (a burns a s at b a second); with Cold Chemistry it freezes. No puddle: a burning patch here
        case 'ignitePuddle': if (!(c.hits || 0) && !c.after) { const cold = !!sk.cold; if (pud) { Object.assign(pud, { kind: cold ? 'frost' : 'fire', coef: cold ? b * 0.5 : b, until: this.time + a, slow: cold ? 60 : sk.wall || pud.seg ? 80 : 20, coat: cold ? 'chill' : null, next: this.time }); pud.slowName = ZONE_SLOW[pud.kind]; this.broadcast({ k: 'czone', id: p.id, zid: pud.id, kind: pud.kind, x: +pud.x.toFixed(2), z: +pud.z.toFixed(2), r: pud.r, dur: a, seg: pud.seg?.map((v) => +v.toFixed(2)), follow: pud.follow ? 1 : undefined }); } else this.chemZone(p, sk, center, cold ? 'frost' : 'fire', cold ? b * 0.5 : b, a, h.r || 4); } break;
        // Blast Vault: the rod is planted on his newest bomb, which goes off under him now (it no longer waits for its fuse)
        case 'useBomb': if (!(c.hits || 0) && p.bombs?.length) { const B = p.bombs.pop(); this.broadcast({ k: 'bombGone', bid: B.id }); } break;
        // Pitch Vault: a strip of tar along the whole vault (where A began to where the fusion began), a s long, b m wide
        case 'tarPath': if (!(c.hits || 0) && !c.after) { const f0 = c.aFrom || p.castFrom || p, f1 = p.castFrom || p; this.chemZone(p, sk, { x: (f0.x + f1.x) / 2, z: (f0.z + f1.z) / 2 }, sk.hotTar ? 'fire' : 'tar', sk.hotTar ? 0.3 : 0, a, b, [f0.x, f0.z, f1.x, f1.z]); } break;
        // ---- the Herbalist's kinds (S13)
        // Nettle Dart's Sap: a drop a dart that strikes (five at most); the next heal spends them (sapMul above)
        case 'sap': if (enemies.length && p.type === 'player') { p.sap = Math.min(5, (p.sap || 0) + a); this.keepBuff(p, { name: 'Sap', stat: 'sap', pct: 0, t: 30, dur: 30, icon: 'sap' }); } break;
        // Bitter (Thistle Net): the machine strikes a% softer for b s (playerDamaged reads 'weak')
        case 'weak': for (const m of enemies) if (m.type === 'mob' && !m.dead) this.addBuff(m, { name: 'Bitter', stat: 'weak', pct: a, t: b, dur: b, debuff: true, icon: 'powder' }); break;
        // Lantern Flash and Lantern Haze: the machines stagger a s (never a boss); its swing is cut and the client plays the flinch
        case 'stagger': for (const m of enemies) { if (m.type !== 'mob' || m.dead || m.def.boss || m.def.dummy) continue; const st = a * cc1; this.addBuff(m, { name: 'Staggered', cc: 'stun', stat: 'vuln', pct: POISE.staggerVuln, t: st, dur: st, debuff: true, icon: 'stun' }); m.pending = null; m.swingT = Math.max(m.swingT || 0, st); const dd = Math.hypot(m.x - p.x, m.z - p.z) || 1; this.broadcast({ k: 'stag', id: m.id, dur: +st.toFixed(2), dir: [+((m.x - p.x) / dd).toFixed(2), +((m.z - p.z) / dd).toFixed(2)] }); } break;
        // Lantern Flash: every ally within a m loses one harmful effect (the newest)
        case 'cleanseOne': if (!(c.hits || 0) && p.type === 'player') for (const q of this.healAllies(p, p, a)) { const i = q.buffs.map((x) => !!x.debuff).lastIndexOf(true); if (i >= 0) { q.buffs.splice(i, 1); if (q.type === 'player') this.pushSelf(q); } } break;
        // a herb zone (Calming Smoke, Willowbark Steam, Field Hospital, Sneezing Powder): [kind, heal a second, s, m]
        case 'hzone': if (!(c.hits || 0) && !c.after && p.type === 'player') this.herbZone(p, sk, center, a, b * skPow * sapMul, cc, Math.max(fxl.find((f) => f[0] === 'hzone')?.[4] || 6, h.r || 0)); break; // (the reach: the zone's own or the compiled hit's, Camphor and Wide Net widen it)
        // Antidote: the ally healed loses one harmful effect (the newest)
        case 'cleanseAlly': for (const q of allies) { const i = q.buffs.map((x) => !!x.debuff).lastIndexOf(true); if (i >= 0) { q.buffs.splice(i, 1); if (q.type === 'player') this.pushSelf(q); } } break;
        // Lantern Haze: the light goes into his nearest smoke (it lasts a s more): every ally in it is rid of every harmful
        // effect and mends b; the machines in it (this contact's enemies) are blinded and staggered by the kinds after it
        case 'hazeSmoke': if (!(c.hits || 0) && p.type === 'player') { const z = this.herbZoneFor(p, center), zr = z ? z.r : h.r || 6; for (const q of this.healAllies(p, center, zr + 0.5)) { q.buffs = q.buffs.filter((x) => !x.debuff); this.heal(p, q, healPow * b * R(0.95, 1.05)); if (q.type === 'player') this.pushSelf(q); } if (z) { z.until = Math.max(z.until, this.time + a); this.broadcast({ k: 'hhaze', id: p.id, zid: z.id, x: +z.x.toFixed(2), z: +z.z.toFixed(2), r: zr, dur: +(z.until - this.time).toFixed(2) }); } else this.broadcast({ k: 'hhaze', id: p.id, x: +center.x.toFixed(2), z: +center.z.toFixed(2), r: zr, dur: a }); } break;
        // Bitterroot Tincture: the most hurt ally within a m mends b (the splash flies back to them)
        case 'healLowest': if (!(c.hits || 0) && p.type === 'player') { const q = this.healAllies(p, p, a).filter((x) => x.hp < x.maxHp).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0] || p; this.heal(p, q, healPow * b * R(0.95, 1.05)); this.broadcast({ k: 'hsplash', id: p.id, from: (enemies[0] || p).id, to: q.id }); } break;
        // Swiftroot Toss: the a most hurt allies within the reach mend b and run cc% faster for the fifth value's s
        case 'healHurt': if (!(c.hits || 0) && p.type === 'player') { const dur = fxl.find((f) => f[0] === 'healHurt')?.[4] || 4; for (const q of this.healAllies(p, p, h.r || 15).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp).slice(0, a)) { this.heal(p, q, healPow * b * R(0.95, 1.05)); this.addBuff(q, { name: 'Swiftroot', stat: 'speed', pct: cc, t: dur, dur, icon: 'swift' }); this.broadcast({ k: 'hsplash', id: p.id, from: p.id, to: q.id }); } } break;
        // Brawling Healer's Staff Flurry: each landed blow mends every ally within b m by a
        case 'healParty': if (enemies.length && p.type === 'player') for (const q of this.healAllies(p, p, b)) this.heal(p, q, healPow * a * R(0.95, 1.05)); break;
        case 'ricochet': { const t0 = enemies[0]; if (!t0) break; const coef = sk.fx.find((f) => f[0] === 'dmg')?.[1] || 1; const near = this.foesOf(p).filter((o) => !o.dead && !enemies.includes(o) && dist(o, t0) <= b).sort((x, y) => dist(x, t0) - dist(y, t0)).slice(0, Math.min(a, 2)); for (const o of near) this.damage(p, o, power * coef * 0.7 * R(0.9, 1.1), sk.id); break; } // (at most 2 bounces a shot, section 3.6)
      }
    }
    this._hc = null;
    // (S10) Bank Shot: every shot skips once off the plate into the nearest other machine within 8 m at half strength (spark:
    // Galvanic on a Corroded machine); Chalk Mark: a fusion's machines take 8% more from everyone for 6 s; Six Chambers:
    // Recoil Jump reloads both pistols, Twelve Rounds empties both
    if (sk.bank && enemies.length && p.type === 'player' && (S0?.fx || sk.fx).some((f) => f[0] === 'dmg')) this.bankShot(p, sk, enemies, power, S0?.fx || sk.fx);
    if (sk.from && p.tal?.flags?.chalk && !(c.hits || 0) && p.type === 'player') for (const m of enemies) if (m.type === 'mob' && !m.dead) this.addBuff(m, { name: 'Chalk Mark', stat: 'vuln', pct: 8, t: 6, dur: 6, debuff: true, icon: 'mark' });
    if (p.type === 'player' && p.tal?.sixChambers && !(c.hits || 0) && (sk.id === 'd_recoil' || sk.to === 'd_recoil')) { p.rounds = [6, 6]; this.broadcast({ k: 'reload', id: p.id, n: 2 }); }
    if (sk.emptyAll && lastHit && p.rounds) p.rounds = [0, 0];
    // (S7) a coat the skill leaves on every machine it reached, after its own blow (so it never sets itself off)
    const ck = enemies.length && p.type === 'player' ? coatOf(sk) : null;
    if (ck) for (const m of enemies) for (let i = 0; i < (sk.coatN || 1); i++) this.applyCoat(p, m, ck.kind, ck.dur); // (S12 coatN: Corrosive Charge's four stacks, Etching Acid's two)
    if (ck?.kind === 'chill' && sk.deepChill && p.type === 'player') (p.deep ||= []).push({ ids: enemies.filter((m) => m.type === 'mob').map((m) => m.id), at: this.time + 2, t: sk.deepChill }); // (S12 Deep Chill)
    // (S11) a trap fusion springs the traps it used on its last contact: they burst (Closed Ground finds the machines there)
    if (h.at === 'trap' && sk.from && lastHit && !c.extraTrap && c.trapList?.length) { p.trapBurst = { list: c.trapList.map((T) => ({ x: T.x, z: T.z })), until: this.time + 4 }; const used = new Set(c.trapList); p.traps = (p.traps || []).filter((T) => !used.has(T)); for (const T of used) this.broadcast({ k: 'trapgone', tid: T.id, burst: 1 }); }
    if (p.type === 'player' && !c.after && !c.extraTrap && !c.lit) this.linkAfter(p, sk, c, enemies, allies); // (fusions: the link window, mastery)
    // Aftershock (the Warden, S9): a slam's last contact strikes again 0.6 s later at half strength (one repeat, never of a repeat)
    if (sk.aftershock && !c.after && lastHit && p.type === 'player') {
      (p.delays ||= []).push({ t: this.time + sk.aftershock.t, sk, c: { ...c, after: true, hits: (h.n || 1) - 1, mul: (c.mul || 1) * sk.aftershock.mul, opening: false } });
      if (p.delays.length > 4) p.delays.shift();
    }
    // Afterwake (S8): a dash leaves a wake of churned sand along its path (castFrom to here) that cuts what crosses it
    if (sk.wake && !(c.hits || 0) && p.type === 'player') {
      const W = sk.wake, f = p.castFrom || p, Z = (p.zones ||= []);
      let ex = p.x, ez = p.z;
      if (Math.hypot(ex - f.x, ez - f.z) < 2) { const d = (sk.fx.find((e) => e[0] === 'dash')?.[1]) || 4; const tx = target ? target.x - f.x : Math.sin(p.ry), tz = target ? target.z - f.z : Math.cos(p.ry), tl = Math.hypot(tx, tz) || 1; ex = f.x + (tx / tl) * Math.min(d, target ? tl + 1.6 : d); ez = f.z + (tz / tl) * Math.min(d, target ? tl + 1.6 : d); }
      Z.push({ kind: sk.hotSand ? 'hotsand' : 'sand', coef: W.coef, until: this.time + W.dur, r: W.r, x: (f.x + ex) / 2, z: (f.z + ez) / 2, seg: [f.x, f.z, ex, ez], next: this.time + 0.5, sk: sk.id, wake: true });
      if (Z.length > 6) Z.shift();
      this.addBuff(p, { name: 'Afterwake', stat: 'speed', pct: W.speed, t: W.dur, dur: W.dur, icon: 'haste' });
      this.broadcast({ k: 'wake', id: p.id, seg: [f.x, f.z, ex, ez].map((v) => +v.toFixed(2)), dur: W.dur });
    }
    // the end of a leap or a dash (its first contact is the landing): the keystones' onLand (Iron Comet's 0.6 s link to
    // Shield Bash, S5; before, the hook was never called)
    if (!(c.hits || 0) && p.type === 'player' && p.tal?.keys?.length && sk.fx.some((f) => f[0] === 'leap' || f[0] === 'dash')) {
      const lc = runKeys(this, p, 'onLand', { sk, x: p.x, z: p.z }).link;
      if (lc && !p.dead) {
        const open = { to: lc.to, until: this.time + lc.t, mul: lc.mul ?? 0.3 };
        p.link = p.link && p.link.at >= c.t0 ? { ...p.link, open, until: Math.max(p.link.until, open.until) } : { from: sk.id, at: this.time, until: open.until, landed: enemies.length > 0, done: true, step: 0, tgt: c.target || null, parried: false, open };
      }
    }
    // any hostile touch (a stun, root, slow or debuff with no damage) still starts the fight
    for (const m of enemies) if (m.type === 'mob' && !m.dead) this.provoke(m, p, 1);
    if (enemies.length || allies.length) this.pushSelf(p);
  }

  damage(src, m, amt, skill) {
    if (m.dead) return;
    if (m.type === 'player') {
      if (src.type === 'player' && !(src.duel?.with === m.id && this.duelOn(src))) return;
      const fz = src.type === 'player' && this._hc?.sk?.from && skill === this._hc.sk.id ? DUEL_FUSE : 1; // (a fusion on a player: x0.8)
      return this.playerDamaged(m, src, amt * (src.type === 'player' ? DUEL.scale * fz * (rand() < 0.1 ? 1.5 : 1) : 1), skill);
    }
    const tal = src.type === 'player' ? src.tal : null;
    if (tal) amt *= balMul(src.cls, src.level, FUSION_BY_ID[skill] ? 'fuse' : skill === FILL[src.cls] ? 'fill' : ''); // (S15: the class balance table, kit.js BAL)
    const hc = this._hc && skill === this._hc.sk.id ? this._hc : null; // a skill contact being resolved (applySkill): feel.js
    let crit = !!hc?.opening || !!hc?.sk.sureCrit || (skill !== 'galvanic' && rand() < 0.1 + (hc?.sk.critAdd || 0) + (src.type === 'player' ? this.buffVal(src, 'crit') + (tal?.crit || 0) : 0)); // (S7: Galvanic's jump is a share of a blow that already rolled; S8: Needle Thrust's +30%, Glasscutter's certain crit)
    if (hc?.sk.behindMul && m.type === 'mob' && fromBehind(m, src.x, src.z)) amt *= hc.sk.behindMul; // (S8: Needle Thrust, Glasscutter from behind)
    if (tal?.noCrit && !hc?.opening) crit = false; // (Heavy Hand)
    if (crit) amt *= 1.6 + (tal?.critDmg || 0);
    if (tal) { const f = m.hp / m.maxHp; if (f < 0.35) amt *= 1 + tal.execute; else if (f > 0.9) amt *= 1 + tal.opener; }
    amt *= 1 + this.buffVal(m, 'vuln');
    if (m.type === 'mob') amt *= 1 + Math.min(0.6, this.buffVal(m, 'armor'));
    if (hc?.sk?.from && m.type === 'mob' && m.winT > this.time && inWindow(m, this.time)) amt *= WINDOW.fuse; // (CR.6: a fusion lands fully in a boss's open window) // sundered armour (every caster's breaks add up, to +60% at most)
    if (hc && m.type === 'mob' && m.airT > this.time && hc.air) amt *= hc.air; // ['air', x]: more against a Lifted machine
    // (S7, shared/reactions.js) Pinned: +30% from behind. A coated machine struck by the right kind of blow: a Reaction
    let rx = null;
    if (m.type === 'mob') {
      if (m.pinT > this.time && fromBehind(m, src.x, src.z)) amt *= 1 + PIN.behind;
      if (hc?.sk.coatMul) for (const k in hc.sk.coatMul) if (m.buffs.some((b) => b.coat === k && b.t > 0)) amt *= hc.sk.coatMul[k]; // (S12 Thermal Shock: x1.35 on a Chilled machine, before the Shatter takes the frost)
      if (m.coatT > this.time && src.type === 'player') {
        rx = this.reactCheck(m, hc, skill); if (rx?.mul) amt *= rx.mul;
        const by = rx?.by ? this.players.get(rx.by) : null; // (S12 Reactive Chemistry: a Reaction on his coat is 50% stronger and gives him 10 Reagents)
        if (by?.tal?.reactive && !by.dead) { rx.boost = 1 + by.tal.reactive; if (rx.kind === 'shatter') amt *= rx.boost; by.res = Math.min(by.maxRes, by.res + 10); }
      }
    }
    if (tal?.keys) { // the Skill Web (S3): notables against a state, then the keystones' onHit (shared/keystones.js)
      for (const [st, v] of Object.entries(tal.vs || {})) if (m.type === 'mob' && this.hasState(m, st)) amt *= 1 + v;
      if (tal.keys.length) amt = runKeys(this, src, 'onHit', { sk: hc?.sk, tgt: m, amt, fused: !!hc?.sk?.from }).amt;
    }
    amt = Math.max(1, Math.round(amt));
    m.hp -= amt;
    const react = hc && m.type === 'mob' && !m.dead ? this.poiseHit(src, m, hc, crit) : null;
    if (hc) hc.xbrk = 0;
    let ht = hc ? tierOf(hc.sk, hc.i, { crit, broke: react?.broke, launched: react?.launched, kill: m.hp <= 0, reaction: !!rx || !!hc.wall }).tier : skill === 'dot' ? 0 : undefined;
    if (rx && ht == null) ht = 3;
    if (hc?.encore && ht < 3) ht = 3; // (Chainwork's Encore: a heavy stop)
    this.broadcast({ k: 'dmg', src: src.id, tgt: m.id, amt, crit, skill, ht });
    if (tal?.leech && !src.dead) src.hp = Math.min(src.maxHp, src.hp + amt * tal.leech);
    if (m.type === 'mob') this.provoke(m, src, amt * (1 + (tal?.threat || 0)) * (src.bot && TANK_CLS.has(src.cls) ? BOT_TANK_THREAT : 1));
    if (rx) this.reactFire(src, m, rx, amt);
    if (m.def?.dummy) { m.hitT = this.time; if (m.hp < m.maxHp * 0.02) m.hp = m.maxHp; return; }
    if (m.hp <= 0 && hc?.sk?.from) m.fzKill = this.time; // (a fusion's blow: the client splits the machine apart)
    if (m.hp <= 0 && !m.dead) this.kill(m, src);
  }

  // ---- S7 (combat_design.md 2.5, 5.8; shared/reactions.js): coats, Reactions, wall slams
  // a coat on a machine (one of each kind; Corroded stacks to 5). Its buff carries the slow, the armour or the miss chance
  applyCoat(src, m, kind, dur) {
    const C = COATS[kind];
    if (!C || m.type !== 'mob' || m.dead) return;
    const i = m.buffs.findIndex((b) => b.coat === kind), n = C.stacks ? Math.min(C.stacks, (i >= 0 ? m.buffs[i].n || 1 : 0) + 1) : 1;
    if (i >= 0) m.buffs.splice(i, 1);
    this.addBuff(m, { name: C.name, coat: kind, n, stat: C.stat, pct: C.pct * n, t: dur, dur, src: src.id, debuff: true, icon: C.icon });
    m.coatT = Math.max(m.coatT || 0, this.time + dur);
  }
  // the blow's kinds (its record's tags, or the legacy table; a fire patch's tick is heat) against the machine's coats: the
  // first coat it sets off is consumed. -> { kind, coat, mul } or null
  reactCheck(m, hc, skill) {
    const el = hc ? elemsOf(hc.sk) : skill === 'zone' && (this._zk === 'fire' || this._zk === 'hotsand') ? HEAT_ONLY : null; // (S8: Hot Sand's column and wake are heat)
    if (!el?.length) return null;
    for (let i = 0; i < m.buffs.length; i++) {
      const b = m.buffs[i];
      if (!b.coat || b.t <= 0) continue;
      const kind = reactionFor(b.coat, el);
      if (!kind) continue;
      m.buffs.splice(i, 1);
      if (kind === 'shatter' && hc) hc.xbrk = REACTIONS.shatter.brk; // (60 more poise on this machine only)
      return { kind, coat: b.coat, mul: kind === 'shatter' ? REACTIONS.shatter.mul : 1, by: b.src };
    }
    return null;
  }
  // after the blow: Ignite's burn, Galvanic's jump; the word and its effects on every client ({k:'react'})
  reactFire(src, m, rx, amt) {
    let to = null;
    if (rx.kind === 'ignite' && !m.dead) { const R0 = REACTIONS.ignite; this.addBuff(m, { name: 'Ignite', stat: 'dot', dot: (src.power * R0.burn * (rx.boost || 1)) / R0.dur, t: R0.dur, dur: R0.dur, src: src.id, tick: 0, debuff: true, icon: 'flame' }); }
    if (rx.kind === 'galvanic') {
      let bd = REACTIONS.galvanic.range;
      for (const o of this.mobs.values()) { if (o === m || o.dead || o.def.dummy) continue; const d = dist(o, m); if (d < bd && this.foeOf(src, o.id)) { bd = d; to = o; } }
    }
    this.broadcast({ k: 'react', id: m.id, kind: rx.kind, src: src.id, ...(to ? { to: to.id } : {}) });
    if (to) this.damage(src, to, amt * REACTIONS.galvanic.share * (rx.boost || 1), 'galvanic');
  }
  // a pull (S8): the machine is dragged up to a m toward c (never closer than its radius + 0.6), with the same clamps as a
  // knockback (dungeon walls, house walls, the world's edge)
  pullMob(m, c, a) {
    const d = Math.hypot(m.x - c.x, m.z - c.z), keep = Math.min(1.2, m.def.radius || 1) + 0.6;
    if (d <= keep + 0.05) return;
    const s = Math.min(a, d - keep), kx = m.x, kz = m.z;
    m.x += ((c.x - m.x) / d) * s; m.z += ((c.z - m.z) / d) * s;
    if (m.x >= DUNGEON_MIN_X) [m.x, m.z] = dungeonPush(m.x, m.z, Math.min(1.2, m.def.radius));
    else { [m.x, m.z] = clampWorld(m.x, m.z, kx, kz, 0); if (houseCrosses(kx, kz, m.x, m.z)) { m.x = kx; m.z = kz; } else [m.x, m.z] = housePush(m.x, m.z, Math.min(1.2, m.def.radius)); }
    m.y = walkHeight(m.x, m.z);
    this.broadcast({ k: 'pull', id: m.id, d: +s.toFixed(1) });
  }
  // a knockback of a m: the machine slides away from p, clamped by dungeon walls, house walls and the world's edge, and
  // stopped where the ground rises into a rock face. Stopped short, or carried into another machine: a wall slam (T3):
  // +20% of the blow, held 0.8 s (elites 0.45) then Pinned 0.5 s, and the machine it hit takes 10%. slamAmt: the blow
  knockMob(p, m, a, slamAmt, skId) {
    const d = dist(p, m) || 1, ux = (m.x - p.x) / d, uz = (m.z - p.z) / d, kx = m.x, kz = m.z, r = Math.min(1.2, m.def.radius);
    let tx = kx + ux * a, tz = kz + uz * a, rock = false;
    if (kx < DUNGEON_MIN_X) { const h0 = heightAt(kx, kz); for (let i = 1; i <= 3; i++) { const f = i / 3; if (heightAt(kx + ux * a * f, kz + uz * a * f) - h0 > WALL.rise) { const g = Math.max(0, f - 1 / 3); tx = kx + ux * a * g; tz = kz + uz * a * g; rock = true; break; } } }
    m.x = tx; m.z = tz;
    if (m.x >= DUNGEON_MIN_X) [m.x, m.z] = dungeonPush(m.x, m.z, r);
    else { [m.x, m.z] = clampWorld(m.x, m.z, kx, kz, 0); if (houseCrosses(kx, kz, m.x, m.z)) { m.x = kx; m.z = kz; } else [m.x, m.z] = housePush(m.x, m.z, r); } // (never knocked through a house wall)
    const moved = Math.hypot(m.x - kx, m.z - kz);
    m._kb = moved / a; m.y = walkHeight(m.x, m.z);
    let other = null;
    if (!rock && m._kb >= WALL.short) for (const o of this.mobs.values()) {
      if (o === m || o.dead) continue;
      const ox = o.x - m.x, oz = o.z - m.z;
      if (Math.abs(ox) > 4 || Math.abs(oz) > 4) continue;
      const od = Math.hypot(ox, oz);
      if (od < o.def.radius + m.def.radius + 0.15 && (ox * ux + oz * uz) > 0.3 * od && this.foeOf(p, o.id)) { other = o; break; } // (the one it was thrown at, ahead of it)
    }
    this.broadcast({ k: 'knock', id: m.id, d: +moved.toFixed(1) });
    if (rock || other || m._kb < WALL.short) {
      const st = isElite(m.def) ? WALL.stunElite : WALL.stun;
      m._wall = this.time;
      this.addBuff(m, { name: 'Slammed', cc: 'stun', t: st, dur: st, debuff: true, icon: 'stun' });
      this.addBuff(m, { name: 'Pinned', cc: 'root', t: st + WALL.pin, dur: st + WALL.pin, debuff: true, icon: 'root' });
      m.pinT = Math.max(m.pinT || 0, this.time + st + WALL.pin);
      m.pending = null; m.swingT = Math.max(m.swingT || 0, st);
      this.broadcast({ k: 'wall', id: m.id, dir: [+ux.toFixed(2), +uz.toFixed(2)], on: other ? 'mob' : rock ? 'rock' : 'wall', ...(other ? { o: other.id } : {}) });
      const hc = this._hc;
      if (hc) { hc.wall = true; if (other) hc.broke.add(other.id); } // (the machine it hit loses no poise to this contact)
      if (slamAmt > 0) this.damage(p, m, slamAmt * WALL.bonus * R(0.9, 1.1), skId);
      if (other && slamAmt > 0) this.damage(p, other, slamAmt * WALL.other * R(0.9, 1.1), skId);
      if (hc) hc.wall = false;
    } else if (m.def.humanoid && moved >= KNOCKDOWN.dist) {
      // a raider thrown far goes down (Knockdown, LayToIdle on the client) and is held while it gets up
      this.addBuff(m, { name: 'Knocked Down', cc: 'stun', t: KNOCKDOWN.down, dur: KNOCKDOWN.down, debuff: true, icon: 'stun' });
      m.pending = null; m.swingT = Math.max(m.swingT || 0, KNOCKDOWN.down);
    }
  }

  // (CR.6, reactions.js WINDOW) a lift or a slam-down on a boss in its open window holds it a little longer: the window
  // grows by `want` s, at most WINDOW.ext s in all per window; the client plays a 0.3 m jolt (air, win) or a pressed stagger
  winHold(src, m, want, kind) {
    const add = Math.min(want, WINDOW.ext - (m.winExt || 0));
    if (add < 0.15 || m.dead) return 0;
    m.winExt = (m.winExt || 0) + add; m.winT += add;
    const t = m.winT - this.time;
    this.addBuff(m, { name: 'Jolted', cc: 'stun', t, dur: t, debuff: true, icon: 'stun' });
    m.pending = null; m.swingT = Math.max(m.swingT || 0, t);
    const d = Math.hypot(m.x - src.x, m.z - src.z) || 1, dir = [+((m.x - src.x) / d).toFixed(2), +((m.z - src.z) / d).toFixed(2)];
    this.broadcast(kind === 'lift' ? { k: 'air', id: m.id, dur: +add.toFixed(2), h: WINDOW.liftH, dir, win: 1 } : { k: 'stag', id: m.id, dur: +add.toFixed(2), dir, win: 1 });
    return add;
  }

  // poise (feel.js, combat_design.md 2.5): a skill contact wears a machine's poise down; at 0 a normal machine is Staggered
  // (1.2 s stun, +15% damage taken; elites 0.8 s) and an elite or boss is Broken (its telegraph cancelled, a 1 s kneel,
  // 4 s Exposed +25%, poise back at 120%). A launch throws a small machine into the air (Lifted: it cannot act); a heavy
  // machine takes x1.5 poise instead. A T3 bash staggers at once. Players have no poise. Returns { broke, launched }.
  poiseHit(src, m, hc, crit) {
    // (poise is set on a machine's first poise hit, not in spawnMob: four more fields on every mob object made tickMob
    // about 6% slower for the 1,465 mobs of the world, S1 review)
    if (m.poiseMax === undefined) { m.poiseMax = poiseMax(m.def, m.sp); m.poise = m.poiseMax; m.poiseT = 0; }
    if (hc.broke.has(m.id) || !m.poiseMax || m.def.dummy || m.def.inert) return null;
    hc.broke.add(m.id); // (once per machine per contact)
    const out = { broke: false, launched: false };
    const big = !liftable(m.def);
    let dmg = (hc.brk + (hc.xbrk || 0)) * (crit ? POISE.critMul : 1) * (hc.launch && big ? POISE.bigLaunchMul : 1) * (m.def.boss || m.def.world ? (hc.sk?.from && m.winT > this.time ? 1 : POISE.bossTake) : 1); // (CR.6: a fusion in a boss's open window lands its full poise)
    if (src.tal?.keys) dmg *= (1 + (src.tal.brk || 0)) * (src.tal.brkMul || 1); // the Skill Web's poise damage (Impact nodes, Heavy Impact, Heavy Hand)
    if (m.brokenT > this.time) dmg = 0; // a Broken machine is already open
    const elite = isElite(m.def);
    // the control guard (feel.js ctlChain/ctlGuard): Staggered and Lifted chain for at most 2.5 s, then 2 s free of both
    const guard = !(elite && !liftable(m.def)) && m.ctlGuard > this.time;
    if (guard && !(m.brokenT > this.time) && !elite) dmg = 0;
    if (dmg > 0) { m.poise = Math.max(0, m.poise - dmg); m.poiseT = this.time; }
    const ctl = (want) => { // -> the duration allowed (0: none), and books it on the chain
      const chain = m.ctlEnd != null && this.time <= m.ctlEnd + POISE.ctlGap;
      if (!chain) m.ctlStart = this.time;
      const d = Math.min(want, m.ctlStart + POISE.ctlChain - this.time);
      if (d < 0.3) { m.ctlGuard = Math.max(m.ctlEnd || 0, this.time) + POISE.ctlGuard; return 0; }
      m.ctlEnd = Math.max(m.ctlEnd || 0, this.time + d);
      if (m.ctlEnd >= m.ctlStart + POISE.ctlChain - 1e-6) m.ctlGuard = m.ctlEnd + POISE.ctlGuard;
      return d;
    };
    if (hc.launch && !big && !(m.airT > this.time) && !guard) {
      const dur = ctl(elite ? Math.min(POISE.eliteAir, hc.launch) : hc.launch);
      if (dur > 0) {
        m.airT = this.time + dur;
        const down = m.def.humanoid ? KNOCKDOWN.liftDown : 0; // (S7: a raider lands on its back and gets up: Air_Juggle_Loop, LayToIdle)
        this.addBuff(m, { name: 'Lifted', cc: 'stun', t: dur + down, dur: dur + down, debuff: true, icon: 'stun' });
        m.pending = null; m.swingT = Math.max(m.swingT || 0, dur + down);
        const d = Math.hypot(m.x - src.x, m.z - src.z) || 1;
        this.broadcast({ k: 'air', id: m.id, dur: +dur.toFixed(2), h: +(hc.sk?.liftH || 1.6 + Math.min(1, dur - 0.7) * 1).toFixed(2), dir: [+((m.x - src.x) / d).toFixed(2), +((m.z - src.z) / d).toFixed(2)] });
        out.launched = true;
      }
    }
    if (hc.launch && big && m.winT > this.time && inWindow(m, this.time)) this.winHold(src, m, WINDOW.lift, 'lift'); // (CR.6: a lift on an open boss: a short jolt)
    if (m.poise <= 0 || (hc.bash && !elite && !(m.brokenT > this.time) && !guard)) {
      out.broke = true;
      if (elite) {
        m.brokenT = this.time + POISE.broken;
        this.addBuff(m, { name: 'Broken', stat: 'vuln', pct: POISE.brokenVuln, t: POISE.broken, dur: POISE.broken, debuff: true, icon: 'armor' });
        this.addBuff(m, { name: 'Kneeling', cc: 'stun', t: POISE.brokenKneel, dur: POISE.brokenKneel, debuff: true, icon: 'stun' });
        // the telegraph it was winding up is cancelled, and the swing it had in hand
        // (only its own wind-up: CUT_KINDS; a dungeon hazard it called, with a.caller, lands on the dungeon's clock)
        const n0 = this.aoes.length;
        this.aoes = this.aoes.filter((a) => a.src !== m.id || a.caller || !CUT_KINDS.has(a.kind) || a.t <= this.time);
        m.pending = null;
        m.poise = m.poiseMax * POISE.brokenRefill;
        if (m.def.boss || m.def.world) { m.winT = this.time + POISE.brokenKneel; m.winExt = 0; } // (CR.6: the kneel is an open window)
        this.broadcast({ k: 'broken', id: m.id, t: POISE.broken, cut: this.aoes.length < n0 ? 1 : 0 }); // (cut: the client clears its circles)
      } else if (guard) { out.broke = false; m.poise = Math.max(m.poise, 1); // (guarded: it shrugs it off)
      } else {
        const dur = ctl(POISE.stagger);
        if (dur <= 0) { out.broke = false; m.poise = m.poiseMax; return out; }
        this.addBuff(m, { name: 'Staggered', cc: 'stun', stat: 'vuln', pct: POISE.staggerVuln, t: dur, dur, debuff: true, icon: 'stun' });
        m.pending = null;
        m.poise = m.poiseMax;
        const d = Math.hypot(m.x - src.x, m.z - src.z) || 1;
        this.broadcast({ k: 'stag', id: m.id, dur, dir: [+((m.x - src.x) / d).toFixed(2), +((m.z - src.z) / d).toFixed(2)] });
      }
    }
    // (no event for an ordinary poise hit: every bot's every contact would add one to every snapshot; the poise bar of S6
    // reads the poise from the target frame instead)
    return out;
  }

  heal(src, q, amt) {
    if (q.dead) return;
    amt = Math.round(amt);
    const before = q.hp;
    q.hp = Math.min(q.maxHp, q.hp + amt);
    this.broadcast({ k: 'heal', src: src.id, tgt: q.id, amt: Math.round(q.hp - before) || amt });
    // (S13) the Herbalist's keystones: Overflowing turns what a heal of his would waste into a shell (up to 30% of the ally's
    // health); Bitter Medicine stings the machines within 4 m of the one healed for 30% of the heal
    if (src?.tal?.overflow && q.type === 'player' && amt > q.hp - before) { const add = Math.min(amt - (q.hp - before), Math.max(0, q.maxHp * src.tal.overflow - (q.absorb || 0))); if (add > 0) { q.absorb = (q.absorb || 0) + add; this.keepBuff(q, { name: 'Overflow', stat: 'absorb', t: 8, dur: 8, icon: 'sap' }); } }
    if (src?.tal?.bitterMed && src.type === 'player' && !src.dead && amt > 0) for (const m of this.foesOf(src)) if (m.type === 'mob' && !m.dead && Math.hypot(m.x - q.x, m.z - q.z) <= 4 + this.rad(m)) this.damage(src, m, amt * src.tal.bitterMed, 'bitter');
    // healers draw a little threat
    for (const m of this.mobs.values()) if (m.threat.has(q.id)) this.addThreat(m, src, amt * 0.4);
    if (q.type === 'player') this.pushSelf(q);
  }

  addThreat(m, p, v) { m.threat.set(p.id, (m.threat.get(p.id) || 0) + v); }

  // a struck foe turns on its attacker, and its idle packmates close by (the same kind) join in
  provoke(m, p, v) {
    if (m.dead || m.def.dummy || !p || p.type !== 'player') return;
    const fresh = !m.threat.size;
    this.addThreat(m, p, v);
    if (m.state === 'idle' || m.state === 'wander') { m.state = 'chase'; m.target = p.id; }
    if (!fresh || m.def.boss || m.state === 'leash') return;
    const PACK = 7;
    for (const o of this.mobs.values()) {
      if (o === m || o.dead || o.threat.size || o.def.dummy || o.def.passive || o.state === 'leash') continue;
      if (o.def !== m.def && o.def.id !== m.def.id) continue;
      if (Math.abs(o.x - m.x) > PACK || Math.abs(o.z - m.z) > PACK || dist2(o, m) > PACK * PACK) continue;
      this.addThreat(o, p, 1);
      if (o.state === 'idle' || o.state === 'wander') { o.state = 'chase'; o.target = p.id; }
    }
  }

  addBuff(e, b) {
    if (b.debuff && e.type === 'player' && e.tal?.unmoving && (b.stat === 'slow' || b.cc === 'root')) return; // (Unmoving, S9: never slowed or held fast)
    if (b.debuff && b.cc && e.type === 'player' && e.ccImmT > this.time) return; // (Unstoppable's charge, S9)
    const ex = e.buffs.find((x) => x.name === b.name && x.src === b.src);
    // a refreshed damage or healing over time keeps its running tick, so a quick recast never skips a tick
    if (ex) { const tk = ex.tick; Object.assign(ex, b); if ((b.dot || b.hot) && tk != null) ex.tick = tk; } else e.buffs.push(b);
    if (e.type === 'player') this.pushSelf(e);
    this.broadcast({ k: 'buff', id: e.id, name: b.name, icon: b.icon, cc: b.cc, dur: b.dur, debuff: !!b.debuff });
  }

  kill(m, killer) {
    m.dead = true; m.hp = 0; m.cast = null;
    if (killer?.tal?.keys?.length) runKeys(this, killer, 'onKill', { tgt: m });
    this.broadcast(m.fzKill === this.time && m.type === 'mob' ? { k: 'die', id: m.id, fz: 1 } : { k: 'die', id: m.id }); // (fz: a fusion's kill, S7)
    if (m.type !== 'mob') return;
    if (this.tmod(m, 'boilers') && !m.def.humanoid && !m.sp.temp) {
      const spots = [{ x: +m.x.toFixed(2), z: +m.z.toFixed(2), r: 2.4 + (m.def.radius || 1) }], dmg = R(m.def.dmg[0], m.def.dmg[1]) * (1 + 0.18 * (m.level - 1)) * mobAbilityMul(m.level) * 0.9 * (m.rh ? 1.25 : 1); // a telegraphed mechanic: on the ability curve (0.85-1), not the swing curve (up to 2.3)
      this.aoes.push({ t: this.time + 1.5, spots, dmg, src: m.id, kind: 'nova' });
      this.broadcast({ k: 'tele', id: m.id, kind: 'nova', spots, t: 1.5, name: 'Boiler burst' });
    }
    m.respawnT = this.time + (m.def.world ? 2400 + R(0, 1200) : m.def.rare ? 420 + R(0, 180) : m.def.boss ? 120 : m.def.elite ? 90 : 25 + R(0, 10));
    if (m.def.world) this.broadcast({ k: 'msg', text: `${m.def.name} has fallen! Everyone who fought it shares the spoils.`, color: '#ffc040' });
    // xp + quest credit to everyone who fought it
    // (a held character, its connection dropped and waiting for a reconnect, earns nothing: no risk-free leech by unplugging)
    const contributors = [...m.threat.keys()].map((id) => this.players.get(id)).filter((q) => q && !q.held);
    for (const c of [...contributors]) for (const q of this.partyMembers(c)) if (!contributors.includes(q) && !q.dead && !q.held && dist(q, m) < 80) contributors.push(q);
    this.ramKill(m, contributors); // the Ram Engine: a machine of the event counts for those at work near the engine (shared/ramEngine.js)
    this.ridesKill(m, contributors); // Clear the Rides: a trunk is everyone's who is near it, no party needed; machines count to the tally
    if (m.sp.event) { const ev = this.wev.find((e) => e.def.id === m.sp.event); if (ev?.live) for (const p of contributors) ev.live.fought.add(p.id); }
    for (const p of contributors) {
      if (p.bot) { if (p.mind) this.botKillCredit(p, m); continue; } // a living bot earns its own XP and quest credit (B.4)
      this.achAdd(p, 'kills'); this.achAdd(p, 'kill:' + m.kind);
      if (m.def.elite) this.achAdd(p, 'elites');
      if (m.def.rare) this.achAdd(p, 'rares');
      if (m.def.boss) this.achAdd(p, 'bosses');
      this.bountyKill(p, m.kind);
      if (m.sp.dungeon && m.kind === this.finalBoss(m.sp.dungeon)) this.featuredBonus(p, m.sp.dungeon);
      if (m.rh && (m.def.raid || m.def.boss)) this.achAdd(p, 'rhkill:' + m.kind);
      if (DUNGEON_BOSSES.includes(m.kind)) { this.achAdd(p, 'dbosses'); if (m.heroic) this.achAdd(p, 'hkill:' + m.kind); if (m.tempest) this.achAdd(p, 'tkill:' + m.kind); if (m.vet) this.achAdd(p, 'vkill:' + m.kind); }
      if (m.level >= p.level - 5) this.addRep(p, factionOfZone(zoneAt(m.x, m.z).id), Math.round((4 + Math.floor(m.level / 4)) * (m.def.boss ? 25 : m.def.rare ? 10 : m.def.elite ? 5 : 1)), true);
      if (p.tal?.killRes) p.res = Math.min(p.maxRes, p.res + p.tal.killRes);
      const diff = m.level - p.level;
      // the party split: people only inside a dungeon (muster volunteers carry a hero through a clear, which pays one level);
      // in the open world party bots count too (P15.7 review: a hero who followed four bots got every bot's kill in full)
      const grp = p.party ? contributors.filter((q) => (!q.bot || !m.sp.dungeon) && q.party === p.party).length : 1;
      const xp = Math.round(killXp(m.def.xp, m.level, p.level) * dungeonXpScale(m.sp.dungeon) * (grp > 1 ? 1.25 / grp : 1)); // shared/xp.js (P15.7: a twentieth of a level at 40-69, a dungeon clear one level)
      const bonus = p.level < LEVEL_CAP ? Math.min(Math.round(p.rested || 0), xp) : 0;
      if (bonus > 0) { p.rested -= bonus; if (p.rested < 1) { p.rested = 0; this.msg(p, 'You no longer feel rested.', '#7ab0ff'); } }
      this.giveXp(p, xp + bonus, bonus);
      for (const [qid, q] of Object.entries(p.quests)) {
        const Q = QUESTS[qid];
        if (Q.goal.kill === m.kind && q.n < Q.goal.n) { q.n++; this.msg(p, `${Q.name}: ${MOBS[m.kind].name} ${q.n}/${Q.goal.n}`, '#ffd060'); }
        // one of each: a set of bosses, each counted once
        if (Q.goal.kills?.includes(m.kind) && !(q.got ||= {})[m.kind]) { q.got[m.kind] = 1; q.n = Object.keys(q.got).length; this.msg(p, `${Q.name}: ${MOBS[m.kind].name} ${q.n}/${Q.goal.n}`, '#ffd060'); }
      }
      this.pushSelf(p);
    }
    // the rarity of every piece is rolled here, when it drops (plan A3/A4), on the table of the kill's source; an endgame
    // kill also moves each player's Tempering counters (plan A5)
    const src = this.dropSrc(m), endgame = this.endgameKill(m);
    // a world boss pays everyone who fought it directly: their own rolls, straight into their bags
    if (m.def.world) {
      const T = LOOT_TABLES[m.def.loot];
      for (const p of contributors) {
        if (p.bot) continue;
        const gold = RI(T.gold[0], T.gold[1]) * m.level; p.gold += gold; this.achAdd(p, 'gold', gold);
        const got = [];
        const give = (g) => { got.push(g); this.dropNotice(g, [p], m); this.giveOrPost(p, { gear: g }, m.def.name); };
        for (const [id, ch] of T.items) if (rand() < ch) { if (ITEMS[id].stats) give(this.namedDrop(id, src, endgame)); else this.addItem(p, { id, n: 1 }); }
        for (let i = 0; i < (T.gearN || 1); i++) give(this.dropGear(this.makeGear(m.level, null, p.cls, src), endgame));
        if (rand() < 0.06) { const L = this.legendaryFor(p.cls, src, endgame); give(L); if (L.q === 5) this.broadcast({ k: 'msg', text: `${p.name} has found ${L.name}, a Legendary weapon!`, color: '#ffc23a' }); }
        this.giveMats(p, [[ENGINE_CORE, UPGRADE_DROPS.coreWorld]], m.def.name);
        if (endgame) this.temperKill(p, m, got);
        this.msg(p, `Your share of ${m.def.name}: ${gold} copper and its spoils.`, '#ffe08a'); this.pushSelf(p);
      }
      return;
    }
    // loot bag
    const tbl = LOOT_TABLES[m.def.loot];
    if (tbl) {
      const items = [];
      // rhIlvl: on Heroic (the raid kind) a boss's named drops come raised to this item level, their stats scaled with it
      const rhUp = (g) => { const L = m.rh && m.def.rhIlvl; if (L && g.ilvl < L) { const k = L / g.ilvl; g.bs = Object.fromEntries(Object.entries(g.bs || g.stats).map(([s, v]) => [s, Math.ceil(v * k)])); g.stats = { ...g.bs }; g.ilvl = L; } return g; };
      const asLoot = (id) => (ITEMS[id]?.stats ? { gear: rhUp(this.namedDrop(id, src, endgame)) } : { id, n: 1 });
      for (const [id, ch] of tbl.items) if (rand() < ch) items.push(asLoot(id));
      const gn = (tbl.gearN || 1) + (m.heroic && (m.def.boss || m.def.elite) ? 1 : 0) + (m.rh && m.def.boss ? 1 : 0);
      const who = contributors.find((q) => !q.bot)?.cls;
      const ilvl = m.level + (m.def.boss ? 2 : m.def.elite ? 1 : 0) + (m.rh ? 4 : 0) + (m.vet ? 3 : 0);
      for (let i = 0; i < gn; i++) if (rand() < (m.heroic ? Math.max(tbl.gear, 0.12) : tbl.gear)) items.push({ gear: this.dropGear(this.makeGear(ilvl, null, who, src), endgame) });
      // ordinary machines and raiders often carry something plain or broken worth a few coins (fixed Poor or Common)
      if (!m.def.elite && !m.def.boss && !m.def.dummy && rand() < 0.22) items.push({ gear: rollGear(rand, m.level, { q: rand() < 0.7 ? 0 : 1, cls: who, weight: CLASS_WEIGHT[who] }) });
      if (m.heroic) for (const [id, ch] of tbl.items) if (ITEMS[id]?.set && rand() < ch) items.push(asLoot(id)); // a second roll at set pieces
      if (m.def.boss && rand() < (m.tempest ? 0.08 : m.heroic ? 0.02 : 0)) items.push({ gear: this.legendaryFor(who, src, endgame) });
      if (m.tempest && m.def.boss && rand() < 0.45) { const P = SETS.tempest.pieces; items.push(asLoot(P[RI(0, P.length - 1)])); }
      // quest items only drop for players on the quest
      for (let i = items.length - 1; i >= 0; i--) {
        const id = items[i].id, it = id && ITEMS[id];
        if (!it || it.slot !== 'quest') continue;
        const needed = Object.values(QUESTS).some((Q) => Q.goal?.item === id);
        if (needed && !contributors.some((q) => Object.keys(q.quests || {}).some((qid) => QUESTS[qid]?.goal?.item === id))) items.splice(i, 1);
      }
      const gold = RI(tbl.gold[0], tbl.gold[1]) * m.level;
      const humans = contributors.filter((p) => !p.bot);
      const party = humans.length > 1 && humans.every((q) => q.party && q.party === humans[0].party) ? humans[0].party : null;
      let owners = contributors;
      if (m.def.raid) {
        const wk = weekNumber();
        owners = contributors.filter((q) => {
          if (q.bot) return true;
          const L = q.raidLock && q.raidLock.w === wk ? q.raidLock : (q.raidLock = { w: wk, k: {} });
          const lk = (m.rh ? 'h:' : '') + m.kind;
          if (L.k[lk]) { this.msg(q, `You have already claimed ${m.def.name}’s treasure this week. It returns at the start of next week.`, '#e8c26a'); return false; }
          L.k[lk] = 1; return true;
        });
        if (!owners.some((q) => !q.bot)) { items.length = 0; }
      }
      // every piece already has its rarity (rolled once, above) before anyone claims it (plan A6)
      const shared = items.filter((it) => it.gear).map((it) => it.gear);
      // alone, the whole bag is yours: its pieces count for your Tempering and the news names you now. In a group a
      // piece counts only for the player who ends up with it (claim winner or looter), so it waits in pendLoot
      const solo = owners.filter((q) => !q.bot).length === 1;
      if (solo) for (const g of shared) this.dropNotice(g, owners, m);
      else { this.pendLoot ||= new WeakMap(); for (const g of shared) this.pendLoot.set(g, { eg: endgame, m: { def: { name: m.def.name } } }); }
      if (party) for (let i = items.length - 1; i >= 0; i--) if (this.claimable(items[i])) this.startClaim(party, humans, items.splice(i, 1)[0], m);
      for (const q of owners) {
        if (q.bot) continue;
        const got = solo ? [...shared] : [];
        // the Dragonslayer set: straight into the bags of each player who claims this week's treasure
        if (m.def.raid && m.kind === DS_BOSS) this.dragonslayerDrop(q, !!m.rh, got);
        // the Dragonslayer armour: each Great Dam boss owns some slots (data.js DSA_SOURCE)
        if (m.def.raid && DSA_SOURCE[m.kind]) this.dsArmourDrop(q, m.kind, !!m.rh, got);
        // upgrade materials, fixed amounts, to each player who earns the kill (raid bosses once per weekly lockout)
        if (m.def.boss && m.def.raid) this.giveMats(q, [[BILLET, m.rh ? UPGRADE_DROPS.billetRaidH : UPGRADE_DROPS.billetRaid], [ENGINE_CORE, m.kind === DS_BOSS ? UPGRADE_DROPS.coreHeart : m.rh ? UPGRADE_DROPS.coreRaidH : UPGRADE_DROPS.coreRaid]], m.def.name);
        else if (m.def.boss && (m.heroic || m.rh)) this.giveMats(q, [[BILLET, UPGRADE_DROPS.billetBossH]], m.def.name);
        if (endgame) this.temperKill(q, m, got);
      }
      m.loot = { gold, items, owners: owners.map((p) => p.id) };
      if (items.length || gold) this.broadcast({ k: 'lootable', id: m.id });
    }
  }

  // ------------------------------------------------------------------ rarity at drop, Tempering, bound pieces (plan A3-A6)
  // which drop table a kill rolls on (a loot table may name its own with src)
  dropSrc(m) {
    const t = LOOT_TABLES[m.def.loot];
    if (t?.src && RARITY_SRC.includes(t.src)) return t.src;
    if (m.def.world) return 'worldboss';
    if (m.def.boss && m.def.raid) return m.rh ? 'raidH' : 'raid';
    if (m.def.boss) return m.heroic || m.rh ? 'bossH' : 'boss';
    if (m.def.elite || m.def.rare) return 'elite';
    return 'world';
  }
  // endgame kills: bosses (dungeon, raid, world) of ENDGAME_LVL and up
  endgameKill(m) { return !!(m.def.boss || m.def.world) && m.level >= ENDGAME_LVL; }
  // Prismatic pieces, the Dragonslayer set and the named (unique) pieces of endgame kills are bound: they cannot be posted
  bound(g) { return !!(g && (g.bd || (g.q ?? 1) >= 6 || g.dragonslayer)); }
  dropGear(g, endgame) { if (g.stats && (g.q ?? 1) >= 2) { g.bs ||= { ...g.stats }; g.up ??= 0; } if ((g.q ?? 1) >= 6 || g.dragonslayer || (endgame && g.unique)) g.bd = 1; return g; }
  // a named template dropped by a foe: its rarity rolled on src (templates below Uncommon keep theirs)
  namedDrop(id, src, endgame) {
    const g = rollNamed(ITEMS[id], src, rand, undefined, id);
    if (g.fx) g.fx = g.fx.map((e) => [...e]);
    return this.dropGear(g, endgame);
  }
  // paid or chosen gear (quest rewards, spares, vendors, quartermasters, marks, crafting): the designed rarity, never rolled
  fixedGear(id) { const g = rollNamed(ITEMS[id], 'fixed', rand, undefined, id); if (g.fx) g.fx = g.fx.map((e) => [...e]); return g; }
  // the whole valley hears of a Prismatic find
  dropNotice(g, who, m) {
    if ((g?.q ?? 1) < 6) return;
    const names = who.filter((q) => !q.bot).map((q) => q.name);
    if (!names.length) return;
    const list = names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    this.broadcast({ k: 'msg', text: `A Prismatic piece! ${list} ${names.length > 1 ? 'have' : 'has'} found ${g.name}${m ? ` on ${m.def.name}` : ''}.`, color: '#ff6ad5', prism: 1, item: { gear: g } });
  }
  // into the bags, or by post when they are full
  giveOrPost(p, it, from) {
    const fits = p.bag.length < this.bagMax(p) || (it.id && p.bag.some((b) => b.id === it.id && b.n + it.n <= (ITEMS[it.id].stack || 1)));
    if (fits && this.addItem(p, it)) return true;
    const name = it.gear ? it.gear.name : ITEMS[it.id].name;
    if (it.gear) this.armoryFind(p, it.gear.id);
    this.systemPost(p, from, name, 'Your bags were full, so this was sent on with the caravans. Any Caravan Master will hand it over.', { item: it });
    this.msg(p, `Your bags are full: ${name} was sent to you by post.`, '#ffe08a');
    return false;
  }
  giveMats(p, list, from) {
    const got = [];
    for (const [id, n] of list) if (n > 0) { this.giveOrPost(p, { id, n }, from); got.push(`${n} ${ITEMS[id].name}`); }
    if (got.length) this.msg(p, `From ${from}: ${got.join(' and ')}.`, '#c8a0ff');
  }
  // Tempering (plan A5): one counted roll per endgame kill for each player who earns it (bots never). g counts kills since
  // the last Legendary or better piece that dropped for the player; the 20th kill without one gives a personal Legendary
  // piece. p counts kills toward a Prismatic: from 150 each kill adds 0.01% toward a personal Prismatic piece, at 300 it
  // is certain, and then p starts again (so it does whenever a Prismatic drops for them).
  temperKill(p, m, got = []) {
    if (p.bot || (p.level || 1) < ENDGAME_LVL) return null;
    const t = (p.temper ||= newTemper());
    t.g = t.g | 0; t.p = (t.p | 0) + 1;
    const best = Math.max(0, ...got.map((g) => g?.q ?? 0));
    let give = 0;
    if (best >= 6) t.p = 0;
    else {
      const extra = t.p >= TEMPER.prisAt ? 1 : t.p > TEMPER.prisFrom ? (t.p - TEMPER.prisFrom) * TEMPER.prisStep : 0;
      if (extra > 0 && rand() < extra) { give = 6; t.p = 0; }
    }
    if (give || best >= 5) t.g = 0;
    else if (t.g + 1 >= TEMPER.golden) { give = 5; t.g = 0; }
    else t.g++;
    if (!give) return null;
    const ilvl = m.level + (m.def.boss ? 2 : 0) + (m.rh ? 4 : 0);
    const g = this.dropGear(rollGear(rand, ilvl, { q: give, cls: p.cls, weight: CLASS_WEIGHT[p.cls] }), true);
    this.msg(p, `Tempering: your long run of hard fights pays off. ${g.name} (${QUALITY_NAME[give]}) is yours.`, give === 6 ? '#ff6ad5' : '#ffc23a');
    this.dropNotice(g, [p], m);
    this.giveOrPost(p, { gear: g }, 'Tempering');
    this.achAdd(p, give === 6 ? 'temperP' : 'temperG');
    return g;
  }
  // a group's shared piece reaches the one player who got it (claim or loot): only now does it reset their Tempering
  // counters (endgame kills) and the valley hear their name if it is Prismatic
  pendGot(p, g) {
    const P = g && this.pendLoot?.get(g);
    if (!P) return;
    this.pendLoot.delete(g);
    if (P.eg && !p.bot && (p.level || 1) >= ENDGAME_LVL) {
      const t = (p.temper ||= newTemper());
      if ((g.q ?? 1) >= 5) t.g = 0;
      if ((g.q ?? 1) >= 6) t.p = 0;
    }
    this.dropNotice(g, [p], P.m);
  }

  // the period a repeatable quest is done for: today, or this week for weekly quests
  // rotating dailies ({ rot: [group, index, size] }): each day one job of the group rests and the others are offered
  restingDaily(Q) { return !!Q.rot && this.today() % Q.rot[2] === Q.rot[1]; }
  qPeriod(Q) { return Q.weekly ? 'w' + weekNumber() : this.today(); }
  // a piece of the player's class's Dragonslayer set: on Heroic always (the weekly lockout makes it the first kill each
  // week), on Normal a rare roll. The piece they have never held comes first.
  dragonslayerDrop(p, heroic, out) {
    const set = DRAGONSLAYER[p.cls];
    if (!set || (!heroic && rand() >= DS_NORMAL_CHANCE)) return null;
    const missing = set.filter((id) => !p.ach?.c?.['found:' + id]);
    const id = missing.length ? missing[0] : set[RI(0, set.length - 1)];
    // its rarity is rolled on the Dragonslayer table (plan A4); the piece is bound
    const g = this.namedDrop(id, 'ds', true);
    out?.push(g);
    this.giveOrPost(p, { gear: g }, 'The Great Dam');
    if (g.q < 6) this.broadcast({ k: 'msg', text: `${p.name} has claimed ${g.name} (${QUALITY_NAME[g.q]}) from the Great Dam’s Heart!`, color: '#ffc23a' });
    else this.dropNotice(g, [p], null);
    this.pushSelf(p);
    return id;
  }
  // the achievement: every piece of your own class's set held at least once
  dragonslayerCheck(p) {
    const set = DRAGONSLAYER[p.cls];
    if (set && set.every((id) => p.ach.c['found:' + id])) this.achSet(p, 'dragonslayer', 1);
    const arm = DRAGONSLAYER_ARMOUR[p.cls];
    if (arm && arm.every((id) => p.ach.c['found:' + id])) this.achSet(p, 'dsarmour', 1);
  }
  // a piece of the player's class's Dragonslayer armour from a Great Dam boss (data.js DSA_SOURCE): the Heart on Heroic
  // always gives a piece you have never held (any slot), on Normal DSA_NORMAL_CHANCE; the other three bosses give one of
  // their own two slots, DSA_HEROIC_CHANCE on Heroic and DSA_NORMAL_CHANCE on Normal (the one you lack first). Once per
  // player per weekly lockout kill (the caller only reaches owners who claimed this week's treasure). Returns the id.
  dsArmourDrop(p, kind, heroic, out) {
    const all = DRAGONSLAYER_ARMOUR[p.cls], slots = DSA_SOURCE[kind];
    if (!all || !slots) return null;
    const heart = kind === DS_BOSS;
    if (!(heart && heroic) && rand() >= (heroic ? DSA_HEROIC_CHANCE : DSA_NORMAL_CHANCE)) return null;
    // the Heart's Heroic piece may be any slot you lack; otherwise the boss's own slots
    const pool = heart && heroic ? all : all.filter((id) => slots.includes(ITEMS[id].slot));
    const missing = pool.filter((id) => !p.ach?.c?.['found:' + id]);
    const from = missing.length ? missing : pool;
    const id = from[RI(0, from.length - 1)];
    const g = this.namedDrop(id, 'ds', true);
    out?.push(g);
    this.giveOrPost(p, { gear: g }, 'The Great Dam');
    if (g.q < 6) this.broadcast({ k: 'msg', text: `${p.name} has claimed ${g.name} (${QUALITY_NAME[g.q]}) from ${MOBS[kind]?.name || 'the Great Dam'}!`, color: '#ffc23a' });
    else this.dropNotice(g, [p], null);
    this.pushSelf(p);
    return id;
  }
  // a leg_* weapon: src rolls its rarity like any drop (null keeps the designed Legendary, for test commands)
  legendaryFor(cls, src = null, endgame = false) {
    const fit = LEGENDARIES.filter((k) => !cls || ITEMS[k].classes.includes(cls));
    const id = (fit.length ? fit : LEGENDARIES)[RI(0, (fit.length ? fit : LEGENDARIES).length - 1)];
    return src ? this.namedDrop(id, src, endgame) : this.fixedGear(id);
  }
  // random gear: src rolls the rarity on that drop table (plan A4); minQ is a floor on top
  makeGear(level, minQ, cls, src) {
    return rollGear(rand, level, { minQ: minQ || undefined, src: src || undefined, cls, weight: CLASS_WEIGHT[cls] });
  }
  makeGearOld(level, minQ) {
    const slots = Object.keys(GEAR_NAMES);
    const slot = slots[RI(0, slots.length - 1)];
    const r = rand();
    let q = r < 0.6 ? 2 : r < 0.92 ? 3 : 4;
    if (minQ) q = Math.max(q, minQ);
    const budget = (3 + level * 1.6) * (q === 2 ? 1 : q === 3 ? 1.45 : 2);
    const stats = {};
    if (slot === 'weapon' || slot === 'trinket' || slot === 'offhand') stats.power = Math.round(budget * 0.8);
    else { stats.armor = Math.round(budget * 3); stats.hp = Math.round(budget * 0.8); }
    if (rand() < 0.5) stats.haste = Math.round(budget * 0.25);
    const base = GEAR_NAMES[slot][RI(0, GEAR_NAMES[slot].length - 1)];
    const name = `${GEAR_PREFIX[RI(0, GEAR_PREFIX.length - 1)]} ${base}`;
    return { name, slot, icon: slot === 'weapon' ? 'sword' : slot, q, stats, ilvl: level };
  }

  giveXp(p, amt, rested = 0) {
    if (p.level >= LEVEL_CAP) return;
    p.xp += amt;
    p.session.send({ t: 'ev', list: [{ k: 'xp', amt, rested: rested || undefined }] });
    while (p.xp >= xpForLevel(p.level) && p.level < LEVEL_CAP) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      this.recalc(p);
      p.hp = p.maxHp; p.res = p.maxRes;
      this.broadcast({ k: 'lvl', id: p.id, level: p.level });
      this.achSet(p, 'level', p.level);
      this.levelPost(p);
      const learned = kitOf(p.cls).filter((s) => s.lvl === p.level);
      for (const s of learned) this.msg(p, `You have learned ${s.name}!`, '#7ad0ff');
      for (const f of FUSIONS[p.cls] || []) if (!f.tree && f.lvl === p.level) this.msg(p, `A new fusion is open: ${f.hint || f.name} (${nameOf(f.from, p.cls)}, then ${nameOf(f.to, p.cls)})`, '#ffd870');
      if (!p.bot) this.msg(p, p.level === 2 ? 'The Skill Web opens! Press N to spend your first Web point.' : 'You gained a Web point (N).', '#7ad0ff');
    }
  }

  // ------------------------------------------------------------------ loot, items, npcs
  on_loot(p, m) {
    const mob = this.mobs.get(m.id);
    if (!mob || !mob.dead || !mob.loot) return;
    if (dist(p, mob) > 6) return this.err(p, 'Too far away.');
    if (!mob.loot.owners.includes(p.id)) return this.err(p, 'That is not yours to loot.');
    p.session.send({ t: 'loot', id: mob.id, gold: mob.loot.gold, items: mob.loot.items.map((it) => (it.gear ? { gear: it.gear } : { id: it.id, n: it.n })) });
  }
  on_take(p, m) {
    const mob = this.mobs.get(m.id);
    if (!mob?.loot || dist(p, mob) > 7) return;
    if (m.all || m.gold) { if (mob.loot.gold) { p.gold += mob.loot.gold; this.achAdd(p, 'gold', mob.loot.gold); this.msg(p, `You loot ${mob.loot.gold} copper.`, '#ffe08a'); mob.loot.gold = 0; } }
    const idxs = m.all ? mob.loot.items.map((_, i) => i).reverse() : [m.slot];
    for (const i of idxs) {
      const it = mob.loot.items[i];
      if (!it) continue;
      if (this.addItem(p, it.gear ? { gear: it.gear } : { id: it.id, n: it.n })) { mob.loot.items.splice(i, 1); this.pendGot(p, it.gear); }
    }
    if (!mob.loot.items.length && !mob.loot.gold) { mob.loot = null; this.broadcast({ k: 'looted', id: mob.id }); }
    p.session.send({ t: 'loot', id: mob.id, gold: mob.loot?.gold || 0, items: mob.loot ? mob.loot.items.map((it) => (it.gear ? { gear: it.gear } : { id: it.id, n: it.n })) : [], closed: !mob.loot });
    this.pushSelf(p);
  }
  addItem(p, it, opt) {
    if (it.id) {
      const def = ITEMS[it.id];
      const st = p.bag.find((b) => b.id === it.id && b.n < (def.stack || 1));
      if (st) { st.n += it.n; this.questItem(p, it.id); this.armoryFind(p, it.id); this.receipt(p, it, opt); return true; }
    }
    if (p.bag.length >= this.bagMax(p)) { this.err(p, 'Your bags are full.'); return false; }
    p.bag.push(it.gear ? { gear: it.gear } : { id: it.id, n: it.n });
    if (it.id) this.questItem(p, it.id);
    this.armoryFind(p, it.gear?.id || it.id);
    if (it.gear) this.lookFind(p, it.gear);
    this.receipt(p, it, opt);
    return true;
  }
  on_recall(p) {
    if (p.dead || p.recall) return;
    const left = (p.recallReady || 0) - Date.now();
    if (left > 0) return this.err(p, `The compass needle is still settling (${Math.ceil(left / 60000)} min).`);
    if (this.time - p.combatT < 5) return this.err(p, 'You cannot use the compass in combat.');
    if (p.x >= DUNGEON_MIN_X) return this.err(p, 'The compass will not point anywhere down here.');
    if (p.trial || p.duel) return this.err(p, 'Not now.');
    if (p.cast) return this.err(p, 'You are busy.');
    this.dismount(p); if (p.salv) this.endSalvage(p, false);
    p.recall = { end: this.time + RECALL.secs, x: p.x, z: p.z, t0: this.time };
    p.session.send({ t: 'ev', list: [{ k: 'recall', secs: RECALL.secs }] });
    this.pushSelf(p);
  }
  tickRecall(p) {
    const R = p.recall;
    const stop = (why) => { p.recall = null; p.session.send({ t: 'ev', list: [{ k: 'recallStop' }, { k: 'err', text: why }] }); this.pushSelf(p); };
    if (p.dead) return stop('The compass falls still.');
    if (Math.hypot(p.x - R.x, p.z - R.z) > 0.8) return stop('You moved: the compass lost its bearing.');
    if (p.combatT > R.t0 || p.cast) return stop('Interrupted.');
    if (this.time < R.end) return;
    p.recall = null;
    const c = CARAVANS.find((x) => x.id === p.home) || CARAVANS[0];
    this.teleport(p, c.x + rand() * 3 - 1.5, c.z + 2.5 + rand() * 2 - 1);
    p.recallReady = Date.now() + RECALL.cooldown;
    this.achAdd(p, 'recalls');
    this.msg(p, `The Homeward Compass brings you back to ${c.name}.`, '#e8c26a');
    this.checkReach(p);
    this.pushSelf(p);
  }
  // the crossings between Harrowmouth, the Cinder Reach and the Rime Steps: Haroun at the Harrowmouth gangway sails you out to
  // the Reach, Zayd on the Reach pier sails you home or (after Part Ten) north, and Nasir on the Rime Steps pier sails you back
  // to either. m.to picks one of the man's ports (sailRoutes); without it he sails to his default (n.sail). Only once Chapter
  // 29 has put you aboard (m_c29_aboard), and a port may need more (SAIL.to[to].need). A teleport over 30 m fades the screen.
  on_sail(p, m) {
    if (p.dead) return;
    const n = m?.npc ? this.npcs.get(m.npc) : [...this.npcs.values()].find((q) => q.sail && dist(p, q) <= SAIL.range);
    if (!n?.sail) return;
    const dest = m?.to != null ? m.to : n.sail;
    // a lift (the Windward Heights' counterweight lift, kind 'lift') is ridden like a crossing, with its own words and gate;
    // so is the haul road (Part Fourteen: the wagon behind the rewound log haulier, kind 'haul', from the Tide Mills to the
    // Rainward Gorge and back), and the ropeway (Part Fifteen: the car on the Makers' rewound rope, kind 'rope', from the head
    // of the Slip over the ridge to the Russet Weald and back)
    const rope = !!n.rope || (!n.haul && SAIL.to[dest]?.kind === 'rope'), haul = !rope && (!!n.haul || SAIL.to[dest]?.kind === 'haul'), lift = !haul && !rope && (!!n.lift || SAIL.to[dest]?.kind === 'lift');
    if (!sailRoutes(n).includes(dest) || !SAIL.to[dest]) return this.err(p, haul ? 'The haul road does not run there from here.' : rope ? 'The ropeway does not run there from here.' : lift ? 'The lift does not run there from here.' : 'The ship does not sail there from here.');
    if (dist(p, n) > SAIL.range) return this.err(p, 'Too far away.');
    if (!lift && !haul && !rope && !p.done[SAIL.need]) return this.err(p, 'The ship is not ready to sail yet.');
    if (SAIL.to[dest].need && !p.done[SAIL.to[dest].need]) return this.err(p, SAIL.to[dest].notReady || (haul ? 'The haul road is not running yet.' : rope ? 'The ropeway is not running yet.' : lift ? 'The lift is not running yet.' : 'The ship is not ready to sail there yet.'));
    if (this.time - p.combatT < 5) return this.err(p, 'Not while you are fighting.');
    if (p.trial || p.duel) return this.err(p, 'Not now.');
    if (p.recall) { p.recall = null; p.session.send({ t: 'ev', list: [{ k: 'recallStop' }] }); }
    this.dismount(p); if (p.salv) this.endSalvage(p, false); p.sit = false; p.eating = 0;
    const to = SAIL.to[dest], from = areaOf(p.x, p.z);
    this.teleport(p, to.x + R(-1, 1), to.z + R(-1, 1));
    p.session.send({ t: 'ev', list: [{ k: haul ? 'haul' : rope ? 'rope' : lift ? 'lift' : 'sail', to: dest, from }] });
    this.msg(p, to.sayFrom?.[from] || to.say, '#e8c26a');
    this.checkReach(p);
    this.pushSelf(p);
  }
  // what a sailing NPC's dialog offers: his default port (to, name, ok, as before) and every port he sails to (routes); a
  // liftwright's routes are kind 'lift' (lift: true on the whole offer), a waggoner's kind 'haul' (haul: true), and a lift or
  // the haul road needs only its own quest, not SAIL.need
  sailState(p, n) {
    const okTo = (to) => (SAIL.to[to].kind === 'lift' || SAIL.to[to].kind === 'haul' || SAIL.to[to].kind === 'rope' || !!p.done[SAIL.need]) && (!SAIL.to[to].need || !!p.done[SAIL.to[to].need]);
    const routes = sailRoutes(n).filter((to) => SAIL.to[to]).map((to) => ({ to, name: SAIL.to[to].name, ok: okTo(to), need: SAIL.to[to].need || SAIL.need, kind: SAIL.to[to].kind || 'ship' }));
    return { to: n.sail, name: SAIL.to[n.sail].name, ok: okTo(n.sail), routes, lift: !!n.lift, haul: !!n.haul, rope: !!n.rope };
  }
  on_setHome(p, m) {
    const n = this.npcs.get(m.npc);
    if (!n?.caravan || dist(p, n) > 8) return;
    p.home = n.caravan;
    this.msg(p, `Your Homeward Compass now points to ${CARAVANS.find((c) => c.id === n.caravan)?.name}.`, '#e8c26a');
    this.pushSelf(p);
  }
  // a rare elite nearby: a ping on the minimap and a word from one of the valley's adventurers (once per rare per 10 minutes)
  spotRares(p) {
    if (p.dead || p.x >= DUNGEON_MIN_X) return;
    for (const m of this.mobs.values()) {
      if (!m.def.rare || m.dead || dist(m, p) > 60) continue;
      p.rareSeen ||= {};
      if (this.time < (p.rareSeen[m.id] || 0)) continue;
      p.rareSeen[m.id] = this.time + 600;
      p.session.send({ t: 'ev', list: [{ k: 'rare', id: m.id, x: +m.x.toFixed(1), z: +m.z.toFixed(1), name: m.def.name }] });
      // the word comes from an adventurer really near (living bots C.10 rare_seen), or as before from one of the valley's
      // (feel review v122: the word at most once per rare per 30 min, and one word per player per 5 min; the ping stays)
      p.rareSaid ||= {};
      if (this.time < (p.rareSaid[m.id] || 0) || this.time < (p.rareSaid._any || 0)) continue;
      p.rareSaid[m.id] = this.time + 1800; p.rareSaid._any = this.time + 300;
      let who = null; for (const q of this.players.values()) if (q.bot && q.wander && !q.away && !q.dead && dist(q, m) < 60) { who = q; break; }
      this.botSay(who || { name: WANDERERS[RI(0, WANDERERS.length - 1)].name, cls: 'ranger', bot: true, wander: true, far: true }, 'world', 'rare_seen', { only: p, to: p, slots: { mob: m.def.name } });
    }
  }
  inHub(p) { return CARAVANS.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < RESTED.hubR) || Math.hypot(p.x, p.z) < 40; }
  addRested(p, levels) { p.rested = Math.round(Math.min(xpForLevel(p.level) * RESTED.cap, (p.rested || 0) + levels * xpForLevel(p.level))); }
  bagMax(p) { return p.bagSize || BAG_BASE; }
  // the best thing in a loot bag, for the beam and the floating name
  lootBest(L) {
    let best = null;
    for (const it of L.items) { const d = it.gear || ITEMS[it.id]; const q = d.q ?? 1; if (!best || q > best.q) best = { q, name: d.name + (it.n > 1 ? ` x${it.n}` : '') }; }
    if (!best && L.gold) best = { q: -1, name: `${L.gold} copper` };
    return best;
  }
  // "You receive [item]" in its quality colour; rare and better finds also pop up a toast
  // opt.traded: a piece another player posted. It was found once already, so the find counters do not move again
  receipt(p, it, opt) {
    if (p.bot) return;
    const d = it.gear || ITEMS[it.id], q = d.q ?? 1;
    const ev = { k: 'recv', name: d.name, q, n: it.n || 1, icon: d.icon, id: it.id || it.gear?.id || null };
    if (!opt?.traded) {
      if (q >= 5) this.achAdd(p, 'legend');
      if (it.gear && q === 5) this.achAdd(p, 'golden');
      if (it.gear && q >= 6) this.achAdd(p, 'prismatic');
    }
    if (it.gear) this.armoryQ(p, it.gear);
    if (it.gear && q >= 3) ev.item = { gear: it.gear };
    p.session.send({ t: 'ev', list: [ev] });
  }
  countItem(p, id) { return p.bag.filter((b) => b.id === id).reduce((a, b) => a + b.n, 0); }
  questItem(p, id) {
    for (const [qid, q] of Object.entries(p.quests)) {
      const Q = QUESTS[qid];
      if (Q.goal.item === id || Q.goal.gather === id) { q.n = Math.min(Q.goal.n, this.countItem(p, id)); this.msg(p, `${Q.name}: ${ITEMS[id].name} ${q.n}/${Q.goal.n}`); }
    }
  }
  on_use(p, m) {
    const it = p.bag[m.slot];
    if (!it || !it.id) return;
    const def = ITEMS[it.id];
    if (!def.use) return;
    if (def.use.gem) {
      const order = ['weapon', 'chest', 'head', 'legs', 'shoulders', 'offhand', 'hands', 'feet', 'back', 'trinket'];
      const slot = order.find((s) => p.equip[s]?.sockets?.includes(null));
      if (!slot) return this.err(p, 'None of the gear you wear has an empty socket.');
      const g = p.equip[slot]; g.sockets[g.sockets.indexOf(null)] = def.use.gem;
      if (--it.n <= 0) p.bag.splice(m.slot, 1);
      this.recalc(p);
      this.msg(p, `You set the ${def.name} into your ${g.name}.`, '#9ac8ff');
      this.pushSelf(p); return;
    }
    if (def.use.bag) {
      if (def.lvl && p.level < def.lvl) return this.err(p, `Requires level ${def.lvl}.`);
      if (this.bagMax(p) >= def.use.bag) return this.err(p, 'Your backpack is already that big.');
      p.bagSize = def.use.bag; p.bag.splice(m.slot, 1);
      this.achSet(p, 'bag', p.bagSize);
      this.msg(p, `Your backpack now holds ${def.use.bag} items.`, '#9ac8ff');
      this.pushSelf(p); return;
    }
    if (def.use.mk3) {
      if (!p.runabout || p.runaboutMk !== 2) return this.err(p, 'The drive kit fits only a Mk II runabout.');
      p.runaboutMk = 3; p.bag.splice(m.slot, 1);
      if (p.mounted) this.broadcast({ k: 'mount', id: p.id, on: true });
      this.msg(p, 'You fit the Makers’ drive kit: your runabout is now a Mk III (+130% speed).', '#ffe08a');
      this.pushSelf(p); return;
    }
    if (def.use.crawler) {
      // the deed stays in the bag: first use keeps the crawler, every later use swaps which mount R brings
      if (!p.crawler) { p.crawler = true; p.mountKind = 'crawler'; this.msg(p, 'The Deepway Crawler is yours. Press R to drive it; use the deed again (or ask Gearwright Ottmar) to switch back to your runabout.', '#ffe08a'); }
      else if (!p.runabout) return this.err(p, 'The crawler is the only mount you own.');
      else { p.mountKind = mountKind(p) === 'crawler' ? 'runabout' : 'crawler'; this.msg(p, p.mountKind === 'crawler' ? 'R now brings the Deepway Crawler.' : 'R now brings your runabout.', '#ffe08a'); }
      if (p.mounted) this.broadcast({ k: 'mount', id: p.id, on: true });
      this.pushSelf(p); return;
    }
    if (def.use.pet) {
      p.pets = p.pets || {};
      if (p.pets[def.use.pet]) return this.err(p, 'You already have that companion.');
      p.pets[def.use.pet] = true; p.pet = def.use.pet;
      p.bag.splice(m.slot, 1);
      this.msg(p, `${def.name} joins your collection and trots after you. Choose companions in your character window (C).`, '#9ac8ff');
      this.achSet(p, 'pets', Object.keys(p.pets).length);
      this.pushSelf(p); return;
    }
    if ((p.cds['item:' + it.id] || 0) > this.time) return this.err(p, 'Not ready yet.');
    if (def.use.food) { if (p.combatT > this.time - 5) return this.err(p, 'You cannot eat in combat.'); p.eating = this.time; p.eatAmt = def.use.heal; this.broadcast({ k: 'eat', id: p.id }); if (def.use.buff) { const B = def.use.buff; this.addBuff(p, { name: B.name, stat: B.stat, pct: B.pct, t: B.dur, dur: B.dur, icon: B.icon }); } }
    else {
      if (def.use.heal) this.heal(p, p, p.maxHp * def.use.heal);
      if (def.use.res) p.res = Math.min(p.maxRes, p.res + p.maxRes * def.use.res);
      if (def.use.buff) { const B = def.use.buff; this.addBuff(p, { name: B.name, stat: B.stat, pct: B.pct, t: B.dur, dur: B.dur, icon: B.icon }); this.msg(p, `${B.name}: ${def.desc}`, '#9ac8ff'); }
      p.cds['item:' + it.id] = this.time + 30;
      this.broadcast({ k: 'drink', id: p.id });
    }
    it.n--;
    if (it.n <= 0) p.bag.splice(m.slot, 1);
    this.pushSelf(p);
  }
  on_equip(p, m) {
    const it = p.bag[m.slot];
    const gear = it?.gear || (it?.id && ITEMS[it.id].stats ? { ...ITEMS[it.id], id: it.id } : null);
    if (!gear) return;
    if (gear.req && p.level < gear.req) return this.err(p, `Requires level ${gear.req}.`);
    if (gear.classes && !gear.classes.includes(p.cls)) return this.err(p, `${CLASSES[p.cls].name}s cannot use ${gear.wtype || gear.otype ? 'that kind of weapon' : 'that'}.`);
    const old = p.equip[gear.slot];
    p.bag.splice(m.slot, 1);
    if (old) p.bag.push({ gear: old });
    p.equip[gear.slot] = gear;
    this.lookFind(p, gear);
    this.recalc(p);
    this.achSync(p);
    this.pushSelf(p);
  }
  on_unequip(p, m) {
    const g = p.equip[m.slot];
    if (!g || p.bag.length >= this.bagMax(p)) return;
    delete p.equip[m.slot];
    p.bag.push({ gear: g });
    this.recalc(p); this.pushSelf(p);
  }
  wearGear(p) {
    const broke = [];
    for (const g of Object.values(p.equip)) {
      if (!g) continue;
      const was = g.dur ?? 100;
      g.dur = Math.max(0, was - DUR_LOSS);
      if (was > 0 && g.dur === 0) broke.push(g.name);
    }
    if (broke.length) { this.recalc(p); this.msg(p, `Broken: ${broke.join(', ')}. Broken gear gives no stats until a merchant repairs it.`, '#ff6040'); }
    else this.msg(p, `Your gear is worn (-${DUR_LOSS}% durability). Any merchant can repair it.`, '#c8b48a');
  }
  repairBill(p) {
    let c = 0;
    for (const g of Object.values(p.equip)) c += repairCost(g);
    for (const it of p.bag) if (it.gear) c += repairCost(it.gear);
    return c;
  }
  on_repair(p, m) {
    const n = this.npcs.get(m.npc);
    if (!n?.vendor || dist(p, n) > 8 || !this.indoorOk(p, n)) return;
    const bill = Math.max(0, Math.round(this.repairBill(p) * this.repDiscount(p, n)));
    if (!bill) return this.msg(p, 'Your gear is in good repair.', '#c8b48a');
    if (p.gold < bill) return this.err(p, 'You cannot afford the repairs.');
    p.gold -= bill;
    for (const g of Object.values(p.equip)) if (g) g.dur = 100;
    for (const it of p.bag) if (it.gear) it.gear.dur = 100;
    this.recalc(p);
    this.msg(p, `${n.name} repairs your gear for ${bill} copper.`, '#ffe08a');
    this.achAdd(p, 'repairs');
    this.pushSelf(p);
  }
  on_sortBag(p) {
    const SL = ['weapon', 'offhand', 'head', 'shoulders', 'chest', 'back', 'hands', 'legs', 'feet', 'trinket'];
    const group = (b) => { const d = b.gear || ITEMS[b.id]; if (!d) return 9; if ((d.q ?? 1) === 0) return 8; if (d.slot === 'quest') return 0; if (b.gear || d.stats) return 1; if (d.slot === 'use') return 2; return 3; };
    const key = (b) => { const d = b.gear || ITEMS[b.id] || {}; return [group(b), -(d.q ?? 1), SL.indexOf(d.slot), -(d.ilvl || 0), d.name || '']; };
    p.bag.sort((a, b) => { const A = key(a), B = key(b); for (let i = 0; i < A.length; i++) { if (A[i] < B[i]) return -1; if (A[i] > B[i]) return 1; } return 0; });
    this.pushSelf(p);
  }
  // wardrobe: a weapon type, an offhand look and a weapon shine, each from what you have owned
  lookFind(p, g) {
    if (!g) return;
    if (g.wtype && !(p.looks ||= []).includes(g.wtype)) p.looks.push(g.wtype);
    const oh = g.slot === 'offhand' ? offhandLook(g) : null;
    if (oh && !(p.ohlooks ||= []).includes(oh)) p.ohlooks.push(oh);
    if (g.slot === 'weapon' && (g.q || 1) >= 3 && !(p.shines ||= []).includes(g.q)) { p.shines.push(g.q); p.shines.sort(); }
    const sl = shoulderLook(g);
    if (sl && !(p.shlooks ||= []).includes(sl)) { p.shlooks.push(sl); p.shlooks.sort(); }
    const cl = cloakLook(g);
    if (cl && !(p.cklooks ||= []).includes(cl)) { p.cklooks.push(cl); p.cklooks.sort(); }
    if ((g.slot === 'weapon' || g.slot === 'offhand') && upOf(g) >= 7) this.heatFind(p, upOf(g));
  }
  // the wardrobe's heat stages (plan C): every stage from +7 up to the highest a weapon or offhand of yours has reached
  heatFind(p, up) { const h = (p.heats ||= []); for (let k = 7; k <= Math.min(UPG.max, up); k++) if (!h.includes(k)) h.push(k); h.sort((a, b) => a - b); }
  // what the snapshot shows for a worn piece's heat (wu/ou): its step, or the wardrobe's choice (0 cold, or a lower stage)
  heatShown(p, g) { const up = upOf(g); if (up < 7) return undefined; const c = p.wheat; const v = c == null ? up : c === 0 ? 0 : Math.min(c, up); return v >= 7 ? v : undefined; }
  on_wlook(p, m) {
    if ('w' in m) p.wlook = m.w && (p.looks || []).includes(m.w) ? m.w : null;
    if ('oh' in m) p.ohlook = m.oh && (p.ohlooks || []).includes(m.oh) ? m.oh : null;
    if ('sh' in m) p.wshine = m.sh === 1 || (p.shines || []).includes(m.sh) ? m.sh : null;
    if ('arm' in m) p.shlook = m.arm === 'none' || (p.shlooks || []).includes(m.arm) ? m.arm : null;
    if ('ck' in m) p.cklook = m.ck === 'none' || (p.cklooks || []).includes(m.ck) ? m.ck : null;
    // heat: null shows what is forged, 0 keeps the steel cold, 7..10 a stage you have reached (never above the piece's own)
    if ('ht' in m) p.wheat = m.ht === 0 ? 0 : (p.heats || []).includes(m.ht) ? m.ht : null;
    this.pushSelf(p);
  }
  on_destroy(p, m) { if (p.bag[m.slot]) { p.bag.splice(m.slot, 1); this.pushSelf(p); } }

  on_npc(p, m) {
    const n = this.npcs.get(m.id);
    if (!n || dist(p, n) > 7 || !npcSeen(n, p.done)) return;
    if (!this.indoorOk(p, n)) return this.err(p, 'Step inside to speak with him.');
    for (const [qid, q] of Object.entries(p.quests)) if (QUESTS[qid].goal.escort && QUESTS[qid].giver === n.id && q.n < 1 && !this.escortOf(p, qid)) { this.startEscort(p, qid); this.msg(p, `${ESCORTS[QUESTS[qid].goal.escort].name} is ready to try the road again.`, '#ffd060'); }
    const offers = [], turnins = [], active = [];
    for (const qid of n.quests || []) {
      const Q = QUESTS[qid];
      if (p.quests[qid]) continue;
      if (Q.daily ? p.daily?.[qid] === this.qPeriod(Q) : p.done[qid]) continue;
      // chains: some quests require an earlier one
      if (Q.pre && !p.done[Q.pre]) continue;
      if (Q.needLedger && (p.ledger || []).length < Q.needLedger) continue;
      if (this.restingDaily(Q)) continue;
      if (Q.lvl > p.level + 2) continue;
      offers.push(qid);
    }
    for (const qid of Object.keys(p.quests)) {
      const Q = QUESTS[qid];
      if (Q.turnin !== n.id) continue;
      if (this.questComplete(p, qid)) turnins.push(qid); else active.push(qid);
    }
    const travel = n.caravan ? CARAVANS.filter((c) => c.id !== n.caravan && this.stopArea(c) === this.stopArea(n)).map((c) => ({ id: c.id, name: c.name, cost: this.fare(n, c), known: !!p.visited[c.id] })) : null;
    const hire = n.merc ? Object.entries(COMPANIONS).map(([cls, c]) => ({ cls, name: c.name, role: c.role, desc: c.desc, cost: companionCost(p.level) })) : null;
    p.session.send({ t: 'dialog', npc: n.id, offers, turnins, active, spares: this.sparesAt(p, n), vendor: n.vendor ? VENDORS[n.vendor] : null, travel, hire, store: n.store ? p.bank || [] : null, craft: n.craft || null, upgrade: !!n.upg, bounty: n.bounty ? this.bountyState(p) : null, rides: n.bounty ? this.dungeonRides(p, n) : null, muster: n.muster ? this.musterState(p) : null, homeshop: n.homeshop ? { owned: p.homeDeco || {}, rep: p.rep || {}, pos: p.homePos || {} } : null, post: !!n.caravan, home: n.caravan ? { here: n.caravan === p.home } : null, trade: !!n.trade, companions: this.myBots(p).filter((b) => !b.lfg).map((b) => b.cls), ladder: n.arena ? this.ringLadder(p) : null, arena: n.arena ? { best: p.arenaBest || 0, busy: !!this.arenaUser() && this.arenaUser() !== p } : null, runabout: n.mounts ? { cost: RUNABOUT.cost, level: RUNABOUT.level, have: !!p.runabout, mk: p.runaboutMk || 1, mk2: RUNABOUT.mk2, crawler: !!p.crawler, kind: mountKind(p), paint: p.paint || 'brass', paints: Object.keys(PAINTS).filter((k) => this.paintOk(p, k)) } : null, valley: n.build ? this.valleyState() : null, repShop: this.qmShop(p, n), sail: n.sail ? this.sailState(p, n) : null });
  }
  questComplete(p, qid) {
    const Q = QUESTS[qid], q = p.quests[qid];
    if (!q) return false;
    if (Q.goal.reach) return q.n >= 1;
    if (Q.goal.talk) return true;
    if (Q.goal.item || Q.goal.gather) return this.countItem(p, Q.goal.item || Q.goal.gather) >= Q.goal.n;
    return q.n >= Q.goal.n;
  }
  on_accept(p, m) {
    const Q = QUESTS[m.q];
    if (!Q || p.quests[m.q] || (Q.daily ? p.daily?.[m.q] === this.qPeriod(Q) : p.done[m.q])) return;
    if (Q.pre && !p.done[Q.pre]) return;
    if (Q.needLedger && (p.ledger || []).length < Q.needLedger) return;
    if (this.restingDaily(Q)) return this.err(p, 'That job is not on offer today.');
    if (!Q.msq && Object.keys(p.quests).filter((id) => !QUESTS[id]?.msq).length >= 12) return this.err(p, 'Your quest log is full.');
    p.quests[m.q] = { n: Q.goal.talk ? 1 : 0 };
    if (Q.msq?.first) p.session.send({ t: 'ev', list: [{ k: 'story', kind: 'start', ch: Q.msq.ch }] });
    if (Q.goal.item || Q.goal.gather) p.quests[m.q].n = Math.min(Q.goal.n, this.countItem(p, Q.goal.item || Q.goal.gather));
    this.msg(p, `Quest accepted: ${Q.name}`, '#ffd060');
    if (Q.goal.escort) this.startEscort(p, m.q);
    this.checkReach(p);
    this.pushSelf(p);
  }
  // offer one of your quests to the rest of your party
  on_share(p, m) {
    const Q = QUESTS[m.q];
    if (!Q || !p.quests[m.q] || Q.daily) return;
    const others = this.partyMembers(p).filter((q) => !q.bot && q !== p);
    if (!others.length) return this.err(p, 'There is no one in your party to share it with.');
    let n = 0;
    for (const q of others) {
      const why = q.quests[m.q] ? 'already has it' : q.done[m.q] ? 'has done it' : Q.pre && !q.done[Q.pre] ? 'is not ready for it' : Q.lvl > q.level + 2 ? 'is too low a level' : Object.keys(q.quests).length >= 12 ? 'has a full quest log' : null;
      if (why) { this.msg(p, `${q.name} ${why}.`, '#c8b48a'); continue; }
      q.shareAsk = { q: m.q, t: this.time + 60 };
      q.session.send({ t: 'ev', list: [{ k: 'questShare', from: p.name, cls: p.cls, q: m.q }] });
      n++;
    }
    if (n) this.msg(p, `You offer "${Q.name}" to ${n} party member${n > 1 ? 's' : ''}.`, '#ffd060');
  }
  on_shareReply(p, m) {
    const ask = p.shareAsk; p.shareAsk = null;
    if (!ask || ask.q !== m.q || this.time > ask.t || !m.accept) return;
    this.on_accept(p, { q: m.q });
  }
  on_abandon(p, m) { if (QUESTS[m.q]?.msq) return this.err(p, 'Main Story quests cannot be abandoned.'); const e = this.escortOf(p, m.q); if (e) this.removeEscort(e, true); delete p.quests[m.q]; this.pushSelf(p); }
  on_turnin(p, m) {
    const Q = QUESTS[m.q];
    if (!Q || !this.questComplete(p, m.q)) return;
    const n = this.npcs.get(Q.turnin);
    if (!n || dist(p, n) > 7 || !this.indoorOk(p, n)) return;
    // a reward must never be lost: it needs a free bag slot (handing in the quest's own items may free one), or room in the post
    if (Q.rewards.length && p.bag.length >= this.bagMax(p) && p.mail.length >= POST.max) {
      let need = Q.goal.item || Q.goal.gather ? Q.goal.n : 0, frees = false;
      const id = Q.goal.item || Q.goal.gather;
      for (let i = p.bag.length - 1; i >= 0 && need > 0; i--) if (p.bag[i].id === id) { if (p.bag[i].n <= need) frees = true; need -= Math.min(need, p.bag[i].n); }
      if (!frees) return this.err(p, 'Your bags and your post are both full. Make room for the reward first.');
    }
    if (Q.goal.item || Q.goal.gather) {
      let need = Q.goal.n;
      const id = Q.goal.item || Q.goal.gather;
      for (let i = p.bag.length - 1; i >= 0 && need > 0; i--) if (p.bag[i].id === id) { const take = Math.min(need, p.bag[i].n); p.bag[i].n -= take; need -= take; if (p.bag[i].n <= 0) p.bag.splice(i, 1); }
    }
    delete p.quests[m.q];
    if (Q.daily) { p.daily = p.daily || {}; p.daily[m.q] = this.qPeriod(Q); } else p.done[m.q] = true;
    if (Q.bonusGear) { const g = this.makeGear(Q.bonusGear.ilvl, Q.bonusGear.q, p.cls, 'raid'); this.dropNotice(g, [p], null); this.addItem(p, { gear: g }); } // the weekly bonus piece: rolled on the raid table, never below its floor
    if (Q.daily && !Q.weekly) { const L = Math.max(p.level, Q.lvl); Q.gold = 8 + L * 3; Q.xp = dailyXp(Q, p.level); }
    p.gold += Q.gold * 10; this.achAdd(p, 'gold', Q.gold * 10); this.achAdd(p, 'quests'); if (Q.goal.escort) this.achAdd(p, 'escorts'); if (Q.ach) this.achAdd(p, 'quest:' + m.q);
    { const f = factionOfZone(zoneAt(n.x, n.z).id); this.addRep(p, f, Math.round((150 + (Q.lvl || 1) * 15) * (FACTIONS[f]?.questRep ?? 1))); } // the outer areas' long stories would otherwise open the whole shop at once (FACTIONS[f].questRep)
    if (Q.rewards.length) {
      let pick = Q.rewards[clamp(m.choice | 0, 0, Q.rewards.length - 1)];
      { const T = ITEMS[pick], W = T?.twin && ITEMS[T.twin]; if (W && T.classes && !T.classes.includes(p.cls) && W.classes?.includes(p.cls)) pick = T.twin; } // a bow and its pistol twin (v107): you get the one your class uses
      const gift = { gear: this.fixedGear(pick) }; (p.picks ||= {})[m.q] = pick;
      if (p.bag.length < this.bagMax(p)) this.addItem(p, gift);
      else { this.armoryFind(p, pick); this.systemPost(p, n.name, Q.name, 'Your bags were full, so I sent your reward on with the caravans. Any Caravan Master will hand it over.', { item: gift }); this.msg(p, `Your bags are full: ${ITEMS[pick].name} was sent to you by post.`, '#ffe08a'); }
    }
    this.msg(p, `Quest complete: ${Q.name}`, '#7aff7a');
    p.session.send({ t: 'ev', list: [{ k: 'questDone', q: m.q, pick: Q.rewards.length ? p.picks?.[m.q] : null, npc: n?.id }, ...(Q.msq?.last ? [{ k: 'story', kind: 'end', ch: Q.msq.ch }] : [])] });
    this.giveXp(p, Q.xp);
    this.pushSelf(p);
  }
  on_buy(p, m) {
    const it = ITEMS[m.item];
    if (!it?.price) return;
    if (it.lvl && p.level < it.lvl) return this.err(p, `Requires level ${it.lvl}.`);
    const vn = m.npc ? this.npcs.get(m.npc) : null;
    const cost = Math.max(1, Math.round(it.price * 10 * (vn ? this.repDiscount(p, vn) : 1)));
    if (p.gold < cost) return this.err(p, 'You cannot afford that.');
    if (this.addItem(p, it.stats ? { gear: this.fixedGear(m.item) } : { id: m.item, n: 1 })) { p.gold -= cost; this.pushSelf(p); } // a piece of gear (the Gunsmith's starter pistols) comes as a full piece
  }
  on_sell(p, m) {
    const it = p.bag[m.slot];
    if (!it) return;
    { let near = false; for (const n of this.npcs.values()) if (n.vendor && dist(p, n) <= 10) { near = true; break; } if (!near) return this.err(p, 'You need to be at a merchant to sell.'); }
    const value = it.gear ? gearValue(it.gear) : (ITEMS[it.id].price || 1) * 3 * it.n;
    if (it.id && ITEMS[it.id].slot === 'quest') return this.err(p, 'You cannot sell that.');
    p.bag.splice(m.slot, 1);
    p.gold += value;
    (p.buyback ||= []).push({ it, value }); if (p.buyback.length > 12) p.buyback.shift();
    this.msg(p, `Sold ${it.gear ? it.gear.name : ITEMS[it.id].name} for ${value} copper.`, '#ffe08a');
    this.pushSelf(p);
  }
  on_buyback(p, m) {
    const i = Number(m.i), B = p.buyback?.[i];
    if (!B) return;
    if (p.gold < B.value) return this.err(p, 'You cannot afford to buy that back.');
    if (p.bag.length >= this.bagMax(p)) return this.err(p, 'Your bags are full.');
    p.gold -= B.value; p.buyback.splice(i, 1);
    p.bag.push(B.it);
    this.msg(p, `You buy back ${B.it.gear ? B.it.gear.name : ITEMS[B.it.id].name}.`, '#ffe08a');
    this.pushSelf(p);
  }
  on_sellJunk(p, m) {
    const n = this.npcs.get(m.npc);
    if (!n?.vendor || dist(p, n) > 8 || !this.indoorOk(p, n)) return;
    let gold = 0, k = 0;
    for (let i = p.bag.length - 1; i >= 0; i--) { const g = p.bag[i].gear; if (g && (g.q ?? 1) === 0) { const v = gearValue(g); gold += v; k++; (p.buyback ||= []).push({ it: p.bag[i], value: v }); p.bag.splice(i, 1); } }
    if (p.buyback?.length > 12) p.buyback.splice(0, p.buyback.length - 12);
    if (!k) return this.msg(p, 'You have no junk to sell.', '#c8b48a');
    p.gold += gold; this.achAdd(p, 'gold', gold);
    this.msg(p, `Sold ${k} piece${k > 1 ? 's' : ''} of junk for ${gold} copper.`, '#ffe08a');
    this.pushSelf(p);
  }
  on_gather(p, m) {
    const n = this.nodes.get(m.id);
    if (!n || !n.ready || dist(p, n) > 4) return;
    // a quest's own nodes (questOnly: driftwood for the ice bow) give nothing to anybody who has no quest wanting them (mosscaps
    // stay open to all: the herbalist's and the cook's recipes use them)
    if (n.questOnly && !Object.keys(p.quests).some((q) => QUESTS[q]?.goal.gather === n.item)) return this.err(p, `You have no use for the ${ITEMS[n.item].name.toLowerCase()} yet.`);
    n.ready = false; n.t = this.time + 40;
    this.broadcast({ k: 'node', id: n.id, ready: false });
    this.addItem(p, { id: n.item, n: 1 });
    this.achAdd(p, 'gathers');
    this.pushSelf(p);
  }
  // quest objects: each one counts once per player
  on_useobj(p, m) {
    if (p.dead) return;
    const o = OBJECTS.find((x) => x.id === m.id);
    if (!o) return;
    if (Math.hypot(p.x - o.x, p.z - o.z) > 4.5) return this.err(p, 'Too far away.');
    if (o.kind === 'ramchest') return this.ramChest(p, o); // Yard-Engineer Yusuf's chest (shared/ramEngine.js)
    if (o.kind === 'rideschest') return this.ridesChest(p, o); // the Woodwrights' chest (shared/rides.js)
    if (o.kind === 'drawing') {
      if (p.ach.c['drw:' + o.id]) return this.err(p, 'You have already taken up this drawing.');
      this.achSet(p, 'drw:' + o.id, 1);
      const Dw = DRAWINGS.find((x) => x.id === o.id), n = DRAWINGS.filter((x) => p.ach.c['drw:' + x.id]).length;
      this.msg(p, `Makers\u2019 drawing ${n} of ${DRAWINGS.length}: \u201c${Dw.title}\u201d. ${Dw.text}`, '#e8d0a0');
      p.session.send({ t: 'ev', list: [{ k: 'useobj', id: p.id, obj: o.id }] });
      this.sendAch(p); this.pushSelf(p);
      return;
    }
    if (o.kind === 'page') {
      p.ledger ||= [];
      if (p.ledger.includes(o.id)) return this.err(p, 'You have already copied this page.');
      p.ledger.push(o.id);
      const L = LEDGER.find((x) => x.id === o.id);
      this.msg(p, `Lost Ledger, page ${p.ledger.length} of ${LEDGER.length}: "${L.title}". Read it in the Valley Journal (J).`, '#e8d0a0');
      this.achSet(p, 'ledger', p.ledger.length);
      p.session.send({ t: 'ev', list: [{ k: 'useobj', id: p.id, obj: o.id }] });
      this.pushSelf(p);
      return;
    }
    let used = false;
    for (const [qid, q] of Object.entries(p.quests)) {
      const Q = QUESTS[qid];
      if (Q.goal.use !== o.kind || q.n >= Q.goal.n) continue;
      q.used = q.used || [];
      if (q.used.includes(o.id)) continue;
      q.used.push(o.id); q.n++; used = true;
      this.msg(p, `${Q.name}: ${OBJECT_KINDS[o.kind].goal} ${q.n}/${Q.goal.n}`, '#ffd060');
    }
    if (!used) return this.err(p, 'You have no need of that.');
    this.broadcast({ k: 'useobj', id: p.id, obj: o.id });
    this.pushSelf(p);
  }

  // fares run between the overworld doors of underground stops (the camp in the Deepway is priced from its stair)
  fare(n, c) { const at = (o) => (o.x >= DUNGEON_MIN_X ? dungeonAt(o.x, o.z)?.door || o : o), a = at(n), b = at(c); return Math.max(10, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 10) * 6); }
  // which area a caravan stop (or caravan master) serves: an underground stop belongs to the area of its door
  stopArea(o) { const q = o.x >= DUNGEON_MIN_X ? dungeonAt(o.x, o.z)?.door || o : o; return areaOf(q.x, q.z); }
  on_travel(p, m) {
    if (p.dead) return;
    const n = this.npcs.get(m.npc), c = CARAVANS.find((x) => x.id === m.to);
    if (!n?.caravan || !c || dist(p, n) > 7) return;
    if (this.stopArea(c) !== this.stopArea(n)) return this.err(p, [this.stopArea(c), this.stopArea(n)].includes('weald') ? 'No caravan crosses the ridge. Ride the ropeway.' : [this.stopArea(c), this.stopArea(n)].includes('rainward') ? 'No caravan runs up the haul road. Ride the wagon.' : 'No caravan crosses the sea. Take the ship.');
    if (!p.visited[c.id]) return this.err(p, 'You have not found that caravan stop yet.');
    if (this.time - p.combatT < 5) return this.err(p, 'You cannot travel while in combat.');
    const cost = this.fare(n, c);
    if (p.gold < cost) return this.err(p, 'You cannot afford the fare.');
    p.gold -= cost;
    this.teleport(p, c.x + R(-1.5, 1.5), c.z + 2.5 + R(-1, 1));
    this.msg(p, `You ride with the supply caravan to ${c.name}.`, '#e8c26a');
    this.achAdd(p, 'travels');
    this.checkReach(p);
    this.pushSelf(p);
  }

  checkReach(p) {
    const z = zoneAt(p.x, p.z).id;
    const zk = 'z:' + z;
    if (!p.visited[zk] && z !== 'meadows') { p.visited[zk] = true; this.achSet(p, 'zone:' + z, 1); const zn = zoneAt(p.x, p.z); if (p.level > 1 || z !== 'village') { const xp = Math.round(40 + p.level * 28); this.msg(p, `Discovered: ${zn.name}`, '#e8d8a0'); p.session.send({ t: 'ev', list: [{ k: 'discover', zone: z }] }); this.giveXp(p, xp); } }
    for (const c of CARAVANS) if (c.zone === z && !p.visited[c.id]) { p.visited[c.id] = true; this.msg(p, this.stopArea(c) === 'valley' ? `Caravan stop found: ${c.name}. Caravan Masters can now take you here.` : `Caravan stop found: ${c.name}. No caravan ${this.stopArea(c) === 'rainward' ? 'runs up the haul road' : this.stopArea(c) === 'weald' ? 'crosses the ridge' : 'crosses the sea'}, but its Caravan Master can point your Homeward Compass here.`, '#e8c26a'); }
    for (const [qid, q] of Object.entries(p.quests)) {
      const Q = QUESTS[qid];
      if (Q.goal.reach && Q.goal.reach === z && q.n < 1) { q.n = 1; this.msg(p, `${Q.name}: destination reached.`, '#ffd060'); this.pushSelf(p); }
    }
  }

  // ------------------------------------------------------------------ tick
  tick(dt) {
    this.time += dt;
    this.lastDt = dt;
    if (this.claims?.size) for (const c of [...this.claims.values()]) if (this.time > c.end) this.settleClaim(c);
    this.tickGuilds(dt);
    this.mindTickAll(dt); this.botInviteTick(dt); this.lfgTick(dt); this.botChatTick(dt); // living bots (each throttles itself)
    for (const p of this.players.values()) this.tickPlayer(p, dt);
    if (this.tiers) this.tickMobsTiered(dt, this.tiers); else this.tickMobsNear(dt);
    this.tickEvents();
    this.tickRam(dt); // the Ram Engine on the Harrow Coast, on the world clock (shared/ramEngine.js)
    this.tickRides(dt); // the Russet Weald's "Clear the Rides" while the gale blows (shared/rides.js)
    for (let i = this.aoes.length - 1; i >= 0; i--) {
      const a = this.aoes[i];
      if (!a.side && FEEL_ON) this.botSidePlan(a);
      if (this.time < a.t) continue;
      this.aoes.splice(i, 1);
      const src = this.mobs.get(a.src) || a.caller;
      if (!src || (src.dead && !a.caller)) continue; // (a slip's lane burst lands even after its caller is dead)
      // bots (volunteers, companions) cannot read the telegraph, so they are taken to step out of most of it (v120: boss fights
      // now last long enough for many telegraphs to land, and a muster party of bots must still win the early dungeons)
      // (S1: the bots that step out were picked when the telegraph went down, and they dodge out of it; botSidePlan)
      for (const p of this.players.values()) if (!p.dead && a.spots.some((sp) => Math.hypot(p.x - sp.x, p.z - sp.z) < sp.r) && !(p.bot && (a.side?.has(p.id) || (!a.side?.hit?.has(p.id) && rand() < BOT_SIDESTEP)))) this.playerDamaged(p, src, a.dmg);
      this.broadcast({ k: 'boom', id: a.src, kind: a.kind, spots: a.spots });
      // (S7) a boss's readable window: after its own big telegraph lands (and none more of its own are waiting) it recovers
      // 1.0-1.5 s: no swing, no mechanic (its ability clock waits while it is held)
      if (!a.caller && RECOVER.kinds.has(a.kind) && src.type === 'mob' && (src.def.boss || src.def.world) && !src.dead && !this.aoes.some((o) => o.src === a.src && !o.caller && o.t > this.time)) {
        const t = R(RECOVER.min, RECOVER.max);
        this.addBuff(src, { name: 'Recovering', cc: 'stun', t, dur: t, debuff: true, icon: 'stun' });
        src.pending = null; src.swingT = Math.max(src.swingT || 0, t);
        src.winT = this.time + t; src.winExt = 0; // (CR.6: the boss's open window, reactions.js WINDOW)
        this.broadcast({ k: 'recover', id: src.id, t: +t.toFixed(2) });
      }
    }
    for (const n of this.nodes.values()) if (!n.ready && this.time > n.t) { n.ready = true; this.broadcast({ k: 'node', id: n.id, ready: true }); }
    this.snapT += dt;
    if (this.snapT >= 0.1) { this.snapT = 0; this.sendSnapshots(); }
    this.saveT += dt;
    if (this.saveT > 30) { this.saveT = 0; for (const p of this.players.values()) if (!p.bot) this.savePlayer(p); }
    this.partyT += dt;
    if (this.partyT > 0.4) { this.partyT = 0; for (const P of this.parties.values()) this.partyChanged(P); this.tickSocial(); }
  }

  // mobs far from every player and adventurer think at 2 Hz instead of 20 (nobody can see them; timers use the world clock)
  // living bots (B.6): bots are weak anchors. A mob with no human within 130 m but a full-detail bot within 60 m thinks at
  // 4 Hz (the rule tickMobsTiered uses offline); coarse and away bots do not count at all
  tickMobsNear(dt) {
    const anchors = this._anchH || (this._anchH = []), weak = this._anchB || (this._anchB = []);
    anchors.length = 0; weak.length = 0;
    for (const p of this.players.values()) { if (p.dead || p.away) continue; if (!p.bot) anchors.push(p); else if (!p.mind || p.mind.lod !== 'coarse') weak.push(p); }
    this.mobGridBuild();
    const sleepOn = !MOB_SLEEP.off, SR2 = MOB_SLEEP.r * MOB_SLEEP.r;
    // a grid square whose centre is further than the sleep range plus a square from every human (and 60 m plus a square
    // from every full-detail bot) holds only mobs that would sleep: they skip the distance checks (worked out once a tick)
    const far = this._mFar || (this._mFar = new Map()), FH = (MOB_SLEEP.r + MOB_CELL) ** 2, FW = (60 + MOB_CELL) ** 2;
    far.clear();
    for (const m of this.mobs.values()) {
      if (m.dead || m.state === 'chase') { this.tickMob(m, dt); continue; }
      if (sleepOn && mobSleepy(m)) {
        const cx = Math.floor(m.x / MOB_CELL), cz = Math.floor(m.z / MOB_CELL), k = (cx + 2048) * 4096 + (cz + 2048);
        let f = far.get(k);
        if (f === undefined) {
          f = true;
          const x = (cx + 0.5) * MOB_CELL, z = (cz + 0.5) * MOB_CELL;
          for (let i = 0; f && i < anchors.length; i++) { const dx = anchors[i].x - x, dz = anchors[i].z - z; if (dx * dx + dz * dz < FH) f = false; }
          for (let i = 0; f && i < weak.length; i++) { const dx = weak[i].x - x, dz = weak[i].z - z; if (dx * dx + dz * dz < FW) f = false; }
          far.set(k, f);
        }
        if (f) {
          m.sleepAcc = (m.sleepAcc || 0) + dt;
          if (m.sleepAcc >= MOB_SLEEP.step) { this.mobDoze(m, m.sleepAcc); m.sleepAcc = 0; }
          continue;
        }
      }
      let d2 = Infinity;
      for (let i = 0; i < anchors.length; i++) { const p = anchors[i], dx = p.x - m.x, dz = p.z - m.z, d = dx * dx + dz * dz; if (d < d2) { d2 = d; if (d < 130 * 130) break; } }
      if (d2 < 130 * 130) { if (m.sleepAcc) { this.tickMob(m, m.sleepAcc + dt); m.sleepAcc = 0; } else this.tickMob(m, dt); continue; }
      let step = 0.5;
      for (let i = 0; i < weak.length; i++) { const p = weak[i], dx = p.x - m.x, dz = p.z - m.z; if (dx * dx + dz * dz < 60 * 60) { step = 0.25; break; } }
      if (sleepOn && step === 0.5 && d2 >= SR2 && mobSleepy(m)) { // asleep (MOB_SLEEP)
        m.sleepAcc = (m.sleepAcc || 0) + dt;
        if (m.sleepAcc >= MOB_SLEEP.step) { this.mobDoze(m, m.sleepAcc); m.sleepAcc = 0; }
        continue;
      }
      m.sleepAcc = (m.sleepAcc || 0) + dt;
      if (m.sleepAcc >= step) { this.tickMob(m, Math.min(m.sleepAcc, 1)); m.sleepAcc = 0; }
    }
  }
  // a sleeping mob's second (MOB_SLEEP): what an idle mob nobody can see would do with its time, without walking about
  mobDoze(m, dt) {
    if (m.buffs.length) { this.tickBuffs(m, dt); if (m.dead) return; }
    if (m.poiseMax && m.poise < m.poiseMax && this.time - m.poiseT > POISE.refill && !(m.brokenT > this.time)) m.poise = m.poiseMax;
    if (m.def.inert || m.def.dummy) return;
    if (m.state === 'leash') { m.x = m.home.x; m.z = m.home.z; m.y = walkHeight(m.x, m.z); m.leashT = 0; m.state = 'idle'; m.target = null; m.speed = 0; this.mobGridMove(m); }
    if (m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.1 * dt);
  }

  // offline play only (the phone and the browser fallback set world.tiers; the server never does), perf plan E2: only the
  // real player keeps mobs at the full tick within 60 m; 60-130 m from them a mob thinks at 10 Hz, within 60 m of an
  // adventurer (bot) at 4 Hz, and everywhere else at tiers.farHz (2, or 1 under Battery saver). Chasing and dead mobs
  // (combat, respawns) keep the full tick within 130 m of the player and 4 Hz elsewhere. A sleeping mob catches up with
  // its saved time (at most 1 s) when it next thinks, so timers and travel come out the same.
  tickMobsTiered(dt, T) {
    const real = this._tierReal || (this._tierReal = []), bots = this._tierBots || (this._tierBots = []);
    real.length = 0; bots.length = 0;
    this.mobGridBuild();
    for (const p of this.players.values()) if (!p.dead && !p.away && !(p.bot && p.mind?.lod === 'coarse')) (p.bot ? bots : real).push(p); // (coarse bots never wake mobs: living bots B.6)
    const far = 1 / Math.max(0.5, T.farHz || 2);
    for (const m of this.mobs.values()) {
      let d2 = Infinity;
      for (let i = 0; i < real.length; i++) { const p = real[i], dx = p.x - m.x, dz = p.z - m.z, d = dx * dx + dz * dz; if (d < d2) d2 = d; }
      let step;
      if (d2 < 60 * 60) step = 0;
      else if (m.dead || m.state === 'chase') step = d2 < 130 * 130 ? 0 : 0.25;
      else if (d2 < 130 * 130) step = 0.1;
      else {
        step = far;
        for (let i = 0; i < bots.length; i++) { const p = bots[i], dx = p.x - m.x, dz = p.z - m.z; if (dx * dx + dz * dz < 60 * 60) { step = Math.min(far, 0.25); break; } }
      }
      if (!step) { if (m.sleepAcc) { const a = m.sleepAcc; m.sleepAcc = 0; this.tickMob(m, Math.min(a + dt, 1)); } else this.tickMob(m, dt); continue; }
      m.sleepAcc = (m.sleepAcc || 0) + dt;
      if (m.sleepAcc >= step) { const a = Math.min(m.sleepAcc, 1); m.sleepAcc = 0; this.tickMob(m, a); }
    }
  }

  tickBuffs(e, dt) {
    let changed = false;
    for (let i = e.buffs.length - 1; i >= 0; i--) {
      const b = e.buffs[i];
      b.t -= dt;
      if (b.dot || b.hot) {
        b.tick += dt;
        while (b.tick >= 1) {
          b.tick -= 1;
          const src = this.entity(b.src) || e;
          if (b.dot) this.damage(src, e, b.dot, 'dot'); else this.heal(src, e, b.hot);
          if (e.dead) return;
        }
      }
      if (b.t <= 0) { if (b.stat === 'absorb') e.absorb = 0; e.buffs.splice(i, 1); changed = true; if (b.hot && b.spread) this.spreadHot(e, b); } // (S13 Spreading Poultice)
    }
    if (changed && e.type === 'player') this.pushSelf(e);
  }

  tickPlayer(p, dt) {
    if (p.salv && this.time >= p.salv.end) this.endSalvage(p, true);
    if (p.trial) this.tickTrial(p);
    if (p.duel) this.tickDuel(p);
    if (p.recall) this.tickRecall(p);
    if (!p.bot && (p.rareT = (p.rareT || 0) + this.lastDt) > 1) { p.rareT = 0; this.spotRares(p); }
    if (!p.bot && (p.playT = (p.playT || 0) + this.lastDt) >= 60) { p.playT -= 60; p.ach.c.played = (p.ach.c.played || 0) + 60; }
    if (!p.bot && (p.restT = (p.restT || 0) + this.lastDt) > 30) { p.restT = 0; if (p.level < LEVEL_CAP && this.time - p.combatT > 10 && this.inHub(p)) { this.addRested(p, (30 / 3600) * RESTED.hubRate); this.pushSelf(p); } }
    if (!p.bot && p.buyOrders?.length && (p.tradeT = (p.tradeT || 0) + this.lastDt) > 30) { p.tradeT = 0; this.tickOrders(p); }
    if (p.bot) { try { this.tickBot(p, dt); } catch (e) { if (!this._botErr) { this._botErr = 1; this.io.log?.('bot error', e?.stack || e); } } }
    if (p.dead) return;
    this.tickBuffs(p, dt);
    if (p.dead) return;
    if (p.zones?.length) this.tickZones(p);
    if (p.delays?.length) this.tickDelays(p);
    if (p.cls === 'ranger' && (p.traps?.length || p.tal?.rangerStill)) this.tickRanger(p); // (S11: the snares on the ground, Never Still's metres)
    if (p.cls === 'chemist' && (p.bombs?.length || p.deep?.length)) this.tickChemist(p); // (S12: his bombs' fuses, Deep Chill)
    if (p.cls === 'deadeye') this.tickDeadeye(p); // (S10: Never Still's metres, the slide's shot, Six Chambers' slow reload)
    // Forge-Heated Head (the Warden, S9): the hot head costs 2% of his health every 10 s in a fight (never the last point)
    if (p.tal?.forgeBurn && this.time - p.combatT < 5 && this.time >= (p.forgeT || 0)) { if (p.forgeT) p.hp = Math.max(1, p.hp - p.maxHp * p.tal.forgeBurn); p.forgeT = this.time + 10; }
    if (p.link && (this.hasCC(p, 'stun') || this.time > p.link.until + LINK.tick + LINK.grace + 0.05)) p.link = null; // (a stun closes the window early)
    const inCombat = this.time - p.combatT < 5;
    const c = CLASSES[p.cls] || { regen: 0 };
    p.res = Math.min(p.maxRes, p.res + c.regen * (1 + (p.tal?.regen || 0)) * dt * (inCombat ? 1 : 1.6));
    if (!inCombat) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.012 * dt);
    if (p.eating) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * p.eatAmt / 10 * dt); if (this.time - p.eating > 10 || p.hp >= p.maxHp) p.eating = 0; }
    if (p.cast) {
      const tgt = p.cast.target ? this.entity(p.cast.target) : null;
      if (tgt && tgt.dead && p.cast.sk.target === 'enemy' && p.cast.hits === 0) this.cancelCast(p);
      else if (this.hasCC(p, 'stun')) this.cancelCast(p, 'Interrupted');
      else this.updateCast(p);
    }
    // the input buffer: a held dodge or skill press fires on the first tick it is legal (or is dropped past its 0.3 s)
    if (p.dodgeN != null && p.dodgeNext) this.dodgeRegen(p, this.dodgeOf(p));
    if (p.qdodge) { if (this.time > p.qdodge.until + 0.051) p.qdodge = null; else this.on_dodge(p, p.qdodge.m, true); }
    if (p.botDodge && this.time >= p.botDodge.at) { const bd = p.botDodge; p.botDodge = null; if (!p.dead && !p.cast?.channel) this.on_dodge(p, bd); }
    // (S9) a bot Warden braces behind the tower shield just before a swing it sees coming lands (botBrace, set by the swing)
    if (p.botGuard && this.time >= p.botGuard.at) { const bg = p.botGuard; p.botGuard = null; const m = this.mobs.get(bg.src); if (!p.dead && !p.cast && m && !m.dead) { p.ry = Math.atan2(m.x - p.x, m.z - p.z); this.on_cast(p, { skill: 'k_guard' }); } }
    if (p.botBrace && this.time >= p.botBrace.at) { const bb = p.botBrace; p.botBrace = null; const m = this.mobs.get(bb.src); if (!p.dead && !p.cast?.channel && m && !m.dead) { p.ry = Math.atan2(m.x - p.x, m.z - p.z); this.on_dodge(p, { dx: 0, dz: 0 }); } }
    if (p.qcast && !p.dead) { if (this.time > p.qcast.until + 0.051) p.qcast = null; else this.on_cast(p, p.qcast.m, true); }
    // send hp/res a few times a second
    p.selfT = (p.selfT || 0) + dt;
    if (p.selfT > 0.25) { p.selfT = 0; p.session.send({ t: 'stat', hp: Math.round(p.hp), maxHp: p.maxHp, res: Math.round(p.res), maxRes: p.maxRes, absorb: Math.round(p.absorb || 0) }); }
  }

  // a hero's ground patches (['zone', kind, coef, dur, r]): every 0.5 s each foe standing in one takes coef x power a
  // second and is slowed while it stands there
  tickZones(p) {
    let foes = null;
    // (S8) the Sandblade's column travels with him and, when it falls, throws up the small machines inside it
    for (const z of p.zones) if (z.follow && z.until <= this.time && z.lift && !z.done) { z.done = true; this.columnFall(p, z, (foes ||= this.foesOf(p))); }
    p.zones = p.zones.filter((z) => z.until > this.time);
    const inZ = (z, m) => (z.seg ? segDist(m.x, m.z, z.seg) : Math.hypot(m.x - z.x, m.z - z.z)) <= z.r + this.rad(m);
    for (const z of p.zones) {
      if (z.follow) { z.x = p.x; z.z = p.z; }
      if (this.time < z.next) continue;
      z.next += 0.5;
      if (z.herb) { this.tickHerbZone(p, z, (foes ||= this.foesOf(p)), inZ); continue; } // (S13: the Herbalist's smoke, steam and Field Hospital)
      const tal = p.tal || {};
      for (const m of (foes ||= this.foesOf(p))) {
        if (m.dead || !inZ(z, m)) continue;
        if (z.coef) { this._zk = z.kind; this.damage(p, m, p.power * (1 + (tal.dmg || 0)) * z.coef * 0.5, 'zone'); this._zk = null; } // (a fire patch is heat: Ignite; S12: a tar puddle deals nothing)
        if (z.coat && m.type === 'mob' && !m.dead && (z.coat === 'corrode' ? (z.tk = !z.tk) : !m.buffs.some((x) => x.coat === z.coat))) this.applyCoat(p, m, z.coat, 3); // (S12: tar, acid and frost coat what stands in them; acid a stack a second)
        if (z.slow && m.type === 'mob') this.addBuff(m, { name: z.slowName || 'Cinders', stat: 'slow', pct: z.slow, t: 0.6, dur: 0.6, debuff: true, icon: 'slow' });
        if (z.blind && m.type === 'mob' && !m.dead) this.addBuff(m, { name: 'Blinded', stat: 'miss', pct: z.blind, t: 1.0, dur: 1.0, debuff: true, icon: 'cloak' });
        if (z.pull && m.type === 'mob' && !m.dead && liftable(m.def) && !m.def.dummy) this.pullMob(m, z, z.pull);
      }
    }
  }
  // ---- the Deadeye (S10)
  // Never Still keeps the metres moved in the last 2 s (p.mvLog) and when he last moved (p.mvAt); Snap Shot held through a
  // slide fires out of it (p.slideFire, keeping the slide's link); Six Chambers reloads one round a second into the emptier
  // pistol after 1.5 s without a shot, and both pistols out of a fight
  tickDeadeye(p) {
    if (p.tal?.neverStill) {
      const d = p.mvX == null ? 0 : Math.hypot(p.x - p.mvX, p.z - p.mvZ);
      p.mvX = p.x; p.mvZ = p.z;
      if (d > 0.02 && d < 6) { (p.mvLog ||= []).push([this.time, d]); p.mvAt = this.time; }
      if (p.mvLog?.length && p.mvLog[0][0] < this.time - 2) p.mvLog = p.mvLog.filter((e) => e[0] >= this.time - 2);
    }
    if (p.slideFire && this.time >= p.slideFire.at) { const f = p.slideFire; p.slideFire = null; if (!p.dead && !p.cast && f.target) this.on_cast(p, { skill: 'd_snap', target: f.target, keepLink: true, slideFire: true }); }
    if (p.tal?.sixChambers) {
      const R0 = (p.rounds ||= [6, 6]);
      if (this.time - (p.combatT || 0) > 5) { R0[0] = 6; R0[1] = 6; }
      else if (this.time - (p.shotT || 0) > 1.5 && this.time >= (p.reloadT || 0) && (R0[0] < 6 || R0[1] < 6)) { R0[R0[0] <= R0[1] ? 0 : 1]++; p.reloadT = this.time + 1; }
    }
  }
  // ---- the Ranger (S11)
  // his snares (p.traps: one, three with Trapper's Ground; the oldest goes): each arms 0.5 s after it lands and closes on the
  // first machine that comes within reach; a sprung one stays until it is used or its time runs out
  layTrap(p, at, hold, dur, sk) {
    const T = { id: newId('tr'), x: +at.x, z: +at.z, until: this.time + (dur || 20), arm: this.time + 0.5, hold: hold || 3, caught: false, spring: !!sk.springTrap, sk: sk.id };
    const L = (p.traps ||= []);
    L.push(T);
    while (L.length > (p.tal?.trapMax || 1)) this.broadcast({ k: 'trapgone', tid: L.shift().id });
    this.broadcast({ k: 'trap', id: p.id, tid: T.id, x: +T.x.toFixed(2), z: +T.z.toFixed(2), dur: +(T.until - this.time).toFixed(1) });
    return T;
  }
  // the traps a trap fusion goes off round: the live ones, else the ones a fusion just burst (Closed Ground after Tripwire)
  trapsFor(p) { const L = (p.traps || []).filter((T) => T.until > this.time); return L.length ? L : p.trapBurst && p.trapBurst.until > this.time ? p.trapBurst.list : []; }
  tickRanger(p) {
    if (p.tal?.rangerStill) {
      const d = p.mvX == null ? 0 : Math.hypot(p.x - p.mvX, p.z - p.mvZ);
      p.mvX = p.x; p.mvZ = p.z;
      if (d > 0.02 && d < 6) { (p.mvLog ||= []).push([this.time, d]); p.mvAt = this.time; }
      if (p.mvLog?.length && p.mvLog[0][0] < this.time - 2) p.mvLog = p.mvLog.filter((e) => e[0] >= this.time - 2);
    }
    if (!p.traps?.length) return;
    p.traps = p.traps.filter((T) => { if (T.until > this.time) return true; this.broadcast({ k: 'trapgone', tid: T.id }); return false; });
    for (const T of p.traps) {
      if (T.caught || this.time < T.arm) continue;
      for (const m of this.mobs.values()) {
        if (m.dead || m.def.boss || m.def.inert || Math.abs(m.x - T.x) > 3 || Math.hypot(m.x - T.x, m.z - T.z) > 1.2 + this.rad(m)) continue;
        T.caught = true;
        this.broadcast({ k: 'trapsnap', tid: T.id, id: p.id, mob: m.id });
        const rec = p.eff?.[T.sk] || p.eff?.r_trap, coef = rec?.fx?.find((f) => f[0] === 'dmg')?.[1] || 0.4, saved = this._hc;
        this._hc = { sk: rec, i: 0, opening: false, brk: 10, launch: T.spring ? 1.0 : 0, bash: false, air: 0, src: p, broke: new Set(), encore: false };
        this.damage(p, m, p.power * (1 + (p.tal?.dmg || 0)) * coef * R(0.9, 1.1), T.sk);
        this._hc = saved;
        if (!T.spring && !m.dead) { this.addBuff(m, { name: 'Pinned', cc: 'root', t: T.hold, dur: T.hold, debuff: true, icon: 'root' }); m.pinT = Math.max(m.pinT || 0, this.time + T.hold); }
        this.provoke(m, p, 1);
        break;
      }
    }
  }
  roundsLeft(p) { const R0 = (p.rounds ||= [6, 6]); return R0[0] + R0[1]; }
  // a shot from the pistol with more rounds left (the right first), so the two cylinders empty together
  spendRound(p) { const R0 = (p.rounds ||= [6, 6]), i = R0[0] >= R0[1] ? 0 : 1; if (R0[i] > 0) R0[i]--; p.shotT = this.time; }
  // Bank Shot's skip off the first machine struck into the nearest other within 8 m, at half strength, as a spark
  bankShot(p, sk, enemies, power, fx) {
    const t0 = enemies[0], B = sk.bank, coef = fx.find((f) => f[0] === 'dmg')?.[1] || 0;
    let to = null, bd = B.r;
    for (const m of this.foesOf(p)) { if (m.dead || enemies.includes(m)) continue; const d = dist(m, t0); if (d < bd) { bd = d; to = m; } }
    if (!to || !coef) return;
    const bk = tagged(BANK_REC, sk, 'spark'), saved = this._hc;
    this._hc = { sk: bk, i: 0, opening: false, brk: 0, launch: 0, bash: false, air: 0, src: p, broke: new Set([to.id]), encore: false };
    this.broadcast({ k: 'bank', id: p.id, from: t0.id, to: to.id });
    this.damage(p, to, power * coef * B.mul * R(0.9, 1.1), sk.id);
    this._hc = saved;
  }
  // ---- the Chemist (S12)
  // his puddles and clouds (p.zones, chem): kind tar (slows, Tarred), fire (burns: heat, Ignite), frost (Cold Chemistry: slows
  // 60%, Chilled), acid (eats: Corroded a stack a second); Closed Lab carries them round him (follow); Pitch Wall lays a wall
  // (seg) across the throw. Every client draws them from {k:'czone'} and lets them run out by dur (cpop: one went off early)
  chemZone(p, sk, center, kind, coef, dur, r, seg = null) {
    const follow = !!sk.zoneFollow;
    if (sk.hotTar && kind === 'tar') { kind = 'fire'; coef = Math.max(coef, 0.3); }
    let slow = kind === 'tar' ? sk.zoneSlow || 50 : kind === 'frost' ? 60 : kind === 'fire' ? sk.zoneSlow || 20 : 0;
    if (sk.wall && !follow && !seg) { const ux = Math.cos(p.ry || 0), uz = -Math.sin(p.ry || 0); seg = [center.x - ux * 4, center.z - uz * 4, center.x + ux * 4, center.z + uz * 4]; r = 1.3; slow = Math.max(slow, 80); }
    if (follow) { seg = null; r = 4; }
    const z = { id: newId('cz'), chem: true, kind, coef, until: this.time + dur, r, x: follow ? p.x : center.x, z: follow ? p.z : center.z, seg, follow, slow, slowName: ZONE_SLOW[kind], coat: { tar: 'tar', acid: 'corrode', frost: 'chill' }[kind] || null, next: this.time + 0.5, sk: sk.id };
    const Z = (p.zones ||= []);
    if (follow) for (const o of Z.filter((q) => q.follow && q.chem)) { Z.splice(Z.indexOf(o), 1); this.broadcast({ k: 'czoneEnd', zid: o.id }); } // (one carried cloud at a time)
    Z.push(z);
    while (Z.length > 6) { const o = Z.shift(); if (o.chem) this.broadcast({ k: 'czoneEnd', zid: o.id }); }
    this.broadcast({ k: 'czone', id: p.id, zid: z.id, kind, x: +z.x.toFixed(2), z: +z.z.toFixed(2), r, dur, seg: seg?.map((v) => +v.toFixed(2)), follow: follow ? 1 : undefined });
    return z;
  }
  // the puddle a fusion goes off round: his burning one nearest the machine first, then any (within 16 m of it)
  puddleFor(p, target) {
    const o = target || p, L = (p.zones || []).filter((z) => z.chem && z.until > this.time && (z.follow || Math.hypot(z.x - o.x, z.z - o.z) <= 16));
    if (!L.length) return null;
    const d = (z) => (z.follow ? Math.hypot(p.x - o.x, p.z - o.z) : Math.hypot(z.x - o.x, z.z - o.z)) - (z.kind === 'fire' || z.kind === 'frost' ? 100 : 0);
    return L.sort((u, v) => d(u) - d(v))[0];
  }
  // a bomb comes to rest (the landing contact): it bursts sk.fuse s later where it lies (or on the machine, Sticky Charge);
  // Chain Reaction first sets off everything of his within reach, 0.1 s apart, and its cask waits for them
  layBomb(p, sk, c, center, target, enemies, allies, pud) {
    const ctr = sk.hit.at === 'target' && target && sk.sticky ? null : { x: center.x, z: center.z };
    const B = { id: newId('bm'), t: this.time + sk.fuse / (c.haste || 1), sk, c: { ...c, lit: true, ctr, bid: null } };
    B.c.bid = B.id;
    const dt = sk.fx.find((f) => f[0] === 'detonateAll');
    if (dt) B.t += 0.1 * this.detonateAll(p, center, dt[1], dt[2], sk, c);
    const L = (p.bombs ||= []);
    L.push(B);
    while (L.length > 8) L.shift();
    this.broadcast({ k: 'bomb', id: p.id, bid: B.id, sk: sk.id, x: +center.x.toFixed(2), z: +center.z.toFixed(2), t: +(B.t - this.time).toFixed(2), r: sk.hit.r || 4, on: ctr ? undefined : target.id });
    if (p.type === 'player') this.linkAfter(p, sk, c, enemies, allies);
  }
  detonateAll(p, center, R, coef, sk, c) {
    const items = [];
    for (const z of p.zones || []) if (z.chem && !z.follow && Math.hypot(z.x - center.x, z.z - center.z) <= R) items.push({ x: z.x, z: z.z, zone: z });
    for (const B of p.bombs || []) if (B.c.ctr && Math.hypot(B.c.ctr.x - center.x, B.c.ctr.z - center.z) <= R) items.push({ x: B.c.ctr.x, z: B.c.ctr.z, bomb: B });
    const far = (o) => Math.hypot(o.x - center.x, o.z - center.z);
    const list = items.sort((u, v) => far(v) - far(u)).slice(0, 8); // (the farthest first: the blasts walk toward the cask)
    let rec = POP_REC.get(sk);
    if (!rec) { rec = { ...sk, fuse: 0, hit: { t: 0, kind: 'aoe', r: 4 }, fx: [['dmg', coef], ['brk', 12]], fxLast: null, seq: null, tiers: [2], coatN: 0, coatMul: null }; POP_REC.set(sk, rec); }
    list.forEach((it, i) => {
      const at = this.time + 0.1 * (i + 1);
      if (it.bomb) { it.bomb.t = Math.min(it.bomb.t, at); return; }
      p.zones = p.zones.filter((z) => z !== it.zone);
      (p.delays ||= []).push({ t: at, sk: rec, c: { ...c, hits: 0, lit: true, ctr: { x: it.x, z: it.z }, opening: false }, pop: { zid: it.zone.id, x: +it.x.toFixed(2), z: +it.z.toFixed(2), r: 4, kind: it.zone.kind } });
    });
    return list.length;
  }
  tickChemist(p) {
    if (p.bombs?.length) {
      const due = p.bombs.filter((B) => B.t <= this.time + 1e-6);
      if (due.length) {
        p.bombs = p.bombs.filter((B) => B.t > this.time + 1e-6);
        for (const B of due) {
          this.broadcast({ k: 'boom', id: p.id, bid: B.id, sk: B.sk.id });
          this.applySkill(p, B.sk, B.c);
          // Unstable Stock's price: one blast in ten scorches him for 5% of his health (never the last point)
          if (p.tal?.unstable && (B.sk.tags || []).includes('blast') && rand() < p.tal.unstable && !p.dead) { p.hp = Math.max(1, p.hp - p.maxHp * 0.05); this.broadcast({ k: 'scorch', id: p.id }); }
        }
      }
    }
    if (p.deep?.length) {
      const due = p.deep.filter((d) => d.at <= this.time + 1e-6);
      if (due.length) {
        p.deep = p.deep.filter((d) => d.at > this.time + 1e-6);
        for (const d of due) for (const id of d.ids) { const m = this.mobs.get(id); if (m && !m.dead && !m.def.boss && m.buffs.some((b) => b.coat === 'chill')) this.addBuff(m, { name: 'Deep Chill', cc: 'root', t: d.t, dur: d.t, debuff: true, icon: 'frost' }); }
      }
    }
  }
  // ---- the Herbalist (S13)
  // the allies a heal of his reaches: his party (himself when alone) within r m of at, alive
  healAllies(p, at, r) { return this.partyMembers(p).filter((q) => q && !q.dead && q.id !== p.duel?.with && Math.hypot(q.x - at.x, q.z - at.z) <= r); }
  // a buff kept up without a new event while it runs (zones refresh theirs every 0.5 s)
  keepBuff(e, b) { const ex = e.buffs.find((x) => x.name === b.name && x.src === b.src); if (ex) { Object.assign(ex, b); return ex; } this.addBuff(e, b); return b; }
  // his herb zones (p.zones, herb): smoke (Calming Smoke: allies mend coef a second, the machines strike zoneWeak% softer),
  // steam (Willowbark Steam: twice the mending for the first 4 s, allies run 20% faster), hospital (Field Hospital: allies
  // take 30% less and the first who would fall stays up at 30%), sneeze (Sneezing Powder: the machines' swings are cut
  // short every sk.sneeze s), patch (Grove Keeper: a small herb patch at a healed ally's feet). Camphor Smoke Chills the
  // machines in it, Drifting Smoke follows him (zoneFollow). Every client draws them from {k:'hzone'} and lets them run out
  herbZone(p, sk, center, kind, coef, dur, r) {
    const follow = !!sk.zoneFollow && kind !== 'hospital' && kind !== 'patch';
    const z = { id: newId('hz'), herb: true, kind, coef, until: this.time + dur, t0: this.time, r, x: follow ? p.x : center.x, z: follow ? p.z : center.z, follow, weak: kind === 'patch' ? 0 : sk.zoneWeak || 0, coat: sk.camphor ? 'chill' : null, sneeze: sk.sneeze || 0, sneezeT: this.time + (sk.sneeze || 0), save: kind === 'hospital' ? 1 : 0, next: this.time + 0.5, sk: sk.id };
    const Z = (p.zones ||= []);
    if (kind === 'patch') { const old = Z.filter((q) => q.herb && q.kind === 'patch'); if (old.length >= 2) { const o = old[0]; Z.splice(Z.indexOf(o), 1); this.broadcast({ k: 'hzoneEnd', zid: o.id }); } } // (Grove Keeper: two patches at most)
    Z.push(z);
    while (Z.length > 6) { const o = Z.shift(); if (o.herb) this.broadcast({ k: 'hzoneEnd', zid: o.id }); else if (o.chem) this.broadcast({ k: 'czoneEnd', zid: o.id }); }
    this.broadcast({ k: 'hzone', id: p.id, zid: z.id, kind, x: +z.x.toFixed(2), z: +z.z.toFixed(2), r, dur, follow: follow ? 1 : undefined, cam: z.coat ? 1 : undefined });
    return z;
  }
  // his smoke (smoke, steam or sneeze) nearest at, within 12 m (Lantern Haze goes off in it)
  herbZoneFor(p, at) {
    const L = (p.zones || []).filter((z) => z.herb && z.until > this.time && (z.kind === 'smoke' || z.kind === 'steam' || z.kind === 'sneeze') && (z.follow || Math.hypot(z.x - at.x, z.z - at.z) <= 12));
    return L.sort((u, v) => Math.hypot(u.x - at.x, u.z - at.z) - Math.hypot(v.x - at.x, v.z - at.z))[0] || null;
  }
  // every 0.5 s: the allies in it mend (and Field Hospital's and the steam's buffs are kept up); the machines in it strike
  // softer, are Chilled (Camphor Smoke) and choke (Sneezing Powder: the swing cut short, a small machine staggers)
  tickHerbZone(p, z, foes, inZ) {
    const tal = p.tal || {};
    const boost = z.kind === 'steam' && this.time - z.t0 < 4 ? 2 : 1;
    const hp = p.power * (1 + (tal.heal || 0)) * z.coef * 0.5 * boost;
    for (const q of this.healAllies(p, z, z.r + 0.5)) {
      if (hp > 0) this.heal(p, q, hp * R(0.95, 1.05));
      if (z.kind === 'steam') this.keepBuff(q, { name: 'Willowbark Steam', stat: 'speed', pct: 20, t: 0.8, dur: 0.8, icon: 'steam' });
      if (z.kind === 'hospital') this.keepBuff(q, { name: 'Field Hospital', stat: 'armor', pct: 30, t: 0.8, dur: 0.8, hosp: z, icon: 'plant' });
    }
    const sneeze = z.sneeze && this.time >= z.sneezeT;
    if (sneeze) z.sneezeT = this.time + z.sneeze;
    for (const m of foes) {
      if (m.dead || m.type !== 'mob' || !inZ(z, m)) continue;
      if (z.weak) this.keepBuff(m, { name: 'Herb Smoke', stat: 'weak', pct: z.weak, t: 0.8, dur: 0.8, debuff: true, icon: 'smoke' });
      if (z.coat && !m.buffs.some((x) => x.coat === z.coat)) this.applyCoat(p, m, z.coat, 3);
      if (sneeze) { m.pending = null; m.swingT = Math.max(m.swingT || 0, 0.5); if (!m.def.boss && !m.def.dummy) this.addBuff(m, { name: 'Staggered', cc: 'stun', t: 0.4, dur: 0.4, debuff: true, icon: 'stun' }); this.broadcast({ k: 'sneeze', id: m.id }); }
    }
  }
  // Splash Jar: the jar bursts on the ally and splashes up to n more within r m at k of the heal
  splashHeal(p, sk, q0, amt) { const [n, r, k] = sk.splashHeal; for (const q of this.healAllies(p, q0, r).filter((x) => x !== q0).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp).slice(0, n)) this.heal(p, q, amt * k * R(0.95, 1.05)); }
  // Spreading Poultice: a heal over time that runs out jumps once to the most hurt ally within 12 m who has none of it
  spreadHot(e, b) {
    const src = this.entity(b.src);
    if (!src || src.dead || src.type !== 'player') return;
    const q = this.healAllies(src, e, 12).filter((x) => x !== e && !x.buffs.some((y) => y.name === b.name)).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
    if (q) { this.addBuff(q, { ...b, t: b.dur, tick: 0, spread: undefined }); this.broadcast({ k: 'hsplash', id: src.id, from: e.id, to: q.id }); }
  }
  // a bot Herbalist on the new kit presses B in the link its last skill opened when the fusion helps the group: Bark Poultice
  // on the one the poultice reached (or the most hurt), Field Hospital and Full Dressing when two are hurt, Willowbark Steam
  // when two are, Lantern Haze when someone in the smoke carries a harmful effect or a machine stands in it, Bitterroot when
  // anyone is hurt, the rest on the machine; companions 85%, volunteers 80%, the rest 60% of the time (one roll a link)
  botHerbFuse(b, team, tgt, tal) {
    const L = b.link, lt = L.tgt ? this.players.get(L.tgt) : null;
    const frac = (q) => q.hp / q.maxHp, hurt = (r) => team.filter((q) => frac(q) < r).sort((x, y) => frac(x) - frac(y));
    for (const f of Object.values(b.effFuse)) {
      if (f.from !== L.from || f.from === 'dodge' || f.fx.some((e) => e[0] === 'dash' || e[0] === 'leap' || e[0] === 'back')) continue;
      const B = b.eff?.[f.to];
      if (!B || B.lvl > b.level || (b.cds[B.id] || 0) > this.time || b.res < skillCost(B, tal) + (f.extra || 0)) continue;
      if (this.fusionOf(b, B, { target: tgt?.id }) !== f) continue;
      const has = (k) => f.fx.some((e) => e[0] === k);
      let want = null;
      if (f.target === 'ally' && f.hit.kind === 'proj') { const q = lt && team.includes(lt) && frac(lt) < 0.92 ? lt : hurt(0.85)[0]; if (q) want = { skill: B.id, target: q.id }; }
      else if (f.hit.kind === 'self' && (f.hit.r || 0) >= 8 && !has('healHurt')) { if (hurt(0.75).length >= 2 || hurt(0.45).length) want = { skill: B.id }; }
      else if (f.target === 'ally' && has('hzone')) { const H = hurt(0.85); if (H.length >= 2) want = { skill: B.id, target: H[0].id }; }
      else if (has('hazeSmoke')) { const z = this.herbZoneFor(b, b); if (z && (team.some((q) => Math.hypot(q.x - z.x, q.z - z.z) <= z.r && q.buffs.some((x) => x.debuff)) || [...this.mobs.values()].some((m) => !m.dead && m.threat?.size && Math.hypot(m.x - z.x, m.z - z.z) <= z.r + this.rad(m)))) want = { skill: B.id }; }
      else if (f.target === 'enemy' && tgt && dist(b, tgt) <= (f.range || 4) + this.rad(tgt) + 0.4) { if (!has('healLowest') || hurt(0.9).length) want = { skill: B.id, target: tgt.id, gx: tgt.x, gz: tgt.z }; }
      if (!want) continue;
      if (b.fuseLink !== L.at) { b.fuseLink = L.at; b.fuseOk = rand() < (b.botRole === 'Volunteer' ? 0.8 : b.owner ? 0.85 : 0.6); } // (one roll a link)
      if (!b.fuseOk) continue;
      return want;
    }
    return null;
  }
  // delayed contacts (S9 Aftershock): each fires once at its time, from where the Warden stands then
  tickDelays(p) {
    const due = p.delays.filter((d) => d.t <= this.time + 1e-6);
    if (!due.length) return;
    p.delays = p.delays.filter((d) => d.t > this.time + 1e-6);
    for (const d of due) {
      const h = d.sk.hit || {}, t = d.c.target ? this.entity(d.c.target) : null;
      if (d.pop) this.broadcast({ k: 'cpop', id: p.id, ...d.pop }); // (S12 Chain Reaction: one of his puddles or clouds goes off)
      else this.broadcast({ k: 'aftershock', id: p.id, sk: d.sk.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2), r: h.r || 3, ...(t && h.at === 'target' ? { x: +t.x.toFixed(2), z: +t.z.toFixed(2) } : {}) });
      this.applySkill(p, d.sk, d.c);
    }
  }
  // Intercept's ally (S9): a party member within range that a machine is hitting (the most hurt first), else the most hurt
  interceptAlly(p, range) {
    const team = this.partyMembers(p).filter((q) => q !== p && !q.dead && dist(q, p) <= range + 1);
    if (!team.length) return null;
    const hit = team.filter((q) => [...this.mobs.values()].some((m) => !m.dead && m.target === q.id));
    return (hit.length ? hit : team).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  }
  // the column falls (Dust Whirl, S8): every small machine still inside is thrown up (a poise contact of the fusion with a
  // launch), the rest staggered by its poise; the client plays a ring where it stood
  columnFall(p, z, foes) {
    const rec = p.eff?.[z.sk] || FUSION_BY_ID[z.sk];
    if (!rec) return;
    this.broadcast({ k: 'column', id: p.id, dur: 0, fall: 1, x: +p.x.toFixed(2), z: +p.z.toFixed(2) });
    this._hc = { sk: rec, i: 0, opening: false, brk: 20, launch: z.lift, bash: false, air: 0, src: p, broke: new Set() };
    for (const m of foes) if (!m.dead && m.type === 'mob' && Math.hypot(m.x - p.x, m.z - p.z) <= z.r + 0.6 + this.rad(m)) this.damage(p, m, p.power * (1 + (p.tal?.dmg || 0)) * 0.3, rec.id);
    this._hc = null;
  }

  playerDamaged(p, src, amt, skill) {
    if (p.held) return; // its connection dropped and it waits for a reconnect: nothing lands on it (a swing in the air, a slam, a burn)
    // (S9) Intercept: the Warden takes this ally's next blows instead, at half strength
    if (p.icpt && p.icpt.n > 0 && p.icpt.until > this.time && src.type === 'mob' && skill !== 'dot') {
      const W = this.players.get(p.icpt.by);
      if (W && !W.dead && W !== p) { p.icpt.n--; if (!p.icpt.n) { p.icpt = null; p.buffs = p.buffs.filter((b) => b.name !== 'Intercepted'); } this.broadcast({ k: 'miss', src: src.id, tgt: p.id, text: 'Intercepted' }); this.playerDamaged(W, src, amt * 0.5, skill); return; }
      p.icpt = null;
    }
    // (S8) out of reach in a Thousand Cuts or a Whiteout; Desert Step's Shield Step Form blocks the next blow within 1 s
    if (p.untargT > this.time && skill !== 'dot') { this.broadcast({ k: 'miss', src: src.id, tgt: p.id, text: 'Dodge' }); return; }
    if (p.guardT > this.time && src.type === 'mob' && skill !== 'dot' && skill !== 'thorns') { p.guardT = 0; this.broadcast({ k: 'miss', src: src.id, tgt: p.id, text: 'Block' }); return; }
    // a dodge's evade (0.3 s): every hit misses; a machine's swing or telegraph caught in it is a perfect dodge (Opening, 2 s)
    if (p.evadeT > this.time) {
      this.broadcast({ k: 'miss', src: src.id, tgt: p.id, text: 'Dodge' });
      if (src.type === 'mob' && skill !== 'dot' && skill !== 'thorns' && p.openT !== p.dodgeAt) {
        p.openT = p.dodgeAt; // (once per dodge)
        const D = this.dodgeOf(p);
        this.addBuff(p, { name: 'Opening', stat: 'opening', pct: 0, t: D.opening, dur: D.opening, icon: 'evade' });
        this.broadcast({ k: 'pdodge', id: p.id, src: src.id });
      }
      return;
    }
    // Shield Step (Oathbound's dodge, S5): a blow from in front of the shield is blocked; the first one gives Opening, as a
    // perfect dodge does
    if (p.blockT > this.time && src.type === 'mob' && skill !== 'dot' && skill !== 'thorns') {
      const ax = src.x - p.x, az = src.z - p.z, al = Math.hypot(ax, az) || 1;
      if ((ax * Math.sin(p.ry) + az * Math.cos(p.ry)) / al >= Math.cos((this.dodgeOf(p).blockArc || 75) * Math.PI / 180)) {
        this.broadcast({ k: 'miss', src: src.id, tgt: p.id, text: 'Block' });
        if (p.openT !== p.dodgeAt) { p.openT = p.dodgeAt; const D = this.dodgeOf(p); this.addBuff(p, { name: 'Opening', stat: 'opening', pct: 0, t: D.opening, dur: D.opening, icon: 'evade' }); this.broadcast({ k: 'pdodge', id: p.id, src: src.id }); }
        // (S9) a blow blocked in the Warden's Brace: the link from it holds the blow (Breakwater throws it back), and Steam Plate
        if (p.link?.from === 'dodge' && p.link.at >= p.dodgeAt - 1e-6) { const blow = Math.min(p.maxHp * 0.5, amt * (1 - (p.armorPct || 0))); p.link.blocked = Math.max(p.link.blocked || 0, blow); p.link.until = Math.max(p.link.until, this.time + LINK.win + (p.tal?.linkWin || 0)); p.link.tgt = src.id; }
        if (p.tal?.hooks?.length || p.tal?.keys?.length) runKeys(this, p, 'onBlock', { src, amt });
        p.combatT = this.time;
        return;
      }
    }
    // a parry (Guard's first 0.25 s): the blow is turned aside, the machine staggers, Valor back, and the link from Guard
    // is marked parried (the gate of Turning Riposte), with the blocked damage for its counter
    if (p.parryT > this.time && src.type === 'mob' && skill !== 'dot' && skill !== 'thorns') {
      this.broadcast({ k: 'miss', src: src.id, tgt: p.id, text: 'Parry' });
      p.res = Math.min(p.maxRes, p.res + PARRY.res);
      if (!src.dead && !src.def.boss && !src.def.dummy) { this.addBuff(src, { name: 'Staggered', cc: 'stun', stat: 'vuln', pct: POISE.staggerVuln, t: PARRY.stagger, dur: PARRY.stagger, debuff: true, icon: 'stun' }); src.pending = null; const d = Math.hypot(src.x - p.x, src.z - p.z) || 1; this.broadcast({ k: 'stag', id: src.id, dur: PARRY.stagger, dir: [+((src.x - p.x) / d).toFixed(2), +((src.z - p.z) / d).toFixed(2)] }); }
      const L0 = p.link && p.link.from === p.parryFrom ? p.link : { from: p.parryFrom, at: this.time, until: 0, landed: false, done: true, step: 0 };
      // blocked: the largest single blow, as it would have landed through armour, at most half the hero's health (adversarial
      // review: five machines' raw blows summed made Turning Riposte hit everything for 13x a Stormfall)
      const blow = Math.min(p.maxHp * 0.5, amt * (1 - (p.armorPct || 0)));
      p.link = { ...L0, parried: true, blocked: Math.max(L0.blocked || 0, blow), until: Math.max(L0.until || 0, this.time + LINK.win), tgt: src.id };
      if (p.tal?.parryLinksAll) p.link.open = { to: '*', until: this.time + LINK.win + (p.tal.linkWin || 0), mul: 0.25 }; // (Oathbound: a parry opens links to every core skill, S5)
      // Counter Stance (S8): the first blow turned is answered at once with a cut, and the stance ends (one answer a stance)
      if (p.parryCounter && !src.dead) {
        const rec = p.eff?.[p.parryCut] || null, coef = p.parryCounter;
        p.parryCounter = 0; p.parryT = 0;
        this.broadcast({ k: 'counter', id: p.id, tgt: src.id });
        if (rec) { this._hc = { sk: rec, i: 0, opening: false, brk: 20, launch: 0, bash: false, air: 0, src: p, broke: new Set() }; this.damage(p, src, p.power * (1 + (p.tal?.dmg || 0)) * coef * R(0.9, 1.1), rec.id); this._hc = null; }
      }
      p.combatT = this.time;
      this.pushSelf(p);
      return;
    }
    let a = amt * (1 - p.armorPct) * (1 - this.buffVal(p, 'armor')) * (src?.buffs ? 1 - Math.min(0.6, this.buffVal(src, 'weak')) : 1); // (S13: Bitter and the herb smoke, the machine strikes softer)
    if (rand() < this.buffVal(p, 'evade') || rand() < this.buffVal(p, 'block') * 0.9 || rand() < (p.tal?.dodge || 0)) { this.broadcast({ k: 'miss', src: src.id, tgt: p.id, text: 'Dodge' }); return; }
    if (rand() < this.buffVal(src, 'miss')) { this.broadcast({ k: 'miss', src: src.id, tgt: p.id, text: 'Miss' }); return; }
    a = Math.max(1, Math.round(a));
    if (p.absorb > 0) { const s = Math.min(p.absorb, a); p.absorb -= s; a -= s; if (a <= 0) { this.broadcast({ k: 'miss', src: src.id, tgt: p.id, text: 'Absorb' }); return; } }
    if (p.tal?.keys && p.tal.hooks.length + p.tal.keys.length) a = Math.max(1, Math.round(runKeys(this, p, 'onTaken', { src, amt: a }).amt)); // (Second Breath)
    // (S13) Field Hospital: the first ally who would fall in it stays up at 30% (once a hospital)
    if (a >= p.hp && p.buffs.length) { const fh = p.buffs.find((b) => b.hosp?.save > 0 && b.t > 0); if (fh) { fh.hosp.save = 0; a = Math.max(0, p.hp - Math.max(1, Math.round(p.maxHp * 0.3))); if (p.hp < p.maxHp * 0.3) p.hp = Math.round(p.maxHp * 0.3); this.broadcast({ k: 'hsave', id: p.id }); } }
    p.hp -= a;
    p.combatT = this.time;
    p.eating = 0;
    this.dismount(p, 'You are knocked off your runabout!');
    if (p.salv) this.endSalvage(p, false);
    this.broadcast({ k: 'dmg', src: src.id, tgt: p.id, amt: a });
    if (p.hp <= 0 && p.duel && p.duel.with === src.id) { p.hp = 1; this.endDuel(src, p); this.pushSelf(p); return; }
    if (p.tal?.thorns && src.type === 'mob' && !src.dead) this.damage(p, src, a * p.tal.thorns, 'thorns');
    if (p.hp <= 0 && p.tal?.lastStand && (!p.lsT || this.time >= p.lsT)) {
      p.lsT = this.time + 120; p.hp = Math.round(p.maxHp * 0.3);
      this.broadcast({ k: 'heal', src: p.id, tgt: p.id, amt: p.hp });
      p.session.send({ t: 'ev', list: [{ k: 'yell', text: 'You refuse to fall!' }, { k: 'msg', text: 'Last stand: you cling on at 30% health (ready again in 2 minutes).', color: '#ffd060' }] });
      this.pushSelf(p);
    }
    if (p.hp <= 0) {
      p.hp = 0; p.dead = true; p.cast = null; p.mounted = false;
      p.link = null; p.qcast = null; p.qdodge = null; p.chain = null; p.parryT = 0; // (a fallen hero keeps no link, held press or parry into the revive)
      this.broadcast({ k: 'die', id: p.id });
      p.deathCounted = false; // "Back on Your Feet" waits until you actually get up
      if (!p.bot && !p.trial && !p.duel) this.wearGear(p);
      for (const m of this.mobs.values()) { m.threat.delete(p.id); if (m.target === p.id) m.target = null; }
      this.pushSelf(p);
    }
  }

  worldBossNotice(m) {
    for (const p of this.players.values()) if (!p.bot) p.session.send({ t: 'ev', list: [{ k: 'wake', kind: m.kind, x: +m.x.toFixed(1), z: +m.z.toFixed(1) }, { k: 'yell', text: `${m.def.name} ${m.def.yell || 'appears!'}` }, { k: 'msg', text: `${m.def.name} (level ${m.level} world boss) ${m.def.notice || 'roams the valley'}. Gather your party!`, color: '#ff9a40' }] });
  }

  // ------------------------------------------------------------------ world events
  tickEvents() {
    for (const ev of this.wev) {
      const E = ev.def;
      if (!ev.live) {
        if (this.time < ev.next) continue;
        const near = [...this.players.values()].filter((p) => !p.bot && !p.dead && Math.hypot(p.x - E.target[0], p.z - E.target[1]) < E.radius);
        if (!near.length) { ev.next = this.time + 60; continue; }
        ev.live = { t0: this.time, mobs: [], fought: new Set() };
        for (const [mob, n, lvl] of E.mobs) for (let i = 0; i < n; i++) {
          const m = this.spawnMob({ mob, path: E.path, r: 2, n: 1, lvl, temp: true, charge: true, event: E.id });
          const [sx, sz] = E.path[0]; m.x = sx + R(-5, 5); m.z = sz + R(-5, 5); m.pi = 1; m.pdir = 1;
          ev.live.mobs.push(m.id);
        }
        this.eventNotice(E, E.start, '#ff9a40', true);
        continue;
      }
      const alive = ev.live.mobs.map((id) => this.mobs.get(id)).filter((m) => m && !m.dead);
      const timeUp = this.time - ev.live.t0 > 300;
      if (alive.length && !timeUp) continue;
      if (!alive.length) {
        this.eventNotice(E, E.win, '#7aff7a', true);
        for (const pid of ev.live.fought) { const p = this.players.get(pid); if (!p) continue; p.gold += E.gold * 10; this.achAdd(p, 'gold', E.gold * 10); this.achAdd(p, 'events'); this.addRep(p, factionOfZone(zoneAt(E.target[0], E.target[1]).id), 250); this.msg(p, `${E.name} defended: +${E.gold * 10} copper.`, '#ffe08a'); this.giveXp(p, eventXp(E, p.level)); this.pushSelf(p); }
      } else {
        this.eventNotice(E, E.lose, '#c8c8c8', false);
        for (const m of alive) { m.dead = true; m.respawnT = 0; m.loot = null; }
      }
      ev.live = null;
      ev.next = this.time + R(E.every[0], E.every[1]);
    }
  }
  eventNotice(E, text, color, banner) {
    for (const p of this.players.values()) {
      if (Math.hypot(p.x - E.target[0], p.z - E.target[1]) > E.radius) continue;
      p.session.send({ t: 'ev', list: [banner ? { k: 'yell', text } : { k: 'msg', text, color }] });
    }
  }

  tickMob(m, dt) {
    if (m.dead) {
      if (m.sp.temp) { if (this.time > m.respawnT + 60 || m.respawnT === 0) { this.mobs.delete(m.id); this.mobGridDrop(m); } return; }
      if (this.time > m.respawnT) { this.spawnMob(m.sp, m); this.broadcast({ k: 'spawn', id: m.id }); if (m.def.world) this.worldBossNotice(m); }
      return;
    }
    this.tickBuffs(m, dt);
    if (m.dead) return;
    const def = m.def;
    if (m.poiseMax && m.poise < m.poiseMax && this.time - m.poiseT > POISE.refill && !(m.brokenT > this.time)) m.poise = m.poiseMax; // (poise refills after 3 s untouched)
    if (def.inert) { m.speed = 0; m.state = 'idle'; m.target = null; return; } // (an event target that never fights: the Weald's fallen standards)
    if (def.dummy) { m.speed = 0; m.state = 'idle'; m.target = null; if (this.time - (m.hitT ?? -99) > 8 && (m.hp < m.maxHp || m.threat.size)) { m.hp = m.maxHp; m.threat.clear(); m.buffs = []; } return; }
    const inDungeon = m.x >= DUNGEON_MIN_X;
    if ((def.raid || (def.boss && m.sp?.dungeon)) && !m.threat.size && m.hp >= m.maxHp) this.raidScale(m);
    if (def.rare && m.state === 'wander') m.stateT = Math.max(m.stateT, 3); // rares keep moving
    const stunned = this.hasCC(m, 'stun');
    const rooted = this.hasCC(m, 'root');
    const slow = 1 - this.buffVal(m, 'slow');
    m.speed = 0;
    // choose target by threat
    let target = null, best = -1;
    for (const [id, v] of m.threat) { const p = this.players.get(id); if (!p || p.dead || p.held) { m.threat.delete(id); continue; } if (v > best) { best = v; target = p; } }
    if (!target && !def.passive && (m.state === 'idle' || m.state === 'wander')) { // passive foes fight only when struck
      for (const p of this.players.values()) {
        if (p.dead || p.escort || p.held) continue; // escorts are only attacked by their ambushers; a held character (connection dropped) is left alone
        // open-world foes at or below the player's level + 2 never pick a fight on sight: they only answer an attack.
        // Dungeon/raid foes and world-event attackers keep their watch.
        if (!inDungeon && !m.sp.event && m.level <= p.level + 2) continue;
        if (p.graceT && this.time < p.graceT) continue; // a few seconds of peace after waking at a graveyard
        const aggro = def.aggro - clamp((p.level - m.level) * 1.5, -4, 6);
        if (dist2(m, p) < aggro * aggro) { this.addThreat(m, p, 1); target = p; break; }
      }
    }
    if (m.damp && !target) { // the Drying Lofts: everyone fighting the boss is down (or gone): the louvres jam again and the stain goes
      const D = DUNGEON_BY_ID[m.sp?.dungeon], A = D && loftAt(D, m.x - D.ox, m.z - D.oz);
      if (m.damp.lv && A) this.broadcast({ k: 'damp', d: D.id, a: D.lofts.indexOf(A), lv: 0 });
      m.damp = null;
    }
    if (stunned) { // (a stunned boss still keeps its loft's paired lever: the hold at the handles and the bots on them go on)
      const dab = target && m.damp && def.abilities?.find((a) => a.kind === 'damp');
      if (dab) this.loftDamp(m, dab, DUNGEON_BY_ID[m.sp.dungeon], dt);
      return;
    }
    if (target) {
      m.state = 'chase';
      m.target = target.id;
      const d = dist(m, target);
      const leash = Math.hypot(m.x - m.home.x, m.z - m.home.z);
      if (leash > (def.boss ? 45 : 40)) { m.state = 'leash'; m.threat.clear(); m.target = null; return; }
      m.ry = Math.atan2(target.x - m.x, target.z - m.z);
      if (def.abilities) this.bossAbilities(m, dt);
      const reach = def.range + def.radius;
      // held against a house wall by a target it cannot reach (no paths round houses): after 4 s with no ground gained it
      // gives up and goes home healing, so a house is never a safe spot to shoot from
      // a wall between them also blocks every swing and shot (ranged foes never shoot through a house wall)
      const walled = !inDungeon && houseCrosses(m.x, m.z, target.x, target.z);
      if (walled) {
        if (d < (m.wallD ?? Infinity) - 0.3) { m.wallD = d; m.wallT = 0; }
        else if ((m.wallT = (m.wallT || 0) + dt) > 4) { m.wallD = Infinity; m.wallT = 0; m.state = 'leash'; m.threat.clear(); m.target = null; return; }
      } else { m.wallD = Infinity; m.wallT = 0; }
      if ((d > reach * 0.92 || walled) && !rooted) {
        const sp = def.speed * slow * (this.tmod(m, 'overclocked') ? 1.15 : 1);
        const step = Math.max(0, Math.min(sp * dt, d - (walled ? 0.5 : reach * 0.85)));
        m.x += ((target.x - m.x) / d) * step; m.z += ((target.z - m.z) / d) * step;
        m.speed = sp;
      } else if (d <= reach + 0.6 && !walled) {
        m.swingT -= dt;
        if (m.swingT <= 0) {
          m.swingT = def.swing * (m.enraged ? 0.7 : 1) * (this.tmod(m, 'overclocked') ? 0.88 : 1);
          const hitDelay = def.ranged ? 0.5 + d / 30 : 0.35;
          this.broadcast({ k: 'mobAtk', id: m.id, tgt: target.id, ranged: def.ranged || null, special: def.boss && rand() < 0.3 ? 'slam' : null });
          // a dungeon or raid boss swings BOSS_SWING harder at its target (on the ability curve), so its tank needs a healer
          const dmg = R(def.dmg[0], def.dmg[1]) * (1 + 0.18 * (m.level - 1)) * mobSwingMul(def, m.level, m.sp, inDungeon) * (def.boss && inDungeon ? groupDmg(m) : 1) * (this.tmod(m, 'heavy') ? 1.15 : 1) * (m.rh ? 1.25 : 1);
          const special = def.boss && rand() < 0.3;
          // a dungeon or raid boss slam lands in full on its target only; everyone else nearby takes one plain hit (v120: fights are
          // long enough now that full slams on every melee fighter wiped volunteer parties)
          m.pending = { t: this.time + hitDelay, tgt: target.id, dmg: special ? dmg * 1.8 : dmg, aoe: special ? 6 : 0, splash: special && def.boss && inDungeon ? dmg / BOSS_SWING : 0 };
          // (S9) a bot Warden on the new kit sees the swing and braces for it: a boss's slam most of the time, other swings less
          if (target.bot && target.type === 'player' && dodgeFor(target.cls).brace && !target.botBrace && rand() < (special ? BOT_BRACE.slam : def.boss ? BOT_BRACE.boss : BOT_BRACE.other)) target.botBrace = { at: m.pending.t - 0.2, src: m.id };
          // (S15) a bot Knight raises Guard for it (its parry opens every skill with Oathbound, Turning Riposte with Riposte Drill)
          else if (target.bot && target.type === 'player' && target.cls === 'knight' && !target.botGuard && target.level >= 14 && !((target.cds.k_guard || 0) > this.time) && target.res >= 10 && rand() < (special ? BOT_BRACE.slam : def.boss ? BOT_BRACE.boss : BOT_BRACE.other)) target.botGuard = { at: m.pending.t - 0.4, src: m.id };
        }
      } else m.swingT = Math.min(m.swingT, 0.6);
    } else if (m.state === 'leash') {
      const d = Math.hypot(m.home.x - m.x, m.home.z - m.z);
      m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.5 * dt);
      // a house between the mob and its home holds it against a wall (no paths round them): after 25 s it is put home
      m.leashT = (m.leashT || 0) + dt;
      if (d >= 1 && m.leashT > 25) { m.x = m.home.x; m.z = m.home.z; m.leashT = 0; m.state = 'idle'; }
      else if (d < 1) { m.state = 'idle'; m.leashT = 0; }
      else { const sp = def.speed * 1.5; m.x += ((m.home.x - m.x) / d) * Math.min(d, sp * dt); m.z += ((m.home.z - m.z) / d) * Math.min(d, sp * dt); m.ry = Math.atan2(m.home.x - m.x, m.home.z - m.z); m.speed = sp; }
    } else if (m.sp.ram && this.ramMob(m, dt)) {
      // the Ram Engine's machines: a Yard Mender with nobody to fight batters the engine; the Wall-Layer stands in its pit
    } else if (m.sp.path) {
      // patrol: walk the road from end to end and back. A spawn with a floodPath walks that one instead while the tide is
      // in at Tidewater Sound (the Great Dredge: across the mud flats at ebb, along their outer edge at flood); a spawn with a rainPath walks that one while it pours in the Rainward Gorge (the Hill Leveller:
      // along the head of the Slip when it is dry, down its own mud lane in the rain)
      // a spawn with a galePath walks that one while the Russet Weald's gale blows (the Great Forwarder: up the south ride to
      // the fall line across it, shared/rides.js)
      const P = m.sp.galePath && galeState(this.time).blowing ? m.sp.galePath : m.sp.rainPath && rainState(this.time).pouring ? m.sp.rainPath : m.sp.floodPath && !tideState(this.time).ebb ? m.sp.floodPath : m.sp.path;
      if (m.pset !== P) { m.pset = P; m.pi = null; }
      if (m.pi == null) { let bi = 0, bd = 1e9; P.forEach(([px, pz], i) => { const d = Math.hypot(px - m.x, pz - m.z); if (d < bd) { bd = d; bi = i; } }); m.pi = bi; m.pdir = rand() < 0.5 ? 1 : -1; }
      const [wx, wz] = P[m.pi], d = Math.hypot(wx - m.x, wz - m.z);
      if (d < 1.2) { m.pi += m.pdir; if (m.pi >= P.length || m.pi < 0) { if (m.sp.charge) { m.sp = { ...m.sp, path: null, x: wx, z: wz, r: 10 }; m.home = { x: wx, z: wz }; m.state = 'idle'; return; } m.pdir = -m.pdir; m.pi += 2 * m.pdir; } }
      else { const sp = def.speed * (m.sp.charge ? 0.8 : 0.42); m.x += ((wx - m.x) / d) * sp * dt; m.z += ((wz - m.z) / d) * sp * dt; m.ry = Math.atan2(wx - m.x, wz - m.z); m.speed = sp; }
      m.home = { x: m.x, z: m.z };
      if (m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.1 * dt);
    } else {
      // idle wander around home
      m.stateT -= dt;
      if (m.state === 'idle' && m.stateT <= 0) { m.state = 'wander'; const a = R(0, 6.28), r2 = R(2, m.sp.r * (inDungeon ? 0.4 : 0.6) + (inDungeon ? 1 : 3)); m.wx = m.home.x + Math.cos(a) * r2; m.wz = m.home.z + Math.sin(a) * r2; m.stateT = 6; }
      if (m.state === 'wander') {
        const d = Math.hypot(m.wx - m.x, m.wz - m.z);
        if (d < 0.5 || m.stateT <= 0) { m.state = 'idle'; m.stateT = R(3, 9); }
        else { const sp = def.speed * 0.35; m.x += ((m.wx - m.x) / d) * sp * dt; m.z += ((m.wz - m.z) / d) * sp * dt; m.ry = Math.atan2(m.wx - m.x, m.wz - m.z); m.speed = sp; }
      }
      if (m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.1 * dt);
    }
    // separation from other mobs (a fixed engine, speed 0 like the Great Governor, is never shoved about by its own adds:
    // they step round it instead)
    // (server perf: only the mobs in the grid cells around it, docs/ai/server_perf.md; the whole list when there is no grid)
    const G = this._mg;
    if (def.speed !== 0 && G) {
      const k = Math.ceil((def.radius + G.maxR) / MOB_CELL), cx = Math.floor(m.x / MOB_CELL), cz = Math.floor(m.z / MOB_CELL);
      for (let i = cx - k; i <= cx + k; i++) for (let j = cz - k; j <= cz + k; j++) {
        const a = G.cells.get((i + 2048) * 4096 + (j + 2048));
        if (a) for (let n = 0; n < a.length; n++) {
          const o = a[n];
          if (o === m || o.dead) continue;
          const dx = m.x - o.x, dz = m.z - o.z, d2 = dx * dx + dz * dz, rr = def.radius + o.def.radius;
          if (d2 < rr * rr && d2 > 1e-4) { const d = Math.sqrt(d2), push = (rr - d) * 0.5; m.x += (dx / d) * push; m.z += (dz / d) * push; }
        }
      }
    } else if (def.speed !== 0) for (const o of this.mobs.values()) {
      if (o === m || o.dead) continue;
      const dx = m.x - o.x, dz = m.z - o.z, d2 = dx * dx + dz * dz, rr = def.radius + o.def.radius;
      if (d2 < rr * rr && d2 > 1e-4) { const d = Math.sqrt(d2), push = (rr - d) * 0.5; m.x += (dx / d) * push; m.z += (dz / d) * push; }
    }
    if (inDungeon) [m.x, m.z] = dungeonPush(m.x, m.z, Math.min(1.2, def.radius));
    else [m.x, m.z] = housePush(m.x, m.z, Math.min(1.2, def.radius));
    if (m.x !== m._hx || m.z !== m._hz) { m._hx = m.x; m._hz = m.z; m._hy = walkHeight(m.x, m.z); } // (the ground under a mob that stood still is the same)
    m.y = m._hy;
    if (G) this.mobGridMove(m);
    if (m.pending && this.time >= m.pending.t) {
      const pd = m.pending; m.pending = null;
      if (pd.aoe) { for (const p of this.players.values()) if (!p.dead && dist(p, m) < pd.aoe && (inDungeon || !houseCrosses(m.x, m.z, p.x, p.z))) this.playerDamaged(p, m, pd.splash && p.id !== pd.tgt ? pd.splash : pd.dmg); this.broadcast({ k: 'slam', id: m.id, r: pd.aoe }); }
      else { const p = this.players.get(pd.tgt); if (p && !p.dead && dist(p, m) < def.range + def.radius + 3 && (inDungeon || !houseCrosses(m.x, m.z, p.x, p.z))) this.playerDamaged(p, m, pd.dmg); }
    }
  }

  // a raid boss (and, from v120, a five-player dungeon boss) is made for a full company (5): a smaller group meets a smaller boss. Players count 1, companions and other
  // bots 0.3 (0.6 before v120); the share runs from 35% (one player alone) to 100%. It only changes while the boss stands idle at full health.
  // the Drying Lofts' paired louvre lever (P15.4): bots in a party (volunteers, companions, the valley's bots) cannot read the
  // damp, so the fight tells them. Someone at one handle: a bot goes to the other. Nobody at either once the damp is in:
  // two bots go, one to each. Damage dealers first, then the healer; never the one the boss is on. Each order lasts a
  // second and is renewed while it is needed (botFollow walks a bot with b.lever there and it keeps fighting from it).
  // the paired lever, every tick of a fight (bossAbilities, and also while the boss is stunned: a stun must not freeze the
  // hold at the handles or send the bots off them). A held character (connection dropped) is nobody at a handle.
  loftDamp(m, ab, D, dt) {
    const A = loftAt(D, m.x - D.ox, m.z - D.oz);
    if (!A) return;
    if (m.hp >= m.maxHp && m.damp && (m.damp.lv || m.damp.clr > -1e9)) { // a fresh pull: the louvres jam again
      if (m.damp.lv) this.broadcast({ k: 'damp', d: D.id, a: D.lofts.indexOf(A), lv: 0 });
      m.damp = null;
    }
    const st = (m.damp ||= { lv: 0, hold: 0, clr: -1e9 });
    const L = A.levers.map(([lx, lz]) => ({ x: D.ox + lx, z: D.oz + lz }));
    const at = L.map((l) => [...this.players.values()].filter((p) => !p.dead && !p.away && !p.held && Math.hypot(p.x - l.x, p.z - l.z) < 1.7));
    const pair = at[0].length > 0 && at[1].length > 0 && at[0].some((p) => at[1].some((q) => q !== p));
    st.hold = pair && st.lv > 0 ? st.hold + dt : 0;
    if (st.hold >= (ab.hold || 2)) {
      st.hold = 0; st.lv = 0; st.clr = this.time;
      this.broadcast({ k: 'damp', d: D.id, a: D.lofts.indexOf(A), lv: 0, open: 1 });
      this.broadcast({ k: 'yell', id: m.id, text: ab.cleared || 'The paired lever comes over, the louvres swing open along the loft, and the damp air goes out through them!' });
    }
    if (st.lv > 0) this.loftLevers(D, A, m, st, L);
  }
  loftLevers(D, A, m, st, L) {
    const near = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
    const here = [...this.players.values()].filter((p) => !p.dead && !p.away && !p.held && p.x >= DUNGEON_MIN_X && dungeonAt(p.x, p.z) === D && near(p, m) < 60);
    const manned = L.map((l) => here.some((p) => !p.bot && near(p, l) < 3));
    const want = manned[0] && manned[1] ? [] : manned[0] ? [1] : manned[1] ? [0] : st.lv >= 1 ? [0, 1] : [];
    if (!want.length) return;
    const rank = (b) => (b.cls === 'herbalist' ? 2 : TANK_CLS.has(b.cls) ? 3 : 1);
    const free = here.filter((b) => b.bot && !b.escort && !b.wander && (b.lfg || b.owner || b.ai?.party) && b.id !== m.target && rank(b) < 3);
    const used = new Set();
    for (const li of want) {
      const l = L[li];
      let b = free.find((q) => !used.has(q) && q.lever && Math.abs(q.lever.x - l.x) < 0.01 && Math.abs(q.lever.z - l.z) < 0.01);
      if (!b) b = free.filter((q) => !used.has(q) && !(q.lever && this.time < q.lever.until)).sort((p, q) => rank(p) - rank(q) || near(p, l) - near(q, l))[0];
      if (!b) continue;
      used.add(b); b.lever = { x: l.x, z: l.z, until: this.time + 1 };
    }
  }
  raidFighters(D) {
    let n = 0;
    for (const q of this.players.values()) if (!q.dead && q.x >= DUNGEON_MIN_X && dungeonAt(q.x, q.z) === D) n += q.bot ? 0.3 : 1; // v120: a bot counts 0.3 (a volunteer deals about a quarter of a geared hero's damage, and bosses are long fights now)
    return n;
  }
  raidScale(m) {
    const D = DUNGEON_BY_ID[m.sp.dungeon];
    if (!D) return;
    m.baseHp = m.baseHp || m.maxHp;
    // 0.35 alone up to 1.0 at five fighters (as tuned), then +0.18 for each fighter past five, up to 1.9 with a full ten
    // (a five-player dungeon boss stops at 1.0)
    const nf = this.raidFighters(D);
    const k = nf <= 5 || !m.def.raid ? clamp(0.35 + 0.1625 * Math.max(0, nf - 1), 0.35, 1) : Math.min(1.9, 1 + 0.18 * (nf - 5));
    const hp = Math.round(m.baseHp * k);
    if (hp !== m.maxHp) { m.maxHp = m.hp = hp; m.raidK = k; }
  }

  // boss mechanics: telegraphed ground circles under the players, a shockwave ring round the boss, enrage at low health
  bossAbilities(m, dt) {
    const def = m.def;
    const list = [...def.abilities, ...(m.tempest && def.boss ? [TEMPEST.surge] : []), ...(this.tmod(m, 'static') ? [TEMPEST.static] : [])];
    if (!m.abT || m.abT.length !== list.length) m.abT = list.map((ab) => (ab.every || 0) * R(0.45, 0.75));
    // a dungeon with its own short tide (the Mill Races): abilities with tide 'flood' / 'ebb' wait for their half of it
    const TD0 = m.sp?.dungeon ? DUNGEON_BY_ID[m.sp.dungeon] : null, TD = TD0 ? dungeonTide(TD0, this.time) : null;
    const abDmg = (ab) => R(def.dmg[0], def.dmg[1]) * (1 + 0.18 * (m.level - 1)) * mobAbilityMul(m.level) * groupDmg(m) * ab.dmg * (m.enraged ? 1.15 : 1) * (this.tmod(m, 'heavy') ? 1.15 : 1) * (m.rh ? 1.25 : 1);
    list.forEach((ab, i) => {
      const hpf = m.hp / m.maxHp;
      if ((ab.below != null && hpf > ab.below) || (ab.above != null && hpf <= ab.above)) return; // not this phase
      if (ab.kind === 'tide') { // only a call as the tide turns in the pits
        if (TD && m.tideWas !== TD.flood) { m.tideWas = TD.flood; const t = TD.flood ? ab.flood : ab.ebb; if (t) this.broadcast({ k: 'yell', id: m.id, text: t }); }
        return;
      }
      if (ab.tide && (!TD || TD.flood !== (ab.tide === 'flood'))) return; // not this tide
      if (ab.kind === 'lanes') { // the dungeon's mud slips (the Drain Adits): each marked lane near the mob bursts once a slip
        const SL = TD0 ? dungeonSlip(TD0, this.time) : null; // (any mob fighting near it calls it; a lane is told once per burst)
        if (!SL || !SL.warn) return;
        const done = (this.slipDone ||= {}), spots = [];
        (TD0.lanes || []).forEach(([x0, z0, x1, z1], li) => {
          const key = TD0.id + ':' + li, X0 = TD0.ox + x0, X1 = TD0.ox + x1, Z0 = TD0.oz + z0, Z1 = TD0.oz + z1;
          if (done[key] === SL.n || Math.hypot(m.x - clamp(m.x, X0, X1), m.z - clamp(m.z, Z0, Z1)) > (ab.reach || 34)) return;
          done[key] = SL.n;
          const r = Math.max(X1 - X0, 0.5) / 2 + 0.3, cxl = (X0 + X1) / 2;
          for (let z = Z0 + r * 0.7; z <= Z1 - r * 0.5 + 0.01; z += r * 1.3) spots.push({ x: +cxl.toFixed(2), z: +z.toFixed(2), r: +r.toFixed(2) });
        });
        if (!spots.length) return;
        // (the mud comes from the hill, not the machine: the burst lands on the clock even if its caller falls or is gone,
        // since the lanes are already told for this slip and nothing else will call them again)
        this.aoes.push({ t: this.time + SL.toBurst, spots, dmg: abDmg(ab), src: m.id, kind: 'lanes', caller: m });
        this.broadcast({ k: 'tele', id: m.id, kind: 'lanes', spots, t: SL.toBurst, name: 'Mud slip' });
        if (ab.text) this.broadcast({ k: 'yell', id: m.id, text: ab.text });
        return;
      }
      if (ab.kind === 'cranes') { // the gantry cranes (the Drying Lofts): each gantry's load near the mob comes down on its marked
        const CR = TD0 ? dungeonCrane(TD0, this.time) : null; // bay on the crane clock (any mob fighting near it calls it, once a drop)
        if (!CR || !CR.warn) return;
        const done = (this.craneDone ||= {}), spots = [], own = TD0.lofts.indexOf(loftAt(TD0, m.x - TD0.ox, m.z - TD0.oz));
        for (const L of craneDrops(TD0, CR.n)) {
          if (own >= 0 && L.a !== own) continue; // (a machine in a loft calls that loft's gantries only, all of them)
          const key = TD0.id + ':' + L.a + ':' + L.g, x = TD0.ox + L.x, z = TD0.oz + L.z;
          if (done[key] === CR.n || Math.hypot(m.x - x, m.z - z) > (own >= 0 ? ab.reach || 60 : ab.reach || 34)) continue;
          done[key] = CR.n; spots.push({ x: +x.toFixed(2), z: +z.toFixed(2), r: L.r });
        }
        if (!spots.length) return;
        // (the load is on the hook: it comes down on the clock even if the machine that called it falls first)
        this.aoes.push({ t: this.time + CR.toDrop, spots, dmg: abDmg(ab), src: m.id, kind: 'cranes', caller: m });
        this.broadcast({ k: 'tele', id: m.id, kind: 'cranes', spots, t: CR.toDrop, name: 'Gantry load' });
        if (ab.text) this.broadcast({ k: 'yell', id: m.id, text: ab.text });
        return;
      }
      if (ab.kind === 'damp') { // the damp in the boss's loft: two people at the paired louvre lever together throw the louvres open
        if (!TD0 || !loftAt(TD0, m.x - TD0.ox, m.z - TD0.oz)) return;
        this.loftDamp(m, ab, TD0, dt);
      }
      if (ab.kind === 'sumps') { // the choked sumps of the mob's chamber: stand on a grate long enough and it runs clear for a while
        if (m.hp >= m.maxHp) m.sumps = null; // a fresh pull: every sump choked again
        const ss = (m.sumps ||= {});
        (TD0?.sumps || []).forEach(([sx, sz], k) => {
          const x = TD0.ox + sx, z = TD0.oz + sz, st = (ss[k] ||= { lv: 0, hold: 0, clr: -1e9 });
          if (Math.hypot(x - m.x, z - m.z) > (ab.reach || 34) || this.time - st.clr < (ab.clear || 24)) return;
          const on = [...this.players.values()].some((p) => !p.dead && !p.bot && Math.hypot(p.x - x, p.z - z) < 1.6);
          st.hold = on ? st.hold + dt : 0;
          if (st.hold >= (ab.hold || 2)) { st.hold = 0; st.lv = 0; st.clr = this.time; this.broadcast({ k: 'yell', id: m.id, text: ab.cleared || 'The grate gives, and the backed-up mud drains away down the sump!' }); }
        });
      }

      if (ab.kind === 'phase') {
        m.phaseDone = m.phaseDone || {};
        if (!m.phaseDone[i]) { m.phaseDone[i] = true; this.broadcast({ k: 'yell', id: m.id, text: ab.text }); }
        return;
      }
      if (ab.kind === 'adds') {
        m.addsDone = m.addsDone || {};
        if (m.addsDone[i] || m.hp > m.maxHp * ab.at || !MOBS[ab.mob]) return;
        m.addsDone[i] = true;
        if (ab.text) this.broadcast({ k: 'yell', id: m.id, text: ab.text });
        const tgt = m.target ? this.players.get(m.target) : null;
        const nAdds = Math.round(ab.n * Math.max(1, m.raidK || 1)); // more adds for a raid group bigger than five
        for (let k = 0; k < nAdds; k++) {
          const a = (k / nAdds) * Math.PI * 2 + R(0, 1), d = def.radius + 2.5;
          let x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d;
          if (x >= DUNGEON_MIN_X) [x, z] = dungeonPush(x, z, 0.8);
          const add = this.spawnMob({ mob: ab.mob, x, z, r: 0.5, n: 1, lvl: [Math.max(1, m.level - 1), Math.max(1, m.level - 1)], temp: true });
          add.x = x; add.z = z; add.y = walkHeight(x, z); add.home = { x, z };
          if (tgt) { this.addThreat(add, tgt, 10); add.state = 'chase'; add.target = tgt.id; }
          this.broadcast({ k: 'spawn', id: add.id });
        }
        return;
      }
      if (ab.kind === 'enrage') {
        if (!m.enraged && m.hp < m.maxHp * ab.at) { m.enraged = true; this.broadcast({ k: 'yell', id: m.id, text: ab.text || `${def.name} becomes enraged!` }); }
        return;
      }
      m.abT[i] -= dt;
      if (m.abT[i] > 0) return;
      m.abT[i] = ab.every * (m.enraged ? 0.75 : 1) * (this.tmod(m, 'fuses') ? 0.8 : 1);
      const spots = [];
      if (ab.kind === 'beam') {
        // a straight run of strikes from the boss toward someone fighting it
        // (ab.n > 1: up to n runs toward different players, all in one telegraph)
        const near = [...this.players.values()].filter((p) => !p.dead && dist(p, m) < 30);
        let tgts;
        if ((ab.n || 1) <= 1) tgts = [near[RI(0, Math.max(0, near.length - 1))]].filter(Boolean);
        else { for (let k = near.length - 1; k > 0; k--) { const j = RI(0, k); [near[k], near[j]] = [near[j], near[k]]; } tgts = near.slice(0, ab.n); }
        if (!tgts.length) return;
        for (const t of tgts) {
          const dx = t.x - m.x, dz = t.z - m.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
          for (let s = def.radius + 1.5; s <= def.radius + ab.len; s += ab.r * 1.5) {
            let x = m.x + ux * s, z = m.z + uz * s;
            if (x >= DUNGEON_MIN_X) { const [px, pz] = dungeonPush(x, z, 0.5); if (Math.hypot(px - x, pz - z) > 0.3) break; }
            spots.push({ x: +x.toFixed(2), z: +z.toFixed(2), r: ab.r });
          }
        }
        if (!spots.length) return;
        m.ry = Math.atan2(tgts[0].x - m.x, tgts[0].z - m.z);
      } else if (ab.kind === 'sumps') {
        // every choked sump in reach backs up, a little wider each time (up to ab.max steps), until it is cleared
        (TD0?.sumps || []).forEach(([sx, sz, sr], k) => {
          const x = TD0.ox + sx, z = TD0.oz + sz, st = m.sumps?.[k];
          if (!st || Math.hypot(x - m.x, z - m.z) > (ab.reach || 34) || this.time - st.clr < (ab.clear || 24)) return;
          spots.push({ x, z, r: +(sr * (1 + 0.3 * st.lv)).toFixed(2) }); st.lv = Math.min(ab.max || 3, st.lv + 1);
        });
        if (!spots.length) return;
      } else if (ab.kind === 'damp') {
        // the damp spreads one more bay from the jammed louvres (up to ab.max), and every damp bay takes it at once
        const A = TD0 ? loftAt(TD0, m.x - TD0.ox, m.z - TD0.oz) : null, st = m.damp;
        if (!A || !st || this.time - st.clr < (ab.clear || 20)) return;
        const bays = loftBays(A);
        st.lv = Math.min(ab.max || bays.length, bays.length, st.lv + 1);
        for (const [x0, z0, x1, z1] of bays.slice(0, st.lv)) {
          const along = x1 - x0 < z1 - z0, w = along ? x1 - x0 : z1 - z0, Lg = along ? z1 - z0 : x1 - x0, r = w / 2 + 0.4;
          for (let s = r * 0.7; s <= Lg - r * 0.5 + 0.01; s += r * 1.3) spots.push(along ? { x: +(TD0.ox + (x0 + x1) / 2).toFixed(2), z: +(TD0.oz + z0 + s).toFixed(2), r: +r.toFixed(2) } : { x: +(TD0.ox + x0 + s).toFixed(2), z: +(TD0.oz + (z0 + z1) / 2).toFixed(2), r: +r.toFixed(2) });
        }
        this.broadcast({ k: 'damp', d: TD0.id, a: TD0.lofts.indexOf(A), lv: st.lv });
      } else if (ab.kind === 'nova') spots.push({ x: +m.x.toFixed(2), z: +m.z.toFixed(2), r: ab.r + def.radius * 0.5 });
      else if (ab.kind === 'pits') {
        // the flooded pits of the boss's chamber (the dungeon's pits within reach): stand out of the water
        for (const [px, pz, pr] of TD0?.pits || []) { const x = TD0.ox + px, z = TD0.oz + pz; if (Math.hypot(x - m.x, z - m.z) < (ab.reach || 30)) spots.push({ x, z, r: pr }); }
        if (!spots.length) return;
      } else {
        const near = [...this.players.values()].filter((p) => !p.dead && dist(p, m) < 30);
        for (const p of near.slice(0, ab.n)) spots.push({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), r: ab.r });
        while (spots.length < ab.n) {
          const a = R(0, 6.28), d = R(3, 11);
          let x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d;
          if (x >= DUNGEON_MIN_X) [x, z] = dungeonPush(x, z, 1);
          spots.push({ x: +x.toFixed(2), z: +z.toFixed(2), r: ab.r });
        }
      }
      const dmg = abDmg(ab);
      this.aoes.push({ t: this.time + ab.delay, spots, dmg, src: m.id, kind: ab.kind });
      this.broadcast({ k: 'tele', id: m.id, kind: ab.kind, spots, t: ab.delay, name: ab.label || { circles: 'Ground strikes', nova: 'Blast', beam: 'Beam', pits: 'Flooding pits', sumps: 'Backed-up sumps' }[ab.kind] || 'Attack' });
      if (ab.text) this.broadcast({ k: 'yell', id: m.id, text: ab.text });
      m.swingT = Math.max(m.swingT, Math.min(ab.delay, 1.2));
    });
  }

  sendSnapshots() {
    const gtags = new Map(); for (const h of this.players.values()) if (!h.bot && h.guild) for (const n of h.guild.bots || []) gtags.set(n, h.guild.name);
    const evs = this.events;
    this.events = [];
    for (const p of this.players.values()) {
      if (p.bot) continue;
      const list = [];
      for (const q of this.players.values()) {
        if (q.away || dist2(p, q) > VIEW * VIEW) continue; // (a living bot away on a crossing or a run is hidden: B.3)
        list.push({ id: q.id, ty: 'p', n: q.name, b: q.bot ? 1 : undefined, v: q.cv || undefined, ti: q.botRole ? '<' + q.botRole + '>' : q.title ? achTitle(q.title) : undefined, c: q.cls, l: q.level, x: +q.x.toFixed(2), y: +q.y.toFixed(2), z: +q.z.toFixed(2), r: +q.ry.toFixed(2), s: +q.speed.toFixed(1), a: q.air ? 1 : 0, h: q.hp / q.maxHp, d: q.dead ? 1 : 0, t: q.target, e: q.eating ? 1 : 0, mt: q.mounted ? 1 : undefined, si: q.sit ? 1 : undefined, mp: q.mounted && q.paint && q.paint !== 'brass' ? q.paint : undefined, mk: q.mounted && q.runaboutMk >= 2 ? q.runaboutMk : undefined, mc: q.crawler ? (mountKind(q) === 'crawler' ? 1 : 0) : undefined, g: (q.bot ? gtags.get(q.name) : q.guild?.name) || undefined, pt: q.pet || undefined, ...(() => { const L = wornLook(q); return { wt: L.wt || undefined, oh: L.oh || undefined, wq: L.wq >= 2 ? L.wq : undefined, wu: q.equip?.weapon ? this.heatShown(q, q.equip.weapon) : undefined, ou: q.equip?.offhand ? this.heatShown(q, q.equip.offhand) : undefined, ar: L.sh || undefined, ck: L.ck || undefined, gr: L.gr || undefined }; })() });
      }
      for (const m of this._mg ? this.mobsAround(p, VIEW) : this.mobs.values()) { // (server perf: only the grid cells in view)
        if (dist2(p, m) > VIEW * VIEW) continue;
        list.push({ id: m.id, ty: 'm', k: m.kind, l: m.level, x: +m.x.toFixed(2), y: +m.y.toFixed(2), z: +m.z.toFixed(2), r: +m.ry.toFixed(2), s: +m.speed.toFixed(1), h: m.hp / m.maxHp, hp: Math.round(m.hp), mh: m.maxHp, d: m.dead ? 1 : 0, t: m.target, lt: m.loot && m.loot.owners.includes(p.id) ? 1 : 0, lq: m.loot && m.loot.owners.includes(p.id) ? this.lootBest(m.loot)?.q : undefined, ln: m.loot && m.loot.owners.includes(p.id) ? this.lootBest(m.loot)?.name : undefined, st: this.hasCC(m, 'stun') ? 1 : 0, po: m.poiseMax && m.poise < m.poiseMax ? +(m.poise / m.poiseMax).toFixed(2) : undefined }); // (po: the poise bar of S6, only while worn down)
      }
      const mine = evs.filter((e) => {
        const a = e.id || e.src || e.tgt;
        const ent = a ? this.entity(a) : null;
        return !ent || dist2(p, ent) < VIEW * VIEW;
      });
      p.session.send({ t: 'snap', time: this.time, e: list, ev: mine });
    }
  }
}

// playing together: whispers, say, who, friends, inspect, player trade (shared/social.js)
Object.assign(World.prototype, SOCIAL_METHODS, BOT_MIND_METHODS, BOT_SOCIAL_METHODS, BOT_CHAT_METHODS, BOT_MEMORY_METHODS, RIDES_METHODS, RAM_METHODS);
