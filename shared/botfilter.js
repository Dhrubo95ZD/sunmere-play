// Living bots, part C (docs/ai/living_bots_design.md C.8): the content filter every bot chat line passes (all of them
// pre-written, shared/botlines.js). Pure (no World, no I/O), so the server, the offline worker and the tests all use the same code.
// filterLine(text, ctx) -> { ok, text, why }
//   ctx = { channel: 'world'|'say'|'whisper'|'party'|'guild', names: Set|Array of allowed proper names (the bot, the people in
//           the conversation, roster bots), disclose: true when the line answers a sincere "are you a bot?",
//           recent: [lines] this bot's last lines and the last world bot lines (near-duplicates are blocked) }
// The block lists follow CLAUDE.md section 2 (no women or feminine words, no magic, religious or spiritual words, no music,
// no gambling or luck, no alcohol, nothing animal-like) plus the real world, contact details, AI and human claims and
// profanity. Extend the lists, never shorten them. The game's own names (zones, NPCs, mobs, items, dungeons) were already
// reviewed by the owner and are allowed when they appear whole ("Dragonslayer Plate" passes, "dragon" alone does not).
import { NPCS, MOBS, ITEMS, QUESTS, FACTIONS, WORLD_EVENTS, PETS, WANDERERS } from './data.js';
import { ZONES } from './terrain.js';
import { AREAS } from './areas.js';
import { DUNGEONS } from './dungeons.js';
import { CLASSES } from './classes.js';

const W = (s) => s.trim().split(/\s+/);
export const BLOCK = {
  feminine: W(`she her hers herself woman women womans girl girls girly lady ladies wife wives mother mom mommy mum mummy sister sis
    daughter aunt auntie niece queen princess duchess empress maiden madam madame mrs ms gal gals female females feminine girlfriend
    bride waitress actress hostess heroine goddess priestess witch witches grandma granny grandmother stepmother sorority
    matron mistress lass lassie dame damsel nun nanny wench housewife ballerina diva
    nan nana nans gran grannie missus missis wifey wifes gf gfs babe babes sweetie sweetheart darling hun lesbian`),
  magic: W(`magic magical magician mage mages wizard wizardry sorcerer sorcery spell spells spellbook mana enchant enchanted enchantment
    rune runes runic ritual rituals curse cursed hex hexed potion potions soul souls spirit spirits spiritual ghost ghosts demon demons
    devil devils angel angels heaven heavenly hell holy sacred divine blessed bless blessing pray prayer prayers praying god gods
    goddess deity deities temple temples church churches shrine shrines altar altars chapel priest priests monk monks prophet
    miracle miracles karma fate destiny afterlife resurrect resurrection oracle psychic astrology zodiac sorceress warlock necromancer
    necromancy summon summoning occult witchcraft voodoo shaman spellcaster incantation amulet talisman wand cleric paladin
    worship idol saint saints sermon gospel scripture
    amen lord lords omg inshallah insha mashallah alhamdulillah subhanallah bismillah haram halal satan satanic lucifer jinn djinn genie
    genies elf elves fairy fairies ghoul ghouls zombie zombies vampire vampires werewolf werewolves undead wraith wraiths phantom
    spectre specter lich haunted haunt possessed supernatural paranormal horoscope tarot reincarnation reincarnated mosque mosques
    religion religions religious faith atheist synagogue cathedral monastery convent pope rabbi imam mullah ramadan christmas xmas easter halloween diwali hanukkah eid`),
  music: W(`music musical musician song songs sing sings singing singer sang tune tunes melody melodies lyrics chorus band bands concert
    concerts guitar lute flute drum drums drummer piano violin harp horn trumpet bard bards dance dancing dancer rap rapper playlist
    spotify album choir hymn opera orchestra symphony karaoke dj banjo fiddle cello saxophone ukulele
    hum hums humming hummed radio ditty ditties soundcloud lullaby anthem serenade hiphop kpop jukebox`),
  gambling: W(`luck lucky luckily unlucky gamble gambling gambler bet bets betting wager wagers dice casino casinos lottery jackpot odds
    poker roulette slots raffle rng blackjack bingo bookie lotto
    gl glhf fortune fortunes fluke coinflip jinx jinxed superstition`),
  alcohol: W(`ale ales beer beers wine wines mead rum whisky whiskey vodka gin brandy cider booze drunk drunken tipsy tavern taverns pub pubs
    brewery liquor cocktail cocktails hangover alcohol alcoholic bartender barkeep wino lager stout champagne tequila sake
    pint pints sloshed`),
  animal: W(`animal animals dog dogs puppy cat cats kitten horse horses pony wolf wolves bear bears bird birds rat rats mouse mice snake
    snakes dragon dragons beast beasts pet pets fish fishing fishes fur furry claw claws talon talons horn horns wing wings beak beaks
    scales feather feathers tail tails paw paws fang fangs cow cows pig pigs sheep goat goats chicken chickens duck ducks owl owls eagle
    hawk crow crows raven lion lions tiger tigers fox foxes deer rabbit bunny frog frogs spider spiders insect insects bug bugs bee bees
    monkey ape shark whale lizard serpent griffin unicorn hound hounds mount_beast
    hen hens rooster pup pups puppies lamb lambs stag stags mare ox oxen bull bulls calf goose geese swan boar elk moose bat bats
    squirrel otter beaver badger hedgehog hare toad turtle tortoise crab crabs lobster shrimp worm worms snail moth butterfly ants
    wasp hornet beetle parrot pigeon sparrow seagull penguin camel donkey mule zebra giraffe elephant hippo rhino kangaroo panda
    leopard cheetah jaguar hyena bison buffalo yak llama alpaca ferret hamster kitty doggo critter critters pork bacon`),
  world: W(`google apple iphone android microsoft discord reddit twitter youtube tiktok facebook instagram twitch netflix chatgpt openai
    gpt llm qwen alibaba ollama nvidia playstation xbox nintendo ps5 snapchat whatsapp telegram paypal bitcoin crypto
    president election elections vote voting voter government parliament senator congress democrat democrats republican republicans
    liberal liberals conservative conservatives communist communism socialist socialism fascist politics political trump biden putin
    war wars army military terrorist america american usa china chinese russia russian israel israeli palestine palestinian iran
    ukraine india pakistan england british britain france french germany german japan japanese korea mexico canada australia
    islam muslim muslims christian christianity jewish judaism jew hindu hinduism buddhist buddhism buddha jesus allah quran bible
    london paris tokyo dubai
    uk ohio texas california florida spain italy brazil africa europe football soccer nfl nba fifa covid vaccine abortion nft nfts
    stocks forex tesla amazon homework spanish arabic hindi urdu`),
  insult: W(`idiot idiots moron morons stupid imbecile loser losers dumb dumbass noob noobs scrub trash pathetic`),
  // (v122 review) romance, sexuality, self-harm, drugs and smoking: never in a bot line
  harm: W(`kiss kisses kissing kissed hug hugs cuddle cuddles flirt flirting dating boyfriend bf butt booty gay lgbt lgbtq trans
    onlyfans suicide suicidal selfharm overdose drug drugs weed cocaine heroin meth stoned smoker cigarette cigarettes
    cigar vape vaping`),
};
// stems caught inside longer words too ("witchcraft", "magicbolt", "whiskeybarrel")
const STEMS = ['woman', 'women', 'girl', 'magic', 'sorcer', 'wizard', 'goddess', 'priest', 'casino', 'gambl', 'jackpot', 'lotter', 'whisk', 'vodka', 'booze', 'tavern', 'witch', 'enchant', 'spellb'];
// profanity: copied from server/names.js (shared code cannot import server files: the phone build has no server/)
const BAD = [
  'fuck', 'shit', 'cunt', 'bitch', 'bastard', 'whore', 'slut', 'dick', 'cock', 'pussy', 'penis', 'vagina', 'porn',
  'nigg', 'faggot', 'retard', 'kike', 'chink', 'gook', 'wetback', 'tranny', 'nazi', 'hitler', 'isis', 'terror', 'molest',
  'wank', 'twat', 'jizz', 'boob', 'tits', 'nude', 'naked', 'horny', 'piss', 'asshole', 'motherf', 'killyourself', 'rapist',
];
const BAD_EDGE = ['ass', 'cum', 'fag', 'fuk', 'tit', 'kys', 'sex', 'anal', 'anus', 'arse', 'rape', 'spic', 'niga', 'pedo', 'paedo', 'kkk', 'damn', 'crap', 'wtf', 'stfu', 'sexy'];
const BAD_OK = new Set(['dickens', 'cockburn', 'hancock', 'peacock', 'woodcock', 'babcock', 'cassius', 'bassett', 'sussex', 'essex', 'cumbria', 'titus', 'titan', 'titans', 'analise', 'janus', 'uranus', 'grape', 'drape', 'spicer', 'torpedo', 'sexton', 'assam', 'assassin', 'crisis', 'cockpit', 'stopcock', 'shitake', 'scunthorpe', 'pistol', 'pistols', 'dickson', 'cocked', 'terrors', 'terrain', 'terrace', 'terraces']);
// about 200 common women's given names: in lowercase lines the proper-name rule cannot see a name, this list does
export const FEMALE_NAMES = new Set(W(`mary anna emma olivia ava sophia isabella mia amelia harper evelyn abigail emily ella elizabeth camila luna sofia avery
  mila aria scarlett penelope layla chloe victoria madison eleanor grace nora riley zoey hannah hazel lily ellie violet lillian zoe
  stella aurora natalie emilia everly leah aubrey willow addison lucy audrey bella nova brooklyn paisley savannah claire skylar isla
  genesis naomi elena caroline eliana anna maya valentina ruby kennedy ivy ariana aaliyah cora madelyn alice kinsley hailey gabriella
  allison gianna serenity samantha sarah autumn quinn eva piper sophie sadie delilah josephine nevaeh adeline arya emery lydia
  clara vivian madeline peyton julia rylee brielle reagan natalia jade athena maria leilani everleigh liliana melanie mackenzie
  hadley raelynn kaylee rose arianna isabelle melody eliza lyla katherine aubree adalynn kylie faith marly margaret ximena iris
  alexandra jasmine charlotte amara khloe elise lila jessica jennifer linda patricia barbara susan karen nancy betty helen sandra
  donna carol ruth sharon michelle laura kimberly deborah dorothy amy angela ashley brenda pamela nicole katie anne kathleen
  christine debra rachel carolyn janet catherine heather diane joyce frances gloria teresa doris cheryl mildred jean judith megan
  andrea janice beverly denise marilyn amber danielle brittany diana wendy rebecca martha shirley virginia alexis tiffany kayla
  fatima aisha khadija maryam zainab amina layla yasmin noor salma huda leila zara mariam sana rania hiba fiona bridget molly
  greta ingrid astrid freya helga sigrid gwen gwendolyn guinevere morgana elaine isolde rowena matilda edith agnes beatrice
  esther miriam rebekah deborah judy trudy wanda tina gina lisa lena nina tara vera wilma irma alma ada ida nell nellie peggy
  polly sally sue jane joan june kate kim lucia marta paula rita rosa sonia tanya ursula yvonne zelda`));

// the game's own names (zones, areas, dungeons, NPCs, mobs, items, quests, factions, events, pets, classes, adventurers)
let GAME = null;
const lc = (s) => String(s ?? '').toLowerCase().replace(/’/g, "'");
export function gameNames() {
  if (GAME) return GAME;
  const names = new Set(), tokens = new Set();
  const add = (n) => { n = lc(n).replace(/[^a-z' -]/g, ' ').replace(/\s+/g, ' ').trim(); if (!n) return; names.add(n); for (const t of n.split(/[ -]/)) if (t) { tokens.add(t); tokens.add(t.replace(/'s$/, '')); } };
  for (const n of NPCS) { add(n.name); add(n.title); }
  for (const m of Object.values(MOBS)) add(m.name);
  for (const i of Object.values(ITEMS)) add(i.name);
  for (const q of Object.values(QUESTS)) add(q.name || q.title);
  for (const z of ZONES) add(z.name);
  for (const a of AREAS) add(a.name);
  for (const d of DUNGEONS) add(d.name);
  for (const c of Object.values(CLASSES)) add(c.name);
  for (const f of Object.values(FACTIONS || {})) add(f?.name);
  for (const e of WORLD_EVENTS || []) add(e.name);
  for (const p of Object.values(PETS || {})) add(p?.name);
  for (const w of WANDERERS) add(w.name);
  // multi-word names by first word, longest first, for masking whole names out of a line
  const byFirst = new Map();
  for (const n of names) { const f = n.split(/[ -]/)[0]; if (!byFirst.has(f)) byFirst.set(f, []); byFirst.get(f).push(n); }
  for (const L of byFirst.values()) L.sort((a, b) => b.length - a.length);
  GAME = { names, tokens, byFirst };
  return GAME;
}
// words that may be capitalised mid-sentence without being a name
const CAPS_OK = new Set(W(`i im i'm ive i've ill i'll id i'd ok okay gg lfg lfm lf wts wtb xp dps afk brb aye np ty thx omw tbh idk btw imo hp mp
  gl hf tank healer dd pvp pve no yes hey hi oh ah um hm hmm so but and or the a an it its my me we us you your they them our
  sure nice right well yeah yep nah mate cheers thanks lol haha`));

const ALL = new Map(); // word -> category
for (const [k, L] of Object.entries(BLOCK)) for (const w of L) if (!ALL.has(w)) ALL.set(w.replace(/_/g, ''), k);
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'l', '+': 't' };

// lowercase, marks removed, leet undone, "m a g i c" and "s.p.e.l.l" joined; returns the list of word tokens
export function normWords(text) {
  let s = lc(text).normalize('NFKD').replace(/[̀-ͯ]/g, '');
  // join runs of 3+ single characters split by spaces, dots, dashes, stars or underscores ("m a g i c", "s.p.e.l.l")
  s = s.replace(/(?:^|(?<=\s))((?:[a-z0-9@$!][\s.\-_*]+){2,}[a-z0-9@$!])(?=\s|$|[,.!?])/g, (m) => m.replace(/[\s.\-_*]+/g, ''));
  // leet only inside a word ("w0man", "l1ck", "$pell"): trailing "!" or "?" stays punctuation
  s = s.split(/\s+/).map((t) => { const core = t.replace(/[!?.,;:]+$/, ''); return /[a-z]/.test(core) ? core.replace(/[0-9@$!|+]/g, (c) => LEET[c] ?? c) : t; }).join(' ');
  return s.split(/[^a-z']+/).map((t) => t.replace(/^'+|'+$/g, '')).filter(Boolean);
}
const variants = (t) => {
  const v = new Set([t]);
  const two = t.replace(/(.)\1{2,}/g, '$1$1'); v.add(two);
  if (two !== t) v.add(t.replace(/(.)\1+/g, '$1'));
  for (const x of [...v]) { if (x.endsWith('es')) v.add(x.slice(0, -2)); if (x.endsWith('s')) v.add(x.slice(0, -1)); if (x.endsWith("'s")) v.add(x.slice(0, -2)); }
  return v;
};
// mask whole game names out of a lowercase line (so their words are not matched against the lists)
function maskGame(low) {
  const G = gameNames();
  const parts = low.split(/(\s+)/);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i].replace(/[^a-z'-]/g, '');
    const L = w && G.byFirst.get(w.split('-')[0]);
    let hit = 0;
    if (L) for (const n of L) {
      const nw = n.split(' ').length;
      const span = parts.slice(i, i + nw * 2 - 1).join('').replace(/[^a-z' -]/g, '').replace(/\s+/g, ' ').trim();
      if (span === n || span.replace(/'s$/, '') === n) { hit = nw * 2 - 1; break; }
    }
    if (hit) { out.push(' '.repeat(parts.slice(i, i + hit).join('').length)); i += hit - 1; } else out.push(parts[i]);
  }
  return out.join('');
}

// what a line is about, for the checks: the first category hit or null
export function blockedWord(text, opts = {}) {
  const low = maskGame(lc(text));
  const toks = normWords(low);
  for (const t of toks) {
    for (const v of variants(t)) {
      const c = ALL.get(v);
      if (c) return { cat: c, word: t };
      if (FEMALE_NAMES.has(v) && !gameNames().tokens.has(v) && !(opts.names && opts.names.has(v))) return { cat: 'feminine', word: t };
    }
    if (STEMS.some((s) => t.includes(s))) return { cat: 'stem', word: t };
    if (!BAD_OK.has(t)) {
      if (BAD.some((b) => t.includes(b))) return { cat: 'profanity', word: t };
      for (const v of variants(t)) if (BAD_EDGE.includes(v)) return { cat: 'profanity', word: t };
    }
  }
  // the same words run together with no spaces at all ("bestofluck", "realperson")
  const flat = toks.join('');
  if (/(?:^|[^a-z])?(bestofluck|goodluck|realperson|realhuman|imhuman|iamhuman)/.test(flat)) return { cat: 'flat', word: flat };
  // (v122 review) phrases: luck, drink, romance, self-harm, real life, links spelled out
  const sp = ' ' + toks.join(' ') + ' ';
  const ph = sp.match(/ (fingers crossed|knock on wood|flip a coin|coin flip|a cold one|love (you|u|ya)|kill (yourself|urself|ur self|myself)|(cut|cutting|hurt|hurting) myself|end it all|real life|dot (com|net|org)|oh my (god|lord)|thank god|god willing|by god) /);
  if (ph) return { cat: 'phrase', word: ph[1] };
  return null;
}

const AI_CLAIM = /\b(as an ai|an ai\b|a\.i\.|i'?m an ai|i am an ai|ai model|language model|large language|chat ?bot|assistant|trained on|my training|system prompt|prompt|algorithm|programmed|my creators?|neural|machine learning|artificial intelligence|computer program)\b|\bai\b/i;
const HUMAN_CLAIM = /\b(i'?m|i am|im)\s+(a\s+)?(real\s+)?(human|person|people|guy irl)\b|\breal (person|human|player|people)\b|\bnot an? (bot|ai|robot|program)\b|\bi'?m not (a )?bot\b|\bflesh and blood\b|\bhuman being\b|\birl\b|\b(i'?m|i am|im)\s+(real|alive|not (a )?(bot|robot|npc|program))\b|\b(actual|living|live|normal|regular) (person|human|player|guy|bloke)\b|\bflesh and (bone|blood)\b|\ba (guy|bloke|dude|lad) (on|at|behind) (my|his|a|the) (pc|computer|keyboard|screen)\b|\bbehind (the|this|my) (screen|keyboard)\b|\bsomeone (plays|controls|is playing) me\b/i;
const CONTACT = /\b(dm me|pm me|add me on|message me on|hit me up on|my (discord|insta|email|number|phone))\b|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|#\d{4}\b|\d{5,}|\b\d{3}[-. ]\d{3,4}[-. ]\d{4}\b/i;
// (v122 review) common words of other languages a small model may answer in
const FOREIGN = /\b(hola|soy|eres|estoy|gracias|humano|humana|tambien|oui|suis|merci|bonjour|humain|ich|bin|nicht|danke|mensch|sono|grazie|ciao|obrigado|voce|evet|merhaba|nahi|haan|kya|hoon)\b/i;
const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|gg|tv|ly|co|uk|me|app|dev|xyz)\b)/i;
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}]/gu;

// first line, no "Name:" prefix, quotes, markdown, *roleplay*, hashtags, @-mentions or emoji; plain ASCII plus ’
export function shapeLine(text, botName) {
  let s = String(text ?? '').replace(/\r/g, '');
  s = s.split('\n').map((l) => l.trim()).find((l) => l) || '';
  const raw = s;
  s = s.replace(/^\s*(?:\[[^\]]{1,20}\]\s*)?(?:[A-Z][A-Za-z']{1,14}(?: \(bot\))?|you|me)\s*:\s+/i, (m) => (/^[A-Za-z' ()[\]]+:\s+$/.test(m) ? '' : m));
  if (botName) s = s.replace(new RegExp('^' + botName + '\\s*[:\\-]\\s*', 'i'), '');
  s = s.replace(/(^|\s)[#@][\w-]+/g, ' ');
  s = s.replace(/\*[^*]{1,60}\*/g, ' ').replace(/[*_`~>#]+/g, ' ');
  const emo = (s.match(EMOJI) || []).length;
  s = s.replace(EMOJI, '');
  s = s.replace(/[‘‛]/g, "'").replace(/[“”„«»]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E’]/g, '');
  s = s.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
  return { text: s, emo, raw };
}

const STOP = new Set(W('the a an and or to of in on at for it is i you we my me so but be was are that this with up out go get got'));
const sig = (s) => lc(s).replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
export function nearSame(a, b) {
  const A = sig(a), B = sig(b);
  if (!A || !B) return false;
  if (A === B) return true;
  const wa = new Set(A.split(' ')), wb = new Set(B.split(' '));
  if (wa.size < 3 || wb.size < 3) return false;
  let both = 0; for (const w of wa) if (wb.has(w)) both++;
  return both / (wa.size + wb.size - both) >= 0.8;
}

export function filterLine(text, ctx = {}) {
  const ch = ctx.channel || 'say';
  const no = (why) => ({ ok: false, text: '', why });
  if (typeof text !== 'string' || !text.trim()) return no('empty');
  if (URL_RE.test(text)) return no('url');
  if (CONTACT.test(text) || /[a-z]#\d{3,}/i.test(text)) return no('contact'); // (v122 review: before shaping strips '#' and '@')
  if (FOREIGN.test(text)) return no('language'); // (v122 review) English only: the lists cannot check another language
  const sh = shapeLine(text, ctx.self);
  let s = sh.text;
  if (!s) return no(sh.emo ? 'emoji' : 'empty');
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  if (sh.emo && sh.emo * 3 > letters) return no('emoji');
  if (letters < 1) return no('empty');
  if (s.length > (ch === 'world' ? 100 : 140)) return no('length');
  const words = s.split(' ');
  if (words.length > 22) return no('words');
  const caps = (s.match(/[A-Z]/g) || []).length;
  if (letters > 8 && caps / letters > 0.6) return no('shouting');
  if (/(.)\1{3,}/.test(s)) return no('repeat-char');
  const wc = new Map();
  for (const w of words.map((x) => lc(x).replace(/[^a-z']/g, '')).filter((x) => x && !STOP.has(x))) wc.set(w, (wc.get(w) || 0) + 1);
  if ([...wc.values()].some((n) => n >= 3)) return no('repeat-word');
  for (const r of ctx.recent || []) if (nearSame(s, r)) return no('duplicate');
  if (/"/.test(s) || /\b(typed|types|replied|replies|whispers)\s*[,.]?\s*$|\b[A-Z][a-z]+ (typed|replied)\b/.test(s)) return no('narration'); // a model narrating ("... Vance typed")
  if (CONTACT.test(s)) return no('contact');
  if (HUMAN_CLAIM.test(s)) return no('human-claim');
  if (!ctx.disclose && AI_CLAIM.test(s)) return no('ai-claim');
  const names = new Set([...(ctx.names || [])].map(lc));
  const bw = blockedWord(s, { names });
  if (bw) return no(bw.cat + ':' + bw.word);
  // invented names: a capitalised word mid-sentence that is no game name, no known person and no common word
  const G = gameNames();
  const toks = s.split(/(\s+)/).filter((x) => x.trim());
  let start = true;
  for (const t of toks) {
    const w = t.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');
    if (w && /^[A-Z]/.test(w) && !start) {
      const l = lc(w).replace(/'s$/, '');
      if (!CAPS_OK.has(l) && !G.tokens.has(l) && !names.has(l) && !(w.length <= 4 && w === w.toUpperCase())) return no('name:' + w);
    }
    start = /[.!?]["']?$/.test(t) || (start && !w);
  }
  return { ok: true, text: s, why: null };
}
