// Living bots, part C (docs/ai/living_bots_design.md C.7): what each roster bot remembers. Installed on World.prototype
// (BOT_MEMORY_METHODS), so `this` is the World. One object per roster bot, saved as its own world key `bot1mem<i>` (the key
// has a digit, so it can never be a character name, and the payload has no top-level `cls`, so server/store.js keeps it
// as world state). botRemember is the only writer; parts A, B and C all call it.
//   mem = { v: 1, people: { "<lowercase name>": { n, met, seen, times, rel, inv: { ask, yes, no, noDay, day }, did: [..4], told: [..3] } },
//           log: [ { t, k, a } ] (ring of 30), said: [hash] (last 30 lines, anti-repeat) }
// Told facts are pulled out of a player's words by rules only, and only facts about the game (class, level, where they are
// heading, what they farm or need, their guild). Anything personal is dropped before it is stored, so no private detail can
// reach a save or a chat line.
import { WANDERERS } from './data.js';
import { CLASSES } from './classes.js';
import { filterLine, gameNames } from './botfilter.js';
import { AREA_BY_ID } from './areas.js';
import { DUNGEON_BY_ID } from './dungeons.js';

export const BOT_MEM = { v: 1, people: 60, did: 4, told: 3, log: 30, said: 30, forgetDays: 60, saveEvery: 300, keyGap: 15 };
const DAY = 86400000;
const KINDS = new Set(['met', 'invite', 'party', 'run', 'boss', 'quest', 'lvl', 'zone', 'death', 'craft', 'sold', 'duel', 'told']);
export const memKey = (i) => 'bot1mem' + i;
export const freshMem = () => ({ v: BOT_MEM.v, people: {}, log: [], said: [] });
const lc = (s) => String(s ?? '').toLowerCase();
const cleanName = (s) => String(s ?? '').replace(/[^A-Za-z]/g, '').slice(0, 14);
// a dungeon id or name as it reads mid-line ("the Briar Warrens")
export const placeName = (a) => String(DUNGEON_BY_ID[a]?.name || a || '').replace(/^The /, 'the ');
// a place name as it reads mid-line: told facts are stored in lower case ("the briar warrens" -> "the Briar Warrens")
const SMALL = new Set(['the', 'of', 'and', 'a', 'an', 'to', 'in', 'on', 'at']);
export const nicePlace = (p) => String(p || '').replace(/[a-z][a-z']*/gi, (w, i) => (SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)));
// told facts ("mains a Warden", "was heading to the Briar Warrens"...) as line slots: main, alt, heading, need, farming
export function toldSlots(facts) {
  const S = {};
  for (const s of facts || []) {
    let m;
    if ((m = s.match(/^mains an? (\w+)/))) S.main = m[1].toLowerCase();
    else if ((m = s.match(/^has an? (\w+) alt/))) S.alt = m[1].toLowerCase();
    else if ((m = s.match(/^was heading to (.+)/))) S.heading = nicePlace(m[1]);
    else if ((m = s.match(/^needed (.+?) for /))) S.need = m[1];
    else if ((m = s.match(/^was ((?:farming|crafting|gathering|grinding|levelling|leveling) .+)/))) S.farming = m[1];
  }
  return S;
}

// ------------------------------------------------------------------ told facts (rules only, game facts only)
const CLS = Object.entries(CLASSES).map(([id, c]) => [id, lc(c.name)]);
const clsIn = (s) => { for (const [id, n] of CLS) if (new RegExp('\\b' + n + 's?\\b').test(s)) return CLASSES[id].name; return null; };
const PERSONAL = /\b(live|lives|living|address|street|road no|age|years? old|yo\b|born|school|college|uni|university|job|work at|boss at|wife|husband|kids?|son|daughter|mom|dad|family|phone|email|mail|discord|insta|name is|real name|irl|city|country|town i|house is|birthday|sick|hospital|money irl|salary|bank|password)\b/i;
export function extractTold(text) {
  const raw = String(text || '').slice(0, 200);
  const s = lc(raw).replace(/[’]/g, "'");
  if (/https?:|www\.|@|\.(com|net|org)\b/.test(s) || PERSONAL.test(s)) return [];
  const facts = [];
  let m;
  if ((m = s.match(/\bi (?:main|play)(?: an?)? (\w+)\b/)) || (m = s.match(/\bi'?m an? (\w+) main\b/)) || (m = s.match(/\bmy main is an? (\w+)\b/))) { const c = clsIn(m[1]); if (c) facts.push(`mains a ${c}`); }
  if ((m = s.match(/\bmy alt is an? (\w+)\b/)) || (m = s.match(/\bi have an? (\w+) alt\b/))) { const c = clsIn(m[1]); if (c) facts.push(`has a ${c} alt`); }
  if ((m = s.match(/\bi'?m (?:level|lvl) (\d{1,2})\b/)) || (m = s.match(/\bim (?:level|lvl) (\d{1,2})\b/))) { const n = +m[1]; if (n >= 1 && n <= 65) facts.push(`was level ${n}`); }
  const G = gameNames();
  const gameName = (frag) => { const f = frag.replace(/^the /, '').replace(/[^a-z' ]/g, '').trim(); for (const n of G.names) if (n.split(' ').length <= 5 && (n === f || n === 'the ' + f || (f.length > 4 && n.replace(/^the /, '') === f))) return n; return null; };
  if ((m = s.match(/\b(?:i'?m|im|i am) (?:going|heading|off) (?:to|up to|out to) ([a-z' ]{3,30})/))) { const n = gameName(m[1].split(/ (?:now|later|next|soon|today|tonight)\b/)[0]); if (n) facts.push(`was heading to ${n}`); }
  if ((m = s.match(/\b(?:i )?need (?:some |a |an )?([a-z' ]{3,24}) for (?:my )?([a-z' ]{3,24})/))) facts.push(`needed ${m[1].trim()} for ${m[2].trim()}`);
  if ((m = s.match(/\b(?:i'?m|im|i am) (farming|crafting|gathering|grinding|levelling|leveling) ([a-z' ]{3,24})/))) facts.push(`was ${m[1]} ${m[2].trim()}`);
  if ((m = raw.match(/\bmy guild is ([A-Za-z' ]{3,24})/i))) facts.push(`is in the guild ${m[1].trim()}`);
  // every fact is cut to 60 characters and must pass the content filter
  return facts.map((f) => f.slice(0, 60).trim()).filter((f) => !/\d{3,}/.test(f) && filterLine(f, { channel: 'say', names: new Set() }).ok);
}

// ------------------------------------------------------------------ the World methods
export const BOT_MEMORY_METHODS = {
  botNow() { return this.io?.now ? this.io.now() : Date.now(); },
  // a bot's roster index: B's mind when it has one, else the place of its name in WANDERERS (the roster starts with them,
  // in order). Companions, volunteers and escorts have no memory.
  botIdx(b) {
    if (!b?.bot) return null;
    if (b.mind && Number.isInteger(b.mind.i)) return b.mind.i;
    if (!b.wander) return null;
    const i = WANDERERS.findIndex((w) => w.name === b.name);
    return i >= 0 ? i : null;
  },
  botMemOf(b) {
    const i = this.botIdx(b);
    if (i == null) return null;
    const M = (this.botMem ||= new Map());
    let mem = M.get(i);
    if (mem) return mem;
    let raw = null;
    try { raw = this.io.load(memKey(i)); } catch { raw = null; }
    mem = freshMem();
    if (raw && typeof raw === 'object' && raw.v === BOT_MEM.v) {
      // unknown fields are kept (a newer build may have added some); people not seen for 60 days are forgotten
      mem = { ...raw, people: {}, log: Array.isArray(raw.log) ? raw.log.slice(-BOT_MEM.log) : [], said: Array.isArray(raw.said) ? raw.said.slice(-BOT_MEM.said) : [] };
      const cut = this.botNow() - BOT_MEM.forgetDays * DAY;
      for (const [k, P] of Object.entries(raw.people || {})) if (P && typeof P === 'object' && (P.seen || 0) >= cut) mem.people[k] = P;
    }
    M.set(i, mem);
    return mem;
  },
  botMemDirty(b) { const i = this.botIdx(b); if (i != null) (this.botMemD ||= new Set()).add(i); },
  // the person record for a name (made on first contact)
  botPerson(mem, name, now) {
    const k = lc(cleanName(name));
    if (!k) return null;
    let P = mem.people[k];
    if (!P) {
      P = mem.people[k] = { n: cleanName(name), met: now, seen: now, times: 0, rel: 1, inv: { ask: 0, yes: 0, no: 0, noDay: 0, day: 0 }, did: [], told: [] };
      const L = Object.entries(mem.people).filter(([kk]) => kk !== k);
      if (L.length + 1 > BOT_MEM.people) {
        // the least relevant go first: closeness, how often, how recent
        const score = (Q) => (Q.rel || 0) * 2 + Math.min(10, Q.times || 0) + Math.max(0, 30 - (now - (Q.seen || 0)) / DAY);
        L.sort((a, b) => score(a[1]) - score(b[1]));
        for (const [kk] of L.slice(0, L.length + 1 - BOT_MEM.people)) delete mem.people[kk];
      }
    }
    return P;
  },
  botKnows(b, name) { const mem = this.botMemOf(b); return mem ? mem.people[lc(cleanName(name))] || null : null; },
  // the only writer. kind: met, invite, party, run, boss, quest, lvl, zone, death, craft, sold, duel, told
  botRemember(b, kind, data = {}) {
    if (!KINDS.has(kind)) return;
    const mem = this.botMemOf(b);
    if (!mem) return;
    const now = this.botNow();
    const day = Math.floor(now / DAY);
    const person = (n) => { const P = this.botPerson(mem, n, now); if (P) P.seen = now; return P; };
    const did = (P, k, a, ok) => { if (!P) return; P.did.push({ t: now, k, a: a != null ? String(a).slice(0, 30) : undefined, ok: ok ? 1 : 0 }); if (P.did.length > BOT_MEM.did) P.did.splice(0, P.did.length - BOT_MEM.did); P.rel = Math.min(10, (P.rel || 0) + (ok ? 1 : 0.5)); };
    const log = (a) => { mem.log.push({ t: now, k: kind, a }); if (mem.log.length > BOT_MEM.log) mem.log.splice(0, mem.log.length - BOT_MEM.log); };
    const names = (data.names || (data.name ? [data.name] : [])).filter((n) => n && lc(n) !== lc(b.name));
    switch (kind) {
      case 'met': { const P = person(data.name); if (P && now - (P.lastMeet || 0) > 600000) { P.times = (P.times || 0) + 1; P.lastMeet = now; } break; }
      case 'invite': {
        const P = person(data.name); if (!P) break;
        const I = (P.inv ||= { ask: 0, yes: 0, no: 0, noDay: 0, day: 0 });
        if (I.day !== day) { I.day = day; I.noDay = 0; }
        if (data.ask !== false) I.ask = now;
        if (data.yes) I.yes = (I.yes || 0) + 1;
        else if (data.yes === false) { I.no = (I.no || 0) + 1; I.noDay = (I.noDay || 0) + 1; I.lastNo = now; }
        break;
      }
      case 'party': for (const n of names) did(person(n), 'party', data.why, data.ok !== false); break;
      case 'run': case 'boss': for (const n of names) did(person(n), kind, data.a, data.ok); log({ a: data.a, ok: data.ok ? 1 : 0, w: names.slice(0, 4) }); break;
      case 'duel': { const P = person(data.name); did(P, 'duel', data.won ? 'won' : 'lost', 1); log({ n: data.name, won: data.won ? 1 : 0 }); break; }
      case 'quest': for (const n of names) did(person(n), 'quest', data.a, 1); log({ a: data.a }); break;
      case 'told': {
        const P = person(data.name); if (!P) break;
        for (const f of data.facts || extractTold(data.text)) {
          P.told = (P.told || []).filter((x) => x.s !== f && !(x.s.split(' ')[0] === f.split(' ')[0] && x.s.split(' ')[1] === f.split(' ')[1]));
          P.told.push({ t: now, s: f });
          if (P.told.length > BOT_MEM.told) P.told.splice(0, P.told.length - BOT_MEM.told);
        }
        break;
      }
      case 'lvl': log({ level: data.level ?? b.level }); break;
      case 'zone': log({ zone: data.zone || AREA_BY_ID[data.area]?.name || (data.area === 'valley' ? 'the valley' : data.area), from: data.from }); break;
      case 'death': log({ mob: data.mob || data.by }); break;
      case 'craft': case 'sold': log({ item: data.item || data.a, n: data.n, gold: data.gold }); break;
    }
    this.botMemDirty(b);
  },
  botSaid(b, hash) { const mem = this.botMemOf(b); if (!mem) return; mem.said.push(hash); if (mem.said.length > BOT_MEM.said) mem.said.splice(0, mem.said.length - BOT_MEM.said); },
  // up to 3 short sentences about a person, in words (tests and debugging: "you have met Ahshan 3 times; ...")
  botMemFacts(b, name) {
    const P = this.botKnows(b, name);
    if (!P) return [];
    const now = this.botNow(), ago = (t) => { const d = Math.floor((now - t) / DAY); return d < 1 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
    const out = [];
    if ((P.times || 0) > 1) out.push(`you have met ${P.n} ${P.times} times`);
    const d = (P.did || []).slice(-1)[0];
    if (d) out.push(`you did ${d.k === 'run' ? 'a run of ' + (d.a || 'a dungeon') : d.k === 'boss' ? 'a fight with ' + (d.a || 'a boss') : d.k === 'duel' ? 'a duel' : 'some questing'} with him ${ago(d.t)}${d.k === 'run' || d.k === 'boss' ? (d.ok ? ' (it went well)' : ' (it went badly)') : ''}`);
    const t = (P.told || []).slice(-1)[0];
    if (t) out.push(`he said he ${t.s}`);
    return out.slice(0, 3);
  },
  // (v127, no AI) what the bot remembers about a person, as line slots for shared/botlines.js; only what is really in its
  // memory, so a line that uses one is true: main, alt, heading, need, farming (told), runok / runbad / beatwith /
  // lostwith / questwith / duelwon / duellost (the last thing done together, within 14 days), times (met more than once)
  botMemSlots(b, name) {
    const P = name ? this.botKnows(b, name) : null;
    if (!P) return {};
    const now = this.botNow(), S = toldSlots((P.told || []).map((x) => x.s));
    if ((P.times || 0) > 1) S.times = P.times;
    const d = (P.did || []).filter((x) => now - (x.t || 0) < 14 * DAY && x.k !== 'party').slice(-1)[0];
    if (d) {
      if (d.k === 'run' && d.a) S[d.ok ? 'runok' : 'runbad'] = placeName(d.a);
      else if (d.k === 'boss' && d.a) S[d.ok ? 'beatwith' : 'lostwith'] = placeName(d.a);
      else if (d.k === 'quest' && d.a) S.questwith = d.a;
      else if (d.k === 'duel') S[d.a === 'won' ? 'duelwon' : 'duellost'] = 1;
    }
    return S;
  },
  // saves: every 5 min when changed (driven by botChatTick), each key at most once per 15 s; force on shutdown / log off
  botMemSave(force = false) {
    const D = this.botMemD;
    if (!D?.size || !this.botMem) return 0;
    const now = this.time, last = (this.botMemSavedT ||= new Map());
    let n = 0;
    for (const i of [...D]) {
      if (!force && now - (last.get(i) ?? -1e9) < BOT_MEM.keyGap) continue;
      const mem = this.botMem.get(i);
      if (mem) { try { this.io.save(memKey(i), { ...mem, v: BOT_MEM.v }); n++; } catch { /* the store logs its own errors */ } }
      D.delete(i); last.set(i, now);
    }
    return n;
  },
};
