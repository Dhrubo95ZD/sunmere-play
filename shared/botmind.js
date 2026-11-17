// Living bots, part B (docs/ai/living_bots_design.md, section B): bot minds. Owner: Builder B.
// Installed on World.prototype by sim.js (Object.assign), so every method runs with `this` = the World, on the server and in
// the offline world alike.
// - The roster (B.1, B.7): about 40 saved bots (16 offline) from the append-only BOT_SEEDS, each with a stable persona, its
//   progress (level, XP, gold, zone, quests, bag, crafts, friends, guild) and play times. Saved as the world key bot1roster.
// - Routines (B.3): bots log on and off by their play times, held between bots.minOnline and bots.maxActive.
// - Goals (B.3): quests (on_accept / on_turnin), hunting, gathering, crafting and selling through the real handlers, world
//   bosses, timed dungeon runs with bot friends, travel up the zone ladder (by the real ship, lift and haul road), resting
//   in hubs, logging off. Decisions at 1 Hz, staggered over the 20 ticks of a second.
// - Progress (B.4): real kill credit (botKillCredit, from the kill loop), level-ups through giveXp, a formula for the time a
//   bot "played" while it was not in the world.
// - Levels of detail (B.6): a bot with a human within 150 m (or in a party with one) runs every tick, fights with skills and
//   walks paths; any other bot is coarse: it thinks once a second, walks its path in 1 s steps, settles its fights by a
//   formula and never keeps mobs awake (sim.js tickMobsNear / tickMobsTiered).
// - Paths (B.5): shared/botpath.js, at most one search per tick for all bots.
// Bots speak only through botSay (part C) and write memory only through botRemember (part C).
import { QUESTS, NODES, RECIPES, SPAWNS, MOBS, LOOT_TABLES, ITEMS, OBJECTS, CARAVANS, SAIL, sailRoutes, npcSeen, EMOTES } from './data.js';
import { CLASSES, LEVEL_CAP, xpForLevel } from './classes.js';
import { ZONES, areaOf, zoneAt, walkHeight, worldGap, inWorld, AREA_BY_ID } from './terrain.js';
import { DUNGEONS, DUNGEON_MIN_X } from './dungeons.js';
import { housePush, houseAt, houseCrosses } from './houses.js';
import { rollGear, CLASS_WEIGHT } from './items.js';
import { mulberry32 } from './noise.js';
import { BOT_SEEDS, BOT_GUILDS, makePersona, makeFriends, nameSeed } from './botroster.js';
import { BotPaths } from './botpath.js';
import { RIDES } from './rides.js';

export const BOTS_MIND = {
  key: 'bot1roster', v: 1,
  saveEvery: 300, lodEvery: 2, routineEvery: 30, near: 150,
  bagMax: 20, sellAt: 14, questsMax: 3, doneKeep: 80,
  reviveT: 25, restMin: [120, 360], runMin: [12, 25], travelAway: [20, 60], logoffHub: 220,
  offlineDays: 14, perCheck: 2, dungeonCool: 1800, friendAt: 3, gearPerRun: 0.01, gearMax: 0.15,
};
// the zone ladder by area (B.4): a bot moves up when its level passes the top of its area plus 1
export const AREA_LADDER = [['valley', 1, 40], ['reach', 40, 45], ['rime', 45, 50], ['heights', 50, 55], ['tidewater', 55, 60], ['rainward', 60, 65], ['weald', 65, 70]];
export const targetArea = (L) => { for (const [a, , hi] of AREA_LADDER) if (L <= hi + 1) return a; return AREA_LADDER[AREA_LADDER.length - 1][0]; };
// roughly what a human makes per minute at a level (questbot pace); a bot gets persona.pace of it
export const xpPerMin = (L) => xpForLevel(L) / (15 + 1.6 * L);
const DAY = 864e5;

const rand = mulberry32((Date.now() ^ 0x0b07) & 0xffff);
const R = (a = 0, b = 1) => a + (b - a) * rand();
const RI = (a, b) => Math.floor(R(a, b + 1));
const pick = (L) => L[Math.floor(rand() * L.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lvlRange = (s) => { const m = String(s || '').match(/(\d+)(?:\s*-\s*(\d+))?/); return m ? [+m[1], +(m[2] || m[1])] : null; };
const zonePt = (Z) => ({ x: Z.lx ?? Z.x, z: Z.lz ?? Z.z });
const isMsq = (Q) => !!Q?.msq;

function defaultProg(seed) {
  const L = seed.lvl || 1, k = Math.min(60, L * 3);
  return { level: L, xp: 0, gold: Math.round(40 * L * L + 50), area: null, zone: null, x: null, z: null, quests: {}, done: [], prof: { smith: k, herbal: k, cook: k },
    bag: [], gearBonus: 0, stats: { kills: 0, deaths: 0, runs: 0, quests: 0 }, friends: [], guild: null, lastOn: 0, playedToday: 0, day: 0, aff: {} };
}

export const BOT_MIND_METHODS = {
  mindNow() { return this.io?.now ? this.io.now() : Date.now(); },
  // ------------------------------------------------------------------ roster load and save (B.1, B.7)
  botsLoad() {
    if (this.io.bots === false || this.io.wanderers === false) return; // (no bots at all: the old switch, and worlds without adventurers)
    this.roster = null;
    this.botPaths = new BotPaths();
    let raw;
    try { raw = this.io.load(BOTS_MIND.key); } catch { return; } // the store is not up yet (the server makes its World first): retried in mindTickAll
    this.rosterFrom(raw);
  },
  rosterFrom(raw) {
    const N = Math.max(1, this.bots.roster | 0);
    const ok = raw && typeof raw === 'object' && raw.v === BOTS_MIND.v && Array.isArray(raw.bots);
    const list = [];
    if (ok) {
      for (const e of raw.bots) {
        const seed = BOT_SEEDS[e?.i];
        if (!seed || seed.name !== e.name) continue; // (a hand-edited or foreign save: that entry is dropped)
        // unknown fields are kept (spread); new fields get defaults: older and newer saves both load
        list.push({ ...e, cls: seed.cls, persona: { ...makePersona(seed), ...(e.persona || {}) }, prog: { ...defaultProg(seed), ...(e.prog || {}) } });
      }
    }
    this.roster = list;
    this.rosterNext = ok ? Math.max(raw.next | 0, list.length ? Math.max(...list.map((r) => r.i)) + 1 : 0) : 0;
    const fresh = !list.length;
    while (this.roster.filter((r) => !r.ret).length < N && this.rosterNext < BOT_SEEDS.length) this.rosterAdd(this.rosterNext++, !fresh);
    if (fresh) {
      makeFriends(this.roster.filter((r) => !r.ret));
      for (const r of this.roster) { const g = mulberry32(nameSeed(r.name, 0x6d17)); if (g() < 0.6) r.prog.guild = BOT_GUILDS[Math.floor(g() * BOT_GUILDS.length)]; }
    }
    this.botsDirty = fresh;
  },
  rosterAdd(i, fromStart) {
    const seed = BOT_SEEDS[i];
    // a new seed past the first 14 skips a name a real character already has (it keeps its index, retired)
    const taken = i >= 14 && !!this.io.exists?.(seed.name);
    const prog = defaultProg(fromStart ? { ...seed, lvl: 1 } : seed);
    if (fromStart) prog.gold = 10;
    const r = { i, name: seed.name, cls: seed.cls, persona: makePersona(seed), prog };
    if (taken) r.ret = 1;
    this.roster.push(r);
    return r;
  },
  saveBots() {
    if (!this.roster) return;
    for (const b of this.players.values()) if (b.mind) this.mindSync(b);
    try {
      this.io.save(BOTS_MIND.key, { v: BOTS_MIND.v, next: this.rosterNext, bots: this.roster.map((r) => ({ ...r, b: undefined, on: undefined })) });
      this.botsDirty = false; this.botsSaveT = this.time;
    } catch (e) { this.io.log?.('bot save error', e?.message || e); }
  },
  // a bot's state goes back into its roster entry (before a save, at log off)
  mindSync(b) {
    const r = this.roster?.[this.rosterIdx(b.mind.i)];
    if (!r) return;
    const P = r.prog;
    P.level = b.level; P.xp = Math.round(b.xp); P.gold = Math.round(b.gold); P.prof = { ...(b.prof || {}) }; P.gearBonus = b.gearBonus || 0;
    const pos = b.away?.at || b;
    if (Number.isFinite(pos.x) && Number.isFinite(pos.z) && pos.x < DUNGEON_MIN_X) { P.x = +pos.x.toFixed(1); P.z = +pos.z.toFixed(1); P.area = areaOf(pos.x, pos.z); P.zone = zoneAt(pos.x, pos.z)?.id || null; }
    P.quests = Object.fromEntries(Object.entries(b.quests || {}).filter(([q]) => QUESTS[q] && !isMsq(QUESTS[q])).slice(0, BOTS_MIND.questsMax).map(([q, v]) => [q, { n: v.n | 0, got: v.got, used: v.used }]));
    P.done = Object.keys(b.done || {}).filter((q) => QUESTS[q] && !isMsq(QUESTS[q])).slice(-BOTS_MIND.doneKeep);
    P.bag = (b.bag || []).slice(0, BOTS_MIND.bagMax);
  },
  rosterIdx(i) { const L = this.roster || []; if (L[i]?.i === i) return i; return L.findIndex((r) => r.i === i); },
  rosterOf(b) { return b?.mind ? this.roster?.[this.rosterIdx(b.mind.i)] || null : null; },

  // ------------------------------------------------------------------ the world places (built once)
  mindPlaces() {
    if (this._mplaces) return this._mplaces;
    const npcArea = new Map();
    for (const n of this.npcs.values()) npcArea.set(n.id, n.x >= DUNGEON_MIN_X ? 'dungeon' : areaOf(n.x, n.z));
    // spawn groups by mob kind (outdoor, not dungeon), as grounds
    const byKind = new Map();
    for (const sp of SPAWNS) {
      if (sp.dungeon || sp.x >= DUNGEON_MIN_X || sp.temp) continue;
      const c = sp.path ? { x: sp.path[0][0], z: sp.path[0][1] } : { x: sp.x, z: sp.z };
      if (!isFinite(c.x)) continue;
      const G = { x: c.x, z: c.z, r: Math.max(8, sp.r || 8), area: areaOf(c.x, c.z), sps: [sp], lvl: (sp.lvl || MOBS[sp.mob]?.lvl || [1])[0] };
      (byKind.get(sp.mob) || byKind.set(sp.mob, []).get(sp.mob)).push(G);
    }
    // which mobs drop an item
    const droppers = new Map();
    for (const [kind, def] of Object.entries(MOBS)) for (const [id] of LOOT_TABLES[def.loot]?.items || []) (droppers.get(id) || droppers.set(id, []).get(id)).push(kind);
    // the side quests a bot can really do, and where
    const quests = [];
    for (const [id, Q] of Object.entries(QUESTS)) {
      if (Q.msq || Q.daily || Q.weekly || Q.goal.escort || Q.needLedger || Q.bonusGear) continue;
      const g = this.npcs.get(Q.giver), t = this.npcs.get(Q.turnin);
      if (!g || !t) continue;
      const area = npcArea.get(g.id);
      if (area === 'dungeon' || npcArea.get(t.id) !== area) continue;
      let work = null;
      const G = Q.goal;
      const grounds = (kinds) => kinds.flatMap((k) => byKind.get(k) || []).filter((x) => x.area === area);
      if (G.kill) { const gs = grounds([G.kill]); if (gs.length) work = { kind: 'kill', kinds: [G.kill], gs }; }
      else if (G.kills) { const gs = grounds(G.kills); if (gs.length && G.kills.every((k) => grounds([k]).length)) work = { kind: 'kill', kinds: G.kills, gs }; }
      else if (G.item) { const ks = (droppers.get(G.item) || []).filter((k) => !MOBS[k].elite && !MOBS[k].boss && !MOBS[k].rare); const gs = grounds(ks); if (gs.length) work = { kind: 'kill', kinds: ks, gs, item: G.item }; }
      else if (G.gather) { const ns = NODES.filter((n) => n.item === G.gather && this.nodes.has(n.id) && areaOf(n.x, n.z) === area); if (ns.length) work = { kind: 'gather', nodes: ns.map((n) => n.id) }; }
      else if (G.use) { const os = OBJECTS.filter((o) => o.kind === G.use && o.x < DUNGEON_MIN_X && areaOf(o.x, o.z) === area); if (os.length >= (G.n || 1)) work = { kind: 'use', objs: os }; }
      else if (G.reach) { const Z = ZONES.find((z) => z.id === G.reach); if (Z && (Z.area || 'valley') === area) work = { kind: 'reach', pt: zonePt(Z) }; }
      else if (G.talk) work = { kind: 'talk' };
      if (work) quests.push({ id, Q, area, giver: g, turnin: t, work });
    }
    // crossings between areas (the ship, the lift, the haul road, the ropeway), as on_sail allows them
    const sails = [];
    for (const n of this.npcs.values()) for (const dest of sailRoutes(n)) {
      const to = SAIL.to[dest]; if (!to) continue;
      const haul = !!n.haul || to.kind === 'haul', rope = !haul && (!!n.rope || to.kind === 'rope'), lift = !haul && !rope && (!!n.lift || to.kind === 'lift');
      sails.push({ n, dest, from: npcArea.get(n.id), to: areaOf(to.x, to.z), need: [...(!lift && !haul && !rope ? [SAIL.need] : []), ...(to.need ? [to.need] : [])] });
    }
    const hubs = [...CARAVANS.filter((c) => c.x < DUNGEON_MIN_X).map((c) => ({ x: c.x, z: c.z + 3, area: areaOf(c.x, c.z) })), { x: 4, z: 4, area: 'valley' }];
    const vendors = [...this.npcs.values()].filter((n) => n.vendor && npcArea.get(n.id) !== 'dungeon');
    const stations = [...this.npcs.values()].filter((n) => n.craft && npcArea.get(n.id) !== 'dungeon');
    const doors = DUNGEONS.filter((D) => !D.open && D.door && D.door.x < DUNGEON_MIN_X).map((D) => ({ D, lv: lvlRange(D.level) || [1, 1], area: areaOf(D.door.x, D.door.z), pt: { x: D.door.x + Math.sin(D.door.ry || 0) * 4, z: D.door.z + Math.cos(D.door.ry || 0) * 4 } }));
    const msq = Object.entries(QUESTS).filter(([, Q]) => Q.msq).map(([id, Q]) => [id, Q.lvl || 1]);
    return (this._mplaces = { npcArea, byKind, quests, sails, hubs, vendors, stations, doors, msq });
  },
  // the Main Story is not played by bots: its quests count as done up to level - 1, so story gates open in step (B.3 msq)
  mindMsq(b) { for (const [id, L] of this.mindPlaces().msq) if (L <= b.level - 1) b.done[id] = true; },
  groundMobs(G) {
    const M = (this._spMobs ||= (() => { const m = new Map(); for (const x of this.mobs.values()) if (!x.sp?.temp) (m.get(x.sp) || m.set(x.sp, []).get(x.sp)).push(x); return m; })());
    if (!G.sps) G.sps = [...this.mobs.values()].filter((m) => !m.sp.temp && m.sp.x === G.x && m.sp.z === G.z).map((m) => m.sp).filter((s, i, a) => a.indexOf(s) === i);
    const out = [];
    for (const sp of G.sps) for (const m of M.get(sp) || []) out.push(m);
    return out;
  },

  // ------------------------------------------------------------------ online and offline (B.3 routines)
  rosterStart() {
    if (this._rosterStarted || !this.roster || !this.grounds) return;
    this._rosterStarted = true;
    // this world's first bots log in at once (the routine then trickles the rest in and out)
    for (const r of this.routineWanted().sort((a, c) => a.i - c.i)) this.mindLogin(r); // (in roster order: the old WANDERERS first)
  },
  playing(r, now) {
    const P = r.persona.play || { days: 127, start: 19, len: 90 };
    const at = new Date(now), mins = at.getHours() * 60 + at.getMinutes();
    const day0 = Math.floor((now - at.getTimezoneOffset() * 6e4) / DAY);
    // today's window and yesterday's (a late session runs past midnight)
    for (const back of [0, 1]) {
      const d = day0 - back, g = mulberry32(nameSeed(r.name, d));
      if (g() < 0.15) continue; // skips a day
      const other = g() < 0.10, jit = (g() * 40 - 20) | 0, oh = Math.floor(g() * 24);
      const wd = new Date(now - back * DAY).getDay();
      if (!other && !(P.days & (1 << wd))) continue;
      const s = (other ? oh : P.start) * 60 + jit - back * 1440;
      if (mins >= s && mins < s + P.len) return true;
    }
    return false;
  },
  // who should be online now: the routine, held between minOnline and maxActive (bots in a party with a human or away on a
  // run stay)
  routineWanted() {
    const now = this.mindNow(), day = Math.floor(now / DAY);
    const act = this.roster.filter((r) => !r.ret).slice(0, Math.max(1, this.bots.roster | 0));
    const ord = (r) => mulberry32(nameSeed(r.name, day * 7 + 3))();
    const on = (r) => !!r.b && this.players.has(r.b.id);
    const sticky = act.filter((r) => on(r) && (r.b.away || r.b.party || r.b.ai?.party || r.b.duel));
    let want = act.filter((r) => this.playing(r, now)).sort((a, b) => ord(a) - ord(b));
    const min = clamp(this.bots.minOnline | 0, 0, this.bots.maxActive | 0), max = Math.max(0, this.bots.maxActive | 0);
    if (want.length < min) {
      // the world is never empty: the bots already on stay first, then the rest by today's order
      const rest = act.filter((r) => !want.includes(r)).sort((a, b) => (on(b) - on(a)) || ord(a) - ord(b));
      want = [...want, ...rest.slice(0, min - want.length)];
    }
    const set = new Set(sticky);
    for (const r of want) { if (set.size >= max) break; set.add(r); }
    return [...set];
  },
  routineTick() {
    const want = new Set(this.routineWanted());
    let ins = 0, n = this.roster.filter((r) => r.b && this.players.has(r.b.id)).length;
    const max = Math.max(0, this.bots.maxActive | 0), min = clamp(this.bots.minOnline | 0, 0, max);
    const leaving = (b) => b.mind.goal?.kind === 'logoff';
    // a wanted bot already on its way out stays after all (else it walks off while its place waits for a log-in)
    for (const r of want) if (r.b && this.players.has(r.b.id) && leaving(r.b)) this.mindSetGoal(r.b, null);
    let stay = this.roster.filter((r) => r.b && this.players.has(r.b.id) && !leaving(r.b)).length;
    for (const r of this.roster) {
      const b = r.b && this.players.has(r.b.id) ? r.b : null;
      if (b && !want.has(r) && !leaving(b) && !b.away) {
        if (b.party || b.ai?.party) { this.botLeaveParty?.(b, 'routine'); continue; }
        this.mindSetGoal(b, this.goalLogoff(b)); stay--;
      } else if (!b && want.has(r) && (ins < BOTS_MIND.perCheck || stay < min)) { // (a trickle, but never below minOnline)
        if (n >= max) { const o = this.roster.find((x) => x.b && this.players.has(x.b.id) && leaving(x.b)); if (!o) continue; this.mindLogoff(o.b); n--; } // room from one on its way out
        this.mindLogin(r); ins++; n++; stay++;
      }
    }
    // never over maxActive: past it, the ones already on their way out go at once
    for (const r of this.roster) { if (n <= max) break; const b = r.b && this.players.has(r.b.id) ? r.b : null; if (b && b.mind.goal?.kind === 'logoff') { this.mindLogoff(b); n--; } }
    this.retireCheck();
  },
  // B.1: when more than half the roster is at the cap, one capped bot a day stops playing and a new level-1 bot starts
  retireCheck() {
    const day = Math.floor(this.mindNow() / DAY);
    if (this.retireDay === day) return;
    this.retireDay = day;
    const act = this.roster.filter((r) => !r.ret);
    const capped = act.filter((r) => (r.b?.level ?? r.prog.level) >= LEVEL_CAP);
    if (capped.length * 2 <= act.length || this.rosterNext >= BOT_SEEDS.length) return;
    const r = capped.find((x) => !x.b || !this.players.has(x.b.id)) || capped[0];
    if (r.b && this.players.has(r.b.id)) this.mindLogoff(r.b);
    r.ret = 1;
    while (this.rosterNext < BOT_SEEDS.length) { const n = this.rosterAdd(this.rosterNext++, true); if (!n.ret) break; }
    this.botsDirty = true;
  },
  // the time a bot was offline but its routine says it played: XP from the formula (B.4), and its place moves up the ladder
  offlineProgress(r) {
    const P = r.prog, now = this.mindNow();
    if (!P.lastOn || now <= P.lastOn) return;
    const days = Math.min(BOTS_MIND.offlineDays, (now - P.lastOn) / DAY);
    let bits = 0; for (let d = 0; d < 7; d++) if (r.persona.play.days & (1 << d)) bits++;
    let mins = days * r.persona.play.len * (bits / 7) * 0.85;
    if (mins < 1) return;
    const L0 = P.level;
    while (mins > 0 && P.level < LEVEL_CAP) {
      const per = xpPerMin(P.level) * r.persona.pace, need = xpForLevel(P.level) - P.xp, m = need / per;
      if (m > mins) { P.xp += Math.round(per * mins); mins = 0; }
      else { mins -= m; P.xp = 0; P.level++; }
    }
    P.gold += Math.round(days * 20 * P.level);
    if (P.level !== L0 && targetArea(P.level) !== P.area) { P.x = null; P.z = null; P.area = null; } // it moved on: placed fresh in its area
  },
  mindLogin(r) {
    if (r.b && this.players.has(r.b.id)) return r.b;
    if (r.ret) return null;
    this.offlineProgress(r);
    const P = r.prog;
    let x = P.x, z = P.z;
    const area = targetArea(P.level);
    if (!(Number.isFinite(x) && Number.isFinite(z) && x < DUNGEON_MIN_X && inWorld(x, z, 0) && (areaOf(x, z) === area || this.mindRoute(areaOf(x, z), area, this.msqDoneFor(P.level))))) {
      const gs = this.huntGrounds(P.level, area);
      const g = gs.length ? gs[nameSeed(r.name) % gs.length] : this.grounds.find((q) => q.area === area) || this.grounds[0];
      x = g.x + R(-4, 4); z = g.z + R(-4, 4);
    }
    [x, z] = housePush(x, z, 0.5);
    const b = this.makeBot({ wander: true, name: r.name, cls: r.cls, level: P.level, x, z, ry: R(0, 6.28), mail: [], gearBonus: P.gearBonus || 0 });
    b.xp = P.xp || 0; b.gold = P.gold || 0; b.prof = { ...(P.prof || {}) }; b.bag = (P.bag || []).slice(0, BOTS_MIND.bagMax);
    b.quests = {}; for (const [q, v] of Object.entries(P.quests || {})) if (QUESTS[q]) b.quests[q] = { ...v };
    b.done = {}; for (const q of P.done || []) b.done[q] = true;
    b.mind = { i: r.i, persona: r.persona, goal: null, lod: 'full', since: this.time, k: r.i % 20, lvlSeen: b.level, area: areaOf(b.x, b.z), cacc: 0, path: null };
    this.mindMsq(b);
    this.botGear(b); b.hp = b.maxHp;
    const gs = this.huntGrounds(b.level, areaOf(b.x, b.z));
    b.ai.ground = gs.length ? gs.reduce((a, g) => (dist(g, b) < dist(a, b) ? g : a)) : this.grounds[0];
    b.ai.moveOn = this.time + R(120, 400); b.ai.chatT = 1e9;
    r.b = b; P.lastOn = this.mindNow();
    return b;
  },
  msqDoneFor(L) { const d = {}; for (const [id, l] of this.mindPlaces().msq) if (l <= L - 1) d[id] = true; return d; },
  mindLogoff(b) {
    const r = this.rosterOf(b);
    this.mindSync(b);
    if (r) { r.prog.lastOn = this.mindNow(); r.b = null; }
    if (b.mind.path?.cb) this.botPaths.cancel(b.mind.path.cb);
    this.sendHome(b);
    this.botsDirty = true; this.botsSaveSoon = true;
  },

  // ------------------------------------------------------------------ the tick (B.3, B.6)
  mindTickAll(dt) {
    if (this.io.bots === false || !this.botPaths) return;
    const n = (this._mindN = (this._mindN || 0) + 1);
    if (!this.roster) {
      if (n % 20 === 0) { try { const raw = this.io.load(BOTS_MIND.key); this.rosterFrom(raw); this.rosterStart(); } catch { /* not yet */ } }
      return;
    }
    if (!this._rosterStarted) this.rosterStart();
    this.botPaths.tick(this.time);
    this.lodT = (this.lodT || 0) + dt;
    if (this.lodT >= BOTS_MIND.lodEvery) { this.lodT = 0; this.mindLod(); }
    this.routineT = (this.routineT ?? R(5, 15)) - dt;
    if (this.routineT <= 0) { this.routineT = BOTS_MIND.routineEvery; this.routineTick(); }
    if ((this.botsDirty && this.time - (this.botsSaveT ?? -1e9) > BOTS_MIND.saveEvery) || (this.botsSaveSoon && this.time - (this.botsSaveT ?? -1e9) > 5)) { this.botsSaveSoon = false; this.saveBots(); }
    else if (this.time - (this.botsSaveT ?? 0) > BOTS_MIND.saveEvery) { this.botsSaveT = this.time; this.botsDirty = true; } // online bots change all the time: a save every 5 min
  },
  // full or coarse (re-checked every 2 s)
  mindLod() {
    const hs = [];
    for (const p of this.players.values()) if (!p.bot && !p.held && !p.dead) hs.push(p);
    for (const b of this.players.values()) {
      if (!b.mind) continue;
      const M = b.mind, inD = b.x >= DUNGEON_MIN_X;
      let full = !!(b.party || b.ai?.party || b.duel) || this.time - b.combatT < 5;
      if (!full) for (const h of hs) if ((h.x >= DUNGEON_MIN_X) === inD && dist(h, b) < BOTS_MIND.near) { full = true; break; }
      const lod = full ? 'full' : 'coarse';
      if (lod !== M.lod) { M.lod = lod; if (lod === 'coarse') { b.target = null; b.speed = 0; if (b.mounted) { b.mounted = false; this.broadcast({ k: 'mount', id: b.id, on: false }); } } }
    }
  },
  mindTick(b, dt) {
    const M = b.mind;
    if (M.paused) return false;
    if (b.away) { if (this.time >= b.away.until) this.mindBack(b); return true; }
    if (b.dead) {
      if (!M.died) { M.died = true; const r = this.rosterOf(b); if (r) r.prog.stats.deaths++; this.botRemember?.(b, 'death', { by: this.mobs.get(b.target)?.def?.name }); }
      b.reviveT = b.reviveT || this.time + BOTS_MIND.reviveT;
      if (this.time > b.reviveT) {
        const g = this.graveyard(b);
        b.dead = false; b.reviveT = 0; b.hp = Math.round(b.maxHp * 0.6); b.res = b.maxRes * 0.5; b.buffs = []; b.target = null; M.died = false;
        b.x = g.x + R(-2, 2); b.z = g.z + R(-2, 2); b.y = walkHeight(b.x, b.z); M.path = null;
        this.broadcast({ k: 'revive', id: b.id });
      }
      return true;
    }
    if (b.level !== M.lvlSeen) this.mindLevelled(b);
    { const a = areaOf(b.x, b.z); if (a !== M.area && a !== 'dungeon') { M.area = a; this.botRemember?.(b, 'zone', { area: a }); this.botSay?.(b, 'world', 'zone_move', { slots: { area: AREA_BY_ID[a]?.name || 'the valley' } }); this.botsSaveSoon = true; } }
    this.mindReplies(b);
    if (b.duel) { this.mindDuel(b, dt); return true; }
    M.cacc += dt;
    if (((this._mindN || 0) + M.k) % 20 === 0) {
      this.mindDecide(b);
      if (M.lod === 'coarse') this.mindCoarse(b, Math.min(2, M.cacc));
      M.cacc = 0;
    }
    if (M.lod === 'full') this.mindFull(b, dt);
    return true;
  },
  // the old wanderer's replies: a duel answer, an emote back
  mindReplies(b) {
    const A = b.ai;
    if (A.duelReply && this.time > A.duelReply.t) {
      const r = A.duelReply, p = this.players.get(r.from); A.duelReply = null;
      if (p && r.yes && this.time > (A.duelCool || 0)) { this.botSay(b, 'world', 'duel_yes', { to: p, must: 1 }); this.startDuel(p, b); }
      else if (p) this.botSay(b, 'world', 'duel_no', { to: p, must: 1 });
    }
    if (A.reply && this.time > A.replyT) { const r = A.reply; A.reply = null; b.speed = 0; this.broadcast({ k: 'emote', id: b.id, e: r.e, text: `${b.name} ${EMOTES[r.e]} at ${r.to}.` }); A.pause = 3; }
  },
  mindDuel(b, dt) {
    b.target = this.duelOn(b) ? b.duel.with : null;
    const tgt = b.target ? this.foeOf(b, b.target) : null;
    if (!tgt) { b.speed = 0; return; }
    this.botMove(b, tgt, (CLASSES[b.cls]?.ranged ? 12 : 2.2), 1, tgt);
    if (!b.cast && this.time >= b.gcd && !this.hasCC(b, 'stun')) { const c = this.botChooseSkill(b, b, tgt); if (c) this.on_cast(b, c); }
  },
  mindLevelled(b) {
    const M = b.mind; M.lvlSeen = b.level;
    this.botGear(b); this.mindMsq(b);
    this.botRemember?.(b, 'lvl', { level: b.level });
    this.botSay?.(b, 'world', 'levelled', { slots: { level: b.level } });
    this.botsDirty = true; this.botsSaveSoon = true;
  },

  // ------------------------------------------------------------------ goals (B.3)
  mindSetGoal(b, g) {
    const M = b.mind;
    if (M.path?.cb) this.botPaths.cancel(M.path.cb);
    M.path = null; M.stuck = 0; b.sit = false;
    M.goal = g ? { t0: this.time, until: this.time + (g.stale || 900), ...g } : null;
  },
  mindDecide(b) {
    const M = b.mind, g = M.goal;
    if (g && this.time < g.until && !g.done) { this.goalCheck(b, g); if (!g.done) return; }
    if (g?.kind === 'logoff') { if (this.time >= g.until) this.mindLogoff(b); return; } // (on its way out; past its time it just goes)
    this.mindSetGoal(b, this.mindChoose(b));
  },
  mindChoose(b) {
    const P = b.mind.persona, likes = new Set(P.likes || []), L = b.level, area = areaOf(b.x, b.z);
    const like = (k, x = 2) => (likes.has(k) ? x : 1);
    const C = [];
    const add = (s, f) => { if (s > 0) C.push([s * R(0.8, 1.2), f]); };
    const ta = targetArea(L);
    if (ta !== area && area !== 'dungeon') { const hop = this.mindRoute(area, ta, b.done); if (hop) add(3, () => this.goalTravel(b, hop)); }
    if (b.bag.length >= BOTS_MIND.sellAt) add(2.5, () => this.goalSell(b));
    const q = this.goalQuest(b); if (q) add(1.3, () => q);
    const boss = [...this.mobs.values()].find((m) => m.def.world && !m.dead && !m.sp.dungeon && areaOf(m.x, m.z) === area && L >= m.level - 5 && dist(m, b) < 400);
    // an open event in its area (the Russet Weald's Clear the Rides while the gale blows): go and help, as for a world boss.
    // While it runs the event comes first (the Great Forwarder is always out in the gale; a world boss of a million health
    // would otherwise hold every bot in the wood for the whole gale and leave the trunks to the players)
    const ev = L >= RIDES.minLevel && !!this.ridesTarget?.(b);
    if (boss) add((ev ? 0.6 : 2) * like('world bosses', 1.5), () => ({ kind: 'worldboss', id: boss.id, label: `fighting ${boss.def.name}`, stale: 600 }));
    if (ev) add(2.2 * like('world bosses', 1.5), () => ({ kind: 'event', ev: 'rides', label: 'clearing the rides in the gale', stale: 300 }));
    // the Ram Engine on the Harrow Coast while its run is on (shared/ramEngine.js): load it, repair it, fight its menders, or drive
    if (this.ramWants?.(b)) add(2.4 * like('world bosses', 1.5), () => ({ kind: 'event', ev: 'ram', label: 'working the Ram Engine', stale: 300 }));
    const cr = this.goalCraft(b); if (cr) add(0.6 * like('crafting') * (cr.station === 'cook' ? like('cooking') : 1), () => cr);
    const ga = this.goalGather(b); if (ga) add(0.35 * like('gathering', 3), () => ga);
    if (this.time > (b.mind.runCool || 0)) { const d = this.goalDungeon(b); if (d) add(0.5 * like('dungeons'), () => d); }
    if (this.mindHub(b, 120)) add(0.35, () => this.goalRest(b));
    add(1, () => this.goalHunt(b));
    C.sort((a, b2) => b2[0] - a[0]);
    for (const [, f] of C) { const g = f(); if (g) return g; }
    return this.goalHunt(b);
  },
  goalHunt(b, G) {
    const gs = this.huntGrounds(b.level, areaOf(b.x, b.z)).filter((g) => Math.abs(g.lvl - b.level) <= 2);
    const g = G || (gs.length ? (rand() < 0.6 && gs.includes(b.ai.ground) ? b.ai.ground : pick(gs)) : b.ai.ground);
    if (!g) return null;
    b.ai.ground = g;
    return { kind: 'hunt', G: g, fight: (m) => Math.abs(m.level - b.level) <= 2, label: `hunting in ${zoneAt(g.x, g.z)?.name || 'the valley'}`, stale: R(200, 480) };
  },
  goalQuest(b) {
    const Pl = this.mindPlaces(), area = areaOf(b.x, b.z);
    // a quest it holds first
    for (const qid of Object.keys(b.quests)) { const I = Pl.quests.find((x) => x.id === qid); if (I && I.area === area) return { kind: 'quest', q: qid, I, stage: this.questComplete(b, qid) ? 'turnin' : 'work', label: `working on ${I.Q.name}`, stale: 1200 }; }
    if (Object.keys(b.quests).filter((q) => !isMsq(QUESTS[q])).length >= BOTS_MIND.questsMax) return null;
    const ok = Pl.quests.filter((I) => I.area === area && !b.done[I.id] && !b.quests[I.id] && (!I.Q.pre || b.done[I.Q.pre]) && I.Q.lvl <= b.level + 1 && I.Q.lvl >= b.level - 4 && npcSeen(I.giver, b.done) && npcSeen(I.turnin, b.done));
    if (!ok.length) return null;
    const I = ok.reduce((a, x) => (dist(x.giver, b) < dist(a.giver, b) ? x : a));
    return { kind: 'quest', q: I.id, I, stage: 'pick', label: `working on ${I.Q.name}`, stale: 1200 };
  },
  goalTravel(b, hop) { return { kind: 'travel', hop, dest: { x: hop.n.x, z: hop.n.z }, stop: 4, label: `heading for ${AREA_BY_ID[hop.to]?.name || 'the valley'}`, stale: 900 }; },
  goalSell(b) {
    const area = areaOf(b.x, b.z), vs = this.mindPlaces().vendors.filter((n) => this.mindPlaces().npcArea.get(n.id) === area);
    if (!vs.length) return null;
    const n = vs.reduce((a, x) => (dist(x, b) < dist(a, b) ? x : a));
    return { kind: 'sell', npc: n.id, ...this.npcDest(n), label: `selling at ${n.name}`, stale: 600 };
  },
  goalCraft(b) {
    const area = areaOf(b.x, b.z), Pl = this.mindPlaces();
    for (const Rc of RECIPES) {
      if (b.level < Rc.lvl || ((b.prof || {})[Rc.station] || 0) < (Rc.skill || 0) || b.gold < Rc.cost + 200) continue;
      if (!Rc.needs.every(([id, k]) => this.countItem(b, id) >= k)) continue;
      const n = Pl.stations.find((s) => s.craft === Rc.station && Pl.npcArea.get(s.id) === area);
      if (n) return { kind: 'craft', recipe: Rc.id, station: Rc.station, npc: n.id, ...this.npcDest(n), label: `crafting ${ITEMS[Rc.makes]?.name || 'gear'}`, stale: 600 };
    }
    return null;
  },
  goalGather(b) {
    const area = areaOf(b.x, b.z);
    const ns = [...this.nodes.values()].filter((n) => n.ready && !n.questOnly && areaOf(n.x, n.z) === area && dist(n, b) < 160);
    if (!ns.length) return null;
    const n = ns.reduce((a, x) => (dist(x, b) < dist(a, b) ? x : a));
    return { kind: 'gather', node: n.id, left: RI(2, 5), dest: { x: n.x, z: n.z }, stop: 2.5, label: `gathering ${ITEMS[n.item]?.name || 'materials'}`, stale: 500 };
  },
  goalRest(b) { const h = this.mindHub(b, 120); return h ? { kind: 'rest', dest: { x: h.x + R(-4, 4), z: h.z + R(-4, 4) }, stop: 1.5, label: 'taking a break', stale: 600 } : null; },
  goalLogoff(b) { const h = this.mindHub(b, BOTS_MIND.logoffHub); return { kind: 'logoff', dest: h ? { x: h.x + R(-3, 3), z: h.z + R(-3, 3) } : null, stop: 2, label: 'about to log off', stale: 240 }; },
  mindHub(b, within) {
    const area = areaOf(b.x, b.z);
    let best = null, bd = within;
    for (const h of this.mindPlaces().hubs) if (h.area === area) { const d = dist(h, b); if (d < bd) { bd = d; best = h; } }
    return best;
  },
  // B.3 dungeon: with 2 or more online bot friends of a fitting level, a timed run (they walk to the door together)
  goalDungeon(b) {
    if (!this.botAvailable(b, 'run')) return null;
    const area = areaOf(b.x, b.z), L = b.level;
    const doors = this.mindPlaces().doors.filter((d) => d.area === area && !d.D.raid && L >= d.lv[0] && L <= d.lv[1] + 3 && dist(d.pt, b) < 500);
    if (!doors.length) return null;
    const fr = this.botFriends(b).filter((f) => !f.away && Math.abs(f.level - L) <= 4 && this.botAvailable(f, 'run') && f.mind.goal?.kind !== 'dungeon' && areaOf(f.x, f.z) === area && !(f.party || f.ai?.party));
    if (fr.length < 2) return null;
    const d = doors.reduce((a, x) => (dist(x.pt, b) < dist(a.pt, b) ? x : a));
    const team = fr.slice(0, 4);
    const g = (lead) => ({ kind: 'dungeon', id: d.D.id, lead, dest: { x: d.pt.x + R(-2, 2), z: d.pt.z + R(-2, 2) }, stop: 3, label: `heading into ${d.D.name}`, dungeon: d.D.name, stale: 900 });
    for (const f of team) this.mindSetGoal(f, g(b.id));
    return { ...g(b.id), team: team.map((f) => f.id) };
  },
  // how a goal is going (1 Hz): stages, completion
  goalCheck(b, g) {
    if (g.kind === 'quest') {
      const qid = g.q, Q = QUESTS[qid];
      if (g.stage !== 'pick' && !b.quests[qid]) { g.done = true; return; }
      if (g.stage === 'pick') { if (g.talk !== g.I.giver || !g.dest) Object.assign(g, this.npcDest(g.I.giver)); g.fight = null; return; }
      if (this.questComplete(b, qid)) g.stage = 'turnin';
      if (g.stage === 'turnin') { if (g.talk !== g.I.turnin || !g.dest) Object.assign(g, this.npcDest(g.I.turnin)); g.fight = null; g.G = null; return; }
      const W = g.I.work;
      // the same spot keeps the same dest object (a new one each second re-asked the path, and a bot by a door never left)
      const keep = (d, p) => (p && !(d && d.x === p.x && d.z === p.z) ? { x: p.x, z: p.z } : d);
      if (W.kind === 'kill') {
        const kinds = new Set(W.kinds.filter((k) => !(b.quests[qid]?.got || {})[k] || !Q.goal.kills));
        if (!g.G || !W.gs.includes(g.G) || !kinds.has(g.G.sps[0].mob)) { const gs = W.gs.filter((x) => kinds.has(x.sps[0].mob)); g.G = gs.length ? gs.reduce((a, x) => (dist(x, b) < dist(a, b) ? x : a)) : null; }
        g.fight = (m) => kinds.has(m.kind); g.dest = null;
        if (!g.G) g.done = true;
      } else if (W.kind === 'gather') {
        const n = W.nodes.map((id) => this.nodes.get(id)).filter((n) => n?.ready).sort((a, c) => dist(a, b) - dist(c, b))[0];
        g.dest = keep(g.dest, n || (g.dest ? null : this.nodes.get(W.nodes[0]))); g.node = n?.id; g.stop = 2.5;
      } else if (W.kind === 'use') {
        const used = b.quests[qid]?.used || [];
        const o = W.objs.filter((x) => !used.includes(x.id)).sort((a, c) => dist(a, b) - dist(c, b))[0];
        if (!o) { g.done = true; return; }
        g.dest = keep(g.dest, o); g.obj = o.id; g.stop = 3;
      } else if (W.kind === 'reach') { g.dest = W.pt; g.stop = 6; }
      else g.stage = 'turnin';
    } else if (g.kind === 'hunt') {
      if (this.time > b.ai.moveOn && !b.target) { b.ai.moveOn = this.time + R(200, 480); g.done = true; }
    } else if (g.kind === 'worldboss') {
      const m = this.mobs.get(g.id);
      if (!m || m.dead) { g.done = true; if (m) this.botRemember?.(b, 'boss', { a: m.def.name, ok: 1 }); return; }
      // Clear the Rides started while it was at the boss: off to the trunks unless the boss is on it now (it chooses again)
      if (m.target !== b.id && b.level >= RIDES.minLevel && this.ridesTarget?.(b)) { g.done = true; return; }
      g.G = { x: m.x, z: m.z, r: 30, sps: [m.sp] }; g.fight = (x) => x.id === g.id; g.boss = true;
    } else if (g.kind === 'event' && g.ev === 'ram') {
      this.ramBotCheck(b, g); // the Ram Engine: its part at the levers, the piles, the frame or the fight (shared/ramEngine.js)
    } else if (g.kind === 'event') {
      // Clear the Rides: the nearest trunk still across a ride, cut with whoever is there (shared/rides.js)
      const m = this.ridesTarget?.(b);
      if (!m) { g.done = true; return; }
      g.id = m.id;
      const cur = b.target && this.mobs.get(b.target); // (a machine set on it is fought first; another trunk it is cutting is kept)
      if (!cur || cur.dead || !(cur.target === b.id || cur.def.inert)) { b.target = m.id; b.ai.pickT = this.time; }
      g.G = { x: m.x, z: m.z, r: 12, sps: [] }; g.fight = (x) => x.id === g.id || x.target === b.id; g.boss = true;
    } else if (g.kind === 'dungeon') {
      if (g.lead !== b.id) { const L = this.players.get(g.lead); if (!L || L.mind?.goal?.kind !== 'dungeon' && !L.away) g.done = true; }
    } else if (g.kind === 'rest' && g.idle && this.time > g.idle) g.done = true;
    else if (g.kind === 'logoff' && !g.dest) this.mindLogoff(b);
  },
  // where to stand to talk to an NPC: close, and inside his house when he keeps one (indoorOk)
  npcDest(n) { return { dest: { x: n.x, z: n.z }, stop: n.house ? 1.6 : 4, talk: n }; },
  // arrived at the goal's spot: the real handler
  mindArrive(b, g) {
    if (g.talk && !this.indoorOk(b, g.talk)) {
      // close but on the wrong side of his wall: walk the path in by the door (a fresh path from here), then give up
      if ((g.tries = (g.tries || 0) + 1) > 3) { g.done = true; return; }
      g.stop = 0.8; b.mind.path = null; return;
    }
    if (g.kind === 'quest') {
      if (g.stage === 'pick') { this.on_accept(b, { q: g.q }); if (b.quests[g.q]) { g.stage = 'work'; g.dest = null; g.talk = null; g.tries = 0; this.goalCheck(b, g); } else g.done = true; return; }
      if (g.stage === 'turnin') {
        const had = !!b.quests[g.q];
        this.on_turnin(b, { q: g.q, choice: 0 });
        if (had && !b.quests[g.q]) { const r = this.rosterOf(b); if (r) r.prog.stats.quests++; this.botRemember?.(b, 'quest', { a: QUESTS[g.q].name, ok: 1 }); this.botsDirty = true; }
        g.done = true; return;
      }
      const W = g.I.work;
      if (W.kind === 'gather' && g.node) this.on_gather(b, { id: g.node });
      else if (W.kind === 'use' && g.obj) this.on_useobj(b, { id: g.obj });
      else if (W.kind === 'reach') this.checkReach(b);
      g.dest = null; this.goalCheck(b, g);
    } else if (g.kind === 'gather') {
      this.on_gather(b, { id: g.node });
      const n = [...this.nodes.values()].filter((x) => x.ready && !x.questOnly && areaOf(x.x, x.z) === areaOf(b.x, b.z) && dist(x, b) < 60).sort((a, c) => dist(a, b) - dist(c, b))[0];
      if (--g.left > 0 && n) { g.node = n.id; g.dest = { x: n.x, z: n.z }; } else g.done = true;
    } else if (g.kind === 'craft') {
      const Rc = RECIPES.find((x) => x.id === g.recipe);
      this.on_craft(b, { recipe: g.recipe, npc: g.npc });
      this.botRemember?.(b, 'craft', { a: ITEMS[Rc?.makes]?.name });
      g.done = true;
    } else if (g.kind === 'sell') {
      const g0 = b.gold;
      this.on_sellJunk(b, { npc: g.npc });
      for (let i = b.bag.length - 1; i >= 0; i--) { const it = b.bag[i]; if ((it.gear && (it.gear.q ?? 1) <= 1) || (it.id && ITEMS[it.id]?.slot !== 'quest' && !RECIPES.some((Rc) => Rc.needs.some(([id]) => id === it.id)))) this.on_sell(b, { slot: i }); }
      if (b.gold > g0) this.botRemember?.(b, 'sold', { gold: b.gold - g0 });
      g.done = true;
    } else if (g.kind === 'rest') { if (!g.idle) { g.idle = this.time + R(...BOTS_MIND.restMin); b.sit = rand() < 0.5; } g.dest = null; }
    else if (g.kind === 'event' && g.ev === 'ram') this.ramBotArrive(b, g); // (the Ram Engine: at the levers, a pile, the engine's side)
    else if (g.kind === 'travel') this.mindAway(b, 'travel', R(...BOTS_MIND.travelAway), { hop: g.hop });
    else if (g.kind === 'dungeon') this.mindRunArrive(b, g);
    else if (g.kind === 'logoff') this.mindLogoff(b);
  },
  // a crossing chain between areas (the gates as on_sail checks them); the first hop, or null
  mindRoute(from, to, done) {
    if (from === to) return null;
    const S = this.mindPlaces().sails.filter((s) => s.need.every((q) => done?.[q]));
    const seen = new Set([from]), Q = [[from, null]];
    while (Q.length) {
      const [a, first] = Q.shift();
      for (const s of S) if (s.from === a && !seen.has(s.to)) { const f = first || s; if (s.to === to) return f; seen.add(s.to); Q.push([s.to, f]); }
    }
    return null;
  },

  // ------------------------------------------------------------------ away: crossings and dungeon runs (hidden, held)
  mindAway(b, kind, secs, extra = {}) {
    b.away = { kind, until: this.time + secs, at: { x: b.x, z: b.z }, ...extra };
    b.held = true; b.target = null; b.speed = 0; b.sit = false;
    for (const m of this.mobs.values()) { m.threat.delete(b.id); if (m.target === b.id) m.target = null; }
    if (b.mind.goal) b.mind.goal.until = Infinity;
  },
  mindBack(b) {
    const A = b.away; b.away = null; b.held = false;
    if (A.kind === 'travel' && A.hop) this.on_sail(b, { npc: A.hop.n.id, to: A.hop.dest });
    if (A.kind === 'run') this.mindRunEnd(b, A);
    const gs = this.huntGrounds(b.level, areaOf(b.x, b.z));
    if (gs.length) b.ai.ground = gs.reduce((a, g) => (dist(g, b) < dist(a, b) ? g : a));
    b.mind.path = null;
    this.mindSetGoal(b, null);
    this.botsSaveSoon = true;
  },
  mindRunArrive(b, g) {
    if (g.lead !== b.id) { g.dest = null; return; } // a friend waits at the door for the leader
    const team = [b, ...(g.team || []).map((id) => this.players.get(id)).filter((f) => f && f.mind?.goal?.kind === 'dungeon' && f.mind.goal.lead === b.id && !f.away)];
    const here = team.filter((f) => dist(f, b) < 40);
    if (here.length < team.length && this.time - (g.wait ||= this.time) < 120) return; // waits up to 2 min for the others
    if (here.length < 3) { for (const f of team) if (f.mind.goal?.kind === 'dungeon') f.mind.goal.done = true; return; }
    const D = this.mindPlaces().doors.find((d) => d.D.id === g.id);
    const avg = here.reduce((s, f) => s + f.level, 0) / here.length;
    const ok = rand() < clamp(0.55 + 0.08 * (avg - D.lv[0]), 0.15, 0.95);
    const bosses = SPAWNS.filter((sp) => sp.dungeon === g.id && MOBS[sp.mob]?.boss).length || 1;
    const res = { id: g.id, name: D.D.name, ok, boss: ok ? bosses : RI(1, bosses), names: here.map((f) => f.name) };
    const secs = R(...BOTS_MIND.runMin) * 60;
    for (const f of here) { this.mindAway(f, 'run', secs + R(0, 20), { res }); f.mind.runCool = this.time + secs + BOTS_MIND.dungeonCool; }
  },
  mindRunEnd(b, A) {
    const r = this.rosterOf(b), res = A.res;
    if (r) r.prog.stats.runs++;
    if (res.ok) { this.giveXp(b, Math.round(xpForLevel(b.level) * 0.3)); b.gold += 30 * b.level; b.gearBonus = Math.min(BOTS_MIND.gearMax, (b.gearBonus || 0) + BOTS_MIND.gearPerRun); this.botGear(b); }
    else this.giveXp(b, Math.round(xpForLevel(b.level) * 0.08));
    this.botRemember?.(b, 'run', { a: res.name, ok: res.ok ? 1 : 0, boss: res.boss, names: res.names.filter((n) => n !== b.name) });
    // B.8: shared runs make friends (+1 affinity a run; a friend at 3)
    if (r) for (const n of res.names) {
      const o = this.roster.find((x) => x.name === n); if (!o || o === r) continue;
      r.prog.aff ||= {}; r.prog.aff[o.i] = (r.prog.aff[o.i] || 0) + 1;
      if (r.prog.aff[o.i] >= BOTS_MIND.friendAt && !r.prog.friends.includes(o.i)) r.prog.friends.push(o.i);
    }
  },

  // ------------------------------------------------------------------ doing it: full detail (every tick)
  mindFull(b, dt) {
    const M = b.mind, g = M.goal;
    if (!g) { b.speed = 0; return; }
    if (!(g.fight && g.G) && g.kind !== 'logoff' && g.kind !== 'travel') {
      // set on while it walks, gathers or talks: it turns and fights back with its skills, as a volunteer would
      const cur = b.target ? this.mobs.get(b.target) : null;
      if (!(cur && !cur.dead && cur.target === b.id && dist(cur, b) < 30)) {
        b.target = null;
        if (this.time - b.combatT < 3 && (this.time - (b.ai.defT || 0)) > 0.4) { b.ai.defT = this.time; for (const m of this.mobs.values()) if (!m.dead && m.target === b.id && dist(m, b) < 30) { b.target = m.id; break; } }
      }
      const foe = b.target ? this.foeOf(b, b.target) : null;
      if (foe) {
        this.botMove(b, foe, (CLASSES[b.cls]?.ranged ? 12 : 2.2) + this.rad(foe) * 0.7, 1, foe);
        if (!b.cast && this.time >= b.gcd && !this.hasCC(b, 'stun')) { const c = this.botChooseSkill(b, b, foe); if (c) this.on_cast(b, c); }
        return;
      }
    }
    if (g.fight && g.G) {
      const tgt = this.mindFight(b, g);
      if (tgt) {
        const ranged = !!CLASSES[b.cls]?.ranged;
        this.botMove(b, tgt, (ranged ? 12 : 2.2) + this.rad(tgt) * 0.7, 1, tgt);
        if (!b.cast && this.time >= b.gcd && !this.hasCC(b, 'stun')) { const c = this.botChooseSkill(b, b, tgt); if (c) this.on_cast(b, c); }
        return;
      }
      if (this.time - b.combatT >= 5 && b.hp < b.maxHp * 0.7) { if (!b.eating) { b.eating = this.time; b.eatAmt = 0.3; } b.speed = 0; return; }
      if (dist(g.G, b) > g.G.r + 6) { this.mindGo(b, g.G, g.G.r * 0.5, dt, 0.8); return; }
      this.mindWander(b, g.G, dt);
      return;
    }
    if (g.dest) { if (this.mindGo(b, g.dest, g.stop ?? 2, dt, g.kind === 'logoff' || g.kind === 'rest' ? 0.62 : 0.85)) this.mindArrive(b, g); return; }
    b.speed = 0;
  },
  mindFight(b, g) {
    const A = b.ai;
    A.t -= this.lastDt || 0.05;
    if (A.t <= 0) {
      A.t = 0.4;
      const cur = b.target ? this.mobs.get(b.target) : null;
      const engaged = (m) => m && !m.dead && (m.target === b.id || m.threat.has(b.id));
      const chosen = cur && !cur.dead && this.time - (A.pickT || 0) < 14;
      if (!engaged(cur) && !chosen) {
        if (cur?.dead) A.nextFight = this.time + R(6, 20);
        b.target = null;
        if (this.time - b.combatT < 3) for (const m of this.mobs.values()) if (engaged(m) && dist(m, b) < 30) { b.target = m.id; break; }
        if (!b.target && b.hp > b.maxHp * 0.75 && !b.eating && this.time > (A.nextFight || 0) && dist(g.G, b) < g.G.r + 30) {
          let best = null, bd = 40;
          for (const m of this.groundMobs(g.G)) {
            if (m.dead || m.def.dummy || (!g.boss && (m.def.elite || m.def.boss || m.def.rare)) || !g.fight(m)) continue;
            let human = false; for (const id of m.threat.keys()) if (!this.players.get(id)?.bot) { human = true; break; }
            if (human && !g.boss) continue;
            const d = dist(m, b); if (d < bd) { bd = d; best = m; }
          }
          if (best && (g.boss || rand() < 0.5)) { b.target = best.id; A.pickT = this.time; }
        }
      }
    }
    return b.target ? this.foeOf(b, b.target) : null;
  },
  mindWander(b, G, dt) {
    const A = b.ai;
    if (!A.wp || Math.hypot(A.wp.x - b.x, A.wp.z - b.z) < 1.2) {
      A.pause = (A.pause ?? 0) - dt;
      if (A.wp && A.pause > 0) { b.speed = 0; return; }
      for (let t = 0; t < 8; t++) { const a = R(0, 6.28), d = Math.sqrt(R()) * G.r; A.wp = { x: G.x + Math.cos(a) * d, z: G.z + Math.sin(a) * d }; if (!houseAt(A.wp.x, A.wp.z) && !houseCrosses(b.x, b.z, A.wp.x, A.wp.z) && worldGap(A.wp.x, A.wp.z) < -1) break; }
      A.pause = R(1, 6);
    }
    this.botMove(b, A.wp, 0.3, 0.62);
  },
  // walk to a spot along a path (asked from botpath, one search per tick for everyone); true on arrival
  mindGo(b, dest, stop, dt, mul, coarse) {
    const M = b.mind;
    const d = Math.hypot(dest.x - b.x, dest.z - b.z);
    if (d <= stop) { b.speed = 0; return true; }
    let P = M.path;
    if (!P || P.dest !== dest) {
      if (P?.cb) this.botPaths.cancel(P.cb);
      P = M.path = { dest, pts: null, i: 1, wait: true, cb: null, t: this.time, x: b.x, z: b.z, re: 0 };
      P.cb = (pts) => { if (M.path !== P) return; P.pts = pts || [[b.x, b.z], [dest.x, dest.z]]; P.wait = false; P.i = 1; };
      this.botPaths.request(b.x, b.z, dest.x, dest.z, P.cb);
    }
    if (P.wait) { b.speed = 0; return false; }
    if (b.cast || this.hasCC(b, 'stun') || this.hasCC(b, 'root')) { b.speed = 0; return false; }
    let len = CLASSES[b.cls].speed * mul * dt;
    while (len > 0.001) {
      const last = P.i >= P.pts.length - 1;
      const wp = P.i < P.pts.length ? { x: P.pts[P.i][0], z: P.pts[P.i][1] } : dest;
      const dw = Math.hypot(wp.x - b.x, wp.z - b.z), s = last ? Math.max(0, dw - stop * 0.5) : dw;
      if (s < 0.05) { if (P.i < P.pts.length) { P.i++; continue; } break; }
      const step = Math.min(s, len);
      let nx = b.x + ((wp.x - b.x) / dw) * step, nz = b.z + ((wp.z - b.z) / dw) * step;
      [nx, nz] = housePush(nx, nz, 0.4);
      if (worldGap(nx, nz) > -0.6) { M.stuck = (M.stuck || 0) + 1; break; } // never off the walkable edge
      b.ry = Math.atan2(wp.x - b.x, wp.z - b.z);
      b.x = nx; b.z = nz; len -= step;
      if (step >= s - 1e-3) { if (P.i < P.pts.length) P.i++; else break; }
    }
    b.y = walkHeight(b.x, b.z);
    b.speed = coarse ? 0 : CLASSES[b.cls].speed * mul; b.eating = 0;
    // stuck (a wall the path did not know, a partial path that ran out): ask again from here, then give up on the goal
    if (this.time - P.t > 4) {
      if (Math.hypot(b.x - P.x, b.z - P.z) < 0.5 || (P.i >= P.pts.length && Math.hypot(dest.x - b.x, dest.z - b.z) > stop + 2)) { if (++P.re > 3 && M.goal) M.goal.done = true; else { M.path = null; } }
      else { P.t = this.time; P.x = b.x; P.z = b.z; }
    }
    return Math.hypot(dest.x - b.x, dest.z - b.z) <= stop;
  },

  // ------------------------------------------------------------------ coarse detail (1 Hz): moves in steps, fights by formula
  mindCoarse(b, dt) {
    const M = b.mind, g = M.goal;
    if (!g) return;
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.03 * dt);
    if (g.fight && g.G) {
      if (dist(g.G, b) > g.G.r + 6) { this.mindGo(b, g.G, g.G.r * 0.5, dt, 0.8, true); return; }
      if (g.boss) return; // a world boss is only ever fought for real (with a human near)
      M.ttk = (M.ttk ?? R(6, 14)) - dt;
      if (M.ttk > 0) return;
      let best = null;
      for (const m of this.groundMobs(g.G)) {
        if (m.dead || m.state === 'chase' || m.def.dummy || m.def.elite || m.def.boss || m.def.rare || m.def.world || m.sp.event || !g.fight(m)) continue;
        if (m.threat.size) continue;
        best = m; if (rand() < 0.4) break;
      }
      if (!best) { M.ttk = R(4, 8); return; }
      // time to kill from the level gap; a hard fight costs some health
      M.ttk = R(10, 20) * (1 + Math.max(0, best.level - b.level) * 0.35);
      b.hp = Math.max(1, b.hp - b.maxHp * R(0.05, 0.25) * (1 + Math.max(0, best.level - b.level) * 0.3));
      b.x = best.x + R(-2, 2); b.z = best.z + R(-2, 2); [b.x, b.z] = housePush(b.x, b.z, 0.4); b.y = walkHeight(b.x, b.z);
      best.threat.set(b.id, 1);
      this.kill(best, b);
      return;
    }
    if (g.dest && this.mindGo(b, g.dest, g.stop ?? 2, dt, 0.85, true)) this.mindArrive(b, g);
  },

  // ------------------------------------------------------------------ progress (B.4)
  botKillCredit(b, m) {
    if (!b.mind) return;
    const diff = m.level - b.level;
    const grp = b.party ? Math.max(1, this.partyMembers(b).filter((q) => m.threat.has(q.id)).length) : 1;
    // a coarse fight is settled by a formula with no travel, rests or bag trips between: its XP is paced so a bot levels at
    // about persona.pace of a human (B.4); fights in full detail earn what a player would
    const pace = b.mind.lod === 'coarse' ? clamp((b.mind.persona.pace || 0.6) * 0.6, 0.2, 0.6) : 1;
    const xp = Math.round(m.def.xp * (1 + 0.15 * (m.level - 1)) * clamp(1 + diff * 0.1, 0.2, 1.5) * (grp > 1 ? 1.25 / grp : 1) * pace);
    this.giveXp(b, xp);
    for (const [qid, q] of Object.entries(b.quests)) {
      const Q = QUESTS[qid]; if (!Q) continue;
      if (Q.goal.kill === m.kind && q.n < Q.goal.n) q.n++;
      if (Q.goal.kills?.includes(m.kind) && !(q.got ||= {})[m.kind]) { q.got[m.kind] = 1; q.n = Object.keys(q.got).length; }
    }
    // a small loot roll into its own bag (never a corpse, never a human's loot)
    const T = LOOT_TABLES[m.def.loot];
    if (T) {
      b.gold += Math.round(RI(T.gold[0], T.gold[1]) * m.level * 0.6);
      const room = () => b.bag.length < BOTS_MIND.bagMax;
      for (const [id, ch] of T.items) {
        const it = ITEMS[id]; if (!it || it.stats || rand() >= ch) continue;
        if (it.slot === 'quest' && !Object.keys(b.quests).some((q) => QUESTS[q]?.goal?.item === id)) continue;
        if (room() || b.bag.some((x) => x.id === id)) this.addItem(b, { id, n: 1 });
      }
      if (room() && !m.def.dummy && rand() < 0.15) b.bag.push({ gear: rollGear(rand, m.level, { q: rand() < 0.75 ? 0 : 1, cls: b.cls, weight: CLASS_WEIGHT[b.cls] }) });
    }
    const r = this.rosterOf(b); if (r) r.prog.stats.kills++;
  },

  // ------------------------------------------------------------------ for parts A and C (D.2)
  botAvailable(b, why) {
    if (!b?.bot || b.dead || b.away || b.duel) return false;
    if (!b.mind) return true; // an old wanderer (io.bots false)
    const g = b.mind.goal;
    if (g?.kind === 'logoff' || g?.kind === 'travel' || (g?.kind === 'dungeon' && why !== 'lfg')) return false;
    if (g?.kind === 'quest' && g.stage === 'turnin' && g.dest && dist(g.dest, b) < 12) return false;
    const r = this.rosterOf(b);
    if (r && !this.playing(r, this.mindNow() + 5 * 6e4) && this.roster.filter((x) => x.b && this.players.has(x.b.id)).length > this.bots.minOnline) return false; // logging off within 5 min
    return true;
  },
  botGoal(b) {
    const g = b?.mind?.goal, z = b && b.x != null ? zoneAt(b.x, b.z)?.name : null;
    if (!g) return { kind: 'hunt', label: 'hunting', zone: z };
    return { kind: g.kind, label: g.label || g.kind, zone: z, quest: g.kind === 'quest' ? QUESTS[g.q]?.name : undefined, dungeon: g.dungeon };
  },
  botBringOnline(o = {}) {
    if (!this.roster) return null;
    const online = this.roster.filter((r) => r.b && this.players.has(r.b.id)).length;
    if (online >= this.bots.maxActive) return null;
    const L = o.level | 0;
    const c = this.roster.filter((r) => !r.ret && !(r.b && this.players.has(r.b.id)) && (!o.role || r.persona.role === o.role) && (!L || Math.abs(r.prog.level - L) <= 4))
      .sort((a, b) => Math.abs(a.prog.level - L) - Math.abs(b.prog.level - L));
    return c.length ? this.mindLogin(c[0]) : null;
  },
  botPause(b, on) {
    if (!b?.mind) return;
    b.mind.paused = !!on;
    if (on) this.mindSetGoal(b, null);
  },
  botFriends(b) {
    const r = this.rosterOf(b); if (!r) return [];
    const ids = new Set(r.prog.friends || []);
    return [...this.players.values()].filter((q) => q.mind && q !== b && ids.has(q.mind.i));
  },
  botGuildOf(b) {
    if (!b) return null;
    for (const h of this.players.values()) if (!h.bot && h.guild && (h.guild.bots || []).includes(b.name)) return h.guild.name;
    return this.rosterOf(b)?.prog.guild || null;
  },
};
