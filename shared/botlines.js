// Living bots, part C (docs/ai/living_bots_design.md C.5, C.10): the voice of the bots. Every bot line is pre-written here
// (no language model anywhere: the server, the phone, the browser build and offline play all speak the same lines).
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
  // (v122 review) "you seem human", and questions about a life outside the game: honest rule answers, never a made-up home
  seemHuman: /\b(you|u|ya)('?re| are)? (seem|sound|type|act|feel|talk) (pretty |so |very |too |just |really )?(like )?(a |an )?(human|real|person|people|normal player|real player)\b/i,
  personal: /\bhow old (are|r) (you|u)\b|\b(your|ur) (age|real name|name irl|family|kids|job|country|city|town|home|weekend|day job|school|house)\b|\bwhere (do|d) (you|u) live\b|\bwhere (are|r) (you|u) from\b|\bdo (you|u) have (a |any )?(family|kids|job|life|friends|home|house)\b|\boutside (the|this) game\b|\bin real life\b|\birl\b|\bwhat time is it\b|\bwhat did (you|u) (eat|have for)\b|\b(what|how) (was|is) (your|ur) (weekend|day off|holiday)\b|\bwhat do (you|u) do for (a living|work|fun)\b/i,
  here: /\b(you|u) (there|around|about|online)\b|\banyone seen\b|\bwhere (are|r) (you|u)\b/i, // (a name check in world: "Osric you there?")
  recall: /\b(do|did|d) (you|u) remember\b|\bremember (me|what|where|when|who)\b|\bwhat did i (tell|say)\b|\bwhere (was|were|am) i (heading|going|off to|headed)\b|\bwhat (did|do) i (need|say i needed)\b|\bwhat (class )?(do|did) i (play|main)\b|\bwhat('?s| is| was) my (main|class|alt)\b/i,
  howru: /\bhow (are|r) (you|u|ya)\b(?! (from|based))|\bhow'?s it going\b|\bhow goes\b|\bhows (things|life in|you)\b|\bhow (have|'?ve) (you|u) been\b|\byou (good|ok|alright)\?/i,
  // (v127, no AI) small questions that used to fall to the AI: answered by plain lines
  whereami: /\bwhere (are|r) (you|u|ya)( at| now| right now)?\b(?! (from|based))/i,
  tips: /\b(any )?(tips|advice|pointers)\b|\bwhat should i do\b|\bwhere should i (go|level|quest)\b|\bnew (player|here)\b.*\?/i,
  worth: /\bworth (it|doing|going|the trip)\b|\bshould i (go|do|try|head)\b/i,
  gold: /\b(make|making|earn|earning|get|farm|farming)( some| more| good)? (gold|money|coin|coins|silver)\b|\bhow (do|to) (i |you )?(get|make) (rich|gold)\b/i,
  opinion: /\b(do|d) (you|u) like\b|\bwhat do (you|u) think (of|about)\b|\bis (it|this|that) (good|fun|any good)\b|\bhow do (you|u) like\b|\b(you|u) enjoy(ing)?\b/i,
};
export function classify(text, ctx = {}) {
  const t = String(text || '').trim();
  if (!t) return { intent: 'unknown' };
  if (RX.injection.test(t)) return { intent: 'injection' };
  if (RX.bot.test(t) || RX.seemHuman.test(t)) return { intent: 'bot' };
  if (RX.personal.test(t)) return { intent: 'personal' };
  if (RX.insult.test(t)) return { intent: 'insult' };
  // (v122 review) a line about a topic the bots never talk about (women, religion, music, luck, drink, animals, the real world,
  // romance...): a fixed rule answer, never a "yeah" that agrees with it
  { const bw = blockedWord(t); if (bw) return { intent: ['insult', 'profanity'].includes(bw.cat) ? 'insult' : 'offtopic' }; }
  // a line in another script (no three Latin letters in a row): the lists cannot read it
  // (v127 review) and at least one letter outside plain Latin: "ok", "hi", "gg" or "ty" are short english, not another script
  if (/\p{L}/u.test(t) && /[^\x00-\x7F]/.test(t.normalize('NFKD').replace(/\p{M}/gu, '')) && !/[a-z]{3,}/i.test(t.normalize('NFKD').replace(/[^\x00-\x7F]/g, ''))) return { intent: 'foreign' };
  if (RX.recall.test(t)) return { intent: 'recall' };
  if (RX.whereami.test(t)) return { intent: 'whereami' };
  const w = t.match(RX.where);
  if (w) return { intent: 'where', thing: w[3].replace(/[?.!]+$/, '').trim() };
  if (RX.quest.test(t)) return { intent: 'quest' };
  if (RX.level.test(t)) return { intent: 'level' };
  if (RX.doing.test(t)) return { intent: 'doing' };
  if (RX.join.test(t)) return { intent: 'join' };
  if (RX.invite.test(t)) return { intent: 'invite' };
  if (RX.tips.test(t)) return { intent: 'tips' };
  if (RX.gold.test(t)) return { intent: 'gold' };
  if (RX.worth.test(t)) return { intent: 'worth' };
  if (RX.opinion.test(t)) return { intent: 'opinion' };
  if (RX.thanks.test(t)) return { intent: 'thanks' };
  if (RX.again.test(t)) return { intent: 'greet' };
  // "later" alone is a goodbye only in a short line ("heading to the Warrens later" is not one)
  if (RX.bye.test(t) && (t.split(/\s+/).length <= 4 || RX.bye.test(t.replace(/\blater\b/gi, '')))) return { intent: 'bye' };
  if (RX.howru.test(t)) return { intent: 'howru' };
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
// {slots}: name (the bot), to (the player), zone, area, goal, level, next, cls, dungeon, mob, item, npc, where, result, n,
// role, friend (the other bot in a thread), fgoal / fzone (what that friend is doing, where), boss, quest, lvl.
// Memory slots (botchat.js botMemSlots, about the player the bot talks to, only when it really remembers it): main, alt
// (their classes), heading (where they said they were going), need (what they needed), farming, runok / runbad (a run
// done together that went well / badly), beatwith / lostwith (a boss fight done together), questwith (a quest done together), duelwon / duellost (the bot won /
// lost a duel with them), times (how often they met), fact (a told fact, for "do you remember").
// {?slot}: the line needs that slot but does not print it. A line with a missing slot is never used, so every line is true.
// Lines that use more of these slots are picked more often (ruleLine), so a bot that remembers you shows it.
const T = {
  greet: ['hey {to}', 'hi {to}', 'hey, how goes it', 'oh hey {to}', 'hey {to}, all good?', 'hi, whats new', 'yo', 'hey hey', 'o/', 'heya {to}', 'hi there',
    'hey {to}, been {goal} all day', 'oh hi. just {goal} out in {zone}', 'hey, you alright?', 'yo {to}, whats up', 'hey, hows things?'],
  howru: ['not bad, you?', 'good, you?', 'cant complain', 'all good here', 'not bad, just {goal}', 'alright, slow day', 'good thanks, you?', 'fine, been {goal} all day',
    'not bad. busy with {goal}', 'yeah good. you?', 'all good, {goal} in {zone}'],
  thanks: ['np', 'no problem', 'anytime', 'sure thing', 'happy to help', 'glad it helped', 'any time {to}', 'all good', 'no bother', 'np {to}', 'yw', 'easy, np'],
  bye: ['cya {to}', 'see you around', 'take care {to}', 'later', 'safe travels', 'cya, good hunting', 'later {to}', 'cya around', 'see ya', 'take it easy',
    'cya, have fun in {heading}', 'later, hope that {need} turns up', 'cya, ill be around {zone}', 'see you, {to}. good chat'],
  level: ['{level}, {cls}', 'level {level} {cls}', 'just {level}, slowly getting there', '{level} now. you?', 'level {level}, still a way to go', 'im {level}', 'lvl {level}',
    '{level}, nearly {next}', '{level} {cls}, nothing special', '{level}. bit behind the rest'],
  doing: ['{goal} in {zone}', 'just {goal}', '{goal}, nothing fancy', 'mostly {goal} around {zone}', '{goal}. you?', 'not much, {goal}', 'out in {zone}, {goal}',
    'same as always, {goal}', '{goal}. slow day', '{goal} round {zone}, you?'],
  where_npc: ['{npc}, {where}', '{npc} in {where}', 'thats {npc}, over in {where}', 'try {npc} in {where}', '{npc}. hangs about {where}', 'you want {npc}, {where}',
    '{where}, ask for {npc}', 'pretty sure its {npc} in {where}'],
  where_dungeon: ['{dungeon} is out in {where}', 'the door to {dungeon} is in {where}', '{where}, the door is hard to miss', '{dungeon}? its in {where}', 'head for {where}, the door is there',
    'out in {where}', '{where}. the map marks the door', 'door for {dungeon} is in {where}, cant miss it'],
  where_zone: ['{zone}? its for levels {level}', '{zone} is a {level} zone, check the map', '{zone} is levels {level}', 'its on the map, levels {level}', '{zone}, about {level}',
    'levels {level}, the map shows the way', '{zone}? {level} or so', 'check the map, {zone} is the {level} bit'],
  where_none: ['no idea, sorry', 'not sure where that is', 'hm, not sure. the map might show it', 'maybe ask in world chat', 'never heard of it', 'dunno, try the map',
    'not sure, someone in world might know', 'no clue where that is'],
  quest_help: ['{quest} is from {npc} in {where}', 'for {quest} go see {npc}, {where}', 'thats {npc} in {where}', '{quest}? talk to {npc} in {where}', '{npc} gives that one, {where}',
    'go back to {npc} in {where} for {quest}', '{quest} starts with {npc}, {where}', 'did that one. {npc}, {where}'],
  quest_none: ['which one? i might know it', 'not sure, which quest?', 'the quest log marks it on the map usually', 'which quest?', 'hm, whats it called?',
    'check the quest log, it shows where', 'not that one, sorry', 'the map shows quest spots if you open it'],
  invite_ok: ['sure, send an invite', 'yeah why not, invite me', 'sure, ill tag along', 'sounds good, send it', 'yeah ok, invite me', 'sure, send it over', 'ok, im in',
    'yeah, could use the company'],
  invite_busy: ['busy right now, sorry', 'cant right now, maybe later', 'not now, im in the middle of something', 'sorry, already busy', 'maybe later, bit busy',
    'cant now, sorry', 'not right now, sorry', 'in the middle of something, another time'],
  join_ok: ['sure, send me an invite and ill come', 'yeah, invite me and ill join you', 'sure, send an invite', 'yeah, invite me', 'ok, send it and ill come over',
    'sure thing, invite me', 'yeah why not, send it', 'sure, ill come along'],
  // (v127 review) no leading "yes" or "i am": the answer to "is there a human behind this?" must not read as a yes to it
  bot: ['im one of the valley bots. happy to group up though', 'bot here. still glad to help out', 'im a bot, hence the tag. need anything?', 'im a bot. ask away if you need something',
    'bot, yeah. the tag gives it away', 'im one of the bots. still up for a group', 'a bot, but i still quest like everyone else', 'just one of the valley bots', 'nobody at the keys, im a bot',
    'im a bot, the name tag says so'],
  compliment: ['thanks', 'haha thanks', 'appreciate it', 'thanks, took a while', 'kind of you', 'ha, thanks {to}', 'thanks, still working on it', 'cheers for that', 'oh, thanks'],
  insult: ['ok then', 'alright', 'fair enough', 'ok', 'if you say so', 'right then', 'noted', 'sure'],
  injection: ['lol what', 'what?', 'not sure what you mean', 'huh', 'eh?', 'no idea what that means', 'lost me there', 'uh, ok'],
  offtopic: ['not something i talk about, sorry', 'cant help with that one', 'rather stick to the valley stuff', 'no idea, i just do quests and gear', 'pass on that one',
    'not my thing, sorry', 'id rather not, lets talk gear', 'dunno about that one'],
  foreign: ['sorry, english only for me', 'sorry, i only type english', 'english only, sorry', 'cant read that, sorry', 'sorry, only english here', 'no idea, english please?',
    'only know english, sorry', 'sorry, cant read that one'],
  personal: ['nothing to tell, im one of the valley bots', 'im a bot, no life outside the valley', 'just a valley bot, so not much to say there', 'im a bot, the valley is all i know',
    'bot here, so nothing outside the game', 'not much to say, im one of the bots', 'just a bot, i only know the valley', 'nothing there, im a valley bot'],
  unknown: ['hm, not sure', 'no idea tbh', 'maybe ask in world', 'couldnt tell you', 'not sure, sorry', 'dunno', 'no clue, sorry', 'hm, no idea. i mostly stick to {zone}',
    'not sure tbh, been {goal} all day', 'dunno, someone in world chat might know', 'beats me', 'havent a clue', 'dunno, check the map maybe', 'no idea, sorry {to}'],
  chatter: ['yeah', 'true', 'fair', 'makes sense', 'ha, yeah', 'right', 'sounds about right', 'fair enough', 'yeah, same', 'ha', 'mm, true', 'yep', 'oh right', 'ha, true',
    'same here really', 'cant argue with that', 'yeah fair'],
  mention: ['yeah?', 'whats up {to}', 'hm?', 'you called?', 'here, whats up', 'yeah, here', 'right here {to}', 'yo, here', 'yep?', 'here. in {zone}', 'whats up'],
  busy: ['sec, fighting', 'one sec, in a fight', 'hold on, fighting', 'sec', 'brb, mid fight', 'one sec', 'sec, got aggro', 'hang on, fighting'],
  spam: ['slow down mate, im typing with gloves on', 'easy, one at a time', 'too fast for me, slow down', 'whoa, slow down', 'one at a time please', 'easy there',
    'cant keep up, slow down', 'slow down a bit'],
  convo_end: ['anyway, back to it. cya', 'right, back to {goal}. later', 'ok, off i go. cya', 'anyway, gotta get on. see you', 'right, gonna get back to it',
    'anyway, good chatting {to}', 'gotta run, cya {to}', 'right, i should get going. later', 'ok, back to {goal}. take care', 'anyway, see you around {zone}'],
  told_ack: ['nice', 'oh nice', 'ah ok', 'cool', 'oh right', 'ha, nice', 'nice, {main} is a good pick', 'ah, a {main}. solid', '{heading}? decent spot', 'oh, {heading}. have fun',
    'hope that {need} turns up', '{farming}? good shout', 'a {alt} alt too? nice', 'ah, good to know', 'oh nice, noted'],
  remember: ['hey {to}, good to see you', 'oh hey {to}, back already?', 'welcome back {to}', 'oh hey, {to}. how goes', 'hey again {to}', '{to}, hey. you again', 'oh its {to}. hows it going',
    'hey {to}, still on the {main}?', 'hey {to}, make it to {heading} in the end?', 'oh hey {to}. ever get that {need}?', 'hey {to}, up for {runok} again sometime?', 'hey {to}. that {beatwith} fight was a good one', 'oh hey {to}. we still owe {lostwith} one',
    'hey {to}. still sore about {runbad}', '{to}, hey. good run in {runok} that time', 'hey {to}, thanks again for {questwith}', '{to}, hey. rematch sometime?{?duellost}',
    'oh hey {to}. i still owe you a rematch{?duelwon}', 'hey {to}, still {farming}?'],
  recall: ['yeah, you said you {fact}', 'you {fact}, right?', 'sure, you told me you {fact}', 'yep. you {fact}', 'course, you {fact}', 'i think you said you {fact}',
    'yeah yeah, you {fact}', 'you {fact}, if i remember right', 'sure. you {fact}'],
  recall_met: ['yeah, we talked earlier', 'sure, we spoke a bit ago', 'yeah, you whispered me before', 'yeah, we met a few times now', 'sure, {to}. we did {runok} together',
    'course, we ran {runok}', 'yeah, we did {questwith} together', 'yeah, seen you about', 'sure, met you {times} times now', 'yeah, we had that duel{?duelwon}',
    'how could i forget {runbad}', 'yeah, we took down {beatwith} together'],
  recall_unsaid: ['dont think you told me', 'hm, you never said', 'not sure you mentioned it', 'you didnt say, i think', 'did you tell me? cant remember it', 'no idea, you never said',
    'hm, dont remember you saying', 'not that i remember, sorry'],
  recall_none: ['hm, not sure i do', 'not really, remind me?', 'sorry, cant place it', 'dont think we met', 'nope, sorry', 'not ringing a bell', 'hm, no. remind me?', 'cant say i do, sorry'],
  // small questions a player may ask (classify), answered plainly
  whereami: ['in {zone}', '{zone}, {goal}', 'around {zone}', 'out in {zone}', '{zone} right now', 'over in {zone}', '{zone}. you?', 'still in {zone}'],
  tips: ['do the main story, the gear keeps up', 'keep your gear repaired and take every quest in town', 'quest hubs first, then dungeons', 'craft early, saves a lot of gold',
    'dont wander above your level', 'spend your talents, they matter', 'group finder for dungeons, saves walking', 'sell what you dont use, keep the ore', 'follow the quest markers on the map'],
  worth: ['depends on your level, check the map', 'if it fits your level, sure', 'for the quests, yeah', 'yeah if you have a group', 'probably, the xp is decent', 'try it and see',
    'cant hurt to try', 'maybe, depends on your gear'],
  gold: ['gather ore and sell it', 'quests and selling the drops', 'craft stuff and sell it', 'dungeons pay alright', 'sell everything you dont use', 'gather on the way between quests',
    'ore sells well in town', 'honestly just questing'],
  opinion: ['its alright', 'yeah, i like it', 'not bad at all', 'decent', 'its fine, bit slow', 'pretty good', 'cant complain', 'mixed, mostly good'],
  // lines a bot starts itself: each one is only said when it is true (part C botchat.js checks the state)
  ambient_place: ['quiet out here in {zone}', 'still {goal} around {zone}', '{zone} is busy today', 'anyone else around {zone}?', '{goal} in {zone}, slow going', 'long day in {zone}',
    '{zone} again, {goal}', 'anyone near {zone}? could use a hand', 'slow going in {zone} today', '{goal}, {weather}', 'out in {zone}, {weather}'],
  ambient_valley: ['nice day for {goal} in {zone}', 'the roads are busy today', 'anyone else out in {zone}?', 'still {goal} around {zone}', 'carts everywhere on the roads today',
    'quiet in {zone} for once', '{zone} is nice this time of day', 'back in {zone}, {goal}'],
  ambient_reach: ['the ash gets into everything out here', 'watch your footing on the slag', 'hot work out in {zone}', 'my boots are black with ash', 'the reach is no joke at this level',
    'slag everywhere out here', 'too hot in {zone} for my liking', 'ash in my kit again'],
  ambient_rime: ['cold enough to freeze a kettle out here', 'snow again in {zone}', 'my boots are frozen through', 'could use a fire out here', 'ice on everything in {zone}',
    'cold one in {zone} today', 'fingers too cold to type', 'snow up to my knees out here'],
  ambient_heights: ['the wind up here never stops', 'windy one up in {zone}', 'mind the ridges in this wind', 'nearly got blown off a ridge', 'long climb up {zone}',
    'wind up here is something else', 'cold and windy in {zone}', 'keep away from the edges up here'],
  ambient_tidewater_low: ['tide is out, the flats are dry', 'low water now, good time to cross', 'flats are open, tide is out', 'tide out, mind the mud', 'low tide, the flats are walkable',
    'tide went out, crossing now', 'dry flats for a bit, go now', 'tide is low, the Sound is quiet'],
  ambient_tidewater_high: ['tide is in, mind the flats', 'high water at the Sound now', 'tide came in, wait it out', 'flats are under water again', 'high tide, nobody crossing for a bit',
    'tide in, stuck on this side', 'water is up at the flats', 'high water again, take the long way'],
  ambient_rainward_wet: ['its pouring in the gorge again', 'rain again. my boots are full of red mud', 'soaked through in the gorge', 'pouring down, the paths are mud',
    'rain wont stop in the gorge', 'red mud everywhere, its pouring', 'wet one in the gorge today', 'heavy rain in the gorge, watch the slopes'],
  ambient_rainward_dry: ['rain stopped for once', 'dry for now in the gorge, wont last', 'gorge is dry, good time to go', 'rain is off, finally', 'gorge is dry for a while',
    'sun out in the gorge for once', 'rain stopped, the mud is drying', 'no rain for now, go while you can'],
  ambient_weald_gale: ['gale is up in the weald, keep off the marked lines', 'trees coming down across the rides again', 'gale in the weald, watch the trees', 'branches everywhere, gale is up',
    'windy one in the weald, careful', 'gale is up, stay off the rides', 'trees creaking all over the weald', 'weald is rough in this gale'],
  ambient_weald_calm: ['wood is quiet again', 'calm in the weald for now, just leaves falling', 'gale dropped, weald is calm', 'quiet in the weald now', 'calm for now, good time to go through',
    'wind died down in the weald', 'weald is still for once', 'nice and calm under the trees now'],
  levelled: ['finally level {level}', 'level {level}, at last', 'just hit {level}', '{level} now, slowly getting there', 'ding, {level}', 'ding {level}', '{level} finally', 'ding. {level}, slow going'],
  zone_move: ['made it out to {area}', 'finally out in {area}', '{area} at last', 'new ground: {area}', 'just got to {area}', 'first time in {area}', 'out in {area} now', '{area}, here we go'],
  lfg_need: ['lf {role} for {dungeon}', 'need a {role} for {dungeon}', '{dungeon} queue needs a {role}, anyone?', 'lf {role}, {dungeon}', 'any {role} for {dungeon}?',
    '{role} wanted for {dungeon}', 'one {role} for {dungeon} please', 'still need a {role} for {dungeon}'],
  selling: ['selling {item}, cheap', 'got {item} if anyone needs it', 'wts {item}, whisper me', 'anyone need {item}?', '{item} for sale', 'spare {item}, cheap', 'wts {item}', 'have {item}, whisper if you want it'],
  worldboss_call: ['{mob} is up near {zone}, come help', '{mob} is out in {zone}!', 'anyone free? {mob} in {zone}', '{mob} up in {zone}, need people', 'come help with {mob} in {zone}',
    '{mob} spotted in {zone}', '{mob} is up, {zone}. all welcome', 'need hands for {mob} in {zone}'],
  rare_seen: ['careful, {mob} is about, just over there', 'saw {mob} rumbling about nearby', 'heads up, {mob} is close', '{mob} up nearby btw', '{mob} is around here, watch out',
    'just saw {mob} close by', 'mind {mob}, its near', '{mob} wandering about nearby'],
  died: ['{mob} flattened me again', 'got knocked over by {mob}', 'back from the graveyard, {mob} won that one', '{mob} got me', 'well, {mob} wins again', 'ouch, {mob}',
    'note to self, avoid {mob}', '{mob} hits way too hard'],
  duel_yes: ['you are on. fight well', 'a friendly bout? gladly', 'alright, show me what you have', 'first to yield, no hard feelings', 'sure, lets go', 'ok, go easy', 'sure, a quick one', 'alright, lets do it'],
  duel_no: ['not now, catching my breath', 'maybe later, i have machines to break', 'another time', 'not right now, sorry', 'pass for now', 'later maybe', 'not today, sorry', 'cant now, busy'],
  guild_join_yes: ['glad to join, count me in', 'a guild? gladly', 'happy to join, thanks', 'sure, count me in', 'oh nice, sure', 'yeah ok, thanks', 'sure, why not', 'in, thanks'],
  guild_join_no: ['thanks, but i like to wander alone', 'kind of you, but no thanks', 'not for me, sorry', 'nah, im good solo. thanks though', 'not looking for one right now, thanks',
    'ill pass, thanks', 'no thanks, solo for now', 'thanks, but no'],
  guild_greet: ['welcome back, {to}', 'there you are, {to}', 'hey {to}', 'o/ {to}', 'hi {to}', 'yo {to}', 'hey {to}, im out in {zone}', 'oh hey {to}, {goal} here if you want company', 'hey {to}, good timing'],
  guild_ambient: ['{goal} in {zone} if anyone wants to come', 'anyone online up for {goal}?', 'out in {zone}, quiet day', 'just hit {level}, slowly', 'anyone around? im in {zone}',
    '{goal} again, slow going', 'in {zone} if anyone needs a hand', 'quiet tonight, {goal} in {zone}', 'anyone want to group later?'],
  guild_bye: ['heading off, cya all', 'thats me for today, see you', 'logging off, take care', 'off for now, cya', 'thats me done, later all', 'cya all', 'heading out, take care', 'done for today, see you'],
  invite_ask: ['{reason} too? want to team up', 'want to group for {reason}?', 'hey, doing {reason}? could team up', 'group up for {reason}?', 'same {reason}? want to team up',
    'want to do {reason} together?', 'hey, {reason}? i could join', 'up for {reason} together?'],
  invite_yes: ['sure, on my way', 'yeah sounds good', 'sure, lets go', 'ok, coming', 'yeah, omw', 'sure thing', 'ok, lets do it', 'yep, coming over'],
  invite_no: ['cant right now, sorry', 'not now, {reason}', 'maybe later, {reason}', 'sorry, {reason}', 'not right now, {reason}', 'another time, {reason}', 'sorry, cant now', 'pass for now, sorry'],
  invite_declined: ['no worries', 'all good', 'ok, maybe another time', 'ok np', 'fair enough', 'another time then', 'sure, no problem', 'ok, later then'],
  leave: ['gotta head off, thanks for the group', 'thats me done, thanks all', 'off i go, thanks for the help', 'thanks for the group, cya', 'ty all, heading out', 'gg, im off', 'thanks, gonna go do my own stuff', 'good group, cya'],
  lfg_omw: ['omw', 'on my way', 'coming', 'omw to the door', 'be right there', 'heading over', 'otw', 'there in a sec'],
  party_pull: ['pulling', 'going in', 'ready when you are', 'pull?', 'here we go', 'ready', 'go', 'ok, in we go'],
  party_boss_down: ['gg', 'nice, that went well', 'gg all', 'down it goes', 'nice one', 'gg, good work', 'easy', 'thats it down'],
  party_wipe: ['ouch', 'that hurt', 'lets try that again', 'well that went badly', 'again?', 'oof', 'run it back', 'ok, one more go'],
  party_level: ['level {level}, nice', 'ding {level}', 'ding', '{level}, finally', 'oh, {level}', 'nice, {level}', 'just hit {level}', '{level} now'],
  // bot-to-bot threads (botchat.js botThreadTick): an ask, an answer that fits it, a reaction, a short close. The topic comes
  // from the friend's real memory (a run, a boss, a level, a zone move, a knock-down, a quest, a craft), else the place.
  thread_ask: ['still {fgoal}, {friend}?', 'you been out to {zone} yet?', 'how is {fzone} treating you?', 'hows it going?', 'busy day?', 'what you up to?', 'anything good around {fzone}?',
    'how goes, {friend}?', 'you still in {fzone}?'],
  thread_answer: ['not bad, {goal}', 'all good, {goal}', 'cant complain', 'quiet, mostly {goal}', 'same old, {goal} in {zone}', 'slow day. {goal}', 'busy, {goal} mostly',
    'alright. {zone} is quiet today', 'yeah, still {goal}'],
  thread_react: ['nice', 'fair enough', 'same here really', 'ha, figures', 'sounds about right', 'right', 'good to hear', 'ha, same as ever', 'not bad'],
  thread_close: ['yeah. anyway, back to it', 'right, cya around', 'ha, yeah. later', 'anyway, catch you later', 'yep. right, off i go', 'later {friend}', 'true. back to {goal} then',
    'yeah, see you about', 'ha. right, gotta go'],
  thread_ask_run: ['how did {dungeon} go?', 'you get through {dungeon} in the end?', 'how was {dungeon}?', 'heard you did {dungeon}. any good?', 'did {dungeon} go ok?', '{dungeon} go alright?',
    'you finish {dungeon}?', '{friend}, how was {dungeon}?'],
  thread_ask_boss: ['you beat {boss}?', 'how was {boss}?', 'heard you took on {boss}', '{boss} go down ok?', 'did {boss} drop anything?', 'you get {boss} in the end?', 'how hard is {boss}?',
    'that {boss} fight go ok?'],
  thread_answer_ok: ['cleared it, slow but steady', 'got through, last boss took ages', 'yeah all done, decent group', 'went fine, no wipes', 'done, took a while', 'all good, went down in the end',
    'yeah, easy enough with a tank', 'cleared it. my repair bill wasnt pretty', 'yep, done and dusted'],
  thread_answer_bad: ['wiped at the last boss, twice', 'didnt go great, we wiped', 'rough, gave up at the boss', 'not well. back to {zone} for gear', 'we fell apart at the end',
    'nope, wiped and called it', 'badly, it hits hard', 'didnt finish it, next time'],
  thread_react_ok: ['nice, well done', 'good stuff', 'nice, i still need to do it', 'ha, nice one', 'not bad at all', 'nice. ill have to try it', 'good, saves me asking around', 'nice, hope it dropped something good'],
  thread_react_bad: ['ouch', 'that one is rough', 'ha, been there', 'rough. next time', 'yeah it hits hard', 'ouch. give me a shout next time', 'ah well, gear up and go again', 'happens to everyone'],
  thread_ask_lvl: ['level {lvl} now? nice', 'saw you hit {lvl}, nice', 'how is {lvl} treating you?', '{lvl} already? you been busy', 'grats on {lvl}', 'gz on {lvl}', 'you {lvl} now?', '{lvl} finally?'],
  thread_answer_lvl: ['yeah, finally', 'yep, slow going', 'yeah, took long enough', 'ha, yeah. long grind', 'yep, new skills to try', 'yeah, still getting used to it', 'thanks, took all week',
    'yeah, next one will take ages'],
  thread_react_lvl: ['nice, catching me up', 'not bad', 'ha, ill catch you', 'good going', 'nice. im still {level}', 'nice one', 'gz again', 'keep at it'],
  thread_ask_zone: ['how is {tzone}?', 'you made it out to {tzone}?', 'whats {tzone} like?', 'saw you went to {tzone}. any good?', '{tzone} treating you ok?', 'is {tzone} worth it?',
    'still out in {tzone}?', 'hows the hunting in {tzone}?'],
  thread_answer_zone: ['not bad, good xp', 'busy, lots to do', 'tough but fine', 'nice, but the mobs hit hard', 'alright, quests are decent', 'good so far', 'bit much for me still',
    'quiet, just how i like it'],
  thread_react_zone: ['nice, might head there', 'good to know', 'ill check it out later', 'sounds about right', 'huh, ok', 'right, ill give it a go', 'might join you out there', 'nice, maybe later on'],
  thread_ask_death: ['heard {mob} got you', 'you ok? saw {mob} flatten you', '{mob} again?', 'did {mob} get you?', 'what happened with {mob}?', '{mob} still bothering you?',
    'saw you run into {mob}', 'you get back from {mob} ok?'],
  thread_answer_death: ['yeah, it hits like a cart', 'dont remind me', 'yeah, walked right into it', 'yep, there goes my repair money', 'all fine, just my pride', 'ha, yeah. twice',
    'yeah, wasnt paying attention', 'yep, back on my feet now'],
  thread_react_death: ['ha, been there', 'it gets everyone', 'keep away from it next time', 'ouch', 'yeah, give it room', 'happens', 'ha, rough', 'stick to the road next time'],
  thread_ask_quest: ['get {quest} done?', 'how did {quest} go?', 'you finish {quest}?', 'was {quest} a pain?', '{quest} done yet?', 'any trouble with {quest}?', 'still on {quest}?',
    'did you get through {quest}?'],
  thread_answer_quest: ['yep, all done', 'done, finally', 'yeah, easy one', 'yeah, took a while to find everything', 'done, on to the next', 'got it done, decent reward', 'all handed in',
    'yeah, bit of walking but fine'],
  thread_react_quest: ['nice', 'good, thats the annoying one', 'nice, i still need it', 'good stuff', 'ha, nice', 'right, ill do it next', 'nice, one less', 'good, thats that then'],
  thread_ask_craft: ['that {item} turn out ok?', 'saw you made {item}. any good?', 'how is the {item}?', 'make that {item} yourself?', '{item} worth making?', 'your {item} come out ok?',
    'how did the {item} go?', 'mats for {item} a pain?'],
  thread_answer_craft: ['came out fine', 'decent, took ages to gather for', 'yeah, not bad', 'good enough for now', 'fine, the mats were the hard part', 'yep, already using it',
    'its ok, nothing special', 'yeah, worth the effort'],
  thread_react_craft: ['nice', 'nice, might make one', 'good stuff', 'not bad', 'handy', 'nice, saves me buying one', 'ha, nice', 'good, the mats are a pain'],
};
// mood flavour: a few casual words in front, now and then
const MOOD = {
  cheerful: ['oh ', 'haha ', 'nice, '], dry: ['sure, ', 'well, ', 'eh, '], earnest: ['honestly, ', 'hm, ', ''],
  gruff: ['aye, ', 'right, ', 'hm, '], quiet: ['', '', ''],
};
export const TEMPLATES = T;
export const INTENTS = Object.keys(T);
// slots that show the bot knows something particular (memory, the thread topic): lines with them are picked more often
const RICH = new Set(['main', 'alt', 'heading', 'need', 'farming', 'runok', 'runbad', 'beatwith', 'lostwith', 'questwith', 'duelwon', 'duellost', 'times', 'fact', 'dungeon', 'boss', 'quest', 'item', 'mob', 'lvl', 'tzone', 'weather', 'friend', 'fgoal', 'fzone']);

const fill = (s, slots) => s.replace(/\{(\?)?(\w+)\}/g, (m, q, k) => (slots[k] != null && slots[k] !== '' ? (q ? '' : String(slots[k])) : '\u0000'));
const lineHash = (s) => { let h = 2166136261; for (const c of String(s).toLowerCase().replace(/[^a-z]/g, '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export { lineHash };
// a template line for the intent (null when none fits the slots); `said` is the bot's recent hashes (anti-repeat): a line
// said lately is skipped while a fresh one is left. Lines that use memory or topic slots weigh 3x.
export function ruleLine(intent, slots = {}, persona = {}, rnd = Math.random, said = []) {
  const L = T[intent];
  if (!L) return null;
  const ok = [];
  for (const t of L) { const s = fill(t, slots); if (s.includes('\u0000')) continue; let w = 1; for (const m of t.matchAll(/\{\??(\w+)\}/g)) if (RICH.has(m[1])) w = 3; ok.push([s, w]); }
  if (!ok.length) return null;
  const fresh = ok.filter(([s]) => !said.includes(lineHash(s)));
  const pool = fresh.length ? fresh : ok;
  let sum = 0; for (const [, w] of pool) sum += w;
  let r = rnd() * sum, s = pool[pool.length - 1][0];
  for (const [x, w] of pool) { r -= w; if (r < 0) { s = x; break; } }
  const M = MOOD[persona.mood];
  if (M && rnd() < 0.2 && !/^(gg|np|ok|yeah|sure|aye|hm|lol|huh|oh|ah|ha|mm|nice|right|well|cool|thanks|yep|yes|dunno|eh|hmm|okay|haha|honestly)\b/.test(s) && ['chatter', 'doing', 'level', 'unknown', 'compliment', 'told_ack', 'opinion', 'worth'].includes(intent)) s = M[Math.floor(rnd() * M.length) % M.length] + s;
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
