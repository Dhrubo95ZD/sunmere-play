// "Clear the Rides" (Part Fifteen, P15.3): the Russet Weald's open event while its gale blows. Mixed into the World
// (shared/sim.js), like the bot minds.
//
// When the gale is up (shared/weald.js galeState: the shared world clock, the same storm for every player) the half-cut
// standards come down one after another along their marked fall lines and lie across the rides (fallState). Each one that
// is down becomes a Fallen Standard where its line crosses the ride: an inert target (MOBS.fallenstandard) that anyone may
// cut clear. A trunk is shared work, as a world boss is: every player and bot within RIDES.range when it is cut clear gets
// the credit (and the kill's experience), with no party needed; a machine broken in the wood while the event runs counts
// to the tally the same way. The tally is zone-wide and sent to everyone in the Weald every couple of seconds (ev 'rides':
// the HUD box over the quest tracker, client/ui/ui.js; the client's wood hides each cleared trunk and shows it cut into a
// log deck beside the ride, client/game/wealdLayout.js). The Great Forwarder, while the gale blows, works up the south ride
// (its galePath) and drags the standard lying across it off onto a deck itself (no credit for that one).
// Clear every ride before the gale drops and the event is won: everyone with a share is owed a small chest at the
// Woodwrights' camp (OBJECTS o_wd_rideschest, opened with useobj; the share is kept with the save until it is taken,
// p.ridesOwed). Bots with a share are paid at once (they cannot open chests). When the gale drops with a ride still
// blocked, the trunks left are taken away (the Woodwrights clear them by hand) and nobody is owed a chest.
// Bots (docs/ai/living_bots_design.md B.3): an 'event' goal for bots of a fitting level in the Weald while it runs
// (shared/botmind.js), and A.2's world-boss invite rule (shared/botsocial.js botInviteReason).
import { MOBS, ITEMS, factionOfZone } from './data.js';
import { WEALD, galeState, fallState, fallPhase, rideAt } from './weald.js';
import { areaOf, zoneAt } from './terrain.js';

export const RIDES = {
  name: 'Clear the Rides',
  trunk: 'fallenstandard',
  trunkHp: 24000, // (about three ordinary machines' worth for one hero; quick with a few)
  range: 30, // credit for everyone this close when a trunk is cut clear or a machine broken
  idle: 20, // ... who has used a skill or taken a blow within this many seconds (no credit for a hero left standing idle)
  tallyEvery: 2, // seconds between tally updates to the wood
  forwarderReach: 7, // the Great Forwarder drags off a trunk lying this close to it
  chest: 'o_wd_rideschest',
  minLevel: 63, // bots of this level and up take the event as a goal (the wood is 65-70; the cap is 65 for now)
  reward: { gold: [160, 220], xpKills: 4, offcuts: 3, rep: 250, maxShares: 3 },
};
// the level of a trunk by the region it lies in
const ZONE_LVL = { ropewayfoot: 65, longsheds: 67, standards: 69 };
// where each fall line crosses its ride: the trunk's middle on the ride, what is cut clear (as the client's posts find it)
export const RIDE_SPOTS = WEALD.falls.map((F, i) => {
  const dx = F.x2 - F.x, dz = F.z2 - F.z, L = Math.hypot(dx, dz);
  let bx = F.x, bz = F.z, bd = 1e9;
  for (let t = 0; t <= L; t += 0.25) { const x = F.x + (dx / L) * t, z = F.z + (dz / L) * t, d = rideAt(x, z).d; if (d < bd) { bd = d; bx = x; bz = z; } }
  return { i, x: +bx.toFixed(2), z: +bz.toFixed(2), ry: Math.atan2(dx, dz), ride: rideAt(bx, bz).id, zone: null };
});
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const RI = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const inWood = (e) => areaOf(e.x, e.z) === 'weald';

export const RIDES_METHODS = {
  // twice a second: start with the gale, put each thrown standard across its ride, the Great Forwarder's own clearing, the
  // tally, the end (won when every ride is clear, lost when the gale drops first)
  tickRides(dt) {
    this.ridesAcc = (this.ridesAcc || 0) + dt;
    if (this.ridesAcc < 0.5) return;
    this.ridesAcc = 0;
    const G = WEALD.gale, t = this.time, st = galeState(t), cyc = Math.floor((t - G.t0) / G.period);
    const R = (this.rides ||= { live: null, last: null });
    if (!R.live) {
      if (R.last !== cyc && st.phase >= G.on + G.ramp && st.phase < G.off - G.ramp) this.ridesStart(cyc);
      return;
    }
    const L = R.live;
    if (cyc !== L.cyc || st.phase >= G.off) { this.ridesEnd(false); return; }
    const FS = fallState(t);
    FS.forEach((s, i) => { L.down[i] = s.down || L.cleared[i]; if (s.down && !L.cleared[i] && !L.mobs[i]) this.ridesTrunk(i); });
    this.ridesForwarder();
    if (L.cleared.every(Boolean)) { this.ridesEnd(true); return; }
    if (L.dirty || t >= L.nextTally) this.ridesTally();
  },
  ridesStart(cyc) {
    const n = WEALD.falls.length;
    this.rides.live = { cyc, t0: this.time, cleared: Array(n).fill(false), down: Array(n).fill(false), by: Array(n).fill(null), mobs: Array(n).fill(null), broken: 0, credit: new Map(), nextTally: 0, dirty: true };
    this.ridesNotice('The gale is up in the Russet Weald! When the half-cut standards come down across the rides, cut them clear before it drops: Clear the Rides!', '#ff9a40', true);
  },
  // a thrown standard lies across its ride: the trunk to cut clear
  ridesTrunk(i) {
    const L = this.rides.live, S = RIDE_SPOTS[i], lvl = ZONE_LVL[zoneAt(S.x, S.z).id] ?? 65;
    const m = this.spawnMob({ mob: RIDES.trunk, x: S.x, z: S.z, r: 0, n: 1, lvl: [lvl, lvl + 1], temp: true, rides: i });
    m.x = S.x; m.z = S.z; m.home = { x: S.x, z: S.z }; m.ry = S.ry;
    m.hp = m.maxHp = RIDES.trunkHp;
    L.mobs[i] = m.id; L.down[i] = true; L.dirty = true;
  },
  // the kill hook (sim.js kill, before the experience and loot): a trunk is shared with everyone near it; a machine broken
  // in the wood while the event runs adds to the tally and to the shares of those who broke it or stood by
  ridesKill(m, contributors) {
    const L = this.rides?.live;
    if (m.sp?.rides != null) {
      for (const q of this.players.values()) if (this.ridesHand(q, m) && !contributors.includes(q)) contributors.push(q);
      const i = m.sp.rides;
      if (!L || L.mobs[i] !== m.id || L.cleared[i]) return;
      L.cleared[i] = true; L.by[i] = 'hands'; L.dirty = true;
      for (const q of contributors) this.ridesCredit(q, 't');
      const n = L.cleared.filter(Boolean).length;
      this.ridesNotice(`A fallen standard is cut clear of the ${S_NAME(RIDE_SPOTS[i].ride)} (${n} of ${L.cleared.length} rides clear).`, '#ffe08a', false);
      return;
    }
    if (!L || m.def.inert || !inWood(m) || m.sp?.dungeon) return;
    L.broken++; L.dirty = true;
    const who = [...contributors];
    for (const q of this.players.values()) if (this.ridesHand(q, m) && !who.includes(q)) who.push(q);
    for (const q of who) this.ridesCredit(q, 'm');
  },
  // a hand on the rides: alive, connected and near, and (a player) working: a skill used or a blow taken in the last
  // RIDES.idle seconds, so a hero parked by a fall line with nobody at the keys earns no trunk, experience or share
  ridesHand(q, m) { return !q.dead && !q.held && !q.away && d2(q, m) <= RIDES.range && (q.bot || this.time - (q.combatT ?? -1e9) <= RIDES.idle); },
  ridesCredit(q, kind) {
    const L = this.rides.live, c = L.credit.get(q.id) || { t: 0, m: 0 };
    c[kind]++; L.credit.set(q.id, c);
  },
  // the Great Forwarder drags a trunk lying close to it off the ride (its own work: cleared, but nobody's share)
  ridesForwarder() {
    const L = this.rides.live;
    for (const f of this.mobs.values()) {
      if (f.kind !== 'greatforwarder' || f.dead || f.state === 'chase') continue;
      L.mobs.forEach((id, i) => {
        const m = id && this.mobs.get(id);
        if (!m || m.dead || L.cleared[i] || d2(f, m) > RIDES.forwarderReach + (f.def.radius || 0)) return;
        m.dead = true; m.hp = 0; m.respawnT = this.time; m.loot = null;
        this.broadcast({ k: 'die', id: m.id });
        L.cleared[i] = true; L.by[i] = 'forwarder'; L.dirty = true;
        this.ridesNotice(`The Great Forwarder drags the fallen standard off the ${S_NAME(RIDE_SPOTS[i].ride)} onto a new log deck.`, '#ffb070', false);
      });
    }
  },
  ridesEnd(won) {
    const R = this.rides, L = R.live;
    R.live = null; R.last = L.cyc;
    if (won) {
      this.ridesNotice('The rides are clear before the gale drops! Shed Master Ridwan has set out a chest at the Woodwrights’ camp for everyone who helped.', '#7aff7a', true);
      for (const [id, c] of L.credit) {
        const q = this.players.get(id);
        if (!q || !(c.t + c.m)) continue;
        if (q.bot) { this.ridesPayBot(q); continue; }
        const o = q.ridesOwed;
        q.ridesOwed = { k: Math.min(RIDES.reward.maxShares, (o?.k || 0) + 1), t: (o?.t || 0) + c.t, m: (o?.m || 0) + c.m };
        this.achAdd(q, 'events');
        this.msg(q, `Clear the Rides: your share is ${c.t} trunk${c.t === 1 ? '' : 's'} cut clear and ${c.m} machine${c.m === 1 ? '' : 's'} broken. Open the chest at the Woodwrights’ camp.`, '#ffe08a');
        this.pushSelf(q);
      }
    } else {
      const left = L.cleared.filter((x) => !x).length;
      this.ridesNotice(`The gale drops with ${left} ride${left === 1 ? '' : 's'} still blocked. The Woodwrights will clear the rest by hand.`, '#c8c8c8', false);
      for (const id of L.mobs) { const m = id && this.mobs.get(id); if (m && !m.dead) { m.dead = true; m.hp = 0; m.respawnT = 0; m.loot = null; this.broadcast({ k: 'die', id: m.id }); } }
    }
    this.ridesTally(L, { won: !!won, over: true });
  },
  // a bot's share, paid at once: what a chest holds, without the gear
  ridesPayBot(b) {
    const W = RIDES.reward, gold = RI(W.gold[0], W.gold[1]) * b.level;
    b.gold = (b.gold || 0) + gold;
    this.giveXp(b, this.ridesXp(b.level));
    this.botRemember?.(b, 'boss', { a: RIDES.name, ok: 1 });
    this.botsDirty = true;
  },
  ridesXp(level) { return Math.round(W_XP * (1 + 0.15 * (level - 1)) * RIDES.reward.xpKills); },
  // the chest at the camp: every share owed, then empty
  ridesChest(p, o) {
    const S = p.ridesOwed;
    if (!S?.k) return this.err(p, 'The chest is empty for you. Help clear the rides in the next gale and the Woodwrights will fill it.');
    const W = RIDES.reward, k = S.k;
    p.ridesOwed = null;
    let gold = 0; for (let i = 0; i < k; i++) gold += RI(W.gold[0], W.gold[1]) * p.level;
    p.gold += gold; this.achAdd(p, 'gold', gold);
    this.giveXp(p, this.ridesXp(p.level) * k);
    this.giveOrPost(p, { id: 'wd_oakoffcut', n: W.offcuts * k }, 'The Woodwrights');
    for (let i = 0; i < k; i++) this.giveOrPost(p, { gear: this.dropGear(this.makeGear(p.level + 1, 2, p.cls, 'elite'), false) }, 'The Woodwrights');
    this.addRep(p, factionOfZone('ropewayfoot'), W.rep * k);
    this.msg(p, `The Woodwrights’ chest: ${gold} copper, ${W.offcuts * k} ${ITEMS.wd_oakoffcut.name}s and ${k === 1 ? 'a piece' : k + ' pieces'} of gear for your work on the rides.`, '#ffe08a');
    p.session.send({ t: 'ev', list: [{ k: 'useobj', id: p.id, obj: o.id }] });
    this.pushSelf(p);
  },
  // the zone-wide tally, to every player in the wood (each with their own share)
  ridesTally(L = this.rides?.live, end = null) {
    if (!L) return;
    L.dirty = false; L.nextTally = this.time + RIDES.tallyEvery;
    const st = galeState(this.time);
    const base = { k: 'rides', on: !end, won: end?.won || false, cl: L.cleared.map((x, i) => (x ? (L.by[i] === 'forwarder' ? 2 : 1) : 0)), dn: L.down.map((x) => (x ? 1 : 0)), br: L.broken, left: Math.max(0, Math.round(st.toCalm)), n: [...L.credit.values()].filter((c) => c.t + c.m).length };
    for (const p of this.players.values()) {
      if (p.bot || !inWood(p)) continue;
      const c = L.credit.get(p.id);
      p.session.send({ t: 'ev', list: [{ ...base, you: c ? [c.t, c.m] : [0, 0] }] });
    }
  },
  ridesNotice(text, color, banner) {
    for (const p of this.players.values()) {
      if (p.bot || !inWood(p)) continue;
      p.session.send({ t: 'ev', list: [banner ? { k: 'yell', text } : { k: 'msg', text, color }] });
    }
  },
  // test option (/gale): the world clock on to the next gale's start ('down': to just after the first standard is down; a
  // number n: to just after the n-th is down; 'cut': the trunk nearest you cut clear at once, by you)
  ridesGaleNow(arg, me) {
    if (arg === 'cut') { const m = me && this.ridesTarget(me); if (m && d2(m, me) <= RIDES.range) { m.hp = 0; this.kill(m, me); } return; }
    const G = WEALD.gale, k = /^\d+$/.test(arg || '') ? Math.max(0, Math.min(WEALD.falls.length, +arg) - 1) : arg === 'down' ? 0 : -1;
    const ph = k >= 0 ? fallPhase(k) + G.fall + 0.002 : G.on + G.ramp + 0.002;
    const p = ((((this.time - G.t0) / G.period) % 1) + 1) % 1;
    this.time += ((((ph - p) % 1) + 1) % 1) * G.period;
  },
  // bots (B.3 'event'): the nearest trunk still across a ride, for a bot in the wood while the event runs
  ridesTarget(b) {
    const L = this.rides?.live;
    if (!L || !inWood(b)) return null;
    let best = null, bd = 1e9;
    for (const id of L.mobs) { const m = id && this.mobs.get(id); if (!m || m.dead) continue; const d = d2(m, b); if (d < bd) { bd = d; best = m; } }
    return best;
  },
};
// the experience of one ordinary machine of the wood, per level (a share is worth RIDES.reward.xpKills of them)
const W_XP = MOBS.feller?.xp || 4250;
const S_NAME = (id) => (id === 'main' ? 'main ride' : id && id[0] === 'n' ? 'north ride' : id && id[0] === 's' ? 'south ride' : 'ride');
