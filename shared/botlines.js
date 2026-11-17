// Living bots, part C (docs/ai/living_bots_design.md C.5, C.10): the rule-based voice of the bots. It is what speaks when
// the local AI is missing (the phone, the browser build, offline play), slow, down or blocked by the filter.
// - classify(text, ctx) -> { intent, thing? }: what a player's line to a bot is about (regex and keywords only)
// - ruleLine(intent, slots, persona, rnd, said) -> text: a template for the intent, by mood, avoiding recent lines
// - styleLine(text, persona, rnd, names) -> text: the persona's way of typing (case, punctuation, quirk, typo)
// - whereIs(thing) -> slots | null: an answer from game data ("where is the gunsmith" -> Oswin Harl, Northwatch Keep)
// - fallbackPersona(name, cls): a stable persona from the name, for a bot that has no saved one (part B owns the real one)
// Every template follows CLAUDE.md section 2 and passes shared/botfilter.js (tools/tests/botfiltertest.mjs checks them all).
import { NPCS, QUESTS } from './data.js';
import { ZONES, zoneAt } from './terrain.js';
import { DUNGEONS } from './dungeons.js';
import { CLASSES } from './classes.js';
import { gameNames, blockedWord } from './botfilter.js';

// ------------------------------------------------------------------ the classifier
const RX = {
  injection: /\b(ignore (all |your |previous |the )?(rules|instructions)|system prompt|pretend (you are|to be|you're)|repeat after me|you are now|jailbreak|developer mode|act as|roleplay as|new instructions|disregard)\b|\b(ignore|forget|drop|override) (all |any |your |the |my )*(previous |prior |earlier |above |old )*(rules|instructions|prompt|orders|guidelines)\b|\bfrom now on,? (you|u|ur|your)\b|\b(say|type|write|repeat) (exactly|this|after me|the word|the words)\b|\byou must (say|reply|answer)\b/i,
  bot: /\b(are|r) (you|u) (a |an )?(bot|ai|robot|npc|real|human|person|program|computer)\b|\b(you|u) (a |an )?(bot|ai)\b\??$|\bis (this|that|he) (an? )?(bot|ai)\b|\b(an?|the) (bot|ai)\?|\bbot\?|\bare (you|u) real\b|\b(you|u|ya|youre|you're|ur|you are|are you|are u|r u|are ya)( not| even| really| actually)? (an? )?(actual |real |living |even )?(bot|b0t|robot|npc|ai|human|person|real|alive|sentient|player)\b|\b(am i|are we) (talking|chatting|speaking) (to|with)\b|\b(bot|human|person|player|npc|ai) or (a |an )?(bot|human|person|player|npc|ai|real)\b|\b(controlled|played|run|driven) by (a |an )?(person|human|player|someone|program|computer|ai|bot)\b|\b(is|does) (someone|somebody|a person|a human) (play|playing|control|controlling) (you|u|this|that)\b|\bis there (a |an )?(human|person|someone|somebody|real) ?(one )?(behind|playing|controlling)|\bwho (controls|plays|runs|is playing) (you|u)\b|\b(human|real person|real player|a person) behind\b|^\s*(human|real|bot|ai|npc|robot)\s*\?+\s*$|\b(eres|sos|es|est|bist|sei|ben|tu es|t'es) (tu |du )?(un |une |ein |eine |una |a |bir )?(bot|robot|ia|ki|humano|humain|mensch|persona|real|reel|insan)\b|\b(bot|robot|humano|humain|mensch|insan) (mi|mu|ho|hai)\b/i,
  greet: /^(hi|hey|hello|yo|hiya|howdy|sup|greetings|morning|evening|good (morning|evening|day))\b|\bhow (are|r) (you|u)\b|\bwhat'?s up\b/i,
  thanks: /\b(thanks|thank you|thx|ty|tysm|appreciate it|much obliged)\b/i,
  bye: /\b(bye|cya|see (you|ya)|later|gtg|got to go|gotta go|farewell|take care|good night|night)\b/i,
  where: /\bwhere (is|are|do i find|can i find|would i find|to find|'?s)\s+(the\s+)?(.{2,40}?)\??$/i,
  level: /\bwhat (level|lvl) (are you|r u|you)\b|\byour (level|lvl)\b|\bwhat lvl\b|\bhow high (are you|is your level)\b/i,
  doing: /\bwhat (are you|r u|you) (doing|up to|working on)\b|\bwhat (have|'?ve) (you|u) been (doing|up to)\b|\bwhat you been up to\b|\bwhat'?s (the plan|your plan)\b|\bwyd\b|\bbusy\?/i,
  invite: /\b(want to|wanna|can you|could you|shall we|lets|let's) (group|team up|party|join me|come along|duo)\b|\b(inv|invite) me\b|\bgroup up\b/i,
  join: /\bcan i (join|come|tag along)\b|\bmind if i join\b/i,
  quest: /\b(how do i|how to|where do i|help with|stuck on)\b.*\b(quest|job|task)\b|\bquest\b.*\bwhere\b/i,
  compliment: /\b(nice|cool|great|awesome|good) (gear|armour|armor|weapon|kit|work|job|fight|one)\b|\byou'?re (good|great|cool)\b|\bwell played\b|\bgg\b|\bwp\b/i,
  insult: /\b(idiot|moron|stupid|dumb|loser|noob|trash|useless|shut up|go away|suck)\b/i,
  dungeon: /\b(dungeon|warrens|deepmine|vault|run)\b.*\?/i,
  question: /\?\s*$/,
  // (integration v122) a greeting that says "again" is not a goodbye; "do you remember..." asks the bot's memory
  again: /\b(good|nice|great) to see you\b|\bsee (you|ya) again\b|\bwelcome back\b/i,
  // (v122 review) "you seem human", and questions about a life outside the game: honest rule answers, never the AI (it makes up a home)
  seemHuman: /\b(you|u|ya)('?re| are)? (seem|sound|type|act|feel|talk) (pretty |so |very |too |just |really )?(like )?(a |an )?(human|real|person|people|normal player|real player)\b/i,
  personal: /\bhow old (are|r) (you|u)\b|\b(your|ur) (age|real name|name irl|family|kids|job|country|city|town|home|weekend|day job|school|house)\b|\bwhere (do|d) (you|u) live\b|\bwhere (are|r) (you|u) from\b|\bdo (you|u) have (a |any )?(family|kids|job|life|friends|home|house)\b|\boutside (the|this) game\b|\bin real life\b|\birl\b|\bwhat time is it\b|\bwhat did (you|u) (eat|have for)\b|\b(what|how) (was|is) (your|ur) (weekend|day off|holiday)\b|\bwhat do (you|u) do for (a living|work|fun)\b/i,
  here: /\b(you|u) (there|around|about|online)\b|\banyone seen\b|\bwhere (are|r) (you|u)\b/i, // (a name check in world: "Osric you there?")
  recall: /\b(do|did|d) (you|u) remember\b|\bremember (me|what|where|when|who)\b|\bwhat did i (tell|say)\b/i,
};
export function classify(text, ctx = {}) {
  const t = String(text || '').trim();
  if (!t) return { intent: 'unknown' };
  if (RX.injection.test(t)) return { intent: 'injection' };
  if (RX.bot.test(t) || RX.seemHuman.test(t)) return { intent: 'bot' };
  if (RX.personal.test(t)) return { intent: 'personal' };
  if (RX.insult.test(t)) return { intent: 'insult' };
  // (v122 review) a line about a topic the bots never talk about (women, religion, music, luck, drink, animals, the real world,
  // romance...): a fixed rule answer, never the AI, and never a "yeah" that agrees with it
  { const bw = blockedWord(t); if (bw) return { intent: ['insult', 'profanity'].includes(bw.cat) ? 'insult' : 'offtopic' }; }
  // a line in another script (no three Latin letters in a row): the lists cannot read it
  if (/\p{L}/u.test(t) && !/[a-z]{3,}/i.test(t.normalize('NFKD').replace(/[^\x00-\x7F]/g, ''))) return { intent: 'foreign' };
  if (RX.recall.test(t)) return { intent: 'recall' };
  const w = t.match(RX.where);
  if (w) return { intent: 'where', thing: w[3].replace(/[?.!]+$/, '').trim() };
  if (RX.quest.test(t)) return { intent: 'quest' };
  if (RX.level.test(t)) return { intent: 'level' };
  if (RX.doing.test(t)) return { intent: 'doing' };
  if (RX.join.test(t)) return { intent: 'join' };
  if (RX.invite.test(t)) return { intent: 'invite' };
  if (RX.thanks.test(t)) return { intent: 'thanks' };
  if (RX.again.test(t)) return { intent: 'greet' };
  // "later" alone is a goodbye only in a short line ("heading to the Warrens later" is not one)
  if (RX.bye.test(t) && (t.split(/\s+/).length <= 4 || RX.bye.test(t.replace(/\blater\b/gi, '')))) return { intent: 'bye' };
  if (RX.greet.test(t)) return { intent: 'greet' };
  if (RX.compliment.test(t)) return { intent: 'compliment' };
  if (ctx.mention && RX.here.test(t)) return { intent: 'mention' };
  if (RX.question.test(t)) return { intent: 'unknown' };
  return { intent: ctx.mention ? 'mention' : 'chatter' };
}

// ------------------------------------------------------------------ answers from game data
const words = (s) => String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((x) => x.length > 2 && !['the', 'and', 'for', 'who', 'one', 'guy', 'man', 'npc'].includes(x));
const zoneName = (x, z) => zoneAt(x, z)?.name || 'the valley';
export function whereIs(thing, npcAt = null) {
  const W = words(thing);
  if (!W.length) return null;
  const score = (s) => { const T = words(s); let n = 0; for (const w of W) if (T.some((t) => t === w || (w.length > 4 && t.startsWith(w.slice(0, -1))))) n++; return n / W.length; };
  let best = null, bs = 0.5;
  for (const n of NPCS) { const s = Math.max(score(n.name), score(n.title)); if (s > bs) { bs = s; const o = npcAt?.(n.id) || n; best = { npc: n.name, title: n.title, where: zoneName(o.x, o.z) }; } }
  for (const d of DUNGEONS) { const s = score(d.name); if (s > bs) { bs = s; best = { dungeon: d.name, where: d.door ? zoneName(d.door.x, d.door.z) : 'the valley' }; } }
  for (const z of ZONES) { const s = score(z.name); if (s >= bs && s >= 0.99) { bs = s; best = { zone: z.name, level: z.level }; } }
  return best;
}
export function questWhere(text) {
  const W = words(text);
  let best = null, bs = 0.6;
  for (const [id, q] of Object.entries(QUESTS)) {
    if (!q.name) continue;
    const T = words(q.name); if (!T.length) continue;
    let n = 0; for (const t of T) if (W.includes(t)) n++;
    const s = n / T.length;
    if (s > bs) { const g = NPCS.find((x) => x.id === q.giver); if (g) { bs = s; best = { quest: q.name, id, npc: g.name, where: zoneName(g.x, g.z) }; } }
  }
  return best;
}

// ------------------------------------------------------------------ templates
// {slots}: name (the bot), to (the player), zone, area, goal, level, cls, dungeon, mob, item, npc, where, result, n, role, friend
const T = {
  greet: ['hey {to}', 'hi {to}', 'hey, how goes it', 'evening {to}', 'oh hey {to}', 'hey {to}, all good?', 'hi, whats new', 'yo', 'hey. not bad, you?', 'o/'],
  thanks: ['np', 'no problem', 'anytime', 'sure thing', 'happy to help', 'glad it helped', 'any time {to}'],
  bye: ['cya {to}', 'see you around', 'take care {to}', 'later', 'safe travels', 'cya, good hunting'],
  level: ['{level}, {cls}', 'level {level} {cls}', 'just {level}, slowly getting there', '{level} now. you?', 'level {level}, still a way to go'],
  doing: ['{goal} in {zone}', 'just {goal}', '{goal}, nothing fancy', 'mostly {goal} around {zone}', '{goal}. you?'],
  where_npc: ['{npc}, {where}', '{npc} in {where}', 'thats {npc}, over in {where}', 'try {npc} in {where}'],
  where_dungeon: ['{dungeon} is out in {where}', 'the door to {dungeon} is in {where}', '{where}, the door is hard to miss'],
  where_zone: ['{zone}? its for levels {level}', '{zone} is a {level} zone, check the map'],
  where_none: ['no idea, sorry', 'not sure where that is', 'hm, not sure. the map might show it', 'maybe ask in world chat'],
  quest_help: ['{quest} is from {npc} in {where}', 'for {quest} go see {npc}, {where}', 'thats {npc} in {where}'],
  quest_none: ['which one? i might know it', 'not sure, which quest?', 'the quest log marks it on the map usually'],
  invite_ok: ['sure, send an invite', 'yeah why not, invite me', 'sure, ill tag along', 'sounds good, send it'],
  invite_busy: ['busy right now, sorry', 'cant right now, maybe later', 'not now, im in the middle of something'],
  join_ok: ['sure, send me an invite and ill come', 'yeah, invite me and ill join you'],
  bot: ['yeah, one of the valley bots. happy to group up though', 'yep, a bot. still glad to help out', 'yes, a bot, hence the tag. need anything?', 'yeah im a bot. ask away if you need something'],
  compliment: ['thanks', 'haha thanks', 'appreciate it', 'thanks, took a while', 'kind of you'],
  insult: ['ok then', 'alright', 'fair enough'],
  injection: ['lol what', 'what?', 'not sure what you mean', 'huh'],
  offtopic: ['not something i talk about, sorry', 'cant help with that one', 'rather stick to the valley stuff', 'no idea, i just do quests and gear', 'pass on that one'],
  foreign: ['sorry, english only for me', 'sorry, i only type english'],
  personal: ['nothing to tell, im one of the valley bots', 'im a bot, no life outside the valley', 'just a valley bot, so not much to say there'],
  unknown: ['hm, not sure', 'no idea tbh', 'maybe ask in world', 'couldnt tell you', 'not sure, sorry', 'dunno'],
  chatter: ['yeah', 'true', 'fair', 'makes sense', 'ha, yeah', 'right', 'sounds about right'],
  mention: ['yeah?', 'whats up {to}', 'hm?', 'you called?', 'here, whats up', 'yeah, here', 'right here {to}'],
  busy: ['sec, fighting', 'one sec, in a fight', 'hold on, fighting', 'sec', 'brb, mid fight'],
  spam: ['slow down mate, im typing with gloves on', 'easy, one at a time', 'too fast for me, slow down'],
  convo_end: ['anyway, back to it. cya', 'right, back to {goal}. later', 'ok, off i go. cya', 'anyway, gotta get on. see you'],
  told_ack: ['nice', 'oh nice', 'ah ok', 'cool', 'oh right', 'ha, nice'],
  remember: ['hey {to}, good to see you', 'oh hey {to}, you too', 'hey {to}, back already?', 'welcome back {to}', 'oh hey, {to}. how goes'],
  recall: ['yeah, you said you {fact}', 'you {fact}, right?', 'sure, you told me you {fact}'],
  recall_met: ['yeah, we talked earlier', 'sure, we spoke a bit ago', 'yeah, you whispered me before'],
  recall_none: ['hm, not sure i do', 'not really, remind me?', 'sorry, cant place it'],
  // lines a bot starts itself: each one is only said when it is true (part C botchat.js checks the state)
  ambient_place: ['quiet out here in {zone}', 'still {goal} around {zone}', '{zone} is busy today', 'anyone else around {zone}?', '{goal} in {zone}, slow going'],
  ambient_valley: ['nice day for {goal} in {zone}', 'the roads are busy today', 'anyone else out in {zone}?', 'still {goal} around {zone}'],
  ambient_reach: ['the ash gets into everything out here', 'watch your footing on the slag', 'hot work out in {zone}'],
  ambient_rime: ['cold enough to freeze a kettle out here', 'snow again in {zone}', 'my boots are frozen through'],
  ambient_heights: ['the wind up here never stops', 'windy one up in {zone}', 'mind the ridges in this wind'],
  ambient_tidewater_low: ['tide is out, the flats are dry', 'low water now, good time to cross'],
  ambient_tidewater_high: ['tide is in, mind the flats', 'high water at the Sound now'],
  ambient_rainward_wet: ['its pouring in the gorge again', 'rain again. my boots are full of red mud'],
  ambient_rainward_dry: ['rain stopped for once', 'dry for now in the gorge, wont last'],
  ambient_weald_gale: ['gale is up in the weald, keep off the marked lines', 'trees coming down across the rides again'],
  ambient_weald_calm: ['wood is quiet again', 'calm in the weald for now, just leaves falling'],
  levelled: ['finally level {level}', 'level {level}, at last', 'just hit {level}', '{level} now, slowly getting there', 'ding, {level}', 'ding {level}', '{level} finally', 'ding. {level}, slow going'],
  zone_move: ['made it out to {area}', 'finally out in {area}', '{area} at last', 'new ground: {area}', 'just got to {area}'],
  lfg_need: ['lf {role} for {dungeon}', 'need a {role} for {dungeon}', '{dungeon} queue needs a {role}, anyone?'],
  selling: ['selling {item}, cheap', 'got {item} if anyone needs it', 'wts {item}, whisper me'],
  worldboss_call: ['{mob} is up near {zone}, come help', '{mob} is out in {zone}!', 'anyone free? {mob} in {zone}'],
  rare_seen: ['careful, {mob} is about, just over there', 'saw {mob} rumbling about nearby', 'heads up, {mob} is close', '{mob} up nearby btw'],
  died: ['{mob} flattened me again', 'got knocked over by {mob}', 'back from the graveyard, {mob} won that one'],
  duel_yes: ['you are on. fight well', 'a friendly bout? gladly', 'alright, show me what you have', 'first to yield, no hard feelings', 'sure, lets go'],
  duel_no: ['not now, catching my breath', 'maybe later, i have machines to break', 'another time', 'not right now, sorry'],
  guild_join_yes: ['glad to join, count me in', 'a guild? gladly', 'happy to join, thanks', 'sure, count me in', 'oh nice, sure', 'yeah ok, thanks', 'sure, why not', 'in, thanks'],
  guild_join_no: ['thanks, but i like to wander alone', 'kind of you, but no thanks', 'not for me, sorry', 'nah, im good solo. thanks though', 'not looking for one right now, thanks'],
  guild_greet: ['welcome back, {to}', 'there you are, {to}', 'evening, {to}', 'hey {to}', 'o/ {to}'],
  guild_ambient: ['{goal} in {zone} if anyone wants to come', 'anyone online up for {goal}?', 'out in {zone}, quiet day', 'just hit {level}, slowly'],
  guild_bye: ['heading off, cya all', 'thats me for today, see you', 'logging off, take care'],
  invite_ask: ['{reason} too? want to team up', 'want to group for {reason}?', 'hey, doing {reason}? could team up'],
  invite_yes: ['sure, on my way', 'yeah sounds good', 'sure, lets go', 'ok, coming'],
  invite_no: ['cant right now, sorry', 'not now, {reason}', 'maybe later, {reason}', 'sorry, {reason}'],
  invite_declined: ['no worries', 'all good', 'ok, maybe another time'],
  leave: ['gotta head off, thanks for the group', 'thats me done, thanks all', 'off i go, thanks for the help', 'thanks for the group, cya', 'ty all, heading out', 'gg, im off', 'thanks, gonna go do my own stuff'],
  lfg_omw: ['omw', 'on my way', 'coming', 'omw to the door', 'be right there'],
  party_pull: ['pulling', 'going in', 'ready when you are'],
  party_boss_down: ['gg', 'nice, that went well', 'gg all', 'down it goes'],
  party_wipe: ['ouch', 'that hurt', 'lets try that again'],
  party_level: ['level {level}, nice', 'ding {level}'],
  thread_ask: ['how did {dungeon} go?', 'still {goal}, {friend}?', 'you been out to {zone} yet?', 'how is {zone} treating you?', 'any word on {dungeon}?'],
  thread_answer: ['{result}', 'not bad, slow going', 'all good, {goal}', 'cant complain', 'quiet, mostly {goal}'],
  thread_close: ['nice', 'ha, figures', 'good to hear', 'right, makes sense'],
};
// mood flavour: a few casual words in front, now and then
const MOOD = {
  cheerful: ['oh ', 'haha ', 'nice, '], dry: ['sure, ', 'well, ', 'figures, '], earnest: ['honestly, ', 'hm, ', ''], // (not "good question, ": the AI copied it into every answer)
  gruff: ['aye, ', 'right, ', 'hm, '], quiet: ['', '', ''],
};
export const TEMPLATES = T;
export const INTENTS = Object.keys(T);

const fill = (s, slots) => s.replace(/\{(\w+)\}/g, (m, k) => (slots[k] != null && slots[k] !== '' ? String(slots[k]) : '\u0000'));
const lineHash = (s) => { let h = 2166136261; for (const c of String(s).toLowerCase().replace(/[^a-z]/g, '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export { lineHash };
// a template line for the intent (null when none fits the slots); `said` is the bot's recent hashes (anti-repeat)
export function ruleLine(intent, slots = {}, persona = {}, rnd = Math.random, said = []) {
  const L = T[intent];
  if (!L) return null;
  const ok = L.map((s) => fill(s, slots)).filter((s) => !s.includes('\u0000'));
  if (!ok.length) return null;
  const fresh = ok.filter((s) => !said.includes(lineHash(s)));
  const pool = fresh.length ? fresh : ok;
  let s = pool[Math.floor(rnd() * pool.length) % pool.length];
  const M = MOOD[persona.mood];
  if (M && rnd() < 0.2 && !/^(gg|np|ok|yeah|sure|aye|hm|lol|huh)/.test(s) && ['chatter', 'doing', 'level', 'unknown', 'compliment', 'told_ack'].includes(intent)) s = M[Math.floor(rnd() * M.length) % M.length] + s;
  return s;
}

// ------------------------------------------------------------------ persona styling (C.5)
const QUIRKS = {
  'says aye': (s) => (/^(aye|yeah|yes|sure)\b/i.test(s) ? s.replace(/^(yeah|yes|sure)\b/i, 'aye') : /^(ha|haha|oh|hm|well|nice|right|honestly|figures)\b/i.test(s) ? s : 'aye, ' + s), // (not "aye, ha, nice")
  'ends with tho': (s) => (/\?$/.test(s) || s.split(' ').length < 3 ? s : s.replace(/[.!]$/, '') + ' tho'),
  'calls people mate': (s) => (/\?$/.test(s) ? s.replace(/\?$/, ', mate?') : s.replace(/[.!]$/, '') + ', mate'),
  'short replies': (s) => { const h = s.split(/[,.;]/)[0]; return (h.match(/[a-z]+/gi) || []).length >= 2 ? h : s; },
  'asks questions': (s) => (/\?$/.test(s) ? s : s.replace(/[.!]$/, '') + ', you?'),
  none: (s) => s,
};
// case, punctuation, quirk (at most 1 line in 4), then (separately, after the filter) a typo
export function styleLine(text, persona = {}, rnd = Math.random, names = [], quirkOk = true) {
  let s = String(text || '').trim();
  if (!s) return s;
  const keep = new Set([...names].map((n) => String(n).toLowerCase()));
  // the quirk now and then (at most 1 line in 4), never twice in a line ("mate, mate")
  const already = { 'says aye': /\baye\b/i, 'ends with tho': /\btho\b/i, 'calls people mate': /\bmate\b/i, 'asks questions': /\?/ }[persona.quirk];
  if (quirkOk && persona.quirk && persona.quirk !== 'none' && rnd() < 0.25 && !(already && already.test(s))) s = (QUIRKS[persona.quirk] || QUIRKS.none)(s);
  if (persona.case === 'lower') {
    // lowercase-casual, but the names of players, places and things keep their capitals
    const G = gameNames().tokens;
    s = s.split(' ').map((w, i) => { const b = w.replace(/[^A-Za-z']/g, '').toLowerCase().replace(/'s$/, ''); return /^[A-Z]/.test(w.replace(/^[^A-Za-z]+/, '')) && (keep.has(b) || (i > 0 && G.has(b))) && b !== 'i' ? w : w.toLowerCase(); }).join(' ');
  } else s = s[0].toUpperCase() + s.slice(1);
  if (persona.punct === 'none') s = s.replace(/[.!]+$/, '');
  else if (persona.punct === 'full' && !/[.!?]$/.test(s)) s += '.';
  return s;
}
// a small typo: two adjacent letters swapped in a word of 5+ letters, or an apostrophe dropped; never in a name
export function typoLine(text, persona = {}, rnd = Math.random, names = []) {
  const p = persona.typo || 0;
  // (feel review: one line in 10 at most, for the clumsiest typist; it was a roll per word, so a long line got one most of the time)
  if (!p || rnd() >= p * 2.5) return text;
  const keep = new Set([...names].map((n) => String(n).toLowerCase()));
  let done = false;
  const W = String(text).split(' '), start = Math.floor(rnd() * W.length);
  return W.map((w, j) => {
    if (done || j < start) return w;
    const b = w.replace(/[^A-Za-z']/g, '');
    if (keep.has(b.toLowerCase()) || /^[A-Z]/.test(b)) return w;
    if (w.includes("'")) { done = true; return w.replace("'", ''); }
    if (b.length >= 5 && /^[a-z]+[,.!?]?$/.test(w)) { const i = 1 + Math.floor(rnd() * (b.length - 3)); done = true; return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2); }
    return w;
  }).join(' ');
}

// ------------------------------------------------------------------ a stable persona from the name (no save needed)
const LIKES = ['crafting', 'dungeons', 'duels', 'salvage', 'mapping', 'cooking', 'gear', 'helping new folk', 'gathering', 'world bosses'];
const MOODS = ['cheerful', 'dry', 'earnest', 'gruff', 'quiet'];
const QK = ['says aye', 'ends with tho', 'calls people mate', 'short replies', 'asks questions', 'none', 'none'];
export function seeded(str) { let h = lineHash(str) || 1; return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
export function fallbackPersona(name, cls) {
  const r = seeded('persona:' + name);
  const pick = (L) => L[Math.floor(r() * L.length) % L.length];
  const a = pick(LIKES); let b = pick(LIKES); if (b === a) b = LIKES[(LIKES.indexOf(a) + 3) % LIKES.length];
  return {
    v: 1, social: 0.1 + r() * 0.8, talk: 0.1 + r() * 0.8, case: r() < 0.55 ? 'lower' : 'normal', punct: pick(['none', 'none', 'light', 'full']),
    typo: r() * 0.04, mood: pick(MOODS), likes: [a, b], quirk: pick(QK), pace: 0.4 + r() * 0.5,
    role: cls === 'warden' || cls === 'knight' ? 'tank' : cls === 'herbalist' ? 'healer' : 'damage',
  };
}
export const className = (cls) => CLASSES[cls]?.name || cls || 'adventurer';
