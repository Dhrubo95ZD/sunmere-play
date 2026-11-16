// Playing together (v113): whispers, say, the who-is-online list, friends, inspecting another player and
// player-to-player trade with both sides confirming. Installed on World.prototype by sim.js (Object.assign), so every
// method runs with `this` = the World, on the server and in the in-page offline world alike.
// Every message is checked here: names and ids, ranges, ownership of what is offered, and per-player rate limits.
// Trade is an atomic swap: each offer remembers the exact bag entry (object and count); both players confirm the same
// version of the deal; at the swap everything is checked again and the whole trade goes through or none of it does.
import { ITEMS } from './data.js';
import { zoneAt } from './terrain.js';
import { achTitle } from './achievements.js';

export const SOCIAL = {
  sayRange: 40, // m: /s reaches players this close
  inspectRange: 30,
  tradeRange: 10, // to ask for or open a trade
  tradeKeep: 14, // a trade closes when the two walk further apart than this
  tradeItems: 6, // pieces each side may offer
  askSecs: 30, // a trade request waits this long for an answer
  friendsMax: 50,
  goldMax: 1e9, // copper
};

// bots (wandering adventurers, hired companions, volunteers, escorts) are marked wherever a player name is shown, so
// real players can tell who is human. Display only: the name itself (saves, commands, guild lists, lookups) never changes.
// Real character names are letters only (server/store.js normName), so a real player can never carry the tag.
export const BOT_TAG = ' (bot)';
export const shownName = (name, bot) => (bot ? String(name ?? '') + BOT_TAG : String(name ?? ''));
// v121: how many real players and how many bots are in a who list (or a list of World players); bots never count as online
export const onlineCounts = (list) => { let real = 0, bots = 0; for (const r of list || []) if (r?.bot) bots++; else if (r) real++; return { real, bots }; };

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const cleanName = (s) => String(s ?? '').replace(/[^A-Za-z]/g, '').slice(0, 14);
const capName = (s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : '');
const cleanText = (s) => String(s ?? '').slice(0, 200).trim();
const isIdx = (v) => Number.isInteger(v) && v >= 0 && v < 1000;
const ptradeId = (() => { let n = 1; return () => 'pt' + (n++).toString(36); })();

export const SOCIAL_METHODS = {
  // ------------------------------------------------------------------ rate limits
  // a token bucket per player and kind: `burst` at once, refilled `per` a second (world clock)
  allow(p, kind, per, burst) {
    const L = (p.rl ||= {});
    const b = (L[kind] ||= { n: burst, t: this.time });
    b.n = Math.min(burst, b.n + Math.max(0, this.time - b.t) * per); b.t = this.time;
    if (b.n < 1) return false;
    b.n -= 1; return true;
  },
  // chat of any kind (world, say, whisper, party): 8 lines at once, then one a second
  chatOk(p) {
    if (p.bot) return true;
    if (this.allow(p, 'chat', 1, 8)) return true;
    if (this.time - (p.rlWarnT ?? -99) > 3) { p.rlWarnT = this.time; this.err(p, 'You are sending messages too quickly.'); }
    return false;
  },
  whereName(p) { return zoneAt(p.x, p.z)?.name || 'the valley'; },

  // ------------------------------------------------------------------ say and whisper
  say(p, text, links) {
    if (!text || !this.chatOk(p)) return;
    for (const q of this.players.values()) if (!q.bot && dist(p, q) <= SOCIAL.sayRange) q.session.send({ t: 'ev', list: [{ k: 'say', id: p.id, from: p.name, cls: p.cls, text, links }] });
  },
  on_whisper(p, m) {
    const text = cleanText(m.text);
    if (!text) return;
    const q = this.findPlayer(cleanName(m.to));
    if (!q) {
      const n = cleanName(m.to).toLowerCase(), b = n && [...this.players.values()].find((x) => x.bot && x.wander && x.name.toLowerCase() === n);
      return this.err(p, b ? `${b.name} is busy adventuring and does not answer whispers.` : `${capName(cleanName(m.to)) || 'That player'} is not online.`);
    }
    if (q === p) return this.err(p, 'You murmur to yourself.');
    if (q.held) return this.err(p, `${q.name} is away (their connection dropped). Try again in a moment.`);
    if (!this.chatOk(p)) return;
    const links = this.cleanLinks(m.links, text);
    q.lastWhisper = p.name; p.lastWhisperTo = q.name;
    q.session.send({ t: 'ev', list: [{ k: 'whisper', from: p.name, cls: p.cls, text, links }] });
    p.session.send({ t: 'ev', list: [{ k: 'whisper', to: q.name, cls: q.cls, text, links, out: 1 }] });
  },
  // the chat box: /w name text, /r text (answer whoever whispered last), /s text
  socialCommand(p, cmd, text, links) {
    if (cmd === '/w' || cmd === '/whisper' || cmd === '/t' || cmd === '/tell') {
      const rest = text.slice(cmd.length).trim(), sp = rest.indexOf(' ');
      if (sp < 1) { this.err(p, 'Use /w name message.'); return true; }
      this.on_whisper(p, { to: rest.slice(0, sp), text: rest.slice(sp + 1), links });
      return true;
    }
    if (cmd === '/r' || cmd === '/reply') {
      if (!p.lastWhisper) { this.err(p, 'No one has whispered to you yet.'); return true; }
      this.on_whisper(p, { to: p.lastWhisper, text: text.slice(cmd.length), links });
      return true;
    }
    if (cmd === '/s' || cmd === '/say') { this.say(p, cleanText(text.slice(cmd.length)), links); return true; }
    if (cmd === '/friend' || cmd === '/addfriend') { this.on_friend(p, { op: 'add', name: text.slice(cmd.length).trim() }); return true; }
    if (cmd === '/unfriend' || cmd === '/removefriend') { this.on_friend(p, { op: 'remove', name: text.slice(cmd.length).trim() }); return true; }
    if (cmd === '/friends') { this.on_friend(p, { op: 'list' }); return true; }
    if (cmd === '/promote') { this.promote(p, text.slice(cmd.length).trim()); return true; }
    if (cmd === '/inspect') { const q = this.findPlayer(cleanName(text.slice(cmd.length))); if (!q) this.err(p, 'Inspect whom?'); else this.on_inspect(p, { id: q.id }); return true; }
    if (cmd === '/trade') { const q = this.findPlayer(cleanName(text.slice(cmd.length))); if (!q) this.err(p, 'Trade with whom?'); else this.on_ptrade(p, { op: 'ask', id: q.id }); return true; }
    return false;
  },

  // ------------------------------------------------------------------ party leader
  promote(p, name) {
    const P = this.partyOf(p), q = this.findPlayer(cleanName(name));
    if (!P || P.leader !== p.id) return this.err(p, 'Only the party leader can do that.');
    if (!q || q.party !== P.id || q === p) return this.err(p, 'Promote whom?');
    P.leader = q.id;
    for (const r of this.partyMembers(p)) if (!r.bot) this.msg(r, `${q.name} now leads the party.`, '#7ab0ff');
    this.partyChanged(P);
  },

  // ------------------------------------------------------------------ who is online
  on_who(p, m) {
    if (!this.allow(p, 'who', 0.5, 3)) return;
    // v121 the "N online" badge by the minimap: count only (no list), cheap enough to ask every few seconds
    if (m?.count) {
      const c = onlineCounts([...this.players.values()].filter((q) => !q.bot || q.wander));
      return p.session.send({ t: 'who', count: 1, n: c.real, bots: c.bots });
    }
    const f = cleanName(m?.q).toLowerCase(), friends = new Set((p.friends || []).map((n) => n.toLowerCase()));
    const list = [];
    for (const q of this.players.values()) {
      if (q.bot && !q.wander) continue;
      if (f && !q.name.toLowerCase().includes(f)) continue;
      list.push({ id: q.id, name: q.name, cls: q.cls, level: q.level, where: this.whereName(q), guild: q.guild?.name || undefined, party: !!(p.party && q.party === p.party) || undefined, friend: friends.has(q.name.toLowerCase()) || undefined, bot: q.bot ? 1 : undefined });
    }
    list.sort((a, b) => (a.bot || 0) - (b.bot || 0) || a.name.localeCompare(b.name));
    const c = onlineCounts(list);
    p.session.send({ t: 'who', list: list.slice(0, 200), n: c.real, bots: c.bots, q: f || undefined });
  },

  // ------------------------------------------------------------------ friends (kept with the character)
  friendsView(p) {
    return (p.friends || []).map((name) => {
      const q = this.findPlayer(name);
      return q ? { name: q.name, on: 1, id: q.id, cls: q.cls, level: q.level, where: this.whereName(q) } : { name };
    }).sort((a, b) => (b.on || 0) - (a.on || 0) || a.name.localeCompare(b.name));
  },
  sendFriends(p) { if (!p.bot) p.session.send({ t: 'friends', list: this.friendsView(p) }); },
  on_friend(p, m) {
    if (p.bot || !this.allow(p, 'friend', 1, 6)) return;
    p.friends = Array.isArray(p.friends) ? p.friends : [];
    const name = capName(cleanName(m?.name));
    if (m?.op === 'add') {
      if (!name) return this.err(p, 'Add whom as a friend?');
      if (name === p.name) return this.err(p, 'You are already your own best friend.');
      if (p.friends.includes(name)) return this.err(p, `${name} is already on your friends list.`);
      if (p.friends.length >= SOCIAL.friendsMax) return this.err(p, 'Your friends list is full.');
      if (!this.findPlayer(name)) return this.err(p, `${name} is not online. A friend can be added while they are in the valley.`);
      p.friends.push(name);
      this.msg(p, `${name} is now on your friends list.`, '#7aff9a');
    } else if (m?.op === 'remove') {
      if (!p.friends.includes(name)) return this.err(p, `${name || 'That name'} is not on your friends list.`);
      p.friends = p.friends.filter((n) => n !== name);
      this.msg(p, `${name} is no longer on your friends list.`, '#a8a8a8');
    } else if (m?.op !== 'list') return;
    this.sendFriends(p);
  },
  // a friend comes into the valley or leaves it: a line for everyone who keeps them on their list
  friendNotice(p, on) {
    if (p.bot) return;
    for (const q of this.players.values()) if (!q.bot && q !== p && q.friends?.includes(p.name)) { this.msg(q, `Your friend ${p.name} ${on ? 'has come online' : 'has gone offline'}.`, '#7aff9a'); this.sendFriends(q); }
  },

  // ------------------------------------------------------------------ inspect
  on_inspect(p, m) {
    const q = this.players.get(String(m?.id ?? ''));
    if (!q || q === p || q.type !== 'player') return;
    if (!this.allow(p, 'inspect', 1, 4)) return;
    if (dist(p, q) > SOCIAL.inspectRange) return this.err(p, `${q.name} is too far away to inspect.`);
    const equip = {};
    for (const [s, g] of Object.entries(q.equip || {})) if (g && typeof g === 'object') equip[s] = g;
    const worn = Object.values(equip).filter((g) => g.ilvl);
    p.session.send({ t: 'inspect', id: q.id, name: q.name, bot: q.bot ? 1 : undefined, cls: q.cls, level: q.level, title: q.title ? achTitle(q.title) : q.botRole ? `<${q.botRole}>` : '', guild: q.guild?.name || '', equip, ilvl: worn.length ? Math.round(worn.reduce((a, g) => a + g.ilvl, 0) / worn.length) : 0 });
  },

  // ------------------------------------------------------------------ player-to-player trade
  tradeOf(p) { const T = p?.ptrade ? this.ptrades?.get(p.ptrade) : null; if (p && p.ptrade && !T) p.ptrade = null; return T || null; },
  tradeBusy(q) { return !q || q.bot || q.dead || !!q.held || !!q.ptrade || !!q.duel || !!q.trial; },
  // what a player may hand over: not quest items, not bound pieces, only known items
  tradable(it) {
    if (!it) return false;
    if (it.gear) return typeof it.gear === 'object' && !this.bound(it.gear);
    const d = ITEMS[it.id];
    return !!d && d.slot !== 'quest' && Number.isInteger(it.n) && it.n > 0;
  },
  tradeSend(T, why, only) {
    for (const id of [T.a, T.b]) {
      const p = this.players.get(id), q = this.players.get(id === T.a ? T.b : T.a);
      if (!p || !q || (only && p !== only)) continue;
      const mine = T.off[p.id], theirs = T.off[q.id];
      const show = (o) => o.refs.map((it, k) => ({ slot: o.slots[k], ...(it.gear ? { gear: it.gear } : { id: it.id, n: it.n }) }));
      p.session.send({ t: 'ptrade', id: T.id, v: T.v, with: q.name, wid: q.id, wcls: q.cls, why: why || undefined,
        mine: { items: show(mine), gold: mine.gold, ok: !!T.ok[p.id] }, theirs: { items: show(theirs), gold: theirs.gold, ok: !!T.ok[q.id] } });
    }
  },
  tradeEnd(T, text, done) {
    if (!this.ptrades?.has(T.id)) return;
    this.ptrades.delete(T.id);
    for (const id of [T.a, T.b]) {
      const p = this.players.get(id);
      if (!p) continue;
      if (p.ptrade === T.id) p.ptrade = null;
      p.session.send({ t: 'ptrade', id: T.id, closed: 1, done: done ? 1 : undefined });
      if (text) this.msg(p, text, done ? '#7aff9a' : '#c8b48a');
      if (done) this.pushSelf(p);
    }
  },
  tradeCancelFor(p, text) { const T = this.tradeOf(p); if (T) this.tradeEnd(T, text || `${p.name} cancels the trade.`); },
  // the offer still stands exactly as it was put up: the same bag entries, the same counts, the gold still in the purse
  offerValid(p, o) {
    if (!o) return false;
    if (!Number.isInteger(o.gold) || o.gold < 0 || o.gold > p.gold) return false;
    // (snap: a piece can change in place without leaving its slot, a gem worked free or wear, so its whole content is compared)
    return o.slots.every((i, k) => p.bag[i] === o.refs[k] && (o.refs[k].n || 0) === o.ns[k] && (!o.snap || JSON.stringify(p.bag[i]) === o.snap[k]) && this.tradable(p.bag[i]));
  },
  on_ptrade(p, m) {
    const op = m?.op;
    if (op === 'ask') {
      if (!this.allow(p, 'ptask', 0.2, 3)) return this.err(p, 'Wait a moment before asking again.');
      const q = this.players.get(String(m.id ?? ''));
      if (!q || q === p || q.type !== 'player') return this.err(p, 'Trade with whom?');
      if (q.bot) return this.err(p, `${q.name} has nothing to trade.`);
      if (this.tradeBusy(p)) return this.err(p, 'You cannot trade right now.');
      if (this.tradeBusy(q)) return this.err(p, `${q.name} is busy.`);
      if (dist(p, q) > SOCIAL.tradeRange) return this.err(p, `${q.name} is too far away to trade.`);
      q.ptAsk = { from: p.id, t: this.time + SOCIAL.askSecs };
      q.session.send({ t: 'ev', list: [{ k: 'ptradeAsk', from: p.name, cls: p.cls, id: p.id }] });
      return this.msg(p, `You ask ${q.name} to trade.`, '#ffd060');
    }
    if (op === 'reply') {
      const ask = p.ptAsk; p.ptAsk = null;
      const q = ask && this.time <= ask.t ? this.players.get(ask.from) : null;
      if (!q) return;
      if (!m.accept) return this.msg(q, `${p.name} declines to trade.`, '#c8b48a');
      if (this.tradeBusy(p) || this.tradeBusy(q)) return this.err(p, 'The trade cannot start.');
      if (dist(p, q) > SOCIAL.tradeRange) return this.err(p, `${q.name} is too far away to trade.`);
      this.ptrades ||= new Map();
      const T = { id: ptradeId(), a: q.id, b: p.id, v: 1, ok: {}, off: {} };
      for (const r of [p, q]) { T.off[r.id] = { slots: [], refs: [], ns: [], gold: 0 }; r.ptrade = T.id; }
      this.ptrades.set(T.id, T);
      return this.tradeSend(T);
    }
    const T = this.tradeOf(p);
    if (!T) return;
    if (op === 'cancel') return this.tradeEnd(T, `${p.name} cancels the trade.`);
    if (op === 'set') {
      if (!this.allow(p, 'ptset', 10, 20)) return;
      const slots = Array.isArray(m.slots) ? m.slots : [], gold = m.gold ?? 0;
      if (slots.length > SOCIAL.tradeItems) return this.err(p, `At most ${SOCIAL.tradeItems} things can change hands in one trade.`);
      if (!slots.every(isIdx) || new Set(slots).size !== slots.length) return this.err(p, 'That offer is not valid.');
      if (!slots.every((i) => i < p.bag.length)) return this.err(p, 'That offer is not valid.');
      const bad = slots.find((i) => !this.tradable(p.bag[i]));
      if (bad !== undefined) return this.err(p, p.bag[bad]?.gear ? 'That piece is bound to you and cannot be traded.' : 'That cannot be traded.');
      if (!Number.isInteger(gold) || gold < 0 || gold > SOCIAL.goldMax) return this.err(p, 'That offer is not valid.');
      if (gold > p.gold) return this.err(p, 'You do not have that much coin.');
      T.off[p.id] = { slots: [...slots], refs: slots.map((i) => p.bag[i]), ns: slots.map((i) => p.bag[i].n || 0), snap: slots.map((i) => JSON.stringify(p.bag[i])), gold };
      T.ok = {}; T.v++;
      return this.tradeSend(T);
    }
    if (op === 'ok') {
      if (!this.allow(p, 'ptok', 4, 8)) return;
      if (m.v !== T.v) return this.tradeSend(T, undefined, p); // confirming a deal that has since changed: look again (only the sender is told)
      const q = this.players.get(p.id === T.a ? T.b : T.a);
      if (!q) return this.tradeEnd(T, 'The trade is off.');
      // an offer that no longer stands (sold, used, moved, spent) is dropped back to nothing, and both must look again
      for (const r of [p, q]) if (!this.offerValid(r, T.off[r.id])) { T.off[r.id] = { slots: [], refs: [], ns: [], gold: 0 }; T.ok = {}; T.v++; this.err(r, 'Your offer changed: check the trade again.'); return this.tradeSend(T, 'changed'); }
      T.ok[p.id] = true;
      if (T.ok[T.a] && T.ok[T.b]) return this.tradeDo(T);
      return this.tradeSend(T);
    }
  },
  // both have confirmed this version: check everything once more, then swap all of it or nothing
  tradeDo(T) {
    const A = this.players.get(T.a), B = this.players.get(T.b);
    if (!A || !B || A.dead || B.dead || A.ptrade !== T.id || B.ptrade !== T.id) return this.tradeEnd(T, 'The trade is off.');
    if (dist(A, B) > SOCIAL.tradeKeep) return this.tradeEnd(T, 'You are too far apart to trade.');
    const oA = T.off[A.id], oB = T.off[B.id];
    for (const [r, o] of [[A, oA], [B, oB]]) if (!this.offerValid(r, o)) { T.off[r.id] = { slots: [], refs: [], ns: [], gold: 0 }; T.ok = {}; T.v++; this.err(r, 'Your offer changed: check the trade again.'); return this.tradeSend(T, 'changed'); }
    // room: what comes in must fit once what goes out has left (stacking only ever needs less)
    for (const [r, out, inn, other] of [[A, oA, oB, B], [B, oB, oA, A]]) {
      if (this.bagMax(r) - r.bag.length + out.slots.length < inn.slots.length) {
        T.ok = {}; T.v++;
        this.err(r, 'Your bags are too full for this trade.'); this.err(other, `${r.name}'s bags are too full for this trade.`);
        return this.tradeSend(T, 'full');
      }
    }
    if (A.gold - oA.gold + oB.gold < 0 || B.gold - oB.gold + oA.gold < 0) return this.tradeEnd(T, 'The trade is off.');
    // the swap itself: nothing below can fail, and nothing else runs in between (one message at a time)
    const take = (r, o) => [...o.slots].sort((x, y) => y - x).map((i) => r.bag.splice(i, 1)[0]);
    const gA = take(A, oA), gB = take(B, oB);
    A.gold += oB.gold - oA.gold; B.gold += oA.gold - oB.gold;
    for (const it of gB) this.addItem(A, it.gear ? { gear: it.gear } : { id: it.id, n: it.n });
    for (const it of gA) this.addItem(B, it.gear ? { gear: it.gear } : { id: it.id, n: it.n });
    const desc = (g, gold) => [...g.map((it) => (it.gear ? it.gear.name : `${it.n}x ${it.id}`)), gold ? gold + 'c' : ''].filter(Boolean).join(', ') || 'nothing';
    this.io.log?.('trade', A.name, '->', B.name, desc(gA, oA.gold), '|', B.name, '->', A.name, desc(gB, oB.gold));
    this.tradeEnd(T, 'Trade complete.', true);
    for (const r of [A, B]) this.savePlayer(r);
  },
  // twice a second: a trade between players who walked apart, died, fell into a duel or left closes
  tickSocial() {
    if (!this.ptrades?.size) return;
    for (const T of [...this.ptrades.values()]) {
      const A = this.players.get(T.a), B = this.players.get(T.b);
      if (!A || !B) this.tradeEnd(T, 'The trade is off.');
      else if (A.dead || B.dead || A.duel || B.duel) this.tradeEnd(T, 'The trade is off.');
      else if (dist(A, B) > SOCIAL.tradeKeep) this.tradeEnd(T, 'You are too far apart to trade.');
    }
  },
  loadFriends(saved) { return (Array.isArray(saved?.friends) ? saved.friends : []).map((n) => capName(cleanName(n))).filter(Boolean).slice(0, SOCIAL.friendsMax); },
};
