// "The Ram Engine" (look-and-feel pass LF.6): an open event on the Harrow Coast, south of Harrowmouth (levels 28-30). Mixed
// into the World (shared/sim.js), like Clear the Rides (shared/rides.js).
//
// The story: a rogue Makers' machine, the Wall-Layer, has walled itself into an old Makers' yard below the cliffs south of
// Harrowmouth and lays course on course of new wall round it. Yard-Engineer Yusuf keeps the Makers' tracked ram engine
// at the head of the yard road. On the world clock (RAM.clock: the same for every player) his crew raises steam and the
// engine is anyone's to work: it runs up the road, breaks the yard gate and the inner gate with its ram head, and then
// the Wall-Layer itself, which has to be fought down by hand with the ram's help.
// Roles, worked by anyone nearby with no party needed:
//   - one driver at the levers on the engine's back platform (forward, back, turn; strikes the ram);
//   - loaders, who carry square iron ram weights and sacks of steam coal from the piles by the road to the engine: the ram
//     strikes only when a weight is loaded, and the engine moves only while it has steam;
//   - everyone else fights the Yard Menders that come out of the yard to batter the engine, and repairs the engine (it has
//     health; at none it stalls until it is repaired to RAM.engine.stallAt).
// Server-authoritative: the client sends { t: 'ram', op } and draws what ev 'ram' says (client/game/ramEvent.js).
// The tally reaches everyone within RAM.near of the yard road (ev 'ram', ten times a second while it runs), each with
// their own part; a share needs real work (driving, loading, a strike, a repair, or a machine broken while at work near
// the engine): a hero left standing by it gets nothing. Win: the Wall-Layer broken before the time runs out, and everyone
// with a share is owed a chest at the engine's park (o_hm_ramchest, kept with the save until opened, p.ramOwed). Bots
// with a share are paid at once. Bots (docs/ai/living_bots_design.md B.3): an 'event' goal (ev 'ram', shared/botmind.js)
// for bots of a fitting level in the valley, where they load, repair and fight, and one takes the levers when nobody has
// held them for a few seconds.
// Content rules: everything here is a machine; no war on people. The engine and the yard are square from above (solid
// disc wheels and rollers, a square timber frame, a square ram head on parallel slides, flat lintels, no arches or X
// bracing).
import { MOBS, factionOfZone } from './data.js';
import { worldGap, walkHeight } from './terrain.js';

export const RAM = {
  name: 'The Ram Engine',
  zone: 'harrowcoast',
  // the world clock: a run every `period` seconds from t0, open for `dur`; the crew raises steam `warn` seconds before
  clock: { t0: 300, period: 1800, dur: 600, warn: 120 },
  near: 260, // players this close to the yard road hear of it and get the tally
  site: { x: 360, z: 158 },
  park: { x: 360, z: 124, ry: 0 }, // where the engine stands between runs (ry 0: its ram faces south, +z, down the road)
  // the piles by the road: square iron ram weights, sacks of steam coal (at the park, and a forward stack half way)
  piles: [
    { id: 'pw1', kind: 'weight', x: 352.5, z: 126 }, { id: 'pc1', kind: 'coal', x: 367.5, z: 126 },
    { id: 'pw2', kind: 'weight', x: 349.5, z: 153 }, { id: 'pc2', kind: 'coal', x: 370.5, z: 153 },
  ],
  // the old Makers' yard below the cliffs: a square wall (t thick, h high) and an inner wall across it; both gates 6 m wide
  yard: { x0: 343, x1: 377, z0: 170, z1: 200, t: 1.2, h: 4.2, inner: 185 },
  gates: [
    { id: 'outer', name: 'the yard gate', x: 360, z: 170, w: 6, hp: 3 },
    { id: 'inner', name: 'the inner gate', x: 360, z: 185, w: 6, hp: 3 },
  ],
  boss: { mob: 'walllayer', x: 360, z: 193, r: 2.9, strike: 0.12 }, // a ram strike takes `strike` of its health
  engine: {
    hp: 2400, fwd: 2.6, back: 1.2, turn: 0.6, halfW: 1.5, halfL: 2.8, reach: 1.4,
    steamMax: 100, steamStart: 60, steamPerM: 1.1, steamPerRad: 2, coal: 35,
    weightsMax: 3, weightsStart: 1, strikeSteam: 12, strikeCd: 3,
    repair: 45, repairCd: 1.5, stallAt: 0.3, inputTtl: 1.2,
    hand: 3.4, // how close to the engine's side you must stand to load or repair it
    lever: 0.8, // the driver stands this far behind the back of the frame
  },
  defenders: { mob: 'yardmender', first: 18, every: 26, base: 2, perHand: 0.5, most: 5, max: 10, hit: 16, lvl: [29, 31], spots: [[349, 166.5], [371, 166.5]] },
  range: 30, // credit for those this close to the engine when a machine is broken
  idle: 20, // ... who have used a skill, taken a blow or worked the engine within this many seconds
  chest: 'o_hm_ramchest',
  botLevel: [24, 40], // roster bots of these levels take the event as a goal
  botDriveWait: 6, // a bot takes the free levers after this many seconds with no driver
  idleDriver: 30, // a player may take the levers from a player who has not worked them (moved, struck) for this long
  // a share: xpKills on-level Yard Menders' worth; gold, experience and gear are reckoned at most at `top` (the event's
  // level), so heroes far above the coast cannot farm it for their own level's pay (P15.7: no faster experience)
  reward: { gold: [160, 220], xpKills: 4, rep: 250, maxShares: 3, top: 30 },
};

// the world clock: is a run on, how long it has left, how long to the next start
export function ramClock(t) {
  const C = RAM.clock, u = t - C.t0;
  if (u < 0) return { cyc: -1, on: false, left: 0, toStart: -u };
  const cyc = Math.floor(u / C.period), ph = u - cyc * C.period;
  return { cyc, on: ph < C.dur, left: Math.max(0, C.dur - ph), toStart: C.period - ph };
}

// the yard's walls as boxes [x0, x1, z0, z1] (the client builds and collides with the same list): the north wall with the
// yard gate's gap and its two square gate towers, the side and south walls, the inner wall with its gap and two square posts
export function ramWalls() {
  const Y = RAM.yard, t = Y.t, [A, B] = RAM.gates, ha = A.w / 2, hb = B.w / 2;
  return [
    { id: 'n1', x0: Y.x0, x1: A.x - ha, z0: Y.z0, z1: Y.z0 + t }, { id: 'n2', x0: A.x + ha, x1: Y.x1, z0: Y.z0, z1: Y.z0 + t },
    { id: 'w', x0: Y.x0, x1: Y.x0 + t, z0: Y.z0, z1: Y.z1 }, { id: 'e', x0: Y.x1 - t, x1: Y.x1, z0: Y.z0, z1: Y.z1 },
    { id: 's', x0: Y.x0, x1: Y.x1, z0: Y.z1 - t, z1: Y.z1 },
    { id: 'i1', x0: Y.x0 + t, x1: B.x - hb, z0: Y.inner, z1: Y.inner + t }, { id: 'i2', x0: B.x + hb, x1: Y.x1 - t, z0: Y.inner, z1: Y.inner + t },
    { id: 'ta', tower: true, x0: A.x - ha - 2.4, x1: A.x - ha, z0: Y.z0 - 1.2, z1: Y.z0 + t + 1.2 }, { id: 'tb', tower: true, x0: A.x + ha, x1: A.x + ha + 2.4, z0: Y.z0 - 1.2, z1: Y.z0 + t + 1.2 },
    { id: 'pa', post: true, x0: B.x - hb - 1.2, x1: B.x - hb, z0: Y.inner - 0.2, z1: Y.inner + t + 0.2 }, { id: 'pb', post: true, x0: B.x + hb, x1: B.x + hb + 1.2, z0: Y.inner - 0.2, z1: Y.inner + t + 0.2 },
  ];
}
// a gate's closed leaves as a box (the gap in its wall)
export function ramGateBox(i) { const g = RAM.gates[i], t = RAM.yard.t; return { x0: g.x - g.w / 2, x1: g.x + g.w / 2, z0: g.z, z1: g.z + t }; }

// where the engine may be: its footprint points must all lie in these boxes (the road field north of the yard, each gate's
// slot once that gate is broken, the outer and the inner court)
function ramRects(broken) {
  const Y = RAM.yard, t = Y.t, [A, B] = RAM.gates, m = 0.4;
  const R = [{ x0: 334, x1: 396, z0: 106, z1: Y.z0 - 1.2 - m }];
  if (broken[0]) R.push({ x0: A.x - A.w / 2 + m, x1: A.x + A.w / 2 - m, z0: Y.z0 - 2, z1: Y.z0 + t + 2 }, { x0: Y.x0 + t + m, x1: Y.x1 - t - m, z0: Y.z0 + t + m, z1: Y.inner - m });
  if (broken[0] && broken[1]) R.push({ x0: B.x - B.w / 2 + m, x1: B.x + B.w / 2 - m, z0: Y.inner - 2, z1: Y.inner + t + 2 }, { x0: Y.x0 + t + m, x1: Y.x1 - t - m, z0: Y.inner + t + m, z1: Y.z1 - t - m });
  return R;
}
const fw = (ry) => [Math.sin(ry), Math.cos(ry)];
// the engine's footprint: its four corners, the middle of each side and its middle
export function ramFootprint(x, z, ry) {
  const E = RAM.engine, [fx, fz] = fw(ry), rx = fz, rz = -fx, out = [];
  for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) out.push([x + fx * E.halfL * a + rx * E.halfW * b, z + fz * E.halfL * a + rz * E.halfW * b]);
  return out;
}
export function ramFits(x, z, ry, broken, boss) {
  const R = ramRects(broken);
  for (const [px, pz] of ramFootprint(x, z, ry)) {
    if (!R.some((r) => px >= r.x0 && px <= r.x1 && pz >= r.z0 && pz <= r.z1)) return false;
    if (worldGap(px, pz) > -1) return false;
    if (boss && Math.hypot(px - boss.x, pz - boss.z) < RAM.boss.r) return false;
  }
  return true;
}
// the driver's spot on the back platform, the ram head's striking point, and the distance from a point to the engine's frame
export function ramLever(E) { const [fx, fz] = fw(E.ry), k = RAM.engine.halfL + RAM.engine.lever; return { x: E.x - fx * k, z: E.z - fz * k }; }
export function ramHead(E) { const [fx, fz] = fw(E.ry), k = RAM.engine.halfL + RAM.engine.reach; return { x: E.x + fx * k, z: E.z + fz * k }; }
export function ramEdgeDist(E, x, z) {
  const [fx, fz] = fw(E.ry), dx = x - E.x, dz = z - E.z, a = dx * fx + dz * fz, b = dx * fz - dz * fx;
  const ox = Math.max(0, Math.abs(a) - RAM.engine.halfL), oz = Math.max(0, Math.abs(b) - RAM.engine.halfW);
  return Math.hypot(ox, oz);
}

const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const RI = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LOAD_NAME = { weight: 'a ram weight', coal: 'a sack of steam coal' };

export const RAM_METHODS = {
  // the engine (one per world): where it stands, its health, steam and weights, its driver and the gates
  ramE() {
    const R = (this.ram ||= { live: null, last: null, warned: null, sendT: 0, E: null });
    if (!R.E) { const P = RAM.park, E = RAM.engine; R.E = { x: P.x, z: P.z, ry: P.ry, hp: E.hp, st: E.steamStart, w: E.weightsStart, dr: null, freeT: -1e9, in: { f: 0, t: 0 }, inT: -1e9, v: 0, cdT: 0, seq: 0, stall: false, gates: RAM.gates.map((g) => g.hp), resetT: null }; }
    return R.E;
  },
  // every tick: the clock (start, warning, end), the driver and the engine's motion, the Yard Menders, the tally
  tickRam(dt) {
    const E = this.ramE(), R = this.ram, C = ramClock(this.time), t = this.time;
    if (!R.live) {
      if (C.on && R.last !== C.cyc && C.left > 30) this.ramStart(C.cyc);
      else if (!C.on && C.toStart <= RAM.clock.warn && R.warned !== C.cyc + 1) { R.warned = C.cyc + 1; this.ramNotice('South of Harrowmouth, Yard-Engineer Yusuf’s crew is raising steam in the Ram Engine. In two minutes it is anyone’s to drive against the Wall-Layer’s yard.', '#ffc070', false); }
      if (E.resetT != null && t >= E.resetT) this.ramReset();
    } else {
      const L = R.live;
      if (L.won) { this.ramEnd(true); return; }
      if (!C.on || C.cyc !== L.cyc) { this.ramEnd(false); return; }
      this.ramDrive(dt);
      if (t >= L.nextWave) this.ramWave();
      if (L.bossId) { const m = this.mobs.get(L.bossId); if (m && !m.dead) { m.home = { x: m.x, z: m.z }; } }
    }
    // the tally: ten times a second while it runs (the engine's pose), every two seconds while it stands
    R.sendT -= dt;
    if (R.sendT <= 0) { R.sendT = R.live ? 0.1 : 2; this.ramTally(); }
  },
  ramStart(cyc) {
    const E = this.ramE(), R = this.ram;
    this.ramReset();
    R.live = { cyc, t0: this.time, credit: new Map(), broken: 0, nextWave: this.time + RAM.defenders.first, mobs: new Set(), bossId: null, won: false, botDrv: null, botDrvT: 0, carry: new Map() };
    E.freeT = this.time; R.sendT = 0;
    this.ramNotice('The Ram Engine has steam up south of Harrowmouth! Drive it down the yard road, load its ram and break the Wall-Layer’s gates: anyone may take a hand.', '#ff9a40', true);
  },
  // the engine back at its park with a full frame, the gates walled up again, and nobody at the levers
  ramReset() {
    const E = this.ramE(), P = RAM.park, S = RAM.engine;
    if (E.dr) this.ramRelease(this.players.get(E.dr), null);
    Object.assign(E, { x: P.x, z: P.z, ry: P.ry, hp: S.hp, st: S.steamStart, w: S.weightsStart, dr: null, in: { f: 0, t: 0 }, inT: -1e9, v: 0, cdT: 0, stall: false, gates: RAM.gates.map((g) => g.hp), resetT: null });
  },
  ramEnd(won) {
    const R = this.ram, L = R.live, E = this.ramE();
    R.live = null; R.last = L.cyc;
    if (E.dr) this.ramRelease(this.players.get(E.dr), 'The run is over: you step down from the levers.');
    for (const q of this.players.values()) q.ramCarry = null;
    for (const id of L.mobs) { const m = this.mobs.get(id); if (m && !m.dead) { m.dead = true; m.hp = 0; m.respawnT = 0; m.loot = null; this.broadcast({ k: 'die', id: m.id }); } }
    if (won) {
      this.ramNotice('The Wall-Layer is broken and the old Makers’ yard is open! Yard-Engineer Yusuf has set out a chest by the Ram Engine’s park for everyone who worked it.', '#7aff7a', true);
      const byKey = new Map(); for (const q of this.players.values()) byKey.set(this.ramKey(q), q);
      for (const [key, c] of L.credit) {
        const q = byKey.get(key);
        if (!q || !this.ramShare(c)) continue;
        if (q.bot) { this.ramPayBot(q); continue; }
        const o = q.ramOwed;
        q.ramOwed = { k: Math.min(RAM.reward.maxShares, (o?.k || 0) + 1) };
        this.achAdd(q, 'events');
        this.msg(q, `The Ram Engine: your share is ${this.ramPart(c)}. Open Yard-Engineer Yusuf’s chest by the engine’s park.`, '#ffe08a');
        this.pushSelf(q);
      }
    } else this.ramNotice('The crew’s time is up: the Ram Engine runs out of daylight and steam before the Wall-Layer is broken. It will be towed back to its park.', '#c8c8c8', false);
    E.resetT = this.time + 45; E.in = { f: 0, t: 0 }; E.v = 0;
    this.ramTally(L, { won: !!won });
  },
  // a share needs real work: some driving, a load, a strike, a repair or a machine broken
  ramShare(c) { return c && (c.d >= 5 || c.l + c.s + c.r + c.m > 0); },
  ramPart(c) {
    const P = [];
    if (c.d >= 5) P.push(`${Math.round(c.d)} m driven`);
    if (c.l) P.push(`${c.l} load${c.l === 1 ? '' : 's'}`);
    if (c.s) P.push(`${c.s} strike${c.s === 1 ? '' : 's'}`);
    if (c.r) P.push(`${c.r} repair${c.r === 1 ? '' : 's'}`);
    if (c.m) P.push(`${c.m} machine${c.m === 1 ? '' : 's'} broken`);
    return P.join(', ') || 'nothing yet';
  },
  // the tally's key: a player by name (a hero who drops for good and joins again within the run keeps their part; the new
  // join is a new id), a bot by its id
  ramKey(q) { return q.bot ? q.id : 'n:' + String(q.name).toLowerCase(); },
  ramCredit(q, kind, n = 1) {
    const L = this.ram?.live; if (!L || !q) return;
    const k = this.ramKey(q), c = L.credit.get(k) || { d: 0, l: 0, s: 0, r: 0, m: 0 };
    c[kind] += n; L.credit.set(k, c);
    q.ramActT = this.time; q.ramWorkT = this.time;
  },
  // a hand at the engine: alive, connected and near, and working (a skill used, a blow taken or the engine worked lately)
  ramHand(q, at) {
    if (q.dead || q.held || q.away || d2(q, at) > RAM.range) return false;
    return q.bot || this.time - (q.combatT ?? -1e9) <= RAM.idle || this.time - (q.ramActT ?? -1e9) <= RAM.idle;
  },
  ramHands() { const E = this.ramE(); let n = 0; for (const q of this.players.values()) if (this.ramHand(q, E)) n++; return n; },

  // ------------------------------------------------------------------ the engine's motion
  ramDrive(dt) {
    const E = this.ramE(), S = RAM.engine, t = this.time;
    // the driver: gone, dead, away, or carried off (a recall, a teleport) frees the levers
    if (E.dr) {
      const p = this.players.get(E.dr), lv = ramLever(E);
      if (!p || p.dead || p.held || p.away || Math.hypot(p.x - lv.x, p.z - lv.z) > 8) this.ramRelease(p, p && !p.dead ? 'You are off the Ram Engine’s levers.' : null);
    }
    if (E.dr && this.players.get(E.dr)?.bot) this.ramAutopilot(this.players.get(E.dr));
    const inp = E.dr && t - E.inT < S.inputTtl ? E.in : { f: 0, t: 0 };
    let f = inp.f, tr = inp.t;
    // out of steam with the driver at the levers asking to move: the coast is told to bring coal (once until it is fed)
    if (E.st > 0) E.dryT = 0;
    else if ((f || tr) && !E.dryT) { E.dryT = t; this.ramNotice('The Ram Engine’s firebox is out of coal: it stands until someone brings steam coal from the piles by the road.', '#ffc070', false); }
    if (E.stall || E.st <= 0) { f = 0; tr = 0; }
    E.v = 0;
    if (f || tr) {
      const broken = E.gates.map((h) => h <= 0), boss = this.ramBoss();
      const sp = f > 0 ? f * S.fwd : f * S.back, nry = E.ry - tr * S.turn * dt;
      const [fx, fz] = fw(nry), nx = E.x + fx * sp * dt, nz = E.z + fz * sp * dt;
      let mx = E.x, mz = E.z, mry = E.ry;
      if (ramFits(nx, nz, nry, broken, boss)) { mx = nx; mz = nz; mry = nry; }
      else if (tr && ramFits(E.x, E.z, nry, broken, boss)) mry = nry;
      else if (f) { const [ox, oz] = fw(E.ry), tx = E.x + ox * sp * dt, tz = E.z + oz * sp * dt; if (ramFits(tx, tz, E.ry, broken, boss)) { mx = tx; mz = tz; } }
      const moved = Math.hypot(mx - E.x, mz - E.z), turned = Math.abs(mry - E.ry);
      E.st = Math.max(0, E.st - moved * S.steamPerM - turned * S.steamPerRad);
      E.v = (f < 0 ? -1 : 1) * moved / dt;
      E.x = mx; E.z = mz; E.ry = mry;
      if (moved > 0) this.ramCredit(this.players.get(E.dr), 'd', moved);
    }
    // the driver rides the back platform
    const p = E.dr && this.players.get(E.dr);
    if (p) { const lv = ramLever(E); p.x = lv.x; p.z = lv.z; p.y = this.ramY(lv.x, lv.z); p.ry = E.ry; p.speed = Math.abs(E.v); p.mounted = false; p.sit = false; }
  },
  ramY(x, z) { return walkHeight(x, z); },
  ramBoss() { const L = this.ram?.live, m = L?.bossId && this.mobs.get(L.bossId); return m && !m.dead ? m : null; },
  // the first standing gate, or the Wall-Layer, if the ram head reaches it
  ramTarget(E = this.ramE()) {
    const h = ramHead(E), [fx, fz] = fw(E.ry);
    const i = E.gates.findIndex((x) => x > 0);
    if (i >= 0) { const B = ramGateBox(i); if (fz > 0.7 && h.x >= B.x0 - 0.6 && h.x <= B.x1 + 0.6 && h.z >= B.z0 - 1.2 && h.z <= B.z1 + 0.6) return { gate: i }; return null; }
    const m = this.ramBoss();
    if (m && Math.hypot(h.x - m.x, h.z - m.z) < RAM.boss.r + 1.6 && (fx * (m.x - E.x) + fz * (m.z - E.z)) > 0) return { boss: m };
    return null;
  },

  // ------------------------------------------------------------------ what players do ({ t: 'ram', op })
  on_ram(p, m) {
    const op = m?.op;
    if (op === 'in') return this.ramInput(p, m);
    if (!this.ram?.live) return this.err(p, 'The Ram Engine is cold. Its crew raises steam on the world clock: watch the tracker near the yard road.');
    if (p.dead) return;
    if (op === 'drive') return this.ramTake(p);
    if (op === 'leave') { if (this.ramE().dr === p.id) this.ramRelease(p, 'You step down from the levers.'); return; }
    if (op === 'pick') return this.ramPick(p, m.pile);
    if (op === 'load') return this.ramLoad(p);
    if (op === 'strike') return this.ramStrike(p);
    if (op === 'repair') return this.ramRepair(p);
    if (op === 'drop') { if (p.ramCarry) { p.ramCarry = null; this.ram.live.carry.delete(p.id); } }
  },
  ramInput(p, m) {
    const E = this.ramE();
    if (E.dr !== p.id) return;
    E.in = { f: clamp(Number(m.f) || 0, -1, 1), t: clamp(Number(m.tn) || 0, -1, 1) }; E.inT = this.time;
    if (E.in.f || E.in.t) E.drAct = this.time; // (the driver is working the levers)
  },
  ramTake(p) {
    const E = this.ramE(), lv = ramLever(E);
    if (E.dr === p.id) return;
    if (Math.hypot(p.x - lv.x, p.z - lv.z) > 4) return this.err(p, 'Stand at the back of the Ram Engine to take its levers.');
    if (p.ramCarry) return this.err(p, 'Put down what you are carrying first: load it into the engine.');
    if (E.dr) {
      const d = this.players.get(E.dr);
      // a player at the levers keeps them while they work them; one who has stood idle there for RAM.idleDriver seconds
      // (away from the keys, or holding the engine up) gives them up to the next player who asks
      const idle = this.time - Math.max(E.drAct ?? -1e9, E.takeT ?? -1e9);
      if (d && !d.bot && !p.bot && idle < RAM.idleDriver) return this.err(p, `${d.name} is at the levers.`);
      if (d && d.bot && p.bot) return;
      if (d && !d.bot && p.bot && idle < RAM.idleDriver * 2) return; // (a bot never pulls a working player off: one sent to the free levers that a player took first gives up)
      if (d) this.ramRelease(d, d.bot ? null : `You stood idle at the levers: ${p.name} takes them.`); // (a bot at the levers steps down for a player)
    }
    E.dr = p.id; E.in = { f: 0, t: 0 }; E.inT = -1e9; E.takeT = this.time; E.drAct = -1e9;
    this.dismount(p, null); p.mounted = false; p.ramActT = this.time;
    this.ramLeverNotice(`${p.name} takes the Ram Engine’s levers.`);
  },
  ramRelease(p, text) {
    const E = this.ramE();
    if (!p || E.dr !== p.id) { if (!p) { E.dr = null; E.freeT = this.time; } return; }
    E.dr = null; E.freeT = this.time; E.in = { f: 0, t: 0 }; E.v = 0;
    if (!p.dead && this.players.has(p.id)) { const [fx, fz] = fw(E.ry); p.x = E.x - fz * (RAM.engine.halfW + 1.2) - fx * 1.5; p.z = E.z + fx * (RAM.engine.halfW + 1.2) - fz * 1.5; p.y = this.ramY(p.x, p.z); if (!p.bot) p.session.send({ t: 'correct', x: p.x, z: p.z }); }
    if (text && !p.bot) this.msg(p, text, '#ffe08a');
    if (this.ram?.live) this.ramLeverNotice('The Ram Engine’s levers are free: anyone at the back of the engine can take them.');
  },
  // who has the levers, told to the coast: four in a row, then one every three seconds (stepping on and off the levers in a
  // loop cannot flood everyone's chat)
  ramLeverNotice(text) {
    const E = this.ramE(), t = this.time;
    E.noteN = Math.min(4, (E.noteN ?? 4) + (t - (E.noteT ?? t)) / 3); E.noteT = t;
    if (E.noteN < 1) return;
    E.noteN -= 1;
    this.ramNotice(text, '#ffe08a', false);
  },
  ramPick(p, id) {
    const P = RAM.piles.find((x) => x.id === id) || RAM.piles.filter((x) => Math.hypot(p.x - x.x, p.z - x.z) < 3.2).sort((a, b) => d2(a, p) - d2(b, p))[0];
    if (!P || Math.hypot(p.x - P.x, p.z - P.z) > 3.2) return this.err(p, 'Too far from the piles.');
    if (this.ramE().dr === p.id) return this.err(p, 'Not from the levers.');
    if (p.ramCarry) return this.err(p, 'You are already carrying something: load it into the engine.');
    p.ramCarry = P.kind; this.ram.live.carry.set(p.id, P.kind); p.ramActT = this.time; p.mounted = false;
    if (!p.bot) this.msg(p, `You pick up ${LOAD_NAME[P.kind]}. Carry it to the Ram Engine and load it.`, '#d8d0c0');
  },
  ramLoad(p) {
    const E = this.ramE(), S = RAM.engine, k = p.ramCarry;
    if (!k) return this.err(p, 'You are carrying nothing to load. The piles of ram weights and steam coal are by the road.');
    if (ramEdgeDist(E, p.x, p.z) > S.hand) return this.err(p, 'Get closer to the Ram Engine.');
    if (k === 'weight' && E.w >= S.weightsMax) return this.err(p, 'The ram’s weight box is full.');
    if (k === 'coal' && E.st >= S.steamMax - 5) return this.err(p, 'The firebox is full.');
    if (k === 'weight') E.w++; else E.st = Math.min(S.steamMax, E.st + S.coal);
    p.ramCarry = null; this.ram.live.carry.delete(p.id);
    this.ramCredit(p, 'l');
    this.broadcast({ k: 'ramload', id: p.id, kind: k });
  },
  ramStrike(p) {
    const E = this.ramE(), S = RAM.engine, L = this.ram.live;
    if (E.dr !== p.id) return this.err(p, 'Only the driver at the levers can strike the ram.');
    E.drAct = this.time;
    if (E.stall) return this.err(p, 'The engine is stalled: it needs repairs.');
    if (this.time < E.cdT) return;
    if (E.w < 1) return this.err(p, 'The ram has no weight loaded. Loaders bring ram weights from the piles by the road.');
    if (E.st < S.strikeSteam) return this.err(p, 'Not enough steam to drive the ram. Bring steam coal.');
    const T = this.ramTarget(E);
    if (!T) return this.err(p, 'Nothing in reach of the ram head: drive it right up against the gate.');
    E.w--; E.st -= S.strikeSteam; E.cdT = this.time + S.strikeCd; E.seq++;
    this.ramCredit(p, 's');
    if (T.gate != null) {
      const i = T.gate, G = RAM.gates[i];
      E.gates[i] = Math.max(0, E.gates[i] - 1);
      if (E.gates[i] > 0) this.ramNotice(`The ram strikes ${G.name}: it cracks (${G.hp - E.gates[i]} of ${G.hp}).`, '#ffe08a', false);
      else {
        this.ramNotice(`${G.name[0].toUpperCase() + G.name.slice(1)} is broken down!${i === RAM.gates.length - 1 ? ' Behind it the Wall-Layer grinds out of its pit: break it!' : ' Drive on to the inner gate.'}`, '#ffd060', true);
        if (i === RAM.gates.length - 1) this.ramSpawnBoss();
      }
    } else {
      const m = T.boss, amt = Math.round(m.maxHp * RAM.boss.strike);
      m.hp -= amt; this.provoke(m, p, amt);
      this.broadcast({ k: 'dmg', src: p.id, tgt: m.id, amt, crit: true, skill: 'ram' });
      if (m.hp <= 0) this.kill(m, p);
    }
  },
  ramRepair(p) {
    const E = this.ramE(), S = RAM.engine;
    if (E.dr === p.id) return this.err(p, 'Step down from the levers to make repairs.');
    if (p.ramCarry) return this.err(p, 'Load what you are carrying first.');
    if (ramEdgeDist(E, p.x, p.z) > S.hand) return this.err(p, 'Get closer to the Ram Engine.');
    if (E.hp >= S.hp) return this.err(p, 'The Ram Engine needs no repairs.');
    if (this.time < (p.ramRepT || 0)) return;
    p.ramRepT = this.time + S.repairCd;
    E.hp = Math.min(S.hp, E.hp + S.repair);
    this.ramCredit(p, 'r');
    this.broadcast({ k: 'ramfix', id: p.id });
    if (E.stall && E.hp >= S.hp * S.stallAt) { E.stall = false; this.ramNotice('The Ram Engine is repaired enough to run again!', '#7aff7a', false); }
  },
  // a blow on the engine (the Yard Menders' battering)
  ramHurt(amt) {
    const E = this.ramE();
    if (E.stall) return;
    E.hp = Math.max(0, E.hp - amt);
    if (E.hp <= 0) { E.stall = true; E.v = 0; this.ramNotice('The Ram Engine is stalled, battered to a standstill! Repair it (stand by it and repair) to get it moving again.', '#ff7050', true); }
  },

  // ------------------------------------------------------------------ the Yard Menders and the Wall-Layer
  ramWave() {
    const L = this.ram.live, D = RAM.defenders, E = this.ramE();
    L.nextWave = this.time + D.every;
    let anyone = false; for (const q of this.players.values()) if (!q.dead && d2(q, E) < 80) { anyone = true; break; }
    if (!anyone) return;
    const alive = [...L.mobs].filter((id) => { const m = this.mobs.get(id); return m && !m.dead && !m.sp.rboss; }).length;
    const n = Math.min(D.max - alive, clamp(D.base + Math.floor(this.ramHands() * D.perHand), 1, D.most));
    for (let i = 0; i < n; i++) {
      const [sx, sz] = D.spots[i % D.spots.length];
      const m = this.spawnMob({ mob: D.mob, x: sx, z: sz, r: 1.5, n: 1, lvl: D.lvl, temp: true, ram: true });
      m.home = { x: E.x, z: E.z }; m.state = 'idle';
      L.mobs.add(m.id);
    }
    if (n > 0) this.ramNotice(`${n === 1 ? 'A Yard Mender comes' : n + ' Yard Menders come'} out of the yard's wicket doors to batter the Ram Engine!`, '#ff9a40', false);
  },
  ramSpawnBoss() {
    const L = this.ram.live, B = RAM.boss;
    const m = this.spawnMob({ mob: B.mob, x: B.x, z: B.z, r: 0, n: 1, temp: true, ram: true, rboss: true });
    m.x = B.x; m.z = B.z; m.home = { x: B.x, z: B.z }; m.ry = Math.PI; m.y = this.ramY(B.x, B.z);
    L.bossId = m.id; L.mobs.add(m.id);
    this.broadcast({ k: 'spawn', id: m.id });
  },
  // a Yard Mender with nobody to fight walks to the engine and batters it (sim.js tickMob); the Wall-Layer stands.
  // Each mender takes a berth beside the engine's frame (three a side, a second rank behind), lying alongside it: they
  // stand in rows parallel to the engine and point the way it points, never fanned round one point (a fan reads as rays
  // from above) and never facing in at it (a long machine either side, square to the frame, reads as a cross from above)
  ramMob(m, dt) {
    if (m.sp.rboss) { m.speed = 0; return true; }
    const L = this.ram?.live, E = L ? this.ramE() : null;
    if (!E) return false;
    m.home = { x: E.x, z: E.z };
    if (m.ramSlot == null) {
      const used = new Set(); for (const id of L.mobs) { const o = this.mobs.get(id); if (o && o !== m && !o.dead && o.ramSlot != null) used.add(o.ramSlot); }
      let k = 0; while (used.has(k)) k++; m.ramSlot = k;
    }
    const k = m.ramSlot, side = k % 2 ? 1 : -1, a = [0.2, -3.0, 3.4][Math.floor(k / 2) % 3], rank = Math.floor(k / 6);
    const [fx, fz] = fw(E.ry), off = RAM.engine.halfW + (m.def.radius || 1) + 0.5 + rank * 2.6;
    const tx = E.x + fx * a + fz * side * off, tz = E.z + fz * a - fx * side * off;
    const dd = Math.hypot(tx - m.x, tz - m.z);
    if (dd > 0.35) {
      const sp = m.def.speed * (1 - this.buffVal(m, 'slow')), step = Math.min(sp * dt, dd);
      m.x += ((tx - m.x) / dd) * step; m.z += ((tz - m.z) / dd) * step; m.speed = sp;
      m.ry = Math.atan2(tx - m.x, tz - m.z);
      m.swingT = Math.min(m.swingT, 0.6);
    } else {
      m.speed = 0;
      m.ry = E.ry; // (lengthwise, parallel to the frame: facing in at it, a pair either side read as a cross from above)
      m.swingT -= dt;
      if (m.swingT <= 0) { m.swingT = m.def.swing; this.broadcast({ k: 'mobAtk', id: m.id, tgt: null }); this.ramHurt(RAM.defenders.hit * (rank ? 0.5 : 1)); }
    }
    if (m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.02 * dt);
    return true;
  },
  // the kill hook (sim.js kill): a machine of the event broken by those at work near the engine; the Wall-Layer wins it
  ramKill(m, contributors) {
    const L = this.ram?.live;
    if (!L || !m.sp?.ram) return;
    const E = this.ramE(), who = [...contributors];
    for (const q of this.players.values()) if (!who.includes(q) && (this.ramHand(q, E) || this.ramHand(q, m))) who.push(q);
    // (fighting lately, or real work on the engine lately: picking a load up and putting it down again, or taking the
    // levers and stepping down, is not work and earns no share from others' kills)
    for (const q of who) if (this.time - (q.combatT ?? -1e9) <= RAM.idle || q.bot || this.time - (q.ramWorkT ?? -1e9) <= RAM.idle) this.ramCredit(q, 'm');
    L.mobs.delete(m.id);
    if (m.sp.rboss) { L.won = true; L.bossId = null; return; }
    L.broken++;
  },

  // ------------------------------------------------------------------ the end: shares and the chest
  ramPayBot(b) {
    const W = RAM.reward;
    b.gold = (b.gold || 0) + RI(W.gold[0], W.gold[1]) * Math.min(b.level, W.top);
    this.giveXp(b, this.ramXp(b.level));
    this.botRemember?.(b, 'boss', { a: RAM.name, ok: 1 });
    this.botsDirty = true;
  },
  // a share's experience: xpKills Yard Menders as they pay a hero of this level (a mender's own level is the event's: a
  // hero above it gets the kill's usual tenth less per level, at least a fifth; one below it is paid as for on-level kills)
  ramXp(level) { const T = RAM.reward.top, L = Math.min(level, T); return Math.round((MOBS.yardmender?.xp || 460) * (1 + 0.15 * (L - 1)) * clamp(1 + (T - level) * 0.1, 0.2, 1) * RAM.reward.xpKills); },
  ramChest(p, o) {
    const S = p.ramOwed;
    if (!S?.k) return this.err(p, 'The chest is empty for you. Work the Ram Engine on its next run and Yusuf will fill it.');
    const W = RAM.reward, k = S.k;
    p.ramOwed = null;
    let gold = 0; for (let i = 0; i < k; i++) gold += RI(W.gold[0], W.gold[1]) * Math.min(p.level, W.top);
    p.gold += gold; this.achAdd(p, 'gold', gold);
    this.giveXp(p, this.ramXp(p.level) * k);
    for (let i = 0; i < k; i++) this.giveOrPost(p, { gear: this.dropGear(this.makeGear(Math.min(p.level + 1, W.top + 1), 2, p.cls, 'elite'), false) }, 'Yard-Engineer Yusuf'); // (gear of the coast's level, never above it)
    this.addRep(p, factionOfZone(RAM.zone), W.rep * k);
    this.msg(p, `Yard-Engineer Yusuf’s chest: ${gold} copper and ${k === 1 ? 'a piece' : k + ' pieces'} of gear for your work on the Ram Engine.`, '#ffe08a');
    p.session.send({ t: 'ev', list: [{ k: 'useobj', id: p.id, obj: o.id }] });
    this.pushSelf(p);
  },
  // the state sent to everyone near the yard road (each with their own part); also after the end, once, with `end`
  ramTally(L = this.ram?.live, end = null) {
    const E = this.ramE(), C = ramClock(this.time), S = RAM.engine;
    const carry = L ? [...L.carry].filter(([id]) => this.players.has(id)).map(([id, k]) => [id, k === 'weight' ? 1 : 2]) : [];
    const dn = E.dr ? this.players.get(E.dr) : null;
    const base = { k: 'ram', on: L && !end ? 1 : 0, x: +E.x.toFixed(2), z: +E.z.toFixed(2), ry: +E.ry.toFixed(3), v: +E.v.toFixed(2), hp: Math.round(E.hp), mh: S.hp, st: Math.round(E.st), w: E.w, dr: E.dr, dn: dn?.name || null, db: dn?.bot ? 1 : 0, stall: E.stall ? 1 : 0, sq: E.seq, g: E.gates, gm: RAM.gates.map((g) => g.hp), boss: L?.bossId || null, reach: L && this.ramTarget(E) ? 1 : 0, left: L ? Math.round(C.left) : 0, next: Math.round(C.toStart), br: L?.broken || 0, cr: carry, n: L ? [...L.credit.values()].filter((c) => this.ramShare(c)).length : 0, cd: Math.max(0, +(E.cdT - this.time).toFixed(1)) };
    if (end) { base.end = 1; base.won = end.won ? 1 : 0; }
    for (const p of this.players.values()) {
      if (p.bot || d2(p, RAM.site) > RAM.near) continue;
      const c = L?.credit.get(this.ramKey(p));
      p.session.send({ t: 'ev', list: [{ ...base, you: c ? [Math.round(c.d), c.l, c.s, c.r, c.m] : [0, 0, 0, 0, 0], sh: c && this.ramShare(c) ? 1 : 0, ca: p.ramCarry === 'weight' ? 1 : p.ramCarry === 'coal' ? 2 : 0 }] });
    }
  },
  ramNotice(text, color, banner) {
    for (const p of this.players.values()) {
      if (p.bot || d2(p, RAM.site) > RAM.near) continue;
      p.session.send({ t: 'ev', list: [banner ? { k: 'yell', text } : { k: 'msg', text, color }] });
    }
  },
  // test option (/ram): the world clock on to the next run's start ('/ram end' to just before this run's end, '/ram fill'
  // the engine's weights, steam and frame full)
  ramNow(arg) {
    const c = ramClock(this.time);
    if (arg === 'end') { if (c.on) this.time += Math.max(0, c.left - 1); return; }
    if (arg === 'fill') { const E = this.ramE(), S = RAM.engine; E.w = S.weightsMax; E.st = S.steamMax; E.hp = S.hp; E.stall = false; return; }
    if (!c.on || this.ram?.live || this.ram?.last === c.cyc) this.time += c.toStart + 0.01;
    if (this.ram) this.ram.sendT = 0;
  },

  // ------------------------------------------------------------------ bots (B.3 'event', ev 'ram')
  ramWants(b) {
    const [a, z] = RAM.botLevel;
    return !!this.ram?.live && b.level >= a && b.level <= z && !b.dead && b.x < 700 && d2(b, RAM.site) <= RAM.near && Math.abs(b.x) < 470;
  },
  // the bot's part: at the levers, loading, fetching from the piles, repairing, or fighting the Yard Menders
  ramBotCheck(b, g) {
    const L = this.ram?.live;
    if (!L) { g.done = true; b.ramCarry = null; return; }
    const E = this.ramE(), S = RAM.engine;
    const keep = (dest, x, z) => (dest && Math.hypot(dest.x - x, dest.z - z) < 1.5 ? dest : { x, z });
    const side = () => { const [fx, fz] = fw(E.ry), s = (b.id.charCodeAt(b.id.length - 1) % 2) ? 1 : -1; return { x: E.x + fz * s * (S.halfW + 1.4), z: E.z - fx * s * (S.halfW + 1.4) }; };
    const roles = { fetch: 0, repair: 0, coal: 0, weight: 0 };
    for (const q of this.players.values()) { const G = q !== b && q.mind?.goal; if (G?.ev === 'ram' && G.role) { roles[G.role] = (roles[G.role] || 0) + 1; if (G.role === 'fetch' || G.role === 'load') roles[G.load || q.ramCarry] = (roles[G.load || q.ramCarry] || 0) + 1; } }
    g.fight = null; g.G = null; g.boss = false;
    if (E.dr === b.id) { g.role = 'drive'; g.dest = null; return; }
    if (b.ramCarry) { const s = side(); g.role = 'load'; g.load = b.ramCarry; g.dest = keep(g.dest, s.x, s.z); g.stop = 1; return; }
    const lv = ramLever(E);
    let humanNear = false; for (const q of this.players.values()) if (!q.bot && !q.dead && Math.hypot(q.x - lv.x, q.z - lv.z) < 6) { humanNear = true; break; }
    if (!E.dr && this.time - E.freeT >= RAM.botDriveWait && !humanNear && (!L.botDrv || L.botDrv === b.id || this.time > L.botDrvT)) {
      L.botDrv = b.id; L.botDrvT = this.time + 20;
      g.role = 'drivego'; g.dest = keep(g.dest, lv.x, lv.z); g.stop = 1.2; return;
    }
    if ((E.stall || E.hp < S.hp * 0.55) && (roles.repair || 0) < 1 || g.role === 'repair' && E.hp < S.hp * 0.9) { const s = side(); g.role = 'repair'; g.dest = keep(g.dest, s.x, s.z); g.stop = 1; return; }
    const needW = E.w + (roles.weight || 0) < S.weightsMax - (E.gates.some((h) => h > 0) || this.ramBoss() ? 0 : 3), needC = E.st + S.coal * (roles.coal || 0) < 65;
    if ((g.role === 'fetch' && g.load) || ((needW || needC) && (roles.fetch || 0) + (roles.load || 0) < 3)) {
      const kind = g.role === 'fetch' && g.load ? g.load : needC && !(needW && (roles.coal || 0) > (roles.weight || 0)) ? 'coal' : 'weight';
      const P = RAM.piles.filter((x) => x.kind === kind).sort((a, c) => d2(a, E) - d2(c, E))[0];
      g.role = 'fetch'; g.load = kind; g.pile = P.id; g.dest = keep(g.dest, P.x, P.z); g.stop = 2.2; return;
    }
    // fight: the nearest machine of the event near the engine (the Wall-Layer once it is out)
    g.role = 'fight'; g.dest = null;
    let best = null, bd = 32;
    for (const id of L.mobs) { const m = this.mobs.get(id); if (!m || m.dead) continue; const d = Math.min(d2(m, E), d2(m, b)); if (d < bd) { bd = d; best = m; } }
    const cur = b.target && this.mobs.get(b.target);
    if (best && (!cur || cur.dead || !cur.sp?.ram)) { b.target = best.id; b.ai.pickT = this.time; }
    g.G = { x: E.x, z: E.z, r: 10, sps: [] }; g.fight = (x) => !!x.sp?.ram; g.boss = true;
  },
  ramBotArrive(b, g) {
    if (g.role === 'drivego') { this.ramTake(b); g.dest = null; if (this.ramE().dr === b.id) g.role = 'drive'; else g.role = null; return; }
    if (g.role === 'fetch') { this.ramPick(b, g.pile); g.role = b.ramCarry ? 'load' : null; g.dest = null; this.ramBotCheck(b, g); return; }
    if (g.role === 'load') { this.ramLoad(b); if (b.ramCarry) { const E = this.ramE(); if ((b.ramCarry === 'weight' && E.w >= RAM.engine.weightsMax) || (b.ramCarry === 'coal' && E.st >= RAM.engine.steamMax - 5)) { b.ramCarry = null; this.ram.live?.carry.delete(b.id); } } g.role = null; g.dest = null; return; }
    if (g.role === 'repair') { this.ramRepair(b); if (this.ramE().hp >= RAM.engine.hp * 0.9) { g.role = null; g.dest = null; } }
  },
  // a bot at the levers drives down the road to the first standing gate, then into the yard, and strikes when the ram
  // head reaches and a weight is loaded
  ramAutopilot(b) {
    const E = this.ramE(), Y = RAM.yard, S = RAM.engine;
    const i = E.gates.findIndex((h) => h > 0), boss = this.ramBoss();
    let goal;
    if (i === 0) goal = { x: RAM.gates[0].x, z: Y.z0 - 1.6 - S.halfL };
    else if (i === 1) goal = { x: RAM.gates[1].x, z: Y.inner - 0.4 - S.halfL };
    else if (boss) goal = { x: boss.x, z: boss.z - RAM.boss.r - S.halfL - 0.2 };
    else goal = { x: RAM.park.x, z: RAM.park.z };
    // into a yard gate: line up on the road's middle first
    const lane = i === 0 && E.z < Y.z0 - 14 ? { x: RAM.gates[0].x, z: Math.min(goal.z, E.z + 8) } : goal;
    const T = this.ramTarget(E);
    if (T && E.w > 0 && E.st >= S.strikeSteam && this.time >= E.cdT && !E.stall) { this.ramStrike(b); E.in = { f: 0, t: 0 }; E.inT = this.time; return; }
    const dx = lane.x - E.x, dz = lane.z - E.z, dd = Math.hypot(dx, dz);
    if (T || dd < 0.4) { E.in = { f: 0, t: 0 }; E.inT = this.time; return; }
    let a = Math.atan2(dx, dz) - E.ry; a = Math.atan2(Math.sin(a), Math.cos(a));
    E.in = { f: Math.abs(a) < 0.5 ? clamp(dd / 2, 0.3, 1) : 0, t: clamp(-a * 2.5, -1, 1) }; E.inT = this.time;
  },
};
