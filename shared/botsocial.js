// Living bots, part A: bot social behaviour and the group finder (docs/ai/living_bots_design.md, section A). Owner: Builder A.
// Installed on World.prototype by sim.js (Object.assign), so every method runs with `this` = the World, on the server and in
// the offline world alike. What is here:
// - players inviting bots (inviteBot) and bots answering, after a short wait, with a reason;
// - rare, polite bot-to-player invites (botInviteTick): only with a shared reason, after 45 s side by side, with hard rate
//   limits per player, per bot and per pair (a decline is remembered: no ask for 24 h, after two never again);
// - a bot in a party follows and fights next to the human who leads (botPartyTick, using the botFollow helper that the
//   companions and volunteers share) and leaves politely, with a line first, for a clear reason (botLeaveParty);
// - the group finder queue (on_lfg, lfgTick): 1 tank, 1 healer and 3 damage, humans first, then bots of the valley, then
//   the old volunteers, a ready check for every human, then everyone goes to the door together.
// A human always leads; a bot never leads, never claims loot and never holds /kick or /promote.
// Bots speak only through botSay (part C). When botSay does not take a line that must be said, the rule line here is sent.
import { QUESTS, MUSTER } from './data.js';
import { DUNGEON_BY_ID, DUNGEON_MIN_X, dungeonAt } from './dungeons.js';
import { areaOf } from './terrain.js';
import { mulberry32 } from './noise.js';

export const BOT_INVITE = { range: 35, seen: 45, perHuman: 1800, perHumanDay: 3, perBot: 1200, declineWait: 86400, declineMax: 2,
  every: 2, sayRange: 15, rollEvery: 60, again: 7200, levelGap: 3, bossGap: 5, bossRange: 80 };
export const LFG = { waitHumans: 90, ready: 30, every: 2, levelBand: 4, combatOut: 60 };
// a bot in a party: how far it runs before it is "on its way", when it leaves, how long its answers take
export const BOT_PARTY = { run: 150, away: [3, 8], idle: 240, levelGap: 6, wipes: 3, wipeWin: 600, lfgAfter: 10, bossWait: [20, 40],
  leaveWait: [6, 9], answer: [2, 5], ask: [5, 8], inviteGap: 8, dayNo: 3 }; // (leave and ask wait out C's typing delay, so the line is always first)
// the roles each class may queue as (A.7); every other class is damage
export const LFG_ROLES = { knight: ['tank', 'damage'], warden: ['tank', 'damage'], herbalist: ['healer', 'damage'] };
export const lfgRoles = (cls) => LFG_ROLES[cls] || ['damage'];
export const LFG_NEED = { tank: 1, healer: 1, damage: 3 };
const DAY = 86400e3;

const rand = mulberry32((Date.now() ^ 0x5bd1) & 0xffff);
const R = (a = 0, b = 1) => a + (b - a) * rand();
const pick = (L) => L[Math.floor(rand() * L.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const fill = (s, slots) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => (slots[k] != null ? String(slots[k]) : ''));
// a bot of the valley that can group with players (a wandering adventurer today, a roster bot with a mind once part B lands)
const rosterBot = (b) => !!(b && b.bot && b.wander && !b.owner && !b.escort);
const roleOf = (b) => b.mind?.persona?.role || MUSTER.roles[b.cls] || 'damage';
const socialOf = (b) => b.mind?.persona?.social ?? b.ai?.social ?? 0.4;

// rule lines for what a bot says in part A (C's botSay may phrase them; these are the fallback, checked by the filter test).
// Keyed by intent, then by reason. Plain words only: CLAUDE.md section 2 applies to every one.
export const SOC_LINES = {
  invite_ask: {
    quest: ['doing {quest} too? want to team up', 'you on {quest} as well? we could group for it', 'same job here, {quest}. group up?'],
    hunt: ['hunting here too? want to group up for a bit', 'these go quicker with two. want to group?', 'want to team up while we clear this spot?'],
    boss: ['{boss} is up. want to take it on together?', 'going for {boss}? happy to join you', 'want a hand with {boss}? I can group'],
  },
  invite_ask_note: ['sending you an invite, no pressure'],
  invite_yes: { any: ['sure, lead the way', 'yeah ok, omw', 'sounds good, count me in', 'sure thing, invite away'] },
  invite_no: {
    dungeon: ['cant right now, I am in a dungeon run', 'mid dungeon at the moment, sorry'],
    party: ['already grouped up, sorry', 'in a group already, maybe later'],
    routine: ['about to head off soon, maybe next time', 'logging off shortly, sorry'],
    level: ['our levels are a bit far apart, sorry', 'I would only slow you down, levels too far apart'],
    duel: ['in the middle of a duel, sorry'],
    spam: ['not right now, thanks though'],
    busy: ['gonna stay solo for a bit, thanks though', 'busy with my own thing right now, maybe later', 'not right now, but thanks for asking'],
    full: ['your group looks full already'],
  },
  invite_accepted: { any: ['nice, lead on', 'great, you lead', 'ok, right behind you', 'good stuff, lets go'] },
  invite_declined: { any: ['no worries', 'all good, have fun', 'np, see you around'] },
  leave: {
    quest: ['quest done for me, thanks for the group', 'that job is done, thanks for the help'],
    boss: ['gg, thanks for the help with that one', 'good fight, thanks all'],
    idle: ['gonna head off and do my own thing, thanks', 'heading back out on my own, thanks for the group'],
    level: ['you have outgrown me, thanks for the group', 'levels too far apart now, thanks for the group'],
    routine: ['gotta head off, thanks for the group', 'time for me to go, thanks all'],
    wipes: ['this is a bit much for me, heading out', 'too rough for me, heading out. thanks'],
    lfg: ['gg all, thanks for the run', 'good run, thanks all'],
    any: ['heading off, thanks for the group'],
  },
  lfg_omw: { any: ['omw', 'on my way to the door', 'coming, be right there'] },
  order_ok: { hold: ['ok, holding here', 'staying put'], assist: ['ok, following', 'right behind you'] },
};
// the {reason} slot for C's rule lines and the AI seed, in plain words
const REASON_TEXT = {
  invite_ask: { hunt: 'hunting here' },
  invite_no: { dungeon: 'in a dungeon run', party: 'already grouped', routine: 'heading off soon', level: 'levels too far apart', duel: 'in a duel', spam: 'not today', busy: 'doing my own thing', full: 'your group is full' },
  leave: { quest: 'the quest is done', boss: 'that fight is done', idle: 'going my own way', level: 'levels too far apart now', routine: 'time to head off', wipes: 'too rough for me', lfg: 'the run is done', any: 'heading off' },
};
const lineFor = (intent, why) => { const T = SOC_LINES[intent]; if (!T) return ''; if (Array.isArray(T)) return pick(T); const L = T[why] || T.any; return L ? pick(L) : ''; };

export const BOT_SOCIAL_METHODS = {
  // ------------------------------------------------------------------ shared helpers
  botRand() { return this.botRoll ? this.botRoll() : rand(); }, // (tests set world.botRoll to fix the rolls)
  botSocial() { return (this._bsoc ||= { pend: [], pairs: new Map(), invT: 0, lfgT: 0, q: [], checks: [], bigs: null, bigsT: -1e9, uid: 0 }); },
  // wall-clock milliseconds that move with the world clock (so tests can run a day in a loop and saves keep real dates)
  botWall() { if (this._wall0 == null) this._wall0 = Date.now() - this.time * 1000; return this._wall0 + this.time * 1000; },
  botPrefsOf(p) { try { return (this.botPrefs ? this.botPrefs(p) : p?.botPrefs) || {}; } catch { return {}; } },
  // what one bot remembers of one human in this part (invites, declines, last group). Merged with C's memory when it has more.
  botPair(b, p) {
    const S = this.botSocial(), key = b.name.toLowerCase() + '|' + p.name.toLowerCase();
    let r = S.pairs.get(key);
    if (!r) { r = { ask: 0, no: 0, noT: 0, yes: 0, endT: 0, refuse: [] }; S.pairs.set(key, r); }
    const k = this.botKnows?.(b, p.name)?.inv;
    if (k && (k.no || 0) > r.no) { r.no = k.no; r.noT = Math.max(r.noT, k.ask || 0); }
    return r;
  },
  // a bot speaks (through C's botSay); a line that must be said falls back to the rule line here
  socSay(b, channel, intent, ctx = {}) {
    const slots = { reason: REASON_TEXT[intent]?.[ctx.why] ?? (ctx.slots?.quest || ctx.slots?.boss || ''), ...(ctx.slots || {}) }, line = fill(lineFor(intent, ctx.why), slots);
    // (feel review) two or three bots in one party do not all say "omw" / "ok, following" / their goodbye in the same
    // breath: after the first, each of the others speaks only 1 time in 3 within 10 s (what they do is unchanged)
    if (channel === 'party' && b?.party && ['lfg_omw', 'order_ok', 'leave', 'invite_yes'].includes(intent)) {
      const M = (this.botSocial().pSaid ||= new Map()), k = b.party + ':' + intent, last = M.get(k);
      if (last != null && this.time - last < 10 && rand() < 0.67) return line;
      if (M.size > 200) M.clear();
      M.set(k, this.time);
    }
    let spoke = false;
    try { spoke = !!this.botSay?.(b, channel, intent, { ...ctx, slots: { ...slots, why: ctx.why, line }, must: ctx.must ? 1 : undefined }); } catch (e) { this.io.log?.('botSay error', e?.stack || e); }
    if (!spoke && ctx.must && line) this.socSend(b, channel, line, ctx.to);
    return line;
  },
  // deliver one bot line on a channel, to the humans who have not hidden that channel (C.11). Bot events carry bot: 1.
  socSend(b, channel, text, to) {
    if (!b || !text) return;
    const shown = (q) => q && !q.bot && !q.held && !this.botPrefsOf(q).hide?.[channel];
    const ev = (k, extra) => ({ t: 'ev', list: [{ k, from: b.name, cls: b.cls, text, bot: 1, ...extra }] });
    if (channel === 'whisper') { if (shown(to)) { to.lastWhisper = b.name; to.lastWhisperBot = b.id; to.session.send(ev('whisper')); } }
    else if (channel === 'say') { for (const q of this.players.values()) if (shown(q) && dist(q, b) <= 40) q.session.send(ev('say', { id: b.id })); }
    else if (channel === 'party') { if (b.party) for (const q of this.partyMembers(b)) if (shown(q)) q.session.send(ev('pchat')); }
    else for (const q of this.players.values()) if (shown(q)) q.session.send(ev('chat'));
  },
  botLater(at, k, o) { this.botSocial().pend.push({ at, k, ...o }); },
  partyHumans(b) { return b?.party ? this.partyMembers(b).filter((q) => !q.bot) : []; },
  partyNote(b, text) { for (const q of this.partyHumans(b)) this.msg(q, text, '#7ab0ff'); },
  findBotByName(name) { const n = String(name || '').toLowerCase(); return [...this.players.values()].find((b) => rosterBot(b) && !b.away && b.name.toLowerCase() === n) || null; },
  // is this bot free to group (its own state, plus part B's view of its plans)?
  botFreeFor(b, why) {
    if (!rosterBot(b) || b.dead || b.away || b.party || b.ai.party || b.duel || b.x >= DUNGEON_MIN_X) return false;
    if ((b.ai.lfgHold || 0) > this.time) return false;
    return this.botAvailable ? this.botAvailable(b, why) !== false : true;
  },
  // the human may be asked by a bot right now (A.2 rule 1 and 4)
  humanAskable(h) {
    if (!h || h.bot || h.held || h.dead || h.duel || h.trial || h.ptrade || h.salv || h.x >= DUNGEON_MIN_X) return false;
    if (this.time - (h.combatT ?? -1e9) < 5) return false;
    if (this.botPrefsOf(h).inv === false) return false;
    if (h.invite && this.time - h.invite.t < 60) return false;
    if (this.lfgUnitOf(h)) return false;
    const P = this.partyOf(h);
    return !(P && (P.leader !== h.id || P.members.length >= 5));
  },

  // ------------------------------------------------------------------ a player invites a bot (A.3)
  inviteBot(p, b) {
    if (!rosterBot(b) || b.away) return this.err(p, 'No one by that name is in the valley.');
    if (!this.allow(p, 'invite', 0.5, 4)) return this.err(p, 'Wait a moment before inviting again.');
    if (b.party && b.party === p.party) return this.err(p, `${b.name} is already in your party.`);
    const P = this.partyOf(p);
    if (P && P.leader !== p.id) return this.err(p, 'Only the party leader can invite.');
    if (P && P.members.length >= 5) return this.err(p, 'Your party is full.');
    const S = this.botSocial();
    if (S.pend.some((x) => x.k === 'answer' && x.b === b.id)) return this.err(p, `${b.name} is answering someone already.`);
    this.msg(p, `You invite ${b.name} to your party.`, '#7ab0ff');
    const r = this.botPair(b, p), wall = this.botWall();
    r.refuse = r.refuse.filter((t) => wall - t < DAY);
    let yes = true, why = null;
    if (b.x >= DUNGEON_MIN_X) why = 'dungeon';
    else if (b.party || b.ai.party) why = 'party';
    else if (b.duel) why = 'duel';
    else if (Math.abs(b.level - p.level) > BOT_PARTY.inviteGap) why = 'level';
    else if (r.refuse.length >= BOT_PARTY.dayNo) why = 'spam';
    else if (this.botAvailable && this.botAvailable(b, 'party') === false) why = 'routine';
    else if (this.botRand() >= ((r.yes || this.botKnows?.(b, p.name)) ? 0.95 : 0.75)) why = 'busy';
    if (why) yes = false;
    this.botLater(this.time + R(...BOT_PARTY.answer), 'answer', { b: b.id, h: p.id, yes, why });
  },
  // the answer arrives (a line first, then the party)
  botAnswer(b, h, yes, why) {
    if (!b || !h || !this.players.has(h.id)) return;
    if (yes && !this.botFreeFor(b, 'party')) { yes = false; why = b.party ? 'party' : 'busy'; }
    const P = this.partyOf(h);
    if (yes && P && (P.leader !== h.id || P.members.length >= 5)) { yes = false; why = 'full'; }
    if (!yes) {
      const r = this.botPair(b, h); r.refuse.push(this.botWall()); (this.botSocial().lastNo ||= {})[b.id] = why;
      this.socSay(b, 'whisper', 'invite_no', { to: h, why, must: 1, priority: 'whisper' });
      this.msg(h, `${b.name} declines your invitation.`, '#7ab0ff');
      this.botRemember?.(b, 'invite', { name: h.name, yes: 0, from: 'them', why });
      return;
    }
    if (!this.joinParty(h, b)) return;
    this.partyNote(b, `${b.name} joins the party.`);
    this.botJoined(b, h, 'asked');
    this.botPair(b, h).yes++;
    this.botRemember?.(b, 'invite', { name: h.name, yes: 1, from: 'them' });
    this.socSay(b, 'party', 'invite_yes', { to: h, why: 'any', must: 1, priority: 'party' });
  },

  // ------------------------------------------------------------------ bot-to-player invites (A.2)
  botInviteTick(dt) {
    const S = this.botSocial();
    if (S.pend.length) this.botPending();
    if ((S.invT += dt) < BOT_INVITE.every) return;
    const step = S.invT; S.invT = 0;
    let humans = null;
    for (const b of this.players.values()) {
      if (!rosterBot(b)) continue;
      const soc = (b.soc ||= { seen: new Map(), roll: new Map(), ask: -1e9 });
      if (b.ai.party || b.dead || b.away || b.party) { soc.seen.clear(); continue; }
      humans ||= [...this.players.values()].filter((q) => !q.bot && !q.held);
      if (!humans.length) return;
      const area = areaOf(b.x, b.z);
      for (const h of humans) {
        if (dist(h, b) <= BOT_INVITE.range && h.x < DUNGEON_MIN_X && areaOf(h.x, h.z) === area) soc.seen.set(h.id, (soc.seen.get(h.id) || 0) + step);
        else soc.seen.delete(h.id);
      }
      if (S.asked === this.time) continue; // one ask a pass, across all bots
      for (const [hid, secs] of soc.seen) {
        if (secs < BOT_INVITE.seen) continue;
        const h = this.players.get(hid);
        if (this.botWantsToAsk(b, h)) break;
      }
    }
  },
  // every condition of A.2 for one bot and one human; asks (line first, the invite a few seconds later) and returns true
  botWantsToAsk(b, h) {
    if (!this.humanAskable(h) || !this.botFreeFor(b, 'party')) return false;
    const soc = b.soc, wall = this.botWall();
    if (this.time - soc.ask < BOT_INVITE.perBot) return false;
    const hi = (h.botInv ||= { last: -1e9, day: [] });
    hi.day = hi.day.filter((t) => wall - t < DAY);
    if (this.time - hi.last < BOT_INVITE.perHuman || hi.day.length >= BOT_INVITE.perHumanDay) return false;
    const r = this.botPair(b, h);
    if (r.no >= BOT_INVITE.declineMax) return false;
    if (r.noT && wall - r.noT < BOT_INVITE.declineWait * 1000) return false;
    if (r.endT && wall - r.endT < BOT_INVITE.again * 1000) return false;
    const reason = this.botInviteReason(b, h);
    if (!reason) return false;
    // personality: most chances pass with nothing said (one roll a minute for each pair)
    if (this.time < (soc.roll.get(h.id) || 0)) return false;
    soc.roll.set(h.id, this.time + BOT_INVITE.rollEvery);
    if (this.botRand() >= socialOf(b) * 0.25) return false;
    soc.ask = this.time; hi.last = this.time; hi.day.push(wall); r.ask = wall;
    this.botSocial().asked = this.time;
    const quiet = this.botPrefsOf(h).wh === false;
    this.socSay(b, dist(b, h) <= BOT_INVITE.sayRange || quiet ? 'say' : 'whisper', 'invite_ask', { to: h, why: reason.kind, slots: reason.slots, must: 1, priority: 'whisper' });
    this.botLater(this.time + R(...BOT_PARTY.ask), 'invite', { b: b.id, h: h.id, why: reason.why, boss: reason.boss, q: reason.q });
    return true;
  },
  // a shared reason to group: the same open quest, a world boss or elite close by, or the same hunting ground (A.2 rule 3)
  botInviteReason(b, h) {
    const gap = Math.abs(b.level - h.level);
    if (gap <= BOT_INVITE.levelGap) for (const qid of Object.keys(b.quests || {})) {
      const Q = QUESTS[qid], hq = h.quests?.[qid], g = Q?.goal;
      if (!hq || !g || Q.msq || !(g.kill || g.kills || g.item || g.gather || g.use)) continue;
      if ((hq.n || 0) < (g.n || 1)) return { kind: 'quest', why: 'quest:' + qid, q: qid, slots: { quest: Q.name } };
    }
    if (gap <= BOT_INVITE.bossGap) {
      const S = this.botSocial();
      if (!S.bigs || this.time - S.bigsT > 60) { S.bigsT = this.time; S.bigs = [...this.mobs.values()].filter((m) => (m.def.world || m.def.elite) && !m.sp?.dungeon && m.x < DUNGEON_MIN_X); }
      for (const m of S.bigs) if (!m.dead && dist(m, h) < BOT_INVITE.bossRange && dist(m, b) < BOT_INVITE.bossRange) return { kind: 'boss', why: 'boss:' + m.id, boss: m.id, slots: { boss: m.def.name } };
    }
    // the same hunting ground: the bot's own ground, or any spawn ground both stand on (a bot with a mind hunts for its
    // quest or goal wherever that is, and its old wanderer ground may be far behind it)
    const on = (G, q) => Math.hypot(q.x - G.x, q.z - G.z) < G.r + 12;
    const G = gap <= BOT_INVITE.levelGap ? [b.ai.ground, ...(this.grounds || [])].find((g) => g && on(g, b) && on(g, h)) : null;
    if (G) return { kind: 'hunt', why: 'hunt', slots: {} };
    return null;
  },
  // the human's answer to a bot's invite (from on_partyReply)
  botInviteAnswer(q, b, accept) {
    if (!rosterBot(b)) return;
    const offer = b.soc?.offer?.h === q.id ? b.soc.offer : {}; if (b.soc) b.soc.offer = null;
    const r = this.botPair(b, q);
    this.botRemember?.(b, 'invite', { name: q.name, yes: accept ? 1 : 0, from: 'bot' });
    if (!accept) {
      r.no++; r.noT = this.botWall();
      if (rand() < 0.3 + socialOf(b) * 0.5) this.socSay(b, dist(b, q) <= 40 ? 'say' : 'whisper', 'invite_declined', { to: q, why: 'any' });
      return;
    }
    if (!this.botFreeFor(b, 'party')) return this.msg(q, `${b.name} has already moved on.`, '#7ab0ff');
    const P = this.partyOf(q);
    if (P && (P.leader !== q.id || P.members.length >= 5)) return this.err(q, 'Your party is full.');
    if (!this.joinParty(q, b)) return; // the human leads: a bot never leads a party
    r.yes++;
    this.partyNote(b, `${b.name} joins the party.`);
    this.botJoined(b, q, offer.why || 'hunt', { boss: offer.boss, q: offer.q });
    this.socSay(b, 'party', 'invite_accepted', { to: q, why: 'any', must: 1, priority: 'party' });
  },
  // things that happen a few seconds later: the invite after the polite line, the answer to a player's invite, leaving
  botPending() {
    const S = this.botSocial();
    for (let i = S.pend.length - 1; i >= 0; i--) {
      const x = S.pend[i];
      if (this.time < x.at) continue;
      S.pend.splice(i, 1);
      const b = this.players.get(x.b), h = this.players.get(x.h);
      if (x.k === 'answer') this.botAnswer(b, h, x.yes, x.why);
      else if (x.k === 'invite' && b && h && this.humanAskable(h) && this.botFreeFor(b, 'party')) {
        h.invite = { from: b.id, t: this.time, bot: 1 };
        b.soc.offer = { h: h.id, why: x.why, boss: x.boss, q: x.q };
        h.session.send({ t: 'ev', list: [{ k: 'invite', from: b.name, cls: b.cls, bot: 1 }] });
      }
    }
  },

  // ------------------------------------------------------------------ in the party (A.4)
  botJoined(b, h, why, o = {}) {
    b.ai.party = { id: b.party, anchor: h.id, why, since: this.time, lfg: o.lfg || null, boss: o.boss || null, q: o.q || (String(why).startsWith('quest:') ? why.slice(6) : null),
      chk: 1, lx: h.x, lz: h.z, still: 0, hub: 0, deaths: [], dead: 0, wasIn: 0, fb: null, fbAlive: 0, endT: 0, bossT: 0, leaveAt: 0 };
    b.ai.stance = 'assist'; b.ai.hold = null; b.target = null; b.ai.lfgHold = 0;
    if (b.soc) b.soc.seen.clear();
    this.botPause?.(b, true);
    // the anchor's quests that the bot can take, so kills count for both (part B gives bots their kill credit)
    let n = 0;
    for (const qid of Object.keys(h.quests || {})) {
      const Q = QUESTS[qid];
      if (n >= 3 || !Q || Q.msq || Q.daily || Q.goal?.escort || b.quests[qid] || b.done[qid]) continue;
      try { this.on_accept(b, { q: qid }); } catch { /* a quest the bot cannot take */ }
      if (b.quests[qid]) { n++; b.ai.party.q ||= qid; } // (the bot leaves once the first shared quest is handed in)
    }
    this.botRemember?.(b, 'met', { name: h.name });
  },
  botPartyTick(b, dt) {
    const S = b.ai.party;
    if (!S) return false;
    if (S.tk === this.time) return true; // (called once a tick, whichever hook gets here first)
    S.tk = this.time;
    const o = this.players.get(S.anchor), P = this.partyOf(b);
    // the anchor logged off or left the party: no line, the bot just goes
    if (!P || !o || o.bot || o.party !== b.party) { this.botFree(b, 'gone'); return false; }
    if (S.leaveAt) { if (this.time >= S.leaveAt) { this.botQuit(b); return false; } }
    else if ((S.chk -= dt) <= 0) { S.chk = 1; const why = this.botLeaveWhy(b, o, S); if (why) this.botLeaveParty(b, why); }
    this.botFollow(b, o, dt, true);
    return true;
  },
  // A.5: a clear reason to leave, checked once a second
  botLeaveWhy(b, o, S) {
    if (b.dead && !S.dead) { S.dead = 1; S.deaths.push(this.time); } else if (!b.dead) S.dead = 0;
    S.deaths = S.deaths.filter((t) => this.time - t < BOT_PARTY.wipeWin);
    if (S.deaths.length >= BOT_PARTY.wipes) return 'wipes';
    if (S.lfg) {
      const inside = o.x >= DUNGEON_MIN_X && dungeonAt(o.x, o.z)?.id === S.lfg;
      if (inside) S.wasIn = 1;
      if (!S.fb) { const k = this.finalBoss?.(S.lfg); S.fb = k ? ([...this.mobs.values()].find((m) => m.sp?.dungeon === S.lfg && m.kind === k)?.id || 'none') : 'none'; }
      const fb = this.mobs.get(S.fb);
      if (fb && !fb.dead) S.fbAlive = 1;
      if (!S.endT && ((S.wasIn && !inside) || (fb && fb.dead && S.fbAlive) || (!S.wasIn && this.time - S.since > 60))) { S.endT = this.time; S.ok = fb && fb.dead && S.fbAlive ? 1 : 0; }
      return S.endT && this.time - S.endT >= BOT_PARTY.lfgAfter ? 'lfg' : null;
    }
    if (S.q && !o.quests?.[S.q]) return 'quest';
    if (S.boss) { const m = this.mobs.get(S.boss); if (!m || m.dead) { S.bossT ||= this.time + R(...BOT_PARTY.bossWait); if (this.time >= S.bossT) return 'boss'; } }
    if (Math.abs(b.level - o.level) > BOT_PARTY.levelGap) return 'level';
    if (!b.dead && !b.away && this.botAvailable && this.botAvailable(b, 'party') === false) return 'routine';
    if (Math.hypot(o.x - S.lx, o.z - S.lz) > 3) { S.lx = o.x; S.lz = o.z; S.still = 0; } else S.still += 1;
    S.hub = this.inHub?.(o) ? S.hub + 1 : 0;
    if (S.still >= BOT_PARTY.idle || S.hub >= BOT_PARTY.idle) return 'idle';
    return null;
  },
  // leaving politely: a line first, then the party a few seconds later (part B calls this with 'routine' to log a bot off)
  botLeaveParty(b, why = 'any') {
    const S = b?.ai?.party;
    if (!S) { if (b?.party) { this.leaveParty(b, true); } return; }
    if (S.leaveAt) return;
    S.leaveAt = this.time + R(...BOT_PARTY.leaveWait); S.leaveWhy = why;
    this.socSay(b, 'party', 'leave', { why, must: 1, priority: 'party', slots: { name: this.players.get(S.anchor)?.name || '' } });
  },
  botQuit(b) {
    const S = b.ai.party;
    if (b.party) { const P = this.partyOf(b); this.leaveParty(b, true); if (P) for (const id of P.members) { const q = this.players.get(id); if (q && !q.bot) this.msg(q, `${b.name} leaves the party.`, '#7ab0ff'); } }
    this.botFree(b, S?.leaveWhy || 'any');
  },
  // the bot is on its own again: memory, the pair's "grouped lately" mark, back to its own goals
  botFree(b, why) {
    const S = b.ai.party;
    b.ai.party = null;
    if (b.party) {
      const humans = this.partyHumans(b);
      this.leaveParty(b, true);
      for (const q of humans) this.msg(q, `${b.name} leaves the party.`, '#7ab0ff');
    }
    if (S) {
      const names = Object.keys(S.names || {});
      const o = this.players.get(S.anchor);
      if (o && !o.bot) this.botPair(b, o).endT = this.botWall();
      this.botRemember?.(b, 'party', { names: o ? [o.name, ...names] : names, why: S.why, ok: why !== 'wipes' ? 1 : 0, end: why });
      if (S.lfg) this.botRemember?.(b, 'run', { a: S.lfg, names: S.runNames || (o ? [o.name] : []), ok: S.ok ? 1 : 0 });
      if (S.boss && why === 'boss') this.botRemember?.(b, 'boss', { a: S.boss, names: o ? [o.name] : [], ok: 1 });
      // out of a dungeon by its door
      if (b.x >= DUNGEON_MIN_X) { const D = DUNGEON_BY_ID[S.lfg] || dungeonAt(b.x, b.z); if (D?.door) { const a = D.door.ry; b.x = D.door.x + Math.sin(a) * 4 + R(-1, 1); b.z = D.door.z + Math.cos(a) * 4 + R(-1, 1); } else { const g = this.graveyard(b); b.x = g.x; b.z = g.z; } }
    }
    b.away = false; b.target = null; b.cast = null; b.ai.stance = undefined; b.ai.hold = null; b.ai.lastLeave = why;
    if (b.mounted) { b.mounted = false; this.broadcast({ k: 'mount', id: b.id, on: false }); }
    if (b.wander && this.grounds?.length) {
      const gs = this.huntGrounds(b.level, areaOf(b.x, b.z));
      if (gs.length) { b.ai.ground = gs.reduce((a, g) => (Math.hypot(g.x - b.x, g.z - b.z) < Math.hypot(a.x - b.x, a.z - b.z) ? g : a)); b.ai.wp = null; b.ai.moveOn = this.time + R(200, 480); }
    }
    this.botPause?.(b, false);
  },
  // the leader removed a bot (/kick): it just goes
  botKicked(p, b) {
    if (b.ai?.party) b.ai.party.leaveWhy = 'kick';
    const humans = this.partyHumans(b);
    this.leaveParty(b, true);
    for (const q of humans) this.msg(q, q === p ? `You remove ${b.name} from the party.` : `${b.name} was removed from the party.`, '#7ab0ff');
    if (b.ai?.party) this.botFree(b, 'kick');
  },
  // party-chat orders (A.3, from C's botHearParty): 'hold' stays put, 'assist' follows and fights
  botOrder(b, order) {
    const S = b?.ai?.party;
    if (!S || !['hold', 'assist', 'passive'].includes(order)) return false;
    b.ai.stance = order; b.ai.hold = order === 'hold' ? { x: b.x, z: b.z } : null;
    if (order !== 'assist') b.target = null;
    if (order === 'hold' && b.mounted) { b.mounted = false; this.broadcast({ k: 'mount', id: b.id, on: false }); }
    this.socSay(b, 'party', 'order_ok', { why: order === 'hold' ? 'hold' : 'assist', must: 1, priority: 'party' });
    return true;
  },

  // ------------------------------------------------------------------ the group finder queue (A.7)
  lfgUnitOf(p) { return p ? this.botSocial().q.find((u) => u.members.includes(p.id)) || null : null; },
  lfgCounts(u) { const c = { tank: 0, healer: 0, damage: 0 }; for (const r of Object.values(u.roles)) c[r]++; return c; },
  lfgWait() { const n = [...this.players.values()].filter((q) => !q.bot && !q.held).length; return this.tiers || n <= 1 ? 0 : LFG.waitHumans; },
  lfgView(p) {
    const u = this.lfgUnitOf(p);
    if (!u) return { queued: 0, role: p.lfgRole || MUSTER.roles[p.cls] || 'damage', roles: lfgRoles(p.cls) };
    const waited = this.time - u.since;
    return { queued: 1, id: u.dungeon, name: DUNGEON_BY_ID[u.dungeon]?.name, role: u.roles[p.id], roles: lfgRoles(p.cls), since: Math.round(waited), fillIn: Math.max(0, Math.round(this.lfgWait() - waited)), have: this.lfgCounts(u), check: u.check ? 1 : 0 };
  },
  lfgSend(p, ready) { if (p && !p.bot) p.session.send({ t: 'lfg', state: this.lfgView(p), ready }); },
  on_lfg(p, m) {
    if (!this.allow(p, 'lfg', 1, 6)) return;
    const op = String(m?.op || '');
    if (op === 'state') return this.lfgSend(p);
    if (op === 'leave') return this.lfgDrop(p, 'You leave the group finder queue.');
    if (op === 'ready') return this.lfgReady(p, !!m.accept);
    if (op !== 'join') return;
    const D = DUNGEON_BY_ID[String(m.id || '')];
    if (!D || D.open) return this.err(p, 'Choose a dungeon for the group finder.');
    if (this.lfgUnitOf(p)) return this.err(p, 'You are already in the group finder queue.');
    const P = this.partyOf(p);
    if (P && P.leader !== p.id) return this.err(p, 'Only the party leader can queue the party.');
    const members = this.partyMembers(p).filter((q) => !q.lfg); // (Bram's volunteers go home when the group goes)
    const humans = members.filter((q) => !q.bot), lo = parseInt(D.level, 10);
    for (const h of humans) {
      if (h.dead) return this.err(p, h === p ? 'You cannot queue while dead.' : `${h.name} is dead.`);
      if (h.x >= DUNGEON_MIN_X) return this.err(p, h === p ? 'Leave the dungeon first.' : `${h.name} is inside a dungeon.`);
      if (h.level < lo - 2) return this.err(p, h === p ? `${D.name} is for level ${D.level}.` : `${D.name} is for level ${D.level}: ${h.name} is too low.`);
      if (D.need?.done && !h.done?.[D.need.done]) return this.err(p, h === p ? (D.need.text || `${D.name} is shut for now.`) : `${h.name} cannot go into ${D.name} yet.`);
      if (h !== p && this.lfgUnitOf(h)) return this.err(p, `${h.name} is already queued.`);
    }
    const want = lfgRoles(p.cls).includes(m.role) ? m.role : null;
    const roleFor = (q) => (q === p && want) || (lfgRoles(q.cls).includes(q.lfgRole) ? q.lfgRole : MUSTER.roles[q.cls] || 'damage');
    const roles = {};
    for (const q of members) roles[q.id] = q.bot ? roleOf(q) : roleFor(q);
    if (want) p.lfgRole = want;
    const u = { uid: ++this.botSocial().uid, dungeon: D.id, since: this.time, members: humans.map((h) => h.id), bots: members.filter((q) => q.bot).map((q) => q.id), roles, check: null };
    const c = this.lfgCounts(u);
    if (Object.keys(LFG_NEED).some((k) => c[k] > LFG_NEED[k])) return this.err(p, 'A group finder company is 1 tank, 1 healer and 3 damage: your party has too many of one role.');
    this.botSocial().q.push(u);
    for (const h of humans) { this.msg(h, `${h === p ? 'You join' : `${p.name} puts your party in`} the group finder queue for ${D.name} as ${roles[h.id]}.`, '#7ab0ff'); this.lfgSend(h); }
  },
  // one human leaves the queue (the rest of a party stays, at its place)
  lfgDrop(p, why) {
    const S = this.botSocial(), id = typeof p === 'string' ? p : p?.id, u = S.q.find((x) => x.members.includes(id));
    if (!u) return;
    if (u.check) this.lfgCancel(S.checks.find((C) => C.id === u.check));
    u.members = u.members.filter((x) => x !== id); delete u.roles[id];
    if (!u.members.length) S.q.splice(S.q.indexOf(u), 1);
    const h = this.players.get(id);
    if (h) { if (why) this.msg(h, why, '#7ab0ff'); this.lfgSend(h); }
    for (const x of u.members) this.lfgSend(this.players.get(x));
  },
  lfgReady(p, accept) {
    const S = this.botSocial(), C = S.checks.find((c) => c.humans.includes(p.id));
    if (!C) return;
    if (!accept) return this.lfgDrop(p, 'You decline the ready check and leave the queue.');
    C.acc.add(p.id);
    if (C.humans.every((id) => C.acc.has(id))) this.lfgGo(C);
  },
  // a ready check ends without going: everyone left in it goes back to their place at the front of the queue
  lfgCancel(C) {
    const S = this.botSocial();
    if (!C || !S.checks.includes(C)) return;
    S.checks.splice(S.checks.indexOf(C), 1);
    for (const u of S.q) if (u.check === C.id) u.check = null;
    for (const id of C.bots) { const b = this.players.get(id); if (b) b.ai.lfgHold = 0; }
    for (const id of C.humans) { const h = this.players.get(id); if (h && this.lfgUnitOf(h)) { this.msg(h, 'The group did not come together. You keep your place in the queue.', '#7ab0ff'); this.lfgSend(h); } }
  },
  lfgTick(dt) {
    const S = this.botSocial();
    if ((S.lfgT += dt) < LFG.every) return;
    const step = S.lfgT; S.lfgT = 0;
    if (!S.q.length && !S.checks.length) return;
    // entries that no longer stand: logged off, in a dungeon, or in a fight for over a minute
    for (const u of [...S.q]) for (const id of [...u.members]) {
      const h = this.players.get(id);
      if (!h) { this.lfgDrop(id); continue; }
      if (h.x >= DUNGEON_MIN_X) { this.lfgDrop(h, 'You went into a dungeon, so you leave the group finder queue.'); continue; }
      if (this.time - (h.combatT ?? -1e9) < 5) { if ((h.lfgFight = (h.lfgFight || 0) + step) > LFG.combatOut) { h.lfgFight = 0; this.lfgDrop(h, 'You were fighting too long, so you leave the group finder queue.'); } }
      else h.lfgFight = 0;
    }
    for (const C of [...S.checks]) if (this.time > C.until) {
      for (const id of C.humans) if (!C.acc.has(id)) this.lfgDrop(id, 'You did not answer the ready check, so you leave the queue.');
      this.lfgCancel(C);
    }
    // the matcher, per dungeon, oldest first; parties are never split
    const byD = new Map();
    for (const u of S.q) if (!u.check) { if (!byD.has(u.dungeon)) byD.set(u.dungeon, []); byD.get(u.dungeon).push(u); }
    for (const [did, list] of byD) {
      list.sort((a, b) => a.since - b.since);
      const left = { ...LFG_NEED }, pickU = [];
      for (const u of list) { const c = this.lfgCounts(u); if (Object.keys(c).every((k) => c[k] <= left[k])) { pickU.push(u); for (const k in c) left[k] -= c[k]; } if (!left.tank && !left.healer && !left.damage) break; }
      if (!pickU.length) continue;
      const missing = left.tank + left.healer + left.damage;
      if (missing && this.time - Math.min(...pickU.map((u) => u.since)) < this.lfgWait()) continue;
      this.lfgStartCheck(did, pickU, left);
    }
  },
  // fill the missing roles (A.7 order: bots of the valley online, then ones part B brings online, then Bram's volunteers)
  lfgFill(did, units, left) {
    const humans = units.flatMap((u) => u.members.map((id) => this.players.get(id))).filter(Boolean);
    const level = Math.round(humans.reduce((a, h) => a + h.level, 0) / Math.max(1, humans.length)), area = humans[0] ? areaOf(humans[0].x, humans[0].z) : 'valley';
    const used = new Set(units.flatMap((u) => [...u.members, ...u.bots].map((id) => this.players.get(id)?.cls)).filter(Boolean));
    const bots = [], vols = [];
    for (const role of ['tank', 'healer', 'damage']) for (let i = 0; i < left[role]; i++) {
      let best = null;
      for (const b of this.players.values()) {
        if (bots.includes(b) || !this.botFreeFor(b, 'lfg') || roleOf(b) !== role || Math.abs(b.level - level) > LFG.levelBand) continue;
        if (!best || Math.abs(b.level - level) < Math.abs(best.level - level)) best = b;
      }
      if (!best && this.botBringOnline) { const b = this.botBringOnline({ role, level, area }); if (b && rosterBot(b) && this.botFreeFor(b, 'lfg')) best = b; }
      if (best) { bots.push(best); used.add(best.cls); continue; }
      vols.push({ role, cls: this.lfgVolClass(role, used) });
    }
    return { bots, vols };
  },
  lfgVolClass(role, used) {
    const L = role === 'tank' ? ['warden', 'knight'] : role === 'healer' ? ['herbalist'] : [...MUSTER.fill.filter((c) => MUSTER.roles[c] === 'damage'), 'ranger', 'deadeye', 'sandblade', 'chemist'];
    const cls = L.find((c) => !used.has(c)) || L[0];
    used.add(cls);
    return cls;
  },
  lfgStartCheck(did, units, left) {
    const S = this.botSocial(), D = DUNGEON_BY_ID[did];
    const { bots, vols } = this.lfgFill(did, units, left);
    const C = { id: 'c' + (++S.uid), dungeon: did, units: units.map((u) => u.uid), humans: units.flatMap((u) => u.members), bots: bots.map((b) => b.id), vols, until: this.time + LFG.ready, acc: new Set() };
    for (const b of bots) b.ai.lfgHold = C.until + 5;
    for (const u of units) u.check = C.id;
    S.checks.push(C);
    const roles = [
      ...units.flatMap((u) => [...u.members, ...u.bots].map((id) => { const q = this.players.get(id); return q && { name: q.name, cls: q.cls, role: u.roles[id], bot: q.bot ? 1 : undefined }; })).filter(Boolean),
      ...bots.map((b) => ({ name: b.name, cls: b.cls, role: roleOf(b), bot: 1 })),
      ...vols.map((v) => ({ name: MUSTER.volunteers[v.cls], cls: v.cls, role: v.role, bot: 1, vol: 1 })),
    ];
    for (const id of C.humans) { const h = this.players.get(id); if (h) this.lfgSend(h, { id: C.id, dungeon: did, name: D.name, t: LFG.ready, roles: roles.map((r) => (r.name === h.name && !r.bot ? { ...r, you: 1 } : r)) }); }
  },
  // everyone said yes: one party, the road money, and in through the door (as on_muster does it)
  lfgGo(C) {
    const S = this.botSocial(), D = DUNGEON_BY_ID[C.dungeon], cost = MUSTER.cost;
    S.checks.splice(S.checks.indexOf(C), 1);
    const units = S.q.filter((u) => C.units.includes(u.uid));
    S.q = S.q.filter((u) => !C.units.includes(u.uid));
    let humans = C.humans.map((id) => this.players.get(id)).filter((h) => h && !h.dead && h.x < DUNGEON_MIN_X);
    for (const h of [...humans]) if (h.gold < cost(h.level)) { this.err(h, 'You cannot afford the road money, so the group goes without you.'); humans = humans.filter((x) => x !== h); this.lfgSend(h); }
    const release = () => { for (const id of C.bots) { const b = this.players.get(id); if (b) b.ai.lfgHold = 0; } };
    if (!humans.length) return release();
    const lead = units.map((u) => this.players.get(u.members[0])).find((h) => h && humans.includes(h) && this.partyOf(h)) || humans[0];
    for (const h of humans) for (const b of this.myBots(h)) if (b.lfg) this.sendHome(b);
    for (const h of humans) if (h !== lead && (!lead.party || h.party !== lead.party)) this.joinParty(lead, h);
    const room = () => 5 - (this.partyOf(lead)?.members.length || 1);
    const vols = [...C.vols];
    for (const id of C.bots) {
      const b = this.players.get(id);
      if (!b || !rosterBot(b) || b.party || b.ai.party || b.dead || b.away) { vols.push({ role: b ? roleOf(b) : 'damage', cls: this.lfgVolClass(b ? roleOf(b) : 'damage', new Set()) }); continue; }
      b.ai.lfgHold = 0;
      if (room() <= 0 || !this.joinParty(lead, b)) continue;
      this.botJoined(b, lead, 'lfg:' + D.id, { lfg: D.id });
      this.socSay(b, 'party', 'lfg_omw', { why: 'any', must: 1, priority: 'party', slots: { dungeon: D.name } });
    }
    for (const v of vols) {
      if (room() <= 0) break;
      const b = this.makeBot({ owner: lead.id, botRole: 'Volunteer', name: MUSTER.volunteers[v.cls], cls: v.cls, level: lead.level, x: lead.x + R(-2, 2), z: lead.z + R(-2, 2), ry: lead.ry, lfg: D.id });
      this.joinParty(lead, b);
    }
    const names = this.partyMembers(lead).map((q) => q.name);
    for (const q of this.partyMembers(lead)) if (q.ai?.party?.lfg === D.id) q.ai.party.runNames = names.filter((n) => n !== q.name);
    const a = D.door.ry;
    for (const h of humans) {
      h.gold -= cost(h.level);
      this.teleport(h, D.door.x + Math.sin(a) * 3, D.door.z + Math.cos(a) * 3);
      this.on_door(h, { id: D.id });
      const roleIs = (q) => units.find((u) => u.roles[q.id])?.roles[q.id] || (q.bot && !q.owner ? roleOf(q) : MUSTER.roles[q.cls] || 'damage');
      this.msg(h, `The group finder sends you to ${D.name}: ${this.partyMembers(lead).filter((q) => q !== h).map((q) => `${q.name}${q.bot ? ' (bot)' : ''} (${roleIs(q)})`).join(', ')}.`, '#7ab0ff');
      this.lfgSend(h); this.sendParty(h); this.pushSelf(h);
    }
  },
};
