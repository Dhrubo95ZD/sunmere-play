// Living bots, part B.1, B.2 and B.8 (docs/ai/living_bots_design.md): the roster of the valley's bots, their personas and
// their guilds. Owner: Builder B.
//
// BOT_SEEDS is APPEND-ONLY. A seed's index is that bot's identity in every save (bot1roster, and C's bot1mem<i>), so never
// reorder, rename or remove an entry: retire it in the save instead (ret). The first 14 are the WANDERERS of data.js, in
// their order and with their levels (the ring ladder, the buy-order sellers and older tests name them). All bots are men;
// every name is letters only, at most 10 letters, and follows CLAUDE.md section 2 (no women's names, nothing spiritual,
// nothing animal-like).
import { mulberry32 } from './noise.js';

export const BOT_SEEDS = [
  // the 14 WANDERERS (data.js 267 and 790)
  { name: 'Kellan', cls: 'knight', lvl: 3 }, { name: 'Osric', cls: 'herbalist', lvl: 4 }, { name: 'Jarek', cls: 'ranger', lvl: 6 },
  { name: 'Dario', cls: 'sandblade', lvl: 7 }, { name: 'Marek', cls: 'warden', lvl: 9 }, { name: 'Halvard', cls: 'chemist', lvl: 10 },
  { name: 'Faris', cls: 'sandblade', lvl: 11 }, { name: 'Karim', cls: 'ranger', lvl: 13 }, { name: 'Lucan', cls: 'knight', lvl: 14 },
  { name: 'Stellan', cls: 'chemist', lvl: 16 }, { name: 'Viggo', cls: 'warden', lvl: 17 }, { name: 'Anwar', cls: 'herbalist', lvl: 19 },
  { name: 'Eamon', cls: 'knight', lvl: 21 }, { name: 'Rurik', cls: 'chemist', lvl: 23 },
  // the rest of the roster (16 Nov 2026): a spread of classes and levels, from new arrivals to the outer areas
  { name: 'Rashid', cls: 'deadeye', lvl: 1 }, { name: 'Edwin', cls: 'warden', lvl: 2 },
  { name: 'Harlan', cls: 'herbalist', lvl: 5 }, { name: 'Bastian', cls: 'ranger', lvl: 8 }, { name: 'Corin', cls: 'knight', lvl: 12 },
  { name: 'Tarik', cls: 'deadeye', lvl: 15 }, { name: 'Brandt', cls: 'warden', lvl: 18 }, { name: 'Emeric', cls: 'herbalist', lvl: 22 },
  { name: 'Wystan', cls: 'sandblade', lvl: 25 }, { name: 'Alaric', cls: 'chemist', lvl: 28 }, { name: 'Baldwin', cls: 'knight', lvl: 30 },
  { name: 'Cedric', cls: 'herbalist', lvl: 33 }, { name: 'Desmond', cls: 'deadeye', lvl: 36 }, { name: 'Fabian', cls: 'warden', lvl: 39 },
  { name: 'Hakon', cls: 'ranger', lvl: 41 }, { name: 'Jorund', cls: 'knight', lvl: 43 }, { name: 'Kasim', cls: 'herbalist', lvl: 46 },
  { name: 'Nadir', cls: 'sandblade', lvl: 48 }, { name: 'Orrin', cls: 'warden', lvl: 51 }, { name: 'Percival', cls: 'chemist', lvl: 53 },
  { name: 'Quentin', cls: 'herbalist', lvl: 56 }, { name: 'Ragnar', cls: 'knight', lvl: 58 }, { name: 'Samir', cls: 'deadeye', lvl: 61 },
  { name: 'Vance', cls: 'ranger', lvl: 63 }, { name: 'Walden', cls: 'warden', lvl: 1 }, { name: 'Zahir', cls: 'chemist', lvl: 3 },
  // spares, brought in one a day when more than half the roster has reached the level cap (B.1); they start at level 1
  { name: 'Conrad', cls: 'knight', lvl: 1 }, { name: 'Darian', cls: 'ranger', lvl: 1 }, { name: 'Garth', cls: 'warden', lvl: 1 },
  { name: 'Henrik', cls: 'herbalist', lvl: 1 }, { name: 'Ivor', cls: 'sandblade', lvl: 1 }, { name: 'Joren', cls: 'deadeye', lvl: 1 },
  { name: 'Lambert', cls: 'chemist', lvl: 1 }, { name: 'Nils', cls: 'knight', lvl: 1 }, { name: 'Otto', cls: 'warden', lvl: 1 },
  { name: 'Rafiq', cls: 'herbalist', lvl: 1 }, { name: 'Soren', cls: 'ranger', lvl: 1 }, { name: 'Tamer', cls: 'sandblade', lvl: 1 },
];

// bot guilds (B.8): plain names of work and places (no emblems, luck or religion)
export const BOT_GUILDS = ['Millrace Hands', 'Steam and Spanner', 'Westfold Ledger', 'Ironcliff Haulers'];

export const PERSONA = {
  moods: ['cheerful', 'dry', 'earnest', 'gruff', 'quiet'],
  likes: ['crafting', 'dungeons', 'duels', 'salvage', 'mapping', 'cooking', 'gear', 'helping new folk', 'gathering', 'world bosses'],
  quirks: ['says aye', 'ends with tho', 'calls people mate', 'short replies', 'asks questions', 'none'],
};
export const ROLE_OF = { knight: 'tank', warden: 'tank', herbalist: 'healer', ranger: 'damage', chemist: 'damage', sandblade: 'damage', deadeye: 'damage' };

// a stable number from a name (FNV-1a), so a persona comes out the same with or without a save
export function nameSeed(name, salt = 0) {
  let h = 0x811c9dc5 ^ salt;
  for (const c of String(name)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

// B.2: made once from the name, then saved and never re-rolled
// (S15) how a bot fights, from its own seed so the older persona fields keep their values: skill, the share of planned
// fusions it completes (0.35 casual to 0.85 skilled, combat_design.md 8), and build, the Skill Web list it follows by role
// (shared/botplan.js BOT_BUILDS: a tank or a healer mostly the defence/support list, a damage bot mostly the damage one)
export function fightStyle(seed) {
  const r = mulberry32(nameSeed(seed.name, 0x5c11));
  const skill = +(0.35 + 0.5 * Math.sqrt(r())).toFixed(2);
  const role = ROLE_OF[seed.cls] || 'damage', u = r();
  const build = role === 'damage' ? (u < 0.6 ? 'damage' : 'mixed') : (u < 0.7 ? 'defence' : 'mixed');
  return { skill, build };
}
export function makePersona(seed) {
  const r = mulberry32(nameSeed(seed.name, 0x5eed));
  const f = (a, b) => +(a + (b - a) * r()).toFixed(2);
  const pick = (L) => L[Math.floor(r() * L.length)];
  const likes = [];
  while (likes.length < 2) { const l = pick(PERSONA.likes); if (!likes.includes(l)) likes.push(l); }
  // play days: most days of the week, a few days off (7-bit mask, bit 0 = Sunday)
  let days = 0;
  for (let d = 0; d < 7; d++) if (r() < 0.72) days |= 1 << d;
  if (!days) days = 1 << Math.floor(r() * 7);
  // most people play in the evening; some in the afternoon or late at night
  const start = [17, 18, 19, 20, 20, 21, 21, 22, 15, 16, 12, 23, 9, 13][Math.floor(r() * 14)];
  return {
    v: 1, social: f(0.1, 0.9), talk: f(0.1, 0.9), case: r() < 0.55 ? 'lower' : 'normal', punct: pick(['none', 'light', 'full']),
    typo: f(0, 0.04), mood: pick(PERSONA.moods), likes, quirk: pick(PERSONA.quirks),
    play: { days, start, len: Math.round(40 + r() * 120) }, pace: f(0.4, 0.9), role: ROLE_OF[seed.cls] || 'damage', ...fightStyle(seed),
  };
}

// B.8: each bot gets 2-4 friends at roster creation, by level band and persona fit (both social, or both quiet)
export function makeFriends(bots) {
  for (const B of bots) B.prog.friends = B.prog.friends || [];
  for (const B of bots) {
    const r = mulberry32(nameSeed(B.name, 0xf00d));
    const want = 2 + Math.floor(r() * 3);
    const cands = bots.filter((C) => C !== B && !B.prog.friends.includes(C.i))
      .map((C) => ({ C, s: Math.abs(C.prog.level - B.prog.level) / 6 + Math.abs(C.persona.social - B.persona.social) + r() * 0.8 }))
      .sort((a, b) => a.s - b.s);
    for (const { C } of cands) {
      if (B.prog.friends.length >= want) break;
      if (C.prog.friends.length >= 4) continue;
      B.prog.friends.push(C.i); C.prog.friends.push(B.i);
    }
  }
}
