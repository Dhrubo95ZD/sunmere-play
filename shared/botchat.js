// Living bots, part C (docs/ai/living_bots_design.md C.1-C.6, C.9-C.11): how the bots talk. Installed on World.prototype
// (BOT_CHAT_METHODS), so `this` is the World, on the server and in the offline world alike.
// - botSay(b, channel, intent, ctx) is the only way a bot speaks: it checks who would see the line (players can hide bot
//   chat per channel), the budgets, picks a pre-written line (shared/botlines.js) with its slots filled from the game and
//   the bot's memory, runs the content filter (shared/botfilter.js) and sends after a typing delay. A line nobody would
//   see is never made.
// - botHear* / botWhisper: what bots hear (whispers, mentions in world chat, say nearby, party chat) and their replies.
// - botChatTick (2 Hz): due lines out, bot-to-bot threads, memory saves.
// (v127) There is no language model any more (the owner: no AI, nothing that depends on his PC): every line is written in
// botlines.js, and a line a bot starts comes from a real event (intent + slots). A sincere "are you a bot?" always gets
// the honest answer.
import { WANDERERS } from './data.js';
import { zoneAt, areaOf } from './terrain.js';
import { AREA_BY_ID } from './areas.js';
import { tideState } from './tidewater.js';
import { rainState } from './rainward.js';
import { galeState } from './weald.js';
import { filterLine, FEMALE_NAMES } from './botfilter.js';
import { classify, ruleLine, styleLine, typoLine, whereIs, questWhere, fallbackPersona, className, lineHash } from './botlines.js';
import { extractTold, toldSlots, placeName, nicePlace } from './botmemory.js';
import { DUNGEON_MIN_X } from './dungeons.js';

export const BOT_CHAT = {
  tickHz: 2,
  world: { per: 480, burst: 2, gap: 60 }, // bot-started world lines, all bots together: 1 per 8 min, burst 2, 60 s apart
  botWorld: [600, 2400], botWorldBase: 1200, // per bot: 20 min / talk, clamped to 10-40 min
  botSay: 120, // per bot, say (replies count)
  mention: 120, mentionAll: 30,
  whisperGap: 4, whisperMax: 12, whisperWin: 300,
  partyStart: 180, guild: 600, greet: 3600,
  thread: [1500, 2700], threadEvery: 5, threadGap: [15, 60],
  convoEnd: [6, 10], convoIdle: 180, spam: { n: 6, win: 30, mute: 60 },
  sayRange: 40, hearSay: 15, threadSay: 30, combatWait: 20, memSave: 300,
};
const CHANNELS = ['world', 'say', 'whisper', 'guild', 'party'];
// the persona's quirk only colours small talk, never an answer that must be plain (a yes, a warning, the honest answer)
// (a thread line never gets the "asks questions" quirk: a ", you?" the friend never answers reads wrong)
const QUIRK_OK = new Set(['greet', 'howru', 'thanks', 'bye', 'chatter', 'unknown', 'mention', 'compliment', 'told_ack', 'remember', 'doing', 'level', 'convo_end', 'invite_ok', 'insult', 'whereami', 'opinion', 'recall', 'recall_met']);
// (v127 review) the "asks questions" quirk (", you?") only where asking back makes sense: "take it easy, you?" or
// "dunno, someone in world might know, you?" read like a machine
const ASK_BACK = new Set(['howru', 'doing', 'level', 'whereami', 'opinion']);
const quirkOk = (intent, P) => (P.quirk === 'asks questions' ? ASK_BACK.has(intent) : QUIRK_OK.has(intent) || (intent.startsWith('thread_') && !intent.startsWith('thread_ask')));
// replies that may use what the bot remembers about the player (botMemSlots); told_ack uses only what was just said
const PLACE_SLOTS = ['zone', 'where', 'dungeon', 'area', 'goal', 'fzone', 'fgoal', 'tzone', 'heading', 'runok', 'runbad', 'boss', 'beatwith', 'lostwith', 'mob'];
const NO_MEM = new Set(['told_ack', 'bot', 'personal', 'offtopic', 'injection', 'foreign', 'spam', 'insult']);
const DEFAULT_PREFS = () => ({ hide: { world: 0, say: 0, whisper: 0, guild: 0, party: 0 }, inv: true, wh: true });
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const rnd = Math.random;
const R = (a, b) => a + rnd() * (b - a);
const lc = (s) => String(s ?? '').toLowerCase();

// a memory log entry (botmemory.js) as a thread topic: { topic, ok, slots, key } or null
function threadTopic(e) {
  const a = e?.a || {};
  switch (e?.k) {
    case 'run': return a.a ? { topic: 'run', ok: a.ok ? 1 : 0, slots: { dungeon: placeName(a.a) }, key: 'run:' + a.a } : null;
    case 'boss': return a.a ? { topic: 'boss', ok: a.ok ? 1 : 0, slots: { boss: placeName(a.a) }, key: 'boss:' + a.a } : null;
    case 'lvl': return a.level ? { topic: 'lvl', ok: 1, slots: { lvl: a.level }, key: 'lvl:' + a.level } : null;
    case 'zone': return a.zone && a.zone !== 'dungeon' ? { topic: 'zone', ok: 1, slots: { tzone: a.zone }, key: 'zone:' + a.zone } : null;
    case 'death': return a.mob ? { topic: 'death', ok: 1, slots: { mob: a.mob }, key: 'death:' + a.mob } : null;
    case 'quest': return a.a ? { topic: 'quest', ok: 1, slots: { quest: a.a }, key: 'quest:' + a.a } : null;
    case 'craft': return a.item ? { topic: 'craft', ok: 1, slots: { item: a.item }, key: 'craft:' + a.item } : null;
  }
  return null;
}

export const BOT_CHAT_METHODS = {
  // ------------------------------------------------------------------ preferences (C.11)
  botPrefs(p) {
    const P = p?.botPrefs, D = DEFAULT_PREFS();
    if (!P || typeof P !== 'object') return D;
    return { hide: { ...D.hide, ...(P.hide || {}) }, inv: P.inv !== false, wh: P.wh !== false };
  },
  on_botPrefs(p, m) {
    if (!p || p.bot || !this.allow(p, 'botPrefs', 0.5, 4)) return;
    const hide = {};
    for (const c of CHANNELS) hide[c] = m?.hide?.[c] ? 1 : 0;
    p.botPrefs = { hide, inv: m?.inv !== false, wh: m?.wh !== false };
  },
  botChatState() {
    return (this.botChat ||= { acc: 0, out: [], defer: [], worldTok: BOT_CHAT.world.burst, worldT: this.time, lastWorld: -1e9, mentionAll: -1e9,
      threadNext: this.time + R(300, 900), thread: null, lastThreadWorld: false, guildT: new Map(), greetT: new Map(), partyT: new Map(), recentWorld: [],
      memT: 0, stats: { lines: 0, rule: 0, blocked: 0, dropped: 0, byCh: {}, byIntent: {} }, log: null });
  },
  botChatOf(b) { return (b.chat ||= { convo: new Map(), lastLines: [], sayT: -1e9, worldT: -1e9, mentionT: -1e9, hear: new Map(), mute: new Map(), wlog: new Map(), partyAsk: -1e9 }); },
  botPersona(b) { return b.mind?.persona || (b.chatPersona ||= fallbackPersona(b.name, b.cls)); },
  botHumans() { const L = []; for (const q of this.players.values()) if (!q.bot && !q.held) L.push(q); return L; },
  // the humans who would see a line on this channel (their bot-chat options allow it)
  botAudience(b, channel, ctx = {}) {
    const ok = (q) => q && !q.bot && !q.held && !this.botPrefs(q).hide[channel];
    if (ctx.only) return ok(ctx.only) ? [ctx.only] : [];
    switch (channel) {
      case 'world': return this.botHumans().filter(ok);
      case 'say': return b.x == null ? [] : this.botHumans().filter((q) => ok(q) && dist(q, b) <= BOT_CHAT.sayRange && (q.x >= DUNGEON_MIN_X) === (b.x >= DUNGEON_MIN_X));
      case 'whisper': return ok(ctx.to) && this.players.has(ctx.to.id) ? [ctx.to] : [];
      case 'party': return b.party ? this.partyMembers(b).filter(ok) : [];
      case 'guild': { const g = ctx.guild || ctx.to?.guild?.name; return g ? this.guildMembersOnline(g).filter(ok) : []; }
    }
    return [];
  },
  // slots every line can use
  botSlots(b, extra = {}) {
    const goal = (!b.far && this.botGoal?.(b)) || { label: 'hunting' };
    const z = b.x != null ? zoneAt(b.x, b.z) : null;
    const zone = goal.zone || z?.name || 'the valley';
    // (v127) "hunting in The Engine Rows" next to the zone read twice ("out in the Engine Rows, hunting in the Engine Rows")
    const label = String(goal.label || 'hunting').replace(' in ' + zone, '');
    return { name: b.name, level: b.level, next: (b.level || 0) + 1, cls: className(b.cls).toLowerCase(), zone, goal: label, area: b.x != null ? areaOf(b.x, b.z) : 'valley', ...extra };
  },
  // names a line may carry: the bot, the people it talks with, the roster bots in the world
  botNames(b, extra = []) {
    const S = new Set([lc(b.name)]);
    for (const q of this.players.values()) if (q.wander || (!q.bot && !FEMALE_NAMES.has(lc(q.name)))) S.add(lc(q.name));
    for (const w of WANDERERS) S.add(lc(w.name));
    for (const n of extra) if (n && !FEMALE_NAMES.has(lc(n))) S.add(lc(n));
    return S;
  },
  // ------------------------------------------------------------------ budgets (C.4)
  botBudget(b, channel, intent, ctx) {
    const C = this.botChatState(), ch = this.botChatOf(b), t = this.time, P = this.botPersona(b);
    if (ctx.only && !ctx.reply) return true; // a notice for one player (the rare ping): its own limit, once per rare per 10 min
    if (ctx.must || ctx.reply) {
      // replies have their own limits in botHear; answers that must be given (duel, guild, invite) always pass
      // (a reply only waits out a short gap: a bot that said one line in Say still answers a player 20 s later)
      if (channel === 'say' && !ctx.must && t - ch.sayT < (ctx.reply ? 20 : BOT_CHAT.botSay)) return false;
      return true;
    }
    if (channel === 'world') {
      if (!this.botHumans().length) return false;
      C.worldTok = Math.min(BOT_CHAT.world.burst, C.worldTok + (t - C.worldT) / BOT_CHAT.world.per); C.worldT = t;
      const own = Math.max(BOT_CHAT.botWorld[0], Math.min(BOT_CHAT.botWorld[1], BOT_CHAT.botWorldBase / Math.max(0.1, P.talk || 0.5)));
      if (C.worldTok < 1 || t - C.lastWorld < BOT_CHAT.world.gap || t - ch.worldT < own) return false;
      return true;
    }
    if (channel === 'say') return t - ch.sayT >= BOT_CHAT.botSay;
    if (channel === 'party') { const k = b.party || 'x'; return t - (C.partyT.get(k) ?? -1e9) >= BOT_CHAT.partyStart; }
    if (channel === 'guild') {
      const g = ctx.guild || ctx.to?.guild?.name; if (!g) return false;
      if (intent === 'guild_greet') { const k = g + ':' + (ctx.to?.name || ''); if (t - (C.greetT.get(k) ?? -1e9) < BOT_CHAT.greet) return false; C.greetT.set(k, t); return true; }
      return t - (C.guildT.get(g) ?? -1e9) >= BOT_CHAT.guild;
    }
    if (channel === 'whisper') return !!this.botPrefs(ctx.to).wh; // a bot whispering first
    return false;
  },
  botSpend(b, channel, ctx) {
    const C = this.botChatState(), ch = this.botChatOf(b), t = this.time;
    if (channel === 'world' && !ctx.reply && !ctx.must) { C.worldTok -= 1; C.lastWorld = t; ch.worldT = t; }
    if (channel === 'say') ch.sayT = t;
    if (channel === 'party' && !ctx.reply) C.partyT.set(b.party || 'x', t);
    if (channel === 'guild' && !ctx.reply) { const g = ctx.guild || ctx.to?.guild?.name; if (g) C.guildT.set(g, t); }
  },

  // ------------------------------------------------------------------ speaking
  // ctx = { to?: player, only?: player, slots?, must?, reply?, heard?: text, convo?: humanId, guild?, disclose?, thread? }
  botSay(b, channel, intent, ctx = {}) {
    if (!b || !CHANNELS.includes(channel) || b.away) return false;
    if (b.id && !b.far && !this.players.has(b.id)) return false;
    const aud = this.botAudience(b, channel, ctx);
    if (!aud.length) return false; // nobody would see it: nothing is made
    if (!this.botBudget(b, channel, intent, ctx)) return false;
    this.botSpend(b, channel, ctx);
    const slots = { ...this.botSlots(b), ...(ctx.slots || {}) };
    if (ctx.to?.name && slots.to == null) slots.to = FEMALE_NAMES.has(lc(ctx.to.name)) ? '' : ctx.to.name;
    if (slots.to == null) slots.to = '';
    // place names read mid-line the way players type them: "out in the Engine Rows", not "out in The Engine Rows"
    for (const k of PLACE_SLOTS) if (typeof slots[k] === 'string') slots[k] = slots[k].replace(/(^|\s)The /g, '$1the ');
    const job = { id: b.id, b, channel, intent, ctx, slots, at: this.time, names: this.botNames(b, [ctx.to?.name, ...aud.map((q) => q.name)]) };
    return this.botSpeakRule(job);
  },
  // a rule line for the job, through the filter (a few tries for a fresh one); silence when none passes
  botSpeakRule(job) {
    const b = job.b, P = this.botPersona(b), mem = this.botMemOf?.(b);
    // its own recent lines, plus what any bot said on a shared channel in the last 2 min (two bots never echo "thats me
    // done, thanks all" in the same second)
    const C = this.botChatState();
    const said = [...(mem?.said || this.botChatOf(b).saidH || []), ...(C.recentH || []).filter((e) => this.time - e.t < 120).map((e) => e.h)];
    for (let i = 0; i < 4; i++) {
      const raw = ruleLine(job.intent, job.slots, P, rnd, said);
      if (!raw) break;
      const out = this.botFinish(job, raw, i === 3 && job.ctx.must);
      if (out) { this.botChatState().stats.rule++; return this.botQueue(job, out); }
      said.push(lineHash(raw)); // (a blocked line is not tried again)
    }
    this.botChatState().stats.blocked++;
    return false;
  },
  // filter, persona style, filter again, typo, filter again (C.8 step 6); null when blocked
  botFinish(job, raw, lenient) {
    const b = job.b, P = this.botPersona(b), ch = this.botChatOf(b);
    const recent = lenient ? [] : [...ch.lastLines, ...(job.channel === 'world' ? this.botChatState().recentWorld : [])];
    const fctx = { channel: job.channel, names: job.names, disclose: !!job.ctx.disclose, recent, self: b.name };
    const f1 = filterLine(raw, fctx);
    if (!f1.ok) { this.botLogBlock?.(job, raw, f1.why); return null; }
    const keep = new Set(job.names);
    for (const k of ['npc', 'where', 'zone', 'dungeon', 'mob', 'item', 'quest', 'friend', 'to', 'fact', 'fzone', 'tzone', 'boss', 'heading', 'runok', 'runbad', 'beatwith', 'lostwith', 'questwith']) for (const w of String(job.slots?.[k] || '').split(/\s+/)) if (w) keep.add(w.toLowerCase().replace(/[^a-z']/g, '').replace(/'s$/, ''));
    const styled = styleLine(f1.text, P, rnd, keep, quirkOk(job.intent, P));
    const f2 = filterLine(styled, fctx);
    if (!f2.ok) return f1.text;
    const typo = typoLine(f2.text, P, rnd, job.names);
    const f3 = typo === f2.text ? f2 : filterLine(typo, { ...fctx, recent: [] });
    return f3.ok ? f3.text : f2.text;
  },
  // the typing delay, then the send (botChatTick sends it when due)
  botQueue(job, text) {
    const C = this.botChatState();
    // an answer the game already timed (duel, guild invite, rare ping) goes at once, as before; a reply waits for its typing
    if ((job.ctx.must || job.ctx.only || job.intent === 'guild_greet') && !job.ctx.reply && !job.ctx.thread) return this.botSend(job, text);
    const typing = job.ctx.reply ? 1.2 + 0.05 * text.length + R(0, 1.5) : R(0.2, 1);
    const wait = Math.max(0, typing - (this.time - job.at));
    C.out.push({ at: this.time + wait, job, text });
    return true;
  },
  botChatFlush() {
    const C = this.botChatState();
    if (!C.out.length) return;
    const due = [], keep = [];
    for (const o of C.out) (o.at <= this.time ? due : keep).push(o);
    C.out = keep;
    for (const o of due) this.botSend(o.job, o.text);
  },
  botSend(job, text) {
    const b = job.b, C = this.botChatState();
    if (b.id && !b.far && !this.players.has(b.id)) { C.stats.dropped++; return false; } // the bot left
    const aud = this.botAudience(b, job.channel, job.ctx);
    if (!aud.length) return false;
    let ev;
    switch (job.channel) {
      case 'world': ev = { k: 'chat', from: b.name, bot: 1, cls: b.cls, text }; break;
      case 'say': ev = { k: 'say', id: b.id, from: b.name, cls: b.cls, text, bot: 1 }; break;
      case 'whisper': ev = { k: 'whisper', from: b.name, id: b.id, cls: b.cls, text, bot: 1 }; for (const q of aud) { q.lastWhisper = b.name; q.lastWhisperBot = b.id; } break;
      case 'party': ev = { k: 'pchat', from: b.name, cls: b.cls, text, bot: 1 }; break;
      case 'guild': ev = { k: 'gchat', from: b.name, bot: 1, cls: b.cls, text, guild: job.ctx.guild || job.ctx.to?.guild?.name }; break;
    }
    for (const q of aud) q.session.send({ t: 'ev', list: [ev] });
    const ch = this.botChatOf(b);
    ch.lastLines.push(text); if (ch.lastLines.length > 12) ch.lastLines.shift();
    if (job.channel === 'world') { C.recentWorld.push(text); if (C.recentWorld.length > 30) C.recentWorld.shift(); }
    if (job.channel !== 'whisper') { (C.recentH ||= []).push({ t: this.time, h: lineHash(text) }); if (C.recentH.length > 24) C.recentH.shift(); }
    if (job.ctx.thread) { job.ctx.thread.lines.push(b.name + ': ' + text); job.ctx.thread.said = (job.ctx.thread.said || 0) + 1; }
    if (this.botSaid && this.botIdx?.(b) != null) this.botSaid(b, lineHash(text)); else { (ch.saidH ||= []).push(lineHash(text)); if (ch.saidH.length > 30) ch.saidH.shift(); }
    if (job.ctx.convo) { const cv = ch.convo.get(job.ctx.convo); if (cv) { cv.lines.push(b.name + ': ' + text); if (cv.lines.length > 6) cv.lines.shift(); cv.t = this.time; } }
    C.stats.lines++; C.stats.byCh[job.channel] = (C.stats.byCh[job.channel] || 0) + 1; C.stats.byIntent[job.intent] = (C.stats.byIntent[job.intent] || 0) + 1;
    C.log?.({ t: this.time, bot: b.name, channel: job.channel, intent: job.intent, text, src: 'rule', kind: job.ctx.reply ? 'reply' : job.ctx.must ? 'must' : job.ctx.only ? 'notice' : 'started', to: aud.map((q) => q.name) });
    return true;
  },

  // ------------------------------------------------------------------ hearing (C.2, C.3)
  // a whisper to a wandering adventurer: the sender sees his line as usual, then the bot may answer
  botWhisper(p, b, text) {
    if (!this.chatOk(p)) return;
    p.lastWhisperTo = b.name;
    p.session.send({ t: 'ev', list: [{ k: 'whisper', to: b.name, id: b.id, cls: b.cls, text, out: 1, bot: 1 }] });
    p.lastWhisper = b.name; p.lastWhisperBot = b.id;
    this.botHear(b, p, 'whisper', text);
  },
  botHear(b, p, channel, text) {
    if (!b?.bot || !p || p.bot || b.away || !this.players.has(b.id)) return;
    const t = this.time, ch = this.botChatOf(b);
    // a thread with another bot ends when a human speaks into it
    const C = this.botChatState();
    if (C.thread && (C.thread.a === b.id || C.thread.b === b.id)) C.thread = null;
    // spam guard: more than 6 lines in 30 s from one human gets one answer, then nothing for 60 s
    const H = ch.hear.get(p.id) || []; H.push(t); while (H.length && t - H[0] > BOT_CHAT.spam.win) H.shift(); ch.hear.set(p.id, H);
    if (t < (ch.mute.get(p.id) || 0)) return;
    this.botRemember?.(b, 'met', { name: p.name });
    const facts = extractTold(text);
    if (facts.length) this.botRemember?.(b, 'told', { name: p.name, facts });
    if (H.length > BOT_CHAT.spam.n) { ch.mute.set(p.id, t + BOT_CHAT.spam.mute); return this.botReply(b, p, channel, 'spam', {}); }
    // the conversation (last 6 lines); it ends after 6-10 exchanges or 3 min of silence
    let cv = ch.convo.get(p.id);
    if (cv && t - cv.t > BOT_CHAT.convoIdle) { ch.convo.delete(p.id); cv = null; }
    if (!cv) { cv = { lines: [], n: 0, t, max: Math.round(R(...BOT_CHAT.convoEnd)), ended: false, ch: channel }; ch.convo.set(p.id, cv); }
    cv.lines.push(p.name + ': ' + String(text).slice(0, 140)); if (cv.lines.length > 6) cv.lines.shift();
    cv.t = t; cv.n++; cv.ch = channel;
    const c = classify(text, { mention: channel === 'world' || (channel !== 'whisper' && new RegExp('\\b' + lc(b.name) + '\\b').test(lc(text))) });
    // (v122 review) an injection, an off-topic or foreign line is never kept word for word
    if (['injection', 'offtopic', 'foreign'].includes(c.intent)) cv.lines[cv.lines.length - 1] = p.name + ': (something off-topic)';
    let intent = c.intent, slots = {};
    if (intent === 'where') {
      const w = whereIs(c.thing, (id) => this.npcs.get(id));
      if (w?.npc) { intent = 'where_npc'; slots = { npc: w.npc, where: w.where }; }
      else if (w?.dungeon) { intent = 'where_dungeon'; slots = { dungeon: w.dungeon, where: w.where }; }
      else if (w?.zone) { intent = 'where_zone'; slots = { zone: w.zone, level: w.level }; }
      else intent = 'where_none';
    } else if (intent === 'quest') {
      const q = questWhere(text);
      if (q) { intent = 'quest_help'; slots = { quest: q.quest, npc: q.npc, where: q.where }; } else intent = 'quest_none';
    } else if (intent === 'invite' || intent === 'join') {
      const free = this.botAvailable ? this.botAvailable(b, 'party') !== false : true;
      intent = !free || b.party ? 'invite_busy' : intent === 'join' ? 'join_ok' : 'invite_ok';
    } else if (intent === 'insult') { if (rnd() < 0.5) return; }
    else if (intent === 'chatter' && facts.length) { intent = 'told_ack'; slots = toldSlots(facts); }
    else if (intent === 'greet') {
      // someone it knows: a "hey again" that shows it remembers (what you did together, what you told it) most of the time
      const P = this.botKnows?.(b, p.name), M = P ? this.botMemSlots?.(b, p.name) || {} : {};
      const rich = Object.keys(M).some((k) => k !== 'times');
      if (P && ((P.times || 0) > 1 || rich) && (rnd() < (rich ? 0.7 : 0.5) || /\b(again|back)\b/i.test(text))) intent = 'remember';
    }
    else if (intent === 'recall') { // "do you remember...": what the human told the bot (memory), by rule, never made up
      const P = this.botKnows?.(b, p.name), T = (P?.told || []).map((x) => x.s), low = lc(text);
      const want = /\b(class|main|play)\b/.test(low) ? /^mains / : /\balt\b/.test(low) ? /^has an? \w+ alt/ : /\b(head|going|where|off to)\w*/.test(low) ? /^was heading/ : /\bneed/.test(low) ? /^needed/ : /\bguild\b/.test(low) ? /^is in the guild/ : /\blevel\b/.test(low) ? /^was level/ : null;
      // (v127 review) a question about one thing (class, heading, need...) is not answered with another told fact
      const f = want ? T.filter((x) => want.test(x)).pop() : T[T.length - 1];
      if (!f && want && P) intent = 'recall_unsaid';
      else if (f) slots = { fact: f.replace(/^(was heading to )(.+)$/, (m, h, p) => h + nicePlace(p)).replace(/^was /, 'were ').replace(/^mains /, 'main ').replace(/^has /, 'have ').replace(/^is /, 'are ') };
      else intent = P && (P.times || 0) > 1 ? 'recall_met' : 'recall_none';
    }
    if (!cv.ended && cv.n >= cv.max) { cv.ended = true; if (['chatter', 'mention', 'unknown', 'greet', 'howru', 'thanks', 'compliment', 'told_ack', 'remember'].includes(intent)) intent = 'convo_end'; }
    else if (cv.ended && ['chatter', 'mention', 'unknown'].includes(intent)) { if (rnd() < 0.5) return; intent = 'chatter'; }
    this.botReply(b, p, channel, intent, slots);
  },
  botReply(b, p, channel, intent, slots) {
    const t = this.time, ch = this.botChatOf(b);
    if (!NO_MEM.has(intent)) slots = { ...(this.botMemSlots?.(b, p.name) || {}), ...slots };
    // whisper replies: per pair 1 per 4 s, at most 12 per 5 min
    // (v127 review) a sincere "are you a bot?" is answered even past the 12-in-5-min cap (the 4 s gap and the spam guard
    // still hold back a flood)
    if (channel === 'whisper' && intent !== 'spam') {
      const L = ch.wlog.get(p.id) || []; while (L.length && t - L[0] > BOT_CHAT.whisperWin) L.shift();
      if ((L.length && t - L[L.length - 1] < BOT_CHAT.whisperGap) || (intent !== 'bot' && L.length >= BOT_CHAT.whisperMax)) return false;
      L.push(t); ch.wlog.set(p.id, L);
    }
    const ctx = { to: p, reply: true, convo: p.id, slots, disclose: intent === 'bot' };
    if (channel === 'world') { ctx.only = undefined; }
    // in a fight: wait until it is over (up to 20 s), or a short "sec, fighting"
    const fighting = t - (b.combatT || -1e9) < 3 && b.target;
    if (fighting && !['bot', 'spam'].includes(intent)) {
      // (feel review: "sec, fighting" at most once a minute per player, and the real answer still comes after the fight;
      // before, the busy line replaced the answer, so "where is the gunsmith?" was never answered)
      const B = (ch.busyT ||= new Map());
      if (rnd() < 0.5 && t - (B.get(p.id) ?? -1e9) > 60) { B.set(p.id, t); this.botSay(b, channel, 'busy', { ...ctx }); }
      this.botChatState().defer.push({ b, p, channel, intent, ctx, until: t + BOT_CHAT.combatWait });
      return true;
    }
    return this.botSay(b, channel, intent, ctx);
  },
  // a name said in world chat: the bot answers (world when far, say when within 40 m); 3+ bots named: no answers
  botHearWorld(p, text) {
    if (!p || p.bot) return;
    const low = lc(text), C = this.botChatState(), t = this.time;
    const realNames = new Set(this.botHumans().map((q) => lc(q.name)));
    const hit = [];
    for (const b of this.players.values()) {
      if (!b.bot || !b.wander || b.away || b.dead || realNames.has(lc(b.name))) continue;
      if (new RegExp('\\b' + lc(b.name) + '\\b').test(low)) hit.push(b);
    }
    if (C.thread) for (const b of hit) if (C.thread.a === b.id || C.thread.b === b.id) C.thread = null;
    if (!hit.length || hit.length >= 3) return;
    const b = hit[0], ch = this.botChatOf(b);
    if (t - ch.mentionT < BOT_CHAT.mention || t - C.mentionAll < BOT_CHAT.mentionAll) return;
    ch.mentionT = t; C.mentionAll = t;
    // (a party mate named in world chat answers in party chat, like a player would)
    this.botHear(b, p, b.party && b.party === p.party ? 'party' : dist(b, p) <= BOT_CHAT.sayRange ? 'say' : 'world', text);
  },
  // /s near a bot: one within 15 m that talked with this human in the last 2 min, or that is named
  botHearSay(p, text) {
    if (!p || p.bot) return;
    const low = lc(text), t = this.time;
    let best = null, bd = BOT_CHAT.hearSay;
    for (const b of this.players.values()) {
      if (!b.bot || !b.wander || b.away || b.dead) continue;
      const d = dist(b, p); if (d > BOT_CHAT.hearSay && !(d <= BOT_CHAT.sayRange && new RegExp('\\b' + lc(b.name) + '\\b').test(low))) continue;
      const named = new RegExp('\\b' + lc(b.name) + '\\b').test(low), cv = b.chat?.convo.get(p.id);
      if (!named && !(cv && t - cv.t < 120)) continue;
      if (named) { best = b; break; }
      if (d < bd) { bd = d; best = b; }
    }
    if (best) this.botHear(best, p, 'say', text);
  },
  // /p in a party with roster bots: orders go to part A, questions and the bot's name get an answer
  botHearParty(p, text) {
    if (!p || p.bot || !p.party) return;
    const low = lc(text);
    const bots = this.partyMembers(p).filter((b) => b.bot && b.wander);
    if (!bots.length) return;
    const order = /^(wait|stay|stay here|hold|hold up|stop)\b/.test(low) ? 'hold' : /^(follow|come|go|lets go|let's go|come on|move)\b/.test(low) ? 'assist' : null;
    if (order) { for (const b of bots) this.botOrder?.(b, order); return; }
    const named = bots.find((b) => new RegExp('\\b' + lc(b.name) + '\\b').test(low));
    const b = named || (/\?\s*$/.test(text) ? bots[Math.floor(rnd() * bots.length)] : null);
    if (b) this.botHear(b, p, 'party', text);
  },

  // ------------------------------------------------------------------ the 2 Hz tick
  botChatTick(dt) {
    const C = this.botChatState();
    C.acc += dt;
    if (C.acc < 1 / BOT_CHAT.tickHz) return;
    const step = C.acc; C.acc = 0;
    // replies held back while the bot fought
    if (C.defer.length) {
      const keep = [];
      for (const d of C.defer) {
        if (!this.players.has(d.b.id) || !this.players.has(d.p.id)) continue;
        const fighting = this.time - (d.b.combatT || -1e9) < 3 && d.b.target;
        if (!fighting || this.time > d.until) this.botSay(d.b, d.channel, d.intent, d.ctx); else keep.push(d);
      }
      C.defer = keep;
    }
    this.botChatFlush();
    C.tT = (C.tT || 0) + step;
    if (C.tT >= BOT_CHAT.threadEvery) { C.tT = 0; this.botThreadTick(); }
    C.memT += step;
    if (C.memT >= BOT_CHAT.memSave) { C.memT = 0; this.botMemSave?.(); }
  },
  // a world line a bot starts by itself about where it is (called from the wanderer's tick; the budget decides)
  botAmbient(b) {
    if (!b || b.away || b.dead || !this.botHumans().length) return false;
    const area = areaOf(b.x, b.z);
    let intent = 'ambient_place', weather = '';
    const v = rnd();
    if (area === 'tidewater') { const T = tideState(this.time); intent = 'ambient_place'; weather = T.ebb ? 'the tide is out' : T.flood ? 'the tide is in' : ''; if (v < 0.5 && (T.ebb || T.flood)) intent = T.ebb ? 'ambient_tidewater_low' : 'ambient_tidewater_high'; }
    else if (area === 'rainward') { const S = rainState(this.time); const wet = !!S?.pouring; weather = wet ? 'it is pouring' : S?.dry ? 'the rain has stopped' : ''; if (v < 0.5 && (wet || S?.dry)) intent = wet ? 'ambient_rainward_wet' : 'ambient_rainward_dry'; }
    else if (area === 'weald') { const S = galeState(this.time); weather = S.blowing ? 'the gale is up' : S.calm ? 'the wood is still' : ''; if (v < 0.5 && (S.blowing || S.calm)) intent = S.blowing ? 'ambient_weald_gale' : 'ambient_weald_calm'; }
    else if (['reach', 'rime', 'heights', 'valley'].includes(area) && v < 0.4) intent = 'ambient_' + area;
    return this.botSay(b, 'world', intent, { slots: { weather } });
  },

  // ------------------------------------------------------------------ bot-to-bot threads (C.6)
  // friends (part B) or guildmates; with no friends from B yet, neighbours on the roster count as friends
  botPals(b) {
    const F = this.botFriends?.(b) || [];
    if (F.length) return F;
    const i = WANDERERS.findIndex((w) => w.name === b.name);
    if (i < 0) return [];
    const names = new Set([WANDERERS[i - 1]?.name, WANDERERS[i + 1]?.name, WANDERERS[i + 2]?.name].filter(Boolean));
    return [...this.players.values()].filter((q) => q.bot && q.wander && names.has(q.name));
  },
  botThreadTick() {
    const C = this.botChatState(), t = this.time;
    const T = C.thread;
    if (T) {
      if (t < T.next) return;
      const A = this.players.get(T.turn % 2 ? T.b : T.a), B = this.players.get(T.turn % 2 ? T.a : T.b);
      if (!A || !B || A.away || B.away || A.dead || B.dead || !this.botThreadVisible(T, A, B)) { C.thread = null; return; }
      const intent = this.botThreadIntent(T);
      // the friend's own goal and place, for an ask about what he is doing ("still hunting gearlings, Osric?")
      const fs = this.botSlots(B);
      const ctx = { slots: { friend: B.name, fgoal: fs.goal, fzone: fs.zone, ...T.slots }, must: 1, thread: T, other: B, guild: T.guild };
      if (T.channel === 'say' && t - this.botChatOf(A).sayT < 15) { T.next = t + 5; return; }
      // the last line must be out (after its typing delay) before the friend answers it; a line that never went out
      // (blocked by the filter) ends the thread, so nobody answers a question that was not asked
      if (T.turn > 0 && (T.said || 0) < T.turn) { if (t - T.at > 25) C.thread = null; else T.next = t + 2; return; }
      const said = this.botSay(A, T.channel, intent, ctx);
      T.at = t;
      T.turn++;
      if (!said || T.turn >= T.turns) { C.thread = null; return; }
      T.next = t + R(...BOT_CHAT.threadGap);
      return;
    }
    if (t < C.threadNext) return;
    // a pair that a human can see: say (both within 30 m, a human within 40 m), guild (a human guild with a member online),
    // or world (1 in 4 threads, short ones, never two in a row)
    const humans = this.botHumans();
    if (!humans.length) return;
    const bots = [...this.players.values()].filter((q) => q.bot && q.wander && !q.away && !q.dead && !(t - (q.combatT || -1e9) < 5));
    const pairs = [];
    for (const a of bots) for (const b of this.botPals(a)) {
      if (b === a || b.away || b.dead || !bots.includes(b)) continue;
      if (dist(a, b) <= BOT_CHAT.threadSay && humans.some((h) => !this.botPrefs(h).hide.say && dist(h, a) <= BOT_CHAT.sayRange)) pairs.push({ a, b, channel: 'say' });
      const g = humans.find((h) => h.guild && (h.guild.bots || []).includes(a.name) && h.guild.bots.includes(b.name));
      if (g) pairs.push({ a, b, channel: 'guild', guild: g.guild.name });
    }
    if (!pairs.length && !C.lastThreadWorld && rnd() < 0.25 && bots.length > 1) {
      const a = bots[Math.floor(rnd() * bots.length)], pals = this.botPals(a).filter((q) => bots.includes(q));
      if (pals.length) pairs.push({ a, b: pals[0], channel: 'world' });
    }
    C.threadNext = t + (pairs.length ? R(...BOT_CHAT.thread) : 60);
    if (!pairs.length) return;
    const P = pairs[Math.floor(rnd() * pairs.length)];
    C.lastThreadWorld = P.channel === 'world';
    // the topic: a real memory entry of the one who is asked (a run, a boss, a level, a zone move, a knock-down, a quest, a
    // craft), so the ask, the answer and the reaction all fit what really happened; the same topic is not talked over twice
    // in 6 hours; with nothing to ask about, the place and what they are doing
    const seen = (C.threadSeen ||= new Map());
    for (const [k, at] of seen) if (t - at > 6 * 3600) seen.delete(k);
    const topicOf = (who) => {
      const L = (this.botMemOf?.(who)?.log || []).filter((e) => this.botNow() - e.t < 3 * 86400000);
      for (let i = L.length - 1; i >= Math.max(0, L.length - 6); i--) { const x = threadTopic(L[i]); if (x && !seen.has(who.name + ':' + x.key)) return x; }
      return null;
    };
    let top = topicOf(P.b);
    if (!top) { const o = topicOf(P.a); if (o) { top = o; [P.a, P.b] = [P.b, P.a]; } }
    if (top) seen.set(P.b.name + ':' + top.key, t);
    C.thread = { a: P.a.id, b: P.b.id, channel: P.channel, guild: P.guild, turn: 0, turns: P.channel === 'world' ? 2 : 2 + Math.floor(rnd() * 3), next: t, lines: [], slots: top?.slots || {}, topic: top?.topic || null, ok: top ? top.ok : 1 };
    this.botThreadTick();
  },
  // which line a thread turn is: the ask (turn 0), the answer, the asker's reaction, the close (turn 3)
  botThreadIntent(T) {
    const k = T.topic, both = k === 'run' || k === 'boss';
    if (T.turn === 0) return k ? 'thread_ask_' + k : 'thread_ask';
    if (T.turn === 1) return both ? (T.ok ? 'thread_answer_ok' : 'thread_answer_bad') : k ? 'thread_answer_' + k : 'thread_answer';
    if (T.turn === 2) return both ? (T.ok ? 'thread_react_ok' : 'thread_react_bad') : k ? 'thread_react_' + k : 'thread_react';
    return 'thread_close';
  },
  botThreadVisible(T, A, B) {
    const humans = this.botHumans();
    if (T.channel === 'say') return dist(A, B) <= BOT_CHAT.threadSay + 10 && humans.some((h) => !this.botPrefs(h).hide.say && dist(h, A) <= BOT_CHAT.sayRange);
    if (T.channel === 'guild') return humans.some((h) => h.guild?.name === T.guild);
    return humans.length > 0;
  },
};
